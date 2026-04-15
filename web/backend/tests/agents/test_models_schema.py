"""Tests for AgentRun/AgentEvent table registration and invariants."""

from __future__ import annotations

from uuid import uuid4

import pytest
import sqlalchemy
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.database import Project
from app.models.agent_event import AgentEvent
from app.models.agent_run import AgentRun


def _make_project(session: Session) -> Project:
    proj = Project(name="test", path=f"/tmp/test-{uuid4()}")
    session.add(proj)
    session.commit()
    session.refresh(proj)
    return proj


def test_agent_run_table_registered(tables: sqlalchemy.Engine):
    with Session(tables) as session:
        proj = _make_project(session)
        run = AgentRun(project_id=proj.id, skill_name="plan-set")
        session.add(run)
        session.commit()
        session.refresh(run)

        fetched = session.exec(select(AgentRun).where(AgentRun.id == run.id)).one()
        assert fetched.status == "pending"
        assert fetched.turn_count == 0


def test_agent_run_partial_unique_index_enforced(session: Session):
    proj = _make_project(session)

    # Two active (status=running) rows with same (project_id, set_id) must collide.
    r1 = AgentRun(project_id=proj.id, set_id="wave-1", skill_name="plan-set", status="running")
    session.add(r1)
    session.commit()

    r2 = AgentRun(project_id=proj.id, set_id="wave-1", skill_name="plan-set", status="running")
    session.add(r2)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()

    # A completed row with the same (project_id, set_id) after a running row must succeed.
    r3 = AgentRun(project_id=proj.id, set_id="wave-1", skill_name="plan-set", status="completed")
    session.add(r3)
    session.commit()  # no IntegrityError


def test_agent_event_unique_seq(session: Session):
    proj = _make_project(session)
    run = AgentRun(project_id=proj.id, skill_name="plan-set")
    session.add(run)
    session.commit()
    session.refresh(run)

    e1 = AgentEvent(run_id=run.id, seq=1, kind="status", payload="{}")
    session.add(e1)
    session.commit()

    e2 = AgentEvent(run_id=run.id, seq=1, kind="status", payload="{}")
    session.add(e2)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_agent_event_fk_cascade_guard(session: Session):
    bogus = AgentEvent(run_id=uuid4(), seq=1, kind="status", payload="{}")
    session.add(bogus)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()
