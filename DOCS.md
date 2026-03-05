# RAPID - Plugin Documentation

RAPID (Rapid Agentic Parallelizable and Isolatable Development) enables team-based parallel development for Claude Code. It decomposes project work into independent sets that execute simultaneously in isolated git worktrees, connected by machine-verifiable interface contracts and merged through an automated review pipeline. Multiple developers work on the same project without blocking each other, with confidence their independent work merges cleanly.

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
- npm dependencies are bundled in `node_modules/`

## Quick Start

A typical RAPID workflow follows these stages:

1. **`/rapid:init`** -- Set up your project with `.planning/` directory and state files
2. **`/rapid:context`** -- Analyze an existing codebase to generate style guides and conventions (skip for greenfield projects)
3. **`/rapid:plan`** -- Decompose work into parallel sets with interface contracts and dependency ordering
4. **`/rapid:execute`** -- Run all sets through the discuss/plan/execute lifecycle in wave order
5. **`/rapid:status`** -- Monitor worktree progress, wave completion, and set phases
6. **`/rapid:merge`** -- Review completed sets and integrate them into main with contract validation
7. **`/rapid:cleanup`** -- Remove worktree directories after successful merges

## Available Commands

### /rapid:install

**Install and configure RAPID plugin, set RAPID_TOOLS env var.**

What it does:

- Detects the RAPID installation directory
- Sets the `RAPID_TOOLS` environment variable to point to `src/bin/rapid-tools.cjs`
- Validates that the CLI is accessible
- Required after marketplace installation; `setup.sh` handles this for git clone installs

```
/rapid:install
```

### /rapid:init

**Initialize a new RAPID project with conversational setup and prerequisite validation.**

What it does:

- Validates prerequisites (git 2.30+, Node.js 18+, optional jq 1.6+)
- Asks for project name, description, and team size
- Detects existing `.planning/` directory and offers reinitialize, upgrade, or cancel
- Scaffolds `.planning/` directory with PROJECT.md, STATE.md, ROADMAP.md, REQUIREMENTS.md, and config.json

```
/rapid:init
```

### /rapid:help

**Show all available RAPID commands and workflow guidance.**

What it does:

- Displays an ASCII workflow diagram showing the full development lifecycle
- Lists all 11 commands grouped by workflow stage
- Provides a static reference card (no project-specific analysis)

```
/rapid:help
```

### /rapid:context

**Analyze codebase and generate project context files (CLAUDE.md, style guide, conventions).**

What it does:

- Runs brownfield detection to identify languages, frameworks, and project structure
- Spawns a context-generation subagent for deep codebase analysis
- Generates STYLE_GUIDE.md, CONVENTIONS.md, and ARCHITECTURE.md in `.planning/context/`
- Context files are automatically loaded into agents during execution for style consistency

```
/rapid:context
```

### /rapid:plan

**Decompose project work into parallelizable sets with interface contracts, dependency graphs, and file ownership.**

What it does:

- Spawns a planner subagent for decomposition analysis
- Produces set definitions (DEFINITION.md), interface contracts (JSON Schema), and a dependency DAG
- Assigns file ownership so every file belongs to exactly one set
- Organizes sets into dependency-ordered waves for parallel execution
- Includes a re-plan guard: shows existing sets before allowing overwrite

```
/rapid:plan
```

### /rapid:assumptions

**Surface Claude's mental model and assumptions about a set before execution begins.**

What it does:

- Lists available sets when no set name is provided
- Displays the assumptions Claude would make when implementing the selected set
- Read-only: corrections route through `/rapid:plan` re-planning
- Helps catch misunderstandings before execution begins

```
/rapid:assumptions auth-set
```

### /rapid:execute

**Execute sets in wave order -- drives discuss/plan/execute lifecycle per set via subagent spawning, with pause/resume and wave reconciliation.**

What it does:

- Processes sets in wave order: all Wave 1 sets complete before Wave 2 begins
- Each set goes through discuss -> plan -> execute lifecycle phases
- Creates isolated git worktrees for parallel development
- Spawns executor subagents (or agent teams) per set
- Runs wave reconciliation with contract validation between waves
- Resumes paused sets automatically when re-invoked

Execution modes:

