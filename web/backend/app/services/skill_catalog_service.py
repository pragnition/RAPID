"""SkillCatalogService -- loads and manages the in-memory catalog of parsed skill frontmatter."""

import logging
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from app.schemas.skill_frontmatter import SkillArg, SkillCategory
from app.services.skill_frontmatter import (
    FrontmatterError,
    discover_skill_files,
    parse_skill_file,
)

logger = logging.getLogger(__name__)


@dataclass
class SkillMeta:
    """Parsed metadata for a single skill."""

    name: str
    description: str
    allowed_tools: str
    args: list[SkillArg]
    categories: list[SkillCategory]
    source_path: Path


@dataclass
class SkillCatalog:
    """Immutable snapshot of all successfully parsed skills."""

    skills: dict[str, SkillMeta] = field(default_factory=dict)
    parse_errors: list[tuple[Path, str]] = field(default_factory=list)

    def get(self, name: str) -> Optional[SkillMeta]:
        """Look up a skill by name, or return None."""
        return self.skills.get(name)

    def list_all(self) -> list[SkillMeta]:
        """Return all parsed skills sorted by name."""
        return sorted(self.skills.values(), key=lambda s: s.name)


def load_catalog(skills_root: Path, strict: bool = True) -> SkillCatalog:
    """Discover and parse all SKILL.md files under *skills_root*.

    In strict mode (default, used at startup), the first FrontmatterError is
    re-raised so the application fails loudly.  In non-strict mode (used by
    hot-reload), errors are collected and successful parses are kept.
    """
    skills: dict[str, SkillMeta] = {}
    parse_errors: list[tuple[Path, str]] = []

    for skill_path in discover_skill_files(skills_root):
        try:
            fm = parse_skill_file(skill_path)
            skills[fm.name] = SkillMeta(
                name=fm.name,
                description=fm.description,
                allowed_tools=fm.allowed_tools,
                args=list(fm.args),
                categories=list(fm.categories),
                source_path=skill_path,
            )
        except FrontmatterError as exc:
            if strict:
                raise
            parse_errors.append((exc.path, exc.reason))
            logger.warning("Skipping %s: %s", exc.path, exc.reason)

    return SkillCatalog(skills=skills, parse_errors=parse_errors)


class SkillCatalogService:
    """Stateful holder for the skill catalog with atomic swap on reload."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._current: Optional[SkillCatalog] = None

    @property
    def current(self) -> SkillCatalog:
        """Return the current catalog snapshot. Raises if not yet loaded."""
        if self._current is None:
            raise RuntimeError("SkillCatalogService not initialized -- call load_initial() first")
        return self._current

    def load_initial(self, skills_root: Path) -> None:
        """Load the catalog in strict mode (fail-loud at startup)."""
        catalog = load_catalog(skills_root, strict=True)
        with self._lock:
            self._current = catalog
        logger.info("Skill catalog loaded: %d skills", len(catalog.skills))

    def reload(self, skills_root: Path) -> None:
        """Hot-reload the catalog in non-strict mode.

        Only swaps if at least one skill parses successfully.  Errors
        accumulate on the new catalog.  If no skills parse, the previous
        catalog is kept unchanged.
        """
        new_catalog = load_catalog(skills_root, strict=False)
        if not new_catalog.skills:
            logger.warning(
                "Hot-reload produced zero valid skills; keeping previous catalog. "
                "Errors: %s",
                new_catalog.parse_errors,
            )
            # Still expose the parse errors on the existing catalog
            if self._current is not None:
                with self._lock:
                    self._current.parse_errors = new_catalog.parse_errors
            return

        with self._lock:
            self._current = new_catalog

        if new_catalog.parse_errors:
            logger.warning(
                "Hot-reload completed with %d errors: %s",
                len(new_catalog.parse_errors),
                new_catalog.parse_errors,
            )
        else:
            logger.info("Hot-reload completed: %d skills", len(new_catalog.skills))
