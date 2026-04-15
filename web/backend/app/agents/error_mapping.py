"""Error-taxonomy → HTTPException mapping.

Wave 4 installs :func:`install_agent_error_handlers` on the FastAPI app.
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app.agents.errors import (
    AgentBaseError,
    RETRYABLE_ERROR_CODES,
    RunError,  # noqa: F401 — re-exported for convenience in tests
    SdkError,  # noqa: F401
    StateError,  # noqa: F401
    ToolError,  # noqa: F401
    UserError,  # noqa: F401
)


# Per-error_code HTTP status overrides. StateError's default http_status is 409
# (generic conflict), but the web-tool-bridge prompt flow produces distinct
# sub-codes that map to different HTTP statuses. Callers pass
# ``error_code=`` to StateError; this dict is consulted as a defense-in-depth
# fallback when the caller forgot to also pass ``http_status=``.
PROMPT_ERROR_HTTP_STATUS: dict[str, int] = {
    "prompt_not_found": 404,
    "prompt_stale": 409,
    "prompt_already_pending": 400,
    "answer_consumed": 409,
    "missing_prompt_id": 400,
}


def to_http_exception(exc: AgentBaseError) -> HTTPException:
    """Map a taxonomy error to ``HTTPException`` with ``{error_code, message, detail}``.

    Retryable errors (``sdk_error``) seed a ``Retry-After: 5`` header.
    """
    envelope = {
        "error_code": exc.error_code,
        "message": exc.message,
        "detail": exc.detail,
    }
    headers: dict[str, str] | None = None
    if exc.error_code in RETRYABLE_ERROR_CODES:
        headers = {"Retry-After": "5"}
    # Defensive: if the caller set an error_code that implies a non-default
    # HTTP status but forgot to set http_status explicitly, honour the
    # PROMPT_ERROR_HTTP_STATUS table.
    status = exc.http_status
    override = PROMPT_ERROR_HTTP_STATUS.get(exc.error_code)
    if override is not None and status == type(exc).http_status:
        status = override
    return HTTPException(
        status_code=status, detail=envelope, headers=headers
    )


def install_agent_error_handlers(app: FastAPI) -> None:
    """Register an :class:`AgentBaseError` exception handler on ``app``.

    The handler delegates to :func:`to_http_exception` and returns the
    resulting HTTPException's body as ``JSONResponse`` with any seeded
    headers (e.g. ``Retry-After``).
    """

    @app.exception_handler(AgentBaseError)
    async def _agent_error_handler(request: Request, exc: AgentBaseError) -> JSONResponse:  # noqa: ARG001
        http_exc = to_http_exception(exc)
        return JSONResponse(
            status_code=http_exc.status_code,
            content=http_exc.detail,
            headers=http_exc.headers,
        )
