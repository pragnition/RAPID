# Architecture Patterns: v3.0 Refresh Integration

**Domain:** Claude Code plugin orchestration layer rewrite
**Researched:** 2026-03-12
**Overall confidence:** HIGH -- analysis based on full codebase review of 32 agents, 21 libraries, 17 skills, and the refresh.md spec

## Recommended Architecture

The v3.0 refresh is a surgical rewrite of RAPID's orchestration layer. The core insight is that the current 4-level hierarchy (project > milestone > set > wave > job) has excessive state tracking granularity. Agents are autonomous enough that wave-level and job-level state management creates overhead without proportional value. The refresh collapses the planning pipeline while preserving the proven review and merge systems.

### Current Architecture (v2.2)

```
Plugin Root
  |-- .claude-plugin/plugin.json          (plugin manifest)
  |-- agents/                             (32 generated .md files)
  |-- skills/                             (17 SKILL.md directories)
  |-- commands/                           (6 command .md files)
  |-- src/
  |   |-- bin/rapid-tools.cjs             (105KB CLI backbone)
  |   |-- lib/                            (21 library modules + tests)
  |   |-- modules/
  |   |   |-- core/                       (5 shared prompt modules)
  |   |   |-- roles/                      (32 role-specific modules)
  |   |-- hooks/                          (1 task-completed hook)
  |-- .planning/
      |-- STATE.json                      (hierarchical state machine)
      |-- ROADMAP.md, PROJECT.md, etc.    (planning artifacts)
      |-- sets/{setId}/                   (CONTRACT.json, DEFINITION.md, etc.)
      |-- waves/{setId}/{waveId}/         (WAVE-CONTEXT.md, WAVE-PLAN.md, *-PLAN.md)
```

### Target Architecture (v3.0)

```
Plugin Root
  |-- .claude-plugin/plugin.json          (version bumped to 3.0.0)
  |-- agents/                             (reduced: ~18-22 agents)
  |   |-- rapid-orchestrator.md           (HAND-WRITTEN, core)
  |   |-- rapid-planner.md                (HAND-WRITTEN, core)
  |   |-- rapid-executor.md               (HAND-WRITTEN, core)
  |   |-- rapid-merger.md                 (HAND-WRITTEN, core)
  |   |-- rapid-reviewer.md               (HAND-WRITTEN, core)
  |   |-- rapid-*.md                      (GENERATED, support roles)
  |-- skills/                             (reduced: ~12-14 skills)
  |   |-- init/SKILL.md                   (REWRITTEN, +6th researcher)
  |   |-- start-set/SKILL.md              (RENAMED from set-init)
  |   |-- discuss-set/SKILL.md            (REWRITTEN, set-scoped)
  |   |-- plan-set/SKILL.md               (REWRITTEN, collapsed pipeline)
  |   |-- execute-set/SKILL.md            (REWRITTEN, no job-level state)
  |   |-- review/SKILL.md                 (PRESERVED, minor updates)
  |   |-- merge/SKILL.md                  (PRESERVED, minor updates)
  |   |-- status/SKILL.md                 (REWRITTEN, simplified)
  |   |-- install/SKILL.md                (PRESERVED)
  |   |-- quick/SKILL.md                  (NEW)
  |   |-- add-set/SKILL.md                (NEW)
  |   |-- new-version/SKILL.md            (REWRITTEN)
  |-- commands/                            (updated references)
  |-- src/
  |   |-- bin/rapid-tools.cjs             (MODIFIED, commands pruned)
  |   |-- lib/
  |   |   |-- state-machine.cjs           (MODIFIED, wave/job tracking removed)
  |   |   |-- state-schemas.cjs           (MODIFIED, simplified schema)
  |   |   |-- state-transitions.cjs       (MODIFIED, set-only transitions)
  |   |   |-- tool-docs.cjs              (NEW, YAML tool doc registry)
  |   |   |-- plan.cjs                    (MODIFIED, collapsed pipeline)
  |   |   |-- execute.cjs                 (MODIFIED, wave-based dispatch)
  |   |   |-- review.cjs                  (PRESERVED)
  |   |   |-- merge.cjs                   (PRESERVED)
  |   |   |-- lock.cjs                    (REMOVED or minimized)
  |   |   |-- wave-planning.cjs           (MODIFIED, simplified)
  |   |   |-- contract.cjs               (MODIFIED, lighter contracts)
  |   |   |-- ...rest                     (PRESERVED)
  |   |-- modules/
  |   |   |-- core/                       (MODIFIED, +tool-docs module)
  |   |   |-- roles/                      (REDUCED, several retired)
  |   |-- hooks/                          (PRESERVED)
  |-- .planning/
      |-- STATE.json                      (simplified: sets only)
      |-- sets/{setId}/
      |   |-- CONTRACT.json               (lighter interface contracts)
      |   |-- CONTEXT.md                  (set-scoped, replaces per-wave)
      |   |-- RESEARCH.md                 (set-scoped)
      |   |-- waves/
      |       |-- wave-1/PLAN.md          (output of collapsed plan-set)
      |       |-- wave-2/PLAN.md
```

