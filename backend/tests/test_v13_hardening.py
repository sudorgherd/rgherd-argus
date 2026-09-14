from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app import main
from app.core_operations import (
    create_record_in_transaction,
    responder_is_assignment_eligible,
    set_record_lifecycle_in_transaction,
)
from app.models import AuditEvent, RecordAssignment, RecordNote, ResponderZone


REAL_AUTO_SEND_RECORD = main.auto_send_record_to_zone


def request_for(subject_id: str | None):
    return SimpleNamespace(session={"subject_id": subject_id} if subject_id else {})


def assert_http_error(status_code, detail, operation):
    with pytest.raises(HTTPException) as captured:
        operation()
    assert captured.value.status_code == status_code
    if detail is not None:
        assert detail in str(captured.value.detail)


@pytest.mark.parametrize(
    ("attributes", "allowed_dependencies"),
    [
        ({}, {"authorized", "respond"}),
        ({"can_dispatch": True}, {"authorized", "respond", "dispatch"}),
        ({"is_admin": True, "can_dispatch": False, "can_respond": False}, {"authorized", "respond", "dispatch", "admin"}),
    ],
)
def test_active_approved_capability_combinations(
    db,
    make_responder,
    attributes,
    allowed_dependencies,
):
    responder = make_responder("operator", **attributes)
    db.commit()
    request = request_for(responder.subject_id)
    dependencies = {
        "authorized": main.require_authorized_responder,
        "respond": main.require_respond_responder,
        "dispatch": main.require_dispatch_responder,
        "admin": main.require_admin_responder,
    }
    for name, dependency in dependencies.items():
        if name in allowed_dependencies:
            assert dependency(request, db).id == responder.id
        else:
            assert_http_error(403, "permission", lambda dependency=dependency: dependency(request, db))


@pytest.mark.parametrize(
    "attributes",
    [
        {"is_approved": False},
        {"is_active": False},
        {"is_active": False, "is_admin": True, "can_dispatch": True},
    ],
)
def test_unapproved_or_inactive_operator_is_centrally_rejected(db, make_responder, attributes):
    responder = make_responder("blocked", **attributes)
    db.commit()
    request = request_for(responder.subject_id)
    assert_http_error(403, "Not authorized", lambda: main.get_current_responder(request, db))
    assert_http_error(403, "Not authorized", lambda: main.require_dispatch_responder(request, db))
    assert_http_error(403, "Not authorized", lambda: main.require_respond_responder(request, db))
    assert_http_error(403, "Not authorized", lambda: main.require_admin_responder(request, db))


def test_missing_session_is_unauthenticated(db):
    assert_http_error(401, "Not authenticated", lambda: main.get_current_responder(request_for(None), db))


@pytest.mark.parametrize(
    ("attributes", "expected_detail"),
    [
        ({"is_approved": False}, "not approved"),
        ({"is_active": False}, "inactive"),
        ({"can_respond": False}, "not response-capable"),
        ({"presence": "Offline"}, "not effectively online"),
        ({"last_seen_at": datetime.utcnow() - timedelta(minutes=30)}, "not effectively online"),
        ({"availability": "Busy"}, "not available"),
        ({"availability": "Away"}, "not available"),
    ],
)
def test_assignment_creation_rejects_each_ineligible_dimension(
    db,
    make_responder,
    make_record,
    attributes,
    expected_detail,
):
    dispatcher = make_responder("dispatcher", can_dispatch=True)
    target = make_responder("target", **attributes)
    record = make_record()
    db.commit()
    assert responder_is_assignment_eligible(target, db, main.get_effective_presence) is False
    assert_http_error(
        400,
        expected_detail,
        lambda: main.create_canonical_assignment(
            db,
            record_id=record.id,
            responder_id=target.id,
            actor_id=dispatcher.subject_id,
        ),
    )
    assert db.query(RecordAssignment).count() == 0


def test_assignment_creation_accepts_only_current_available_responder(db, make_responder, make_record):
    dispatcher = make_responder("dispatcher", can_dispatch=True)
    target = make_responder("target")
    record = make_record()
    db.commit()
    assert responder_is_assignment_eligible(target, db, main.get_effective_presence) is True
    assignment, _ = main.create_canonical_assignment(
        db,
        record_id=record.id,
        responder_id=target.id,
        actor_id=dispatcher.subject_id,
    )
    assert assignment.assignment_state == "assigned"


