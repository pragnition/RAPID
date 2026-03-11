# Agent Reference

RAPID uses 31 specialized agents across the development lifecycle. Each agent has a narrow focus, receives structured inputs, and returns structured outputs. Agents fall into four types based on their role in the system.

## Agent Types

| Type | Description |
|------|-------------|
| **Orchestrator** | Has the Agent tool and spawns other agents to coordinate multi-step workflows |
| **Pipeline** | Runs multi-step pipelines and may trigger further agent dispatch through the orchestrator |
| **Research** | Uses WebSearch/WebFetch to gather external knowledge before synthesis |
| **Leaf** | Terminal agent that does focused work and returns results directly |

## Dispatch Tree

This tree shows the full spawn hierarchy -- which skills dispatch which agents.

```
User
  └── rapid-orchestrator (coordinates all phases)
        ├── /rapid:init
        │     ├── rapid-codebase-synthesizer
        │     ├── rapid-research-stack ─────────┐
        │     ├── rapid-research-features ──────┤ (5 parallel)
        │     ├── rapid-research-architecture ──┤
        │     ├── rapid-research-pitfalls ──────┤
        │     ├── rapid-research-oversights ────┘
        │     ├── rapid-research-synthesizer
        │     └── rapid-roadmapper
        ├── /rapid:context
        │     └── rapid-context-generator
        ├── /rapid:plan
        │     └── rapid-planner
        ├── /rapid:set-init
        │     └── rapid-set-planner
        ├── /rapid:plan-set
        │     ├── rapid-wave-analyzer
        │     ├── rapid-wave-researcher
        │     ├── rapid-wave-planner
        │     └── rapid-plan-verifier
        ├── /rapid:wave-plan
        │     ├── rapid-wave-researcher
        │     ├── rapid-wave-planner
        │     ├── rapid-job-planner (per job)
        │     └── rapid-plan-verifier
        ├── /rapid:execute
        │     ├── rapid-job-executor (parallel per job)
        │     └── rapid-bugfix (--fix-issues mode)
        ├── /rapid:review
        │     ├── rapid-scoper
        │     ├── rapid-unit-tester
        │     ├── rapid-bug-hunter ──> rapid-devils-advocate ──> rapid-judge
        │     ├── rapid-uat
        │     └── rapid-bugfix (fix accepted bugs)
        └── /rapid:merge
              ├── rapid-set-merger (per set)
              └── rapid-conflict-resolver (per mid-confidence conflict)
```

**Legacy/internal agents** not shown in the tree: `rapid-executor` (v1.0 set-level executor, replaced by `rapid-job-executor`), `rapid-merger` (v1.0 single-agent merger, replaced by `rapid-set-merger`), `rapid-verifier` (internal verification), and `rapid-reviewer` (deep code review, not currently dispatched by any skill).

## Agent Catalog by Lifecycle Stage

### Cross-cutting

#### rapid-orchestrator
**Orchestrator** | blue

Coordinates planning, execution, verification, and merge across all RAPID phases.

| | |
|---|---|
| Spawned by | User (top-level entry point) |
| Inputs | User commands (`/rapid:*`), project state |
| Outputs | Dispatches to all other agents via the Agent tool |

---

### Setup

Agents spawned during `/rapid:init` and `/rapid:context` to bootstrap a project.

#### rapid-codebase-synthesizer
**Research** | blue

Analyzes existing codebase structure and patterns to inform project planning.

| | |
|---|---|
| Spawned by | `/rapid:init` |
| Inputs | Project root directory, file tree |
| Outputs | Codebase analysis document (structure, patterns, conventions) |

#### rapid-research-stack
**Research** | blue

Investigates technology stack options and recommendations for the project domain.

| | |
|---|---|
| Spawned by | `/rapid:init` |
| Inputs | Project context, domain description |
| Outputs | Stack research findings (libraries, frameworks, trade-offs) |

#### rapid-research-features
**Research** | blue

Analyzes feature requirements and implementation approaches using external sources.

| | |
|---|---|
| Spawned by | `/rapid:init` |
| Inputs | Project context, feature requirements |
| Outputs | Feature research findings (implementation patterns, prior art) |

#### rapid-research-architecture
**Research** | blue

Evaluates architecture patterns and design decisions for the project domain.

| | |
|---|---|
| Spawned by | `/rapid:init` |
| Inputs | Project context, architecture constraints |
| Outputs | Architecture research findings (patterns, trade-offs, recommendations) |

#### rapid-research-pitfalls
**Research** | blue

Identifies common pitfalls and anti-patterns to avoid in the project domain.

