from datetime import datetime

import pytest
from fastapi import HTTPException

from app import main
from app import record_activity
from app.models import RecordAssignment, RecordViewState, ResponderZone
from app.record_activity import (
    bump_record_activity,
    get_last_seen_versions,
    mark_record_activity_seen,
)


def view_state(db, record_id, responder_id):
    return (
        db.query(RecordViewState)
        .filter(
            RecordViewState.record_id == record_id,
            RecordViewState.responder_id == responder_id,
        )
        .one_or_none()
    )


def test_version_zero_without_state_is_seen_but_version_one_is_unseen(
    db,
    make_responder,
    make_record,
):
    dispatcher = make_responder("dispatcher", can_dispatch=True)
    historical = make_record(activity_version=0)
    current = make_record(activity_version=1)
    db.commit()

    payload = main.get_records(lifecycle=None, subject_id=dispatcher.subject_id, db=db)
    by_id = {record["id"]: record for record in payload["records"]}

    assert by_id[historical.id]["has_unseen_activity"] is False
    assert by_id[current.id]["has_unseen_activity"] is True
    assert by_id[historical.id]["activity_version"] == 0
    assert by_id[current.id]["activity_version"] == 1


@pytest.mark.parametrize(
    "capabilities",
    [
        {"can_dispatch": True},
        {"is_admin": True},
    ],
)
def test_dispatcher_and_admin_list_use_only_their_own_state(
    db,
    make_responder,
    make_record,
    capabilities,
):
    viewer = make_responder("viewer", **capabilities)
    other = make_responder("other", can_dispatch=True)
    record = make_record(activity_version=3)
    mark_record_activity_seen(db, record, other)
    db.commit()

    payload = main.get_records(lifecycle=None, subject_id=viewer.subject_id, db=db)
    serialized = payload["records"][0]

    assert serialized["activity_version"] == 3
    assert serialized["has_unseen_activity"] is True
    assert "last_seen_version" not in serialized
    assert "viewed_at" not in serialized
    assert "responder_id" not in serialized


def test_assigned_responder_serialization_includes_unseen_without_dispatch_fields(
    db,
    make_responder,
    make_record,
):
    responder = make_responder("assigned")
    record = make_record(activity_version=2)
    db.add(
        RecordAssignment(
            record_id=record.id,
            responder_id=responder.id,
            assigned_by="dispatcher",
        )
    )
    db.commit()

    payload = main.get_records(lifecycle=None, subject_id=responder.subject_id, db=db)
    serialized = payload["records"][0]

    assert serialized["activity_version"] == 2
    assert serialized["has_unseen_activity"] is True
    assert serialized["source_type"] == "phone"
    assert "created_by" not in serialized
    assert "internal_notes_summary" not in serialized


def test_zone_visible_record_serialization_stays_redacted_with_unseen(
    db,
    make_responder,
    make_record,
    make_zone,
):
    responder = make_responder("zone-viewer")
    zone = make_zone()
    db.add(ResponderZone(responder_id=responder.id, zone_id=zone.id))
    record = make_record(activity_version=4, zone_id=zone.id)
    db.commit()

    payload = main.get_records(lifecycle=None, subject_id=responder.subject_id, db=db)
    serialized = payload["records"][0]

    assert serialized["activity_version"] == 4
    assert serialized["has_unseen_activity"] is True
    assert "source_type" not in serialized
    assert "responder_instructions" not in serialized
    assert "internal_notes_summary" not in serialized
    assert "created_by" not in serialized


def test_mark_viewed_creates_updates_and_is_idempotent(
    db,
    make_responder,
    make_record,
):
    dispatcher = make_responder("dispatcher", can_dispatch=True)
    record = make_record(activity_version=1)
    db.commit()

    created = main.mark_record_viewed(record.id, responder=dispatcher, db=db)
    state = view_state(db, record.id, dispatcher.id)
    assert created["last_seen_version"] == 1
    assert created["has_unseen_activity"] is False
    assert state.last_seen_version == 1
    assert state.viewed_at is not None

    first_state_id = state.id
    record.activity_version = 2
    db.commit()
    updated = main.mark_record_viewed(record.id, responder=dispatcher, db=db)
    assert updated["last_seen_version"] == 2
    assert view_state(db, record.id, dispatcher.id).id == first_state_id

    repeated = main.mark_record_viewed(record.id, responder=dispatcher, db=db)
    assert repeated["last_seen_version"] == 2
    assert db.query(RecordViewState).count() == 1


