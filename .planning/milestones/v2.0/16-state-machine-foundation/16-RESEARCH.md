# Phase 16: State Machine Foundation - Research

**Researched:** 2026-03-06
**Domain:** Hierarchical JSON state machine with validated transitions, lock-protected writes, DAG computation
**Confidence:** HIGH

## Summary

Phase 16 creates the foundational state tracking layer for RAPID v2.0. The core deliverable is a new `state-machine.cjs` module that manages a deeply nested JSON hierarchy (project > milestone > set > wave > job) with Zod-validated schemas, transition enforcement, atomic writes, and crash recovery. This replaces the Markdown-based `state.cjs` entirely.

The project is 100% CommonJS (.cjs), uses `node:test` + `node:assert/strict` for testing, and already has `proper-lockfile` for locking and `ajv` for JSON Schema validation (contracts). The CONTEXT.md locks Zod as the schema validator (matching gsd_merge_agent patterns). Zod 3.x (specifically 3.24.4 or earlier minor) is the safe choice for CommonJS `require('zod')` -- Zod 4 has known CommonJS issues.

**Primary recommendation:** Use Zod 3.24.x for schema validation in CommonJS. Build three distinct transition maps (Set, Wave, Job) as plain objects. Extend existing `dag.cjs` for v2.0 DAG shape. Reuse `lock.cjs` directly for atomic writes. All in pure JavaScript CommonJS.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Deeply nested hierarchy: project.milestones[].sets[].waves[].jobs[]
- Job-level state includes: id, status, startedAt, completedAt, commitSha, artifacts[]
- DAG remains separate file (DAG.json) -- state references it by convention, not embedded
- Schema validated with Zod (proven pattern from gsd_merge_agent state schemas)
- STATE.json lives at .planning/STATE.json
- Hard error on invalid transitions -- no warnings-only mode, no permissive fallback
- Distinct state machines per entity level:
  - Set: pending > planning > executing > reviewing > merging > complete
  - Wave: pending > discussing > planning > executing > reconciling > complete
  - Job: pending > executing > complete | failed
- Failed states can retry (failed > executing), complete is terminal
- Parent state auto-derived from children (computed, not stored independently)
- No migration -- clean break, STATE.json is the only state format
- state.cjs replaced entirely by the new module
- Atomic rename pattern: write STATE.json.tmp, then fs.renameSync to STATE.json
- lock.cjs reused as-is for concurrent access protection
- Git-based recovery for corruption -- STATE.json committed at workflow boundaries
- /rapid:status should detect corruption and offer "Restore from last commit?"
- STATE.json.tmp gitignored
- Auto-commit STATE.json at workflow boundaries (job complete/fail, wave transitions, set status changes)
- Hand-rolled state machine (~50 lines per entity), not XState

### Claude's Discretion
- Exact Zod schema field names and optional vs required decisions
- Internal helper function design for state reads/writes
- Whether to use a class or functional module pattern
- Exact error message wording for invalid transitions

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STATE-01 | State machine persists hierarchical JSON state (project > milestone > set > wave > job) with lock-protected writes | Zod schema design, lock.cjs reuse, atomic rename pattern |
| STATE-02 | State transitions validated -- cannot skip states | Hand-rolled transition maps per entity, hard error on invalid transitions |
| STATE-03 | Sets/Waves/Jobs data model with DAG computation extending dag.cjs | Extend dag.cjs for v2.0 node types, DAG.json separate file |
| STATE-05 | All inter-agent outputs use structured format (JSON/structured markdown) for reliable parsing | Extend returns.cjs RAPID:RETURN protocol with schema validation at handoff |
| UX-03 | State updated at every step so user can /clear context between phases | STATE.json auto-committed at workflow boundaries, corruption detection |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 3.24.x | Runtime schema validation for STATE.json | Locked decision; matches gsd_merge_agent patterns; works with CommonJS require() |
| proper-lockfile | 4.1.x | Lock-protected atomic writes | Already installed, proven in lock.cjs |
| node:fs | built-in | File I/O, renameSync for atomic writes | No external dep needed |
| node:test | built-in | Test framework | Established project pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:assert/strict | built-in | Test assertions | All tests |
| node:path | built-in | Path manipulation | STATE.json path construction |
| node:child_process | built-in | Git operations | Auto-committing STATE.json at workflow boundaries |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zod 3.24.x | Zod 4.x | Zod 4 has CommonJS issues (module resolution problems); 3.24.x is proven stable |
| Zod | AJV (already installed) | AJV lacks the ergonomic API; Zod gives .parse(), .safeParse(), z.enum() -- decision locked to Zod |
| Hand-rolled FSM | XState | XState is overkill for ~50 lines per entity; decision locked to hand-rolled |

