"""add system settings

Revision ID: 88ae3828c0d2
Revises: 7b7c2f8a91d4
Create Date: 2026-05-18
"""

from alembic import op
import sqlalchemy as sa

revision = "88ae3828c0d2"
down_revision = "7b7c2f8a91d4"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.String(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("key"),
    )

    settings_table = sa.table(
        "system_settings",
        sa.column("key", sa.String),
        sa.column("value", sa.String),
    )

    op.bulk_insert(
        settings_table,
        [
            {"key": "presence_idle_minutes", "value": "5"},
            {"key": "presence_offline_minutes", "value": "10"},
        ],
    )


def downgrade():
    op.drop_table("system_settings")
