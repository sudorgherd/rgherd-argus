import importlib.util
from pathlib import Path

import sqlalchemy as sa
from alembic.config import Config
from alembic.script import ScriptDirectory


MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "e2f6b44d8c91_add_argus_module_states.py"
)


def load_migration():
    spec = importlib.util.spec_from_file_location("module_state_migration", MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class RecordingOperations:
    def __init__(self):
        self.calls = []

    def create_table(self, table_name, *items):
        self.calls.append(("create_table", table_name, items))

    def drop_table(self, table_name):
        self.calls.append(("drop_table", table_name))


def test_module_state_migration_is_singular_head(monkeypatch):
    migration = load_migration()
    assert migration.revision == "e2f6b44d8c91"
    assert migration.down_revision == "c7f2a6d9e104"

    config = Config()
    config.set_main_option(
        "script_location",
        str(Path(__file__).resolve().parents[1] / "alembic"),
    )
    assert ScriptDirectory.from_config(config).get_heads() == ["e2f6b44d8c91"]

    operations = RecordingOperations()
    monkeypatch.setattr(migration, "op", operations)
    migration.upgrade()
    creation = operations.calls[0]
    assert creation[0:2] == ("create_table", "argus_module_states")
    columns = {item.name for item in creation[2] if isinstance(item, sa.Column)}
    assert columns == {"module_id", "enabled", "installed_version", "updated_at"}

    migration.downgrade()
    assert operations.calls[-1] == ("drop_table", "argus_module_states")
