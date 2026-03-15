# SET-OVERVIEW: status-rename

## Approach

This set performs a mechanical but safety-critical rename of set status values from present-participle form (`discussing`, `planning`, `executing`) to past-tense form (`discussed`, `planned`, `executed`). The motivation is grammatical consistency: a set that has finished its discussion phase should be `discussed`, not perpetually `discussing`. The rename touches the Zod schema, the transition map, every status string literal across the codebase, and agent prompt files.

The core risk is that a partial rename will cause Zod validation to crash -- the schema and all consumers must be updated atomically within a single commit. The implementation strategy is: (1) update the schema and transition definitions, (2) update all runtime consumers in library and CLI code, (3) update all test files to match, (4) update agent prompt markdown files, (5) add a `migrateState()` function so existing STATE.json files with old values load transparently. Each wave builds on the previous, but every change within a wave ships together in one commit to maintain atomicity.

There are no imports from other sets. This set is a pure internal refactor with no new features, no new dependencies, and no API surface changes beyond the string values themselves.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| src/lib/state-schemas.cjs | `SetStatus` Zod enum definition | Existing -- rename enum values |
| src/lib/state-schemas.test.cjs | Schema validation tests | Existing -- update literals |
| src/lib/state-transitions.cjs | `SET_TRANSITIONS` map | Existing -- rename keys/values |
| src/lib/state-transitions.test.cjs | Transition validation tests | Existing -- update literals |
| src/lib/state-machine.cjs | `readState()`, `writeState()`, status checks | Existing -- rename literals, add migration |
| src/lib/state-machine.test.cjs | State machine unit tests | Existing -- update literals |
| src/lib/state-machine.lifecycle.test.cjs | Lifecycle integration tests | Existing -- update literals |
| src/lib/worktree.cjs | Wave progress summary, status sort order, action routing | Existing -- rename literals |
| src/lib/worktree.test.cjs | Worktree tests | Existing -- update literals |
| src/bin/rapid-tools.cjs | CLI entry point | Existing -- update status references |
| src/bin/rapid-tools.test.cjs | CLI tests | Existing -- update literals |
| src/modules/core/core-identity.md | Core agent identity prompt | Existing -- rename status references |
| src/modules/roles/*.md (12 files) | Agent role prompts | Existing -- rename status references |

## Integration Points

- **Exports:** `SetStatus` (updated Zod enum), `SET_TRANSITIONS` (updated map), `migrateState()` (new migration function)
- **Imports:** None -- this set has no external dependencies
- **Side Effects:** Existing STATE.json files containing old status values (`discussing`, `planning`, `executing`) will be transparently migrated on read via `migrateState()` called inside `readState()`

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Partial rename leaves old and new values mixed | High -- Zod validation crashes on any mismatch | Atomic commit per wave; grep-verify zero old-value occurrences before committing |
| Existing STATE.json in user projects breaks on upgrade | High -- project becomes unreadable | `migrateState()` in `readState()` transparently rewrites old values before validation |
| Agent prompts reference old status names in workflow docs | Medium -- agents generate invalid transitions | Wave 3 explicitly sweeps all 13 markdown files in src/modules/ |
| Other sets in-flight use old status values in their worktrees | Low -- worktree STATE.json diverges | `migrateState()` is idempotent; merge will normalize values |

## Wave Breakdown (Preliminary)

- **Wave 1:** Schema and transitions foundation -- update `SetStatus` enum in state-schemas.cjs, `SET_TRANSITIONS` in state-transitions.cjs, and their corresponding test files. Add `migrateState()` to state-machine.cjs with idempotency tests.
- **Wave 2:** Runtime consumers -- update all status string literals in state-machine.cjs, worktree.cjs, execute.cjs, rapid-tools.cjs, and their test files. Wire `migrateState()` into `readState()` for backward-compatible reads.
- **Wave 3:** Agent prompts and verification -- rename status references across all 13 markdown files in src/modules/. Run a final grep to confirm zero remaining occurrences of `discussing`, `planning` (as a status value, not the general word), or `executing`.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
