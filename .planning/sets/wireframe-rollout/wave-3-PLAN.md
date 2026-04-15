# PLAN: wireframe-rollout / Wave 3 — Downstream Contract Rewrites

**Set:** wireframe-rollout
**Wave:** 3 of 3
**Status:** pending (blocked on Wave 1; independent of Wave 2 completion though scheduled after it)
**Set worktree path:** `.rapid-worktrees/wireframe-rollout/`

## Objective

Propagate the redesign through the planning substrate. Rewrite three pending downstream `CONTRACT.json` files (`skill-invocation-ui`, `kanban-autopilot`, `agents-chats-tabs`) editorially, grounded in specific wireframe artifacts. Handle `web-tool-bridge` specially (it is already `merged`). Apply targeted `DEFINITION.md` edits where UI scope materially shifted.

Why: the real handoff from `wireframe-rollout` to the downstream sets is the rewritten contracts (CONTEXT.md decision "Contract Rewrite Approach" — editorial rewrite from scratch). This wave is pure planning-artifact edits — zero code.

## File Ownership (exclusive)

Wave 3 owns exclusively:

- `.planning/sets/skill-invocation-ui/CONTRACT.json`
- `.planning/sets/kanban-autopilot/CONTRACT.json`
- `.planning/sets/agents-chats-tabs/CONTRACT.json`
- `.planning/sets/web-tool-bridge/CONTRACT.json` — **scoped edits only, see Task 0**
- `.planning/sets/{skill-invocation-ui,kanban-autopilot,agents-chats-tabs,web-tool-bridge}/DEFINITION.md` — **targeted edits only where UI scope materially shifted**

Wave 3 must NOT touch:

- `web/frontend/**` (Wave 1 + Wave 2 territory)
- `.planning/sets/DAG.json` (per CONTEXT decision "DAG Edge Management": this set does NOT inject deps into downstream DAG entries)
- `.planning/STATE.json` (transitions go through the CLI)
- `.planning/sets/wireframe-rollout/**` (self — read-only during execution)
- `.planning/branding/**` (source of truth, read-only)

## Task 0 — Pre-flight status check + web-tool-bridge decision

Before editing any downstream contract, run the CLI status check:

```
node "${RAPID_TOOLS}" state get set web-tool-bridge
node "${RAPID_TOOLS}" state get set skill-invocation-ui
node "${RAPID_TOOLS}" state get set kanban-autopilot
node "${RAPID_TOOLS}" state get set agents-chats-tabs
```

Expected per research: `web-tool-bridge=merged`, others `pending`. For any `pending` downstream set, proceed with full editorial rewrite per Tasks 1–3. For each set whose status is **not** `pending` (i.e., `discussed`, `planned`, `executed`, `complete`, or `merged`), emit the warning below into the Wave 3 commit message AND append a note block at the top of that set's rewritten `CONTRACT.json`'s `behavioral` section:

```
WARNING: <setId> was <status> when wireframe-rollout's CONTRACT.json rewrite landed.
Manual action required: run /rapid:discuss-set <setId> and /rapid:plan-set <setId>
to re-plan against the redesigned surface. If the set's code has already shipped,
the rewrite documents the redesigned surface that the post-merge polish set will
adopt; do NOT expect this contract to match what is currently live.
```

### Web-tool-bridge special handling

`web-tool-bridge` is `merged`. Its exports are mostly backend (tools, endpoints, models). The only UI-facing export is `ask_user_modal_component`.

**Decision (per CONTEXT + SET-OVERVIEW risk mitigation):** scope the `web-tool-bridge` rewrite to the single UI-facing export. Specifically:

1. Preserve every backend export **verbatim**: `webui_ask_user_tool`, `ask_free_text_tool`, `ask_user_built_in_interception`, `agent_prompts_model`, `answer_endpoint`, `pending_prompt_endpoint`, `reopen_prompt_endpoint`, `skill_prose_patches`. Do NOT reword their signatures or descriptions.
2. Rewrite `ask_user_modal_component` only, to reference the new chat-surface primitives (`StructuredQuestion`, `ErrorCard`, `Composer`) from `components/primitives/` introduced by Wave 1.
3. Preserve every `imports.*` entry verbatim. Preserve every `behavioral.*` entry verbatim.
4. Add the WARNING block inside `behavioral.redesign_note` (new key) containing the warning text above.

