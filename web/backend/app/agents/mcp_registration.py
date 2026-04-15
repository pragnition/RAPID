"""In-process SDK MCP server registration helper.

:func:`register_mcp_tools` mutates a :class:`ClaudeAgentOptions` in place:
creates (or re-uses) an in-process MCP server named ``server_name`` exposing
the given ``@tool``-decorated callables, and appends the corresponding
``mcp__{server_name}__{tool_name}`` entries to ``allowed_tools``. Must be
called BEFORE ``session.connect()`` — options must be fully assembled
before SDK client creation per SDK docs.

Downstream sets (web-tool-bridge, kanban-autopilot) call this with their
``@tool``-decorated functions. Wave 2 provides the wiring; tools come later.
"""

from __future__ import annotations

from typing import Any

from claude_agent_sdk import ClaudeAgentOptions, create_sdk_mcp_server


def register_mcp_tools(
    options: ClaudeAgentOptions,
    tools: list[Any],
    server_name: str = "rapid",
    server_version: str = "1.0.0",
) -> ClaudeAgentOptions:
    """Attach ``tools`` to ``options`` via an in-process MCP server.

    Idempotent: registering the same tool twice does not duplicate its entry
    in ``options.allowed_tools``. No-op when ``tools`` is empty.
    """
    if not tools:
        return options

    server = create_sdk_mcp_server(
        name=server_name, version=server_version, tools=list(tools)
    )
    existing = dict(getattr(options, "mcp_servers", {}) or {})
    existing[server_name] = server
    options.mcp_servers = existing

    allowed = list(options.allowed_tools or [])
    for t in tools:
        tool_name = getattr(t, "name", None) or getattr(t, "__name__", None)
        if not tool_name:
            continue
        fqn = f"mcp__{server_name}__{tool_name}"
        if fqn not in allowed:
            allowed.append(fqn)
    options.allowed_tools = allowed
    return options
