"""chat persistence — Chat, ChatMessage, ChatAttachment tables

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-16

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- chat table ---------------------------------------------------------------
    op.create_table(
        "chat",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("skill_name", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False, server_default=""),
        sa.Column("session_status", sa.String(), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_message_at", sa.DateTime(), nullable=False),
        sa.Column("archived_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["project.id"],
            name=op.f("fk_chat_project_id_project"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chat")),
    )
    op.create_index(op.f("ix_chat_project_id"), "chat", ["project_id"])
    op.create_index(op.f("ix_chat_session_status"), "chat", ["session_status"])
    op.create_index(op.f("ix_chat_created_at"), "chat", ["created_at"])
    op.create_index(op.f("ix_chat_last_message_at"), "chat", ["last_message_at"])

    # -- chatmessage table --------------------------------------------------------
    op.create_table(
        "chatmessage",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("chat_id", sa.Uuid(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("content", sa.String(), nullable=False, server_default=""),
        sa.Column("tool_calls", sa.String(), nullable=False, server_default="[]"),
        sa.Column("tool_use_id", sa.String(), nullable=True),
        sa.Column("agent_run_id", sa.Uuid(), nullable=True),
        sa.Column("temp_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["chat_id"],
            ["chat.id"],
            name=op.f("fk_chatmessage_chat_id_chat"),
        ),
        sa.ForeignKeyConstraint(
            ["agent_run_id"],
            ["agentrun.id"],
            name=op.f("fk_chatmessage_agent_run_id_agentrun"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chatmessage")),
    )
    op.create_index(op.f("ix_chatmessage_chat_id"), "chatmessage", ["chat_id"])
    op.create_index(op.f("ix_chatmessage_seq"), "chatmessage", ["seq"])
    op.create_index(op.f("ix_chatmessage_role"), "chatmessage", ["role"])
    op.create_index(op.f("ix_chatmessage_agent_run_id"), "chatmessage", ["agent_run_id"])
    op.create_index(op.f("ix_chatmessage_temp_id"), "chatmessage", ["temp_id"])
    op.create_index(op.f("ix_chatmessage_created_at"), "chatmessage", ["created_at"])
    op.create_index(
        "uq_chat_message_chat_seq",
        "chatmessage",
        ["chat_id", "seq"],
        unique=True,
    )

    # -- chatattachment table -----------------------------------------------------
    op.create_table(
        "chatattachment",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("chat_id", sa.Uuid(), nullable=True),
        sa.Column("message_id", sa.Uuid(), nullable=True),
        sa.Column("kind", sa.String(), nullable=True),
        sa.Column("payload", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["chat_id"],
            ["chat.id"],
            name=op.f("fk_chatattachment_chat_id_chat"),
        ),
        sa.ForeignKeyConstraint(
            ["message_id"],
            ["chatmessage.id"],
            name=op.f("fk_chatattachment_message_id_chatmessage"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chatattachment")),
    )
    op.create_index(op.f("ix_chatattachment_chat_id"), "chatattachment", ["chat_id"])
    op.create_index(op.f("ix_chatattachment_message_id"), "chatattachment", ["message_id"])


def downgrade() -> None:
    # -- chatattachment -----------------------------------------------------------
    op.drop_index(op.f("ix_chatattachment_message_id"), table_name="chatattachment")
    op.drop_index(op.f("ix_chatattachment_chat_id"), table_name="chatattachment")
    op.drop_table("chatattachment")

    # -- chatmessage --------------------------------------------------------------
    op.drop_index("uq_chat_message_chat_seq", table_name="chatmessage")
    op.drop_index(op.f("ix_chatmessage_created_at"), table_name="chatmessage")
    op.drop_index(op.f("ix_chatmessage_temp_id"), table_name="chatmessage")
    op.drop_index(op.f("ix_chatmessage_agent_run_id"), table_name="chatmessage")
    op.drop_index(op.f("ix_chatmessage_role"), table_name="chatmessage")
    op.drop_index(op.f("ix_chatmessage_seq"), table_name="chatmessage")
    op.drop_index(op.f("ix_chatmessage_chat_id"), table_name="chatmessage")
    op.drop_table("chatmessage")

    # -- chat ---------------------------------------------------------------------
    op.drop_index(op.f("ix_chat_last_message_at"), table_name="chat")
    op.drop_index(op.f("ix_chat_created_at"), table_name="chat")
    op.drop_index(op.f("ix_chat_session_status"), table_name="chat")
    op.drop_index(op.f("ix_chat_project_id"), table_name="chat")
    op.drop_table("chat")