Rationale: CONTEXT "Downstream Replan Handling" says the rewrite proceeds but emits a warning. CONTEXT also says "Per-export judgement. Preserve a name when the wireframe implies the same surface" — all backend names are preserved; only the UI component gets the redesign citation.

## Task 1 — Rewrite `skill-invocation-ui/CONTRACT.json`

**Edit in full:** `.planning/sets/skill-invocation-ui/CONTRACT.json`.

Editorial rewrite grounded in the wireframe. Each export entry's `description` must cite the specific wireframe artifact and section that justifies its shape. Preserve export NAMES where the wireframe implies the same surface (most will preserve).

### Required export names and rewrite guidance

| Export name | Preserve? | Rewrite guidance |
|-------------|-----------|------------------|
| `skill_args_frontmatter_schema` | **preserve name + signature verbatim** | Backend/data shape — untouched by redesign. Description can stay identical. |
| `skill_catalog_service` | **preserve name + signature verbatim** | Backend — untouched. |
| `skills_catalog_endpoint` | **preserve name + signature verbatim** | Backend — untouched. |
| `skill_launcher_component` | **preserve name**; rewrite signature + description | New signature cites Wave 1 primitives: `<SkillLauncher skillName=string />` composed from `StructuredQuestion` (for choice args), `Composer`-pattern textarea (for multi-line), `SearchInput` (for set-ref pickers), `PageHeader` for modal header. Submit button primary `bg-accent text-bg-0`. Description cites `components.html` form patterns + BRANDING.md `<chat-surface>` "Structured-question form" for choice/radio layout. |
| `skill_gallery_page` | **rename → `skill_gallery_component`** and reshape | The redesign does NOT make the skill gallery a standalone page — CONTEXT says gallery is composed inside AgentsPage's "Launch New Run" tab. So the export becomes a component, not a page. Signature: `<SkillGallery skills={SkillMeta[]} filters={GalleryFilters} onPick={(skill) => void} />`. Description cites: wireframe.html section 01 stat-card grid (4-up `StatCard` layout reused for skill cards) + CONTEXT "Cross-Page Shared Patterns" for `PageHeader` at top of gallery modal + BRANDING.md `<interaction-patterns>` keyboard-first (arrow-key navigation inside gallery). Includes a rename-note field: `"_redesign_rename": "was skill_gallery_page; gallery is now a component consumed by AgentsPage"`. |
| `sanitized_args_contract` | **preserve verbatim** | Security surface — untouched. |
| `precondition_check_endpoint` | **preserve name + signature**; description can note "launcher disables Submit and renders blockers via ErrorCard primitive from wireframe-rollout Wave 1 primitives" | Backend endpoint unchanged; UI rendering of blockers changes. |

### Add new exports (none required)

The wireframe does not introduce a new skill-invocation surface beyond the existing gallery + launcher. Do NOT invent new exports.

### Rewrite `imports` and `behavioral`

Preserve `imports` entirely (no fromSet change — still depends on `agent-runtime-foundation`).

Preserve `behavioral` entirely. Add one new behavioral entry:

```
"adopts_wireframe_primitives": {
  "description": "SkillLauncher and SkillGallery compose components from web/frontend/src/components/primitives/ introduced by the wireframe-rollout set (StructuredQuestion, PageHeader, StatCard, SearchInput, ErrorCard). This set does not introduce new primitives; it consumes them.",
  "enforced_by": "review"
}
```

### Citations required inside each rewritten export's description

- `skill_launcher_component` cites: `BRANDING.md §chat-surface (Structured-question form)` + `.planning/branding/components.html` form sections.
- `skill_gallery_component` cites: `.planning/branding/wireframe.html §01 metric-card grid (lines 307–325)` for card-grid layout + `.planning/branding/wireframe.html §04 command palette (lines 1201–1226)` for search+filter interaction model.
- `precondition_check_endpoint` description cites: `BRANDING.md §chat-surface (Error card)` for blocker rendering.

Finally: update `"version"` from `"1.0.0"` to `"1.1.0"` to signal the redesign-grounded rewrite.

Verification:
```
node -e 'JSON.parse(require("fs").readFileSync(".planning/sets/skill-invocation-ui/CONTRACT.json","utf8"))'
```
Must exit 0 (valid JSON). All preserved export names must still appear. The renamed export must appear under the new name with `_redesign_rename` metadata.

## Task 2 — Rewrite `kanban-autopilot/CONTRACT.json`

**Edit in full:** `.planning/sets/kanban-autopilot/CONTRACT.json`.

