# Phase 21: Execution Engine - Research

**Researched:** 2026-03-07
**Domain:** Parallel job execution orchestration, state machine transitions, subagent dispatch, progress tracking
**Confidence:** HIGH

## Summary

Phase 21 transforms the v1.0 set-level execution engine into a Mark II job-level execution engine. The v1.0 `/rapid:execute` skill drives discuss-plan-execute per set; Mark II separates discuss and plan into Phase 20 (`/rapid:discuss` + `/rapid:wave-plan`) and this phase focuses solely on executing jobs from JOB-PLAN.md files produced by Phase 20. The skill takes a set ID, walks waves sequentially, dispatches parallel subagents (one per job) within each wave, tracks per-job progress in STATE.json, and reconciles after each wave completes.

The existing codebase provides substantial infrastructure: `state-machine.cjs` already has `transitionJob()`, `transitionWave()`, `deriveWaveStatus()`, and lock-protected atomic writes; `execute.cjs` has handoff/reconciliation logic at the set level that needs job-level adaptation; `teams.cjs` has agent teams detection and teammate configuration; `assembler.cjs` has role registration for prompt assembly; and the CLI (`rapid-tools.cjs`) has the full `execute` subcommand tree. The primary work is (1) rewriting the execute SKILL.md to be job-dispatch-only, (2) creating role-job-executor.md for job-level execution, (3) extending execute.cjs with job-level reconciliation and verification, (4) extending teams.cjs for job-level teammates, and (5) adding new CLI subcommands for job execution management.

**Primary recommendation:** Reuse the existing v1.0 execute skill as a structural template but replace set-level dispatch with job-level dispatch. All state transitions go through the existing `transitionJob()`/`transitionWave()` APIs. Reconciliation adapts from set-level to job-level by checking each job's JOB-PLAN.md deliverables instead of DEFINITION.md file ownership.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- /rapid:execute is execute-only -- it takes JOB-PLAN.md files as input and runs execution. It assumes discuss+plan already happened in Phase 20
- If discuss/plan haven't happened, /execute prompts the user to run /rapid:discuss and /rapid:wave-plan first (does not auto-trigger them)
- Input is set-scoped: `/rapid:execute <set-id>` -- executes all waves in a set sequentially
- All waves process sequentially within one invocation: Wave 1 execute -> reconcile -> Wave 2 execute -> reconcile -> etc. User can pause between waves
- New `role-job-executor.md` agent role module for job-level execution. Existing `role-executor.md` stays as-is for backward compatibility
- The v1.0 execute SKILL.md gets a major rewrite -- the discuss+plan steps are removed, replaced by job dispatch logic
- Parallel subagents: one subagent spawned per job, all jobs in a wave spawned in parallel
- If rate limits hit, reduce to sequential execution within the wave and inform the user
- File contention handled via file ownership enforcement: WAVE-PLAN.md's file ownership table (from Phase 20) assigns files to specific jobs. Each job only modifies its owned files. Contention = violation, not a race
- Agent teams mode supported: adapt teams.cjs for job-level (one team per wave, one teammate per job). Same fallback-to-subagents pattern as v1.0
- Git commits: each job agent commits atomically per task. Git handles concurrent commits on the same branch naturally. Commit format: `type(set-name): description`
- Job-level granularity: show each job's status within the current wave (job name, status, task count)
- Visual format: banner blocks like GSD auto-advance banners. Wave header + indented job status lines + timestamp. Updated at key transitions (job start, job complete, job fail)
- STATE.json updated at transition boundaries only (job pending->executing, executing->complete/failed, wave transitions). Consistent with Phase 16 decisions
- STATE.json committed at workflow boundaries (job complete/fail, wave transitions) -- not on intermediate updates
- /rapid:status reads STATE.json statically -- no real-time polling needed. Since transitions write immediately, it's accurate enough
- Smart re-entry: on invocation, read STATE.json to find job statuses. Skip 'complete' jobs, re-execute 'failed' jobs, execute 'pending' jobs. Show summary of what was skipped
- Job-level pause: each job can pause independently via CHECKPOINT return. STATE.json records per-job progress. On resume, only paused jobs re-spawn. Other jobs' results preserved
- Failed jobs: mark 'failed' in STATE.json, other jobs in the wave continue executing. After wave completes, user decides: retry failed jobs, skip them, or cancel
- Job-level reconciliation: after all jobs in a wave complete, verify each job's deliverables against its JOB-PLAN.md. Check file existence, commit format, file ownership. Aggregate into wave-level pass/fail

