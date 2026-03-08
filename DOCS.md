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

<!-- PLAN 02: Architecture, agents, libraries, CLI reference, state machine, configuration sections will be added below -->
