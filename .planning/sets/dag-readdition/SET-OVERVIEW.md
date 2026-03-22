# SET-OVERVIEW: dag-readdition

## Approach

This set wires the existing DAG library (`src/lib/dag.cjs`) into the full RAPID workflow by building the missing integration layers: a CLI command for DAG generation and display, hooks into `init` and `add-set` for automatic DAG regeneration, DAG-ordered output in `/status`, and a real interactive graph visualization on the web dashboard.

The core DAG library already provides toposort, wave assignment, createDAG/createDAGv2, validation, and file loading. The backend DAG service (`dag_service.py`) and API endpoint (`/api/projects/{id}/dag`) also exist and function. The GraphPage component exists but is a placeholder stub. The primary work is therefore: (1) creating the CLI command layer, (2) ensuring the skill files trigger DAG generation at the right moments, (3) making `/status` output DAG-aware, and (4) replacing the GraphPage stub with a real cytoscape-dagre visualization.

The work is naturally sequenced: CLI tooling first (it enables testing), then skill/status integration (depends on the CLI), then the frontend visualization (depends on the backend API already working).

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/commands/dag.cjs` | CLI command with `generate` and `show` subcommands | New |
| `src/lib/dag.cjs` | Core DAG library (toposort, waves, create, validate) | Existing -- no changes expected |
| `skills/init/SKILL.md` | Init skill -- already has DAG generation step | Existing -- may need updates |
| `skills/status/SKILL.md` | Status skill -- needs DAG-ordered display logic | Existing -- needs updates |
| `skills/add-set/SKILL.md` | Add-set skill -- needs DAG regeneration trigger | Existing -- needs updates |
| `web/frontend/src/pages/GraphPage.tsx` | Dashboard graph visualization page | Existing stub -- full rewrite |
| `web/backend/app/routers/views.py` | Backend router with existing DAG endpoint | Existing -- no changes expected |
| `web/backend/app/services/dag_service.py` | Backend DAG service reading DAG.json | Existing -- no changes expected |

## Integration Points

- **Exports:**
  - `dag generate` CLI command: reads STATE.json set dependencies, produces `.planning/sets/DAG.json`
  - `dag show` CLI command: prints formatted DAG with wave grouping and execution order
  - DAG-ordered status display: sets grouped by dependency wave in `/status` output
  - GraphPage visualization: interactive cytoscape-dagre rendering at `/api/projects/{id}/dag`

- **Imports:** None -- this set has no dependencies on other sets

- **Side Effects:**
  - `DAG.json` is created/updated on disk during `init` roadmap and `add-set` operations
  - GraphPage requires `cytoscape` and `cytoscape-dagre` npm packages in the frontend

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| cytoscape-dagre bundle size bloat in frontend | Medium | Lazy-load GraphPage via React.lazy/code splitting |
| Skill file edits conflict with other sets modifying same skills | Medium | Scoped edits -- only add DAG-specific lines, do not restructure existing content |
| DAG.json out of sync if generation fails silently | Low | Already mitigated -- init SKILL.md treats DAG generation failure as non-fatal warning |
| Status skill has no existing DAG integration to build on | Low | Keep DAG ordering as enhancement -- fall back to alphabetical when DAG.json absent |

## Wave Breakdown (Preliminary)

- **Wave 1:** CLI foundation -- create `src/commands/dag.cjs` with `generate` and `show` subcommands, wire into `rapid-tools.cjs` command router
- **Wave 2:** Workflow integration -- update `skills/status/SKILL.md` for DAG-ordered display, verify `skills/init/SKILL.md` and `skills/add-set/SKILL.md` DAG hooks are correct
- **Wave 3:** Frontend visualization -- replace `GraphPage.tsx` stub with cytoscape-dagre interactive graph, add npm dependencies, connect to existing backend DAG API

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
