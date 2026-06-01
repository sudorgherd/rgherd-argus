import os
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
from typing import Any

import requests
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session
from starlette.middleware.sessions import SessionMiddleware

from .core.config import BOOT_CONFIG
from .auth import oauth
from .database import SessionLocal, engine
from .models import Record as RecordModel, RecordAssignment as RecordAssignmentModel, RecordNote as RecordNoteModel, AuditEvent as AuditEventModel, SystemAuditEvent as SystemAuditEventModel, Base, Responder, ResponderZone, SystemSetting, Zone
from .matrix_config import MATRIX_CONFIG, MatrixConfig
from authlib.integrations.base_client.errors import MismatchingStateError


app = FastAPI(title="Argus Operator Interface")

app.add_middleware(
    SessionMiddleware,
    secret_key=BOOT_CONFIG.session_secret,
    same_site="lax",
    https_only=True,
)

ALLOWED_CATEGORIES = {
    "Safety / Threat / Health",
    "Basic Needs (Shelter / Food / Supplies)",
    "Escort / Transport",
    "Legal Support / Observer",
    "Logistics / Coordination",
    "Other Support",
}

ALLOWED_SEVERITIES = {
    "Low",
    "Medium",
    "High",
    "Critical",
}

ALLOWED_PROFESSIONAL_ESCALATION = {
    "yes",
    "no",
    "unknown",
}

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


ALLOWED_RESPONDER_AVAILABILITY = {
    "Available",
    "Busy",
    "Away",
}

FRONTEND_DIR = "/opt/argus/frontend"
FRONTEND_INDEX = os.path.join(FRONTEND_DIR, "index.html")
FRONTEND_ASSETS = os.path.join(FRONTEND_DIR, "assets")

MAS_ADMIN_BASE_URL = BOOT_CONFIG.mas_admin_base_url or ""
MAS_ADMIN_CLIENT_ID = BOOT_CONFIG.mas_admin_client_id
MAS_ADMIN_CLIENT_SECRET = BOOT_CONFIG.mas_admin_client_secret
MAS_ADMIN_REQUEST_TIMEOUT_SECONDS = BOOT_CONFIG.mas_admin_request_timeout_seconds
MATRIX_USER_DOMAIN = MATRIX_CONFIG.user_domain
MAS_USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9._=\-/]+$")

if os.path.isdir(FRONTEND_ASSETS):
    app.mount("/assets", StaticFiles(directory=FRONTEND_ASSETS), name="assets")


class RecordCreate(BaseModel):
    summary: str
    category: str
    severity: str
    active_response: bool
    professional_escalation: str | None = None
    verification_state: str | None = None
    source_type: str | None = None
    location: str | None = None
    zone_id: int | None = None
    internal_notes_summary: str | None = None


class RecordUpdate(BaseModel):
    category: str | None = None
    status: str | None = None
    verification_state: str | None = None
    severity: str | None = None
    active_response: bool | None = None
    professional_escalation: str | None = None
    location: str | None = None
    responder_instructions: str | None = None
    internal_notes_summary: str | None = None



class RecordAssignmentCreate(BaseModel):
    responder_id: int
    dispatcher_note: str | None = None


class RecordClose(BaseModel):
    outcome_type: str
    outcome_notes: str
    responders_involved: list | None = None
    need_met: bool
    follow_up_needed: bool


class RecordReopen(BaseModel):
    reason: str | None = None


class RecordArchive(BaseModel):
    reason: str | None = None



class ResponderAvailabilityUpdate(BaseModel):
    availability: str


class ZoneCreate(BaseModel):
    name: str
    description: str | None = None
    matrix_room_id: str | None = None


class ZoneUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    matrix_room_id: str | None = None


class ResponderZoneCreate(BaseModel):
    zone_id: int


class ResponderAdminUpsert(BaseModel):
    subject_id: str
    display_name: str
    matrix_user_id: str | None = None
    dm_room_id: str | None = None
    role: str | None = "Responder"
    skills: list[str] | None = None
    is_active: bool = True
    is_approved: bool = False
    is_admin: bool = False
    can_dispatch: bool = False
    can_respond: bool = True


class RecordNoteCreate(BaseModel):
    body: str
    visibility: str | None = "internal"


class AssignmentStateUpdate(BaseModel):
    assignment_state: str | None = None
    mark_cleared: bool = False


class MatrixManualAlertCreate(BaseModel):
    destination: str
    responder_id: int | None = None
    zone_id: int | None = None
    dispatcher_note: str | None = None


class PresenceSettingsUpdate(BaseModel):
    idle_minutes: int
    offline_minutes: int


