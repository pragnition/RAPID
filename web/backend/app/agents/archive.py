"""30-day JSONL archive writer for terminal agent runs.

Complements Wave 2's per-run row-cap prune. Called periodically by
:class:`~app.agents.session_manager.AgentSessionManager` (every hour). For any
:class:`~app.models.agent_run.AgentRun` in a terminal state whose ``ended_at``
is older than :attr:`app.config.Settings.rapid_agent_event_retention_days`,
all of its :class:`~app.models.agent_event.AgentEvent` rows are streamed to

    ``<rapid_agent_archive_dir>/<project_id>/<run_id>.jsonl``

as newline-delimited JSON (one event per line), written via
``tempfile + os.replace`` so the final file is only visible once complete.
After a successful rename, the archived event rows are deleted.

Idempotent: re-running against a run with no remaining event rows is a no-op.
Archive skips runs whose status is not terminal (``pending``, ``running``,
``waiting``).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import sqlalchemy
from sqlalchemy import text
from sqlmodel import Session, select

from app.config import settings
from app.models.agent_event import AgentEvent
from app.models.agent_run import AgentRun

logger = logging.getLogger("rapid.agents.archive")

_TERMINAL_STATES = frozenset({"completed", "failed", "interrupted"})


def _archive_run_sync(
    engine: sqlalchemy.Engine, run_id_hex: str, project_id_hex: str, archive_root: Path
) -> int:
    """Synchronously archive a single run. Returns rows archived."""
    project_dir = archive_root / project_id_hex
    project_dir.mkdir(parents=True, exist_ok=True)
    final_path = project_dir / f"{run_id_hex}.jsonl"

    # Load event rows for this run (oldest-first).
    with Session(engine) as s:
        rows = s.exec(
            select(AgentEvent)
            .where(text("run_id = :rid")).params(rid=run_id_hex)
            .order_by(AgentEvent.seq)
        ).all()
        if not rows:
            return 0
        payload_lines: list[str] = []
        for r in rows:
            try:
                payload = json.loads(r.payload)
            except Exception:
                payload = {"_raw": r.payload}
            payload_lines.append(
                json.dumps(
                    {
                        "run_id": run_id_hex,
                        "seq": r.seq,
                        "ts": r.ts.isoformat() if isinstance(r.ts, datetime) else r.ts,
                        "kind": r.kind,
                        "payload": payload,
                    },
                    default=str,
                )
            )

    # Write to tempfile in the target dir, then atomic rename.
    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{run_id_hex}.", suffix=".jsonl.tmp", dir=str(project_dir)
    )
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            for line in payload_lines:
                fh.write(line)
                fh.write("\n")
            fh.flush()
            try:
                os.fsync(fh.fileno())
            except OSError:
                pass
        os.replace(tmp_path, final_path)
    except Exception:
        try:
            tmp_path.unlink()
        except FileNotFoundError:
            pass
        raise

    # Rename succeeded — delete the event rows.
    archived = len(payload_lines)
    with Session(engine) as s:
        s.exec(
            text("DELETE FROM agentevent WHERE run_id = :rid").bindparams(
                rid=run_id_hex
            )
        )
        s.commit()
    return archived


async def archive_expired_runs(engine: sqlalchemy.Engine) -> int:
    """Archive ``agent_event`` rows for terminal runs older than the retention window.

    Returns the total number of event rows written to JSONL and deleted. Skips
    runs whose ``status`` is still active. Idempotent across repeated calls.
    """
    retention_days = int(settings.rapid_agent_event_retention_days)
    archive_root = Path(settings.rapid_agent_archive_dir)

    def _load_expired() -> list[tuple[str, str]]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
        with Session(engine) as s:
            rows = s.exec(
                select(AgentRun).where(
                    AgentRun.status.in_(list(_TERMINAL_STATES)),  # type: ignore[attr-defined]
                    AgentRun.ended_at.is_not(None),  # type: ignore[attr-defined]
                    AgentRun.ended_at <= cutoff,  # type: ignore[operator]
                )
            ).all()
            return [(r.id.hex, r.project_id.hex) for r in rows]

    expired = await asyncio.to_thread(_load_expired)
    if not expired:
        return 0

    total = 0
    for run_id_hex, project_id_hex in expired:
        try:
            total += await asyncio.to_thread(
                _archive_run_sync, engine, run_id_hex, project_id_hex, archive_root
            )
        except Exception:
            logger.exception(
                "archive failed for run", extra={"run_id": run_id_hex}
            )
    return total
