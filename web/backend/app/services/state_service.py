"""Service for reading project state from .planning/STATE.json."""

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def get_project_state(project_path: Path) -> dict | None:
    """Read .planning/STATE.json and return full state structure.

    Returns dict with keys: version, project_name, current_milestone, milestones.
    Each milestone contains id, name, and list of sets with id, status, waves.
    Returns None if file missing or malformed.
    """
    state_file = project_path / ".planning" / "STATE.json"
    try:
        raw = state_file.read_text(encoding="utf-8")
        data = json.loads(raw)
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        logger.debug("STATE.json not readable at %s", state_file)
        return None

    milestones = []
    for ms in data.get("milestones", []):
        sets = []
        for s in ms.get("sets", []):
            sets.append({
                "id": s.get("id", ""),
                "status": s.get("status", "pending"),
                "waves": s.get("waves", []),
            })
        milestones.append({
            "id": ms.get("id", ""),
            "name": ms.get("name", ""),
            "sets": sets,
        })

    return {
        "version": data.get("version", 1),
        "project_name": data.get("projectName", project_path.name),
        "current_milestone": data.get("currentMilestone"),
        "milestones": milestones,
    }
