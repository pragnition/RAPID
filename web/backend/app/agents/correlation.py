"""``run_id`` correlation machinery.

A ``ContextVar`` carries the current agent run identifier through async and
logging layers so every log record emitted during a run can be tagged with
its originating run_id without plumbing it through call signatures.
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Iterator

# Exact var name is part of the contract — referenced by CONTEXT.md.
run_id_var: ContextVar[str | None] = ContextVar("rapid_run_id", default=None)
card_id_var: ContextVar[str | None] = ContextVar("rapid_card_id", default=None)


def get_run_id() -> str | None:
    return run_id_var.get()


def get_card_id() -> str | None:
    return card_id_var.get()


@contextmanager
def bind_run_id(run_id: str) -> Iterator[None]:
    token = run_id_var.set(run_id)
    try:
        yield
    finally:
        run_id_var.reset(token)


@contextmanager
def bind_card_id(card_id: str) -> Iterator[None]:
    token = card_id_var.set(card_id)
    try:
        yield
    finally:
        card_id_var.reset(token)


class RunIdLogFilter(logging.Filter):
    """Attach the current ``run_id`` (or ``"-"``) to every log record."""

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: D401
        record.run_id = run_id_var.get() or "-"
        return True


# Single source of truth shared by downstream modules that need to scrub env.
SAFE_ENV_KEYS: frozenset[str] = frozenset({"PATH", "HOME", "TERM", "LANG", "LC_ALL"})