**Installation:**
```bash
cd ~/Projects/RAPID && npm install zod@3.24.4
```

**Rationale for Zod 3.24.4 specifically:** Zod 3.25.x introduced a `"type": "module"` change in package.json that broke CommonJS `require('zod')`. Versions 3.24.4 and earlier are confirmed safe for plain `require()`.

## Architecture Patterns

### Recommended Project Structure
```
src/lib/
  state-machine.cjs          # Main module (replaces state.cjs)
  state-machine.test.cjs     # Tests
  state-schemas.cjs           # Zod schemas (separate file for clarity)
  state-schemas.test.cjs      # Schema tests
  state-transitions.cjs       # Transition maps + validation logic
  state-transitions.test.cjs  # Transition tests
  dag.cjs                     # Extended with v2.0 node types
  dag.test.cjs                # Extended tests
  lock.cjs                    # Reused as-is
  returns.cjs                 # Extended with schema validation at handoff
```

### Pattern 1: Zod Schema Design (CommonJS)
**What:** Define hierarchical STATE.json schema with Zod in plain JavaScript
**When to use:** All state read/write operations
**Example:**
```javascript
// state-schemas.cjs
'use strict';
const { z } = require('zod');

const JobStatus = z.enum(['pending', 'executing', 'complete', 'failed']);

const JobState = z.object({
  id: z.string(),
  status: JobStatus.default('pending'),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  commitSha: z.string().optional(),
  artifacts: z.array(z.string()).default([]),
});

const WaveStatus = z.enum(['pending', 'discussing', 'planning', 'executing', 'reconciling', 'complete']);

const WaveState = z.object({
  id: z.string(),
  status: WaveStatus.default('pending'),
  jobs: z.array(JobState).default([]),
});

const SetStatus = z.enum(['pending', 'planning', 'executing', 'reviewing', 'merging', 'complete']);

const SetState = z.object({
  id: z.string(),
  status: SetStatus.default('pending'),
  waves: z.array(WaveState).default([]),
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

module.exports = {
  JobStatus, JobState,
  WaveStatus, WaveState,
  SetStatus, SetState,
  MilestoneState, ProjectState,
};
```

### Pattern 2: Hand-Rolled Transition Maps
**What:** Simple object mapping current state to valid next states, with a validate function
**When to use:** Every state transition call
**Example:**
```javascript
// state-transitions.cjs
'use strict';

const SET_TRANSITIONS = {
  pending:   ['planning'],
  planning:  ['executing'],
  executing: ['reviewing'],
  reviewing: ['merging'],
  merging:   ['complete'],
  complete:  [],  // terminal
};

const WAVE_TRANSITIONS = {
  pending:       ['discussing'],
  discussing:    ['planning'],
  planning:      ['executing'],
  executing:     ['reconciling'],
  reconciling:   ['complete'],
  complete:      [],  // terminal
};

const JOB_TRANSITIONS = {
  pending:   ['executing'],
  executing: ['complete', 'failed'],
  complete:  [],  // terminal
  failed:    ['executing'],  // retry allowed
};

function validateTransition(entityType, currentStatus, nextStatus) {
  const map = { set: SET_TRANSITIONS, wave: WAVE_TRANSITIONS, job: JOB_TRANSITIONS }[entityType];
  if (!map) throw new Error(`Unknown entity type: ${entityType}`);

  const allowed = map[currentStatus];
  if (!allowed) throw new Error(`Unknown status "${currentStatus}" for ${entityType}`);

  if (!allowed.includes(nextStatus)) {
    const validOptions = allowed.length > 0 ? allowed.join(', ') : '(none -- terminal state)';
    throw new Error(
      `Invalid ${entityType} transition: "${currentStatus}" -> "${nextStatus}". ` +
      `Valid transitions from "${currentStatus}": ${validOptions}`
    );
  }
}

module.exports = { SET_TRANSITIONS, WAVE_TRANSITIONS, JOB_TRANSITIONS, validateTransition };
```

