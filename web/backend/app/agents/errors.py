"""Error taxonomy for the agent runtime.

All agent-runtime code raises one of these classes so HTTP handlers and the
SSE layer can map errors to a stable ``error_code`` / ``http_status`` pair.
"""

from __future__ import annotations


class AgentBaseError(Exception):
    """Base class for the agent-runtime error taxonomy."""

    error_code: str = "agent_error"
    http_status: int = 500

    def __init__(self, message: str, detail: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail or {}


class SdkError(AgentBaseError):
    error_code = "sdk_error"
    http_status = 502  # retryable


class RunError(AgentBaseError):
    error_code = "run_error"
    http_status = 500


class StateError(AgentBaseError):
    error_code = "state_error"
    http_status = 409


class ToolError(AgentBaseError):
    error_code = "tool_error"
    http_status = 422


class UserError(AgentBaseError):
    error_code = "user_error"
    http_status = 400


RETRYABLE_ERROR_CODES: frozenset[str] = frozenset({"sdk_error"})
