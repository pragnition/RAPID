"""SKILL.md frontmatter parser -- reads YAML frontmatter and validates against the schema."""

import re
from pathlib import Path
from typing import List

import yaml
from pydantic import ValidationError

from app.schemas.skill_frontmatter import SkillFrontmatter

# Anchored at BOF so bare `---` inside prose does not match.
FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


class FrontmatterError(Exception):
    """Raised when a SKILL.md file has missing or invalid frontmatter."""

    def __init__(self, path: Path, reason: str) -> None:
        self.path = path
        self.reason = reason
        super().__init__(f"{path.resolve()}: {reason}")


def parse_skill_file(path: Path) -> SkillFrontmatter:
    """Parse a SKILL.md file and return a validated SkillFrontmatter instance.

    Raises FrontmatterError if the file lacks a frontmatter block or if the
    YAML content fails schema validation.
    """
    text = path.read_text(encoding="utf-8")
    match = FRONTMATTER_RE.match(text)
    if not match:
        raise FrontmatterError(path, "no YAML frontmatter block found (expected ---\\n...\\n---)")

    raw_yaml = match.group(1)
    try:
        data = yaml.safe_load(raw_yaml)
    except yaml.YAMLError as exc:
        raise FrontmatterError(path, f"invalid YAML: {exc}") from exc

    if not isinstance(data, dict):
        raise FrontmatterError(path, f"frontmatter must be a YAML mapping, got {type(data).__name__}")

    # Derive the skill name from the parent directory name (e.g., skills/merge/SKILL.md -> merge)
    data.setdefault("name", path.parent.name)

    try:
        return SkillFrontmatter.model_validate(data)
    except ValidationError as exc:
        raise FrontmatterError(path, f"schema validation failed: {exc}") from exc


def discover_skill_files(skills_root: Path) -> List[Path]:
    """Walk skills_root one level deep and return paths to all SKILL.md files.

    A skill directory is any immediate child directory of skills_root that
    contains a file literally named SKILL.md. Files at the root level
    (e.g., review-auto-detect.test.cjs) are ignored.
    """
    results: List[Path] = []
    if not skills_root.is_dir():
        return results
    for child in sorted(skills_root.iterdir()):
        if not child.is_dir():
            continue
        skill_md = child / "SKILL.md"
        if skill_md.is_file():
            results.append(skill_md)
    return results
