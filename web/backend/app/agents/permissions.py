"""Data-only permission policy + destructive command regex list.

Pure data and pure functions — no SDK imports, no I/O. Wave 2 layers the
active hook (``permission_hooks.py``) on top of this module.
"""

from __future__ import annotations

import re
from typing import Literal

from app.config import settings

# Source patterns kept as raw strings so tests can assert the exact source.
_PATTERN_SOURCES: list[str] = [
    r"\brm\s+-rf\s+/",
    r"\bgit\s+push\s+.*--force\b",
    r"\bgit\s+push\s+.*(?:-f|--force-with-lease)\b",
    r"\bgit\s+branch\s+-D\b",
    r"\bgit\s+reset\s+--hard\s+origin\b",
    r"\bgit\s+clean\s+-[fdx]{1,3}\b",
    r"\benv\b(?!\s*\|\s*grep)",
    r"\bcat\s+.*\.env\b",
    r"\bprintenv\b",
    r"\bdd\s+if=.*of=/dev/",
    r"\b:\s*\(\)\s*{\s*:\s*\|\s*:\s*&\s*}\s*;",
]

DESTRUCTIVE_PATTERNS: list[re.Pattern] = [
    re.compile(src, re.IGNORECASE) for src in _PATTERN_SOURCES
]


def is_destructive(command: str) -> tuple[bool, str | None]:
    """Return ``(True, pattern_source)`` on first match; else ``(False, None)``."""
    for src, pat in zip(_PATTERN_SOURCES, DESTRUCTIVE_PATTERNS):
        if pat.search(command):
            return True, src
    return False, None


PERMISSION_POLICY: dict[str, dict] = {
    "plan-set": {
        "permission_mode": "acceptEdits",
        "allowed_tools": [],
        "disallowed_tools": ["WebSearch"],
        "max_turns": 80,
    },
    "execute-set": {
        "permission_mode": "acceptEdits",
        "allowed_tools": [],
        "disallowed_tools": [],
        "max_turns": 200,
    },
    "discuss-set": {
        "permission_mode": "default",
        "allowed_tools": [],
        "disallowed_tools": [],
        "max_turns": 40,
    },
    "review": {
        "permission_mode": "default",
        "allowed_tools": [],
        "disallowed_tools": [],
        "max_turns": 60,
    },
    "merge": {
        "permission_mode": "default",
        "allowed_tools": [],
        "disallowed_tools": [],
        "max_turns": 80,
    },
    "cleanup": {
        "permission_mode": "default",
        "allowed_tools": [],
        "disallowed_tools": [],
        "max_turns": 20,
    },
    "init": {
        "permission_mode": "default",
        "allowed_tools": [],
        "disallowed_tools": [],
        "max_turns": 80,
    },
    "start-set": {
        "permission_mode": "default",
        "allowed_tools": [],
        "disallowed_tools": [],
        "max_turns": 20,
    },
    "unit-test": {
        "permission_mode": "acceptEdits",
        "allowed_tools": [],
        "disallowed_tools": [],
        "max_turns": 60,
    },
    "bug-hunt": {
        "permission_mode": "default",
        "allowed_tools": [],
        "disallowed_tools": [],
        "max_turns": 60,
    },
    "uat": {
        "permission_mode": "default",
        "allowed_tools": [],
        "disallowed_tools": [],
        "max_turns": 40,
    },
    "status": {
        "permission_mode": "default",
        "allowed_tools": [],
        "disallowed_tools": [],
        "max_turns": 10,
    },
    "audit-version": {
        "permission_mode": "default",
        "allowed_tools": [],
        "disallowed_tools": [],
        "max_turns": 60,
    },
    "quick": {
        "permission_mode": "acceptEdits",
        "allowed_tools": [],
        "disallowed_tools": [],
        "max_turns": 60,
    },
    "bug-fix": {
        "permission_mode": "acceptEdits",
        "allowed_tools": [],
        "disallowed_tools": [],
        "max_turns": 60,
    },
    "autopilot": {
        "permission_mode": "acceptEdits",
        "allowed_tools": [],
        "disallowed_tools": [],
        "max_turns": 100,
    },
    "_default": {
        "permission_mode": "default",
        "allowed_tools": [],
        "disallowed_tools": [],
        "max_turns": settings.rapid_agent_default_max_turns,
    },
}


def resolve_policy(skill_name: str) -> dict:
    return PERMISSION_POLICY.get(skill_name, PERMISSION_POLICY["_default"])
