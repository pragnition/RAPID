# VERIFICATION-REPORT: wireframe-rollout

**Set:** wireframe-rollout
**Waves verified:** wave-1, wave-2, wave-3
**Verified:** 2026-04-15
**Verdict:** PASS_WITH_GAPS

## Coverage

| Requirement (from CONTEXT + instructions) | Covered By | Status | Notes |
|-------------------------------------------|------------|--------|-------|
| In-place rewrite of `web/frontend/**` | Wave 2 (Tasks 1–8) | PASS | Migration Strategy explicitly in-place; Wave 2 forbids parallel v2 surface. |
| Fully restyle all 11 existing pages | Wave 2 Task 8 | PASS | Each of 11 pages has an explicit directive block. |
| Tailwind v4 `@theme inline` tokens in `global.css` | Wave 1 (Tokens Pre-Audit + Task 8) | PASS | No `tailwind.config.js` referenced; additions-only to `@theme inline`. |
| `--th-*` vars in 8 theme files | Wave 1 Task 8 | PASS | All 8 theme files named explicitly; additions only. |
| NEW `components/primitives/` dir sibling to `ui/` | Wave 1 Task 1 | PASS | Task 1 scaffolds the barrel. |
| Wave 1 eager primitives | Wave 1 Tasks 2–7 | PASS | 23 primitives + 2 hooks enumerated in Acceptance #4. |
| Wave 2 shell + pages consume Wave 1 | Wave 2 Tasks 2–8 + Prerequisite block | PASS | Wave 2 has explicit prerequisite check for barrel + export count. |
| Wave 3 contract rewrites | Wave 3 Tasks 1–4 | PASS | Four downstream CONTRACT.json files targeted. |
| Shortcut map `gd,gp,gh,gk,gw,gs,ga,gc` authoritative | Wave 2 Task 1 (NAV_GROUPS) + Task 4 (bindings) | PASS | Verbatim match to CONTEXT authoritative map; `gh=/graph`, `gc=/chats`. |
| Nav groups: Workspace / Execution / Library | Wave 2 Task 1 + Task 2 | PASS | Exact group names in NAV_GROUPS; sidebar renders NavGroup primitive. |
| Stub routes `/agents` and `/chats` | Wave 2 Tasks 6 + 7 | PASS | Router edit + two new stub pages. |
| Theme picker primitive + header wiring | Wave 1 Task 6 + Wave 2 Task 3 | PASS | Presentational primitive in Wave 1, wired to `useTheme` in Wave 2. |
| ⌘K command palette (primary) + `/` (alternate) | Wave 2 Task 4 + Task 5 | PASS | Alternate retained per R3; primary binding added. |
| Primitives directory location | Wave 1 ownership block | PASS | `web/frontend/src/components/primitives/**`. |
| Downstream warning for web-tool-bridge (merged) | Wave 3 Task 0 + Task 4 | PASS | Explicit warning in commit body AND `behavioral.redesign_note`. |
| DAG edges NOT injected into downstream DAG | Wave 3 ownership block + Acceptance #9 | PASS | `.planning/sets/DAG.json` forbidden from edit. |
| R4 NoteEditor path preserved | Wave 2 Task 8 (NoteEditor block) | PASS | "Do NOT rename or move `NoteEditor.tsx`" called out. |
| R2 shortcut conflicts resolved | Wave 2 Task 4 conflict table | PASS | `gk→/kanban`, `gh→/graph`, `gc→/chats` — all reassignments enumerated. |
| R3 `⌘K` + `/` alternate | Wave 2 Task 4 + Acceptance #4 | PASS | Both bindings preserved. |
| R5 token additions-only | Wave 1 ownership block + Task 0 + Acceptance #6 | PASS | Enforced by "additions only" and `git diff` check. |
| R11 geometry atomicity | Wave 2 Geometry Reconciliation + Task 9 | PASS | Explicit atomic commit requirement. |
| R12 `rapid-sidebar` key preserved | Wave 2 Task 2.7 + ownership block | PASS | "Do not touch `useLayoutStore`". |
| R14 no tests — typecheck+build only | Wave 2 Task 8 directive | PASS | "Behavior tests (there are none — risk R14) do not gate". |
| R1 web-tool-bridge already merged | Wave 3 Task 0 + Task 4 | PASS | Scope-limited to `ask_user_modal_component` + warning. |
| R9 Tailwind arbitrary values over new tokens | Wave 1 Task 0 + Task 3 (SurfaceCard) | PASS | `border-l-[3px]` pattern + audit bias toward no new tokens. |
| R10 three sidebar states preserved | Wave 2 Task 2.7 | PASS | full/compact/hidden explicitly retained. |
| R6 router root not mutated | Wave 2 Task 6 | PASS | "Do NOT alter the `<AppLayout />` root or existing routes". |
| DEFINITION.md edits for downstream sets | Wave 3 Task 5 | **GAP** | Only `wireframe-rollout` has a DEFINITION.md on disk; the three pending downstream sets have NO DEFINITION.md. Task 5 does not acknowledge this and directs edits to files that don't exist. See Implementability + Edits Made. |
| `consolidated_dashboard_endpoint` wired from Dashboard stat cards | Wave 2 Task 8 Dashboard + Wave 3 Task 3 | PASS | Dashboard uses TODO stubs; `agents-chats-tabs` CONTRACT description updated to say this set fulfills the TODOs. |
| Chat-surface primitives for downstream consumption | Wave 1 Task 5 | PASS | 7 chat-surface primitives enumerated. |
| A11y hooks (reduced motion, auto-scroll pill opt-out) | Wave 1 Task 7 | PASS | Both hooks specified in `components/primitives/hooks/`. |
| `CommandPalette` extension to sets + pages + commands | Wave 2 Task 5 | PASS | Three entry-type icons (`#`, `@`, `>`) per wireframe. |
| `KeyBinding` Meta-vs-Ctrl uncertainty | Wave 2 Task 4 note | **GAP** | Verified: `web/frontend/src/types/keyboard.ts` has `ctrl/shift/alt` fields only — no `meta`. Wave 2 already flags this and says "Verify by reading `types/keyboard.ts` and `KeyboardContext.tsx` before committing"; executor may need to extend the interface (a layout-type file in Wave 2 ownership). Not a blocker, but worth surfacing. |