### Required export names and rewrite guidance

| Export name | Preserve? | Rewrite guidance |
|-------------|-----------|------------------|
| `kanban_v2_schema` | **preserve verbatim** | Schema — untouched by redesign. |
| `kanban_tools` | **preserve verbatim** | Backend @tools — untouched. |
| `kanban_service_extensions` | **preserve verbatim** | Service layer — untouched. |
| `autopilot_skill` | **preserve verbatim** | Skill definition — untouched. |
| `autopilot_worker` | **preserve verbatim** | Backend worker — untouched. |
| `card_to_skill_routing` | **preserve verbatim** | Routing logic — untouched. |
| `retry_and_blocked_policy` | **preserve verbatim** | Runtime policy — untouched. |
| `commit_trailer_traceability` | **preserve verbatim** | Git trailer pattern — untouched. |
| `ui_agent_badges` | **preserve name; rewrite signature + description** | New signature: `<KanbanCard />` composes `SurfaceCard` (from primitives) + `StatusBadge` instances per agent state. Badge labels: "Agent claimed" (`tone="info"`), "Agent created" (`tone="highlight"`), "Agent completed" (`tone="accent"`), "Blocked" (`tone="error"` when in Blocked column). Per-card action buttons use the primary `bg-accent` style. Description cites `.planning/branding/wireframe.html §03 Kanban (lines 983–1080)` for column layout + `BRANDING.md §component-style (Badges)` for badge shape. |

### Add new export

Add `kanban_column_surface`:

```
"kanban_column_surface": {
  "type": "file",
  "signature": "<KanbanColumn /> composed from SurfaceCard elevation=1 + column header (mono uppercase muted text) + card stack",
  "description": "Column visual shape, extracted because wireframe-rollout standardizes surfaces. Cites wireframe.html section 03 column header pattern (lines ~990–1020) and BRANDING.md component-style Elevation via surface tokens. Consumed by the kanban page in the shell and by any embedded kanban views."
}
```

### Imports and behavioral

Preserve `imports` verbatim.

Preserve `behavioral` verbatim. Add:

```
"adopts_wireframe_primitives": {
  "description": "Agent-badged kanban cards compose primitives (SurfaceCard, StatusBadge) from wireframe-rollout Wave 1. No new primitives introduced here.",
  "enforced_by": "review"
}
```

Update version to `"1.1.0"`.

Citations required: `ui_agent_badges` cites `wireframe.html §03 (lines 983–1080)` and `BRANDING.md §component-style (Badges)`. `kanban_column_surface` cites `wireframe.html §03` and `BRANDING.md §component-style (Surface hierarchy)`.

Verification: same JSON-parse sanity check as Task 1.

## Task 3 — Rewrite `agents-chats-tabs/CONTRACT.json`

**Edit in full:** `.planning/sets/agents-chats-tabs/CONTRACT.json`.

This is the heaviest rewrite — the wireframe + chatbot-wireframe artifacts reshape most of these surfaces. Cite aggressively.

### Critical pre-fix: the `gh` / `gc` shortcut collision

The current contract encodes `ga=/agents` but also `gh=/chats` (via `sidebar_nav_extension.signature`). CONTEXT authoritative map is `gc=/chats` (and `gh=/graph`). **Rewrite `sidebar_nav_extension` to use `ga=/agents` and `gc=/chats`**. Explicit call-out inside the description: "Previous contract bound `gh=/chats`; this rewrite reconciles to CONTEXT authoritative map `gc=/chats` (matching wireframe-rollout Wave 2's `types/layout.ts` grouping)."

### Required export names and rewrite guidance

