"""Tests for ``can_use_tool_hook_bound`` AUQ interception.

For each ``questions_count``, kick off the bound hook, drain the per-question
prompts that land in the DB in order, and answer each one. Assert:
* The number of distinct ``batch_position`` values equals ``questions_count``.
* All emitted prompts share the same ``batch_id``.
* The synthesized ``PermissionResultDeny.message`` is JSON with an ``answers``
  list whose length and order matches the inputs.
* The number of chunks (n_of_m total) equals ``ceil(questions_count / 4)``.
"""

from __future__ import annotations

import asyncio
import json
import math
import types
from uuid import UUID, uuid4

import pytest
import sqlalchemy
from sqlmodel import Session, select

from app.agents.permission_hooks import can_use_tool_hook_bound
from app.agents.session_manager import AgentSessionManager
from app.database import Project
from app.models.agent_prompt import AgentPrompt
from app.models.agent_run import AgentRun


def _seed_run(engine: sqlalchemy.Engine) -> UUID:
    with Session(engine) as s:
        p = Project(name="auq-test", path="/tmp/auq-intercept")
        s.add(p)
        s.commit()
        s.refresh(p)
        run = AgentRun(
            id=uuid4(),
            project_id=p.id,
            skill_name="execute-set",
            skill_args="{}",
            status="running",
            max_turns=40,
        )
        s.add(run)
        s.commit()
        return run.id


def _fake_ctx():
    return types.SimpleNamespace(tool_use_id="tu-auq", suggestions=[])


async def _wait_for_pending_prompt(
    engine: sqlalchemy.Engine, run_id: UUID, timeout_s: float = 2.0
) -> AgentPrompt:
    deadline = asyncio.get_event_loop().time() + timeout_s
    while asyncio.get_event_loop().time() < deadline:
        await asyncio.sleep(0.005)

        def _load() -> AgentPrompt | None:
            with Session(engine) as s:
                rows = s.exec(
                    select(AgentPrompt)
                    .where(AgentPrompt.run_id == run_id)
                    .where(AgentPrompt.status == "pending")
                ).all()
                return rows[0] if rows else None

        row = await asyncio.to_thread(_load)
        if row is not None:
            return row
    raise AssertionError("no pending prompt appeared within timeout")


@pytest.mark.asyncio
@pytest.mark.parametrize("questions_count", [1, 2, 4, 5, 6, 12])
async def test_auq_interception_synthesizes_answers(
    questions_count: int,
    manager: AgentSessionManager,
    tables: sqlalchemy.Engine,
) -> None:
    run_id = _seed_run(tables)

    questions = [
        {
            "question": f"question {i}?",
            "options": ["yes", "no"],
            "allow_free_text": False,
        }
        for i in range(questions_count)
    ]

    expected_answers = [f"ans-{i}" for i in range(questions_count)]

    # Spawn the hook on a background task. It will block awaiting prompt
    # answers; we drive resolution from the main task.
    hook_task = asyncio.create_task(
        can_use_tool_hook_bound(
            "AskUserQuestion",
            {"questions": questions},
            _fake_ctx(),
            run_id=run_id,
            manager=manager,
        )
    )

    # Resolve each prompt in the order they appear. Because the hook walks
    # questions sequentially, the pending prompt at any moment corresponds to
    # the next answer in expected_answers.
    answered_prompt_ids: list[str] = []
    for i in range(questions_count):
        row = await _wait_for_pending_prompt(tables, run_id)
        await manager.resolve_prompt(run_id, row.id, expected_answers[i])
        answered_prompt_ids.append(row.id)

    result = await asyncio.wait_for(hook_task, timeout=3.0)

    # Result is a PermissionResultDeny carrying JSON in `message`.
    assert result.behavior == "deny"
    payload = json.loads(result.message)
    assert "answers" in payload
    assert payload["answers"] == expected_answers

    # Per-row assertions: shared batch_id, contiguous batch_position from 0,
    # and the n_of_m total carried in payload matches ceil(qc/4).
    expected_chunks = math.ceil(questions_count / 4)
    with Session(tables) as s:
        rows = s.exec(
            select(AgentPrompt)
            .where(AgentPrompt.run_id == run_id)
            .order_by(AgentPrompt.batch_position)  # type: ignore[attr-defined]
        ).all()
        assert len(rows) == questions_count

        batch_ids = {r.batch_id for r in rows}
        assert len(batch_ids) == 1
        assert next(iter(batch_ids)) is not None

        positions = [r.batch_position for r in rows]
        assert positions == list(range(questions_count))

        for r in rows:
            assert r.status == "answered"
            assert r.answered_at is not None
            assert r.consumed_at is not None
            payload_dict = json.loads(r.payload)
            n_of_m = payload_dict.get("n_of_m")
            assert n_of_m is not None
            assert n_of_m[1] == expected_chunks


@pytest.mark.asyncio
async def test_auq_interception_empty_questions_allows(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    """Degenerate AUQ call with no questions short-circuits to allow."""
    run_id = _seed_run(tables)
    result = await can_use_tool_hook_bound(
        "AskUserQuestion",
        {"questions": []},
        _fake_ctx(),
        run_id=run_id,
        manager=manager,
    )
    assert result.behavior == "allow"


@pytest.mark.asyncio
async def test_auq_interception_passes_through_other_tools(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    run_id = _seed_run(tables)
    result = await can_use_tool_hook_bound(
        "Edit",
        {"file_path": "x.py"},
        _fake_ctx(),
        run_id=run_id,
        manager=manager,
    )
    assert result.behavior == "allow"


@pytest.mark.asyncio
async def test_auq_interception_blocks_destructive_bash(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    run_id = _seed_run(tables)
    result = await can_use_tool_hook_bound(
        "Bash",
        {"command": "rm -rf /"},
        _fake_ctx(),
        run_id=run_id,
        manager=manager,
    )
    assert result.behavior == "deny"
    assert "firewall" in result.message.lower()
