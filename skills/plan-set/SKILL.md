---
description: Plan all waves in a set with automatic sequencing -- spawns wave analyzer for dependency detection, then runs wave-plan pipeline per wave
allowed-tools: Bash(rapid-tools:*), Agent, AskUserQuestion, Read, Write, Glob, Grep
---

# /rapid:plan-set -- Set-Level Wave Planning Orchestrator

You are the RAPID set-level planning orchestrator. This skill plans ALL waves in a set with a single command. It spawns a wave-analyzer agent for dependency detection, groups waves into parallel batches, then runs the full wave-plan pipeline (research -> wave-plan -> job-plans -> verify -> validate) for each wave in dependency order.

Follow these steps IN ORDER. Do not skip steps. Use AskUserQuestion only at FAIL decision points.

## Step 1: Environment Setup

Load environment variables before any CLI calls:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill. Every `node "${RAPID_TOOLS}"` call must be preceded by the env loading block above in the same Bash invocation.

## Display Stage Banner

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display banner plan-set
```

---

## Step 2: Resolve Set and Validate Preconditions

Accept set identifier. The user invokes as:
- `/rapid:plan-set 1` (numeric index)
- `/rapid:plan-set auth-system` (string set ID)

### Resolve Set Reference

```bash
# (env preamble here)
RESOLVE_RESULT=$(node "${RAPID_TOOLS}" resolve set "<user-input>" 2>&1)
RESOLVE_EXIT=$?
if [ $RESOLVE_EXIT -ne 0 ]; then
  echo "$RESOLVE_RESULT"
  # Display the error message from the JSON and STOP
fi
SET_ID=$(echo "$RESOLVE_RESULT" | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.resolvedId)")
SET_INDEX=$(echo "$RESOLVE_RESULT" | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.setIndex)")
```

Use `SET_ID` for all subsequent operations. The numeric input has been resolved to a string ID.

### Load Full State

```bash
# (env preamble here)
STATE_JSON=$(node "${RAPID_TOOLS}" state get --all 2>/dev/null)
echo "$STATE_JSON"
```

Parse the JSON to find all waves in the resolved set within the current milestone. Extract `MILESTONE_ID` and the wave list.

### Validate Wave Statuses

Classify all waves in the set:

```javascript
// Parse inline -- conceptual logic to apply when reading the state JSON
const state = JSON.parse(stateJson);
const milestone = state.milestones.find(m => m.id === state.currentMilestone);
const set = milestone.sets.find(s => s.id === setId);
const waves = set.waves || [];

const pendingWaves = waves.filter(w => w.status === 'pending');
const discussingWaves = waves.filter(w => w.status === 'discussing');
const plannedOrLaterWaves = waves.filter(w => ['planning', 'executing', 'reviewing', 'complete'].includes(w.status));
```

**Fail fast:** If ANY wave has status `pending`, abort immediately:
```
"Cannot plan set '{SET_ID}': {N} wave(s) have not been discussed yet:
  - {waveId} (status: pending)
  - {waveId} (status: pending)

Run /rapid:discuss for each undiscussed wave before running /rapid:plan-set."
```
Then STOP. Do NOT skip pending waves -- all waves must be at least `discussing` before set-level planning begins.

**Smart re-entry:** If some waves are already in `planning` or later status, skip them. Only plan waves in `discussing` state.

- If ALL waves are already planned (none in `discussing`): Display "All waves in set '{SET_ID}' are already planned. Nothing to do." and STOP.

**Display summary:**
```
"Planning set '{SET_ID}':
  - {N} wave(s) to plan: {wave IDs}
  - {M} wave(s) already planned (skipped): {wave IDs}
  - Total waves in set: {total}"
