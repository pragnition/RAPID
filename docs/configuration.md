# Configuration

This reference covers environment setup, the state schema, and the project directory layout for RAPID v3.0.

## Environment Variables

RAPID uses one environment variable and supports `.env` file loading as a fallback.

| Variable | Purpose | Set By |
|----------|---------|--------|
| `RAPID_TOOLS` | Absolute path to `src/bin/rapid-tools.cjs`. Required for all commands. | `/rapid:install` |

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
| `lock_timeout_ms` | number | milliseconds | `300000` (5 min) | Stale lock file expiration |

The `lock_timeout_ms` key is the only one with a built-in default in `loadConfig()`. All other keys are project-specific and set during initialization.

## State Schema (`STATE.json`)

Located at `.planning/STATE.json`. This is the machine-readable project state. In v3.0, state tracks at the set level only -- there is no wave or task state.

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
          "name": "string",
          "status": "pending | discussing | planning | executing | complete | merged",
          "branch": "string",
          "worktree": "string"
        }
      ]
    }
  }
}
```

### SetStatus Enum

`pending`, `discussing`, `planning`, `executing`, `complete`, `merged`

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

---

Next: [State Machines](state-machines.md)
