# Web Registration Errors

## Module Resolution Error

**Step:** Checking if RAPID_WEB is enabled (Step 2)

**Error:** `Cannot find module '/home/kek/.claude/plugins/cache/joey-plugins/rapid/4.1.0/src/bin/rapid-tools.cjs/../lib/web-client.cjs'`

**Cause:** The skill template uses `${RAPID_TOOLS}/../lib/web-client.cjs` to resolve the web-client module. `RAPID_TOOLS` points to `.../src/bin/rapid-tools.cjs`, so `../lib/` resolves to `.../src/bin/../lib/` which is `.../src/lib/`. However, Node's `require()` resolved the `..` relative to the `bin/` directory incorrectly, looking at `.../src/bin/rapid-tools.cjs/../lib/` as a literal path rather than navigating up from the `bin/` directory.

**Fix applied:** Used the absolute path `/home/kek/.claude/plugins/cache/joey-plugins/rapid/4.1.0/src/lib/web-client.cjs` directly instead of the relative `${RAPID_TOOLS}/../lib/web-client.cjs` pattern.

**Node version:** v25.6.1

## DAG Data Load Failure

**Step:** Viewing Knowledge Graph in Mission Control frontend

**Error:** `Failed to load DAG data. Check that the backend is running and try again.`

**Source:** `web/frontend/src/pages/KnowledgeGraphPage.tsx` (line 295) — displayed when backend returns a non-404 HTTP error.

**Cause:** Schema mismatch between `.planning/sets/DAG.json` and the web dashboard's expected format. The backend endpoint `GET /api/projects/{projectId}/dag` reads DAG.json via `dag_service.py`, then validates it against a Pydantic schema expecting `nodes`, `edges`, `waves` (dict), and `metadata` keys. The actual DAG.json contained the per-set execution format (`wave_count` + `waves` array with task descriptions), which fails validation and returns a 500.

**Actual DAG.json structure:**
```json
{
  "wave_count": 1,
  "waves": [{"wave": 1, "plan_file": "wave-1-PLAN.md", "tasks": 5, "description": "..."}]
}
```

**Expected DAG.json structure (graph format):**
```json
{
  "nodes": [{"id": "set-name", "wave": 0, "status": "complete"}],
  "edges": [{"source": "set-a", "target": "set-b"}],
  "waves": {"0": {"sets": ["set-name"], "checkpoint": {}}},
  "metadata": {}
}
```

**Fix:** DAG.json needs to be in the graph/dependency format showing sets and their relationships. This is generated during set creation or milestone planning, not during per-set wave execution.
