"""Destructive-command firewall for the agent runtime.

Dual-gated: both ``can_use_tool_hook`` and ``destructive_pre_tool_hook``
enforce the destructive-pattern policy. The PreToolUse hook is NOT a
no-op — it is a second gate because the SDK's ``can_use_tool`` callback
does not fire in ``acceptEdits`` mode for file-edit tools or when tools
are explicitly allowed. This is belt-and-suspenders.

web-tool-bridge: ``can_use_tool_hook_bound`` extends the hook with a
built-in ``AskUserQuestion`` interception branch that routes every AUQ
call through the web bridge (splitting >4 questions into batches of up
to 4). Because the SDK's ``can_use_tool`` takes a fixed signature, the
run_id + manager are bound via ``functools.partial`` in
``AgentSession.__aenter__``.
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from typing import TYPE_CHECKING, Any
from uuid import UUID

from claude_agent_sdk import (
    HookContext,
    PermissionResultAllow,
    PermissionResultDeny,
    ToolPermissionContext,
)

from app.agents.correlation import get_card_id, get_run_id  # noqa: F401 — re-exported for symmetry
from app.agents.permissions import is_destructive

if TYPE_CHECKING:  # pragma: no cover
    from app.agents.session_manager import AgentSessionManager

logger = logging.getLogger("rapid.agents.permissions")

# Built-in AskUserQuestion's hard limit: max 4 questions per call.
_AUQ_CHUNK_SIZE = 4


async def can_use_tool_hook(
    tool_name: str,
    input_data: dict[str, Any],
    context: ToolPermissionContext,
) -> PermissionResultAllow | PermissionResultDeny:
    """``can_use_tool`` callback — first gate of the destructive firewall.

    Does NOT intercept AskUserQuestion. Use ``can_use_tool_hook_bound`` for
    the bridge-routed variant (wired in ``AgentSession.__aenter__``).
    """
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


async def _route_auq_through_bridge(
    run_id: UUID,
    manager: "AgentSessionManager",
    questions: list[dict[str, Any]],
) -> list[str]:
    """Synthesise per-chunk ``ask_user`` prompts for a built-in AUQ call.

    Chunks the questions into groups of up to 4 (the SDK's built-in AUQ
    limit), emits one ``AskUserEvent`` per chunk via the shared
    ``emit_and_await_prompt`` primitive, and concatenates the answers in
    original question order. Returns ``list[str]`` sized to ``len(questions)``.
    """
    from app.agents.tools.ask_user import emit_and_await_prompt

    chunks: list[list[dict[str, Any]]] = [
        questions[i : i + _AUQ_CHUNK_SIZE]
        for i in range(0, len(questions), _AUQ_CHUNK_SIZE)
    ]
    total_chunks = len(chunks)
    batch_id = str(uuid.uuid4())

    answers: list[str] = []
    for chunk_idx, chunk in enumerate(chunks):
        # For each sub-question inside the chunk, emit a distinct prompt —
        # the client shows one at a time (sequential split UX per CONTEXT.md).
        for q_idx, q in enumerate(chunk):
            question_text = str(q.get("question") or "")
            raw_opts = q.get("options")
            # The SDK's built-in AskUserQuestion sends options as dicts
            # ({"label": ..., "description": ...}); normalise to plain
            # strings so AskUserEvent (list[str]) validates cleanly.
            if raw_opts is not None:
                options = [
                    o["label"] if isinstance(o, dict) and "label" in o else str(o)
                    for o in raw_opts
                ]
            else:
                options = None
            # Built-in AUQ supports multi-select; we surface it as list[str]
            # with allow_free_text determined per-question (default False).
            allow_free_text = bool(q.get("allow_free_text", False))
            answer = await emit_and_await_prompt(
                run_id=run_id,
                manager=manager,
                question=question_text,
                options=options,
                allow_free_text=allow_free_text,
                n_of_m=(chunk_idx + 1, total_chunks),
                batch_id=batch_id,
                batch_position=chunk_idx * _AUQ_CHUNK_SIZE + q_idx,
            )
            answers.append(answer)
    return answers


async def can_use_tool_hook_bound(
    tool_name: str,
    input_data: dict[str, Any],
    context: ToolPermissionContext,
    *,
    run_id: UUID,
    manager: "AgentSessionManager",
) -> PermissionResultAllow | PermissionResultDeny:
    """Run-aware variant of ``can_use_tool_hook`` with AUQ interception.

    Bound with ``functools.partial(run_id=..., manager=...)`` inside
    ``AgentSession.__aenter__`` (can_use_tool's SDK signature doesn't expose
    a way to thread per-run context, so we bind at registration time).
    """
    # 1. Destructive firewall (same as the vanilla hook).
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

    # 2. AskUserQuestion interception — route through the web bridge.
    if tool_name == "AskUserQuestion":
        questions = input_data.get("questions") or []
        if not questions:
            # Degenerate AUQ call — no questions to route. Allow through.
            return PermissionResultAllow(
                behavior="allow", updated_input=input_data
            )
        try:
            answers = await _route_auq_through_bridge(run_id, manager, questions)
        except Exception:
            logger.exception(
                "AUQ bridge routing failed",
                extra={"run_id": str(run_id)},
            )
            # Surface as a denied tool call with a diagnostic message; the
            # SDK treats Deny.message as the tool_result payload.
            return PermissionResultDeny(
                behavior="deny",
                message=json.dumps({"error": "auq_bridge_failed"}),
                interrupt=False,
            )
        # Returning a Deny with the answers JSON in ``message`` is how the
        # SDK delivers this payload back to the agent as tool_result content.
        return PermissionResultDeny(
            behavior="deny",
            message=json.dumps({"answers": answers}),
            interrupt=False,
        )

    # 3. Trust-all-tools default.
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


# ---------------------------------------------------------------------------
# Commit-trailer injection for autopilot runs
# ---------------------------------------------------------------------------

_GIT_COMMIT_RE = re.compile(
    r"^\s*git\s+commit\b",
    re.MULTILINE,
)


def _is_simple_git_commit(cmd: str) -> bool:
    """Return True if *cmd* is a simple git commit (no pipes, no chaining)."""
    if any(sep in cmd for sep in ("|", "&&", "||", ";")):
        return False
    return bool(_GIT_COMMIT_RE.search(cmd))


async def inject_commit_trailers(
    input_data: dict,
    tool_use_id: str | None,
    context: HookContext,
) -> dict:
    """PreToolUse hook: inject Autopilot-Card-Id and Autopilot-Run-Id trailers
    into git commit commands when running inside an autopilot session."""
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    if tool_name != "Bash":
        return {}

    cmd = str(tool_input.get("command", ""))

    if not _is_simple_git_commit(cmd):
        return {}

    card_id = get_card_id()
    run_id = get_run_id()
    if card_id is None and run_id is None:
        return {}

    trailers: list[str] = []
    if card_id is not None:
        trailers.append(f'--trailer "Autopilot-Card-Id: {card_id}"')
    if run_id is not None:
        trailers.append(f'--trailer "Autopilot-Run-Id: {run_id}"')

    updated_cmd = cmd.rstrip() + " " + " ".join(trailers)
    updated_input = dict(input_data)
    updated_input["tool_input"] = {**tool_input, "command": updated_cmd}
    return {"updatedInput": updated_input}
