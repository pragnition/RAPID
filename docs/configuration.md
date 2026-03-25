[DOCS.md](../DOCS.md) > Configuration

# Configuration

This reference covers environment setup, the state schema, and the project directory layout.

## Environment Variables

RAPID uses one environment variable and supports `.env` file loading as a fallback.

| Variable | Purpose | Set By |
|----------|---------|--------|
| `RAPID_TOOLS` | Absolute path to `src/bin/rapid-tools.cjs`. Required for all commands. | `/rapid:install` |
| `NO_COLOR` | When set, suppresses ANSI color codes in banner output. | User |
| `RAPID_WEB` | Set to `true` to enable Mission Control web dashboard features. | User |

Every skill loads `RAPID_TOOLS` from both the shell environment and the project's `.env` file (whichever is available). The `.env` file is created automatically by `/rapid:install` in the plugin root directory. If the shell config fails during install, the `.env` fallback ensures RAPID works inside Claude Code sessions regardless.

## `.env` File

Located in the plugin root directory. Created by `/rapid:install`.

```
RAPID_TOOLS=/absolute/path/to/src/bin/rapid-tools.cjs
ANTHROPIC_API_KEY=sk-ant-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com
```

## Project Configuration (`config.json`)

Located at `.planning/config.json`. Created by `/rapid:init` during project setup.

| Key | Type | Values | Default | Purpose |
|-----|------|--------|---------|---------|
| `mode` | string | `"yolo"`, etc. | _(none)_ | Execution mode |
| `parallelization` | boolean | `true` / `false` | _(none)_ | Enable parallel dispatch within waves |
| `commit_docs` | boolean | `true` / `false` | _(none)_ | Auto-commit documentation files |
| `model_profile` | string | `"quality"` / `"speed"` | _(none)_ | Model selection profile for agents |
| `workflow.research` | boolean | `true` / `false` | _(none)_ | Enable research phase during planning |
| `workflow.plan_check` | boolean | `true` / `false` | _(none)_ | Enable plan verification after planning |
| `workflow.verifier` | boolean | `true` / `false` | _(none)_ | Enable post-execution verification |
| `granularity` | string | `"fine"` / `"coarse"` | _(none)_ | Task sizing granularity |
| `solo` | boolean | `true` / `false` | `true` if teamSize=1 | Enable solo mode (no worktrees, work on main) |
| `lock_timeout_ms` | number | milliseconds | `300000` (5 min) | Stale lock file expiration |

The `lock_timeout_ms` key is the only one with a built-in default in `loadConfig()`. Solo mode defaults to `true` when team size is 1. All other keys are project-specific and set during initialization.

## State Schema (`STATE.json`)

Located at `.planning/STATE.json`. This is the machine-readable project state. State tracks at three levels: sets, waves (within sets), and jobs (within waves).

### Schema

```json
{
  "project": {
    "name": "string",
    "milestone": {
      "name": "string",
      "version": "string",
      "sets": [
        {
          "id": "string",
          "status": "pending | discussed | planned | executed | complete | merged",
          "waves": [
            {
              "id": "string",
              "status": "pending | executing | complete",
              "jobs": [
                {
                  "id": "string",
                  "status": "pending | executing | complete"
                }
              ]
            }
          ]
        }
      ]
    }
  }
}
```

### SetStatus Enum

`pending`, `discussed`, `planned`, `executed`, `complete`, `merged`

### WaveStatus / JobStatus Enum

`pending`, `executing`, `complete`

See [State Machines](state-machines.md) for transition rules and crash recovery details.

## Key Directories and Files

| Path | Purpose |
|------|---------|
| `.planning/` | All project state and planning artifacts |
| `.planning/STATE.json` | Machine-readable state (set-level only) |
| `.planning/config.json` | Project configuration (see table above) |
| `.planning/PROJECT.md` | Project name, description, core value |
| `.planning/REQUIREMENTS.md` | Requirements for decomposition |
| `.planning/ROADMAP.md` | Milestone roadmap with sets |
| `.planning/CONTRACT.json` | Interface contracts between sets |
| `.planning/.locks/` | Lock files for concurrent access safety (gitignored). Auto-expire after 5 minutes. |
| `.planning/research/` | Research outputs from `/rapid:init` |
| `.planning/context/` | Codebase context files from `/rapid:context` |
| `.planning/sets/{set-name}/` | Per-set artifacts: SET-OVERVIEW.md, PLAN.md files |
| `.planning/worktrees/` | Worktree registry |
| `.rapid-worktrees/` | Git worktree checkout directories (one per started set) |
| `.rapid-web/` | Per-project web dashboard data (kanban, notes) -- created when RAPID_WEB=true |
| `web/` | Web dashboard source (FastAPI backend + React frontend) |

## Solo Mode

When `solo: true` in config.json (default for team size 1), sets work directly on main without creating worktrees or branches. The registry entry records `solo: true` and a `startCommit` hash used as the diff base for review scoping. Solo sets auto-transition from `complete` to `merged` since there is no branch to merge.

## Web Dashboard (v4.1.0)

An optional locally-hosted web dashboard at `http://127.0.0.1:8998`. Gated by `RAPID_WEB=true` in the environment.

| Variable | Purpose |
|----------|---------|
| `RAPID_WEB` | Set to `true` to enable web dashboard features |

The dashboard provides read-only project visualization: state views, worktree tracking, knowledge graph (DAG), codebase mapping, kanban board, and markdown notes. Data is stored in SQLite at `~/.rapid/rapid.db` with `.rapid-web/` per-project directories for portability.

---

Next: [State Machines](state-machines.md)