def test_first_view_state_unique_conflict_recovers_inside_savepoint(
    db,
    make_responder,
    make_record,
    monkeypatch,
):
    responder = make_responder("responder")
    record = make_record(activity_version=4)
    original_viewed_at = datetime(2026, 1, 1, 12, 0, 0)
    existing = RecordViewState(
        record_id=record.id,
        responder_id=responder.id,
        last_seen_version=2,
        viewed_at=original_viewed_at,
    )
    db.add(existing)
    db.commit()

    original_loader = record_activity._load_view_state_for_update
    load_count = 0

    def miss_then_load_winning_state(db, record_id, responder_id):
        nonlocal load_count
        load_count += 1
        if load_count == 1:
            return None
        return original_loader(db, record_id, responder_id)

    monkeypatch.setattr(
        record_activity,
        "_load_view_state_for_update",
        miss_then_load_winning_state,
    )

    record.summary = "Outer transaction remains active"
    acknowledgement_time = datetime(2026, 1, 2, 12, 0, 0)
    state = mark_record_activity_seen(
        db,
        record,
        responder,
        viewed_at=acknowledgement_time,
    )

    assert load_count == 2
    assert state.id == existing.id
    assert state.last_seen_version == 4
    assert state.viewed_at == acknowledgement_time
    assert record.summary == "Outer transaction remains active"
    assert db.in_transaction()
    assert db.query(RecordViewState).count() == 1

    db.rollback()
    db.refresh(record)
    restored_state = view_state(db, record.id, responder.id)
    assert record.summary == "Test record"
    assert restored_state.last_seen_version == 2
    assert restored_state.viewed_at == original_viewed_at


def test_mark_viewed_http_endpoint_is_post_without_a_request_body():
    route = next(
        route
        for route in main.app.routes
        if getattr(route, "path", None) == "/api/records/{record_id}/view"
    )
    assert route.methods == {"POST"}
    assert route.dependant.body_params == []


def test_mark_viewed_refuses_inaccessible_record_and_distinguishes_missing(
    db,
    make_responder,
    make_record,
):
    responder = make_responder("responder")
    record = make_record(activity_version=1)
    db.commit()

    with pytest.raises(HTTPException) as inaccessible:
        main.mark_record_viewed(record.id, responder=responder, db=db)
    assert inaccessible.value.status_code == 403

    with pytest.raises(HTTPException) as missing:
        main.mark_record_viewed(99999, responder=responder, db=db)
    assert missing.value.status_code == 404


def test_create_record_starts_at_one_and_creator_is_seen_while_other_is_unseen(
    db,
    make_responder,
):
    creator = make_responder("creator", can_dispatch=True)
    other = make_responder("other", can_dispatch=True)
    payload = main.RecordCreate(
        summary="Created record",
        category="Other Support",
        severity="Medium",
        active_response=False,
    )

    serialized = main.create_record(payload, subject_id=creator.subject_id, db=db)
    record_id = serialized["id"]
    assert serialized["activity_version"] == 1
    assert serialized["has_unseen_activity"] is False
    assert view_state(db, record_id, creator.id).last_seen_version == 1

    creator_list = main.get_records(None, subject_id=creator.subject_id, db=db)
    other_list = main.get_records(None, subject_id=other.subject_id, db=db)
    assert creator_list["records"][0]["has_unseen_activity"] is False
    assert other_list["records"][0]["has_unseen_activity"] is True


def test_zone_auto_send_does_not_increment_new_record_beyond_one(
    db,
    make_responder,
    make_zone,
    monkeypatch,
):
    creator = make_responder("creator", can_dispatch=True)
    zone = make_zone(matrix_room_id="!test:example")
    monkeypatch.setattr(
        main,
        "auto_send_record_to_zone",
        lambda db, record: {
            "ok": True,
            "zone_id": zone.id,
            "room_id": zone.matrix_room_id,
        },
    )

    serialized = main.create_record(
        main.RecordCreate(
            summary="Created with delivery",
            category="Other Support",
            severity="Medium",
            active_response=False,
            zone_id=zone.id,
        ),
        subject_id=creator.subject_id,
        db=db,
    )

    assert serialized["activity_version"] == 1
    assert view_state(db, serialized["id"], creator.id).last_seen_version == 1
    event_types = [event.event_type for event in db.query(main.AuditEventModel).all()]
    assert event_types.count("matrix_zone_auto_send") == 1


