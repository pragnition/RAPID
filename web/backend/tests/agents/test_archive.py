"""Tests for ``app.agents.archive.archive_expired_runs``."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import pytest
import sqlalchemy
from sqlalchemy import text
from sqlmodel import Session

from app.agents import archive as archive_mod
from app.agents.archive import archive_expired_runs
from app.database import Project
from app.models.agent_event import AgentEvent
from app.models.agent_run import AgentRun


def _seed_project(engine: sqlalchemy.Engine) -> Project:
    with Session(engine) as s:
        p = Project(name="archive-test", path=f"/tmp/archive-{uuid4().hex}")
        s.add(p)
        s.commit()
        s.refresh(p)
        return p


def _insert_run_with_events(
    engine: sqlalchemy.Engine,
    *,
    project_id,
    status: str,
    ended_at,
    n_events: int,
):
    run_id = uuid4()
    with Session(engine) as s:
        s.add(
            AgentRun(
                id=run_id,
                project_id=project_id,
                skill_name="execute-set",
                skill_args="{}",
                status=status,
                started_at=datetime.now(timezone.utc) - timedelta(days=2),
                ended_at=ended_at,
            )
        )
        s.commit()
        for i in range(1, n_events + 1):
            s.add(
                AgentEvent(
                    run_id=run_id,
                    seq=i,
                    ts=datetime.now(timezone.utc) - timedelta(days=2),
                    kind="assistant_text",
                    payload=json.dumps(
                        {
                            "seq": i,
                            "kind": "assistant_text",
                            "text": f"event-{i}",
                            "ts": "2020-01-01T00:00:00+00:00",
                            "run_id": str(run_id),
                        }
                    ),
                )
            )
        s.commit()
    return run_id


@pytest.mark.asyncio
async def test_archive_skips_active_runs(
    tables: sqlalchemy.Engine, tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.agents.archive.settings.rapid_agent_archive_dir", tmp_path
    )
    monkeypatch.setattr(
        "app.agents.archive.settings.rapid_agent_event_retention_days", 0
    )
    p = _seed_project(tables)
    run_id = _insert_run_with_events(
        tables,
        project_id=p.id,
        status="running",
        ended_at=None,
        n_events=100,
    )
    archived = await archive_expired_runs(tables)
    assert archived == 0
    assert not any(tmp_path.glob("**/*.jsonl"))
    # Rows still present.
    with Session(tables) as s:
        rows = s.exec(
            text("SELECT COUNT(*) FROM agentevent WHERE run_id = :rid").bindparams(
                rid=run_id.hex
            )
        ).one()
        assert rows[0] == 100


@pytest.mark.asyncio
async def test_archive_writes_jsonl_and_deletes_rows(
    tables: sqlalchemy.Engine, tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setattr(
        "app.agents.archive.settings.rapid_agent_archive_dir", tmp_path
    )
    monkeypatch.setattr(
        "app.agents.archive.settings.rapid_agent_event_retention_days", 0
    )
    p = _seed_project(tables)
    ended_at = datetime.now(timezone.utc) - timedelta(hours=2)
    run_id = _insert_run_with_events(
        tables,
        project_id=p.id,
        status="completed",
        ended_at=ended_at,
        n_events=50,
    )

    archived = await archive_expired_runs(tables)
    assert archived == 50

    # File exists at the expected path.
    expected = tmp_path / p.id.hex / f"{run_id.hex}.jsonl"
    assert expected.exists()
    with expected.open() as fh:
        lines = fh.readlines()
    assert len(lines) == 50
    for line in lines:
        data = json.loads(line)
        assert "seq" in data and "kind" in data

    # Event rows deleted.
    with Session(tables) as s:
        remaining = s.exec(
            text(
                "SELECT COUNT(*) FROM agentevent WHERE run_id = :rid"
            ).bindparams(rid=run_id.hex)
        ).one()[0]
        assert remaining == 0


@pytest.mark.asyncio
async def test_archive_idempotent(
    tables: sqlalchemy.Engine, tmp_path: Path, monkeypatch
) -> None:
    """Running the archive twice on the same run is a no-op the second time."""
    monkeypatch.setattr(
        "app.agents.archive.settings.rapid_agent_archive_dir", tmp_path
    )
    monkeypatch.setattr(
        "app.agents.archive.settings.rapid_agent_event_retention_days", 0
    )
    p = _seed_project(tables)
    ended_at = datetime.now(timezone.utc) - timedelta(hours=2)
    _insert_run_with_events(
        tables,
        project_id=p.id,
        status="completed",
        ended_at=ended_at,
        n_events=10,
    )
    first = await archive_expired_runs(tables)
    assert first == 10
    second = await archive_expired_runs(tables)
    assert second == 0


@pytest.mark.asyncio
async def test_archive_atomic_tempfile_rename(
    tables: sqlalchemy.Engine, tmp_path: Path, monkeypatch
) -> None:
    """When os.replace fails, no half-written file should appear at the target."""
    monkeypatch.setattr(
        "app.agents.archive.settings.rapid_agent_archive_dir", tmp_path
    )
    monkeypatch.setattr(
        "app.agents.archive.settings.rapid_agent_event_retention_days", 0
    )
    p = _seed_project(tables)
    ended_at = datetime.now(timezone.utc) - timedelta(hours=2)
    run_id = _insert_run_with_events(
        tables,
        project_id=p.id,
        status="completed",
        ended_at=ended_at,
        n_events=5,
    )
    final_path = tmp_path / p.id.hex / f"{run_id.hex}.jsonl"

    orig_replace = archive_mod.os.replace

    def _fail_replace(src, dst):
        raise OSError("simulated replace failure")

    with patch.object(archive_mod.os, "replace", side_effect=_fail_replace):
        archived = await archive_expired_runs(tables)
        # The archive helper caught the exception per-run, so archived rows total 0
        # and no target file exists.
        assert archived == 0

    assert not final_path.exists(), "target file must not exist after failed rename"
    # Event rows still present (delete only happens after successful rename).
    with Session(tables) as s:
        remaining = s.exec(
            text(
                "SELECT COUNT(*) FROM agentevent WHERE run_id = :rid"
            ).bindparams(rid=run_id.hex)
        ).one()[0]
        assert remaining == 5

    # Subsequent archive pass with real os.replace restores correctness.
    archived2 = await archive_expired_runs(tables)
    assert archived2 == 5
    assert final_path.exists()
