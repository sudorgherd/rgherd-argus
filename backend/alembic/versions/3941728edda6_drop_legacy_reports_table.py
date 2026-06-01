"""drop legacy reports table

Revision ID: 3941728edda6
Revises: a84df04cb272
Create Date: 2026-04-13 23:29:53.581068

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3941728edda6'
down_revision: Union[str, Sequence[str], None] = 'a84df04cb272'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_table("reports")


def downgrade() -> None:
    """Downgrade schema."""
    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("type", sa.String(), nullable=True),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("priority", sa.String(), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=True),
    )
    op.create_index(op.f("ix_reports_id"), "reports", ["id"], unique=False)
