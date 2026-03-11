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

## RAPID Workflow

```
  INIT ──> SET-INIT ──> DISCUSS ──> PLAN ──> EXECUTE ──> REVIEW ──> MERGE ──> CLEANUP
   │          │            │          │          │           │          │
   │          │            │          │          │           │          └─ Integrate to main
   │          │            │          │          │           └─ Test + bug hunt
   │          │            │          │          └─ Dispatch parallel agents per job
   │          │            │          └─ Plan all waves and jobs for the set
   │          │            └─ Capture implementation vision for the set
   │          └─ Claim set, create isolated worktree
   └─ Research, roadmap, and model selection
```

## Available Commands

### Setup

| Command | Description |
|---------|-------------|
| `/rapid:install` | Install RAPID plugin and configure environment (shell detection, .env setup) |
| `/rapid:init` | Initialize a new RAPID project (greenfield/brownfield detection, parallel research agents, roadmap generation) |

### Planning

| Command | Description |
|---------|-------------|
| `/rapid:set-init` | Claim a set for development, create isolated worktree |
| `/rapid:discuss` | Capture implementation vision for a set before detailed planning |
| `/rapid:plan` | Plan all waves in a set with automatic sequencing |
| `/rapid:assumptions` | Surface and validate Claude's assumptions about a set before execution |

### Execution

| Command | Description |
|---------|-------------|
| `/rapid:execute` | Execute jobs within a set (parallel via subagents or agent teams, supports resume) |
| `/rapid:status` | Display cross-set progress dashboard with set status overview |
| `/rapid:pause` | Pause current set work with handoff file for resumption |

### Review

| Command | Description |
|---------|-------------|
| `/rapid:review` | Run unit test > bug hunt > UAT pipeline for completed work |

### Merge

| Command | Description |
|---------|-------------|
| `/rapid:merge` | Merge completed sets to main with contract validation and conflict detection |
| `/rapid:cleanup` | Remove completed set worktrees with safety checks |

### Meta

| Command | Description |
|---------|-------------|
| `/rapid:new-milestone` | Start a new milestone/version cycle (archive current, bump version, re-plan) |
| `/rapid:help` | Show this command reference |

### Utility

| Command | Description |
|---------|-------------|
| `/rapid:quick` | Run a quick task on the current branch (tracked in project state) |
| `/rapid:migrate` | Migrate an existing project from another framework (GSD, openspec, etc.) to RAPID |

## Typical Workflow

1. **`/rapid:install`** -- One-time setup: install plugin, configure shell, create .env
2. **`/rapid:init`** -- Project initialization: research, roadmap, contracts, model selection

Then for each set (in parallel across developers):

3. **`/rapid:set-init`** -- Claim set for development, create worktree
4. **`/rapid:discuss`** -- Capture implementation vision for the set
5. **`/rapid:plan`** -- Plan all waves and jobs for the set
6. **`/rapid:execute`** -- Run jobs (parallel agents within waves)
7. **`/rapid:review`** -- Run adversarial review pipeline

After sets complete:

8. **`/rapid:merge`** -- Integrate sets to main with contract checks
9. **`/rapid:cleanup`** -- Remove worktrees for merged sets

Start next cycle:

10. **`/rapid:new-milestone`** -- Archive completed milestone, begin next version

---

RAPID v2.2 | 17 commands | Rapid Agentic Parallelizable and Isolatable Development
