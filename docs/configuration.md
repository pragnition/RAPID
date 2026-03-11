# Configuration

This reference covers all configuration options, the state schema, and the project directory layout.

## Environment Variables

RAPID uses one environment variable and supports `.env` file loading as a fallback.

| Variable | Purpose | Set By |
|----------|---------|--------|
| `RAPID_TOOLS` | Absolute path to `src/bin/rapid-tools.cjs`. Required for all commands. | `/rapid:install` |

Every skill loads `RAPID_TOOLS` from both the shell environment and the project's `.env` file (whichever is available). The `.env` file is created automatically by `/rapid:install` in the plugin root directory. If the shell config fails during install, the `.env` fallback ensures RAPID works inside Claude Code sessions regardless.

## Project Configuration (`config.json`)

Located at `.planning/config.json`. Created by `/rapid:init` during project setup.

| Key | Type | Values | Default | Purpose |
|-----|------|--------|---------|---------|
| `mode` | string | `"yolo"`, etc. | _(none)_ | Execution mode |
| `parallelization` | boolean | `true` / `false` | _(none)_ | Enable parallel job dispatch within waves |
| `commit_docs` | boolean | `true` / `false` | _(none)_ | Auto-commit documentation files |
| `model_profile` | string | `"quality"` / `"speed"` | _(none)_ | Model selection profile for agents |
| `workflow.research` | boolean | `true` / `false` | _(none)_ | Enable research phase during wave planning |
| `workflow.plan_check` | boolean | `true` / `false` | _(none)_ | Enable plan verification after job planning |
| `workflow.verifier` | boolean | `true` / `false` | _(none)_ | Enable post-execution verification |
| `granularity` | string | `"fine"` / `"coarse"` | _(none)_ | Job sizing granularity (fine = more smaller jobs, coarse = fewer larger jobs) |
| `lock_timeout_ms` | number | milliseconds | `300000` (5 min) | How long before a stale lock file is considered expired |

The `lock_timeout_ms` key is the only one with a built-in default in `loadConfig()` (see `src/lib/core.cjs`). All other keys are project-specific and set during initialization.

## State Schema (`STATE.json`)

Located at `.planning/STATE.json`. This is the machine-readable project state, validated at runtime by Zod schemas defined in `src/lib/state-schemas.cjs`.

### Top-Level Structure

| Entity | Key Fields | Description |
|--------|-----------|-------------|
| **ProjectState** | `version`, `projectName`, `currentMilestone`, `milestones[]`, `lastUpdatedAt`, `createdAt` | Root state object. `version` is always `1`. `currentMilestone` points to the active milestone ID. |
| **MilestoneState** | `id`, `name`, `sets[]` | A milestone (e.g., v1.0, v2.0) containing all its sets. |
| **SetState** | `id`, `status`, `waves[]` | An independent workstream. Status transitions: `pending` > `planning` > `executing` > `reviewing` > `merging` > `complete`. |
| **WaveState** | `id`, `status`, `jobs[]` | A dependency-ordered group within a set. Status transitions: `pending` > `discussing` > `planning` > `executing` > `reconciling` > `complete` (also `failed` > `executing` for retries). |
| **JobState** | `id`, `status`, `startedAt?`, `completedAt?`, `commitSha?`, `artifacts[]` | An atomic work unit. Status transitions: `pending` > `executing` > `complete` or `failed` (also `failed` > `executing` for retries). |

### Status Enums

**SetStatus:** `pending`, `planning`, `executing`, `reviewing`, `merging`, `complete`

**WaveStatus:** `pending`, `discussing`, `planning`, `executing`, `reconciling`, `complete`, `failed`

**JobStatus:** `pending`, `executing`, `complete`, `failed`

### Derived Status Rules

Wave and set statuses can be derived from their children:

- **Wave status** from jobs: all pending = `pending`, all complete = `complete`, any failed with none executing = `failed`, otherwise = `executing`.
- **Set status** from waves: all pending = `pending`, all complete = `complete`, otherwise = `executing`.

See `src/lib/state-schemas.cjs` for the full Zod schema definitions and `src/lib/state-machine.cjs` for transition logic and derived status functions.

## Key Directories and Files

| Path | Purpose |
|------|---------|
| `.planning/` | All project state and planning artifacts |
| `.planning/STATE.json` | Machine-readable project state (Zod-validated) |
| `.planning/config.json` | Project configuration (see table above) |
| `.planning/PROJECT.md` | Project name, description, core value, team size |
| `.planning/REQUIREMENTS.md` | Full requirements list for decomposition |
| `.planning/ROADMAP.md` | Milestone roadmap with set/wave breakdown |
| `.planning/.locks/` | Lock files for concurrent access safety (gitignored). Auto-expire after 5 minutes. |
| `.planning/worktrees/REGISTRY.json` | Worktree registry tracking active set worktrees |
| `.planning/sets/{set-name}/` | Per-set artifacts: DEFINITION.md, CONTRACT.json, SET-OVERVIEW.md |
| `.planning/sets/DAG.json` | Dependency graph between sets |
| `.planning/sets/OWNERSHIP.json` | File-to-set ownership map |
| `.planning/waves/{set-name}/{wave-id}/` | Per-wave artifacts: WAVE-CONTEXT.md, WAVE-PLAN.md, JOB-PLAN.md files |
| `.planning/research/` | Research outputs from `/rapid:init` (STACK.md, FEATURES.md, etc.) |
| `.planning/context/` | Codebase context files from `/rapid:context` |
| `.rapid-worktrees/` | Git worktree checkout directories (one per initialized set) |

---

Next: [State Machines](state-machines.md)
