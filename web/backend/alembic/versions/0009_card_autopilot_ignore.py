"""add autopilot_ignore flag to kanbancard

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-17

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("kanbancard") as batch_op:
        batch_op.add_column(
            sa.Column(
                "autopilot_ignore",
                sa.Boolean(),
                nullable=False,
                server_default="0",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("kanbancard") as batch_op:
        batch_op.drop_column("autopilot_ignore")