class MatrixSettingsUpdate(BaseModel):
    homeserver_url: str | None = None
    sender_user_id: str | None = None
    access_token: str | None = None
    request_timeout_seconds: int | None = None
    user_domain: str | None = None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def upsert_local_responder(
    db: Session,
    subject_id: str,
    display_name: str | None = None,
    matrix_user_id: str | None = None,
):
    responder = (
        db.query(Responder)
        .filter(Responder.subject_id == subject_id)
        .first()
    )

    if responder:
        changed = False
        if (not responder.display_name) and display_name:
            responder.display_name = display_name
            changed = True
        if (not responder.matrix_user_id) and matrix_user_id:
            responder.matrix_user_id = matrix_user_id
            changed = True
        if changed:
            responder.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(responder)
        return responder

    responder = Responder(
        subject_id=subject_id,
        display_name=display_name or subject_id,
        matrix_user_id=matrix_user_id,
        role="Responder",
        presence="Offline",
        availability="Available",
        skills=None,
        is_active=True,
        is_admin=False,
        can_dispatch=False,
        can_respond=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.add(responder)
    db.commit()
    db.refresh(responder)

    return responder



def write_audit_event(
    db: Session,
    actor_id: str,
    event_type: str,
    record_id: int | None = None,
    event_metadata: dict | None = None,
):
    event = AuditEventModel(
        record_id=record_id,
        actor_id=actor_id,
        event_type=event_type,
        event_metadata=event_metadata,
        created_at=datetime.utcnow(),
    )
    db.add(event)


def write_system_audit_event(
    db: Session,
    actor_id: str,
    event_type: str,
    severity: str = "medium",
    related_record_id: int | None = None,
    related_responder_id: int | None = None,
    event_metadata: dict | None = None,
):
    event = SystemAuditEventModel(
        actor_id=actor_id,
        event_type=event_type,
        severity=severity,
        related_record_id=related_record_id,
        related_responder_id=related_responder_id,
        event_metadata=event_metadata,
        created_at=datetime.utcnow(),
    )
    db.add(event)


def get_subject_id(request: Request):
    return request.session.get("subject_id")


def get_current_responder(
    request: Request,
    db: Session,
) -> Responder:
    subject_id = get_subject_id(request)

    if not subject_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    responder = (
        db.query(Responder)
        .filter(Responder.subject_id == subject_id)
        .first()
    )

    if not responder or not responder.is_approved:
        raise HTTPException(status_code=403, detail="Not authorized")

    return responder


def require_authorized_subject_id(
    request: Request,
    db: Session = Depends(get_db),
) -> str:
    responder = get_current_responder(request, db)
    return responder.subject_id


def require_dispatch_subject_id(
    request: Request,
    db: Session = Depends(get_db),
) -> str:
    responder = get_current_responder(request, db)
    if not (responder.is_admin or responder.can_dispatch):
        raise HTTPException(status_code=403, detail="Dispatch permission required")
    return responder.subject_id


def require_respond_subject_id(
    request: Request,
    db: Session = Depends(get_db),
) -> str:
    responder = get_current_responder(request, db)
    if not (responder.is_admin or responder.can_respond):
        raise HTTPException(status_code=403, detail="Responder permission required")
    return responder.subject_id


def require_admin_subject_id(
    request: Request,
    db: Session = Depends(get_db),
) -> str:
    responder = get_current_responder(request, db)
    if not responder.is_admin:
        raise HTTPException(status_code=403, detail="Admin permission required")
    return responder.subject_id


def responder_is_assigned_to_record(
    db: Session,
    subject_id: str,
    record_id: int,
) -> bool:
    return (
        db.query(RecordAssignmentModel)
        .join(Responder, RecordAssignmentModel.responder_id == Responder.id)
        .filter(
            RecordAssignmentModel.record_id == record_id,
            Responder.subject_id == subject_id,
        )
        .first()
        is not None
    )


def responder_is_zone_visible_for_record(
    db: Session,
    subject_id: str,
    record_id: int,
) -> bool:
    return (
        db.query(RecordModel)
        .join(ResponderZone, ResponderZone.zone_id == RecordModel.zone_id)
        .join(Responder, ResponderZone.responder_id == Responder.id)
        .filter(
            RecordModel.id == record_id,
            RecordModel.zone_id.isnot(None),
            Responder.subject_id == subject_id,
        )
        .first()
        is not None
    )


def responder_has_record_access(
    db: Session,
    subject_id: str,
    record_id: int,
) -> bool:
    return (
        responder_is_assigned_to_record(db, subject_id, record_id)
        or responder_is_zone_visible_for_record(db, subject_id, record_id)
    )


def require_note_access_subject_id(
    request: Request,
    record_id: int,
    db: Session = Depends(get_db),
) -> str:
    responder = get_current_responder(request, db)

    if responder.is_admin or responder.can_dispatch:
        return responder.subject_id

    if responder.can_respond and responder_is_assigned_to_record(db, responder.subject_id, record_id):
        return responder.subject_id

    raise HTTPException(status_code=403, detail="Assigned responder or dispatch permission required")


def ensure_record_not_archived(record: RecordModel):
    if record.archived_at is not None:
        raise HTTPException(status_code=400, detail="Archived records are read-only")


def serialize_utc_datetime(value):
    if not value:
        return None
    if value.tzinfo is None:
        return value.isoformat() + "Z"
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def serialize_record(record: RecordModel) -> dict:
    return {
        "id": record.id,
        "summary": record.summary,
        "category": record.category,
        "severity": record.severity,
        "active_response": record.active_response,
        "professional_escalation": record.professional_escalation,
        "status": record.status,
        "verification_state": record.verification_state,
        "location": record.location,
        "zone_id": record.zone_id,
        "source_type": record.source_type,
        "occurrence_time": serialize_utc_datetime(record.occurrence_time),
        "created_by": record.created_by,
        "created_at": serialize_utc_datetime(record.created_at),
        "updated_at": serialize_utc_datetime(record.updated_at),
        "closed_by": record.closed_by,
        "closed_at": serialize_utc_datetime(record.closed_at),
        "archived_by": record.archived_by,
        "archived_at": serialize_utc_datetime(record.archived_at),
        "outcome_type": record.outcome_type,
        "outcome_notes": record.outcome_notes,
        "responders_involved": record.responders_involved,
        "need_met": record.need_met,
        "follow_up_needed": record.follow_up_needed,
        "internal_notes_summary": record.internal_notes_summary,
        "responder_instructions": record.responder_instructions,
    }


def serialize_record_redacted(record: RecordModel) -> dict:
    return {
        "id": record.id,
        "summary": record.summary,
        "category": record.category,
        "severity": record.severity,
        "active_response": record.active_response,
        "status": record.status,
        "verification_state": record.verification_state,
        "location": record.location,
        "zone_id": record.zone_id,
        "created_at": serialize_utc_datetime(record.created_at),
        "updated_at": serialize_utc_datetime(record.updated_at),
    }


def serialize_record_responder(record: RecordModel) -> dict:
    return {
        "id": record.id,
        "summary": record.summary,
        "category": record.category,
        "severity": record.severity,
        "active_response": record.active_response,
        "status": record.status,
        "verification_state": record.verification_state,
        "location": record.location,
        "zone_id": record.zone_id,
        "source_type": record.source_type,
        "occurrence_time": serialize_utc_datetime(record.occurrence_time),
        "created_at": serialize_utc_datetime(record.created_at),
        "updated_at": serialize_utc_datetime(record.updated_at),
        "closed_at": serialize_utc_datetime(record.closed_at),
        "archived_at": serialize_utc_datetime(record.archived_at),
        "outcome_type": record.outcome_type,
        "outcome_notes": record.outcome_notes,
        "responders_involved": record.responders_involved,
        "need_met": record.need_met,
        "follow_up_needed": record.follow_up_needed,
        "responder_instructions": record.responder_instructions,
    }




DEFAULT_PRESENCE_IDLE_MINUTES = 5
DEFAULT_PRESENCE_OFFLINE_MINUTES = 10
MIN_PRESENCE_IDLE_MINUTES = 2
MAX_PRESENCE_OFFLINE_MINUTES = 60
PRESENCE_IDLE_SETTING_KEY = "presence_idle_minutes"
PRESENCE_OFFLINE_SETTING_KEY = "presence_offline_minutes"

MATRIX_HOMESERVER_SETTING_KEY = "matrix_homeserver_url"
MATRIX_SENDER_USER_SETTING_KEY = "matrix_sender_user_id"
MATRIX_ACCESS_TOKEN_SETTING_KEY = "matrix_access_token"
MATRIX_TIMEOUT_SETTING_KEY = "matrix_request_timeout_seconds"
MATRIX_USER_DOMAIN_SETTING_KEY = "matrix_user_domain"


def parse_int_setting(value, default_value: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default_value


def get_system_setting_value(db: Session, key: str, default_value: int) -> int:
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()

    if not setting:
        return default_value

    return parse_int_setting(setting.value, default_value)


def get_system_setting_string(db: Session, key: str) -> str | None:
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()

    if not setting:
        return None

    value = (setting.value or "").strip()
    return value or None


def matrix_domain_from_user_id(user_id: str | None) -> str | None:
    value = (user_id or "").strip()
    if not value.startswith("@") or ":" not in value:
        return None
    return value.rsplit(":", 1)[-1].strip() or None


def get_effective_matrix_config(db: Session | None = None) -> MatrixConfig:
    if db is None:
        return MATRIX_CONFIG

    homeserver_url = (
        get_system_setting_string(db, MATRIX_HOMESERVER_SETTING_KEY)
        or MATRIX_CONFIG.homeserver_url
        or ""
    ).rstrip("/")
    sender_user_id = (
        get_system_setting_string(db, MATRIX_SENDER_USER_SETTING_KEY)
        or MATRIX_CONFIG.sender_user_id
    )
    access_token = (
        get_system_setting_string(db, MATRIX_ACCESS_TOKEN_SETTING_KEY)
        or MATRIX_CONFIG.access_token
    )
    timeout_value = get_system_setting_string(db, MATRIX_TIMEOUT_SETTING_KEY)
    request_timeout_seconds = parse_int_setting(timeout_value, MATRIX_CONFIG.request_timeout_seconds)
    explicit_user_domain = (
        get_system_setting_string(db, MATRIX_USER_DOMAIN_SETTING_KEY)
        or MATRIX_CONFIG.user_domain
    )
    derived_user_domain = matrix_domain_from_user_id(sender_user_id)

    return MatrixConfig(
        homeserver_url=homeserver_url,
        sender_user_id=sender_user_id,
        access_token=access_token,
        request_timeout_seconds=request_timeout_seconds,
        user_domain=explicit_user_domain or derived_user_domain,
    )


def get_admin_matrix_settings(db: Session) -> dict:
    config = get_effective_matrix_config(db)
    db_token = get_system_setting_string(db, MATRIX_ACCESS_TOKEN_SETTING_KEY)

    return {
        "configured": config.configured,
        "homeserver_url": config.homeserver_url or "",
        "sender_user_id": config.sender_user_id or "",
        "request_timeout_seconds": config.request_timeout_seconds,
        "user_domain": config.user_domain or "",
        "access_token_configured": bool(config.access_token),
        "access_token_source": "database" if db_token else ("environment" if MATRIX_CONFIG.access_token else "missing"),
        "env_fallback_available": {
            "homeserver_url": bool(MATRIX_CONFIG.homeserver_url),
            "sender_user_id": bool(MATRIX_CONFIG.sender_user_id),
            "access_token": bool(MATRIX_CONFIG.access_token),
            "request_timeout_seconds": bool(MATRIX_CONFIG.request_timeout_seconds),
            "user_domain": bool(MATRIX_CONFIG.user_domain),
        },
    }


def normalize_optional_setting_value(value: str | None) -> str | None:
    normalized = (value or "").strip()
    return normalized or None


def validate_matrix_timeout_seconds(value: int):
    if value < 1:
        raise HTTPException(status_code=400, detail="Matrix request timeout must be at least 1 second")
    if value > 60:
        raise HTTPException(status_code=400, detail="Matrix request timeout must be 60 seconds or less")


def validate_presence_timeout_settings(idle_minutes: int, offline_minutes: int):
    if idle_minutes < MIN_PRESENCE_IDLE_MINUTES:
        raise HTTPException(
            status_code=400,
            detail=f"Idle timeout must be at least {MIN_PRESENCE_IDLE_MINUTES} minutes",
        )

    if offline_minutes <= idle_minutes:
        raise HTTPException(status_code=400, detail="Offline timeout must be greater than idle timeout")

    if offline_minutes > MAX_PRESENCE_OFFLINE_MINUTES:
        raise HTTPException(
            status_code=400,
            detail=f"Offline timeout must be {MAX_PRESENCE_OFFLINE_MINUTES} minutes or less",
        )


def get_presence_timeout_settings(db: Session | None = None) -> dict:
    owns_session = False

    if db is None:
        db = SessionLocal()
        owns_session = True

    try:
        idle_minutes = get_system_setting_value(
            db,
            PRESENCE_IDLE_SETTING_KEY,
            DEFAULT_PRESENCE_IDLE_MINUTES,
        )
        offline_minutes = get_system_setting_value(
            db,
            PRESENCE_OFFLINE_SETTING_KEY,
            DEFAULT_PRESENCE_OFFLINE_MINUTES,
        )

        if (
            idle_minutes < MIN_PRESENCE_IDLE_MINUTES
            or offline_minutes <= idle_minutes
            or offline_minutes > MAX_PRESENCE_OFFLINE_MINUTES
        ):
            idle_minutes = DEFAULT_PRESENCE_IDLE_MINUTES
            offline_minutes = DEFAULT_PRESENCE_OFFLINE_MINUTES

        return {
            "idle_minutes": idle_minutes,
            "offline_minutes": offline_minutes,
            "min_idle_minutes": MIN_PRESENCE_IDLE_MINUTES,
            "max_offline_minutes": MAX_PRESENCE_OFFLINE_MINUTES,
        }
    finally:
        if owns_session:
            db.close()


def upsert_system_setting(db: Session, key: str, value: str):
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    now = datetime.utcnow()

    if setting:
        setting.value = value
        setting.updated_at = now
        return setting

    setting = SystemSetting(
        key=key,
        value=value,
        updated_at=now,
    )
    db.add(setting)
    return setting


def get_effective_presence(responder: Responder, db: Session | None = None) -> str:
    if not responder or responder.presence == "Offline":
        return "Offline"

    if not responder.last_seen_at:
        return "Offline"

    settings = get_presence_timeout_settings(db)
    age = datetime.utcnow() - responder.last_seen_at

    if age <= timedelta(minutes=settings["idle_minutes"]):
        return "Online"

    if age <= timedelta(minutes=settings["offline_minutes"]):
        return "Idle"

    return "Offline"

def serialize_responder(responder: Responder) -> dict:
    zone_links = sorted(
        [link for link in responder.zone_links if link.zone],
        key=lambda link: (link.zone.name or "").lower(),
    )

    return {
        "id": responder.id,
        "subject_id": responder.subject_id,
        "display_name": responder.display_name,
        "matrix_user_id": responder.matrix_user_id,
        "dm_room_id": responder.dm_room_id,
        "role": responder.role,
        "presence": get_effective_presence(responder),
        "stored_presence": responder.presence,
        "last_seen_at": serialize_utc_datetime(responder.last_seen_at),
        "availability": responder.availability,
        "skills": responder.skills,
        "zones": [link.zone.name for link in zone_links],
        "zone_ids": [link.zone_id for link in zone_links],
        "is_active": responder.is_active,
        "is_approved": responder.is_approved,
        "is_admin": responder.is_admin,
        "can_dispatch": responder.can_dispatch,
        "can_respond": responder.can_respond,
        "created_at": serialize_utc_datetime(responder.created_at),
        "updated_at": serialize_utc_datetime(responder.updated_at),
    }


def serialize_zone(zone: Zone) -> dict:
    return {
        "id": zone.id,
        "name": zone.name,
        "description": zone.description,
        "matrix_room_id": zone.matrix_room_id,
        "is_active": zone.is_active,
    }


def serialize_assignment(assignment: RecordAssignmentModel) -> dict:
    return {
        "id": assignment.id,
        "record_id": assignment.record_id,
        "responder_id": assignment.responder_id,
        "assignment_state": assignment.assignment_state,
        "assigned_by": assignment.assigned_by,
        "assigned_at": serialize_utc_datetime(assignment.assigned_at),
        "cleared_at": serialize_utc_datetime(assignment.cleared_at),
        "dispatcher_note": assignment.dispatcher_note,
        "matrix_send_result": None,
    }


def serialize_assignment_responder(assignment: RecordAssignmentModel) -> dict:
    return {
        "id": assignment.id,
        "record_id": assignment.record_id,
        "responder_id": assignment.responder_id,
        "assignment_state": assignment.assignment_state,
        "assigned_at": serialize_utc_datetime(assignment.assigned_at),
        "cleared_at": serialize_utc_datetime(assignment.cleared_at),
    }


@app.delete("/api/records/{record_id}/assignments/{assignment_id}")
def delete_record_assignment(
    record_id: int,
    assignment_id: int,
    subject_id: str = Depends(require_dispatch_subject_id),
    db: Session = Depends(get_db),
):
    record = db.query(RecordModel).filter(RecordModel.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    ensure_record_not_archived(record)

    assignment = (
        db.query(RecordAssignmentModel)
        .filter(
            RecordAssignmentModel.id == assignment_id,
            RecordAssignmentModel.record_id == record_id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    deleted_assignment = {
        "id": assignment.id,
        "record_id": assignment.record_id,
        "responder_id": assignment.responder_id,
        "assignment_state": assignment.assignment_state,
        "assigned_by": assignment.assigned_by,
        "assigned_at": serialize_utc_datetime(assignment.assigned_at),
        "cleared_at": serialize_utc_datetime(assignment.cleared_at),
        "dispatcher_note": assignment.dispatcher_note,
    }

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="responder_unassigned",
        record_id=record_id,
        event_metadata={
            "assignment_id": assignment.id,
            "responder_id": assignment.responder_id,
            "assignment_state": assignment.assignment_state,
            "dispatcher_note": assignment.dispatcher_note,
        },
    )

    db.delete(assignment)
    db.commit()

    return {
        "ok": True,
        "record_id": record_id,
        "assignment_id": assignment_id,
        "deleted_assignment": deleted_assignment,
    }



def serialize_note(note: RecordNoteModel) -> dict:
    return {
        "id": note.id,
        "record_id": note.record_id,
        "author_subject_id": note.author_subject_id,
        "author_role": note.author_role,
        "visibility": note.visibility,
        "body": note.body,
        "created_at": serialize_utc_datetime(note.created_at),
    }


def serialize_note_responder(note: RecordNoteModel) -> dict:
    return {
        "id": note.id,
        "record_id": note.record_id,
        "author_role": note.author_role,
        "visibility": note.visibility,
        "body": note.body,
        "created_at": serialize_utc_datetime(note.created_at),
    }



def serialize_audit_event(event: AuditEventModel) -> dict:
    return {
        "id": event.id,
        "record_id": event.record_id,
        "actor_id": event.actor_id,
        "event_type": event.event_type,
        "event_metadata": event.event_metadata,
        "created_at": serialize_utc_datetime(event.created_at),
    }


def serialize_system_audit_event(event: SystemAuditEventModel) -> dict:
    return {
        "id": event.id,
        "actor_id": event.actor_id,
        "event_type": event.event_type,
        "severity": event.severity,
        "related_record_id": event.related_record_id,
        "related_responder_id": event.related_responder_id,
        "event_metadata": event.event_metadata,
        "created_at": serialize_utc_datetime(event.created_at),
    }


def get_matrix_config_status(db: Session | None = None) -> dict:
    config = get_effective_matrix_config(db)
    configured = config.configured

    status = {
        "configured": configured,
        "homeserver_url": config.homeserver_url or None,
        "sender_user_id": config.sender_user_id,
        "request_timeout_seconds": config.request_timeout_seconds,
        "user_domain": config.user_domain,
        "access_token_configured": bool(config.access_token),
        "whoami_ok": False,
        "whoami_user_id": None,
        "whoami_error": None,
        "zones_with_matrix_room_ids": None,
        "active_zones_with_matrix_room_ids": None,
        "responders_with_matrix_user_ids": None,
        "active_responders_with_matrix_user_ids": None,
        "responders_with_cached_dm_rooms": None,
    }

    if configured:
        try:
            whoami = matrix_whoami(db=db)
            status["whoami_ok"] = True
            status["whoami_user_id"] = whoami.get("user_id")
        except Exception as exc:
            status["whoami_error"] = str(exc)

    if db is not None:
        status["zones_with_matrix_room_ids"] = db.query(Zone).filter(Zone.matrix_room_id.isnot(None)).count()
        status["active_zones_with_matrix_room_ids"] = db.query(Zone).filter(
            Zone.is_active.is_(True),
            Zone.matrix_room_id.isnot(None),
        ).count()
        status["responders_with_matrix_user_ids"] = db.query(Responder).filter(
            Responder.matrix_user_id.isnot(None),
        ).count()
        status["active_responders_with_matrix_user_ids"] = db.query(Responder).filter(
            Responder.is_active.is_(True),
            Responder.matrix_user_id.isnot(None),
        ).count()
        status["responders_with_cached_dm_rooms"] = db.query(Responder).filter(
            Responder.dm_room_id.isnot(None),
        ).count()

    return status


def normalize_matrix_escalation_value(value: str | None) -> str:
    return (value or "").strip().lower()


def build_matrix_record_payload(record: RecordModel, zone: Zone | None = None) -> dict:
    return {
        "record_id": record.id,
        "summary": record.summary,
        "category": record.category,
        "severity": record.severity,
        "zone": zone.name if zone else None,
        "location": record.location,
        "safety_escalation_active": bool(record.active_response),
        "professional_escalation": normalize_matrix_escalation_value(record.professional_escalation),
        "intake_note": (record.internal_notes_summary or "").strip() or None,
    }


def build_matrix_message_lines(record: RecordModel, zone: Zone | None = None, header: str = "ARGUS Alert", dispatcher_note: str | None = None) -> list[str]:
    payload = build_matrix_record_payload(record, zone=zone)
    lines = [
        header,
        f"Summary: {payload['summary']}",
        f"Category: {payload['category']}",
        f"Severity: {payload['severity']}",
    ]

    escalation_lines = []
    is_escalated_record = payload["safety_escalation_active"]
    is_safety_escalation = (
        is_escalated_record
        and payload["category"] == "Safety / Threat / Health"
    )

    if is_safety_escalation:
        escalation_lines = [
            "⚠️ SAFETY ESCALATION",
            "Safety / threat / health response flagged.",
        ]
    elif is_escalated_record:
        escalation_lines = [
            "⚠️ RECORD ESCALATED",
            "Active response requested.",
        ]

    if escalation_lines:
        lines.append("")
        lines.extend(escalation_lines)
        lines.append("")

    if (payload["zone"] or payload["location"]) and not escalation_lines:
        lines.append("")
    if payload["zone"]:
        lines.append(f"Zone: {payload['zone']}")
    if payload["location"]:
        lines.append(f"Location: {payload['location']}")

    lines.append(f"Record: {payload['record_id']}")

    note_value = (dispatcher_note or "").strip()
    if payload["intake_note"] or note_value:
        lines.append("")
    if payload["intake_note"]:
        lines.append(f"Intake Note: {payload['intake_note']}")
    if note_value:
        lines.append(f"Dispatcher Note: {note_value}")

    return lines


def build_matrix_message_body(record: RecordModel, zone: Zone | None = None, header: str = "ARGUS Alert", dispatcher_note: str | None = None) -> str:
    return "\n".join(build_matrix_message_lines(record, zone=zone, header=header, dispatcher_note=dispatcher_note))


def matrix_client_headers(db: Session | None = None) -> dict[str, str]:
    config = get_effective_matrix_config(db)
    if not config.access_token:
        raise RuntimeError("Matrix access token is not configured")
    return {
        "Authorization": f"Bearer {config.access_token}",
        "Content-Type": "application/json",
    }


def matrix_whoami(db: Session | None = None) -> dict[str, Any]:
    config = get_effective_matrix_config(db)
    if not config.homeserver_url:
        raise RuntimeError("Matrix homeserver URL is not configured")
    response = requests.get(
        f"{config.homeserver_url}/_matrix/client/v3/account/whoami",
        headers=matrix_client_headers(db),
        timeout=config.request_timeout_seconds,
    )
    response.raise_for_status()
    return response.json()


def send_matrix_room_message(room_id: str, body: str, *, msgtype: str = "m.notice", db: Session | None = None) -> dict[str, Any]:
    room_value = (room_id or "").strip()
    if not room_value:
        raise RuntimeError("room_id is required")
    if not body.strip():
        raise RuntimeError("body is required")
    config = get_effective_matrix_config(db)
    if not config.homeserver_url:
        raise RuntimeError("Matrix homeserver URL is not configured")

    txn_id = f"argus-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
    response = requests.put(
        f"{config.homeserver_url}/_matrix/client/v3/rooms/{room_value}/send/m.room.message/{txn_id}",
        headers=matrix_client_headers(db),
        json={
            "msgtype": msgtype,
            "body": body,
        },
        timeout=config.request_timeout_seconds,
    )
    response.raise_for_status()
    data = response.json()
    return {
        "ok": True,
        "room_id": room_value,
        "event_id": data.get("event_id"),
        "txn_id": txn_id,
        "msgtype": msgtype,
    }


def auto_send_record_to_zone(db: Session, record: RecordModel) -> dict[str, Any] | None:
    if not record.zone_id:
        return None

    zone = db.query(Zone).filter(Zone.id == record.zone_id).first()
    if not zone:
        return {
            "ok": False,
            "reason": "zone_not_found",
            "zone_id": record.zone_id,
        }

    room_id = (zone.matrix_room_id or "").strip()
    if not room_id:
        return {
            "ok": False,
            "reason": "zone_missing_matrix_room_id",
            "zone_id": zone.id,
            "zone_name": zone.name,
        }

    body = build_matrix_message_body(
        record,
        zone=zone,
        header="ARGUS Alert — New Record",
    )

    result = send_matrix_room_message(room_id, body, db=db)
    return {
        "ok": True,
        "zone_id": zone.id,
        "zone_name": zone.name,
        "room_id": room_id,
        "event_id": result.get("event_id"),
        "txn_id": result.get("txn_id"),
        "msgtype": result.get("msgtype"),
    }


def create_matrix_dm_room(matrix_user_id: str, db: Session | None = None) -> str:
    user_value = (matrix_user_id or "").strip()
    if not user_value:
        raise RuntimeError("matrix_user_id is required")
    config = get_effective_matrix_config(db)
    if not config.homeserver_url:
        raise RuntimeError("Matrix homeserver URL is not configured")

    response = requests.post(
        f"{config.homeserver_url}/_matrix/client/v3/createRoom",
        headers=matrix_client_headers(db),
        json={
            "is_direct": True,
            "preset": "trusted_private_chat",
            "invite": [user_value],
            "name": "ARGUS DM",
        },
        timeout=config.request_timeout_seconds,
    )
    response.raise_for_status()
    data = response.json()
    room_id = (data.get("room_id") or "").strip()
    if not room_id:
        raise RuntimeError("Matrix DM room creation returned no room_id")
    return room_id


def send_matrix_direct_message(db: Session, responder: Responder, body: str, *, msgtype: str = "m.notice") -> dict[str, Any]:
    matrix_user_id = (responder.matrix_user_id or "").strip()
    if not matrix_user_id:
        raise RuntimeError("Responder has no matrix_user_id")

    cached_room_id = (responder.dm_room_id or "").strip() or None

    if cached_room_id:
        try:
            result = send_matrix_room_message(cached_room_id, body, msgtype=msgtype, db=db)
            responder.dm_room_id = cached_room_id
            db.add(responder)
            return {
                "ok": True,
                "matrix_user_id": matrix_user_id,
                "room_id": cached_room_id,
                "event_id": result.get("event_id"),
                "txn_id": result.get("txn_id"),
                "msgtype": result.get("msgtype"),
                "used_cached_room": True,
            }
        except Exception:
            cached_room_id = None

    room_id = create_matrix_dm_room(matrix_user_id, db=db)
    result = send_matrix_room_message(room_id, body, msgtype=msgtype, db=db)

    responder.dm_room_id = room_id
    db.add(responder)

    return {
        "ok": True,
        "matrix_user_id": matrix_user_id,
        "room_id": room_id,
        "event_id": result.get("event_id"),
        "txn_id": result.get("txn_id"),
        "msgtype": result.get("msgtype"),
        "used_cached_room": False,
    }


@app.get("/")
def root():
    return {
        "service": "Argus",
        "status": "online",
        "message": "Argus Operator Interface backend is running"
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow()
    }


@app.get("/api/health")
def api_health(subject_id: str = Depends(require_authorized_subject_id)):
    return {
        "status": "ok",
        "timestamp": datetime.utcnow(),
        "subject_id": subject_id,
    }


@app.get("/login")
async def login(request: Request):
    redirect_uri = request.url_for("auth_callback")
    return await oauth.mas.authorize_redirect(request, redirect_uri)


@app.get("/logout")
async def logout(request: Request, db: Session = Depends(get_db)):
    subject_id = get_subject_id(request)
    if subject_id:
        responder = (
            db.query(Responder)
            .filter(Responder.subject_id == subject_id)
            .first()
        )
        if responder:
            now = datetime.utcnow()
            responder.presence = "Offline"
            responder.last_seen_at = now
            responder.updated_at = now
            db.commit()

    request.session.clear()
    return RedirectResponse(url="/", status_code=303)


@app.get("/auth/callback", name="auth_callback")
async def auth_callback(request: Request, db: Session = Depends(get_db)):
    try:
        token = await oauth.mas.authorize_access_token(request)
    except MismatchingStateError:
        request.session.clear()
        return RedirectResponse(url="/login", status_code=303)

    request.session["token"] = token

    userinfo = token.get("userinfo", {})
    subject_id = (
        userinfo.get("sub")
        or userinfo.get("preferred_username")
        or userinfo.get("username")
    )

    request.session["subject_id"] = subject_id

    responder = upsert_local_responder(
        db=db,
        subject_id=subject_id,
        display_name=(
            userinfo.get("name")
            or userinfo.get("preferred_username")
            or userinfo.get("username")
        ),
    )

    now = datetime.utcnow()
    responder.presence = "Online"
    responder.last_seen_at = now
    responder.updated_at = now
    db.commit()
    db.refresh(responder)

    if responder.is_approved:
        return RedirectResponse(url="/console")

    return RedirectResponse(url="/access-denied")


@app.get("/me")
async def me(request: Request, db: Session = Depends(get_db)):
    token = request.session.get("token")
    if not token:
        return JSONResponse({"authenticated": False}, status_code=401)

    userinfo = token.get("userinfo", {})
    subject_id = get_subject_id(request)

    if not subject_id:
        return JSONResponse({"authenticated": False}, status_code=401)

    display_name = (
        userinfo.get("name")
        or userinfo.get("preferred_username")
        or userinfo.get("username")
    )

    responder = upsert_local_responder(
        db=db,
        subject_id=subject_id,
        display_name=display_name,
    )

    return {
        "authenticated": True,
        "subject_id": subject_id,
        "responder": {
            "id": responder.id,
            "display_name": responder.display_name,
            "role": responder.role,
            "presence": responder.presence,
            "availability": responder.availability,
            "is_approved": responder.is_approved,
            "is_admin": responder.is_admin,
            "can_dispatch": responder.can_dispatch,
            "can_respond": responder.can_respond,
        },
    }

@app.get("/console")
async def console(request: Request, db: Session = Depends(get_db)):
    subject_id = get_subject_id(request)
    if not subject_id:
        return RedirectResponse(url="/login")

    responder = (
        db.query(Responder)
        .filter(Responder.subject_id == subject_id)
        .first()
    )

    if not responder or not responder.is_approved:
        return RedirectResponse(url="/access-denied")

    if not os.path.isfile(FRONTEND_INDEX):
        return JSONResponse(
            {
                "authenticated": True,
                "authorized": True,
                "message": "Frontend build not found",
                "subject_id": subject_id,
            },
            status_code=503,
        )

    return FileResponse(FRONTEND_INDEX)


@app.get("/access-denied")
async def access_denied(request: Request):
    subject_id = get_subject_id(request)

    if not os.path.exists(FRONTEND_INDEX):
        return JSONResponse(
            {
                "authenticated": bool(subject_id),
                "authorized": False,
                "message": "Frontend build not found",
                "subject_id": subject_id,
            },
            status_code=503,
        )

    return FileResponse(FRONTEND_INDEX)


@app.get("/api/records")
def get_records(
    lifecycle: str | None = None,
    subject_id: str = Depends(require_authorized_subject_id),
    db: Session = Depends(get_db),
):
    allowed_lifecycles = {None, "working", "closed", "archived"}
    if lifecycle not in allowed_lifecycles:
        raise HTTPException(status_code=400, detail="Invalid lifecycle filter")

    responder = (
        db.query(Responder)
        .filter(Responder.subject_id == subject_id)
        .first()
    )
    if not responder:
        raise HTTPException(status_code=404, detail="Responder not found")

    def apply_lifecycle_filters(query):
        if lifecycle == "working":
            return query.filter(
                RecordModel.archived_at.is_(None),
                RecordModel.status != "closed",
            )
        if lifecycle == "closed":
            return query.filter(
                RecordModel.archived_at.is_(None),
                RecordModel.status == "closed",
            )
        if lifecycle == "archived":
            return query.filter(RecordModel.archived_at.isnot(None))
        return query

    if responder.is_admin or responder.can_dispatch:
        results = (
            apply_lifecycle_filters(db.query(RecordModel))
            .order_by(RecordModel.created_at.desc(), RecordModel.id.desc())
            .all()
        )
        records = [serialize_record(record) for record in results]
    else:
        assigned_results = (
            apply_lifecycle_filters(
                db.query(RecordModel)
                .join(RecordAssignmentModel, RecordAssignmentModel.record_id == RecordModel.id)
                .join(Responder, RecordAssignmentModel.responder_id == Responder.id)
                .filter(Responder.subject_id == subject_id)
            )
            .all()
        )

        zone_results = (
            apply_lifecycle_filters(
                db.query(RecordModel)
                .join(ResponderZone, ResponderZone.zone_id == RecordModel.zone_id)
                .join(Responder, ResponderZone.responder_id == Responder.id)
                .filter(
                    RecordModel.zone_id.isnot(None),
                    Responder.subject_id == subject_id,
                )
            )
            .all()
        )

        assigned_ids = {record.id for record in assigned_results}
        merged = {record.id: record for record in [*assigned_results, *zone_results]}
        results = sorted(
            merged.values(),
            key=lambda record: (record.created_at or datetime.min, record.id),
            reverse=True,
        )
        records = [
            serialize_record_responder(record) if record.id in assigned_ids else serialize_record_redacted(record)
            for record in results
        ]

    return {
        "count": len(records),
        "records": records,
        "subject_id": subject_id,
        "lifecycle": lifecycle,
    }



@app.get("/api/matrix/status")
def get_matrix_status(
    subject_id: str = Depends(require_dispatch_subject_id),
    db: Session = Depends(get_db),
):
    return {
        **get_matrix_config_status(db=db),
        "subject_id": subject_id,
    }


@app.get("/api/zones")
def get_zones(
    subject_id: str = Depends(require_dispatch_subject_id),
    db: Session = Depends(get_db),
):
    results = (
        db.query(Zone)
        .order_by(Zone.is_active.desc(), Zone.name.asc())
        .all()
    )

    return {
        "count": len(results),
        "zones": [serialize_zone(zone) for zone in results],
        "subject_id": subject_id,
    }


@app.post("/api/zones", status_code=201)
def create_zone(
    payload: ZoneCreate,
    subject_id: str = Depends(require_admin_subject_id),
    db: Session = Depends(get_db),
):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Zone name is required")

    existing = db.query(Zone).filter(Zone.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Zone name already exists")

    zone = Zone(
        name=name,
        description=(payload.description or "").strip() or None,
        matrix_room_id=(payload.matrix_room_id or "").strip() or None,
        is_active=True,
    )
    db.add(zone)
    db.flush()

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="zone_created",
        record_id=None,
        event_metadata={
            "zone_id": zone.id,
            "name": zone.name,
        },
    )

    write_system_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="zone_created",
        severity="high",
        event_metadata={
            "zone_id": zone.id,
            "name": zone.name,
        },
    )

    db.commit()
    db.refresh(zone)
    return serialize_zone(zone)


@app.patch("/api/zones/{zone_id}")
def update_zone(
    zone_id: int,
    payload: ZoneUpdate,
    subject_id: str = Depends(require_admin_subject_id),
    db: Session = Depends(get_db),
):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    changed = False

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Zone name cannot be empty")

        existing = (
            db.query(Zone)
            .filter(Zone.name == name, Zone.id != zone_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Zone name already exists")

        zone.name = name
        changed = True

    if payload.description is not None:
        zone.description = payload.description.strip() or None
        changed = True

    if payload.matrix_room_id is not None:
        zone.matrix_room_id = payload.matrix_room_id.strip() or None
        changed = True

    if not changed:
        raise HTTPException(status_code=400, detail="No zone changes submitted")

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="zone_updated",
        record_id=None,
        event_metadata={
            "zone_id": zone.id,
            "name": zone.name,
        },
    )

    write_system_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="zone_updated",
        severity="high",
        event_metadata={
            "zone_id": zone.id,
            "name": zone.name,
        },
    )

    db.commit()
    db.refresh(zone)
    return serialize_zone(zone)


@app.delete("/api/zones/{zone_id}")
def delete_zone(
    zone_id: int,
    subject_id: str = Depends(require_admin_subject_id),
    db: Session = Depends(get_db),
):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    linked_records = db.query(RecordModel).filter(RecordModel.zone_id == zone_id).count()
    linked_responders = db.query(ResponderZone).filter(ResponderZone.zone_id == zone_id).count()

    if linked_records > 0 or linked_responders > 0:
        raise HTTPException(status_code=400, detail="Zone is in use and cannot be deleted")

    zone_name = zone.name
    db.delete(zone)
    db.flush()

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="zone_deleted",
        record_id=None,
        event_metadata={
            "zone_id": zone_id,
            "name": zone_name,
        },
    )

    write_system_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="zone_deleted",
        severity="high",
        event_metadata={
            "zone_id": zone_id,
            "name": zone_name,
        },
    )

    db.commit()
    return {"ok": True, "zone_id": zone_id, "name": zone_name}


@app.get("/api/responders/capacity")
def get_responder_capacity(
    subject_id: str = Depends(require_authorized_subject_id),
    db: Session = Depends(get_db),
):
    responders = (
        db.query(Responder)
        .filter(
            Responder.is_active.is_(True),
            Responder.is_approved.is_(True),
            Responder.can_respond.is_(True),
        )
        .all()
    )

    def is_online(responder: Responder) -> bool:
        return get_effective_presence(responder, db) == "Online"

    def is_available(responder: Responder) -> bool:
        return get_effective_presence(responder, db) == "Online" and responder.availability == "Available"

    overall_online = sum(1 for responder in responders if is_online(responder))
    overall_available = sum(1 for responder in responders if is_available(responder))

    active_zones = (
        db.query(Zone)
        .filter(Zone.is_active.is_(True))
        .order_by(Zone.name.asc(), Zone.id.asc())
        .all()
    )

    capacity_by_zone = []
    for zone in active_zones:
        zone_responders = [
            responder
            for responder in responders
            if any(link.zone_id == zone.id for link in responder.zone_links)
        ]

        capacity_by_zone.append(
            {
                "zone_id": zone.id,
                "zone_name": zone.name,
                "online": sum(1 for responder in zone_responders if is_online(responder)),
                "available": sum(1 for responder in zone_responders if is_available(responder)),
            }
        )

    return {
        "overall": {
            "online": overall_online,
            "available": overall_available,
        },
        "zones": capacity_by_zone,
        "subject_id": subject_id,
    }


@app.get("/api/responders")
def get_responders(
    subject_id: str = Depends(require_dispatch_subject_id),
    db: Session = Depends(get_db),
):
    results = (
        db.query(Responder)
        .order_by(Responder.created_at.desc(), Responder.id.desc())
        .all()
    )

    return {
        "count": len(results),
        "responders": [serialize_responder(responder) for responder in results],
        "subject_id": subject_id,
    }


@app.get("/api/responders/me")
def get_my_responder(
    subject_id: str = Depends(require_authorized_subject_id),
    db: Session = Depends(get_db),
):
    responder = (
        db.query(Responder)
        .filter(Responder.subject_id == subject_id)
        .first()
    )
    if not responder:
        raise HTTPException(status_code=404, detail="Responder not found")

    return serialize_responder(responder)


@app.post("/api/responders/me/heartbeat")
def heartbeat_my_responder(
    subject_id: str = Depends(require_authorized_subject_id),
    db: Session = Depends(get_db),
):
    responder = (
        db.query(Responder)
        .filter(Responder.subject_id == subject_id)
        .first()
    )
    if not responder:
        raise HTTPException(status_code=404, detail="Responder not found")

    now = datetime.utcnow()
    responder.presence = "Online"
    responder.last_seen_at = now
    responder.updated_at = now
    db.commit()
    db.refresh(responder)

    return {
        "ok": True,
        "responder": serialize_responder(responder),
    }





@app.get("/api/admin/settings/presence")
def get_admin_presence_settings(
    subject_id: str = Depends(require_admin_subject_id),
    db: Session = Depends(get_db),
):
    return get_presence_timeout_settings(db)


@app.patch("/api/admin/settings/presence")
def update_admin_presence_settings(
    payload: PresenceSettingsUpdate,
    subject_id: str = Depends(require_admin_subject_id),
    db: Session = Depends(get_db),
):
    current = get_presence_timeout_settings(db)

    idle_minutes = int(payload.idle_minutes)
    offline_minutes = int(payload.offline_minutes)
    validate_presence_timeout_settings(idle_minutes, offline_minutes)

    upsert_system_setting(db, PRESENCE_IDLE_SETTING_KEY, str(idle_minutes))
    upsert_system_setting(db, PRESENCE_OFFLINE_SETTING_KEY, str(offline_minutes))

    write_system_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="presence_settings_updated",
        severity="warning",
        event_metadata={
            "old_idle_minutes": current["idle_minutes"],
            "new_idle_minutes": idle_minutes,
            "old_offline_minutes": current["offline_minutes"],
            "new_offline_minutes": offline_minutes,
        },
    )

    db.commit()

    return get_presence_timeout_settings(db)