## Implementability

### Wave 1 — files to create (all under NEW directory)

| File | Wave | Action | Status | Notes |
|------|------|--------|--------|-------|
| `web/frontend/src/components/primitives/index.ts` | 1 | Create | PASS | Directory does not exist; no collision. |
| `web/frontend/src/components/primitives/StatusDot.tsx` + 5 more atoms | 1 | Create | PASS | |
| `web/frontend/src/components/primitives/SurfaceCard.tsx` + 4 more surfaces | 1 | Create | PASS | |
| `web/frontend/src/components/primitives/DataTable.tsx`, `SearchInput.tsx` | 1 | Create | PASS | |
| 7 chat-surface primitives | 1 | Create | PASS | |
| `ThemePicker.tsx` | 1 | Create | PASS | |
| `hooks/usePrefersReducedMotion.ts`, `hooks/useAutoScrollWithOptOut.ts` | 1 | Create | PASS | Co-located under primitives per plan. |
| `README.md` for primitives | 1 | Create | PASS | |

### Wave 1 — files to modify

| File | Wave | Action | Status | Notes |
|------|------|--------|--------|-------|
| `web/frontend/src/styles/global.css` | 1 | Modify (additions-only) | PASS | File exists. |
| `web/frontend/src/styles/themes/*.css` (8 files) | 1 | Modify (additions-only, conditional on Task 0) | PASS | All 8 exist. |

### Wave 2 — files to modify

