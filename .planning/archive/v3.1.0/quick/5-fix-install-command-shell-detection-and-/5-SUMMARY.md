---
phase: quick-5
plan: 1
subsystem: install
tags: [setup, shell-detection, env-persistence]
dependency_graph:
  requires: []
  provides: [shell-detection, env-fallback]
  affects: [setup.sh, commands/install.md, skills/install/SKILL.md]
tech_stack:
  added: []
  patterns: [.env-persistence, shell-config-detection]
key_files:
  created:
    - .env.example
  modified:
    - setup.sh
    - commands/install.md
    - skills/install/SKILL.md
    - .gitignore
decisions:
  - "Shell detection builds dynamic menu from existing config files rather than assuming $SHELL"
  - "Always write .env to plugin root regardless of shell config choice"
  - ".env.example tracked in git, .env gitignored"
metrics:
  duration: 2 min
  completed: "2026-03-05T15:39:00Z"
---

# Quick Task 5: Fix Install Command Shell Detection and .env Persistence Summary

Rewrote setup.sh to detect all available shell configs and present a numbered menu (with current shell marked), always persist RAPID_TOOLS to a .env file in the plugin root, and updated install command/skill to load from .env as fallback.

## What Changed

### setup.sh
- Replaced single `$SHELL`-based detection with dynamic menu that checks which shell config files actually exist on the system
- Each detected config is presented as a numbered option with "(current)" marker for the active shell
- Added "Skip shell config (use .env only)" as final option
- Default selection is the current shell's config
- Always writes `.env` file to `$SCRIPT_DIR/.env` with RAPID_TOOLS path (regardless of shell choice)
- Creates `.env.example` template at runtime
- Updated summary message to show both .env and shell config persistence locations

### commands/install.md and skills/install/SKILL.md
- Added .env fallback loading in Step 2 (verification): loads RAPID_TOOLS from .env if env var is not set
- Updated Step 3 (user guidance) to mention .env file location and shell config
- Added note about dual persistence in description
- Both files kept identical (dual registration pattern)

### .gitignore and .env.example
- Added `.env` to .gitignore (prevents committing local paths)
- Created `.env.example` as tracked template

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 3da8748 | Rewrite setup.sh shell detection and add .env persistence |
| 2 | f8e7b58 | Update install command/skill with .env fallback loading |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] Added .env to .gitignore**
- **Found during:** Task 1
- **Issue:** .env file (containing local paths) would be tracked by git without .gitignore entry
- **Fix:** Added `.env` to .gitignore
- **Files modified:** .gitignore
- **Commit:** 3da8748

**2. [Rule 2 - Missing functionality] Created .env.example as tracked file**
- **Found during:** Task 1
- **Issue:** Plan specified .env.example but setup.sh only creates it at runtime; it should be tracked in git as a template
- **Fix:** Created .env.example as a committed file in the repo root
- **Files modified:** .env.example (new)
- **Commit:** 3da8748

## Self-Check: PASSED