@app.get("/api/admin/settings/matrix")
def get_admin_matrix_integration_settings(
    subject_id: str = Depends(require_admin_subject_id),
    db: Session = Depends(get_db),
):
    return get_admin_matrix_settings(db)


@app.patch("/api/admin/settings/matrix")
def update_admin_matrix_integration_settings(
    payload: MatrixSettingsUpdate,
    subject_id: str = Depends(require_admin_subject_id),
    db: Session = Depends(get_db),
):
    current = get_admin_matrix_settings(db)

    homeserver_url = normalize_optional_setting_value(payload.homeserver_url)
    sender_user_id = normalize_optional_setting_value(payload.sender_user_id)
    user_domain = normalize_optional_setting_value(payload.user_domain)

    if homeserver_url:
        homeserver_url = homeserver_url.rstrip("/")

    if sender_user_id and not sender_user_id.startswith("@"):
        raise HTTPException(status_code=400, detail="Matrix sender user ID must start with @")

    if payload.request_timeout_seconds is not None:
        timeout_seconds = int(payload.request_timeout_seconds)
        validate_matrix_timeout_seconds(timeout_seconds)
        upsert_system_setting(db, MATRIX_TIMEOUT_SETTING_KEY, str(timeout_seconds))

    if payload.homeserver_url is not None:
        upsert_system_setting(db, MATRIX_HOMESERVER_SETTING_KEY, homeserver_url or "")

    if payload.sender_user_id is not None:
        upsert_system_setting(db, MATRIX_SENDER_USER_SETTING_KEY, sender_user_id or "")

    if payload.user_domain is not None:
        upsert_system_setting(db, MATRIX_USER_DOMAIN_SETTING_KEY, user_domain or "")

    token_changed = False
    token_value = normalize_optional_setting_value(payload.access_token)
    if token_value:
        upsert_system_setting(db, MATRIX_ACCESS_TOKEN_SETTING_KEY, token_value)
        token_changed = True

    updated = get_admin_matrix_settings(db)

    write_system_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="matrix_settings_updated",
        severity="warning",
        event_metadata={
            "old_configured": current["configured"],
            "new_configured": updated["configured"],
            "homeserver_changed": current["homeserver_url"] != updated["homeserver_url"],
            "sender_changed": current["sender_user_id"] != updated["sender_user_id"],
            "timeout_changed": current["request_timeout_seconds"] != updated["request_timeout_seconds"],
            "user_domain_changed": current["user_domain"] != updated["user_domain"],
            "access_token_changed": token_changed,
        },
    )

    db.commit()

    return updated