### Pattern 3: Atomic Write with Lock
**What:** Lock-protected write with tmp-file + rename for crash safety
**When to use:** Every STATE.json mutation
**Example:**
```javascript
// Inside state-machine.cjs
async function writeState(cwd, state) {
  const release = await acquireLock(cwd, 'state-machine');
  try {
    const validated = ProjectState.parse(state);
    validated.lastUpdatedAt = new Date().toISOString();
    const json = JSON.stringify(validated, null, 2);
    const statePath = path.join(cwd, '.planning', 'STATE.json');
    const tmpPath = statePath + '.tmp';
    fs.writeFileSync(tmpPath, json, 'utf-8');
    fs.renameSync(tmpPath, statePath);
  } finally {
    await release();
  }
}
```

### Pattern 4: Parent State Derived from Children
**What:** Compute parent entity status from child statuses instead of storing independently
**When to use:** After any child status change
**Example:**
```javascript
function deriveParentStatus(childStatuses) {
  if (childStatuses.every(s => s === 'pending')) return 'pending';
  if (childStatuses.every(s => s === 'complete')) return 'complete';
  if (childStatuses.some(s => s === 'executing')) return 'executing';
  if (childStatuses.some(s => s === 'failed') && !childStatuses.some(s => s === 'executing')) return 'failed';
  // Fallback: if some complete, some pending, none executing/failed
  return 'executing';
}
```

Note: This derivation pattern works for Waves (deriving from Jobs) and potentially Sets (deriving from Waves). The exact mapping between child entity statuses and parent statuses needs careful thought since child status enums differ from parent status enums. For example, a Wave has status "discussing" but its parent Set has no equivalent -- the Set should show "executing" whenever any Wave is actively in progress.

### Pattern 5: Structured Inter-Agent Output Schema Validation
**What:** Validate RAPID:RETURN payloads with Zod schemas at handoff points
**When to use:** Every inter-agent boundary
**Example:**
```javascript
const ReturnPayload = z.object({
  status: z.enum(['COMPLETE', 'CHECKPOINT', 'BLOCKED']),
  artifacts: z.array(z.string()).optional(),
  tasks_completed: z.number().optional(),
  tasks_total: z.number().optional(),
  // ... other fields per status type
});

function validateHandoff(agentOutput) {
  const { parsed, data, error } = parseReturn(agentOutput);
  if (!parsed) throw new Error(`Handoff parse failed: ${error}`);
  return ReturnPayload.parse(data); // throws ZodError on invalid
}
```

