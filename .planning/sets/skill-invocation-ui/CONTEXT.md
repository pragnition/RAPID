# CONTEXT: skill-invocation-ui

**Set:** skill-invocation-ui
**Generated:** 2026-04-16
**Mode:** interactive

<domain>
## Set Boundary

This set builds the end-to-end user-facing path for launching RAPID skills from the Mission Control web dashboard. In scope: extending all ~30 `skills/*/SKILL.md` files with an `args:` frontmatter block, the backend `skill_catalog_service` + `/api/skills` endpoints + `sanitize_skill_args` + precondition check endpoint, and the frontend `SkillGallery` + `SkillLauncher` + `RunLauncher` components composed from wireframe-rollout primitives. The set consumes `build_sdk_options`, `skill_runner.build_prompt`, and `POST /api/agents/runs` from `agent-runtime-foundation` and does not introduce new UI primitives.

Out of scope: the run dispatch endpoint itself, SDK option construction, session management, the chat/agent-run UI surfaces (owned by `agents-chats-tabs`), the MCP ask-user bridge (owned by `web-tool-bridge`), kanban autopilot (owned by `kanban-autopilot`), and the wireframe primitives themselves (owned by `wireframe-rollout`).
</domain>

<decisions>
## Implementation Decisions

### Precondition check architecture
- **Decision:** Preconditions live in a **centralized Python registry** module (one map of skill name \u2192 check function). Each check receives `project_state` and returns `PreconditionResult`. Shared state-introspection helpers live alongside.
- **Scope:** Checks stay **shallow** \u2014 STATE.json presence, set status, artifact file existence. Skills themselves remain the source of truth for deep DAG / wave / branch validation.
- **Rationale:** Rules frequently need state-introspection logic richer than YAML supports, and keeping them in one module makes them reviewable together and easy to evolve. Shallow scope keeps the `/check-preconditions` endpoint fast enough for debounced re-checks and avoids duplicating logic that lives inside the skills themselves.

### Catalog hot-reload strategy
- **Decision:** **File-watch in dev, startup-only in prod.** `watchdog` observer on `skills/` when a `RAPID_DEV` (or equivalent) env flag is set; production parses once at process boot.
- **Invalid frontmatter handling:** **Fail-loud at startup; keep-last-good on hot-reload.** Startup still crashes on invalid frontmatter (matches CONTRACT.json `frontmatter_schema_validated`). Hot-reload preserves the previous catalog and surfaces the parse error in logs and a `/api/skills/health` (or equivalent) signal.
- **Rationale:** Devs edit SKILL.md often; a watcher pays for itself quickly. Prod stays simple and predictable. The fail-loud-on-boot / keep-last-good-on-reload split honors CONTRACT.json's startup clause while keeping a running dev server alive through transient bad edits.

### Set-ref arg validation
- **Decision:** **No server-side sanitization or existence check** on set-ref args. The launcher's `SearchInput` autocompletes from `.planning/sets/` to guide valid input, but invalid refs are forwarded to the skill, which reports \"set not found\" in its own way. String args still flow through the existing `<user_input>` tag wrap + length caps; only the set-ref-specific metacharacter rejection and existence gate are removed.
- **Contract impact:** `CONTRACT.json` `sanitized_args_contract` will be revised during planning to drop the \"rejects shell metacharacters in set-ref args\" clause. Tag wrapping and per-type length caps remain.
- **Rationale:** User explicitly said \"no need any sanitization\" and elected to skip even the existence check. Args never reach a shell (SDK `ClaudeAgentOptions` boundary handles isolation); the user-input wrap is the defense line. Skills already handle invalid set refs gracefully. This simplifies the server and avoids duplicating skill-side error reporting.

### SKILL.md args edit strategy
- **Decision:** **Hand-authored per-skill** with a short one-page style guide (arg name conventions, description voice, default choices). No template inheritance, no script migration.
- **Scope:** **Args on set-targeted skills only.** The ~16 skills that take a set-ref or set-index (discuss-set, plan-set, execute-set, bug-fix, merge, review, uat, unit-test, resume, pause, cleanup, backlog, quick, audit-version, new-version, add-set) get non-empty `args:` blocks. All other skills (init, status, scaffold, branding, documentation, find-skills, register-web, migrate, etc.) ship `args: []` and become one-click confirm-and-launch entries in the gallery.
- **Rationale:** Args are UX-facing text; quality variance matters, and 30 files is tractable for hand authoring. Args-less default keeps the launcher surface small and ships faster; the ~5 most-used interactive skills still get full form ergonomics.

### Category taxonomy
- **Decision:** **Flat 3-category filter by behavior** \u2014 autonomous / interactive / human-in-loop. No second axis, no free-tag system.
- **Source of truth:** **Per-skill in SKILL.md frontmatter** (`categories: [autonomous]`). Catalog service parses it alongside `args:`. Missing categories fail the startup schema.
- **Rationale:** Matches CONTRACT.json's stated taxonomy. Frontmatter-based authoring keeps classification close to the skill and reviewed per-file, consistent with how args are handled. Name prefixes (`rapid:`, `branding:`) already convey domain grouping visually, so a second axis would add chrome without meaningful navigation gain.

