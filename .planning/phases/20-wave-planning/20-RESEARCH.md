# Phase 20: Wave Planning - Research

**Researched:** 2026-03-07
**Domain:** Wave-level discussion, multi-stage planning pipeline, contract validation
**Confidence:** HIGH

## Summary

Phase 20 delivers the wave-level planning pipeline: a `/rapid:discuss` skill for capturing developer vision per wave, a wave research agent, a two-stage planner (Wave Planner then Job Planner), and a contract validation gate. This replaces the current v1.0 execute skill's inline discuss/plan steps (Steps 5-6 in `skills/execute/SKILL.md`) with dedicated, more thorough wave-scoped equivalents.

The codebase already has all necessary infrastructure: `state-machine.cjs` provides `transitionWave()` for the `pending > discussing > planning > executing` flow, `state-transitions.cjs` defines legal wave transitions, `assembler.cjs` builds agent prompts from composable modules, and `contract.cjs` provides `compileContract()` and `createManifest()` for validation. The work is primarily new skill files, new agent role modules, new CLI subcommands, and the planning artifact directory structure under `.planning/waves/`.

**Primary recommendation:** Build five deliverables in sequence: (1) the `/rapid:discuss` skill with GSD-style gray area identification, (2) new CLI subcommands for wave planning operations, (3) three new agent role modules (wave-researcher, wave-planner, job-planner), (4) a `/rapid:wave-plan` skill (or extend `/rapid:plan`) that orchestrates the research-then-plan pipeline, and (5) the contract validation gate with VALIDATION-REPORT.md output.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- /discuss is a standalone skill (`skills/discuss/SKILL.md`) -- developer runs `/rapid:discuss <wave>` manually
- /execute does NOT orchestrate discussion -- it checks if discussion happened and prompts if missing
- Discussion scope is per-wave holistic: identify gray areas across all jobs in the wave, then deep-dive selected areas. Jobs are context but not individually discussed
- Every AskUserQuestion includes a "Claude decides" option so the developer can opt out per-question
- /discuss transitions wave to 'discussing' AND set from 'pending' to 'planning' (first discussion triggers set transition)
- Discussion style is similar to GSD's discuss-phase: gray area identification, multi-select which to discuss, 4-question loops per area
- Two-stage planning: Wave Planner produces high-level per-job plans, then Job Planner expands each into detailed implementation plans
- User discussion happens ONLY at wave level in /discuss -- both Wave Planner and Job Planner work autonomously from CONTEXT.md without additional user discussion per job
- Output: JOB-PLAN.md per job with approach, files to create/modify, implementation steps, acceptance criteria
- JOB-PLAN.md files live in the set's worktree: `.planning/waves/{wave-id}/{job-id}-PLAN.md`
- Wave Planner produces an intermediate WAVE-PLAN.md with high-level job approach summaries that Job Planner consumes
- Single focused research agent per wave (not 5 parallel agents like init)
- Research agent reads CONTEXT.md + CONTRACT.json + targeted codebase files related to the wave's jobs
- Research agent uses Context7 MCP for documentation lookups on libraries/frameworks in scope
- Output: WAVE-RESEARCH.md stored in set's `.planning/waves/{wave-id}/WAVE-RESEARCH.md`
- Research is more focused than init research since specific jobs and their file targets are already known
- Post-planning gate: after all job plans are produced, contract validation runs before transitioning wave to 'executing'
- Simple violations (missing exports, type mismatches) are auto-fixed in the plan
- Complex violations (structural conflicts, cross-set incompatibilities) escalate to user with specific choices: fix plan, update contract, or override
- Cross-set import validation: checks that referenced imports match what other sets' contracts promise to export, but ignores minor differences
- Produces VALIDATION-REPORT.md in the set's `.planning/` directory with violations found, auto-fixes applied, and cross-set dependency check results

