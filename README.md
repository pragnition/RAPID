# RAPID

**Rapid Agentic Parallelizable and Isolatable Development**

A Claude Code plugin that turns a single-player AI coding experience into a coordinated multi-developer workflow with parallel execution, isolated worktrees, and intelligent merging.

---

## The Problem

Claude Code is powerful for a solo developer, but the moment two people use it on the same project, things fall apart fast.

Developer A's agent rewrites a utility file while Developer B's agent is importing from it. Nobody owns any file, so agents happily overwrite each other's work. Merge conflicts pile up because there's no coordination layer between independent Claude sessions. Even when the code merges cleanly at the text level, semantic conflicts slip through undetected -- incompatible API changes, duplicated abstractions, contradictory design decisions.

The core issue isn't Claude Code itself. It's that parallel AI-assisted development needs the same things parallel human development needs: isolation, ownership, contracts, and a structured merge strategy. Without those, you're not doing parallel development -- you're doing concurrent chaos.

RAPID solves this by giving each developer an isolated worktree with strict file ownership, connecting workstreams through machine-verifiable interface contracts, and merging them back through a multi-level conflict detection and resolution pipeline. The agents coordinate so the humans don't have to.

## Install

```
claude plugin add fishjojo1/RAPID
```

Then run `/rapid:install` inside Claude Code to configure your environment.

## How It Works

RAPID structures work in a hierarchy:

- A **Milestone** (e.g., v1.0, v2.0) contains **Sets** -- independent workstreams
- Each **Set** contains **Waves** -- dependency-ordered groups
- Each **Wave** contains **Jobs** -- atomic work units

Sets run in parallel across developers -- Developer A works on the auth system while Developer B builds the dashboard -- each in their own git worktree on their own branch. Waves within a set run sequentially because later waves depend on earlier ones. Jobs within a wave run in parallel via subagents because they touch different files.

Before any code is written, RAPID runs a research pipeline (5 parallel agents covering stack, features, architecture, pitfalls, and cross-cutting concerns), synthesizes the findings, and generates a roadmap. The planning phase then decomposes work into sets with strict file ownership and interface contracts. Contracts are JSON Schema definitions that specify exactly which functions, types, and endpoints each set exposes to others. If Set A needs a function from Set B, the contract enforces that Set B actually exports it with the right signature.

