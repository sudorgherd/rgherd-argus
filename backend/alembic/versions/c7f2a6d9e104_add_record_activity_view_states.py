"""add record activity view states

Revision ID: c7f2a6d9e104
Revises: 88ae3828c0d2
Create Date: 2026-09-07
"""

from alembic import op
import sqlalchemy as sa


revision = "c7f2a6d9e104"
down_revision = "88ae3828c0d2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "records",
        sa.Column(
            "activity_version",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.execute(sa.text("UPDATE records SET activity_version = 0"))
    op.alter_column(
        "records",
        "activity_version",
        existing_type=sa.Integer(),
        nullable=False,
        server_default=sa.text("1"),
    )

    op.create_table(
        "record_view_states",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("record_id", sa.Integer(), nullable=False),
        sa.Column("responder_id", sa.Integer(), nullable=False),
        sa.Column(
            "last_seen_version",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("viewed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["record_id"],
            ["records.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["responder_id"],
            ["responders.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "record_id",
            "responder_id",
            name="uq_record_view_state_record_responder",
        ),
    )
    op.create_index(
        "ix_record_view_states_responder_id",
        "record_view_states",
        ["responder_id"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        "ix_record_view_states_responder_id",
        table_name="record_view_states",
    )
    op.drop_table("record_view_states")
    op.drop_column("records", "activity_version")