### Claude's Discretion
- Internal prompt design for role-job-executor.md
- Exact banner block formatting and update frequency
- How to handle git commit conflicts when parallel jobs commit simultaneously
- Rate limit detection and sequential fallback threshold
- HANDOFF.md format adaptations for job-level (vs v1.0 set-level)
- Execute library function signatures and internal helpers
- Error message wording for pre-condition checks (missing plans, wrong state)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXEC-01 | /execute runs parallel job execution within a wave via subagents or agent teams | Skill rewrite removes discuss/plan steps, adds job-level dispatch; teams.cjs extended for job teammates; rate limit fallback pattern documented |
| EXEC-02 | Executor agent executes jobs with atomic commits producing bisectable git history | New role-job-executor.md with per-task atomic commits; commit convention `type(set-name): description`; file ownership enforcement from WAVE-PLAN.md |
| EXEC-03 | Per-job progress tracking with state updates surviving context resets | STATE.json transitions via transitionJob()/transitionWave(); committed at workflow boundaries; smart re-entry reads state on invocation |
| EXEC-04 | Orchestrator dispatches commands based on current state and spawns appropriate subagents | Skill reads STATE.json for wave/job statuses, skips complete, retries failed, executes pending; spawns subagents with assembled prompts from job plans |
| UX-02 | Progress indicators with visual formatting during subagent operations | Banner block format: wave header + indented job status lines + timestamp; updated at job start/complete/fail transitions |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 18+ | Runtime for CLI and lib modules | Already validated as prereq in Phase 18 |
| Zod | 3.24.4 | Schema validation for state, returns, handoffs | Locked in Phase 16 for CommonJS compatibility |
| proper-lockfile | latest | Lock-protected STATE.json writes | Already used in lock.cjs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:test | built-in | Test runner | All unit tests use node:test describe/it/assert |
| node:assert/strict | built-in | Assertions | Strict assertion mode per existing convention |
| node:child_process | built-in | Git operations, command execution | execSync/execFileSync for git commands |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual banner formatting | chalk/ansi-colors | Not needed -- SKILL.md outputs plaintext, Claude Code handles rendering |
| Polling for subagent completion | Event-driven notification | Agent tool is synchronous return -- no polling needed |

**Installation:**
No new dependencies. All required libraries are already in the project.

## Architecture Patterns

### Recommended Project Structure
```
skills/
  execute/
    SKILL.md                      # Major rewrite: job-level dispatch (was set-level)
src/
  lib/
    execute.cjs                   # Extended: job-level reconciliation, verification
    teams.cjs                     # Extended: job-level teammate config
    assembler.cjs                 # Extended: register 'job-executor' role
  modules/
    roles/
      role-job-executor.md        # New: job-level executor role
      role-executor.md            # Unchanged: backward compatibility
  bin/
    rapid-tools.cjs               # Extended: new job execution CLI subcommands
```