- **Agent Teams** (when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`): Enhanced parallel execution via Claude Code agent teams with automatic fallback to subagents on failure
- **Subagents** (default): Standard execution via subagent spawning with one agent per set

```
/rapid:execute
```

### /rapid:status

**Show all active worktrees, their set assignments, lifecycle phase, and wave progress.**

What it does:

- Displays a formatted table of all worktrees with set name, branch, phase, and status
- Shows wave-level progress summary (done/executing/error counts per wave)
- Reports execution mode (Agent Teams or Subagents) when applicable

```
/rapid:status
```

### /rapid:pause

**Pause execution of a set and save state for later resumption.**

What it does:

- Saves current execution state to a HANDOFF.md file in the set's worktree
- Records pause cycle count for tracking repeated pauses
- Marks the set's phase as "Paused" in the worktree registry
- Resumed automatically by `/rapid:execute` on next invocation

```
/rapid:pause auth-set
```

### /rapid:merge

**Merge completed sets into main -- orchestrates review, cleanup, and dependency-ordered merging with integration gates.**

What it does:

- Determines merge order from the dependency DAG (topological sort)
- Spawns a reviewer subagent for deep code review per set
- Validates interface contracts before allowing merge (contract gate)
- Merges in dependency order: dependencies merge before dependents
- Optionally spawns a cleanup subagent for fixable issues found during review
- Produces REVIEW.md with verdict (pass/fail/pass-with-issues)

```
/rapid:merge
```

### /rapid:cleanup

**Clean up completed worktrees with safety checks -- removes worktree directory while preserving branches.**

What it does:

- Validates the target worktree exists and is in a completed state
- Checks for uncommitted changes before removal
- Removes the worktree directory but preserves the git branch
- Updates the worktree registry

```
/rapid:cleanup auth-set
```

## Architecture

### Directory Structure

```
RAPID/                              (repo root)
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest (name, version, metadata)
├── commands/                    # Legacy command files (6)
│   ├── assumptions.md
│   ├── context.md
│   ├── help.md
│   ├── init.md
│   ├── install.md
│   └── plan.md
├── skills/                      # Modern SKILL.md skills (11)
│   ├── assumptions/SKILL.md
│   ├── cleanup/SKILL.md
│   ├── context/SKILL.md
│   ├── execute/SKILL.md
│   ├── help/SKILL.md
│   ├── init/SKILL.md
│   ├── install/SKILL.md
│   ├── merge/SKILL.md
│   ├── pause/SKILL.md
│   ├── plan/SKILL.md
│   └── status/SKILL.md
├── agents/                      # Subagent definitions (6, gitignored)
│   ├── rapid-cleanup.md
│   ├── rapid-executor.md
│   ├── rapid-orchestrator.md
│   ├── rapid-planner.md
│   ├── rapid-reviewer.md
│   └── rapid-verifier.md
├── src/
│   ├── bin/rapid-tools.cjs      # CLI entry point
│   ├── hooks/rapid-task-completed.sh  # TaskCompleted hook
│   ├── lib/                     # 17 runtime libraries + 17 test files
│   └── modules/                 # Agent assembly modules (5 core + 6 roles)
├── config.json                  # Agent assembly configuration
├── DOCS.md                      # This file
├── LICENSE                      # MIT License
├── package.json                 # npm dependencies
└── package-lock.json
```

### Agent Assembly

Agents are built from composable modules at runtime. The `config.json` file maps each agent name to a list of core modules, a role-specific module, and context requirements. The `assembler.cjs` library reads this configuration and assembles the full agent prompt by concatenating the selected modules with project context files.

Core modules (shared across agents):
- `core-identity.md` -- RAPID identity and behavioral guidelines
- `core-returns.md` -- Structured return protocol (COMPLETE/CHECKPOINT/BLOCKED)
- `core-state-access.md` -- STATE.md reading and update patterns
- `core-git.md` -- Git conventions and commit formatting
- `core-context-loading.md` -- Project context file loading

Role-specific modules give each agent its specialized behavior (planner, executor, reviewer, verifier, orchestrator).

### Runtime Libraries

| Library | Purpose |
|---------|---------|
| `core.cjs` | Output formatting, project root detection, config loading |
| `lock.cjs` | Cross-process atomic locking (mkdir strategy) with stale detection |
| `state.cjs` | STATE.md reading and field updates |
| `prereqs.cjs` | Prerequisite validation (git, Node.js, jq versions) |
| `init.cjs` | Project scaffolding and existing project detection |
| `assembler.cjs` | Agent assembly from modular components |
| `returns.cjs` | Structured return protocol parsing (COMPLETE/CHECKPOINT/BLOCKED) |
| `verify.cjs` | Artifact verification (lightweight and heavyweight) |
| `context.cjs` | Brownfield codebase detection and context generation |
| `dag.cjs` | Dependency graph (DAG) with topological sort (Kahn's algorithm) |
| `contract.cjs` | Interface contract validation (Ajv JSON Schema) |
| `stub.cjs` | Cross-set stub file generation for parallel development |
| `plan.cjs` | Set decomposition, definition generation, planning gates |
| `worktree.cjs` | Git worktree lifecycle management, registry, status display |
| `execute.cjs` | Per-set execution context, verification, wave reconciliation |
| `merge.cjs` | Deep review, contract gate testing, dependency-ordered merge |
| `teams.cjs` | Agent teams detection, teammate config, completion tracking |

### Agents

| Agent | Role | Spawned By |
|-------|------|------------|
| `rapid-planner` | Decomposes project into parallelizable sets | `/rapid:plan` |
| `rapid-executor` | Implements a set's tasks in an isolated worktree | `/rapid:execute` |
| `rapid-reviewer` | Deep code review for merge readiness | `/rapid:merge` |
| `rapid-verifier` | Filesystem artifact verification | `/rapid:execute` (post-execution) |
| `rapid-orchestrator` | Top-level workflow coordination | `/rapid:execute` |
| `rapid-cleanup` | Fixes issues found during merge review | `/rapid:merge` (when needed) |

## Key Concepts

### Sets

Independent workstreams that run in isolated git worktrees. Each set has a DEFINITION.md describing its scope, file ownership, interface contracts, and dependency edges. Sets within the same wave execute in parallel; sets in later waves depend on earlier ones.

### Interface Contracts

Machine-verifiable JSON schemas that define the API surface between sets. Contracts specify the exports one set provides and the imports another set consumes. Validated automatically during wave reconciliation and before merge.

### Waves

Dependency-ordered execution groups. Wave 1 sets have no dependencies and run first. Wave 2 sets depend on Wave 1 outputs. Wave reconciliation runs between waves to validate that all contracts are satisfied before proceeding.

### Planning Gates

Enforcement that all sets must be fully planned before execution begins. GATES.json tracks planning and execution state transitions per wave, preventing premature execution.

### Wave Reconciliation

Mandatory contract validation between execution waves. After all sets in a wave complete, reconciliation verifies that interface contracts are satisfied, runs contract tests, and produces a WAVE-N-SUMMARY.md before the next wave can begin.

### Ownership

Every file belongs to exactly one set. Cross-set file access is tracked via CONTRIBUTIONS.json. Ownership violations are detected during execution and flagged as warnings. This prevents merge conflicts from parallel development.

## Prerequisites

- **Claude Code** (latest version)
- **git 2.30+** (required for worktree support in parallel development)
- **Node.js 18+** (runtime for tool libraries)
- **jq 1.6+** (optional, for JSON processing utilities)

## Configuration

### .planning/ Directory

Created by `/rapid:init`, this directory contains all project state:

| File | Purpose |
|------|---------|
| `PROJECT.md` | Project identity, description, key decisions |
| `STATE.md` | Current execution state, progress tracking, session continuity |
| `ROADMAP.md` | Phased development roadmap with plan progress |
| `REQUIREMENTS.md` | Requirements tracking and traceability |
| `config.json` | Planning configuration (depth, parallelization, etc.) |
| `sets/` | Set definitions, contracts, and ownership maps |
| `contracts/` | Interface contract JSON schemas |
| `context/` | Generated context files (style guide, conventions, architecture) |
| `waves/` | Wave reconciliation summaries |

### Agent Assembly Configuration

The `config.json` at the plugin root controls agent assembly. Each agent entry specifies:

- `role` -- Which role module to load (planner, executor, reviewer, etc.)
- `core` -- List of core modules to include
- `context` -- Which context categories to load (project, contracts, style)
- `context_files` -- Specific context files to include

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `RAPID_TOOLS` | Path to the rapid-tools.cjs CLI | Auto-detected from plugin location |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Enable agent teams execution mode | `0` (disabled) |

## License

MIT License. See [LICENSE](LICENSE) file.

---

RAPID v1.0.0 -- Rapid Agentic Parallelizable and Isolatable Development for Claude Code
