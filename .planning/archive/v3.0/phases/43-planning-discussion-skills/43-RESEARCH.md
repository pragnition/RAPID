# Phase 43: Planning & Discussion Skills - Research

**Researched:** 2026-03-13
**Domain:** Claude Code skill rewriting (SKILL.md files), agent orchestration, planning pipeline collapse
**Confidence:** HIGH

## Summary

Phase 43 rewrites four SKILL.md files (init, start-set, discuss-set, plan-set) and their supporting agents for v3.0. The core challenge is collapsing a 15-20 agent-spawn planning pipeline into a 2-4 spawn pipeline while maintaining plan quality. The existing codebase provides strong foundations: the state machine (Phase 38), tool docs registry (Phase 39), CLI surface (Phase 40), build pipeline (Phase 41), and core agents (Phase 42) are all stable.

The research question flagged in the roadmap -- "validate single-agent planning for multi-wave scenarios" -- resolves positively. The rapid-planner agent (hand-written in Phase 42) already contains decomposition logic for splitting sets into waves and producing per-wave PLAN.md files. The key insight from the CONTEXT.md decisions is that the planner agent itself handles wave decomposition AND per-wave planning when there are 1-2 waves, and spawns parallel wave-planners only for 3-4 waves. This eliminates the v2 pattern of separate wave-analyzer, wave-researcher, wave-planner, and job-planner agents.

The v3 architecture is skill-centric: skills are their own orchestrators (Phase 42 removed the orchestrator agent). Each skill dispatches Agent tool calls directly. Claude Code's platform constraint (no sub-sub-agent spawning) means all agent spawning must happen at the skill level.

**Primary recommendation:** Implement the four skills in dependency order (init first, then start-set, then discuss-set, then plan-set) with the v3 simplified state schema. Each skill writes SKILL.md as the sole orchestration document. Agent prompts are already stable from Phase 42.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**discuss-set interaction model:**
- Set-level discussion (not wave-level like v2)
- Structured 4 gray area Q&A: agent identifies 4 gray areas, user selects which to discuss
- Batch all questions per area into a single AskUserQuestion call (2-3 questions per area answered at once)
- After Q&A, agent compiles follow-up questions only if genuine gaps remain -- skip follow-up if the 4 areas covered everything
- Captures vision/what, not implementation/how -- agent does not prompt for every detail

**discuss-set --skip (auto-context):**
- When --skip is provided, agent auto-generates CONTEXT.md without user discussion
- Uses three sources: ROADMAP.md set description + codebase scan + spawns a quick researcher agent
- All decisions become Claude's discretion in the auto-generated context

**plan-set pipeline:**
- Fully autonomous -- user runs /plan-set, no checkpoints or approval gates during planning
- Agent flow: researcher -> planner (decomposes into waves + plans each wave, or spawns wave-planners for 3-4 waves) -> verifier
- Verifier is a separate spawned agent (not internal to planner)
- If verification fails: re-plan failing waves once, re-verify. If still fails after 1 retry, surface issues to user
- Brief confirmation output at the end: set name, wave count, verification status, next command. No full plan preview.

**start-set behavior:**
- Does NOT auto-chain into discuss-set -- just suggests it as next step
- Still spawns a lightweight set-planner agent to generate SET-OVERVIEW.md (provides context for discuss-set)
- Creates worktree + scoped CLAUDE.md + SET-OVERVIEW.md

**command chaining and UX:**
- Each command suggests exactly one next action (UX-02)
- Progress breadcrumb shown at end of each command: `init > start-set > discuss-set > plan-set > execute-set > review > merge`
- Error messages show what is done, what is missing, what to run next (UX-01)

**init flow:**
- Keep deep discovery conversation (8-15+ questions across 10 areas) -- do not streamline
- Batch discovery questions by topic (group related questions together) instead of one-at-a-time
- Roadmapper outputs sets only, no wave structure -- waves are determined during plan-set by the planner
- CONTRACT.json files generated at init time (not deferred) -- sets need boundaries for independent work
- STATE.json simplified: project > milestone > sets (no waves/jobs)
- 6-researcher pipeline unchanged (5 domain + UX)