### Pattern 1: Job-Level Execute Skill (Orchestration Flow)
**What:** The rewritten SKILL.md follows a linear flow: validate preconditions -> detect mode -> walk waves sequentially -> dispatch parallel jobs per wave -> reconcile per wave -> final summary.
**When to use:** Every invocation of `/rapid:execute <set-id>`.
**Example:**
```
Step 0: Environment + Precondition Check
  - Load RAPID_TOOLS env
  - Read STATE.json to find set and its waves
  - Verify at least one wave has JOB-PLAN.md files (else: prompt user to run /rapid:discuss + /rapid:wave-plan)

Step 1: Detect Execution Mode
  - Same as v1.0: check agent teams availability, prompt user

Step 2: Smart Re-entry
  - Read STATE.json for all jobs across all waves in this set
  - Skip complete jobs, identify failed/pending jobs
  - Show summary of what will be executed vs skipped

Step 3: For each wave (sequentially):
  Step 3a: Transition wave to 'executing' via CLI
  Step 3b: For each job in wave:
    - Read JOB-PLAN.md
    - Transition job to 'executing'
    - Spawn subagent with role-job-executor prompt + JOB-PLAN.md content
  Step 3c: Collect all subagent returns
  Step 3d: For each completed job: transition to 'complete'/'failed'
  Step 3e: Reconcile wave: verify deliverables, commit format, file ownership
  Step 3f: Transition wave to 'reconciling' then 'complete'
  Step 3g: Commit STATE.json
  Step 3h: User decision: continue to next wave, pause, or retry failures

Step 4: Final summary
```

### Pattern 2: Job-Level Subagent Prompt Assembly
**What:** Each job executor subagent receives: role-job-executor.md instructions + JOB-PLAN.md content + file ownership context + commit convention + worktree path.
**When to use:** Every job subagent spawn.
**Example:**
```markdown
# Job: {jobId} -- Execution

You are implementing job '{jobId}' in set '{setId}'.

## Your JOB-PLAN
{Full content of {jobId}-PLAN.md}

## File Ownership
You may ONLY modify these files:
{File list from WAVE-PLAN.md job file assignments}

## Commit Convention
After each implementation step, commit with:
  git add <specific files>
  git commit -m "type({setName}): description"
Where type is feat|fix|refactor|test|docs|chore

## Working Directory
{worktreePath}

## Completion
When all steps complete, emit RAPID:RETURN with status COMPLETE.
If context window limit reached, emit CHECKPOINT.
If blocked, emit BLOCKED.
```

### Pattern 3: Concurrent Git Commits on Same Branch
**What:** Multiple parallel job agents commit to the same branch simultaneously. Git handles this naturally because each commit creates a new object and updates HEAD atomically. However, two agents running `git commit` at the same instant can race on HEAD update.
**When to use:** All parallel job execution.
**Prevention strategy:**
```
1. Each job only modifies its OWN files (file ownership from WAVE-PLAN.md)
2. Git add + commit is atomic per job -- each job stages only its owned files
3. If git commit fails with "HEAD has changed", retry once (simple retry, not complex merging)
4. The commit message format includes set-name (not job-name) per user decision
5. Since all jobs are on the same branch in the same worktree, commits interleave naturally
```

### Pattern 4: Smart Re-entry on Resume
**What:** When `/rapid:execute` is invoked, read STATE.json before doing anything. Map job statuses to determine what to do.
**When to use:** Every invocation.
**Example:**
```javascript
// Pseudocode for re-entry logic
const state = await readState(cwd);
const set = findSet(state, milestoneId, setId);
for (const wave of set.waves) {
  if (wave.status === 'complete') {
    // Skip entirely, show "Wave N: already complete"
    continue;
  }
  for (const job of wave.jobs) {
    switch (job.status) {
      case 'complete':
        // Skip, show "Job X: already complete (skipped)"
        break;
      case 'failed':
        // Re-execute, show "Job X: retrying (previously failed)"
        break;
      case 'executing':
        // Stale state from crash -- treat as failed, re-execute
        break;
      case 'pending':
        // Normal execution
        break;
    }
  }
}
```

