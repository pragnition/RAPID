"""kanban v2 autopilot — agent-aware columns on kanbancard and kanbancolumn

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-16

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- kanbancard: add agent-aware columns -----------------------------------
    with op.batch_alter_table("kanbancard") as batch_op:
        batch_op.add_column(
            sa.Column("rev", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("created_by", sa.String(), nullable=False, server_default="human")
        )
        batch_op.add_column(
            sa.Column("locked_by_run_id", sa.Uuid(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("completed_by_run_id", sa.Uuid(), nullable=True)
        )
        batch_op.add_column(
            sa.Column(
                "agent_status", sa.String(), nullable=False, server_default="idle"
            )
        )
        batch_op.add_column(
            sa.Column(
                "metadata_json", sa.String(), nullable=False, server_default="{}"
            )
        )
        batch_op.add_column(
            sa.Column("agent_run_id", sa.Uuid(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.create_foreign_key(
            "fk_kanbancard_locked_by_run_id_agentrun",
            "agentrun",
            ["locked_by_run_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            "fk_kanbancard_completed_by_run_id_agentrun",
            "agentrun",
            ["completed_by_run_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            "fk_kanbancard_agent_run_id_agentrun",
            "agentrun",
            ["agent_run_id"],
            ["id"],
        )

    op.create_index(
        "ix_kanbancard_agent_status", "kanbancard", ["agent_status"]
    )
    op.create_index(
        "ix_kanbancard_status_locked",
        "kanbancard",
        ["agent_status", "locked_by_run_id"],
    )

    # -- kanbancolumn: add autopilot flag --------------------------------------
    with op.batch_alter_table("kanbancolumn") as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_autopilot",
                sa.Boolean(),
                nullable=False,
                server_default="0",
            )
        )


def downgrade() -> None:
    # -- kanbancolumn ----------------------------------------------------------
    with op.batch_alter_table("kanbancolumn") as batch_op:
        batch_op.drop_column("is_autopilot")

    # -- kanbancard ------------------------------------------------------------
    op.drop_index("ix_kanbancard_status_locked", table_name="kanbancard")
    op.drop_index("ix_kanbancard_agent_status", table_name="kanbancard")

    with op.batch_alter_table("kanbancard") as batch_op:
        batch_op.drop_constraint(
            "fk_kanbancard_agent_run_id_agentrun", type_="foreignkey"
        )
        batch_op.drop_constraint(
            "fk_kanbancard_completed_by_run_id_agentrun", type_="foreignkey"
        )
        batch_op.drop_constraint(
            "fk_kanbancard_locked_by_run_id_agentrun", type_="foreignkey"
        )
        batch_op.drop_column("retry_count")
        batch_op.drop_column("agent_run_id")
        batch_op.drop_column("metadata_json")
        batch_op.drop_column("agent_status")
        batch_op.drop_column("completed_by_run_id")
        batch_op.drop_column("locked_by_run_id")
        batch_op.drop_column("created_by")
        batch_op.drop_column("rev")
