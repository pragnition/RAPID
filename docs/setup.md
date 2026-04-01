[DOCS.md](../DOCS.md) > Setup

# Setup

Four commands handle everything from first install to project initialization, codebase analysis, and optional web dashboard setup. Run them once at the start of a new project.

## Requirements

- **Node.js 20+** (runtime for tool libraries)
- **git 2.30+** (required for worktree support)
- **RAPID_TOOLS env var** must be set (both installation methods handle this)

## Installation Methods

### Plugin Marketplace (Primary)

```
claude plugin add pragnition/RAPID
```

Then run `/rapid:install` from within Claude Code to complete setup.

### Git Clone

```bash
git clone https://github.com/pragnition/RAPID.git
cd RAPID
./setup.sh
```

The `setup.sh` script installs dependencies, configures `RAPID_TOOLS`, and runs `build-agents` to generate agent definition files.

## `/rapid:install`

Bootstraps the RAPID plugin by detecting your shell (bash, zsh, fish, or POSIX), writing the `RAPID_TOOLS` environment variable to your shell config, creating a `.env` fallback, validating the toolchain, and running agent file generation. If shell config fails, the `.env` fallback ensures RAPID works inside Claude Code sessions regardless. Handles both marketplace and git clone installations.

See [skills/install/SKILL.md](../skills/install/SKILL.md) for full details.

## `/rapid:init`

Runs the complete project initialization pipeline. Starts with prerequisite and git checks, then runs a batched discovery conversation in 4 topic groups (Vision+Users, Features+Technical, Scale+Integrations, Context+Success) to understand the project scope. For brownfield projects, a codebase synthesizer agent analyzes the existing code first. Then 6 parallel research agents (stack, features, architecture, pitfalls, oversights, UX) investigate the project domain independently. A synthesizer merges their findings, and a roadmapper proposes sets with dependency ordering. The roadmap goes through a propose-then-approve loop before any files are written. Scaffolds `.planning/` with PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.json, CONTRACT.json, and config.json.

Output: STATE.json at init contains only project > milestone > sets (no wave or task decomposition -- that is deferred to `/rapid:plan-set`).

See [skills/init/SKILL.md](../skills/init/SKILL.md) for full details.

## `/rapid:context`

Analyzes an existing codebase and generates context documents that downstream agents use to understand project conventions, architecture, and style. Spawns a `rapid-context-generator` subagent that reads sample source files, identifies patterns (architecture, naming, error handling, test infrastructure), and writes the results. Generates CLAUDE.md (under 80 lines) at the project root plus CODEBASE.md, ARCHITECTURE.md, CONVENTIONS.md, and STYLE_GUIDE.md in `.planning/context/`. Re-running regenerates all files from scratch -- the current codebase is always the source of truth.

See [skills/context/SKILL.md](../skills/context/SKILL.md) for full details.

## `/rapid:register-web`

Registers an existing project with the RAPID web dashboard. Only needed for projects initialized before v4.1.0. New projects auto-register during `/rapid:init` when `RAPID_WEB=true` is set.

---

Next: [Planning](planning.md)