def normalize_mas_username(username: str) -> str:
    value = (username or "").strip()

    if not value:
        raise HTTPException(status_code=400, detail="MAS username is required")

    if len(value) > 128:
        raise HTTPException(status_code=400, detail="MAS username is too long")

    if value.startswith("@") or ":" in value:
        raise HTTPException(status_code=400, detail="Enter the MAS username/localpart only, not a full Matrix ID")

    if not MAS_USERNAME_PATTERN.fullmatch(value):
        raise HTTPException(status_code=400, detail="MAS username contains unsupported characters")

    return value


def get_mas_admin_access_token() -> str:
    if not MAS_ADMIN_BASE_URL or not MAS_ADMIN_CLIENT_ID or not MAS_ADMIN_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="MAS admin lookup is not configured")

    try:
        response = requests.post(
            f"{MAS_ADMIN_BASE_URL}/oauth2/token",
            auth=(MAS_ADMIN_CLIENT_ID, MAS_ADMIN_CLIENT_SECRET),
            data={
                "grant_type": "client_credentials",
                "scope": "urn:mas:admin",
            },
            timeout=MAS_ADMIN_REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="MAS admin token request failed")

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="MAS admin token request was rejected")

    try:
        payload = response.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="MAS admin token response was not JSON")

    token = payload.get("access_token")
    if not token:
        raise HTTPException(status_code=502, detail="MAS admin token response did not include an access token")

    return token


