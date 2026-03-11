# Setup

These three skills handle everything from first install to project initialization and codebase analysis. Run them once at the start of a new project.

## `/rapid:install`

Bootstraps the RAPID plugin by running the non-interactive setup script (`setup.sh`), which handles prerequisites, `npm install`, validation, `.env` creation, plugin registration, and agent file generation. After setup, the skill detects your shell (bash, zsh, fish, or POSIX), writes the `RAPID_TOOLS` environment variable to your shell config, and verifies the full toolchain works. If shell config fails, a `.env` fallback ensures RAPID works inside Claude Code sessions regardless.

See [skills/install/SKILL.md](../skills/install/SKILL.md) for full details.

## `/rapid:init`

Orchestrates the complete project initialization pipeline. Starts with prerequisite and git checks, then runs an adaptive deep-discovery conversation to understand the project's vision, users, features, constraints, and success criteria. For brownfield projects, a codebase synthesizer agent analyzes the existing code first. Then 5 parallel research agents (stack, features, architecture, pitfalls, oversights) investigate the project domain independently. A synthesizer merges their findings, and a roadmapper proposes sets, waves, jobs, and interface contracts. The roadmap goes through a propose-then-approve loop -- you review and accept before any files are written. Scaffolds `.planning/` with PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.json, and config.json.

See [skills/init/SKILL.md](../skills/init/SKILL.md) for full details.

## `/rapid:context`

Analyzes an existing codebase and generates context documents that downstream agents use to understand project conventions, architecture, and style. Spawns a context-generator subagent that reads sample source files from a scan manifest, identifies patterns (architecture, naming, error handling, test infrastructure), and writes the results. Generates CLAUDE.md (under 80 lines) at the project root plus CODEBASE.md, ARCHITECTURE.md, CONVENTIONS.md, and STYLE_GUIDE.md in `.planning/context/`. Re-running regenerates all files from scratch -- the current codebase is always the source of truth.

See [skills/context/SKILL.md](../skills/context/SKILL.md) for full details.

---

Next: [Planning](planning.md)
