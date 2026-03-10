# Architecture Research: Merge Pipeline Subagent Delegation

**Domain:** Claude Code plugin -- agentic merge pipeline restructuring
**Researched:** 2026-03-10
**Confidence:** HIGH (based on existing codebase patterns, not external sources)

## Executive Summary

The current merge SKILL.md is a monolithic orchestrator that processes every set sequentially, accumulating detection reports, resolution results, merger agent context, escalation decisions, and programmatic gate outputs in a single context window. On a codebase with 8+ sets and complex conflicts, this context window overflows before the pipeline completes.

The restructuring follows the pattern already proven by the review pipeline: the SKILL stays lean as a dispatcher that manages DAG ordering, wave sequencing, and human decision gates, while per-set merge work is delegated to subagents that return structured results via RAPID:RETURN. The critical constraint -- subagents CANNOT spawn sub-subagents -- means "adaptive nesting" as described in PROJECT.md must be reframed: the SKILL itself dispatches per-conflict resolution agents when a per-set merge agent reports unresolved conflicts, not the merge agent spawning them.

## Current Architecture (v2.0)

### Context Window Flow (the problem)

```
SKILL orchestrator context window accumulates:
  Wave 1:
    Set A: detect(L1-L4) -> resolve(T1-T2) -> spawn merger agent -> parse return
           -> handle escalations -> programmatic gate -> execute merge
    Set B: detect(L1-L4) -> resolve(T1-T2) -> spawn merger agent -> parse return
           -> handle escalations -> programmatic gate -> execute merge
    Integration test -> bisection if failed
  Wave 2:
    Set C: ... (all previous wave context still in window)
    Set D: ... (all previous context still in window)

By Set D, orchestrator has accumulated:
  - 4x detection reports (L1-L4 JSON per set)
  - 4x resolution cascade results
  - 4x merger agent prompts + returns
  - 4x programmatic gate results
  - 4x merge execution results
  - Escalation decision context
  - Integration test output
  = Context window overflow on large codebases
```

### What the Orchestrator Currently Does

| Step | Work | Context Cost |
|------|------|-------------|
| Load merge plan | DAG order, status checks | Low |
| Per-set detection (L1-L4) | Runs 4 CLI commands, parses JSON | Medium |
| Per-set resolution (T1-T2) | Runs CLI, parses JSON | Medium |
| Prepare merger agent context | Reads CONTEXT.md, CONTRACT.json, other set contexts | High |
| Spawn merger agent | Builds prompt with all context + unresolved conflicts | High |
| Parse merger return | Semantic conflicts, resolutions, escalations | Medium |
| Handle escalations (T4) | Per-escalation AskUserQuestion with full context | High |
| Programmatic gate | CLI command, parse result | Low |
| Execute merge | CLI command, parse result, handle conflict scenarios | Medium |
| Integration test | CLI command, parse result | Low |
| Bisection | CLI command, parse result, rollback decisions | Medium |

**Total per set: ~6-8 tool calls + context accumulation. For 8 sets, that is 48-64 tool interactions in one context window.**

## Recommended Architecture (v2.2)

### Design Principle: Dispatch-Collect-Decide

The orchestrator's job is three things:
1. **Dispatch** -- send work to subagents with minimal context
2. **Collect** -- parse structured RAPID:RETURN results
3. **Decide** -- make sequencing decisions and present human gates

Everything else is delegated.

### System Overview

```
                    SKILL (merge orchestrator)
                    ========================
                    Owns: DAG ordering, wave sequencing,
                          human decision gates, status updates
                    Does NOT own: detection, resolution,
                                  semantic analysis, conflict resolution

    Wave 1                              Wave 2
    ------                              ------
    [per-set-merge-agent: Set A]        [per-set-merge-agent: Set C]
    [per-set-merge-agent: Set B]        [per-set-merge-agent: Set D]
         |                                   |
         v                                   v
    SKILL collects RAPID:RETURN         SKILL collects RAPID:RETURN
         |                                   |
         v                                   v
    Escalations? ----YES----> [per-conflict-resolver: conflict-1]
         |                    [per-conflict-resolver: conflict-2]
         |                         |
         NO                   SKILL collects resolutions
         |                         |
         v                         v
    Programmatic gate         Human escalation gate (AskUserQuestion)
         |                         |
         v                         v
    Execute merge (CLI)       Execute merge (CLI)
         |                         |
         v                         v
    Integration gate ----FAIL----> Bisection (CLI, stays in orchestrator)
         |
         PASS
         |
         v
    Next wave
```

