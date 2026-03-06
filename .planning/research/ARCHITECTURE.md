# Architecture: Mark II Integration with Existing RAPID

**Domain:** Metaprompting plugin -- workflow overhaul
**Researched:** 2026-03-06
**Focus:** How new features integrate with existing architecture, what changes, what's new

## Executive Summary

The existing RAPID architecture is well-structured for the Mark II overhaul. The plugin follows a clean layered pattern: commands (entry points) -> skills (SKILL.md prose orchestrators) -> lib modules (CJS programmatic layer) -> state files (JSON + Markdown in `.planning/`). Mark II primarily extends this architecture rather than replacing it. The hierarchy change (Sets > Waves > Jobs replacing the flat set model) requires a new state machine and planning hierarchy, but the existing worktree, contract, merge, and execution infrastructure provides solid foundations to build on.

The biggest architectural change is inside each set: replacing the monolithic discuss/plan/execute cycle with a Wave Planner -> Job Planner -> Executor -> Reviewer pipeline. The existing set-level worktree isolation remains unchanged. The review module (hunter/devils-advocate/judge) is additive -- new agents and a new skill, not a rewrite. The merger adaptation from gsd_merge_agent is also additive: the 5-level conflict detection slots into the existing merge pipeline as an enhanced conflict classification + resolution layer.

## Current Architecture (v1.x Baseline)

### Layer Diagram

```
User Commands (/rapid:init, /rapid:execute, etc.)
    |
    v
Skills (SKILL.md prose files -- Claude interprets these)
    |
    v  (calls via Bash)
CLI Entry Point (src/bin/rapid-tools.cjs)
    |
    v  (dispatches to)
Library Modules (src/lib/*.cjs)
    |
    v  (reads/writes)
State Files (.planning/ -- JSON machine + Markdown human)
    |
    v  (operates on)
Git Layer (worktrees, branches, merges)
```

### Key Modules and Their Roles

| Module | Role | Mark II Impact |
|--------|------|----------------|
| `core.cjs` | Project root detection, config, output utils | Minimal -- add config fields for new features |
| `state.cjs` | Read/write STATE.md fields with lock protection | **Major rewrite** -- needs hierarchical state machine |
| `plan.cjs` | Set creation, DAG, ownership, gates, decomposition | **Extension** -- add wave/job planning within sets |
| `execute.cjs` | Context prep, prompt assembly, verify, stubs | **Extension** -- add job-level execution dispatch |
| `merge.cjs` | Programmatic gate, review prompt, merge execution | **Enhancement** -- integrate 5-level conflict detection |
| `worktree.cjs` | Git worktree CRUD, registry, status formatting | Minimal -- already handles sets well |
| `contract.cjs` | Contract schema, test generation, ownership maps | Minimal -- contracts stay at set level |
| `dag.cjs` | DAG creation, topological sort, execution order | **Extension** -- add intra-set wave/job DAGs |
| `lock.cjs` | File-based locking for concurrent state access | Unchanged |
| `teams.cjs` | Agent teams detection and team creation | Unchanged |
| `verify.cjs` | Artifact verification (light/heavy) | Unchanged |
| `assembler.cjs` | Agent prompt assembly from config.json modules | **Extension** -- add new agent roles |
| `returns.cjs` | RAPID:RETURN structured output parsing | Unchanged |

## Component 1: Hierarchical State Machine

### Problem

Current `state.cjs` is flat -- reads/writes key-value fields from `STATE.md` via regex. Mark II needs hierarchical tracking: Project > Milestone > Set > Wave > Job with lifecycle states at each level.

### Architecture Decision: JSON State File with Markdown Projection

**Recommendation:** Replace STATE.md with `STATE.json` as the source of truth. Keep a generated `STATE.md` as a human-readable projection (read-only, regenerated on every state change).

**Why not keep Markdown as source of truth:**
- Parsing structured hierarchical data from Markdown is fragile
- The current regex-based field extraction breaks with nested structures
- JSON is trivially parseable and supports the nested hierarchy

### State Schema

```
.planning/
  STATE.json          -- Machine state (source of truth)
  STATE.md            -- Human-readable projection (auto-generated)
```