| Export name | Preserve? | Rewrite guidance |
|-------------|-----------|------------------|
| `agents_routes` | **preserve verbatim (shortcut fix)** | Adjust shortcut reference from `gh` to `gc`. Note that Wave 2 of wireframe-rollout already creates placeholder `/agents` and `/chats` routes — this set replaces the placeholders with real content. |
| `sidebar_nav_extension` | **rewrite** | Agents and Chats are in the **Execution** nav group (per CONTEXT + Wave 2 `NAV_GROUPS`), not "Driver/Observer" as the old contract said. New signature: `NAV_GROUPS[Execution].items += [{ id: 'agents', label: 'Agents', path: '/agents', shortcut: 'ga' }, { id: 'chats', label: 'Chats', path: '/chats', shortcut: 'gc' }]`. Note: wireframe-rollout Wave 2 already inserts these items as stubs; this set adjusts icons and wires real destination behavior (agents list + chat list pages). |
| `agents_page` | **preserve name; rewrite signature** | Compose `PageHeader` (title "Agents", action slot with `SearchInput` + "Launch New Run" button), `DataTable` for runs list (columns: status `StatusBadge`, skill name mono, duration mono, set ref mono, cost mono), `StatCard` grid above the table for "Running", "Waiting", "Failed", "Completed" counts. Empty state via `EmptyState` primitive with onboarding text. Cites `.planning/branding/wireframe.html §01 (lines 640–785)` for stat-card + activity-feed pattern. |
| `agent_run_page` | **preserve name; rewrite signature** | Composes `PageHeader` (title: run ID, description: skill name, action: pause/stop buttons), `StatusBadge` pill (RUNNING/WAITING/FAILED/COMPLETED per WCAG 1.4.1 color+label), live activity feed as stacked `ToolCallCard`s, telemetry panel in `SurfaceCard` with `DataTable` (token/cost/duration rows). **NO composer** (enforced by existing behavioral). Cites `.planning/branding/chatbot-wireframe.html` tool-call section + `BRANDING.md §chat-surface (Tool-call cards)`. |
| `chats_page` | **preserve name; rewrite signature** | Composes `PageHeader` (title "Chats", action: "New Chat" button opening `SkillGallery` filtered to interactive skills), `DataTable` for threads (columns: title, skill mono, last message timestamp mono, status `StatusBadge`). Empty state per CONTEXT. Cites `wireframe.html §01` pattern. |
| `chat_thread_page` | **preserve name; rewrite signature** | Persistent bottom `Composer` primitive (from Wave 1); message list scrollable above; inline `ToolCallCard`s for tool uses; inline `StructuredQuestion` primitive for `can_use_tool` prompts; `ErrorCard` primitive for errors; `AutoScrollPill` for opt-out; `StreamingCursor` on the active assistant message; `SlashAutocomplete` above composer on `/`. Cites `.planning/branding/chatbot-wireframe.html` entire file + `BRANDING.md §chat-surface` all subsections. |
| `use_agent_events_hook` | **preserve verbatim** | Hook signature unchanged. |
| `use_chats_hook` | **preserve verbatim** | Hook signature unchanged. |
| `chat_schema` | **preserve verbatim** | SQLModel — untouched. |
| `chat_service` | **preserve verbatim** | Backend service — untouched. |
| `chats_http` | **preserve verbatim** | Endpoints — untouched. |
| `consolidated_dashboard_endpoint` | **preserve verbatim** | Endpoint shape unchanged. Description can add a note: "Wave 2 of wireframe-rollout wires dashboard stat cards to stub values with a TODO to consume this endpoint once this set ships; this set fulfills those TODOs." |
| `vite_sse_proxy_config` | **preserve verbatim** | Infra — untouched. |
| `accessibility_primitives` | **rename → `accessibility_hooks`** and rewrite | The redesign absorbs primitive-scoped a11y hooks (`usePrefersReducedMotion`, `useAutoScrollWithOptOut`) into `components/primitives/hooks/` during Wave 1. This set's a11y surface reduces to: `<LiveRegion aria-live='polite'>`, `useFocusTrap` hook (specific to modals, not covered by wireframe primitives). Add `_redesign_rename` metadata field. Cite BRANDING.md `<anti-patterns>` (reduced-motion respect) + `<chat-surface>` (auto-scroll pill). |
| `empty_state_onboarding` | **preserve name; rewrite signature** | New signature: `<AgentsEmptyState />` and `<ChatsEmptyState />` both compose the `EmptyState` primitive from Wave 1 with 3-action lists. Cites CONTEXT "Cross-Page Shared Patterns". |

### Add new import

Because this set now consumes Wave 1 primitives directly (not just styles), add an explicit import entry:

```
"wireframe_primitives": {
  "fromSet": "wireframe-rollout",
  "type": "file",
  "signature": "components exported from web/frontend/src/components/primitives/index.ts",
  "description": "All page/component exports above compose primitives from wireframe-rollout Wave 1: PageHeader, EmptyState, StatCard, DataTable, StatusBadge, StatusDot, HealthDot, SurfaceCard, ToolCallCard, StructuredQuestion, ErrorCard, Composer, SlashAutocomplete, AutoScrollPill, StreamingCursor, Kbd, SearchInput."
}
```

