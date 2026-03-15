---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - CLAUDE.md
  - user_plan.md
  - rapid/.claude/settings.json
  - test/.planning/PROJECT.md
  - test/.planning/REQUIREMENTS.md
  - test/.planning/ROADMAP.md
  - test/.planning/STATE.md
  - test/.planning/config.json
  - .planning/.locks/.gitignore
  - .planning/.locks/state.target
autonomous: true
requirements: []
must_haves:
  truths:
    - "All non-nested-repo untracked files are committed to main"
    - "Commit is pushed to origin (fishjojo1/RAPID)"
    - "paul/ directory is excluded to avoid submodule issues"
  artifacts:
    - path: "CLAUDE.md"
      provides: "Project instructions"
    - path: "user_plan.md"
      provides: "Project plan document"
  key_links:
    - from: "local main"
      to: "origin/main"
      via: "git push"
      pattern: "git push origin main"
---

<objective>
Commit all untracked files (excluding the nested git repo `paul/`) and push to fishjojo1/RAPID on GitHub.

Purpose: Get the current project state pushed to the remote repository so it is backed up and accessible.
Output: All untracked files committed and pushed to origin/main.
</objective>

<execution_context>
@/home/pog/.claude/get-shit-done/workflows/execute-plan.md
@/home/pog/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Stage all safe untracked files (skip paul/)</name>
  <files>CLAUDE.md, user_plan.md, rapid/.claude/settings.json, test/.planning/PROJECT.md, test/.planning/REQUIREMENTS.md, test/.planning/ROADMAP.md, test/.planning/STATE.md, test/.planning/config.json, .planning/.locks/.gitignore, .planning/.locks/state.target</files>
  <action>
Stage each untracked file individually using git add. Do NOT add the paul/ directory -- it contains a nested .git repo and adding it would create submodule issues or corrupt history.

Specific files to add:
- git add CLAUDE.md
- git add user_plan.md
- git add rapid/.claude/settings.json
- git add "test/.planning/PROJECT.md" "test/.planning/REQUIREMENTS.md" "test/.planning/ROADMAP.md" "test/.planning/STATE.md" "test/.planning/config.json"
- git add ".planning/.locks/.gitignore" ".planning/.locks/state.target"

After staging, run git status to confirm paul/ is NOT staged and all other untracked files are staged.
  </action>
  <verify>
    <automated>cd /home/pog/RAPID && git diff --cached --name-only | sort</automated>
  </verify>
  <done>All files except paul/ are staged. git status shows paul/ still as untracked, everything else is in "Changes to be committed".</done>
</task>

<task type="auto">
  <name>Task 2: Commit and push to origin</name>
  <files>None (git operations only)</files>
  <action>
Create a commit with message: "chore: add project files, config, and test planning docs"

Then push to origin main:
- git push origin main

If push fails due to auth, create a checkpoint for the user to authenticate. If push fails due to diverged history (unlikely on a fresh remote), report the error -- do NOT force push.
  </action>
  <verify>
    <automated>cd /home/pog/RAPID && git log --oneline -1 && git status</automated>
  </verify>
  <done>Commit exists on main. Push succeeds -- git log on remote matches local HEAD. Working tree shows only paul/ as untracked.</done>
</task>

</tasks>

<verification>
- git log --oneline -1 shows the new commit
- git status shows clean working tree except paul/ as untracked
- git remote show origin confirms main is up to date (or push was successful)
</verification>

<success_criteria>
All untracked files (CLAUDE.md, user_plan.md, rapid/.claude/, test/.planning/, .planning/.locks/) are committed and pushed to https://github.com/fishjojo1/RAPID.git. The paul/ nested git repo is excluded.
</success_criteria>

<output>
After completion, create `.planning/quick/1-commit-and-push-this-to-fishjojo1-rapid/1-SUMMARY.md`
</output>
