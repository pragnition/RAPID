"""Tests for the destructive firewall (``can_use_tool`` + ``PreToolUse``)."""

from __future__ import annotations

import types
from pathlib import Path

import pytest

from app.agents.permission_hooks import can_use_tool_hook, destructive_pre_tool_hook
from app.agents.sdk_options import build_sdk_options


def fake_ctx():
    return types.SimpleNamespace(tool_use_id="t-1", suggestions=[])


def fake_hook_ctx():
    return types.SimpleNamespace(
        session_id="s-1", transcript_path=None, cwd="/tmp", permission_mode="default"
    )


@pytest.mark.asyncio
async def test_can_use_tool_blocks_rm_rf():
    result = await can_use_tool_hook(
        "Bash", {"command": "rm -rf /"}, fake_ctx()
    )
    assert result.behavior == "deny"
    assert "firewall" in result.message.lower()


@pytest.mark.asyncio
async def test_can_use_tool_allows_ls():
    result = await can_use_tool_hook(
        "Bash", {"command": "ls -la"}, fake_ctx()
    )
    assert result.behavior == "allow"


@pytest.mark.asyncio
async def test_can_use_tool_allows_non_bash():
    result = await can_use_tool_hook(
        "Edit", {"file_path": "foo.py"}, fake_ctx()
    )
    assert result.behavior == "allow"


@pytest.mark.asyncio
async def test_can_use_tool_blocks_cat_env():
    result = await can_use_tool_hook(
        "Bash", {"command": "cat .env"}, fake_ctx()
    )
    assert result.behavior == "deny"


@pytest.mark.asyncio
async def test_can_use_tool_blocks_printenv():
    result = await can_use_tool_hook(
        "Bash", {"command": "printenv"}, fake_ctx()
    )
    assert result.behavior == "deny"


@pytest.mark.asyncio
async def test_can_use_tool_allows_env_grep_path():
    result = await can_use_tool_hook(
        "Bash", {"command": "env | grep PATH"}, fake_ctx()
    )
    assert result.behavior == "allow"


@pytest.mark.asyncio
async def test_pretooluse_blocks_force_push():
    result = await destructive_pre_tool_hook(
        {
            "tool_name": "Bash",
            "tool_input": {"command": "git push --force origin main"},
        },
        "use-1",
        fake_hook_ctx(),
    )
    assert result["hookSpecificOutput"]["permissionDecision"] == "deny"
    assert result["hookSpecificOutput"]["hookEventName"] == "PreToolUse"


@pytest.mark.asyncio
async def test_pretooluse_passes_through_safe():
    result = await destructive_pre_tool_hook(
        {"tool_name": "Bash", "tool_input": {"command": "ls"}},
        "use-1",
        fake_hook_ctx(),
    )
    assert result == {}


@pytest.mark.asyncio
async def test_pretooluse_passes_through_non_bash():
    result = await destructive_pre_tool_hook(
        {"tool_name": "Edit", "tool_input": {"file_path": "x.py"}},
        "use-1",
        fake_hook_ctx(),
    )
    assert result == {}


def test_firewall_dual_gate_source_presence():
    opts = build_sdk_options(
        project_root=Path("/tmp").resolve(),
        worktree=None,
        skill_name="execute-set",
        skill_args={},
        run_id="rid-1",
    )
    assert opts.can_use_tool is can_use_tool_hook
    assert opts.hooks["PreToolUse"][0].hooks[0] is destructive_pre_tool_hook