### Pattern 5: Job-Level Reconciliation
**What:** After all jobs in a wave complete, verify deliverables per-job rather than per-set.
**When to use:** After every wave completes.
**Checks per job:**
```
1. File existence: each file in JOB-PLAN.md "Files to Create/Modify" table exists
2. Commit format: commits on the branch match type(setName): description
3. File ownership: changed files are only from this job's assigned files
4. Commit count: number of commits >= number of implementation steps
```
**Aggregation:** All job results roll up to wave-level PASS/PASS_WITH_WARNINGS/FAIL.

### Anti-Patterns to Avoid
- **Cross-job file access:** A job agent modifying files assigned to another job in the same wave. This is a file ownership violation. The WAVE-PLAN.md file assignment table is the source of truth.
- **Auto-triggering discuss/plan:** The execute skill must NOT auto-trigger `/rapid:discuss` or `/rapid:wave-plan`. It validates preconditions and prompts the user to run them manually.
- **Polling STATE.json during execution:** STATE.json is written at transition boundaries. The orchestrator (skill) drives transitions -- it does not poll. Subagents do not read STATE.json.
- **Spawning subagents from subagents:** Only the orchestrator (SKILL.md) spawns subagents. Job executor agents do not spawn sub-subagents. This is enforced by the allowed-tools in role-job-executor.md.
- **Using git add -A or git add .:** Every commit must stage specific files. This is stated in both the executor role and the skill prompt.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State transitions | Custom status tracking | `transitionJob()`, `transitionWave()` from state-machine.cjs | Already validates transitions, acquires locks, derives parent status, writes atomically |
| Lock management | Custom file-based locks | `acquireLock()` from lock.cjs | Uses proper-lockfile with stale detection, retry, and onCompromised handler |
| Return validation | Custom JSON parsing | `parseReturn()`, `validateHandoff()` from returns.cjs | Zod schemas for type-safe validation, handles COMPLETE/CHECKPOINT/BLOCKED |
| Handoff generation | Custom HANDOFF.md writer | `generateHandoff()`, `parseHandoff()` from execute.cjs | Already handles frontmatter, sections, decisions, round-trip parsing |
| Agent teams detection | Custom env check | `detectAgentTeams()` from teams.cjs | Already checks CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS env var |
| Wave summary generation | Custom summary writer | `generateWaveSummary()` from execute.cjs | Already generates Markdown with per-set details, blocks, action items |
| State corruption detection | Manual JSON checks | `detectCorruption()`, `recoverFromGit()` from state-machine.cjs | Validates against Zod schemas, recovers from git on corruption |
| Wave resolution | Manual state traversal | `resolveWave()` from wave-planning.cjs | Handles ambiguous matches, lists available waves on error |

**Key insight:** The state machine infrastructure from Phase 16 is the backbone. Every status change goes through `transitionJob()` which validates against `JOB_TRANSITIONS`, updates timestamps, derives wave status via `deriveWaveStatus()`, and writes atomically under lock. The reconciliation and handoff infrastructure from execute.cjs needs adaptation from set-level to job-level but the patterns are identical.

## Common Pitfalls

### Pitfall 1: Concurrent STATE.json Writes from Parallel Jobs
**What goes wrong:** Multiple parallel subagent completions trigger simultaneous `transitionJob()` calls, which each acquire a lock, read state, modify, and write. If not properly serialized, state could be lost.
**Why it happens:** Lock contention when many jobs complete near-simultaneously.
**How to avoid:** The existing `acquireLock()` with proper-lockfile handles this correctly -- it retries with exponential backoff (10 retries, 100ms-2000ms). The orchestrator (skill) calls `transitionJob()` AFTER each subagent returns, which is inherently sequential from the orchestrator's perspective even if subagents were parallel. The orchestrator processes returns one at a time.
**Warning signs:** "Lock compromised" messages in stderr.

