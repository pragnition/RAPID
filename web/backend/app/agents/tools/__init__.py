"""In-process SDK MCP tools owned by ``web-tool-bridge``.

Public entry point: :func:`build_tools` — called from ``AgentSession.__aenter__``
with the bound ``run_id`` and ``manager`` so the tool coroutines capture both
in closures (rather than relying on a ContextVar across SDK callback
boundaries, which isn't reliable).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, List
from uuid import UUID

from app.agents.tools.ask_user import build_ask_user_tools

if TYPE_CHECKING:  # pragma: no cover — avoid circular import at runtime
    from app.agents.session_manager import AgentSessionManager


def build_tools(run_id: UUID, manager: "AgentSessionManager") -> List[Any]:
    """Return the list of ``@tool``-decorated callables for this run.

    ``run_id`` and ``manager`` are captured in closure so each tool call knows
    which run to persist prompts against and which manager to drive futures on.
    """
    return build_ask_user_tools(run_id=run_id, manager=manager)


__all__ = ["build_tools"]
