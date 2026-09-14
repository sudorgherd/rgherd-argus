import os
import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import pytest
import requests
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SESSION_SECRET", "test-session-secret")
os.environ.setdefault("MAS_ISSUER", "https://issuer.example")
os.environ.setdefault("MAS_CLIENT_ID", "test-client")
os.environ.setdefault("MAS_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("ARGUS_BASE_URL", "https://argus.example")


class _AuthMetadataResponse:
    def __init__(self, payload):
        self.payload = payload

    def json(self):
        return self.payload


def _auth_metadata_get(url, *args, **kwargs):
    if url.endswith("openid-configuration"):
        return _AuthMetadataResponse({"jwks_uri": "https://issuer.example/jwks"})
    return _AuthMetadataResponse({"keys": []})


with patch.object(requests, "get", side_effect=_auth_metadata_get):
    from app import main  # noqa: E402
from app.models import Base, Record, Responder, Zone  # noqa: E402


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(connection, _connection_record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, autoflush=False)
    session = testing_session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture
def make_responder(db):
    def factory(
        subject_id,
        *,
        is_admin=False,
        can_dispatch=False,
        can_respond=True,
        is_approved=True,
        is_active=True,
        presence="Online",
        availability="Available",
        last_seen_at=None,
    ):
        responder = Responder(
            subject_id=subject_id,
            display_name=subject_id,
            role="Admin" if is_admin else "Responder",
            presence=presence,
            last_seen_at=last_seen_at or datetime.utcnow(),
            availability=availability,
            is_active=is_active,
            is_approved=is_approved,
            is_admin=is_admin,
            can_dispatch=can_dispatch,
            can_respond=can_respond,
        )
        db.add(responder)
        db.flush()
        return responder

    return factory


@pytest.fixture
def make_zone(db):
    def factory(name="Test Zone", matrix_room_id=None):
        zone = Zone(
            name=name,
            matrix_room_id=matrix_room_id,
            is_active=True,
        )
        db.add(zone)
        db.flush()
        return zone

    return factory


@pytest.fixture
def make_record(db):
    def factory(
        *,
        activity_version=1,
        created_by="creator",
        zone_id=None,
        status="new",
        archived=False,
    ):
        record = Record(
            summary="Test record",
            category="Other Support",
            severity="Medium",
            active_response=False,
            status=status,
            verification_state="pending",
            activity_version=activity_version,
            location="Visible location",
            zone_id=zone_id,
            source_type="phone",
            internal_notes_summary="private intake detail",
            responder_instructions="Responder detail",
            created_by=created_by,
        )
        if archived:
            record.status = "closed"
            record.closed_at = datetime.utcnow()
            record.archived_at = datetime.utcnow()
            record.archived_by = created_by
        db.add(record)
        db.flush()
        return record

    return factory


@pytest.fixture(autouse=True)
def disable_matrix_delivery(monkeypatch):
    monkeypatch.setattr(main, "auto_send_record_to_zone", lambda db, record: None)
    monkeypatch.setattr(
        main,
        "send_matrix_direct_message",
        lambda **kwargs: {"ok": True, "event_id": "test-event"},
    )
    monkeypatch.setattr(
        main,
        "send_matrix_room_message",
        lambda *args, **kwargs: {"ok": True, "event_id": "test-event"},
    )