### Claude's Discretion
- Internal agent prompt design for wave research agent, Wave Planner, and Job Planner role modules
- WAVE-PLAN.md template structure and level of detail
- How "minor differences" are distinguished from "contract violations" in cross-set validation
- Error handling and recovery during the multi-stage planning pipeline
- How the discuss skill identifies gray areas for a given wave (analysis heuristics)
- Exact AskUserQuestion wording and option design within /discuss

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WAVE-01 | /discuss captures user implementation vision per wave via AskUserQuestion | GSD discuss-phase pattern analysis, existing AskUserQuestion patterns from v1.1, wave state transition infrastructure |
| WAVE-02 | /discuss is comprehensive -- probes uncovered facets, asks about edge cases, only acts autonomously if user opts in | GSD 4-question loop pattern, "Claude decides" option design, gray area identification heuristics |
| WAVE-03 | /plan spawns research agents to investigate how to implement wave jobs | Assembler module system for agent construction, existing research agent role patterns from Phase 18, Context7 integration |
| WAVE-04 | Wave Planner produces high-level per-job plans with structured output | Existing set-planner and roadmapper role patterns, WAVE-PLAN.md template design, structured JSON return protocol |
| WAVE-05 | Job Planner creates detailed per-job implementation plans with user discussion | JOB-PLAN.md template design, existing plan patterns from v1.0 skills, per-job structured output format |
| WAVE-06 | Job Planner validates plans against interface contracts | contract.cjs validation infrastructure, CONTRACT_META_SCHEMA, cross-set import/export matching, VALIDATION-REPORT.md format |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js (node:test) | 18+ | Test framework | Already used across all 20+ test files in the project |
| Node.js (node:assert/strict) | 18+ | Test assertions | Paired with node:test, used consistently |
| Zod | 3.25.76 | Schema validation | Already used for state schemas (state-schemas.cjs) |
| Ajv | 8.17.1 | JSON Schema validation | Already used for contract validation (contract.cjs) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| proper-lockfile | 4.1.2 | Atomic locks | Already used for state write protection via lock.cjs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node:test | jest/vitest | node:test is already the project standard -- zero additional deps |
| Ajv for contract validation | Zod | Ajv is the existing contract.cjs validator -- Zod is for state schemas only |

**Installation:**
```bash
# No new dependencies needed -- all libraries are already installed
```

## Architecture Patterns

### Recommended Project Structure

New files to create:

```
skills/
  discuss/
    SKILL.md                          # /rapid:discuss skill (new)
  wave-plan/
    SKILL.md                          # /rapid:wave-plan skill (new, or extend plan/)

src/
  modules/
    roles/
      role-wave-researcher.md         # Wave research agent role (new)
      role-wave-planner.md            # Wave planner agent role (new)
      role-job-planner.md             # Job planner agent role (new)
  lib/
    wave-planning.cjs                 # Wave planning logic (new)
    wave-planning.test.cjs            # Tests (new)

# Runtime artifact structure (per set worktree):
.planning/
  waves/
    {wave-id}/
      WAVE-CONTEXT.md                 # Output of /discuss for this wave
      WAVE-RESEARCH.md                # Output of wave research agent
      WAVE-PLAN.md                    # Output of Wave Planner (high-level)
      {job-id}-PLAN.md                # Output of Job Planner (detailed, per job)
  VALIDATION-REPORT.md               # Contract validation results (per set)
```

### Pattern 1: Discuss Skill (GSD discuss-phase adaptation)

**What:** A standalone skill that captures developer implementation vision for a wave, following the GSD discuss-phase pattern of gray area identification, multi-select, and 4-question deep-dive loops.

**When to use:** Developer runs `/rapid:discuss <wave-id>` before planning begins.

**How it maps from GSD:**

| GSD discuss-phase | RAPID /discuss |
|-------------------|----------------|
| Phase goal from ROADMAP.md | Wave goal from STATE.json + job descriptions |
| Phase-specific gray areas | Wave-specific gray areas across all jobs |
| Prior CONTEXT.md files | Set CONTRACT.json + DEFINITION.md + SET-OVERVIEW.md |
| Codebase scout via grep | Targeted file reads from wave job file targets |
| 4-question loops per area | 4-question loops per area with "Claude decides" option |
| Write CONTEXT.md | Write WAVE-CONTEXT.md to `.planning/waves/{wave-id}/` |
| Phase boundary scope check | Wave boundary scope check (deferred ideas go to backlog) |

