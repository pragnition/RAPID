"""Label-based card-to-skill routing for autopilot dispatch."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.database import KanbanCard

# Default routing table -- configurable via column settings in future.
_LABEL_TO_SKILL: dict[str, str] = {
    "bug": "rapid:bug-fix",
    "feature": "rapid:add-set",
    "chore": "rapid:quick",
}

_DEFAULT_SKILL = "rapid:quick"


def route_card_to_skill(card: "KanbanCard") -> tuple[str, dict]:
    """Return (skill_name, skill_args) for a given card.

    Routing priority:
    1. Check card labels (stored in metadata_json["labels"]).
    2. First matching label wins.
    3. Fallback to _DEFAULT_SKILL.
    """
    labels: list[str] = []
    try:
        meta = json.loads(card.metadata_json) if card.metadata_json else {}
        labels = [l.lower().strip() for l in meta.get("labels", [])]
    except (json.JSONDecodeError, AttributeError):
        pass

    for label in labels:
        if label in _LABEL_TO_SKILL:
            skill = _LABEL_TO_SKILL[label]
            break
    else:
        skill = _DEFAULT_SKILL

    args = {
        "card_id": str(card.id),
        "title": card.title,
        "description": card.description,
    }
    return skill, args
