# RAPID - Plugin Documentation

RAPID (Rapid Agentic Parallelizable and Isolatable Development) enables team-based parallel development for Claude Code. It decomposes project work into a hierarchical structure of Sets, Waves, and Jobs that execute simultaneously in isolated git worktrees, connected by machine-verifiable interface contracts and validated through an adversarial review pipeline. Multiple developers work on the same project without blocking each other, with confidence their independent work merges cleanly through 5-level conflict detection and 4-tier resolution.

**Version:** 1.0.0

## Installation

### Method 1: Plugin Marketplace (Primary)

```
claude plugin add fishjojo1/RAPID
```

Then run `/rapid:install` from within Claude Code to complete setup. This configures the `RAPID_TOOLS` environment variable needed by all RAPID commands.

### Method 2: Git Clone

```bash
git clone https://github.com/fishjojo1/RAPID.git
cd RAPID
./setup.sh
```

The `setup.sh` script installs dependencies and configures the `RAPID_TOOLS` environment variable automatically.

### Requirements

- **Node.js 18+** (runtime for tool libraries)
- **git 2.30+** (required for worktree support)
- **RAPID_TOOLS env var** must be set (both installation methods handle this automatically)
- **jq 1.6+** (optional, for JSON processing utilities)
- npm dependencies are bundled in `node_modules/`

## Quick Start

A typical RAPID Mark II workflow follows these stages:

1. **`/rapid:install`** -- One-time setup: install plugin, configure shell, create .env
2. **`/rapid:init`** -- Research, roadmap generation, model/team selection, scaffold `.planning/` directory
3. **`/rapid:context`** -- Analyze existing codebase to generate style guides and conventions (skip for greenfield)
4. **`/rapid:plan`** -- Decompose work into parallel sets with interface contracts, dependency DAG, and file ownership

Then for each set (in parallel across developers):

5. **`/rapid:set-init`** -- Create worktree, scoped CLAUDE.md, and set overview
6. **`/rapid:discuss`** -- Capture implementation vision for the current wave
7. **`/rapid:wave-plan`** -- Research, produce wave plan, per-job plans, and validate contracts
8. **`/rapid:execute`** -- Run jobs in parallel (subagents or agent teams), reconcile per wave
9. **`/rapid:review`** -- Unit test + adversarial bug hunt + UAT pipeline

After sets complete:

10. **`/rapid:merge`** -- 5-level conflict detection, 4-tier resolution, DAG-ordered merge with integration gates
11. **`/rapid:cleanup`** -- Remove completed worktrees and optionally delete branches

Start next cycle:

12. **`/rapid:new-milestone`** -- Archive current milestone, bump version, re-plan new scope

## Available Commands

### Setup Commands

#### /rapid:install

**Install and configure RAPID plugin for Claude Code.**

What it does:
- Detects the RAPID installation directory (marketplace or git clone)
- Runs `setup.sh` to handle prerequisites, npm install, validation, and `.env` writing
- Detects user's shell (bash, zsh, fish) and presents config file options for persisting `RAPID_TOOLS`
- Writes the `RAPID_TOOLS` export to the chosen shell config and auto-sources it
- Verifies the full tool chain with `prereqs` check
- Offers post-install next actions: run `/rapid:help` or `/rapid:init`

Usage:
```
/rapid:install
```

No arguments. Interactive setup via AskUserQuestion at every decision point.

---

#### /rapid:init

**Initialize a new RAPID project with deep discovery, parallel research, and roadmap generation.**

What it does:
- Validates prerequisites (git 2.30+, Node.js 18+, optional jq 1.6+) and checks for a git repository
- Detects existing `.planning/` directory and offers reinitialize, upgrade, or cancel
- Gathers project logistics: name, team size (solo/small/medium/large), model selection (opus/sonnet)
- Conducts a deep adaptive discovery conversation (8-15+ probing questions across 10 areas) to understand the project thoroughly
- Scaffolds `.planning/` directory with PROJECT.md, STATE.md, ROADMAP.md, REQUIREMENTS.md, and config.json
- For brownfield projects, spawns a codebase synthesizer subagent for deep analysis
- Spawns 5 parallel research agents (stack, features, architecture, pitfalls, oversights)
- Spawns a research synthesizer to produce SUMMARY.md
- Spawns a roadmapper agent to create a sets/waves/jobs roadmap with contracts
- Presents the roadmap for user approval with Accept/Request changes/Cancel options
- Writes ROADMAP.md, CONTRACT.json files per set, and updates STATE.json

