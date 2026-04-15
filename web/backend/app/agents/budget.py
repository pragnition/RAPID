"""Python-side turn/cost budget for agent runs.

``RunBudget`` is the Python halt (emits graceful ``status`` + ``run_complete``
in Wave 3). The SDK's ``max_budget_usd`` is wired through
:func:`app.agents.sdk_options.build_sdk_options` as a second-line safety net.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Literal

from app.config import settings


@dataclass
class BudgetStatus:
    turns_used: int
    turns_remaining: int
    cost_used_usd: float
    cost_cap_usd: float
    cost_remaining_usd: float
    halted: bool
    halt_reason: Literal["none", "turns_exceeded", "cost_exceeded"] = "none"


class RunBudget:
    def __init__(self, max_turns: int, daily_cap_usd: float | None = None) -> None:
        self.max_turns = max_turns
        self.cost_cap_usd = (
            daily_cap_usd if daily_cap_usd is not None else settings.rapid_agent_daily_cap_usd
        )
        self._turns = 0
        self._cost = 0.0
        self._lock = asyncio.Lock()
        self._halted = False
        self._halt_reason: Literal["none", "turns_exceeded", "cost_exceeded"] = "none"

    async def record_turn(self, cost_usd: float) -> None:
        async with self._lock:
            self._turns += 1
            self._cost += cost_usd
            if self._turns >= self.max_turns:
                self._halted = True
                self._halt_reason = "turns_exceeded"
            elif self._cost >= self.cost_cap_usd:
                self._halted = True
                self._halt_reason = "cost_exceeded"

    async def check(self) -> BudgetStatus:
        async with self._lock:
            return BudgetStatus(
                turns_used=self._turns,
                turns_remaining=max(0, self.max_turns - self._turns),
                cost_used_usd=round(self._cost, 4),
                cost_cap_usd=self.cost_cap_usd,
                cost_remaining_usd=round(max(0.0, self.cost_cap_usd - self._cost), 4),
                halted=self._halted,
                halt_reason=self._halt_reason,
            )
