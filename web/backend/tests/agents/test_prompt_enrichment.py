"""Tests for skill content injection into agent prompts."""

import textwrap
from pathlib import Path
from unittest.mock import MagicMock

from app.agents.session_manager import AgentSessionManager
from app.services.skill_catalog_service import SkillCatalogService, SkillMeta


def _make_skill_file(tmp_path: Path, name: str, body: str) -> Path:
    """Create a SKILL.md file with frontmatter + body."""
    skill_dir = tmp_path / name
    skill_dir.mkdir()
    skill_md = skill_dir / "SKILL.md"
    skill_md.write_text(
        textwrap.dedent(f"""\
        ---
        description: test skill
        args: []
        categories: [autonomous]
        ---
        {body}
        """),
        encoding="utf-8",
    )
    return skill_md


def _mgr_with_catalog(tmp_path: Path, skills: dict[str, str]) -> AgentSessionManager:
    """Build an AgentSessionManager with a mock engine and populated catalog."""
    engine = MagicMock()
    mgr = AgentSessionManager(engine)

    catalog_svc = SkillCatalogService()
    from app.services.skill_catalog_service import SkillCatalog

    metas: dict[str, SkillMeta] = {}
    for name, body in skills.items():
        path = _make_skill_file(tmp_path, name, body)
        metas[name] = SkillMeta(
            name=name,
            description="test",
            allowed_tools="*",
            args=[],
            categories=[],
            source_path=path,
        )
    catalog_svc._current = SkillCatalog(skills=metas)
    mgr.set_skill_catalog(catalog_svc)
    return mgr


class TestEnrichPromptWithSkill:
    def test_prepends_skill_body_to_prompt(self, tmp_path: Path) -> None:
        mgr = _mgr_with_catalog(tmp_path, {"status": "# Status\nShow the dashboard."})
        result = mgr._enrich_prompt_with_skill("status", "/rapid:status {}")
        assert "<command-name>/rapid:status</command-name>" in result
        assert "# Status" in result
        assert "Show the dashboard." in result
        assert "ARGUMENTS: /rapid:status {}" in result

    def test_returns_original_prompt_for_unknown_skill(self, tmp_path: Path) -> None:
        mgr = _mgr_with_catalog(tmp_path, {})
        result = mgr._enrich_prompt_with_skill("nonexistent", "hello")
        assert result == "hello"

    def test_returns_original_prompt_when_no_catalog(self) -> None:
        engine = MagicMock()
        mgr = AgentSessionManager(engine)
        result = mgr._enrich_prompt_with_skill("status", "hello")
        assert result == "hello"

    def test_returns_original_prompt_for_empty_body(self, tmp_path: Path) -> None:
        mgr = _mgr_with_catalog(tmp_path, {"empty": ""})
        result = mgr._enrich_prompt_with_skill("empty", "original prompt")
        assert result == "original prompt"

    def test_preserves_chat_prompts_for_unknown_skill(self, tmp_path: Path) -> None:
        """Chat messages for skills not in the catalog pass through unchanged."""
        mgr = _mgr_with_catalog(tmp_path, {"status": "# Status\nBody."})
        chat_prompt = "Tell me about the weather"
        result = mgr._enrich_prompt_with_skill("unknown-chat-skill", chat_prompt)
        assert result == chat_prompt