---

## Integration Analysis: What Changes, What Stays, What's New

### Component 1: Simplified State Machine

**Status:** MODIFY three existing files

**Current state hierarchy:**
```
ProjectState > MilestoneState > SetState > WaveState > JobState
  - SetStatus:  pending | planning | executing | reviewing | merging | complete
  - WaveStatus: pending | discussing | planning | executing | reconciling | complete | failed
  - JobStatus:  pending | executing | complete | failed
```

**Target state hierarchy:**
```
ProjectState > MilestoneState > SetState
  - SetStatus: pending | discussing | planning | executing | reviewing | merging | complete
```

Wave metadata (wave count, wave names) can be stored as a simple array of strings or an integer on SetState for informational purposes, but without individual status tracking.

**Files to modify:**

1. **`src/lib/state-schemas.cjs`** -- Remove `JobState`, `WaveState`, `JobStatus`, `WaveStatus` Zod schemas. Add `discussing` to `SetStatus` enum. Remove `waves` array from `SetState`. Optionally add `waveCount: z.number().optional()` for display purposes.

2. **`src/lib/state-transitions.cjs`** -- Remove `WAVE_TRANSITIONS`, `JOB_TRANSITIONS`. Remove entries from `ENTITY_MAPS`. Update `SET_TRANSITIONS` to include new `discussing` state:
   ```javascript
   const SET_TRANSITIONS = {
     pending: ['discussing'],
     discussing: ['planning'],
     planning: ['executing'],
     executing: ['reviewing'],
     reviewing: ['merging'],
     merging: ['complete'],
     complete: [],
   };
   ```

3. **`src/lib/state-machine.cjs`** -- Remove `transitionJob()`, `transitionWave()`, `findJob()`, `findWave()`, `deriveWaveStatus()`, `deriveSetStatus()`, `isDerivedStatusValid()`, all ordinal maps. Remove `acquireLock` import and lock acquisition inside `transitionSet()`. Keep atomic write (write-to-tmp + rename) without locks.

4. **`src/bin/rapid-tools.cjs`** -- Remove CLI subcommands: `state get wave`, `state get job`, `state transition wave`, `state transition job`. Remove `wave-plan list-jobs`, `wave-plan validate-contracts`, `wave-plan create-wave-dir` (or keep `create-wave-dir` adapted for new path structure). Remove `execute job-status`, `execute reconcile-jobs`.

**What stays untouched:** `readState()`, `writeState()`, `createInitialState()`, `findMilestone()`, `findSet()`, `addMilestone()`, `detectCorruption()`, `recoverFromGit()`, `commitState()`.

**Risk:** HIGH -- this is a breaking change to every agent and skill that references wave/job state. Must be done as a clean break, not incrementally.

### Component 2: Collapsed Planning Pipeline

**Status:** REWRITE skill, MODIFY libraries

**Current pipeline per set (plan-set/SKILL.md, ~600 lines):**
```
/discuss (per wave) -> /plan-set:
  wave-analyzer -> [batch ordering]
    per-wave: researcher -> wave-planner -> job-planner(N) -> verifier -> contract-validator
  -> commit artifacts
```

For a 3-wave set with 3 jobs each: wave-analyzer (1) + 3 waves * (researcher + wave-planner + 3 job-planners + verifier) = 1 + 3*(1+1+3+1) = 19 agent spawns.

**Target pipeline per set:**
```
/discuss-set -> /plan-set:
  set-researcher (1) -> plan-set-agent (1) -> [optional verifier (1)]
  -> write per-wave PLAN.md files
  -> commit artifacts
```

Total: 2-3 agent spawns per set.

**New artifact structure:**
```
.planning/sets/{setId}/
  CONTEXT.md           (from discuss-set)
  RESEARCH.md          (from plan-set researcher)
  waves/
    wave-1/PLAN.md     (from plan-set planner)
    wave-2/PLAN.md
    wave-3/PLAN.md
```