Also append to `imports.fromSets` a new `{"set": "wireframe-rollout"}` entry. Per CONTEXT "DAG Edge Management", the downstream set declares its own wireframe dep — this contract rewrite encodes that intent so it is picked up on the next `/rapid:plan-set`.

### Behavioral

Preserve every existing behavioral entry verbatim. Add:

```
"adopts_wireframe_primitives": {
  "description": "All chat-surface and list-surface components in this set compose primitives from wireframe-rollout (components/primitives/). This set does NOT ship new primitives; new composition or new primitive needs must be raised as wireframe-rollout follow-up, not added here.",
  "enforced_by": "review"
},
"sidebar_shortcut_map_matches_context": {
  "description": "Sidebar nav shortcuts for Agents and Chats are ga and gc respectively, matching wireframe-rollout CONTEXT authoritative map. The previous contract encoded gh=/chats which collided with gh=/graph; this rewrite reconciles.",
  "enforced_by": "review"
}
```

Update version to `"1.1.0"`.

Verification: JSON-parse check; grep for `"gh"` in the file — must NOT appear as a shortcut value for `/chats` (it still may appear in descriptions explaining the reconciliation).

## Task 4 — Scoped edit of `web-tool-bridge/CONTRACT.json`

Per Task 0 decision. **Only edit the `ask_user_modal_component` export and add one `behavioral.redesign_note` entry.**

Rewrite `ask_user_modal_component`:

```
"ask_user_modal_component": {
  "type": "file",
  "signature": "<AskUserModal prompt={Prompt} onSubmit />",
  "description": "React component rendering structured questions. After wireframe-rollout, AskUserModal composes the StructuredQuestion primitive from components/primitives (multi-choice/radio), the Composer-pattern textarea from primitives (free-form), and ErrorCard (for validation blockers). Retains sessionStorage-backed draft persistence across tab close. Cites .planning/branding/chatbot-wireframe.html (Structured-question section) and BRANDING.md §chat-surface (Structured-question form)."
}
```

Add the behavioral note:

```
"redesign_note": {
  "description": "WARNING: web-tool-bridge was merged when wireframe-rollout's CONTRACT.json rewrite landed. The ask_user_modal_component export has been updated editorially to document the redesigned composition using Wave 1 primitives; the live merged code may not yet match. Manual action required: either open a polish set that refactors AskUserModal to adopt the primitives, OR run /rapid:discuss-set web-tool-bridge and /rapid:plan-set web-tool-bridge to re-plan the full set against this contract. Every other export in this file is preserved verbatim from the merged implementation.",
  "enforced_by": "review"
}
```

Do NOT touch any other key. Do NOT bump `version`.

Verification: JSON-parse; `git diff` against `main` for this file shows only the two blocks above as changes (one export rewrite + one new behavioral key).

## Task 5 — Targeted DEFINITION.md edits

For each downstream set, read its `DEFINITION.md`. Compare its "Files and Areas" / "Key Deliverables" sections against the rewritten CONTRACT. Edit only where UI scope materially shifted:

### `.planning/sets/agents-chats-tabs/DEFINITION.md`
- Likely edits: add a "Dependencies" line citing `wireframe-rollout`; add to "Files and Areas" a note that pages compose primitives from `web/frontend/src/components/primitives/`; adjust the sidebar shortcut reference in-file from `gh` to `gc` if the old binding appears.

### `.planning/sets/skill-invocation-ui/DEFINITION.md`
- Likely edits: add `wireframe-rollout` dependency; note that `skill_gallery_page` is now `skill_gallery_component` consumed inside AgentsPage's "Launch New Run" tab (no standalone page).

### `.planning/sets/kanban-autopilot/DEFINITION.md`
- Likely edits: add `wireframe-rollout` dependency; note that `ui_agent_badges` composes primitives rather than introducing new styles.

### `.planning/sets/web-tool-bridge/DEFINITION.md`
- If this file exists, add a one-paragraph NOTE at the bottom citing the `redesign_note` in the contract. Do NOT rewrite the set's scope or deliverables. If the file does not mention the merged status, leave structural sections untouched.

**Rule of restraint:** the bar for editing DEFINITION.md is "UI scope materially shifted". If an export's UI composition changed but the set's overall deliverable list is unchanged, do NOT edit DEFINITION.md for that set. The CONTRACT.json is the authoritative redesign record; DEFINITION.md is only updated where a human reading it would otherwise be misled about what the set does.