@app.get("/api/admin/mas-users/by-username/{username:path}")
def lookup_mas_user_by_username(
    username: str,
    subject_id: str = Depends(require_admin_subject_id),
):
    lookup_username = normalize_mas_username(username)
    token = get_mas_admin_access_token()

    try:
        response = requests.get(
            f"{MAS_ADMIN_BASE_URL}/api/admin/v1/users/by-username/{quote(lookup_username, safe='')}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=MAS_ADMIN_REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="MAS user lookup request failed")

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="MAS user not found")

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="MAS user lookup failed")

    try:
        payload = response.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="MAS user lookup response was not JSON")

    data = payload.get("data") or {}
    attributes = data.get("attributes") or {}

    mas_subject_id = (data.get("id") or "").strip()
    mas_username = (attributes.get("username") or lookup_username).strip()

    if not mas_subject_id or not mas_username:
        raise HTTPException(status_code=502, detail="MAS user lookup response was missing required identity fields")

    if attributes.get("locked_at"):
        raise HTTPException(status_code=400, detail="MAS user is locked")

    if attributes.get("deactivated_at"):
        raise HTTPException(status_code=400, detail="MAS user is deactivated")

    return {
        "subject_id": mas_subject_id,
        "display_name": mas_username,
        "matrix_user_id": f"@{mas_username}:{MATRIX_USER_DOMAIN}",
        "mas_user": {
            "id": mas_subject_id,
            "username": mas_username,
            "locked_at": attributes.get("locked_at"),
            "deactivated_at": attributes.get("deactivated_at"),
            "admin": bool(attributes.get("admin")),
            "legacy_guest": bool(attributes.get("legacy_guest")),
        },
    }


@app.post("/api/admin/responders", status_code=201)
def create_admin_responder(
    payload: ResponderAdminUpsert,
    subject_id: str = Depends(require_admin_subject_id),
    db: Session = Depends(get_db),
):
    subject_value = (payload.subject_id or "").strip()
    display_value = (payload.display_name or "").strip()
    matrix_value = (payload.matrix_user_id or "").strip() or None
    dm_room_value = (payload.dm_room_id or "").strip() or None
    role_value = (payload.role or "Responder").strip() or "Responder"

    if not subject_value:
        raise HTTPException(status_code=400, detail="subject_id is required")
    if not display_value:
        raise HTTPException(status_code=400, detail="display_name is required")

    existing = db.query(Responder).filter(Responder.subject_id == subject_value).first()
    if existing:
        raise HTTPException(status_code=400, detail="Responder with this subject_id already exists")

    if matrix_value:
        existing_matrix = db.query(Responder).filter(Responder.matrix_user_id == matrix_value).first()
        if existing_matrix:
            raise HTTPException(status_code=400, detail="Responder with this matrix_user_id already exists")

    responder = Responder(
        subject_id=subject_value,
        display_name=display_value,
        matrix_user_id=matrix_value,
        dm_room_id=dm_room_value,
        role=role_value,
        presence="Offline",
        availability="Available",
        skills=payload.skills or None,
        is_active=payload.is_active,
        is_approved=payload.is_approved,
        is_admin=payload.is_admin,
        can_dispatch=payload.can_dispatch,
        can_respond=payload.can_respond,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(responder)
    db.flush()

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="admin_responder_created",
        record_id=None,
        event_metadata={
            "responder_id": responder.id,
            "subject_id": responder.subject_id,
            "display_name": responder.display_name,
        },
    )

    write_system_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="admin_responder_created",
        severity="critical",
        related_responder_id=responder.id,
        event_metadata={
            "responder_id": responder.id,
            "subject_id": responder.subject_id,
            "display_name": responder.display_name,
        },
    )

    db.commit()
    db.refresh(responder)
    return serialize_responder(responder)


