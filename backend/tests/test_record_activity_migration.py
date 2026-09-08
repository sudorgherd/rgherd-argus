import importlib.util
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy.exc import IntegrityError

from app.models import Record, RecordViewState


MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "c7f2a6d9e104_add_record_activity_view_states.py"
)


def load_migration():
    spec = importlib.util.spec_from_file_location("record_activity_migration", MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class RecordingOperations:
    def __init__(self):
        self.calls = []

    def add_column(self, table_name, column):
        self.calls.append(("add_column", table_name, column))

    def execute(self, statement):
        self.calls.append(("execute", str(statement)))

    def alter_column(self, table_name, column_name, **kwargs):
        self.calls.append(("alter_column", table_name, column_name, kwargs))

    def create_table(self, table_name, *items):
        self.calls.append(("create_table", table_name, items))

    def create_index(self, name, table_name, columns, **kwargs):
        self.calls.append(("create_index", name, table_name, columns, kwargs))


class HistoricalRowOperations(RecordingOperations):
    def __init__(self, connection):
        super().__init__()
        self.connection = connection

    def add_column(self, table_name, column):
        super().add_column(table_name, column)
        self.connection.execute(
            sa.text(
                "ALTER TABLE records "
                "ADD COLUMN activity_version INTEGER NOT NULL DEFAULT 0"
            )
        )

    def execute(self, statement):
        super().execute(statement)
        self.connection.execute(statement)


def test_migration_head_follows_canonical_head():
    migration = load_migration()
    assert migration.revision == "c7f2a6d9e104"
    assert migration.down_revision == "88ae3828c0d2"

    config = Config()
    config.set_main_option(
        "script_location",
        str(Path(__file__).resolve().parents[1] / "alembic"),
    )
    assert ScriptDirectory.from_config(config).get_heads() == ["e2f6b44d8c91"]


def test_migration_creates_version_view_state_and_unique_constraint(monkeypatch):
    migration = load_migration()
    operations = RecordingOperations()
    monkeypatch.setattr(migration, "op", operations)

    migration.upgrade()

    add_column = operations.calls[0]
    assert add_column[0:2] == ("add_column", "records")
    assert add_column[2].name == "activity_version"
    assert str(add_column[2].server_default.arg) == "0"

    create_table = next(call for call in operations.calls if call[0] == "create_table")
    assert create_table[1] == "record_view_states"
    items = create_table[2]
    assert {item.name for item in items if isinstance(item, sa.Column)} == {
        "id",
        "record_id",
        "responder_id",
        "last_seen_version",
        "viewed_at",
    }
    unique_constraints = [
        item for item in items if isinstance(item, sa.UniqueConstraint)
    ]
    assert len(unique_constraints) == 1
    assert unique_constraints[0].name == "uq_record_view_state_record_responder"
    assert unique_constraints[0]._pending_colargs == [
        "record_id",
        "responder_id",
    ]


def test_migration_preserves_historical_zero_then_changes_future_default(monkeypatch):
    migration = load_migration()
    operations = RecordingOperations()
    monkeypatch.setattr(migration, "op", operations)

    migration.upgrade()

    assert [call[0] for call in operations.calls[:3]] == [
        "add_column",
        "execute",
        "alter_column",
    ]
    assert operations.calls[1] == (
        "execute",
        "UPDATE records SET activity_version = 0",
    )
    alter_kwargs = operations.calls[2][3]
    assert str(alter_kwargs["server_default"]) == "1"


def test_historical_rows_receive_activity_version_zero(monkeypatch):
    migration = load_migration()
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(sa.text("CREATE TABLE records (id INTEGER PRIMARY KEY)"))
        connection.execute(sa.text("INSERT INTO records (id) VALUES (1)"))
        operations = HistoricalRowOperations(connection)
        monkeypatch.setattr(migration, "op", operations)

        migration.upgrade()

        version = connection.execute(
            sa.text("SELECT activity_version FROM records WHERE id = 1")
        ).scalar_one()
        assert version == 0
    engine.dispose()


def test_new_record_model_defaults_to_activity_version_one(db, make_responder):
    make_responder("creator", can_dispatch=True)
    record = Record(
        summary="New record",
        category="Other Support",
        severity="Low",
        active_response=False,
        created_by="creator",
    )
    db.add(record)
    db.flush()

    assert record.activity_version == 1


def test_database_server_default_for_new_records_is_one(db):
    result = db.execute(
        sa.text(
            """
            INSERT INTO records (
                summary,
                category,
                severity,
                active_response,
                status,
                verification_state,
                created_by,
                created_at,
                updated_at
            ) VALUES (
                'Server-default record',
                'Other Support',
                'Low',
                0,
                'new',
                'pending',
                'creator',
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )
            RETURNING activity_version
            """
        )
    )
    assert result.scalar_one() == 1


def test_record_view_state_unique_pair_is_enforced(db, make_responder, make_record):
    responder = make_responder("viewer")
    record = make_record(activity_version=1)
    db.add_all(
        [
            RecordViewState(record_id=record.id, responder_id=responder.id),
            RecordViewState(record_id=record.id, responder_id=responder.id),
        ]
    )

    with pytest.raises(IntegrityError):
        db.flush()
