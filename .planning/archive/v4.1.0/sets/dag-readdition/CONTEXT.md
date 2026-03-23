# CONTEXT: dag-readdition

**Set:** dag-readdition
**Generated:** 2026-03-23
**Mode:** interactive

<domain>
## Set Boundary
Wire the existing DAG library (`src/lib/dag.cjs`) and backend service (`dag_service.py`) into the full RAPID workflow. This means: a CLI `dag` command for generation/display, automatic DAG regeneration hooks in init/add-set/new-version, DAG-ordered set display in /status, and a real interactive cytoscape-dagre visualization replacing the GraphPage stub on the web dashboard.

The core library (toposort, waves, create, validate, tryLoadDAG) and backend DAG service (reads DAG.json, maps from/to -> source/target) already exist and are NOT being modified. The GraphPage component exists as a placeholder stub. The backend router (`views.py`) already has a DAG endpoint.
</domain>

<decisions>
## Implementation Decisions

### CLI Command Design

- Top-level `dag` command registered in rapid-tools.cjs with `generate` and `show` subcommands
- `dag generate`: silent on success, prints only the output file path; errors to stderr
- `dag show`: wave-grouped table format -- sets grouped under wave headers (Wave 1, Wave 2...) with status coloring, similar to /status output style

### DAG Auto-Generation Triggers

- Triggered by: init roadmap, add-set, and new-version operations
- Failure handling: non-fatal warning -- log warning but continue parent operation; agent should attempt to rebuild DAG if generation fails
- Data source: both CONTRACT.json imports and ROADMAP.md parsing, with CONTRACT.json tried first and ROADMAP.md as fallback if contracts are incomplete

### Status Display Ordering

- When DAG.json exists: group sets under wave headers ("Wave 1", "Wave 2"...) with sets listed under each
- When DAG.json is absent: fall back to canonical insertion order (NOT alphabetical -- preserve the existing display order from STATE.json)

### GraphPage Visualization

- Node coloring: Everforest theme colors mapped to set status (green=merged, blue=executing, yellow=planned, gray=pending)
- Interactivity: pan & zoom, click-for-details tooltip/sidebar (set name, status, wave, dependencies), fit-to-view button, layout toggle (dagre top-down vs breadthfirst left-right)
- Bundle strategy: React.lazy code splitting with Suspense -- cytoscape only loads when user navigates to graph page
</decisions>

<specifics>
## Specific Ideas
- Agent should attempt DAG rebuild on failure rather than just warning and moving on
- Canonical order (not alphabetical) is the existing display order -- respect STATE.json set ordering as fallback
</specifics>

<code_context>
## Existing Code Insights

- `src/lib/dag.cjs` exports: toposort, assignWaves, createDAG, createDAGv2, validateDAG, validateDAGv2, getExecutionOrder, tryLoadDAG, DAG_CANONICAL_SUBPATH
- DAG.json canonical path: `.planning/sets/DAG.json` (via DAG_CANONICAL_SUBPATH)
- `web/backend/app/services/dag_service.py`: get_dag_graph() reads DAG.json, maps from/to -> source/target for frontend consumption
- `web/backend/app/routers/views.py`: already has DAG endpoint wired
- `web/frontend/src/pages/GraphPage.tsx`: placeholder stub -- needs full rewrite with cytoscape-dagre
- `src/commands/dag.cjs` does NOT exist yet -- needs to be created
- No existing `skills/status/SKILL.md` DAG integration -- needs to be added
- Multiple commands already reference DAG (merge.cjs, execute.cjs, plan.cjs, worktree.cjs) via tryLoadDAG
</code_context>

<deferred>
## Deferred Ideas
- None identified during discussion
</deferred>