```

Record `MILESTONE_ID`, `SET_ID`, `SET_INDEX`, and the list of `WAVES_TO_PLAN` for subsequent steps.

---

## Step 3: Wave Dependency Analysis

**If only 1 wave to plan:** Skip the analyzer entirely. Treat as a single sequential batch containing that one wave. Proceed to Step 4.

**If re-entry (some waves already planned):** Skip the analyzer entirely. Derive batch structure from remaining `discussing` waves -- treat them all as a single sequential batch. Proceed to Step 4. Rationale: already-planned waves are fixed; re-running the analyzer could produce stale dependency info.

**If 2+ waves to plan (fresh run):** Spawn the wave analyzer for dependency detection.

### Read Wave Context Files

For each wave in `WAVES_TO_PLAN`, read its WAVE-CONTEXT.md:
```
.planning/waves/{SET_ID}/{waveId}/WAVE-CONTEXT.md
```

Concatenate all WAVE-CONTEXT.md contents with clear wave ID headers.

### Spawn Wave Analyzer

Spawn the **rapid-wave-analyzer** agent with this task:

```
Analyze dependencies between waves in set '{SET_ID}'.

## Wave Contexts

### Wave: {waveId-1}
{WAVE-CONTEXT.md contents for wave 1}

### Wave: {waveId-2}
{WAVE-CONTEXT.md contents for wave 2}

... (all waves being planned)

## Instructions
Determine which waves depend on each other and which are independent. Return your analysis via RAPID:RETURN JSON.
```

### Parse Analyzer Output

Extract the RAPID:RETURN JSON from the agent output. The return structure is:
```json
{
  "status": "COMPLETE",
  "dependencies": [
    { "from": "wave-1", "to": "wave-2", "reason": "wave-2 modifies files created in wave-1" }
  ],
  "independent_groups": [["wave-2", "wave-4"], ["wave-3"]],
  "analysis_notes": "..."
}
```

### Convert Dependencies to Planning Batches

Use BFS-level assignment to group waves into ordered batches:

```bash
# (env preamble here)
# Inline BFS leveling (same algorithm as dag.cjs assignWaves)
node -e "
const deps = JSON.parse(process.argv[1]);
const waves = JSON.parse(process.argv[2]);

// Build adjacency: from -> [to] (from is dependency, to is dependent)
const inDegree = {};
const adj = {};
waves.forEach(w => { inDegree[w] = 0; adj[w] = []; });
deps.forEach(d => {
  if (adj[d.from] && inDegree[d.to] !== undefined) {
    adj[d.from].push(d.to);
    inDegree[d.to]++;
  }
});

// BFS level assignment
const queue = waves.filter(w => inDegree[w] === 0);
const levels = {};
queue.forEach(w => { levels[w] = 1; });
let idx = 0;
while (idx < queue.length) {
  const curr = queue[idx++];
  for (const next of adj[curr]) {
    inDegree[next]--;
    levels[next] = Math.max(levels[next] || 0, levels[curr] + 1);
    if (inDegree[next] === 0) queue.push(next);
  }
}

// Group by level
const batches = {};
for (const [w, lvl] of Object.entries(levels)) {
  if (!batches[lvl]) batches[lvl] = [];
  batches[lvl].push(w);
}

// Output ordered batches
const ordered = Object.keys(batches).sort((a,b) => a-b).map(k => batches[k]);
console.log(JSON.stringify(ordered));
" '${DEPS_JSON}' '${WAVES_JSON}'
```

This produces an array of batches: `[["wave-1"], ["wave-2", "wave-4"], ["wave-3"]]` -- batch 1 plans first, then batch 2 (waves in parallel), then batch 3.

**Fallback:** If the analyzer fails, returns no RAPID:RETURN, or produces invalid JSON, fall back to sequential planning: each wave in its own batch, processed one at a time. This is the safest default.

Display the batch plan:
```
"Wave planning order:
  Batch 1: {wave IDs} (parallel: {yes/no})
  Batch 2: {wave IDs} (parallel: {yes/no})
  ..."
