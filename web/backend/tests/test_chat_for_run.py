"""Tests for ``find_or_create_for_run`` and the ``POST /runs/{run_id}/chat`` endpoint."""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest
import sqlalchemy
from sqlmodel import Session, select

import json

from app.agents.errors import StateError
from app.database import Project
from app.models.agent_event import AgentEvent
from app.models.agent_run import AgentRun
from app.models.chat import Chat, ChatMessage
from app.services import chat_service


# ---------- helpers ----------


def _seed_project(engine: sqlalchemy.Engine) -> UUID:
    with Session(engine) as s:
        project = Project(name="test-project", path="/tmp/test-project")
        s.add(project)
        s.commit()
        s.refresh(project)
        return project.id


def _seed_run(
    engine: sqlalchemy.Engine, project_id: UUID, skill_name: str = "execute-set"
) -> UUID:
    run_id = uuid4()
    with Session(engine) as s:
        s.add(
            AgentRun(
                id=run_id,
                project_id=project_id,
                skill_name=skill_name,
                skill_args="{}",
                status="completed",
                max_turns=40,
            )
        )
        s.commit()
    return run_id


# ---------- tests ----------


@pytest.mark.asyncio
async def test_creates_new_chat_when_none_exists(tables: sqlalchemy.Engine):
    """First call creates a new chat thread."""
    project_id = _seed_project(tables)
    run_id = _seed_run(tables, project_id, "my-skill")

    with Session(tables) as s:
        chat = await chat_service.find_or_create_for_run(s, run_id)
        assert chat is not None
        assert chat.project_id == project_id
        assert chat.skill_name == "my-skill"
        assert "my-skill" in chat.title


@pytest.mark.asyncio
async def test_idempotent_returns_same_chat(tables: sqlalchemy.Engine):
    """Calling twice for the same run returns the same chat thread."""
    project_id = _seed_project(tables)
    run_id = _seed_run(tables, project_id)

    with Session(tables) as s:
        chat1 = await chat_service.find_or_create_for_run(s, run_id)

    with Session(tables) as s:
        # Now seed a ChatMessage referencing the run so the reverse lookup works
        s.add(ChatMessage(chat_id=chat1.id, seq=1, role="assistant", agent_run_id=run_id))
        s.commit()

    with Session(tables) as s:
        chat2 = await chat_service.find_or_create_for_run(s, run_id)

    assert chat1.id == chat2.id


@pytest.mark.asyncio
async def test_finds_via_active_run_id(tables: sqlalchemy.Engine):
    """Chat is found when active_run_id matches."""
    project_id = _seed_project(tables)
    run_id = _seed_run(tables, project_id)

    # Manually create a chat with active_run_id set
    with Session(tables) as s:
        chat = Chat(
            project_id=project_id,
            skill_name="test",
            title="existing",
            active_run_id=run_id,
        )
        s.add(chat)
        s.commit()
        s.refresh(chat)
        chat_id = chat.id

    with Session(tables) as s:
        found = await chat_service.find_or_create_for_run(s, run_id)
        assert found.id == chat_id


@pytest.mark.asyncio
async def test_finds_via_chat_message_agent_run_id(tables: sqlalchemy.Engine):
    """Chat is found via ChatMessage.agent_run_id reverse lookup."""
    project_id = _seed_project(tables)
    run_id = _seed_run(tables, project_id)

    # Create a chat with a message that references the run
    with Session(tables) as s:
        chat = Chat(project_id=project_id, skill_name="test", title="existing")
        s.add(chat)
        s.commit()
        s.refresh(chat)
        s.add(ChatMessage(chat_id=chat.id, seq=1, role="assistant", agent_run_id=run_id))
        s.commit()
        chat_id = chat.id

    with Session(tables) as s:
        found = await chat_service.find_or_create_for_run(s, run_id)
        assert found.id == chat_id


@pytest.mark.asyncio
async def test_404_for_nonexistent_run(tables: sqlalchemy.Engine):
    """Returns 404 when run_id does not exist."""
    fake_run_id = uuid4()
    with Session(tables) as s:
        with pytest.raises(StateError) as exc_info:
            await chat_service.find_or_create_for_run(s, fake_run_id)
        assert exc_info.value.error_code == "run_not_found"


@pytest.mark.asyncio
async def test_materializes_run_history_into_new_chat(tables: sqlalchemy.Engine):
    """When creating a new chat for a run, agent events are materialized as ChatMessages."""
    project_id = _seed_project(tables)
    run_id = _seed_run(tables, project_id, "my-skill")

    # Seed some AgentEvent rows for this run
    with Session(tables) as s:
        s.add(AgentEvent(run_id=run_id, seq=1, kind="status", payload=json.dumps({"status": "running"})))
        s.add(AgentEvent(run_id=run_id, seq=2, kind="assistant_text", payload=json.dumps({"text": "Hello, "})))
        s.add(AgentEvent(run_id=run_id, seq=3, kind="assistant_text", payload=json.dumps({"text": "world!"})))
        s.add(AgentEvent(run_id=run_id, seq=4, kind="tool_use", payload=json.dumps({
            "tool_use_id": "tu1", "tool_name": "Bash", "input": {"command": "ls"},
        })))
        s.add(AgentEvent(run_id=run_id, seq=5, kind="tool_result", payload=json.dumps({
            "tool_use_id": "tu1", "output": "file.txt", "is_error": False,
        })))
        s.add(AgentEvent(run_id=run_id, seq=6, kind="run_complete", payload=json.dumps({
            "status": "completed", "total_cost_usd": 0.01,
        })))
        s.commit()

    with Session(tables) as s:
        chat = await chat_service.find_or_create_for_run(s, run_id)
        chat_id = chat.id

    # Verify ChatMessages were created
    with Session(tables) as s:
        messages = list(s.exec(
            select(ChatMessage)
            .where(ChatMessage.chat_id == chat_id)
            .order_by(ChatMessage.seq.asc())
        ).all())
        assert len(messages) == 1
        assert messages[0].role == "assistant"
        assert "Hello, world!" in messages[0].content
        tool_calls = json.loads(messages[0].tool_calls)
        assert len(tool_calls) == 1
        assert tool_calls[0]["tool_name"] == "Bash"
        assert tool_calls[0]["output"] == "file.txt"
        assert messages[0].agent_run_id == run_id


@pytest.mark.asyncio
async def test_no_materialization_when_no_events(tables: sqlalchemy.Engine):
    """No ChatMessages created when run has no events."""
    project_id = _seed_project(tables)
    run_id = _seed_run(tables, project_id)

    with Session(tables) as s:
        chat = await chat_service.find_or_create_for_run(s, run_id)
        chat_id = chat.id

    with Session(tables) as s:
        messages = list(s.exec(
            select(ChatMessage).where(ChatMessage.chat_id == chat_id)
        ).all())
        assert len(messages) == 0