### Pitfall 2: Wave Status Derivation Regression
**What goes wrong:** `deriveWaveStatus()` might derive 'executing' for a wave that was already in 'reconciling' state, causing a regression.
**Why it happens:** `isDerivedStatusValid()` checks ordinal ordering but derived status computation doesn't account for current wave status being manually set to 'reconciling'.
**How to avoid:** The `isDerivedStatusValid()` function already prevents this -- it only applies derived status if ordinal >= current. The skill must transition wave to 'reconciling' AFTER all jobs complete, and `deriveWaveStatus()` won't regress it.
**Warning signs:** Wave status going backward in STATE.json.

### Pitfall 3: Git Commit Race on Same Worktree
**What goes wrong:** Two parallel job agents run `git add` + `git commit` simultaneously in the same worktree, leading to merge conflicts or lost staging.
**Why it happens:** All jobs in a set share the same worktree/branch. Git's index is a shared resource.
**How to avoid:** Since each job modifies DIFFERENT files (enforced by WAVE-PLAN.md file ownership), `git add <specific-files>` won't conflict. However, `git commit` can race on HEAD. Simple retry (1 attempt) on commit failure resolves this. Git's object model ensures no data loss. The key insight: this is a low-frequency race since commits happen at task boundaries, not continuously.
**Warning signs:** "error: cannot lock ref 'HEAD'" in git output.

### Pitfall 4: Stale 'executing' Status After Crash
**What goes wrong:** If the orchestrator crashes mid-execution, jobs are left in 'executing' status in STATE.json. On re-entry, these look like they're still running.
**Why it happens:** STATE.json was updated to 'executing' but never updated to 'complete' or 'failed' because the orchestrator crashed.
**How to avoid:** On re-entry, treat 'executing' jobs as failed -- they need re-execution. The smart re-entry pattern handles this: any job in 'executing' status is re-spawned.
**Warning signs:** Jobs showing 'executing' status when no subagents are running.

### Pitfall 5: Missing Precondition Check for JOB-PLAN.md Files
**What goes wrong:** Execute skill starts dispatching jobs but no JOB-PLAN.md files exist because `/rapid:wave-plan` was never run.
**Why it happens:** User runs `/rapid:execute` before completing the discuss+plan pipeline.
**How to avoid:** Step 0 of the skill must check for JOB-PLAN.md files in `.planning/waves/{setId}/{waveId}/` for each wave. If none exist, prompt user to run `/rapid:discuss` and `/rapid:wave-plan` first.
**Warning signs:** Empty job plan content passed to subagents, resulting in unstructured execution.

### Pitfall 6: HANDOFF.md Location Mismatch (Set vs Job Level)
**What goes wrong:** v1.0 writes HANDOFF.md to `.planning/sets/{setName}/HANDOFF.md`. Job-level handoffs need per-job storage but may conflict with the existing path.
**Why it happens:** v1.0 assumed one HANDOFF.md per set. Job-level execution has multiple jobs per set.
**How to avoid:** Store job-level handoffs in the wave artifacts directory: `.planning/waves/{setId}/{waveId}/{jobId}-HANDOFF.md`. This is consistent with JOB-PLAN.md storage. The v1.0 HANDOFF.md path continues to work for backward compatibility. Update `generateHandoff()` and `parseHandoff()` to accept a path parameter, or create new job-specific variants.
**Warning signs:** HANDOFF.md being overwritten by different jobs.

## Code Examples

Verified patterns from the existing codebase:

### State Transition for Job Execution
```javascript
// Source: src/lib/state-machine.cjs (existing code)
// transitionJob validates against JOB_TRANSITIONS: pending -> executing -> complete|failed
// It also derives wave status automatically via deriveWaveStatus()

await transitionJob(cwd, milestoneId, setId, waveId, jobId, 'executing');
// ... subagent runs ...
await transitionJob(cwd, milestoneId, setId, waveId, jobId, 'complete');
// Wave status auto-derived: if all jobs complete, wave becomes 'complete'
```