### Claude's Discretion

- Exact progress breadcrumb format and rendering
- How the researcher agent invoked by --skip differs from the full research pipeline
- Internal planner threshold for self-planning vs spawning wave-planners (the "3-4 waves" heuristic)
- Error message formatting and breadcrumb styling
- How to handle partial failures gracefully during autonomous planning

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CMD-01 | /init handles greenfield and brownfield with 5-researcher pipeline and roadmap creation | Existing init SKILL.md is 706 lines and covers both paths. Needs updates for: batched discovery questions, sets-only roadmap output, CONTRACT.json at init time, no wave/job state. 6-researcher pipeline (5 domain + UX) already wired in Phase 41. |
| CMD-02 | /start-set creates worktree scaffold for a set | Existing start-set SKILL.md is 184 lines. Needs updates for: no auto-chain into discuss-set (just suggest), progress breadcrumb at end. Core worktree creation and set-planner spawn are reusable. |
| CMD-03 | /discuss-set as standalone command with --skip flag | Full rewrite from wave-level to set-level. New 4-area Q&A model with batched questions. --skip spawns quick researcher for auto-context. Output is CONTEXT.md (not WAVE-CONTEXT.md). |
| CMD-04 | /plan-set as standalone command | Radical simplification from v2's 10-step per-wave pipeline. New flow: researcher -> planner -> verifier with 2-4 total spawns. Planner decomposes into waves AND produces per-wave PLAN.md. |
| PLAN-01 | /plan-set produces one PLAN.md per wave in a single pass (2-4 agent spawns, not 15-20) | Validated: rapid-planner agent (Phase 42) already has decomposition + per-wave PLAN.md production in its role. Skill orchestrates: spawn researcher, spawn planner, spawn verifier = 3 spawns for simple sets. 4th spawn only for re-plan on verification failure. |
| PLAN-02 | /discuss-set captures user vision and produces CONTEXT.md for the planner | New set-level CONTEXT.md format replaces per-wave WAVE-CONTEXT.md. Format: decisions, Claude's discretion, deferred ideas, code context. |
| PLAN-03 | /discuss-set --skip auto-generates CONTEXT.md from roadmap + codebase scan | --skip spawns lightweight researcher that reads ROADMAP.md set description + does codebase scan. All decisions marked as Claude's discretion. |
| PLAN-04 | Interface contracts defined between sets without blocking gates | CONTRACT.json already generated at init time (existing contract.cjs). No gating -- sets are independent per v3 design. Contract validation remains as advisory checks. |
| PLAN-05 | Contract enforcement at three points: after planning, during execution, before merge | wave-planning.cjs validateJobPlans() exists. Need to wire it into: (1) plan-set after planner produces PLAN.md, (2) execute-set (Phase 44), (3) merge skill (already has review gate). |
| UX-01 | Error messages show progress breadcrumb (done/missing/next) | New pattern across all 4 skills. Breadcrumb format at Claude's discretion. Breadcrumb rendered after each command completion and on errors. |
| UX-02 | Strong defaults with one suggested next action (minimize AskUserQuestion) | Already partially implemented (Phase 28 decision). Each skill ends with exactly one next-step suggestion. AskUserQuestion used only for genuine user decisions, not confirmations. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rapid-tools.cjs | v3.0 | CLI for all state mutations | Project's own tooling -- all agent/skill state access |
| state-machine.cjs | v3.0 | Set-level state with atomic writes | Stable from Phase 38 -- SetStatus enum with 6 values |
| state-transitions.cjs | v3.0 | SET_TRANSITIONS validation map | pending -> discussing -> planning -> executing -> complete -> merged |
| contract.cjs | v3.0 | CONTRACT.json validation and generation | compileContract, validateJobPlans, createManifest, createOwnershipMap |
| tool-docs.cjs | v3.0 | Per-agent tool docs injection | ROLE_TOOL_MAP maps roles to CLI commands |
| display.cjs | v3.0 | Branded stage banners | STAGE_VERBS and STAGE_BG for all skill stages |
| resolve.cjs | v3.0 | Numeric ID resolution | resolveSet (1-based index) and resolveWave (N.N dot notation) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| wave-planning.cjs | v3.0 | Wave directory management | createWaveDir, writeWaveContext -- still used for planning artifact dirs |
| init.cjs | v3.0 | Scaffold generation | generateProjectMd, generateStateMd, scaffold command |
| plan.cjs | v3.0 | Set listing and creation | listSets, createSet, decompose |
| context.cjs | v3.0 | Brownfield detection | detectContext for codebase analysis |

