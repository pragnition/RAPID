# Phase 7: Execution Lifecycle - Research

**Researched:** 2026-03-04
**Domain:** CLI lifecycle management, state machines, file-based reconciliation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Status Dashboard:** Unified table layout -- single table showing all sets with columns: set name, wave, lifecycle phase, progress, last activity. 5-phase lifecycle tracking per set: Discuss, Plan, Execute, Verify, Merge. ASCII progress bar within phases: `Execute [===----] 3/7` showing sub-task completion. Wave summary header line above the table. Enhances existing `/rapid:status` skill.
- **Pause/Resume Flow:** Dual trigger: explicit `/rapid:pause {setName}` command AND automatic CHECKPOINT emission before context window limit. Subagent should emit CHECKPOINT proactively before hitting context limit. Persist handoff file only: HANDOFF.md in the set's `.planning/` directory with CHECKPOINT data (done, remaining, resume instructions). No WIP commits or file snapshots needed. Resume spawns a new subagent with full replay: original plan PLUS handoff content. Warn after 3 pause/resume cycles on the same set.
- **Sync Gate Rules:** Artifact-based gate checks: verify existence of plan artifacts (`.planning/sets/{set}/PLAN.md` or equivalent) rather than relying on registry status alone. Per-wave scope: only sets in the current wave need completed plans. Override with interactive confirmation. Gate error message shows both blocked and ready sets.
- **Wave Reconciliation:** Compare artifacts + contracts: verify all planned artifacts exist and all interface contracts are satisfied. Detailed report format: per-set sections with what was planned vs delivered, contract compliance details, specific gaps found. Categorized blocking: contract violations are hard blocks, missing artifacts are soft blocks. Auto with review: reconciliation runs automatically when last set in a wave completes, presents results, waits for developer acknowledgment. Per-wave summary files: `.planning/waves/WAVE-{N}-SUMMARY.md`.

### Claude's Discretion
- Exact progress bar ASCII design and character choices
- Dashboard column widths and alignment
- HANDOFF.md internal format and structure
- How "proactive CHECKPOINT before context limit" is implemented in the subagent prompt
- Specific wording of gate override confirmation prompts
- SUMMARY.md detailed section structure and formatting

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXEC-04 | Developer can run `/rapid:status` to see progress across all sets and all phases | Enhance existing `formatStatusTable()` and `formatWaveSummary()` in worktree.cjs; add lifecycle phase column, progress bar column, last activity timestamp; rework status SKILL.md to show unified dashboard |
| EXEC-05 | Developer can pause work on a set and resume later with full state restoration (handoff files) | New HANDOFF.md file in `.planning/sets/{set}/`; new `/rapid:pause` skill; CHECKPOINT return data maps directly to handoff content; resume logic in `/rapid:execute` reads HANDOFF.md and replays context; pause cycle counter in registry |
| EXEC-07 | Loose sync gates enforce: all sets must finish planning before any begins execution; execution is independent per set | Enhance existing `checkPlanningGate()` in plan.cjs to do artifact-based checks (verify PLAN.md or equivalent files exist on disk, not just registry status); add gate override mechanism with interactive confirmation; per-wave scope enforcement |
| EXEC-08 | Mandatory reconciliation after each execution wave -- compare plan vs actual, create SUMMARY with pass/fail on acceptance criteria, block next wave until reconciled | New `reconcileWave()` function in execute.cjs; compares planned artifacts vs actual, checks contract compliance; generates `.planning/waves/WAVE-{N}-SUMMARY.md`; hard/soft block categorization; execution gate blocks next wave until reconciled |
</phase_requirements>

## Summary

Phase 7 extends the RAPID execution infrastructure built in Phase 6 with four lifecycle management capabilities: a unified status dashboard, session pause/resume, sync gate enforcement, and mandatory wave reconciliation. The codebase already contains significant foundation for all four features -- the registry/DAG/gate/return infrastructure is fully in place.

The primary technical work is: (1) reworking the status display functions to show richer per-set lifecycle data with progress bars, (2) creating a handoff file mechanism that bridges CHECKPOINT return data to new subagent sessions, (3) strengthening the existing planning gate to verify artifacts on disk rather than just registry state, and (4) building a reconciliation engine that compares planned deliverables against actual git artifacts and contract test results.