### Job-Level Reconciliation (new function to add to execute.cjs)
```javascript
// Pattern: verify each job's deliverables against its JOB-PLAN.md
function reconcileJob(cwd, setId, waveId, jobId, worktreePath, baseBranch) {
  const waveDir = path.join(cwd, '.planning', 'waves', setId, waveId);
  const jobPlanPath = path.join(waveDir, `${jobId}-PLAN.md`);
  const jobPlan = fs.readFileSync(jobPlanPath, 'utf-8');

  const results = { passed: [], failed: [] };

  // 1. Parse "Files to Create/Modify" table from JOB-PLAN.md
  const plannedFiles = parseJobPlanFiles(jobPlan);

  // 2. Check each planned file exists in worktree
  for (const file of plannedFiles) {
    const fullPath = path.join(worktreePath, file.path);
    if (fs.existsSync(fullPath)) {
      results.passed.push({ type: 'file_exists', target: file.path });
    } else if (file.action === 'Create') {
      results.failed.push({ type: 'missing_file', target: file.path });
    }
  }

  // 3. Commit format check (same pattern as v1.0 verifySetExecution)
  const messages = getCommitMessages(worktreePath, baseBranch);
  const formatPattern = new RegExp(`^(feat|fix|refactor|test|docs|chore)\\(${escapeRegExp(setId)}\\):`);
  for (const msg of messages) {
    if (formatPattern.test(msg)) {
      results.passed.push({ type: 'commit_format_valid', target: msg });
    } else {
      results.failed.push({ type: 'commit_format_violation', target: msg });
    }
  }

  return results;
}
```

### Job-Level Wave Reconciliation (adapts existing reconcileWave)
```javascript
// Pattern: aggregate per-job reconciliation into wave-level result
function reconcileWaveJobs(cwd, setId, waveId, worktreePath, baseBranch) {
  const waveDir = path.join(cwd, '.planning', 'waves', setId, waveId);
  const jobPlanFiles = fs.readdirSync(waveDir).filter(f => f.endsWith('-PLAN.md'));

  const hardBlocks = [];
  const softBlocks = [];
  const jobResults = {};

  for (const planFile of jobPlanFiles) {
    const jobId = planFile.replace('-PLAN.md', '');
    const result = reconcileJob(cwd, setId, waveId, jobId, worktreePath, baseBranch);

    jobResults[jobId] = {
      filesPlanned: result.passed.length + result.failed.length,
      filesDelivered: result.passed.filter(p => p.type === 'file_exists').length,
      missingFiles: result.failed.filter(f => f.type === 'missing_file').map(f => f.target),
      commitViolations: result.failed.filter(f => f.type === 'commit_format_violation').map(f => f.target),
    };

    // Missing files are soft blocks
    for (const f of result.failed.filter(f => f.type === 'missing_file')) {
      softBlocks.push({ job: jobId, type: 'missing_file', detail: f.target });
    }
    // Commit violations are soft blocks
    for (const f of result.failed.filter(f => f.type === 'commit_format_violation')) {
      softBlocks.push({ job: jobId, type: 'commit_format_violation', detail: f.target });
    }
  }

  let overall = 'PASS';
  if (hardBlocks.length > 0) overall = 'FAIL';
  else if (softBlocks.length > 0) overall = 'PASS_WITH_WARNINGS';

  return { hardBlocks, softBlocks, jobResults, overall };
}
```

### Agent Teams Job-Level Configuration (extends teams.cjs)
```javascript
// Pattern: one teammate per job (not per set like v1.0)
function buildJobTeammateConfig(cwd, setId, waveId, jobId, worktreePath, jobPlanContent) {
  return {
    name: `${setId}-${jobId}`,
    prompt: assembleJobExecutorPrompt(cwd, setId, waveId, jobId, jobPlanContent),
    worktreePath,
  };
}

function waveJobTeamMeta(setId, waveId) {
  return {
    teamName: `rapid-${setId}-${waveId}`,
    setId,
    waveId,
  };
}
```

