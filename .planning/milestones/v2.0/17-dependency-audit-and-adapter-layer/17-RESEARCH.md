# Phase 17: Dependency Audit and Adapter Layer - Research

**Researched:** 2026-03-06
**Domain:** v1.0 module coupling to old state structures, direct rewrite to state-machine.cjs
**Confidence:** HIGH

## Summary

Phase 17 maps all v1.0 lib module coupling to old data structures (STATE.md, flat filesystem conventions) and rewrites state-coupled code to use state-machine.cjs directly. The audit reveals that **only 3 modules + 1 CLI file** have direct state coupling that needs rewriting: `state.cjs` (delete), `rapid-tools.cjs` (rewrite `handleState`), `worktree.cjs` (minor -- OWNERSHIP.json reads only, no STATE.md coupling), and `init.cjs` (generates STATE.md template). The remaining modules (`execute.cjs`, `merge.cjs`, `plan.cjs`) operate on filesystem artifacts (.planning/sets/, OWNERSHIP.json, DAG.json) and do NOT read/write STATE.md -- their state coupling is exclusively via the worktree registry (REGISTRY.json), not the state file. This means Phase 17's rewrite scope is narrower than initially expected: the primary work is (1) deleting state.cjs, (2) rewriting rapid-tools.cjs state commands, (3) updating init.cjs to also create STATE.json, and (4) documenting the full dependency map.

**Primary recommendation:** Sequence work as: dependency map first (documentation), then state.cjs deletion, then rapid-tools.cjs rewrite, then init.cjs update, then integration tests. worktree/merge/execute/plan modules have no STATE.md coupling to rewrite -- their filesystem artifact usage (.planning/sets/) is orthogonal to state management and will be addressed in their dedicated phases (19-23).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- No separate adapter module -- rewrite state-coupled code in each v1.0 module directly to use state-machine.cjs
- V1.0 modules keep their filesystem artifacts (.planning/sets/, .planning/worktrees/, .planning/contracts/) alongside STATE.json -- dual source with STATE.json as authoritative
- State updates are synchronous -- state-machine.cjs transition functions called immediately when modules perform actions (matches lock-protected write pattern from Phase 16)
- All rewritten code uses v2.0 terminology (sets/waves/jobs) consistently -- no backwards-compatible aliases
- **state.cjs**: Delete entirely (and state.test.cjs). Replaced by state-machine.cjs. Clean break, no migration
- **rapid-tools.cjs**: Rewrite CLI state commands to use state-machine.cjs with new hierarchy-aware API
- **worktree.cjs**: Rewrite state-coupled parts to use state-machine.cjs directly. Full worktree overhaul deferred to Phase 19
- **merge.cjs**: Rewrite state-coupled parts to use state-machine.cjs directly. Full merge overhaul deferred to Phase 23
- **execute.cjs**: Rewrite state-coupled parts to use state-machine.cjs directly. Full execution rewrite in Phase 21
- **plan.cjs**: Rewrite state-coupled parts to use state-machine.cjs directly. Full planning rewrite in Phase 20
- No-coupling modules documented in dependency map with "no state coupling, no changes needed" note
- Dependency map: DEPENDENCY-MAP.md in phase artifact directory
- Integration tests verifying rewritten modules produce correct STATE.json transitions
- Update existing .test.cjs files for each rewritten module
- state.cjs and state.test.cjs deleted as part of this phase

### Claude's Discretion
- Exact order of module rewrites (dependency-aware sequencing)
- Internal refactoring decisions within each module's state-coupled sections
- How much of each module's internals to touch vs. leave for dedicated phase rewrites
- DEPENDENCY-MAP.md internal structure and level of detail per module

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STATE-04 | Dependency audit maps coupling in v1.0 lib modules and creates adapter layer | Full coupling analysis completed below; state-machine.cjs API documented; all modules categorized by coupling type |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| state-machine.cjs | v1 (Phase 16) | Hierarchical state management | readState/writeState/find*/transition* -- the target API for all rewrites |
| state-schemas.cjs | v1 (Phase 16) | Zod validation for ProjectState | Boundary validation for all state writes |
| state-transitions.cjs | v1 (Phase 16) | Transition validation maps | Prevents invalid state transitions |
| zod | 3.24.4 | Schema validation | Locked for CommonJS compatibility (3.25+ breaks require) |
| node:test | Built-in (Node 18+) | Test framework | Already used for all existing .test.cjs files |
| node:assert | Built-in | Test assertions | Already used project-wide |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lock.cjs | v1 | Lock-protected writes | Already integrated into state-machine.cjs; no direct usage needed |

