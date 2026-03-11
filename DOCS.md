# RAPID - Plugin Documentation

RAPID (Rapid Agentic Parallelizable and Isolatable Development) enables team-based parallel development for Claude Code. It decomposes project work into a hierarchical structure of Sets, Waves, and Jobs that execute simultaneously in isolated git worktrees, connected by machine-verifiable interface contracts and validated through an adversarial review pipeline. Multiple developers work on the same project without blocking each other, with confidence their independent work merges cleanly through 5-level conflict detection and 4-tier resolution.

**Version:** 2.2.0

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
7. **`/rapid:wave-plan`** -- Research, produce wave plan, per-job plans, and validate contracts (or **`/rapid:plan-set`** to plan all waves in one command)
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

---

#### /rapid:plan-set

**Plan all waves in a set with automatic dependency sequencing.**

What it does:
- Validates all waves are at least in `discussing` state (fails fast if any are `pending`)
- Smart re-entry: skips already-planned waves, plans only remaining `discussing` waves
- For 2+ waves, spawns a wave-analyzer agent to detect inter-wave dependencies
- Groups waves into ordered batches using BFS level assignment
- Runs the full wave-plan pipeline per wave (research, wave plan, job plans, plan verification, contract validation)
- Parallel batches: independent waves plan simultaneously with interleaved agent dispatch at each pipeline step
- Commits all planning artifacts and transitions waves to `planning` state

Usage:
```
/rapid:plan-set <set-id>
```

Arguments: `<set-id>` supports both string IDs (e.g., `auth-system`) and numeric indices (e.g., `1`).

