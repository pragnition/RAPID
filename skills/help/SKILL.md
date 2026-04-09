---
description: Show all available RAPID commands and workflow guidance
disable-model-invocation: true
---

# /rapid:help -- Command Reference

You are the RAPID help command. Your ONLY job is to output the static reference content below. Follow these rules strictly:

1. Output the content below EXACTLY as written
2. Do NOT analyze the current project
3. Do NOT add commentary or suggestions beyond what is written below
4. Do NOT modify, abbreviate, or summarize the content
5. Do NOT check project state or files

Output this content now:

---

## RAPID v6.3.0 Workflow

```
  INIT -> /clear -> START-SET -> /clear -> DISCUSS-SET -> /clear -> PLAN-SET
    |                   |                       |                      |
    |                   |                       |                      +-- Research, wave plans, validation
    |                   |                       +-- Capture implementation vision
    |                   +-- Create worktree, scoped CLAUDE.md, set overview
    +-- Research, roadmap, model selection, project decomposition

  /clear -> EXECUTE-SET -> /clear -> REVIEW -> /clear -> MERGE
                 |                      |                    |
                 |                      |                    +-- Integrate to main
                 |                      +-- Scope for review (then unit-test, bug-hunt, uat)
                 +-- Parallel job execution per wave
```

> Tip: Run /clear between every command. Each RAPID step works best with a fresh context window.

## 7 Core Lifecycle Commands

| # | Command | Description |
|---|---------|-------------|
| 1 | `/rapid:init` | Initialize project -- research, roadmap, model selection, set decomposition |
| 2 | `/rapid:start-set` | Create isolated worktree, generate scoped CLAUDE.md, run set planner |
| 3 | `/rapid:discuss-set` | Capture developer implementation vision for a wave before planning |
| 4 | `/rapid:plan-set` | Plan all waves in a set -- research, wave plans, job plans, validation |
| 5 | `/rapid:execute-set` | Execute jobs within waves (parallel subagents or agent teams, smart re-entry) |
| 6 | `/rapid:review` | Scope a completed set for review -- produces REVIEW-SCOPE.md |
| 7 | `/rapid:merge` | Merge completed sets to main with contract validation and conflict detection |

## 3 Review Pipeline Commands

| # | Command | Description |
|---|---------|-------------|
| 1 | `/rapid:unit-test` | Run unit test pipeline (reads REVIEW-SCOPE.md) |
| 2 | `/rapid:bug-hunt` | Run adversarial bug hunt (reads REVIEW-SCOPE.md) |
| 3 | `/rapid:uat` | Run user acceptance testing (reads REVIEW-SCOPE.md) |

## 4 Auxiliary Commands

| # | Command | Description |
|---|---------|-------------|
| 1 | `/rapid:status` | Project dashboard with set statuses and next-action suggestions |
| 2 | `/rapid:install` | Plugin installation, shell configuration, .env setup |
| 3 | `/rapid:new-version` | Start new milestone/version cycle (archive, bump, re-plan) |
| 4 | `/rapid:add-set` | Add sets mid-milestone with discovery and contract generation |

## Meta

| Command | Description |
|---------|-------------|
| `/rapid:help` | This command reference |

## Kept Utilities

These commands are functional but not part of the primary 7+4 command set:

| Command | Description |
|---------|-------------|
| `/rapid:assumptions` | Surface and validate Claude's assumptions about a set |
| `/rapid:pause` | Pause current set work with handoff file for resumption |
| `/rapid:resume` | Resume paused set work from handoff |
| `/rapid:context` | Generate codebase context files (ARCHITECTURE.md, CONVENTIONS.md, etc.) |
| `/rapid:cleanup` | Remove completed set worktrees with safety checks |

## Additional Commands

| Command | Description |
|---------|-------------|
| `/rapid:documentation` | Generate and update project documentation |
| `/rapid:bug-fix` | Investigate and fix bugs with targeted agents |
| `/rapid:migrate` | Migrate .planning/ state from older versions |
| `/rapid:scaffold` | Generate project-type-aware foundation files |
| `/rapid:branding` | Conduct structured branding interview |
| `/rapid:audit-version` | Audit completed milestone for delivery gaps |
| `/rapid:register-web` | Register project with Mission Control dashboard |

## Typical Workflow

1. **`/rapid:install`** -- One-time setup: install plugin, configure shell, create .env
2. **`/rapid:init`** -- Project initialization: research, roadmap, decomposition into sets
   > /clear

Then for each set (in parallel across developers):

3. **`/rapid:start-set`** -- Claim a set: create worktree, generate scoped CLAUDE.md
   > /clear
4. **`/rapid:discuss-set`** -- Capture your implementation vision and design decisions
   > /clear
5. **`/rapid:plan-set`** -- Plan all waves (research, wave plans, job plans, validation)
   > /clear
6. **`/rapid:execute-set`** -- Run jobs (parallel agents within each wave)
   > /clear
7. **`/rapid:review`** -- Scope set for review (produces REVIEW-SCOPE.md)
   > /clear
7a. **`/rapid:unit-test`** -- Run unit test pipeline
   > /clear
7b. **`/rapid:bug-hunt`** -- Run adversarial bug hunt
   > /clear
7c. **`/rapid:uat`** -- Run user acceptance testing
   > /clear

After sets complete:

8. **`/rapid:merge`** -- Integrate sets to main with contract checks
   > /clear
9. **`/rapid:cleanup`** -- Remove worktrees for merged sets

Start next cycle:

10. **`/rapid:new-version`** -- Archive completed milestone, begin next version

---

RAPID v6.3.0 | 30 commands | Rapid Agentic Parallelizable and Isolatable Development