Each PLAN.md is a self-contained implementation specification. It replaces the hierarchy of WAVE-PLAN.md + multiple JOB-PLAN.md files. The plan-set agent decides how to decompose into waves and writes each PLAN.md with enough detail that an executor can implement without interpretation.

**Integration points:**

1. **`skills/plan-set/SKILL.md`** -- Full rewrite. Remove the 10-step batched pipeline. Replace with: (a) read CONTEXT.md, (b) spawn researcher, (c) spawn single planner agent with CONTEXT.md + RESEARCH.md, (d) optional verifier, (e) commit. Smart re-entry logic: check which waves already have PLAN.md files and skip them.

2. **`skills/discuss-set/SKILL.md`** -- Rename from `skills/discuss/SKILL.md`. Change from wave-scoped to set-scoped discussion. Remove wave resolution (no more dot notation like `1.1`). Produce `.planning/sets/{setId}/CONTEXT.md` instead of `.planning/waves/{setId}/{waveId}/WAVE-CONTEXT.md`. State transition: `set pending -> discussing`.

3. **`src/lib/wave-planning.cjs`** -- Simplify `createWaveDir()` for new path structure (`.planning/sets/{setId}/waves/{waveId}/`). Remove `writeWaveContext()` (replaced by set-level CONTEXT.md written by discuss-set skill). Remove `validateJobPlans()` (contract validation simplified to advisory). Keep `resolveWave()` for backward compatibility or remove if no longer needed.

4. **`src/lib/plan.cjs`** -- Keep DAG-based set decomposition during `/init` but remove per-set wave-level decomposition functions. The planner agent handles wave decomposition internally.

**Agents retired:** `rapid-wave-analyzer`, `rapid-wave-researcher`, `rapid-wave-planner`, `rapid-job-planner`, `rapid-job-executor`. Their role modules in `src/modules/roles/` are removed.

**Agents modified:** `rapid-planner` (absorbs wave decomposition responsibility within its prompt), `rapid-plan-verifier` (operates on per-wave PLAN.md files, not JOB-PLAN.md files).

### Component 3: Inline YAML Tool Documentation

**Status:** NEW component, MODIFY build pipeline

**Problem:** Agents currently have no documentation of what `rapid-tools.cjs` commands are available. The `<state-access>` core module lists some commands, but agents frequently guess wrong commands (e.g., trying `wave-plan` which does not exist as a standalone command, or using wrong argument order).

**Solution:** Each agent gets a `<tools>` XML section containing YAML-formatted command specs relevant to that agent's role. Tool docs are injected by the build-agents pipeline.

**Tool doc format (inline in agent prompt):**
```yaml
commands:
  - name: state get --all
    description: Read full STATE.json
    output: "JSON: { version, projectName, currentMilestone, milestones[{ id, name, sets[] }] }"
    example: node "${RAPID_TOOLS}" state get --all

  - name: state transition set
    args: "<milestoneId> <setId> <status>"
    description: Transition a set to a new status
    valid_statuses: [pending, discussing, planning, executing, reviewing, merging, complete]
    output: Silent on success, error message on invalid transition
    example: 'node "${RAPID_TOOLS}" state transition set v3.0 auth-system executing'
```

**Files created:**

1. **`src/lib/tool-docs.cjs`** (NEW) -- Registry of all rapid-tools.cjs commands as structured objects. Two exports:
   - `TOOL_REGISTRY` -- Map of command-key to command spec (name, args, description, output, example, error cases)
   - `getToolDocsForRole(roleName)` -- Returns YAML string of tool docs for a given role
   - `ROLE_TOOL_MAP` -- Map of role name to array of command-keys

2. **`src/modules/core/core-tools.md`** (NEW) -- Template module. The build pipeline replaces a placeholder with the role-specific YAML tool docs at build time. This replaces `core-state-access.md`.

**Files modified:**

3. **`src/bin/rapid-tools.cjs` `handleBuildAgents()`** -- Modify `assembleAgentPrompt()` to add a 4th step: after core modules and before the role module, inject `<tools>` section using `getToolDocsForRole()`. Update `ROLE_CORE_MAP` to reference `core-tools.md` instead of `core-state-access.md`.

4. **Per-role modules** -- Remove inline CLI command examples from role files. They move to the centralized tool-docs registry.

**Files retired:**
- `src/modules/core/core-state-access.md` (replaced by `core-tools.md`)