**Key adaptation from GSD:**
- GSD uses `AskUserQuestion` with `multiSelect: true` -- RAPID must do the same
- GSD does NOT include a "skip"/"you decide" in the multi-select -- RAPID adds "Claude decides" per individual question within loops, not at the area-selection level
- GSD's `<prior_decisions>` becomes reading existing set-level artifacts (CONTRACT.json, SET-OVERVIEW.md)
- GSD's `<code_context>` becomes reading the actual source files that jobs will modify

**State transitions:**
```
Wave: pending -> discussing (on discuss start)
Set: pending -> planning (on first wave discuss, if set was pending)
Wave: discussing -> planning (when /wave-plan starts)
```

The discuss skill calls:
```bash
node "${RAPID_TOOLS}" state transition wave <milestoneId> <setId> <waveId> discussing
```

And for the first wave discussion, also:
```bash
node "${RAPID_TOOLS}" state transition set <milestoneId> <setId> planning
```

### Pattern 2: Multi-Stage Planning Pipeline

**What:** Three-stage autonomous pipeline: Research -> Wave Plan -> Job Plans, all working from WAVE-CONTEXT.md without additional user interaction.

**When to use:** After `/rapid:discuss` completes, developer runs `/rapid:wave-plan <wave-id>`.

**Pipeline flow:**

```
WAVE-CONTEXT.md
       |
       v
[Wave Research Agent]  -- reads CONTEXT + CONTRACT + targeted files + Context7
       |
       v
WAVE-RESEARCH.md
       |
       v
[Wave Planner Agent]   -- reads CONTEXT + RESEARCH, produces high-level per-job plans
       |
       v
WAVE-PLAN.md
       |
       v
[Job Planner Agent]    -- for EACH job, reads WAVE-PLAN + RESEARCH + relevant files
       |
       v
{job-id}-PLAN.md (one per job)
       |
       v
[Contract Validation]  -- validates all job plans against CONTRACT.json
       |
       v
VALIDATION-REPORT.md
```

**Agent spawning:** The wave-plan skill spawns agents sequentially:
1. Single research agent (Agent tool)
2. Single wave planner agent (Agent tool)
3. Job planner agents -- can be spawned in parallel (one per job) since they share read-only inputs

**Structured returns:** Each agent uses the RAPID:RETURN protocol (COMPLETE/CHECKPOINT/BLOCKED). If any agent returns BLOCKED, the pipeline stops and prompts the user.

### Pattern 3: Contract Validation Gate

**What:** Post-planning validation that checks all job plans against CONTRACT.json before allowing the wave to transition to 'executing'.

**When to use:** Automatically at the end of the wave-plan pipeline.

**Validation checks:**
1. **Export coverage:** Every function/type in CONTRACT.json exports is referenced in at least one job plan's "files to create/modify"
2. **Import satisfaction:** Every import references an export that exists in another set's CONTRACT.json
3. **Type consistency:** Parameter types and return types in imports match the source set's exports
4. **File ownership:** Job plans only modify files owned by this set (per OWNERSHIP.json)
5. **Behavioral invariants:** Job plans acknowledge and plan for behavioral constraints

**Violation classification:**

| Severity | Example | Action |
|----------|---------|--------|
| Auto-fix | Job plan missing a contract export -- add it to the relevant job | Fix in plan, note in report |
| Minor | Slight type naming mismatch (e.g., `userId` vs `user_id`) | Note in report, do not block |
| Major | Job plan imports function not exported by any set | Escalate to user with choices |

