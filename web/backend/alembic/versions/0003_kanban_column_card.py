"""replace kanbanitem with kanbancolumn and kanbancard

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("kanbanitem")

    op.create_table(
        "kanbancolumn",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["project.id"],
            name=op.f("fk_kanbancolumn_project_id_project"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_kanbancolumn")),
    )
    op.create_index(
        op.f("ix_kanbancolumn_project_id"),
        "kanbancolumn",
        ["project_id"],
    )

    op.create_table(
        "kanbancard",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("column_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False, server_default=""),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["column_id"],
            ["kanbancolumn.id"],
            name=op.f("fk_kanbancard_column_id_kanbancolumn"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_kanbancard")),
    )
    op.create_index(
        op.f("ix_kanbancard_column_id"),
        "kanbancard",
        ["column_id"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_kanbancard_column_id"), table_name="kanbancard")
    op.drop_table("kanbancard")
    op.drop_index(op.f("ix_kanbancolumn_project_id"), table_name="kanbancolumn")
    op.drop_table("kanbancolumn")

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
            ["project_id"],
            ["project.id"],
            name=op.f("fk_kanbanitem_project_id_project"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_kanbanitem")),
    )