### Component 4: XML Prompt Format Standardization

**Status:** MODIFY all core and role modules

**Current format:** Already uses XML tags (`<identity>`, `<returns>`, `<state-access>`, `<git>`, `<context-loading>`, `<role>`). Content within tags is inconsistent.

**Target XML structure (every agent):**
```xml
<identity>           WHO: agent identity, project context, working directory
<returns>            HOW TO REPORT: structured return protocol
<tools>              WHAT CLI COMMANDS: inline YAML tool docs (NEW)
<conventions>        GIT + CODE STYLE: commit format, file ownership
<role>               WHAT TO DO: role-specific instructions
```

**Integration points:**

1. **`core-identity.md`** -- Update workflow sequence from v2.2 (wave-plan/job-plan) to v3.0 (discuss-set/plan-set/execute-set). Merge `core-context-loading.md` content into identity (progressive context loading is universal guidance, not a separate concern). Remove wave/job references.

2. **`core-returns.md`** -- Keep as-is. The structured return protocol is proven and unchanged.

3. **`core-state-access.md`** -- REPLACE with `core-tools.md` (Component 3). The current state-access module is a subset of what agents need.

4. **`core-git.md`** -- Merge into a new `core-conventions.md` that covers git commit format AND code style guidance. This is a consolidation, not a content change.

5. **`core-context-loading.md`** -- Merge into `core-identity.md`. Currently only used by 10 of 32 roles. The guidance is universal enough to include in identity.

6. **Build pipeline** -- Update `ROLE_CORE_MAP` to reference new module names: `core-identity.md`, `core-returns.md`, `core-tools.md`, `core-conventions.md`.

### Component 5: Hybrid Agent Build

**Status:** MODIFY build pipeline, NEW hand-written agent files

**Current:** All 32 agents generated by `handleBuildAgents()`. Every agent assembled from core modules + role module.

**Target:** 5 core agents hand-written, ~15-17 support agents generated.

**Hand-written agents (authored directly in `agents/`, NOT generated):**
- `rapid-orchestrator.md` -- Most complex agent, needs precise control flow
- `rapid-planner.md` -- Core planning logic, needs careful prompt engineering
- `rapid-executor.md` -- Execution orchestration, rate-limit handling
- `rapid-merger.md` -- Critical path, needs precise merge protocol
- `rapid-reviewer.md` -- Review pipeline coordination

**Generated agents (built from `src/modules/`):**
- Research agents: stack, features, architecture, pitfalls, oversights, domain-ux (NEW), synthesizer
- Support agents: bugfix, bug-hunter, devils-advocate, judge, unit-tester, uat
- Utility agents: codebase-synthesizer, context-generator, scoper, roadmapper
- Merge support: set-merger, conflict-resolver

**Integration points:**

1. **`handleBuildAgents()`** -- Add a skip list. Before writing to `agents/rapid-{role}.md`, check if the file exists and does NOT contain the `<!-- GENERATED by build-agents -->` comment header. If so, skip it (it is hand-written). This makes hand-written agents invisible to the build pipeline.

2. **Hand-written agents** follow the same XML structure but can have additional sections, more nuanced instructions, and agent-specific tool docs embedded directly rather than template-injected.

3. **`ROLE_CORE_MAP`** -- Remove entries for hand-written roles (orchestrator, planner, executor, merger, reviewer). These agents manage their own content.

### Component 6: Interface Contracts Without Gating

**Status:** MODIFY `contract.cjs`, `plan.cjs`, `dag.cjs`

**Current:** Contracts include full JSON Schema exports/imports/behavioral with cross-set validation. Sets are gated via GATES.json and DAG.json -- set Y cannot execute until dependency set X completes.

**Target:** Contracts define interfaces (what each set exposes/consumes) but NO runtime gating. Sets are truly independent. Contracts serve as documentation for planning and verification targets for merge, not execution barriers.

**What changes:**
1. Remove GATES.json generation and enforcement
2. Remove DAG.json ordering enforcement during execution (keep for merge ordering)
3. Keep CONTRACT.json as lightweight interface documentation
4. Keep contract validation during planning as advisory (warnings, not blockers)
5. Contract stubs generated during `/start-set` remain (enable parallel coding against interfaces)

**What stays:** The contract data structure (exports/imports/behavioral) is sound. The planner still produces contracts. The merge pipeline still validates contract compliance for integration quality.

### Component 7: Discuss-Set (Set-Scoped Discussion)

**Status:** REWRITE skill