def test_assignment_transition_graph_and_history(db, make_responder, make_record):
    responder = make_responder("responder")
    record = make_record(activity_version=1)
    assignment = RecordAssignment(
        record_id=record.id,
        responder_id=responder.id,
        assignment_state="assigned",
        assigned_by="dispatcher",
        dispatcher_note="Meet at the south entrance",
    )
    db.add(assignment)
    db.commit()

    active = main.update_record_assignment(
        record.id,
        assignment.id,
        main.AssignmentStateUpdate(assignment_state="active"),
        subject_id=responder.subject_id,
        db=db,
    )
    assert active["assignment_state"] == "active"
    assert active["dispatcher_note"] == "Meet at the south entrance"
    assert record.activity_version == 2

    cleared = main.update_record_assignment(
        record.id,
        assignment.id,
        main.AssignmentStateUpdate(mark_cleared=True),
        subject_id=responder.subject_id,
        db=db,
    )
    assert cleared["assignment_state"] == "cleared"
    assert cleared["cleared_at"] is not None
    assert record.activity_version == 3
    assert [event.event_type for event in db.query(AuditEvent).order_by(AuditEvent.id)] == [
        "responder_assignment_updated",
        "responder_cleared",
    ]


@pytest.mark.parametrize(
    ("initial_state", "cleared_at", "payload"),
    [
        ("assigned", datetime.utcnow(), main.AssignmentStateUpdate(assignment_state="active")),
        ("active", datetime.utcnow(), main.AssignmentStateUpdate(mark_cleared=True)),
        ("cleared", None, main.AssignmentStateUpdate(assignment_state="active")),
    ],
)
def test_inconsistent_assignment_representation_cannot_transition(
    db,
    make_responder,
    make_record,
    initial_state,
    cleared_at,
    payload,
):
    responder = make_responder("responder")
    record = make_record(activity_version=7)
    assignment = RecordAssignment(
        record_id=record.id,
        responder_id=responder.id,
        assignment_state=initial_state,
        cleared_at=cleared_at,
        assigned_by="dispatcher",
    )
    db.add(assignment)
    db.commit()

    assert_http_error(
        409,
        "inconsistent",
        lambda: main.update_record_assignment(
            record.id,
            assignment.id,
            payload,
            subject_id=responder.subject_id,
            db=db,
        ),
    )
    db.refresh(record)
    db.refresh(assignment)
    assert record.activity_version == 7
    assert assignment.assignment_state == initial_state
    assert assignment.cleared_at == cleared_at
    assert db.query(AuditEvent).count() == 0


@pytest.mark.parametrize(
    ("assignment_state", "cleared_at"),
    [
        ("assigned", datetime.utcnow()),
        ("active", datetime.utcnow()),
        ("cleared", None),
    ],
)
def test_inconsistent_assignment_representation_blocks_record_close(
    db,
    make_responder,
    make_record,
    assignment_state,
    cleared_at,
):
    dispatcher = make_responder("dispatcher", can_dispatch=True)
    responder = make_responder("responder")
    record = make_record(activity_version=3)
    db.add(
        RecordAssignment(
            record_id=record.id,
            responder_id=responder.id,
            assignment_state=assignment_state,
            cleared_at=cleared_at,
            assigned_by=dispatcher.subject_id,
        ),
    )
    db.commit()

    assert_http_error(
        400,
        "All responders",
        lambda: main.close_record(
            record.id,
            main.RecordClose(
                outcome_type="completed",
                outcome_notes="Handled",
                responders_involved=[],
                need_met=True,
                follow_up_needed=False,
            ),
            subject_id=dispatcher.subject_id,
            db=db,
        ),
    )
    db.refresh(record)
    assert record.status == "new"
    assert record.activity_version == 3
    assert db.query(AuditEvent).count() == 0


