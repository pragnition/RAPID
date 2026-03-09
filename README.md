# RAPID

**Rapid Agentic Parallelizable and Isolatable Development for Claude Code**

A plugin that enables team-based parallel development by decomposing project work into a hierarchy of Sets, Waves, and Jobs -- each executing in isolated git worktrees, connected by machine-verifiable interface contracts, and validated through an adversarial review pipeline.

## Install

```
claude plugin add fishjojo1/RAPID
```

## Quick Start

1. Install the plugin (command above), then run `/rapid:install` to configure your environment
2. Run `/rapid:init` to research your project and generate a roadmap
3. Run `/rapid:plan` to decompose work into parallelizable sets with contracts

RAPID orchestrates the full development lifecycle: research, planning, parallel execution with isolated worktrees, adversarial code review, and intelligent merging.

## Features

- **Parallel Execution** -- Decompose work into Sets/Waves/Jobs. Sets run in parallel across developers, waves execute sequentially within a set, jobs execute in parallel within a wave.
- **Isolated Worktrees** -- Each set gets its own git worktree and branch, eliminating conflicts during development.
- **Interface Contracts** -- Machine-verifiable JSON Schema contracts enforce cross-set boundaries and file ownership.
- **Adversarial Review** -- Three-stage pipeline: unit testing, bug hunting (hunter/advocate/judge), and UAT with browser automation.
- **Intelligent Merging** -- 5-level conflict detection (textual, structural, dependency, API, semantic) with 4-tier resolution cascade and automatic bisection recovery.

## How It Works

RAPID structures work in a hierarchical model: a Project contains Milestones, each Milestone contains Sets (independent workstreams), each Set contains Waves (dependency-ordered groups), and each Wave contains Jobs (atomic work units). Sets execute in parallel across developers or Claude instances, while waves within a set execute sequentially. Jobs within a wave execute in parallel via subagents.

Before execution, RAPID runs a research pipeline (5 parallel agents covering stack, features, architecture, pitfalls, and oversights) and generates a roadmap. The planning phase decomposes work into sets with strict file ownership and interface contracts. Each set is initialized in an isolated git worktree, discussed with the developer to capture implementation vision, and planned at the wave and job level before execution begins.

## Hierarchy

```
Project
  Milestone (v1.0, v2.0, ...)
    Set (independent workstream -- own worktree and branch)
      Wave (dependency-ordered group -- sequential within set)
        Job (atomic work unit -- parallel within wave)
```

## Prerequisites

- Node.js 18+
- git 2.30+
- Claude Code (latest)

## Commands

| Command | Description |
|---------|-------------|
| `/rapid:install` | One-time setup: configure shell and environment |
| `/rapid:init` | Research, roadmap, scaffold `.planning/` directory |
| `/rapid:context` | Analyze existing codebase (brownfield projects) |
| `/rapid:plan` | Decompose into sets with contracts and DAG |
| `/rapid:set-init` | Create worktree and branch for a set |
| `/rapid:discuss` | Capture implementation vision for a wave |
| `/rapid:wave-plan` | Research, plan waves, plan jobs |
| `/rapid:execute` | Run jobs in parallel, reconcile per wave |
| `/rapid:review` | Unit test + bug hunt + UAT pipeline |
| `/rapid:merge` | 5-level detection, 4-tier resolution, DAG merge |
| `/rapid:cleanup` | Remove worktrees and branches |
| `/rapid:new-milestone` | Archive, bump version, re-plan |
| `/rapid:status` | Cross-set progress dashboard |
| `/rapid:assumptions` | Surface assumptions about a set before execution |
| `/rapid:pause` | Save state for later resumption |
| `/rapid:resume` | Resume a paused set |
| `/rapid:help` | Command reference and workflow guide |

See [DOCS.md](DOCS.md) for the full command reference, architecture details, and configuration.

## License

MIT -- see [LICENSE](LICENSE).
