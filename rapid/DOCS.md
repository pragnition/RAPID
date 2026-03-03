# RAPID - Plugin Documentation

RAPID (Agentic Parallelizable and Isolatable Development) enables team-based
parallel development with Claude Code. Multiple developers work on the same
project simultaneously without blocking each other, with confidence their
independent work will merge cleanly.

## Installation

Install via Claude Code plugin marketplace or add to `.claude/plugins/`:

```
rapid
```

Once installed, RAPID commands are available as slash commands in your Claude Code session.

## Available Commands

### /rapid:init

Initialize a new RAPID project with conversational setup and prerequisite validation.

**What it does:**

1. Validates prerequisites (git 2.30+, Node.js 18+, optional jq 1.6+)
2. Asks for project name, description, and team size
3. Detects existing `.planning/` directory and offers reinitialize/upgrade/cancel
4. Scaffolds `.planning/` directory with project state files

**Files created:**

- `.planning/PROJECT.md` - Project identity and key decisions
- `.planning/STATE.md` - Current execution state and progress tracking
- `.planning/ROADMAP.md` - Phased development roadmap
- `.planning/REQUIREMENTS.md` - Requirements tracking and traceability
- `.planning/config.json` - Planning configuration

**Example usage:**

```
> /rapid:init

RAPID will ask:
  1. What is your project name?
  2. Describe your project in 1-2 sentences.
  3. How many developers will work on this project?

Then it scaffolds your .planning/ directory and you're ready to plan.
```

**CLI equivalent:**

```bash
# Check if project already exists
node rapid/src/bin/rapid-tools.cjs init detect

# Scaffold a new project
node rapid/src/bin/rapid-tools.cjs init scaffold --name "MyProject" --desc "A web application" --team-size 3

# Reinitialize (backs up existing .planning/)
node rapid/src/bin/rapid-tools.cjs init scaffold --name "MyProject" --desc "A web app" --team-size 3 --mode reinitialize

# Upgrade (add missing files, keep existing)
node rapid/src/bin/rapid-tools.cjs init scaffold --name "MyProject" --desc "A web app" --team-size 3 --mode upgrade
```

### /rapid:help

Show all available RAPID commands grouped by workflow stage.

**What it does:**

- Displays an ASCII workflow diagram showing the RAPID development lifecycle
- Lists all commands with available and coming-soon markers
- Provides a static reference (no project-specific analysis)

**Example usage:**

```
> /rapid:help

Shows the full command reference with workflow stages:
  INIT -> PLAN -> EXECUTE -> REVIEW -> MERGE
```

## Architecture

RAPID uses Claude Code's plugin system with dual command/skill registration:

- `.claude-plugin/plugin.json` - Plugin manifest for marketplace discovery
- `commands/` - Legacy command files (`.md` format)
- `skills/` - Modern SKILL.md-based skills with conversational flows
- `src/lib/` - Node.js runtime libraries (CommonJS)
- `src/bin/rapid-tools.cjs` - CLI entry point for all tool operations

### Runtime Libraries

| Library | Purpose |
|---------|---------|
| `core.cjs` | Output formatting, project root detection, config loading |
| `lock.cjs` | Cross-process atomic locking for parallel safety |
| `state.cjs` | STATE.md reading and field updates |
| `prereqs.cjs` | Prerequisite validation (git, Node.js, jq) |
| `init.cjs` | Project scaffolding and existing project detection |
| `assembler.cjs` | Agent assembly from modular components |
| `returns.cjs` | Return protocol parsing and validation |
| `verify.cjs` | Artifact verification (lightweight and heavyweight) |

## Requirements

- **Claude Code** (latest version)
- **git 2.30+** (required for worktree support in parallel development)
- **Node.js 18+** (runtime for tool libraries)
- **jq 1.6+** (optional, for JSON processing utilities)

## Getting Started

1. Install the RAPID plugin in Claude Code
2. Run `/rapid:init` in your project directory
3. Answer the setup questions (name, description, team size)
4. Start planning with `/rapid:plan` (coming soon)

---

*RAPID is designed for teams using Claude Code to coordinate parallel development
with structured planning, isolated execution, and clean merges.*
