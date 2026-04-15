"""Destructive-command firewall for the agent runtime.

Dual-gated: both ``can_use_tool_hook`` and ``destructive_pre_tool_hook``
enforce the destructive-pattern policy. The PreToolUse hook is NOT a
no-op — it is a second gate because the SDK's ``can_use_tool`` callback
does not fire in ``acceptEdits`` mode for file-edit tools or when tools
are explicitly allowed. This is belt-and-suspenders.
"""

from __future__ import annotations

import logging
from typing import Any

from claude_agent_sdk import (
    HookContext,
    PermissionResultAllow,
    PermissionResultDeny,
    ToolPermissionContext,
)

from app.agents.correlation import get_run_id  # noqa: F401 — re-exported for symmetry
from app.agents.permissions import is_destructive

logger = logging.getLogger("rapid.agents.permissions")


async def can_use_tool_hook(
    tool_name: str,
    input_data: dict[str, Any],
    context: ToolPermissionContext,
) -> PermissionResultAllow | PermissionResultDeny:
    """``can_use_tool`` callback — first gate of the destructive firewall."""
    if tool_name == "Bash":
        cmd = str(input_data.get("command", ""))
        blocked, matched = is_destructive(cmd)
        if blocked:
            logger.warning(
                "destructive bash blocked",
                extra={
                    "tool": tool_name,
                    "pattern": matched,
                    "tool_use_id": getattr(context, "tool_use_id", None),
                },
            )
            return PermissionResultDeny(
                behavior="deny",
                message=f"Destructive command blocked by RAPID firewall: {matched}",
                interrupt=False,
            )
    # Trust-all-tools policy: everything else is allowed. ``permission_req``
    # is emitted as an info-only event by the session pump in Wave 3.
    return PermissionResultAllow(behavior="allow", updated_input=input_data)


async def destructive_pre_tool_hook(
    input_data: dict,
    tool_use_id: str | None,
    context: HookContext,
) -> dict:
    """``PreToolUse`` hook — second gate of the destructive firewall."""
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    if tool_name == "Bash":
        cmd = str(tool_input.get("command", ""))
        blocked, matched = is_destructive(cmd)
        if blocked:
            logger.warning(
                "destructive bash blocked via PreToolUse",
                extra={
                    "tool": tool_name,
                    "pattern": matched,
                    "tool_use_id": tool_use_id,
                },
            )
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"Destructive command blocked: {matched}",
                }
            }
    return {}
