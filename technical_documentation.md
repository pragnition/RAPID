# RAPID Technical Documentation

This is the deep reference for RAPID v3.0 (Rapid Agentic Parallelizable and Isolatable Development). It covers the full development lifecycle, all 26 agents, state machine transitions, configuration, and command reference. If you are new to RAPID, see the [README](README.md) for a quickstart guide.

## Table of Contents

1. [Workflow Overview](#workflow-overview) -- The full lifecycle at a glance
2. [Project Initialization](#project-initialization) -- `/rapid:init`
3. [Set Lifecycle](#set-lifecycle) -- `/rapid:start-set`, `/rapid:discuss-set`
4. [Planning](#planning) -- `/rapid:plan-set`
5. [Execution](#execution) -- `/rapid:execute-set`
6. [Review](#review) -- `/rapid:review`
7. [Merge](#merge) -- `/rapid:merge`
8. [Auxiliary Commands](#auxiliary-commands) -- `/rapid:status`, `/rapid:install`, `/rapid:new-version`, `/rapid:add-set`, `/rapid:quick`
9. [Utility Commands](#utility-commands) -- `/rapid:assumptions`, `/rapid:pause`, `/rapid:resume`, `/rapid:context`, `/rapid:cleanup`, `/rapid:help`
10. [Agent Reference](#agent-reference) -- All 26 agents by category
11. [State Machine](#state-machine) -- SetStatus lifecycle
12. [Configuration](#configuration) -- Environment, STATE.json, directory layout

**Deep-dive references:** Each lifecycle stage has a companion doc in the [docs/](docs/) directory for topic-specific detail.

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
| **Review** | `/rapid:review` | Adversarial pipeline: unit tests, bug hunt, UAT |
| **Merge** | `/rapid:merge` | Integrate set branch into main with conflict resolution |

Multiple developers work through this lifecycle in parallel -- each on their own set in an isolated worktree. Sets are independent: starting, executing, or merging one set never blocks another.

---

## Project Initialization

**Command:** `/rapid:init`

Initialization bootstraps a new RAPID project. It handles both greenfield projects (no existing code) and brownfield projects (existing codebase to analyze).

### What happens

1. **Prerequisite checks** -- Verifies Node.js, git, and RAPID_TOOLS are available.

2. **Batched discovery** -- An adaptive conversation gathers project context in 4 topic batches rather than 8-15 individual questions:
   - Vision and Users
   - Features and Technical constraints
   - Scale and Integrations
   - Context and Success criteria

3. **Codebase synthesis** (brownfield only) -- A `rapid-codebase-synthesizer` agent analyzes the existing code for structure, patterns, and conventions.

4. **Parallel research** -- 6 research agents run simultaneously, each investigating a different domain:
   - `rapid-research-stack` -- Technology choices and trade-offs
   - `rapid-research-features` -- Feature implementation patterns
   - `rapid-research-architecture` -- Architecture design decisions
   - `rapid-research-pitfalls` -- Common mistakes to avoid
   - `rapid-research-oversights` -- Edge cases and forgotten requirements
   - `rapid-research-ux` -- User experience direction and patterns

5. **Synthesis** -- `rapid-research-synthesizer` merges all 6 research outputs into a unified RESEARCH.md with recommendations across stack, features, architecture, pitfalls, oversights, and UX.

6. **Roadmap** -- `rapid-roadmapper` proposes sets for the milestone based on synthesized research. The roadmap goes through a propose-then-approve loop before any files are written. Sets only -- wave and task decomposition is deferred to `/rapid:plan-set`.

### Output

The initialization pipeline scaffolds the `.planning/` directory:

```
.planning/
  PROJECT.md          -- Project description and core value
  REQUIREMENTS.md     -- Requirements extracted from discovery
  ROADMAP.md          -- Sets with dependency ordering
  STATE.json          -- Machine-readable state (sets only)
  CONTRACT.json       -- Interface contracts between sets
  config.json         -- Project configuration
  research/           -- Individual research outputs (STACK.md, FEATURES.md, etc.)
```

**Agents spawned:** 9 total (codebase-synthesizer + 6 researchers + synthesizer + roadmapper)

---

## Set Lifecycle

### Starting a Set

**Command:** `/rapid:start-set <set-id>`

Claims a set for development by creating an isolated git worktree and branch (`rapid/{set-name}`). A `rapid-set-planner` agent produces a SET-OVERVIEW.md with the set's scope, file ownership, and approach. A scoped CLAUDE.md is generated in the worktree with set-specific context and deny lists.

The worktree gives each developer a clean workspace -- Developer A's changes in Set 1 do not affect Developer B working on Set 2.

### Discussion

**Command:** `/rapid:discuss-set <set-id>` or `/rapid:discuss-set <set-id> --skip`

Captures implementation vision before planning begins. The skill identifies exactly 4 gray areas where multiple valid approaches exist, then asks batched questions (2-3 per area) via structured conversation. Decisions are recorded in CONTEXT.md for the planner to consume.

**`--skip` flag:** For teams that prefer full delegation, `--skip` spawns a `rapid-research-stack` agent that auto-generates CONTEXT.md from the roadmap and codebase scan without user interaction.

**State transition:** The set moves from `pending` to `discussing` when discussion starts.

---

## Planning

**Command:** `/rapid:plan-set <set-id>`

Planning uses a 3-step pipeline that produces per-wave PLAN.md files in 2-4 total agent spawns (down from 15-20 in earlier versions):

1. **Research** -- `rapid-research-stack` investigates implementation specifics for the set's scope.

2. **Planning** -- `rapid-planner` decomposes the set into waves with per-wave PLAN.md files. Each PLAN.md contains tasks, file assignments, and acceptance criteria.

3. **Verification** -- `rapid-plan-verifier` validates plans for coverage, implementability, and consistency.

After verification, contract enforcement runs to validate that the planned work respects interface boundaries defined in CONTRACT.json.

### Output

```
.planning/sets/{set-name}/
  PLAN-wave-1.md      -- Tasks for wave 1
  PLAN-wave-2.md      -- Tasks for wave 2 (if multi-wave)
  VERIFICATION.md     -- Plan verifier report
```

**State transition:** The set moves from `discussing` to `planning`.

### Ad-hoc Planning

**Command:** `/rapid:quick <description>`

For ad-hoc changes that do not warrant a full set structure, `/rapid:quick` runs a lightweight 3-agent pipeline: planner, plan-verifier, and executor. Quick tasks are excluded from STATE.json sets to avoid polluting the `/rapid:status` dashboard.

### Mid-milestone Set Addition

**Command:** `/rapid:add-set <set-name>`

Adds new sets to an existing milestone mid-stream. Writes directly to STATE.json using the same pattern as `/rapid:init` -- no special CLI command needed.

---

## Execution

**Command:** `/rapid:execute-set <set-id>`

Execution runs one `rapid-executor` agent per wave, processing waves sequentially. Within each wave, the executor implements all tasks from the wave's PLAN.md file, committing atomically per task.

### How it works

1. The skill reads all PLAN.md files to determine which waves exist and their order.
2. For each wave, one `rapid-executor` agent is spawned with the wave's PLAN.md as input.
3. The executor implements tasks in order, committing each completed task.
4. After all waves complete, a lean `rapid-verifier` agent checks that set objectives are met.

### Artifact-based completion detection

The executor determines what work is done by reading planning artifacts rather than relying on state. It checks which PLAN.md files have corresponding implementation commits (via WAVE-COMPLETE.md markers and git log). This makes execution fully re-entrant: if the process crashes mid-wave, re-running `/rapid:execute-set` picks up exactly where it left off by scanning for existing commits against planned tasks.

### Re-entry after crash

On every invocation, the skill reads planning artifacts to classify each wave:
- Waves with WAVE-COMPLETE.md markers are skipped
- The first incomplete wave resumes from its last committed task
- Subsequent waves execute normally

**State transition:** The set moves from `planning` to `executing`, then to `complete` after verification.

**Agents spawned:** 1 per wave + 1 verifier

---

## Review

**Command:** `/rapid:review <set-id>`

The review pipeline validates a completed set through a multi-stage adversarial process. Review operates at the set level -- all changed files across all waves are scoped together.

### Pipeline stages

1. **Scoping** -- `rapid-scoper` diffs the set branch against main, identifies changed files and their dependents, and categorizes them into concern groups (e.g., "authentication", "database", "UI"). If cross-cutting files exceed 50%, scoping falls back to directory chunking (groups of 15 files max).

2. **Unit testing** -- `rapid-unit-tester` agents (one per concern group, parallel) generate test plans and execute tests. Results go to REVIEW-UNIT.md.

3. **Bug hunting** -- A three-stage adversarial pipeline with up to 3 fix-and-rehunt cycles:
   - `rapid-bug-hunter` agents analyze scoped files for bugs (one per concern group, parallel)
   - `rapid-devils-advocate` challenges each finding with counter-evidence
   - `rapid-judge` rules on each finding: ACCEPTED, DISMISSED, or DEFERRED
   - Accepted bugs are dispatched to `rapid-bugfix` for targeted fixes
   - Cycles 2-3 narrow scope to only modified files, preventing scope creep

4. **UAT** -- `rapid-uat` generates acceptance test plans with automated (browser) and human-verified steps. Results go to REVIEW-UAT.md.

### Output

```
REVIEW-UNIT.md       -- Unit test results
REVIEW-BUGS.md       -- Bug findings with verdicts
REVIEW-UAT.md        -- UAT results
REVIEW-SUMMARY.md    -- Consolidated review summary
```

**State transition:** The set must be in `complete` status to start review.

**Agents spawned:** scoper + unit-testers + bug-hunters + devils-advocate + judge + bugfix + uat (variable based on scope)

---

## Merge

**Command:** `/rapid:merge` or `/rapid:merge <set-id>`

Merges completed and reviewed set branches into main. Sets merge in dependency order defined by the DAG.

### Clean merge fast-path

Before dispatching any subagent, the skill runs `git merge-tree --write-tree` to test for conflicts. If the merge is clean (exit code 0), no subagent is needed -- the set merges directly. This is the common case for well-isolated sets with strict file ownership.

### Conflicting merges

When conflicts exist, a `rapid-set-merger` subagent runs 5-level conflict detection:

1. **Textual** -- Line-level conflicts in the same file
2. **Structural** -- Incompatible code structure changes
3. **Dependency** -- Conflicting package or import changes
4. **API** -- Breaking interface changes between sets
5. **Semantic** -- Logically incompatible behavior changes

Resolution follows a 4-tier cascade:

| Tier | Confidence | Action |
|------|-----------|--------|
| T1 | > 0.9 | Auto-resolved, no review |
| T2 | 0.7 - 0.9 | Auto-resolved, flagged for review |
| T3 | 0.3 - 0.7 | Dispatched to `rapid-conflict-resolver` for deep analysis |
| T4 | < 0.3 | Escalated to developer |

API-signature conflicts always escalate to the developer regardless of confidence.

### Adaptive conflict resolution

Mid-confidence conflicts (T3) are dispatched to dedicated `rapid-conflict-resolver` agents. Each resolver performs deep semantic analysis of the conflict. Results with confidence above 0.7 are auto-accepted; below 0.7, they escalate to the developer with the resolver's analysis attached.

### Contract validation

Before executing the merge, the pipeline validates that interface contracts defined in CONTRACT.json are satisfied. Contract violations block the merge.

**State transition:** The set moves to `merged` as its terminal state after successful merge.

**Agents spawned:** 0 (clean merge) or set-merger + conflict-resolvers (conflicting merge)

---

## Auxiliary Commands

### `/rapid:status`

Cross-set progress dashboard showing all sets, their statuses, active worktrees, and actionable next-step suggestions. Reads state via `state get --all`.

### `/rapid:install`

One-time setup: detects your shell (bash, zsh, fish, POSIX), writes the `RAPID_TOOLS` environment variable to shell config, creates `.env` fallback, validates the toolchain, and runs agent file generation.

### `/rapid:new-version`

Completes the current milestone and starts a new planning cycle. Reads current state, gathers new milestone details (version, name, goals), and handles unfinished sets with carry-forward options (Archive or Keep -- user-chosen, not forced). Re-runs the full 6-researcher pipeline scoped to the new milestone's goals, then the roadmapper proposes a new roadmap with sets. Goes through propose-then-approve before writing to state.

### `/rapid:add-set <set-name>`

Adds new sets to an existing milestone mid-stream. Uses direct STATE.json Write tool (same as `/rapid:init`), not a separate CLI command.

### `/rapid:quick <description>`

Ad-hoc tasks without set structure. Runs a 3-agent pipeline: planner, plan-verifier, and executor. Quick tasks are excluded from STATE.json sets to keep the `/rapid:status` dashboard clean.

---

## Utility Commands

These commands support the lifecycle but do not advance set state:

| Command | Purpose |
|---------|---------|
| `/rapid:assumptions <set-id>` | Surfaces Claude's assumptions about a set's implementation for validation |
| `/rapid:pause <set-id>` | Saves execution state to HANDOFF.md for later resumption |
| `/rapid:resume <set-id>` | Resumes a paused set from its last checkpoint |
| `/rapid:context` | Analyzes codebase and generates context documents (CLAUDE.md, CODEBASE.md, etc.) |
| `/rapid:cleanup <set-id>` | Removes a completed set's worktree and optionally deletes the branch |
| `/rapid:help` | Static command reference grouped by lifecycle stage |

---

## Agent Reference

RAPID v3.0 uses 26 specialized agents organized into 6 categories. Skills dispatch agents directly -- there is no central coordination agent.

### Core (4 agents)

Hand-written agents that define the v3.0 user experience. Never overwritten by the build pipeline.

| Agent | Spawned By | Produces |
|-------|-----------|----------|
| `rapid-planner` | `/rapid:plan-set`, `/rapid:quick` | Per-wave PLAN.md files with tasks and file assignments |
| `rapid-executor` | `/rapid:execute-set`, `/rapid:quick` | Implementation commits per task, WAVE-COMPLETE.md markers |
| `rapid-merger` | `/rapid:merge` | Merge result with semantic conflict detection and resolution |
| `rapid-reviewer` | `/rapid:review` | Prioritized 5-level review with 3-tier severity (Blocking/Fixable/Suggestion) |

### Research (7 agents)

Investigate the project domain during `/rapid:init` and `/rapid:new-version`. Run in parallel.

| Agent | Focus Area | Produces |
|-------|-----------|----------|
| `rapid-research-stack` | Technology choices | STACK.md -- libraries, frameworks, trade-offs |
| `rapid-research-features` | Feature implementation | FEATURES.md -- patterns, prior art |
| `rapid-research-architecture` | Architecture design | ARCHITECTURE.md -- patterns, trade-offs |
| `rapid-research-pitfalls` | Common mistakes | PITFALLS.md -- risks, mitigations |
| `rapid-research-oversights` | Edge cases | OVERSIGHTS.md -- forgotten requirements |
| `rapid-research-ux` | User experience | UX.md -- UX direction and patterns |
| `rapid-research-synthesizer` | Synthesis | RESEARCH.md -- unified recommendations from all 6 researchers |

### Review (7 agents)

Run the adversarial review pipeline during `/rapid:review`.

| Agent | Role | Produces |
|-------|------|----------|
| `rapid-scoper` | Categorize files by concern | Concern groups with file assignments |
| `rapid-unit-tester` | Generate and run tests | Test plans, test files, pass/fail results |
| `rapid-bug-hunter` | Find bugs via static analysis | Bug findings with severity and evidence |
| `rapid-devils-advocate` | Challenge bug findings | Counter-evidence assessments |
| `rapid-judge` | Rule on contested findings | ACCEPTED/DISMISSED/DEFERRED verdicts |
| `rapid-bugfix` | Fix accepted bugs | Targeted fix commits |
| `rapid-uat` | Acceptance testing | UAT results per criterion |

### Merge (2 agents)

Handle conflict detection and resolution during `/rapid:merge`.

| Agent | Role | Produces |
|-------|------|----------|
| `rapid-set-merger` | Per-set merge with 5-level detection | Merge result (clean, resolved, or escalation) |
| `rapid-conflict-resolver` | Deep analysis of mid-confidence conflicts | Resolution with confidence score |

### Utility (5 agents)

Support planning, verification, and project setup.

| Agent | Spawned By | Produces |
|-------|-----------|----------|
| `rapid-roadmapper` | `/rapid:init`, `/rapid:new-version` | ROADMAP.md with sets and dependency ordering |
| `rapid-set-planner` | `/rapid:start-set` | SET-OVERVIEW.md with scope and file ownership |
| `rapid-plan-verifier` | `/rapid:plan-set`, `/rapid:quick` | Verification report (coverage, conflicts) |
| `rapid-verifier` | `/rapid:execute-set` | Post-execution verification report |
| `rapid-codebase-synthesizer` | `/rapid:init`, `/rapid:context` | Codebase analysis (structure, patterns, conventions) |

### Context (1 agent)

| Agent | Spawned By | Produces |
|-------|-----------|----------|
| `rapid-context-generator` | `/rapid:context` | CLAUDE.md + context documents (CODEBASE.md, ARCHITECTURE.md, etc.) |

### Spawn Hierarchy

Skills dispatch agents directly. The spawn map shows which skill triggers which agents:

```
/rapid:init
  |-- rapid-codebase-synthesizer
  |-- rapid-research-stack -------+
  |-- rapid-research-features ----+
  |-- rapid-research-architecture-+ (6 parallel)
  |-- rapid-research-pitfalls ----+
  |-- rapid-research-oversights --+
  |-- rapid-research-ux ----------+
  |-- rapid-research-synthesizer
  +-- rapid-roadmapper

/rapid:start-set
  +-- rapid-set-planner

/rapid:discuss-set --skip
  +-- rapid-research-stack

/rapid:plan-set
  |-- rapid-research-stack
  |-- rapid-planner
  +-- rapid-plan-verifier

/rapid:execute-set
  |-- rapid-executor (x waves)
  +-- rapid-verifier

/rapid:review
  |-- rapid-scoper
  |-- rapid-unit-tester (x concern groups)
  |-- rapid-bug-hunter (x concern groups)
  |-- rapid-devils-advocate
  |-- rapid-judge
  |-- rapid-bugfix
  +-- rapid-uat

/rapid:merge
  |-- rapid-set-merger (per conflicting set)
  +-- rapid-conflict-resolver (per mid-confidence conflict)

/rapid:quick
  |-- rapid-planner
  |-- rapid-plan-verifier
  +-- rapid-executor

/rapid:new-version
  |-- rapid-research-stack -------+
  |-- rapid-research-features ----+
  |-- rapid-research-architecture-+ (6 parallel)
  |-- rapid-research-pitfalls ----+
  |-- rapid-research-oversights --+
  |-- rapid-research-ux ----------+
  |-- rapid-research-synthesizer
  +-- rapid-roadmapper

/rapid:context
  +-- rapid-context-generator
```

---

## State Machine

RAPID v3.0 tracks state at the set level only. Sets are the sole stateful entity -- there is no wave or task state in STATE.json.

### SetStatus Lifecycle

```
pending --> discussing --> planning --> executing --> complete --> merged
```

| Transition | Triggered By | Description |
|------------|-------------|-------------|
| pending --> discussing | `/rapid:discuss-set` | Discussion begins on the set |
| discussing --> planning | `/rapid:plan-set` | Planning pipeline starts |
| planning --> executing | `/rapid:execute-set` | Execution begins |
| executing --> complete | `/rapid:execute-set` | All waves complete, verification passes |
| complete --> merged | `/rapid:merge` | Set branch merged into main |

`merged` is the terminal state -- no transitions out.

### Key properties

- **Independence:** Sets are fully independent. No state transition rejects based on another set's status. Sets can be started, executed, and merged in any order.
- **Crash recovery:** The state machine preserves the crash recovery triad: `detectCorruption` identifies bad state, `recoverFromGit` restores the last good commit, and atomic writes (temp-file-then-rename) prevent partial writes.
- **Transaction pattern:** Every state mutation follows: read STATE.json, validate preconditions, perform work, write STATE.json atomically.
- **Bootstrapping:** Every command bootstraps exclusively from STATE.json and disk artifacts. No conversation context is required -- the system is fully self-contained after a `/clear`.

---

## Configuration

### Environment

| Variable | Purpose | Set By |
|----------|---------|--------|
| `RAPID_TOOLS` | Absolute path to `src/bin/rapid-tools.cjs` | `/rapid:install` |

Every skill loads `RAPID_TOOLS` from both the shell environment and the project's `.env` file (whichever is available).

### `.env` file

Created by `/rapid:install` in the plugin root directory. Contains:

```
RAPID_TOOLS=/absolute/path/to/src/bin/rapid-tools.cjs
ANTHROPIC_API_KEY=sk-ant-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com
```

### STATE.json Schema

Located at `.planning/STATE.json`. Set-level hierarchy only:

```json
{
  "project": {
    "name": "string",
    "milestone": {
      "name": "string",
      "version": "string",
      "sets": [
        {
          "name": "string",
          "status": "pending | discussing | planning | executing | complete | merged",
          "branch": "string",
          "worktree": "string"
        }
      ]
    }
  }
}
```

State is validated at runtime and protected by file-level locking during writes. Locks auto-expire after 5 minutes.

### `.planning/` Directory Layout

```
.planning/
  PROJECT.md            -- Project description and core value
  REQUIREMENTS.md       -- Requirements for decomposition
  ROADMAP.md            -- Milestone roadmap with sets
  STATE.json            -- Machine-readable state (set-level)
  CONTRACT.json         -- Interface contracts between sets
  config.json           -- Project configuration
  .locks/               -- Lock files for concurrent access (gitignored)
  research/             -- Research outputs from /init
  context/              -- Codebase context from /context
  sets/{set-name}/      -- Per-set artifacts
  worktrees/            -- Worktree registry
.rapid-worktrees/       -- Git worktree checkout directories
```

### Key architectural decisions

- **Skills are their own dispatchers.** There is no central coordination agent. Each skill command dispatches the agents it needs directly.
- **Interface contracts via CONTRACT.json.** Sets communicate through machine-verifiable contracts, not blocking gates.
- **Hybrid agent build.** 4 core agents are hand-written and never overwritten by the build pipeline. The remaining 22 agents are generated via `build-agents` with embedded tool docs and XML prompt structure.
- **Inline tool docs.** Each agent embeds its own CLI command reference in YAML format, curated per role. No shared reference file.

---

Each lifecycle stage has a companion deep-dive in the [docs/](docs/) directory. See [DOCS.md](DOCS.md) for the full documentation index.
