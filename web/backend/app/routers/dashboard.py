"""FastAPI router for the consolidated dashboard endpoint (``/api/dashboard``).

Single endpoint: ``GET /api/dashboard?project_id=X`` returning aggregated
counts and recent items for runs, chats, kanban, and budget.

Includes a 1-second in-memory LRU-ish cache to prevent thundering herd on
tab focus.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from app.config import settings
from app.database import KanbanCard, KanbanColumn
from app.main import get_db
from app.models.agent_run import AgentRun
from app.models.chat import Chat
from app.schemas.dashboard import (
    BudgetRemaining,
    ChatsSummary,
    DashboardResponse,
    KanbanSummary,
    RunsSummary,
    _ActivityItem,
    _RecentRun,
    _RecentThread,
)

logger = logging.getLogger("rapid.routers.dashboard")

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


# ---------------------------------------------------------------------------
# Cache (1-second in-memory, capped at 64 entries)
# ---------------------------------------------------------------------------

_MAX_CACHE = 64
_CACHE_TTL_S = 1.0
_cache: dict[UUID, tuple[DashboardResponse, float]] = {}


def _invalidate_cache(project_id: UUID | None = None) -> None:
    """Invalidate a single project or the entire cache."""
    if project_id is not None:
        _cache.pop(project_id, None)
    else:
        _cache.clear()


def _clear_cache() -> None:
    """Reset the cache entirely (for test isolation)."""
    _cache.clear()


def _get_cached(project_id: UUID) -> DashboardResponse | None:
    """Return cached response if fresh, else None."""
    entry = _cache.get(project_id)
    if entry is None:
        return None
    resp, ts = entry
    if time.monotonic() - ts < _CACHE_TTL_S:
        return resp
    # Stale -- remove and return None
    _cache.pop(project_id, None)
    return None


def _put_cache(project_id: UUID, resp: DashboardResponse) -> None:
    """Store a response in the cache, evicting oldest if at cap."""
    if len(_cache) >= _MAX_CACHE:
        # Evict oldest entry by timestamp
        oldest_key = min(_cache, key=lambda k: _cache[k][1])
        _cache.pop(oldest_key, None)
    _cache[project_id] = (resp, time.monotonic())


# ---------------------------------------------------------------------------
# Aggregation helpers
# ---------------------------------------------------------------------------


def _build_runs_summary(session: Session, project_id: UUID) -> RunsSummary:
    """Aggregate run counts by status and fetch 5 most recent runs."""
    # Counts by status
    rows = session.exec(
        select(AgentRun.status, func.count(AgentRun.id))
        .where(AgentRun.project_id == project_id)
        .group_by(AgentRun.status)
    ).all()

    counts: dict[str, int] = {}
    for status, cnt in rows:
        counts[status] = cnt

    # Recent 5
    recent_rows = session.exec(
        select(AgentRun)
        .where(AgentRun.project_id == project_id)
        .order_by(AgentRun.started_at.desc())  # type: ignore[union-attr]
        .limit(5)
    ).all()

    return RunsSummary(
        running=counts.get("running", 0),
        waiting=counts.get("waiting", 0),
        failed=counts.get("failed", 0),
        completed=counts.get("completed", 0),
        recent=[
            _RecentRun(
                id=r.id,
                skill_name=r.skill_name,
                status=r.status,
                started_at=r.started_at,
            )
            for r in recent_rows
        ],
    )


def _build_chats_summary(session: Session, project_id: UUID) -> ChatsSummary:
    """Aggregate chat counts by status and fetch 5 most recent active threads."""
    # Counts using CASE expressions
    result = session.exec(
        select(
            func.sum(
                func.iif(
                    (Chat.session_status == "active") & (Chat.archived_at.is_(None)),  # type: ignore[union-attr]
                    1,
                    0,
                )
            ).label("active"),
            func.sum(
                func.iif(
                    (Chat.session_status == "idle") & (Chat.archived_at.is_(None)),  # type: ignore[union-attr]
                    1,
                    0,
                )
            ).label("idle"),
            func.sum(
                func.iif(Chat.archived_at.is_not(None), 1, 0)  # type: ignore[union-attr]
            ).label("archived"),
        ).where(Chat.project_id == project_id)
    ).one()

    active_cnt = result[0] or 0
    idle_cnt = result[1] or 0
    archived_cnt = result[2] or 0

    # Recent 5 non-archived
    recent_rows = session.exec(
        select(Chat)
        .where(Chat.project_id == project_id, Chat.archived_at.is_(None))  # type: ignore[union-attr]
        .order_by(Chat.last_message_at.desc())  # type: ignore[union-attr]
        .limit(5)
    ).all()

    return ChatsSummary(
        active=active_cnt,
        idle=idle_cnt,
        archived=archived_cnt,
        recent=[
            _RecentThread(
                id=c.id,
                title=c.title,
                skill_name=c.skill_name,
                last_message_at=c.last_message_at,
                session_status=c.session_status,
            )
            for c in recent_rows
        ],
    )


def _build_kanban_summary(session: Session, project_id: UUID) -> KanbanSummary:
    """Count kanban cards for the project."""
    # Get column IDs for this project
    col_ids = list(
        session.exec(
            select(KanbanColumn.id).where(KanbanColumn.project_id == project_id)
        ).all()
    )

    if not col_ids:
        return KanbanSummary(total=0, in_progress=0, blocked=0)

    total = session.exec(
        select(func.count(KanbanCard.id)).where(
            KanbanCard.column_id.in_(col_ids)  # type: ignore[union-attr]
        )
    ).one()

    # in_progress and blocked: kanban schema does not have explicit status columns;
    # column positions encode status. Return total for in_progress placeholder, 0 for blocked.
    # TODO: refine once kanban schema gains explicit status fields.
    return KanbanSummary(total=total, in_progress=0, blocked=0)


def _build_budget_remaining(session: Session, project_id: UUID) -> BudgetRemaining:
    """Calculate budget usage for today."""
    daily_cap = settings.rapid_agent_daily_cap_usd

    # Sum today's cost
    today_midnight = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    spent = session.exec(
        select(func.coalesce(func.sum(AgentRun.total_cost_usd), 0.0)).where(
            AgentRun.project_id == project_id,
            AgentRun.started_at >= today_midnight,
        )
    ).one()
    spent_val = float(spent)

    return BudgetRemaining(
        daily_cap=daily_cap,
        spent_today=spent_val,
        remaining=max(0.0, daily_cap - spent_val),
    )


def _build_recent_activity(
    session: Session, project_id: UUID
) -> list[_ActivityItem]:
    """Merge 10 most recent runs + 10 most recent chats, sort by ts desc, take 10."""
    items: list[_ActivityItem] = []

    # Recent runs
    runs = session.exec(
        select(AgentRun)
        .where(AgentRun.project_id == project_id)
        .order_by(AgentRun.started_at.desc())  # type: ignore[union-attr]
        .limit(10)
    ).all()
    for r in runs:
        items.append(
            _ActivityItem(
                kind="run",
                id=r.id,
                title=r.skill_name,
                status=r.status,
                ts=r.started_at,
            )
        )

    # Recent chats
    chats = session.exec(
        select(Chat)
        .where(Chat.project_id == project_id)
        .order_by(Chat.last_message_at.desc())  # type: ignore[union-attr]
        .limit(10)
    ).all()
    for c in chats:
        items.append(
            _ActivityItem(
                kind="chat",
                id=c.id,
                title=c.title or c.skill_name,
                status=c.session_status,
                ts=c.last_message_at,
            )
        )

    # Sort by ts desc, take 10
    items.sort(key=lambda x: x.ts, reverse=True)
    return items[:10]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    project_id: UUID,
    session: Session = Depends(get_db),
):
    """Consolidated dashboard: counts + 5 most recent items per section."""
    # Check cache
    cached = _get_cached(project_id)
    if cached is not None:
        return cached

    resp = DashboardResponse(
        runs_summary=_build_runs_summary(session, project_id),
        chats_summary=_build_chats_summary(session, project_id),
        kanban_summary=_build_kanban_summary(session, project_id),
        budget_remaining=_build_budget_remaining(session, project_id),
        recent_activity=_build_recent_activity(session, project_id),
    )

    _put_cache(project_id, resp)
    return resp