| File | Wave | Action | Status | Notes |
|------|------|--------|--------|-------|
| `web/frontend/src/types/layout.ts` | 2 | Modify | PASS | Exists. |
| `web/frontend/src/components/layout/Sidebar.tsx` | 2 | Modify | PASS | Exists. |
| `web/frontend/src/components/layout/Header.tsx` | 2 | Modify | PASS | Exists. |
| `web/frontend/src/components/layout/AppLayout.tsx` | 2 | Modify | PASS | Exists. |
| `web/frontend/src/components/ui/CommandPalette.tsx` | 2 | Modify | PASS | Exists; explicit carve-out from Wave 1 forbidden list. |
| `web/frontend/src/router.tsx` | 2 | Modify | PASS | Exists. |
| `web/frontend/src/App.tsx` | 2 | (Listed in ownership; not specifically edited in tasks) | PASS | Listed for ownership boundary; no direct edit mandated. |
| `web/frontend/src/types/command.ts` | 2 | Modify (conditional) | PASS | Exists; edit conditional on registry extension. |
| `web/frontend/src/pages/DashboardPage.tsx` + 10 existing pages | 2 | Modify | PASS | All 11 pages verified on disk. |
| `web/frontend/src/pages/AgentsPage.tsx` | 2 | Create | PASS | Does not exist. |
| `web/frontend/src/pages/ChatsPage.tsx` | 2 | Create | PASS | Does not exist. |
| `web/frontend/src/types/keyboard.ts` | 2 | Read-only / verify | **PASS_WITH_GAPS** | Wave 2 Task 4 "verify before committing" — confirmed interface lacks `meta` field. Executor may need to add it. Type file is NOT in Wave 2's exclusive ownership list but is implicitly in its scope since no other wave touches it; see Consistency. |

### Wave 3 — files to modify

| File | Wave | Action | Status | Notes |
|------|------|--------|--------|-------|
| `.planning/sets/skill-invocation-ui/CONTRACT.json` | 3 | Modify (full rewrite) | PASS | Exists. |
| `.planning/sets/kanban-autopilot/CONTRACT.json` | 3 | Modify (full rewrite) | PASS | Exists. |
| `.planning/sets/agents-chats-tabs/CONTRACT.json` | 3 | Modify (full rewrite) | PASS | Exists; current contract confirmed encoding `gh` for Chats as Wave 3 claims. |
| `.planning/sets/web-tool-bridge/CONTRACT.json` | 3 | Modify (scoped) | PASS | Exists. |
| `.planning/sets/agents-chats-tabs/DEFINITION.md` | 3 | Modify | **FAIL_SOFT** | File does NOT exist. Task 5 says "Likely edits:" but does not guard against absence. |
| `.planning/sets/skill-invocation-ui/DEFINITION.md` | 3 | Modify | **FAIL_SOFT** | File does NOT exist. |
| `.planning/sets/kanban-autopilot/DEFINITION.md` | 3 | Modify | **FAIL_SOFT** | File does NOT exist. |
| `.planning/sets/web-tool-bridge/DEFINITION.md` | 3 | Modify (conditional) | PASS | File does NOT exist, but Task 5 says "If this file exists" — correctly guarded. |

## Consistency

### Cross-wave file claims (ownership)

