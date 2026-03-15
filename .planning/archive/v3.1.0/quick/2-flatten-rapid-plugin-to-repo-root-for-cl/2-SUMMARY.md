---
phase: quick-2
plan: 01
subsystem: infra
tags: [plugin, flattening, claude-code, discoverability]

# Dependency graph
requires: []
provides:
  - "Plugin discoverable at repo root .claude-plugin/plugin.json"
  - "All plugin files (commands, skills, src, config) at repo root level"
  - "All internal path references updated to match flat structure"
affects: [all-skills, all-commands, plugin-discovery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plugin files at repo root (not nested subdirectory)"
    - "RAPID_TOOLS fallback path: $HOME/RAPID/src/bin/rapid-tools.cjs"

key-files:
  created: []
  modified:
    - ".claude-plugin/plugin.json"
    - ".gitignore"
    - "src/lib/core.cjs"
    - "src/lib/core.test.cjs"
    - "src/bin/rapid-tools.test.cjs"
    - "src/lib/merge.cjs"
    - "src/lib/merge.test.cjs"
    - "src/modules/core/core-state-access.md"
    - "skills/execute/SKILL.md"
    - "skills/merge/SKILL.md"
    - "skills/assumptions/SKILL.md"
    - "skills/pause/SKILL.md"
    - "skills/plan/SKILL.md"
    - "skills/context/SKILL.md"
    - "skills/status/SKILL.md"
    - "skills/cleanup/SKILL.md"
    - "skills/init/SKILL.md"
    - "commands/init.md"
    - "DOCS.md"
    - "package-lock.json"

key-decisions:
  - "Replaced marketplace.json with plugin.json at .claude-plugin/ (plugin.json is what Claude Code discovers)"
  - "Merged rapid/.gitignore entries into root .gitignore (node_modules/, agents/)"
  - "Deleted rapid/.claude/settings.json (referenced old nested path, no longer needed)"
  - "4 pre-existing test failures left unmodified (out of scope: worktree status header, assembler size, checkGitRepo, verify git)"

patterns-established:
  - "Plugin files live at repo root, not nested in subdirectory"

requirements-completed: []

# Metrics
duration: 7min
completed: 2026-03-05
---

# Quick Task 2: Flatten RAPID Plugin to Repo Root Summary

**Moved all plugin files from nested rapid/ subdirectory to repo root, making .claude-plugin/plugin.json discoverable by Claude Code's plugin loader**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-05T08:14:04Z
- **Completed:** 2026-03-05T08:20:36Z
- **Tasks:** 3
- **Files modified:** 73 (moves) + 17 (path fixes) + 1 (package-lock)

## Accomplishments
- All plugin files (commands/, skills/, src/, config.json, package.json, DOCS.md, LICENSE) moved from rapid/ to repo root using git mv (preserving history)
- Plugin manifest (.claude-plugin/plugin.json) now discoverable at repo root
- All 17 files with internal path references updated (loadConfig, RAPID_TOOLS fallback, test fixtures, DOCS.md)
- 517/521 tests pass (4 pre-existing failures unrelated to flattening)

## Task Commits

Each task was committed atomically:

1. **Task 1: Move all files from rapid/ to repo root and update plugin manifest** - `160692c` (feat)
2. **Task 2: Fix all internal path references broken by flattening** - `f6253f0` (fix)
3. **Task 3: Run tests and verify plugin discoverability** - `39350ed` (chore)

## Files Created/Modified
- `.claude-plugin/plugin.json` - Plugin manifest now at discoverable location (was marketplace.json)
- `.gitignore` - Merged in node_modules/ and agents/ from rapid/.gitignore
- `src/lib/core.cjs` - loadConfig reads config.json from project root (removed 'rapid' prefix)
- `src/lib/core.test.cjs` - Test writes config.json to tmpDir root (not tmpDir/rapid/)
- `src/bin/rapid-tools.test.cjs` - Test copies config.json to tmpDir root
- `src/lib/merge.cjs` - Integration test path updated to src/lib/*.test.cjs
- `src/lib/merge.test.cjs` - Test creates src/lib/ not rapid/src/lib/
- `src/modules/core/core-state-access.md` - CLI examples use src/bin/rapid-tools.cjs
- `skills/*/SKILL.md` (9 files) - RAPID_TOOLS fallback: $HOME/RAPID/src/bin/rapid-tools.cjs
- `commands/init.md` - RAPID_TOOLS fallback updated
- `DOCS.md` - Directory structure shows flat repo root, installation instructions updated
- `package-lock.json` - Version synced from 0.1.0 to 1.0.0

## Decisions Made
- Replaced marketplace.json with plugin.json (Claude Code looks for plugin.json, not marketplace.json)
- Merged rapid/.gitignore into root .gitignore rather than git mv (to keep existing root entries)
- Deleted rapid/.claude/settings.json which had stale "plugins": ["~/RAPID/rapid"] reference
- Left 4 pre-existing test failures as-is (out of scope: worktree status header format, assembler size limit, checkGitRepo resolution, verify.test.cjs git context)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed DOCS.md installation instructions**
- **Found during:** Task 2 (path reference fixes)
- **Issue:** DOCS.md had `cd RAPID/rapid && npm install` and `claude --plugin-dir ~/RAPID/rapid` installation commands
- **Fix:** Updated to `cd RAPID && npm install` and `claude --plugin-dir ~/RAPID`
- **Files modified:** DOCS.md
- **Verification:** grep confirms no RAPID/rapid references in DOCS.md
- **Committed in:** f6253f0 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed core.cjs resolveRapidDir JSDoc comment**
- **Found during:** Task 2 (path reference fixes)
- **Issue:** JSDoc still said "this file lives at rapid/src/lib/core.cjs"
- **Fix:** Updated to "this file lives at src/lib/core.cjs"
- **Files modified:** src/lib/core.cjs
- **Committed in:** f6253f0 (Task 2 commit)

**3. [Rule 1 - Bug] Fixed merge.cjs runIntegrationTests path**
- **Found during:** Task 2 (path reference fixes)
- **Issue:** merge.cjs had hardcoded `node --test rapid/src/lib/*.test.cjs` path
- **Fix:** Updated to `node --test src/lib/*.test.cjs`
- **Files modified:** src/lib/merge.cjs
- **Committed in:** f6253f0 (Task 2 commit)

**4. [Rule 1 - Bug] Synced package-lock.json version**
- **Found during:** Task 3 (test verification)
- **Issue:** package-lock.json had version 0.1.0 while package.json had 1.0.0
- **Fix:** npm install updated the version automatically
- **Files modified:** package-lock.json
- **Committed in:** 39350ed (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (4 bugs)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- 4 pre-existing test failures (517/521 pass): worktree status table header format, assembler size limit exceeded (18.6KB > 15KB), checkGitRepo test, and verify.test.cjs git context. All verified as pre-existing by running tests before our changes. Not caused by flattening.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plugin is now discoverable by Claude Code when repo is cloned
- All skills and commands work from the flat repo root structure
- Ready for plugin marketplace submission or direct usage

---
*Quick Task: 2-flatten-rapid-plugin-to-repo-root*
*Completed: 2026-03-05*
