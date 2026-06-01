from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


# -------------------------------------------------------------------
# Frozen v1 models
# -------------------------------------------------------------------
class Zone(Base):
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    matrix_room_id = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    records = relationship("Record", back_populates="zone")
    responder_links = relationship("ResponderZone", back_populates="zone")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


class Responder(Base):
    __tablename__ = "responders"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(String, nullable=False, unique=True, index=True)
    display_name = Column(String, nullable=False)
    matrix_user_id = Column(String, nullable=True, unique=True)
    dm_room_id = Column(String, nullable=True)
    role = Column(String, nullable=False, default="Responder")
    presence = Column(String, nullable=False, default="Offline")
    last_seen_at = Column(DateTime, nullable=True)
    availability = Column(String, nullable=False, default="Available")
    skills = Column(JSON, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    is_approved = Column(Boolean, nullable=False, default=False)
    is_admin = Column(Boolean, nullable=False, default=False)
    can_dispatch = Column(Boolean, nullable=False, default=False)
    can_respond = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    zone_links = relationship("ResponderZone", back_populates="responder")
    assignments = relationship("RecordAssignment", back_populates="responder")


class ResponderZone(Base):
    __tablename__ = "responder_zones"
    __table_args__ = (
        UniqueConstraint("responder_id", "zone_id", name="uq_responder_zone"),
    )

    id = Column(Integer, primary_key=True, index=True)
    responder_id = Column(Integer, ForeignKey("responders.id"), nullable=False)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)

    responder = relationship("Responder", back_populates="zone_links")
    zone = relationship("Zone", back_populates="responder_links")


class Record(Base):
    __tablename__ = "records"

    id = Column(Integer, primary_key=True, index=True)

    # Core intake / classification
    summary = Column(Text, nullable=False)
    category = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    active_response = Column(Boolean, nullable=False, default=False)
    professional_escalation = Column(String, nullable=True)
    status = Column(String, nullable=False, default="new")
    verification_state = Column(String, nullable=False, default="pending")

    # Optional intake detail
    location = Column(Text, nullable=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)
    source_type = Column(String, nullable=True)
    occurrence_time = Column(DateTime, nullable=True)

    # Reporter data
    reporter_name = Column(String, nullable=True)
    reporter_alias = Column(String, nullable=True)
    reporter_contact = Column(String, nullable=True)
    callback_allowed = Column(Boolean, nullable=True)

    # Notes / instructions
    internal_notes_summary = Column(Text, nullable=True)
    responder_instructions = Column(Text, nullable=True)

    # Ownership / timestamps
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    closed_by = Column(String, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    archived_by = Column(String, nullable=True)
    archived_at = Column(DateTime, nullable=True)

    # Structured closure
    outcome_type = Column(String, nullable=True)
    outcome_notes = Column(Text, nullable=True)
    responders_involved = Column(JSON, nullable=True)
    need_met = Column(Boolean, nullable=True)
    follow_up_needed = Column(Boolean, nullable=True)

    zone = relationship("Zone", back_populates="records")
    assignments = relationship("RecordAssignment", back_populates="record")
    notes = relationship("RecordNote", back_populates="record")
    audit_events = relationship("AuditEvent", back_populates="record")


class RecordAssignment(Base):
    __tablename__ = "record_assignments"
    __table_args__ = (
        UniqueConstraint("record_id", "responder_id", name="uq_record_responder"),
    )

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("records.id"), nullable=False)
    responder_id = Column(Integer, ForeignKey("responders.id"), nullable=False)

    assignment_state = Column(String, nullable=False, default="assigned")
    assigned_by = Column(String, nullable=False)
    assigned_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    cleared_at = Column(DateTime, nullable=True)
    dispatcher_note = Column(Text, nullable=True)

    record = relationship("Record", back_populates="assignments")
    responder = relationship("Responder", back_populates="assignments")


class RecordNote(Base):
    __tablename__ = "record_notes"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("records.id"), nullable=False)

    author_subject_id = Column(String, nullable=False)
    author_role = Column(String, nullable=False)
    visibility = Column(String, nullable=False, default="internal")
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    record = relationship("Record", back_populates="notes")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("records.id"), nullable=True)

    actor_id = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    event_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    record = relationship("Record", back_populates="audit_events")


class SystemAuditEvent(Base):
    __tablename__ = "system_audit_events"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    severity = Column(String, nullable=False, default="medium")
    related_record_id = Column(Integer, nullable=True)
    related_responder_id = Column(Integer, nullable=True)
    event_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