## Architecture Patterns

### state-machine.cjs API Surface (Target for All Rewrites)

```javascript
// Source: /home/kek/Projects/RAPID/src/lib/state-machine.cjs (verified)

// Read/Write
async readState(cwd)     // returns { valid, state } | { valid: false, errors } | null
async writeState(cwd, state)  // validates via Zod, lock-protected, atomic rename

// Finders (throw on not-found)
findMilestone(state, milestoneId)
findSet(state, milestoneId, setId)
findWave(state, milestoneId, setId, waveId)
findJob(state, milestoneId, setId, waveId, jobId)

// Transitions (lock-protected, validate, derive parent status)
async transitionJob(cwd, milestoneId, setId, waveId, jobId, newStatus)
async transitionWave(cwd, milestoneId, setId, waveId, newStatus)
async transitionSet(cwd, milestoneId, setId, newStatus)

// Utilities
createInitialState(projectName, milestoneName)
deriveWaveStatus(jobs)
deriveSetStatus(waves)
detectCorruption(cwd)
recoverFromGit(cwd)
commitState(cwd, message)
```

### Current state.cjs API (Being Deleted)

```javascript
// Source: /home/kek/Projects/RAPID/src/lib/state.cjs (verified)

stateGet(cwd, field?)    // regex-based field extraction from STATE.md markdown
stateUpdate(cwd, field, value)  // regex-based field replacement in STATE.md
```

### Key Difference: Flat vs Hierarchical

Old API (state.cjs): `stateGet(cwd, 'Status')` returns a string from markdown.
New API (state-machine.cjs): `readState(cwd)` returns a full JSON hierarchy: `{ version, projectName, currentMilestone, milestones: [{ sets: [{ waves: [{ jobs: [] }] }] }] }`.

The CLI rewrite must translate flat field-access patterns into hierarchy-aware queries.

### Pattern: Lock-Protected Atomic Writes

```javascript
// state-machine.cjs already handles this internally
// Modules should call transition functions, NOT writeState directly for status changes
await transitionJob(cwd, milestoneId, setId, waveId, jobId, 'complete');
// This: validates transition, updates timestamps, derives wave status, writes atomically
```

### Anti-Patterns to Avoid
- **Reading STATE.md directly**: All modules must use readState() from state-machine.cjs
- **Writing state without lock**: Always use writeState() or transition*() functions
- **Regex-based field extraction**: The old stateGet pattern is fragile; use structured JSON access
- **Touching module internals beyond state coupling**: worktree.cjs, merge.cjs, execute.cjs, plan.cjs have dedicated rewrite phases (19-23); only state-related code changes now

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State reading/writing | Custom file parsers | state-machine.cjs readState/writeState | Lock protection, Zod validation, atomic rename |
| Status transitions | Manual status string assignment | transitionJob/transitionWave/transitionSet | Validates transitions, updates timestamps, derives parent status |
| State validation | Manual field checking | state-schemas.cjs Zod schemas | Catches schema violations at boundaries |
| Initial state creation | Manual JSON construction | createInitialState() | Produces valid ProjectState with proper timestamps |

## Common Pitfalls

### Pitfall 1: Confusing Filesystem Artifacts with State Coupling
**What goes wrong:** Treating modules that read .planning/sets/ files as "state-coupled" when they are actually reading planning artifacts (DEFINITION.md, CONTRACT.json, OWNERSHIP.json, DAG.json)
**Why it happens:** The word "state" is overloaded -- file-based artifacts are not the same as the project state (STATE.md/STATE.json)
**How to avoid:** Only classify a module as "state-coupled" if it reads/writes STATE.md or needs to interact with the project state machine. Filesystem artifacts (.planning/sets/) are orthogonal.
**Warning signs:** If a module's "state coupling" is just reading JSON files from .planning/sets/, it is NOT state-coupled