**User escalation pattern (AskUserQuestion):**
```
"Contract violation found: Job {jobId} imports '{functionName}' from set '{setId}', but that set does not export it."
Options:
- "Fix plan" -- "Remove the import from this job's plan and find an alternative approach"
- "Update contract" -- "Add '{functionName}' to set '{setId}' exports (requires re-planning that set)"
- "Override" -- "Proceed anyway -- the import may be added during execution"
```

### Anti-Patterns to Avoid

- **Re-asking decided questions:** The discuss skill must read CONTRACT.json, DEFINITION.md, and SET-OVERVIEW.md to avoid re-asking questions already settled during set planning. The GSD pattern of loading prior context is critical.
- **Per-job user discussion:** The user explicitly decided that discussion happens only at wave level. Job Planner must work autonomously from WAVE-CONTEXT.md without asking the user per-job questions.
- **Over-researching:** The wave research agent is focused (single agent, not 5 parallel) because specific jobs and their file targets are already known. Do not replicate the init research pattern.
- **Skipping contract validation:** The validation gate is mandatory before wave transitions to 'executing'. Do not allow bypass without explicit user override.
- **Monolithic planning:** Wave Planner produces WAVE-PLAN.md (high-level), then Job Planner produces per-job plans. Do not combine these into a single step -- the two-stage approach ensures the wave-level vision is coherent before diving into per-job details.
- **Writing STATE.json directly:** All state transitions go through `rapid-tools.cjs` CLI commands, never by editing STATE.json directly from skills or agents.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wave state transitions | Manual JSON edits | `transitionWave()` via CLI | Lock-protected, validated transitions with automatic set status derivation |
| Contract validation | Custom schema validator | `compileContract()` from contract.cjs + Ajv | Already handles meta-schema validation, error formatting |
| Agent prompt assembly | String concatenation | `assembleAgent()` from assembler.cjs | Handles frontmatter, core modules, role modules, context injection, size warnings |
| Structured returns | Ad-hoc JSON | RAPID:RETURN protocol (core-returns.md) | COMPLETE/CHECKPOINT/BLOCKED with standardized fields, parseable by CLI |
| File locking | Manual lock files | `acquireLock()` from lock.cjs | Handles stale lock detection, exponential backoff, PID tracking |
| Cross-set import resolution | Manual CONTRACT.json reading | `createManifest()` from contract.cjs | Cross-references imports across all sets, builds consumer maps |

**Key insight:** Phase 20 is primarily orchestration and prompt engineering. The hard infrastructure (state machine, contracts, locks, assembler) is already built. The work is composing these pieces into new skills, roles, and CLI commands.

## Common Pitfalls

### Pitfall 1: Double State Transition on Discuss Start
**What goes wrong:** The discuss skill must transition both the wave (pending -> discussing) AND the set (pending -> planning) on first discussion. Doing these separately risks a crash between transitions leaving inconsistent state.
**Why it happens:** Two separate CLI calls with a window between them.
**How to avoid:** Call the wave transition first (it succeeds or fails atomically). Then call the set transition. If the set transition fails because it is already in 'planning' (another wave was discussed first), that is fine -- catch the error and continue. The set transition is idempotent in effect.
**Warning signs:** Error "Invalid set transition: planning -> planning" on second wave discussion.

### Pitfall 2: Missing Wave ID Resolution
**What goes wrong:** The user runs `/rapid:discuss wave-1` but the actual wave ID in STATE.json might be different (e.g., `wave-1` vs `w1` vs `1`).
**Why it happens:** Wave IDs are assigned by the roadmapper agent during init and may not follow a predictable pattern.
**How to avoid:** The discuss skill must resolve wave identifiers by reading STATE.json and listing available waves for the current set. Provide fuzzy matching or a selection prompt if the provided ID is ambiguous.
**Warning signs:** "Wave 'wave-1' not found in set 'xyz'" errors.

