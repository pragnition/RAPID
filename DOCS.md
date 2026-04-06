# RAPID -- Technical Reference

RAPID (Rapid Agentic Parallelizable and Isolatable Development) is a Claude Code plugin that enables coordinated parallel AI-assisted development. It structures work around independent sets -- each running in an isolated git worktree with strict file ownership -- connected through machine-verifiable interface contracts and validated through a multi-stage adversarial review pipeline. 27 specialized agents handle research, planning, execution, review, and merge so developers focus on decisions, not coordination.

**Version:** 6.0.0

This is the central reference hub for RAPID. For a quickstart overview, see [README.md](README.md). For architectural deep-dives and system design narrative, see [technical_documentation.md](technical_documentation.md).

## Table of Contents

- [Installation](#installation) -- [docs/setup.md](docs/setup.md)
- [Session Management](#session-management) -- /clear pattern, footer behavior, context hygiene
- [Core Lifecycle](#core-lifecycle)
  - [Getting Started](#getting-started): install, init
  - [Set Lifecycle](#set-lifecycle): start-set, discuss-set, plan-set, execute-set
  - [Review Pipeline](#review-pipeline): review, unit-test, bug-hunt, uat
  - [Integration](#integration): merge
- [Project Management](#project-management): status, new-version, add-set
- [Workflow Helpers](#workflow-helpers): pause, resume, quick, bug-fix, assumptions
- [Analysis & Generation](#analysis--generation): context, documentation, scaffold, audit-version, branding, migrate
- [Reference](#reference): help, cleanup, register-web
- [Architecture Overview](#architecture-overview) -- [docs/agents.md](docs/agents.md), [docs/state-machines.md](docs/state-machines.md)
- [Configuration](#configuration) -- [docs/configuration.md](docs/configuration.md)
- [File Structure](#file-structure)
- [Practical Tips](#practical-tips)
- [Troubleshooting](#troubleshooting) -- [docs/troubleshooting.md](docs/troubleshooting.md)
- [Changelog](#changelog) -- [docs/CHANGELOG.md](docs/CHANGELOG.md)
- [Deprecated Commands](#deprecated-commands)

---

## Installation

### Plugin Marketplace (Primary)

```
claude plugin add pragnition/RAPID
```

Then run `/rapid:install` from within Claude Code to complete setup. This configures the `RAPID_TOOLS` environment variable needed by all RAPID commands.

### Git Clone

```bash
git clone https://github.com/pragnition/RAPID.git
cd RAPID
./setup.sh
```

The `setup.sh` script installs dependencies, configures `RAPID_TOOLS`, and runs `build-agents` to generate agent definition files.

### Requirements

- **Node.js 22+** (runtime for tool libraries)
- **git 2.30+** (required for worktree support)
- **RAPID_TOOLS env var** must be set (both installation methods handle this)
- npm dependencies are bundled in `node_modules/`

For full setup details, see [docs/setup.md](docs/setup.md).

---

## Session Management

RAPID commands spawn specialized agents that consume significant context. After each command completes, the context window is filled with agent output, planning artifacts, and execution logs. Running `/clear` between commands resets the context window so the next command starts fresh, focused on its own task rather than carrying stale context from the previous step. This is the core mechanism that prevents context rot -- the degradation that occurs when too much prior conversation competes for the model's attention.

### The Footer Box

After every lifecycle command that produces artifacts, RAPID displays a bordered box containing:

- "Run /clear before continuing"
- The suggested next command (e.g., "Next: /rapid:plan-set 1")
- An optional progress breadcrumb showing the current stage

This footer is produced by `renderFooter()` in `src/lib/display.cjs`.

### Commands That Show the Footer (17 of 28)

All core lifecycle commands: init, start-set, discuss-set, plan-set, execute-set, review, merge. Review sub-pipeline: unit-test, bug-hunt, uat. Project management: new-version, add-set. Generation: scaffold, audit-version, branding, documentation, quick, bug-fix.

### Commands That Do NOT Show the Footer (10 of 28)

Informational: help, status, assumptions. Setup and maintenance: install, cleanup, pause, resume, context, migrate, register-web. These commands produce no artifacts and consume minimal context, so clearing after them is unnecessary.

### The Pattern in Practice

A typical session looks like this:

```
/rapid:start-set 1
/clear
/rapid:discuss-set 1
/clear
/rapid:plan-set 1
```

If you skip `/clear`, RAPID still works -- but command quality degrades as the session gets longer. The footer is a strong recommendation, not a hard gate.

For the technical specification of which skills include footers and why, see the CLEAR-POLICY in the planning directory.

---

## Core Lifecycle

These commands form the linear workflow from project initialization to merge:

```
INIT --> START-SET --> DISCUSS-SET --> PLAN-SET --> EXECUTE-SET --> REVIEW --> MERGE
                                                                     |
                                                          unit-test, bug-hunt, uat
```

### Getting Started

---

#### `/rapid:install`

Bootstraps the RAPID plugin by detecting your shell (bash, zsh, fish, or POSIX), writing `RAPID_TOOLS` to your shell config, creating a `.env` fallback, and running agent file generation. Handles both marketplace and git clone installations.

```bash
/rapid:install
```

See [docs/setup.md](docs/setup.md) for details.

---

#### `/rapid:init`

Bootstraps a new RAPID project. Validates prerequisites, runs a 4-batch discovery conversation to gather project context, spawns 6 parallel research agents (stack, features, architecture, pitfalls, oversights, UX), synthesizes findings, and generates a roadmap with sets through a propose-then-approve loop. For brownfield projects, a codebase synthesizer analyzes existing code first.

```bash
/rapid:init
```

See [docs/planning.md](docs/planning.md) for details.

---

### Set Lifecycle

---

#### `/rapid:start-set <set-id>`

Claims a set for development by creating an isolated git worktree and branch (`rapid/{set-name}`). Generates a scoped CLAUDE.md with set-specific contracts and deny lists, then spawns a `rapid-set-planner` agent to produce SET-OVERVIEW.md. Supports both string names and numeric indices.

```bash
/rapid:start-set auth-system
/rapid:start-set 1
```

See [docs/planning.md](docs/planning.md) for details.

---

#### `/rapid:discuss-set <set-id> [--skip]`

Captures developer implementation vision for a set before planning begins. Identifies exactly 4 gray areas where multiple valid approaches exist, then asks batched questions for each. Records decisions in CONTEXT.md for the planner. With `--skip`, auto-generates CONTEXT.md without user interaction.

```bash
/rapid:discuss-set auth-system
/rapid:discuss-set 1 --skip
```

See [docs/planning.md](docs/planning.md) for details.

---

#### `/rapid:plan-set <set-id> [--gaps]`

Plans all waves in a set using a 3-step pipeline: researcher, planner, verifier. Produces per-wave PLAN.md files with tasks, file assignments, and acceptance criteria. If verification fails, the planner re-runs once automatically. The `--gaps` flag enables gap-closure mode for addressing post-merge gaps.

```bash
/rapid:plan-set auth-system
/rapid:plan-set 2 --gaps
```

See [docs/planning.md](docs/planning.md) for details.

---

#### `/rapid:execute-set <set-id> [--gaps]`

Executes all waves in a set sequentially, spawning one `rapid-executor` agent per wave. Uses artifact-based crash recovery -- re-running after an interruption picks up exactly where it left off via WAVE-COMPLETE.md markers and git commit verification. After all waves complete, a `rapid-verifier` agent checks objectives. The `--gaps` flag enables gap-closure mode, executing plans generated from post-merge gap analysis (GAPS.md).

```bash
/rapid:execute-set auth-system
/rapid:execute-set 1
/rapid:execute-set auth-system --gaps
```

See [docs/execution.md](docs/execution.md) for details.

---

### Review Pipeline

The review pipeline is split into 4 separate skills. First, `/rapid:review` scopes the review. Then `/rapid:unit-test`, `/rapid:bug-hunt`, and `/rapid:uat` each run independently against the produced scope.

---

#### `/rapid:review <set-id>`

Scopes a completed set for review by diffing the set branch against main, identifying changed files and their dependents, and producing `REVIEW-SCOPE.md`. This artifact is consumed by the downstream review skills. Does not run tests or hunt bugs itself.

```bash
/rapid:review auth-system
/rapid:review 1
```

See [docs/review.md](docs/review.md) for details.

---

#### `/rapid:unit-test <set-id>`

Runs the unit test pipeline on a scoped set. Reads `REVIEW-SCOPE.md` as input, generates test plans, and executes tests using the configured test framework. Results are written to `REVIEW-UNIT.md`. Spawns `rapid-unit-tester` agents per concern group.

```bash
/rapid:unit-test auth-system
```

See [docs/review.md](docs/review.md) for details.

---

#### `/rapid:bug-hunt <set-id>`

Runs the adversarial bug hunt pipeline on a scoped set. Uses a hunter-advocate-judge pattern with up to 3 iterative fix-and-rehunt cycles. Reads `REVIEW-SCOPE.md` as input. Accepted bugs are dispatched to `rapid-bugfix` for targeted fixes. Results are written to `REVIEW-BUGS.md`.

```bash
/rapid:bug-hunt auth-system
```

See [docs/review.md](docs/review.md) for details.

---

#### `/rapid:uat <set-id>`

Runs user acceptance testing on a scoped set. Reads `REVIEW-SCOPE.md` as input. Generates acceptance test plans with automated (browser automation) and human-verified steps. Runs once on the full scope without concern-scoping. Results are written to `REVIEW-UAT.md`.

```bash
/rapid:uat auth-system
```

See [docs/review.md](docs/review.md) for details.

---

### Integration

---

#### `/rapid:merge [set-id]`

Merges completed set branches into main in DAG dependency order. Clean merges skip subagent dispatch via `git merge-tree` fast-path. Conflicting merges use `rapid-set-merger` agents with 5-level conflict detection and a 4-tier resolution cascade. API-signature conflicts always escalate to the developer.

```bash
/rapid:merge
/rapid:merge auth-system
```

See [docs/merge-and-cleanup.md](docs/merge-and-cleanup.md) for details.

---

## Project Management

---

#### `/rapid:status`

Read-only dashboard showing all sets with statuses, last git activity per branch, and actionable next-step suggestions. Displays sets in DAG wave order. Supports numeric shorthand for suggested actions.

```bash
/rapid:status
```

---

#### `/rapid:new-version [--spec <path>]`

Completes the current milestone and starts a new planning cycle. Archives current state, gathers new goals (or reads them from a spec file), handles unfinished sets with carry-forward options, and re-runs the full 6-researcher pipeline. Auto-discovers DEFERRED.md files and includes them in researcher briefs.

```bash
/rapid:new-version
/rapid:new-version --spec goals.md
```

See [docs/merge-and-cleanup.md](docs/merge-and-cleanup.md) for details.

---

#### `/rapid:add-set <set-name>`

Adds a new set to the current milestone mid-stream through a lightweight 2-question discovery flow. Creates DEFINITION.md and CONTRACT.json, updates STATE.json and ROADMAP.md. No subagent spawns.

```bash
/rapid:add-set payment-system
```

---

## Workflow Helpers

---

#### `/rapid:pause <set-id>`

Saves execution state to HANDOFF.md for later resumption. Records current wave/job progress, user notes, and checkpoint data. Warns after 3 pause cycles that the set scope may be too large.

```bash
/rapid:pause auth-system
```

---

#### `/rapid:resume <set-id>`

Resumes a paused set from its last checkpoint. Loads HANDOFF.md context, presents the handoff summary, and transitions the set back to executing phase.

```bash
/rapid:resume auth-system
```

---

#### `/rapid:quick <description>`

Ad-hoc changes without set structure. Runs a 3-agent pipeline (planner, plan-verifier, executor) in-place on the current branch. Fully autonomous after the initial task description. Quick tasks are stored in `.planning/quick/` and excluded from STATE.json.

```bash
/rapid:quick "add error handling to the config loader"
```

---

#### `/rapid:bug-fix <description> [--uat <set-id>]`

Investigates and fixes bugs. The user describes a bug, and the skill dispatches agents to investigate the codebase and apply a targeted fix with atomic commits. Works from any branch -- no set association required. With `--uat <set-id>`, reads `UAT-FAILURES.md` from the set's planning directory and fixes reported failures automatically without manual investigation.

```bash
/rapid:bug-fix "merge command fails when .planning/ has untracked files"
/rapid:bug-fix --uat auth-system
```

See [docs/review.md](docs/review.md) for details on the UAT-to-bug-fix workflow.

---

#### `/rapid:assumptions <set-id>`

Read-only skill that surfaces Claude's mental model about a set's implementation. Presents scope understanding, file boundaries, contract assumptions, dependency assumptions, and risk factors for developer validation before execution begins.

```bash
/rapid:assumptions auth-system
```

---

## Analysis & Generation

---

#### `/rapid:context`

Analyzes existing codebase and generates context files. Spawns a `rapid-context-generator` agent for deep analysis, then writes CLAUDE.md (under 80 lines) plus CODEBASE.md, ARCHITECTURE.md, CONVENTIONS.md, and STYLE_GUIDE.md in `.planning/context/`. Re-runnable at any time.

```bash
/rapid:context
```

---

#### `/rapid:documentation [--scope <full|changelog|api|architecture>] [--diff-only]`

Generates and updates project documentation from git history and RAPID artifacts. Supports scoped generation (changelog, API, architecture) and diff-only mode for previewing changes without writing files. Extracts changelogs from ROADMAP.md set descriptions.

```bash
/rapid:documentation
/rapid:documentation --scope changelog
```

See [docs/auxiliary.md](docs/auxiliary.md) for details.

---

#### `/rapid:scaffold`

Generates project-type-aware foundation files for the target codebase. Detects the project type (Node.js, Python, etc.) and scaffolds appropriate directory structure, config files, and boilerplate. Additive-only -- existing files are never overwritten.

```bash
/rapid:scaffold
```

See [docs/auxiliary.md](docs/auxiliary.md) for details.

---

#### `/rapid:audit-version [version]`

Audits a completed milestone by cross-referencing planned requirements against actual delivery. Produces a structured gap report at `.planning/v{version}-AUDIT.md`. Read-only -- never mutates state. Offers remediation through `/rapid:add-set` or deferral for the next version.

```bash
/rapid:audit-version
/rapid:audit-version v4.1.0
```

See [docs/auxiliary.md](docs/auxiliary.md) for details.

---

#### `/rapid:branding`

Conducts a structured branding interview to capture visual identity, component style, terminology, and interaction preferences. Generates a BRANDING.md artifact that shapes how all RAPID agents communicate and style their output. Optional -- use before frontend-heavy sets.

```bash
/rapid:branding
```

See [docs/auxiliary.md](docs/auxiliary.md) for details.

---

#### `/rapid:migrate [--dry-run]`

Migrates `.planning/` state from older RAPID versions to the current version. Detects the current version, compares against the running RAPID version, and guides an interactive migration. Handles schema changes, status renames, and structural updates. Supports dry-run mode to preview changes.

```bash
/rapid:migrate
/rapid:migrate --dry-run
```

See [docs/auxiliary.md](docs/auxiliary.md) for details.

---

## Reference

---

#### `/rapid:help`

Displays a static command reference with the full workflow diagram, all 28 commands organized by category, and usage guidance. No project analysis or state checking -- purely informational.

```bash
/rapid:help
```

---

#### `/rapid:cleanup <set-id>`

Removes a completed set's worktree with safety checks (blocks on uncommitted changes). Offers optional branch deletion with double-confirmation for unmerged branches.

```bash
/rapid:cleanup auth-system
```

See [docs/merge-and-cleanup.md](docs/merge-and-cleanup.md) for details.

---

#### `/rapid:register-web`

Registers the current project with the RAPID Mission Control web dashboard. Only needed for projects initialized before v4.1.0. New projects auto-register during `/rapid:init` when `RAPID_WEB=true` is set.

```bash
/rapid:register-web
```

---

## Architecture Overview

RAPID v6.0.0 structures parallel work around **sets** -- independent workstreams that each developer owns end-to-end. Sets are the sole stateful entity; there is no wave or task state in STATE.json.

### How It Works

**Research pipeline.** `/rapid:init` runs a structured discovery conversation, spawns 6 parallel researchers (stack, features, architecture, pitfalls, oversights, UX) to analyze the project, synthesizes findings, and generates a roadmap with sets.

**Isolation.** `/rapid:start-set` creates a dedicated git worktree per set so each agent works in its own copy of the repo.

**Discussion.** `/rapid:discuss-set` captures implementation vision and design decisions into CONTEXT.md before planning begins.

**Interface contracts.** Sets connect through `CONTRACT.json` -- machine-verifiable specs defining which functions, types, and endpoints each set exposes. Contracts are validated after planning, during execution, and before merge.

**Planning.** `/rapid:plan-set` runs researcher, planner, and verifier agents to produce per-wave PLAN.md files.

**Execution.** `/rapid:execute-set` runs one executor per wave with atomic commits and artifact-based crash recovery.

**Review pipeline.** Four sequential stages: scoping, unit tests, adversarial bug hunt (hunter/advocate/judge, up to 3 rounds), and acceptance testing.

**Merge.** `/rapid:merge` detects conflicts at 5 levels and resolves them through a confidence cascade.

### Agent Dispatch

Skills dispatch agents directly -- there is no central coordination agent. Each command spawns exactly the agents it needs. 27 agents are organized into 7 categories:

- **Core (4):** planner, executor, merger, reviewer
- **Research (7):** 6 domain researchers (stack, features, architecture, pitfalls, oversights, UX) + 1 synthesizer
- **Review (7):** scoper, unit-tester, bug-hunter, devils-advocate, judge, bugfix, uat
- **Merge (2):** set-merger, conflict-resolver
- **Utility (6):** roadmapper, set-planner, plan-verifier, verifier, codebase-synthesizer, auditor
- **Context (1):** context-generator

For the full agent catalog with spawn hierarchy and input/output specifications, see [docs/agents.md](docs/agents.md).

### State Machine

```
pending --> discussed --> planned --> executed --> complete --> merged
              ^                        ^
              |                        |
              +-- (self-loop)          +-- (self-loop)
```

The `pending -> planned` shortcut skips the discuss phase when no design discussion is needed. The `discussed -> discussed` self-loop supports re-discussion, and the `executed -> executed` self-loop enables crash recovery re-execution. In solo mode, `complete -> merged` auto-transitions without branch merging.

Sets are fully independent. No state transition rejects based on another set's status. For full transition rules and crash recovery details, see [docs/state-machines.md](docs/state-machines.md).

### Data Flow

1. `/rapid:init` gathers project context, runs 6 parallel researchers, synthesizes findings, and generates a roadmap with sets
2. `/rapid:start-set` creates an isolated worktree and branch for one set
3. `/rapid:discuss-set` captures implementation vision into CONTEXT.md
4. `/rapid:plan-set` runs researcher -> planner -> verifier pipeline to produce per-wave PLAN.md files
5. `/rapid:execute-set` runs one executor per wave sequentially, with artifact-based crash recovery
6. `/rapid:review` scopes the set for review; then `/rapid:unit-test`, `/rapid:bug-hunt`, `/rapid:uat` run independently
7. `/rapid:merge` integrates sets into main with 5-level conflict detection and 4-tier resolution

---

## File Structure

```
RAPID/
├── skills/                          # Skill definitions (one per command)
│   ├── add-set/
│   ├── assumptions/
│   ├── audit-version/
│   ├── branding/
│   ├── bug-fix/
│   ├── bug-hunt/
│   ├── cleanup/
│   ├── context/
│   ├── discuss-set/
│   ├── documentation/
│   ├── execute-set/
│   ├── help/
│   ├── init/
│   ├── install/
│   ├── merge/
│   ├── migrate/
│   ├── new-version/
│   ├── pause/
│   ├── plan-set/
│   ├── quick/
│   ├── register-web/
│   ├── resume/
│   ├── review/
│   ├── scaffold/
│   ├── start-set/
│   ├── status/
│   ├── uat/
│   └── unit-test/
├── agents/                          # 27 generated agent definitions
├── src/
│   ├── bin/
│   │   └── rapid-tools.cjs          # CLI tool library
│   ├── commands/                    # CLI command handlers
│   ├── hooks/                       # Post-task verification hooks
│   ├── lib/                         # Core libraries (state, merge, worktree, etc.)
│   ├── modules/                     # Role definitions and core modules
│   └── schemas/                     # Zod validation schemas
├── docs/                            # Detailed documentation (11 files)
├── web/                             # Mission Control dashboard source
├── branding/                        # Branding assets
├── test/                            # Test suites
├── .claude-plugin/
│   └── plugin.json                  # Plugin manifest
├── config.json                      # Project configuration
├── package.json
├── setup.sh                         # Installation script
├── README.md                        # User-facing overview
├── DOCS.md                          # This file (central reference hub)
└── technical_documentation.md       # Architectural deep-dive narrative
```

---

## Practical Tips

### Working with Multiple Sets

- Use numeric shorthand for commands: `/rapid:start-set 1`, `/rapid:execute-set 2`. The number maps to the set's position in DAG wave order.
- Run `/rapid:status` frequently to see which sets need attention and what command to run next.
- Each developer should work in their own set's worktree. Sets are fully independent -- starting, executing, or merging one set never blocks another.

### Crash Recovery

- If execution crashes mid-wave, simply re-run `/rapid:execute-set`. The skill detects completed waves via WAVE-COMPLETE.md markers and git commit verification, resuming from the first incomplete wave.
- If planning crashes, re-run `/rapid:plan-set`. The skill is idempotent and will overwrite incomplete plan files.
- If merge crashes, re-run `/rapid:merge`. MERGE-STATE.json tracks which sets have been processed for idempotent re-entry.

### Review Pipeline

- First run `/rapid:review` to scope the set and produce REVIEW-SCOPE.md.
- Then run `/rapid:unit-test`, `/rapid:bug-hunt`, and `/rapid:uat` independently -- they each read REVIEW-SCOPE.md.
- You can run any combination of the three review skills based on your needs.

### Optimizing Agent Costs

- The adversarial bug hunt is the most expensive review stage. Skip it for low-risk changes.
- Concern-based scoping (automatic) reduces redundant analysis by grouping related files together.
- The `--skip` flag on `/rapid:discuss-set` saves a full interactive session when you trust Claude's defaults.
- `/rapid:quick` uses only 3 agent spawns for ad-hoc changes, avoiding the full set lifecycle overhead.

---

## Deprecated Commands

These v2 commands have been replaced. Running them shows migration guidance:

| Old Command | Replacement |
|-------------|-------------|
| `/rapid:set-init` | `/rapid:start-set` |
| `/rapid:discuss` | `/rapid:discuss-set` |
| `/rapid:execute` | `/rapid:execute-set` |
| `/rapid:plan` | `/rapid:plan-set` |
| `/rapid:wave-plan` | `/rapid:plan-set` |
| `/rapid:new-milestone` | `/rapid:new-version` |
