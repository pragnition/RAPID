"""Tests for the skill args sanitizer -- tag wrapping, length limits, shape validation."""

from pathlib import Path

import pytest

from app.schemas.skill_frontmatter import SkillArg, SkillArgType, SkillCategory
from app.services.skill_args_sanitizer import SanitizerError, sanitize_skill_args
from app.services.skill_catalog_service import SkillMeta


def _make_meta(*args: SkillArg) -> SkillMeta:
    """Build a minimal SkillMeta with the given args."""
    return SkillMeta(
        name="test-skill",
        description="A test skill",
        allowed_tools="",
        args=list(args),
        categories=[SkillCategory.AUTONOMOUS],
        source_path=Path("/fake/SKILL.md"),
    )


def _string_arg(name: str = "msg", required: bool = True, max_length: int | None = None) -> SkillArg:
    return SkillArg(name=name, type=SkillArgType.STRING, description="A string arg", required=required, max_length=max_length)


def _multiline_arg(name: str = "body", required: bool = True) -> SkillArg:
    return SkillArg(name=name, type=SkillArgType.MULTI_LINE, description="Multi-line", required=required)


def _set_ref_arg(name: str = "set_id", required: bool = True) -> SkillArg:
    return SkillArg(name=name, type=SkillArgType.SET_REF, description="Set ref", required=required)


def _choice_arg(name: str = "mode", choices: list[str] | None = None) -> SkillArg:
    return SkillArg(
        name=name,
        type=SkillArgType.CHOICE,
        description="Choice arg",
        choices=choices or ["fast", "slow"],
    )


def _bool_arg(name: str = "verbose", required: bool = False, default: bool | None = False) -> SkillArg:
    return SkillArg(name=name, type=SkillArgType.BOOL, description="Bool", required=required, default=default)


class TestStringArg:
    def test_string_arg_wrapped_in_user_input_tags(self):
        meta = _make_meta(_string_arg())
        result = sanitize_skill_args(meta, {"msg": "hello"})
        assert result["msg"] == "<user_input>hello</user_input>"

    def test_string_arg_rejected_over_max_length(self):
        meta = _make_meta(_string_arg(max_length=5))
        with pytest.raises(SanitizerError) as exc_info:
            sanitize_skill_args(meta, {"msg": "toolong"})
        assert exc_info.value.code == "ARG_TOO_LONG"
        assert exc_info.value.arg_name == "msg"


class TestSetRef:
    @pytest.mark.parametrize("value", [
        "skill-invocation-ui",
        "wave-1",
        "foo.bar_baz",
        "simple",
        "UPPER123",
    ])
    def test_set_ref_shape_accepts_valid(self, value: str):
        meta = _make_meta(_set_ref_arg())
        result = sanitize_skill_args(meta, {"set_id": value})
        assert result["set_id"] == f"<user_input>{value}</user_input>"

    @pytest.mark.parametrize("value", [
        "foo;bar",
        "foo/bar",
        "foo bar",
        "foo$",
        "a&b",
        "x|y",
        "$(cmd)",
    ])
    def test_set_ref_shape_rejects_metachars(self, value: str):
        meta = _make_meta(_set_ref_arg())
        with pytest.raises(SanitizerError) as exc_info:
            sanitize_skill_args(meta, {"set_id": value})
        assert exc_info.value.code == "ARG_SHAPE"


class TestChoiceArg:
    def test_choice_arg_rejects_unknown_choice(self):
        meta = _make_meta(_choice_arg(choices=["fast", "slow"]))
        with pytest.raises(SanitizerError) as exc_info:
            sanitize_skill_args(meta, {"mode": "turbo"})
        assert exc_info.value.code == "ARG_INVALID_CHOICE"

    def test_choice_arg_accepts_valid_choice(self):
        meta = _make_meta(_choice_arg(choices=["fast", "slow"]))
        result = sanitize_skill_args(meta, {"mode": "fast"})
        assert result["mode"] == "fast"


class TestRequiredAndDefaults:
    def test_missing_required_arg_raises(self):
        meta = _make_meta(_string_arg(required=True))
        with pytest.raises(SanitizerError) as exc_info:
            sanitize_skill_args(meta, {})
        assert exc_info.value.code == "ARG_MISSING"

    def test_unknown_arg_raises(self):
        meta = _make_meta(_string_arg())
        with pytest.raises(SanitizerError) as exc_info:
            sanitize_skill_args(meta, {"msg": "ok", "bogus": "bad"})
        assert exc_info.value.code == "ARG_UNKNOWN"
        assert exc_info.value.arg_name == "bogus"

    def test_default_value_substituted_when_optional_and_missing(self):
        meta = _make_meta(_bool_arg(required=False, default=True))
        result = sanitize_skill_args(meta, {})
        assert result["verbose"] is True

    def test_optional_without_default_omitted(self):
        meta = _make_meta(_string_arg(name="opt", required=False))
        result = sanitize_skill_args(meta, {})
        assert "opt" not in result


class TestBoolArg:
    def test_bool_coercion_from_string(self):
        meta = _make_meta(_bool_arg(required=True, default=None))
        result = sanitize_skill_args(meta, {"verbose": "true"})
        assert result["verbose"] is True

    def test_bool_false_string(self):
        meta = _make_meta(_bool_arg(required=True, default=None))
        result = sanitize_skill_args(meta, {"verbose": "false"})
        assert result["verbose"] is False


class TestMultiLineArg:
    def test_multiline_wrapped(self):
        meta = _make_meta(_multiline_arg())
        result = sanitize_skill_args(meta, {"body": "line1\nline2"})
        assert result["body"] == "<user_input>line1\nline2</user_input>"