### Pitfall 3: WAVE-CONTEXT.md Path in Worktree vs Main
**What goes wrong:** The discuss skill writes WAVE-CONTEXT.md but the wave-plan skill (possibly running in a different context) cannot find it because it is looking in the wrong directory.
**Why it happens:** Planning artifacts live in the set's worktree at `.planning/waves/{wave-id}/`, but the main repo also has `.planning/`. The skill must determine the correct worktree path.
**How to avoid:** Use `node "${RAPID_TOOLS}" worktree list` to resolve the set's worktree path, then construct all artifact paths relative to that worktree. Or work from the main project root if the set's worktree is not yet created (discuss can happen before execution begins).
**Warning signs:** Files written to `.planning/waves/` in main repo but expected in worktree, or vice versa.

### Pitfall 4: Job Planner Agents Conflicting on Shared Files
**What goes wrong:** When Job Planner agents run in parallel (one per job), they might produce plans that both want to modify the same file.
**Why it happens:** Multiple jobs in a wave may legitimately need to touch the same source file.
**How to avoid:** The Wave Planner's WAVE-PLAN.md should explicitly assign primary file ownership per job within the wave. The contract validation gate checks for intra-wave file conflicts. Job Planner agents receive the full WAVE-PLAN.md context showing all job assignments.
**Warning signs:** Two JOB-PLAN.md files listing the same file under "files to create/modify".

### Pitfall 5: Contract Validation False Positives
**What goes wrong:** The validation gate rejects valid plans because of overly strict matching (e.g., `string` vs `String`, or a function that will be added by a dependency set).
**Why it happens:** Literal string comparison of types/names without semantic understanding.
**How to avoid:** Implement the "minor differences" tolerance the user specified: case-insensitive type name matching, ignoring whitespace differences, and noting but not blocking on imports from dependency sets that have not completed yet. Use the CONTEXT.md "Claude's Discretion" guidance for the threshold.
**Warning signs:** User repeatedly overriding validation results, indicating too many false positives.

### Pitfall 6: Planning in Main Repo vs Worktree
**What goes wrong:** The discuss and wave-plan skills need to decide whether to work in the main repo or the set's worktree. Inconsistency causes artifacts to scatter.
**Why it happens:** The set's worktree might not exist yet when discussing (set-init creates worktrees), or the developer might run discuss from the main repo.
**How to avoid:** Decision: Planning artifacts live in the MAIN repo under `.planning/waves/{wave-id}/` (not in the worktree). The worktree is for source code execution. This keeps planning artifacts accessible to all agents regardless of which worktree they are in. The set's worktree `CLAUDE.md` can reference these plans.
**Warning signs:** Artifacts split between worktree and main repo, confusion about which is authoritative.

## Code Examples

### Wave State Transition via CLI

```bash
# Transition wave from pending to discussing
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi

# Get current milestone and set context
STATE_JSON=$(node "${RAPID_TOOLS}" state get --all)
MILESTONE_ID=$(echo "$STATE_JSON" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8'));console.log(d.currentMilestone)")

# Transition wave to discussing
node "${RAPID_TOOLS}" state transition wave "$MILESTONE_ID" "$SET_ID" "$WAVE_ID" discussing

# Transition set to planning (first discuss triggers this)
node "${RAPID_TOOLS}" state transition set "$MILESTONE_ID" "$SET_ID" planning 2>/dev/null || true
```

### Creating the Waves Directory Structure

```bash
# Create wave planning artifact directory
mkdir -p ".planning/waves/${WAVE_ID}"

# After discuss:  WAVE-CONTEXT.md
# After research: WAVE-RESEARCH.md
# After wave-plan: WAVE-PLAN.md
# After job-plan: {job-id}-PLAN.md (one per job)
```

### Agent Spawning Pattern (from existing init skill)

The wave research agent follows the same pattern as init research agents:

```
Agent tool call:
- Pass role instructions from role-wave-researcher.md
- Pass the WAVE-CONTEXT.md content (from /discuss)
- Pass the CONTRACT.json for this set
- Pass the targeted codebase file contents (files the wave's jobs will modify)
- Include Context7 instruction for documentation lookups
- Agent writes WAVE-RESEARCH.md to .planning/waves/{wave-id}/
```

### Contract Validation Logic