Subagents spawned: wave-analyzer (dependency detection), wave-researcher (one per wave), wave-planner (one per wave), job-planner (one per job), plan-verifier (one per wave). Parallel dispatch within batches.

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
/rapid:execute <set-id> --retry-wave <wave-id>
```

The `--retry-wave` flag targets a specific wave, verifies predecessors are complete, re-executes failed/pending jobs, and auto-advances subsequent waves.

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
- **Scoping stage:** Diffs set branch vs main, spawns a scoper agent to categorize files by concern area; falls back to directory chunking (15 files max) if cross-cutting files exceed 50%
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

Subagents spawned: scoper (file categorization), unit-tester, bug-hunter, devils-advocate, judge, bugfix, uat (depending on selected stages). Stage order is always: scoping, then unit test, then bug hunt, then UAT.

### Integration Commands

#### /rapid:merge

**Merge completed sets into main with 5-level conflict detection, 4-tier resolution, and recovery mechanisms.**

What it does:
- Determines merge order from the dependency DAG (topological sort); presents merge plan
- Supports single-set merge (`/rapid:merge <set-name>`) including its unmerged dependencies
- Idempotent re-entry: checks MERGE-STATE.json, skips already-merged sets; max 2 total attempts per set
- **Fast-path check:** Uses `git merge-tree --write-tree` -- exit code 0 means clean merge, skips conflict detection entirely
- For each wave of sets (sequential within wave):
  - **5-level conflict detection:** L1 textual, L2 structural (function-scope mapping), L3 dependency, L4 API (3-way comparison), L5 semantic (via set-merger agent)
  - **4-tier resolution cascade:** T1 deterministic, T2 heuristic, T3 AI-assisted (set-merger agent with confidence scoring), T4 human escalation
  - Spawns `rapid-set-merger` subagent per set for conflict detection and resolution pipeline
  - Mid-confidence conflicts (0.3-0.8) are escalated to dedicated `rapid-conflict-resolver` agents for deep analysis
  - Low-confidence conflicts (<0.3) and API-signature conflicts are escalated to the developer
  - High-confidence resolutions (>0.8) are auto-accepted
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

Subagents spawned: set-merger (one per set), conflict-resolver (for mid-confidence conflicts -- the only two-level agent nesting in the system). Sets within a wave merge sequentially; each merge sees the result of the previous.

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
| **Plan Set** | `/rapid:plan-set` | Plans all waves in a set with automatic dependency sequencing -- runs the full wave-plan pipeline per wave. |
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
WAVE-PLAN (per wave)              Research -> Wave plan -> Job plans -> Verify -> Validate
  or PLAN-SET (all waves)         Automatic dependency sequencing, parallel batch grouping
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
- **Scoping:** Diffs set branch vs main, spawns a scoper agent to categorize changed files by concern area (e.g., auth, database, API routes). Falls back to directory-based chunking (15 files max per chunk) if cross-cutting files exceed 50%
- **Unit testing:** Test plan generation with approval gate, then test writing and execution
- **Adversarial bug hunt:** Three-agent pipeline with up to 3 iteration cycles:
  - **Bug hunter** performs broad static analysis with risk/confidence scoring
  - **Devils advocate** (read-only) challenges findings with counter-evidence from the code
  - **Judge** produces final rulings: ACCEPTED, DISMISSED, or DEFERRED (escalated to developer)
  - **Bugfix agent** fixes accepted bugs; re-hunt narrows scope to modified files only
- **UAT:** Acceptance testing with browser automation (Chrome DevTools MCP or Playwright), mixing automated and human-verified steps

### 11. 5-Level Conflict Detection

The merge pipeline first runs a fast-path check via `git merge-tree --write-tree` -- if exit code is 0, the merge is clean and conflict detection is skipped entirely. Otherwise, conflicts are detected at five escalating levels of sophistication:
1. **L1 Textual:** Standard git diff-based textual conflicts
2. **L2 Structural:** Function-scope mapping via diff hunk headers -- detects when two sets modify the same function
3. **L3 Dependency:** Analyzes import/require changes to detect broken dependency chains
4. **L4 API:** 3-way comparison (ancestor vs branch vs base) using `git merge-base` to detect incompatible API changes
5. **L5 Semantic:** AI-powered analysis via the `rapid-set-merger` agent for subtle behavioral conflicts that pass textual checks

### 12. 4-Tier Resolution Cascade

Detected conflicts are resolved through an escalating cascade:
1. **Tier 1 (Deterministic):** Automatic resolution for trivial conflicts (whitespace, import ordering, additive-only changes)
2. **Tier 2 (Heuristic):** Pattern-based resolution using ownership information and contract data
3. **Tier 3 (AI-assisted):** `rapid-set-merger` agent resolves with confidence scoring; high-confidence resolutions (>0.8) are auto-accepted. Mid-confidence conflicts (0.3-0.8) are escalated to dedicated `rapid-conflict-resolver` agents for deep analysis -- the only two-level agent nesting in RAPID
4. **Tier 4 (Human escalation):** Low-confidence resolutions (<0.3) and API-signature conflicts are escalated to the developer with proposed resolution and reasoning

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
| **jq** | 1.6+ | v1.0 | Optional JSON processing utilities |
| **Claude Code** | Latest | Yes | Plugin host environment |

## Architecture

### Directory Structure

```
RAPID/
  .claude-plugin/
    plugin.json                   Plugin manifest (name, version, description)
  agents/                         Assembled agent prompts (gitignored, built at runtime)
  commands/                       6 legacy command files (backward compatibility)
    assumptions.md
    context.md
    help.md
    init.md
    install.md
    plan.md
  skills/                         18 skill orchestrators (primary command mechanism)
    assumptions/
    cleanup/
    context/
    discuss/
    execute/
    help/
    init/
    install/
    merge/
    new-milestone/
    pause/
    plan/
    plan-set/
    resume/
    review/
    set-init/
    status/
    wave-plan/
  src/
    bin/
      rapid-tools.cjs             CLI entry point (50+ subcommands)
    hooks/
      rapid-task-completed.sh     Post-task hook for agent teams
    lib/                          21 runtime libraries + test files
    modules/
      core/                       5 core agent modules (shared across all agents)
        core-identity.md
        core-returns.md
        core-state-access.md
        core-git.md
        core-context-loading.md
      roles/                      31 role-specific agent modules
  config.json                     Agent assembly configuration
  docs/                           Technical reference documentation
    setup.md                      Install, init, context commands
    planning.md                   Plan, set-init, discuss, wave-plan, plan-set, assumptions commands
    execution.md                  Execute command (normal, fix-issues, retry-wave modes)
    review.md                     Review pipeline (scoping, unit test, bug hunt, UAT)
    merge-and-cleanup.md          Merge, cleanup, new-milestone commands
    agents.md                     All 31 agents with type badges and spawn hierarchy
    configuration.md              Environment variables, config, STATE.json schema, directory layout
    state-machines.md             Set, wave, and job lifecycle transitions
    troubleshooting.md            Common failure modes with symptom, cause, and fix
  DOCS.md                         Full documentation (this file)
  README.md                       GitHub landing page
  LICENSE                         MIT license
  package.json                    npm manifest and dependencies
  setup.sh                        Installation script