| | |
|---|---|
| Spawned by | `/rapid:init` |
| Inputs | Project context, technology choices |
| Outputs | Pitfall research findings (risks, mitigations, cautionary patterns) |

#### rapid-research-oversights
**Research** | blue

Discovers overlooked concerns and edge cases that other research agents may miss.

| | |
|---|---|
| Spawned by | `/rapid:init` |
| Inputs | Project context, existing research findings |
| Outputs | Oversight research findings (edge cases, forgotten requirements) |

#### rapid-research-synthesizer
**Pipeline** | blue

Combines findings from all five parallel research agents into coherent recommendations.

| | |
|---|---|
| Spawned by | `/rapid:init` |
| Inputs | All research agent outputs (stack, features, architecture, pitfalls, oversights) |
| Outputs | Synthesized RESEARCH.md with unified recommendations |

#### rapid-roadmapper
**Leaf** | blue

Creates phased implementation roadmaps from requirements and research findings.

| | |
|---|---|
| Spawned by | `/rapid:init` |
| Inputs | Synthesized research, project requirements, codebase analysis |
| Outputs | ROADMAP.md with phased milestones and requirement traceability |

#### rapid-context-generator
**Leaf** | blue

Produces project context documents for agent consumption during planning and execution.

| | |
|---|---|
| Spawned by | `/rapid:context` |
| Inputs | Project state, user discussion notes |
| Outputs | CONTEXT.md capturing decisions, constraints, and implementation direction |

---

### Planning

Agents spawned during `/rapid:plan`, `/rapid:set-init`, `/rapid:plan-set`, and `/rapid:wave-plan` to decompose work.

#### rapid-planner
**Leaf** | blue

Decomposes work into parallelizable sets based on the roadmap and requirements.

| | |
|---|---|
| Spawned by | `/rapid:plan` |
| Inputs | ROADMAP.md, phase requirements, existing project state |
| Outputs | Phase plan with set definitions and dependency ordering |

#### rapid-set-planner
**Leaf** | blue

Decomposes milestones into parallelizable development sets with file ownership boundaries.

| | |
|---|---|
| Spawned by | `/rapid:set-init` |
| Inputs | Phase plan, milestone scope, codebase analysis |
| Outputs | Set definitions with wave structure and file ownership |

#### rapid-wave-analyzer
**Leaf** | blue

Determines wave dependencies via LLM analysis of wave contexts and file relationships.

| | |
|---|---|
| Spawned by | `/rapid:plan-set` |
| Inputs | Set structure, wave contexts, file dependency graph |
| Outputs | Wave dependency analysis with ordering recommendations |

#### rapid-wave-researcher
**Research** | blue

Investigates implementation specifics for a wave using codebase analysis and external sources.

| | |
|---|---|
| Spawned by | `/rapid:wave-plan`, `/rapid:plan-set` |
| Inputs | Wave context, file list, implementation questions |
| Outputs | Wave-specific research findings (APIs, patterns, integration points) |

#### rapid-wave-planner
**Leaf** | blue

Produces high-level per-job plans for a wave based on research and wave context.

| | |
|---|---|
| Spawned by | `/rapid:wave-plan`, `/rapid:plan-set` |
| Inputs | Wave context, wave research findings, file ownership |
| Outputs | WAVE-PLAN.md with job definitions and file assignments |

#### rapid-job-planner
**Leaf** | blue

Creates detailed implementation plans for a single job within a wave.

| | |
|---|---|
| Spawned by | `/rapid:wave-plan` |
| Inputs | Wave plan, job scope, file ownership list |
| Outputs | JOB-PLAN.md with task-level implementation steps |

#### rapid-plan-verifier
**Leaf** | blue

Validates job plans for coverage, implementability, and consistency before execution.

| | |
|---|---|
| Spawned by | `/rapid:wave-plan`, `/rapid:plan-set` |
| Inputs | All JOB-PLAN.md files for a wave, wave context |
| Outputs | Verification report (coverage gaps, conflicts, recommendations) |

---

### Execution

Agents spawned during `/rapid:execute` to implement planned work.

#### rapid-job-executor
**Leaf** | green

Implements a single job within a wave per JOB-PLAN.md. Commits atomically per task within the set's worktree.

| | |
|---|---|
| Spawned by | `/rapid:execute` |
| Inputs | JOB-PLAN.md content, file ownership list, worktree path |
| Outputs | RAPID:RETURN (COMPLETE/CHECKPOINT/BLOCKED) with artifacts and commits |

#### rapid-bugfix
**Leaf** | green

