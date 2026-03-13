---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .claude-plugin/plugin.json
  - .claude-plugin/marketplace.json
  - .gitignore
  - config.json
  - package.json
  - package-lock.json
  - DOCS.md
  - LICENSE
  - commands/
  - skills/
  - src/
  - agents/
  - src/lib/core.cjs
  - src/lib/core.test.cjs
  - src/lib/merge.test.cjs
  - src/bin/rapid-tools.test.cjs
  - src/modules/core/core-state-access.md
  - skills/execute/SKILL.md
  - skills/merge/SKILL.md
  - skills/assumptions/SKILL.md
  - skills/pause/SKILL.md
  - skills/plan/SKILL.md
  - skills/context/SKILL.md
  - skills/status/SKILL.md
  - skills/cleanup/SKILL.md
  - skills/init/SKILL.md
  - commands/init.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "Claude Code discovers plugin.json at .claude-plugin/plugin.json when repo is cloned"
    - "All commands and skills resolve from repo root (not nested rapid/ subdir)"
    - "npm install succeeds at repo root"
    - "All tests pass after flattening"
    - "Internal path references (RAPID_TOOLS fallback, loadConfig, core-state-access) point to correct new locations"
  artifacts:
    - path: ".claude-plugin/plugin.json"
      provides: "Plugin manifest at discoverable root location"
    - path: "config.json"
      provides: "Agent assembly configuration at repo root"
    - path: "src/bin/rapid-tools.cjs"
      provides: "CLI entry point at repo root src/"
  key_links:
    - from: "skills/*/SKILL.md"
      to: "src/bin/rapid-tools.cjs"
      via: "RAPID_TOOLS env var fallback path"
      pattern: "RAPID_TOOLS:-\\$HOME/RAPID/src/bin/rapid-tools\\.cjs"
    - from: "src/lib/core.cjs"
      to: "config.json"
      via: "loadConfig path.join"
      pattern: "path\\.join\\(projectRoot, 'config\\.json'\\)"
---

<objective>
Flatten the RAPID plugin from the nested rapid/ subdirectory to the repo root so Claude Code can discover .claude-plugin/plugin.json when the repo is cloned.

Purpose: Currently the plugin manifest lives at rapid/.claude-plugin/plugin.json which is invisible to Claude Code's plugin loader that looks at repo root. Moving everything up one level makes the plugin discoverable.

Output: All plugin files at repo root, all internal path references updated, tests passing.
</objective>

<execution_context>
@/home/pog/.claude/get-shit-done/workflows/execute-plan.md
@/home/pog/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
Working with the RAPID plugin repo at /home/pog/RAPID.

Current structure has a nested rapid/ subdirectory containing the actual plugin.
The repo root only has .claude-plugin/marketplace.json (no plugin.json).
Claude Code looks for .claude-plugin/plugin.json at repo root and cannot find it.

Key files that need path updates after flattening:
- src/lib/core.cjs line 63: `path.join(projectRoot, 'rapid', 'config.json')` references the old nested path
- src/lib/core.test.cjs: Test setup creates `rapid/` subdir for config
- src/bin/rapid-tools.test.cjs line 29: Creates `rapid/` subdir for config test
- src/lib/merge.test.cjs lines 618/629/646: Creates `rapid/src/lib/` for test files
- src/modules/core/core-state-access.md: Hardcoded `node rapid/src/bin/rapid-tools.cjs`
- 12 skill/command files: RAPID_TOOLS fallback `$HOME/RAPID/rapid/src/bin/rapid-tools.cjs`
- DOCS.md: Directory structure listing starts with `rapid/`
- rapid/.claude/settings.json: `"plugins": ["~/RAPID/rapid"]`
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move all files from rapid/ to repo root and update plugin manifest</name>
  <files>
    .claude-plugin/plugin.json
    .claude-plugin/marketplace.json
    .gitignore
    config.json
    package.json
    package-lock.json
    DOCS.md
    LICENSE
    commands/
    skills/
    src/
    agents/
    rapid/
  </files>
  <action>
1. Replace .claude-plugin/marketplace.json with rapid/.claude-plugin/plugin.json:
   - `cp ~/RAPID/rapid/.claude-plugin/plugin.json ~/RAPID/.claude-plugin/plugin.json`
   - `rm ~/RAPID/.claude-plugin/marketplace.json`

