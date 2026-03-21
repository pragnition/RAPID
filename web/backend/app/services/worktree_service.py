"""Service for reading worktree registry from .planning/worktrees/REGISTRY.json."""

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def get_worktree_registry(project_path: Path) -> dict | None:
    """Read .planning/worktrees/REGISTRY.json and return worktree list.

    Returns dict with keys: version, worktrees (as list, not dict).
    Each worktree has: set_name, branch, path, phase, status, wave,
    created_at, solo, merge_status, merged_at, merge_commit.
    Returns None if file missing or malformed.
    """
    registry_file = project_path / ".planning" / "worktrees" / "REGISTRY.json"
    try:
        raw = registry_file.read_text(encoding="utf-8")
        data = json.loads(raw)
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        logger.debug("REGISTRY.json not readable at %s", registry_file)
        return None

    raw_worktrees = data.get("worktrees", {})

    # The raw JSON has worktrees as a dict keyed by set name.
    # Convert to a list with set_name included and camelCase mapped to snake_case.
    worktrees = []
    for key, wt in raw_worktrees.items():
        worktrees.append({
            "set_name": wt.get("setName", key),
            "branch": wt.get("branch", ""),
            "path": wt.get("path", ""),
            "phase": wt.get("phase", ""),
            "status": wt.get("status", ""),
            "wave": wt.get("wave"),
            "created_at": wt.get("createdAt"),
            "solo": wt.get("solo", False),
            "merge_status": wt.get("mergeStatus"),
            "merged_at": wt.get("mergedAt"),
            "merge_commit": wt.get("mergeCommit"),
        })

    return {
        "version": data.get("version", 1),
        "worktrees": worktrees,
    }