**Current:** Wave-scoped. User runs `/discuss 1.1` (set 1 wave 1), produces `WAVE-CONTEXT.md` per wave.

**Target:** Set-scoped. User runs `/discuss-set 1`, discusses vision for entire set, produces single `CONTEXT.md`. The planner decides wave decomposition later.

**Integration points:**
1. Remove wave resolution (no dot notation)
2. Write `.planning/sets/{setId}/CONTEXT.md`
3. State transition: `set pending -> discussing` (new transition)
4. The `--skip` flag generates CONTEXT.md autonomously
5. Discussion covers the ENTIRE set vision, not per-wave details

### Component 8: 6th Researcher (Domain/UX)

**Status:** NEW agent, MODIFY init skill

**Integration points:**
1. Create `src/modules/roles/role-domain-researcher.md`
2. Add `domain-researcher` to `ROLE_CORE_MAP`, `ROLE_TOOLS`, `ROLE_DESCRIPTIONS`, `ROLE_COLORS`
3. Modify `init/SKILL.md` Step 7: spawn 6 researchers (stack, features, architecture, pitfalls, oversights, domain-ux)
4. Modify `init/SKILL.md` Step 8: include `.planning/research/DOMAIN.md` in synthesizer inputs

---

## Patterns to Follow

### Pattern 1: Skill-as-Orchestrator (Existing, Reinforced)

**What:** Skills dispatch agents; agents do NOT dispatch sub-agents. The skill file IS the orchestrator for its command.

**When:** Every `/rapid:*` command invocation.

**Why reinforced:** Claude Code does not support sub-sub-agent spawning. The plan-set collapse simplifies this -- fewer agent spawns per skill invocation means less complexity in the orchestration layer.

```
SKILL.md (orchestrator)
  |-- spawn Agent 1 (does work, returns RAPID:RETURN)
  |-- parse return, extract structured data
  |-- spawn Agent 2 (does work, returns RAPID:RETURN)
  |-- parse return
  |-- transition state via CLI
  |-- commit artifacts
```

### Pattern 2: Tool Docs as Agent DNA (New)

**What:** Every agent knows exactly which CLI commands it can run, with exact syntax and expected output format, because the tool docs are embedded in its prompt.

**When:** Every agent that calls `rapid-tools.cjs`.

**Why:** The number one agent failure mode in v2.x is guessing CLI commands. Agents invent commands like `wave-plan` or `job-plan` that do not exist. Inline tool docs make the available command surface explicit and unambiguous.

### Pattern 3: Plan-as-Specification (Existing, Simplified)

**What:** PLAN.md files are complete implementation specifications that executors follow without interpretation. Each PLAN.md includes: file list to modify, implementation steps with code patterns, verification commands, done conditions.

**Simplified from:** Multiple JOB-PLAN.md files per wave to a single PLAN.md per wave. The plan is still a spec, but it is one document, not a scatter of files.

### Pattern 4: State-as-Bookmark (New, Replaces State-Driven Orchestration)

**What:** STATE.json records where the project IS (which set, which phase). It does NOT drive control flow. Skills check set status on entry to determine where to resume, and update it on exit to record progress.

**Replaces:** The current approach where wave/job status transitions drive execution flow, derived statuses propagate upward, and the state machine enforces valid transitions at every level.

**Why:** Users `/clear` between commands. Each command invocation starts from a clean context. State only needs to answer: "what command should I run next?" -- which only requires set-level status.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Fine-Grained State Tracking

**What:** Tracking status at wave and job granularity (current v2.x with WaveState and JobState).

**Why bad:** Creates 500+ line STATE.json files for large projects. Every state change requires validation, derivation, and lock acquisition. The state-machine.cjs alone is 460 lines of complexity that exists solely to manage hierarchical status.

**Instead:** Track only set status. Execution progress within a set is managed by the executor agent using planning artifacts (which PLAN.md files have been implemented), not by the state machine.

### Anti-Pattern 2: Agent Prompt Bloat

**What:** Agent prompts that embed the entire workflow spec. Current sizes: orchestrator 13.6KB, planner 22.5KB, plan-verifier 15.7KB.

**Why bad:** Wastes context budget. Core modules alone add 5-10KB to every agent before it receives any task-specific context.

**Instead:** Hand-written core agents get lean, focused prompts with only the instructions they need. Inline tool docs replace verbose CLI command listings. Target: core agents under 8KB, generated agents under 12KB.

### Anti-Pattern 3: Lock Files for State Protection

