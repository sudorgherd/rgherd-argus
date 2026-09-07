from datetime import datetime

from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .models import Record, RecordViewState, Responder


def get_last_seen_versions(
    db: Session,
    responder_id: int,
    record_ids: list[int],
) -> dict[int, int]:
    if not record_ids:
        return {}

    states = (
        db.query(RecordViewState)
        .filter(
            RecordViewState.responder_id == responder_id,
            RecordViewState.record_id.in_(record_ids),
        )
        .all()
    )
    return {state.record_id: state.last_seen_version for state in states}


def _load_view_state_for_update(
    db: Session,
    record_id: int,
    responder_id: int,
) -> RecordViewState | None:
    return (
        db.query(RecordViewState)
        .filter(
            RecordViewState.record_id == record_id,
            RecordViewState.responder_id == responder_id,
        )
        .with_for_update()
        .one_or_none()
    )


def mark_record_activity_seen(
    db: Session,
    record: Record,
    responder: Responder,
    viewed_at: datetime | None = None,
) -> RecordViewState:
    now = viewed_at or datetime.utcnow()
    state = _load_view_state_for_update(
        db,
        record.id,
        responder.id,
    )

    if state is None:
        # Keep failures from other pending caller work outside the savepoint
        # used specifically to recover a concurrent first-state insert.
        db.flush()
        try:
            with db.begin_nested():
                state = RecordViewState(
                    record_id=record.id,
                    responder_id=responder.id,
                )
                db.add(state)
                db.flush()
        except IntegrityError:
            state = _load_view_state_for_update(
                db,
                record.id,
                responder.id,
            )
            if state is None:
                raise

    state.last_seen_version = max(state.last_seen_version or 0, record.activity_version)
    state.viewed_at = now
    db.flush()
    return state


def mark_record_activity_seen_by_subject(
    db: Session,
    record: Record,
    actor_subject_id: str,
    viewed_at: datetime | None = None,
) -> RecordViewState:
    responder = (
        db.query(Responder)
        .filter(Responder.subject_id == actor_subject_id)
        .one()
    )
    return mark_record_activity_seen(
        db,
        record,
        responder,
        viewed_at=viewed_at,
    )


def bump_record_activity(
    db: Session,
    record: Record,
    actor_subject_id: str,
    viewed_at: datetime | None = None,
) -> RecordViewState:
    new_version = db.execute(
        update(Record)
        .where(Record.id == record.id)
        .values(activity_version=Record.activity_version + 1)
        .returning(Record.activity_version)
    ).scalar_one()
    record.activity_version = new_version

    return mark_record_activity_seen_by_subject(
        db,
        record,
        actor_subject_id,
        viewed_at=viewed_at,
    )
