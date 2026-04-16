"""chat active_run_id — bind chat thread to an active agent run

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-16

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("chat", sa.Column("active_run_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        op.f("fk_chat_active_run_id_agentrun"),
        "chat",
        "agentrun",
        ["active_run_id"],
        ["id"],
    )
    op.create_index(op.f("ix_chat_active_run_id"), "chat", ["active_run_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_chat_active_run_id"), table_name="chat")
    op.drop_constraint(op.f("fk_chat_active_run_id_agentrun"), "chat", type_="foreignkey")
    op.drop_column("chat", "active_run_id")