### Pitfall 2: Over-Rewriting Modules Destined for Dedicated Phases
**What goes wrong:** Deeply rewriting worktree.cjs, merge.cjs, execute.cjs, or plan.cjs internals when they have dedicated rewrite phases (19-23)
**Why it happens:** The temptation to "fix everything while we're here"
**How to avoid:** Only touch state-coupled code (STATE.md reads/writes). Leave filesystem artifact usage, prompt assembly, verification logic, etc. for dedicated phases.
**Warning signs:** If you're modifying functions that don't reference state.cjs or STATE.md, you're probably going too deep

### Pitfall 3: init.cjs STATE.md Generation
**What goes wrong:** Forgetting that init.cjs generates STATE.md during scaffolding, so new projects still need STATE.md for v1.0 compatibility OR need STATE.json for v2.0
**Why it happens:** init.cjs doesn't import state.cjs, but it generates the file directly
**How to avoid:** Update init.cjs scaffolding to also create STATE.json via createInitialState(). Decision per CONTEXT.md: STATE.json is authoritative, but dual source is acceptable during transition.

### Pitfall 4: CLI API Compatibility
**What goes wrong:** Breaking the CLI `state get` / `state update` interface that skills/modules call via shell commands
**Why it happens:** The new hierarchy-aware API requires different arguments (milestone, set, wave, job IDs)
**How to avoid:** Design new CLI commands that are hierarchy-aware: e.g., `state get set <setId> status` instead of `state get Status`. Update the USAGE string and all module references (core-state-access.md, core-context-loading.md).

### Pitfall 5: Worktree Registry vs STATE.json Confusion
**What goes wrong:** Conflating the worktree REGISTRY.json (tracks worktree metadata, phase, path) with STATE.json (tracks project/milestone/set/wave/job status)
**Why it happens:** Both track "set status" but at different levels -- registry tracks filesystem worktree state, STATE.json tracks logical execution state
**How to avoid:** Keep them separate. The `execute update-phase` CLI command updates REGISTRY.json (worktree phase), not STATE.json (project state). Phase 19 will address whether to unify these.

## Detailed Coupling Analysis

### Modules WITH State Coupling (Need Changes)

#### 1. state.cjs -- DELETE
- **Coupling:** Directly reads/writes .planning/STATE.md via regex
- **Functions:** stateGet(), stateUpdate()
- **Consumers:** rapid-tools.cjs handleState() (line 194)
- **Action:** Delete state.cjs and state.test.cjs entirely

#### 2. rapid-tools.cjs -- REWRITE handleState()
- **Coupling:** Lines 190-231 import state.cjs and expose `state get` / `state update` CLI commands
- **Functions affected:** handleState() only
- **Action:** Rewrite to use state-machine.cjs with hierarchy-aware commands
- **New CLI shape:** `state get [--all | milestone <id> | set <milestoneId> <setId> | ...]`, `state transition <entity> <ids...> <newStatus>`

#### 3. init.cjs -- ADD STATE.json Generation
- **Coupling:** Lines 48-89 generate STATE.md content via generateStateMd()
- **Not importing state.cjs:** Generates content directly
- **Action:** Add STATE.json generation alongside STATE.md in scaffoldProject(). Use createInitialState() from state-machine.cjs.

#### 4. Agent modules (prompt .md files) -- UPDATE References
- **Files:** src/modules/core/core-state-access.md, core-context-loading.md
- **Coupling:** Reference `state get` and `state update` CLI commands in documentation
- **Action:** Update to reference new hierarchy-aware CLI commands

### Modules WITHOUT State Coupling (Document Only)