**What:** Using filesystem locks (`lock.cjs`, mkdir-based) to protect STATE.json during concurrent writes.

**Why bad:** Adds complexity for a problem v3.0 eliminates. With sets-only tracking and no derived status propagation, concurrent STATE.json writes are rare and low-risk.

**Instead:** Atomic write (write-to-tmp + rename) without locks. If two agents race on STATE.json, last write wins -- acceptable for bookmark-level state.

### Anti-Pattern 4: Gating Between Independent Sets

**What:** Preventing set Y from executing until set X completes via GATES.json.

**Why bad:** Defeats the core RAPID promise that sets are parallelizable and independent.

**Instead:** Contracts define interfaces. Sets execute independently. The merge pipeline catches integration issues. Dependencies that are truly blocking should cause the planner to put that work in the same set.

---

## Data Flow Changes

### Current Data Flow (v2.2)

```
/init -> PROJECT.md, ROADMAP.md, STATE.json (sets > waves > jobs)
  |
/set-init -> worktree, CONTRACT.json, SET-OVERVIEW.md
  |
/discuss (per wave) -> WAVE-CONTEXT.md (per wave)
  |
/plan-set (per set) ->
  wave-analyzer -> batch ordering
  per-wave: researcher -> WAVE-RESEARCH.md
            wave-planner -> WAVE-PLAN.md
            job-planner(s) -> JOB-PLAN.md (per job)
            verifier -> VERIFICATION-REPORT.md
            contract-validator -> inline
  |
/execute (per set) ->
  per-wave sequential:
    per-job parallel: job-executor -> commits, state transitions
    reconcile -> RECONCILIATION-REPORT
    lean-review -> REVIEW-ISSUES.json
  |
/review -> unit-test, bug-hunt, UAT pipeline
  |
/merge -> 5-level detection, 4-tier resolution, integration gate
```

### Target Data Flow (v3.0)

```
/init -> PROJECT.md, ROADMAP.md, STATE.json (sets only)
  |
/start-set -> worktree, CONTRACT.json (lighter)
  |
/discuss-set -> CONTEXT.md (set-scoped, one file)
  |
/plan-set ->
  set-researcher -> RESEARCH.md
  plan-set-agent -> wave-1/PLAN.md, wave-2/PLAN.md, ...
  [optional verifier]
  |
/execute-set ->
  per-wave sequential:
    executor-agent(s) -> commits
    [optional lean-review]
  |
/review -> unit-test, bug-hunt, UAT pipeline (PRESERVED)
  |
/merge -> 5-level detection, 4-tier resolution, integration gate (PRESERVED)
```

### Key Artifact Changes

| v2.2 Artifact | v3.0 Artifact | Change |
|---------------|---------------|--------|
| `WAVE-CONTEXT.md` (per wave) | `CONTEXT.md` (per set) | Scope broadened from wave to set |
| `WAVE-RESEARCH.md` (per wave) | `RESEARCH.md` (per set) | Scope broadened from wave to set |
| `WAVE-PLAN.md` + `*-PLAN.md` | `PLAN.md` (per wave) | Collapsed into single file per wave |
| `STATE.json` with waves[] and jobs[] | `STATE.json` with sets only | Dramatically simplified |
| `GATES.json`, `DAG.json` | Removed (or DAG.json kept for merge ordering only) | No execution gating |
| `OWNERSHIP.json` | Kept (optional, advisory) | Lighter usage |
| `VERIFICATION-REPORT.md` per wave | Optional single verification | Lighter, not per-wave |
| `RECONCILIATION-REPORT` per wave | Removed | Executor self-validates |
| `.planning/waves/{set}/{wave}/` | `.planning/sets/{set}/waves/{wave}/` | Path restructured under sets/ |

---

## Suggested Build Order

The v3.0 refresh should be built in this order. Each phase produces a testable intermediate state and minimizes dependencies on unfinished work.

### Phase 1: State Machine Simplification

**Rationale for first:** Everything downstream depends on the state schema. The simplified schema is the foundation for all other changes. Changing it later would require re-touching every component.

**Scope:**
- Strip wave/job tracking from `state-schemas.cjs`, `state-transitions.cjs`, `state-machine.cjs`
- Add `discussing` to set status enum and transitions
- Remove lock dependency from state writes
- Update all unit tests (6 test files affected)