@pytest.mark.parametrize(
    ("initial_state", "payload", "expected_status"),
    [
        ("assigned", main.AssignmentStateUpdate(mark_cleared=True), 409),
        ("cleared", main.AssignmentStateUpdate(assignment_state="active"), 409),
        ("cleared", main.AssignmentStateUpdate(assignment_state="assigned"), 400),
        ("active", main.AssignmentStateUpdate(assignment_state="assigned"), 400),
        ("active", main.AssignmentStateUpdate(assignment_state="active"), 409),
        ("active", main.AssignmentStateUpdate(assignment_state="active", mark_cleared=True), 400),
    ],
)
def test_invalid_assignment_transitions_create_no_history(
    db,
    make_responder,
    make_record,
    initial_state,
    payload,
    expected_status,
):
    responder = make_responder("responder")
    record = make_record(activity_version=4)
    assignment = RecordAssignment(
        record_id=record.id,
        responder_id=responder.id,
        assignment_state=initial_state,
        cleared_at=datetime.utcnow() if initial_state == "cleared" else None,
        assigned_by="dispatcher",
    )
    db.add(assignment)
    db.commit()
    assert_http_error(
        expected_status,
        None,
        lambda: main.update_record_assignment(
            record.id,
            assignment.id,
            payload,
            subject_id=responder.subject_id,
            db=db,
        ),
    )
    db.refresh(record)
    db.refresh(assignment)
    assert record.activity_version == 4
    assert assignment.assignment_state == initial_state
    assert db.query(AuditEvent).count() == 0


@pytest.mark.parametrize("archived", [False, True])
def test_assignment_mutation_denied_after_close_or_archive(db, make_responder, make_record, archived):
    responder = make_responder("responder")
    record = make_record(status="closed", archived=archived)
    assignment = RecordAssignment(
        record_id=record.id,
        responder_id=responder.id,
        assignment_state="active",
        assigned_by="dispatcher",
    )
    db.add(assignment)
    db.commit()
    assert_http_error(
        400,
        "read-only",
        lambda: main.update_record_assignment(
            record.id,
            assignment.id,
            main.AssignmentStateUpdate(mark_cleared=True),
            subject_id=responder.subject_id,
            db=db,
        ),
    )


def test_closed_record_rejects_assignment_create_and_delete(db, make_responder, make_record):
    dispatcher = make_responder("dispatcher", can_dispatch=True)
    target = make_responder("target")
    record = make_record(status="closed")
    existing = RecordAssignment(
        record_id=record.id,
        responder_id=target.id,
        assignment_state="cleared",
        cleared_at=datetime.utcnow(),
        assigned_by=dispatcher.subject_id,
    )
    db.add(existing)
    db.commit()
    assert_http_error(
        400,
        "Closed records are read-only",
        lambda: main.create_canonical_assignment(
            db,
            record_id=record.id,
            responder_id=target.id,
            actor_id=dispatcher.subject_id,
        ),
    )
    assert_http_error(
        400,
        "Closed records are read-only",
        lambda: main.delete_canonical_assignment(
            db,
            record_id=record.id,
            assignment_id=existing.id,
            actor_id=dispatcher.subject_id,
        ),
    )
def test_cleared_assignment_retains_read_but_not_note_authority(db, make_responder, make_record):
    responder = make_responder("responder")
    other = make_responder("other")
    record = make_record(status="closed")
    assignment = RecordAssignment(
        record_id=record.id,
        responder_id=responder.id,
        assignment_state="cleared",
        cleared_at=datetime.utcnow(),
        assigned_by="dispatcher",
        dispatcher_note="Authorized history",
    )
    db.add(assignment)
    db.commit()

    visible = main.get_records(
        lifecycle="closed",
        subject_id=responder.subject_id,
        db=db,
    )
    assert [item["id"] for item in visible["records"]] == [record.id]
    assert main.get_records(lifecycle="closed", subject_id=other.subject_id, db=db)["records"] == []
    assignments = main.get_record_assignments(record.id, responder.subject_id, db)
    assert assignments["assignments"][0]["dispatcher_note"] == "Authorized history"
    assert_http_error(
        400,
        "Closed records are read-only",
        lambda: main.create_record_note(
            record.id,
            main.RecordNoteCreate(body="late note", visibility="responder"),
            subject_id=responder.subject_id,
            db=db,
        ),
    )


def test_cleared_open_assignment_cannot_add_note(db, make_responder, make_record):
    responder = make_responder("responder")
    record = make_record()
    db.add(
        RecordAssignment(
            record_id=record.id,
            responder_id=responder.id,
            assignment_state="cleared",
            cleared_at=datetime.utcnow(),
            assigned_by="dispatcher",
        ),
    )
    db.commit()
    assert_http_error(
        403,
        "Current assignment",
        lambda: main.create_record_note(
            record.id,
            main.RecordNoteCreate(body="late note", visibility="responder"),
            subject_id=responder.subject_id,
            db=db,
        ),
    )
    assert db.query(RecordNote).count() == 0


