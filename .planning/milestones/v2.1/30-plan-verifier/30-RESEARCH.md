# Phase 30: Plan Verifier - Research

**Researched:** 2026-03-10
**Domain:** Plan validation agent, wave-plan pipeline integration, file-system verification
**Confidence:** HIGH

## Summary

Phase 30 adds a plan verification step at the end of the `/rapid:wave-plan` pipeline. The verifier is a dedicated subagent (`rapid-plan-verifier`) spawned after all job planner agents complete (Step 5) but before the existing contract validation gate (Step 6) and commit (Step 7). It reads all JOB-PLAN.md files holistically against WAVE-PLAN.md and WAVE-CONTEXT.md to check three dimensions: coverage (all wave requirements addressed), implementability (file references valid against the actual codebase), and consistency (no file ownership conflicts within the wave). The verifier can auto-fix minor issues by editing JOB-PLAN.md files directly, and outputs a VERIFICATION-REPORT.md with a PASS/PASS_WITH_GAPS/FAIL verdict.

The implementation involves four areas: (1) creating a new agent role module (`role-plan-verifier.md`) with Glob/Read/Write tools, (2) registering it in the build-agents infrastructure (`ROLE_TOOLS`, `ROLE_COLORS`, `ROLE_DESCRIPTIONS`, `ROLE_CORE_MAP`), (3) modifying the wave-plan SKILL.md to spawn the verifier between Steps 5 and 6 with appropriate FAIL gate handling, and (4) writing unit tests for the helper functions. The existing `parseJobPlanFiles()` in `execute.cjs` provides a proven parser for the "Files to Create/Modify" table -- the verifier agent can reuse this directly by reading and parsing JOB-PLAN.md content. The existing `validateJobPlans()` in `wave-planning.cjs` handles contract-level validation (export coverage, cross-set imports) and runs alongside the verifier agent's semantic checks.

**Primary recommendation:** Implement as a new agent role with file-system tools (Read, Write, Glob, Grep), integrated into the wave-plan skill as a new Step 5.5 between job planner fan-out and contract validation. The verifier agent does LLM-based semantic analysis for coverage and uses Glob/Read for implementability checks. File conflict detection is done by parsing all JOB-PLAN.md files and cross-referencing their "Files to Create/Modify" tables.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Invocation Point
- Verifier runs automatically as the final step of `/rapid:wave-plan` -- no separate command
- On FAIL: wave state stays in 'discussing' (does not transition to 'planning') -- blocks execute
- On PASS or PASS_WITH_GAPS: wave transitions to 'planning' normally
- Verifier is a dedicated subagent (`rapid-plan-verifier`), not inline logic
- Verifier has read + edit access to JOB-PLAN.md files -- can auto-fix minor issues directly

#### Coverage Detection
- Semantic analysis by the verifier agent (LLM reasoning, not string matching)
- Source of truth: both WAVE-PLAN.md (structural coverage) and WAVE-CONTEXT.md (decision compliance)
- Verifier reads all JOB-PLAN.md files holistically against these two sources
- File ownership overlap within a wave: verifier flags conflicts AND suggests which job should own the contested file, auto-fixing if the choice is clear

#### Implementability Checks
- Verifier scans the actual codebase (Glob/Read) to confirm files marked 'Modify' exist on disk
- Files marked 'Create' checked to not already exist (catches stale plans)
- Cross-job dependency ordering checked logically (Job B references file Job A creates -> A must come first)

#### Verdict Thresholds
- **PASS**: All requirements covered, no file conflicts, all references valid
- **PASS_WITH_GAPS**: Minor gaps -- requirement partially addressed, non-critical section missing, but structurally sound
- **FAIL**: File ownership conflicts, requirements entirely missing, referenced files don't exist, structural issues the verifier can't auto-fix

#### PASS_WITH_GAPS Handling
- Auto-proceed with warning -- no user gate
- Gaps logged in VERIFICATION-REPORT.md
- Wave transitions normally; gaps often resolve during implementation

#### FAIL Decision Gate
- Three options: Re-plan / Override / Cancel
- Re-plan: re-runs job planners only for failing jobs (not entire wave)
- Override: proceed despite failures (user takes responsibility)
- Cancel: stop and let user investigate