```javascript
// Validate job plans against CONTRACT.json
// Uses existing contract.cjs infrastructure

const { compileContract, createManifest } = require('./contract.cjs');

function validateJobPlans(contractJson, jobPlans, allSetContracts) {
  const violations = [];
  const autoFixes = [];

  // 1. Check export coverage
  const exports = contractJson.exports || {};
  const plannedFiles = new Set();
  for (const plan of jobPlans) {
    for (const file of plan.filesToModify || []) {
      plannedFiles.add(file);
    }
  }

  for (const fn of (exports.functions || [])) {
    if (!plannedFiles.has(fn.file)) {
      autoFixes.push({
        type: 'missing-export-coverage',
        detail: `Export '${fn.name}' in '${fn.file}' not covered by any job plan`,
        fix: `Add ${fn.file} to the most relevant job's file list`
      });
    }
  }

  // 2. Cross-set import validation
  const imports = contractJson.imports || {};
  if (imports.fromSets) {
    for (const imp of imports.fromSets) {
      const sourceContract = allSetContracts[imp.set];
      if (!sourceContract) {
        violations.push({
          severity: 'major',
          detail: `Imports from set '${imp.set}' but no contract found for that set`
        });
        continue;
      }
      // Check each imported function exists in source exports
      for (const fnName of (imp.functions || [])) {
        const sourceExports = sourceContract.exports?.functions || [];
        const found = sourceExports.some(f =>
          f.name.toLowerCase() === fnName.toLowerCase()
        );
        if (!found) {
          violations.push({
            severity: 'major',
            detail: `Imports '${fnName}' from set '${imp.set}' but that set does not export it`
          });
        }
      }
    }
  }

  return { violations, autoFixes };
}
```

### WAVE-PLAN.md Template

```markdown
# WAVE-PLAN: {wave-id}

**Set:** {set-name}
**Wave:** {wave-number}
**Generated:** {date}

## Wave Objective

{2-3 sentences summarizing what this wave accomplishes, derived from WAVE-CONTEXT.md}

## Job Summaries

### Job: {job-id}
**Objective:** {what this job delivers}
**Approach:** {high-level implementation strategy}
**Key Files:**
- {file1} -- {what changes}
- {file2} -- {what changes}
**Dependencies:** {other jobs in this wave it relates to, or "independent"}
**Estimated complexity:** {S/M/L}

### Job: {job-id}
...

## Intra-Wave Coordination

{Notes on shared files, ordering constraints, or integration points between jobs in this wave}

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| {risk} | {H/M/L} | {how to handle} |
```

### JOB-PLAN.md Template

```markdown
# JOB-PLAN: {job-id}

**Set:** {set-name}
**Wave:** {wave-id}
**Job:** {job-name}
**Generated:** {date}

## Objective

{What this job delivers -- 1-2 sentences}

## Approach

{Implementation strategy -- 2-3 paragraphs covering the technical approach, key design decisions, and how this job fits into the wave}

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| {path} | Create/Modify | {what changes and why} |

## Implementation Steps

1. **{Step title}**
   - {Detailed instruction}
   - {Expected outcome}
   - Commit: `type({set-name}): {description}`

2. **{Step title}**
   - {Detailed instruction}
   - {Expected outcome}
   - Commit: `type({set-name}): {description}`

## Acceptance Criteria

- [ ] {Criterion 1 -- verifiable}
- [ ] {Criterion 2 -- verifiable}

## Contract Compliance

- **Exports implemented:** {list of CONTRACT.json exports this job satisfies}
- **Imports consumed:** {list of imports this job uses}
- **Invariants honored:** {behavioral invariants this job must respect}

## Notes

{Any additional context, edge cases to watch for, or coordination notes}
```

### VALIDATION-REPORT.md Template

```markdown
# Validation Report: {set-name}

**Wave:** {wave-id}
**Generated:** {date}
**Result:** {PASS / PASS_WITH_WARNINGS / FAIL}

## Export Coverage

