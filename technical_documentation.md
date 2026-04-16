# RAPID Technical Documentation

This is the architectural deep-dive for RAPID v7.0.0 (Rapid Agentic Parallelizable and Isolatable Development). It explains how RAPID's systems fit together, the design rationale behind key architectural decisions, and the cross-cutting concerns that span multiple lifecycle stages. This document is intentionally a "thin companion" -- it covers architecture and design narrative rather than exhaustive per-topic detail, which lives in the [docs/](docs/) directory. For command reference and quick lookup, see [DOCS.md](DOCS.md). For topic-specific detail, see the [docs/](docs/) directory.

## Table of Contents

1. [System Architecture](#system-architecture) -- How RAPID's components fit together
2. [Agent Pipeline](#agent-pipeline) -- 27 agents across 7 categories
3. [State Machine Design](#state-machine-design) -- Rationale and lifecycle
4. [Planning and Execution Architecture](#planning-and-execution-architecture) -- From research to implementation
5. [Review Cascade Architecture](#review-cascade-architecture) -- 4-skill split and adversarial patterns
6. [Merge Strategy Architecture](#merge-strategy-architecture) -- DAG ordering, conflict resolution, solo mode
7. [Configuration and Environment](#configuration-and-environment) -- Env vars, config.json, .env
8. [Cross-Cutting Concerns](#cross-cutting-concerns) -- Memory, hooks, contracts, RAPID:RETURN, solo mode
9. [Reference Links](#reference-links) -- Pointers to all docs/ files

**Deep-dive references:** Each lifecycle stage has a companion doc in the [docs/](docs/) directory. See [DOCS.md](DOCS.md) for the full documentation index.

---

## Workflow Overview

A RAPID project follows a linear lifecycle from initialization through merge:

```
INIT --> START-SET --> DISCUSS-SET --> PLAN-SET --> EXECUTE-SET --> REVIEW --> MERGE
```

| Stage | Command | What Happens |
|-------|---------|-------------|
| **Init** | `/rapid:init` | Research the project domain, build a roadmap, scaffold `.planning/` |
| **Start Set** | `/rapid:start-set` | Create a worktree and branch for one set from the roadmap |
| **Discuss Set** | `/rapid:discuss-set` | Capture implementation vision via structured conversation (or `--skip` for auto) |
| **Plan Set** | `/rapid:plan-set` | 3-step pipeline produces per-wave PLAN.md files |
| **Execute Set** | `/rapid:execute-set` | One executor agent per wave, waves run sequentially |
| **Review** | `/rapid:review` | Scope the set for review (produces REVIEW-SCOPE.md) |
| **Merge** | `/rapid:merge` | Integrate set branch into main with conflict resolution |

Multiple developers work through this lifecycle in parallel -- each on their own set in an isolated worktree. Sets are independent: starting, executing, or merging one set never blocks another.

---

## System Architecture

RAPID is built around a small number of architectural decisions that enable safe parallel development by multiple AI agents. Understanding these decisions explains why the system is structured the way it is.

### Skills-as-Dispatchers

There is no central coordination agent. Each `/rapid:*` command is implemented as a skill that directly spawns the agents it needs. The init skill dispatches 9 agents (codebase synthesizer, 6 researchers, synthesizer, roadmapper). The plan-set skill dispatches 3 agents (researcher, planner, verifier). This direct-dispatch model eliminates coordination overhead and makes each command self-contained -- a skill reads state, dispatches agents, and writes results without consulting any other skill.

### Set Isolation Model

Git worktrees provide filesystem isolation. When a developer starts a set via `/rapid:start-set`, RAPID creates a new branch (`rapid/{set-name}`) and checks it out in a dedicated worktree under `.rapid-worktrees/`. Each set gets its own working directory. Developer A's changes in Set 1 do not affect Developer B working on Set 2. File ownership is exclusive -- CONTRACT.json declares which set owns which files, and no two sets modify the same file. This exclusivity is what makes parallel development safe: sets cannot conflict if they never touch the same files.

For solo developers, solo mode skips worktree creation entirely and works directly on main, avoiding the overhead of branches and merges for single-developer projects. For details on solo mode configuration, see [docs/configuration.md](docs/configuration.md).

### State Hierarchy

Sets are the sole stateful entity tracked in STATE.json. While waves and jobs exist as planning artifacts (in PLAN.md files and STATE.json sub-arrays), the lifecycle state machine operates exclusively at the set level. This keeps the state surface small and reduces the chance of state corruption during concurrent access. Every state mutation follows a strict transaction pattern: read STATE.json, validate preconditions, perform work, write atomically via temp-file-then-rename. State is validated by Zod schemas at runtime, catching malformed data before it propagates. For the full state schema and transition rules, see [docs/state-machines.md](docs/state-machines.md).

### Contract System

CONTRACT.json defines machine-verifiable interface boundaries between sets. Contracts specify file ownership (which set can modify which files), exported functions and types, and imported dependencies. Contract validation runs during planning (to verify planned work respects boundaries) and before merge (to ensure the final code satisfies interface commitments). Contracts are what make set independence enforceable rather than merely conventional.

### Artifact-Driven Architecture

The system bootstraps from STATE.json and disk artifacts. No conversation context is required -- the system is fully self-contained after a `/clear`. Crash recovery uses artifact scanning rather than in-memory state: WAVE-COMPLETE.md markers indicate completed waves, git log reveals which tasks have been committed, and HANDOFF.md files capture pause/resume context. This makes every command re-entrant: if the process crashes mid-execution, re-running the same command picks up exactly where it left off by scanning for existing artifacts against planned work. For crash recovery details, see the [State Machine Design](#state-machine-design) section below.

---

## Agent Pipeline

RAPID v7.0.0 uses 27 specialized agents organized into 7 categories. Skills dispatch agents directly -- there is no central coordination agent.

### Category Overview

| Category | Count | Role |
|----------|-------|------|
| **Core** | 4 | Hand-written agents (planner, executor, merger, reviewer) that define the user experience. Never overwritten by the build pipeline. |
| **Research** | 7 | Investigate the project domain during `/rapid:init` and `/rapid:new-version`. Six topic researchers run in parallel; one synthesizer merges results. |
| **Review** | 7 | Run the adversarial review pipeline: scoper, unit-tester, bug-hunter, devil's-advocate, judge, bugfix, and UAT agents. |
| **Merge** | 2 | Handle conflict detection (`rapid-set-merger`) and mid-confidence resolution (`rapid-conflict-resolver`) during `/rapid:merge`. |
| **Utility** | 6 | Support planning, verification, project setup, and auditing: roadmapper, set-planner, plan-verifier, verifier, codebase-synthesizer, and `rapid-auditor`. |
| **Context** | 1 | `rapid-context-generator` produces project context documents (CLAUDE.md, CODEBASE.md, ARCHITECTURE.md, CONVENTIONS.md, STYLE_GUIDE.md). |

### Hybrid Build Model

The 4 core agents (planner, executor, merger, reviewer) are hand-written with carefully crafted prompts. They are marked with `SKIP_GENERATION` and never overwritten by the build pipeline. The remaining 23 agents are generated via `build-agents` with embedded tool docs and XML prompt structure. Each generated agent embeds its own CLI command reference in YAML format, curated per role -- there is no shared reference file.

For the complete agent catalog with spawn hierarchy, input/output specs, and dispatch map, see [docs/agents.md](docs/agents.md).

---

## State Machine Design

RAPID v7.0.0 tracks state at the set level. Sets are the sole stateful entity in the lifecycle state machine, and this is a deliberate design choice.

### SetStatus Lifecycle

```
pending --> discussed --> planned --> executed --> complete --> merged
  |                        ^           ^
  |                        |           |
  +-- planned (skip)       |           +-- executed (self-loop)
                           |
                           +-- discussed (self-loop)
```

The lifecycle supports three non-linear transitions beyond the main chain:

- **Skip discuss:** `pending` can transition directly to `planned`, bypassing discussion entirely when delegation is preferred.
- **Re-discussion:** `discussed` can self-loop back to `discussed` for re-discussion with updated context.
- **Crash recovery re-execution:** `executed` can self-loop back to `executed` when re-running after a crash.

### Design Rationale

Why are sets the sole stateful entity? Waves and jobs exist as planning artifacts in STATE.json sub-arrays, but the lifecycle state machine validates transitions only at the set level. This keeps the state surface small -- there is exactly one status enum to validate per set -- and reduces the chance of state corruption during concurrent access by multiple agents. Wave and job states (`pending`, `executing`, `complete`) track progress within a set but do not participate in the cross-set lifecycle.

Why independence? No set transition rejects based on another set's status. Sets can be started, executed, reviewed, and merged in any order. This independence is what enables safe parallelism -- if one developer is blocked on review, it does not prevent another from merging a different set.

### Solo Mode

When `solo: true` in config.json (default for team size 1), sets work directly on main without creating worktrees or branches. The worktree registry records `solo: true` and a `startCommit` hash used as the diff base for review scoping. Solo sets auto-transition from `complete` to `merged` since there is no branch to merge.

### Crash Recovery

RAPID preserves a crash recovery triad:

1. **detectCorruption** -- Validates STATE.json against the Zod schema. Returns diagnostic information if the state is malformed or missing.
2. **recoverFromGit** -- Restores the last committed version of STATE.json from git history.
3. **Atomic writes** -- The temp-file-then-rename pattern ensures crashes during writes leave a valid state file (either old or new, never partial).

For the full transition table, wave/job lifecycles, and crash recovery details, see [docs/state-machines.md](docs/state-machines.md).

---

## Planning and Execution Architecture

### Planning Pipeline

Planning uses a 3-step pipeline that produces per-wave PLAN.md files in 2-4 total agent spawns:

1. **Research** -- `rapid-research-stack` investigates implementation specifics for the set's scope.
2. **Planning** -- `rapid-planner` decomposes the set into waves with per-wave PLAN.md files. Each PLAN.md contains tasks, file assignments, and acceptance criteria.
3. **Verification** -- `rapid-plan-verifier` validates plans for coverage, implementability, and consistency.

After verification, contract enforcement runs to validate that the planned work respects interface boundaries defined in CONTRACT.json.

Planning also supports gap-closure mode via `--gaps`, which processes a GAPS.md artifact from a prior merge to plan remediation waves rather than fresh implementation. For details on planning, see [docs/planning.md](docs/planning.md).

### Execution Model

Execution runs one `rapid-executor` agent per wave, processing waves sequentially. Within each wave, the executor implements all tasks from the wave's PLAN.md file, committing atomically per task. After all waves complete, a `rapid-verifier` agent checks that set objectives are met.

Execution is fully re-entrant through artifact-based completion detection. On every invocation, the skill reads planning artifacts to classify each wave: waves with WAVE-COMPLETE.md markers are skipped, the first incomplete wave resumes from its last committed task, and subsequent waves execute normally. This means crashing and re-running `/rapid:execute-set` always picks up exactly where it left off.

Execution also supports gap-closure mode via `--gaps`, which re-executes using gap-closure plans rather than the original PLAN.md files. For details on execution, see [docs/execution.md](docs/execution.md).

---

## Review Cascade Architecture

Since v4.4, the review pipeline is split into 4 independent skills. This is a deliberate architectural decision: separating scoping from testing allows each review skill to run independently, in any order, and on any schedule.

### 4-Skill Split

| Skill | Purpose | Output |
|-------|---------|--------|
| `/rapid:review` | Scope the set: diff against main, categorize files by concern | `REVIEW-SCOPE.md` |
| `/rapid:unit-test` | Generate and run unit tests per concern group | `REVIEW-UNIT.md` |
| `/rapid:bug-hunt` | Adversarial bug hunting with fix cycles | `REVIEW-BUGS.md` |
| `/rapid:uat` | User acceptance testing with automated and human steps | `REVIEW-UAT.md` |

`/rapid:review` must run first to produce `REVIEW-SCOPE.md`. The three downstream skills consume that scope artifact independently -- you can run any combination in any order.

### Adversarial Pattern

The bug hunt pipeline uses a hunter-advocate-judge pattern with up to 3 iterative fix-and-rehunt cycles:

1. `rapid-bug-hunter` agents analyze scoped files for bugs (one per concern group, parallel).
2. `rapid-devils-advocate` challenges each finding with counter-evidence to reduce false positives.
3. `rapid-judge` rules on each finding: ACCEPTED, DISMISSED, or DEFERRED.
4. Accepted bugs are dispatched to `rapid-bugfix` for targeted fixes with atomic commits.
5. Cycles 2-3 narrow scope to only the files modified by bugfix, preventing scope creep.

This adversarial structure exists because single-pass bug detection has high false-positive rates. The advocate-judge pattern filters findings through structured skepticism before any code is modified.

### UAT Architecture

UAT generates acceptance test plans with steps tagged as automated (browser automation) or human-verified. Automated steps execute via the configured browser tool; human steps pause for verification. UAT runs once on the full scope -- it is never chunked or concern-scoped, unlike unit tests and bug hunts which operate per concern group.

For the full review pipeline stages, see [docs/review.md](docs/review.md).

---

## Merge Strategy Architecture

The merge pipeline integrates completed set branches into main with conflict detection, resolution, and contract validation.

### DAG-Ordered Merging

Sets merge in dependency order defined by DAG.json. The DAG (Directed Acyclic Graph) records which sets depend on which others, and the merge pipeline processes them in topological order so each merge sees the result of all its dependencies. Sets process sequentially so each merge sees the result of the previous one.

### Fast-Path Optimization

Before dispatching any subagent, the skill runs `git merge-tree --write-tree` to test for conflicts. If the merge is clean (exit code 0), no subagent is needed -- the set merges directly. This is the common case for well-isolated sets with strict file ownership.

### 5-Level Conflict Detection

When conflicts exist, a `rapid-set-merger` subagent runs 5-level conflict detection:

1. **Textual** -- Line-level conflicts in the same file
2. **Structural** -- Incompatible code structure changes
3. **Dependency** -- Conflicting package or import changes
4. **API** -- Breaking interface changes between sets
5. **Semantic** -- Logically incompatible behavior changes

### 4-Tier Resolution Cascade

| Tier | Confidence | Action |
|------|-----------|--------|
| T1 | > 0.9 | Auto-resolved, no review needed |
| T2 | 0.7 - 0.9 | Auto-resolved, flagged for review |
| T3 | 0.3 - 0.7 | Dispatched to `rapid-conflict-resolver` for deep analysis |
| T4 | < 0.3 | Escalated to developer for manual resolution |

API-signature conflicts always require human direction regardless of confidence score.

### Adaptive Resolution

Mid-confidence conflicts (T3) are dispatched to dedicated `rapid-conflict-resolver` agents. Each resolver performs deep semantic analysis of the conflict. Results with confidence above 0.7 are auto-accepted; below 0.7, they escalate to the developer with the resolver's analysis attached.

### Solo Mode

Solo sets (working directly on main without a branch) are detected automatically. Since their work is already on main, the merge pipeline skips them and auto-transitions the set to `merged` status.

### MERGE-STATE.json

Per-set merge tracking file that enables idempotent re-entry. MERGE-STATE.json records which sets have been processed, allowing the merge pipeline to resume safely after interruption without re-merging sets that already completed.

### Contract Validation

Before executing the merge, the pipeline validates that interface contracts defined in CONTRACT.json are satisfied. Contract violations block the merge.

### Bisection Recovery

The merge pipeline includes bisection recovery for detecting which merge introduced a regression. When a post-merge test failure is detected, bisection can identify the offending set merge.

For the full merge pipeline, see [docs/merge-and-cleanup.md](docs/merge-and-cleanup.md).

---

## Configuration and Environment

### Environment Variables

| Variable | Purpose | Set By |
|----------|---------|--------|
| `RAPID_TOOLS` | Absolute path to `src/bin/rapid-tools.cjs`. Required for all commands. | `/rapid:install` |
| `NO_COLOR` | When set, suppresses ANSI color codes in banner output. | User |
| `RAPID_WEB` | Set to `true` to enable Mission Control web dashboard features. | User |

Every skill loads `RAPID_TOOLS` from both the shell environment and the project's `.env` file (whichever is available).

### .env File

Created by `/rapid:install` in the plugin root directory. Contains `RAPID_TOOLS` as the critical path, plus optional API keys for observability (Langfuse) and the Anthropic API.

### config.json

Located at `.planning/config.json`. Key settings that shape agent behavior and workflow:

| Key | Purpose |
|-----|---------|
| `model_profile` | Model selection profile (`"quality"` or `"speed"`) for agent dispatch |
| `granularity` | Task sizing (`"fine"` or `"coarse"`) that shapes plan decomposition |
| `solo` | Solo mode toggle (default `true` for team size 1) -- no worktrees, work on main |
| `workflow.research` | Enable/disable research phase during planning |
| `workflow.plan_check` | Enable/disable plan verification after planning |
| `workflow.verifier` | Enable/disable post-execution verification |
| `lock_timeout_ms` | Stale lock file expiration (default 300000ms / 5 minutes) |
| `mode` | Execution mode |
| `parallelization` | Enable parallel dispatch within waves |
| `commit_docs` | Auto-commit documentation files |

For the full configuration reference, see [docs/configuration.md](docs/configuration.md).

---

## Cross-Cutting Concerns

These systems span multiple lifecycle stages and shape how RAPID operates as a whole.

### Memory System

RAPID agents build and query project memory across sessions via `rapid-tools.cjs` memory commands. The `memory log-decision` command records architectural decisions with category, rationale, and source. The `memory log-correction` command captures course corrections when initial assumptions prove wrong. Memory persists across `/clear` boundaries because it is stored as disk artifacts, not conversation context.

### Hook System

Post-task verification hooks (`hooks run`, `hooks list`) provide automated quality checks at lifecycle transitions. The hook system runs a verify shell script (`src/hooks/rapid-verify.sh`) that checks for common issues after each task completion. Hooks are configurable and can be extended per-project.

### RAPID:RETURN Protocol

Every RAPID agent invocation ends with a structured return in a hybrid format: a human-readable Markdown table and a machine-parseable JSON payload in an HTML comment. Returns use one of three statuses:

- **COMPLETE** -- All assigned tasks finished successfully, with artifacts and commits listed.
- **CHECKPOINT** -- Pausing mid-execution with full handoff context (what is done, what remains, key decisions made).
- **BLOCKED** -- Cannot continue due to a dependency, permission, clarification, or error.

This protocol enables machine-driven orchestration: skills parse the JSON payload to determine whether to dispatch the next agent, resume from a checkpoint, or escalate a blocker.

### DAG.json and Worktree Registry

DAG.json records the dependency graph between sets. It determines merge order (sets merge in topological order) and enables RAPID to detect when sets have unresolved dependencies. The worktree registry (`REGISTRY.json` in `.planning/worktrees/`) tracks active worktrees, their branches, and solo mode entries. Together, these artifacts let any command understand the current state of parallel development without querying git directly.

### Quality Profiles

The `model_profile` and `granularity` settings in config.json shape agent behavior across the lifecycle. Quality profile (`"quality"` vs `"speed"`) controls which model tier agents use. Granularity (`"fine"` vs `"coarse"`) controls how finely the planner decomposes work into tasks. Agent output artifacts are verified against quality profile anti-patterns to maintain consistency.

### DEFERRED.md Auto-Discovery

When `/rapid:new-version` starts a new milestone, it scans for DEFERRED.md files across all sets in the current and archived milestones. Deferred items are automatically included in the researcher briefs for the new milestone, ensuring that postponed work is never lost across version boundaries.

### Gap-Closure Mode

The `--gaps` flag on `/rapid:plan-set` and `/rapid:execute-set` enables post-merge gap remediation. After merging, a GAPS.md artifact may identify issues that need fixing. Gap-closure mode plans and executes remediation waves using the GAPS.md as input rather than the original roadmap. This closes the loop between merge validation and corrective action.

---

## Reference Links

| Document | Coverage |
|----------|----------|
| [docs/setup.md](docs/setup.md) | Installation, project initialization, context generation, web dashboard setup |
| [docs/agents.md](docs/agents.md) | Full agent catalog, spawn hierarchy, I/O specs, dispatch map |
| [docs/state-machines.md](docs/state-machines.md) | SetStatus lifecycle, wave/job states, transition rules, crash recovery |
| [docs/configuration.md](docs/configuration.md) | Environment variables, config.json keys, state schema, directory layout |
| [docs/planning.md](docs/planning.md) | Init pipeline, discuss-set, plan-set, add-set, quick tasks |
| [docs/execution.md](docs/execution.md) | Execute-set, artifact-based re-entry, gap-closure execution |
| [docs/review.md](docs/review.md) | Review scoping, unit-test, bug-hunt, UAT pipelines |
| [docs/merge-and-cleanup.md](docs/merge-and-cleanup.md) | Merge pipeline, cleanup, new-version, pause/resume, migrate |
| [docs/auxiliary.md](docs/auxiliary.md) | Specialized commands: branding, scaffold, documentation, bug-fix, audit-version |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Common issues and resolution steps |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Version history and per-release changes |
