"""Service for reading DAG graph from .planning/sets/DAG.json."""

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def get_dag_graph(project_path: Path) -> dict | None:
    """Read .planning/sets/DAG.json and return graph structure.

    Returns dict with keys: nodes, edges, waves, metadata.
    Returns None if file missing or malformed.
    """
    dag_file = project_path / ".planning" / "sets" / "DAG.json"
    try:
        raw = dag_file.read_text(encoding="utf-8")
        data = json.loads(raw)
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        logger.debug("DAG.json not readable at %s", dag_file)
        return None

    # Map edge keys: from/to -> source/target
    edges = []
    for edge in data.get("edges", []):
        edges.append({
            "source": edge.get("from", edge.get("source", "")),
            "target": edge.get("to", edge.get("target", "")),
        })

    return {
        "nodes": data.get("nodes", []),
        "edges": edges,
        "waves": data.get("waves", {}),
        "metadata": data.get("metadata", {}),
    }
