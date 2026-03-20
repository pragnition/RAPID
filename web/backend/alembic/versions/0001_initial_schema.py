"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-03-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("path", sa.String(), nullable=False),
        sa.Column("registered_at", sa.DateTime(), nullable=False),
        sa.Column("last_seen_commit", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_project")),
        sa.UniqueConstraint("path", name=op.f("uq_project_path")),
    )

    op.create_table(
        "note",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"], ["project.id"], name=op.f("fk_note_project_id_project")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_note")),
    )

    op.create_table(
        "kanbanitem",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"], ["project.id"], name=op.f("fk_kanbanitem_project_id_project")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_kanbanitem")),
    )

    op.create_table(
        "syncstate",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("last_sync_at", sa.DateTime(), nullable=True),
        sa.Column("last_commit_hash", sa.String(), nullable=True),
        sa.Column("file_checksums", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"], ["project.id"], name=op.f("fk_syncstate_project_id_project")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_syncstate")),
        sa.UniqueConstraint("project_id", name=op.f("uq_syncstate_project_id")),
    )

    op.create_table(
        "appconfig",
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.String(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("key", name=op.f("pk_appconfig")),
    )


def downgrade() -> None:
    op.drop_table("appconfig")
    op.drop_table("syncstate")
    op.drop_table("kanbanitem")
    op.drop_table("note")
    op.drop_table("project")