```

### Agent Assembly

RAPID uses a composable module system to build agent prompts at runtime. The `config.json` file maps 5 named agents to their component modules:

- **5 core modules** are shared across all agents (identity, returns protocol, state access, git conventions, context loading)
- **31 role modules** define specialized behavior for each agent type
- **5 named agents** in `config.json` (rapid-planner, rapid-executor, rapid-reviewer, rapid-verifier, rapid-orchestrator) are assembled from core modules + one role module + context files
- **Skills also spawn agents inline** by loading role module content directly, enabling the 31 role modules to be used without pre-assembly

The assembler (`src/lib/assembler.cjs`) reads `config.json`, concatenates the core modules, appends the role module, and injects context files (project overview, contracts, style guide) based on the agent configuration. The assembler registers all 31 role modules.

### Core Agent Modules

| # | Module | Purpose |
|---|--------|---------|
| 1 | core-identity.md | RAPID agent identity and behavioral guidelines -- establishes the agent as part of a team-based parallel development system |
| 2 | core-returns.md | Structured return protocol -- every agent invocation ends with a RAPID:RETURN marker (COMPLETE/CHECKPOINT/BLOCKED) containing both Markdown and JSON |
| 3 | core-state-access.md | State access protocol -- all state access goes through rapid-tools.cjs CLI, never direct file reads of .planning/ |
| 4 | core-git.md | Git commit conventions -- atomic commits, branch naming, bisectable history across parallel worktrees |
| 5 | core-context-loading.md | Progressive context loading -- load minimum context needed, then expand as required within finite context budget |

### Agent Roles

| # | Role Module | Purpose | Spawned By |
|---|-------------|---------|------------|
| 1 | role-planner.md | Decomposes project work into parallelizable sets with contracts, DAG, and file ownership | `/rapid:plan` |
| 2 | role-executor.md | Implements tasks within an assigned worktree (set-level, v1 compatibility) | `/rapid:execute` |
| 3 | role-job-executor.md | Implements a single job within a wave with atomic commits per step | `/rapid:execute` |
| 4 | role-reviewer.md | Deep code review for merge readiness -- catches style, contract, and architectural issues | `/rapid:merge` |
| 5 | role-verifier.md | Filesystem artifact verification -- independently confirms claimed work exists and is substantive | `/rapid:execute` |
| 6 | role-orchestrator.md | Top-level workflow coordination -- spawns and manages all other agents | `/rapid:execute` |
| 7 | role-codebase-synthesizer.md | Deep brownfield codebase analysis producing structured report for downstream agents | `/rapid:init` |
| 8 | role-context-generator.md | Codebase analysis and context file generation (CLAUDE.md, style guide, conventions) | `/rapid:context` |
| 9 | role-research-stack.md | Technology stack research -- versions, compatibility, upgrade considerations | `/rapid:init` |
| 10 | role-research-features.md | Feature implementation research -- decomposition strategies, libraries, services | `/rapid:init` |
| 11 | role-research-architecture.md | Architecture pattern research -- structure, data flow, design decisions | `/rapid:init` |
| 12 | role-research-pitfalls.md | Common pitfalls research -- failure modes, anti-patterns, stack-specific mistakes | `/rapid:init` |
| 13 | role-research-oversights.md | Cross-cutting concern research -- easily-missed requirements spanning multiple systems | `/rapid:init` |
| 14 | role-research-synthesizer.md | Combines 5 parallel research outputs into unified SUMMARY.md, deduplicates and resolves contradictions | `/rapid:init` |
| 15 | role-roadmapper.md | Creates project roadmap with sets/waves/jobs hierarchy and interface contracts | `/rapid:init` |
| 16 | role-set-planner.md | Produces SET-OVERVIEW.md with high-level implementation approach for a specific set | `/rapid:set-init` |
| 17 | role-wave-analyzer.md | Analyzes inter-wave dependencies within a set and groups waves into parallel planning batches | `/rapid:plan-set` |
| 18 | role-wave-researcher.md | Targeted research for a single wave's implementation specifics (uses Context7 MCP) | `/rapid:wave-plan`, `/rapid:plan-set` |
| 19 | role-wave-planner.md | Produces WAVE-PLAN.md with per-job summaries, file assignments, and coordination notes | `/rapid:wave-plan`, `/rapid:plan-set` |
| 20 | role-job-planner.md | Creates detailed per-job implementation plan (JOB-PLAN.md) with steps and acceptance criteria | `/rapid:wave-plan`, `/rapid:plan-set` |
| 21 | role-plan-verifier.md | Validates job plans for coverage, implementability, and consistency with wave plan | `/rapid:wave-plan`, `/rapid:plan-set` |
| 22 | role-scoper.md | Categorizes changed files by concern area for focused review (auth, database, API routes, etc.) | `/rapid:review` |
| 23 | role-unit-tester.md | Generates test plan for approval, then writes and runs tests with full observability | `/rapid:review` |
| 24 | role-bug-hunter.md | Broad static analysis with risk/confidence scoring on scoped files | `/rapid:review` |
| 25 | role-devils-advocate.md | Challenges hunter findings with counter-evidence from the code (strictly read-only) | `/rapid:review` |
| 26 | role-judge.md | Final ACCEPTED/DISMISSED/DEFERRED rulings on contested findings | `/rapid:review` |
| 27 | role-bugfix.md | Fixes accepted bugs with targeted, atomic changes | `/rapid:execute --fix-issues` |
| 28 | role-uat.md | User acceptance testing with browser automation and human/automated step classification | `/rapid:review` |
| 29 | role-set-merger.md | Per-set merge pipeline -- runs 5-level conflict detection, 4-tier resolution cascade, gate validation | `/rapid:merge` |
| 30 | role-conflict-resolver.md | Deep analysis of mid-confidence conflicts with full context; produces resolution with confidence scoring | `rapid-set-merger` |
| 31 | role-merger.md | Level 5 semantic conflict detection and Tier 3 AI-assisted resolution (legacy, replaced by set-merger + conflict-resolver) | -- |

### Runtime Libraries

| # | Library | Purpose | Status |
|---|---------|---------|-------------|
| 1 | core.cjs | Output formatting (`[RAPID]` prefix), project root detection, config loading | Core |
| 2 | lock.cjs | Cross-process atomic locking using mkdir strategy with proper-lockfile, 5-minute stale threshold | Core |
| 3 | prereqs.cjs | Prerequisite validation (git 2.30+, Node.js 18+, optional jq 1.6+) with semver comparison | Core |
| 4 | init.cjs | Project scaffolding -- PROJECT.md, STATE.md, ROADMAP.md, REQUIREMENTS.md, config.json, STATE.json | Core |
| 5 | assembler.cjs | Agent assembly from modular components -- registers 31 role modules | Core |
| 6 | returns.cjs | Structured return protocol parsing -- extracts RAPID:RETURN JSON from agent output | Core |
| 7 | verify.cjs | Tiered artifact verification -- lightweight (file existence) and heavyweight (tests + content) | Core |
| 8 | context.cjs | Brownfield codebase detection, language/framework scanning, directory mapping | Core |
| 9 | dag.cjs | Directed acyclic graph operations -- topological sort (Kahn's algorithm), wave assignment (BFS), execution ordering | Core |
| 10 | contract.cjs | Interface contract management -- Ajv JSON Schema validation, contract tests, manifest, file ownership maps | Core |
| 11 | stub.cjs | Contract stub generator -- produces CommonJS stubs from CONTRACT.json exports for cross-set development | Core |
| 12 | plan.cjs | Planning orchestration -- set creation, DAG/ownership/manifest/gate persistence, planning gate enforcement | Core |
| 13 | worktree.cjs | Git worktree lifecycle -- create, cleanup, reconcile, registry, scoped CLAUDE.md generation, branch deletion | Core |
| 14 | execute.cjs | Execution engine -- context preparation, prompt assembly, wave reconciliation, job status tracking | Core |
| 15 | merge.cjs | Merge pipeline -- 5-level conflict detection (L1-L4), 4-tier resolution (T1-T2), MERGE-STATE.json, DAG ordering | Major rewrite |
| 16 | teams.cjs | Agent teams detection -- checks CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS env var for execution mode | Core |
| 17 | state-machine.cjs | Hierarchical JSON state management -- read/write with lock protection, atomic rename, transition functions, corruption detection, git recovery | Core |
| 18 | state-schemas.cjs | Zod schemas for Project/Milestone/Set/Wave/Job state with status enums and default values | Core |
| 19 | state-transitions.cjs | Valid state transition maps for set, wave, and job entities with validation function | Core |
| 20 | wave-planning.cjs | Wave resolution across milestones/sets, wave directory management, contract validation for job plans | Core |
| 21 | review.cjs | Review pipeline -- Zod-validated schemas, wave-scoped file discovery, issue logging, bugfix tracking, summary generation | Core |

## State Machine Architecture

### Hierarchy

```
ProjectState
  +-- milestones[]
      +-- MilestoneState (id, name)
          +-- sets[]
              +-- SetState (id, status)
                  +-- waves[]
                      +-- WaveState (id, status, jobs[])
                          +-- jobs[]
                              +-- JobState (id, status, startedAt, completedAt, commitSha, artifacts[])
