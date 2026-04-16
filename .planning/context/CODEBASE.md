# RAPID Codebase Overview

## Project Identity

**RAPID** = Rapid Agentic Parallelizable and Isolatable Development (recursive acronym)
- Claude Code plugin (v3.0.0) for coordinated parallel AI-assisted development
- 27 specialized agents, strict file ownership via git worktrees, 5-level conflict detection
- MIT licensed, hosted at github.com/pragnition/RAPID

## Tech Stack

- **Runtime:** Node.js 22+ (CommonJS throughout, `.cjs` extension -- `engines.node` is `">=22"`)
- **Validation:** Zod 3.25.76 (state schemas), Ajv 8.18.0 (contract JSON Schema) -- both exact-pinned
- **Concurrency:** proper-lockfile 4.1.2 (file-based distributed locking -- exact-pinned)
- **VCS:** Git 2.30+ (worktrees for isolation, branches per set)
- **Platform:** Claude Code plugin API (skills, agents, hooks)

## Directory Layout

```
/home/kek/Projects/RAPID/
├── src/
│   ├── bin/rapid-tools.cjs        # CLI router (~400 lines, dispatches to src/commands/)
│   ├── commands/                   # 23 command handler modules + co-located tests
│   │   ├── state.cjs               # state get/set/install-meta handlers
│   │   ├── plan.cjs                # plan create-set/decompose/list-sets/load-set
│   │   ├── execute.cjs             # execute prepare-context + branding integration
│   │   ├── merge.cjs               # merge dispatch handlers
│   │   ├── review.cjs              # review scoping and scope file generation
│   │   ├── display.cjs             # display render / update-reminder banner
│   │   ├── build-agents.cjs        # agent build from modules
│   │   └── ...                     # 16 more handler modules
│   ├── lib/                        # 41 core library modules + co-located tests
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
│   │   ├── display.cjs             # Branded formatting + update-reminder banner
│   │   ├── stub.cjs                # Contract stub generation
│   │   ├── tool-docs.cjs           # YAML tool documentation registry
│   │   ├── version.cjs             # Version read + install-staleness primitives
│   │   ├── branding-artifacts.cjs  # Branding manifest CRUD (Zod-validated)
│   │   ├── branding-server.cjs     # HTTP/SSE server for branding artifact reload
│   │   ├── memory.cjs              # Agent memory persistence
│   │   ├── migrate.cjs             # .planning/ schema migrations
│   │   ├── prereqs.cjs             # Prereq + version comparison
│   │   ├── principles.cjs          # Agent principles registry
│   │   ├── quality.cjs             # Code quality heuristics
│   │   ├── compaction.cjs          # Context compaction for large sets
│   │   ├── quick-log.cjs           # Ad-hoc quick-pipeline logging
│   │   ├── remediation.cjs         # Review finding remediation
│   │   ├── scaffold.cjs            # Project-type scaffolding
│   │   ├── ui-contract.cjs         # UI contract validation
│   │   ├── web-client.cjs          # Mission Control web dashboard client
│   │   ├── add-set.cjs             # Mid-milestone set insertion
│   │   ├── args.cjs                # CLI arg parsing
│   │   ├── docs.cjs                # Docs generation helpers
│   │   ├── errors.cjs              # Structured error types
│   │   ├── group.cjs               # Set grouping utilities
│   │   ├── hooks.cjs               # Hook lifecycle helpers
│   │   └── stdin.cjs               # Stdin handling for CLI handlers
│   ├── modules/
│   │   ├── core/                   # 3 shared prompt modules (identity, conventions, returns)
│   │   └── roles/                  # 28 role-specific agent modules (.md)
│   └── hooks/
│       └── rapid-task-completed.sh
├── agents/                         # 27 generated agent definitions (.md)
├── skills/                         # 30 skill command directories (SKILL.md each)
├── docs/                           # 9 user documentation guides
├── .planning/                      # Project state and planning artifacts
│   ├── STATE.json                  # Machine-readable project state
│   ├── PROJECT.md                  # Project description and vision
│   ├── ROADMAP.md                  # Set decomposition and DAG
│   ├── REQUIREMENTS.md             # Feature requirements
│   ├── MILESTONES.md               # Milestone tracking
│   ├── config.json                 # Planning config
│   ├── worktrees/REGISTRY.json     # Worktree tracking
│   ├── branding/                   # Branding artifacts + server PID (gitignored)
│   │   ├── artifacts.json          # Manifest (Zod-validated CRUD)
│   │   └── .server.pid             # Branding server PID (local only)
│   └── context/                    # Generated context files (this directory)
├── .claude-plugin/plugin.json      # Plugin manifest
├── .rapid-worktrees/               # Active git worktrees (gitignored)
├── .rapid-install-meta.json        # Install timestamp sidecar (gitignored)
├── config.json                     # Runtime config (lock_timeout_ms, agent_size_warn_kb)
├── package.json                    # npm metadata (4 dependencies)
└── CLAUDE.md                       # Project instructions for agents
```

## Source Code Summary

| Category | Count | Location | Description |
|----------|-------|----------|-------------|
| Core Libraries | 41 | src/lib/*.cjs | State, contracts, worktrees, merge, branding, version, etc. |
| Library Tests | 41+ | src/lib/*.test.cjs | Co-located unit tests (some modules ship multiple test files) |
| CLI Router | 1 | src/bin/rapid-tools.cjs | Thin ~400-line command router |
| Command Handlers | 23 | src/commands/*.cjs | Dispatch targets for the CLI router |
| Command Tests | 10+ | src/commands/*.test.cjs | Co-located handler tests |
| Agent Roles | 28 | src/modules/roles/*.md | Specialized agent personas |
| Core Modules | 3 | src/modules/core/*.md | Identity, conventions, returns protocol |
| Generated Agents | 27 | agents/*.md | Built from role modules |
| Skills | 30 | skills/*/SKILL.md | User-facing command definitions |
| Documentation | 9+ | docs/*.md | User guides |

## Key Entry Points

- **CLI:** `node src/bin/rapid-tools.cjs <command> [subcommand] [args...]` -- thin router (~400 lines) that dispatches to `src/commands/<command>.cjs` handler modules
- **Plugin:** `.claude-plugin/plugin.json` declares plugin metadata
- **Setup:** `./setup.sh` installs deps, sets RAPID_TOOLS env var, builds agents
- **Agent Build:** `node src/bin/rapid-tools.cjs build-agents` generates agents/ from modules/

## Dependencies (Production -- all exact-pinned)

| Package | Version | Purpose |
|---------|---------|---------|
| ajv | 8.18.0 | JSON Schema validation for CONTRACT.json |
| ajv-formats | 3.0.1 | Additional format validators |
| zod | 3.25.76 | TypeScript-first schema validation for state |
| proper-lockfile | 4.1.2 | File-based locking for concurrent access |

No dev dependencies. Tests use Node.js built-in `node:test` module. The v7.0.0 pin policy is enforced by `src/lib/version.test.cjs` (`runtime dependency pins` describe block) -- any future `npm install` regression surfaces immediately.