| File | Claimed By | Status | Resolution |
|------|------------|--------|------------|
| `web/frontend/src/components/primitives/**` | Wave 1 (exclusive) | PASS | Wave 2 explicitly forbidden from editing; consumes only. |
| `web/frontend/src/styles/**` | Wave 1 (exclusive) | PASS | Wave 2 explicitly forbidden; Wave 3 does not touch frontend. |
| `web/frontend/src/components/layout/**` | Wave 2 (exclusive) | PASS | Wave 1 ownership block forbids. |
| `web/frontend/src/components/ui/CommandPalette.tsx` | Wave 2 | PASS | Wave 1 forbids editing `components/ui/`; explicit carve-out in Wave 1 ownership ("CommandPalette.tsx, TooltipOverlay.tsx are Wave 2 territory"). |
| `web/frontend/src/pages/**` | Wave 2 (exclusive) | PASS | Wave 1 forbids; Wave 3 forbids. |
| `web/frontend/src/router.tsx`, `App.tsx`, `types/layout.ts` | Wave 2 | PASS | Wave 1 forbids. |
| `web/frontend/src/types/keyboard.ts` | **None explicitly** | **PASS_WITH_GAPS** | Wave 1 forbids touching frontend types not listed; Wave 2 does not list it in exclusive ownership. Since Wave 2 Task 4 may need to add a `meta` field to `KeyBinding`, Wave 2 should claim it. Treat as implicit Wave 2 ownership. |
| `web/frontend/src/hooks/useTheme.ts`, `useLayoutStore.ts` | Neither (read-only) | PASS | Both waves explicitly forbid editing (CONTEXT "ThemeProvider NO change needed" + R12). |
| `web/frontend/src/components/{editor,graph,kanban,prompts}/**` | Neither | PASS | Wave 2 explicitly wraps, does not refactor internals. |
| `.planning/sets/{skill-invocation-ui,kanban-autopilot,agents-chats-tabs,web-tool-bridge}/CONTRACT.json` | Wave 3 (exclusive) | PASS | Waves 1/2 do not touch `.planning/`. |
| `.planning/sets/*/DEFINITION.md` | Wave 3 (conditional) | PASS_WITH_GAPS | Files don't exist for 3 of 4 sets; non-blocking since Task 5 can be no-op for those. |
| `.planning/sets/DAG.json` | Neither (forbidden) | PASS | CONTEXT decision "DAG Edge Management" enforced. |
| `.planning/sets/wireframe-rollout/**` | Neither (read-only during execution) | PASS | Wave 3 explicitly forbids self-edit. |

No cross-wave file claim conflicts detected. No two waves claim Create on the same file. No two waves claim Modify on the same file.

## Cross-Job Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Wave 2 consumes Wave 1 primitives (`@/components/primitives`) | PASS | Wave 2 has explicit Prerequisite block with barrel existence + export-count probe; emits BLOCKED if missing. Correct. |
| Wave 3 is independent of Wave 2 code changes | PASS | Wave 3 is planning-artifact only; cites Wave 1 primitives by name for traceability but does not depend on Wave 2's page rewrites having shipped. Wave 3's Status header correctly says "blocked on Wave 1; independent of Wave 2 completion". |
| Dashboard stat cards stubbed with TODO to consume `consolidated_dashboard_endpoint` | PASS | Wave 2 Task 8 Dashboard + Wave 3 Task 3 agents-chats-tabs contract description explicitly links the two. |
| CommandPalette set-jump registration depends on sets API | PASS_WITH_GAPS | Wave 2 Task 5.3 correctly handles missing API with a `// TODO` skip — explicit degradation path documented. |
| Wave 2 ⌘K binding depends on `KeyBinding` interface supporting Meta | PASS_WITH_GAPS | `types/keyboard.ts` inspected: no `meta` field currently. Wave 2 Task 4 flags this as "Verify by reading `types/keyboard.ts` and `KeyboardContext.tsx` before committing" — executor will need to either (a) extend the interface (implicitly Wave 2 ownership) or (b) use `ctrl: true` (macOS translation behavior unverified). Recommend Wave 2 explicitly add `types/keyboard.ts` to its ownership list. |
| Wave 1 README.md listing barrel exports | PASS | Task 9 acceptance check; Wave 2 uses it as lookup reference. |

## Verification Commands

| Wave | Commands | Status | Notes |
|------|----------|--------|-------|
| Wave 1 | `npx tsc -b`, `npx vite build`, `git diff --stat main` scope check | PASS | Concrete, executable from `web/frontend/`. |
| Wave 2 | `npx tsc -b`, `npx vite build`, manual nav + keybind check, `git diff --stat main` scope check | PASS | Manual steps are concrete; acceptance enumerates every shortcut to verify. |
| Wave 3 | `node -e 'JSON.parse(...)'` per contract, `jq` preserved-signature checks, `git diff main -- .planning/sets/DAG.json` emptiness check | PASS | JSON-parse checks are concrete. |

## Success Criteria Measurability

