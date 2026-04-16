"""Tests for the skill catalog service -- loading, discovery, reload, and error handling."""

import textwrap
from pathlib import Path

import pytest

from app.services.skill_catalog_service import SkillCatalogService, load_catalog
from app.services.skill_frontmatter import (
    FrontmatterError,
    discover_skill_files,
    parse_skill_file,
)


def _find_project_root() -> Path:
    """Walk up from this file to find the directory containing .claude-plugin/plugin.json."""
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / ".claude-plugin" / "plugin.json").is_file():
            return parent
    raise RuntimeError("Cannot find project root (no .claude-plugin/plugin.json found)")


@pytest.fixture
def skills_root() -> Path:
    """Return the real skills/ directory in the project."""
    root = _find_project_root()
    sr = root / "skills"
    assert sr.is_dir(), f"skills/ directory not found at {sr}"
    return sr


class TestLoadCatalog:
    def test_load_catalog_finds_all_skills(self, skills_root: Path) -> None:
        catalog = load_catalog(skills_root, strict=True)
        assert len(catalog.skills) >= 29, (
            f"Expected at least 29 skills, found {len(catalog.skills)}: "
            f"{sorted(catalog.skills.keys())}"
        )
        for meta in catalog.list_all():
            assert meta.name, "SkillMeta.name must be non-empty"
            assert meta.description, "SkillMeta.description must be non-empty"
            assert len(meta.categories) > 0, f"Skill {meta.name} has no categories"

    def test_every_skill_dir_has_parseable_frontmatter(self, skills_root: Path) -> None:
        skill_files = discover_skill_files(skills_root)
        assert len(skill_files) >= 29, f"Expected at least 29 skill files, found {len(skill_files)}"
        for path in skill_files:
            # Should not raise FrontmatterError
            fm = parse_skill_file(path)
            assert fm.name == path.parent.name, (
                f"Skill name mismatch: expected {path.parent.name}, got {fm.name}"
            )


class TestSkillCatalogService:
    def test_reload_keeps_last_good_on_error(self, skills_root: Path, tmp_path: Path) -> None:
        """Write a bad SKILL.md, reload, and verify the service keeps the prior good catalog."""
        service = SkillCatalogService()
        service.load_initial(skills_root)
        initial_count = len(service.current.skills)
        assert initial_count >= 29

        # Create a temp skills root with one bad skill
        bad_root = tmp_path / "skills"
        bad_skill_dir = bad_root / "bad-skill"
        bad_skill_dir.mkdir(parents=True)
        (bad_skill_dir / "SKILL.md").write_text(
            textwrap.dedent("""\
            ---
            description: This skill has invalid frontmatter
            categories: [nonexistent-category]
            ---
            """),
            encoding="utf-8",
        )

        # Reload from the bad root -- should keep prior good data since zero valid skills
        service.reload(bad_root)
        assert len(service.current.skills) == initial_count, (
            "Service should have kept the previous good catalog"
        )

    def test_reload_swaps_when_valid_skills_exist(self, skills_root: Path, tmp_path: Path) -> None:
        """Reload with a mix of good and bad skills -- should swap to new catalog."""
        service = SkillCatalogService()
        service.load_initial(skills_root)

        # Create a temp skills root with one good and one bad skill
        new_root = tmp_path / "skills"
        good_dir = new_root / "good-skill"
        good_dir.mkdir(parents=True)
        (good_dir / "SKILL.md").write_text(
            textwrap.dedent("""\
            ---
            description: A valid skill
            args: []
            categories: [autonomous]
            ---
            """),
            encoding="utf-8",
        )
        bad_dir = new_root / "bad-skill"
        bad_dir.mkdir(parents=True)
        (bad_dir / "SKILL.md").write_text("no frontmatter", encoding="utf-8")

        service.reload(new_root)
        assert len(service.current.skills) == 1
        assert "good-skill" in service.current.skills
        assert len(service.current.parse_errors) == 1


class TestDiscoverSkillFiles:
    def test_discover_skip_files_at_root(self, skills_root: Path) -> None:
        """Verify that non-directory items at skills root (like test files) are excluded."""
        paths = discover_skill_files(skills_root)
        for p in paths:
            assert p.name == "SKILL.md", f"Expected SKILL.md, got {p.name}"
            assert p.parent.is_dir(), f"Parent of {p} should be a directory"
        # Specifically: review-auto-detect.test.cjs (if it exists) must not appear
        names = [p.parent.name for p in paths]
        assert "review-auto-detect.test.cjs" not in names
