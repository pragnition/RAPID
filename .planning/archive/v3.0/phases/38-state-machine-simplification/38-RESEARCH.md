# Phase 38: State Machine Simplification - Research

**Researched:** 2026-03-12
**Domain:** State machine refactoring (Node.js/CJS, Zod schemas, file-based state)
**Confidence:** HIGH

## Summary

Phase 38 is a well-scoped internal refactoring of four core files (`state-schemas.cjs`, `state-transitions.cjs`, `state-machine.cjs`, `lock.cjs`) and their associated test files. The current state machine tracks three levels of hierarchy (Set > Wave > Job) with derived status propagation upward. This phase collapses that to a single level (Set only) with a simplified status enum: `pending | discussing | planning | executing | complete | merged`.

The refactoring is low-risk because: (1) all four source files have comprehensive test suites, (2) the wave/job removal is purely subtractive (delete schemas, delete transitions, delete functions), (3) the crash recovery triad (detectCorruption, recoverFromGit, atomic writes) is already proven and stays functionally identical, and (4) callers in `rapid-tools.cjs` that reference wave/job will be updated in later phases (40-44) since those entire command paths are being rewritten.

**Primary recommendation:** Execute as a clean rewrite of the four core files with new tests, rather than incremental editing. The target code is small enough (~160 lines for schemas+transitions+machine combined, down from ~460) that a fresh write is cleaner than surgical deletion.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- SetStatus enum: `pending | discussing | planning | executing | complete | merged`
- No `failed` state -- sets stay in their current status until user fixes and retries
- No back-transitions -- strictly forward only
- `pending` can transition to `discussing` OR `planning` (discussing is optional, supports --skip)
- `discussing` -> `planning` -> `executing` -> `complete` -> `merged`
- Reviewing is not a state -- it's an action performed on completed sets without changing status
- `merging` removed -- a set is `complete`, then after merge it's `merged`
- Full removal: SetState becomes `{ id, status }` -- no nested waves/jobs arrays
- Wave/job progress determined from disk artifacts (PLAN.md files, commits), not state
- Remove findWave, findJob, transitionWave, transitionJob, deriveWaveStatus, deriveSetStatus completely -- no stubs
- Remove WaveState, JobState, WaveStatus, JobStatus schemas from state-schemas.cjs
- Remove WAVE_TRANSITIONS, JOB_TRANSITIONS from state-transitions.cjs
- Remove all wave/job transition tests -- write new tests for simplified state machine
- Simplify lock.cjs in this phase (don't defer to Phase 45) -- only STATE.json-level locks needed
- File-level recovery only: detectCorruption (JSON + Zod validation), recoverFromGit (checkout HEAD), atomic writes (tmp+rename)
- No partial transition detection -- if status was written but work wasn't committed, user re-runs the command
- Auto-clean stale lock files on startup (PID check -- if owning process is dead, remove lock)
- Bootstrap from STATE.json + disk artifact validation -- commands check both
- On mismatch: warn and suggest fix (e.g., "State says planning but no plan found -- run /plan-set"). Don't auto-correct.
- Sets are completely isolated during their lifecycle -- no cross-set state reads during transitions
- Remove any code that reads other sets' states during transitions (no enforcement assertion needed -- just delete the code)
- Contract violations produce warnings only, never block transitions
- Multiple sets can be in any status simultaneously -- no limits on concurrent states
- The `merged` status is tracked in STATE.json (complete -> merged), not inferred from git

### Claude's Discretion
- Exact transaction pattern for state mutations
- How to structure disk artifact validation checks
- Test organization for the simplified state machine
- How to handle the 16+ files that reference wave/job patterns (clean up callers in this phase vs leave broken for later phases)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STATE-01 | State machine simplified to set-level hierarchy (remove WaveState, JobState, derived status propagation) | Core refactoring target: remove 4 schemas, 2 transition maps, 6 functions, replace with flat SetState `{ id, status }`. See Architecture Patterns for exact schemas. |
| STATE-02 | SetStatus enum updated with 'discussing' status for discuss-set flow | New enum `pending \| discussing \| planning \| executing \| complete \| merged` with branching transition from `pending` to either `discussing` or `planning`. See Architecture Patterns for SET_TRANSITIONS map. |
| STATE-03 | Crash recovery triad preserved (detectCorruption, recoverFromGit, atomic writes) through simplification | These three functions are structurally unchanged -- detectCorruption reads+parses+validates, recoverFromGit does `git checkout HEAD`, writeState does tmp+rename. Only the Zod schema they validate against changes. Plus: PID-based stale lock cleanup added. |
| STATE-04 | Every command bootstraps exclusively from STATE.json + disk artifacts (self-contained after /clear) | readState already returns parsed validated state. New: add `validateDiskArtifacts(cwd, milestoneId, setId)` function that checks STATE.json status against expected disk artifacts and returns warnings. |
| STATE-05 | Each command follows transaction pattern: read state -> validate -> work -> write state -> suggest next action | transitionSet already implements read->validate->write. Formalize as documented pattern with `withStateTransaction(cwd, fn)` helper. Suggest-next-action is a UX concern handled by callers. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^3.25.76 | Schema validation for STATE.json | Already used, `.safeParse()` for validation, `.parse()` for fail-fast |
| proper-lockfile | ^4.1.2 | Atomic file locking | Already used for mutex on STATE.json writes |
| node:fs | built-in | File I/O for STATE.json | Atomic write via `writeFileSync` + `renameSync` |
| node:test | built-in | Test runner | Already used across all test files, `describe/it/beforeEach/afterEach` |
| node:assert/strict | built-in | Test assertions | Already used, provides clear failure messages |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:child_process | built-in | Git operations | `execFileSync('git', ...)` for recoverFromGit, commitState |
| node:os | built-in | Temp directories for tests | `os.tmpdir()` for isolated test environments |
| node:path | built-in | Path construction | Cross-platform path joining |
| node:process | built-in | PID checking for stale locks | `process.kill(pid, 0)` for checking if owning process is alive |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| proper-lockfile | Custom PID file locking | proper-lockfile handles stale detection, retry, cross-platform -- don't hand-roll |
| Zod | AJV (already in deps) | Zod is already entrenched in state layer, AJV used elsewhere -- keep Zod for state |

## Architecture Patterns

### Recommended Project Structure (no changes to file locations)
```
src/lib/
  state-schemas.cjs      # Zod schemas: SetStatus, SetState, MilestoneState, ProjectState
  state-transitions.cjs  # SET_TRANSITIONS map + validateTransition()
  state-machine.cjs      # CRUD + transition + corruption + recovery
  lock.cjs               # acquireLock, isLocked, cleanStaleLocks
```

### Pattern 1: Simplified SetState Schema
**What:** Flat set schema with no nested arrays
**When to use:** All state operations

```javascript
// NEW state-schemas.cjs
const SetStatus = z.enum(['pending', 'discussing', 'planning', 'executing', 'complete', 'merged']);

const SetState = z.object({
  id: z.string(),
  status: SetStatus.default('pending'),
});

// MilestoneState and ProjectState remain structurally identical
// (MilestoneState.sets is now z.array(SetState) with no wave/job nesting)
```

### Pattern 2: Branching Transition Map
**What:** SetStatus transitions with a branch point at `pending`
**When to use:** All status transitions

```javascript
// NEW state-transitions.cjs
const SET_TRANSITIONS = {
  pending:    ['discussing', 'planning'],  // discussing is optional (--skip goes to planning)
  discussing: ['planning'],
  planning:   ['executing'],
  executing:  ['complete'],
  complete:   ['merged'],
  merged:     [],  // terminal
};

// validateTransition simplified to set-only (remove entityType parameter)
function validateTransition(currentStatus, nextStatus) {
  const allowed = SET_TRANSITIONS[currentStatus];
  if (allowed === undefined) {
    throw new Error(`Unknown status "${currentStatus}". Valid: ${Object.keys(SET_TRANSITIONS).join(', ')}`);
  }
  if (!allowed.includes(nextStatus)) {
    if (allowed.length === 0) {
      throw new Error(`"${currentStatus}" is terminal -- no transitions allowed.`);
    }
    throw new Error(
      `Invalid transition: "${currentStatus}" -> "${nextStatus}". ` +
      `Valid from "${currentStatus}": [${allowed.join(', ')}]`
    );
  }
}
```

### Pattern 3: Transaction Pattern for State Mutations
**What:** Read-validate-mutate-write pattern with lock protection
**When to use:** All state mutations (transitionSet, addSet, addMilestone)

```javascript
// Recommended: explicit transaction helper
async function withStateTransaction(cwd, mutationFn) {
  const release = await acquireLock(cwd, 'state');
  try {
    const readResult = await readState(cwd);
    if (!readResult || !readResult.valid) {
      throw new Error('Cannot mutate: STATE.json is missing or invalid');
    }
    const state = readResult.state;

    // mutationFn receives state, mutates in-place, returns nothing
    mutationFn(state);

    // Validate + atomic write
    const validated = ProjectState.parse(state);
    validated.lastUpdatedAt = new Date().toISOString();
    const stateFile = path.join(cwd, PLANNING_DIR, STATE_FILE);
    const tmpFile = stateFile + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(validated, null, 2), 'utf-8');
    fs.renameSync(tmpFile, stateFile);

    return validated;
  } finally {
    await release();
  }
}

// Usage:
async function transitionSet(cwd, milestoneId, setId, newStatus) {
  return withStateTransaction(cwd, (state) => {
    const set = findSet(state, milestoneId, setId);
    validateTransition(set.status, newStatus);
    set.status = newStatus;
  });
}
```

### Pattern 4: Disk Artifact Validation (STATE-04)
**What:** Check STATE.json status against expected disk artifacts
**When to use:** Bootstrap/startup of any command

```javascript
// state-machine.cjs (new function)
function validateDiskArtifacts(cwd, milestoneId, setId) {
  const warnings = [];
  const readResult = readStateSync(cwd); // or use cached state
  if (!readResult?.valid) return [{ type: 'error', message: 'STATE.json missing or invalid' }];

  const set = findSet(readResult.state, milestoneId, setId);
  const setDir = path.join(cwd, '.planning', 'sets', setId);

  // Check: if status says 'planning' or later, CONTEXT.md should exist
  if (['planning', 'executing', 'complete', 'merged'].includes(set.status)) {
    const contextPath = path.join(setDir, 'CONTEXT.md');
    if (!fs.existsSync(contextPath)) {
      warnings.push({
        type: 'warning',
        message: `Set "${setId}" is "${set.status}" but no CONTEXT.md found -- run /discuss-set or /discuss-set --skip`,
      });
    }
  }

  // Check: if status says 'executing' or later, PLAN.md files should exist
  if (['executing', 'complete', 'merged'].includes(set.status)) {
    // Check for wave plan files
    const wavesDir = path.join(cwd, '.planning', 'waves', setId);
    if (!fs.existsSync(wavesDir)) {
      warnings.push({
        type: 'warning',
        message: `Set "${setId}" is "${set.status}" but no wave plans found -- run /plan-set`,
      });
    }
  }

  return warnings;
}
```

### Pattern 5: PID-Based Stale Lock Cleanup
**What:** On startup, check lock files and remove those owned by dead processes
**When to use:** Added to `acquireLock` or called explicitly at command startup

```javascript
// lock.cjs enhancement
function cleanStaleLocks(cwd) {
  const locksPath = path.join(cwd, LOCKS_DIR);
  if (!fs.existsSync(locksPath)) return;

  const targets = fs.readdirSync(locksPath).filter(f => f.endsWith('.target'));
  for (const target of targets) {
    const targetPath = path.join(locksPath, target);
    try {
      const data = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      if (data.pid && !isProcessAlive(data.pid)) {
        // Owning process is dead -- clean up lock artifacts
        const lockDir = targetPath + '.lock';
        if (fs.existsSync(lockDir)) {
          fs.rmSync(lockDir, { recursive: true, force: true });
        }
        fs.unlinkSync(targetPath);
      }
    } catch {
      // If we can't read/parse, skip -- proper-lockfile stale detection handles this
    }
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0); // signal 0 = existence check only
    return true;
  } catch {
    return false;
  }
}
```

### Anti-Patterns to Avoid
- **Reading other sets' state during transitions:** The old code had derived status that read sibling waves. The new code must never look at other sets' status during a transition. Each `transitionSet` call operates on exactly one set.
- **Storing wave/job progress in STATE.json:** Per the user decision, wave/job progress is determined from disk artifacts (PLAN.md files, git commits). Do not re-introduce tracking arrays.
- **Auto-correcting state/disk mismatches:** When `validateDiskArtifacts` finds a mismatch, it returns warnings. The caller displays the warning and suggests the fix command. It does NOT modify STATE.json.
- **Adding `failed` status:** Per user decision, there is no `failed` state. If something fails, the set stays in its current status and the user retries.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File locking | Custom PID-file locking | proper-lockfile with `stale` option | Handles retry, stale detection, cross-platform, race conditions |
| Schema validation | Manual JSON field checks | Zod `.safeParse()` / `.parse()` | Type coercion, default values, structured error reporting |
| Atomic file writes | Direct `writeFileSync` | tmp-file + `renameSync` | rename is atomic on POSIX; prevents corrupt reads mid-write |
| Git recovery | Custom VCS operations | `execFileSync('git', ['checkout', 'HEAD', '--', path])` | Git is the source of truth, already proven pattern |

**Key insight:** The existing patterns for locking, validation, and atomic writes are battle-tested through v2.0-v2.2. This phase simplifies what is tracked, not how it is tracked.

## Common Pitfalls

### Pitfall 1: Breaking Callers in rapid-tools.cjs
**What goes wrong:** Removing exports from state-machine.cjs (findWave, findJob, transitionWave, transitionJob, deriveWaveStatus, deriveSetStatus) breaks `require('./state-machine.cjs')` calls in rapid-tools.cjs.
**Why it happens:** rapid-tools.cjs has ~80+ references to wave/job functions and the `state get wave`, `state get job`, `state transition wave`, `state transition job` subcommands.
**How to avoid:** Leave the rapid-tools.cjs wave/job command paths broken (they will error naturally). Those paths are being completely rewritten in phases 40-44. The state-machine module's exports should be clean (no stubs). If a caller hits a removed export, the `require` will succeed but the function call will throw `TypeError: sm.findWave is not a function` which is the correct behavior -- those code paths are dead in v3.0.
**Warning signs:** Tests in `rapid-tools.test.cjs` that exercise wave/job state commands will fail. This is expected.

### Pitfall 2: Forgetting the Branching Transition
**What goes wrong:** Making `pending` only transition to `discussing`, breaking `--skip` flows that go directly to `planning`.
**Why it happens:** Linear transition chains are the common pattern. The branch is unusual.
**How to avoid:** SET_TRANSITIONS must map `pending` to `['discussing', 'planning']`. Test both paths explicitly.
**Warning signs:** `transitionSet(cwd, milestone, set, 'planning')` throws when set is in `pending` state.

### Pitfall 3: Schema Version Mismatch with Existing STATE.json Files
**What goes wrong:** Existing STATE.json files (in worktrees, from v2.x) contain `waves` and `jobs` arrays that fail the new simplified schema validation.
**Why it happens:** The Zod schema will reject unknown fields by default (Zod's `strict()`) or silently strip them (`parse` without `strict`).
**How to avoid:** Zod's `z.object()` by default strips unknown keys. Since SetState changes from `{ id, status, waves: [...] }` to `{ id, status }`, the `waves` key will be silently stripped by `z.object().parse()`. This is actually correct behavior -- old STATE.json files will parse successfully with waves stripped. However, `readState` -> `writeState` will lose wave data permanently. This is acceptable for v3.0 since wave/job data is no longer tracked. Document this as a one-way migration.
**Warning signs:** Old worktree STATE.json files losing wave data after any state write.

### Pitfall 4: Double-Locking in withStateTransaction
**What goes wrong:** `transitionSet` acquires a lock, then calls `writeState` which also acquires a lock, causing a deadlock (proper-lockfile is not reentrant).
**Why it happens:** The current code has lock acquisition both in `transitionSet`/`transitionWave`/`transitionJob` AND in `writeState`.
**How to avoid:** The `withStateTransaction` helper acquires the lock once and does the write inline (bypassing `writeState`). Or: make `writeState` accept an optional `skipLock` parameter. The current codebase already handles this -- `transitionJob/Wave/Set` write directly to disk inside their lock, bypassing `writeState`. Follow the same pattern in the simplified code.
**Warning signs:** Tests hanging or timing out during transition operations.

### Pitfall 5: Lock Simplification Going Too Far
**What goes wrong:** Removing the lock entirely because "it's simpler" and then getting corrupt STATE.json from concurrent agent writes.
**Why it happens:** With wave/job removal, locking feels like overkill. But multiple sets can be executing simultaneously in different worktrees, and they share STATE.json.
**How to avoid:** Keep `acquireLock` with the same `proper-lockfile` mechanism. Simplify the lock name from 'state-machine' to 'state' for clarity, but keep the locking itself.
**Warning signs:** Concurrent test failures or corrupt STATE.json in multi-worktree scenarios.

## Code Examples

### Example 1: Complete New state-schemas.cjs

```javascript
'use strict';

const { z } = require('zod');

// --- Status enum ---
const SetStatus = z.enum(['pending', 'discussing', 'planning', 'executing', 'complete', 'merged']);

// --- State schemas (bottom-up) ---
const SetState = z.object({
  id: z.string(),
  status: SetStatus.default('pending'),
});

const MilestoneState = z.object({
  id: z.string(),
  name: z.string(),
  sets: z.array(SetState).default([]),
});

const ProjectState = z.object({
  version: z.literal(1),
  projectName: z.string(),
  currentMilestone: z.string(),
  milestones: z.array(MilestoneState).default([]),
  lastUpdatedAt: z.string(),
  createdAt: z.string(),
});

module.exports = { SetStatus, SetState, MilestoneState, ProjectState };
```

### Example 2: Complete New state-transitions.cjs

```javascript
'use strict';

const SET_TRANSITIONS = {
  pending:     ['discussing', 'planning'],
  discussing:  ['planning'],
  planning:    ['executing'],
  executing:   ['complete'],
  complete:    ['merged'],
  merged:      [],
};

function validateTransition(currentStatus, nextStatus) {
  const allowed = SET_TRANSITIONS[currentStatus];
  if (allowed === undefined) {
    throw new Error(
      `Unknown status "${currentStatus}". Valid statuses: ${Object.keys(SET_TRANSITIONS).join(', ')}`
    );
  }
  if (!allowed.includes(nextStatus)) {
    if (allowed.length === 0) {
      throw new Error(
        `Invalid transition: "${currentStatus}" -> "${nextStatus}". ` +
        `"${currentStatus}" is a terminal state with no valid transitions.`
      );
    }
    throw new Error(
      `Invalid transition: "${currentStatus}" -> "${nextStatus}". ` +
      `Valid transitions from "${currentStatus}": [${allowed.join(', ')}]`
    );
  }
}

module.exports = { SET_TRANSITIONS, validateTransition };
```

### Example 3: Simplified transitionSet with Transaction Pattern

```javascript
async function transitionSet(cwd, milestoneId, setId, newStatus) {
  const release = await acquireLock(cwd, 'state');
  try {
    const readResult = await readState(cwd);
    if (!readResult || !readResult.valid) {
      throw new Error('Cannot transition: STATE.json is missing or invalid');
    }
    const state = readResult.state;
    const set = findSet(state, milestoneId, setId);
    validateTransition(set.status, newStatus);
    set.status = newStatus;

    // Atomic write (inline, not via writeState to avoid double-lock)
    const validated = ProjectState.parse(state);
    validated.lastUpdatedAt = new Date().toISOString();
    const stateFile = path.join(cwd, PLANNING_DIR, STATE_FILE);
    const tmpFile = stateFile + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(validated, null, 2), 'utf-8');
    fs.renameSync(tmpFile, stateFile);
  } finally {
    await release();
  }
}
```

### Example 4: PID-Based Stale Lock Cleanup

```javascript
function cleanStaleLocks(cwd) {
  const locksPath = path.join(cwd, LOCKS_DIR);
  if (!fs.existsSync(locksPath)) return;

  const targets = fs.readdirSync(locksPath).filter(f => f.endsWith('.target'));
  for (const target of targets) {
    const targetPath = path.join(locksPath, target);
    try {
      const data = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      if (data.pid) {
        try {
          process.kill(data.pid, 0);
          // Process alive -- leave lock alone
        } catch {
          // Process dead -- clean up
          const lockDir = targetPath + '.lock';
          if (fs.existsSync(lockDir)) {
            fs.rmSync(lockDir, { recursive: true, force: true });
          }
          fs.unlinkSync(targetPath);
        }
      }
    } catch {
      // Can't read/parse target -- skip
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 3-level hierarchy (Set > Wave > Job) | 1-level (Set only) | v3.0 Phase 38 | Removes ~300 lines of derivation/transition code |
| Derived wave status from jobs | No derivation -- status set explicitly | v3.0 Phase 38 | Eliminates `deriveWaveStatus`, `deriveSetStatus`, `isDerivedStatusValid` |
| 6 set statuses (no discussing, no merged) | 6 set statuses (pending/discussing/planning/executing/complete/merged) | v3.0 Phase 38 | Adds discuss flow, removes reviewing/merging as states |
| Entity-type transitions (set/wave/job) | Set-only transitions (no entity type parameter) | v3.0 Phase 38 | Simplifies validateTransition to single-entity |
| Lock scoped to 'state-machine' | Lock scoped to 'state' | v3.0 Phase 38 | Simpler lock naming, PID-based stale cleanup |

**Removed in this phase:**
- `JobStatus`, `JobState`, `WaveStatus`, `WaveState` schemas
- `WAVE_TRANSITIONS`, `JOB_TRANSITIONS` maps
- `findWave`, `findJob`, `transitionWave`, `transitionJob` functions
- `deriveWaveStatus`, `deriveSetStatus`, `isDerivedStatusValid` functions
- `WAVE_STATUS_ORDER`, `SET_STATUS_ORDER` ordinal maps

## Caller Impact Analysis

### Files That Reference Wave/Job State Functions

| File | Impact | Handle In |
|------|--------|-----------|
| `src/lib/state-schemas.cjs` | Direct rewrite | **Phase 38** |
| `src/lib/state-transitions.cjs` | Direct rewrite | **Phase 38** |
| `src/lib/state-machine.cjs` | Direct rewrite | **Phase 38** |
| `src/lib/lock.cjs` | Simplification + PID cleanup | **Phase 38** |
| `src/lib/state-schemas.test.cjs` | Full rewrite | **Phase 38** |
| `src/lib/state-transitions.test.cjs` | Full rewrite | **Phase 38** |
| `src/lib/state-machine.test.cjs` | Full rewrite | **Phase 38** |
| `src/lib/state-machine.lifecycle.test.cjs` | Full rewrite | **Phase 38** |
| `src/lib/lock.test.cjs` | Add PID cleanup tests | **Phase 38** |
| `src/bin/rapid-tools.cjs` | ~80+ wave/job references in CLI handlers | Phase 40+ (those command paths are being rewritten) |
| `src/lib/wave-planning.cjs` | Entire module references waves | Phase 43 (rewrite as plan.cjs) |
| `src/lib/execute.cjs` | References wave execution | Phase 44 (rewrite) |
| `src/lib/dag.state-alignment.test.cjs` | Tests reference WaveState/JobState alignment | Phase 38 or delete (tests are for a pattern being removed) |
| `src/lib/phase17-integration.test.cjs` | References `transitionJob` in assertion | **Phase 38** (update assertion to check `transitionSet` instead) |
| `src/lib/resolve.cjs` | `resolveWave` function | Phase 40+ (remove wave resolution) |

**Recommendation for Claude's Discretion item (16+ files):** Only rewrite the 9 files in the core state layer (4 source + 5 test files) plus update `phase17-integration.test.cjs` (1 line). Leave `rapid-tools.cjs` and other callers for their designated phases. The state module's exports will be clean -- callers that reference removed exports will get `TypeError` at runtime, which is correct behavior for dead code paths.

## Open Questions

1. **Should `dag.state-alignment.test.cjs` be deleted or updated?**
   - What we know: This test file validates that DAG output aligns with the Set > Wave > Job hierarchy. That hierarchy is being removed.
   - What's unclear: Whether the DAG module itself needs the `createDAGv2` function that uses 'job' type nodes.
   - Recommendation: Delete `dag.state-alignment.test.cjs` in this phase. The DAG module will be updated in Phase 43/44 when execution is rewritten. The tests test a contract (DAG -> state alignment) that no longer exists.

2. **Should `addMilestone` handle carry-forward sets that still have waves?**
   - What we know: `addMilestone` deep-copies carry-forward sets. Old sets have waves arrays.
   - What's unclear: Whether `addMilestone` will be called with old-format sets during v3.0 migration.
   - Recommendation: Since Zod `z.object()` strips unknown keys, old sets with `waves` will have them silently stripped during parse. This is correct. No special handling needed.

3. **Lock name change: 'state-machine' -> 'state'**
   - What we know: The lock name is just a filename in `.planning/.locks/`. Changing it is trivial.
   - What's unclear: Whether any worktrees have active locks with the old name.
   - Recommendation: Change the name. Old lock files will be cleaned up by the PID-based stale lock cleanup. Not a migration concern.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in, no version) |
| Config file | none -- tests run via `node --test <file>` |
| Quick run command | `node --test src/lib/state-schemas.test.cjs src/lib/state-transitions.test.cjs src/lib/state-machine.test.cjs src/lib/lock.test.cjs` |
| Full suite command | `node --test src/lib/state-schemas.test.cjs src/lib/state-transitions.test.cjs src/lib/state-machine.test.cjs src/lib/state-machine.lifecycle.test.cjs src/lib/lock.test.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STATE-01 | SetState is `{ id, status }` only -- no waves/jobs | unit | `node --test src/lib/state-schemas.test.cjs` | Will rewrite |
| STATE-01 | WaveState/JobState schemas removed | unit | `node --test src/lib/state-schemas.test.cjs` | Will rewrite |
| STATE-01 | findWave/findJob/transitionWave/transitionJob removed from exports | unit | `node --test src/lib/state-machine.test.cjs` | Will rewrite |
| STATE-02 | SetStatus includes 'discussing' and 'merged' | unit | `node --test src/lib/state-schemas.test.cjs` | Will rewrite |
| STATE-02 | pending -> discussing and pending -> planning both valid | unit | `node --test src/lib/state-transitions.test.cjs` | Will rewrite |
| STATE-02 | Full chain: pending -> discussing -> planning -> executing -> complete -> merged | unit | `node --test src/lib/state-transitions.test.cjs` | Will rewrite |
| STATE-03 | detectCorruption identifies bad JSON | unit | `node --test src/lib/state-machine.test.cjs` | Will rewrite |
| STATE-03 | detectCorruption identifies bad schema | unit | `node --test src/lib/state-machine.test.cjs` | Will rewrite |
| STATE-03 | recoverFromGit restores last good commit | unit | `node --test src/lib/state-machine.test.cjs` | Will rewrite |
| STATE-03 | Atomic write via tmp+rename leaves no .tmp | unit | `node --test src/lib/state-machine.test.cjs` | Will rewrite |
| STATE-03 | PID-based stale lock cleanup | unit | `node --test src/lib/lock.test.cjs` | Will add |
| STATE-04 | validateDiskArtifacts returns warnings for mismatches | unit | `node --test src/lib/state-machine.test.cjs` | Will add |
| STATE-04 | readState -> writeState round-trip preserves data | unit | `node --test src/lib/state-machine.test.cjs` | Will rewrite |
| STATE-05 | transitionSet follows read->validate->mutate->write pattern | unit | `node --test src/lib/state-machine.test.cjs` | Will rewrite |
| STATE-05 | Invalid transition throws descriptive error | unit | `node --test src/lib/state-transitions.test.cjs` | Will rewrite |
| STATE-05 | Sets are independent -- no cross-set reads during transition | unit | `node --test src/lib/state-machine.test.cjs` | Will add |

### Sampling Rate
- **Per task commit:** `node --test src/lib/state-schemas.test.cjs src/lib/state-transitions.test.cjs src/lib/state-machine.test.cjs src/lib/lock.test.cjs`
- **Per wave merge:** Full suite command above
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. The test files exist and will be rewritten in-place with new test cases matching the simplified state machine. No new framework installation or configuration needed.

## Sources

### Primary (HIGH confidence)
- Direct code analysis of `src/lib/state-schemas.cjs` (60 lines), `state-transitions.cjs` (73 lines), `state-machine.cjs` (462 lines), `lock.cjs` (88 lines)
- Direct code analysis of test files: `state-schemas.test.cjs` (211 lines), `state-transitions.test.cjs` (147 lines), `state-machine.test.cjs` (752 lines), `state-machine.lifecycle.test.cjs` (682 lines), `lock.test.cjs` (128 lines)
- Grep analysis of all wave/job references across `src/` (10 files identified)
- User decisions from `38-CONTEXT.md` (comprehensive, locked)

### Secondary (MEDIUM confidence)
- `rapid-tools.cjs` caller analysis (~80+ wave/job references identified via grep)
- Existing STATE.json format from `.rapid-worktrees/state-and-ux/.planning/STATE.json` as migration reference

### Tertiary (LOW confidence)
- None -- this is internal refactoring with full source code visibility

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all libraries already in use
- Architecture: HIGH -- clear subtractive refactoring with proven patterns
- Pitfalls: HIGH -- identified from direct code analysis of existing implementation
- Caller impact: HIGH -- grep-verified list of all affected files

**Research date:** 2026-03-12
**Valid until:** Indefinite -- internal refactoring, no external dependency concerns
