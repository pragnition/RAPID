"""RAPID agent runtime — public contract surface.

Wave 1 created this file empty because the re-exports depend on symbols that
only land across Waves 1–3. Wave 3 fills it in with the full set of stable
public names listed in ``CONTRACT.json`` (``ExportNames``).
"""

from app.agents.budget import BudgetStatus, RunBudget
from app.agents.correlation import (
    RunIdLogFilter,
    SAFE_ENV_KEYS,
    bind_run_id,
    get_run_id,
    run_id_var,
)
from app.agents.error_mapping import install_agent_error_handlers, to_http_exception
from app.agents.errors import (
    AgentBaseError,
    RETRYABLE_ERROR_CODES,
    RunError,
    SdkError,
    StateError,
    ToolError,
    UserError,
)
from app.agents.event_bus import EventBus, RunChannel
from app.agents.mcp_registration import register_mcp_tools
from app.agents.permission_hooks import can_use_tool_hook, destructive_pre_tool_hook
from app.agents.permissions import (
    DESTRUCTIVE_PATTERNS,
    PERMISSION_POLICY,
    is_destructive,
    resolve_policy,
)
from app.agents.sdk_options import RAPID_RUN_MODE, build_sdk_options
from app.agents.session import AgentSession
from app.agents.session_manager import AgentSessionManager

__all__ = [
    # errors
    "AgentBaseError",
    "SdkError",
    "RunError",
    "StateError",
    "ToolError",
    "UserError",
    "RETRYABLE_ERROR_CODES",
    # correlation
    "run_id_var",
    "bind_run_id",
    "get_run_id",
    "SAFE_ENV_KEYS",
    "RunIdLogFilter",
    # permissions
    "PERMISSION_POLICY",
    "DESTRUCTIVE_PATTERNS",
    "resolve_policy",
    "is_destructive",
    "can_use_tool_hook",
    "destructive_pre_tool_hook",
    # sdk options
    "build_sdk_options",
    "RAPID_RUN_MODE",
    # event bus
    "EventBus",
    "RunChannel",
    # budget
    "RunBudget",
    "BudgetStatus",
    # mcp
    "register_mcp_tools",
    # error mapping
    "to_http_exception",
    "install_agent_error_handlers",
    # session
    "AgentSession",
    "AgentSessionManager",
]
