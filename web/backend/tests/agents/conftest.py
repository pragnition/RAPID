"""Shared fixtures for Wave 3 agent-runtime tests."""

from __future__ import annotations

import pytest
import pytest_asyncio
import sqlalchemy

from app.agents.session_manager import AgentSessionManager


@pytest_asyncio.fixture
async def manager(tables: sqlalchemy.Engine):
    """AgentSessionManager bound to the in-test engine.

    NOTE: does NOT call ``manager.start()`` — unit tests exercise sweeps and
    archive passes by calling their helpers directly, never the periodic loops.
    """
    mgr = AgentSessionManager(tables)
    try:
        yield mgr
    finally:
        await mgr.stop()
