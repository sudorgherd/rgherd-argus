"""Commit-free core mutations exposed through the ARGUS module host.

These functions contain the same validation, audit, and activity behavior used
by ARGUS's HTTP routes. Callers own the surrounding transaction.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import AuditEvent, Record, RecordAssignment, Responder
from .record_activity import bump_record_activity, mark_record_activity_seen_by_subject


ALLOWED_CATEGORIES = {
    "Safety / Threat / Health",
    "Basic Needs (Shelter / Food / Supplies)",
    "Escort / Transport",
    "Legal Support / Observer",
    "Logistics / Coordination",
    "Other Support",
}
ALLOWED_SEVERITIES = {"Low", "Medium", "High", "Critical"}
ALLOWED_PROFESSIONAL_ESCALATION = {"yes", "no", "unknown"}
ALLOWED_STATUSES = {
    "new",
    "under_review",
    "notified",
    "assigned",
    "active",
    "resolved",
    "closed",
}
ALLOWED_VERIFICATION_STATES = {
    "pending",
    "unverified",
    "verified",
    "not_applicable",
}

RecordNotification = Callable[[Session, Record], dict[str, Any] | None]
AssignmentNotification = Callable[
    [Session, Record, Responder, str | None],
    dict[str, Any] | None,
]
PresenceResolver = Callable[[Responder, Session | None], str]


def _write_audit_event(
    db: Session,
    *,
    actor_id: str,
    event_type: str,
    record_id: int | None,
    event_metadata: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditEvent(
            actor_id=actor_id,
            event_type=event_type,
            record_id=record_id,
            event_metadata=event_metadata,
            created_at=datetime.utcnow(),
        ),
    )


def create_record_in_transaction(
    db: Session,
    values: Mapping[str, Any],
    *,
    actor_id: str,
    notify: RecordNotification | None = None,
) -> Record:
    """Create a canonical record without committing the caller's transaction."""

    category = values.get("category")
    severity = values.get("severity")
    escalation = values.get("professional_escalation")
    active_response = values.get("active_response")

    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    if severity not in ALLOWED_SEVERITIES:
        raise HTTPException(status_code=400, detail="Invalid severity")
    if escalation is not None and escalation not in ALLOWED_PROFESSIONAL_ESCALATION:
        raise HTTPException(
            status_code=400,
            detail="Invalid professional_escalation value",
        )
    if (
        active_response
        and category == "Safety / Threat / Health"
        and escalation is None
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "professional_escalation is required for "
                "Safety / Threat / Health when active_response is true"
            ),
        )

    record = Record(
        summary=str(values.get("summary") or "").strip(),
        category=category,
        severity=severity,
        active_response=bool(active_response),
        professional_escalation=escalation,
        location=(str(values["location"]).strip() if values.get("location") else None),
        zone_id=values.get("zone_id"),
        source_type=(
            str(values["source_type"]).strip() if values.get("source_type") else None
        ),
        internal_notes_summary=(
            str(values["internal_notes_summary"]).strip()
            if values.get("internal_notes_summary")
            else None
        ),
        status="new",
        verification_state=values.get("verification_state") or "pending",
        created_by=actor_id,
    )
    db.add(record)
    db.flush()

    mark_record_activity_seen_by_subject(db, record, actor_id)
    _write_audit_event(
        db,
        actor_id=actor_id,
        event_type="record_created",
        record_id=record.id,
        event_metadata={
            "category": record.category,
            "severity": record.severity,
            "active_response": record.active_response,
            "status": record.status,
            "verification_state": record.verification_state,
        },
    )

    if notify is not None:
        try:
            send_result = notify(db, record)
        except Exception as exc:  # Preserve existing best-effort Matrix behavior.
            send_result = {
                "ok": False,
                "reason": "matrix_send_exception",
                "detail": str(exc),
                "zone_id": record.zone_id,
            }
        if send_result is not None:
            _write_audit_event(
                db,
                actor_id=actor_id,
                event_type="matrix_zone_auto_send",
                record_id=record.id,
                event_metadata=send_result,
            )

    return record


