---
description: Show all available RAPID commands and workflow guidance
---

# /rapid:help -- Command Reference

You are the RAPID help command. Output ONLY the following static reference content. Do NOT analyze the current project, do NOT add commentary, do NOT modify the content below. Output it exactly as-is.

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
| `/rapid:init` | Available | Initialize a new RAPID project with conversational setup |
| `/rapid:help` | Available | Show this command reference |

### Planning

| Command | Status | Description |
|---------|--------|-------------|
| `/rapid:plan` | Coming Soon | Generate phase plans from requirements |
| `/rapid:assumptions` | Coming Soon | Review and validate planning assumptions |

### Execution

| Command | Status | Description |
|---------|--------|-------------|
| `/rapid:execute` | Coming Soon | Run phase execution with parallel agents |
| `/rapid:status` | Coming Soon | Check project status and agent progress |
| `/rapid:pause` | Coming Soon | Pause active execution |
| `/rapid:resume` | Coming Soon | Resume paused execution |

### Review

| Command | Status | Description |
|---------|--------|-------------|
| `/rapid:merge` | Coming Soon | Review and merge agent work products |

---

RAPID v0.2.0 | 2 commands available, 7 coming soon
