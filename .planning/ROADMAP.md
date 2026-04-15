# Roadmap: RAPID

## Milestones

- **v1.0 MVP** — 11 sets (shipped 2026-03-03)
- **v1.1 Polish** — 6 sets (shipped 2026-03-06)
- **v2.0 Mark II** — 9 sets (shipped 2026-03-09)
- **v2.1 Improvements & Fixes** — 10 sets (shipped 2026-03-10)
- **v2.2 Subagent Merger & Documentation** — 5 sets (shipped 2026-03-12)
- **v3.0 Refresh** — 8 sets (shipped 2026-03-13)
- **v3.1.0 Polish & Cleanup** — 4 sets (shipped 2026-03-13)
- **v3.2.0 General Fixes** — 5 sets (shipped 2026-03-14)
- **v3.3.0 Developer Experience** — 10 sets (shipped 2026-03-17)
- **v3.4.0 Agent Intelligence** — 6 sets (shipped 2026-03-18)
- **v3.5.0 Robustness & Fixes** — 4 sets (shipped 2026-03-19)
- **v3.6.0 Workflow & UX Polish** — 5 sets (shipped 2026-03-20)
- **v4.0.0 Mission Control** — 7 sets (shipped 2026-03-22)
- **v4.1.0 Polish & Fixes** — 8 sets (shipped 2026-03-23)
- **v4.2.1 Discuss & Audit** — 3 sets (shipped 2026-03-24)
- **v4.3.0 Reliability & State** — 4 sets (shipped 2026-03-25)
- **v4.4.0 Polish & Documentation** — 3 sets (shipped 2026-03-26)
- **v4.5 Developer Experience II** — 4 sets (shipped 2026-03-26)
- **v5.0 OSS Presentation** — 5 sets (shipped 2026-03-31)
- **v6.0.0 Scale & Quality** — 7 sets (shipped 2026-04-06)
- **v6.1.0 UX & Onboarding** — 7 sets (shipped 2026-04-07)
- **v6.2.0 DX Refinements** — 5 sets (shipped 2026-04-08)
- **v6.3.0 Mission Control & Fixes** — 7 sets (shipped 2026-04-15)
- **v7.0.0 Mission Control Autopilot** — 6 sets (in progress)

## Active Milestone: v7.0.0 — Mission Control Autopilot

Build a Python-native agent control plane in-process in the existing FastAPI Mission Control backend, grafted onto the current webUI dashboard. The Claude Agent SDK runs in-process, owning `ClaudeSDKClient` instances inside a new `AgentSessionManager`. Each run is a durable server-side resource with a SQLite row, an in-memory session, and an event bus streaming to the browser via SSE + polling fallback. Closing the browser does not kill the run; reopening re-attaches. Autonomous skills ship via SDK on day one; interactive skills land in Wave 2 via a `can_use_tool` bridge plus custom MCP tools (`mcp__rapid__webui_ask_user`, `ask_free_text`). Kanban becomes an agent-accessible work queue with autopilot routing in Wave 3, alongside new Agents and Chats tabs in the webUI.

### Set 1: Agent Runtime Foundation
**Branch:** `set/agent-runtime-foundation`
**Scope:** The foundational `app/agents/` package (session_manager, agent_session, event_bus, skill_runner, permissions, transcripts, tools package), `agent_run` + `agent_event` SQLModels and Alembic migration, task-queue dispatch endpoints (`POST/GET /api/agents/runs`, SSE `/events`, `POST /input`, `POST /interrupt`), destructive-command firewall (`can_use_tool` callback with regex + no-op PreToolUse hook + `disallowed_tools`), credential scrub + proxy hook (`env={}` to SDK), per-project asyncio.Semaphore (cap 3) and per-set SQLite unique-constraint mutex, run orphan sweeper on startup, `run_id` correlation threaded through logs + SQLite + SSE + `.planning/` writes, centralized SDK option construction (`setting_sources=["project"]`, `cwd=project_root`, `additional_directories=[worktree]`, `max_turns`, no `bypassPermissions`), per-skill permission policy config, per-run `max_turns`/`total_cost_usd` tracking with per-project daily cap (default $10), error taxonomy (`SdkError`/`RunError`/`StateError`/`ToolError`/`UserError`), CORS config from env, tool shim compatibility audit doc (`docs/SKILL_SDK_MATRIX.md`). Ships autonomous execution end-to-end for the 17 no-input skills (plan-set, execute-set, merge, review, start-set, cleanup, status, pause, resume, backlog, unit-test, bug-hunt, uat, audit-version, documentation, migrate, new-version planning half) behind a provisional `/runs` page.
**Dependencies:** none

