# CONTEXT: ux-first-run

**Generated:** 2026-04-07 (auto-skip mode)
**Milestone:** v6.1.0

## Domain

This set implements 5 deferred first-run UX items from the v6.1.0 audit (`.planning/v6.1.0-UX-AUDIT.md`). All 5 items were graded "Deferred" during the ux-audit set because they required modifying SKILL.md files outside that set's ownership.

### Items in scope

| Audit Item | Description | Target File |
|-----------|-------------|-------------|
| 2.2 | Fuzzy command matching -- suggest closest valid command on unknown input | `src/bin/rapid-tools.cjs` |
| 2.3 | Status contextual next-step hints -- enrich next-action suggestions | `skills/status/SKILL.md` |
| 3.1 | Post-init workflow guide -- show lifecycle workflow after init completes | `skills/init/SKILL.md` |
| 3.2 | Status empty-state guidance -- show workflow guide when no sets started | `skills/status/SKILL.md` |
| 3.3 | Init-to-first-set bridge -- emerges from 3.1 + 3.2 working together | No dedicated file; satisfied by 3.1 and 3.2 |

### Boundaries

- This set modifies exactly 3 files: `skills/init/SKILL.md`, `skills/status/SKILL.md`, `src/bin/rapid-tools.cjs`.
- No new files are created.
- No CONTRACT.json exports/imports -- this set has no cross-set dependencies.
- No runtime library changes beyond the `default` case in `rapid-tools.cjs`.

---

## Decisions (Claude's Discretion)

All decisions below are made by Claude since this is an auto-skip context generation (no developer discussion).

### D1: Fuzzy matching algorithm (Item 2.2)

**Decision:** Use Levenshtein edit distance, implemented inline in `rapid-tools.cjs` with no external dependencies.

**Rationale:** The command list is small (28 commands). A simple Levenshtein function (10-20 lines) is sufficient. Adding a dependency like `fastest-levenshtein` is unnecessary for this scale. The implementation should live in the `default` case of the switch statement or as a local helper function within the same file.

**Behavior:** When an unknown command is entered, compute edit distance to all known commands. If the closest match has distance <= 3, suggest it: `Did you mean '{closest}'?`. If multiple commands tie, list all tied suggestions. If no command is close enough, show the standard USAGE output only.

### D2: Post-init workflow guide placement (Item 3.1)

**Decision:** Add a new Step 11.5 between the current Step 11 (Completion summary) and Step 12 (Footer) in `skills/init/SKILL.md`.

**Rationale:** The completion summary (Step 11) shows what was created. The footer (Step 12) shows the immediate next command. A workflow guide between them provides the "big picture" context the user needs to understand the full lifecycle. This avoids modifying existing steps.

**Content:** The workflow guide should display the RAPID lifecycle stages as a compact numbered list:
1. `/rapid:status` -- see your project dashboard
2. `/rapid:start-set N` -- initialize a set for development
3. `/rapid:discuss-set N` -- capture implementation vision
4. `/rapid:plan-set N` -- plan waves and tasks
5. `/rapid:execute-set N` -- implement the plan
6. `/rapid:review N` -- review before merge
7. `/rapid:merge N` -- merge into main

### D3: Empty-state guidance in status (Item 3.2)

**Decision:** Expand the existing "No sets exist" edge case in `skills/status/SKILL.md` from a one-liner to a multi-line guidance block that includes the workflow lifecycle.

**Rationale:** The current behavior (`"No sets found. Run /rapid:init to get started."`) is technically correct but unhelpful for users who have already run init and have an empty milestone. The guidance should distinguish between "no STATE.json" (run init) and "sets exist but none started" (run start-set).

**New behavior:**
- **STATE.json missing:** Keep existing message: "STATE.json not found. Run `/rapid:init` to initialize."
- **Sets exist, all pending:** Show a "Getting Started" guide explaining the first step is `/rapid:start-set 1`, with the lifecycle stages listed.
- **No sets in milestone:** Keep existing "No sets found" message but add a suggestion to run `/rapid:add-set` or `/rapid:new-version`.

### D4: Status contextual hints (Item 2.3)

**Decision:** Enhance the Step 4 next-action suggestions in `skills/status/SKILL.md` to include contextual tips based on milestone progress patterns.

**Rationale:** The current next-action routing (Step 4) already maps set status to commands. Contextual hints add awareness of broader patterns: e.g., "All Wave 1 sets are merged -- Wave 2 sets are ready to start" or "3 sets are ready for review -- consider batch reviewing."

**Implementation:** Add a "Progress Insights" subsection before the AskUserQuestion in Step 4 that detects and surfaces:
- All sets in a wave are complete/merged (wave advancement hint)
- Multiple sets are at the same lifecycle stage (batch operation hint)
- All sets are merged (milestone completion hint -- already partially handled by the "All sets merged" edge case)

### D5: Init-to-first-set bridge (Item 3.3)

**Decision:** This item is satisfied by D2 (post-init workflow guide) and D3 (status empty-state guidance) working together. No separate implementation needed.

**Rationale:** The audit explicitly states item 3.3 "depends on 3.1 and 3.2." The bridge is the continuity of messaging: init ends with a workflow guide pointing to `/rapid:start-set`, and status (when accessed next) reinforces that guidance with the empty-state view. No additional code or content is required beyond D2 and D3.