```javascript
// STATE.json schema
{
  "version": 2,
  "project": {
    "name": "...",
    "status": "active",                    // active | paused | completed
    "currentMilestone": "v2.0"
  },
  "milestones": {
    "v2.0": {
      "status": "in-progress",            // planned | in-progress | completed
      "currentSet": "set-name"
    }
  },
  "sets": {
    "set-name": {
      "milestone": "v2.0",
      "status": "executing",              // planned | initialized | executing | reviewing | merging | done
      "currentWave": 1,
      "worktree": { "branch": "rapid/set-name", "path": "..." },
      "waves": {
        "1": {
          "status": "executing",          // planned | discussing | planning | executing | reviewing | done
          "jobs": {
            "job-1": {
              "status": "done",           // planned | executing | paused | done | error
              "tasksCompleted": 3,
              "tasksTotal": 3,
              "lastCommit": "abc123"
            },
            "job-2": {
              "status": "executing",
              "tasksCompleted": 1,
              "tasksTotal": 5
            }
          }
        },
        "2": {
          "status": "pending",
          "jobs": {}
        }
      }
    }
  },
  "lastUpdated": "2026-03-06T12:00:00Z"
}
```

### Integration with Existing Code

**What changes:**
- `state.cjs` -- Rewrite: replace `stateGet`/`stateUpdate` with hierarchical accessors (`getSetStatus`, `getJobStatus`, `updateJobStatus`, `transitionWave`, etc.). Keep `stateGet`/`stateUpdate` as deprecated wrappers for backward compat.
- `state.cjs` -- Add: `projectStateToMarkdown()` function that generates STATE.md from STATE.json
- `rapid-tools.cjs` -- Extend: new CLI subcommands for state queries (`state get-set`, `state get-job`, `state transition`)

**What stays:**
- Lock-based write protection (already in state.cjs via `acquireLock`)
- `.planning/` as root for all state
- The lock.cjs module and its API

**Migration path:**
- The new `stateGet`/`stateUpdate` functions check for STATE.json first, fall back to STATE.md for backward compatibility
- v2.0 /init creates STATE.json from scratch; existing projects can be migrated with a one-time conversion

### State Transitions

```
Set Lifecycle:
  planned -> initialized (/set-init) -> executing (first wave starts) -> reviewing (/review) -> merging (/merge) -> done

Wave Lifecycle (within a set):
  pending -> discussing (/discuss) -> planning (/plan) -> executing (/execute) -> reviewing (/review) -> done

Job Lifecycle (within a wave):
  planned -> executing (executor spawned) -> done | paused | error
```

## Component 2: Wave Planner and Job Planner Agents

### Problem

Current planning (plan.cjs + `/rapid:plan` skill) works at the set level -- it creates DEFINITION.md, CONTRACT.json, DAG.json for sets. Mark II needs planning within each set: breaking a set into waves of parallel jobs, then creating detailed implementation plans per job.

### Architecture: Two New Agents + Extended plan.cjs

**Wave Planner Agent:**
- Lives at: `agents/wave-planner/AGENT.md` (new)
- Spawned by: the set-init or plan skill during wave decomposition
- Input: Set's DEFINITION.md, CONTRACT.json, discussion decisions, research output
- Output: Wave structure written to `.planning/sets/{setName}/WAVES.json`
- Responsibility: Decomposes a set into waves of parallelizable jobs

**Job Planner Agent:**
- Lives at: `agents/job-planner/AGENT.md` (new)
- Spawned by: the execute skill during `/plan` phase for each wave
- Input: WAVES.json, specific job definition, research output, discussion context
- Output: Job plan written to `.planning/sets/{setName}/jobs/{jobId}/PLAN.md`
- Responsibility: Creates detailed implementation plan for a single job

### How They Interact with Existing Planning Engine

The existing planning engine (plan.cjs) works at the **set** level. Wave/job planning is a **layer below** sets, not a replacement. The interaction is:

1. `/rapid:init` -> existing plan.cjs creates sets, DAG, contracts (unchanged)
2. `/rapid:set-init` -> calls existing `worktree.createWorktree()` then spawns **wave planner** agent
3. Wave planner writes WAVES.json (new file, new plan.cjs functions)
4. `/rapid:plan` (for a wave) -> spawns **job planner** agents (one per job in wave)
5. Job planners write per-job PLAN.md files (new file structure under sets/{setName}/jobs/)

The key insight: **plan.cjs is extended, not replaced.** Set-level functions (`createSet`, `loadSet`, `decomposeIntoSets`) remain unchanged. New functions are added for wave/job operations.

### File Structure Addition

```
.planning/sets/{setName}/
  DEFINITION.md          -- (existing) Set scope, tasks, contract
  CONTRACT.json          -- (existing) Interface contracts
  WAVES.json             -- (new) Wave/job decomposition
  discussions/           -- (new) Discussion phase outputs
    wave-1.md
    wave-2.md
  jobs/
    {jobId}/
      PLAN.md            -- (new) Detailed implementation plan
      HANDOFF.md         -- (new) Pause/resume state (replaces set-level HANDOFF.md)
      REPORT.md          -- (new) Execution report
```

