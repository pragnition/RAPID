"""Tests for SKILL.md frontmatter parsing and validation."""

import textwrap
from pathlib import Path

import pytest

from app.schemas.skill_frontmatter import SkillFrontmatter
from app.services.skill_frontmatter import FrontmatterError, parse_skill_file, read_skill_body


def _write_skill(tmp_path: Path, content: str) -> Path:
    """Write a SKILL.md file into a skill-like directory and return its path."""
    skill_dir = tmp_path / "test-skill"
    skill_dir.mkdir(parents=True, exist_ok=True)
    skill_md = skill_dir / "SKILL.md"
    skill_md.write_text(textwrap.dedent(content), encoding="utf-8")
    return skill_md


class TestParseSkillFile:
    def test_parse_minimal_frontmatter(self, tmp_path: Path) -> None:
        path = _write_skill(
            tmp_path,
            """\
            ---
            description: A test skill
            args: []
            categories: [autonomous]
            ---

            Body prose here.
            """,
        )
        fm = parse_skill_file(path)
        assert fm.name == "test-skill"
        assert fm.description == "A test skill"
        assert fm.args == []
        assert len(fm.categories) == 1

    def test_parse_rejects_missing_frontmatter(self, tmp_path: Path) -> None:
        path = _write_skill(
            tmp_path,
            """\
            No frontmatter here, just prose.
            """,
        )
        with pytest.raises(FrontmatterError, match="no YAML frontmatter block found"):
            parse_skill_file(path)

    def test_parse_rejects_invalid_category(self, tmp_path: Path) -> None:
        path = _write_skill(
            tmp_path,
            """\
            ---
            description: A test skill
            args: []
            categories: [unknown]
            ---
            """,
        )
        with pytest.raises(FrontmatterError, match="schema validation failed"):
            parse_skill_file(path)

    def test_parse_rejects_choice_without_choices(self, tmp_path: Path) -> None:
        path = _write_skill(
            tmp_path,
            """\
            ---
            description: A test skill
            args:
              - name: strategy
                type: choice
                description: Pick one
                required: true
            categories: [autonomous]
            ---
            """,
        )
        with pytest.raises(FrontmatterError, match="schema validation failed"):
            parse_skill_file(path)

    def test_parse_accepts_allowed_tools_string(self, tmp_path: Path) -> None:
        path = _write_skill(
            tmp_path,
            """\
            ---
            description: A test skill
            allowed-tools: "Bash(rapid-tools:*), Read"
            args: []
            categories: [autonomous]
            ---
            """,
        )
        fm = parse_skill_file(path)
        assert fm.allowed_tools == "Bash(rapid-tools:*), Read"

    def test_parse_with_args(self, tmp_path: Path) -> None:
        path = _write_skill(
            tmp_path,
            """\
            ---
            description: A set-targeted skill
            args:
              - name: set
                type: set-ref
                description: Set to operate on
                required: true
            categories: [human-in-loop]
            ---
            """,
        )
        fm = parse_skill_file(path)
        assert len(fm.args) == 1
        assert fm.args[0].name == "set"
        assert fm.args[0].type.value == "set-ref"
        assert fm.args[0].required is True

    def test_parse_choice_with_choices(self, tmp_path: Path) -> None:
        path = _write_skill(
            tmp_path,
            """\
            ---
            description: A skill with choice arg
            args:
              - name: strategy
                type: choice
                description: Merge strategy
                required: false
                default: auto
                choices: [auto, manual]
            categories: [autonomous]
            ---
            """,
        )
        fm = parse_skill_file(path)
        assert fm.args[0].choices == ["auto", "manual"]
        assert fm.args[0].default == "auto"


class TestReadSkillBody:
    def test_returns_body_after_frontmatter(self, tmp_path: Path) -> None:
        path = _write_skill(
            tmp_path,
            """\
            ---
            description: A test skill
            args: []
            categories: [autonomous]
            ---

            # Step 1
            Do the thing.
            """,
        )
        body = read_skill_body(path)
        assert "# Step 1" in body
        assert "Do the thing." in body
        assert "description:" not in body

    def test_returns_empty_for_frontmatter_only(self, tmp_path: Path) -> None:
        path = _write_skill(
            tmp_path,
            """\
            ---
            description: A test skill
            args: []
            categories: [autonomous]
            ---
            """,
        )
        body = read_skill_body(path)
        assert body.strip() == ""

    def test_returns_whole_file_when_no_frontmatter(self, tmp_path: Path) -> None:
        path = _write_skill(
            tmp_path,
            """\
            Just plain instructions, no frontmatter.
            """,
        )
        body = read_skill_body(path)
        assert "Just plain instructions" in body