```

---

## Step 4: Plan Waves in Batches

Process batches in order. Within each batch, plan waves according to the batch size:

- **Batch size = 1 (sequential):** Run the full pipeline for the single wave inline.
- **Batch size > 1 (parallel):** Run the pipeline with interleaved parallel agent calls across waves in the batch. Specifically: spawn the same pipeline step for ALL waves in the batch in parallel, wait for all to complete, then proceed to the next pipeline step for all waves.

**IMPORTANT:** Do NOT try to spawn a single orchestrator agent per wave for parallel batches. Claude Code does not allow sub-sub-agent spawning. Instead, the plan-set skill itself dispatches agents at each pipeline step, interleaving across waves.

### Per-Wave Pipeline (Steps 4a-4j)

For each wave (or for all waves in a parallel batch simultaneously at each step):

#### Step 4a: Display Wave Transition Banner

```bash
# (env preamble here)
node "${RAPID_TOOLS}" display banner plan-set "Wave {waveIndex}/{totalWaves}: {waveId}"
```

#### Step 4b: Read Wave Context

Read the following files for each wave:
- `.planning/waves/{SET_ID}/{waveId}/WAVE-CONTEXT.md`
- `.planning/sets/{SET_ID}/CONTRACT.json`
- `.planning/sets/{SET_ID}/SET-OVERVIEW.md` (if exists)
- Targeted source files referenced in CONTRACT.json exports (the `file` field in each export function)

#### Step 4c: Spawn Wave Research Agent

Display progress: "Researching implementation specifics for wave {waveId}..."

Spawn the **rapid-wave-researcher** agent with this task:

```
Research implementation specifics for wave '{waveId}' in set '{SET_ID}'.

## Wave Context
{WAVE-CONTEXT.md full contents}

## Contract
{CONTRACT.json full contents}

## Set Overview
{SET-OVERVIEW.md full contents, if exists}

## Source Files
{Source file contents for each export file}

## Jobs
{Job descriptions from the state data}

## Working Directory
{worktreePath}

## Instructions
Use Context7 MCP for documentation lookups. Write output to .planning/waves/{SET_ID}/{waveId}/WAVE-RESEARCH.md
```

**For parallel batches:** Spawn the rapid-wave-researcher agent for ALL waves in the batch simultaneously (multiple Agent tool calls in a single response). Wait for all to complete before proceeding to Step 4d.

After agent completes:
- Verify `.planning/waves/{SET_ID}/{waveId}/WAVE-RESEARCH.md` was created
- If agent failed: Log the failure. For parallel batches, continue with other waves. The wave can proceed to Step 4d without research (graceful degradation).

#### Step 4d: Read Research and Context

- Read `.planning/waves/{SET_ID}/{waveId}/WAVE-RESEARCH.md` (if created in Step 4c)
- Read `.planning/sets/OWNERSHIP.json` (if exists)

#### Step 4e: Spawn Wave Planner Agent

Display progress: "Creating wave plan for {waveId}..."

Spawn the **rapid-wave-planner** agent with this task:

```
Produce WAVE-PLAN.md for wave '{waveId}' with per-job summaries, file assignments, and coordination notes.

## Wave Context
{WAVE-CONTEXT.md full contents}

## Wave Research
{WAVE-RESEARCH.md full contents, if exists}

## Contract
{CONTRACT.json full contents}

## Set Overview
{SET-OVERVIEW.md full contents, if exists}

## Ownership
{OWNERSHIP.json full contents, if exists}

## Wave Jobs
{Wave jobs JSON from state}

## Working Directory
{worktreePath}

## Output
Write output to .planning/waves/{SET_ID}/{waveId}/WAVE-PLAN.md
```

**For parallel batches:** Spawn the rapid-wave-planner agent for ALL waves in the batch simultaneously. Wait for all to complete before proceeding to Step 4f.

After agent completes:
- Verify `.planning/waves/{SET_ID}/{waveId}/WAVE-PLAN.md` was created
- If agent failed: This is a critical failure for the wave. Mark the wave as failed and skip remaining pipeline steps for it.

#### Step 4f: Spawn Job Planner Agents

Display progress: "Creating detailed plans for {N} jobs in wave {waveId}..."

Read WAVE-PLAN.md to extract job IDs and their summaries from the "## Job Summaries" section.

For each job in the wave, spawn the **rapid-job-planner** agent with this task:

```
Produce {jobId}-PLAN.md for job '{jobId}' with detailed implementation steps.