### WAVES.json Schema

```javascript
{
  "version": 1,
  "setName": "auth-backend",
  "totalWaves": 2,
  "waves": {
    "1": {
      "description": "Core auth infrastructure",
      "jobs": [
        {
          "id": "auth-models",
          "description": "User model and auth schema",
          "files": ["src/models/user.ts", "src/schemas/auth.ts"],
          "estimatedTasks": 3,
          "dependencies": []
        },
        {
          "id": "auth-middleware",
          "description": "JWT middleware and session handling",
          "files": ["src/middleware/auth.ts"],
          "estimatedTasks": 4,
          "dependencies": []
        }
      ]
    },
    "2": {
      "description": "Auth API routes",
      "jobs": [
        {
          "id": "auth-routes",
          "description": "Login, register, refresh endpoints",
          "files": ["src/routes/auth.ts"],
          "estimatedTasks": 5,
          "dependencies": ["auth-models", "auth-middleware"]
        }
      ]
    }
  }
}
```

### New plan.cjs Functions (Extension, Not Replacement)

```javascript
// Existing exports remain unchanged:
// createSet, loadSet, listSets, decomposeIntoSets, writeDAG, writeOwnership,
// writeManifest, writeGates, checkPlanningGate, updateGate, surfaceAssumptions

// New additions:
module.exports.createWavePlan = function(cwd, setName, waveData) {};   // Writes WAVES.json
module.exports.loadWavePlan = function(cwd, setName) {};               // Reads WAVES.json
module.exports.createJobPlan = function(cwd, setName, jobId, plan) {}; // Writes job PLAN.md
module.exports.loadJobPlan = function(cwd, setName, jobId) {};         // Reads job PLAN.md
module.exports.listJobs = function(cwd, setName, waveNum) {};          // Lists jobs in a wave
```

**dag.cjs extension:**
- Add `createJobDAG(jobs)` -- creates a mini-DAG for job dependencies within a set
- Reuses existing `createDAG` logic with jobs as nodes instead of sets

## Component 3: Review Module (Hunter/Devils-Advocate/Judge/Unit-Test/UAT)

### Architecture: New Skill + New Agents + New Lib Module

The review module is entirely additive. It does not modify existing merge review -- it adds a comprehensive pre-merge review phase.

**Where agents live:**

```
agents/
  hunter/AGENT.md           -- Bug hunter (static analysis, broad net)
  devils-advocate/AGENT.md  -- Skeptic that disproves hunter findings
  judge/AGENT.md            -- Final ruling on contested findings
  unit-test/AGENT.md        -- Unit test plan + execution + reporting
  uat/AGENT.md              -- UAT test plan + Playwright automation
  bugfix/AGENT.md           -- Spawned to fix confirmed bugs
```

**New skills:**

```
skills/review/SKILL.md      -- /rapid:review orchestrator (runs all 3 sub-pipelines)
skills/uat/SKILL.md          -- /rapid:uat (UAT only)
skills/unit-test/SKILL.md   -- /rapid:unit-test (unit tests only)
skills/bug-hunt/SKILL.md    -- /rapid:bug-hunt (hunter pipeline only)
```

**New commands:**

```
commands/review.md           -- /rapid:review (full pipeline)
commands/uat.md              -- /rapid:uat (UAT only)
commands/unit-test.md        -- /rapid:unit-test (unit tests only)
commands/bug-hunt.md         -- /rapid:bug-hunt (hunter pipeline only)
```

### Review Pipeline Data Flow

```
/rapid:review
    |
    v
[1] UAT Agent
    |-- Generates UAT plan (automated + human steps)
    |-- Runs Playwright for automated steps
    |-- Prompts user for human steps (AskUserQuestion)
    |-- Outputs: UAT-REPORT.md
    |-- If failures: spawns bugfix agent -> loops
    |
    v
[2] Unit Test Agent
    |-- Generates test plan -> user approval (AskUserQuestion)
    |-- Writes tests, runs tests
    |-- Outputs: UNIT-TEST-REPORT.md + test log file
    |-- If failures: spawns bugfix agent -> loops
    |
    v
[3] Bug Hunt Pipeline
    |-- Hunter agent -> BUG-HUNT-REPORT.md
    |-- Devils Advocate agent -> DEVILS-ADVOCATE-REPORT.md
    |-- Judge agent -> JUDGE-RULING.md (+ AskUserQuestion for contested)
    |-- If accepted bugs: spawns bugfix agent -> loops from Hunter
    |
    v
[done] All reports in .planning/sets/{setName}/review/
```

