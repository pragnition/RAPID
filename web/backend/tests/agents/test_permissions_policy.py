"""Tests for the permission policy table and destructive-pattern matcher."""

from __future__ import annotations

from app.agents.permissions import (
    PERMISSION_POLICY,
    is_destructive,
    resolve_policy,
)

_REQUIRED_SKILLS = {
    "plan-set",
    "execute-set",
    "discuss-set",
    "review",
    "merge",
    "cleanup",
    "init",
    "start-set",
    "unit-test",
    "bug-hunt",
    "uat",
    "status",
    "audit-version",
    "quick",
    "bug-fix",
}


def test_permission_policy_has_all_rapid_skills():
    for skill in _REQUIRED_SKILLS:
        assert skill in PERMISSION_POLICY, f"missing skill {skill!r}"


def test_no_bypass_permissions_in_policy():
    modes = {entry["permission_mode"] for entry in PERMISSION_POLICY.values()}
    assert "bypassPermissions" not in modes


def test_permission_modes_are_restricted_set():
    modes = {entry["permission_mode"] for entry in PERMISSION_POLICY.values()}
    assert modes <= {"default", "acceptEdits"}


def test_destructive_patterns_block_rm_rf_root():
    assert is_destructive("rm -rf /")[0] is True


def test_destructive_patterns_block_force_push():
    assert is_destructive("git push origin main --force")[0] is True
    assert is_destructive("git push -f origin main")[0] is True


def test_destructive_patterns_allow_safe_bash():
    assert is_destructive("ls -la")[0] is False
    assert is_destructive("git status")[0] is False
    assert is_destructive("pytest tests/")[0] is False
    assert is_destructive("env | grep PATH")[0] is False


def test_resolve_policy_falls_back_to_default():
    assert resolve_policy("nonexistent-skill") is PERMISSION_POLICY["_default"]