@app.patch("/api/admin/responders/{responder_id}")
def update_admin_responder(
    responder_id: int,
    payload: ResponderAdminUpsert,
    subject_id: str = Depends(require_admin_subject_id),
    db: Session = Depends(get_db),
):
    responder = db.query(Responder).filter(Responder.id == responder_id).first()
    if not responder:
        raise HTTPException(status_code=404, detail="Responder not found")

    subject_value = (payload.subject_id or "").strip()
    display_value = (payload.display_name or "").strip()
    matrix_value = (payload.matrix_user_id or "").strip() or None
    dm_room_value = (payload.dm_room_id or "").strip() or None
    role_value = (payload.role or "Responder").strip() or "Responder"

    if not subject_value:
        raise HTTPException(status_code=400, detail="subject_id is required")
    if not display_value:
        raise HTTPException(status_code=400, detail="display_name is required")

    existing_subject = (
        db.query(Responder)
        .filter(Responder.subject_id == subject_value, Responder.id != responder_id)
        .first()
    )
    if existing_subject:
        raise HTTPException(status_code=400, detail="Responder with this subject_id already exists")

    if matrix_value:
        existing_matrix = (
            db.query(Responder)
            .filter(Responder.matrix_user_id == matrix_value, Responder.id != responder_id)
            .first()
        )
        if existing_matrix:
            raise HTTPException(status_code=400, detail="Responder with this matrix_user_id already exists")

    responder.subject_id = subject_value
    responder.display_name = display_value
    responder.matrix_user_id = matrix_value
    responder.dm_room_id = dm_room_value
    responder.role = role_value
    responder.skills = payload.skills or None
    responder.is_active = payload.is_active
    responder.is_approved = payload.is_approved
    responder.is_admin = payload.is_admin
    responder.can_dispatch = payload.can_dispatch
    responder.can_respond = payload.can_respond
    responder.updated_at = datetime.utcnow()

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="admin_responder_updated",
        record_id=None,
        event_metadata={
            "responder_id": responder.id,
            "subject_id": responder.subject_id,
            "display_name": responder.display_name,
        },
    )

    write_system_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="admin_responder_updated",
        severity="critical",
        related_responder_id=responder.id,
        event_metadata={
            "responder_id": responder.id,
            "subject_id": responder.subject_id,
            "display_name": responder.display_name,
        },
    )

    db.commit()
    db.refresh(responder)
    return serialize_responder(responder)



@app.delete("/api/admin/responders/{responder_id}")
def delete_admin_responder(
    responder_id: int,
    subject_id: str = Depends(require_admin_subject_id),
    db: Session = Depends(get_db),
):
    responder = db.query(Responder).filter(Responder.id == responder_id).first()
    if not responder:
        raise HTTPException(status_code=404, detail="Responder not found")

    zone_links = (
        db.query(ResponderZone)
        .filter(ResponderZone.responder_id == responder_id)
        .all()
    )
    for link in zone_links:
        db.delete(link)

    assignments = (
        db.query(RecordAssignmentModel)
        .filter(RecordAssignmentModel.responder_id == responder_id)
        .all()
    )
    for assignment in assignments:
        db.delete(assignment)

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="admin_responder_deleted",
        record_id=None,
        event_metadata={
            "responder_id": responder.id,
            "subject_id": responder.subject_id,
            "display_name": responder.display_name,
        },
    )

    write_system_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="admin_responder_deleted",
        severity="critical",
        related_responder_id=responder.id,
        event_metadata={
            "responder_id": responder.id,
            "subject_id": responder.subject_id,
            "display_name": responder.display_name,
        },
    )

    db.delete(responder)
    db.commit()

    return {"ok": True, "responder_id": responder_id}



@app.post("/api/responders/{responder_id}/zones", status_code=201)
def add_responder_zone(
    responder_id: int,
    payload: ResponderZoneCreate,
    subject_id: str = Depends(require_admin_subject_id),
    db: Session = Depends(get_db),
):
    responder = db.query(Responder).filter(Responder.id == responder_id).first()
    if not responder:
        raise HTTPException(status_code=404, detail="Responder not found")

    zone = db.query(Zone).filter(Zone.id == payload.zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    existing = (
        db.query(ResponderZone)
        .filter(
            ResponderZone.responder_id == responder_id,
            ResponderZone.zone_id == payload.zone_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Responder already belongs to this zone")

    link = ResponderZone(
        responder_id=responder_id,
        zone_id=payload.zone_id,
    )
    db.add(link)
    db.flush()

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="responder_zone_added",
        record_id=None,
        event_metadata={
            "responder_id": responder.id,
            "zone_id": zone.id,
            "zone_name": zone.name,
        },
    )

    write_system_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="responder_zone_added",
        severity="high",
        related_responder_id=responder.id,
        event_metadata={
            "responder_id": responder.id,
            "zone_id": zone.id,
            "zone_name": zone.name,
        },
    )

    db.commit()
    db.refresh(responder)
    return serialize_responder(responder)


@app.delete("/api/responders/{responder_id}/zones/{zone_id}")
def delete_responder_zone(
    responder_id: int,
    zone_id: int,
    subject_id: str = Depends(require_admin_subject_id),
    db: Session = Depends(get_db),
):
    responder = db.query(Responder).filter(Responder.id == responder_id).first()
    if not responder:
        raise HTTPException(status_code=404, detail="Responder not found")

    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    link = (
        db.query(ResponderZone)
        .filter(
            ResponderZone.responder_id == responder_id,
            ResponderZone.zone_id == zone_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Responder zone link not found")

    db.delete(link)
    db.flush()

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="responder_zone_removed",
        record_id=None,
        event_metadata={
            "responder_id": responder.id,
            "zone_id": zone.id,
            "zone_name": zone.name,
        },
    )

    write_system_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="responder_zone_removed",
        severity="high",
        related_responder_id=responder.id,
        event_metadata={
            "responder_id": responder.id,
            "zone_id": zone.id,
            "zone_name": zone.name,
        },
    )

    db.commit()
    db.refresh(responder)
    return serialize_responder(responder)


@app.patch("/api/responders/me")
def update_my_responder_availability(
    payload: ResponderAvailabilityUpdate,
    subject_id: str = Depends(require_respond_subject_id),
    db: Session = Depends(get_db),
):
    if payload.availability not in ALLOWED_RESPONDER_AVAILABILITY:
        raise HTTPException(status_code=400, detail="Invalid responder availability")

    responder = (
        db.query(Responder)
        .filter(Responder.subject_id == subject_id)
        .first()
    )
    if not responder:
        raise HTTPException(status_code=404, detail="Responder not found")

    responder.availability = payload.availability
    responder.updated_at = datetime.utcnow()

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="responder_status_updated",
        record_id=None,
        event_metadata={
            "responder_id": responder.id,
            "availability": responder.availability,
        },
    )

    db.commit()
    db.refresh(responder)

    return serialize_responder(responder)