### Agent Chaining Pattern (Critical Design Decision)

Agents cannot spawn agents (Claude Code limitation). The **review skill** (SKILL.md) is the orchestrator that spawns all agents sequentially and passes reports between them:

```
Review Skill (SKILL.md) orchestrates:
  1. Spawn hunter agent -> reads codebase, writes BUG-HUNT-REPORT.md
  2. Read BUG-HUNT-REPORT.md
  3. Spawn devils-advocate agent with BUG-HUNT-REPORT.md content -> writes DEVILS-ADVOCATE-REPORT.md
  4. Read DEVILS-ADVOCATE-REPORT.md
  5. Spawn judge agent with both reports -> writes JUDGE-RULING.md
  6. Read JUDGE-RULING.md, present to user (AskUserQuestion)
  7. If bugs accepted: spawn bugfix agent -> loop from step 1
```

This follows the existing pattern in merge/SKILL.md where the skill spawns reviewer and cleanup agents and chains their outputs.

### File Structure

```
.planning/sets/{setName}/review/
  UAT-REPORT.md
  UAT-LOG.txt
  UNIT-TEST-PLAN.md
  UNIT-TEST-REPORT.md
  unit-test-log.txt
  BUG-HUNT-REPORT.md
  DEVILS-ADVOCATE-REPORT.md
  JUDGE-RULING.md
```

### Integration Points

1. **With existing merge pipeline:** The review module runs BEFORE `/rapid:merge`. Add a `checkReviewGate(cwd, setName)` to merge.cjs that verifies review artifacts exist and all bugs are resolved. This slots into the existing `runProgrammaticGate` as an additional check.

2. **With state machine:** Each review sub-phase updates the set/wave status: `executing -> reviewing -> done` or `reviewing -> executing` (if bugs found and fixed).

3. **Playwright dependency:** UAT agent needs Playwright MCP or playwright-cli. This is an optional dependency -- if not available, UAT falls back to all-human steps. Detection via `which playwright` or checking for `@playwright/test` in package.json.

### New lib module: `review.cjs`

```javascript
// New module -- does NOT modify existing modules
module.exports = {
  // Report management
  writeReport(setDir, reportType, content) {},
  loadReport(setDir, reportType) {},

  // Pipeline state
  checkReviewComplete(cwd, setName) {},  // All 3 sub-phases done, no open bugs

  // Integration with merge gate
  checkReviewGate(cwd, setName) {},      // Returns { passed, reason }

  // Prompt assembly for each agent
  assembleHunterPrompt(cwd, setName) {},
  assembleDAPrompt(cwd, setName, hunterReport) {},
  assembleJudgePrompt(cwd, setName, hunterReport, daReport) {},
  assembleUnitTestPrompt(cwd, setName) {},
  assembleUATPrompt(cwd, setName) {},
};
```

## Component 4: Merger Agent (5-Level Conflict Detection)

### Problem

Current merge.cjs does simple `git merge --no-ff` with conflict detection via string matching on stdout. Mark II needs the 5-level detection (textual, structural, dependency, API, semantic) and tiered resolution (deterministic, heuristic, AI, human) from gsd_merge_agent.

### Architecture: Enhance merge.cjs, Don't Import gsd_merge_agent

The gsd_merge_agent is a standalone plugin with its own state machine, TypeScript schemas (Zod), and skill files. We should NOT import it wholesale -- instead, adapt its concepts into RAPID's existing CJS module pattern.

**What to bring from gsd_merge_agent:**
1. Conflict classification (5 levels: textual, structural, dependency, API, semantic) -- port schemas/conflict.ts concepts to CJS
2. Resolution cascade (4 tiers: deterministic, heuristic, AI, human) -- implement as functions in merge.cjs
3. Integration branch pattern (`gsd-merge/integrate-{timestamp}`) -- adapt to `rapid-merge/integrate-{timestamp}`
4. Bisection recovery -- add as new function in merge.cjs
5. Rerere integration -- enable during merge session, disable after

**What NOT to bring:**
- gsd_merge_agent's separate state file (`.gsd-merge/state.json`) -- use RAPID's STATE.json instead
- TypeScript/Zod schemas -- RAPID is CJS, use runtime validation or simple shape checks
- Separate plugin registration -- it's part of RAPID, not a separate plugin
- Separate commands (/merge-status, /merge-report, /merge-abort) -- fold into existing /rapid:merge and /rapid:status

### How 5-Level Detection Integrates with Existing mergeSet()

The existing `mergeSet()` function in merge.cjs does:
1. `git checkout baseBranch`
2. `git merge --no-ff branch`
3. If conflict: abort and return `{ merged: false, reason: 'conflict' }`

