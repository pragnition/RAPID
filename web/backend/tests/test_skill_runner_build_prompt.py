"""Tests for the build_prompt helper in skill_runner."""

from app.services.skill_runner import build_prompt


class TestBuildPrompt:
    def test_no_args_returns_bare_command(self):
        result = build_prompt("init", {})
        assert result == "/rapid:init"

    def test_single_arg_inline(self):
        result = build_prompt("discuss-set", {"set_id": "my-set"})
        assert result == "/rapid:discuss-set my-set"

    def test_single_arg_with_tags_inline(self):
        """Tags from sanitization should pass through as-is."""
        result = build_prompt("discuss-set", {"set_id": "<user_input>my-set</user_input>"})
        assert result == "/rapid:discuss-set <user_input>my-set</user_input>"

    def test_multi_arg_xml_block(self):
        result = build_prompt("execute-set", {"set_id": "foo", "wave": "2"})
        assert "/rapid:execute-set" in result
        assert "<args>" in result
        assert "<set_id>foo</set_id>" in result
        assert "<wave>2</wave>" in result
        assert "</args>" in result

    def test_multi_arg_xml_block_structure(self):
        result = build_prompt("custom", {"a": "1", "b": "2"})
        lines = result.split("\n")
        assert lines[0] == "/rapid:custom"
        assert lines[1] == ""
        assert lines[2] == "<args>"
        assert lines[-1] == "</args>"

    def test_multi_arg_preserves_all_keys(self):
        args = {"alpha": "A", "beta": "B", "gamma": "C"}
        result = build_prompt("test", args)
        for key, val in args.items():
            assert f"<{key}>{val}</{key}>" in result
