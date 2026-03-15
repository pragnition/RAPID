# CONTEXT: status-rename

**Set:** status-rename
**Generated:** 2026-03-13
**Mode:** interactive

<domain>
## Set Boundary
Rename all set status values from present-participle (-ing) to past-tense (-ed) forms: `discussing` -> `discussed`, `planning` -> `planned`, `executing` -> `executed`. This is a cross-cutting change touching Zod schemas, transition tables, state machine logic, CLI commands, module role files, generated agents, and test suites. Includes a STATE.json migration layer so existing projects with in-flight state files upgrade cleanly without Zod validation crashes.
</domain>

<decisions>
## Implementation Decisions

### Migration Strategy
- **Auto-rewrite on read:** migrateState() should migrate old status values AND immediately rewrite STATE.json to disk during readState(). This ensures consistency -- once a file is read, it's upgraded on disk so subsequent reads don't need migration.
- migrateState() must be idempotent (safe to call multiple times).
- No standalone CLI migration command needed -- auto-migration on read is sufficient.

### Rename Scope Boundaries
- **Status literals AND prose references:** Rename both exact status string values in code AND prose references in agent prompt markdown files that describe set status (e.g., "when the set is planning" -> "when the set is planned").
- The `.planning/` directory name uses "planning" as a noun and should NOT be renamed.
- Use contextual judgment for "executing" -- rename when it refers to set status, leave when it means "executing a command" in general prose.

### Atomicity Approach
- **Multiple commits within a wave are acceptable** as long as tests pass at each step.
- Intermediate inconsistency within a wave is tolerable if the wave's final commit resolves it.
- No pre-commit verification grep hook needed -- the grep-based test (see below) provides sufficient safety.

### Test Verification Strategy
- **Belt and suspenders:** Add a dedicated grep-based integration test AND keep existing Zod validation tests.
- The grep test should scan all .cjs and .md files for old status literals (`discussing`, `planning`-as-status, `executing`-as-status).
- The grep test should be smart enough to exclude false positives (e.g., `.planning/` directory references, "planning phase" as a general concept).
- The grep test should be part of the permanent test suite (not a one-time migration check).
</decisions>

<specifics>
## Specific Ideas
- The three renames: `discussing` -> `discussed`, `planning` -> `planned`, `executing` -> `executed`
- `pending`, `complete`, `merged` remain unchanged (already past-tense/noun form)
- migrateState() is called inside readState() before Zod validation, and auto-rewrites STATE.json on disk
- The grep verification test should use word boundaries or context patterns to avoid false positives on "planning" as a noun
</specifics>

<code_context>
## Existing Code Insights
- `SetStatus` Zod enum defined in `src/lib/state-schemas.cjs:3` -- current values: `['pending', 'discussing', 'planning', 'executing', 'complete', 'merged']`
- `SET_TRANSITIONS` map in `src/lib/state-transitions.cjs:3-10` -- keys and values use old -ing forms
- `validateDiskArtifacts()` in `src/lib/state-machine.cjs:243` uses `.includes()` with old status strings for artifact checks
- `readState()` in `src/lib/state-machine.cjs:43` does not currently have a migration step -- migrateState() needs to be wired in before `ProjectState.safeParse(parsed)`
- `transitionSet()` in `src/lib/state-machine.cjs:166` delegates to `validateTransition()` which reads from SET_TRANSITIONS
- Agent role markdown files in `src/modules/roles/*.md` reference status values in workflow descriptions
</code_context>

<deferred>
## Deferred Ideas
- Wave-level and job-level status values could also be renamed in a future set (out of scope for this set which focuses on set-level status)
</deferred>