After execution, each set passes through an adversarial review pipeline -- unit testing, a three-stage bug hunt (hunter, devil's advocate, judge), and UAT with browser automation. You choose which stages to run.

Sets then merge into main through a pipeline that detects conflicts at 5 levels (textual, structural, dependency, API, semantic) and resolves them through a 4-tier cascade. Adaptive conflict resolution routes each conflict by confidence: high-confidence resolutions are auto-accepted, mid-confidence conflicts are dispatched to dedicated resolver agents, and low-confidence conflicts go directly to the developer. Clean merges skip conflict detection entirely via a fast-path `git merge-tree` check.

## Architecture

```
                         Milestone (v1.0, v2.0, ...)
           ┌──────────────────┼──────────────────┐
       Set 1 (Dev A)     Set 2 (Dev B)      Set 3 (Dev C)
       ┌────┴────┐       ┌────┴────┐        ┌────┘
    Wave 1    Wave 2   Wave 1    Wave 2    Wave 1
    ┌─┴─┐    ┌─┘      ┌─┴─┐    ┌─┘        ┌─┘
  Job A Job B Job C  Job D Job E Job F    Job G
  ──────────────────────────────────────────────

  Agent Dispatch
  ──────────────────────────────────────────────
  orchestrator ─┬─ job-executor  (parallel per job)
                ├─ scoper + reviewer  (review pipeline)
                └─ set-merger ─── conflict-resolver
                    (per set)       (per conflict)
```

Sets run in full isolation (own worktree, own branch). Jobs within a wave execute as parallel subagents, each restricted to its assigned files. The merge pipeline delegates per-set work to `set-merger` subagents, which can further dispatch `conflict-resolver` agents for mid-confidence conflicts -- the only two-level agent nesting in the system.

## Quick Start

### Prerequisites

- **Node.js 18+** -- runtime for RAPID's tooling
- **git 2.30+** -- required for worktree support
- **Claude Code** (latest) -- the AI coding assistant RAPID orchestrates

### Installation

First, add the plugin:

```
claude plugin add fishjojo1/RAPID
```

Then inside Claude Code, run the one-time setup:

```
/rapid:install
```

This configures the `RAPID_TOOLS` environment variable for your shell and creates a `.env` file in the plugin directory.

### Project Setup

<details open>
<summary><strong>Greenfield (new project)</strong></summary>

1. **`/rapid:init`** -- Runs 5 parallel research agents to analyze your project domain
   (stack, features, architecture, pitfalls, cross-cutting concerns), synthesizes
   findings, and generates a roadmap. Scaffolds the `.planning/` directory with all
   project state.

2. **`/rapid:plan`** -- Decomposes the roadmap into parallelizable sets with strict
   file ownership, interface contracts (JSON Schema), and a dependency DAG. Each set
   becomes an independent workstream that one developer can own end-to-end.

</details>

<details open>
<summary><strong>Brownfield (existing codebase)</strong></summary>

1. **`/rapid:init`** -- Same research pipeline as greenfield. Includes a codebase
   synthesizer agent that analyzes your existing code structure, patterns, and
   conventions so the roadmap builds on what's already there rather than starting
   from scratch.

2. **`/rapid:context`** -- Deep analysis of your existing codebase. Generates
   context documents that subsequent agents use to understand your project's patterns,
   conventions, and architecture. Run this before planning so the decomposition
   respects your existing structure.

3. **`/rapid:plan`** -- Same decomposition as greenfield, but informed by the context
   analysis. Sets are designed to integrate with your existing code rather than
   replace it.

</details>

### Per-Set Development

This is where parallel work happens. Each developer claims a set and works through
it independently. Developer A works on Set 1 while Developer B works on Set 2 --
both running these steps in their own worktree at the same time.

1. **`/rapid:set-init <set-id>`** -- Creates an isolated git worktree and branch for
   the set. Generates a scoped `CLAUDE.md` with set-specific context and runs a set
   planner to produce a high-level implementation overview.

2. **`/rapid:discuss <set-id>`** -- Structured discussion about a set's
   implementation approach. Identifies product and UX gray areas across all waves,
   conducts a single-round discussion (one question per area), and splits decisions
   into per-wave WAVE-CONTEXT.md files. Run once per set.

3. **`/rapid:plan <set-id>`** -- Plans all waves in a set with a single command.
   Detects dependencies between waves, groups them into parallel batches, then runs
   the full planning pipeline (research, wave plan, job plans, verification) for each
   wave in dependency order. Supports smart re-entry -- re-running skips already-planned
   waves.

4. **`/rapid:execute <set-id>`** -- Dispatches parallel subagents (one per job) across
   all waves sequentially. Each job-executor implements its assigned files, commits
   atomically, and reports back. Waves auto-advance on success; failures pause for
   retry. Supports smart re-entry -- if interrupted, re-running skips completed jobs
   and retries failed ones.

5. **`/rapid:review <set-id>`** -- Runs the adversarial review pipeline. You choose
   which stages to run:
   - **Unit testing** -- generates a test plan for approval, writes and runs tests
   - **Bug hunt** -- hunter finds issues, devil's advocate challenges, judge rules
     (up to 3 fix-and-rehunt cycles)
   - **UAT** -- acceptance testing with browser automation (Chrome DevTools or
     Playwright)

### Finalization

After all sets pass review:

1. **`/rapid:merge`** -- Merges completed sets into main in DAG order. Clean merges
   skip conflict detection entirely via `git merge-tree` fast path. Conflicting
   merges dispatch per-set `set-merger` subagents for 5-level detection and 4-tier
   resolution. Mid-confidence conflicts route to dedicated `conflict-resolver` agents.
   Integration tests run between merge waves with automatic bisection recovery on
   failure.

2. **`/rapid:cleanup <set-id>`** -- Removes the set's worktree and optionally deletes
   its branch. Safe to run after merge -- blocks removal if uncommitted changes exist.

3. **`/rapid:new-milestone`** -- Archives the current milestone, bumps the version,
   and starts a new planning cycle. Use when the current milestone's scope is complete
   and you're ready for the next phase of work.

### Utility Commands

These can be used at any point during development:

- **`/rapid:status`** -- Cross-set progress dashboard showing the full set > wave > job
  hierarchy with completion status and actionable next steps.
- **`/rapid:pause <set-id>`** -- Saves set state for later resumption. Use when you
  need to context-switch to a different set or take a break.
- **`/rapid:resume <set-id>`** -- Resumes a paused set from where it left off.
- **`/rapid:assumptions <set-id>`** -- Surfaces Claude's mental model about how a set
  will be implemented so you can catch misunderstandings before execution begins.
- **`/rapid:help`** -- Quick command reference and workflow guide.

## Command Reference

| Command | Arguments | Description |
|---------|-----------|-------------|
| `/rapid:install` | _(none)_ | One-time setup: configure shell and environment |
| `/rapid:init` | _(none)_ | Research project, generate roadmap, scaffold `.planning/` |
| `/rapid:context` | _(none)_ | Analyze existing codebase and generate context files |
| `/rapid:plan` | _(none)_ or `<set-id>` | Decompose into sets (no args) or plan all waves in a set |
| `/rapid:assumptions` | `<set-id>` | Surface assumptions about a set before execution |
| `/rapid:set-init` | `<set-id>` | Create worktree and branch for a set |
| `/rapid:discuss` | `<set-id>` | Capture implementation vision for a set |
| `/rapid:execute` | `<set-id>` or `<set-id> --fix-issues` | Run jobs in parallel per wave |
| `/rapid:review` | `<set-id>` | Unit test + bug hunt + UAT pipeline |
| `/rapid:merge` | _(none)_ or `<set-id>` | Merge completed sets into main |
| `/rapid:cleanup` | `<set-id>` | Remove worktrees and optionally delete branches |
| `/rapid:pause` | `<set-id>` | Save set state for later resumption |
| `/rapid:resume` | `<set-id>` | Resume a paused set |
| `/rapid:status` | _(none)_ | Cross-set progress dashboard |
| `/rapid:new-milestone` | _(none)_ | Archive current milestone, re-plan new scope |
| `/rapid:help` | _(none)_ | Command reference and workflow guide |

**Notes:**
- Commands accepting `<set-id>` support both string IDs (e.g., `auth-system`) and numeric indices (e.g., `1`).

## Further Reading

For detailed configuration, all 31 agent roles, state machine documentation, and troubleshooting, see [technical_documentation.md](technical_documentation.md).

## License

MIT -- see [LICENSE](LICENSE).
