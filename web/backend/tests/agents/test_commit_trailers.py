"""Tests for commit-trailer injection hook and helper."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.agents.correlation import bind_card_id, bind_run_id
from app.agents.permission_hooks import _is_simple_git_commit, inject_commit_trailers


# ---------------------------------------------------------------------------
# _is_simple_git_commit
# ---------------------------------------------------------------------------


class TestIsSimpleGitCommit:
    def test_positive_basic(self):
        assert _is_simple_git_commit('git commit -m "msg"')

    def test_positive_amend(self):
        assert _is_simple_git_commit("git commit --amend")

    def test_positive_bare(self):
        assert _is_simple_git_commit("git commit")

    def test_positive_leading_whitespace(self):
        assert _is_simple_git_commit("  git commit -m 'hello'")

    def test_negative_pipe(self):
        assert not _is_simple_git_commit("git log | head")

    def test_negative_and_chain(self):
        assert not _is_simple_git_commit("echo x && git commit -m y")

    def test_negative_or_chain(self):
        assert not _is_simple_git_commit("git commit || echo fail")

    def test_negative_semicolon(self):
        assert not _is_simple_git_commit("ls; git commit")

    def test_negative_non_commit(self):
        assert not _is_simple_git_commit("git push origin main")


# ---------------------------------------------------------------------------
# inject_commit_trailers
# ---------------------------------------------------------------------------


def _make_input(tool_name: str = "Bash", command: str = 'git commit -m "test"') -> dict:
    return {"tool_name": tool_name, "tool_input": {"command": command}}


@pytest.fixture
def mock_context():
    return MagicMock()


class TestInjectCommitTrailers:
    @pytest.mark.asyncio
    async def test_no_context(self, mock_context):
        """When no card_id or run_id is set, returns empty dict."""
        result = await inject_commit_trailers(_make_input(), None, mock_context)
        assert result == {}

    @pytest.mark.asyncio
    async def test_with_card_id(self, mock_context):
        """Set card_id_var, verify --trailer flag is appended."""
        with bind_card_id("card-123"):
            result = await inject_commit_trailers(_make_input(), None, mock_context)
        assert "updatedInput" in result
        cmd = result["updatedInput"]["tool_input"]["command"]
        assert '--trailer "Autopilot-Card-Id: card-123"' in cmd

    @pytest.mark.asyncio
    async def test_with_both(self, mock_context):
        """Set both card_id and run_id, verify both trailers are appended."""
        with bind_run_id("run-abc"):
            with bind_card_id("card-456"):
                result = await inject_commit_trailers(_make_input(), None, mock_context)
        assert "updatedInput" in result
        cmd = result["updatedInput"]["tool_input"]["command"]
        assert '--trailer "Autopilot-Card-Id: card-456"' in cmd
        assert '--trailer "Autopilot-Run-Id: run-abc"' in cmd

    @pytest.mark.asyncio
    async def test_non_bash_tool(self, mock_context):
        """tool_name is not 'Bash', returns empty dict."""
        inp = _make_input(tool_name="Read")
        with bind_card_id("card-1"):
            result = await inject_commit_trailers(inp, None, mock_context)
        assert result == {}

    @pytest.mark.asyncio
    async def test_non_commit_command(self, mock_context):
        """Bash command is 'git push', returns empty dict (no trailers)."""
        inp = _make_input(command="git push origin main")
        with bind_card_id("card-1"):
            result = await inject_commit_trailers(inp, None, mock_context)
        assert result == {}

    @pytest.mark.asyncio
    async def test_chained_command_ignored(self, mock_context):
        """Chained command with git commit is not modified."""
        inp = _make_input(command="echo x && git commit -m y")
        with bind_card_id("card-1"):
            result = await inject_commit_trailers(inp, None, mock_context)
        assert result == {}

    @pytest.mark.asyncio
    async def test_run_id_only(self, mock_context):
        """Only run_id set (no card_id), verify only run trailer is appended."""
        with bind_run_id("run-only"):
            result = await inject_commit_trailers(_make_input(), None, mock_context)
        assert "updatedInput" in result
        cmd = result["updatedInput"]["tool_input"]["command"]
        assert '--trailer "Autopilot-Run-Id: run-only"' in cmd
        assert "Autopilot-Card-Id" not in cmd