**Primary recommendation:** Extend existing modules (worktree.cjs, execute.cjs, plan.cjs) with new functions rather than creating new library files. The four features share the same state substrate (registry, DAG, GATES.json) and follow established CLI/skill patterns.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (fs, path, child_process) | 18+ | All file I/O, git commands, process control | Zero-dependency project convention |
| node:test + node:assert/strict | built-in | Unit testing | Project convention since Phase 1 (01-01 decision) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| proper-lockfile (mkdir strategy) via lock.cjs | N/A (custom) | Cross-process atomic state updates | Any write to REGISTRY.json, GATES.json, or wave SUMMARY files |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ASCII progress bars (custom) | cli-progress, progress | External dependency for a 10-line function -- not worth it for this project's zero-dep convention |
| Markdown SUMMARY files | JSON summaries | User decision locks Markdown format for wave summaries; JSON used only for machine state |

**Installation:**
```bash
# No new dependencies required -- all built on existing codebase
```

## Architecture Patterns

### Recommended Project Structure
```
rapid/
├── src/
│   ├── lib/
│   │   ├── worktree.cjs    # EXTEND: formatStatusTable, formatWaveSummary, progress bar
│   │   ├── execute.cjs     # EXTEND: reconcileWave, generateWaveSummary
│   │   ├── plan.cjs        # EXTEND: checkPlanningGateArtifact, gateOverride
│   │   └── returns.cjs     # EXISTING: CHECKPOINT status already supports handoff fields
│   └── bin/
│       └── rapid-tools.cjs # EXTEND: new subcommands (pause, resume, reconcile, enhanced status)
├── skills/
│   ├── status/SKILL.md     # REWRITE: unified dashboard with progress bars
│   ├── execute/SKILL.md    # EXTEND: pause/resume integration, gate checks, reconciliation
│   ├── pause/SKILL.md      # NEW: explicit pause command
│   └── reconcile/SKILL.md  # NEW or inline in execute -- wave reconciliation trigger
└── ...
.planning/
├── sets/{set}/
│   ├── HANDOFF.md          # NEW: pause/resume state per set
│   └── ... (existing DEFINITION.md, CONTRACT.json)
└── waves/
    └── WAVE-{N}-SUMMARY.md # NEW: per-wave reconciliation reports
```

### Pattern 1: Enhanced Status Dashboard
**What:** Rework `formatStatusTable()` to show 5-phase lifecycle with progress bars
**When to use:** Whenever `/rapid:status` is invoked
**Example:**
```
Wave 1: 2/3 complete | Wave 2: 0/2 pending | Wave 3: 0/1 pending

SET           WAVE  PHASE              PROGRESS          LAST ACTIVITY
───────────── ────  ─────────────────  ────────────────  ─────────────
auth-core     1     Execute [===---]   3/6 tasks         2 min ago
db-schema     1     Done               6/6 tasks         15 min ago
config-mgr    1     Plan               -                 5 min ago
api-routes    2     Pending            -                 -
ui-shell      2     Pending            -                 -
```

**Key implementation details:**
- 5 phases: Discuss, Plan, Execute, Verify, Merge (matching CONTEXT.md)
- Progress bar only shown during Execute phase (sub-task granularity)
- "Last activity" derived from registry `updatedAt` timestamp (add field)
- Column widths auto-calculated per existing `formatStatusTable()` pattern
- Wave summary header above table per existing `formatWaveSummary()` pattern

### Pattern 2: Handoff File for Pause/Resume
**What:** Bridge CHECKPOINT return data to persistent HANDOFF.md for session recovery
**When to use:** Explicit `/rapid:pause` or automatic CHECKPOINT before context limit

