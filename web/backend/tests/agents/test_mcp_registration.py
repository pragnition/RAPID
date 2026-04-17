"""Tests for ``app.agents.mcp_registration.register_mcp_tools``."""

from __future__ import annotations

import types
from pathlib import Path

from app.agents import mcp_registration
from app.agents.mcp_registration import register_mcp_tools
from app.agents.sdk_options import build_sdk_options


def _options():
    return build_sdk_options(
        project_root=Path("/tmp").resolve(),
        worktree=None,
        skill_name="execute-set",
        skill_args={},
        run_id="rid-1",
    )


def test_register_noop_when_empty():
    opts = _options()
    before_allowed = list(opts.allowed_tools)
    before_servers = dict(getattr(opts, "mcp_servers", {}) or {})
    out = register_mcp_tools(opts, [])
    assert out is opts
    assert list(opts.allowed_tools) == before_allowed
    assert (dict(getattr(opts, "mcp_servers", {}) or {})) == before_servers


def test_register_appends_allowed_tools(monkeypatch):
    fake_server = object()
    monkeypatch.setattr(
        mcp_registration,
        "create_sdk_mcp_server",
        lambda **kw: fake_server,
    )

    tool = types.SimpleNamespace(name="ask_user")
    opts = _options()
    out = register_mcp_tools(opts, [tool])
    assert out is opts
    assert "mcp__rapid__ask_user" in opts.allowed_tools
    assert opts.mcp_servers["rapid"] is fake_server


def test_register_idempotent(monkeypatch):
    fake_server = object()
    monkeypatch.setattr(
        mcp_registration,
        "create_sdk_mcp_server",
        lambda **kw: fake_server,
    )

    tool = types.SimpleNamespace(name="ask_user")
    opts = _options()
    register_mcp_tools(opts, [tool])
    register_mcp_tools(opts, [tool])
    assert opts.allowed_tools.count("mcp__rapid__ask_user") == 1


def test_register_uses_dunder_name_fallback(monkeypatch):
    fake_server = object()
    monkeypatch.setattr(
        mcp_registration,
        "create_sdk_mcp_server",
        lambda **kw: fake_server,
    )

    def my_tool():  # noqa: D401 — stub
        pass

    opts = _options()
    register_mcp_tools(opts, [my_tool])
    assert "mcp__rapid__my_tool" in opts.allowed_tools


def test_register_skips_unnamed_tool(monkeypatch):
    fake_server = object()
    monkeypatch.setattr(
        mcp_registration,
        "create_sdk_mcp_server",
        lambda **kw: fake_server,
    )

    opts = _options()
    # Plain object — no ``name`` or ``__name__``.
    register_mcp_tools(opts, [object()])
    # Server still installed, but no allowed_tools entries added.
    assert opts.mcp_servers["rapid"] is fake_server
    assert not any(t.startswith("mcp__rapid__") for t in opts.allowed_tools)


def test_register_custom_server_name(monkeypatch):
    fake_server = object()
    monkeypatch.setattr(
        mcp_registration,
        "create_sdk_mcp_server",
        lambda **kw: fake_server,
    )

    tool = types.SimpleNamespace(name="probe")
    opts = _options()
    register_mcp_tools(opts, [tool], server_name="custom")
    assert "mcp__custom__probe" in opts.allowed_tools
    assert "custom" in opts.mcp_servers