### Set 2: Web Tool Bridge
**Branch:** `set/web-tool-bridge`
**Scope:** In-process SDK MCP tools in `app/agents/tools/ask_user.py` -- `mcp__rapid__webui_ask_user`, `mcp__rapid__ask_free_text`, optional `render_diff`; `can_use_tool` interception of built-in `AskUserQuestion` (4-question auto-split, zero skill changes for CLI path); `agent_prompts` SQLite table (server-minted `prompt_id` per request, status tracking, timeout + 409-on-stale); `POST /api/agents/runs/{id}/answer` endpoint; approval-modal triad (Approve / Reject / Edit) with focus-trap + ESC=reject; `RAPID_RUN_MODE=sdk` env gate so skill prose branches without forking skill files; minimal patches to 9 interactive skill prose files (discuss-set, init, new-version discovery half, bug-fix, scaffold, branding, quick scoping, assumptions, add-set mid-milestone) to call the custom tool when in sdk mode; sessionStorage-backed prompt draft persistence across tab close; reconnect/prompt-resume UX. Unlocks interactive skills in the browser.
**Dependencies:** agent-runtime-foundation (session manager + SSE event schema + `can_use_tool` callback + agent_run SQLite row)

### Set 3: Skill Invocation UI
**Branch:** `set/skill-invocation-ui`
**Scope:** Extend all 30 `SKILL.md` files with YAML frontmatter `args:` schema (string / choice / bool / multi-line / set-ref input types, description, required flag, default value, cap ~10 inputs per skill); `app/services/skill_catalog_service.py` + `GET /api/skills` + `GET /api/skills/{name}` catalog endpoints; frontend `<SkillLauncher>` modal + typed form generator (modeled on GitHub Actions `workflow_dispatch`); dedicated "Skip discuss" toggle wiring for skills that support it; precondition-check endpoint (e.g. cannot `/execute-set` without plan); skill-argument sanitization (`<user_input>` delimiters, length limits, server-controlled SDK options only -- no shell interpolation); skill gallery page; launch flow that calls the run dispatch endpoint from Set A with validated args. Pre-dispatch concern; fully parallelizable with Set B (runtime-side).
**Dependencies:** agent-runtime-foundation (run dispatch endpoint + skill_runner contract)

### Set 4: Kanban Autopilot
**Branch:** `set/kanban-autopilot`
**Scope:** In-process `@tool` functions in `app/agents/tools/kanban_tools.py` (list, get, add, move, update, comment) routed through `kanban_service.py` (SQL transactions + optimistic concurrency via per-card `rev`); Kanban schema v2 Alembic migration + backfill (`created_by`, `locked_by_run_id`, `completed_by_run_id`, `agent_status`, optional `metadata` JSON, optional `agent_run_id` FK on KanbanCard; `is_autopilot` flag on KanbanColumn); enforce `board.json` as read-only projection (canonical state in SQLite); new `skills/autopilot/SKILL.md` that polls autopilot-flagged columns; `app/agents/autopilot_worker.py` (lifespan-managed poller) with per-card max-retry (N=3) + card-level timeout + "Blocked" column halt on failure; card-to-skill routing by label (`bug` -> `/rapid:bug-fix`, `feature` -> `/rapid:add-set`, default -> `/rapid:quick`); commit-trailer traceability (`Autopilot-Card-Id:`); UI badges for agent-claimed/agent-created cards; prompt-injection delimiting of card descriptions as `<untrusted>`. Self-contained; parallelizable with Set E.
**Dependencies:** agent-runtime-foundation (session manager dispatches the autopilot runs + kanban tools are registered as MCP via `create_sdk_mcp_server` from the foundation)