## Your Job Section
{Job section from WAVE-PLAN.md highlighted for this specific job}

## Wave Plan
{WAVE-PLAN.md full contents}

## Wave Research
{WAVE-RESEARCH.md full contents}

## Wave Context
{WAVE-CONTEXT.md full contents}

## Contract
{CONTRACT.json full contents}

## Source Files
{Source file contents for files assigned to this job in WAVE-PLAN.md}

## Working Directory
{worktreePath}

## Output
Write output to .planning/waves/{SET_ID}/{waveId}/{jobId}-PLAN.md
```

**Spawning strategy within a single wave:**
- If 3 or more jobs: Spawn all job planner agents in parallel (multiple Agent tool calls in a single response).
- If 1-2 jobs: Spawn them sequentially.

**For parallel batches:** Process job planners for each wave independently. All waves in the batch can have their job planners running simultaneously.

After all agents complete:
- Use Glob to check `.planning/waves/{SET_ID}/{waveId}/*-PLAN.md` for created files
- If any job planner failed, mark the specific job as failed but continue with available plans

#### Step 4g: Spawn Plan Verifier Agent

Display progress: "Verifying job plans for {waveId}..."

Read all context needed for the verifier:
- `.planning/waves/{SET_ID}/{waveId}/WAVE-PLAN.md`
- `.planning/waves/{SET_ID}/{waveId}/WAVE-CONTEXT.md`
- All JOB-PLAN.md files from `.planning/waves/{SET_ID}/{waveId}/` (use Glob to discover `*-PLAN.md` files, then Read each one)

Concatenate all JOB-PLAN.md contents with `### {filename}` headers between them.

Spawn the **rapid-plan-verifier** agent with this task:

```
Verify all job plans for wave '{waveId}' in set '{SET_ID}'.

## Wave Plan
{WAVE-PLAN.md full contents}

## Wave Context
{WAVE-CONTEXT.md full contents}

## Job Plans
{All JOB-PLAN.md file contents, each preceded by ### {filename} header}

## Working Directory
{worktreePath}

## Output
Write VERIFICATION-REPORT.md to .planning/waves/{SET_ID}/{waveId}/VERIFICATION-REPORT.md
```

**For parallel batches:** Spawn the rapid-plan-verifier agent for ALL waves in the batch simultaneously. Wait for all to complete before proceeding to Step 4h.

After agent completes:
- Read the structured return to extract `verdict` and `failingJobs`
- Read `.planning/waves/{SET_ID}/{waveId}/VERIFICATION-REPORT.md`

#### Step 4h: Handle Verification Verdict

**If verdict is PASS or PASS_WITH_GAPS:**
- PASS: Display "Wave {waveId}: All plans verified."
- PASS_WITH_GAPS: Display gaps as a warning, then continue.
- Proceed to Step 4i.

**If verdict is FAIL:**
Display the failures from the VERIFICATION-REPORT.md Summary section.

Use AskUserQuestion:
```
"Plan verification FAILED for wave {waveId}:

{Summary section from VERIFICATION-REPORT.md}

Failing jobs: {failingJobs list}

What would you like to do?"
Options:
- "Re-plan failing jobs" -- "Re-spawn job planners only for the failing jobs, then re-verify"
- "Override" -- "Proceed despite failures (you take responsibility for plan issues)"
- "Cancel" -- "Stop the entire planning chain (wave stays in discussing state)"
```

If "Re-plan failing jobs":
  - Re-read WAVE-PLAN.md and WAVE-RESEARCH.md
  - For each failing job, re-spawn the **rapid-job-planner** agent
  - After re-plan completes, re-spawn the **rapid-plan-verifier** agent
  - If re-verification also returns FAIL: present AskUserQuestion with ONLY "Override" and "Cancel" (no second re-plan -- maximum 1 re-plan attempt)
  - If re-verification returns PASS or PASS_WITH_GAPS: continue to Step 4i

If "Override":
  Log: "Proceeding with plan verification overridden by user for wave {waveId}."
  Continue to Step 4i.

If "Cancel":
  **STOP the entire planning chain.** Commit any already-completed wave artifacts (for re-entry). Display:
  "Planning cancelled. Investigate issues in VERIFICATION-REPORT.md. Completed waves are saved for re-entry.
  Re-run: /rapid:plan-set {SET_INDEX}"
  STOP.

#### Step 4i: Contract Validation Gate

Display progress: "Validating job plans against contracts for wave {waveId}..."

```bash
# (env preamble here)
VALIDATION_RESULT=$(node "${RAPID_TOOLS}" wave-plan validate-contracts "${SET_ID}" "${WAVE_ID}")
echo "$VALIDATION_RESULT"
```

Parse the JSON output (`violations`, `autoFixes`, `jobPlansFound`).

**PASS (no violations, no autoFixes):** Display "Wave {waveId}: All job plans validated against contracts."

**PASS_WITH_WARNINGS (autoFixes but no major violations):** Display auto-fixes noted. Continue.

**FAIL (major violations):** For each major violation, use AskUserQuestion:
```
"Contract violation in wave {waveId}: {violation.detail}"
Options:
- "Fix plan" -- "Remove the problematic import/export and find an alternative approach"
- "Update contract" -- "Add the missing export to the source set's contract"
- "Override" -- "Proceed anyway -- may be resolved during execution"
```
Handle each choice inline (same as wave-plan Step 6).

#### Step 4j: Transition Wave to Planning

All validation complete for this wave. Transition the wave state:

```bash
# (env preamble here)
node "${RAPID_TOOLS}" state transition wave "${MILESTONE_ID}" "${SET_ID}" "${WAVE_ID}" planning
```

Display: "Wave {waveId}: transitioned to planning state."

This transition is deferred until AFTER verification and contract validation pass. A FAIL verdict blocks the wave from entering `planning` state.

### Parallel Batch Execution Pattern

When a batch contains 2+ waves, interleave agent dispatches at each pipeline step:

1. **Step 4a:** Display banners for all waves in batch
2. **Step 4b:** Read context for all waves in batch
3. **Step 4c:** Spawn rapid-wave-researcher for all waves in batch simultaneously (parallel Agent calls)
4. Wait for all researchers to complete
5. **Step 4d:** Read research outputs for all waves
6. **Step 4e:** Spawn rapid-wave-planner for all waves in batch simultaneously
7. Wait for all planners to complete
8. **Step 4f:** Spawn rapid-job-planner agents for all waves (parallel within and across waves)
9. Wait for all job planners to complete
10. **Step 4g:** Spawn rapid-plan-verifier for all waves in batch simultaneously
11. Wait for all verifiers to complete
12. **Step 4h:** Handle verification verdicts for each wave (sequentially -- FAIL gates need user input)
13. **Step 4i:** Run contract validation for each wave
14. **Step 4j:** Transition each passing wave to planning state

If any wave in a parallel batch fails at verification (Step 4h) and the user cancels:
- Sibling waves that have already passed verification continue to completion (Steps 4i-4j)
- Only subsequent dependent batches are blocked
- The entire chain stops after the current batch finishes its passing waves

---

## Step 5: Commit All Artifacts and Present Results

After all batches complete (or after partial completion if chain was stopped):

### Commit Planning Artifacts

```bash
# (env preamble here)
git add ".planning/waves/${SET_ID}/"
if [ -f ".planning/sets/${SET_ID}/VALIDATION-REPORT.md" ]; then
  git add ".planning/sets/${SET_ID}/VALIDATION-REPORT.md"
fi
WAVES_PLANNED=$(ls -d ".planning/waves/${SET_ID}/"*/ 2>/dev/null | xargs -I{} basename {} | tr '\n' ', ' | sed 's/,$//')
git commit -m "plan(${SET_ID}): plan-set complete -- waves planned: ${WAVES_PLANNED}"
```

### Display Summary

```
"Set planning complete for '{SET_ID}'!