### Anti-Patterns to Avoid
- **Storing derived state:** Do NOT persist Wave/Set computed status independently. Always derive from children. Storing it creates inconsistency risk.
- **Direct file writes without lock:** Every STATE.json write MUST go through acquireLock(). Even reads during transitions should be inside the lock to prevent TOCTOU races.
- **Partial writes:** Never write STATE.json directly. Always write to .tmp then rename. A crash during write leaves .tmp (gitignored) and STATE.json intact.
- **Embedded DAG in state:** DAG.json is separate by design. State references DAG by convention. Never duplicate dependency info into STATE.json.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation | Custom type checking | Zod z.object/z.enum/z.array | Zod gives .parse(), .safeParse(), precise error messages, defaults -- locked decision |
| File locking | Custom lock mechanism | lock.cjs (proper-lockfile) | Already proven, handles stale detection, retry backoff |
| Atomic file writes | Custom write logic | fs.writeFileSync + fs.renameSync pattern | OS-level atomicity guarantee on same filesystem |
| Topological sort | Custom graph algorithm | dag.cjs toposort/assignWaves | Already tested, handles cycle detection, wave assignment |
| Structured returns | Custom serialization | returns.cjs parseReturn/generateReturn | Already handles COMPLETE/CHECKPOINT/BLOCKED with validation |

**Key insight:** The existing lib/ modules handle the hard infrastructure problems (locking, DAG, returns). This phase is about building a clean state layer ON TOP of them, not replacing them.

## Common Pitfalls

### Pitfall 1: Zod Version Compatibility with CommonJS
**What goes wrong:** Installing Zod 3.25+ or 4.x breaks `require('zod')` in CommonJS projects
**Why it happens:** Zod 3.25+ changed package.json to include `"type": "module"` which breaks CJS require(). Zod 4 uses subpath exports (`zod/v4`) that don't resolve in CJS without TypeScript.
**How to avoid:** Pin to `zod@3.24.4` explicitly in package.json
**Warning signs:** `Error: require() of ES Module` or `Cannot find module 'zod'`

### Pitfall 2: TOCTOU Race in Read-Modify-Write
**What goes wrong:** Two processes read STATE.json, both modify, second write overwrites first's changes
**Why it happens:** Lock not held across the full read-modify-write cycle
**How to avoid:** Always hold the lock from read through write. The `writeState` function should read, validate, modify, and write within a single lock hold.
**Warning signs:** Sporadic state "jumps" where job completions disappear

### Pitfall 3: Parent Status Derivation with Mixed Enums
**What goes wrong:** Trying to derive Set status from Wave statuses when they have different enum values
**Why it happens:** Wave has "discussing", "reconciling" which don't exist in Set enum. Set has "reviewing", "merging" which don't exist in Wave enum.
**How to avoid:** Map child statuses to semantic categories (idle/active/done/failed) then map categories to parent status enum. Don't try to match string values directly.
**Warning signs:** Invalid parent status values, schema validation failures

### Pitfall 4: Circular Dependency Between State and DAG
**What goes wrong:** State module imports DAG module which imports state module
**Why it happens:** DAG needs state to know completion status; state needs DAG to know what's next
**How to avoid:** Keep them decoupled. State module reads DAG.json directly when needed (file read, not import). DAG module never imports state.
**Warning signs:** `require()` returns empty object, cryptic "undefined is not a function" errors

### Pitfall 5: Forgetting to Gitignore STATE.json.tmp
**What goes wrong:** Temporary files get committed, confusing state recovery
**Why it happens:** No .gitignore entry for the tmp file
**How to avoid:** Add `STATE.json.tmp` to `.planning/.gitignore` in Wave 0 setup
**Warning signs:** `git status` shows STATE.json.tmp as untracked

### Pitfall 6: Auto-Commit Trigger Scope
**What goes wrong:** Committing STATE.json too often (on every field update) or too rarely (only on set completion)
**Why it happens:** Unclear about "workflow boundaries"
**How to avoid:** Commit at: job complete/fail, wave status changes, set status changes. Do NOT commit on intermediate progress (e.g., job startedAt timestamp updates).
**Warning signs:** Git history cluttered with state commits, or state lost after context reset

## Code Examples

### Reading STATE.json with Validation
```javascript
// Source: project conventions + Zod docs
function readState(cwd) {
  const statePath = path.join(cwd, '.planning', 'STATE.json');
  if (!fs.existsSync(statePath)) return null;

  const raw = fs.readFileSync(statePath, 'utf-8');
  const parsed = JSON.parse(raw);
  const result = ProjectState.safeParse(parsed);

  if (!result.success) {
    return { valid: false, errors: result.error.issues };
  }
  return { valid: true, state: result.data };
}
```

