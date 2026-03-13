---
phase: quick-7
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
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
autonomous: true
requirements: [QUICK-7]

must_haves:
  truths:
    - "All skills and commands load RAPID_TOOLS from .env if env var is not set"
    - "The fallback pattern is consistent across all files"
    - "Existing behavior unchanged when RAPID_TOOLS is already set in environment"
  artifacts:
    - path: "skills/init/SKILL.md"
      provides: "Init skill with .env fallback guard"
      contains: ".env"
    - path: "skills/status/SKILL.md"
      provides: "Status skill with .env fallback guard"
      contains: ".env"
    - path: "commands/init.md"
      provides: "Init command with .env fallback guard"
      contains: ".env"
    - path: "src/modules/core/core-context-loading.md"
      provides: "Core module with .env fallback guard"
      contains: ".env"
  key_links:
    - from: "all skills and commands"
      to: ".env file in plugin root"
      via: "CLAUDE_SKILL_DIR-based path resolution"
      pattern: "grep -v.*\\.env.*xargs"
---

<objective>
Update all RAPID skills, commands, and core modules to load RAPID_TOOLS from the .env file as a fallback when the environment variable is not set.

Purpose: Currently, if RAPID_TOOLS is not in the shell environment (e.g., new terminal, fresh session), all skills hard-fail with an error. The install skill already has a .env fallback pattern -- this task propagates that pattern to all other files.

Output: All 12 files updated with consistent .env fallback loading before the RAPID_TOOLS guard check.
</objective>

<execution_context>
@/home/kek/.claude/get-shit-done/workflows/execute-plan.md
@/home/kek/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@skills/install/SKILL.md (reference pattern for .env fallback -- lines 52-56)
@.env.example (shows env var format)
</context>

<interfaces>
<!-- Established .env fallback pattern from skills/install/SKILL.md: -->

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then
    export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs)
fi
```

<!-- Current hard-fail guard (present in all target files): -->

```bash
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Update all skills with .env fallback loading</name>
  <files>skills/init/SKILL.md, skills/status/SKILL.md, skills/plan/SKILL.md, skills/execute/SKILL.md, skills/merge/SKILL.md, skills/pause/SKILL.md, skills/cleanup/SKILL.md, skills/context/SKILL.md, skills/assumptions/SKILL.md</files>
  <action>
In each of the 9 skill SKILL.md files listed above, replace the existing hard-fail RAPID_TOOLS guard block:

```bash
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

With this .env-fallback-then-guard block (3 lines replacing 1 line):

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

This is the same pattern already used in skills/install/SKILL.md Step 2. The logic:
1. Compute RAPID_ROOT from CLAUDE_SKILL_DIR (skills are 2 levels deep: skills/name/SKILL.md)
2. If RAPID_TOOLS is unset AND .env exists, source it
3. If RAPID_TOOLS is STILL unset after .env attempt, fail with error

Do NOT modify the install skill -- it already has this pattern.
  </action>
  <verify>
    <automated>grep -c "RAPID_ROOT.*CLAUDE_SKILL_DIR" skills/init/SKILL.md skills/status/SKILL.md skills/plan/SKILL.md skills/execute/SKILL.md skills/merge/SKILL.md skills/pause/SKILL.md skills/cleanup/SKILL.md skills/context/SKILL.md skills/assumptions/SKILL.md | grep -v ':0$' | wc -l</automated>
  </verify>
  <done>All 9 skill files have the 3-line .env fallback guard pattern. Count of files with RAPID_ROOT line equals 9.</done>
</task>

<task type="auto">
  <name>Task 2: Update commands and core modules with .env fallback loading</name>
  <files>commands/init.md, src/modules/core/core-context-loading.md, src/modules/core/core-state-access.md</files>
  <action>
Update the remaining 3 files that have the hard-fail guard.

**For commands/init.md:** Replace the guard with:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Note: commands/init.md uses `CLAUDE_SKILL_DIR` with `../..` (same as the install command already does -- see commands/install.md line 22). Keep this consistent.

**For src/modules/core/core-context-loading.md and src/modules/core/core-state-access.md:**
These are core modules assembled into agent prompts. Agents are spawned from skills/commands that set RAPID_TOOLS, but as a safety net, replace the guard in the Prerequisites section with:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

For core modules, we also guard on CLAUDE_SKILL_DIR being set since these modules may run in contexts where it is unavailable.
  </action>
  <verify>
    <automated>grep -c "\.env" commands/init.md src/modules/core/core-context-loading.md src/modules/core/core-state-access.md | grep -v ':0$' | wc -l</automated>
  </verify>
  <done>All 3 files have .env fallback loading. Command uses CLAUDE_SKILL_DIR pattern. Core modules use CLAUDE_SKILL_DIR with additional guard for availability.</done>
</task>

</tasks>

<verification>
Run across ALL modified files to confirm:
1. Every file that previously had the hard-fail guard now has the .env fallback before it
2. No file lost the final hard-fail guard (it must still be present as last resort)
3. The install skill was NOT modified (already correct)

```bash
# Verify all 12 target files have .env reference
grep -l "\.env" skills/init/SKILL.md skills/status/SKILL.md skills/plan/SKILL.md skills/execute/SKILL.md skills/merge/SKILL.md skills/pause/SKILL.md skills/cleanup/SKILL.md skills/context/SKILL.md skills/assumptions/SKILL.md commands/init.md src/modules/core/core-context-loading.md src/modules/core/core-state-access.md | wc -l
# Expected: 12

# Verify all still have the final hard-fail guard
grep -l "RAPID ERROR.*RAPID_TOOLS is not set" skills/init/SKILL.md skills/status/SKILL.md skills/plan/SKILL.md skills/execute/SKILL.md skills/merge/SKILL.md skills/pause/SKILL.md skills/cleanup/SKILL.md skills/context/SKILL.md skills/assumptions/SKILL.md commands/init.md src/modules/core/core-context-loading.md src/modules/core/core-state-access.md | wc -l
# Expected: 12
```
</verification>

<success_criteria>
- All 9 skills (excluding install) have the 3-line .env fallback guard
- commands/init.md has the .env fallback guard
- Both core modules have the .env fallback guard with CLAUDE_SKILL_DIR availability check
- The hard-fail error message is preserved as last resort in all files
- install skill is unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/7-update-init-and-other-commands-to-load-e/7-SUMMARY.md`
</output>
