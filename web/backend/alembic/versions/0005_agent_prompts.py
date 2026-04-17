"""agent_prompts table (server-minted ask_user prompts)

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-15

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agentprompt",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False, server_default="ask_user"),
        sa.Column("payload", sa.String(), nullable=False, server_default="{}"),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("answer", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("answered_at", sa.DateTime(), nullable=True),
        sa.Column("consumed_at", sa.DateTime(), nullable=True),
        sa.Column("batch_id", sa.String(), nullable=True),
        sa.Column("batch_position", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["agentrun.id"],
            name=op.f("fk_agentprompt_run_id_agentrun"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agentprompt")),
    )
    op.create_index(
        op.f("ix_agentprompt_run_id"),
        "agentprompt",
        ["run_id"],
    )
    op.create_index(
        op.f("ix_agentprompt_status"),
        "agentprompt",
        ["status"],
    )
    op.create_index(
        op.f("ix_agentprompt_batch_id"),
        "agentprompt",
        ["batch_id"],
    )
    op.create_index(
        "ix_agent_prompt_run_created",
        "agentprompt",
        ["run_id", "created_at"],
    )
    op.create_index(
        "uq_agent_prompt_run_pending",
        "agentprompt",
        ["run_id"],
        unique=True,
        sqlite_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_index("uq_agent_prompt_run_pending", table_name="agentprompt")
    op.drop_index("ix_agent_prompt_run_created", table_name="agentprompt")
    op.drop_index(op.f("ix_agentprompt_batch_id"), table_name="agentprompt")
    op.drop_index(op.f("ix_agentprompt_status"), table_name="agentprompt")
    op.drop_index(op.f("ix_agentprompt_run_id"), table_name="agentprompt")
    op.drop_table("agentprompt")
