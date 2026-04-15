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
    return HTTPException(
        status_code=exc.http_status, detail=envelope, headers=headers
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