### Transitioning a Job Status
```javascript
async function transitionJob(cwd, milestoneId, setId, waveId, jobId, newStatus) {
  const release = await acquireLock(cwd, 'state-machine');
  try {
    const state = readStateOrThrow(cwd);
    const job = findJob(state, milestoneId, setId, waveId, jobId);

    validateTransition('job', job.status, newStatus);

    job.status = newStatus;
    if (newStatus === 'executing') job.startedAt = new Date().toISOString();
    if (newStatus === 'complete' || newStatus === 'failed') job.completedAt = new Date().toISOString();

    // Re-derive wave status from jobs
    const wave = findWave(state, milestoneId, setId, waveId);
    wave.status = deriveWaveStatus(wave.jobs);

    writeStateUnsafe(cwd, state); // already inside lock
    return { transitioned: true, from: job.status, to: newStatus };
  } finally {
    await release();
  }
}
```

### Corruption Detection and Recovery
```javascript
function detectCorruption(cwd) {
  const statePath = path.join(cwd, '.planning', 'STATE.json');
  if (!fs.existsSync(statePath)) return { exists: false };

  try {
    const raw = fs.readFileSync(statePath, 'utf-8');
    JSON.parse(raw); // Valid JSON?
    const result = ProjectState.safeParse(JSON.parse(raw));
    if (!result.success) {
      return { exists: true, corrupt: true, reason: 'Schema validation failed', errors: result.error.issues };
    }
    return { exists: true, corrupt: false };
  } catch (err) {
    return { exists: true, corrupt: true, reason: `Parse error: ${err.message}` };
  }
}

function recoverFromGit(cwd) {
  const { execSync } = require('child_process');
  execSync('git checkout HEAD -- .planning/STATE.json', { cwd });
}
```

