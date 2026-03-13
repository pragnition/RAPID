# Phase 44: Execution & Auxiliary Skills - Research

**Researched:** 2026-03-13
**Domain:** RAPID skill orchestration (execute-set rewrite, /quick, /add-set, /new-version)
**Confidence:** HIGH

## Summary

Phase 44 requires a full rewrite of the `/execute-set` skill to eliminate v2's job-level state model (JOB-PLAN.md, wave/job state transitions, agent teams, per-job reconciliation) and replace it with v3's radically simpler model: one executor per wave, sequential waves, artifact-based re-entry via marker files and git commit inspection. Additionally, three auxiliary commands need implementation: `/quick` (ad-hoc fire-and-forget), `/add-set` (mid-milestone set creation), and `/new-version` (milestone rotation).

The research validates that artifact-based re-entry without wave/job state is feasible. The v3 state machine has only set-level states (`pending -> discussing -> planning -> executing -> complete -> merged`). Since PLAN.md files live at `.planning/sets/{setId}/wave-{N}-PLAN.md` and executor commits land in the worktree branch, re-entry detection combines two signals: (1) WAVE-COMPLETE.md marker files written after each wave, and (2) git log inspection to verify commits exist. This dual mechanism provides both fast re-entry (marker check) and defense-in-depth (commit verification).

The existing codebase has substantial v2 infrastructure in execute.cjs that must be preserved selectively (handoff generation, progress banners, some reconciliation) while removing v2-specific functions (reconcileWaveJobs with JOB-PLAN.md parsing, job-level state tracking). The display.cjs needs `add-set` and `quick` stage entries. The state-machine.cjs `addMilestone()` already handles carry-forward sets for `/new-version`.