| Module | Why No Coupling | Filesystem Artifacts Used |
|--------|----------------|--------------------------|
| worktree.cjs | Uses REGISTRY.json, OWNERSHIP.json; no STATE.md/STATE.json | .planning/worktrees/REGISTRY.json, .planning/sets/OWNERSHIP.json |
| merge.cjs | Uses plan.loadSet, worktree.loadRegistry, DAG.json; no STATE.md | .planning/sets/{name}/, DAG.json, OWNERSHIP.json |
| execute.cjs | Uses worktree, plan, verify, contract; no STATE.md | .planning/sets/{name}/DEFINITION.md, CONTRACT.json, OWNERSHIP.json |
| plan.cjs | Uses dag.cjs, contract.cjs; no STATE.md | .planning/sets/, .planning/contracts/, DAG.json, OWNERSHIP.json, GATES.json |
| lock.cjs | Pure lock mechanism | .planning/locks/ |
| prereqs.cjs | System prerequisites only | None |
| stub.cjs | Contract stub generation | .planning/sets/{name}/CONTRACT.json |
| assembler.cjs | Prompt assembly | src/modules/ |
| core.cjs | Utility functions | .planning/ (findProjectRoot) |
| verify.cjs | Artifact verification | Checks file existence only |
| teams.cjs | Agent team detection | Environment only |
| context.cjs | Codebase analysis | .planning/context/ |
| contract.cjs | Contract operations | .planning/sets/{name}/CONTRACT.json |
| dag.cjs | DAG computation | No files (pure functions) |
| returns.cjs | Return parsing | No state files (parses agent output) |

### Important Clarification: worktree.cjs, merge.cjs, execute.cjs, plan.cjs

The CONTEXT.md lists these as needing "state-coupled parts rewritten." However, code analysis reveals:

- **worktree.cjs**: Zero imports of state.cjs. Uses REGISTRY.json (its own registry) and OWNERSHIP.json (planning artifact). No STATE.md coupling.
- **merge.cjs**: Zero imports of state.cjs. Uses plan.loadSet, worktree, execute, contract, dag. No STATE.md coupling.
- **execute.cjs**: Zero imports of state.cjs. Uses worktree, plan, verify, contract. No STATE.md coupling.
- **plan.cjs**: Zero imports of state.cjs. Uses dag, contract. No STATE.md coupling.

These modules interact with the **planning filesystem** (.planning/sets/), not the **project state** (STATE.md/STATE.json). Their filesystem conventions will be updated in their dedicated phases (19-23). The only "state" update they do is via `worktree.registryUpdate()` which modifies REGISTRY.json, not STATE.md.

**Recommendation:** Document these modules in DEPENDENCY-MAP.md as "no STATE.md/STATE.json coupling; filesystem artifact usage deferred to Phase {N}" and DO NOT rewrite them in Phase 17.

## Code Examples

### Rewriting rapid-tools.cjs handleState()

```javascript
// Source: Pattern based on state-machine.cjs API (verified)

async function handleState(cwd, subcommand, args) {
  const sm = require('../lib/state-machine.cjs');

  switch (subcommand) {
    case 'get': {
      const useAll = args.includes('--all');
      const result = await sm.readState(cwd);
      if (!result) {
        error('STATE.json not found. Run init first.');
        process.exit(1);
      }
      if (!result.valid) {
        error('STATE.json is invalid: ' + JSON.stringify(result.errors));
        process.exit(1);
      }
      if (useAll) {
        process.stdout.write(JSON.stringify(result.state, null, 2) + '\n');
      } else {
        // Hierarchy-aware field access: state get set <milestoneId> <setId>
        const entity = args[0];
        // ... entity-specific lookup using find* helpers
      }
      break;
    }

    case 'transition': {
      // state transition job <milestoneId> <setId> <waveId> <jobId> <newStatus>
      const entity = args[0];
      // ... route to transitionJob/transitionWave/transitionSet
      break;
    }
  }
}
```

### Adding STATE.json to init.cjs scaffolding