Usage:
```
/rapid:init
```

Subagents spawned: codebase-synthesizer (brownfield), 5 research agents, research-synthesizer, roadmapper.

---

#### /rapid:help

**Show all available RAPID commands and workflow guidance.**

What it does:
- Displays an ASCII workflow diagram showing the full Mark II development lifecycle
- Lists all 17 commands grouped by workflow stage (setup, planning, execution, review, merge, lifecycle)
- Provides a static reference card -- no project-specific analysis
- Shows the typical workflow from install through new-milestone

Usage:
```
/rapid:help
```

Output-only command. No arguments, no project state read, no subagents.

---

#### /rapid:context

**Analyze codebase and generate project context files.**

What it does:
- Runs brownfield detection to identify languages, frameworks, and project structure
- Spawns a context-generation subagent for deep codebase analysis (analysis-only pass)
- Presents analysis results and file generation plan for user confirmation
- Spawns the context-generator again in write mode to produce:
  - `CLAUDE.md` at project root (under 80 lines, lean project context)
  - `CODEBASE.md` in `.planning/context/` (brownfield analysis report)
  - `ARCHITECTURE.md` in `.planning/context/` (architecture patterns)
  - `CONVENTIONS.md` in `.planning/context/` (code conventions)
  - `STYLE_GUIDE.md` in `.planning/context/` (style rules, descriptive tone)
- Context files are automatically loaded into agents during execution for consistency

Usage:
```
/rapid:context
```

Subagents spawned: context-generator (analysis pass), context-generator (write pass). Re-running regenerates all files from scratch.

### Planning Commands

#### /rapid:plan

**Decompose project work into parallelizable sets with interface contracts, dependency graphs, and file ownership.**

What it does:
- Checks for existing sets and offers Re-plan/View current/Cancel if found
- Loads requirements (REQUIREMENTS.md), project overview (PROJECT.md), codebase scan, and architecture/conventions context
- Spawns a planner subagent to analyze requirements and propose a set decomposition
- Each set gets: DEFINITION.md (scope, tasks, acceptance criteria), CONTRACT.json (exports/imports/behavioral), and dependency edges
- Assigns file ownership so every file belongs to exactly one set
- Organizes sets into dependency-ordered waves for parallel execution
- Presents the full proposal with dependency DAG and ownership coverage for developer approval
- On approval, persists all artifacts: set definitions, contracts, DAG.json, OWNERSHIP.json, GATES.json

Usage:
```
/rapid:plan
```

Subagents spawned: planner. The proposal requires explicit developer approval before any files are written.

---

#### /rapid:assumptions

**Surface Claude's mental model and assumptions about a set before execution begins.**

What it does:
- Lists available sets when no set name is provided
- Runs CLI assumptions command for the specified set
- Displays scope understanding, file boundaries, contract assumptions, dependency assumptions, and risk factors
- Read-only: never modifies files or state
- If assumptions are wrong, directs the developer to re-run `/rapid:plan`
- Offers to review another set or finish

Usage:
```
/rapid:assumptions <set-name>
```

No subagents spawned. Read-only analysis of DEFINITION.md and CONTRACT.json.

### Set Lifecycle Commands

#### /rapid:set-init

**Initialize a set for development -- create worktree, scoped CLAUDE.md, and set overview.**

What it does:
- Lists available pending sets if no set name provided
- Validates set eligibility: must be in `pending` status, checks for existing branch/worktree
- Creates a git worktree at `.rapid-worktrees/{set-name}` on branch `rapid/{set-name}`
- Generates a scoped CLAUDE.md for the worktree containing only relevant contracts, context, and style guide
- Spawns a set planner subagent to produce SET-OVERVIEW.md with implementation approach
- Presents next steps: run `/rapid:discuss`, `/rapid:status`, or initialize another set

Usage:
```
/rapid:set-init <set-name>
```

Subagents spawned: set-planner. Note: set-init does NOT transition the set's status -- the set stays `pending` until `/rapid:discuss` is run.

---

#### /rapid:discuss

**Capture developer implementation vision for a wave via structured discussion.**