**Files modified:**
- `src/lib/state-schemas.cjs`
- `src/lib/state-transitions.cjs`
- `src/lib/state-machine.cjs`
- `src/lib/state-schemas.test.cjs`
- `src/lib/state-transitions.test.cjs`
- `src/lib/state-machine.test.cjs`
- `src/lib/state-machine.lifecycle.test.cjs`

**Deliverable:** Simplified state machine passes all new tests. Old wave/job tests removed.

### Phase 2: Tool Docs Registry and Core Module Refactor

**Rationale for second:** The tool docs registry must exist before rewriting agents or skills, because agents will reference tool docs. Core module refactoring (merging git+context-loading, replacing state-access) must happen before the build pipeline update.

**Scope:**
- Create `tool-docs.cjs` with command registry and per-role query function
- Create `core-tools.md` template module (replaces `core-state-access.md`)
- Create `core-conventions.md` (merges `core-git.md` + code style)
- Merge `core-context-loading.md` into `core-identity.md`
- Update `core-identity.md` workflow sequence for v3.0

**Files created:**
- `src/lib/tool-docs.cjs`
- `src/lib/tool-docs.test.cjs`
- `src/modules/core/core-tools.md`
- `src/modules/core/core-conventions.md`

**Files modified:**
- `src/modules/core/core-identity.md`

**Files retired:**
- `src/modules/core/core-state-access.md`
- `src/modules/core/core-git.md`
- `src/modules/core/core-context-loading.md`

### Phase 3: CLI Command Surface Update

**Rationale for third:** The CLI surface must be finalized before tool docs can be populated with accurate command specs, and before agents reference specific commands.

**Scope:**
- Remove wave/job CLI subcommands from `rapid-tools.cjs`
- Update help text for all remaining commands
- Prune unused library functions from CLI routing
- Adapt path-related commands for new artifact structure (`.planning/sets/{set}/waves/` instead of `.planning/waves/{set}/`)

**Files modified:**
- `src/bin/rapid-tools.cjs`
- `src/bin/rapid-tools.test.cjs`

**Deliverable:** CLI help text shows only v3.0 commands. All removed commands return clear deprecation errors.

### Phase 4: Build Pipeline + Generated Agent Updates

**Rationale for fourth:** The build pipeline produces agents. It must be updated before any agent can be rebuilt. Generated agents update here; hand-written agents come in Phase 5.

**Scope:**
- Update `handleBuildAgents()` to inject `<tools>` section from tool-docs.cjs
- Update `ROLE_CORE_MAP` with new core modules
- Add skip-list logic for hand-written agents
- Add domain/UX researcher role module
- Update all generated role modules to remove wave/job references
- Retire role modules for deleted agents (wave-analyzer, wave-researcher, wave-planner, job-planner, job-executor)
- Run build-agents to regenerate all generated agents

**Files modified:**
- `src/bin/rapid-tools.cjs` (`handleBuildAgents`, `ROLE_CORE_MAP`, `ROLE_TOOLS`, etc.)
- `src/lib/build-agents.test.cjs`
- All `src/modules/roles/role-*.md` for surviving generated agents

**Files created:**
- `src/modules/roles/role-domain-researcher.md`

**Files retired:**
- `src/modules/roles/role-wave-analyzer.md`
- `src/modules/roles/role-wave-researcher.md`
- `src/modules/roles/role-wave-planner.md`
- `src/modules/roles/role-job-planner.md`
- `src/modules/roles/role-job-executor.md`

### Phase 5: Core Agent Rewrites (Hand-Written)

**Rationale for fifth:** Core agents define how users experience v3.0. They depend on finalized state schema (Phase 1), tool docs (Phase 2), CLI surface (Phase 3), and the build pipeline skip-list (Phase 4).

**Scope:**
- Write `agents/rapid-orchestrator.md` from scratch (hand-written, no `<!-- GENERATED -->` header)
- Write `agents/rapid-planner.md` from scratch (absorbs wave decomposition)
- Write `agents/rapid-executor.md` from scratch (wave-based, no job-level tracking)
- Write `agents/rapid-merger.md` from scratch (preserves merge protocol, adds v2.2 subagent delegation)
- Write `agents/rapid-reviewer.md` from scratch (preserves review pipeline)

**Files created/rewritten:**
- `agents/rapid-orchestrator.md`
- `agents/rapid-planner.md`
- `agents/rapid-executor.md`
- `agents/rapid-merger.md`
- `agents/rapid-reviewer.md`

**Files retired (replaced by hand-written versions):**
- `src/modules/roles/role-orchestrator.md`
- `src/modules/roles/role-planner.md`
- `src/modules/roles/role-executor.md`
- `src/modules/roles/role-merger.md`
- `src/modules/roles/role-reviewer.md`