### SkillLauncher form layout
- **Decision:** **Single-column form with optional-args collapse.** Required args always visible; optional args behind a \"Show optional inputs (N)\" disclosure. Composition uses wireframe-rollout `PageHeader` at the modal top, `StructuredQuestion` for choice/bool args, Composer-pattern textarea for multi-line, `SearchInput` for set-ref args, and `ErrorCard` for blockers.
- **Defaults UX:** **Pre-filled with a \"default\" marker.** Default values appear in the field on modal open with a small `default` tag; a reset/edit affordance lets the user restore the default after changes.
- **Rationale:** Most skills will be args-less or 1-3 args, so a wizard is overkill. The optional-args collapse keeps the first screen focused for the few skills with richer arg sets without splitting input across steps. Pre-filled defaults reduce keystrokes for the common case; the marker keeps users from dispatching a default they didn't notice.

### Precondition error display
- **Decision:** **Top `ErrorCard` for global blockers + inline under-field for arg-specific blockers.** Global blockers (e.g. \"no plan exists\") live at the top of the launcher; arg-scoped blockers (e.g. \"target set must be in 'pending' status\") render beneath the offending field.
- **Re-check timing:** **Debounced (~500ms) on args-change + hard check on Submit.** Live feedback as the user edits; the Submit click triggers the authoritative server-side check, which also handles the race when state changes between pre-check and dispatch.
- **Rationale:** Each blocker lands where it's actionable without hiding the at-a-glance overview. 500ms debounce keeps `/check-preconditions` load manageable while still showing blockers as args settle. Submit-time re-check remains mandatory because the 400 race path is an explicit contract requirement.

### Gallery variants in AgentsPage vs ChatsPage
- **Decision:** **Filtered by default with an \"All skills\" toggle.** `AgentsPage` defaults the gallery to `autonomous + human-in-loop`; `ChatsPage` defaults to `interactive + human-in-loop`. An explicit toggle in each host reveals the full catalog.
- **Sort:** **By category, alphabetical within.** Cards are grouped into category bands; within each band sorted alphabetically.
- **Rationale:** Context-aware defaults reinforce the chat-vs-run mental model while the toggle preserves discoverability for power users. Category grouping matches the filter chips visually and is predictable as the catalog grows; recent-use / usage-tracking is deferred (see DEFERRED.md) until real usage data is available.

### Claude's Discretion
- Exact Pydantic/Zod-equivalent schema shapes for each arg type (`string`, `choice`, `bool`, `multi-line`, `set-ref`) \u2014 wave-level design.
- Concrete file layout for the central precondition registry module and helper utilities.
- SkillGallery `StatCard` layout specifics (per-category count header, empty-state copy) within the bounds of the wireframe-rollout primitives.
- `RAPID_DEV` / hot-reload env flag name and exact watchdog debouncing parameters.
- Precise default-value marker styling within the wireframe-rollout design tokens.
- Per-skill category classification decisions when a skill straddles two buckets (e.g. `/rapid:quick`) \u2014 decide during the SKILL.md edit wave.
- Error copy for precondition blockers \u2014 per-blocker voice and phrasing.
- Arrow-key navigation ergonomics inside the gallery (wrap-around, category-band traversal) within BRANDING.md interaction-patterns.
</decisions>

<specifics>
## Specific Ideas
- Skills receiving non-empty `args:` (~16): discuss-set, plan-set, execute-set, bug-fix, merge, review, uat, unit-test, resume, pause, cleanup, backlog, quick, audit-version, new-version, add-set.
- `CONTRACT.json` `sanitized_args_contract` needs an in-set revision to drop the \"rejects shell metacharacters in set-ref args\" clause; tag wrapping + length caps remain.
- Launcher layout uses exactly these wireframe-rollout primitives: `PageHeader`, `StructuredQuestion`, Composer textarea, `SearchInput`, `ErrorCard`; no new primitives introduced.
- Gallery default sort is category-banded alphabetical; no usage tracking in this set.
- Hot-reload uses `watchdog` gated by a dev env flag; keep-last-good on reload parse failure; `/api/skills/health` (or similar) surfaces the parse error.
- Submit button uses the `bg-accent` / `text-bg-0` token pairing per BRANDING.md.
</specifics>

<code_context>
## Existing Code Insights
- CONTRACT.json's `adopts_wireframe_primitives` behavioral clause already enforces the no-new-primitives rule; wave plans should cite the specific primitive per usage.
- `skill_runner.build_prompt(skill_name, sanitized_args) -> str` from `agent-runtime-foundation` is the downstream consumer \u2014 sanitized args shape must match.
- `POST /api/agents/runs {project_id, skill_name, skill_args} -> {run_id}` is the dispatch entry point; launcher hits it after Submit's server-side precondition check passes.
- The `wireframe-rollout` set (already merged) introduced the primitives under `web/frontend/src/components/primitives/`; `StructuredQuestion`, `PageHeader`, `SearchInput`, `ErrorCard`, `StatCard` are the authoritative references.
- ~30 SKILL.md files live under `skills/` with existing prose `## ARGUMENTS` sections; hand-authoring should preserve intent while translating to the typed `args:` shape.
- Existing SET-OVERVIEW.md wave breakdown (4 waves: frontmatter+catalog foundation, backend endpoints+sanitization, frontend components, integration+polish) remains valid under these decisions with one adjustment: the CONTRACT.json revision for `sanitized_args_contract` fits into Wave 2.
</code_context>

<deferred>
## Deferred Ideas
- Recent-use / usage-tracking sort for the gallery (needs usage store; future polish milestone).
- Full-state-introspection preconditions (DAG readiness, wave completeness) as an alternative to the current shallow-gates decision.
- In-set CONTRACT.json revision to drop the set-ref metacharacter-rejection clause (flagged for plan-set, not truly deferred).
- Two-axis gallery taxonomy if the 3-category flat system becomes insufficient as the catalog grows.
- Multi-step launcher wizard for future skills whose args benefit from staged collection.
</deferred>