Fixes accepted bugs from the review pipeline with atomic commits.

| | |
|---|---|
| Spawned by | `/rapid:execute --fix-issues`, `/rapid:review` (fix accepted bugs) |
| Inputs | Accepted bug findings with file paths and descriptions |
| Outputs | RAPID:RETURN (COMPLETE/BLOCKED) with fix commits |

---

### Review

Agents spawned during `/rapid:review` to validate execution quality.

#### rapid-scoper
**Leaf** | blue

Categorizes files by concern area for focused review scoping across the review pipeline.

| | |
|---|---|
| Spawned by | `/rapid:review` |
| Inputs | Set file list, change summary |
| Outputs | Concern groups with file assignments for parallel review dispatch |

#### rapid-unit-tester
**Leaf** | cyan

Generates test plans and writes/runs tests against the set's implementation.

| | |
|---|---|
| Spawned by | `/rapid:review` |
| Inputs | Concern group files, acceptance criteria |
| Outputs | Test plan, test files, execution results (pass/fail counts) |

#### rapid-bug-hunter
**Leaf** | yellow

Performs static analysis and identifies bugs across concern groups.

| | |
|---|---|
| Spawned by | `/rapid:review` |
| Inputs | Concern group files, codebase context |
| Outputs | Bug findings with severity, file locations, and evidence |

#### rapid-devils-advocate
**Leaf** | purple

Challenges bug hunter findings with counter-evidence to reduce false positives.

| | |
|---|---|
| Spawned by | `/rapid:review` |
| Inputs | Merged bug findings from all bug hunters |
| Outputs | Advocate assessments (agree/disagree with evidence for each finding) |

#### rapid-judge
**Leaf** | red

Rules on contested findings with ACCEPTED/DISMISSED/DEFERRED verdicts.

| | |
|---|---|
| Spawned by | `/rapid:review` |
| Inputs | Bug findings + advocate assessments |
| Outputs | Final rulings (ACCEPTED/DISMISSED/DEFERRED) with rationale |

#### rapid-uat
**Leaf** | cyan

Generates and executes acceptance test plans to validate user-facing behavior.

| | |
|---|---|
| Spawned by | `/rapid:review` |
| Inputs | Full set scope, acceptance criteria from plans |
| Outputs | UAT results (pass/fail per acceptance criterion) |

---

### Merge

Agents spawned during `/rapid:merge` to integrate completed sets into the main branch.

#### rapid-set-merger
**Pipeline** | green

Runs detection, resolution, and gate validation for a single set merge into main.

| | |
|---|---|
| Spawned by | `/rapid:merge` |
| Inputs | Set branch, main branch, merge-tree analysis |
| Outputs | Merge result (clean merge, resolved conflicts, or escalation to human) |

#### rapid-conflict-resolver
**Leaf** | yellow

Deep analysis and resolution of mid-confidence merge conflicts escalated by the set merger.

| | |
|---|---|
| Spawned by | `/rapid:merge` (via set-merger escalation, confidence 0.3-0.8) |
| Inputs | Conflict diff, file context, semantic analysis from set-merger |
| Outputs | Resolution with confidence score; auto-accepted if >= 0.7, escalated if < 0.7 |

---

### Internal / Legacy

Agents kept for backward compatibility or internal use.

#### rapid-executor
**Leaf** | green -- *Legacy*

Set-level executor from v1.0. Replaced by `rapid-job-executor` which operates at the finer-grained job level.

| | |
|---|---|
| Spawned by | `/rapid:execute` (legacy path) |
| Inputs | Set-level plan, worktree path |
| Outputs | RAPID:RETURN with implementation commits |

#### rapid-merger
**Leaf** | green -- *Legacy*

Single-agent merger from v1.0. Replaced by `rapid-set-merger` + `rapid-conflict-resolver` pipeline.

| | |
|---|---|
| Spawned by | `/rapid:merge` (legacy path) |
| Inputs | Set branch, main branch |
| Outputs | Merge result with semantic conflict detection |

#### rapid-verifier
**Leaf** | blue -- *Internal*

Verifies task completion via filesystem checks. Used internally for post-execution validation.

| | |
|---|---|
| Spawned by | Internal verification pipeline |
| Inputs | Task completion criteria, file paths |
| Outputs | Verification report (pass/fail per criterion) |

#### rapid-reviewer
**Leaf** | red -- *Internal*

Performs deep code review before merge. Defined but not currently dispatched by any active skill.

| | |
|---|---|
| Spawned by | Not currently dispatched |
| Inputs | Changed files, review criteria |
| Outputs | Review verdict with findings |