2. Move all contents of rapid/ to repo root (commands, skills, src, agents, config.json, package.json, package-lock.json, DOCS.md, LICENSE):
   - Use `git mv` for tracked files to preserve history
   - `git mv rapid/commands ~/RAPID/commands`
   - `git mv rapid/skills ~/RAPID/skills`
   - `git mv rapid/src ~/RAPID/src`
   - `git mv rapid/config.json ~/RAPID/config.json`
   - `git mv rapid/package.json ~/RAPID/package.json`
   - `git mv rapid/package-lock.json ~/RAPID/package-lock.json`
   - `git mv rapid/DOCS.md ~/RAPID/DOCS.md`
   - `git mv rapid/LICENSE ~/RAPID/LICENSE`
   - `git mv rapid/.claude-plugin/plugin.json ~/RAPID/.claude-plugin/plugin.json` (if not already moved)
   - Copy rapid/agents/ if it exists (it is gitignored, so just copy)
   - Copy rapid/node_modules/ if it exists (gitignored)

3. Update root .gitignore -- merge in entries from rapid/.gitignore:
   - Add `node_modules/` line
   - Add `agents/` line
   - Keep existing entries (.rapid-worktrees/, .planning/worktrees/*.lock)

4. Delete the now-empty rapid/ directory:
   - `rm -rf ~/RAPID/rapid`

5. Remove or update .claude/settings.json if it exists (the one at rapid/.claude/settings.json had `"plugins": ["~/RAPID/rapid"]`). Since this was inside rapid/ and gets deleted with the directory, no action needed. But check if the user's ~/.claude/settings.json or any project-level settings reference the old path and update to `~/RAPID`.

6. Run `npm install` at repo root to verify dependencies resolve.

IMPORTANT: The root already has files like CLAUDE.md, .planning/, paul/, test/, user_plan.md -- do NOT overwrite or touch these. Only move files from rapid/ that don't conflict. The root has no commands/, skills/, src/, config.json, package.json etc. so no conflicts exist.
  </action>
  <verify>
    <automated>ls ~/RAPID/.claude-plugin/plugin.json && ls ~/RAPID/config.json && ls ~/RAPID/src/bin/rapid-tools.cjs && ls ~/RAPID/skills/execute/SKILL.md && ls ~/RAPID/commands/init.md && ! test -d ~/RAPID/rapid && echo "PASS: Files moved, rapid/ deleted"</automated>
  </verify>
  <done>All plugin files live at repo root. rapid/ directory no longer exists. npm install succeeds. .claude-plugin/plugin.json exists at root (marketplace.json removed).</done>
</task>

<task type="auto">
  <name>Task 2: Fix all internal path references broken by flattening</name>
  <files>
    src/lib/core.cjs
    src/lib/core.test.cjs
    src/bin/rapid-tools.test.cjs
    src/lib/merge.test.cjs
    src/modules/core/core-state-access.md
    skills/execute/SKILL.md
    skills/merge/SKILL.md
    skills/assumptions/SKILL.md
    skills/pause/SKILL.md
    skills/plan/SKILL.md
    skills/context/SKILL.md
    skills/status/SKILL.md
    skills/cleanup/SKILL.md
    skills/init/SKILL.md
    commands/init.md
    DOCS.md
  </files>
  <action>
Fix all broken path references. There are 5 categories:

**Category A: loadConfig path in core.cjs (CRITICAL)**
In `src/lib/core.cjs` line 63, change:
  `const configPath = path.join(projectRoot, 'rapid', 'config.json');`
to:
  `const configPath = path.join(projectRoot, 'config.json');`

Also update the JSDoc comment on loadConfig (line 51-55) to say "config.json relative to project root" instead of "rapid/config.json relative to project root".

**Category B: Test files that create rapid/ subdirectory for config**
In `src/lib/core.test.cjs` around line 96, the test creates `path.join(tmpDir, 'rapid')` and writes config.json there. Change to write config.json directly to tmpDir (no 'rapid' subdirectory).

In `src/bin/rapid-tools.test.cjs` around line 29, similar pattern: `const rapidConfigDir = path.join(tmpDir, 'rapid')` and copies config there. Change to copy config.json directly to tmpDir root.

In `src/lib/merge.test.cjs` around lines 618/629/646, creates `path.join(tmpDir, 'rapid', 'src', 'lib')` for test files. Change to `path.join(tmpDir, 'src', 'lib')`.

**Category C: RAPID_TOOLS fallback path in all skill/command files (12 files)**
In every SKILL.md and commands/*.md file, find-replace all occurrences of:
  `$HOME/RAPID/rapid/src/bin/rapid-tools.cjs`
with:
  `$HOME/RAPID/src/bin/rapid-tools.cjs`

The affected files are:
- skills/execute/SKILL.md (many occurrences)
- skills/merge/SKILL.md (many occurrences)
- skills/assumptions/SKILL.md
- skills/pause/SKILL.md
- skills/plan/SKILL.md
- skills/context/SKILL.md
- skills/status/SKILL.md
- skills/cleanup/SKILL.md
- skills/init/SKILL.md
- commands/init.md

Also in skills/execute/SKILL.md line 134, there is a node -e inline script with a similar fallback path for plan.cjs:
  `process.env.HOME + '/RAPID/rapid/src/lib/plan.cjs'`
Change to:
  `process.env.HOME + '/RAPID/src/lib/plan.cjs'`

**Category D: core-state-access.md hardcoded paths**
In `src/modules/core/core-state-access.md`, change all occurrences of:
  `node rapid/src/bin/rapid-tools.cjs`
to:
  `node src/bin/rapid-tools.cjs`

**Category E: DOCS.md directory structure**
In `DOCS.md`, update the directory structure listing (around line 209-247). Change the root from `rapid/` to the repo name or just show it as the root. The tree should start with:
```
RAPID/                              (repo root)
├── .claude-plugin/
│   └── plugin.json
├── commands/
...
```
Remove the nesting level -- everything is one level less indented since there is no rapid/ parent.
  </action>
  <verify>
    <automated>cd ~/RAPID && grep -r "RAPID/rapid" skills/ commands/ src/modules/ DOCS.md 2>/dev/null | grep -v node_modules | grep -v '.git/' | wc -l | xargs test 0 -eq && grep "projectRoot, 'rapid'" src/lib/core.cjs | wc -l | xargs test 0 -eq && grep "node rapid/" src/modules/core/core-state-access.md | wc -l | xargs test 0 -eq && echo "PASS: No stale rapid/ path references"</automated>
  </verify>
  <done>All internal path references updated. No file contains the old "rapid/src/bin/rapid-tools.cjs" fallback path. loadConfig reads config.json from project root directly. core-state-access.md uses "src/bin/rapid-tools.cjs". DOCS.md shows flat structure.</done>
</task>

<task type="auto">
  <name>Task 3: Run tests and verify plugin discoverability</name>
  <files>src/lib/*.test.cjs, src/bin/*.test.cjs</files>
  <action>
1. Run the full test suite from the repo root to verify nothing broke:
   `cd ~/RAPID && node --test src/lib/*.test.cjs src/bin/*.test.cjs`

   If tests fail, diagnose and fix. Common failure modes:
   - Tests that create tmpDir with `rapid/` subpath for config (should have been fixed in Task 2)
   - Tests using resolveRapidDir() -- this should still work since it uses __dirname relative (../../ from src/lib/ = repo root, which is now correct)
   - Import paths -- all use relative `require('./X.cjs')` so they should be unaffected by the move

2. Verify plugin discoverability:
   - Confirm `.claude-plugin/plugin.json` exists at repo root
   - Confirm it has valid JSON with name, version, description fields
   - Confirm no `.claude-plugin/marketplace.json` exists

3. Verify npm dependencies:
   - `cd ~/RAPID && npm ls` should show ajv, ajv-formats, proper-lockfile without errors

4. Check git status to ensure all moves are tracked and nothing unexpected is untracked.
  </action>
  <verify>
    <automated>cd ~/RAPID && node --test src/lib/*.test.cjs src/bin/*.test.cjs 2>&1 | tail -5 && node -e "const p=require('./`.claude-plugin/plugin.json`' || JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf-8'))); if(p.name==='rapid') console.log('PASS: plugin.json valid'); else process.exit(1)"</automated>
  </verify>
  <done>All tests pass. Plugin manifest is discoverable at .claude-plugin/plugin.json. npm dependencies resolve. Git status shows clean tracked moves.</done>
</task>

</tasks>

<verification>
- `.claude-plugin/plugin.json` exists at repo root and contains valid plugin manifest
- No `rapid/` directory exists
- `grep -r "RAPID/rapid" skills/ commands/ src/modules/ DOCS.md` returns zero results
- `grep "projectRoot, 'rapid'" src/lib/core.cjs` returns zero results
- `node --test src/lib/*.test.cjs src/bin/*.test.cjs` passes
- `npm ls` shows no missing dependencies
</verification>

<success_criteria>
- Claude Code plugin loader finds .claude-plugin/plugin.json at repo root
- All 10 skills and 5 commands reference correct path: $HOME/RAPID/src/bin/rapid-tools.cjs
- loadConfig() reads config.json from project root (no 'rapid' subdirectory)
- All existing tests pass without modification beyond the path fixes
- No stale references to the old rapid/ nested structure remain in any tracked file
</success_criteria>

<output>
After completion, create `.planning/quick/2-flatten-rapid-plugin-to-repo-root-for-cl/2-SUMMARY.md`
</output>
