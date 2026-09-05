"""Store Google Place IDs on selected places."""

import sqlalchemy as sa
from alembic import op

revision = "20260905_0010"
down_revision = "20260829_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "selected_places",
        sa.Column("google_place_id", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("selected_places", "google_place_id")
