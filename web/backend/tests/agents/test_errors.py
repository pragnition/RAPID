"""Tests for the agent error taxonomy."""

from __future__ import annotations

from app.agents.errors import (
    RETRYABLE_ERROR_CODES,
    AgentBaseError,
    RunError,
    SdkError,
    StateError,
    ToolError,
    UserError,
)


def test_error_taxonomy_classes_exist():
    for cls in (SdkError, RunError, StateError, ToolError, UserError):
        assert issubclass(cls, AgentBaseError)


def test_error_http_status_mapping():
    assert SdkError("").http_status == 502
    assert StateError("").http_status == 409
    assert ToolError("").http_status == 422
    assert UserError("").http_status == 400
    assert RunError("").http_status == 500


def test_error_code_unique_mapping():
    codes = {e.error_code for e in (SdkError(""), RunError(""), StateError(""), ToolError(""), UserError(""))}
    assert len(codes) == 5


def test_retryable_only_sdk_error():
    assert "sdk_error" in RETRYABLE_ERROR_CODES
    assert len(RETRYABLE_ERROR_CODES) == 1