What it does:
- Resolves the target wave (auto-detects set or accepts explicit set+wave arguments)
- Handles ambiguous wave IDs across multiple sets via disambiguation prompt
- Reads set-level artifacts: CONTRACT.json, DEFINITION.md, SET-OVERVIEW.md, and target source files
- Identifies 5-8 gray areas where developer input would improve planning (tradeoffs, edge cases, integration points)
- Presents gray areas with multi-select for the developer to choose which to discuss
- For each selected area, runs a 4-question deep-dive loop:
  1. Open-ended exploration with approach options
  2. Follow-up probing of edge cases
  3. Implementation specifics clarification
  4. Confirmation or revision of decisions
- Every question includes a "Let Claude decide" option for delegation
- Transitions wave to `discussing` and set to `planning`
- Writes WAVE-CONTEXT.md with all locked decisions, Claude's discretion areas, and deferred ideas
- Commits WAVE-CONTEXT.md

Usage:
```
/rapid:discuss <wave-id>
/rapid:discuss <set-id> <wave-id>
```

No subagents spawned. Interactive discussion via AskUserQuestion throughout.

---

#### /rapid:wave-plan

**Run the wave planning pipeline: research, wave plan, job plans, and contract validation.**

What it does:
- Resolves and validates the target wave (must be in `discussing` state with WAVE-CONTEXT.md present)
- Transitions wave to `planning`
- Spawns a wave-researcher agent to investigate implementation specifics (uses Context7 MCP for documentation)
- Spawns a wave-planner agent to produce WAVE-PLAN.md with per-job summaries, file assignments, and coordination notes
- Spawns job-planner agents (one per job, in parallel for 3+ jobs) to produce detailed {jobId}-PLAN.md files
- Runs contract validation gate against all job plans:
  - PASS: all plans satisfy contracts
  - PASS_WITH_WARNINGS: auto-fix suggestions noted
  - FAIL: major violations escalated with Fix plan/Update contract/Override options
- Writes VALIDATION-REPORT.md
- Commits all wave planning artifacts

Usage:
```
/rapid:wave-plan <wave-id>
/rapid:wave-plan <set-id> <wave-id>
```

Subagents spawned: wave-researcher, wave-planner, job-planner (one per job). Sequential pipeline with parallel fan-out for job planners.

### Execution Commands

#### /rapid:execute

**Execute jobs within waves -- parallel subagents per job, progress tracking, per-wave reconciliation.**

What it does:
- Verifies JOB-PLAN.md files exist for the set; prompts user to run `/rapid:discuss` and `/rapid:wave-plan` if missing
- Detects execution mode: Agent Teams (if available) or Subagents (default)
- Smart re-entry: reads STATE.json to skip complete jobs, retry failed jobs, re-execute stale jobs
- Processes waves sequentially, within each wave:
  - Transitions wave to `executing`
  - Dispatches parallel job subagents (or agent teams) with JOB-PLAN.md content and file ownership constraints
  - Each job agent commits atomically per implementation step
  - Collects RAPID:RETURN markers (COMPLETE/CHECKPOINT/BLOCKED) and transitions job state
  - Commits STATE.json at wave boundary
  - Runs job-level reconciliation (files delivered vs planned, commit format)
  - Runs lean review automatically on successful reconciliation
  - Transitions wave through `reconciling` to `complete` (or leaves in `reconciling` on failure)
  - Prompts for next action: continue to next wave, retry failed jobs, or pause
- Supports `--fix-issues` flag to batch-fix logged review issues via bugfix subagent
- Final summary shows per-wave, per-job completion status

Usage:
```
/rapid:execute <set-id>
/rapid:execute <set-id> --fix-issues
```

Subagents spawned: job-executor (one per job per wave), bugfix (for --fix-issues mode). Execution mode locked for entire run.

---

#### /rapid:status

**Show cross-set dashboard with set > wave > job hierarchy, progress, and actionable next steps.**

What it does:
- Loads the Mark II state from STATE.json and worktree registry
- Displays milestone header and a compact ASCII table with columns: SET, STATUS, WAVES, WORKTREE, UPDATED
- Falls back to legacy status display if STATE.json is not found
- Presents actionable next steps via AskUserQuestion based on current project state
- Read-only: never modifies any state

Usage:
```
/rapid:status
```

No subagents spawned. Reads STATE.json and REGISTRY.json.

---

