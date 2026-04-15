"""agent runtime tables (agentrun, agentevent)

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-15

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agentrun",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("set_id", sa.String(), nullable=True),
        sa.Column("skill_name", sa.String(), nullable=False),
        sa.Column("skill_args", sa.String(), nullable=False, server_default="{}"),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("pid", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("active_duration_s", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("total_wall_clock_s", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("total_cost_usd", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("max_turns", sa.Integer(), nullable=False, server_default="40"),
        sa.Column("turn_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_code", sa.String(), nullable=True),
        sa.Column("error_detail", sa.String(), nullable=False, server_default="{}"),
        sa.Column("last_seq", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["project.id"],
            name=op.f("fk_agentrun_project_id_project"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agentrun")),
    )
    op.create_index(
        op.f("ix_agentrun_project_id"),
        "agentrun",
        ["project_id"],
    )
    op.create_index(
        op.f("ix_agentrun_set_id"),
        "agentrun",
        ["set_id"],
    )
    op.create_index(
        op.f("ix_agentrun_status"),
        "agentrun",
        ["status"],
    )
    op.create_index(
        "uq_agent_run_active_set",
        "agentrun",
        ["project_id", "set_id"],
        unique=True,
        sqlite_where=sa.text("status IN ('running','waiting')"),
    )

    op.create_table(
        "agentevent",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("ts", sa.DateTime(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("payload", sa.String(), nullable=False, server_default="{}"),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["agentrun.id"],
            name=op.f("fk_agentevent_run_id_agentrun"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agentevent")),
    )
    op.create_index(
        op.f("ix_agentevent_run_id"),
        "agentevent",
        ["run_id"],
    )
    op.create_index(
        op.f("ix_agentevent_seq"),
        "agentevent",
        ["seq"],
    )
    op.create_index(
        op.f("ix_agentevent_kind"),
        "agentevent",
        ["kind"],
    )
    op.create_index(
        "uq_agent_event_run_seq",
        "agentevent",
        ["run_id", "seq"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_agent_event_run_seq", table_name="agentevent")
    op.drop_index(op.f("ix_agentevent_kind"), table_name="agentevent")
    op.drop_index(op.f("ix_agentevent_seq"), table_name="agentevent")
    op.drop_index(op.f("ix_agentevent_run_id"), table_name="agentevent")
    op.drop_table("agentevent")

    op.drop_index("uq_agent_run_active_set", table_name="agentrun")
    op.drop_index(op.f("ix_agentrun_status"), table_name="agentrun")
    op.drop_index(op.f("ix_agentrun_set_id"), table_name="agentrun")
    op.drop_index(op.f("ix_agentrun_project_id"), table_name="agentrun")
    op.drop_table("agentrun")