**Primary recommendation:** Decompose into 4 waves: (1) execute-set SKILL.md rewrite with artifact-based re-entry, (2) /quick skill creation, (3) /add-set skill creation, (4) /new-version skill rewrite. Display and CLI infrastructure changes can be bundled into wave 1.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Execute-set dispatch model:**
- One rapid-executor spawned per wave, waves executed sequentially
- No parallel per-job execution within waves (v2's JOB-PLAN.md model removed)
- Subagents only -- no Agent Teams mode detection or prompt (sequential waves don't benefit from it)
- RAPID:RETURN protocol remains for structured executor returns

**Execute-set re-entry detection:**
- Dual mechanism: git commit inspection + marker files (WAVE-COMPLETE.md)
- After each wave completes, write a marker file AND verify corresponding commits exist in worktree branch
- On re-entry, check marker files first (fast), then verify against commits (defense-in-depth)
- Re-execute waves that have no marker or whose commits don't match

**Execute-set verification:**
- Lean verifier agent runs after all waves complete
- Verifier reads success criteria from ROADMAP.md set description and checks they're met
- If gaps found: verifier produces GAPS.md listing unmet criteria
- Gap resolution loop: user runs `/plan-set <set> --gaps` then `/execute-set <set> --gaps` to close gaps
- Verification is non-blocking -- produces GAPS.md report, user decides next action

**Execute-set reconciliation:**
- Simplified from v2: basic checks only (did executor commit? are there uncommitted changes?)
- Remove job-level file ownership reconciliation (no jobs in v3)
- Remove commit format validation, lean review step, and per-wave reconciliation reports

**/quick design:**
- In-place execution on current branch (no worktree created)
- Light state entry in STATE.json for history/auditability (not full set lifecycle)
- Pipeline: planner agent -> plan-verifier agent -> executor agent (mini lifecycle, fully autonomous)
- Lean verifier runs after execution (same GAPS.md pattern as execute-set)
- User provides task via interactive prompt (not inline argument)
- No discuss phase -- user's task description IS the context

**/add-set workflow:**
- Interactive discovery: ask user what the set should accomplish (mini discuss-set with a few questions)
- Produces set description for ROADMAP.md and adds to STATE.json as pending set
- Generates CONTRACT.json for the new set (boundary clarity with existing sets)
- Does NOT auto-start -- user runs /start-set separately after add-set
- Suggests /start-set as next action

**/new-version changes:**
- Keep full 5-researcher pipeline + synthesizer + roadmapper (same depth as /init)
- Roadmapper outputs sets only (no waves) -- consistent with v3 /init flow
- Wave decomposition happens later in /plan-set
- User gets the option to archive old milestone's planning artifacts (not forced)
- Archive destination: .planning/archive/{milestone}/ if user chooses to archive
- STATE.json updated: new milestone entry, carry-forward sets if selected

### Claude's Discretion
- Exact marker file format and content for WAVE-COMPLETE.md
- How /quick structures the planner prompt (task description -> plan format)
- /add-set question depth (how many discovery questions before creating set)
- How the gap resolution loop interacts with plan-set internals (--gaps flag behavior)
- Error handling and recovery for each command
- Progress breadcrumb format for execute-set (continuing Phase 43's UX-01 pattern)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CMD-05 | /execute-set as standalone command | Execute-set SKILL.md rewrite with artifact-based re-entry, sequential waves, one executor per wave |
| CMD-09 | /quick for ad-hoc changes without set structure | New quick SKILL.md with planner -> plan-verifier -> executor pipeline, in-place execution |
| CMD-10 | /add-set adds sets to an existing project mid-milestone | New add-set SKILL.md with mini discovery, CONTRACT.json generation, STATE.json mutation |
| CMD-11 | /new-version completes current milestone and starts new version | Rewrite new-version SKILL.md to use 6-researcher pipeline, sets-only roadmap, archive option |
| EXEC-01 | /execute-set runs parallel wave execution using per-wave PLAN.md files | Per-wave PLAN.md files at `.planning/sets/{setId}/wave-{N}-PLAN.md`, one executor per wave |
| EXEC-02 | Lean verification agent runs after all waves complete | rapid-verifier spawned post-execution, reads ROADMAP.md success criteria, produces GAPS.md |
| EXEC-03 | Executor determines completion by reading planning artifacts for re-entry | WAVE-COMPLETE.md marker + git commit inspection dual mechanism |
</phase_requirements>

## Standard Stack

### Core (Existing - No New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | existing | Schema validation (STATE.json, returns) | Already used throughout for state validation |
| node:fs | built-in | File I/O for marker files, plans | Standard Node.js API |
| node:path | built-in | Path manipulation | Standard Node.js API |
| node:child_process | built-in | Git commands (execFileSync) | Standard Node.js API |

### Supporting (Existing Reusable Modules)

| Module | Path | Purpose | When to Use |
|--------|------|---------|-------------|
| state-machine.cjs | src/lib/ | Set state transitions, addMilestone | execute-set, add-set, new-version |
| state-transitions.cjs | src/lib/ | Transition validation | execute-set (planning -> executing -> complete) |
| state-schemas.cjs | src/lib/ | Zod schemas for STATE.json | All commands touching state |
| returns.cjs | src/lib/ | RAPID:RETURN parsing | execute-set, quick (parsing executor returns) |
| execute.cjs | src/lib/ | Handoff generation, progress banners | execute-set (selective reuse) |
| display.cjs | src/lib/ | Stage banners | All commands (needs add-set, quick entries) |
| resolve.cjs | src/lib/ | Set/wave numeric ID resolution | execute-set, add-set |
| worktree.cjs | src/lib/ | Worktree management | execute-set (worktree path resolution) |

### No New Libraries Needed

This phase is entirely SKILL.md authoring plus minor display.cjs and state-machine.cjs updates. No npm packages to install.

## Architecture Patterns

### Recommended File Changes

```
skills/
  execute-set/SKILL.md        # REWRITE -- 516 lines v2 -> ~300 lines v3
  quick/SKILL.md               # NEW -- ~180 lines (create skill directory + file)
  add-set/SKILL.md             # NEW -- ~150 lines (create skill directory + file)
  new-version/SKILL.md         # REWRITE -- 236 lines v2 -> ~280 lines v3

src/lib/
  display.cjs                  # MODIFY -- add 'add-set' and 'quick' stage entries
```

### Pattern 1: v3 Skill Structure (from Phase 43)

Every SKILL.md follows this established pattern:

```yaml
---
description: One-line description
allowed-tools: Bash(rapid-tools:*), Agent, AskUserQuestion, Read, Write, Glob, Grep
---
```

```markdown
# /rapid:{command} -- Title

Step 0: Environment preamble (RAPID_TOOLS + .env loading)
Step 1: Display banner via `node "${RAPID_TOOLS}" display banner {stage}`
Step 2: Resolve set (if applicable) via `node "${RAPID_TOOLS}" resolve set`
Step 3: Load state via `node "${RAPID_TOOLS}" state get --all`
Step N: Core logic (agent spawning, state transitions)
Step N+1: Commit artifacts
Step N+2: Next step suggestion
Step N+3: Progress breadcrumb
```

**Confidence:** HIGH -- this pattern is proven across init, start-set, discuss-set, and plan-set.

### Pattern 2: Artifact-Based Re-Entry (v3 Execute-Set)

**What:** Instead of reading wave/job state from STATE.json, detect completion by inspecting disk artifacts and git history.

**Mechanism:**

```
On entry:
  1. Read PLAN.md files from .planning/sets/{setId}/wave-{N}-PLAN.md
  2. For each wave N:
     a. Check if .planning/sets/{setId}/WAVE-{N}-COMPLETE.md exists (fast path)
     b. If marker exists, verify commits on worktree branch (defense-in-depth)
     c. If both pass: wave is complete, skip
     d. If marker missing or commits don't match: re-execute wave

After each wave completes:
  1. Write .planning/sets/{setId}/WAVE-{N}-COMPLETE.md with completion metadata
  2. Basic reconciliation (commit check, uncommitted changes check)
  3. Continue to next wave
```

**WAVE-COMPLETE.md format (Claude's Discretion):**

```markdown
# Wave {N} Complete

**Set:** {setId}
**Wave:** {N}
**Completed:** {ISO timestamp}
**Executor commits:** {comma-separated commit hashes from git log}
**Verification:** basic-pass
```

This format gives both human readability and machine parseability. The commit hashes enable re-entry verification: on re-entry, compare listed commits against `git log` on the worktree branch.

**Confidence:** HIGH -- this is a straightforward file-existence + git-log approach. No complex state machine needed.

### Pattern 3: Sequential Wave Execution (v3 Execute-Set)

**What:** Execute waves one at a time, one executor per wave.

```
For wave in 1..N:
  if wave already complete (re-entry check): skip

  Spawn rapid-executor with:
    - Full wave-{N}-PLAN.md content
    - Working directory (worktree path)
    - Commit conventions

  Parse RAPID:RETURN from executor output

  If COMPLETE:
    Write WAVE-{N}-COMPLETE.md
    Basic reconciliation check
    Continue to next wave
  If CHECKPOINT:
    Write handoff file, pause, show resume instructions
    STOP (user re-runs execute-set to continue)
  If BLOCKED:
    Show blocker, suggest resolution
    STOP
```

**No wave-level or job-level state transitions.** The only state transition is `set: planning -> executing` (at start) and `set: executing -> complete` (after all waves + verification).

**Confidence:** HIGH -- eliminates all v2 complexity. The executor agent (rapid-executor.md) is already hand-written for exactly this model.

### Pattern 4: Lean Post-Execution Verification

**What:** After all waves complete, spawn rapid-verifier to check success criteria.

```
After all waves complete:
  1. Read success criteria from ROADMAP.md set description
  2. Spawn rapid-verifier with:
     - Success criteria
     - Working directory (worktree)
     - List of PLAN.md files + their objectives
  3. Parse RAPID:RETURN
  4. If all criteria met: transition set to 'complete'
  5. If gaps found:
     a. Write GAPS.md to .planning/sets/{setId}/
     b. Display gaps to user
     c. Suggest: /plan-set {setIndex} --gaps then /execute-set {setIndex} --gaps
     d. Still transition set to 'complete' (verification is non-blocking)
```

**Confidence:** MEDIUM -- the gap resolution loop (`--gaps` flag on plan-set and execute-set) needs careful thought. The GAPS.md -> re-plan -> re-execute cycle must not clobber existing wave PLAN.md files. Recommended approach: `--gaps` creates an additional wave (e.g., wave-{N+1}-PLAN.md) rather than modifying existing waves.

### Pattern 5: /quick Mini-Lifecycle

**What:** Three-agent fire-and-forget pipeline for ad-hoc changes.

```
1. Display banner
2. AskUserQuestion (freeform): "What would you like to do?"
3. Create quick task directory: .planning/quick/{N+1}-{slug}/
4. Light state entry: add to STATE.json as quick task (not full set lifecycle)
5. Spawn rapid-planner with task description -> writes {N+1}-PLAN.md
6. Spawn rapid-plan-verifier -> writes VERIFICATION-REPORT.md
7. Spawn rapid-executor -> implements plan in current directory
8. Parse RAPID:RETURN from executor
9. Basic verification (commit check)
10. Write {N+1}-SUMMARY.md
11. Done
```

**Key difference from set lifecycle:** No worktree, no discuss phase, no CONTRACT.json, no wave decomposition. Single plan, single execution pass, in-place on current branch.

**Confidence:** HIGH -- follows existing quick task pattern from `.planning/quick/` directory.

### Anti-Patterns to Avoid

- **Do NOT reference wave/job state transitions:** v3 has only `state transition set`. Never use `state transition wave` or `state transition job`.
- **Do NOT detect agent teams mode:** v3 execute-set uses subagents only (locked decision).
- **Do NOT use JOB-PLAN.md:** v3 uses per-wave PLAN.md at `.planning/sets/{setId}/wave-{N}-PLAN.md`.
- **Do NOT implement per-job reconciliation:** No job-level file ownership, commit format validation, or per-wave reconciliation reports.
- **Do NOT prompt between waves (on success):** Auto-advance after each wave. Only CHECKPOINT or BLOCKED stop execution.
- **Do NOT create worktrees in /quick:** Quick tasks execute in-place on current branch.
- **Do NOT auto-start sets in /add-set:** The user runs /start-set separately.
- **Do NOT produce waves in /new-version roadmapper:** Sets only (consistent with v3 /init).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State transitions | Manual STATE.json editing | `node "${RAPID_TOOLS}" state transition set` | Atomic writes, lock management, validation |
| Set resolution | Manual ID matching | `node "${RAPID_TOOLS}" resolve set` | Handles numeric + string IDs |
| RAPID:RETURN parsing | Custom regex | `returns.cjs parseReturn()` | Handles edge cases, validates with Zod |
| Milestone creation | Manual STATE.json mutation | `state-machine.cjs addMilestone()` | Already handles carry-forward, validation |
| Banner display | Custom ANSI | `node "${RAPID_TOOLS}" display banner` | Consistent branding, color grouping |
| Progress banners | Custom formatting | `execute.cjs formatProgressBanner()` | Existing, tested format |
| Handoff generation | Custom markdown | `execute.cjs generateHandoff()` | Existing, tested format |
| Commit state | Manual git add/commit | `state-machine.cjs commitState()` | Handles clean tree edge case |

**Key insight:** Almost all infrastructure exists. This phase is 90% SKILL.md authoring (prompt engineering for Claude Code skill dispatch) and 10% minor library updates (display.cjs stage entries).

## Common Pitfalls

### Pitfall 1: Referencing Removed v2 Commands in SKILL.md

**What goes wrong:** New SKILL.md files accidentally reference `state transition wave`, `state transition job`, `execute job-status`, `execute reconcile-jobs`, `wave-plan list-jobs`, or `execute detect-mode`.
**Why it happens:** Copying from the existing v2 execute-set SKILL.md without fully removing v2 concepts.
**How to avoid:** Write v3 execute-set from scratch (don't modify the existing 516-line v2 file). Reference only: `state get --all`, `state transition set`, `resolve set`, `display banner`.
**Warning signs:** Any mention of `JOB-PLAN.md`, `wave-plan`, `job-status`, `reconcile-jobs`, `agent-teams`, or `detect-mode` in the new SKILL.md.

### Pitfall 2: WAVE-COMPLETE.md Written Before Commit Verification

**What goes wrong:** Marker file written immediately when executor returns COMPLETE, but before checking that the executor actually committed. If executor failed silently (no RAPID:RETURN, or returned COMPLETE without commits), the marker creates a false positive.
**Why it happens:** Natural flow is "executor done -> write marker -> move on".
**How to avoid:** After executor returns COMPLETE, verify at least one commit exists on the worktree branch since the start of execution. Only then write the marker.
**Warning signs:** WAVE-COMPLETE.md with `Executor commits: (none)`.

### Pitfall 3: /quick Creating Full Set Lifecycle State

**What goes wrong:** /quick adds a full set to STATE.json with discussing/planning/executing lifecycle, creating noise in `/status` dashboard.
**Why it happens:** Reusing `state transition set` mechanics for a non-set operation.
**How to avoid:** Quick tasks should use a separate tracking mechanism. Store quick task history in STATE.md (the human-readable state doc) or a separate `.planning/quick/HISTORY.json` file, not in STATE.json's milestones.sets array.
**Warning signs:** Running `/status` shows a bunch of "quick task" entries mixed with real sets.

### Pitfall 4: /new-version Using 5 Researchers Instead of 6

**What goes wrong:** Phase 41 added the 6th researcher (rapid-research-ux) to the init pipeline, but new-version references the old 5-researcher count.
**Why it happens:** The CONTEXT.md says "full 5-researcher pipeline" based on pre-Phase-41 knowledge. The actual /init skill spawns 6 researchers.
**How to avoid:** /new-version should spawn 6 researchers (stack, features, architecture, pitfalls, oversights, ux) + synthesizer -- matching the current /init implementation exactly.
**Warning signs:** Missing UX.md in research output.

### Pitfall 5: Gap Resolution Loop Clobbering Existing Plans

**What goes wrong:** Running `/plan-set --gaps` overwrites existing wave-{N}-PLAN.md files, destroying completed work tracking.
**Why it happens:** Re-planning reuses the same wave numbering.
**How to avoid:** Gap plans should be additive: create wave-{N+1}-PLAN.md (one beyond the last existing wave). The `--gaps` flag on execute-set should only execute the gap wave(s), not re-execute all waves.
**Warning signs:** WAVE-COMPLETE.md markers disappearing after gap resolution.

### Pitfall 6: display.cjs Missing Stage Entries

**What goes wrong:** `/rapid:quick` and `/rapid:add-set` fail to render banners because `STAGE_VERBS` and `STAGE_BG` don't have entries for 'quick' and 'add-set'.
**Why it happens:** display.cjs was updated in Phase 40 but only for known v3 commands at the time.
**How to avoid:** Add 'add-set' and 'quick' entries to both `STAGE_VERBS` and `STAGE_BG` maps in display.cjs.
**Warning signs:** `[RAPID] Unknown stage: quick` in output.

## Code Examples

### Execute-Set SKILL.md Core Loop (v3 Simplified)

```markdown
## Step 3: Execute Waves Sequentially

For each wave N (from 1 to total_waves):

### 3a: Check re-entry status

Check if `.planning/sets/${SET_ID}/WAVE-${N}-COMPLETE.md` exists:
- If marker exists AND git commits match: Print "Wave {N}: already complete, skipping." Continue to next wave.
- If marker missing or commits don't match: Execute this wave.

### 3b: Spawn executor

Display: "Executing wave {N} of {total_waves}..."

Spawn the **rapid-executor** agent with this task:

    Implement wave {N} for set '{SET_ID}'.

    ## Your PLAN
    {Full content of wave-{N}-PLAN.md}

    ## Commit Convention
    After each task, commit with: type({SET_ID}): description
    Where type is feat|fix|refactor|test|docs|chore

    ## Working Directory
    {worktreePath}

### 3c: Process return

Parse RAPID:RETURN from executor output.

**If COMPLETE:**
1. Verify commits exist: `git -C {worktreePath} log --oneline main..HEAD`
2. Check for uncommitted changes: `git -C {worktreePath} status --porcelain`
3. If both pass: Write WAVE-{N}-COMPLETE.md marker
4. Continue to next wave

**If CHECKPOINT:**
1. Write handoff file
2. Display resume instructions
3. STOP

**If BLOCKED:**
1. Display blocker details
2. STOP
```

### WAVE-COMPLETE.md Marker File

```markdown
# Wave {N} Complete

**Set:** {setId}
**Wave:** {N}
**Completed:** 2026-03-13T12:34:56.789Z
**Executor commits:** abc1234, def5678, ghi9012
**Branch:** rapid/{setId}
**Reconciliation:** basic-pass
```

### /quick Skill Structure

```markdown
## Step 1: Gather Task Description

Use AskUserQuestion (freeform):
> "Describe what you'd like to do. Be specific about the changes needed."

Record task description.

## Step 2: Create Quick Task Directory

```bash
# Count existing quick tasks
NEXT_ID=$(($(ls .planning/quick/ | wc -l) + 1))
SLUG=$(echo "{task description}" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | cut -c1-40)
TASK_DIR=".planning/quick/${NEXT_ID}-${SLUG}"
mkdir -p "$TASK_DIR"
```

## Step 3: Spawn Planner

Spawn rapid-planner with task description. Output: {TASK_DIR}/{NEXT_ID}-PLAN.md

## Step 4: Spawn Plan Verifier

Spawn rapid-plan-verifier. Output: {TASK_DIR}/VERIFICATION-REPORT.md

## Step 5: Spawn Executor

Spawn rapid-executor with plan. No worktree -- execute in current directory.

## Step 6: Summary

Write {TASK_DIR}/{NEXT_ID}-SUMMARY.md with execution results.
```

### /add-set State Mutation

```bash
# After discovery questions, add set to STATE.json
node "${RAPID_TOOLS}" state get --all
# Parse to get current milestone ID

# Create set directory and CONTRACT.json
mkdir -p .planning/sets/${NEW_SET_ID}
# Write CONTRACT.json via Write tool

# Add set to STATE.json (must use withStateTransaction in state-machine.cjs)
# This requires a new CLI command or manual Write tool usage
```

**Note:** Currently `state-machine.cjs` does not have an `addSet()` function. The /init skill writes STATE.json directly via the Write tool with roadmapper output. /add-set should follow the same pattern: read STATE.json, add the new set object to the current milestone's sets array, write back via the Write tool. Alternatively, a new `state add-set` CLI command could be added, but using the Write tool directly is simpler and consistent with how /init works.

### display.cjs Additions

```javascript
// Add to STAGE_VERBS
'add-set': 'ADDING SET',
'quick': 'QUICK TASK',

// Add to STAGE_BG
'add-set': '\x1b[104m',   // bright blue (planning stage)
'quick': '\x1b[102m',     // bright green (execution stage)
```

## State of the Art

| Old Approach (v2) | Current Approach (v3) | When Changed | Impact |
|---|---|---|---|
| JOB-PLAN.md per job per wave | wave-{N}-PLAN.md per wave (no jobs) | Phase 43 | Eliminates job-level dispatch and reconciliation |
| Wave/Job state in STATE.json | Set-level state only | Phase 38 | Removes WaveState, JobState schemas |
| Agent Teams + Subagents dual mode | Subagents only | Phase 44 context | Eliminates agent teams detection and fallback |
| Per-job file ownership reconciliation | Basic commit check per wave | Phase 44 context | Simplifies reconciliation to 2 checks |
| wave-plan list-jobs CLI | Direct file read of wave-{N}-PLAN.md | Phase 43 | No CLI for job listing (no jobs) |
| `state transition wave/job` CLI | `state transition set` only | Phase 38 | No per-wave or per-job state tracking |

**Deprecated/outdated (must not appear in v3 skills):**
- `execute detect-mode` -- agent teams removed
- `execute job-status` -- no job state
- `execute reconcile-jobs` -- no job reconciliation
- `wave-plan list-jobs` -- no jobs
- `state transition wave` / `state transition job` -- no wave/job state
- `review lean <set> <wave>` -- no per-wave lean review in execute-set

## Open Questions

1. **STATE.json mutation for /add-set**
   - What we know: /init writes STATE.json directly via Write tool after roadmapper output. state-machine.cjs has `addMilestone()` but no `addSet()`.
   - What's unclear: Should /add-set use the Write tool directly (consistent with /init) or should a new `state add-set` CLI command be created?
   - Recommendation: Use Write tool directly via `withStateTransaction` pattern. The skill reads STATE.json, pushes the new set to the current milestone's sets array, and writes back. Adding a CLI command is unnecessary complexity for a single use case.

2. **Quick task state tracking**
   - What we know: Quick tasks currently store PLAN.md and SUMMARY.md in `.planning/quick/{N}-{slug}/`. STATE.md lists them in a "Quick Tasks Completed" table.
   - What's unclear: Should /quick add an entry to STATE.json? The locked decision says "light state entry for history/auditability."
   - Recommendation: Append to the STATE.md "Quick Tasks Completed" table (human-readable) and write a SUMMARY.md in the quick task directory. Do NOT add to STATE.json sets array -- quick tasks are not sets. This avoids polluting the `/status` dashboard.

3. **--gaps flag implementation depth**
   - What we know: GAPS.md lists unmet success criteria. User runs `/plan-set --gaps` then `/execute-set --gaps`.
   - What's unclear: How does `--gaps` interact with plan-set internals? Does the planner agent receive GAPS.md as input?
   - Recommendation: `plan-set --gaps` reads GAPS.md and passes its content as additional context to the planner, which produces an additional wave-{N+1}-PLAN.md. `execute-set --gaps` only executes waves that don't have WAVE-COMPLETE.md markers (which naturally includes the new gap wave). This makes --gaps a thin wrapper over the normal pipeline.

4. **Archive mechanics for /new-version**
   - What we know: Archive destination is `.planning/archive/{milestone}/`. User gets the option to archive (not forced).
   - What's unclear: What exactly gets archived? All of `.planning/sets/`, `.planning/research/`, `.planning/waves/`?
   - Recommendation: Archive `.planning/sets/`, `.planning/research/`, and `.planning/quick/` directories. Move them to `.planning/archive/{milestone}/sets/`, etc. Do not archive STATE.json (it accumulates across milestones). Do not archive `.planning/config.json` or `.planning/PROJECT.md` (global).

## Validation Architecture

> nyquist_validation not explicitly set to false in config.json -- including this section.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in) |
| Config file | none -- uses `node --test` directly |
| Quick run command | `node --test src/lib/display.test.cjs` |
| Full suite command | `node --test src/lib/*.test.cjs` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMD-05 | execute-set SKILL.md exists and is valid YAML frontmatter | manual-only | Read and verify YAML frontmatter | n/a (SKILL.md) |
| CMD-09 | quick SKILL.md exists | manual-only | Read and verify YAML frontmatter | n/a (SKILL.md) |
| CMD-10 | add-set SKILL.md exists | manual-only | Read and verify YAML frontmatter | n/a (SKILL.md) |
| CMD-11 | new-version SKILL.md is rewritten | manual-only | Read and verify YAML frontmatter | n/a (SKILL.md) |
| EXEC-01 | display.cjs has add-set and quick stages | unit | `node --test src/lib/display.test.cjs` | Yes |
| EXEC-02 | Verification pattern documented in SKILL.md | manual-only | SKILL.md review | n/a |
| EXEC-03 | Re-entry detection via marker + git | manual-only | SKILL.md review | n/a |

### Sampling Rate
- **Per task commit:** `node --test src/lib/display.test.cjs`
- **Per wave merge:** `node --test src/lib/*.test.cjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/display.test.cjs` -- add tests for 'add-set' and 'quick' stage entries (extends existing test file)

**Note:** This phase is primarily SKILL.md authoring (Claude Code skill files, not executable code). Most requirements are verified by reviewing the SKILL.md content, not by automated tests. The only testable code changes are display.cjs stage entries.

## Sources

### Primary (HIGH confidence)
- **Existing codebase inspection** -- all source files read directly
  - `skills/execute-set/SKILL.md` (v2, 516 lines) -- baseline for rewrite
  - `skills/new-version/SKILL.md` (v2, 236 lines) -- baseline for rewrite
  - `agents/rapid-executor.md` (v3, hand-written) -- executor agent already supports PLAN.md model
  - `agents/rapid-planner.md` (v3, hand-written) -- available for /quick pipeline
  - `agents/rapid-verifier.md` (v3, generated) -- available for post-execution verification
  - `agents/rapid-plan-verifier.md` (v3, generated) -- available for /quick pipeline
  - `src/lib/state-machine.cjs` -- addMilestone(), transitionSet(), commitState()
  - `src/lib/state-transitions.cjs` -- SET_TRANSITIONS map (pending->discussing->planning->executing->complete->merged)
  - `src/lib/state-schemas.cjs` -- SetStatus enum, ProjectState schema
  - `src/lib/execute.cjs` -- handoff generation, progress banners, reconciliation helpers
  - `src/lib/display.cjs` -- STAGE_VERBS, STAGE_BG (needs add-set, quick entries)
  - `src/lib/returns.cjs` -- parseReturn(), validateHandoff()
  - `skills/init/SKILL.md` (v3, 753 lines) -- /new-version should match init pipeline depth
  - `skills/plan-set/SKILL.md` (v3) -- 3-step pipeline reference for /quick
  - `skills/discuss-set/SKILL.md` (v3) -- skill structure pattern reference

### Secondary (MEDIUM confidence)
- `.planning/phases/44-execution-auxiliary-skills/44-CONTEXT.md` -- locked decisions from user discussion
- `.planning/REQUIREMENTS.md` -- requirement definitions
- `.planning/STATE.md` -- project history and decisions

### Tertiary (LOW confidence)
- None -- all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing modules verified
- Architecture: HIGH -- patterns proven in Phases 42-43, v3 model well-understood
- Pitfalls: HIGH -- derived from direct codebase inspection of v2 -> v3 differences
- Re-entry mechanism: HIGH -- simple file-existence + git-log, no complex state
- Gap resolution loop: MEDIUM -- --gaps flag behavior is discretionary, needs careful implementation
- /new-version researcher count: HIGH -- corrected from 5 to 6 based on Phase 41 changes

**Research date:** 2026-03-13
**Valid until:** 2026-03-20 (stable -- project-internal skill authoring)