#### /rapid:pause

**Pause a set and save state for later resumption.**

What it does:
- Finds executing sets or accepts a set name as argument
- Asks for optional pause notes for the next developer
- Builds a checkpoint from STATE.json with wave/job progress snapshot
- Saves state to HANDOFF.md in `.planning/sets/{setName}/`
- Updates registry phase to Paused
- Warns if the set has been paused 3+ times (may indicate scope is too large)

Usage:
```
/rapid:pause <set-name>
```

No subagents spawned. The set can be resumed with `/rapid:resume`.

---

#### /rapid:resume

**Resume a paused set from its last checkpoint.**

What it does:
- Lists paused sets or accepts a set name as argument
- Loads handoff data from HANDOFF.md and STATE.json context (info-only, no state change yet)
- Displays handoff summary: last action, remaining work, pause notes, wave/job progress
- Offers to view full HANDOFF.md before confirming
- On confirmation, transitions the set from Paused back to Executing
- Preserves HANDOFF.md for reference until the set completes

Usage:
```
/rapid:resume <set-name>
```

No subagents spawned. After resuming, run `/rapid:execute <set-name>` to continue execution.

### Quality Commands

#### /rapid:review

**Run the review pipeline: unit test, adversarial bug hunt, and UAT.**

What it does:
- Validates the set is in `executing` or `reviewing` state; transitions to `reviewing`
- Lets the user select which stages to run: All, Unit test only, Bug hunt only, UAT only, or combinations
- Processes waves sequentially, computing review scope (changed files + dependents)
- **Unit test stage:**
  - Spawns unit-tester subagent to generate a test plan (CHECKPOINT return)
  - Presents test plan for approval (Approve/Modify/Skip)
  - On approval, re-spawns for test execution; writes and runs tests
  - Logs failed tests as review issues
- **Bug hunt stage** (up to 3 cycles):
  - Spawns bug-hunter for broad static analysis with risk/confidence scoring
  - Spawns devils-advocate to challenge findings with counter-evidence (read-only)
  - Spawns judge for final ACCEPTED/DISMISSED/DEFERRED rulings
  - DEFERRED rulings are escalated to the developer with evidence from both sides
  - Spawns bugfix agent for ACCEPTED bugs; cycles 2-3 narrow scope to modified files only
  - After 3 cycles, remaining bugs presented to developer: fix manually, defer, or dismiss
- **UAT stage:**
  - Determines browser automation tool (Chrome DevTools MCP, Playwright, or manual)
  - Spawns UAT subagent to generate test plan with [automated]/[human] step tagging
  - Presents plan for approval; executes automated steps, pauses for human verification
- Generates REVIEW-SUMMARY.md with consolidated results

Usage:
```
/rapid:review <set-id>
/rapid:review <set-id> <wave-id>
```

Subagents spawned: unit-tester, bug-hunter, devils-advocate, judge, bugfix, uat (depending on selected stages). Stage order is always: unit test, then bug hunt, then UAT.

### Integration Commands

#### /rapid:merge

**Merge completed sets into main with 5-level conflict detection, 4-tier resolution, and recovery mechanisms.**

What it does:
- Determines merge order from the dependency DAG (topological sort); presents merge plan
- Supports single-set merge (`/rapid:merge <set-name>`) including its unmerged dependencies
- Idempotent re-entry: checks MERGE-STATE.json, skips already-merged sets
- For each wave of sets (sequential within wave):
  - **5-level conflict detection:** L1 textual, L2 structural (function-scope mapping), L3 dependency, L4 API (3-way comparison), L5 semantic (via merger agent)
  - **4-tier resolution cascade:** T1 deterministic, T2 heuristic, T3 AI-assisted (merger agent), T4 human escalation
  - Spawns merger subagent for unresolved conflicts with full set context and contracts
  - Escalates low-confidence resolutions to developer: Accept AI resolution, Resolve manually, or Skip
  - Runs programmatic gate: ownership validation and contract tests
  - Executes git merge with structured conflict recovery
  - Writes MERGE-STATE.json per set for tracking
- **Post-wave integration gate:** Runs integration tests after each wave
  - On failure: auto-triggers bisection recovery to isolate breaking set
  - Developer chooses: rollback breaking set, investigate manually, or abort
  - Rollback checks for cascade impact on dependent sets