#### Report Format
- Per-wave: `.planning/waves/{setId}/{waveId}/VERIFICATION-REPORT.md`
- One report per wave, alongside the JOB-PLAN.md files it verified
- Summary + per-check breakdown (not full per-file analysis)
- Sections: Coverage, Implementability, Consistency (file conflicts)
- Each section: pass/fail per item with brief notes
- Brief summaries of changes made (not full before/after diffs)
- Condensed verdict banner + any issues/gaps shown inline in terminal

### Claude's Discretion
- Exact criteria thresholds for PASS_WITH_GAPS vs FAIL edge cases
- Agent prompt structure and check ordering
- How to handle edge cases in cross-job dependency analysis

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAN-01 | Plan verifier agent checks coverage of all wave requirements against job plans | Verifier agent reads WAVE-PLAN.md + WAVE-CONTEXT.md holistically against all JOB-PLAN.md files using LLM semantic analysis; coverage section in VERIFICATION-REPORT.md |
| PLAN-02 | Plan verifier checks implementability (referenced files exist or are created) | Agent uses Glob tool to check files marked 'Modify' exist on disk, files marked 'Create' do not already exist; reuses parseJobPlanFiles() pattern from execute.cjs |
| PLAN-03 | Plan verifier checks consistency (no file ownership overlap within a wave) | Agent parses all JOB-PLAN.md "Files to Create/Modify" tables, cross-references for overlap, flags conflicts with suggested resolution |
| PLAN-04 | Plan verifier outputs VERIFICATION-REPORT.md with PASS/PASS_WITH_GAPS/FAIL verdict | Report at `.planning/waves/{setId}/{waveId}/VERIFICATION-REPORT.md` with Coverage, Implementability, Consistency sections |
| PLAN-05 | FAIL verdict triggers user decision gate (re-plan / override / cancel) | AskUserQuestion in wave-plan SKILL.md; re-plan re-spawns only failing job planners; state stays in 'discussing' on FAIL |
</phase_requirements>

## Standard Stack

### Core
| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| `role-plan-verifier.md` | `src/modules/roles/` | New role module for plan verification agent | Follows established role module pattern (27.1 architecture) |
| `rapid-plan-verifier.md` | `agents/` | Generated agent file | Built by `build-agents` from role module + core modules |
| `rapid-tools.cjs` | `src/bin/` | Agent registration (ROLE_TOOLS, ROLE_COLORS, etc.) | Central agent registry per Phase 27.1 pattern |
| `wave-plan SKILL.md` | `skills/wave-plan/` | Pipeline orchestration with new verification step | Existing skill receives new step between Steps 5 and 6 |

### Supporting (Existing, Reusable)
| Component | Location | Purpose | Reuse |
|-----------|----------|---------|-------|
| `parseJobPlanFiles()` | `src/lib/execute.cjs` | Parses "Files to Create/Modify" table from JOB-PLAN.md | Direct reuse for implementability + consistency checks |
| `validateJobPlans()` | `src/lib/wave-planning.cjs` | Contract-level validation (export coverage, cross-set imports) | Runs alongside (not replaced by) plan verifier |
| Structured return protocol | `core-returns.md` | `<!-- RAPID:RETURN {...} -->` for agent verdicts | Verifier returns verdict in standard format |
| `AskUserQuestion` | Skills framework | User decision gate for FAIL verdict | Existing pattern used in wave-plan SKILL.md |

### Not Needed
| Problem | Why Not | Instead |
|---------|---------|---------|
| Custom file parser | `parseJobPlanFiles()` already exists | Verifier agent reads files with Read tool, uses Glob for existence checks |
| New CLI subcommand | Verifier is an agent, not a CLI function | Agent spawned from SKILL.md like other pipeline agents |
| New state transitions | `discussing -> planning` already exists | FAIL simply does not transition; PASS transitions normally |

## Architecture Patterns

### Agent Registration Pattern (from Phase 27.1)
Every new agent follows this exact registration pattern in `rapid-tools.cjs`:

```javascript
// In ROLE_TOOLS
'plan-verifier': 'Read, Write, Grep, Glob',

// In ROLE_COLORS
'plan-verifier': 'blue',

// In ROLE_DESCRIPTIONS
'plan-verifier': 'RAPID plan verifier agent -- validates job plans for coverage, implementability, and consistency',

// In ROLE_CORE_MAP
'plan-verifier': ['core-identity.md', 'core-returns.md', 'core-context-loading.md'],
```