### D6: Threshold for fuzzy match suggestions

**Decision:** Use edit distance <= 3 as the suggestion threshold, with a maximum of 3 suggestions shown.

**Rationale:** At distance 1-2, suggestions are almost certainly what the user meant (typos). At distance 3, suggestions are still plausible for short commands. Beyond 3, suggestions become noise. Capping at 3 suggestions keeps the output concise.

---

## Code Context

### `src/bin/rapid-tools.cjs` -- CLI dispatcher

**Structure:** The file is a Node.js CLI entry point using CommonJS. It imports handler functions from `src/commands/*.cjs` modules. The `main()` function parses `process.argv`, handles 4 commands that do not need project root (`prereqs`, `init`, `context`, `display`), then resolves project root for all others via `resolveProjectRoot()`. The remaining commands are dispatched through a `switch` statement (lines 215-312).

**Default case (line 308-311):** Currently prints `[RAPID ERROR] Unknown command: ${command}` to stderr via the `error()` function, then writes the full USAGE string to stdout, then exits with code 1. This is the integration point for fuzzy matching.

**Known commands (28 total):** `lock`, `state`, `parse-return`, `verify-artifacts`, `plan`, `assumptions`, `worktree`, `execute`, `memory`, `quick`, `merge`, `set-init`, `review`, `resume`, `resolve`, `build-agents`, `migrate`, `scaffold`, `compact`, `hooks`, `ui-contract`, `docs`, `dag`. Plus 4 pre-switch commands: `prereqs`, `init`, `context`, `display`.

**Error pattern:** Uses `error()` from `src/lib/core.cjs` for stderr output (`[RAPID ERROR] msg`), and `exitWithError()` from `src/lib/errors.cjs` for dual-channel errors (JSON to stdout + ANSI-colored `[ERROR]` to stderr). The default case currently uses the simpler `error()` pattern.

**Testing:** No dedicated unit test file exists for `rapid-tools.cjs` itself. The `display.test.cjs` tests cover the display subsystem. Fuzzy matching logic should be unit-testable if extracted as a pure function.

### `skills/init/SKILL.md` -- Init skill

**Structure:** 12 steps (0.5 through 12) plus error handling and constraints sections. Total length ~1340 lines. Steps flow: parse args (0.5) -> prereqs (1) -> detect existing (2) -> interview (3/4A/4B) -> codebase scan (5) -> research agents (6-8) -> synthesis (9) -> roadmap (10) -> commit (10.5) -> web registration (10.5) -> completion summary (11) -> footer (12).

**Step 11 (lines 1249-1278):** Displays a markdown summary block with project name, description, model, team size, granularity, roadmap set count, and files created. This is pure markdown output (no bash commands).

**Step 12 (lines 1280-1298):** Displays the footer via `node "${RAPID_TOOLS}" display footer` with the breadcrumb showing the full lifecycle. Two variants: one pointing to `/rapid:start-set 1` (when sets exist) and one pointing to `/rapid:status` (when no sets planned).

**Integration point for workflow guide:** Between Step 11 and Step 12. A new Step 11.5 can be inserted as pure markdown output (matching Step 11's pattern). No bash commands needed -- the agent simply outputs the guide text.

**Breadcrumb pattern:** All footers use `--breadcrumb "init [done] > start-set > discuss-set > plan-set > execute-set > review > merge"` showing the full lifecycle.

### `skills/status/SKILL.md` -- Status skill

**Structure:** 4 steps plus edge cases and notes. Step 1: env loading. Step 2: load state + DAG + git activity. Step 3: display dashboard table with wave grouping. Step 3.5: pending remediations. Step 4: next-action routing via AskUserQuestion.

**Edge cases (lines 155-159):** Three cases defined:
1. "No sets exist" -> one-liner message pointing to `/rapid:init`
2. "All sets merged" -> message pointing to `/rapid:new-version`
3. "STATE.json missing" -> handled in Step 2 with fallback to Step 4

**Step 4 next-action routing (lines 161-210):** Maps set status to suggested commands via a lookup table. Uses AskUserQuestion with up to 4 options plus "Done." The "more than 4 actionable sets" case adds a text note for remaining actions. This is where contextual hints would be added -- as a "Progress Insights" block before the AskUserQuestion call.

**Key observation:** The "No sets exist" edge case (line 157) does not distinguish between "STATE.json exists with 0 sets" and "all sets are pending." Both need different guidance. The "all pending" case is the primary target for item 3.2 (empty-state guidance after a fresh init).

**AskUserQuestion pattern:** Always used for routing. Options have `name` (the command) and `description` (what it does). This pattern should be preserved for any new contextual hints.

### `.planning/v6.1.0-UX-AUDIT.md` -- Carry-forward audit context

**Status:** 16 total items, 11 Pass, 0 Fail, 5 Deferred. The 5 deferred items are exactly the scope of this set (items 2.2, 2.3, 3.1, 3.2, 3.3). Each deferred item has a clear description of what was expected and why it was deferred ("Requires modifying SKILL.md files, which are not owned by this set" or "out of scope for this audit").

**Remediation log:** Documents 7 remediations already applied in the ux-audit set with commit hashes. This set should not re-address any of the 11 Pass items.

---

## Deferred

No deferred items identified (auto-skip mode).