- Final summary with detection, resolution, and bisection statistics

Usage:
```
/rapid:merge
/rapid:merge <set-name>
```

Subagents spawned: merger (for unresolved conflicts). Sets within a wave merge sequentially; each merge sees the result of the previous.

---

#### /rapid:cleanup

**Clean up completed set worktrees with safety checks and optional branch deletion.**

What it does:
- Shows current worktrees and their status
- Lets the developer select a worktree to clean up
- Runs safety check: blocks removal if uncommitted changes exist
  - Offers structured recovery: Commit changes, Stash changes, Force remove (with double confirmation), or Cancel
- Removes the worktree directory
- Offers optional branch deletion (`git branch -d`); handles unmerged branches with force-delete confirmation
- Updates the worktree registry automatically

Usage:
```
/rapid:cleanup <set-name>
```

No subagents spawned. Can loop to clean up multiple worktrees.

### Lifecycle Commands

#### /rapid:new-milestone

**Start a new milestone/version cycle -- archive current, bump version, re-plan.**

What it does:
- Reads current STATE.json to display milestone status and set completion
- Gathers new milestone details: version/ID, name, and goals
- Handles unfinished sets: carry all forward, select which to carry, or start fresh
- Creates the new milestone in STATE.json (deep copies carried sets for full isolation)
- Spawns 5 parallel research agents focused on the new milestone goals
- Spawns a research synthesizer for findings consolidation
- Spawns a roadmapper to create a new sets/waves/jobs roadmap
- Presents proposed roadmap for approval with Accept/Revise/Cancel options
- On acceptance, writes ROADMAP.md and updates STATE.json with new sets, waves, and jobs

Usage:
```
/rapid:new-milestone
```

Subagents spawned: 5 research agents, research-synthesizer, roadmapper.

## Workflow Lifecycle

The Mark II workflow follows a structured lifecycle with a per-set loop at its center:

```
INSTALL -> INIT -> CONTEXT -> PLAN -> [ per set: SET-INIT -> DISCUSS -> WAVE-PLAN -> EXECUTE -> REVIEW ] -> MERGE -> CLEANUP -> NEW-MILESTONE
```

### Stage-by-Stage Breakdown

| Stage | Command | What Happens |
|-------|---------|--------------|
| **Install** | `/rapid:install` | One-time plugin setup. Configures RAPID_TOOLS env var and validates prerequisites. |
| **Initialize** | `/rapid:init` | Deep project discovery, parallel research (5 agents), roadmap generation with sets/waves/jobs structure. |
| **Context** | `/rapid:context` | Codebase analysis for brownfield projects. Generates style guide, conventions, and architecture docs. |
| **Plan** | `/rapid:plan` | Decomposes work into parallelizable sets with contracts, dependency DAG, and file ownership. |
| **Set Init** | `/rapid:set-init` | Creates isolated worktree and branch per set, generates scoped CLAUDE.md. |
| **Discuss** | `/rapid:discuss` | Developer captures implementation vision for a wave via structured discussion. |
| **Wave Plan** | `/rapid:wave-plan` | Research agent investigates, wave planner produces high-level plan, job planners detail each job. |
| **Execute** | `/rapid:execute` | Parallel job execution within waves via subagents or agent teams, with per-wave reconciliation. |
| **Review** | `/rapid:review` | Unit test + adversarial bug hunt (hunter/advocate/judge) + UAT pipeline. |
| **Merge** | `/rapid:merge` | 5-level conflict detection, 4-tier resolution, DAG-ordered merge with integration gates. |
| **Cleanup** | `/rapid:cleanup` | Removes completed worktrees, optionally deletes branches. |
| **New Milestone** | `/rapid:new-milestone` | Archives current milestone, bumps version, re-runs research and roadmap for new scope. |

### Parallelism Model

- **Sets run in parallel** across developers. Each set has its own git worktree and branch.
- **Waves execute sequentially** within a set. Wave 1 must complete before Wave 2 begins.
- **Jobs execute in parallel** within a wave. Each job has its own subagent and modifies only its assigned files.
- **Review gates** prevent merging untested code. The adversarial bug hunt pipeline (hunter/advocate/judge) provides quality assurance.

### Per-Set Loop Detail