Verification: `git diff --stat main -- .planning/sets/*/DEFINITION.md` — the diff should be small (a few lines per file, not a wholesale rewrite). If a DEFINITION.md diff exceeds 40 lines, the edit is too aggressive — revert and reduce.

## Acceptance (Wave 3 Success Criteria)

1. All four `CONTRACT.json` files parse as valid JSON (`node -e 'JSON.parse(require("fs").readFileSync(path))'` exits 0 for each).
2. `skill-invocation-ui` and `kanban-autopilot` CONTRACT.json have `version: "1.1.0"`.
3. `agents-chats-tabs` CONTRACT.json has `version: "1.1.0"`, has an `imports.fromSets` entry for `wireframe-rollout`, has an `imports.wireframe_primitives` record, and contains NO `gh` binding for `/chats`.
4. `web-tool-bridge` CONTRACT.json has its `ask_user_modal_component` description mentioning `StructuredQuestion` primitive AND has a `behavioral.redesign_note` key. Every other top-level key is byte-identical to `main` (verify with `git diff main -- .planning/sets/web-tool-bridge/CONTRACT.json` — diff must be <30 lines).
5. Every rewritten export's `description` contains at least one citation referencing `.planning/branding/wireframe.html` / `.planning/branding/chatbot-wireframe.html` / `.planning/branding/components.html` / `.planning/branding/guidelines.html` / `BRANDING.md §<section>`.
6. Renamed exports (`skill_gallery_page → skill_gallery_component`, `accessibility_primitives → accessibility_hooks`) carry a `_redesign_rename` string metadata field explaining the rename.
7. All backend-facing exports in all four contracts are byte-identical to their prior signatures (use `jq` or manual grep to verify: `jq '.exports.kanban_v2_schema.signature' <file>` before/after equals).
8. DEFINITION.md edits are minimal — each file's diff against `main` is <40 lines.
9. `.planning/sets/DAG.json` is **unchanged** per CONTEXT "DAG Edge Management". Verify with `git diff main -- .planning/sets/DAG.json` → empty.
10. Warning log for `web-tool-bridge` appears in the commit message of Task 4's commit.

## Commit Plan

- `refactor(wireframe-rollout): rewrite skill-invocation-ui contract grounded in wireframe` (Task 1)
- `refactor(wireframe-rollout): rewrite kanban-autopilot contract grounded in wireframe` (Task 2)
- `refactor(wireframe-rollout): rewrite agents-chats-tabs contract and reconcile shortcut map` (Task 3)
- `refactor(wireframe-rollout): scoped ask_user_modal_component rewrite on web-tool-bridge contract

WARNING: web-tool-bridge is already merged. The scoped rewrite documents the redesigned AskUserModal composition. A manual polish follow-up or full re-plan (/rapid:discuss-set + /rapid:plan-set) may be required to bring the live code into alignment with this contract.` (Task 4)
- `docs(wireframe-rollout): targeted DEFINITION.md updates for downstream sets` (Task 5)

## Notes for Executor

- **Do not edit code.** Wave 3 is planning-artifact only. If you find yourself wanting to open a `.tsx` file, stop — that belongs in Wave 2 and should have shipped already.
- **Preserve backend export signatures verbatim.** Copy-paste from the current file; do not reword. The redesign governs UI surfaces only.
- **Cite aggressively.** Every rewritten UI export description names a specific wireframe artifact + section/lines. Reviewers audit by chasing citations.
- **Do not rename exports unless the wireframe clearly reshapes them.** Two renames are sanctioned above: `skill_gallery_page → skill_gallery_component`, `accessibility_primitives → accessibility_hooks`. Do not rename anything else.
- **Do not add exports the wireframe does not require.** Only `kanban_column_surface` is sanctioned as new (kanban-autopilot Task 2). Resist the urge to add speculative primitives or UI helpers; those belong in `wireframe-rollout` Wave 1, not in downstream contracts.
- **Warning emission for `web-tool-bridge` is a hard requirement.** It must land in (a) the Task 4 commit message body, and (b) the `behavioral.redesign_note` field in the contract. Both. Missing either fails Wave 3 acceptance.
- If a downstream set's status is discovered to be beyond `pending` during Task 0's check (other than `web-tool-bridge`, which is already known), apply the same warning treatment as `web-tool-bridge` for that set: scope the rewrite to UI-facing exports, preserve backend verbatim, add a `behavioral.redesign_note`, and include the warning in the commit message body.