def test_note_bumps_once_sees_author_and_leaves_other_unseen(
    db,
    make_responder,
    make_record,
):
    author = make_responder("author", can_dispatch=True)
    other = make_responder("other", can_dispatch=True)
    record = make_record(activity_version=1)
    db.commit()

    main.create_record_note(
        record.id,
        main.RecordNoteCreate(body="Meaningful update"),
        subject_id=author.subject_id,
        db=db,
    )
    db.refresh(record)

    assert record.activity_version == 2
    assert view_state(db, record.id, author.id).last_seen_version == 2
    other_list = main.get_records(None, subject_id=other.subject_id, db=db)
    assert other_list["records"][0]["has_unseen_activity"] is True


def test_assignment_creation_bumps_once_and_auto_send_does_not_bump_again(
    db,
    make_responder,
    make_record,
):
    dispatcher = make_responder("dispatcher", can_dispatch=True)
    target = make_responder("target")
    record = make_record(activity_version=1)
    db.commit()

    main.create_record_assignment(
        record.id,
        main.RecordAssignmentCreate(responder_id=target.id),
        subject_id=dispatcher.subject_id,
        db=db,
    )
    db.refresh(record)

    assert record.activity_version == 2
    assert view_state(db, record.id, dispatcher.id).last_seen_version == 2


def test_assignment_state_update_and_clear_each_bump_once(
    db,
    make_responder,
    make_record,
):
    responder = make_responder("responder")
    record = make_record(activity_version=1)
    assignment = RecordAssignment(
        record_id=record.id,
        responder_id=responder.id,
        assigned_by="dispatcher",
    )
    db.add(assignment)
    db.commit()

    main.update_record_assignment(
        record.id,
        assignment.id,
        main.AssignmentStateUpdate(assignment_state="active"),
        subject_id=responder.subject_id,
        db=db,
    )
    db.refresh(record)
    assert record.activity_version == 2
    assert view_state(db, record.id, responder.id).last_seen_version == 2

    main.update_record_assignment(
        record.id,
        assignment.id,
        main.AssignmentStateUpdate(mark_cleared=True),
        subject_id=responder.subject_id,
        db=db,
    )
    db.refresh(record)
    assert record.activity_version == 3
    assert view_state(db, record.id, responder.id).last_seen_version == 3


def test_assignment_deletion_bumps_once(
    db,
    make_responder,
    make_record,
):
    dispatcher = make_responder("dispatcher", can_dispatch=True)
    target = make_responder("target")
    record = make_record(activity_version=1)
    assignment = RecordAssignment(
        record_id=record.id,
        responder_id=target.id,
        assigned_by=dispatcher.subject_id,
    )
    db.add(assignment)
    db.commit()

    main.delete_record_assignment(
        record.id,
        assignment.id,
        subject_id=dispatcher.subject_id,
        db=db,
    )
    db.refresh(record)

    assert record.activity_version == 2
    assert view_state(db, record.id, dispatcher.id).last_seen_version == 2
    assert db.query(RecordAssignment).count() == 0


def test_record_edit_bumps_for_changes_but_not_for_no_op(
    db,
    make_responder,
    make_record,
):
    dispatcher = make_responder("dispatcher", can_dispatch=True)
    record = make_record(activity_version=1)
    db.commit()

    changed = main.update_record(
        record.id,
        main.RecordUpdate(severity="High"),
        subject_id=dispatcher.subject_id,
        db=db,
    )
    db.refresh(record)
    assert record.activity_version == 2
    assert changed["has_unseen_activity"] is False
    assert view_state(db, record.id, dispatcher.id).last_seen_version == 2

    unchanged = main.update_record(
        record.id,
        main.RecordUpdate(severity="High"),
        subject_id=dispatcher.subject_id,
        db=db,
    )
    db.refresh(record)
    assert record.activity_version == 2
    assert "has_unseen_activity" not in unchanged


