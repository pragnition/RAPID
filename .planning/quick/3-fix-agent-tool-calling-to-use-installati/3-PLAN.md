---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/modules/core/core-state-access.md
  - src/modules/core/core-context-loading.md
autonomous: true
requirements: [QUICK-3]

must_haves:
  truths:
    - "Agent CLI commands work when CWD is the user's project, not the RAPID installation"
    - "All executable rapid-tools.cjs references use RAPID_TOOLS env var with fallback"
    - "Informational/prose references remain unchanged"
  artifacts:
    - path: "src/modules/core/core-state-access.md"
      provides: "State access CLI commands with portable paths"
      contains: "RAPID_TOOLS"
    - path: "src/modules/core/core-context-loading.md"
      provides: "Context loading guidance with portable CLI reference"
      contains: "RAPID_TOOLS"
  key_links:
    - from: "src/modules/core/core-state-access.md"
      to: "src/bin/rapid-tools.cjs"
      via: "RAPID_TOOLS env var with ~/RAPID fallback"
      pattern: "RAPID_TOOLS:-~/RAPID"
---

<objective>
Fix hardcoded `node src/bin/rapid-tools.cjs` paths in agent core modules to use the `RAPID_TOOLS` env var with tilde fallback, matching the pattern established in skills.

Purpose: Agents run in the USER's project directory, not the RAPID installation root. Bare relative paths like `node src/bin/rapid-tools.cjs` fail because the file doesn't exist relative to the user's CWD.

Output: Updated core modules with portable CLI paths.
</objective>

<execution_context>
@/home/kek/.claude/get-shit-done/workflows/execute-plan.md
@/home/kek/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/modules/core/core-state-access.md
@src/modules/core/core-context-loading.md
@skills/status/SKILL.md (reference for established RAPID_TOOLS pattern)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update core-state-access.md CLI commands to use portable paths</name>
  <files>src/modules/core/core-state-access.md</files>
  <action>
Replace all 5 executable `node src/bin/rapid-tools.cjs` commands with the portable pattern using RAPID_TOOLS env var.

The established pattern in skills uses `$HOME` in the fallback:
```
node "${RAPID_TOOLS:-$HOME/RAPID/src/bin/rapid-tools.cjs}" ...
```

However, per CLAUDE.md: "use the tilde ~ instead of the $HOME environment variable" for shell commands. Use tilde in the fallback:
```
node "${RAPID_TOOLS:-~/RAPID/src/bin/rapid-tools.cjs}" ...
```

Lines to update (all in the CLI Commands section):
- Line 8: `node src/bin/rapid-tools.cjs state get [field]` -> `node "${RAPID_TOOLS:-~/RAPID/src/bin/rapid-tools.cjs}" state get [field]`
- Line 9: `node src/bin/rapid-tools.cjs state get --all` -> `node "${RAPID_TOOLS:-~/RAPID/src/bin/rapid-tools.cjs}" state get --all`
- Line 10: `node src/bin/rapid-tools.cjs state update <field> <value>` -> `node "${RAPID_TOOLS:-~/RAPID/src/bin/rapid-tools.cjs}" state update <field> <value>`
- Line 13: `node src/bin/rapid-tools.cjs lock acquire <name>` -> `node "${RAPID_TOOLS:-~/RAPID/src/bin/rapid-tools.cjs}" lock acquire <name>`
- Line 14: `node src/bin/rapid-tools.cjs lock status <name>` -> `node "${RAPID_TOOLS:-~/RAPID/src/bin/rapid-tools.cjs}" lock status <name>`

Also update the prose reference on line 3 to mention the env var:
Change "accessed through the `rapid-tools.cjs` CLI" to "accessed through the `rapid-tools.cjs` CLI (via `RAPID_TOOLS` env var)"

Do NOT change the Rules section -- it is prose guidance, not executable commands.
  </action>
  <verify>
    <automated>grep -c 'RAPID_TOOLS' src/modules/core/core-state-access.md | grep -q '[56]' && grep -c 'node src/bin/rapid-tools' src/modules/core/core-state-access.md | grep -q '^0$' && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>All 5 executable CLI commands use RAPID_TOOLS env var with ~/RAPID fallback. No bare relative paths remain.</done>
</task>

<task type="auto">
  <name>Task 2: Update core-context-loading.md CLI reference to use portable path</name>
  <files>src/modules/core/core-context-loading.md</files>
  <action>
Update line 8 which contains a semi-executable CLI reference:
```
Use `rapid-tools.cjs state get <field>` rather than reading STATE.md directly.
```

Change to include the full portable invocation pattern so agents copying this command get the right path:
```
Use `node "${RAPID_TOOLS:-~/RAPID/src/bin/rapid-tools.cjs}" state get <field>` rather than reading STATE.md directly.
```

This is the only change needed in this file. The other references are pure prose guidance.
  </action>
  <verify>
    <automated>grep -c 'RAPID_TOOLS' src/modules/core/core-context-loading.md | grep -q '1' && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>Context loading module references the portable CLI path pattern so agents get correct invocation syntax.</done>
</task>

</tasks>

<verification>
- `grep -r 'node src/bin/rapid-tools' src/modules/` returns zero matches (no bare relative paths remain in modules)
- `grep -r 'RAPID_TOOLS' src/modules/` shows matches in core-state-access.md and core-context-loading.md
- Informational references in core-identity.md and role-orchestrator.md are unchanged (they mention `rapid-tools.cjs` generically without executable paths)
</verification>

<success_criteria>
All executable rapid-tools.cjs references in agent core modules use the `RAPID_TOOLS` env var with `~/RAPID` tilde fallback, matching the portability pattern established in skills during phase 09.1.
</success_criteria>

<output>
After completion, create `.planning/quick/3-fix-agent-tool-calling-to-use-installati/3-SUMMARY.md`
</output>
