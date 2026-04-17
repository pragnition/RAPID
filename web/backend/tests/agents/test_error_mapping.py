"""Tests for ``app.agents.error_mapping``."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.agents.error_mapping import install_agent_error_handlers, to_http_exception
from app.agents.errors import (
    RunError,
    SdkError,
    StateError,
    ToolError,
    UserError,
)


def test_sdk_error_maps_502_retryable():
    exc = to_http_exception(SdkError("boom"))
    assert exc.status_code == 502
    assert exc.headers is not None
    assert exc.headers.get("Retry-After") == "5"
    assert exc.detail["error_code"] == "sdk_error"
    assert exc.detail["message"] == "boom"


def test_state_error_maps_409():
    exc = to_http_exception(StateError("conflict"))
    assert exc.status_code == 409
    assert exc.headers is None
    assert exc.detail["error_code"] == "state_error"


def test_user_error_maps_400():
    exc = to_http_exception(UserError("bad input"))
    assert exc.status_code == 400


def test_tool_error_maps_422():
    exc = to_http_exception(ToolError("tool fail"))
    assert exc.status_code == 422


def test_run_error_maps_500():
    exc = to_http_exception(RunError("run fail", detail={"step": "init"}))
    assert exc.status_code == 500
    assert exc.detail["detail"] == {"step": "init"}


def test_install_agent_error_handlers_registers_handler():
    app = FastAPI()

    @app.get("/boom")
    def boom():
        raise RunError("x", detail={"where": "boom"})

    install_agent_error_handlers(app)
    client = TestClient(app)
    resp = client.get("/boom")
    assert resp.status_code == 500
    body = resp.json()
    assert body["error_code"] == "run_error"
    assert body["message"] == "x"
    assert body["detail"] == {"where": "boom"}


def test_install_agent_error_handlers_emits_retry_after():
    app = FastAPI()

    @app.get("/sdkboom")
    def sdkboom():
        raise SdkError("upstream")

    install_agent_error_handlers(app)
    client = TestClient(app)
    resp = client.get("/sdkboom")
    assert resp.status_code == 502
    assert resp.headers.get("retry-after") == "5"
    body = resp.json()
    assert body["error_code"] == "sdk_error"