@app.get("/api/records/{record_id}/assignments")
def get_record_assignments(
    record_id: int,
    subject_id: str = Depends(require_authorized_subject_id),
    db: Session = Depends(get_db),
):
    record = db.query(RecordModel).filter(RecordModel.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    responder = (
        db.query(Responder)
        .filter(Responder.subject_id == subject_id)
        .first()
    )
    if not responder:
        raise HTTPException(status_code=404, detail="Responder not found")

    results = (
        db.query(RecordAssignmentModel)
        .filter(RecordAssignmentModel.record_id == record_id)
        .order_by(RecordAssignmentModel.assigned_at.desc(), RecordAssignmentModel.id.desc())
        .all()
    )

    if responder.is_admin or responder.can_dispatch:
        assignments = [serialize_assignment(assignment) for assignment in results]
    else:
        if not responder_is_assigned_to_record(db, subject_id, record_id):
            raise HTTPException(status_code=403, detail="Assigned responder or dispatch permission required")
        assignments = [serialize_assignment_responder(assignment) for assignment in results]

    return {
        "count": len(assignments),
        "assignments": assignments,
        "record_id": record_id,
        "subject_id": subject_id,
    }



@app.get("/api/records/{record_id}/notes")
def get_record_notes(
    record_id: int,
    subject_id: str = Depends(require_note_access_subject_id),
    db: Session = Depends(get_db),
):
    record = db.query(RecordModel).filter(RecordModel.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    responder = (
        db.query(Responder)
        .filter(Responder.subject_id == subject_id)
        .first()
    )
    if not responder:
        raise HTTPException(status_code=404, detail="Responder not found")

    if responder.is_admin or responder.can_dispatch:
        results = (
            db.query(RecordNoteModel)
            .filter(RecordNoteModel.record_id == record_id)
            .order_by(RecordNoteModel.created_at.desc(), RecordNoteModel.id.desc())
            .all()
        )
        notes = [serialize_note(note) for note in results]
    else:
        results = (
            db.query(RecordNoteModel)
            .filter(
                RecordNoteModel.record_id == record_id,
                RecordNoteModel.visibility == "responder",
            )
            .order_by(RecordNoteModel.created_at.desc(), RecordNoteModel.id.desc())
            .all()
        )
        notes = [serialize_note_responder(note) for note in results]

    return {
        "count": len(notes),
        "notes": notes,
        "record_id": record_id,
        "subject_id": subject_id,
    }



@app.get("/api/records/{record_id}/audit")
def get_record_audit(
    record_id: int,
    subject_id: str = Depends(require_dispatch_subject_id),
    db: Session = Depends(get_db),
):
    record = db.query(RecordModel).filter(RecordModel.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    results = (
        db.query(AuditEventModel)
        .filter(AuditEventModel.record_id == record_id)
        .order_by(AuditEventModel.created_at.desc(), AuditEventModel.id.desc())
        .all()
    )

    return {
        "count": len(results),
        "audit_events": [serialize_audit_event(event) for event in results],
        "record_id": record_id,
        "subject_id": subject_id,
    }


@app.get("/api/system-audit")
def get_system_audit(
    subject_id: str = Depends(require_dispatch_subject_id),
    db: Session = Depends(get_db),
):
    results = (
        db.query(SystemAuditEventModel)
        .order_by(SystemAuditEventModel.created_at.desc(), SystemAuditEventModel.id.desc())
        .limit(200)
        .all()
    )

    return {
        "count": len(results),
        "system_audit_events": [serialize_system_audit_event(event) for event in results],
        "subject_id": subject_id,
    }


@app.post("/api/records/{record_id}/notes", status_code=201)
def create_record_note(
    record_id: int,
    payload: RecordNoteCreate,
    subject_id: str = Depends(require_note_access_subject_id),
    db: Session = Depends(get_db),
):
    record = db.query(RecordModel).filter(RecordModel.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    ensure_record_not_archived(record)

    body = (payload.body or "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="Note body is required")

    visibility = payload.visibility or "internal"
    if visibility not in {"internal", "responder"}:
        raise HTTPException(status_code=400, detail="Invalid note visibility")

    responder = (
        db.query(Responder)
        .filter(Responder.subject_id == subject_id)
        .first()
    )

    if responder and (responder.is_admin or responder.can_dispatch):
        author_role = "Dispatcher"
    elif responder and responder.can_respond:
        author_role = "Responder"
        visibility = "responder"
    else:
        author_role = "Dispatcher"

    note = RecordNoteModel(
        record_id=record_id,
        author_subject_id=subject_id,
        author_role=author_role,
        visibility=visibility,
        body=body,
        created_at=datetime.utcnow(),
    )

    db.add(note)
    db.flush()

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="note_created",
        record_id=record_id,
        event_metadata={
            "note_id": note.id,
            "author_role": note.author_role,
            "visibility": note.visibility,
        },
    )

    db.commit()
    db.refresh(note)

    if responder and (responder.is_admin or responder.can_dispatch):
        return serialize_note(note)

    return serialize_note_responder(note)


@app.patch("/api/records/{record_id}/assignments/{assignment_id}")
def update_record_assignment(
    record_id: int,
    assignment_id: int,
    payload: AssignmentStateUpdate,
    subject_id: str = Depends(require_respond_subject_id),
    db: Session = Depends(get_db),
):
    assignment = (
        db.query(RecordAssignmentModel)
        .join(Responder, RecordAssignmentModel.responder_id == Responder.id)
        .filter(
            RecordAssignmentModel.id == assignment_id,
            RecordAssignmentModel.record_id == record_id,
            Responder.subject_id == subject_id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    record = db.query(RecordModel).filter(RecordModel.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    ensure_record_not_archived(record)

    changed = False

    if payload.assignment_state is not None:
        requested_state = (payload.assignment_state or "").strip()

        if requested_state != "active":
            raise HTTPException(
                status_code=400,
                detail="Responders may only mark their own assignment active through this route",
            )

        assignment.assignment_state = "active"
        assignment.cleared_at = None
        changed = True

    if payload.mark_cleared:
        now = datetime.utcnow()
        assignment.assignment_state = "cleared"
        assignment.cleared_at = now
        changed = True

    if not changed:
        raise HTTPException(status_code=400, detail="No assignment changes submitted")

    db.add(assignment)
    db.flush()

    event_type = "responder_assignment_updated"
    event_metadata = {
        "assignment_id": assignment.id,
        "responder_id": assignment.responder_id,
        "assignment_state": assignment.assignment_state,
        "cleared_at": serialize_utc_datetime(assignment.cleared_at),
    }

    if payload.mark_cleared:
        event_type = "responder_cleared"

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type=event_type,
        record_id=record_id,
        event_metadata=event_metadata,
    )

    db.commit()
    db.refresh(assignment)

    return serialize_assignment_responder(assignment)


@app.post("/api/records/{record_id}/assignments", status_code=201)
def create_record_assignment(
    record_id: int,
    payload: RecordAssignmentCreate,
    subject_id: str = Depends(require_dispatch_subject_id),
    db: Session = Depends(get_db),
):
    record = db.query(RecordModel).filter(RecordModel.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    ensure_record_not_archived(record)

    responder = db.query(Responder).filter(Responder.id == payload.responder_id).first()
    if not responder:
        raise HTTPException(status_code=404, detail="Responder not found")

    if not responder.is_active:
        raise HTTPException(status_code=400, detail="Responder is inactive")

    effective_presence = get_effective_presence(responder, db)
    if effective_presence == "Offline":
        raise HTTPException(status_code=400, detail="Responder is offline")

    existing = (
        db.query(RecordAssignmentModel)
        .filter(
            RecordAssignmentModel.record_id == record_id,
            RecordAssignmentModel.responder_id == payload.responder_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Responder already assigned to this record")

    assignment = RecordAssignmentModel(
        record_id=record_id,
        responder_id=payload.responder_id,
        assignment_state="assigned",
        assigned_by=subject_id,
        assigned_at=datetime.utcnow(),
        dispatcher_note=payload.dispatcher_note,
    )

    db.add(assignment)
    db.flush()

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="responder_assigned",
        record_id=record_id,
        event_metadata={
            "assignment_id": assignment.id,
            "responder_id": responder.id,
            "assignment_state": assignment.assignment_state,
            "dispatcher_note": assignment.dispatcher_note,
        },
    )

    assignment_send_result = None
    try:
        body = build_matrix_message_body(
            record,
            zone=db.query(Zone).filter(Zone.id == record.zone_id).first() if record.zone_id else None,
            header="ARGUS Assignment",
            dispatcher_note=payload.dispatcher_note,
        )
        assignment_send_result = send_matrix_direct_message(
            db=db,
            responder=responder,
            body=body,
        )
    except Exception as exc:
        assignment_send_result = {
            "ok": False,
            "reason": "matrix_send_exception",
            "detail": str(exc),
            "responder_id": responder.id,
            "matrix_user_id": responder.matrix_user_id,
            "dm_room_id": responder.dm_room_id,
        }

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="matrix_assignment_auto_send",
        record_id=record_id,
        event_metadata={
            "assignment_id": assignment.id,
            "responder_id": responder.id,
            **(assignment_send_result or {"ok": False, "reason": "no_result"}),
        },
    )

    db.commit()
    db.refresh(assignment)
    db.refresh(responder)

    return {
        "id": assignment.id,
        "record_id": assignment.record_id,
        "responder_id": assignment.responder_id,
        "assignment_state": assignment.assignment_state,
        "assigned_by": assignment.assigned_by,
        "assigned_at": serialize_utc_datetime(assignment.assigned_at),
        "cleared_at": serialize_utc_datetime(assignment.cleared_at),
        "dispatcher_note": assignment.dispatcher_note,
        "matrix_send_result": assignment_send_result,
    }


@app.post("/api/records/{record_id}/matrix-alerts")
def create_matrix_manual_alert(
    record_id: int,
    payload: MatrixManualAlertCreate,
    subject_id: str = Depends(require_dispatch_subject_id),
    db: Session = Depends(get_db),
):
    allowed_destinations = {
        "one_responder",
        "all_online_responders",
        "all_responders",
        "one_zone",
        "all_zones",
    }

    destination = (payload.destination or "").strip()
    if destination not in allowed_destinations:
        raise HTTPException(status_code=400, detail="Invalid destination")

    record = db.query(RecordModel).filter(RecordModel.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    zone = db.query(Zone).filter(Zone.id == record.zone_id).first() if record.zone_id else None
    dispatcher_note = (payload.dispatcher_note or "").strip() or None
    body = build_matrix_message_body(
        record,
        zone=zone,
        header="ARGUS Alert",
        dispatcher_note=dispatcher_note,
    )

    results: list[dict[str, Any]] = []

    def send_to_responder(responder: Responder):
        try:
            result = send_matrix_direct_message(db=db, responder=responder, body=body)
            results.append({
                "ok": True,
                "target_type": "responder",
                "responder_id": responder.id,
                "display_name": responder.display_name,
                "matrix_user_id": responder.matrix_user_id,
                **result,
            })
        except Exception as exc:
            results.append({
                "ok": False,
                "target_type": "responder",
                "responder_id": responder.id,
                "display_name": responder.display_name,
                "matrix_user_id": responder.matrix_user_id,
                "dm_room_id": responder.dm_room_id,
                "reason": "matrix_send_exception",
                "detail": str(exc),
            })

    def send_to_zone(target_zone: Zone):
        room_id = (target_zone.matrix_room_id or "").strip()
        if not room_id:
            results.append({
                "ok": False,
                "target_type": "zone",
                "zone_id": target_zone.id,
                "zone_name": target_zone.name,
                "reason": "zone_missing_matrix_room_id",
            })
            return
        try:
            result = send_matrix_room_message(room_id, body, db=db)
            results.append({
                "ok": True,
                "target_type": "zone",
                "zone_id": target_zone.id,
                "zone_name": target_zone.name,
                "room_id": room_id,
                **result,
            })
        except Exception as exc:
            results.append({
                "ok": False,
                "target_type": "zone",
                "zone_id": target_zone.id,
                "zone_name": target_zone.name,
                "room_id": room_id,
                "reason": "matrix_send_exception",
                "detail": str(exc),
            })

    if destination == "one_responder":
        if not payload.responder_id:
            raise HTTPException(status_code=400, detail="responder_id is required for one_responder")
        responder = db.query(Responder).filter(Responder.id == payload.responder_id).first()
        if not responder:
            raise HTTPException(status_code=404, detail="Responder not found")
        send_to_responder(responder)

    elif destination == "all_online_responders":
        responders = (
            db.query(Responder)
            .filter(
                Responder.is_active.is_(True),
                Responder.presence == "Online",
                Responder.matrix_user_id.isnot(None),
            )
            .order_by(Responder.display_name.asc(), Responder.id.asc())
            .all()
        )
        for responder in responders:
            send_to_responder(responder)

    elif destination == "all_responders":
        responders = (
            db.query(Responder)
            .filter(
                Responder.is_active.is_(True),
                Responder.matrix_user_id.isnot(None),
            )
            .order_by(Responder.display_name.asc(), Responder.id.asc())
            .all()
        )
        for responder in responders:
            send_to_responder(responder)

    elif destination == "one_zone":
        if not payload.zone_id:
            raise HTTPException(status_code=400, detail="zone_id is required for one_zone")
        target_zone = db.query(Zone).filter(Zone.id == payload.zone_id).first()
        if not target_zone:
            raise HTTPException(status_code=404, detail="Zone not found")
        send_to_zone(target_zone)

    elif destination == "all_zones":
        target_zones = (
            db.query(Zone)
            .filter(Zone.is_active.is_(True))
            .order_by(Zone.name.asc(), Zone.id.asc())
            .all()
        )
        for target_zone in target_zones:
            send_to_zone(target_zone)

    success_count = sum(1 for item in results if item.get("ok"))
    failure_count = len(results) - success_count

    audit_payload = {
        "destination": destination,
        "dispatcher_note": dispatcher_note,
        "success_count": success_count,
        "failure_count": failure_count,
        "results": results,
    }

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="matrix_manual_alert_sent",
        record_id=record_id,
        event_metadata=audit_payload,
    )

    db.commit()

    return {
        "ok": failure_count == 0,
        "record_id": record_id,
        "destination": destination,
        "success_count": success_count,
        "failure_count": failure_count,
        "results": results,
    }


@app.post("/api/records", status_code=201)
def create_record(
    payload: RecordCreate,
    subject_id: str = Depends(require_dispatch_subject_id),
    db: Session = Depends(get_db),
):
    if payload.category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")

    if payload.severity not in ALLOWED_SEVERITIES:
        raise HTTPException(status_code=400, detail="Invalid severity")

    if payload.professional_escalation is not None and payload.professional_escalation not in ALLOWED_PROFESSIONAL_ESCALATION:
        raise HTTPException(status_code=400, detail="Invalid professional_escalation value")

    if (
        payload.active_response
        and payload.category == "Safety / Threat / Health"
        and payload.professional_escalation is None
    ):
        raise HTTPException(
            status_code=400,
            detail="professional_escalation is required for Safety / Threat / Health when active_response is true",
        )

    new_record = RecordModel(
        summary=payload.summary.strip(),
        category=payload.category,
        severity=payload.severity,
        active_response=payload.active_response,
        professional_escalation=payload.professional_escalation,
        location=(payload.location.strip() if payload.location else None),
        zone_id=payload.zone_id,
        source_type=(payload.source_type.strip() if payload.source_type else None),
        internal_notes_summary=(
            payload.internal_notes_summary.strip()
            if payload.internal_notes_summary else None
        ),
        status="new",
        verification_state=(payload.verification_state or "pending"),
        created_by=subject_id,
    )

    db.add(new_record)
    db.flush()

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="record_created",
        record_id=new_record.id,
        event_metadata={
            "category": new_record.category,
            "severity": new_record.severity,
            "active_response": new_record.active_response,
            "status": new_record.status,
            "verification_state": new_record.verification_state,
        },
    )

    zone_send_result = None
    try:
        zone_send_result = auto_send_record_to_zone(db, new_record)
    except Exception as exc:
        zone_send_result = {
            "ok": False,
            "reason": "matrix_send_exception",
            "detail": str(exc),
            "zone_id": new_record.zone_id,
        }

    if zone_send_result is not None:
        write_audit_event(
            db=db,
            actor_id=subject_id,
            event_type="matrix_zone_auto_send",
            record_id=new_record.id,
            event_metadata=zone_send_result,
        )

    db.commit()
    db.refresh(new_record)

    return serialize_record(new_record)


@app.patch("/api/records/{record_id}")
def update_record(
    record_id: int,
    payload: RecordUpdate,
    subject_id: str = Depends(require_dispatch_subject_id),
    db: Session = Depends(get_db),
):
    record = db.query(RecordModel).filter(RecordModel.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    ensure_record_not_archived(record)

    update_changes = {}

    def apply_record_change(field_name: str, new_value):
        old_value = getattr(record, field_name)
        if old_value != new_value:
            update_changes[field_name] = {
                "from": old_value,
                "to": new_value,
            }
        setattr(record, field_name, new_value)

    if payload.category is not None:
        if payload.category not in ALLOWED_CATEGORIES:
            raise HTTPException(status_code=400, detail="Invalid category")
        apply_record_change("category", payload.category)

    if payload.status is not None:
        if payload.status not in ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status")
        if payload.status == "closed":
            raise HTTPException(status_code=400, detail="Use /api/records/{record_id}/close for structured closure")
        apply_record_change("status", payload.status)

    if payload.verification_state is not None:
        if payload.verification_state not in ALLOWED_VERIFICATION_STATES:
            raise HTTPException(status_code=400, detail="Invalid verification_state")
        apply_record_change("verification_state", payload.verification_state)

    if payload.severity is not None:
        if payload.severity not in ALLOWED_SEVERITIES:
            raise HTTPException(status_code=400, detail="Invalid severity")
        apply_record_change("severity", payload.severity)

    if payload.active_response is not None:
        apply_record_change("active_response", payload.active_response)

    if payload.professional_escalation is not None:
        if payload.professional_escalation not in ALLOWED_PROFESSIONAL_ESCALATION:
            raise HTTPException(status_code=400, detail="Invalid professional_escalation value")
        apply_record_change("professional_escalation", payload.professional_escalation)

    if payload.location is not None:
        apply_record_change("location", payload.location)

    if payload.responder_instructions is not None:
        apply_record_change("responder_instructions", payload.responder_instructions)

    if payload.internal_notes_summary is not None:
        apply_record_change("internal_notes_summary", payload.internal_notes_summary)

    if (
        record.active_response
        and record.category == "Safety / Threat / Health"
        and record.professional_escalation is None
    ):
        raise HTTPException(
            status_code=400,
            detail="professional_escalation is required for Safety / Threat / Health when active_response is true",
        )

    record.updated_at = datetime.utcnow()

    db.add(record)
    db.flush()

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="record_updated",
        record_id=record.id,
        event_metadata={
            "changes": update_changes,
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
        },
    )

    db.commit()
    db.refresh(record)

    return serialize_record(record)


@app.post("/api/records/{record_id}/close")
def close_record(
    record_id: int,
    payload: RecordClose,
    subject_id: str = Depends(require_dispatch_subject_id),
    db: Session = Depends(get_db),
):
    record = db.query(RecordModel).filter(RecordModel.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    ensure_record_not_archived(record)

    outcome_type = (payload.outcome_type or "").strip()
    outcome_notes = (payload.outcome_notes or "").strip()

    if not outcome_type:
        raise HTTPException(status_code=400, detail="outcome_type is required")

    if not outcome_notes:
        raise HTTPException(status_code=400, detail="outcome_notes is required")

    uncleared_assignments = (
        db.query(RecordAssignmentModel)
        .filter(
            RecordAssignmentModel.record_id == record_id,
            RecordAssignmentModel.cleared_at.is_(None),
        )
        .count()
    )
    if uncleared_assignments > 0:
        raise HTTPException(
            status_code=400,
            detail="All responders must be unassigned or cleared before closing",
        )

    now = datetime.utcnow()

    record.outcome_type = outcome_type
    record.outcome_notes = outcome_notes
    record.responders_involved = payload.responders_involved or []
    record.need_met = payload.need_met
    record.follow_up_needed = payload.follow_up_needed
    record.closed_by = subject_id
    record.closed_at = now
    record.status = "closed"
    record.updated_at = now

    db.add(record)
    db.flush()

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="record_closed",
        record_id=record.id,
        event_metadata={
            "status": record.status,
            "closed_by": record.closed_by,
            "closed_at": record.closed_at.isoformat() if record.closed_at else None,
            "outcome_type": record.outcome_type,
            "need_met": record.need_met,
            "follow_up_needed": record.follow_up_needed,
        },
    )

    db.commit()
    db.refresh(record)

    return serialize_record(record)


@app.post("/api/records/{record_id}/reopen")
def reopen_record(
    record_id: int,
    payload: RecordReopen,
    subject_id: str = Depends(require_dispatch_subject_id),
    db: Session = Depends(get_db),
):
    record = db.query(RecordModel).filter(RecordModel.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if record.archived_at is not None:
        raise HTTPException(status_code=400, detail="Archived records cannot be reopened")

    if record.status != "closed":
        raise HTTPException(status_code=400, detail="Only closed records can be reopened")

    now = datetime.utcnow()
    previous_closure = {
        "closed_by": record.closed_by,
        "closed_at": record.closed_at.isoformat() if record.closed_at else None,
        "outcome_type": record.outcome_type,
        "outcome_notes_present": bool(record.outcome_notes),
        "responders_involved": record.responders_involved,
        "need_met": record.need_met,
        "follow_up_needed": record.follow_up_needed,
    }

    record.status = "under_review"
    record.closed_by = None
    record.closed_at = None
    record.outcome_type = None
    record.outcome_notes = None
    record.responders_involved = None
    record.need_met = None
    record.follow_up_needed = None
    record.updated_at = now

    db.add(record)
    db.flush()

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="record_reopened",
        record_id=record.id,
        event_metadata={
            "status": record.status,
            "reason": (payload.reason or "").strip() or None,
            "cleared_previous_closure": previous_closure,
        },
    )

    db.commit()
    db.refresh(record)
    return serialize_record(record)


@app.post("/api/records/{record_id}/archive")
def archive_record(
    record_id: int,
    payload: RecordArchive,
    subject_id: str = Depends(require_admin_subject_id),
    db: Session = Depends(get_db),
):
    record = db.query(RecordModel).filter(RecordModel.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if record.archived_at is not None:
        raise HTTPException(status_code=400, detail="Record is already archived")

    if record.status != "closed":
        raise HTTPException(status_code=400, detail="Only closed records can be archived")

    now = datetime.utcnow()
    record.archived_by = subject_id
    record.archived_at = now
    record.updated_at = now

    db.add(record)
    db.flush()

    write_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="record_archived",
        record_id=record.id,
        event_metadata={
            "archived_by": record.archived_by,
            "archived_at": record.archived_at.isoformat() if record.archived_at else None,
            "reason": (payload.reason or "").strip() or None,
        },
    )

    db.commit()
    db.refresh(record)
    return serialize_record(record)


@app.delete("/api/records/{record_id}/purge")
def purge_record(
    record_id: int,
    subject_id: str = Depends(require_admin_subject_id),
    db: Session = Depends(get_db),
):
    record = db.query(RecordModel).filter(RecordModel.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if record.archived_at is None:
        raise HTTPException(status_code=400, detail="Only archived records can be purged")

    assignments = (
        db.query(RecordAssignmentModel)
        .filter(RecordAssignmentModel.record_id == record_id)
        .all()
    )

    notes = (
        db.query(RecordNoteModel)
        .filter(RecordNoteModel.record_id == record_id)
        .all()
    )

    audit_events = (
        db.query(AuditEventModel)
        .filter(AuditEventModel.record_id == record_id)
        .all()
    )

    write_system_audit_event(
        db=db,
        actor_id=subject_id,
        event_type="record_purged",
        severity="critical",
        related_record_id=record.id,
        event_metadata={
            "record_id": record.id,
            "summary": record.summary,
            "status": record.status,
            "severity": record.severity,
            "category": record.category,
            "archived_by": record.archived_by,
            "archived_at": record.archived_at.isoformat() if record.archived_at else None,
            "created_at": record.created_at.isoformat() if record.created_at else None,
            "updated_at": record.updated_at.isoformat() if record.updated_at else None,
            "assignment_count": len(assignments),
            "note_count": len(notes),
            "record_audit_event_count": len(audit_events),
            "purged_at": datetime.utcnow().isoformat(),
        },
    )

    for assignment in assignments:
        db.delete(assignment)

    for note in notes:
        db.delete(note)

    for event in audit_events:
        db.delete(event)

    db.delete(record)
    db.commit()

    return {"ok": True, "record_id": record_id}