The enhanced flow:
1. Create integration branch (new)
2. `git merge --no-ff branch` (existing)
3. If conflict:
   a. **Classify** conflicts at 5 levels (new `classifyConflicts()`)
   b. **Resolve** via tiered cascade (new `resolveConflicts()`)
   c. If all resolved: commit and continue
   d. If human escalation needed: pause with structured scaffold
4. Validate (build + test) after merge (existing `runIntegrationTests()`)
5. If final validation fails: bisection recovery (new `bisectFailure()`)

### Enhanced merge.cjs API

```javascript
// Existing (keep unchanged):
module.exports.runProgrammaticGate = ...;
module.exports.mergeSet = ...;           // Enhanced internally, same external API
module.exports.getMergeOrder = ...;
module.exports.runIntegrationTests = ...;
module.exports.assembleReviewerPrompt = ...;
module.exports.writeReviewMd = ...;
module.exports.parseReviewVerdict = ...;

// New additions:
module.exports.classifyConflicts = function(cwd, setName, baseBranch) {
  // Returns array of { file, level, tier, severity, conflictCount, description }
  // Detects: textual, structural, dependency, API, semantic
};

module.exports.resolveConflicts = function(cwd, classifications) {
  // Tiered resolution cascade:
  // 1. Deterministic (lockfiles, whitespace normalization)
  // 2. Heuristic (pattern matching on 3-way chunks)
  // 3. AI-assisted (single file, with validation)
  // 4. Human escalation (scaffold with explanation)
  // Returns: { resolved: [...], unresolved: [...], stats }
};

module.exports.createIntegrationBranch = function(projectRoot, baseBranch) {
  // Creates rapid-merge/integrate-{timestamp} branch
  // Enables rerere
  // Returns { branch, created }
};

module.exports.bisectFailure = function(projectRoot, sets) {
  // Binary search to isolate which merged set breaks final validation
  // Returns { breakingSet, evidence } or { inconclusive }
};

module.exports.rollbackSet = function(projectRoot, setName) {
  // Cascade revert: revert target set + re-merge later sets
  // Returns { reverted, cascadedSets }
};
```

### Merge State in STATE.json

Instead of a separate `.gsd-merge/state.json`, merge state lives in STATE.json:

```javascript
{
  "merge": {
    "session": {
      "mode": "active",                    // active | paused | conflicted | completed | aborted
      "integrationBranch": "rapid-merge/integrate-1709500800",
      "targetBranch": "main",
      "startedAt": "..."
    },
    "phases": {
      "set-a": {
        "status": "validated",             // pending | merging | conflicted | merged | validating | validated | failed | reverted
        "mergeCommit": "abc123",
        "resolutions": [
          { "file": "...", "tier": "deterministic", "resolved": true }
        ]
      }
    }
  }
}
```

## Component 5: Orchestrator Pattern

### Architecture Decision: Enhanced Skills, Not a Central Orchestrator Agent

**Against a central orchestrator agent:** Adding a layer of indirection between commands and skills creates unnecessary complexity and consumes an extra agent invocation. The current pattern (command -> skill -> lib) is clean and works.

**Recommendation:** Keep the command -> skill -> lib pattern. Make each skill smarter about state awareness by reading STATE.json on entry.

### How Command Dispatch Changes

**Current flow:**
```
/rapid:execute -> skills/execute/SKILL.md -> (reads state, runs entire discuss/plan/execute pipeline)
```

**Mark II flow:**
```
/rapid:execute -> skills/execute/SKILL.md
    |-- Read STATE.json to determine current position
    |-- If no set initialized: prompt user to run /rapid:set-init
    |-- If set initialized, no waves planned: run wave planner
    |-- If waves planned, current wave not yet discussed: start /discuss flow
    |-- If wave discussed, jobs not planned: run job planners
    |-- If jobs planned: execute current wave's jobs
    |-- Each skill is re-entrant based on state
```

The key insight: **state awareness replaces central dispatch.** Each skill reads STATE.json, determines where the project is, and picks up from there. This is already how the existing execute skill works (it checks registry state and resumes from the current wave).

### New Commands and Skills

