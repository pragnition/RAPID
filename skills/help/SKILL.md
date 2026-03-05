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
  INIT ──> PLAN ──> EXECUTE ──> MERGE
   │         │         │          │
   │         │         │          └─ Review and integrate
   │         │         └─ Parallel agent execution
   │         └─ Phase planning and task breakdown
   └─ Project setup and prerequisites
```

## Available Commands

### Setup

| Command | Status | Description |
|---------|--------|-------------|
| `/rapid:install` | Available | Install and configure RAPID plugin for Claude Code |
| `/rapid:init` | Available | Initialize a new RAPID project with conversational setup |
| `/rapid:help` | Available | Show this command reference |
| `/rapid:context` | Available | Analyze codebase and generate project context files |

### Planning

| Command | Status | Description |
|---------|--------|-------------|
| `/rapid:plan` | Available | Decompose project into parallelizable sets with contracts |
| `/rapid:assumptions` | Available | Review Claude's mental model for a set before execution |

### Execution

| Command | Status | Description |
|---------|--------|-------------|
| `/rapid:execute` | Available | Run set execution with parallel agents (supports resume) |
| `/rapid:status` | Available | Check project status, worktree state, and wave progress |
| `/rapid:pause` | Available | Pause execution of a set and save state for resumption |

### Review

| Command | Status | Description |
|---------|--------|-------------|
| `/rapid:merge` | Available | Review, validate contracts, and merge set branches |
| `/rapid:cleanup` | Available | Clean up completed worktrees safely |

---

RAPID v1.0.0 | 11 commands available
