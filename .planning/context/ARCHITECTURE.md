# RAPID Architecture

## System Overview

RAPID is a Claude Code plugin that orchestrates parallel development through isolated git worktrees, interface contracts, and multi-agent pipelines. The architecture decomposes into five layers.

```
┌─────────────────────────────────────────────────────┐
│                   SKILL LAYER                        │
│  24 skills (SKILL.md) — user-facing command defs     │
│  Orchestrate agent spawning and CLI calls             │
├─────────────────────────────────────────────────────┤
│                   AGENT LAYER                        │
│  26 agents (.md) — specialized AI workers            │
│  Built from core modules + role modules              │
├─────────────────────────────────────────────────────┤
│                   CLI LAYER                          │
│  rapid-tools.cjs — command router + handlers         │
│  Dispatches to library modules                       │
├─────────────────────────────────────────────────────┤
│                   LIBRARY LAYER                      │
│  21 modules (src/lib/) — core business logic         │
│  State, contracts, worktrees, merge, review, etc.    │
├─────────────────────────────────────────────────────┤
│                   STORAGE LAYER                      │
│  .planning/ — STATE.json, definitions, contracts     │
│  .rapid-worktrees/ — isolated git worktrees          │
│  Git branches — rapid/{set-name} per set             │
└─────────────────────────────────────────────────────┘
```

## State Hierarchy

```
ProjectState
├── version: 1
├── projectName: string
├── currentMilestone: string (ID)
└── milestones[]
    ├── id, name
    └── sets[]
        ├── id, status (pending → discussing → planning → executing → complete → merged)
        └── waves[]
            ├── id, status
            └── jobs[]
                └── id, status
```

- Validated by Zod schemas at every mutation boundary
- Persisted to `.planning/STATE.json`
- Protected by file locks (`.planning/.locks/`)
- Atomic writes via `withStateTransaction(cwd, mutationFn)`

## Core Patterns

### 1. Transaction Pattern
All state mutations follow: lock → read → validate → mutate → validate → write → unlock

```javascript
await withStateTransaction(cwd, (state) => {
  state.milestones[0].sets.push(newSet);
  // Auto-validates via Zod, writes atomically, releases lock
});
```

### 2. Worktree Isolation
Each set gets a dedicated git worktree and branch:

```
.rapid-worktrees/{set-name}/     ← isolated checkout
  └── branch: rapid/{set-name}   ← dedicated branch

.planning/worktrees/REGISTRY.json ← tracks all worktrees
```

Worktrees provide physical isolation — no concurrent file access conflicts between sets.

### 3. Contract-First Planning
Interface contracts (`CONTRACT.json`) define boundaries before implementation:

```json
{
  "exports": { "functions": [...], "types": [...] },
  "imports": { "fromSets": [...] },
  "behavioral": { "invariants": [...], "sideEffects": [...] }
}
```

Validated at 3 gates: after planning, during execution, before merge.

### 4. DAG-Driven Execution
Sets form a dependency graph. Kahn's topological sort assigns wave groupings:

```
Wave 1: [set-01, set-02]     ← no dependencies, execute in parallel
Wave 2: [set-03]             ← depends on set-01
Wave 3: [set-04, set-05]     ← depend on set-02 and set-03
```

### 5. Structured Returns (RAPID:RETURN)
Agents communicate completion status via embedded markers:

```
<!-- RAPID:RETURN {"status": "COMPLETE", "artifacts": [...], "commits": [...]} -->
```

Statuses: `COMPLETE`, `CHECKPOINT` (pause/resume), `BLOCKED` (escalation needed)

## Agent Architecture

### Build Pipeline
```
src/modules/core/*.md    ← shared identity, conventions, returns
src/modules/roles/*.md   ← 30 role-specific instructions
        ↓ build-agents
agents/*.md              ← 26 assembled agent definitions
```

### Agent Categories
| Category | Agents | Role |
|----------|--------|------|
| Core | planner, executor, merger, reviewer | Primary lifecycle |
| Research | 6 domain + synthesizer | Init-time analysis |
| Review | scoper, unit-tester, bug-hunter, devils-advocate, judge, bugfix, uat | Quality gate |
| Merge | set-merger, conflict-resolver | Integration |
| Utility | roadmapper, set-planner, plan-verifier, verifier, codebase-synthesizer | Support |

### Prompt Assembly
```
YAML frontmatter (name, model, tools, color)
  + <identity>    (core-identity.md)
  + <conventions> (core-conventions.md, if commits code)
  + <tools>       (generated YAML tool docs)
  + <role>        (role-{name}.md)
  + <returns>     (core-returns.md)
  + <context>     (injected at runtime)
```

## Set Lifecycle

```
┌──────────┐    ┌────────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌────────┐
│ pending  │───▶│ discussing │───▶│ planning │───▶│ executing │───▶│ complete │───▶│ merged │
└──────────┘    └────────────┘    └──────────┘    └───────────┘    └──────────┘    └────────┘
                     │                  │               │
               /discuss-set       /plan-set       /execute-set
               captures vision    decomposes      implements in
               via questions      into waves      isolated worktree
```

## Merge Pipeline

### 5-Level Conflict Detection
| Level | Type | What It Detects |
|-------|------|-----------------|
| L1 | Textual | Git 3-way merge markers (`<<<<`, `>>>>`) |
| L2 | Structural | Changed function signatures, class definitions |
| L3 | Dependency | Import/export graph changes |
| L4 | API | Public API contract violations |
| L5 | Semantic | Context-aware logic conflicts |

### 4-Tier Resolution Cascade
| Tier | Method | When Used |
|------|--------|-----------|
| T1 | Deterministic auto-resolve | Unambiguous patterns |
| T2 | Heuristic merging | Name matching, schema inference |
| T3 | Agent-assisted | Spawned conflict-resolver subagent |
| T4 | Human escalation | Complex multi-file conflicts |

## Review Pipeline

Adversarial multi-agent approach:
```
scoper → unit-tester → bug-hunter → devils-advocate → judge → bugfix → uat
```

The hunter/devils-advocate/judge pipeline ensures high-confidence findings by having agents argue for and against each bug.

## Key File Flows

### Command Flow: `/rapid:execute-set set-01`
```
1. Skill (skills/execute-set/SKILL.md) → orchestrates
2. CLI (rapid-tools.cjs execute prepare-context) → dispatches
3. execute.cjs → prepares context, loads contracts
4. worktree.cjs → generates scoped CLAUDE.md
5. Agent (rapid-executor) → implements in worktree
6. returns.cjs → parses RAPID:RETURN
7. state-machine.cjs → transitions set to 'complete'
```

### State Flow: Init → Merge
```
1. /init → scaffolds .planning/, creates STATE.json
2. /start-set → creates worktree, registers in REGISTRY.json
3. /discuss-set → captures vision, STATE: pending → discussing
4. /plan-set → decomposes waves, STATE: discussing → planning
5. /execute-set → implements, STATE: planning → executing → complete
6. /review → adversarial testing, validates artifacts
7. /merge → DAG-ordered merge, STATE: complete → merged
```
