"""Centralized ``build_sdk_options()`` factory for the agent runtime.

Exactly one place constructs :class:`ClaudeAgentOptions` for live runs. This
module enforces the session contract: ``setting_sources=['project']``, only
``default`` or ``acceptEdits`` permission modes (the unsafe bypass mode is
forbidden by test), explicit env allow-list, dual-gated destructive firewall
(``can_use_tool`` plus ``PreToolUse`` hook), and skill-scoped turn/budget caps.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from claude_agent_sdk import ClaudeAgentOptions, HookMatcher

from app.agents.correlation import SAFE_ENV_KEYS
from app.agents.permission_hooks import (
    can_use_tool_hook,
    destructive_pre_tool_hook,
    inject_commit_trailers,
)
from app.agents.permissions import resolve_policy
from app.config import settings

# Threaded into ``ClaudeAgentOptions.env['RAPID_RUN_MODE']`` so the agent
# process can distinguish SDK runs from legacy subprocess runs.
RAPID_RUN_MODE = "sdk"


def build_sdk_options(
    project_root: Path,
    worktree: Path | None,
    skill_name: str,
    skill_args: dict[str, Any],
    run_id: str,
) -> ClaudeAgentOptions:
    """Build a :class:`ClaudeAgentOptions` with the RAPID session contract applied.

    Raises ``ValueError`` if ``project_root`` or ``worktree`` are not absolute.
    """
    if not project_root.is_absolute():
        raise ValueError("project_root must be absolute")
    if worktree is not None and not worktree.is_absolute():
        raise ValueError("worktree must be absolute")

    policy = resolve_policy(skill_name)

    env: dict[str, str] = {
        "RAPID_RUN_MODE": RAPID_RUN_MODE,
        "RAPID_RUN_ID": run_id,
    }
    for k in SAFE_ENV_KEYS:
        if k in os.environ:
            env[k] = os.environ[k]

    options = ClaudeAgentOptions(
        cwd=str(project_root),
        add_dirs=[str(worktree)] if worktree is not None else [],
        setting_sources=["project"],
        permission_mode=policy["permission_mode"],
        allowed_tools=list(policy["allowed_tools"]),
        disallowed_tools=list(policy["disallowed_tools"]),
        max_turns=int(policy["max_turns"]),
        env=env,
        can_use_tool=can_use_tool_hook,
        hooks={
            "PreToolUse": [
                HookMatcher(matcher="Bash", hooks=[destructive_pre_tool_hook, inject_commit_trailers]),
            ],
        },
        max_budget_usd=float(settings.rapid_agent_daily_cap_usd),
    )

    # Safety belt: these invariants must hold on every construction path.
    assert options.setting_sources == ["project"], "setting_sources invariant broken"
    assert options.permission_mode in {"default", "acceptEdits"}, "unexpected permission_mode"
    return options