def test_dispatcher_closed_mutations_require_reopen(db, make_responder, make_record):
    dispatcher = make_responder("dispatcher", can_dispatch=True)
    record = make_record(status="closed")
    db.commit()
    assert_http_error(
        400,
        "Closed records are read-only",
        lambda: main.update_record(
            record.id,
            main.RecordUpdate(severity="High"),
            subject_id=dispatcher.subject_id,
            db=db,
        ),
    )
    main.reopen_record(
        record.id,
        main.RecordReopen(reason="Resume work"),
        subject_id=dispatcher.subject_id,
        db=db,
    )
    note = main.create_record_note(
        record.id,
        main.RecordNoteCreate(body="work resumed"),
        subject_id=dispatcher.subject_id,
        db=db,
    )
    assert note["body"] == "work resumed"


def test_dispatcher_note_is_only_returned_to_its_assigned_responder(db, make_responder, make_record):
    first = make_responder("first")
    second = make_responder("second")
    record = make_record()
    db.add_all([
        RecordAssignment(
            record_id=record.id,
            responder_id=first.id,
            assigned_by="dispatcher",
            dispatcher_note="first-only",
        ),
        RecordAssignment(
            record_id=record.id,
            responder_id=second.id,
            assigned_by="dispatcher",
            dispatcher_note="second-only",
        ),
    ])
    db.commit()
    response = main.get_record_assignments(record.id, first.subject_id, db)
    by_responder = {item["responder_id"]: item for item in response["assignments"]}
    assert by_responder[first.id]["dispatcher_note"] == "first-only"
    assert "dispatcher_note" not in by_responder[second.id]


def test_zone_visibility_does_not_expose_dispatcher_notes(
    db,
    make_responder,
    make_record,
    make_zone,
):
    assigned = make_responder("assigned")
    zone_viewer = make_responder("zone-viewer")
    zone = make_zone()
    record = make_record(zone_id=zone.id)
    db.add_all([
        ResponderZone(responder_id=zone_viewer.id, zone_id=zone.id),
        RecordAssignment(
            record_id=record.id,
            responder_id=assigned.id,
            assigned_by="dispatcher",
            dispatcher_note="assigned-only",
        ),
    ])
    db.commit()
    assert_http_error(
        403,
        "Assigned responder",
        lambda: main.get_record_assignments(record.id, zone_viewer.subject_id, db),
    )


def test_matrix_messages_use_safe_record_allowlist_across_send_paths(
    db,
    make_responder,
    make_record,
    make_zone,
    monkeypatch,
):
    marker = "INTERNAL-ONLY-MARKER-9e24"
    dispatcher = make_responder("dispatcher", can_dispatch=True)
    target = make_responder("target")
    target.matrix_user_id = "@target:example"
    zone = make_zone(matrix_room_id="!zone:example")
    record = make_record(zone_id=zone.id)
    record.internal_notes_summary = marker
    record.reporter_name = marker
    bodies = []

    def capture_room(_room_id, body, **_kwargs):
        bodies.append(body)
        return {"ok": True, "event_id": "room-event"}

    def capture_direct(**kwargs):
        bodies.append(kwargs["body"])
        return {"ok": True, "event_id": "dm-event"}

    monkeypatch.setattr(main, "send_matrix_room_message", capture_room)
    monkeypatch.setattr(main, "send_matrix_direct_message", capture_direct)

    REAL_AUTO_SEND_RECORD(db, record)
    main.create_canonical_assignment(
        db,
        record_id=record.id,
        responder_id=target.id,
        actor_id=dispatcher.subject_id,
        dispatcher_note="Safe assignment detail",
    )
    main.create_matrix_manual_alert(
        record.id,
        main.MatrixManualAlertCreate(destination="one_zone", zone_id=zone.id),
        subject_id=dispatcher.subject_id,
        db=db,
    )
    create_record_in_transaction(
        db,
        {
            "summary": "Module-created record",
            "category": "Other Support",
            "severity": "Medium",
            "active_response": False,
            "zone_id": zone.id,
            "internal_notes_summary": marker,
        },
        actor_id=dispatcher.subject_id,
        notify=REAL_AUTO_SEND_RECORD,
    )
    assert len(bodies) == 4
    assert all(marker not in body for body in bodies)

    main.create_matrix_manual_alert(
        record.id,
        main.MatrixManualAlertCreate(
            destination="one_zone",
            zone_id=zone.id,
            dispatcher_note=marker,
        ),
        subject_id=dispatcher.subject_id,
        db=db,
    )
    assert marker in bodies[-1]