def create_assignment_in_transaction(
    db: Session,
    *,
    record_id: int,
    responder_id: int,
    actor_id: str,
    dispatcher_note: str | None = None,
    get_presence: PresenceResolver,
    notify: AssignmentNotification | None = None,
) -> tuple[RecordAssignment, dict[str, Any] | None]:
    """Create a canonical dispatcher assignment without committing."""

    record = db.query(Record).filter(Record.id == record_id).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    if record.archived_at is not None:
        raise HTTPException(status_code=400, detail="Archived records are read-only")

    responder = db.query(Responder).filter(Responder.id == responder_id).first()
    if responder is None:
        raise HTTPException(status_code=404, detail="Responder not found")
    if not responder.is_active:
        raise HTTPException(status_code=400, detail="Responder is inactive")
    if get_presence(responder, db) == "Offline":
        raise HTTPException(status_code=400, detail="Responder is offline")

    existing = (
        db.query(RecordAssignment)
        .filter(
            RecordAssignment.record_id == record_id,
            RecordAssignment.responder_id == responder_id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="Responder already assigned to this record",
        )

    assignment = RecordAssignment(
        record_id=record_id,
        responder_id=responder_id,
        assignment_state="assigned",
        assigned_by=actor_id,
        assigned_at=datetime.utcnow(),
        dispatcher_note=dispatcher_note,
    )
    db.add(assignment)
    db.flush()
    bump_record_activity(db, record, actor_id)
    _write_audit_event(
        db,
        actor_id=actor_id,
        event_type="responder_assigned",
        record_id=record_id,
        event_metadata={
            "assignment_id": assignment.id,
            "responder_id": responder.id,
            "assignment_state": assignment.assignment_state,
            "dispatcher_note": dispatcher_note,
        },
    )

    send_result = None
    if notify is not None:
        try:
            send_result = notify(db, record, responder, dispatcher_note)
        except Exception as exc:  # Preserve existing best-effort Matrix behavior.
            send_result = {
                "ok": False,
                "reason": "matrix_send_exception",
                "detail": str(exc),
                "responder_id": responder.id,
                "matrix_user_id": responder.matrix_user_id,
                "dm_room_id": responder.dm_room_id,
            }
        _write_audit_event(
            db,
            actor_id=actor_id,
            event_type="matrix_assignment_auto_send",
            record_id=record_id,
            event_metadata={
                "assignment_id": assignment.id,
                "responder_id": responder.id,
                **(send_result or {"ok": False, "reason": "no_result"}),
            },
        )

    return assignment, send_result


def delete_assignment_in_transaction(
    db: Session,
    *,
    record_id: int,
    assignment_id: int,
    actor_id: str,
) -> dict[str, Any]:
    """Delete the exact canonical dispatcher assignment without committing."""

    record = db.query(Record).filter(Record.id == record_id).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    if record.archived_at is not None:
        raise HTTPException(status_code=400, detail="Archived records are read-only")

    assignment = (
        db.query(RecordAssignment)
        .filter(
            RecordAssignment.id == assignment_id,
            RecordAssignment.record_id == record_id,
        )
        .first()
    )
    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found")

    deleted = {
        "id": assignment.id,
        "record_id": assignment.record_id,
        "responder_id": assignment.responder_id,
        "assignment_state": assignment.assignment_state,
        "assigned_by": assignment.assigned_by,
        "assigned_at": assignment.assigned_at,
        "cleared_at": assignment.cleared_at,
        "dispatcher_note": assignment.dispatcher_note,
    }
    _write_audit_event(
        db,
        actor_id=actor_id,
        event_type="responder_unassigned",
        record_id=record_id,
        event_metadata={
            "assignment_id": assignment.id,
            "responder_id": assignment.responder_id,
            "assignment_state": assignment.assignment_state,
            "dispatcher_note": assignment.dispatcher_note,
        },
    )
    bump_record_activity(db, record, actor_id)
    db.delete(assignment)
    db.flush()
    return deleted


def set_record_lifecycle_in_transaction(
    db: Session,
    *,
    record_id: int,
    status: str,
    actor_id: str,
    closure: Mapping[str, Any] | None = None,
) -> Record:
    """Apply a generic record lifecycle target without committing."""

    if status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    record = db.query(Record).filter(Record.id == record_id).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    if record.archived_at is not None:
        raise HTTPException(status_code=400, detail="Archived records are read-only")
    if record.status == status:
        return record

    previous_status = record.status
    if status == "closed":
        uncleared_assignments = (
            db.query(RecordAssignment)
            .filter(
                RecordAssignment.record_id == record_id,
                RecordAssignment.cleared_at.is_(None),
            )
            .count()
        )
        if uncleared_assignments:
            raise HTTPException(
                status_code=400,
                detail="All responders must be unassigned or cleared before closing",
            )
        closure = closure or {}
        outcome_type = str(closure.get("outcome_type") or "").strip()
        outcome_notes = str(closure.get("outcome_notes") or "").strip()
        if not outcome_type or not outcome_notes:
            raise HTTPException(
                status_code=400,
                detail="Structured closure details are required",
            )
        now = datetime.utcnow()
        record.status = status
        record.closed_by = actor_id
        record.closed_at = now
        record.outcome_type = outcome_type
        record.outcome_notes = outcome_notes
        record.responders_involved = closure.get("responders_involved") or []
        record.need_met = bool(closure.get("need_met", False))
        record.follow_up_needed = bool(closure.get("follow_up_needed", False))
        record.updated_at = now
        event_type = "record_closed"
        metadata: dict[str, Any] = {
            "status": record.status,
            "closed_by": record.closed_by,
            "closed_at": record.closed_at.isoformat(),
            "outcome_type": record.outcome_type,
            "need_met": record.need_met,
            "follow_up_needed": record.follow_up_needed,
        }
    else:
        record.status = status
        record.updated_at = datetime.utcnow()
        event_type = "record_updated"
        metadata = {
            "changes": {"status": {"from": previous_status, "to": status}},
            "current": {
                "category": record.category,
                "status": record.status,
                "verification_state": record.verification_state,
                "severity": record.severity,
                "active_response": record.active_response,
                "professional_escalation": record.professional_escalation,
                "location": record.location,
                "responder_instructions": record.responder_instructions,
                "internal_notes_summary": record.internal_notes_summary,
            },
        }

    db.add(record)
    db.flush()
    bump_record_activity(db, record, actor_id)
    _write_audit_event(
        db,
        actor_id=actor_id,
        event_type=event_type,
        record_id=record.id,
        event_metadata=metadata,
    )
    return record