```

### Schemas

All state is validated with Zod schemas (`state-schemas.cjs`):

| Schema | Fields | Defaults |
|--------|--------|----------|
| **ProjectState** | version (literal 1), projectName, currentMilestone, milestones[], lastUpdatedAt, createdAt | milestones: [] |
| **MilestoneState** | id, name, sets[] | sets: [] |
| **SetState** | id, status (SetStatus enum), waves[] | status: pending, waves: [] |
| **WaveState** | id, status (WaveStatus enum), jobs[] | status: pending, jobs: [] |
| **JobState** | id, status (JobStatus enum), startedAt?, completedAt?, commitSha?, artifacts[] | status: pending, artifacts: [] |

### Transition Maps

State transitions are validated -- attempting to skip states produces a clear error (`state-transitions.cjs`):

**Set transitions:**
```
pending -> planning -> executing -> reviewing -> merging -> complete
```

**Wave transitions:**
```
pending -> discussing -> planning -> executing -> reconciling -> complete
failed -> executing (retry)
```

**Job transitions:**
```
pending -> executing -> complete
pending -> executing -> failed
failed -> executing (retry)
```

### Lock-Protected Writes

`state-machine.cjs` protects all state writes with a two-phase strategy:

1. **Validate first:** State is validated against the Zod schema *before* acquiring the lock (fail-fast on bad data)
2. **Lock acquisition:** Uses `lock.cjs` (proper-lockfile with mkdir strategy) to acquire a named lock (`state-machine`)
3. **Atomic rename:** State is written to a temporary file (`STATE.json.tmp`) then renamed to `STATE.json` -- the rename is atomic on POSIX systems, preventing partial writes
4. **Lock release:** The lock is released in a `finally` block, guaranteeing cleanup even on errors

Transition functions (`transitionJob`, `transitionWave`, `transitionSet`) acquire their own lock and write directly to avoid double-lock issues. Child transitions automatically derive parent status (e.g., completing all jobs in a wave derives the wave status to `complete`).

### Status Derivation

Parent entity status is automatically derived from children:

- **Wave status** derived from jobs: all pending = pending, all complete = complete, any failed + none executing = failed, otherwise = executing
- **Set status** derived from waves: all pending = pending, all complete = complete, any active wave = executing

Derived status only applies if it represents forward progression -- this prevents regressions (e.g., a wave in `reconciling` state will not be regressed to `executing` by a derived status).

## CLI Reference

The `rapid-tools.cjs` CLI provides 50+ subcommands organized into command groups. All commands are invoked via `node "$RAPID_TOOLS" <command> [subcommand] [args...]`.

| Command Group | Subcommands | Purpose |
|---------------|-------------|---------|
| **lock** | acquire, status, release | Cross-process atomic locking for concurrent state access |
| **state** | get (--all, milestone, set, wave, job), transition (set, wave, job), add-milestone, detect-corruption, recover | Hierarchical state management with hierarchy-aware addressing |
| **assemble-agent** | (role), --list, --validate | Agent prompt assembly from modular components |
| **parse-return** | (file), --validate | Structured return parsing from agent output |
| **verify-artifacts** | (files), --heavy --test, --report | Tiered artifact verification (lightweight and heavyweight) |
| **prereqs** | (default), --git-check, --json | Prerequisite validation (git, Node.js, jq) |
| **init** | detect, scaffold | Project initialization and .planning/ directory setup |
| **context** | detect, generate | Codebase analysis and context directory management |
| **plan** | create-set, decompose, write-dag, check-gate, update-gate, list-sets, load-set | Set decomposition, DAG persistence, planning gate enforcement |
| **assumptions** | (set-name) | Set assumption surfacing (read-only) |
| **worktree** | create, list, cleanup, reconcile, status (--json), generate-claude-md, delete-branch (--force) | Git worktree lifecycle and registry management |
| **resume** | (set-name) | Set resumption from paused state with STATE.json context |
| **execute** | prepare-context, verify, generate-stubs, cleanup-stubs, wave-status, update-phase, pause, resume, reconcile, detect-mode, reconcile-jobs, job-status, commit-state | Execution management -- context prep, wave reconciliation, job tracking |
| **merge** | review, execute, status, integration-test, order, update-status, detect, resolve, bisect, rollback, merge-state | Merge pipeline -- 5-level detection, 4-tier resolution, bisection, rollback |
| **set-init** | create, list-available | Set initialization -- worktree creation and pending set discovery |
| **resolve** | set | Reference resolution -- converts numeric indices to string set IDs |
| **wave-plan** | resolve-wave, create-wave-dir, validate-contracts, list-jobs | Wave planning -- wave resolution, directory setup, contract validation |
| **display** | banner | Stage banners for skill progress display |
| **review** | scope, log-issue, list-issues, update-issue, lean, summary | Review management -- file scoping, issue tracking, summary generation |

## Configuration

### .planning/ Directory

| File/Directory | Purpose | Since |
|----------------|---------|-------------|
| PROJECT.md | Project overview, team size, model selection, key decisions | v1.0 |
| STATE.md | Human-readable project state (position, decisions, blockers) | v1.0 |
| ROADMAP.md | Phase/plan roadmap with dependency ordering | v1.0 |
| REQUIREMENTS.md | Project requirements with traceability | v1.0 |
| config.json | Planning configuration (mode, parallelization, model profile) | v1.0 |
| sets/ | Per-set artifacts: DEFINITION.md, CONTRACT.json, HANDOFF.md | v1.0 |
| contracts/ | Contract manifest, ownership map, contributions | v1.0 |
| context/ | Generated context files: CODEBASE.md, ARCHITECTURE.md, CONVENTIONS.md, STYLE_GUIDE.md | v1.0 |
| **STATE.json** | Machine-readable hierarchical state (source of truth for state machine) | v2.0 |
| **research/** | Parallel research agent outputs from /rapid:init and /rapid:new-milestone | v2.0 |
| **waves/{setId}/{waveId}/** | Wave/job planning artifacts: WAVE-CONTEXT.md, WAVE-RESEARCH.md, WAVE-PLAN.md, {jobId}-JOB-PLAN.md, VALIDATION-REPORT.md | v2.0 |
| **worktrees/** | Worktree registry (REGISTRY.json) | v2.0 |
| **.locks/** | Lock state directory for cross-process coordination | v2.0 |
| **MERGE-STATE.json** | Per-set merge tracking (detection results, resolution outcomes) | v2.0 |
| DAG.json | Dependency graph for set ordering | v1.0 |
| OWNERSHIP.json | File-to-set ownership map | v1.0 |
| GATES.json | Planning/execution gate status per wave | v1.0 |

### Agent Assembly Configuration

The root `config.json` defines 5 named agents with their module composition:

```json
{
  "agents": {
    "rapid-planner": {
      "role": "planner",
      "core": ["core-identity.md", "core-returns.md", "core-state-access.md", "core-git.md", "core-context-loading.md"],
      "context": ["project", "contracts", "style"],
      "context_files": ["CONVENTIONS.md", "ARCHITECTURE.md"]
    }
  },
  "lock_timeout_ms": 300000,
  "agent_size_warn_kb": 15
}
```

Each agent entry specifies:
- **role** -- Which role module to load from `src/modules/roles/`
- **core** -- Which core modules to include (all 5 by default)
- **context** -- Context categories to inject (project, contracts, style)
- **context_files** -- Specific context files from `.planning/context/`

Additional settings:
- **lock_timeout_ms** -- Lock stale threshold (default: 300000ms / 5 minutes)
- **agent_size_warn_kb** -- Warning threshold for assembled agent prompt size (default: 15 KB)

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `RAPID_TOOLS` | Absolute path to `rapid-tools.cjs` CLI. Required by all RAPID commands and agent modules. | Must be set via `/rapid:install` or `setup.sh` |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Enable experimental agent teams execution mode (parallel job dispatch via Claude Code teams). | `0` (disabled -- subagent mode used instead) |

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| zod | ^3.25.76 | Schema validation for STATE.json (Zod 3.24.4 locked for CommonJS compatibility) |
| ajv | ^8.17.1 | JSON Schema validation for interface contracts (CONTRACT.json) |
| ajv-formats | ^3.0.1 | Format validation extensions for Ajv (email, uri, date-time, etc.) |
| proper-lockfile | ^4.1.2 | File-level locking for cross-process state protection (mkdir strategy) |

## Further Reading

For detailed command syntax, all 31 agent roles with spawn hierarchy, configuration options, state machine transitions, and troubleshooting guides, see the [technical documentation](technical_documentation.md) and the `docs/` directory:

- [Setup](docs/setup.md) -- Install, init, and context commands
- [Planning](docs/planning.md) -- Plan, set-init, discuss, wave-plan, plan-set, and assumptions commands
- [Execution](docs/execution.md) -- Execute command with normal, fix-issues, and retry-wave modes
- [Review](docs/review.md) -- Scoping, unit test, bug hunt, and UAT pipeline
- [Merge and Cleanup](docs/merge-and-cleanup.md) -- Merge, cleanup, and new-milestone commands
- [Agent Reference](docs/agents.md) -- All 31 agents with type badges and spawn hierarchy
- [Configuration](docs/configuration.md) -- Environment variables, config, STATE.json schema, and directory layout
- [State Machines](docs/state-machines.md) -- Set, wave, and job lifecycle transitions
- [Troubleshooting](docs/troubleshooting.md) -- Common failure modes with symptom, cause, and fix

---

RAPID v2.2.0 -- Rapid Agentic Parallelizable and Isolatable Development for Claude Code