### Phase 6: Skill Rewrites

**Rationale for last functional phase:** Skills wire agents, state, and CLI together. They must be written after all underlying components are finalized.

**Skills rewritten (7):**
- `skills/discuss-set/SKILL.md` -- Set-scoped discussion, produces CONTEXT.md
- `skills/plan-set/SKILL.md` -- Collapsed pipeline: researcher + planner + optional verifier
- `skills/execute-set/SKILL.md` -- Wave-based execution, no job-level state
- `skills/start-set/SKILL.md` -- Renamed from set-init, updated paths
- `skills/init/SKILL.md` -- 6 researchers, updated state creation
- `skills/status/SKILL.md` -- Simplified display (sets only)
- `skills/new-version/SKILL.md` -- Updated for simplified state

**Skills created (2):**
- `skills/quick/SKILL.md` -- Quick fixes/changes outside set workflow
- `skills/add-set/SKILL.md` -- Add set to existing milestone after initial planning

**Skills preserved (4, minor updates only):**
- `skills/review/SKILL.md` -- Update state references, keep pipeline intact
- `skills/merge/SKILL.md` -- Update state references, keep pipeline intact
- `skills/install/SKILL.md` -- No changes needed
- `skills/help/SKILL.md` -- Update command list

**Skills retired:**
- `skills/discuss/SKILL.md` (replaced by discuss-set)
- `skills/wave-plan/SKILL.md` (absorbed into plan-set)
- `skills/execute/SKILL.md` (replaced by execute-set)
- `skills/set-init/SKILL.md` (replaced by start-set)
- `skills/plan/SKILL.md` (if still exists, absorbed into init roadmapper)
- `skills/context/SKILL.md` (if kept, minor update only)
- `skills/assumptions/SKILL.md` (evaluate if still needed)
- `skills/pause/SKILL.md`, `skills/resume/SKILL.md` (evaluate if still needed)
- `skills/cleanup/SKILL.md` (evaluate if still needed)

### Phase 7: Documentation, Contracts, and Cleanup

**Rationale for last:** Polish phase. Everything functional is done. This phase updates documentation, simplifies contracts, removes dead code, and bumps the version.

**Scope:**
- Simplify CONTRACT.json structure (remove GATES.json generation)
- Remove or minimize `lock.cjs`
- Remove unused libraries and test files
- Rewrite `DOCS.md` for v3.0 command surface
- Update `README.md`
- Update `commands/*.md` reference files
- Bump `.claude-plugin/plugin.json` version to 3.0.0
- Update `setup.sh` if needed

---

## Scalability Considerations

| Concern | v2.2 Current | v3.0 Target |
|---------|--------------|-------------|
| STATE.json size | 500+ lines (waves * jobs) | ~50-100 lines (sets only) |
| Agent spawns per plan-set | 5-20 per invocation | 2-4 per invocation |
| Context budget per agent | 10-20KB prompt + task | 5-10KB prompt + task |
| Planning artifact count | 3-10 files per wave | 1 file per wave |
| Lock contention risk | Real with parallel worktrees | Eliminated |
| State corruption risk | Real with concurrent transitions | Minimal with atomic writes |
| Time to plan a set | Minutes (sequential agent cascade) | Seconds-to-minute (2-3 spawns) |

---

## Sources

- Full codebase analysis of RAPID v2.2.0 (32 agents, 21 libraries, 17 skills, 105KB CLI)
- `refresh/refresh.md` -- v3.0 design spec authored by project owner
- `.planning/PROJECT.md` -- project context, requirements, and key decisions
- `.planning/research/DEEP-ANALYSIS.md` -- prior architecture analysis of GSD and PAUL patterns
- `src/lib/state-machine.cjs`, `state-schemas.cjs`, `state-transitions.cjs` -- current state management (460+ lines)
- `src/bin/rapid-tools.cjs` -- CLI backbone and build-agents pipeline (105KB)
- `skills/plan-set/SKILL.md` (600 lines), `skills/execute/SKILL.md`, `skills/discuss/SKILL.md`, `skills/init/SKILL.md` -- current skill implementations
- `agents/rapid-orchestrator.md`, `agents/rapid-planner.md` -- current agent prompts
- `src/modules/core/*` and `src/modules/roles/*` -- build pipeline source modules
- Confidence: HIGH -- all findings based on direct codebase inspection
