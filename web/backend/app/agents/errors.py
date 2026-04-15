"""Error taxonomy for the agent runtime.

All agent-runtime code raises one of these classes so HTTP handlers and the
SSE layer can map errors to a stable ``error_code`` / ``http_status`` pair.
"""

from __future__ import annotations


class AgentBaseError(Exception):
    """Base class for the agent-runtime error taxonomy."""

    error_code: str = "agent_error"
    http_status: int = 500

    def __init__(
        self,
        message: str,
        detail: dict | None = None,
        *,
        error_code: str | None = None,
        http_status: int | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail or {}
        # Per-instance overrides — used by the prompt flow where several
        # sub-codes share the same StateError class but need distinct
        # error_code/http_status mappings (prompt_not_found → 404,
        # prompt_stale → 409, prompt_already_pending → 400, answer_consumed
        # → 409). Falls back to the class-level default when not overridden.
        if error_code is not None:
            self.error_code = error_code
        if http_status is not None:
            self.http_status = http_status


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