| Command | Skill | Purpose | New/Modified |
|---------|-------|---------|--------------|
| `/rapid:set-init` | `skills/set-init/SKILL.md` | Create worktree + branch, trigger wave planning | **New** |
| `/rapid:discuss` | `skills/discuss/SKILL.md` | Wave-level discussion phase | **New** (extracted from execute) |
| `/rapid:plan` | `skills/plan/SKILL.md` | Wave + job planning | **Enhanced** |
| `/rapid:execute` | `skills/execute/SKILL.md` | Job-level execution within a wave | **Major rewrite** |
| `/rapid:review` | `skills/review/SKILL.md` | UAT + unit test + bug hunt pipeline | **New** |
| `/rapid:merge` | `skills/merge/SKILL.md` | 5-level merge with conflict resolution | **Major rewrite** |
| `/rapid:uat` | `skills/uat/SKILL.md` | Standalone UAT | **New** |
| `/rapid:unit-test` | `skills/unit-test/SKILL.md` | Standalone unit testing | **New** |
| `/rapid:bug-hunt` | `skills/bug-hunt/SKILL.md` | Standalone bug hunting | **New** |

**Existing commands that stay mostly unchanged:**
- `/rapid:init` -- enhanced with roadmap creation, greenfield/brownfield detection (already exists)
- `/rapid:install` -- unchanged
- `/rapid:status` -- enhanced to show wave/job state from STATE.json
- `/rapid:help` -- updated descriptions
- `/rapid:pause` -- enhanced for job-level pause
- `/rapid:cleanup` -- unchanged

## Component 6: /set-init Command

### Flow

```
/rapid:set-init [set-name]
    |
    v
[1] Read STATE.json to find the set definition
    |-- If set doesn't exist: error with helpful message
    |-- If set already initialized: offer to re-initialize or skip
    |
    v
[2] Create worktree + branch
    |-- Uses existing worktree.createWorktree(projectRoot, setName)
    |-- Returns { branch: "rapid/set-name", path: "..." }
    |
    v
[3] Generate scoped CLAUDE.md
    |-- Uses existing worktree.generateScopedClaudeMd(cwd, setName)
    |-- Writes to worktree path
    |
    v
[4] Run Wave Planner agent (via Agent tool)
    |-- Input: DEFINITION.md + CONTRACT.json + any research output
    |-- Output: WAVES.json written to .planning/sets/{setName}/
    |-- User reviews wave/job decomposition (AskUserQuestion)
    |
    v
[5] Update STATE.json
    |-- set.status -> "initialized"
    |-- set.worktree -> { branch, path }
    |-- set.waves -> populated from WAVES.json
    |
    v
[6] Update worktree registry
    |-- Uses existing worktree.registryUpdate()
    |
    v
[7] Print summary and prompt user for next step
    |-- "Set '{setName}' initialized. Run /rapid:discuss to start Wave 1."
```

### Integration with Existing Modules

- **worktree.cjs:** Uses `createWorktree()`, `generateScopedClaudeMd()`, `registryUpdate()` -- all existing functions, no changes needed
- **plan.cjs:** Uses `loadSet()` (existing) and `createWavePlan()` (new)
- **state.cjs:** Uses new hierarchical state functions
- **No new lib modules needed** -- just a new skill that composes existing lib functions

## Data Flow Changes Summary

### Current v1.x Flow

```
/init -> PROJECT.md, STATE.md, ROADMAP.md, sets/, DAG.json, contracts/
    |
/plan -> DEFINITION.md + CONTRACT.json per set
    |
/execute -> worktrees, CLAUDE.md per worktree, discuss/plan/execute per set
    |
/merge -> REVIEW.md per set, merge commits on main
```

### Mark II Flow

```
/init -> PROJECT.md, STATE.json, STATE.md, ROADMAP.md, sets/, DAG.json, contracts/
    |
/set-init -> worktree + branch, WAVES.json per set, STATE.json update
    |
/discuss -> .planning/sets/{set}/discussions/wave-{N}.md
    |
/plan -> .planning/sets/{set}/jobs/{jobId}/PLAN.md per job
    |
/execute -> Parallel job execution in worktree, per-job commits, STATE.json updates
    |
/review -> .planning/sets/{set}/review/ (UAT, unit-test, bug-hunt reports)
    |
/merge -> Integration branch, 5-level conflict detection, tiered resolution, promote to main
```

### Complete File Tree (New + Modified)