### Set 5: Agents + Chats Tabs
**Branch:** `set/agents-chats-tabs`
**Scope:** New frontend routes `/agents`, `/agents/:runId`, `/chats`, `/chats/:threadId`; sidebar `NAV_ITEMS` extension with `ga` / `gh` keyboard shortcuts (grouped with Kanban under driver surfaces, separated from observer surfaces); `AgentsPage` (runs list with filters + launcher entry), `AgentRunPage` (status pill `RUNNING / 00:04:32` + live activity feed + pause/stop controls + cost/token/duration telemetry + inline tool-call cards with spinner-checkmark-duration-expandable args/result + NO composer); `ChatsPage` thread list + `ChatThreadPage` with persistent bottom composer, streaming cursor, inline tool-call cards, inline structured-question forms for `can_use_tool` prompts; `useAgentEvents` hook with SSE primary + polling fallback (2-5s); `useChats` hook; chat persistence schema (`chat`, `chat_message`, optional `chat_attachments` stubbed nullable) + Alembic migration + `chat_service.py` + `/api/chats` routes; ARIA live regions for streaming content, `aria-busy` during token streams, focus-trapped approval modals, keyboard-accessible pause/stop/approve (`Shift+P`/`Shift+S`), `prefers-reduced-motion` respect, auto-scroll opt-out, WCAG AA color contrast; empty-state onboarding on both tabs explaining chat-vs-run distinction with 3 example actions; deep-linkable routes; consolidated dashboard endpoint to reduce React Query thundering herd; Vite dev-proxy config for SSE (`vite.config.ts`). Replaces the provisional `/runs` page from Set A.
**Dependencies:** agent-runtime-foundation (SSE event schema + agent_run queries + run dispatch); web-tool-bridge (rich chat with pending-question UI + approval modal triad); skill-invocation-ui (launcher modal embedded in AgentsPage)

### Set 6: Wireframe Rollout
**Branch:** `set/wireframe-rollout`
**Scope:** Apply the newly branded wireframe (produced via the `/rapid:branding` skill) across the Mission Control frontend shell AND rewrite the `CONTRACT.json` files for every pending downstream set in this milestone so their exports/imports/file-ownership reflect the new UI structure. Deliverables: updated `web/frontend/**` (layout, theme, routing, top-level components, design tokens, shared primitives), rewritten `.planning/sets/{web-tool-bridge,skill-invocation-ui,kanban-autopilot,agents-chats-tabs}/CONTRACT.json` aligned to the redesigned surfaces, and targeted `DEFINITION.md` updates on downstream sets whose UI scope shifted materially. This set is the rollout vehicle for the redesign: it makes the wireframe real in code, then propagates the design's implications through the planning artifacts so downstream sets execute against the new shape instead of the pre-redesign contracts.
**Dependencies:** agent-runtime-foundation (backend runtime the redesigned frontend consumes). Blocks (soft): web-tool-bridge, skill-invocation-ui, kanban-autopilot, agents-chats-tabs — those sets will consume the rewritten contracts and should declare `wireframe-rollout` as a dep when planned.

## Dependency Graph

```
agent-runtime-foundation (must go first; gates all others)
  |
  +-- wireframe-rollout (rewrites downstream CONTRACT.json; lands before B/C/D/E)
  |     |
  |     +-- web-tool-bridge ---------+
  |     |                            |
  |     +-- skill-invocation-ui -----+--> agents-chats-tabs
  |     |
  |     +-- kanban-autopilot (independent of B/C/E)
```

- `agent-runtime-foundation` gates everything.
- `wireframe-rollout` lands next, applying the new branded wireframe and rewriting contracts for sets B-E so they execute against the redesign.
- `web-tool-bridge` and `skill-invocation-ui` are parallel-compatible (runtime-side vs pre-dispatch-side).
- `kanban-autopilot` and `agents-chats-tabs` are parallel-compatible.
- `agents-chats-tabs` soft-depends on `web-tool-bridge` for the chat UI's pending-question flow; the agents list/run-detail view alone could ship against the foundation.

## Contract Summary