### Extending DAG for v2.0
```javascript
// In dag.cjs -- extend createDAG to support v2.0 node types
// v1.0 nodes: { id: string }
// v2.0 nodes: { id: string, type: 'set' | 'wave' | 'job', parentId?: string }

function createDAGv2(nodes, edges) {
  // Validate that edges only connect same-type or parent-child relationships
  // Reuse existing toposort and assignWaves
  const sorted = toposort(nodes, edges);
  const waveMap = assignWaves(nodes, edges);

  // Build v2 structure with type-aware metadata
  const dagNodes = nodes.map(node => ({
    ...node,
    wave: waveMap[node.id],
    status: 'pending',
  }));

  return { version: 2, nodes: dagNodes, edges, /* ... */ };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| STATE.md (Markdown) | STATE.json (JSON + Zod) | Phase 16 (now) | Machine-parseable, validated, crash-recoverable |
| Regex field extraction | Zod .parse() / .safeParse() | Phase 16 (now) | Precise errors, defaults, type safety |
| No transition validation | Explicit transition maps | Phase 16 (now) | Invalid state changes impossible |
| Flat state (phase/plan level) | Hierarchical (project > milestone > set > wave > job) | Phase 16 (now) | Supports v2.0 parallel execution model |

**Deprecated/outdated:**
- `state.cjs` (stateGet/stateUpdate): Markdown-based, no schema validation, no transition enforcement. Replaced entirely by state-machine.cjs. Consumers updated in Phase 17 adapter layer.

## Open Questions

1. **Wave status derivation semantics**
   - What we know: Parent status is derived from children. Rules: all pending = pending, any executing = executing, all complete = complete, any failed + none executing = failed.
   - What's unclear: How do intermediate Wave statuses ("discussing", "planning", "reconciling") map to Set's "executing" umbrella? The derivation rules in CONTEXT.md use generic terms but the actual enums differ per level.
   - Recommendation: Treat any non-pending, non-complete, non-failed child status as "active" and map to parent's active equivalent. For Set, "active" = whichever status makes sense based on the Set's own enum. The planner should define an explicit mapping table.

2. **STATE.json initial creation**
   - What we know: STATE.json is the only format, no migration needed.
   - What's unclear: Which command creates the initial STATE.json? Is it /rapid:init (Phase 18) or should state-machine.cjs provide a `createInitialState()` function?
   - Recommendation: Provide `createInitialState(projectName)` in state-machine.cjs that creates a minimal valid STATE.json. Phase 18's init command will call it.

3. **Structured output schema validation (STATE-05)**
   - What we know: returns.cjs already has RAPID:RETURN protocol with COMPLETE/CHECKPOINT/BLOCKED.
   - What's unclear: Does STATE-05 mean adding Zod validation to the existing returns.cjs, or creating new schemas for future agent output formats?
   - Recommendation: Add Zod-based validation to returns.cjs that validates the JSON payload inside RAPID:RETURN markers. Keep the existing validation function as fallback. This gives schema-level guarantees at every handoff.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node.js 20+) |
| Config file | none -- tests run via `node --test src/lib/*.test.cjs` |
| Quick run command | `node --test src/lib/state-machine.test.cjs src/lib/state-schemas.test.cjs src/lib/state-transitions.test.cjs` |
| Full suite command | `node --test src/lib/*.test.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STATE-01 | Hierarchical JSON state persists with lock-protected writes | unit | `node --test src/lib/state-machine.test.cjs` | Wave 0 |
| STATE-02 | Invalid transitions produce hard errors | unit | `node --test src/lib/state-transitions.test.cjs` | Wave 0 |
| STATE-03 | DAG computation for Sets/Waves/Jobs | unit | `node --test src/lib/dag.test.cjs` | Exists (extend) |
| STATE-05 | Structured output with schema validation at handoff | unit | `node --test src/lib/returns.test.cjs` | Exists (extend) |
| UX-03 | State updated at every step, corruption detection works | unit | `node --test src/lib/state-machine.test.cjs` | Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test src/lib/state-machine.test.cjs src/lib/state-schemas.test.cjs src/lib/state-transitions.test.cjs`
- **Per wave merge:** `node --test src/lib/*.test.cjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/state-schemas.test.cjs` -- covers STATE-01 schema validation
- [ ] `src/lib/state-transitions.test.cjs` -- covers STATE-02 transition enforcement
- [ ] `src/lib/state-machine.test.cjs` -- covers STATE-01 read/write, UX-03 corruption detection
- [ ] `zod@3.24.4` installation -- `npm install zod@3.24.4`
- [ ] `.planning/.gitignore` entry for `STATE.json.tmp`

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/lib/lock.cjs`, `src/lib/dag.cjs`, `src/lib/state.cjs`, `src/lib/returns.cjs` -- read directly
- Existing codebase: `mark2-plans/gsd_merge_agent/schemas/state.ts` -- Zod schema patterns reference
- CONTEXT.md: All locked decisions and implementation specifics

### Secondary (MEDIUM confidence)
- [Zod npm](https://www.npmjs.com/package/zod) -- version info and CJS compatibility
- [Zod CommonJS Issue #4372](https://github.com/colinhacks/zod/issues/4372) -- Zod 4 CJS problems, confirming 3.x is correct choice
- [Zod CJS Issue #4434](https://github.com/colinhacks/zod/issues/4434) -- Zod 3.25+ broke CJS require

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are already installed or well-understood; Zod CJS compatibility verified
- Architecture: HIGH - Patterns directly follow CONTEXT.md locked decisions and existing codebase conventions
- Pitfalls: HIGH - Based on actual codebase analysis (Zod version issue verified via GitHub issues, TOCTOU from lock.cjs patterns)
- Transition design: HIGH - Exact states and transitions specified in CONTEXT.md
- Parent derivation: MEDIUM - General rules specified but exact cross-enum mapping needs planner attention

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (30 days -- stable domain, no fast-moving dependencies)
