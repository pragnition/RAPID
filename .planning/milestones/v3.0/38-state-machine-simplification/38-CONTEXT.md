# Phase 38: State Machine Simplification - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Collapse the state hierarchy to set-level only (remove WaveState and JobState), add `discussing` and `merged` statuses to SetStatus, simplify lock.cjs, and preserve crash recovery with atomic writes. The state machine operates at project > milestone > set only.

</domain>

<decisions>
## Implementation Decisions

### Set status lifecycle
- SetStatus enum: `pending | discussing | planning | executing | complete | merged`
- No `failed` state — sets stay in their current status until user fixes and retries
- No back-transitions — strictly forward only
- `pending` can transition to `discussing` OR `planning` (discussing is optional, supports --skip)
- `discussing` → `planning` → `executing` → `complete` → `merged`
- Reviewing is not a state — it's an action performed on completed sets without changing status
- `merging` removed — a set is `complete`, then after merge it's `merged`

### Wave/job removal strategy
- Full removal: SetState becomes `{ id, status }` — no nested waves/jobs arrays
- Wave/job progress determined from disk artifacts (PLAN.md files, commits), not state
- Remove findWave, findJob, transitionWave, transitionJob, deriveWaveStatus, deriveSetStatus completely — no stubs
- Remove WaveState, JobState, WaveStatus, JobStatus schemas from state-schemas.cjs
- Remove WAVE_TRANSITIONS, JOB_TRANSITIONS from state-transitions.cjs
- Remove all wave/job transition tests — write new tests for simplified state machine
- Simplify lock.cjs in this phase (don't defer to Phase 45) — only STATE.json-level locks needed

### Crash recovery
- File-level recovery only: detectCorruption (JSON + Zod validation), recoverFromGit (checkout HEAD), atomic writes (tmp+rename)
- No partial transition detection — if status was written but work wasn't committed, user re-runs the command
- Auto-clean stale lock files on startup (PID check — if owning process is dead, remove lock)
- Bootstrap from STATE.json + disk artifact validation — commands check both
- On mismatch: warn and suggest fix (e.g., "State says planning but no plan found — run /plan-set"). Don't auto-correct.

### Set independence
- Sets are completely isolated during their lifecycle — no cross-set state reads during transitions
- Remove any code that reads other sets' states during transitions (no enforcement assertion needed — just delete the code)
- Contract violations produce warnings only, never block transitions
- Contracts guide development for mergeability — enforcement is advisory during lifecycle, checked during merge
- Multiple sets can be in any status simultaneously — no limits on concurrent states
- The `merged` status is tracked in STATE.json (complete → merged), not inferred from git

### Claude's Discretion
- Exact transaction pattern for state mutations
- How to structure disk artifact validation checks
- Test organization for the simplified state machine
- How to handle the 16+ files that reference wave/job patterns (clean up callers in this phase vs leave broken for later phases)

</decisions>

<specifics>
## Specific Ideas

- "Sets shouldn't even care about the states of other sets. This is only when you want to merge."
- "A set cannot be in a state of 'merging' — it is completed then merged with other sets"
- "Reviewing is optional — doesn't need its own state"
- Contracts are advisory during lifecycle, enforced at merge — they exist to guide development toward mergeable code

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `state-machine.cjs`: createInitialState, readState, writeState, findMilestone, findSet, transitionSet, detectCorruption, recoverFromGit, commitState — all reusable after removing wave/job functions
- `state-schemas.cjs`: ProjectState, MilestoneState, SetState schemas — restructure SetState, keep ProjectState/MilestoneState
- `state-transitions.cjs`: SET_TRANSITIONS map and validateTransition function — update SET_TRANSITIONS, keep validation pattern
- `lock.cjs`: acquireLock function — simplify but keep atomic lock pattern

### Established Patterns
- Zod schemas with `.safeParse()` for validation — maintain this pattern
- Atomic writes via tmp file + rename — preserve exactly
- Lock acquisition before state mutation — simplify but keep
- `execFileSync('git', ...)` for git operations — keep for recoverFromGit

### Integration Points
- `rapid-tools.cjs` references wave/job state — callers will need updating (may be deferred to Phase 40-44)
- `execute.cjs`, `wave-planning.cjs`, `plan.cjs`, `dag.cjs` use wave/job state heavily — these modules will be rewritten in later phases
- `review.cjs` and `worktree.cjs` reference wave patterns — will be updated in Phase 40+
- STATE.json file format changes affect all commands that read state

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 38-state-machine-simplification*
*Context gathered: 2026-03-12*