```
.planning/
  STATE.json                         -- (new) Hierarchical project state, source of truth
  STATE.md                           -- (modified) Auto-generated from STATE.json, read-only
  PROJECT.md                         -- (unchanged)
  ROADMAP.md                         -- (unchanged)
  sets/
    DAG.json                         -- (unchanged) Set dependency graph
    OWNERSHIP.json                   -- (unchanged) File ownership map
    GATES.json                       -- (unchanged) Wave gates
    {setName}/
      DEFINITION.md                  -- (unchanged) Set scope and tasks
      CONTRACT.json                  -- (unchanged) Interface contracts
      contract.test.cjs              -- (unchanged)
      CONTRIBUTIONS.json             -- (unchanged)
      WAVES.json                     -- (new) Wave/job decomposition
      REVIEW.md                      -- (enhanced) Written by review module too
      discussions/                   -- (new) Discussion phase outputs per wave
        wave-1.md
        wave-2.md
      jobs/                          -- (new) Per-job planning and state
        {jobId}/
          PLAN.md                    -- Detailed implementation plan
          HANDOFF.md                 -- Pause/resume state
          REPORT.md                  -- Execution report
      review/                        -- (new) Review module outputs
        UAT-REPORT.md
        UAT-LOG.txt
        UNIT-TEST-PLAN.md
        UNIT-TEST-REPORT.md
        unit-test-log.txt
        BUG-HUNT-REPORT.md
        DEVILS-ADVOCATE-REPORT.md
        JUDGE-RULING.md
  contracts/
    MANIFEST.json                    -- (unchanged)
  worktrees/
    REGISTRY.json                    -- (unchanged)
```

## Patterns to Follow

### Pattern 1: State-Driven Re-Entrancy

**What:** Every skill reads STATE.json on entry and resumes from the current position. No skill assumes a clean start.

**When:** All commands. Users will context-reset between phases.

**Example:**
```javascript
// In the execute skill, determine where to pick up
const state = loadState(cwd);
const set = state.sets[setName];
const currentWave = set.currentWave;
const waveState = set.waves[currentWave];

if (waveState.status === 'pending') {
  // Start discussion phase
} else if (waveState.status === 'discussing') {
  // Resume or complete discussion
} else if (waveState.status === 'planning') {
  // Resume job planning
} else if (waveState.status === 'executing') {
  // Resume job execution -- check which jobs are done vs pending
}
```

### Pattern 2: Agent Chaining via Structured Reports

**What:** Agents communicate through structured files (Markdown + JSON), not direct message passing. Each agent writes a report; the next agent reads it. The skill orchestrates the chain.

**When:** Review pipeline (hunter -> DA -> judge), wave planner -> job planner, reviewer -> cleanup.

**Why this works in RAPID:** This is already the established pattern. The existing merge skill chains reviewer and cleanup agents through REVIEW.md. Mark II extends this to more agent chains without changing the underlying mechanism.

### Pattern 3: Additive Module Pattern

**What:** New features add new modules and extend existing ones via new exports. Never delete or change existing public API function signatures.

**When:** All Mark II work.

**Why:** Existing skills reference existing lib functions by name. Breaking those references breaks the plugin. New features should add new exports, not modify existing ones.

### Pattern 4: CJS Module Conventions

**What:** All lib modules remain CJS (`.cjs`). No TypeScript, no ES modules.

**When:** All new code.

**Why:** The entire existing codebase is CJS. The CLI entry point, all lib modules, all tests -- everything is `.cjs`. Introducing TypeScript or ESM would require a build step and break the direct-execution pattern (`node rapid-tools.cjs`).

## Anti-Patterns to Avoid

### Anti-Pattern 1: Central Orchestrator God-Agent

**What:** Creating a single orchestrator agent that intercepts all commands and dispatches to sub-agents.

**Why bad:** Adds latency (extra agent invocation), creates a bottleneck, makes each command depend on the orchestrator's context window, and makes debugging harder. The existing "each skill is its own orchestrator" pattern is simpler and more reliable.

**Instead:** Each skill reads state and self-dispatches. Skills ARE orchestrators for their domain.

### Anti-Pattern 2: Importing gsd_merge_agent Wholesale

**What:** Copying the gsd_merge_agent directory structure and TypeScript into RAPID.

**Why bad:** Different language (TS vs CJS), different state model (`.gsd-merge/` vs `.planning/`), different plugin framework. The integration surface becomes a translation layer.

**Instead:** Adapt the concepts (5-level detection, 4-tier resolution, bisection) into RAPID's CJS modules and STATE.json.

### Anti-Pattern 3: Separate State Files per Feature

**What:** Review module has its own state file, merger has its own state file, each wave has its own state file.

**Why bad:** State fragmentation. No single place to know "where is this project?" Multiple files to keep in sync. Race conditions between files.