## Architecture Patterns

### Recommended Skill Structure

```
skills/
  init/SKILL.md              # Full rewrite -- batched discovery, sets-only roadmap, CONTRACT.json at init
  start-set/SKILL.md         # Update -- remove auto-chain, add breadcrumb
  discuss-set/SKILL.md       # Full rewrite -- set-level, 4-area Q&A, --skip flag
  plan-set/SKILL.md          # Radical rewrite -- 3-step pipeline (researcher -> planner -> verifier)
```

### Planning Artifacts (v3 Layout)

```
.planning/
  STATE.json                 # project > milestone > sets (NO waves/jobs)
  ROADMAP.md                 # Sets only, no wave structure
  config.json                # Model selection, team size
  research/                  # Init research outputs (STACK.md, FEATURES.md, etc.)
  sets/
    {set-id}/
      CONTRACT.json          # Generated at init time
      DEFINITION.md          # Set scope and file ownership
      SET-OVERVIEW.md        # Generated by start-set (rapid-set-planner)
      CONTEXT.md             # Generated by discuss-set (NEW -- replaces per-wave WAVE-CONTEXT.md)
      PLAN.md (wave-1)       # Generated by plan-set planner agent
      PLAN.md (wave-2)       # One PLAN.md per wave, all in set directory
      VERIFICATION-REPORT.md # Generated by plan-set verifier agent
```

### Pattern 1: Skill as Orchestrator (v3 Core Pattern)

**What:** Each SKILL.md is the sole orchestrator. No orchestrator agent exists. The skill dispatches Agent tool calls directly to leaf agents.

**When to use:** Every v3 skill follows this pattern.

**Example:**
```markdown
# In SKILL.md
## Step N: Spawn Planner
Spawn the **rapid-planner** agent with this task:
\```
Plan set '{set-id}' from CONTEXT.md.
## Context Files to Read
- .planning/sets/{set-id}/CONTEXT.md
- .planning/sets/{set-id}/CONTRACT.json
## Working Directory
{projectRoot}
## Output
Write PLAN.md files to .planning/sets/{set-id}/
\```
```

### Pattern 2: Progress Breadcrumb (New UX Pattern)

**What:** Every command renders a breadcrumb showing pipeline progress at completion and on errors.

**When to use:** End of every skill, and in error handlers.