### Progress Banner Format
```
// Banner block pattern for job-level progress display
// Updated at: job start, job complete, job fail

--- RAPID Execute ---
Wave wave-1 (1/3)
  job-state-schema: Executing (2/5 steps)
  job-transitions:  Complete (5/5 steps)
  job-cli-wiring:   Pending
[14:32]
---------------------

// On completion:
--- RAPID Execute ---
Wave wave-1: COMPLETE
  job-state-schema: Complete (5/5)
  job-transitions:  Complete (5/5)
  job-cli-wiring:   Complete (3/3)
Reconciliation: PASS
[14:45]
---------------------
```

### Precondition Validation
```bash
# Check that JOB-PLAN.md files exist for a wave
JOB_PLANS=$(ls .planning/waves/${SET_ID}/${WAVE_ID}/*-PLAN.md 2>/dev/null | wc -l)
if [ "$JOB_PLANS" -eq 0 ]; then
  echo "No job plans found for wave ${WAVE_ID}."
  echo "Run /rapid:discuss and /rapid:wave-plan first."
  # Use AskUserQuestion with options: "Run discuss" / "Cancel"
fi
```

## State of the Art

| Old Approach (v1.0) | Current Approach (Mark II) | When Changed | Impact |
|---------------------|---------------------------|--------------|--------|
| Set-level execution | Job-level execution | Phase 21 | Finer-grained parallelism within sets |
| Discuss+plan+execute in one skill | Discuss+plan separated (Phase 20), execute standalone (Phase 21) | Phase 20-21 split | Cleaner separation of concerns |
| Set-level HANDOFF.md | Job-level handoff in wave artifacts dir | Phase 21 | Multiple jobs can checkpoint independently |
| Registry-based phase tracking | STATE.json hierarchical state machine | Phase 16-17 | Type-safe, validated transitions with derived parent status |
| One subagent per set | One subagent per job | Phase 21 | More granular parallelism |
| Set-level reconciliation | Job-level reconciliation aggregated to wave | Phase 21 | More precise verification of deliverables |

**Deprecated/outdated:**
- `execute update-phase <set> <phase>`: v1.0 CLI command that updates worktree registry phase. Still needed for backward compatibility but primary state tracking now uses STATE.json transitions.
- `execute prepare-context <set>`: v1.0 context preparation for set-level execution. Job-level execution assembles context from JOB-PLAN.md directly.

## Open Questions

1. **Git index locking with parallel commits**
   - What we know: Each job stages and commits different files. Git's index is per-worktree. Two simultaneous `git add` + `git commit` sequences CAN race.
   - What's unclear: Exact failure mode and frequency in practice. Git's index.lock prevents simultaneous index modifications, so `git add` operations serialize naturally.
   - Recommendation: Rely on git's built-in index.lock for serialization. If a commit fails, retry once. The file ownership model means staging never conflicts (different files). Document as Claude's discretion item.

2. **Job-level HANDOFF.md storage path**
   - What we know: v1.0 uses `.planning/sets/{setName}/HANDOFF.md` (one per set). Job-level needs per-job storage.
   - What's unclear: Whether to use wave artifacts dir (`.planning/waves/{setId}/{waveId}/{jobId}-HANDOFF.md`) or a new path.
   - Recommendation: Use wave artifacts dir. It's consistent with JOB-PLAN.md location and naturally scoped per wave. The v1.0 HANDOFF.md path is untouched for backward compatibility.

3. **Rate limit detection heuristic**
   - What we know: Claude Code API rate limits can cause subagent spawn failures. The v1.0 skill mentions reducing parallelism on rate limit errors.
   - What's unclear: What the error message looks like and how to reliably detect it vs. other errors.
   - Recommendation: Catch any Agent tool error, check for rate-limit-like messages (429, "rate limit", "too many"), and fall back to sequential. Document as Claude's discretion since the exact detection heuristic is implementation-specific.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in) |