After registration, run `node "${RAPID_TOOLS}" build-agents` to generate `agents/rapid-plan-verifier.md`.

### Agent Spawning Pattern (from wave-plan SKILL.md)
```
Spawn the **rapid-plan-verifier** agent with this task:

Verify all job plans for wave '{waveId}' in set '{setId}'.

## Wave Plan
{WAVE-PLAN.md full contents}

## Wave Context
{WAVE-CONTEXT.md full contents}

## Job Plans
{All JOB-PLAN.md files concatenated with headers}

## Working Directory
{worktreePath}

## Output
Write VERIFICATION-REPORT.md to .planning/waves/{setId}/{waveId}/VERIFICATION-REPORT.md
```

### FAIL State Handling Pattern
The key architectural decision is that on FAIL, the wave state stays in `discussing` (the transition to `planning` has not yet occurred). The current wave-plan SKILL.md transitions to `planning` at the end of Step 2, before any agents run. This must change: the transition must move AFTER the verification step, so FAIL can block it.

**Current flow:**
```
Step 2: Resolve wave -> transition to 'planning'
Step 3: Research agent
Step 4: Wave planner agent
Step 5: Job planner agents
Step 6: Contract validation
Step 7: Commit
```

**New flow:**
```
Step 2: Resolve wave (NO transition yet)
Step 3: Research agent
Step 4: Wave planner agent
Step 5: Job planner agents
Step 5.5: Plan verifier agent -> VERIFICATION-REPORT.md
  - PASS/PASS_WITH_GAPS: proceed
  - FAIL: AskUserQuestion (re-plan/override/cancel)
    - re-plan: re-spawn failing job planners, re-run verifier
    - override: proceed despite failures
    - cancel: STOP (state remains 'discussing')
Step 6: Contract validation (existing)
Step 6.5: Transition wave to 'planning' (moved from Step 2)
Step 7: Commit
```

### VERIFICATION-REPORT.md Structure
```markdown
# VERIFICATION-REPORT: {waveId}

**Set:** {setId}
**Wave:** {waveId}
**Verified:** {date}
**Verdict:** {PASS | PASS_WITH_GAPS | FAIL}

## Coverage

| Requirement | Covered By | Status | Notes |
|------------|------------|--------|-------|
| {req from WAVE-PLAN.md} | {jobId} | PASS/GAP/MISSING | {detail} |

## Implementability

| File | Job | Action | Status | Notes |
|------|-----|--------|--------|-------|
| {path} | {jobId} | Modify | PASS/FAIL | {exists on disk / not found} |
| {path} | {jobId} | Create | PASS/FAIL | {does not exist / already exists} |

## Consistency

| File | Claimed By | Status | Resolution |
|------|-----------|--------|------------|
| {path} | {job-1, job-2} | CONFLICT | {auto-fixed: assigned to job-1 / needs manual resolution} |

## Cross-Job Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| {job-B needs file from job-A} | VALID/INVALID | {ordering check} |

## Edits Made

| File | Change | Reason |
|------|--------|--------|
| {jobId}-PLAN.md | {brief description} | {auto-fix reason} |

## Summary

{Verdict justification - 2-3 sentences}
```

### Anti-Patterns to Avoid
- **Duplicating contract validation:** The existing `validateJobPlans()` handles export coverage and cross-set imports. The plan verifier handles a different domain (wave-level coverage, implementability, intra-wave consistency). Do not conflate them.
- **Inline verification logic in SKILL.md:** The verifier must be a dedicated agent, not Bash commands in the skill. LLM semantic analysis for coverage cannot be done with string matching.
- **Transitioning state too early:** The wave must NOT transition to `planning` before verification passes. The current Step 2 transition must be deferred to after Step 5.5.
- **Re-planning entire wave on FAIL:** Only the failing jobs should be re-planned. Passing jobs should be preserved.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JOB-PLAN.md file parsing | Custom Markdown table parser | `parseJobPlanFiles()` from `execute.cjs` | Already handles header detection, separator rows, cell extraction |
| File existence checking | Custom file walker | Agent's Glob tool (`Glob('src/lib/some-file.cjs')`) | Built-in tool, battle-tested |
| Agent registration | Manual .md file editing | `ROLE_TOOLS/ROLE_COLORS/ROLE_DESCRIPTIONS/ROLE_CORE_MAP` + `build-agents` | Standard 27.1 pattern, generates consistent agent files |
| User decision gates | Custom prompt logic | `AskUserQuestion` tool with options | Standard skill pattern used throughout RAPID |
| Structured returns | Custom verdict format | `<!-- RAPID:RETURN {...} -->` protocol | All agents use this, skill parses it |