| Set | Exports | Imports |
|-----|---------|---------|
| agent-runtime-foundation | `build_sdk_options()` helper, `AgentSessionManager` service, `AgentSession` class, `EventBus` pub/sub, `can_use_tool` callback hook, `disallowed_tools` registry, `agent_run` + `agent_event` SQLModels, `sse_event_schema` (typed event names: assistant_text / thinking / tool_use / tool_result / ask_user / permission_req / status / run_complete), `POST/GET /api/agents/runs` + SSE `/events` + `POST /input` + `POST /interrupt` HTTP surface, `run_id` correlation contract, per-skill permission policy registry, `create_sdk_mcp_server` integration point, `RAPID_RUN_MODE` env var contract | none |
| web-tool-bridge | `mcp__rapid__webui_ask_user` MCP tool, `mcp__rapid__ask_free_text` MCP tool, `agent_prompts` table, `POST /api/agents/runs/{id}/answer` endpoint, `<AskUserModal>` + `<PermissionPrompt>` + `<ApprovalModal>` React components, prompt-id mint+timeout+409 protocol, patched skill prose for 9 interactive skills | `build_sdk_options()`, `can_use_tool` callback hook, `EventBus`, SSE event schema (ask_user / permission_req events), `agent_run` SQLModel, `RAPID_RUN_MODE` env var (from agent-runtime-foundation) |
| skill-invocation-ui | Extended SKILL.md frontmatter schema (`args:` block), `GET /api/skills` + `GET /api/skills/{name}` catalog endpoints, `skill_catalog_service.py`, `<SkillLauncher>` + `<RunLauncher>` React components + typed form generator, precondition-check endpoint, sanitized-args contract (`<user_input>` delimiters + length limits) | `POST /api/agents/runs` dispatch endpoint, `build_sdk_options()` helper signature, `skill_runner` contract (from agent-runtime-foundation) |
| kanban-autopilot | Kanban v2 schema (`created_by`, `locked_by_run_id`, `completed_by_run_id`, `agent_status`, `metadata`, `agent_run_id` FK; `is_autopilot` flag on KanbanColumn), Kanban MCP tools (list/get/add/move/update/comment as `@tool`), `autopilot_worker.py` lifespan service, `skills/autopilot/SKILL.md`, card-to-skill routing contract, commit-trailer traceability (`Autopilot-Card-Id:`) | `create_sdk_mcp_server` integration point, `AgentSessionManager`, `build_sdk_options()` helper, `agent_run` FK target, `run_id` correlation contract (from agent-runtime-foundation) |
| agents-chats-tabs | `/agents` + `/agents/:runId` + `/chats` + `/chats/:threadId` routes, sidebar `ga`/`gh` nav entries, `AgentsPage` + `AgentRunPage` + `ChatsPage` + `ChatThreadPage` React pages, `useAgentEvents` + `useChats` hooks, `chat` + `chat_message` SQLModels, `chat_service.py`, `/api/chats` REST endpoints, consolidated dashboard endpoint, Vite SSE proxy config, inline tool-call card + status-pill + approval-modal integration | `GET /api/agents/runs` + SSE `/events` + `POST /interrupt` (from agent-runtime-foundation), SSE event schema, `<AskUserModal>` + `<PermissionPrompt>` + `<ApprovalModal>` (from web-tool-bridge), `<SkillLauncher>` + `GET /api/skills` (from skill-invocation-ui), frontend shell + design tokens + component primitives (from wireframe-rollout) |
| wireframe-rollout | Redesigned `web/frontend/**` layout, theme, routing, top-level components, design tokens, shared component primitives from the new branded wireframe; rewritten `CONTRACT.json` for `web-tool-bridge` + `skill-invocation-ui` + `kanban-autopilot` + `agents-chats-tabs` aligned to the redesigned UI surfaces; targeted `DEFINITION.md` edits on downstream sets where UI scope shifted | `app/agents/*` HTTP + SSE surface (from agent-runtime-foundation) — the redesigned frontend consumes these endpoints |

## Notes

- This roadmap decomposes into sets only; wave and job decomposition happens per-set during `/rapid:plan-set`.
- The meta-goal "Browser-Native Workflow" is an emergent property of Sets 1-5 landing together (it is not a separate set).
- No scaffold report is present; there is no shared baseline of generated files to exclude from set ownership.
- Team size is 1 (solo developer), so no foundation set and no Developer Groups section are included.
- Five load-bearing foundations live in Set 1 because their retrofit cost is very high: run mutex (SQLite unique constraint + semaphore), logging substrate with `run_id` correlation, authentication model (localhost-only + optional bearer token), tool shim compatibility audit (all 30 skills), and the centralized SDK option-construction helper.
- Set 6 (`wireframe-rollout`) was added mid-milestone (2026-04-15) after a UI redesign via the `/rapid:branding` skill produced a new wireframe. It rolls the wireframe into code AND rewrites the pending downstream sets' contracts so they execute against the redesigned surfaces rather than the pre-redesign shape.