Waves planned:
  - {waveId-1}: {N} jobs, verification {PASS/PASS_WITH_GAPS/FAIL (overridden)}
  - {waveId-2}: {N} jobs, verification {PASS/PASS_WITH_GAPS/FAIL (overridden)}
  ...

Planning batches used: {N} ({M} parallel, {K} sequential)
Overrides: {list of overridden waves, or 'None'}
Skipped (already planned): {list, or 'None'}"
```

### Next Step

Display the next step (no AskUserQuestion -- Phase 28 decision):

> **Next step:** `/rapid:execute {SET_INDEX}`

---

## Error Handling

### Critical Errors (STOP immediately)
- `RAPID_TOOLS` not set: Show error and suggest `/rapid:install`
- `STATE.json` missing or invalid: Show error and suggest `/rapid:init`
- Any wave in `pending` state: Fail fast with list of undiscussed waves and suggest `/rapid:discuss`

### Wave Pipeline Failures
- Research agent fails: Continue without research (graceful degradation -- planner works from WAVE-CONTEXT.md alone)
- Wave planner agent fails: Mark wave as failed, skip remaining pipeline steps for that wave
- Job planner agent fails: Continue with available plans, note missing plans in verification
- Plan verifier returns FAIL: User gate -- re-plan / override / cancel (cancel stops entire chain)
- Contract validation FAIL: User gate per violation -- fix / update contract / override

### Chain Stop Behavior (Locked Decision)
- If any wave's planning fails and user selects "Cancel": the ENTIRE chain stops
- No skip-and-continue -- partial planning is committed for re-entry
- Re-run `/rapid:plan-set {SET_INDEX}` triggers smart re-entry (skips completed waves)

### Parallel Batch Failure Behavior
- If one wave in a parallel batch fails: sibling waves continue to completion
- Only subsequent dependent batches are blocked by the failed wave
- Completed waves within the batch are committed and transitioned normally

## Anti-Patterns to Avoid

- **Do NOT invoke `/rapid:wave-plan` skill.** Skills cannot call other skills. Plan-set replicates the pipeline inline.
- **Do NOT write persistent analyzer artifacts.** RAPID:RETURN from wave-analyzer is ephemeral (user decision). No DEPENDENCY-GRAPH.json or similar.
- **Do NOT attempt sub-sub-agent spawning.** Agents spawned by plan-set cannot spawn their own sub-agents. Plan-set dispatches all Agent tool calls directly.
- **Do NOT skip undiscussed waves.** Fail fast if ANY wave is `pending`. All waves must be discussed before set-level planning.
- **Do NOT transition wave state before verification passes.** State transition is deferred to Step 4j (after verification and contract validation).

## Key Principles

- **Single command:** User runs `/rapid:plan-set 1` and all waves in set 1 are planned without further manual wave-plan invocations.
- **Dependency-aware sequencing:** Independent waves plan in parallel batches; dependent waves plan sequentially with predecessor artifacts available.
- **Full pipeline per wave:** Research -> Wave Plan -> Job Plans -> Verify -> Validate -> Transition. Each stage depends on the prior output.
- **Smart re-entry:** Re-running `/rapid:plan-set` after partial completion skips already-planned waves and plans only remaining `discussing` waves.
- **Fail fast:** Pending (undiscussed) waves abort the entire command immediately.
- **Chain-stop on cancel:** If any wave's verification fails and user cancels, the entire chain stops. Partial progress is saved.
- **All CLI calls via RAPID_TOOLS:** Never edit STATE.json directly. All state transitions via `node "${RAPID_TOOLS}" state transition` CLI.
