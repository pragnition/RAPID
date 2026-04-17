"""Tests for ``app.agents.pid_liveness``."""

from __future__ import annotations

import os

from app.agents.pid_liveness import is_pid_alive, send_sigterm


# A pid very unlikely to exist on any typical Linux box.
_DEAD_PID = 999_999


def test_none_pid_not_alive() -> None:
    assert is_pid_alive(None) is False


def test_zero_pid_not_alive() -> None:
    assert is_pid_alive(0) is False


def test_negative_pid_not_alive() -> None:
    assert is_pid_alive(-1) is False


def test_current_process_alive() -> None:
    assert is_pid_alive(os.getpid()) is True


def test_nonexistent_pid_not_alive() -> None:
    # Skip if by some cosmic coincidence this pid exists.
    try:
        os.kill(_DEAD_PID, 0)
        existing = True
    except (ProcessLookupError, PermissionError):
        existing = False
    if existing:
        import pytest

        pytest.skip(f"PID {_DEAD_PID} happens to exist on this system")
    assert is_pid_alive(_DEAD_PID) is False


def test_send_sigterm_returns_false_for_dead() -> None:
    try:
        os.kill(_DEAD_PID, 0)
        existing = True
    except (ProcessLookupError, PermissionError):
        existing = False
    if existing:
        import pytest

        pytest.skip(f"PID {_DEAD_PID} happens to exist on this system")
    assert send_sigterm(_DEAD_PID) is False


def test_send_sigterm_refuses_none_or_zero() -> None:
    # ``send_sigterm`` only accepts ``int``; is_pid_alive already rejects 0.
    assert send_sigterm(0) is False
