"""add agent_type to kanbancard and default_agent_type to kanbancolumn

Revision ID: 0010
Revises: 0009
Create Date: 2026-04-17

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("kanbancard") as batch_op:
        batch_op.add_column(
            sa.Column(
                "agent_type",
                sa.VARCHAR(),
                nullable=False,
                server_default="quick",
            )
        )

    with op.batch_alter_table("kanbancolumn") as batch_op:
        batch_op.add_column(
            sa.Column(
                "default_agent_type",
                sa.VARCHAR(),
                nullable=False,
                server_default="quick",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("kanbancolumn") as batch_op:
        batch_op.drop_column("default_agent_type")

    with op.batch_alter_table("kanbancard") as batch_op:
        batch_op.drop_column("agent_type")