def test_close_reopen_and_archive_each_bump_once(
    db,
    make_responder,
    make_record,
):
    admin = make_responder("admin", is_admin=True, can_dispatch=True)
    record = make_record(activity_version=1)
    db.commit()

    close_payload = main.RecordClose(
        outcome_type="completed",
        outcome_notes="Handled",
        responders_involved=[],
        need_met=True,
        follow_up_needed=False,
    )
    main.close_record(record.id, close_payload, subject_id=admin.subject_id, db=db)
    db.refresh(record)
    assert record.activity_version == 2

    main.reopen_record(
        record.id,
        main.RecordReopen(reason="More work"),
        subject_id=admin.subject_id,
        db=db,
    )
    db.refresh(record)
    assert record.activity_version == 3

    main.close_record(record.id, close_payload, subject_id=admin.subject_id, db=db)
    db.refresh(record)
    assert record.activity_version == 4

    main.archive_record(
        record.id,
        main.RecordArchive(reason="Complete"),
        subject_id=admin.subject_id,
        db=db,
    )
    db.refresh(record)
    assert record.activity_version == 5
    assert view_state(db, record.id, admin.id).last_seen_version == 5


def test_manual_matrix_alert_does_not_bump_activity(
    db,
    make_responder,
    make_record,
    make_zone,
):
    dispatcher = make_responder("dispatcher", can_dispatch=True)
    zone = make_zone(matrix_room_id="!test:example")
    record = make_record(activity_version=7, zone_id=zone.id)
    db.commit()

    main.create_matrix_manual_alert(
        record.id,
        main.MatrixManualAlertCreate(destination="one_zone", zone_id=zone.id),
        subject_id=dispatcher.subject_id,
        db=db,
    )
    db.refresh(record)

    assert record.activity_version == 7
    assert view_state(db, record.id, dispatcher.id) is None


def test_bump_and_actor_seen_share_caller_transaction_without_commit(
    db,
    make_responder,
    make_record,
    monkeypatch,
):
    actor = make_responder("actor")
    record = make_record(activity_version=1)
    db.commit()
    commit_called = False

    def unexpected_commit():
        nonlocal commit_called
        commit_called = True
        raise AssertionError("helper must not commit")

    monkeypatch.setattr(db, "commit", unexpected_commit)
    bump_record_activity(db, record, actor.subject_id)

    assert commit_called is False
    assert record.activity_version == 2
    assert view_state(db, record.id, actor.id).last_seen_version == 2
    assert db.in_transaction()


def test_rollback_restores_mutation_version_and_actor_seen_state(
    db,
    make_responder,
    make_record,
):
    actor = make_responder("actor")
    record = make_record(activity_version=1)
    db.commit()
    record_id = record.id
    responder_id = actor.id

    record.summary = "Rolled-back summary"
    bump_record_activity(db, record, actor.subject_id)
    db.flush()
    db.rollback()

    restored = db.get(type(record), record_id)
    assert restored.summary == "Test record"
    assert restored.activity_version == 1
    assert view_state(db, record_id, responder_id) is None


def test_record_purge_cascades_view_states(
    db,
    make_responder,
    make_record,
):
    admin = make_responder("admin", is_admin=True, can_dispatch=True)
    viewer = make_responder("viewer")
    record = make_record(activity_version=2, archived=True)
    mark_record_activity_seen(db, record, viewer)
    db.commit()

    result = main.purge_record(record.id, subject_id=admin.subject_id, db=db)

    assert result["ok"] is True
    assert db.query(RecordViewState).count() == 0


def test_responder_deletion_cascades_view_states(
    db,
    make_responder,
    make_record,
):
    admin = make_responder("admin", is_admin=True, can_dispatch=True)
    viewer = make_responder("viewer")
    record = make_record(activity_version=2)
    mark_record_activity_seen(db, record, viewer)
    db.commit()

    result = main.delete_admin_responder(
        viewer.id,
        subject_id=admin.subject_id,
        db=db,
    )

    assert result["ok"] is True
    assert db.query(RecordViewState).count() == 0


def test_last_seen_versions_batches_only_requested_responder_states(
    db,
    make_responder,
    make_record,
):
    viewer = make_responder("viewer")
    other = make_responder("other")
    first = make_record(activity_version=2)
    second = make_record(activity_version=3)
    db.add_all(
        [
            RecordViewState(
                record_id=first.id,
                responder_id=viewer.id,
                last_seen_version=2,
                viewed_at=datetime.utcnow(),
            ),
            RecordViewState(
                record_id=second.id,
                responder_id=other.id,
                last_seen_version=3,
                viewed_at=datetime.utcnow(),
            ),
        ]
    )
    db.commit()

    versions = get_last_seen_versions(db, viewer.id, [first.id, second.id])
    assert versions == {first.id: 2}
