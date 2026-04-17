"""Lifespan-managed autopilot poller.

Polls autopilot-enabled columns for unclaimed cards and dispatches agent runs
via AgentSessionManager.start_run(). Respects per-project concurrency cap
by reusing the same semaphore mechanism in the session manager.
"""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING
from uuid import UUID

from sqlmodel import Session, select

from app.agents.card_routing import route_card_to_skill
from app.agents.errors import StateError
from app.database import KanbanCard, KanbanColumn
from app.services import kanban_service

if TYPE_CHECKING:
    import sqlalchemy
    from app.agents.session_manager import AgentSessionManager

logger = logging.getLogger("rapid.agents.autopilot")

_MAX_RETRY_COUNT = 3


def _build_prompt(card: KanbanCard) -> str:
    """Construct the agent prompt for a dispatched card."""
    return (
        f"You are working on kanban card '{card.title}'.\n"
        f"Card ID: {card.id}\n"
        f"Description:\n<untrusted>{card.description}</untrusted>\n\n"
        f"Complete the task described above. When done, move the card "
        f"to the 'Done' column."
    )


class AutopilotWorker:
    """Polls autopilot-enabled columns and dispatches agent runs."""

    def __init__(
        self,
        engine: "sqlalchemy.Engine",
        session_manager: "AgentSessionManager",
        interval_s: float = 60.0,
    ) -> None:
        self.engine = engine
        self.session_manager = session_manager
        self.interval_s = interval_s
        self._stopping = asyncio.Event()
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        """Start the background poll loop."""
        logger.info("autopilot worker started", extra={"interval_s": self.interval_s})
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self) -> None:
        """Stop the background poll loop gracefully."""
        logger.info("autopilot worker stopping")
        self._stopping.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    # -- poll loop ---------------------------------------------------------

    async def _poll_loop(self) -> None:
        """Main poll loop: wait interval, then poll once."""
        try:
            while not self._stopping.is_set():
                try:
                    await asyncio.wait_for(
                        self._stopping.wait(), timeout=self.interval_s
                    )
                    return  # stopping event was set
                except asyncio.TimeoutError:
                    pass

                try:
                    dispatched = await self._poll_once()
                    if dispatched > 0:
                        logger.info(
                            "autopilot cycle complete",
                            extra={"dispatched": dispatched},
                        )
                except Exception:
                    logger.exception("autopilot poll cycle failed")
        except asyncio.CancelledError:
            return

    async def _poll_once(self) -> int:
        """Run a single poll cycle. Returns number of dispatched runs.

        Exposed as a separate method for testability.
        """
        dispatched = 0

        # Discover autopilot columns and their unclaimed cards
        candidates = await asyncio.to_thread(self._find_candidates)
        logger.info("autopilot poll cycle", extra={"candidates": len(candidates)})

        for col_project_id, card_id, card_snapshot in candidates:
            try:
                dispatched += await self._dispatch_card(
                    col_project_id, card_id, card_snapshot
                )
            except Exception:
                logger.exception(
                    "autopilot dispatch failed for card %s", card_id
                )
        return dispatched

    def _find_candidates(
        self,
    ) -> list[tuple[UUID, UUID, dict]]:
        """Synchronous DB query: find all dispatchable cards.

        Returns a list of (project_id, card_id, card_snapshot_dict) tuples.
        """
        results: list[tuple[UUID, UUID, dict]] = []
        with Session(self.engine) as s:
            # All autopilot-enabled columns
            cols = list(
                s.exec(
                    select(KanbanColumn).where(
                        KanbanColumn.is_autopilot == True  # noqa: E712
                    )
                ).all()
            )
            for col in cols:
                cards = list(
                    s.exec(
                        select(KanbanCard)
                        .where(KanbanCard.column_id == col.id)
                        .where(KanbanCard.agent_status == "idle")
                        .where(KanbanCard.locked_by_run_id.is_(None))  # type: ignore[union-attr]
                        .where(KanbanCard.retry_count < _MAX_RETRY_COUNT)
                        .where(KanbanCard.autopilot_ignore == False)  # noqa: E712
                        .order_by(KanbanCard.position.asc())  # type: ignore[union-attr]
                    ).all()
                )
                for card in cards:
                    # Snapshot the card data for routing (avoid detached-instance errors)
                    snapshot = {
                        "id": card.id,
                        "title": card.title,
                        "description": card.description,
                        "metadata_json": card.metadata_json,
                        "agent_type": card.agent_type,
                    }
                    results.append((col.project_id, card.id, snapshot))
        return results

    async def _dispatch_card(
        self,
        project_id: UUID,
        card_id: UUID,
        card_snapshot: dict,
    ) -> int:
        """Dispatch a single card. Returns 1 on success, 0 on skip."""
        # Build a lightweight mock-like object for routing
        class _CardProxy:
            def __init__(self, snap: dict):
                self.id = snap["id"]
                self.title = snap["title"]
                self.description = snap["description"]
                self.metadata_json = snap["metadata_json"]
                self.agent_type = snap.get("agent_type", "quick")

        proxy = _CardProxy(card_snapshot)
        skill_name, skill_args = route_card_to_skill(proxy)  # type: ignore[arg-type]

        prompt = _build_prompt(proxy)  # type: ignore[arg-type]

        # Start the agent run
        try:
            run = await self.session_manager.start_run(
                project_id,
                skill_name,
                skill_args,
                prompt=prompt,
            )
        except StateError:
            # Concurrency cap or duplicate run — skip
            logger.debug(
                "autopilot skipped card %s: StateError from start_run",
                card_id,
            )
            return 0

        # Lock the card with the new run_id
        locked = await asyncio.to_thread(
            self._lock_card_sync, card_id, run.id
        )
        if not locked:
            # Card was claimed between query and lock — race condition
            logger.debug(
                "autopilot: card %s claimed by another run between "
                "query and lock",
                card_id,
            )
            return 0

        # Set agent_status to running
        await asyncio.to_thread(
            self._set_status_sync, card_id, "running", run.id
        )

        logger.info(
            "autopilot dispatched card %s -> run %s (skill=%s)",
            card_id,
            run.id,
            skill_name,
        )
        return 1

    def _lock_card_sync(self, card_id: UUID, run_id: UUID) -> bool:
        with Session(self.engine) as s:
            return kanban_service.lock_card(s, card_id, run_id)

    def _set_status_sync(
        self, card_id: UUID, status: str, run_id: UUID
    ) -> None:
        with Session(self.engine) as s:
            kanban_service.set_card_agent_status(s, card_id, status, run_id)