```
SET-INIT                          Create worktree + branch + scoped CLAUDE.md
    |
    v
DISCUSS (per wave)                Capture implementation vision, identify gray areas
    |
    v
WAVE-PLAN (per wave)              Research -> Wave plan -> Job plans -> Contract validation
    |
    v
EXECUTE (per wave)                Parallel job agents -> Reconciliation -> Lean review
    |
    v
REVIEW (per set)                  Unit test -> Bug hunt (3 cycles) -> UAT
    |
    v
[Set ready for merge]
```

## Key Concepts

### 1. Sets

Independent workstreams that run in isolated git worktrees. Each set has a DEFINITION.md describing its scope, file ownership, and acceptance criteria, plus a CONTRACT.json defining its API surface. Sets within the same wave execute in parallel; sets in later waves depend on earlier ones. In Mark II, sets go through a full lifecycle: `pending -> planning -> executing -> reviewing -> merging -> complete`.

### 2. Waves

Dependency-ordered execution groups within sets. Wave 1 jobs have no dependencies and run first. Wave 2 jobs depend on Wave 1 outputs. Within a set, waves execute sequentially. Wave reconciliation runs between waves to validate that all planned files were delivered and commits follow conventions. Waves have their own state lifecycle: `pending -> discussing -> planning -> executing -> reconciling -> complete`.

### 3. Jobs

Granular work units within waves (equivalent to v1.0 "plans"). Each job has a JOB-PLAN.md with detailed implementation steps, file assignments, and acceptance criteria. Jobs within a wave execute in parallel via subagents, each working in the same worktree but modifying only its assigned files. Jobs have a simple lifecycle: `pending -> executing -> complete` (or `failed -> executing` for retries).

### 4. State Machine

Mark II tracks all project state in a hierarchical JSON structure (STATE.json) with lock-protected atomic writes. The hierarchy is:

```
ProjectState
  +-- milestones[]
      +-- MilestoneState (id, name)
          +-- sets[]
              +-- SetState
                  +-- waves[]
                      +-- WaveState
                          +-- jobs[]
                              +-- JobState
```

State transitions are validated -- attempting to skip states (e.g., `pending` to `complete` without going through `executing`) produces a clear error. All schemas are Zod-validated. State updates survive context resets, enabling `/rapid:status` to always show accurate progress.

**State transition diagrams:**

```
Set:  pending -> planning -> executing -> reviewing -> merging -> complete

Wave: pending -> discussing -> planning -> executing -> reconciling -> complete
      failed -> executing (retry)

Job:  pending -> executing -> complete
      pending -> executing -> failed
      failed -> executing (retry)
```

### 5. Milestones

Version cycles with archive/re-plan lifecycle. A milestone (e.g., "v2.0 Mark II") contains all sets, waves, and jobs for that version. When a milestone is complete, `/rapid:new-milestone` archives it and creates a new milestone with fresh research and roadmapping. Unfinished sets can be carried forward with deep copy isolation.

### 6. Interface Contracts

Machine-verifiable JSON schemas that define the API surface between sets. Contracts specify:
- **Exports:** Functions and types a set provides (name, file, params, returns)
- **Imports:** Functions and types consumed from other sets
- **Behavioral invariants:** Conditions that must always hold (e.g., "authenticate returns null, never throws, for invalid tokens")
- **Side effects:** Observable effects (e.g., "writes session to disk", "emits auth:login event")

Contracts are validated automatically during wave planning (contract validation gate) and before merge (programmatic gate).

### 7. Set Initialization

The `/rapid:set-init` command creates an isolated development environment per set:
- Creates a git worktree at `.rapid-worktrees/{set-name}` on branch `rapid/{set-name}`
- Generates a scoped CLAUDE.md containing only the set's contracts, relevant context, and style guide
- Spawns a set planner to produce SET-OVERVIEW.md with implementation approach

This ensures each developer (or Claude instance) works in full isolation with only relevant context loaded.

### 8. Wave Discussion

The `/rapid:discuss` command captures developer implementation vision before autonomous planning begins. It identifies 5-8 gray areas (tradeoffs, edge cases, integration points) and runs a structured 4-question deep-dive loop for each selected area. Every question includes a "Let Claude decide" option for delegation. The output is WAVE-CONTEXT.md, which downstream planners use as their primary guidance.

### 9. Wave Planning Pipeline

