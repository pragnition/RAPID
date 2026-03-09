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

## RAPID Mark II Workflow

```
  INIT ──> CONTEXT ──> PLAN ──> [ per set: DISCUSS ──> PLAN ──> EXECUTE ──> REVIEW ] ──> MERGE ──> CLEANUP
   │          │          │                                          │                       │
   │          │          │                                          └─ Test + bug hunt       └─ Integrate to main
   │          │          └─ Set/wave/job planning with contracts
   │          └─ Codebase analysis and context generation
   └─ Research, roadmap, and model selection
```

## Available Commands

### Setup

| Command | Description |
|---------|-------------|
| `/rapid:init` | Initialize a new RAPID project (greenfield/brownfield detection, parallel research agents, roadmap generation) |
| `/rapid:install` | Install RAPID plugin and configure environment (shell detection, .env setup) |
| `/rapid:context` | Analyze codebase and generate project context files (CODEBASE.md, ARCHITECTURE.md, CONVENTIONS.md, STYLE_GUIDE.md, CLAUDE.md) |

### Planning

| Command | Description |
|---------|-------------|
| `/rapid:plan` | Plan sets and waves for the current milestone with interface contracts |
| `/rapid:discuss` | Capture implementation vision for a wave before detailed planning (Phase 20) |
| `/rapid:assumptions` | Surface and validate Claude's assumptions about a set before execution |

### Execution

| Command | Description |
|---------|-------------|
| `/rapid:execute` | Execute jobs within a wave (parallel via subagents or agent teams, supports resume) |
| `/rapid:status` | Display cross-set progress dashboard with set > wave > job hierarchy |
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

### Internal / Developer

| Command | Description |
|---------|-------------|
| `node rapid-tools.cjs build-agents` | Regenerate all agent .md files from source modules (run automatically during setup) |

> Commands marked (Phase N) are planned but not yet implemented. All commands listed above are either available or in active development for Mark II.

## Typical Workflow

1. **`/rapid:install`** -- One-time setup: install plugin, configure shell, create .env
2. **`/rapid:init`** -- Project initialization: research, roadmap, contracts, model selection
3. **`/rapid:context`** -- Generate codebase analysis and context files (especially for brownfield)
4. **`/rapid:plan`** -- Create detailed set/wave/job plans with contracts

Then for each set (in parallel across developers):

5. **`/rapid:discuss`** -- Capture vision for the current wave
6. **`/rapid:plan`** -- Detail the wave's jobs
7. **`/rapid:execute`** -- Run jobs (parallel agents within a wave)
8. **`/rapid:status`** -- Monitor progress across sets
9. **`/rapid:review`** -- Run adversarial review pipeline

After sets complete:

10. **`/rapid:merge`** -- Integrate sets to main with contract checks
11. **`/rapid:cleanup`** -- Remove worktrees for merged sets

Start next cycle:

12. **`/rapid:new-milestone`** -- Archive completed milestone, begin next version

---

RAPID v2.0 Mark II | 15 commands | Rapid Agentic Parallelizable and Isolatable Development
