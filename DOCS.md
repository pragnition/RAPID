# RAPID -- Technical Reference

RAPID (Rapid Agentic Parallelizable and Isolatable Development) is a Claude Code plugin that enables coordinated parallel AI-assisted development. It structures work around independent sets -- each running in an isolated git worktree with strict file ownership -- connected through machine-verifiable interface contracts and validated through a multi-stage adversarial review pipeline. 26 specialized agents handle research, planning, execution, review, and merge so developers focus on decisions, not coordination.

**Version:** 3.0.0

For the full technical deep-dive covering all 26 agents, the state machine, configuration, and directory layout, see [technical_documentation.md](technical_documentation.md). For a quickstart overview, see [README.md](README.md).

## Table of Contents

- [Installation](#installation)
- [Commands](#commands)
  - [Core Lifecycle (7 commands)](#core-lifecycle-7-commands)
  - [Auxiliary (4 commands)](#auxiliary-4-commands)
  - [Utilities (6 commands)](#utilities-6-commands)
- [Architecture Overview](#architecture-overview)
- [File Structure](#file-structure)
- [Practical Tips](#practical-tips)

## Installation

### Plugin Marketplace (Primary)

```
claude plugin add fishjojo1/RAPID
```

Then run `/rapid:install` from within Claude Code to complete setup. This configures the `RAPID_TOOLS` environment variable needed by all RAPID commands.

### Git Clone

```bash
git clone https://github.com/fishjojo1/RAPID.git
cd RAPID
./setup.sh
```

The `setup.sh` script installs dependencies, configures `RAPID_TOOLS`, and runs `build-agents` to generate agent definition files.

### Requirements

- **Node.js 18+** (runtime for tool libraries)
- **git 2.30+** (required for worktree support)
- **RAPID_TOOLS env var** must be set (both installation methods handle this)
- npm dependencies are bundled in `node_modules/`

---

## Commands

### Core Lifecycle (7 commands)

These commands form the linear workflow from project initialization to merge:

```
INIT --> START-SET --> DISCUSS-SET --> PLAN-SET --> EXECUTE-SET --> REVIEW --> MERGE
```

---

#### `/rapid:init`

Bootstraps a new RAPID project. Handles both greenfield projects (no existing code) and brownfield projects (existing codebase to analyze).

**What it does:**

1. Validates prerequisites (Node.js, git, RAPID_TOOLS)
2. Runs an adaptive 4-batch discovery conversation to gather project context (vision, features, technical constraints, success criteria)
3. For brownfield projects, spawns a `rapid-codebase-synthesizer` agent to analyze existing code
4. Spawns 6 parallel research agents (stack, features, architecture, pitfalls, oversights, UX)
5. Synthesizes research into a unified RESEARCH.md
6. Generates a roadmap with sets through a propose-then-approve loop

**Arguments:** None. Interactive discovery gathers all inputs.

**Output:**

```
.planning/
  PROJECT.md          -- Project description and core value
  REQUIREMENTS.md     -- Requirements extracted from discovery
  ROADMAP.md          -- Sets with dependency ordering
  STATE.json          -- Machine-readable state (set-level)
  CONTRACT.json       -- Interface contracts between sets
  config.json         -- Project configuration
  research/           -- Individual research outputs
```

**Agents spawned:** Up to 9 (codebase-synthesizer + 6 researchers + synthesizer + roadmapper)

---

#### `/rapid:start-set <set-id>`

Claims a set for development by creating an isolated git worktree and branch (`rapid/{set-name}`).

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `set-id` | string or number | _(required)_ | Set name (e.g., `auth-system`) or numeric index (e.g., `1`) |

**What it does:**

1. Resolves the set reference (numeric shorthand or string ID)
2. Validates the set is in `pending` status
3. Creates a git worktree at `.rapid-worktrees/{set-name}/` on branch `rapid/{set-name}`
4. Generates a scoped CLAUDE.md with set-specific context and deny lists
5. Spawns a `rapid-set-planner` agent to produce SET-OVERVIEW.md

**Workflow context:** Run this after `/rapid:init`. Each developer runs `start-set` for their assigned set. The worktree provides complete isolation -- changes in one set never affect another.

---

#### `/rapid:discuss-set <set-id> [--skip]`

Captures developer implementation vision for a set before planning begins.

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `set-id` | string or number | _(required)_ | Set name or numeric index |
| `--skip` | flag | _(off)_ | Auto-generate CONTEXT.md without user interaction |

**What it does:**

1. Identifies exactly 4 gray areas where multiple valid approaches exist
2. Asks batched questions (2-3 per area) for each selected gray area
3. Records decisions in CONTEXT.md for the planner to consume

**With `--skip`:** Spawns a `rapid-research-stack` agent to auto-generate CONTEXT.md from the roadmap and codebase scan. No user interaction required.

**State transition:** `pending` --> `discussing`

---

#### `/rapid:plan-set <set-id>`

Plans all waves in a set using a 3-step pipeline. Fully autonomous -- no user interaction during the normal flow.

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `set-id` | string or number | _(required)_ | Set name or numeric index |

**Pipeline:**

1. **Research** -- `rapid-research-stack` investigates implementation specifics
2. **Planning** -- `rapid-planner` decomposes the set into 1-4 waves with per-wave PLAN.md files
3. **Verification** -- `rapid-plan-verifier` validates coverage, implementability, and consistency

If verification fails, the planner re-runs once automatically. After a second failure, the user chooses to override or cancel.

Contract validation runs after planning completes (advisory during planning, enforced at merge).

**Output:**

```
.planning/sets/{set-name}/
  wave-1-PLAN.md          -- Tasks for wave 1
  wave-2-PLAN.md          -- Tasks for wave 2 (if multi-wave)
  VERIFICATION-REPORT.md  -- Plan verifier report
```

**Agents spawned:** 3-4 (researcher + planner + verifier, optionally +1 re-plan)

**State transition:** `discussing` --> `planning`

---

#### `/rapid:execute-set <set-id>`

Executes all waves in a set sequentially. One `rapid-executor` agent per wave.

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `set-id` | string or number | _(required)_ | Set name or numeric index |

**What it does:**

1. Reads all PLAN.md files to determine wave count and order
2. Detects completed waves via WAVE-COMPLETE.md markers and git commit verification (enables crash recovery)
3. For each incomplete wave, spawns one `rapid-executor` agent
4. After all waves complete, spawns a `rapid-verifier` agent to check objectives

**Re-entry after crash:** On every invocation, the skill scans for existing commits against planned tasks. Completed waves are skipped. The first incomplete wave resumes from its last committed task.

**Agents spawned:** 1 per wave + 1 verifier

**State transition:** `planning` --> `executing` --> `complete`

---

#### `/rapid:review <set-id>`

Validates a completed set through a multi-stage adversarial review pipeline. Review operates at the set level -- all changed files across all waves are scoped together.

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `set-id` | string or number | _(required)_ | Set name or numeric index |

**Pipeline stages (user selects which to run):**

1. **Scoping** -- `rapid-scoper` diffs the set branch against main, categorizes files into concern groups
2. **Unit testing** -- `rapid-unit-tester` agents generate test plans and execute tests (one per concern group, parallel)
3. **Bug hunting** -- Three-stage adversarial pipeline with up to 3 fix-and-rehunt cycles:
   - `rapid-bug-hunter` finds bugs (parallel per concern group)
   - `rapid-devils-advocate` challenges each finding with counter-evidence
   - `rapid-judge` rules: ACCEPTED, DISMISSED, or DEFERRED
   - `rapid-bugfix` fixes accepted bugs
   - Cycles 2-3 narrow scope to only modified files
4. **UAT** -- `rapid-uat` generates acceptance test plans with automated (browser) and human-verified steps

**Output:**

```
REVIEW-UNIT.md       -- Unit test results
REVIEW-BUGS.md       -- Bug findings with verdicts
REVIEW-UAT.md        -- UAT results
REVIEW-SUMMARY.md    -- Consolidated review summary
```

**Agents spawned:** Variable (scoper + unit-testers + bug-hunters + devils-advocate + judge + bugfix + uat)

---

#### `/rapid:merge [set-id]`

Merges completed and reviewed set branches into main. Sets merge in dependency order defined by the DAG.

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `set-id` | string or number | _(optional)_ | Specific set to merge (with its dependencies). Omit to merge all ready sets. |

**Clean merge fast-path:** Before dispatching any subagent, `git merge-tree --write-tree` tests for conflicts. If clean (exit code 0), no subagent needed -- the set merges directly.

**Conflicting merges:** A `rapid-set-merger` subagent runs 5-level conflict detection:

| Level | Type | Description |
|-------|------|-------------|
| L1 | Textual | Line-level conflicts in the same file |
| L2 | Structural | Incompatible code structure changes |
| L3 | Dependency | Conflicting package or import changes |
| L4 | API | Breaking interface changes between sets |
| L5 | Semantic | Logically incompatible behavior changes |

**Resolution uses a 4-tier cascade:**

| Tier | Confidence | Action |
|------|-----------|--------|
| T1 | > 0.9 | Auto-resolved, no review |
| T2 | 0.7 - 0.9 | Auto-resolved, flagged for review |
| T3 | 0.3 - 0.7 | Dispatched to `rapid-conflict-resolver` for deep analysis |
| T4 | < 0.3 | Escalated to developer |

API-signature conflicts always escalate to the developer regardless of confidence. Post-wave integration testing with automatic bisection recovery identifies breaking sets if tests fail.

**State transition:** `complete` --> `merged` (terminal)

---

### Auxiliary (4 commands)

#### `/rapid:status`

Read-only dashboard showing all sets with statuses, last git activity per branch, and actionable next-step suggestions. Supports numeric shorthand for suggested actions.

#### `/rapid:install`

One-time setup: detects shell (bash, zsh, fish, POSIX), writes `RAPID_TOOLS` to shell config, creates `.env` fallback, validates toolchain, and runs agent file generation.

#### `/rapid:new-version`

Completes the current milestone and starts a new planning cycle. Reads current state, gathers new milestone details, handles unfinished sets with carry-forward options, and re-runs the full 6-researcher pipeline scoped to new goals. Generates a new roadmap through the propose-then-approve loop.

#### `/rapid:add-set <set-name>`

Adds a new set to the current milestone mid-stream through a lightweight 2-question discovery flow. Creates DEFINITION.md and CONTRACT.json, updates STATE.json and ROADMAP.md. No subagent spawns.

---

### Utilities (6 commands)

#### `/rapid:quick <description>`

Ad-hoc changes without set structure. Runs a 3-agent pipeline (planner, plan-verifier, executor) in-place on the current branch. Fully autonomous after the initial task description. Quick tasks are stored in `.planning/quick/` and excluded from STATE.json.

#### `/rapid:assumptions <set-id>`

Read-only skill that surfaces Claude's mental model about a set's implementation. Presents scope understanding, file boundaries, contract assumptions, dependency assumptions, and risk factors for developer validation before execution begins.

#### `/rapid:pause <set-id>`

Saves execution state to HANDOFF.md for later resumption. Records current wave/job progress, user notes, and checkpoint data. Warns after 3 pause cycles that the set scope may be too large.

#### `/rapid:resume <set-id>`

Resumes a paused set from its last checkpoint. Loads HANDOFF.md context, presents the handoff summary, and transitions the set back to executing phase.

#### `/rapid:context`

Analyzes existing codebase and generates context files. Spawns a `rapid-context-generator` agent for deep analysis, then writes CLAUDE.md (under 80 lines), CODEBASE.md, ARCHITECTURE.md, CONVENTIONS.md, and STYLE_GUIDE.md. Re-runnable at any time.

#### `/rapid:cleanup <set-id>`

Removes a completed set's worktree with safety checks (blocks on uncommitted changes). Offers optional branch deletion with double-confirmation for unmerged branches.

---

## Architecture Overview

RAPID v3.0 structures parallel work around **sets** -- independent workstreams that each developer owns end-to-end. Sets are the sole stateful entity; there is no wave or task state in STATE.json.

### Agent Dispatch

Skills dispatch agents directly -- there is no central coordination agent. Each command spawns exactly the agents it needs. 26 agents are organized into 6 categories:

- **Core (4):** planner, executor, merger, reviewer -- hand-written, never overwritten by the build pipeline
- **Research (7):** 6 domain researchers (stack, features, architecture, pitfalls, oversights, UX) + 1 synthesizer -- run in parallel during `/rapid:init` and `/rapid:new-version`
- **Review (7):** scoper, unit-tester, bug-hunter, devils-advocate, judge, bugfix, uat -- run the adversarial review pipeline
- **Merge (2):** set-merger (5-level detection), conflict-resolver (deep analysis for mid-confidence conflicts)
- **Utility (5):** roadmapper, set-planner, plan-verifier, verifier, codebase-synthesizer
- **Context (1):** context-generator

### Interface Contracts

Sets connect through `CONTRACT.json` -- machine-verifiable specifications that define which functions, types, and endpoints each set exposes. Contracts are validated after planning, during execution, and before merge.

### State Machine

```
pending --> discussing --> planning --> executing --> complete --> merged
```

Sets are fully independent. No state transition rejects based on another set's status. Crash recovery is built in: `detectCorruption` identifies bad state, `recoverFromGit` restores the last good commit, and atomic writes prevent partial STATE.json corruption.

### Data Flow

1. `/rapid:init` gathers project context, runs 6 parallel researchers, synthesizes findings, and generates a roadmap with sets
2. `/rapid:start-set` creates an isolated worktree and branch for one set
3. `/rapid:discuss-set` captures implementation vision into CONTEXT.md
4. `/rapid:plan-set` runs researcher -> planner -> verifier pipeline to produce per-wave PLAN.md files
5. `/rapid:execute-set` runs one executor per wave sequentially, with artifact-based crash recovery
6. `/rapid:review` validates through unit tests, adversarial bug hunting, and UAT
7. `/rapid:merge` integrates sets into main with 5-level conflict detection and 4-tier resolution

---

## File Structure

```
RAPID/
├── skills/                          # Skill definitions (one per command)
│   ├── init/
│   │   └── SKILL.md                 # /rapid:init orchestration logic
│   ├── start-set/
│   │   └── SKILL.md                 # /rapid:start-set
│   ├── discuss-set/
│   │   └── SKILL.md                 # /rapid:discuss-set
│   ├── plan-set/
│   │   └── SKILL.md                 # /rapid:plan-set
│   ├── execute-set/
│   │   └── SKILL.md                 # /rapid:execute-set
│   ├── review/
│   │   └── SKILL.md                 # /rapid:review pipeline
│   ├── merge/
│   │   └── SKILL.md                 # /rapid:merge pipeline
│   ├── status/
│   │   └── SKILL.md                 # /rapid:status dashboard
│   ├── install/
│   │   └── SKILL.md                 # /rapid:install setup
│   ├── new-version/
│   │   └── SKILL.md                 # /rapid:new-version milestone
│   ├── add-set/
│   │   └── SKILL.md                 # /rapid:add-set
│   ├── quick/
│   │   └── SKILL.md                 # /rapid:quick ad-hoc tasks
│   ├── assumptions/
│   │   └── SKILL.md                 # /rapid:assumptions
│   ├── pause/
│   │   └── SKILL.md                 # /rapid:pause
│   ├── resume/
│   │   └── SKILL.md                 # /rapid:resume
│   ├── context/
│   │   └── SKILL.md                 # /rapid:context
│   ├── cleanup/
│   │   └── SKILL.md                 # /rapid:cleanup
│   └── help/
│       └── SKILL.md                 # /rapid:help static reference
├── src/
│   └── bin/
│       └── rapid-tools.cjs          # CLI tool library
├── agents/                          # Generated agent definitions
├── .claude-plugin/
│   └── plugin.json                  # Plugin manifest
├── package.json
├── setup.sh                         # Installation script
├── README.md                        # User-facing overview
├── DOCS.md                          # This file
└── technical_documentation.md       # Deep technical reference
```

### Key Files

#### `src/bin/rapid-tools.cjs`

- **Purpose:** CLI tool library that all skills invoke via `node "${RAPID_TOOLS}" <command>`
- **Format:** CommonJS module with subcommands for state management, worktree operations, merge pipeline, review scoping, and more
- **Lifecycle:** Referenced by every skill through the `RAPID_TOOLS` environment variable

#### `.planning/STATE.json`

- **Purpose:** Machine-readable project state tracking sets and their statuses
- **Format:** JSON with `milestones[].sets[]` hierarchy (set-level only, no wave/task state)
- **Lifecycle:** Created by `/rapid:init`, updated by state transition commands, protected by file-level locking

#### `.planning/ROADMAP.md`

- **Purpose:** Human-readable project roadmap with set descriptions and dependencies
- **Format:** Markdown with per-set sections
- **Lifecycle:** Created by the roadmapper agent during `/rapid:init`, updated by `/rapid:add-set` and `/rapid:new-version`

#### `CONTRACT.json` (per set)

- **Purpose:** Machine-verifiable interface contracts defining exports, imports, and file ownership
- **Format:** JSON with `exports.functions[]`, `exports.types[]`, `imports`, and `fileOwnership` arrays
- **Lifecycle:** Created by the roadmapper during `/rapid:init`, populated during `/rapid:plan-set`, validated during merge

---

## Practical Tips

### Working with Multiple Sets

- Use numeric shorthand for commands: `/rapid:start-set 1`, `/rapid:execute-set 2`. The number maps to the set's alphabetical position.
- Run `/rapid:status` frequently to see which sets need attention and what command to run next.
- Each developer should work in their own set's worktree. Sets are fully independent -- starting, executing, or merging one set never blocks another.

### Crash Recovery

- If execution crashes mid-wave, simply re-run `/rapid:execute-set`. The skill detects completed waves via WAVE-COMPLETE.md markers and git commit verification, resuming from the first incomplete wave.
- If planning crashes, re-run `/rapid:plan-set`. The skill is idempotent and will overwrite incomplete plan files.
- If merge crashes, re-run `/rapid:merge`. MERGE-STATE.json tracks which sets have been processed for idempotent re-entry.

### Optimizing Agent Costs

- The adversarial bug hunt is the most expensive review stage. Use stage selection in `/rapid:review` to run only the stages you need.
- Concern-based scoping (automatic) reduces redundant analysis by grouping related files together.
- The `--skip` flag on `/rapid:discuss-set` saves a full interactive session when you trust Claude's defaults.
- `/rapid:quick` uses only 3 agent spawns for ad-hoc changes, avoiding the full set lifecycle overhead.

### Deprecated Commands

These v2 commands have been replaced. Running them shows migration guidance:

| Old Command | Replacement |
|-------------|-------------|
| `/rapid:set-init` | `/rapid:start-set` |
| `/rapid:discuss` | `/rapid:discuss-set` |
| `/rapid:execute` | `/rapid:execute-set` |
| `/rapid:plan` | `/rapid:plan-set` |
| `/rapid:wave-plan` | `/rapid:plan-set` |
| `/rapid:new-milestone` | `/rapid:new-version` |