### New Component: rapid-set-merger Agent

**Purpose:** Encapsulates ALL per-set merge analysis work that currently lives in the orchestrator. One agent per set, each in its own context window.

**What it receives:**
- Set name and branch info
- Detection report (L1-L4 from CLI, run by orchestrator BEFORE spawning)
- Resolution cascade results (T1-T2 from CLI, run by orchestrator BEFORE spawning)
- Unresolved conflicts (filtered from resolution results)
- Set's CONTEXT.md content
- Set's CONTRACT.json content
- Contexts of already-merged sets in this wave

**What it does:**
1. L5 semantic conflict detection (currently the merger agent's Task 1)
2. T3 conflict resolution for all unresolved conflicts (currently Task 2)
3. Confidence scoring and escalation flagging

**What it returns (RAPID:RETURN):**
```json
{
  "status": "COMPLETE",
  "data": {
    "setName": "auth-core",
    "semantic_conflicts": [...],
    "resolutions": [...],
    "escalations": [...],
    "all_resolved": true|false,
    "files_modified": ["src/auth.cjs"],
    "summary": "2 semantic conflicts found, 1 resolved (0.85), 1 escalated"
  }
}
```

**What it does NOT do:**
- Run detection (CLI commands -- orchestrator does this)
- Run resolution cascade (CLI commands -- orchestrator does this)
- Execute the git merge
- Handle human escalations
- Run integration tests

**Key difference from current rapid-merger:** The current merger gets a fully assembled prompt with all context inlined. The new rapid-set-merger reads its own context files (CONTEXT.md, CONTRACT.json) within its context window, keeping the orchestrator lean.

### Why Detection/Resolution Stay in the Orchestrator (CLI calls)

Detection (L1-L4) and resolution (T1-T2) are CLI commands that return JSON. They add minimal context to the orchestrator -- just a `node "${RAPID_TOOLS}" merge detect {setName}` call and a JSON parse. The expensive part is the semantic analysis (reading file contents, understanding intent, writing resolution code). That is what gets delegated.

The orchestrator runs detection/resolution via CLI, filters for unresolved conflicts, and passes ONLY the unresolved set to the subagent. This means:
- If T1/T2 resolves everything, no subagent is spawned (fast path)
- If conflicts remain, the subagent gets a focused payload (only unresolved conflicts, not the full detection report)

### "Adaptive Nesting" Reframed

PROJECT.md states: "merge agents can spawn per-conflict sub-agents for complex resolutions." This is IMPOSSIBLE under Claude Code's constraint that subagents cannot spawn sub-subagents.

**Reframed design:** The SKILL orchestrator implements a two-phase dispatch pattern:

```
Phase 1: Per-set merge agent
  - Handles all conflicts for a set
  - Returns with escalations if any conflict has confidence < 0.7

Phase 2: Per-conflict resolution agents (only if Phase 1 has escalations)
  - SKILL spawns one agent per escalated conflict (or batches by file)
  - Each agent gets ONLY the single conflict context + relevant file content
  - Returns with a proposed resolution + confidence score
  - SKILL then decides: apply (if confidence >= 0.7) or escalate to human

This achieves the "adaptive nesting" goal (deeper analysis per conflict)
without violating the sub-subagent constraint.
```

**When to use Phase 2 vs direct human escalation:**

Phase 2 is worth spawning only when:
- Conflict involves multiple files or complex semantic interaction
- Phase 1 merger returned confidence 0.4-0.7 (ambiguous, not hopeless)
- Conflict is NOT an API signature change (those always go to human per existing rules)

If Phase 1 confidence is below 0.4, skip Phase 2 and go directly to human escalation. The agent is unlikely to do better with more context.

### DAG Dependencies and Sequential Merging

**Current behavior (preserved):** Sets within a wave merge SEQUENTIALLY, not in parallel. Each merge sees the result of the previous one. This is correct and must be preserved because:
1. Set B's detection depends on main's state AFTER Set A merges
2. The dry-run git merge in L1 detection operates on the current HEAD

**What changes with subagent delegation:**

The orchestrator loop becomes:

```
for each wave (in DAG order):
  record pre-wave commit
  for each set in wave (sequentially):
    1. ORCHESTRATOR: run detection CLI (L1-L4) -- light, stays in orchestrator
    2. ORCHESTRATOR: run resolution CLI (T1-T2) -- light, stays in orchestrator
    3. IF unresolved conflicts > 0:
       a. ORCHESTRATOR: spawn rapid-set-merger agent
       b. ORCHESTRATOR: parse RAPID:RETURN
       c. IF escalations AND confidence 0.4-0.7:
          ORCHESTRATOR: spawn per-conflict-resolver agents (Phase 2)
          ORCHESTRATOR: parse RAPID:RETURNs
       d. FOR EACH remaining escalation:
          ORCHESTRATOR: AskUserQuestion (human gate)
    4. ORCHESTRATOR: run programmatic gate CLI
    5. ORCHESTRATOR: execute merge CLI
    6. ORCHESTRATOR: forget per-set context (only retain: merged/skipped status)
  run integration test
  handle bisection if needed
```

**Step 6 is the key innovation.** After a set's merge completes, the orchestrator discards all per-set detection/resolution/merger context. It only retains a one-line status entry: `{setName: "auth-core", status: "merged", commit: "abc1234"}`. This prevents context accumulation across sets.

### Result Aggregation Pattern

The orchestrator collects results from subagents using the same RAPID:RETURN protocol used everywhere in RAPID. The pattern is:

```
1. Build minimal prompt (set name + unresolved conflicts + file references)
2. Spawn agent with RAPID:RETURN format specified
3. Parse the <!-- RAPID:RETURN {...} --> from agent output
4. Extract data fields, discard the rest of agent output
5. Make decisions based on structured data
6. Update MERGE-STATE.json via CLI
```

This is identical to how the review pipeline collects hunter findings, advocate assessments, and judge rulings. No new protocol is needed.

### What the Orchestrator Retains vs Delegates

| Concern | Orchestrator | Subagent |
|---------|-------------|----------|
| DAG ordering | RETAINS | -- |
| Wave sequencing | RETAINS | -- |
| Detection (L1-L4 CLI) | RETAINS (light CLI calls) | -- |
| Resolution cascade (T1-T2 CLI) | RETAINS (light CLI calls) | -- |
| Semantic detection (L5) | DELEGATES | rapid-set-merger |
| AI conflict resolution (T3) | DELEGATES | rapid-set-merger |
| Deep per-conflict resolution | DELEGATES | rapid-conflict-resolver (Phase 2) |
| Human escalation gates | RETAINS | -- |
| Programmatic gate (CLI) | RETAINS | -- |
| Merge execution (CLI) | RETAINS | -- |
| Integration tests (CLI) | RETAINS | -- |
| Bisection (CLI) | RETAINS | -- |
| Rollback (CLI) | RETAINS | -- |
| MERGE-STATE updates | RETAINS | -- |
| Context accumulation | DISCARDS per-set context after merge | -- |

### Independent Sets and Parallel Merge (DAG allows)

Sets in different waves are inherently sequential (Wave 2 depends on Wave 1). Within a wave, sets are currently sequential because each merge changes HEAD.

**Future optimization (out of scope for v2.2 but noted):** Sets within the same wave that have NO overlapping files could theoretically merge in parallel (to separate temp branches, then fast-forward). This requires:
1. Pre-computing file overlap between sets in the same wave
2. Grouping non-overlapping sets for parallel merge
3. Reconciling the parallel merges

This is complex and the current sequential model works. Flagged as a potential v2.3 optimization if context window savings from subagent delegation are insufficient.

## New Components

### 1. rapid-set-merger Agent (NEW)

**Source module:** `src/modules/roles/role-set-merger.md`
**Generated agent:** `agents/rapid-set-merger.md`

Replaces the current rapid-merger agent role. The existing `rapid-merger` agent can be deprecated or kept as a simpler variant.

**Tools needed:** Read, Write, Bash, Grep, Glob (same as current rapid-merger)
**Cannot use:** Agent tool (leaf agent, no sub-subagents)

**Key differences from rapid-merger:**
- Reads its own context files (CONTEXT.md, CONTRACT.json) rather than receiving them inlined
- Receives only unresolved conflicts as input (not full detection report)
- Returns structured data for orchestrator decision-making
- One instance per set, each in isolated context window

### 2. rapid-conflict-resolver Agent (NEW, Phase 2 only)

**Source module:** `src/modules/roles/role-conflict-resolver.md`
**Generated agent:** `agents/rapid-conflict-resolver.md`

Spawned by the orchestrator for escalated conflicts with confidence 0.4-0.7. Gets a single conflict's full context and attempts a deeper resolution.

**Tools needed:** Read, Write, Grep, Glob (no Bash needed -- reads files, writes resolved code)
**Cannot use:** Agent tool (leaf agent)

**Input:** Single conflict descriptor + both versions of the conflicting file(s) + relevant CONTEXT.md excerpts
**Output:** Proposed resolution + confidence score + rationale

This agent is optional. If Phase 1 merger resolves everything or escalates everything to human, Phase 2 never triggers.

### 3. Modified merge SKILL.md (MODIFIED)

The SKILL.md is rewritten to follow the dispatch-collect-decide pattern. Major changes:
- Step 3 (detection) + Step 4a-4b (resolution T1-T2): unchanged (CLI calls)
- Step 4c (merger agent): replaced with rapid-set-merger spawn + collect
- NEW Step 4c.5 (Phase 2): per-conflict resolver dispatch if needed
- Step 4d-4e (process results, handle escalations): restructured to work with RAPID:RETURN
- NEW: explicit context discard after each set completes within the wave loop
- Steps 5-8 (programmatic gate through pipeline complete): largely unchanged

### 4. Modified merge.cjs Library (MODIFIED)

Minimal changes:
- Add a `prepareMergerContext` function that assembles the minimal context payload for the rapid-set-merger agent (replaces the inline context assembly currently in SKILL.md)
- Add a `parseSetMergerReturn` function that validates the RAPID:RETURN data schema from rapid-set-merger
- Existing detection, resolution, merge execution, bisection, rollback functions: UNCHANGED

### 5. MERGE-STATE.json Schema Extension (MODIFIED)

Add fields to track subagent delegation:

```javascript
// New fields in MergeStateSchema
agentPhase1: z.object({
  spawned: z.boolean().default(false),
  completedAt: z.string().optional(),
  semanticConflictsFound: z.number().default(0),
  resolutionsApplied: z.number().default(0),
  escalationsReturned: z.number().default(0),
}).optional(),
agentPhase2: z.object({
  spawned: z.boolean().default(false),
  conflictsDispatched: z.number().default(0),
  resolved: z.number().default(0),
  stillEscalated: z.number().default(0),
  completedAt: z.string().optional(),
}).optional(),
```

This enables idempotent re-entry: if the pipeline restarts mid-set, the orchestrator can check whether Phase 1/Phase 2 agents already ran and skip re-spawning.

## Data Flow

### Happy Path (no conflicts)

```
SKILL: merge order CLI -> DAG waves
SKILL: merge detect {set} -> { L1: 0, L2: 0, L3: 0, L4: 0 }
SKILL: (no conflicts) -> skip to programmatic gate
SKILL: merge review {set} -> { passed: true }
SKILL: merge execute {set} -> { merged: true, commit: "abc1234" }
SKILL: discard set context, record status
```

Context cost: ~5 CLI calls + JSON parses. Minimal.

### Conflict Path (T1/T2 resolve all)

```
SKILL: merge detect {set} -> { L1: 3, L2: 1, L3: 0, L4: 0 }
SKILL: merge resolve {set} -> { tier1: 2, tier2: 2, unresolvedForAgent: 0 }
SKILL: (all resolved) -> skip agent spawn
SKILL: merge review {set} -> { passed: true }
SKILL: merge execute {set} -> { merged: true }
SKILL: discard set context
```

Context cost: ~6 CLI calls. Still minimal.

### Complex Path (needs agent + Phase 2)

```
SKILL: merge detect {set} -> { L1: 3, L2: 2, L3: 1, L4: 1 }
SKILL: merge resolve {set} -> { tier1: 1, tier2: 2, unresolvedForAgent: 4 }
SKILL: prepareMergerContext({set}, unresolved) -> minimal payload
SKILL: spawn rapid-set-merger with payload
  AGENT: reads CONTEXT.md, CONTRACT.json, analyzes 4 conflicts
  AGENT: resolves 2 (confidence 0.85, 0.78), escalates 2 (confidence 0.55, 0.62)
  AGENT: RAPID:RETURN { resolutions: [...], escalations: [...] }
SKILL: parse return, apply 2 resolutions
SKILL: 2 escalations with confidence 0.4-0.7 -> spawn Phase 2
SKILL: spawn rapid-conflict-resolver for escalation-1
SKILL: spawn rapid-conflict-resolver for escalation-2
  AGENTS: deep analysis, return proposed resolutions
SKILL: parse returns
  - escalation-1 resolved (confidence 0.82) -> apply
  - escalation-2 still low (confidence 0.45) -> human gate
SKILL: AskUserQuestion for escalation-2
SKILL: merge review {set} -> { passed: true }
SKILL: merge execute {set} -> { merged: true }
SKILL: discard set context
```

Context cost: 1 set-merger spawn + 2 conflict-resolver spawns + 1 human question. Each agent runs in its own context window. Orchestrator only holds structured return data.

## Build Order

### Phase 1: Core Delegation Infrastructure

1. **Create `src/modules/roles/role-set-merger.md`** -- the new per-set merger role
   - Port Task 1 (semantic detection) and Task 2 (conflict resolution) from current role-merger.md
   - Add self-context-loading (reads CONTEXT.md, CONTRACT.json within agent)
   - Accepts unresolved conflicts as input (not full detection report)
   - Dependencies: none (new file)

2. **Add `prepareMergerContext` to `src/lib/merge.cjs`** -- assembles minimal agent payload
   - Reads CONTEXT.md, CONTRACT.json, filters unresolved conflicts
   - Returns a structured object (not a prompt string -- the SKILL builds the prompt)
   - Dependencies: existing merge.cjs functions

3. **Add `parseSetMergerReturn` to `src/lib/merge.cjs`** -- validates agent return data
   - Zod schema for the RAPID:RETURN data payload
   - Dependencies: existing Zod patterns in merge.cjs

4. **Run `build-agents`** -- generates `agents/rapid-set-merger.md` from the role module
   - Dependencies: step 1

### Phase 2: SKILL.md Rewrite

5. **Rewrite `skills/merge/SKILL.md`** -- implement dispatch-collect-decide pattern
   - Replace Step 4c (merger agent) with rapid-set-merger spawn + collect
   - Add context discard after each set
   - Preserve all CLI-based steps (detection, resolution, gates, merge, tests)
   - Dependencies: steps 1-4

6. **Extend `MergeStateSchema`** -- add agentPhase1/agentPhase2 tracking
   - Dependencies: existing merge.cjs schema

### Phase 3: Phase 2 Conflict Resolution (optional enhancement)

7. **Create `src/modules/roles/role-conflict-resolver.md`** -- per-conflict deep resolver
   - Receives single conflict context
   - Returns proposed resolution + confidence
   - Dependencies: none (new file)

8. **Add Phase 2 dispatch logic to SKILL.md** -- spawn per-conflict resolvers for mid-confidence escalations
   - Dependencies: steps 5, 7

9. **Run `build-agents`** -- generates `agents/rapid-conflict-resolver.md`
   - Dependencies: step 7

### Phase 4: Testing and Migration

10. **Update `src/lib/merge.test.cjs`** -- tests for new functions
    - `prepareMergerContext` unit tests
    - `parseSetMergerReturn` validation tests
    - Dependencies: steps 2-3

11. **Deprecate `src/modules/roles/role-merger.md`** -- mark as v2.0 legacy
    - Dependencies: step 1 (replacement exists)

## Anti-Patterns

### Anti-Pattern 1: Inlining Context in the Orchestrator Prompt

**What people do:** The orchestrator reads CONTEXT.md, CONTRACT.json, and all set contexts, then passes them as a massive string to the subagent prompt.
**Why it's wrong:** The context is counted in BOTH the orchestrator's AND the subagent's context window. The whole point of delegation is to keep the orchestrator lean.
**Do this instead:** Pass file PATHS to the subagent. Let the subagent read its own context files. The orchestrator prompt should contain: set name, branch info, unresolved conflict JSON (compact), file paths to read. NOT the file contents.

### Anti-Pattern 2: Parallel Set Merging Within a Wave

**What people do:** Spawn multiple rapid-set-merger agents for all sets in a wave simultaneously.
**Why it's wrong:** Each merge changes HEAD. Set B's detection (L1 textual = dry-run git merge) depends on main's state after Set A merges. Parallel detection would use stale HEAD.
**Do this instead:** Keep sets sequential within waves. The subagent optimization is about context window isolation, not parallelism. Within a wave, the orchestrator processes sets one at a time but discards context between sets.

### Anti-Pattern 3: Phase 2 for Everything

**What people do:** Always spawn per-conflict resolvers for every escalation.
**Why it's wrong:** Phase 2 agents cost tokens and time. Conflicts with confidence < 0.4 are unlikely to be resolved by another agent -- they genuinely need human judgment. API signature changes should always go to human per existing rules.
**Do this instead:** Phase 2 is a targeted intervention for the "ambiguous middle" (confidence 0.4-0.7). Below 0.4 or API changes: go directly to human. Above 0.7: Phase 1 already resolved it.

### Anti-Pattern 4: Keeping Agent Output in Orchestrator Memory

**What people do:** Store the full text output of each subagent in the orchestrator's context for "reference."
**Why it's wrong:** Defeats the purpose of delegation. The structured RAPID:RETURN data is all the orchestrator needs.
**Do this instead:** Parse RAPID:RETURN, extract structured data, update MERGE-STATE.json via CLI, discard the rest. If detailed logs are needed later, the MERGE-STATE.json has the structured data.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| SKILL <-> rapid-set-merger | Agent tool spawn + RAPID:RETURN | One-shot: spawn, collect, discard |
| SKILL <-> rapid-conflict-resolver | Agent tool spawn + RAPID:RETURN | Phase 2 only, one per conflict |
| SKILL <-> merge.cjs (CLI) | Bash tool + JSON stdout | Unchanged from v2.0 |
| SKILL <-> MERGE-STATE.json | CLI read/write via rapid-tools | Extended schema, same access pattern |
| SKILL <-> Human | AskUserQuestion | Unchanged -- all escalation gates preserved |
| rapid-set-merger <-> filesystem | Read tool (CONTEXT.md, CONTRACT.json, source files) | Agent reads its own context |
| rapid-set-merger <-> worktree | Write tool (resolved conflict files) | Agent writes resolution code directly |

### External (Unchanged)

| Boundary | Communication | Notes |
|----------|---------------|-------|
| SKILL <-> git | Bash (merge, abort, log, diff) | All git ops stay in orchestrator or CLI |
| merge.cjs <-> git | execFileSync | Detection, merge execution, bisection |
| merge.cjs <-> dag.cjs | Function calls | Merge ordering |
| merge.cjs <-> contract.cjs | Function calls | Ownership, contract tests |

## Comparison: Review Pipeline Pattern vs Merge Pipeline Adaptation

The review pipeline provides the proven delegation pattern, but merge has constraints that review does not:

| Aspect | Review Pipeline | Merge Pipeline (v2.2) |
|--------|----------------|----------------------|
| Parallelism | Multiple hunters/testers in parallel per wave | Sequential per set within wave (git constraint) |
| Fan-out trigger | Always (chunk or concern based) | Conditional (only if T1/T2 leave unresolved) |
| Agent lifecycle | Spawn, collect, merge findings | Spawn, collect, apply resolutions, discard |
| Multi-phase | Hunter -> Advocate -> Judge (3 sequential) | Set-merger -> (optional) conflict-resolvers (2 max) |
| Context discard | After full review completes | After EACH set completes (within wave loop) |
| Human gates | After judge rulings (DEFERRED) | After Phase 1/2 escalations (confidence < threshold) |
| Idempotent re-entry | Via REVIEW-ISSUES.json | Via MERGE-STATE.json agentPhase1/agentPhase2 |

The key adaptation: review can afford to hold all findings in memory because it processes one set at a time. Merge processes multiple sets sequentially within a wave. The per-set context discard is the critical innovation that review does not need.

## Sources

- `/home/kek/Projects/RAPID/skills/merge/SKILL.md` -- current merge orchestrator (v2.0)
- `/home/kek/Projects/RAPID/skills/review/SKILL.md` -- reference delegation pattern
- `/home/kek/Projects/RAPID/src/lib/merge.cjs` -- merge pipeline library (detection, resolution, state)
- `/home/kek/Projects/RAPID/src/lib/dag.cjs` -- DAG ordering (toposort, wave assignment)
- `/home/kek/Projects/RAPID/agents/rapid-merger.md` -- current merger agent (to be replaced)
- `/home/kek/Projects/RAPID/src/modules/roles/role-merger.md` -- current merger role module
- `/home/kek/Projects/RAPID/.planning/PROJECT.md` -- project requirements and constraints

---
*Architecture research for: RAPID v2.2 merge pipeline subagent delegation*
*Researched: 2026-03-10*
