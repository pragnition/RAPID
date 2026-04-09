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

    # ---- Merge authoritative statuses from STATE.json ----
    status_map: dict[str, str] = {}
    try:
        state_file = project_path / ".planning" / "STATE.json"
        state_raw = state_file.read_text(encoding="utf-8")
        state_data = json.loads(state_raw)
        current_ms = state_data.get("currentMilestone")
        if current_ms:
            for ms in state_data.get("milestones", []):
                if ms.get("id") == current_ms:
                    for s in ms.get("sets", []):
                        if s.get("id") and s.get("status"):
                            status_map[s["id"]] = s["status"]
                    break
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        logger.debug("STATE.json not readable; using DAG.json statuses as-is")

    nodes = data.get("nodes", [])
    if status_map:
        for node in nodes:
            node_id = node.get("id", "")
            if node_id in status_map:
                node["status"] = status_map[node_id]

    # Map edge keys: from/to -> source/target
    edges = []
    for edge in data.get("edges", []):
        edges.append({
            "source": edge.get("from", edge.get("source", "")),
            "target": edge.get("to", edge.get("target", "")),
        })

    return {
        "nodes": nodes,
        "edges": edges,
        "waves": data.get("waves", {}),
        "metadata": data.get("metadata", {}),
    }
