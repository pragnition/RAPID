# RAPID Codebase Overview

## Project Identity

**RAPID** = Rapid Agentic Parallelizable and Isolatable Development (recursive acronym)
- Claude Code plugin (v3.0.0) for coordinated parallel AI-assisted development
- 26 specialized agents, strict file ownership via git worktrees, 5-level conflict detection
- MIT licensed, hosted at github.com/fishjojo1/RAPID

## Tech Stack

- **Runtime:** Node.js 18+ (CommonJS throughout, `.cjs` extension)
- **Validation:** Zod 3.25.76 (state schemas), Ajv 8.17.1 (contract JSON Schema)
- **Concurrency:** proper-lockfile 4.1.2 (file-based distributed locking)
- **VCS:** Git 2.30+ (worktrees for isolation, branches per set)
- **Platform:** Claude Code plugin API (skills, agents, hooks)

## Directory Layout

```
/home/kek/Projects/RAPID/
├── src/
│   ├── bin/rapid-tools.cjs        # CLI backbone (~3500 lines, command router)
│   ├── lib/                        # 21 core library modules + co-located tests
│   │   ├── state-machine.cjs       # State CRUD, transactions, locking
│   │   ├── state-schemas.cjs       # Zod schemas (ProjectState hierarchy)
│   │   ├── state-transitions.cjs   # Valid status transition map
│   │   ├── worktree.cjs            # Git worktree lifecycle + registry
│   │   ├── plan.cjs                # Set/wave planning, definitions
│   │   ├── dag.cjs                 # Dependency graph (Kahn's toposort)
│   │   ├── contract.cjs            # Interface contracts (compile, validate)
│   │   ├── execute.cjs             # Execution context prep, prompt assembly
│   │   ├── merge.cjs               # 5-level detection, 4-tier resolution
│   │   ├── review.cjs              # Review scoping, issue management
│   │   ├── verify.cjs              # Artifact verification (light/heavy)
│   │   ├── returns.cjs             # RAPID:RETURN marker parser
│   │   ├── resolve.cjs             # Set/wave reference resolution
│   │   ├── lock.cjs                # File locking primitives
│   │   ├── core.cjs                # Utilities (output, error, findProjectRoot)
│   │   ├── init.cjs                # Project scaffolding
│   │   ├── context.cjs             # Language detection, project analysis
│   │   ├── display.cjs             # Branded formatting
│   │   ├── stub.cjs                # Contract stub generation
│   │   └── tool-docs.cjs           # YAML tool documentation registry
│   ├── modules/
│   │   ├── core/                   # 3 shared prompt modules (identity, conventions, returns)
│   │   └── roles/                  # 30 role-specific agent modules (.md)
│   └── hooks/
│       └── rapid-task-completed.sh
├── agents/                         # 26 generated agent definitions (.md)
├── skills/                         # 24 skill command directories (SKILL.md each)
├── commands/                       # 6 command definition files (.md)
├── docs/                           # 9 user documentation guides
├── .planning/                      # Project state and planning artifacts
│   ├── STATE.json                  # Machine-readable project state
│   ├── PROJECT.md                  # Project description and vision
│   ├── ROADMAP.md                  # Set decomposition and DAG
│   ├── REQUIREMENTS.md             # Feature requirements
│   ├── MILESTONES.md               # Milestone tracking
│   ├── config.json                 # Planning config
│   ├── worktrees/REGISTRY.json     # Worktree tracking
│   └── context/                    # Generated context files (this directory)
├── .claude-plugin/plugin.json      # Plugin manifest
├── .rapid-worktrees/               # Active git worktrees (gitignored)
├── config.json                     # Runtime config (lock_timeout_ms, agent_size_warn_kb)
├── package.json                    # npm metadata (3 dependencies)
└── CLAUDE.md                       # Project instructions for agents
```

## Source Code Summary

| Category | Count | Location | Description |
|----------|-------|----------|-------------|
| Core Libraries | 21 | src/lib/*.cjs | State, contracts, worktrees, merge, etc. |
| Test Files | 21+ | src/lib/*.test.cjs | Co-located unit tests |
| CLI Backbone | 1 | src/bin/rapid-tools.cjs | Command router and handler dispatch |
| Agent Roles | 30 | src/modules/roles/*.md | Specialized agent personas |
| Core Modules | 3 | src/modules/core/*.md | Identity, conventions, returns protocol |
| Generated Agents | 26 | agents/*.md | Built from role modules |
| Skills | 24 | skills/*/SKILL.md | User-facing command definitions |
| Documentation | 9 | docs/*.md | User guides |

## Key Entry Points

- **CLI:** `node src/bin/rapid-tools.cjs <command> [subcommand] [args...]`
- **Plugin:** `.claude-plugin/plugin.json` declares plugin metadata
- **Setup:** `./setup.sh` installs deps, sets RAPID_TOOLS env var, builds agents
- **Agent Build:** `node src/bin/rapid-tools.cjs build-agents` generates agents/ from modules/

## Dependencies (Production)

| Package | Version | Purpose |
|---------|---------|---------|
| ajv | ^8.17.1 | JSON Schema validation for CONTRACT.json |
| ajv-formats | ^3.0.1 | Additional format validators |
| zod | ^3.25.76 | TypeScript-first schema validation for state |
| proper-lockfile | ^4.1.2 | File-based locking for concurrent access |

No dev dependencies. Tests use Node.js built-in `node:test` module.