**Key insight:** The verifier agent leverages LLM reasoning for semantic coverage analysis and uses standard tools (Glob, Read, Write) for filesystem checks. No custom library code is needed -- the agent role module defines what to check, and the skill orchestrates spawning and handling results.

## Common Pitfalls

### Pitfall 1: State Transition Timing
**What goes wrong:** If the wave transitions to `planning` before verification, a FAIL verdict cannot block execution -- the wave is already in `planning` state and `/rapid:execute` will accept it.
**Why it happens:** The current SKILL.md transitions to `planning` in Step 2, at the very beginning.
**How to avoid:** Move the `state transition wave ... planning` call to AFTER the verification step succeeds. On FAIL, leave the wave in `discussing` state.
**Warning signs:** If a user can run `/rapid:execute` on a wave that failed verification.

### Pitfall 2: Re-plan Scope Creep
**What goes wrong:** Re-planning all jobs when only some failed wastes time and discards good plans.
**Why it happens:** Simpler to re-run the entire pipeline than track which jobs failed.
**How to avoid:** The verifier's structured return must include a `failingJobs` array. The SKILL.md re-plan flow spawns job planners only for those specific job IDs.
**Warning signs:** Re-plan taking as long as initial planning.

### Pitfall 3: Conflict Detection False Positives
**What goes wrong:** Two jobs referencing the same file as "Modify" is flagged as a conflict, but it might be intentional (e.g., both adding different functions to the same file).
**Why it happens:** Naive path-string comparison without understanding the nature of the modification.
**How to avoid:** The verifier agent uses LLM reasoning to evaluate whether the overlap is a true conflict (same function, same section) or benign (different sections of the same file). True conflicts get FAIL; benign overlaps get PASS_WITH_GAPS with a note.
**Warning signs:** Every wave with shared utility files failing verification.

### Pitfall 4: Verifier Context Budget Explosion
**What goes wrong:** Passing all JOB-PLAN.md files plus WAVE-PLAN.md plus WAVE-CONTEXT.md plus source files exceeds the agent's context window.
**Why it happens:** Large waves with many jobs and many files.
**How to avoid:** The verifier receives JOB-PLAN.md files (which are relatively compact) and the wave-level documents. It does NOT receive full source file contents -- it uses Glob/Read selectively to check specific files. Keep the prompt lean.
**Warning signs:** Agent truncation or hallucinated file existence.

### Pitfall 5: parseJobPlanFiles() Not Exported
**What goes wrong:** Trying to import `parseJobPlanFiles` from `execute.cjs` in a new module, but it might not be in the `module.exports`.
**Why it happens:** The function exists but may not be exported.
**How to avoid:** It IS exported -- `execute.cjs` line 957+ exports `reconcileJob` and `reconcileWaveJobs` which use it, and `parseJobPlanFiles` itself is NOT in the exports. However, the verifier agent does not need to call it programmatically -- it reads the JOB-PLAN.md content directly with the Read tool and parses it with LLM reasoning. The agent handles parsing natively.
**Warning signs:** None -- this is a non-issue since the verifier is an LLM agent, not a code function.

## Code Examples

### Pattern 1: Agent Role Module Structure
Source: Existing `src/modules/roles/role-verifier.md` (post-execution verifier)

```markdown
# Role: Plan Verifier

You verify job plans before execution begins. You check three dimensions:
coverage, implementability, and consistency.

## Verification Process

### 1. Coverage Check
Read all JOB-PLAN.md files and compare against:
- WAVE-PLAN.md job summaries (are all jobs addressed?)
- WAVE-CONTEXT.md decisions (are all decisions reflected in plans?)

### 2. Implementability Check
For each file in every JOB-PLAN.md "Files to Create/Modify" table:
- If Action is "Modify": Use Glob to confirm the file exists on disk
- If Action is "Create": Use Glob to confirm the file does NOT exist

### 3. Consistency Check
Parse all JOB-PLAN.md "Files to Create/Modify" tables.
Build a map: file path -> [claiming job IDs].
Any file claimed by 2+ jobs is a conflict.

## Auto-Fix Rules
- File conflict with clear ownership: Edit the losing job's PLAN.md to remove the file
- Missing coverage for minor section: Add a note, classify as PASS_WITH_GAPS

## Verdict Output
Write VERIFICATION-REPORT.md with structured sections.
Return verdict in structured return:
<!-- RAPID:RETURN {"status":"COMPLETE","verdict":"PASS|PASS_WITH_GAPS|FAIL","failingJobs":[],...} -->
```

