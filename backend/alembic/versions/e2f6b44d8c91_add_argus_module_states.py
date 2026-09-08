"""add generic ARGUS module state

Revision ID: e2f6b44d8c91
Revises: c7f2a6d9e104
Create Date: 2026-09-08
"""

from alembic import op
import sqlalchemy as sa


revision = "e2f6b44d8c91"
down_revision = "c7f2a6d9e104"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "argus_module_states",
        sa.Column("module_id", sa.String(), nullable=False),
        sa.Column(
            "enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("installed_version", sa.String(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("module_id"),
    )


def downgrade() -> None:
    op.drop_table("argus_module_states")
