"""add responder last_seen_at

Revision ID: 7b7c2f8a91d4
Revises: 4efa9e036095
Create Date: 2026-05-18
"""

from alembic import op
import sqlalchemy as sa

revision = "7b7c2f8a91d4"
down_revision = "4efa9e036095"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("responders", sa.Column("last_seen_at", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("responders", "last_seen_at")