**HANDOFF.md structure (Claude's discretion):**
```markdown
---
set: auth-core
paused_at: 2026-03-04T12:00:00Z
pause_cycle: 1
phase: Executing
tasks_completed: 3
tasks_total: 7
---

## Completed Work
- [x] Task 1: Created token.cjs with JWT generation
- [x] Task 2: Created verify.cjs with signature validation
- [x] Task 3: Added error handling for expired tokens

## Commits
- feat(auth-core): add token generation (abc1234)
- feat(auth-core): add token verification (def5678)
- feat(auth-core): add expiry handling (ghi9012)

## Remaining Work
- [ ] Task 4: Add refresh token rotation
- [ ] Task 5: Add rate limiting to token endpoint
- [ ] Task 6: Write integration tests
- [ ] Task 7: Update README

## Decisions Made
- Using HS256 algorithm for JWT signing
- Tokens expire after 1 hour, refresh tokens after 7 days

## Resume Instructions
Continue from Task 4. The token infrastructure is complete and tested.
Read src/auth/token.cjs and src/auth/verify.cjs to understand current state.
All commits are on the rapid/auth-core branch.
```

**Key implementation details:**
- CHECKPOINT return data (`handoff_done`, `handoff_remaining`, `handoff_resume`) maps directly to sections
- HANDOFF.md stored at `.planning/sets/{setName}/HANDOFF.md`
- Resume reads HANDOFF.md, prepends to executor prompt alongside original plan
- `pause_cycle` counter incremented each pause; warn at 3 per CONTEXT.md decision
- Registry entry gets `phase: 'Paused'` (new phase value needed in update-phase)

### Pattern 3: Artifact-Based Gate Checks
**What:** Verify plan artifacts exist on disk, not just registry state
**When to use:** Before any wave begins execution

**How it differs from existing `checkPlanningGate()`:**
```
Current (plan.cjs):
  - Reads GATES.json
  - Checks completed[] array
  - Returns { open, required, completed, missing }

Enhanced:
  - STILL reads GATES.json for the set list
  - ALSO checks disk: does .planning/sets/{set}/DEFINITION.md exist?
  - ALSO checks disk: does .planning/sets/{set}/CONTRACT.json exist?
  - Optionally checks: does the set have any plan-phase artifacts?
  - Returns { open, required, completed, missing, missingArtifacts[] }
```

**Override mechanism:**
```
Gate blocked: auth-core (no plan), api-routes (no plan). Ready: db-schema (planned).

Override? This will proceed despite incomplete planning.
Sets that would execute without plans: auth-core, api-routes
[yes/no]: _
```

### Pattern 4: Wave Reconciliation Engine
**What:** Compare planned deliverables against actual execution results
**When to use:** After the last set in a wave completes execution

**Reconciliation checks:**
1. **Artifact existence:** For each set in the wave, verify all files listed in DEFINITION.md "File Ownership" section actually exist in the worktree
2. **Contract compliance:** Run the auto-generated `contract.test.cjs` for each set to verify exported functions/types exist and match contracts
3. **Commit count:** Compare `tasks_total` from return data against actual commit count on branch
4. **Ownership compliance:** Verify no cross-set file modifications via `verifySetExecution()` (already exists)

**Categorized results:**
- **Hard blocks (contract violations):** Exported function doesn't exist, type shape mismatch, contract test failures -- MUST fix before next wave
- **Soft blocks (missing artifacts):** A non-critical file is missing, commit count mismatch -- can be overridden by developer

**WAVE-{N}-SUMMARY.md format (Claude's discretion):**
```markdown
# Wave 1 Reconciliation Summary

**Reconciled:** 2026-03-04T12:30:00Z
**Result:** PASS (with warnings)

## Sets

### auth-core
**Status:** PASS
**Planned artifacts:** 2 | **Delivered:** 2
**Contract compliance:** All exports verified
**Commits:** 6 (expected 6)

### db-schema
**Status:** PASS (soft warning)
**Planned artifacts:** 3 | **Delivered:** 2 (README.md missing)
**Contract compliance:** All exports verified
**Commits:** 4 (expected 5) -- 1 fewer than planned

## Contract Compliance Details
| Set | Export | Status |
|-----|--------|--------|
| auth-core | createToken | PASS |
| auth-core | verifyToken | PASS |
| db-schema | initDatabase | PASS |
| db-schema | runMigration | PASS |

## Hard Blocks
None

## Soft Blocks
- db-schema: README.md not found (non-critical artifact)
- db-schema: 4 commits vs 5 expected (minor)

## Developer Action Required
Review soft blocks above. Approve to proceed to Wave 2.
```

### Anti-Patterns to Avoid
- **Polling for completion:** Do NOT have the orchestrator poll registry to detect when sets finish. The execute skill drives completion sequentially per set in each wave -- it knows when each set finishes because it spawns the subagent and gets the return.
- **Storing execution state outside .planning/:** All state (HANDOFF.md, WAVE-SUMMARY.md, registry) stays in `.planning/` per project convention.
- **Modifying GATES.json without lock:** Gate updates must use `acquireLock` for cross-process safety, matching existing registry update pattern.
- **Making pause automatic only:** The CONTEXT.md explicitly requires dual trigger (explicit command + automatic). Don't implement only one.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contract compliance checking | Custom JSON diff engine | Run existing `contract.test.cjs` via `node --test` | Auto-generated tests already verify exports exist and match contract shapes |
| Artifact existence checking | Custom file walking | Extend existing `verifyLight()` from verify.cjs | Already handles file existence + commit hash checking |
| Ownership violation detection | Manual file-to-set comparison | Reuse `verifySetExecution()` from execute.cjs | Already checks ownership, commit format, artifact existence |
| Progress bar rendering | Complex state machine | Simple `Math.floor(completed/total * barWidth)` | Progress bar is purely a display concern -- calculate from tasks_completed/tasks_total |
| Lock-safe state updates | Raw fs.writeFileSync | Use `registryUpdate()` and `acquireLock()` from worktree.cjs / lock.cjs | mkdir-based atomic locking is already battle-tested |

**Key insight:** All four features in this phase are orchestration layers over existing verification, state, and display infrastructure. The reconciliation engine is the only meaningfully new logic; everything else is wiring existing functions into new workflows.

## Common Pitfalls

### Pitfall 1: Phase Enum Mismatch
**What goes wrong:** The CONTEXT.md defines 5 lifecycle phases (Discuss, Plan, Execute, Verify, Merge) but the existing `update-phase` command in rapid-tools.cjs only accepts `['Discussing', 'Planning', 'Executing', 'Verifying', 'Done', 'Error']`. The dashboard needs to show "Discuss" while the registry stores "Discussing".
**Why it happens:** Display labels differ from internal state values.
**How to avoid:** Either map display labels in the formatter (`Discussing` -> `Discuss`) or keep registry values aligned. The simplest approach: add a display map in `formatStatusTable()` rather than changing registry values (which would break existing Phase 6 execute skill).
**Warning signs:** Dashboard shows "Discussing" instead of "Discuss" or vice versa.

### Pitfall 2: Pause/Resume Cycle Without Worktree
**What goes wrong:** Attempting to pause a set that hasn't created a worktree yet (e.g., still in Discuss or Plan phase).
**Why it happens:** Pause is meaningful only during Execute phase, but nothing prevents calling `/rapid:pause` during other phases.
**How to avoid:** Guard pause command: check registry phase is "Executing" before writing HANDOFF.md. For pre-execution phases, pause is meaningless (just stop talking to the orchestrator).
**Warning signs:** HANDOFF.md created for a set in "Planning" phase with no git commits to track.

### Pitfall 3: Reconciliation Running Before All Sets Complete
**What goes wrong:** Reconciliation triggers when 2 of 3 sets in a wave are done, producing incomplete results.
**Why it happens:** Wave completion detection is racy if sets finish asynchronously.
**How to avoid:** The execute skill processes sets within a wave sequentially (spawns subagents one at a time or in parallel and waits for all). Reconciliation triggers AFTER the wave completion loop, not on individual set completion. This is an orchestrator-level concern, not a library concern.
**Warning signs:** WAVE-SUMMARY.md shows fewer sets than expected.

### Pitfall 4: Gate Override Without Audit Trail
**What goes wrong:** Developer overrides a gate, later can't remember what was bypassed.
**Why it happens:** Override is interactive confirmation only, no persistence.
**How to avoid:** Log overrides in GATES.json (add `overrides: [{ wave, timestamp, missing }]` array) or append to wave summary. The override should be visible in `/rapid:status` output.
**Warning signs:** Sets executing without plans and no record of how that happened.

### Pitfall 5: Stale HANDOFF.md After Resume
**What goes wrong:** After successful resume and completion, HANDOFF.md still exists with old data.
**Why it happens:** No cleanup of HANDOFF.md after set completes.
**How to avoid:** On set completion (phase -> Done), delete or archive HANDOFF.md. Could rename to `HANDOFF.md.resolved` or just delete since git history preserves it.
**Warning signs:** Next pause/resume cycle reads stale handoff data.

### Pitfall 6: Registry Phase Value "Paused" Not in Valid Phases
**What goes wrong:** `update-phase` command rejects "Paused" because it's not in the valid phases array.
**Why it happens:** Phase 6 defined a fixed set of valid phases.
**How to avoid:** Add "Paused" to the `validPhases` array in `handleExecute` within rapid-tools.cjs.
**Warning signs:** CLI error when trying to pause a set.

## Code Examples

### Progress Bar Rendering
```javascript
// Source: Custom (no external dependency needed)
/**
 * Render an ASCII progress bar.
 * @param {string} label - Phase label (e.g., "Execute")
 * @param {number} completed - Tasks completed
 * @param {number} total - Total tasks
 * @param {number} [width=7] - Bar width in characters
 * @returns {string} e.g., "Execute [===----] 3/7"
 */
function renderProgressBar(label, completed, total, width = 7) {
  if (total === 0) return `${label}`;
  const filled = Math.round((completed / total) * width);
  const empty = width - filled;
  const bar = '='.repeat(filled) + '-'.repeat(empty);
  return `${label} [${bar}] ${completed}/${total}`;
}
```

### HANDOFF.md Generation from CHECKPOINT Return
```javascript
// Source: Maps existing returns.cjs CHECKPOINT fields to Markdown
/**
 * Generate HANDOFF.md content from CHECKPOINT return data.
 * @param {Object} checkpointData - Parsed CHECKPOINT return
 * @param {string} setName - Set name
 * @param {number} pauseCycle - Current pause cycle count
 * @returns {string} Markdown content for HANDOFF.md
 */
function generateHandoff(checkpointData, setName, pauseCycle) {
  const frontmatter = [
    '---',
    `set: ${setName}`,
    `paused_at: ${new Date().toISOString()}`,
    `pause_cycle: ${pauseCycle}`,
    `tasks_completed: ${checkpointData.tasks_completed || 0}`,
    `tasks_total: ${checkpointData.tasks_total || 0}`,
    '---',
  ].join('\n');

  const sections = [
    frontmatter,
    '',
    '## Completed Work',
    checkpointData.handoff_done || '(none recorded)',
    '',
    '## Remaining Work',
    checkpointData.handoff_remaining || '(none recorded)',
    '',
    '## Resume Instructions',
    checkpointData.handoff_resume || 'Continue from where execution stopped.',
  ];

  if (checkpointData.decisions && checkpointData.decisions.length > 0) {
    sections.push('', '## Decisions Made');
    for (const d of checkpointData.decisions) {
      sections.push(`- ${d}`);
    }
  }

  return sections.join('\n') + '\n';
}
```

### Artifact-Based Gate Check
```javascript
// Source: Extends existing plan.cjs checkPlanningGate pattern
/**
 * Check planning gate with artifact verification on disk.
 * @param {string} cwd - Project root
 * @param {number} wave - Wave number
 * @returns {{ open, required, completed, missing, missingArtifacts }}
 */
function checkPlanningGateArtifact(cwd, wave) {
  const baseResult = checkPlanningGate(cwd, wave);
  const missingArtifacts = [];

  for (const setName of baseResult.required) {
    const setDir = path.join(cwd, '.planning', 'sets', setName);
    const defPath = path.join(setDir, 'DEFINITION.md');
    const contractPath = path.join(setDir, 'CONTRACT.json');

    if (!fs.existsSync(defPath)) {
      missingArtifacts.push({ set: setName, file: 'DEFINITION.md' });
    }
    if (!fs.existsSync(contractPath)) {
      missingArtifacts.push({ set: setName, file: 'CONTRACT.json' });
    }
  }

  return {
    ...baseResult,
    open: baseResult.open && missingArtifacts.length === 0,
    missingArtifacts,
  };
}
```

### Wave Reconciliation
```javascript
// Source: Combines existing execute.cjs verifySetExecution with contract.test.cjs runner
/**
 * Reconcile a wave: compare planned vs actual for all sets.
 * @param {string} cwd - Project root
 * @param {number} waveNum - Wave number
 * @param {Object} dagJson - DAG data
 * @param {Object} registry - Worktree registry
 * @returns {{ hardBlocks: Array, softBlocks: Array, setResults: Object }}
 */
function reconcileWave(cwd, waveNum, dagJson, registry) {
  const waveSets = dagJson.waves[waveNum]?.sets || [];
  const hardBlocks = [];
  const softBlocks = [];
  const setResults = {};

  for (const setName of waveSets) {
    const entry = registry.worktrees[setName];
    if (!entry) continue;

    const worktreePath = path.resolve(cwd, entry.path);
    const setDir = path.join(cwd, '.planning', 'sets', setName);

    // 1. Run contract tests (hard block if fail)
    try {
      const testFile = path.join(setDir, 'contract.test.cjs');
      if (fs.existsSync(testFile)) {
        execSync(`node --test "${testFile}"`, { cwd: worktreePath, stdio: 'pipe', timeout: 30000 });
        setResults[setName] = { contractCompliance: 'PASS' };
      }
    } catch (err) {
      hardBlocks.push({ set: setName, type: 'contract_violation', detail: err.stderr?.toString() || err.message });
      setResults[setName] = { contractCompliance: 'FAIL' };
    }

    // 2. Check artifact existence (soft block if missing)
    // Load DEFINITION.md, parse owned files, check they exist in worktree
    // ... artifact checking logic ...
  }

  return { hardBlocks, softBlocks, setResults };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Registry-only gate checks | Artifact-based gate checks | Phase 7 | Gates verify actual files on disk, not just status flags |
| No pause/resume | HANDOFF.md-based state restoration | Phase 7 | Long-running execution can survive context window limits |
| Post-hoc wave review | Mandatory reconciliation with hard/soft blocks | Phase 7 | Contract violations caught before downstream waves execute |
| Basic worktree table | Unified lifecycle dashboard with progress bars | Phase 7 | Developer sees cross-set, cross-phase progress at a glance |

**Deprecated/outdated:**
- None. Phase 7 extends Phase 6 patterns without deprecating anything.

## Open Questions

1. **Contract test execution path during reconciliation**
   - What we know: `contract.test.cjs` files are auto-generated per set and use `require()` with relative paths (`../../..` from the set dir to project root)
   - What's unclear: When running in a worktree context, the relative paths in contract tests may resolve to the worktree root (which lacks the `.planning/` directory structure). Tests may need to run from the main project root with an explicit path.
   - Recommendation: Test this during implementation. If paths break, pass `cwd` as the main project root when running `node --test`, not the worktree path.

2. **Pause cycle counter storage**
   - What we know: CONTEXT.md says "warn after 3 pause/resume cycles on the same set"
   - What's unclear: Should the counter live in HANDOFF.md (reset on delete), in the registry (persistent across sessions), or in a dedicated file?
   - Recommendation: Store in registry entry as `pauseCycles: N`. Registry is the canonical per-set state store and survives HANDOFF.md cleanup.

3. **"Last activity" timestamp granularity**
   - What we know: Dashboard should show "last activity" per set
   - What's unclear: Should this be the last phase transition, last commit, or last registry update?
   - Recommendation: Use registry `updatedAt` timestamp (add this field to registry updates). It naturally reflects the most recent phase transition.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `rapid/src/lib/worktree.cjs` -- formatStatusTable, formatWaveSummary, registry operations
- Codebase inspection: `rapid/src/lib/execute.cjs` -- verifySetExecution, assembleExecutorPrompt, prepareSetContext
- Codebase inspection: `rapid/src/lib/plan.cjs` -- checkPlanningGate, updateGate, writeGates
- Codebase inspection: `rapid/src/lib/returns.cjs` -- CHECKPOINT status with handoff_done, handoff_remaining, handoff_resume fields
- Codebase inspection: `rapid/src/lib/dag.cjs` -- getExecutionOrder, assignWaves
- Codebase inspection: `rapid/src/bin/rapid-tools.cjs` -- handleExecute, handleWorktree, wave-status, update-phase CLI patterns
- Codebase inspection: `rapid/skills/execute/SKILL.md` -- execute orchestration skill pattern
- Codebase inspection: `rapid/skills/status/SKILL.md` -- current status dashboard skill

### Secondary (MEDIUM confidence)
- Phase 7 CONTEXT.md decisions -- all locked decisions and discretion areas

### Tertiary (LOW confidence)
- None. All findings are based on direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all patterns established in Phases 1-6
- Architecture: HIGH -- extends existing modules with clear integration points; all existing APIs and patterns documented by direct code reading
- Pitfalls: HIGH -- identified from direct analysis of registry phase enum, existing gate check limitations, and HANDOFF lifecycle gaps

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable -- internal project patterns, no external dependencies to drift)
