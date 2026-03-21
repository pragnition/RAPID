# Agent Reference

RAPID uses 26 specialized agents across the development lifecycle. Each agent has a narrow focus, receives structured inputs, and returns structured outputs. Skills dispatch agents directly -- there is no central coordination agent.

## Agent Types

| Type | Description |
|------|-------------|
| **Core** | Hand-written agents that define the user experience. Never overwritten by the build pipeline. |
| **Research** | Uses WebSearch/WebFetch to gather external knowledge before synthesis |
| **Pipeline** | Runs multi-step pipelines and may trigger further agent dispatch |
| **Leaf** | Terminal agent that does focused work and returns results directly |

## Spawn Hierarchy

This tree shows the full spawn hierarchy -- which skills dispatch which agents.

```
User
  |
  +-- /rapid:init
  |     |-- rapid-codebase-synthesizer
  |     |-- rapid-research-stack -------+
  |     |-- rapid-research-features ----+
  |     |-- rapid-research-architecture-+ (6 parallel)
  |     |-- rapid-research-pitfalls ----+
  |     |-- rapid-research-oversights --+
  |     |-- rapid-research-ux ----------+
  |     |-- rapid-research-synthesizer
  |     +-- rapid-roadmapper
  |
  +-- /rapid:start-set
  |     +-- rapid-set-planner
  |
  +-- /rapid:discuss-set --skip
  |     +-- rapid-research-stack
  |
  +-- /rapid:plan-set
  |     |-- rapid-research-stack
  |     |-- rapid-planner
  |     +-- rapid-plan-verifier
  |
  +-- /rapid:execute-set
  |     |-- rapid-executor (x waves, sequential)
  |     +-- rapid-verifier
  |
  +-- /rapid:review
  |     |-- rapid-scoper
  |     |-- rapid-unit-tester (x concern groups)
  |     |-- rapid-bug-hunter (x concern groups)
  |     |-- rapid-devils-advocate
  |     |-- rapid-judge
  |     |-- rapid-bugfix
  |     +-- rapid-uat
  |
  +-- /rapid:merge
  |     |-- rapid-set-merger (per conflicting set)
  |     +-- rapid-conflict-resolver (per mid-confidence conflict)
  |
  +-- /rapid:quick
  |     |-- rapid-planner
  |     |-- rapid-plan-verifier
  |     +-- rapid-executor
  |
  +-- /rapid:new-version
  |     |-- rapid-research-stack -------+
  |     |-- rapid-research-features ----+
  |     |-- rapid-research-architecture-+ (6 parallel)
  |     |-- rapid-research-pitfalls ----+
  |     |-- rapid-research-oversights --+
  |     |-- rapid-research-ux ----------+
  |     |-- rapid-research-synthesizer
  |     +-- rapid-roadmapper
  |
  +-- /rapid:context
  |     +-- rapid-context-generator
  |
  +-- /rapid:bug-fix
  |     +-- rapid-bugfix
  |
  +-- /rapid:documentation
        (skill-level orchestration, no subagent)
```

## Agent Catalog by Category

### Core (4 agents)

Hand-written agents that define the user experience. Marked with `SKIP_GENERATION` in the build pipeline.

#### rapid-planner
**Core** | blue

Decomposes work into per-wave PLAN.md files with tasks, file assignments, and acceptance criteria.

| | |
|---|---|
| Spawned by | `/rapid:plan-set`, `/rapid:quick` |
| Inputs | Set context, CONTEXT.md, research findings, CONTRACT.json |
| Outputs | Per-wave PLAN.md files |

#### rapid-executor
**Core** | green

Implements tasks from a wave's PLAN.md, committing atomically per task. Produces WAVE-COMPLETE.md markers.

| | |
|---|---|
| Spawned by | `/rapid:execute-set`, `/rapid:quick` |
| Inputs | Wave PLAN.md content, worktree path |
| Outputs | Implementation commits, WAVE-COMPLETE.md marker |

#### rapid-merger
**Core** | green

Runs 5-level conflict detection and 4-tier resolution cascade for set merges into main.

| | |
|---|---|
| Spawned by | `/rapid:merge` |
| Inputs | Set branch, main branch, merge-tree analysis |
| Outputs | RAPID:RETURN with semantic_conflicts, resolutions, escalations, all_resolved |

#### rapid-reviewer
**Core** | red

Performs prioritized 5-level code review with 3-tier severity assessment (Blocking, Fixable, Suggestion). Verdict vocabulary: APPROVE, CHANGES, BLOCK.

| | |
|---|---|
| Spawned by | `/rapid:review` |
| Inputs | Changed files, review criteria |
| Outputs | Review verdict with categorized findings |

---

### Research (7 agents)

Investigate the project domain during `/rapid:init` and `/rapid:new-version`. All 6 topic researchers run in parallel; the synthesizer runs after they complete.

#### rapid-research-stack
**Research** | blue

Investigates technology stack options and recommendations for the project domain.

| | |
|---|---|
| Spawned by | `/rapid:init`, `/rapid:new-version`, `/rapid:plan-set`, `/rapid:discuss-set --skip` |
| Inputs | Project context, domain description |
| Outputs | STACK.md -- libraries, frameworks, trade-offs |

#### rapid-research-features
**Research** | blue

Analyzes feature requirements and implementation approaches using external sources.

| | |
|---|---|
| Spawned by | `/rapid:init`, `/rapid:new-version` |
| Inputs | Project context, feature requirements |
| Outputs | FEATURES.md -- implementation patterns, prior art |