| Config file | none -- uses node --test directly |
| Quick run command | `node --test src/lib/execute.test.cjs` |
| Full suite command | `node --test src/lib/*.test.cjs src/bin/*.test.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXEC-01 | Job-level subagent dispatch and parallel execution | unit | `node --test src/lib/execute.test.cjs -x` | Partial (set-level tests exist, need job-level additions) |
| EXEC-02 | Atomic commits per task with format validation | unit | `node --test src/lib/execute.test.cjs -x` | Yes (verifySetExecution tests exist, extend for job-level) |
| EXEC-03 | Per-job progress tracking via STATE.json transitions | unit | `node --test src/lib/state-machine.test.cjs -x` | Yes (transitionJob tests exist) |
| EXEC-04 | Orchestrator command dispatch based on state | unit | `node --test src/lib/execute.test.cjs -x` | No (need new tests for re-entry logic, precondition checks) |
| UX-02 | Progress banner formatting | unit | `node --test src/lib/execute.test.cjs -x` | No (need new tests for banner generation) |

### Sampling Rate
- **Per task commit:** `node --test src/lib/execute.test.cjs`
- **Per wave merge:** `node --test src/lib/*.test.cjs src/bin/*.test.cjs`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] `src/lib/execute.test.cjs` -- extend with job-level reconciliation tests (reconcileJob, reconcileWaveJobs)
- [ ] `src/lib/execute.test.cjs` -- add job-level handoff generation/parsing tests
- [ ] `src/lib/execute.test.cjs` -- add precondition validation tests (missing JOB-PLAN.md detection)
- [ ] `src/lib/execute.test.cjs` -- add re-entry logic tests (skip complete, retry failed, handle stale executing)
- [ ] `src/lib/teams.test.cjs` -- extend with job-level teammate config tests (buildJobTeammateConfig, waveJobTeamMeta)
- [ ] `src/lib/assembler.test.cjs` -- add 'job-executor' role registration test
- [ ] `src/lib/execute.test.cjs` -- add progress banner generation test

*(No framework install needed -- node:test is built-in)*

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `src/lib/execute.cjs`, `src/lib/teams.cjs`, `src/lib/state-machine.cjs`, `src/lib/state-transitions.cjs`, `src/lib/state-schemas.cjs`, `src/lib/assembler.cjs`, `src/lib/returns.cjs`, `src/lib/lock.cjs`, `src/lib/wave-planning.cjs`
- Direct codebase analysis: `skills/execute/SKILL.md` (v1.0 skill, full text reviewed)
- Direct codebase analysis: `skills/wave-plan/SKILL.md` (Phase 20 wave planning pipeline)
- Direct codebase analysis: `skills/discuss/SKILL.md` (Phase 20 discussion skill)
- Direct codebase analysis: `src/modules/roles/role-executor.md`, `role-orchestrator.md`, `role-job-planner.md`, `core-returns.md`
- Direct codebase analysis: `src/bin/rapid-tools.cjs` (full execute subcommand tree reviewed)
- Direct codebase analysis: `src/lib/execute.test.cjs`, `src/lib/teams.test.cjs` (existing test patterns)
- Phase 21 CONTEXT.md: locked decisions and discretion areas
- STATE.md: project decisions from Phases 16-20

### Secondary (MEDIUM confidence)
- Git concurrent commit behavior: based on established git internals knowledge (index.lock serialization, object model atomicity)

### Tertiary (LOW confidence)
- Rate limit detection heuristic: based on general Claude Code API behavior, not verified against specific error messages

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in the project, no new dependencies
- Architecture: HIGH -- extends existing patterns (state machine, reconciliation, handoff) from codebase analysis
- Pitfalls: HIGH -- identified from direct analysis of concurrent execution paths and state machine transitions
- Execute skill rewrite: HIGH -- v1.0 skill fully analyzed, rewrite scope clearly bounded by CONTEXT.md decisions
- Git concurrency: MEDIUM -- based on general git knowledge, not tested with RAPID-specific parallel execution
- Rate limit handling: LOW -- detection heuristic needs runtime validation

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable internal architecture, no external dependency changes)
