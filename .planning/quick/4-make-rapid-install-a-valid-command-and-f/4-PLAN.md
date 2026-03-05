---
phase: quick-4
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/install.md
  - commands/help.md
  - DOCS.md
  - .planning/PROJECT.md
  - .planning/research/SUMMARY.md
  - .planning/research/PITFALLS.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "/rapid:install exists as both a skill (skills/install/SKILL.md) and a command (commands/install.md)"
    - "commands/help.md lists /rapid:install and shows 11 commands"
    - "RAPID acronym is expanded as 'Rapid Agentic Parallelizable and Isolatable Development' (recursive) everywhere"
  artifacts:
    - path: "commands/install.md"
      provides: "Legacy command registration for /rapid:install"
    - path: "commands/help.md"
      provides: "Updated help with install command and correct count"
  key_links:
    - from: "commands/install.md"
      to: "skills/install/SKILL.md"
      via: "Dual registration pattern — same command available through both systems"
---

<objective>
Fix two issues with the RAPID plugin:

1. `/rapid:install` exists only as a skill (skills/install/SKILL.md) but has no corresponding legacy command file (commands/install.md). The dual registration pattern requires both for max Claude Code compatibility.

2. The RAPID acronym is inconsistently expanded. It should be "Rapid Agentic Parallelizable and Isolatable Development" (recursive acronym where R = Rapid) but many files omit the leading "Rapid".

Additionally, commands/help.md is out of sync with skills/help/SKILL.md — missing the install command entry and showing "10 commands" instead of "11 commands".

Purpose: Ensure /rapid:install works via both command systems and fix branding consistency.
Output: commands/install.md created, help updated, acronym references fixed.
</objective>

<execution_context>
@/home/kek/.claude/get-shit-done/workflows/execute-plan.md
@/home/kek/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@commands/help.md
@skills/install/SKILL.md
@skills/help/SKILL.md
@DOCS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create commands/install.md and sync commands/help.md with skills/help/SKILL.md</name>
  <files>commands/install.md, commands/help.md</files>
  <action>
1. Create `commands/install.md` following the dual registration pattern. Use the same YAML frontmatter pattern as other commands (description field, allowed-tools matching the skill). The content should mirror `skills/install/SKILL.md` — same description, disable-model-invocation, allowed-tools (Read, Bash), and identical step-by-step instructions. Copy the full content from the SKILL.md.

2. Update `commands/help.md` to match `skills/help/SKILL.md` exactly:
   - Add `/rapid:install` row to the Setup table (first row, before /rapid:init):
     `| /rapid:install | Available | Install and configure RAPID plugin for Claude Code |`
   - Update footer from "RAPID v1.0.0 | 10 commands available" to "RAPID v1.0.0 | 11 commands available"
  </action>
  <verify>
    <automated>test -f commands/install.md && grep -q "rapid:install" commands/help.md && grep -q "11 commands" commands/help.md && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>commands/install.md exists with same content as skills/install/SKILL.md; commands/help.md lists /rapid:install and shows 11 commands; commands/help.md content matches skills/help/SKILL.md</done>
</task>

<task type="auto">
  <name>Task 2: Fix RAPID acronym to use recursive form everywhere</name>
  <files>DOCS.md, .planning/PROJECT.md, .planning/research/SUMMARY.md, .planning/research/PITFALLS.md</files>
  <action>
The RAPID acronym is a recursive acronym: "Rapid Agentic Parallelizable and Isolatable Development" (R = Rapid, like GNU = GNU's Not Unix). Currently many files expand it as just "Agentic Parallelizable and Isolatable Development" (missing the leading "Rapid").

Fix these specific occurrences:

1. `DOCS.md` line 3: Change "RAPID (Agentic Parallelizable and Isolatable Development)" to "RAPID (Rapid Agentic Parallelizable and Isolatable Development)"
2. `DOCS.md` line 384: Change "Agentic Parallelizable and Isolatable Development for Claude Code" to "Rapid Agentic Parallelizable and Isolatable Development for Claude Code"
3. `.planning/PROJECT.md` line 1: Change "RAPID -- Agentic Parallelizable and Isolatable Development" to "RAPID -- Rapid Agentic Parallelizable and Isolatable Development"
4. `.planning/research/SUMMARY.md` line 3: Change "RAPID -- Agentic Parallelizable and Isolatable Development" to "RAPID -- Rapid Agentic Parallelizable and Isolatable Development"
5. `.planning/research/PITFALLS.md` last line: Change "RAPID -- Agentic Parallelizable and Isolatable Development" to "RAPID -- Rapid Agentic Parallelizable and Isolatable Development"

Do NOT modify files under `.planning/phases/` (those are historical plan/research records and should not be revised).
  </action>
  <verify>
    <automated>grep -r "Agentic Parallelizable" DOCS.md .planning/PROJECT.md .planning/research/SUMMARY.md .planning/research/PITFALLS.md | grep -v "Rapid Agentic" | wc -l | xargs -I{} test {} -eq 0 && echo "PASS: all refs use recursive acronym" || echo "FAIL: some refs still missing Rapid prefix"</automated>
  </verify>
  <done>All acronym expansions in DOCS.md, PROJECT.md, SUMMARY.md, PITFALLS.md use "Rapid Agentic Parallelizable and Isolatable Development" (recursive form). Historical phase files left unchanged.</done>
</task>

</tasks>

<verification>
- `commands/install.md` exists and has same content as `skills/install/SKILL.md`
- `commands/help.md` matches `skills/help/SKILL.md` (same command list, same count)
- All non-historical acronym references use recursive form "Rapid Agentic Parallelizable and Isolatable Development"
- `diff commands/help.md <(sed 's/^---$/---/' skills/help/SKILL.md)` shows minimal/no differences (aside from skill-specific frontmatter)
</verification>

<success_criteria>
- /rapid:install has dual registration (both commands/install.md and skills/install/SKILL.md)
- Help output shows 11 commands including /rapid:install
- RAPID acronym consistently expanded as recursive form in all active documentation
</success_criteria>

<output>
After completion, create `.planning/quick/4-make-rapid-install-a-valid-command-and-f/4-SUMMARY.md`
</output>