```javascript
// Source: Pattern based on state-machine.cjs createInitialState (verified)
const { createInitialState, writeState } = require('./state-machine.cjs');

// In scaffoldProject, after writing STATE.md:
const initialState = createInitialState(projectName, 'v1.0');
// Write STATE.json directly (no lock needed during init -- no concurrent access)
const stateJsonPath = path.join(planningDir, 'STATE.json');
fs.writeFileSync(stateJsonPath, JSON.stringify(initialState, null, 2), 'utf-8');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| STATE.md with regex parsing | STATE.json with Zod-validated hierarchical schema | Phase 16 (2026-03-06) | All state operations now go through state-machine.cjs |
| Flat key-value fields (Status, Phase) | Hierarchical project > milestone > set > wave > job | Phase 16 | CLI needs hierarchy-aware commands |
| Lock on 'state' name | Lock on 'state-machine' name | Phase 16 | Lock name changed; old 'state' lock no longer relevant |
| v1.0 terminology (sets in DAG waves) | v2.0 terminology (sets/waves/jobs in milestones) | Phase 16 | All new code uses v2.0 terms |

## Open Questions

1. **init.cjs: Should STATE.md still be generated?**
   - What we know: CONTEXT.md says "dual source with STATE.json as authoritative"
   - What's unclear: Should init.cjs keep generating STATE.md alongside STATE.json, or only STATE.json?
   - Recommendation: Keep generating both for now (dual source). Phase 18 (init rewrite) will make the final call. For Phase 17, just add STATE.json generation.

2. **Worktree registry + STATE.json alignment**
   - What we know: `execute update-phase` updates REGISTRY.json phase field, which tracks worktree lifecycle (Discussing/Planning/Executing/etc). STATE.json tracks logical execution state (set/wave/job statuses).
   - What's unclear: Should `execute update-phase` also call transitionSet/transitionWave when it updates the registry?
   - Recommendation: Do NOT add this coupling in Phase 17. Document it in DEPENDENCY-MAP.md as a future integration point for Phase 19/21.

3. **Agent module .md files referencing old CLI**
   - What we know: core-state-access.md and core-context-loading.md reference `state get` and `state update`
   - What's unclear: Whether to update these in Phase 17 or defer to Phase 18 (init/module rewrite)
   - Recommendation: Update them minimally in Phase 17 to reference new CLI commands. Full agent module rewrite is Phase 18+.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node 18+) |
| Config file | None needed -- uses `node --test` runner |
| Quick run command | `node --test src/lib/state-machine.test.cjs` |
| Full suite command | `node --test src/lib/*.test.cjs` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STATE-04a | Dependency map documents all module coupling | Documentation review | Manual verification | N/A |
| STATE-04b | state.cjs deleted, no remaining imports | Integration | `node -e "try{require('./src/lib/state.cjs');process.exit(1)}catch{}"` | No -- Wave 0 |
| STATE-04c | rapid-tools.cjs state commands use state-machine.cjs | Integration | `node --test src/lib/state-machine.test.cjs` | Exists (state-machine.test.cjs) |
| STATE-04d | init.cjs generates STATE.json | Unit | `node --test src/lib/init.test.cjs` | Exists (needs update) |
| STATE-04e | Rewritten modules produce correct STATE.json transitions | Integration | `node --test src/lib/state-machine.lifecycle.test.cjs` | Exists |

### Sampling Rate
- **Per task commit:** `node --test src/lib/state-machine.test.cjs`
- **Per wave merge:** `node --test src/lib/*.test.cjs`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps
- [ ] Update `src/lib/init.test.cjs` to verify STATE.json is created during scaffolding
- [ ] Create integration test verifying state.cjs is fully removed and no modules import it
- [ ] Update rapid-tools.cjs CLI tests (if any) to test new hierarchy-aware state commands

## Sources

### Primary (HIGH confidence)
- Direct code analysis of all src/lib/*.cjs and src/bin/rapid-tools.cjs modules
- state-machine.cjs, state-schemas.cjs, state-transitions.cjs API verified by reading source
- state.cjs coupling verified by grep for require() and function calls

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions from user discussion session
- Phase 16 completion evidence in STATE.md

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already exist in the project, versions locked
- Architecture: HIGH - state-machine.cjs API fully documented from source code
- Pitfalls: HIGH - Coupling analysis based on exhaustive grep of all source files
- Coupling scope: HIGH - Every module verified for state.cjs/STATE.md/STATE.json references

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- internal project, no external dependency changes)
