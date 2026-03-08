# Architecture Research: v2.1 Integration Architecture

**Domain:** Workflow streamlining, subagent delegation, and plan verification for RAPID plugin
**Researched:** 2026-03-09
**Confidence:** HIGH (derived from direct codebase analysis of all 21 libraries, 17 skills, and 26 role/core modules)

## System Overview

```
+-----------------------------------------------------------------------+
|                        SKILL LAYER (17 skills)                         |
|  /init  /set-init  /discuss  /wave-plan  /execute  /review  /merge    |
|  Each skill = SKILL.md orchestrator that spawns subagents via Agent    |
+-----------------------------------------------------------------------+
        |               |               |               |
        v               v               v               v
+-----------------------------------------------------------------------+
|                     AGENT COMPOSITION LAYER                            |
|  assembler.cjs builds agents from:                                    |
|  - 5 core modules (identity, returns, state-access, git, context)     |
|  - 26 role modules (role-*.md files)                                  |
|  - config.json agent registry (5 composite agents)                    |
+-----------------------------------------------------------------------+
        |               |               |               |
        v               v               v               v
+-----------------------------------------------------------------------+
|                      CLI LAYER (rapid-tools.cjs)                       |
|  Single entry point routing to library functions                      |
|  ~95 subcommands across 10 command groups                             |
+-----------------------------------------------------------------------+
        |               |               |               |
        v               v               v               v
+-----------------------------------------------------------------------+
|                      LIBRARY LAYER (21 .cjs files)                     |
|  state-machine  state-schemas  state-transitions  wave-planning       |
|  execute  review  merge  dag  worktree  contract  lock  plan          |
|  core  context  init  prereqs  assembler  verify  returns  stub teams |
+-----------------------------------------------------------------------+
        |                               |
        v                               v
+-------------------+    +-----------------------------+
|   STATE.json      |    |   .planning/ filesystem     |
|   (Zod-validated, |    |   waves/  sets/  research/  |
|   lock-protected) |    |   ROADMAP.md  config.json   |
+-------------------+    +-----------------------------+
```

### Component Responsibilities

| Component | Responsibility | Key Files |
|-----------|----------------|-----------|
| State Machine | Hierarchical state tracking (project > milestone > set > wave > job), validated transitions, crash recovery | `state-machine.cjs`, `state-schemas.cjs`, `state-transitions.cjs` |
| Wave Planning | Wave resolution, directory creation, wave context writing, job plan validation against contracts | `wave-planning.cjs` |
| Execution Engine | Set/job context preparation, prompt assembly, reconciliation (wave-level and job-level), progress banners, handoff generation | `execute.cjs` |
| Review Pipeline | Wave-scoped file discovery, dependent finding, issue logging/tracking, summary generation | `review.cjs` |
| Agent Assembler | Composable agent construction from core + role modules, frontmatter generation, size warnings | `assembler.cjs` |
| CLI Router | Single entry point, 10 command groups, ~95 subcommands, delegates to library functions | `rapid-tools.cjs` |
| DAG Engine | Topological sort, wave assignment, dependency validation | `dag.cjs` |
| Worktree Manager | Git worktree lifecycle, registry, scoped CLAUDE.md generation | `worktree.cjs` |

## State Machine: Current Schema and Transitions

The state hierarchy is the backbone everything hangs off:

```
ProjectState (Zod-validated, version: 1)
  projectName: string
  currentMilestone: string
  milestones[]:
    id, name
    sets[]:
      id, status: pending|planning|executing|reviewing|merging|complete
      waves[]:
        id, status: pending|discussing|planning|executing|reconciling|complete|failed
        jobs[]:
          id, status: pending|executing|complete|failed
          startedAt?, completedAt?, commitSha?, artifacts[]
```

**Transition maps (state-transitions.cjs):**

```
SET:  pending -> planning -> executing -> reviewing -> merging -> complete
WAVE: pending -> discussing -> planning -> executing -> reconciling -> complete
                                                                      failed -> executing (retry)
JOB:  pending -> executing -> complete
                           -> failed -> executing (retry)
```