**Example format (Claude's discretion on exact rendering):**
```
init [done] > start-set [done] > discuss-set [current] > plan-set > execute-set > review > merge
```

**Implementation:** Each skill reads the set's current status from STATE.json and renders the breadcrumb. The status enum maps directly to command stages:
- `pending` = start-set not done
- `discussing` = discuss-set in progress
- `planning` = plan-set in progress
- `executing` = execute-set in progress
- `complete` = review/merge ready
- `merged` = done

### Pattern 3: Simplified State Transitions

**What:** v3 uses set-level state only. No wave or job transitions.

**When to use:** All state mutations in skills.

**Key transitions for Phase 43 skills:**
```
init:        Creates STATE.json with sets in 'pending' status
start-set:   No state transition (set stays 'pending')
discuss-set: pending -> discussing (or discussing remains if re-discuss)
plan-set:    discussing -> planning
```

**CLI commands:**
```bash
node "${RAPID_TOOLS}" state transition set "${MILESTONE_ID}" "${SET_ID}" discussing
node "${RAPID_TOOLS}" state transition set "${MILESTONE_ID}" "${SET_ID}" planning
```

### Pattern 4: Batched User Interaction (discuss-set)

**What:** Instead of asking one question at a time, batch related questions into a single AskUserQuestion call.

**When to use:** discuss-set Q&A and init discovery.

**Flow:**
1. Agent identifies 4 gray areas from set scope analysis
2. User selects which areas to discuss
3. For each selected area: one AskUserQuestion with 2-3 questions about that area answered at once
4. Follow-up only if genuine gaps remain after all 4 areas

### Pattern 5: Autonomous Planning Pipeline (plan-set)

**What:** plan-set runs fully autonomously -- no user checkpoints.

**When to use:** plan-set only.

**Flow (2-4 spawns):**
```
Spawn 1: rapid-researcher (set-scoped research)
Spawn 2: rapid-planner   (decompose into waves + produce PLAN.md per wave)
Spawn 3: rapid-plan-verifier (verify all PLAN.md files)
Spawn 4: rapid-planner   (re-plan failing waves, ONLY if verification fails -- max 1 retry)
```

**Planner self-planning vs spawning wave-planners:**
- 1-2 waves: planner handles decomposition AND per-wave planning itself (single spawn)
- 3-4 waves: planner can spawn parallel wave-planners (Claude's discretion on threshold)
- Note: Claude Code constraint -- agents spawned by plan-set cannot spawn sub-agents. If planner needs wave-planners, the SKILL orchestrates those spawns based on the planner's structured return.

### Anti-Patterns to Avoid

- **Sub-sub-agent spawning:** Agents spawned by skills cannot spawn their own sub-agents. All Agent tool calls must come from the SKILL.md itself.
- **Wave/job state tracking:** v3 state is set-level only. Do not reference wave or job states. Do not call `state transition wave` or `state transition job`.
- **Per-wave discussion:** discuss-set operates at set level. No WAVE-CONTEXT.md. One CONTEXT.md per set.
- **Approval gates in plan-set:** plan-set is fully autonomous. No AskUserQuestion except on final failure after retry.
- **Skill-to-skill invocation:** Skills cannot call other skills. Each skill is self-contained.
- **Direct STATE.json editing:** All state mutations go through `rapid-tools.cjs` CLI.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State transitions | Custom status tracking | `state transition set` CLI | Atomic writes, lock handling, validation built-in |
| Set resolution | String parsing for set IDs | `resolve set` CLI | Handles numeric index, string ID, error messages |
| Contract validation | Custom import/export checking | `wave-plan validate-contracts` CLI | Cross-set validation, case-insensitive matching |
| Stage banners | Custom ANSI formatting | `display banner` CLI | Consistent branding, color coding |
| Worktree creation | Manual git worktree commands | `set-init create` CLI | Handles branch creation, registration, scoped CLAUDE.md |
| Research directory | mkdir commands | `init research-dir` CLI | Consistent structure, idempotent |

**Key insight:** The rapid-tools.cjs CLI encapsulates all side-effectful operations. Skills should never directly write to .planning/ files or manage git state manually (except for committing planning artifacts at the end of a pipeline).

## Common Pitfalls

### Pitfall 1: Wave State References in Skills

**What goes wrong:** v2 skills reference `state transition wave` and `state transition job` commands that no longer exist in v3.
**Why it happens:** Copy-paste from existing v2 SKILL.md files.
**How to avoid:** Only use `state transition set` in v3 skills. The state schema has no waves or jobs.
**Warning signs:** Any reference to `MILESTONE_ID`, `SET_ID`, `WAVE_ID` as three separate variables in CLI calls. In v3, you only need `MILESTONE_ID` and `SET_ID`.

### Pitfall 2: WAVE-CONTEXT.md vs CONTEXT.md

**What goes wrong:** v2 discuss skill writes WAVE-CONTEXT.md per wave. v3 writes a single CONTEXT.md per set.
**Why it happens:** The wave-planning.cjs `writeWaveContext()` function still exists and writes WAVE-CONTEXT.md.
**How to avoid:** discuss-set should use the Write tool to write CONTEXT.md directly, NOT call `writeWaveContext()`. The planner agent reads CONTEXT.md from `.planning/sets/{set-id}/CONTEXT.md`.
**Warning signs:** Any reference to `.planning/waves/` directory in discuss-set.

### Pitfall 3: Roadmapper Producing Wave Structure

**What goes wrong:** v2 roadmapper returns state with milestones > sets > waves > jobs. v3 returns milestones > sets only.
**Why it happens:** The roadmapper agent (rapid-roadmapper.md) still has v2 instructions for wave/job output.
**How to avoid:** The init skill must instruct the roadmapper to output sets-only structure. Waves are determined later by the planner during plan-set.
**Warning signs:** `"waves"` or `"jobs"` keys in roadmapper structured return.

### Pitfall 4: discuss-set Auto-Chaining from start-set

**What goes wrong:** v2 start-set's Step 5 suggests `/rapid:discuss-set {setIndex}.1` (wave-level).
**Why it happens:** CONTEXT.md decision explicitly says start-set does NOT auto-chain.
**How to avoid:** start-set suggests `/rapid:discuss-set {setIndex}` (set-level, no wave reference). No auto-chain -- just a next-step suggestion.
**Warning signs:** Dot notation in next-step suggestion from start-set.

### Pitfall 5: Plan-Set Trying to Use Wave-Analyzer

**What goes wrong:** v2 plan-set spawns a wave-analyzer agent for dependency detection between waves. v3 removes this.
**Why it happens:** The v2 plan-set SKILL.md (605 lines) has a dedicated Step 3 for wave dependency analysis.
**How to avoid:** In v3, the planner agent itself determines wave decomposition. No separate analyzer. The planner's PLAN.md output already specifies wave ordering.
**Warning signs:** Any reference to `rapid-wave-analyzer`, `DEPENDENCY-GRAPH.json`, or BFS leveling in plan-set.

### Pitfall 6: Missing Contract Enforcement Points

**What goes wrong:** PLAN-05 requires contract enforcement at three points. Only one exists today (validateJobPlans in wave-planning.cjs).
**Why it happens:** v2 had contract validation only during planning.
**How to avoid:** Phase 43 wires enforcement point 1 (after planning). Points 2 and 3 are wired in Phase 44 (execution) and Phase 40 (merge already has review gate). Document this split clearly.
**Warning signs:** Trying to implement all 3 enforcement points in Phase 43.

### Pitfall 7: init Discovery Batching Misunderstood

**What goes wrong:** Interpreting "batch discovery questions by topic" as "ask all questions at once."
**Why it happens:** The CONTEXT.md says "batch" but the existing init SKILL.md says "ask ONE question at a time."
**How to avoid:** The v3 intent is to group related questions into topic batches (e.g., all technical constraint questions together) but still use AskUserQuestion per batch. Each batch is one AskUserQuestion with a multi-part freeform question, NOT a single mega-question covering all 10 areas.
**Warning signs:** Single AskUserQuestion call with 15+ questions.

## Code Examples

### Example 1: v3 State Transition in Skill

```bash
# Environment preamble (required in every Bash invocation)
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi

# Get current milestone ID
MILESTONE_ID=$(node "${RAPID_TOOLS}" state get --all 2>/dev/null | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.currentMilestone)")

# Transition set from pending to discussing
node "${RAPID_TOOLS}" state transition set "${MILESTONE_ID}" "${SET_ID}" discussing
```

### Example 2: v3 Set Resolution in Skill

```bash
# Resolve user input (numeric "1" or string "auth-system") to set info
RESOLVE_RESULT=$(node "${RAPID_TOOLS}" resolve set "<user-input>" 2>&1)
RESOLVE_EXIT=$?
if [ $RESOLVE_EXIT -ne 0 ]; then
  echo "$RESOLVE_RESULT"
  # Display the error message and STOP
fi
SET_ID=$(echo "$RESOLVE_RESULT" | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.resolvedId)")
SET_INDEX=$(echo "$RESOLVE_RESULT" | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.numericIndex)")
```

### Example 3: v3 Agent Spawn from Skill (plan-set planner)

```markdown
Spawn the **rapid-planner** agent with this task:
\```
Decompose and plan set '{SET_ID}'.

## Set Context
- CONTEXT.md: {CONTEXT.md full contents}
- CONTRACT.json: {CONTRACT.json full contents}
- SET-OVERVIEW.md: {SET-OVERVIEW.md full contents}

## Research
{Research output from researcher agent}

## Instructions
1. Read the set context to understand scope and boundaries
2. Decompose the set into 1-4 waves based on natural work boundaries
3. For each wave, produce a PLAN.md with:
   - Objective
   - Tasks with specific file paths and implementation actions
   - Verification commands
   - Success criteria
4. Write each PLAN.md to .planning/sets/{SET_ID}/wave-{N}-PLAN.md

## Working Directory
{projectRoot}
\```
```

### Example 4: v3 Progress Breadcrumb Rendering

```markdown
## Progress

init > start-set > discuss-set [done] > plan-set [current] > execute-set > review > merge

**Next step:** `/rapid:execute-set {setIndex}`
```

### Example 5: v3 discuss-set --skip Auto-Context

```markdown
Spawn a lightweight **rapid-researcher** agent with this task:
\```
Generate auto-context for set '{SET_ID}' (--skip mode).

## Sources
1. ROADMAP.md set description for '{SET_ID}'
2. CONTRACT.json interface boundaries
3. Codebase scan of files in set's file ownership

## Output
Write CONTEXT.md to .planning/sets/{SET_ID}/CONTEXT.md with:
- All decisions marked as "Claude's Discretion"
- Code context from codebase scan
- No user decisions (none were captured)
\```
```

## State of the Art

| Old Approach (v2) | Current Approach (v3) | When Changed | Impact |
|---|---|---|---|
| Per-wave discussion (WAVE-CONTEXT.md) | Per-set discussion (CONTEXT.md) | v3.0 Phase 43 | Single discuss pass per set instead of per wave |
| 15-20 agent spawns for planning | 2-4 agent spawns for planning | v3.0 Phase 43 | Massive context savings, faster planning |
| Wave-analyzer -> wave-researcher -> wave-planner -> job-planner -> verifier (per wave) | researcher -> planner -> verifier (per set) | v3.0 Phase 43 | Planner handles decomposition + per-wave planning |
| STATE.json tracks wave/job status | STATE.json tracks set status only | v3.0 Phase 38 | Simpler state, fewer transitions |
| Orchestrator agent dispatches agents | Skills dispatch agents directly | v3.0 Phase 42 | Skills are first-class orchestrators |
| Roadmap includes wave/job structure | Roadmap includes sets only | v3.0 Phase 43 | Waves determined during plan-set, not init |
| Gate-based set ordering | Contract-based independent sets | v3.0 Phase 43 | Sets can be worked in any order |

**Deprecated/outdated agents (removed in Phase 41):**
- `rapid-wave-analyzer` -- replaced by planner's internal decomposition
- `rapid-wave-researcher` -- replaced by set-level researcher
- `rapid-wave-planner` -- replaced by rapid-planner's per-wave output
- `rapid-job-planner` -- replaced by rapid-planner's task-level output
- `rapid-job-executor` -- replaced by rapid-executor's task-level execution

## Key Design Decisions for Planning

### Plan-Set Single-Agent Planning Validation

The core research question was whether a single planner agent can handle multi-wave planning effectively. Analysis confirms **YES** for these reasons:

1. **The rapid-planner agent (Phase 42) already has the role instructions** for decomposition into sets/waves and producing per-wave PLAN.md files. Its `<role>` section covers: "Analyze project requirements", "Decompose work into independent sets", "Produce one PLAN.md per wave with specific, actionable tasks."

2. **Context efficiency:** A single planner agent holding the full set context (CONTEXT.md + CONTRACT.json + research output) makes better decisions about wave boundaries than multiple agents with fragmented context.

3. **Wave count is bounded:** The CONTEXT.md locks the heuristic at 1-4 waves. At 1-2 waves, the planner handles everything. At 3-4 waves, the skill can optionally spawn parallel wave-planners -- but the planner still determines the decomposition.

4. **Verification is separate:** The rapid-plan-verifier agent (existing, Phase 30) validates plan quality after the planner finishes, providing a quality gate without adding planning complexity.

### PLAN.md Naming Convention for Multi-Wave Sets

In v3, PLAN.md files live in the set directory (not per-wave subdirectories). Recommended naming:

```
.planning/sets/{set-id}/wave-1-PLAN.md
.planning/sets/{set-id}/wave-2-PLAN.md
.planning/sets/{set-id}/wave-3-PLAN.md
```

This allows the executor (Phase 44) to glob for `wave-*-PLAN.md` files and process them in order.

### Contract Enforcement Architecture

PLAN-05 requires enforcement at three points. Phase 43 implements point 1:

1. **After planning (Phase 43):** plan-set runs `wave-plan validate-contracts` against each PLAN.md's file list. Violations are advisory -- logged in VERIFICATION-REPORT.md but do not block planning.

2. **During execution (Phase 44):** execute-set validates contract compliance before committing.

3. **Before merge (already exists):** merge skill runs review gate which includes contract checks.

### Roadmapper v3 Changes

The roadmapper agent needs instruction updates to output sets-only:

- Remove `"waves"` and `"jobs"` from state structure output
- Keep `"contracts"` array for CONTRACT.json generation
- ROADMAP.md shows set descriptions and dependency graph only
- Wave/job breakdown is explicitly deferred to plan-set

### Auto-Context Researcher (--skip)

The --skip researcher is a lightweight agent distinct from the full 6-researcher init pipeline:

- Reads only: ROADMAP.md set description, CONTRACT.json, and quick codebase scan (file structure, no deep analysis)
- Produces CONTEXT.md with all items marked "Claude's Discretion"
- Uses the same rapid-researcher agent type but with a simpler task prompt
- Single spawn, not 6 parallel researchers

## Open Questions

1. **PLAN.md file location within set directory**
   - What we know: v2 used `.planning/waves/{setId}/{waveId}/` for per-wave artifacts. v3 removes wave state.
   - What's unclear: Should PLAN.md files be `.planning/sets/{set-id}/wave-N-PLAN.md` (flat) or `.planning/sets/{set-id}/waves/wave-N/PLAN.md` (nested)?
   - Recommendation: Use flat naming (`wave-N-PLAN.md`) in the set directory. Simpler glob pattern, no subdirectory management. The verifier and executor can easily discover them.

2. **How planner communicates wave structure to skill**
   - What we know: The planner writes PLAN.md files directly. The skill needs to know how many waves were created.
   - What's unclear: Should the planner return wave count in RAPID:RETURN, or should the skill glob for wave-*-PLAN.md files?
   - Recommendation: Both. Planner returns wave count in structured return AND writes the files. Skill uses glob as verification.

3. **Contract validation scope in plan-set**
   - What we know: `validateJobPlans()` takes per-job file lists. v3 PLAN.md is per-wave, not per-job.
   - What's unclear: Does `validateJobPlans()` need refactoring for wave-level validation?
   - Recommendation: The planner's PLAN.md includes per-task file lists. Extract file lists from PLAN.md and pass to `validateJobPlans()`. The existing function works if fed the right data.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | node:test (built-in) + node:assert/strict |
| Config file | None -- uses node --test flag |
| Quick run command | `node --test src/lib/{module}.test.cjs` |
| Full suite command | `node --test src/lib/*.test.cjs` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMD-01 | /init handles greenfield+brownfield, 6-researcher pipeline, roadmap | integration | Manual verification -- skill orchestration | N/A (skill test) |
| CMD-02 | /start-set creates worktree scaffold | integration | `node --test src/lib/worktree.test.cjs` | Yes |
| CMD-03 | /discuss-set captures vision, --skip generates auto-context | integration | Manual verification -- skill orchestration | N/A (skill test) |
| CMD-04 | /plan-set produces PLAN.md per wave | integration | Manual verification -- skill orchestration | N/A (skill test) |
| PLAN-01 | 2-4 agent spawns for planning | integration | Manual verification -- count Agent tool calls | N/A (skill test) |
| PLAN-02 | CONTEXT.md produced by discuss-set | integration | Manual verification | N/A (skill test) |
| PLAN-03 | --skip auto-generates CONTEXT.md | integration | Manual verification | N/A (skill test) |
| PLAN-04 | Contract enforcement without blocking gates | unit | `node --test src/lib/contract.test.cjs` | Yes |
| PLAN-05 | Three enforcement points | unit | `node --test src/lib/wave-planning.test.cjs` | Yes |
| UX-01 | Progress breadcrumb in error messages | manual-only | Visual inspection | N/A |
| UX-02 | One suggested next action per command | manual-only | Visual inspection | N/A |

### Sampling Rate

- **Per task commit:** `node --test src/lib/state-transitions.test.cjs && node --test src/lib/contract.test.cjs`
- **Per wave merge:** `node --test src/lib/*.test.cjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] No automated tests for SKILL.md files -- these are declarative orchestration documents tested via manual end-to-end runs
- [ ] `validateJobPlans()` may need additional test cases for wave-level (vs job-level) file list extraction
- [ ] Breadcrumb rendering has no test infrastructure -- verify visually

## Sources

### Primary (HIGH confidence)

- Existing codebase: `skills/init/SKILL.md` (706 lines), `skills/start-set/SKILL.md` (184 lines), `skills/discuss-set/SKILL.md` (351 lines), `skills/plan-set/SKILL.md` (605 lines) -- current v2 implementations
- Existing agents: `agents/rapid-planner.md` (Phase 42 hand-written), `agents/rapid-plan-verifier.md`, `agents/rapid-set-planner.md`, `agents/rapid-roadmapper.md`
- State machine: `src/lib/state-schemas.cjs` (SetStatus enum), `src/lib/state-transitions.cjs` (SET_TRANSITIONS map)
- Contract system: `src/lib/contract.cjs` (CONTRACT_META_SCHEMA, compileContract, validateJobPlans)
- Tool docs: `src/lib/tool-docs.cjs` (TOOL_REGISTRY, ROLE_TOOL_MAP)
- Display: `src/lib/display.cjs` (STAGE_VERBS, STAGE_BG, renderBanner)
- Resolve: `src/lib/resolve.cjs` (resolveSet, resolveWave)
- Phase 43 CONTEXT.md: `.planning/phases/43-planning-discussion-skills/43-CONTEXT.md` -- locked user decisions

### Secondary (MEDIUM confidence)

- `refresh/refresh.md` -- v3 design philosophy document from user
- `.planning/STATE.md` -- project state with accumulated decisions from Phases 38-42
- `.planning/ROADMAP.md` -- v3.0 phase structure and success criteria
- `.planning/REQUIREMENTS.md` -- v3.0 requirement definitions

### Tertiary (LOW confidence)

- None -- all findings verified from codebase and project artifacts

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries exist in codebase, APIs verified by reading source
- Architecture: HIGH -- patterns derived from existing v2 skills and v3 agent rewrites (Phase 42)
- Pitfalls: HIGH -- identified from direct comparison of v2 code vs v3 CONTEXT.md decisions
- Plan-set validation: HIGH -- confirmed by reading rapid-planner.md role section and CONTEXT.md pipeline design

**Research date:** 2026-03-13
**Valid until:** 2026-03-20 (stable internal project, no external dependencies changing)