| Wave | Measurable? | Notes |
|------|-------------|-------|
| Wave 1 | Yes | 7 explicit criteria; all checkable via CLI + `git diff`. |
| Wave 2 | Yes | 10 explicit criteria; mix of CLI and manual visual — acceptable per R14. |
| Wave 3 | Yes | 10 explicit criteria; all CLI-checkable (JSON-parse, jq, git diff). |

## Commit Plan Format

| Wave | Format | Status | Notes |
|------|--------|--------|-------|
| Wave 1 | `feat(wireframe-rollout): <subject>` + `docs(wireframe-rollout): ...` | PASS | 9 commits, conventional format + set prefix. |
| Wave 2 | `refactor(wireframe-rollout): ...` + `feat(wireframe-rollout): ...` | PASS | ~18 commits when Task 8 expanded; CONVENTIONS "one commit per task" honored. |
| Wave 3 | `refactor(wireframe-rollout): ...` + `docs(wireframe-rollout): ...` | PASS | 5 commits; web-tool-bridge commit body includes WARNING block. |

## Edits Made

No auto-fixes applied. The identified gaps are advisory (they inform the executor but do not justify mutating the plan files):

| File | Change | Reason |
|------|--------|--------|
| (none) | (none) | Gaps identified are either (a) flagged in the plan itself (Meta/Ctrl; DEFINITION.md restraint rule) or (b) easy no-ops at execute time (missing DEFINITION.md for 3 sets). No edit would materially improve the plan without risking scope change. |

## Gaps & Ambiguities (non-blocking)

1. **DEFINITION.md absence for 3 downstream sets.** `skill-invocation-ui`, `kanban-autopilot`, `agents-chats-tabs` have no `DEFINITION.md` on disk (only `CONTRACT.json`). Wave 3 Task 5 lists "Likely edits" for those files without a guard clause. **Recommended executor action:** treat Task 5 as no-op for any downstream set that lacks a DEFINITION.md; record that decision in the Task 5 commit body. This mirrors the guard pattern Task 5 already uses for `web-tool-bridge/DEFINITION.md` ("If this file exists").
2. **`KeyBinding` interface lacks a `meta` field.** Wave 2 Task 4 correctly flags uncertainty but does not add `types/keyboard.ts` to Wave 2's exclusive ownership list. **Recommended executor action:** if the interface must be extended to distinguish Meta from Ctrl, make that edit and note it as implicitly within Wave 2 scope (no other wave claims it). Alternatively, use `ctrl: true` and document the cross-platform behavior assumption.
3. **`App.tsx` listed in Wave 2 ownership but not touched by any task.** Non-blocking — ownership declaration is belt-and-suspenders; removing from the list at execute time is fine if no edit is needed.
4. **Wave 3 Task 5 DEFINITION.md diff <40 line limit.** The "40 lines" cap is a soft heuristic. For files that do exist but need broader updates than the cap allows (e.g. if `wireframe-rollout/DEFINITION.md` accumulates context), executor should raise CHECKPOINT rather than force-fit.
5. **`CommandPalette` set-jump API dependency.** The skip-with-TODO degradation path is sound, but no follow-up task is enqueued to revisit once `agents-chats-tabs` ships. **Recommended executor action:** add the TODO comment exactly as written; it is expected to be picked up by `agents-chats-tabs` during its own execution.

## Summary

All three wave plans are structurally sound, have clear objectives, concrete tasks with specific file paths, measurable acceptance criteria, and executable verification commands. File ownership is exclusive across waves with one minor implicit-ownership gap around `types/keyboard.ts` (which Wave 2 should claim if it needs to extend the `KeyBinding` interface). All 14 risks (R1–R14) are addressed in-plan. The only non-trivial gap is that `DEFINITION.md` does not exist for three of the four downstream sets Wave 3 targets in Task 5 — but the plan's "Rule of restraint" paragraph already gives the executor room to no-op that task per-set. Verdict is **PASS_WITH_GAPS**: execution can begin without further planning, with the gaps above recorded for the executor's situational awareness.