### Pattern 2: Spawning and Handling Verifier in SKILL.md
Source: wave-plan SKILL.md existing Step 5 pattern (job planner fan-out)

```markdown
## Step 5.5: Spawn Plan Verifier Agent

Display progress: "Verifying job plans for {waveId}..."

Read all JOB-PLAN.md files from `.planning/waves/{setId}/{waveId}/`:
```bash
# List all job plan files
ls .planning/waves/${SET_ID}/${WAVE_ID}/*-PLAN.md
```

Read each JOB-PLAN.md, WAVE-PLAN.md, and WAVE-CONTEXT.md.

Spawn the **rapid-plan-verifier** agent with this task:
{task prompt with all context}

After agent completes:
- Read the structured return to extract verdict
- Read `.planning/waves/{setId}/{waveId}/VERIFICATION-REPORT.md`

**If verdict is PASS:** Display "All plans verified." Continue to Step 6.
**If verdict is PASS_WITH_GAPS:** Display gaps from report. Continue to Step 6.
**If verdict is FAIL:** Use AskUserQuestion:
  "Plan verification FAILED for wave {waveId}:
  {summary of failures from report}

  What would you like to do?"
  Options:
  - "Re-plan failing jobs" -- re-spawn job planners for {failingJobs}, then re-verify
  - "Override" -- proceed despite failures (you take responsibility)
  - "Cancel" -- stop and investigate
```

### Pattern 3: Structured Return with Verdict
Source: Existing RAPID:RETURN protocol

```markdown
<!-- RAPID:RETURN {
  "status": "COMPLETE",
  "artifacts": ["VERIFICATION-REPORT.md"],
  "verdict": "FAIL",
  "failingJobs": ["job-2", "job-3"],
  "tasks_completed": 3,
  "tasks_total": 3,
  "notes": ["Coverage: PASS", "Implementability: FAIL (job-2)", "Consistency: FAIL (job-3)"]
} -->
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No pre-execution verification | Contract validation only (Step 6) | Phase 20 (wave planning) | Catches export/import issues but not coverage, implementability, or consistency |
| Post-execution verification only | Pre-execution plan verification | Phase 30 (this phase) | Catches structural issues before wasting execution time |

**Existing and unchanged:**
- `validateJobPlans()` in `wave-planning.cjs`: Contract-level validation continues to run in Step 6. The plan verifier in Step 5.5 is additive, not a replacement.
- `rapid-verifier` agent: Post-execution verifier remains unchanged. The new `rapid-plan-verifier` is a separate agent with a different role.

## Integration Points

### State Machine Integration
- Wave transition `discussing -> planning` is valid per `WAVE_TRANSITIONS` in `state-transitions.cjs`
- No new transitions needed -- the change is about WHEN the existing transition occurs
- On FAIL: state remains `discussing`; user can re-run `/rapid:wave-plan` or investigate
- On PASS/PASS_WITH_GAPS: transition to `planning` occurs normally, just later in the pipeline

### Skill Integration (wave-plan SKILL.md)
The wave-plan SKILL.md currently has 7 steps. After this phase:
1. Step 2 loses its `state transition wave ... planning` call (deferred)
2. New Step 5.5 added after job planners, before contract validation
3. Step 6.5 added: `state transition wave ... planning` (moved from Step 2)
4. Step 7 commits VERIFICATION-REPORT.md alongside other artifacts

### Agent Build Integration
After adding the role module and updating ROLE_* maps:
- `node "${RAPID_TOOLS}" build-agents` generates `agents/rapid-plan-verifier.md`
- Must also add to `.gitignore` exception if agents/ has selective tracking (it does not -- agents/ was removed from .gitignore in Phase 27.1)

## Open Questions

1. **PASS_WITH_GAPS vs FAIL boundary for file conflicts**
   - What we know: True conflicts (same function/section) are FAIL; benign overlaps (different sections) are PASS_WITH_GAPS
   - What's unclear: The exact prompt wording that makes LLM reasoning reliable for this distinction
   - Recommendation: Start conservative (any file overlap is FAIL), iterate based on real-world testing. The agent prompt can include examples of benign vs true conflicts.

2. **Re-plan loop termination**
   - What we know: Re-plan re-spawns only failing job planners, then re-runs verifier
   - What's unclear: What if re-planned jobs still fail? Infinite loop?
   - Recommendation: Allow at most 1 re-plan attempt. If verification fails again, present FAIL gate with override/cancel only (no re-plan option).

3. **Cross-job dependency ordering validation**
   - What we know: If Job B references a file that Job A creates, A must come first
   - What's unclear: Jobs within a wave are often executed in parallel, so "ordering" is about wave-level planning, not execution order
   - Recommendation: If Job A creates a file and Job B modifies it, flag as PASS_WITH_GAPS with a note that Job A must complete before Job B. The execute phase already handles sequential dependencies within a wave.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in) |
| Config file | none -- uses `node --test` CLI |
| Quick run command | `node --test src/lib/wave-planning.test.cjs` |
| Full suite command | `node --test src/lib/*.test.cjs src/bin/*.test.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAN-01 | Coverage check via semantic analysis | manual-only | N/A -- LLM agent behavior, tested via integration | N/A |
| PLAN-02 | Implementability: file existence checks | unit | `node --test src/lib/wave-planning.test.cjs` | Wave 0 (new tests in existing file) |
| PLAN-03 | Consistency: file ownership conflict detection | unit | `node --test src/lib/wave-planning.test.cjs` | Wave 0 (new tests in existing file) |
| PLAN-04 | VERIFICATION-REPORT.md output format | unit | `node --test src/lib/wave-planning.test.cjs` | Wave 0 (new tests) |
| PLAN-05 | FAIL gate with re-plan/override/cancel | manual-only | N/A -- skill-level AskUserQuestion flow | N/A |

### Sampling Rate
- **Per task commit:** `node --test src/lib/wave-planning.test.cjs`
- **Per wave merge:** `node --test src/lib/*.test.cjs src/bin/*.test.cjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/modules/roles/role-plan-verifier.md` -- new role module
- [ ] Agent registration in `rapid-tools.cjs` ROLE_* maps -- `plan-verifier` entry
- [ ] Tests for `detectFileConflicts()` and `checkFileImplementability()` helper functions if extracted to `wave-planning.cjs`
- [ ] Integration test: build-agents includes `rapid-plan-verifier.md` in output

## Sources

### Primary (HIGH confidence)
- `src/lib/wave-planning.cjs` -- `validateJobPlans()`, `createWaveDir()`, module structure
- `src/lib/execute.cjs` -- `parseJobPlanFiles()` parser pattern, `reconcileJob()`/`reconcileWaveJobs()` verification patterns
- `skills/wave-plan/SKILL.md` -- full pipeline flow, step ordering, agent spawning pattern
- `agents/rapid-verifier.md` -- existing verifier agent structure, VERIFICATION.md report format
- `agents/rapid-wave-planner.md` -- wave planner output (WAVE-PLAN.md) structure
- `agents/rapid-job-planner.md` -- job planner output (JOB-PLAN.md) structure, "Files to Create/Modify" table
- `src/bin/rapid-tools.cjs` (lines 459-656) -- agent registration pattern (ROLE_TOOLS, ROLE_COLORS, ROLE_DESCRIPTIONS, ROLE_CORE_MAP, `buildAllAgents()`)
- `src/lib/state-transitions.cjs` -- wave state machine (`discussing -> planning` valid transition)
- `src/lib/wave-planning.test.cjs` -- test patterns using node:test, temp directories, state helpers

### Secondary (MEDIUM confidence)
- `.planning/phases/30-plan-verifier/30-CONTEXT.md` -- user decisions and code context insights

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components are existing RAPID patterns, no new libraries
- Architecture: HIGH -- integration points verified by reading actual source code
- Pitfalls: HIGH -- identified from actual code analysis (state transition timing, parseJobPlanFiles export status)

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- internal project patterns, no external dependencies)
