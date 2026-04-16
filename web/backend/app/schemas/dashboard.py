"""Response schemas for the ``GET /api/dashboard`` endpoint."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class _RecentRun(BaseModel):
    id: UUID
    skill_name: str
    status: str
    started_at: datetime


class RunsSummary(BaseModel):
    running: int
    waiting: int
    failed: int
    completed: int
    recent: list[_RecentRun]  # top 5


class _RecentThread(BaseModel):
    id: UUID
    title: str
    skill_name: str
    last_message_at: datetime
    session_status: str


class ChatsSummary(BaseModel):
    active: int
    idle: int
    archived: int
    recent: list[_RecentThread]  # top 5


class KanbanSummary(BaseModel):
    total: int
    in_progress: int
    blocked: int


class BudgetRemaining(BaseModel):
    daily_cap: float
    spent_today: float
    remaining: float


class _ActivityItem(BaseModel):
    kind: Literal["run", "chat"]
    id: UUID
    title: str  # skill_name for runs, title for chats
    status: str
    ts: datetime


class DashboardResponse(BaseModel):
    runs_summary: RunsSummary
    chats_summary: ChatsSummary
    kanban_summary: KanbanSummary
    budget_remaining: BudgetRemaining
    recent_activity: list[_ActivityItem]  # top 10 across runs + chats
