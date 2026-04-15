"""Tests for ``app.agents.sdk_options.build_sdk_options``."""

from __future__ import annotations

import pathlib
from pathlib import Path

import pytest

from app.agents.permission_hooks import can_use_tool_hook, destructive_pre_tool_hook
from app.agents.permissions import PERMISSION_POLICY
from app.agents.sdk_options import build_sdk_options
from app.config import settings


def _build(**overrides):
    defaults = dict(
        project_root=Path("/tmp").resolve(),
        worktree=None,
        skill_name="execute-set",
        skill_args={},
        run_id="rid-1",
    )
    defaults.update(overrides)
    return build_sdk_options(**defaults)


def test_setting_sources_project_only():
    opts = _build()
    assert opts.setting_sources == ["project"]


def test_cwd_is_absolute_project_root(tmp_path: Path):
    opts = _build(project_root=tmp_path)
    assert opts.cwd == str(tmp_path)


def test_worktree_adds_additional_directory(tmp_path: Path):
    wt = tmp_path / "worktrees" / "x"
    wt.mkdir(parents=True)
    opts = _build(project_root=tmp_path, worktree=wt)
    assert opts.add_dirs == [str(wt)]


def test_rejects_relative_project_root():
    with pytest.raises(ValueError, match="project_root must be absolute"):
        build_sdk_options(
            project_root=Path("rel/path"),
            worktree=None,
            skill_name="execute-set",
            skill_args={},
            run_id="rid-1",
        )


def test_rejects_relative_worktree(tmp_path: Path):
    with pytest.raises(ValueError, match="worktree must be absolute"):
        build_sdk_options(
            project_root=tmp_path,
            worktree=Path("relative"),
            skill_name="execute-set",
            skill_args={},
            run_id="rid-1",
        )


def test_env_scrubs_credentials(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "secret")
    monkeypatch.setenv("GITHUB_TOKEN", "ghp_x")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "dontleakme")
    monkeypatch.setenv("PATH", "/usr/bin")
    opts = _build(run_id="rid-42")
    assert "ANTHROPIC_API_KEY" not in opts.env
    assert "GITHUB_TOKEN" not in opts.env
    assert "AWS_SECRET_ACCESS_KEY" not in opts.env
    assert opts.env["PATH"] == "/usr/bin"
    assert opts.env["RAPID_RUN_MODE"] == "sdk"
    assert opts.env["RAPID_RUN_ID"] == "rid-42"


def test_no_bypass_permissions_anywhere():
    for skill_name in PERMISSION_POLICY:
        opts = _build(skill_name=skill_name)
        assert opts.permission_mode in {"default", "acceptEdits"}, (
            f"skill {skill_name} permission_mode={opts.permission_mode!r}"
        )
    src = pathlib.Path(
        pathlib.Path(__file__).resolve().parents[2]
        / "app"
        / "agents"
        / "sdk_options.py"
    ).read_text()
    assert "bypassPermissions" not in src


def test_pretooluse_hook_registered():
    opts = _build()
    assert "PreToolUse" in opts.hooks
    matchers = opts.hooks["PreToolUse"]
    assert len(matchers) == 1
    assert matchers[0].matcher == "Bash"
    assert destructive_pre_tool_hook in matchers[0].hooks


def test_can_use_tool_callback_is_our_hook():
    opts = _build()
    assert opts.can_use_tool is can_use_tool_hook


def test_max_turns_from_policy():
    opts = _build(skill_name="execute-set")
    assert opts.max_turns == 200


def test_max_budget_usd_from_settings(monkeypatch):
    monkeypatch.setattr(settings, "rapid_agent_daily_cap_usd", 25.0)
    opts = _build()
    assert opts.max_budget_usd == 25.0


def test_unknown_skill_falls_back_to_default():
    opts = _build(skill_name="does-not-exist-xyz")
    assert opts.permission_mode == "default"
    assert opts.max_turns == settings.rapid_agent_default_max_turns