**Instead:** One STATE.json with sections for each concern. Lock-protected writes ensure consistency. Separate REPORT files are fine (they're outputs, not state).

### Anti-Pattern 4: Deep Agent Nesting

**What:** Skills spawning agents that spawn agents that spawn agents.

**Why bad:** Claude Code subagents cannot spawn subagents. This is a hard platform limitation.

**Instead:** The skill (top-level) spawns all agents directly. Agents return structured output; the skill chains them sequentially.

## Suggested Build Order

Based on dependency analysis between components:

### Phase 1: State Machine Foundation
**Build:** STATE.json schema, new state.cjs module, STATE.md projection, CLI extensions
**Why first:** Every other feature depends on hierarchical state. This is the foundation.
**Modifies:** `src/lib/state.cjs` (major rewrite), `src/bin/rapid-tools.cjs` (new subcommands)
**Risk:** Medium -- backward compat with v1.x STATE.md consumers needs careful handling

### Phase 2: Wave/Job Planning Infrastructure
**Build:** WAVES.json schema, plan.cjs extensions, job directory structure, dag.cjs extension
**Why second:** Execution depends on having wave/job plans to execute.
**Modifies:** `src/lib/plan.cjs` (extension), `src/lib/dag.cjs` (extension)
**Creates:** `agents/wave-planner/AGENT.md`, `agents/job-planner/AGENT.md`

### Phase 3: /set-init Command
**Build:** set-init skill and command, worktree creation + wave planning trigger
**Why third:** Depends on state machine (Phase 1) and wave planning (Phase 2).
**Creates:** `skills/set-init/SKILL.md`, `commands/set-init.md`

### Phase 4: Enhanced Execute Skill
**Build:** Job-level execution dispatch, job-level pause/resume, per-job commit tracking
**Why fourth:** Depends on wave/job structure (Phase 2) and set-init (Phase 3).
**Modifies:** `skills/execute/SKILL.md` (major rewrite), `src/lib/execute.cjs` (extension)

### Phase 5: Review Module
**Build:** review.cjs, all 6 review agents, review/uat/unit-test/bug-hunt skills and commands
**Why fifth:** Additive -- can be built independently once state machine exists. Does not block execution.
**Creates:** `src/lib/review.cjs`, `agents/{hunter,devils-advocate,judge,unit-test,uat,bugfix}/AGENT.md`, `skills/{review,uat,unit-test,bug-hunt}/SKILL.md`, `commands/{review,uat,unit-test,bug-hunt}.md`

### Phase 6: Enhanced Merger
**Build:** 5-level conflict detection, tiered resolution, integration branch, bisection, merge skill rewrite
**Why sixth:** Depends on review module (Phase 5) for review gate. Most complex adaptation.
**Modifies:** `src/lib/merge.cjs` (major enhancement), `skills/merge/SKILL.md` (rewrite)

### Phase 7: /init Overhaul and Polish
**Build:** Enhanced /init with integrated roadmap creation, overhauled greenfield/brownfield flow
**Why last:** Existing /init works. Core workflow matters more.
**Modifies:** `skills/init/SKILL.md`, `src/lib/init.cjs`

### Dependency Graph

```
[Phase 1: State Machine] ----+
                              |
[Phase 2: Wave/Job Planning] -+---> [Phase 3: /set-init] ---> [Phase 4: Execute]
                              |
                              +---> [Phase 5: Review Module] ---> [Phase 6: Merger]
                              |
                              +---> [Phase 7: /init Overhaul]
```

Phases 4 and 5 can run in parallel after Phase 3 completes.
Phase 7 can run in parallel with Phases 4-6.

## Scalability Considerations

| Concern | 1 developer | 3 developers | 10+ developers |
|---------|------------|--------------|----------------|
| State contention | No issue | Lock timeout rare | Consider lock queue or partitioned state |
| STATE.json size | Trivial (<10KB) | Small (<50KB) | Could grow with many jobs -- archive completed milestones |
| Worktree count | 1-3 | 3-9 | 10-30 -- git worktree scales well but disk space matters |
| Agent spawning | Sequential fine | Parallel within waves | Rate limiting likely -- need exponential backoff |
| Review pipeline | Full run each time | Per-set independent | Per-set independent -- scales linearly |
| Merge complexity | Simple merges | Some conflicts | 5-level detection + bisection becomes essential |

## Sources

- Existing RAPID codebase at `/home/kek/Projects/RAPID/` (HIGH confidence -- direct code analysis)
- gsd_merge_agent reference at `/home/kek/Projects/RAPID/mark2-plans/gsd_merge_agent/` (HIGH confidence -- direct code analysis)
- Review module specs at `/home/kek/Projects/RAPID/mark2-plans/review-module/` (HIGH confidence -- user-provided specs)
- Mark II design doc at `/home/kek/Projects/RAPID/mark2-plans/mark2.md` (HIGH confidence -- user-provided design)
- Claude Code subagent limitation (no nested spawning) from existing skill patterns (HIGH confidence -- observed in codebase)