A sequential pipeline that produces detailed implementation plans:
1. **Research:** Wave researcher investigates implementation specifics, using Context7 MCP for documentation
2. **Wave plan:** Wave planner produces WAVE-PLAN.md with per-job summaries, file assignments, and coordination notes
3. **Job plans:** Job planners (one per job, parallel for 3+) produce detailed {jobId}-PLAN.md files
4. **Contract validation:** All job plans validated against interface contracts with escalation for violations

### 10. Review Pipeline

A multi-stage quality assurance pipeline:
- **Unit testing:** Test plan generation with approval gate, then test writing and execution
- **Adversarial bug hunt:** Three-agent pipeline with up to 3 iteration cycles:
  - **Bug hunter** performs broad static analysis with risk/confidence scoring
  - **Devils advocate** (read-only) challenges findings with counter-evidence from the code
  - **Judge** produces final rulings: ACCEPTED, DISMISSED, or DEFERRED (escalated to developer)
  - **Bugfix agent** fixes accepted bugs; re-hunt narrows scope to modified files only
- **UAT:** Acceptance testing with browser automation (Chrome DevTools MCP or Playwright), mixing automated and human-verified steps

### 11. 5-Level Conflict Detection

The merge pipeline detects conflicts at five escalating levels of sophistication:
1. **L1 Textual:** Standard git diff-based textual conflicts
2. **L2 Structural:** Function-scope mapping via diff hunk headers -- detects when two sets modify the same function
3. **L3 Dependency:** Analyzes import/require changes to detect broken dependency chains
4. **L4 API:** 3-way comparison (ancestor vs branch vs base) using `git merge-base` to detect incompatible API changes
5. **L5 Semantic:** AI-powered analysis via the merger agent for subtle behavioral conflicts that pass textual checks

### 12. 4-Tier Resolution Cascade

Detected conflicts are resolved through an escalating cascade:
1. **Tier 1 (Deterministic):** Automatic resolution for trivial conflicts (whitespace, import ordering, additive-only changes)
2. **Tier 2 (Heuristic):** Pattern-based resolution using ownership information and contract data
3. **Tier 3 (AI-assisted):** Merger agent resolves with confidence scoring; resolutions above 0.7 threshold are applied automatically
4. **Tier 4 (Human escalation):** Low-confidence resolutions are escalated to the developer with proposed resolution and reasoning

### 13. Bisection Recovery

When an integration test fails after merging a wave of sets, RAPID automatically runs binary search to isolate which set introduced the failure. The bisection saves and restores `.planning/` state to `os.tmpdir()` during search, avoiding git stash issues with untracked files. After identifying the breaking set, the developer can rollback, investigate, or abort.

### 14. Rollback

Cascade-aware revert for problematic merges. Before rolling back a set, RAPID checks for dependent sets that have already been merged and warns about cascade impact. The `--force` flag bypasses the cascade warning after the developer confirms via AskUserQuestion.

### 15. Planning Gates

Enforcement that all sets in a wave must be planned before execution begins. GATES.json tracks planning and execution state transitions per wave, preventing premature execution. Wave 2 planning can overlap with Wave 1 execution.

### 16. Wave Reconciliation

Mandatory validation between execution waves. After all jobs in a wave complete, reconciliation verifies:
- All planned files were delivered (file existence check per JOB-PLAN.md)
- Commits follow the required format
- No file ownership violations

Results are PASS, PASS_WITH_WARNINGS, or FAIL. A lean review runs automatically on successful reconciliation to catch obvious issues early.

### 17. File Ownership

Every file that could be modified belongs to exactly one set. Cross-set file access is tracked via CONTRIBUTIONS.json, where a set can declare intent to modify a file owned by another set (with section, priority, and intent metadata). Ownership violations are detected during wave reconciliation and flagged during merge review. This prevents merge conflicts from parallel development.

## Prerequisites

The following tools are validated by `/rapid:install` and `/rapid:init`:

| Tool | Minimum Version | Required | Purpose |
|------|----------------|----------|---------|
| **Node.js** | 18+ | Yes | Runtime for tool libraries and CLI |
| **git** | 2.30+ | Yes | Worktree support for parallel development |
| **jq** | 1.6+ | No | Optional JSON processing utilities |
| **Claude Code** | Latest | Yes | Plugin host environment |

<!-- PLAN 02: Architecture, agents, libraries, CLI reference, state machine, configuration sections will be added below -->