**Key constraint:** Derived status propagation flows upward -- job completions derive wave status, wave statuses derive set status. The `isDerivedStatusValid()` guard prevents regression (e.g., can't go from `reviewing` back to `executing`).

## How Each v2.1 Feature Integrates

### Feature 1: Parallel Wave Planning with Dependency-Aware Sequencing

**Problem:** Currently `/discuss` and `/wave-plan` operate on one wave at a time. The user must manually invoke each wave in sequence. The todo.md asks: "is it possible to plan all waves first within a set?"

**Integration points:**

| Component | Change Type | Detail |
|-----------|-------------|--------|
| `skills/wave-plan/SKILL.md` | MODIFY | Add "plan all waves" mode that iterates waves in order, spawns all job planners in parallel |
| `skills/discuss/SKILL.md` | MODIFY | Add "discuss all waves" batch mode |
| `src/lib/wave-planning.cjs` | MODIFY | Add `listWavesInOrder(state, milestoneId, setId)` -- returns waves sorted by ID/order |
| `src/bin/rapid-tools.cjs` | MODIFY | Add `wave-plan plan-all <setId>` and `wave-plan resolve-all-waves <setId>` subcommands |

**Architecture decision:** Waves within a set are inherently sequential in execution (wave-1 completes before wave-2 starts). However, planning is different -- wave plans can be generated in parallel because plan artifacts are independent. The key insight: **plan in parallel, execute in sequence**.

The `discuss` phase should support batched discussion of all waves in a set, but the user may still want to discuss specific waves individually.

**Data flow for all-wave planning:**

```
/rapid:wave-plan --all <setId>
    |
    v
listWavesInOrder(state, milestoneId, setId)
    |
    v
For each wave (in order):
  1. Verify WAVE-CONTEXT.md exists (from /discuss)
  2. Transition wave to 'planning'
  3. Spawn research agent
  4. Spawn wave planner agent
    |
    v (parallel fan-out for job planners across ALL waves)
For all jobs across all waves:
  Spawn job planner agents in parallel (max batch from existing pattern)
    |
    v
Run plan verifier (Feature 2)
    |
    v
Validate all wave plans against contracts
    |
    v
Commit all planning artifacts
```

**State transition consideration:** Each wave transitions `discussing -> planning` independently. The skill orchestrator handles this before spawning the wave planner for that wave. No schema changes needed -- the existing WaveStatus enum already supports all required transitions.

**New library functions (wave-planning.cjs):**

```javascript
// Returns waves in order for a given set
function listWavesInOrder(state, milestoneId, setId) {
  const set = findSet(state, milestoneId, setId);
  return [...set.waves].sort((a, b) => {
    // Sort by wave ID (wave-1, wave-2, etc.) or by position
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });
}

// Check which waves are ready for planning (status: discussing)
function getPlannableWaves(state, milestoneId, setId) {
  return listWavesInOrder(state, milestoneId, setId)
    .filter(w => w.status === 'discussing');
}
```

### Feature 2: Plan Verifier Agent

**Problem:** No validation exists between planning and execution beyond `validateJobPlans()` which only checks contract coverage and cross-set imports. Plans can have overlapping file ownership, infeasible steps, or missing dependency chains.

**Integration points:**

| Component | Change Type | Detail |
|-----------|-------------|--------|
| `src/modules/roles/role-plan-verifier.md` | NEW | Role module for plan verification agent |
| `src/lib/wave-planning.cjs` | MODIFY | Add `verifyPlanCoverage(jobPlans, contractJson)` for structured coverage analysis |
| `skills/wave-plan/SKILL.md` | MODIFY | Add step between job planning (Step 5) and contract validation (Step 6): spawn plan verifier |
| `src/lib/assembler.cjs` | MODIFY | Add `plan-verifier` to ROLE_TOOLS and ROLE_DESCRIPTIONS |
| `config.json` | MODIFY | Add `rapid-plan-verifier` agent definition |

**Verifier responsibilities:**

1. **Coverage check:** Every CONTRACT.json export has a corresponding task in some job plan
2. **Implementability check:** Implementation steps reference real files, APIs, and patterns
3. **Overlap detection:** No two job plans claim to modify the same file (file ownership conflict within wave)
4. **Dependency ordering:** Job plans reference outputs of prior jobs correctly
5. **Completeness:** All acceptance criteria in job plans have corresponding implementation steps

**Where it sits in the pipeline:**

```
Research -> Wave Plan -> Job Plans -> PLAN VERIFIER -> Contract Validation -> Execute
                                          |
                                    Writes PLAN-VERIFICATION.md
                                    Returns via RAPID:RETURN:
                                    { status, coverage, overlaps, infeasible, warnings }
```

**Role module design principles:**

The plan verifier is read-only -- it reads plans and codebase but modifies nothing.
- Tools: `Read, Grep, Glob, Bash`
- Returns structured data via RAPID:RETURN (COMPLETE with findings, or BLOCKED if codebase unreadable)
- Output artifact: `.planning/waves/{setId}/{waveId}/PLAN-VERIFICATION.md`

**Existing integration point:** The `validateJobPlans()` function in `wave-planning.cjs` already does contract-level validation. The plan verifier is complementary -- it checks implementability and overlap, which `validateJobPlans()` does not. Both run in sequence: plan verifier first (broader analysis), then contract validation (specific cross-set checks).

### Feature 3: Numeric ID Resolution

**Problem:** Users must type exact set/wave IDs like `set-01-foundation` when `1` would suffice. The todo.md explicitly asks for `/set-init 1` and `/discuss 1`.

**Integration points:**

| Component | Change Type | Detail |
|-----------|-------------|--------|
| `src/lib/state-machine.cjs` | MODIFY | Add `resolveEntityId(state, milestoneId, input, entityType, parentSetId?)` |
| `src/bin/rapid-tools.cjs` | MODIFY | Add `state resolve-id <input> --type set|wave [--set <setId>]` subcommand |
| `skills/set-init/SKILL.md` | MODIFY | Parse numeric input, resolve via CLI before other operations |
| `skills/discuss/SKILL.md` | MODIFY | Same |
| `skills/wave-plan/SKILL.md` | MODIFY | Same |
| `skills/execute/SKILL.md` | MODIFY | Same |
| `skills/review/SKILL.md` | MODIFY | Same |

**Resolution strategy:**

```javascript
function resolveEntityId(state, milestoneId, input, entityType, parentSetId) {
  const milestone = findMilestone(state, milestoneId);

  if (entityType === 'set') {
    // 1. Try exact match
    const exact = milestone.sets.find(s => s.id === input);
    if (exact) return exact.id;

    // 2. Try numeric: "1" -> sets[0], "2" -> sets[1]
    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= milestone.sets.length) {
      return milestone.sets[num - 1].id;
    }

    // 3. Try substring match: "foundation" matches "set-01-foundation"
    const matches = milestone.sets.filter(s =>
      s.id.toLowerCase().includes(input.toLowerCase())
    );
    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) {
      throw new Error(`Ambiguous: "${input}" matches ${matches.map(m => m.id).join(', ')}`);
    }

    throw new Error(`Cannot resolve set "${input}". Available: ${milestone.sets.map(s => s.id).join(', ')}`);
  }

  if (entityType === 'wave') {
    // Need parent set context
    if (!parentSetId) throw new Error('Set ID required to resolve wave');
    const set = findSet(state, milestoneId, parentSetId);

    const exact = set.waves.find(w => w.id === input);
    if (exact) return exact.id;

    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= set.waves.length) {
      return set.waves[num - 1].id;
    }

    const matches = set.waves.filter(w =>
      w.id.toLowerCase().includes(input.toLowerCase())
    );
    if (matches.length === 1) return matches[0].id;

    throw new Error(`Cannot resolve wave "${input}" in set "${parentSetId}"`);
  }
}
```

**Design choice:** Resolution lives in the library layer, called via CLI. Skills call `node "${RAPID_TOOLS}" state resolve-id <input> --type set` and parse JSON output. This keeps resolution testable, consistent across all skills, and avoids duplicating logic in prompt files.

**CLI subcommand output format:**

```json
{ "resolved": true, "id": "set-01-foundation", "input": "1", "type": "set" }
```

or

```json
{ "resolved": false, "error": "Ambiguous", "candidates": ["set-01-a", "set-01-b"], "input": "01" }
```

### Feature 4: Batched Questioning During Discuss Phase

**Problem:** The discuss phase asks 4 questions per gray area via sequential AskUserQuestion calls, creating high-friction loops (answer -> wait -> answer). The todo.md explicitly flags this.

**Integration points:**

| Component | Change Type | Detail |
|-----------|-------------|--------|
| `skills/discuss/SKILL.md` | MODIFY | Restructure Step 5 deep-dive to reduce question count |
| No library changes | -- | Pure prompt/orchestration change |

**Current question flow (4 per area):**
1. Open-ended exploration (which approach?)
2. Follow-up probing (edge cases for chosen approach)
3. Specifics clarification (implementation details)
4. Confirmation (approve decisions)

**Proposed batched flow (2 rounds total, not per area):**

**Round 1 -- All areas at once:**
Present ALL selected gray areas with their approach options in a single structured prompt. Each area gets its top-level question with options. The user can answer all areas in one response.

Implementation: Use AskUserQuestion with a structured multi-select where each option encodes an area + approach choice. For 5 areas with 3 options each, present 15 options grouped by area header.

Alternatively, since AskUserQuestion may not support grouping, batch areas into groups of 2-3 and present each group as a single AskUserQuestion with clearly labeled sections.

**Round 2 -- Confirmation:**
Present all collected decisions as a summary table. One AskUserQuestion: "Approve all decisions, revise specific areas, or let Claude decide remaining details?"

**Net effect:** For 5 selected gray areas, this reduces from 20 questions (5 areas * 4) to approximately 4-6 questions (2-3 batched rounds + 1 confirmation + possible revisions). This is a 3-4x reduction in user interactions.

**No library changes needed.** The batching is entirely in the SKILL.md prompt orchestration. The `writeWaveContext()` function in `wave-planning.cjs` already accepts the structured context data regardless of how many questions were asked to collect it.

### Feature 5: Context-Efficient Review with Scoper Delegation

**Problem:** The review pipeline consumes enormous context because the orchestrator loads all files before passing them to review agents. The todo.md notes: "the review agent should spawn a scoper" and "agents eat quite a lot of context."

**Integration points:**

| Component | Change Type | Detail |
|-----------|-------------|--------|
| `src/modules/roles/role-review-scoper.md` | NEW | Role module for review scoping agent |
| `skills/review/SKILL.md` | MODIFY | Spawn scoper subagent at Step 3.0; pass scoped output to downstream agents |
| `src/lib/review.cjs` | MODIFY | Add `generateScopeInput(changedFiles, dependentFiles, worktreePath)` that produces scoper input |
| `src/lib/assembler.cjs` | MODIFY | Add `review-scoper` to ROLE_TOOLS and ROLE_DESCRIPTIONS |

**Architecture for context efficiency:**

```
/rapid:review
    |
    v
Step 3.0: Compute review scope (existing scopeWaveForReview())
    |  Returns: { changedFiles, dependentFiles, totalFiles }
    |
    v
Step 3.0.5: Spawn SCOPER subagent (NEW)
    |  Input: file list + git diffs for each file
    |  The SCOPER reads full files, produces compressed summary
    |  Output: REVIEW-SCOPE.md with:
    |    - Per-file change summary (not full content)
    |    - Key function signatures affected
    |    - Contract-relevant interfaces
    |    - Files flagged as "needs full read" vs "summary sufficient"
    |
    v
Step 3a-3c: Pass REVIEW-SCOPE.md to review agents
    instead of raw file contents
    For "needs full read" files: agent reads them directly
    For "summary sufficient" files: agent uses scope summary only
```

**Scoper role design:**

The scoper is a dedicated subagent that reads full files and produces a compressed context document. Downstream review agents receive this scope document, reducing their context consumption by an estimated 60-80%.

Tools for scoper: `Read, Grep, Glob, Bash` (needs Bash for `git diff` to see change deltas)

**Scoper output format (REVIEW-SCOPE.md):**

```markdown
# Review Scope: wave-1

## Change Summary
- 3 files changed, 2 dependent files affected
- Net: +45 -12 lines

## Changed Files

### src/lib/state-machine.cjs
- **Delta:** +45 -12 lines
- **Key changes:** Added resolveEntityId(), modified findSet() error messages
- **Exports affected:** resolveEntityId (new), findSet (unchanged signature)
- **Full review needed:** YES (logic-heavy, new branching paths)

### src/lib/wave-planning.cjs
- **Delta:** +23 -0 lines
- **Key changes:** Added listWavesInOrder(), getPlannableWaves()
- **Exports affected:** listWavesInOrder (new), getPlannableWaves (new)
- **Full review needed:** NO (straightforward array operations)

## Dependent Files
### src/bin/rapid-tools.cjs
- **Imports from changed:** state-machine.cjs
- **Impact:** New CLI route for resolve-id subcommand
```

**Critical insight:** The scoper flags files where "full review needed" is YES vs NO. For logic-heavy changes, review agents still need full content. For straightforward additions, the summary suffices. This judgment call is why the scoper is an agent (LLM reasoning) not a library function (deterministic).

### Feature 6: GSD Agent Type Decontamination

**Problem:** Residual `gsd` references exist in state files and documentation. Runtime agents sometimes spawn with `gsd-*` names.

**Integration points:**

| Component | Change Type | Detail |
|-----------|-------------|--------|
| `.planning/STATE.md` | MODIFY | Change `gsd_state_version` to `rapid_state_version` |
| `test/.planning/STATE.md` | MODIFY | Same change in test fixtures |
| All skills and role modules | VERIFIED CLEAN | Grep confirms zero `gsd` references in skills/ and src/modules/ |
| `config.json` | VERIFIED CLEAN | Already uses `rapid-*` naming |

**Status:** Mostly resolved already. The skill files and role modules are clean. Only STATE.md frontmatter (2 files) and historical documentation references remain. The runtime agent naming issue reported in todo.md appears to stem from the Claude Code settings `.claude/settings.json` where agent types may still be registered with `gsd-*` prefixes, not from RAPID's own code.

**Action needed:** Fix STATE.md files (trivial find-replace) and verify Claude Code settings don't have stale `gsd-*` agent type registrations.

### Feature 7: Streamlined Workflow

**Problem:** The workflow is confusing. The todo.md identifies the ideal flow: `/init -> /plan (auto?) -> /set-init -> /discuss -> /wave-plan -> /execute -> /review -> /merge`. Currently each step requires explicit manual invocation.

**Integration points:**

| Component | Change Type | Detail |
|-----------|-------------|--------|
| `skills/init/SKILL.md` | MODIFY | Step 9 roadmap generation already writes STATE.json with sets/waves/jobs -- the separate `/plan` step is redundant |
| `skills/set-init/SKILL.md` | MODIFY | After worktree creation, offer to auto-start `/discuss` for wave-1 |
| `skills/execute/SKILL.md` | MODIFY | Remove the explicit "Begin execution?" confirmation prompt -- the user already chose to execute |
| `skills/wave-plan/SKILL.md` | MODIFY | Support `--all` flag for all-wave planning within a set |
| `skills/review/SKILL.md` | MODIFY | Default to lean review (already exists), full adversarial pipeline becomes opt-in |

**Recommended streamlined workflow:**

```
/init          -> creates STATE.json with sets/waves/jobs from roadmap
                  (absorbs what /plan used to do)
/set-init <N>  -> creates worktree, generates CLAUDE.md, offers to start discuss
/discuss <N>   -> batch discuss all waves in set (or specific wave)
/wave-plan <N> -> plan all waves in set with plan verification
/execute <N>   -> execute all waves sequentially without extra confirmation
/review <N>    -> lean review by default, full pipeline opt-in
/merge <N>     -> merge set branch into main
```

**Key architectural insight:** The `/plan` command from v1.0 is effectively absorbed into `/init` Step 9. The roadmapper agent already produces the full set/wave/job structure and writes it to STATE.json. A separate `/plan` invocation is redundant -- it only confuses the workflow.

### Feature 8: Leaner Review Stage

**Problem:** The 3-agent adversarial bug hunt costs $15-45 per cycle and burns massive context. The todo.md asks for a leaner review.

**Integration points:**

| Component | Change Type | Detail |
|-----------|-------------|--------|
| `skills/review/SKILL.md` | MODIFY | Default to lean review. Full adversarial pipeline requires explicit opt-in. |
| `skills/execute/SKILL.md` | ALREADY EXISTS | Step 3g.1 already runs `review lean` after wave reconciliation |
| `src/lib/review.cjs` | MINOR MODIFY | Ensure lean review includes basic static analysis beyond file existence |

**Architecture decision:** Lean review already exists and runs automatically during execution (Step 3g.1 of execute SKILL.md). The full adversarial pipeline (hunter/advocate/judge) should be an explicit opt-in during `/review`, not the default.

When `/review` is invoked, the default should be:
1. Show lean review results (already generated during execute)
2. Ask if user wants full adversarial review (with cost warning: "$15-45 per cycle")
3. If yes, run the full pipeline with scoper delegation (Feature 5)

## New Components Summary

| New Component | Type | Depends On | Consumed By |
|---------------|------|------------|-------------|
| `resolveEntityId()` | Library function in state-machine.cjs | `findMilestone()`, `findSet()` | All skills that accept set/wave IDs |
| `state resolve-id` | CLI subcommand in rapid-tools.cjs | `resolveEntityId()` | All skill SKILL.md files |
| `listWavesInOrder()` | Library function in wave-planning.cjs | `findSet()` from state-machine.cjs | wave-plan SKILL.md |
| `getPlannableWaves()` | Library function in wave-planning.cjs | `listWavesInOrder()` | wave-plan SKILL.md |
| `wave-plan plan-all` | CLI subcommand in rapid-tools.cjs | `listWavesInOrder()`, `getPlannableWaves()` | wave-plan SKILL.md |
| `role-plan-verifier.md` | Role module (NEW file) | None (read-only agent) | wave-plan SKILL.md spawns it |
| `role-review-scoper.md` | Role module (NEW file) | None (read-only, produces scope doc) | review SKILL.md spawns it |
| `generateScopeInput()` | Library function in review.cjs | `scopeWaveForReview()` | review SKILL.md (passes to scoper) |
| PLAN-VERIFICATION.md | Artifact | Plan verifier agent writes it | wave-plan SKILL.md reads for gate decision |
| REVIEW-SCOPE.md | Artifact | Review scoper agent writes it | Review stage agents (hunter, unit-tester, etc.) read it |

## Modified Components Summary

| Existing Component | Modification | Risk |
|--------------------|-------------|------|
| `state-machine.cjs` | Add `resolveEntityId()` export | LOW -- additive, no changes to existing functions |
| `wave-planning.cjs` | Add `listWavesInOrder()`, `getPlannableWaves()` exports | LOW -- additive |
| `review.cjs` | Add `generateScopeInput()` export | LOW -- additive |
| `assembler.cjs` | Add `plan-verifier` and `review-scoper` to ROLE_TOOLS/ROLE_DESCRIPTIONS | LOW -- additive to existing maps |
| `rapid-tools.cjs` | Add `state resolve-id` and `wave-plan plan-all` routes | LOW -- new routes, no changes to existing |
| `config.json` | Add `rapid-plan-verifier` agent definition | LOW -- additive |
| `skills/discuss/SKILL.md` | Batch questioning, numeric ID support | MEDIUM -- significant prompt restructuring |
| `skills/wave-plan/SKILL.md` | Parallel planning, plan verifier step, numeric IDs | MEDIUM -- adds new pipeline step |
| `skills/execute/SKILL.md` | Numeric IDs, remove permission prompt | LOW -- minor prompt changes |
| `skills/review/SKILL.md` | Scoper delegation, lean default | MEDIUM -- changes review flow |
| `skills/set-init/SKILL.md` | Numeric IDs, auto-discuss offer | LOW -- minor prompt changes |
| `skills/init/SKILL.md` | Streamlined auto-plan flow | LOW -- adds optional step at end |
| `.planning/STATE.md` | `gsd_state_version` -> `rapid_state_version` | ZERO -- cosmetic rename |
| `test/.planning/STATE.md` | Same rename | ZERO |

## Architectural Patterns

### Pattern 1: CLI-Mediated State Access

**What:** Skills never read/write STATE.json directly. All state operations go through `rapid-tools.cjs` CLI commands, which delegate to `state-machine.cjs` with lock protection and Zod validation.

**When to use:** Always. Every new feature that touches state must go through the CLI.

**Trade-offs:** Adds a process spawn per state operation (~50ms overhead) but provides atomicity, validation, and crash safety. Already proven across the entire codebase.

**v2.1 implication:** The numeric ID resolver must be a CLI subcommand (`state resolve-id`), not inline JavaScript in skill files. The parallel wave planner must use CLI commands for state transitions, not batch them unsafely.

### Pattern 2: Subagent Orchestration from SKILL.md

**What:** SKILL.md files are the orchestration layer. They spawn subagents via the Agent tool, passing role module contents as prompts. Subagents cannot spawn sub-subagents.

**When to use:** For all multi-step workflows. The orchestrator holds state, the subagent does focused work.

**Trade-offs:** Limited to single-level delegation. Subagent context is bounded by what the orchestrator passes. Cannot have agents coordinate with each other -- all coordination goes through the skill.

**v2.1 implication:** The plan verifier and review scoper are new subagent roles that fit this pattern perfectly. The orchestrator spawns them, collects RAPID:RETURN output, and acts on it. No architectural changes needed.

### Pattern 3: Artifact-Based Communication

**What:** Agents communicate through filesystem artifacts (Markdown and JSON files), not through structured data channels. WAVE-CONTEXT.md, WAVE-PLAN.md, JOB-PLAN.md are the interfaces between pipeline stages.

**When to use:** Between all pipeline stages. Each stage reads prior artifacts and writes new ones.

**Trade-offs:** Human-readable and debuggable. But tightly coupled to file format -- format changes require updating both producer (writing agent) and consumer (reading agent/skill).

**v2.1 implication:** Two new artifacts: PLAN-VERIFICATION.md (plan verifier output) and REVIEW-SCOPE.md (scoper output). Both follow the established pattern -- the producing agent writes them, the consuming skill reads them.

### Pattern 4: Lock-Protected Atomic Writes

**What:** `lock.cjs` provides advisory file locking. `writeState()` acquires lock, validates with Zod, writes to `.tmp`, atomically renames.

**When to use:** Any write to STATE.json or other shared state.

**v2.1 implication:** Parallel wave planning may need concurrent access to STATE.json (transitioning multiple waves to `planning` simultaneously). The existing lock serializes these -- no race conditions, but slightly slower. Acceptable for planning-time operations where latency tolerance is high.

## Anti-Patterns to Avoid

### Anti-Pattern 1: State Mutation in Skill Files

**What people do:** Directly read/modify STATE.json or use `cat`/`jq` in bash within SKILL.md.
**Why it's wrong:** Bypasses Zod validation, lock protection, and transition validation. Can corrupt state or create invalid transitions.
**Do this instead:** Always use `node "${RAPID_TOOLS}" state transition` and `node "${RAPID_TOOLS}" state get`.

### Anti-Pattern 2: Passing Full File Contents to All Agents

**What people do:** Load every source file referenced by a wave and pass full contents to review/planning agents as inline context.
**Why it's wrong:** Burns context window. A 200K-context agent receiving 150K of file contents has almost no room for reasoning. This is the root cause of the "agents eat quite a lot of context" complaint.
**Do this instead:** Use the scoper pattern (Feature 5) -- produce lean summaries, flag which files need full content vs summary.

### Anti-Pattern 3: Nested Agent Spawning

**What people do:** Design agent prompts that expect to spawn sub-agents via the Agent tool.
**Why it's wrong:** Claude Code Agent tool does not support sub-sub-agents. The call fails silently or errors. This was the original GSD contamination issue -- role modules referencing `gsd-phase-researcher` as if they could spawn it.
**Do this instead:** All spawning goes through the SKILL.md orchestrator. Agents return structured output via RAPID:RETURN; the skill chains them.

### Anti-Pattern 4: Adding New State Statuses

**What people do:** Propose adding `verified`, `scoped`, `batched` etc. as new wave/set statuses to track sub-operations.
**Why it's wrong:** More statuses = more transition paths = more edge cases in recovery. The current status sets are well-chosen for the granularity needed.
**Do this instead:** Use artifact existence as implicit sub-status. Wave has WAVE-CONTEXT.md? Discussion happened. Has PLAN-VERIFICATION.md? Verification happened. No new statuses needed for v2.1 features.

### Anti-Pattern 5: Feature-Specific State Files

**What people do:** Create `PLAN-VERIFICATION-STATE.json`, `REVIEW-SCOPE-STATE.json`, etc.
**Why it's wrong:** State fragmentation. No single source of truth. Race conditions between files.
**Do this instead:** One STATE.json for lifecycle state. Separate report/artifact files are fine -- they're outputs, not lifecycle state.

## Integration Points

### Internal Boundaries

| Boundary | Communication Pattern | v2.1 Impact |
|----------|----------------------|-------------|
| Skill -> CLI | Process spawn (`node "${RAPID_TOOLS}" ...`), JSON on stdout | Add `state resolve-id` and `wave-plan plan-all` subcommands |
| CLI -> Library | Direct `require()` and function call | Add `resolveEntityId()`, `listWavesInOrder()`, `generateScopeInput()` |
| Skill -> Agent | Agent tool call, role module content as prompt | Add plan-verifier and review-scoper agent spawns |
| Agent -> Artifact | File write (Write tool or RAPID:RETURN) | Add PLAN-VERIFICATION.md and REVIEW-SCOPE.md |
| Artifact -> Agent | File read by downstream agent via Read tool | Plan verifier reads JOB-PLAN.md; scoper reads changed files |
| Skill -> User | AskUserQuestion (single-select, multi-select, freeform) | Batched questioning in discuss skill |

## Suggested Build Order

```
Phase 1: Foundation (no inter-feature dependencies)
  1.1  GSD decontamination (STATE.md gsd -> rapid rename)
  1.2  Numeric ID resolution (resolveEntityId in state-machine.cjs + CLI route)
  1.3  Plan verifier role module (role-plan-verifier.md)
  1.4  Review scoper role module (role-review-scoper.md)

Phase 2: Skill Updates (depends on Phase 1)
  2.1  Numeric IDs in all skills (set-init, discuss, wave-plan, execute, review)
  2.2  Batched questioning in /discuss
  2.3  Parallel wave planning in /wave-plan + plan verifier integration
  2.4  Streamlined workflow (init auto-plan, set-init auto-discuss offer)

Phase 3: Context Efficiency (depends on Phase 1)
  3.1  Scope summary library function (review.cjs)
  3.2  Scoper integration in /review
  3.3  Leaner review defaults
  3.4  Execute without extra permission prompt

Phase 4: Integration Testing (depends on Phases 2-3)
  4.1  End-to-end workflow test (init -> set-init -> discuss -> wave-plan -> execute -> review)
  4.2  Numeric ID resolution across all entry points
  4.3  Context efficiency measurement (before/after token counts)
```

**Build order rationale:**

- **Phase 1 first:** All items are independent, zero-risk, and foundational. GSD decontamination is a 2-file rename. Numeric ID resolution is a new library function + CLI route that all subsequent skill modifications depend on. Role modules are standalone files that don't affect existing code.

- **Phase 2 second:** These are the user-facing workflow improvements. They depend on numeric ID resolution from Phase 1. Batched questioning and parallel planning are independent of each other and can be built in parallel within this phase.

- **Phase 3 third:** Context efficiency improvements are independent of planning changes but benefit from the Phase 1 role modules. The scoper pattern is a new concept that needs careful testing to calibrate the "full review needed" vs "summary sufficient" threshold.

- **Phase 4 last:** Integration testing validates that all features work together in the end-to-end flow. Must come after individual features are implemented.

**Dependency graph:**

```
[1.1 GSD decontamination]  (independent)
[1.2 Numeric ID resolution] --+--> [2.1 Numeric IDs in skills]
                               +--> [2.2 Batched questioning]
[1.3 Plan verifier role]   ----+--> [2.3 Parallel planning + verifier]
[1.4 Review scoper role]   ----+--> [3.2 Scoper integration]
                               |
[2.4 Streamlined workflow] <---+--- [2.1, 2.2, 2.3]
[3.3 Leaner review] <---------+--- [3.1, 3.2]
[3.4 Execute changes] <-------+--- [1.2]
                               |
[4.1-4.3 Integration testing] <--- [ALL of Phases 2-3]
```

Phases 2 and 3 can be built in parallel since they modify different skills (wave-plan/discuss vs review/execute).

## Data Flow Changes: Before vs After

### Current Flow

```
User -> /discuss wave-1 (one wave, 4 questions per gray area)
  -> /wave-plan wave-1 (one wave, sequential pipeline)
    -> research agent -> wave planner -> job planners -> contract validation
  -> /discuss wave-2 (manual repeat)
  -> /wave-plan wave-2 (manual repeat)
  -> /execute set-01-foundation (full ID, explicit permission prompt)
  -> /review set-01-foundation (full adversarial pipeline, high context)
  -> /merge set-01-foundation (full ID)
```

### v2.1 Flow

```
User -> /discuss 1 (numeric ID, all waves, batched questions)
  -> /wave-plan 1 --all (numeric ID, all waves, parallel planning)
    -> research agents (per wave)
    -> wave planners (per wave)
    -> job planners (all jobs across all waves, parallel)
    -> PLAN VERIFIER (new) -> contract validation
  -> /execute 1 (numeric ID, no extra confirmation, lean review auto)
  -> /review 1 (numeric ID, lean default, full pipeline opt-in with SCOPER)
  -> /merge 1 (numeric ID)
```

**Net improvement:** Fewer user interactions (batched questions, no redundant confirmations), faster planning (parallel wave planning), lower context consumption (scoper delegation), and less typing (numeric IDs).

## Sources

- Direct codebase analysis of all source files in `/home/kek/Projects/RAPID/` (HIGH confidence)
- `state-machine.cjs` (463 lines), `state-schemas.cjs` (60 lines), `state-transitions.cjs` (74 lines) -- authoritative for state model
- `wave-planning.cjs` (230 lines) -- authoritative for wave planning infrastructure
- `execute.cjs` (973 lines), `review.cjs` (434 lines) -- authoritative for execution and review patterns
- `assembler.cjs` (243 lines) -- authoritative for agent composition
- `rapid-tools.cjs` CLI router -- authoritative for available subcommands
- All 17 SKILL.md files -- authoritative for current skill orchestration patterns
- `todo.md` -- first-party user feedback and requirements
- `.planning/PROJECT.md` -- first-party v2.1 milestone definition

---
*Architecture research for: RAPID v2.1 integration*
*Researched: 2026-03-09*