def test_matrix_online_fanout_uses_current_responder_authorization_without_availability(
    db,
    make_responder,
    make_record,
    monkeypatch,
):
    dispatcher = make_responder("dispatcher", can_dispatch=True)
    eligible_busy = make_responder("eligible-busy", availability="Busy")
    stale = make_responder("stale", last_seen_at=datetime.utcnow() - timedelta(minutes=30))
    unapproved = make_responder("unapproved", is_approved=False)
    inactive = make_responder("inactive", is_active=False)
    incapable = make_responder("incapable", can_respond=False)
    for responder in (eligible_busy, stale, unapproved, inactive, incapable):
        responder.matrix_user_id = f"@{responder.subject_id}:example"
    record = make_record()
    sent = []
    monkeypatch.setattr(
        main,
        "send_matrix_direct_message",
        lambda **kwargs: sent.append(kwargs["responder"].id) or {"ok": True},
    )
    main.create_matrix_manual_alert(
        record.id,
        main.MatrixManualAlertCreate(destination="all_online_responders"),
        subject_id=dispatcher.subject_id,
        db=db,
    )
    assert sent == [eligible_busy.id]

    sent.clear()
    main.create_matrix_manual_alert(
        record.id,
        main.MatrixManualAlertCreate(destination="all_responders"),
        subject_id=dispatcher.subject_id,
        db=db,
    )
    assert set(sent) == {eligible_busy.id, stale.id}

    assert_http_error(
        400,
        "current online responder",
        lambda: main.create_matrix_manual_alert(
            record.id,
            main.MatrixManualAlertCreate(destination="one_responder", responder_id=stale.id),
            subject_id=dispatcher.subject_id,
            db=db,
        ),
    )


def test_generic_record_metadata_round_trips_only_through_dispatcher_serializer(
    db,
    make_responder,
):
    dispatcher = make_responder("dispatcher", can_dispatch=True)
    occurrence = datetime(2026, 9, 14, 12, 30, tzinfo=timezone(timedelta(hours=-5)))
    created = main.create_record(
        main.RecordCreate(
            summary="Metadata record",
            category="Other Support",
            severity="Medium",
            active_response=False,
            occurrence_time=occurrence,
            reporter_name="Private Name",
            reporter_alias="Private Alias",
            reporter_contact="private@example.test",
            callback_allowed=True,
        ),
        subject_id=dispatcher.subject_id,
        db=db,
    )
    assert created["occurrence_time"] == "2026-09-14T17:30:00Z"
    assert created["reporter_name"] == "Private Name"
    assert created["reporter_alias"] == "Private Alias"
    assert created["reporter_contact"] == "private@example.test"
    assert created["callback_allowed"] is True

    record = db.get(main.RecordModel, created["id"])
    responder_view = main.serialize_record_responder(record)
    redacted_view = main.serialize_record_redacted(record)
    for field in ("reporter_name", "reporter_alias", "reporter_contact", "callback_allowed"):
        assert field not in responder_view
        assert field not in redacted_view

    updated = main.update_record(
        record.id,
        main.RecordUpdate(
            occurrence_time=datetime(2026, 9, 15, 1, tzinfo=timezone.utc),
            reporter_name=None,
            reporter_alias=None,
            reporter_contact=None,
            callback_allowed=None,
        ),
        subject_id=dispatcher.subject_id,
        db=db,
    )
    assert updated["occurrence_time"] == "2026-09-15T01:00:00Z"
    assert updated["reporter_name"] is None
    assert updated["callback_allowed"] is None


def test_host_lifecycle_cannot_reopen_closed_record_implicitly(db, make_record):
    record = make_record(status="closed")
    db.commit()
    assert_http_error(
        400,
        "canonical reopen route",
        lambda: set_record_lifecycle_in_transaction(
            db,
            record_id=record.id,
            status="under_review",
            actor_id="dispatcher",
        ),
    )