| Export | File | Covered by Job | Status |
|--------|------|----------------|--------|
| {name} | {file} | {job-id} | OK / MISSING |

## Import Validation

| Import | From Set | Exists in Source | Status |
|--------|----------|-----------------|--------|
| {name} | {set-id} | Yes/No | OK / VIOLATION |

## Auto-Fixes Applied

| Fix | Detail | Applied To |
|-----|--------|------------|
| {type} | {description} | {job-id}-PLAN.md |

## Violations

| Severity | Detail | Resolution Options |
|----------|--------|-------------------|
| Major | {description} | Fix plan / Update contract / Override |
| Minor | {description} | Noted -- no action required |

## Cross-Set Dependency Check

| This Set Imports | From Set | Set Status | Available |
|------------------|----------|------------|-----------|
| {function} | {set-id} | {pending/executing/complete} | Yes/No/Pending |
```

## State of the Art

| Old Approach (v1.0 execute skill) | New Approach (Phase 20) | Why Changed |
|---|---|---|
| Inline discuss per set in execute skill (Step 5) | Standalone /discuss skill per wave | More thorough, follows GSD pattern, user-driven depth |
| Inline plan per set in execute skill (Step 6) | Two-stage Wave Planner + Job Planner pipeline | Higher quality plans with research backing |
| No contract validation before execution | Mandatory validation gate with VALIDATION-REPORT.md | Catches violations early, before execution wastes time |
| No research during planning | Single focused research agent per wave | Targeted investigation of implementation specifics |
| Set-level scope (all waves treated together) | Wave-level scope (discuss + plan per wave) | Finer granularity, more relevant discussion per wave |

**Deprecated/outdated from execute skill:**
- Steps 5-6 of `skills/execute/SKILL.md` (discuss and plan phases) will be superseded by the new discuss and wave-plan skills. The execute skill should be updated to check for the existence of JOB-PLAN.md files and VALIDATION-REPORT.md before proceeding to execution.

## Open Questions

1. **Where do wave planning artifacts live -- main repo or worktree?**
   - What we know: CONTEXT.md says `.planning/waves/{wave-id}/` but does not specify main vs worktree
   - What's unclear: Whether the `.planning/waves/` path is relative to the set's worktree or the main project root
   - Recommendation: Store in main repo under `.planning/waves/{set-id}/{wave-id}/` (include set-id to namespace). This keeps planning artifacts accessible from any context and avoids coupling to worktree lifecycle. The worktree is for source code execution only.

2. **How does the discuss skill determine which set the wave belongs to?**
   - What we know: The user runs `/rapid:discuss <wave-id>`. Waves are nested inside sets inside milestones.
   - What's unclear: Whether the user also provides the set, or the skill looks it up
   - Recommendation: Accept either `/rapid:discuss <set-id> <wave-id>` or `/rapid:discuss <wave-id>` (auto-detect set by scanning STATE.json for the wave). If the wave ID is ambiguous across sets, prompt the user.

3. **Should the wave-plan skill be a new skill or an extension of /rapid:plan?**
   - What we know: /rapid:plan currently handles set-level decomposition into parallelizable sets
   - What's unclear: Whether a new skill or an extended plan skill is cleaner
   - Recommendation: Create a new `/rapid:wave-plan` skill. The existing /rapid:plan handles project-level set decomposition (different scope). A new skill avoids overloading and keeps skills focused.

4. **How does Job Planner receive job definitions when jobs are just IDs in STATE.json?**
   - What we know: STATE.json stores minimal job data (id, status, timestamps). ROADMAP.md has job titles. SET-OVERVIEW.md has preliminary wave breakdown.
   - What's unclear: Where the detailed job descriptions come from for the Job Planner
   - Recommendation: The Wave Planner (WAVE-PLAN.md) produces the detailed job descriptions. The roadmapper only set titles and complexity. The Wave Planner, with research and context, fleshes out what each job actually needs to do.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) |
| Config file | None -- uses CLI flags |
| Quick run command | `node --test src/lib/wave-planning.test.cjs` |
| Full suite command | `node --test src/lib/*.test.cjs` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WAVE-01 | Discuss skill transitions wave state and produces WAVE-CONTEXT.md | integration | `node --test src/lib/wave-planning.test.cjs` | Wave 0 |
| WAVE-02 | Gray area identification produces actionable questions | unit | `node --test src/lib/wave-planning.test.cjs` | Wave 0 |
| WAVE-03 | Research agent produces WAVE-RESEARCH.md from wave context | integration | Manual -- requires Agent tool | Wave 0 |
| WAVE-04 | Wave Planner produces WAVE-PLAN.md with per-job summaries | integration | Manual -- requires Agent tool | Wave 0 |
| WAVE-05 | Job Planner produces JOB-PLAN.md per job | integration | Manual -- requires Agent tool | Wave 0 |
| WAVE-06 | Contract validation detects violations and produces VALIDATION-REPORT.md | unit | `node --test src/lib/wave-planning.test.cjs` | Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test src/lib/wave-planning.test.cjs`
- **Per wave merge:** `node --test src/lib/*.test.cjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/wave-planning.cjs` -- core wave planning logic (state transitions, validation, artifact management)
- [ ] `src/lib/wave-planning.test.cjs` -- unit tests for wave planning functions
- [ ] `skills/discuss/SKILL.md` -- /rapid:discuss skill file
- [ ] `skills/wave-plan/SKILL.md` -- /rapid:wave-plan skill file
- [ ] `src/modules/roles/role-wave-researcher.md` -- wave research agent role
- [ ] `src/modules/roles/role-wave-planner.md` -- wave planner agent role
- [ ] `src/modules/roles/role-job-planner.md` -- job planner agent role

## Sources

### Primary (HIGH confidence)
- `/home/kek/Projects/RAPID/src/lib/state-machine.cjs` -- Wave transition functions (transitionWave, findWave, deriveWaveStatus)
- `/home/kek/Projects/RAPID/src/lib/state-transitions.cjs` -- WAVE_TRANSITIONS: pending > discussing > planning > executing > reconciling > complete
- `/home/kek/Projects/RAPID/src/lib/state-schemas.cjs` -- WaveState and JobState Zod schemas
- `/home/kek/Projects/RAPID/src/lib/contract.cjs` -- compileContract(), createManifest(), createOwnershipMap()
- `/home/kek/Projects/RAPID/src/lib/assembler.cjs` -- assembleAgent() with role/core module composition
- `/home/kek/Projects/RAPID/src/bin/rapid-tools.cjs` -- Existing CLI subcommand patterns
- `/home/kek/Projects/RAPID/skills/init/SKILL.md` -- Research agent spawning pattern (5 parallel agents)
- `/home/kek/Projects/RAPID/skills/execute/SKILL.md` -- Current inline discuss/plan pattern to replace
- `/home/kek/Projects/RAPID/skills/set-init/SKILL.md` -- Set initialization and agent spawning pattern
- `/home/kek/Projects/RAPID/src/modules/roles/role-set-planner.md` -- Existing planner role module pattern
- `/home/kek/Projects/RAPID/src/modules/roles/role-research-stack.md` -- Existing research agent role pattern
- `/home/kek/Projects/RAPID/src/modules/roles/role-roadmapper.md` -- Structured JSON return from agent pattern
- `/home/kek/Projects/RAPID/src/modules/core/core-returns.md` -- RAPID:RETURN protocol

### Secondary (MEDIUM confidence)
- `/home/kek/.claude/get-shit-done/workflows/discuss-phase.md` -- GSD discuss-phase pattern (the template RAPID's discuss is modeled after)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing project libraries
- Architecture: HIGH -- clear patterns from existing skills and roles, direct codebase verification
- Pitfalls: HIGH -- derived from analysis of actual codebase state transitions and file layout patterns
- Contract validation: MEDIUM -- the validation logic is new code, but builds on verified contract.cjs infrastructure

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable -- no external dependencies, all internal patterns)
