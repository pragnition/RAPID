---
phase: quick-7
plan: 1
subsystem: plugin-bootstrap
tags: [env-loading, resilience, developer-experience]
dependency_graph:
  requires: [quick-5]
  provides: [consistent-env-fallback]
  affects: [all-skills, commands, core-modules]
tech_stack:
  patterns: [env-fallback-guard, CLAUDE_SKILL_DIR-resolution]
key_files:
  modified:
    - skills/init/SKILL.md
    - skills/status/SKILL.md
    - skills/plan/SKILL.md
    - skills/execute/SKILL.md
    - skills/merge/SKILL.md
    - skills/pause/SKILL.md
    - skills/cleanup/SKILL.md
    - skills/context/SKILL.md
    - skills/assumptions/SKILL.md
    - commands/init.md
    - src/modules/core/core-context-loading.md
    - src/modules/core/core-state-access.md
decisions:
  - Core modules use CLAUDE_SKILL_DIR availability guard since they may run in contexts where it is unavailable
  - Skills and commands use RAPID_ROOT variable for readability
metrics:
  duration: 1 min
  completed: 2026-03-05
---

# Quick Task 7: Update All Skills/Commands with .env Fallback Loading

Propagated .env fallback pattern from install skill to all 12 remaining files, ensuring RAPID_TOOLS loads from .env when not in shell environment.

## What Changed

### Task 1: Updated 9 skill files (a49d141)

Added the 3-line .env fallback guard to all skill SKILL.md files (excluding install, which already had it):

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Files: init, status, plan, execute, merge, pause, cleanup, context, assumptions

### Task 2: Updated command and core modules (00e8b9a)

- **commands/init.md**: Same CLAUDE_SKILL_DIR pattern as skills
- **core-context-loading.md** and **core-state-access.md**: Added CLAUDE_SKILL_DIR availability guard since core modules may run in contexts where the variable is unavailable:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
```

## Verification Results

- 12/12 files have .env fallback loading
- 12/12 files retain the hard-fail RAPID_TOOLS guard as last resort
- install skill was not modified (already correct)

## Deviations from Plan

None -- plan executed exactly as written.