#### rapid-research-architecture
**Research** | blue

Evaluates architecture patterns and design decisions for the project domain.

| | |
|---|---|
| Spawned by | `/rapid:init`, `/rapid:new-version` |
| Inputs | Project context, architecture constraints |
| Outputs | ARCHITECTURE.md -- patterns, trade-offs, recommendations |

#### rapid-research-pitfalls
**Research** | blue

Identifies common pitfalls and anti-patterns to avoid in the project domain.

| | |
|---|---|
| Spawned by | `/rapid:init`, `/rapid:new-version` |
| Inputs | Project context, technology choices |
| Outputs | PITFALLS.md -- risks, mitigations, cautionary patterns |

#### rapid-research-oversights
**Research** | blue

Discovers overlooked concerns and edge cases that other research agents may miss.

| | |
|---|---|
| Spawned by | `/rapid:init`, `/rapid:new-version` |
| Inputs | Project context, existing research findings |
| Outputs | OVERSIGHTS.md -- edge cases, forgotten requirements |

#### rapid-research-ux
**Research** | blue

Researches user experience direction and patterns for the project domain.

| | |
|---|---|
| Spawned by | `/rapid:init`, `/rapid:new-version` |
| Inputs | Project context, user requirements |
| Outputs | UX.md -- UX direction and patterns |

#### rapid-research-synthesizer
**Pipeline** | blue

Combines findings from all 6 parallel research agents into coherent recommendations.

| | |
|---|---|
| Spawned by | `/rapid:init`, `/rapid:new-version` |
| Inputs | All research outputs (STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, OVERSIGHTS.md, UX.md) |
| Outputs | RESEARCH.md -- unified recommendations |

---

### Review (7 agents)

Run the adversarial review pipeline during `/rapid:review`.

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
| Outputs | Test plan, test files, pass/fail results |

#### rapid-bug-hunter
**Leaf** | yellow

Performs static analysis and identifies bugs across concern groups.

| | |
|---|---|
| Spawned by | `/rapid:review` |
| Inputs | Concern group files, codebase context |
| Outputs | Bug findings with severity, file locations, evidence |

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
| Outputs | Final rulings with rationale |

#### rapid-bugfix
**Leaf** | green

Fixes accepted bugs from the review pipeline with atomic commits.

| | |
|---|---|
| Spawned by | `/rapid:review` |
| Inputs | Accepted bug findings with file paths and descriptions |
| Outputs | Targeted fix commits |

#### rapid-uat
**Leaf** | cyan

Generates and executes acceptance test plans to validate user-facing behavior.

| | |
|---|---|
| Spawned by | `/rapid:review` |
| Inputs | Full set scope, acceptance criteria from plans |
| Outputs | UAT results (pass/fail per acceptance criterion) |

---

### Merge (2 agents)

Handle conflict detection and resolution during `/rapid:merge`.

#### rapid-set-merger
**Pipeline** | green

Runs detection, resolution, and contract validation for a single set merge into main.

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
| Spawned by | `/rapid:merge` (via set-merger escalation, confidence 0.3-0.7) |
| Inputs | Conflict diff, file context, semantic analysis from set-merger |
| Outputs | Resolution with confidence score; auto-accepted if >= 0.7, escalated if < 0.7 |

---

### Utility (5 agents)

Support planning, verification, and project setup.

#### rapid-roadmapper
**Leaf** | blue

Creates implementation roadmaps from requirements and research findings. Proposes sets with dependency ordering.

| | |
|---|---|
| Spawned by | `/rapid:init`, `/rapid:new-version` |
| Inputs | Synthesized research, project requirements, codebase analysis |
| Outputs | ROADMAP.md with sets and dependency ordering |

#### rapid-set-planner
**Leaf** | blue

Produces SET-OVERVIEW.md with the set's scope, file ownership, and approach.

| | |
|---|---|
| Spawned by | `/rapid:start-set` |
| Inputs | Set definition, milestone scope, codebase analysis |
| Outputs | SET-OVERVIEW.md with scope and file ownership |

#### rapid-plan-verifier
**Leaf** | blue

Validates plans for coverage, implementability, and consistency before execution.

| | |
|---|---|
| Spawned by | `/rapid:plan-set`, `/rapid:quick` |
| Inputs | All PLAN.md files for a set, set context |
| Outputs | Verification report (coverage gaps, conflicts, recommendations) |

#### rapid-verifier
**Leaf** | blue

Verifies task completion via filesystem checks. Runs after all waves complete during execution.

| | |
|---|---|
| Spawned by | `/rapid:execute-set` |
| Inputs | Set objectives, completion criteria |
| Outputs | Post-execution verification report |

#### rapid-codebase-synthesizer
**Research** | blue

Analyzes existing codebase structure and patterns to inform project planning.

| | |
|---|---|
| Spawned by | `/rapid:init`, `/rapid:context` |
| Inputs | Project root directory, file tree |
| Outputs | Codebase analysis document (structure, patterns, conventions) |

---

### Context (1 agent)

#### rapid-context-generator
**Leaf** | blue

Produces project context documents for agent consumption during planning and execution.

| | |
|---|---|
| Spawned by | `/rapid:context` |
| Inputs | Project state, codebase scan |
| Outputs | CLAUDE.md + context documents (CODEBASE.md, ARCHITECTURE.md, CONVENTIONS.md, STYLE_GUIDE.md) |
