"""Tests for ``app.agents.budget.RunBudget``."""

from __future__ import annotations

import asyncio

import pytest

from app.agents.budget import RunBudget


@pytest.mark.asyncio
async def test_initial_state():
    rb = RunBudget(max_turns=10)
    s = await rb.check()
    assert s.turns_used == 0
    assert s.turns_remaining == 10
    assert s.halted is False
    assert s.halt_reason == "none"
    assert s.cost_used_usd == 0.0


@pytest.mark.asyncio
async def test_turns_exceeded_halts():
    rb = RunBudget(max_turns=3, daily_cap_usd=100.0)
    for _ in range(3):
        await rb.record_turn(0.01)
    s = await rb.check()
    assert s.halted is True
    assert s.halt_reason == "turns_exceeded"
    assert s.turns_used == 3
    assert s.turns_remaining == 0


@pytest.mark.asyncio
async def test_cost_exceeded_halts():
    rb = RunBudget(max_turns=100, daily_cap_usd=1.0)
    await rb.record_turn(1.5)
    s = await rb.check()
    assert s.halted is True
    assert s.halt_reason == "cost_exceeded"
    assert s.cost_remaining_usd == 0.0


@pytest.mark.asyncio
async def test_concurrent_record_turn_is_safe():
    rb = RunBudget(max_turns=1000, daily_cap_usd=100.0)
    await asyncio.gather(*(rb.record_turn(0.01) for _ in range(50)))
    s = await rb.check()
    assert s.turns_used == 50
    assert s.cost_used_usd == pytest.approx(0.50, abs=1e-4)
    assert s.halted is False


@pytest.mark.asyncio
async def test_defaults_to_settings_cap():
    # No daily_cap_usd override: uses settings.rapid_agent_daily_cap_usd.
    from app.config import settings as _s

    rb = RunBudget(max_turns=10)
    assert rb.cost_cap_usd == _s.rapid_agent_daily_cap_usd
