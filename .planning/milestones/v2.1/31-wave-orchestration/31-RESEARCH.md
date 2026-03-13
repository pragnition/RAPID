# Phase 31: Wave Orchestration - Research

**Researched:** 2026-03-10
**Domain:** CLI skill authoring, agent orchestration, state machine workflows, DAG-based dependency analysis
**Confidence:** HIGH

## Summary

Phase 31 introduces set-level wave orchestration -- a single `/rapid:plan-set` command that plans all waves in a set (auto-chaining), and modifications to `/rapid:execute` that remove per-wave approval gates for PASS/PASS_WITH_WARNINGS results. The core challenge is building an LLM-based wave independence detector (the `rapid-wave-analyzer` agent) that reads WAVE-CONTEXT.md files and returns a dependency graph, then using that graph to sequence planning operations (parallel for independent waves, sequential for dependent ones).

The implementation builds on well-established project patterns: the existing `dag.cjs` library provides topological sort and wave assignment algorithms reusable for ordering waves within a set. The skill/agent/role-module/RAPID:RETURN architecture is mature (27 registered agents, 17 skills). The primary new artifacts are a `plan-set` skill, a `rapid-wave-analyzer` agent (role module + registered agent), and modifications to the existing `execute` skill.

**Primary recommendation:** Implement as three distinct units: (1) the wave-analyzer agent and its role module, (2) the plan-set skill that orchestrates multi-wave planning, and (3) execute skill modifications for auto-advance. Use the existing `dag.cjs` `assignWaves` function pattern for wave dependency ordering, and follow the established agent-spawn-and-return protocol.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- New `/rapid:plan-set` command that plans all waves in a set -- takes set index/ID only (e.g., `/rapid:plan-set 1`)
- Existing `/rapid:wave-plan` kept for single-wave planning -- both commands coexist
- `/rapid:plan-set` requires ALL waves to be discussed first (fail fast) -- if any wave is in `pending` state, abort with message listing undiscussed waves
- Plan-set and execute are separate commands -- no auto-chain from planning into execution. Plan-set prints next step: `/rapid:execute {setIndex}`
- Dedicated `rapid-wave-analyzer` agent reads all WAVE-CONTEXT.md files in a set and determines wave dependencies via LLM analysis
- Analyzer returns structured JSON via RAPID:RETURN (ephemeral) -- no persistent artifact written
- Independent waves (no overlap detected) plan in parallel; dependent waves plan sequentially with predecessor artifacts available
- If parallel-planned waves later show file overlap, the plan verifier (Phase 30) catches it during verification -- no separate cross-wave reconciliation
- PASS and PASS_WITH_WARNINGS auto-advance to next wave without user approval
- FAIL reconciliation stops the chain and presents user with retry/cancel options (only remaining gate)
- PASS_WITH_WARNINGS prints brief inline summary: "Wave X: PASS_WITH_WARNINGS (2 soft blocks). Continuing..."
- Wave transition banner printed between waves (consistent style for both plan-set and execute)
- Lean review auto-fixes committed automatically with count printed: "Lean review: 3 auto-fixed."
- Lean review needsAttention items still gate (log-and-continue or pause -- existing behavior)
- Plan-set: if any wave's planning fails and user cancels re-plan, the entire chain stops (no skip-and-continue)
- Parallel-planned waves: if one fails, sibling waves in the same batch continue to completion. Only subsequent dependent waves are blocked.
- Plan-set has smart re-entry: skip waves already in `planning` state, only plan waves still in `discussing` state
- Execute: new `--retry-wave wave-2` flag for targeting a specific failed wave instead of re-running the entire set
- Execute also retains smart re-entry (re-run `/rapid:execute 1` skips complete waves, retries failed)

### Claude's Discretion
- Wave analyzer agent prompt design and dependency detection heuristics
- Wave transition banner exact format and styling
- How plan-set communicates progress between sequential waves
- Internal structure of RAPID:RETURN JSON from wave analyzer
- Whether plan-set needs its own rapid-tools.cjs subcommands or reuses existing wave-plan CLI calls

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WAVE-01 | Single command plans all waves in a set sequentially (auto-chaining) | New `plan-set` skill iterates waves, calling wave-plan pipeline per wave. State machine `discussing -> planning` transition verified per wave. Smart re-entry skips already-planned waves. |
| WAVE-02 | Independent waves (no file overlap or cross-references) plan in parallel | `rapid-wave-analyzer` agent performs LLM-based dependency analysis on WAVE-CONTEXT.md files. Returns dependency graph. Independent waves (no edges) dispatched to parallel Agent tool calls. |
| WAVE-03 | Dependent waves plan sequentially with predecessor artifacts available | Analyzer's dependency edges determine ordering via `assignWaves`-style leveling. Sequential waves wait for predecessor WAVE-PLAN.md + JOB-PLAN.md to exist before their own research/planning agents are spawned. |
| WAVE-04 | Execute runs waves sequentially without per-wave user approval gates | Execute SKILL.md Step 3i modified: PASS/PASS_WITH_WARNINGS auto-advance (no AskUserQuestion). FAIL retains user decision gate. `--retry-wave` flag added for targeted retry. |
</phase_requirements>

## Standard Stack

### Core (No New Libraries)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins | v25.8.0 | Process spawning, filesystem, path operations | Already used throughout rapid-tools.cjs |
| zod | 3.25.76 | Schema validation for state, return payloads | Already used for all RAPID schemas |
| node:test + node:assert/strict | built-in | Unit testing framework | Project standard -- all 50+ test files use this |

### Reusable Internal Modules

| Module | Functions | Purpose for This Phase |
|--------|-----------|------------------------|
| `dag.cjs` | `toposort`, `assignWaves` | Wave dependency ordering from analyzer output |
| `wave-planning.cjs` | `resolveWave`, `createWaveDir` | Wave directory and resolution for plan-set |
| `resolve.cjs` | `resolveSet`, `resolveWave` | Numeric/string set+wave ID resolution |
| `display.cjs` | `renderBanner` | Wave transition banners between waves |
| `state-machine.cjs` | `readState`, `findSet`, `findWave`, `transitionWave` | State reading and wave status transitions |
| `state-transitions.cjs` | Wave: `discussing -> planning` | Validate allowed wave state transitions |
| `state-schemas.cjs` | `WaveState`, `SetState` | Zod schemas for validation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| LLM-based wave analyzer | Static file-path intersection from WAVE-CONTEXT.md | Misses semantic dependencies (e.g., shared concepts, API contracts). LLM catches these. User explicitly chose LLM analysis. |
| New `plan-set` subcommands in rapid-tools | Reuse existing `wave-plan` CLI calls from within skill | Reusing existing CLI is simpler; only add new subcommands if wave-level listing/status queries cannot be composed from existing `state get --all` + `resolve wave`. Research conclusion: existing CLI is sufficient -- no new subcommands needed. |

**Installation:**
```bash
# No new dependencies -- all modules already exist in the project
```

## Architecture Patterns

### New Files to Create

```
skills/
  plan-set/
    SKILL.md                   # New: /rapid:plan-set orchestrator skill
src/
  modules/
    roles/
      role-wave-analyzer.md    # New: LLM wave dependency analysis role
agents/
  rapid-wave-analyzer.md       # New: Generated agent file (via build-agents)
```

### Files to Modify

```
skills/
  execute/
    SKILL.md                   # Modify: Step 3i auto-advance, --retry-wave flag
src/
  bin/
    rapid-tools.cjs            # Modify: Add wave-analyzer to ROLE_TOOLS, ROLE_COLORS,
                               #   ROLE_DESCRIPTIONS, ROLE_CORE_MAP. Add plan-set to
                               #   STAGE_VERBS/STAGE_BG in display section.
  lib/
    display.cjs                # Modify: Add 'plan-set' stage entry
```

### Pattern 1: Plan-Set Skill Structure

**What:** The plan-set skill is a sequential orchestrator that iterates waves, calling the wave-plan pipeline for each one. It mirrors the execute skill's "process each wave" loop pattern.

**When to use:** When a single command must drive multiple wave-level operations in dependency order.

**Skill flow:**
```
Step 1: Environment setup (standard RAPID preamble)
Step 2: Resolve set, load all waves, validate all are in "discussing" state
Step 3: Spawn rapid-wave-analyzer for dependency detection
Step 4: Order waves into planning batches (parallel groups + sequential chain)
Step 5: For each batch, spawn wave-plan pipeline per wave (parallel within batch)
Step 6: Commit all planning artifacts, print next step
```

**Example (Step 2 precondition check):**
```bash
# Env preamble
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set."; exit 1; fi

# Load all state to find set and waves
STATE_JSON=$(node "${RAPID_TOOLS}" state get --all 2>/dev/null)
echo "$STATE_JSON"
```
Then parse to find all waves, check each wave's status is `discussing` or `planning` (for re-entry).

### Pattern 2: Wave Analyzer Agent (LLM Dependency Detection)

**What:** An LLM agent that reads all WAVE-CONTEXT.md files in a set and outputs a dependency graph as structured JSON via RAPID:RETURN.

**When to use:** Before multi-wave planning to determine which waves can plan in parallel.

**RAPID:RETURN JSON structure (Claude's discretion -- recommended design):**
```json
{
  "status": "COMPLETE",
  "dependencies": [
    { "from": "wave-1", "to": "wave-2", "reason": "wave-2 modifies files created in wave-1" },
    { "from": "wave-1", "to": "wave-3", "reason": "wave-3 extends API defined in wave-1" }
  ],
  "independent_groups": [["wave-2", "wave-4"], ["wave-3"]],
  "analysis_notes": "wave-2 and wave-4 touch entirely separate domains"
}
```

**Role module prompt heuristics (recommended):**
The wave analyzer should look for these dependency signals in WAVE-CONTEXT.md files:
1. **File overlap:** Wave A and Wave B both mention modifying the same files
2. **API dependency:** Wave B mentions using APIs or interfaces that Wave A creates
3. **Sequential logic:** Wave B's description explicitly references Wave A's deliverables
4. **Shared data structures:** Wave B modifies data models that Wave A defines
5. **Test dependencies:** Wave B tests functionality introduced by Wave A

When no signals are found between two waves, they are independent.

### Pattern 3: Plan-Set Calls Wave-Plan Pipeline Internally

**What:** The plan-set skill does NOT spawn the wave-plan skill directly (skills cannot invoke skills). Instead, it replicates the wave-plan pipeline steps (research -> wave-plan -> job-plans -> verify -> validate) inline for each wave, using the same agent names.

**Why:** Claude Code skills are invoked by the user via `/rapid:wave-plan`. A skill cannot programmatically invoke another skill. The plan-set skill must contain or inline the wave-plan logic.

**Approach:** Plan-set includes its own abbreviated version of the wave-plan pipeline per wave:
1. Spawn `rapid-wave-researcher` agent
2. Spawn `rapid-wave-planner` agent
3. Spawn `rapid-job-planner` agents (parallel if 3+ jobs)
4. Spawn `rapid-plan-verifier` agent
5. Run contract validation via CLI: `node "${RAPID_TOOLS}" wave-plan validate-contracts`
6. Transition wave: `node "${RAPID_TOOLS}" state transition wave ... planning`

The prompts for each agent are identical to those in `wave-plan/SKILL.md`. Plan-set just orchestrates multiple iterations.

### Pattern 4: Execute Auto-Advance (Modified Step 3i)

**What:** The execute skill's Step 3i currently uses AskUserQuestion for every wave completion. For auto-advance, PASS and PASS_WITH_WARNINGS skip the question and proceed directly to the next wave.

**Current Step 3i (to be modified):**
```
If PASS:
  AskUserQuestion: "Continue to next wave" | "Pause here"
If PASS_WITH_WARNINGS:
  AskUserQuestion: "Continue anyway" | "Retry failed jobs" | "Pause"
If FAIL:
  AskUserQuestion: "Retry failed jobs" | "Cancel execution"
```

**New Step 3i:**
```
If PASS:
  Print: "Wave {waveId}: PASS. Continuing to wave {nextWaveId}..."
  Auto-advance to next wave.
If PASS_WITH_WARNINGS:
  Print: "Wave {waveId}: PASS_WITH_WARNINGS ({N} soft blocks). Continuing..."
  Auto-advance to next wave.
If FAIL:
  AskUserQuestion: "Retry failed jobs" | "Cancel execution"
  (This is the ONLY remaining per-wave gate)
```

### Pattern 5: --retry-wave Flag

**What:** A new flag for `/rapid:execute` that targets a specific wave for retry.

**Usage:** `/rapid:execute 1 --retry-wave wave-2`

**Behavior:** Skip all waves before `wave-2`, execute only `wave-2` (re-running failed/pending jobs), then continue with subsequent waves if wave-2 succeeds.

### Anti-Patterns to Avoid

- **Skill-invokes-skill:** Skills cannot call other skills. Plan-set must inline the wave-plan pipeline.
- **Sub-subagent spawning:** Agents spawned by plan-set cannot spawn their own sub-agents. Only the orchestrating skill (plan-set SKILL.md) dispatches Agent tool calls.
- **Writing persistent analyzer artifacts:** The user decided analyzer output is ephemeral (RAPID:RETURN only). Do NOT write a DEPENDENCY-GRAPH.json or similar file.
- **Removing AskUserQuestion for FAIL:** Only PASS and PASS_WITH_WARNINGS auto-advance. FAIL must retain the user decision gate.
- **Skipping undiscussed waves:** Plan-set must fail fast if ANY wave is in `pending` state. Do not skip pending waves and plan only discussed ones.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wave dependency ordering | Custom sort logic | `dag.cjs` `assignWaves` (or equivalent BFS leveling) | Already handles cycle detection, wave grouping |
| Wave ID resolution | Manual state parsing | `resolve.cjs` `resolveSet` + `resolveWave` | Handles numeric/string IDs, error messages |
| State transitions | Direct STATE.json edits | `state-machine.cjs` via `node "${RAPID_TOOLS}" state transition wave` | Lock-protected, schema-validated, transition-validated |
| Agent file generation | Manual .md creation | `build-agents` command after adding to ROLE_CORE_MAP | Consistent frontmatter, core module assembly |
| Banner rendering | Inline ANSI codes | `display.cjs` `renderBanner` | Consistent branding, color scheme |
| Contract validation | Custom plan checking | `node "${RAPID_TOOLS}" wave-plan validate-contracts` | Already handles cross-set imports, export coverage |

**Key insight:** This phase is primarily a coordination/orchestration problem, not an algorithm problem. Almost all building blocks exist. The new code is glue: iterating waves, deciding parallel vs sequential, and removing approval gates.

## Common Pitfalls

### Pitfall 1: Plan-Set Tries to Invoke Wave-Plan Skill
**What goes wrong:** Developer writes plan-set to call `/rapid:wave-plan` as if it were a function.
**Why it happens:** Skills look like callable functions but they are user-invoked MCP prompts.
**How to avoid:** Plan-set must inline the wave-plan pipeline steps (spawn agents directly). Reference `wave-plan/SKILL.md` as a template but duplicate the orchestration logic.
**Warning signs:** Any mention of "invoke wave-plan" or "call the wave-plan skill" in the plan.

### Pitfall 2: Analyzer Returns Stale/Wrong Dependencies for Re-Entry
**What goes wrong:** On re-entry (some waves already planned), the analyzer is re-run on ALL waves including already-planned ones, potentially changing the dependency order.
**Why it happens:** Smart re-entry filters which waves to plan but doesn't account for the analyzer being re-invoked.
**How to avoid:** On re-entry, skip the analyzer entirely. Already-planned waves are fixed. Only plan waves still in `discussing` state. If the original batch structure is needed, derive it from the wave statuses (planned = done, discussing = pending).
**Warning signs:** Analyzer spawned when all remaining waves are independent singletons.

### Pitfall 3: Parallel Wave Planning Hits Rate Limits
**What goes wrong:** Spawning 3+ wave-plan pipelines in parallel (each spawning multiple agents) exceeds Claude Code's 5-subagent concurrency ceiling.
**Why it happens:** Each wave-plan pipeline spawns 3-6 agents sequentially (researcher + planner + N job planners + verifier). Parallel pipelines multiply this.
**How to avoid:** Plan-set plans waves within a parallel batch by spawning them as parallel Agent calls, but each pipeline runs sequentially within its agent. The skill (plan-set) spawns one Agent per wave in the parallel batch. Each agent runs the full pipeline (research -> plan -> job-plans -> verify) internally. Max parallelism = number of waves in one batch, not number of agents per wave.
**Warning signs:** "Rate limit" errors when planning 3+ waves simultaneously.

### Pitfall 4: Wave Transition State Mismatch
**What goes wrong:** Plan-set transitions waves from `discussing` to `planning` at the wrong time (before verification completes), leaving waves in invalid states on failure.
**Why it happens:** The existing wave-plan SKILL.md defers the transition to Step 6.5 (after verification). Plan-set might transition earlier.
**How to avoid:** Follow the exact same deferred-transition pattern: `discussing -> planning` only AFTER plan verification and contract validation pass for that wave.
**Warning signs:** Waves stuck in `planning` state with no JOB-PLAN.md files.

### Pitfall 5: Execute --retry-wave Does Not Respect Wave Dependencies
**What goes wrong:** User retries wave-3, but wave-3 depends on wave-2 which is still in `failed` state.
**Why it happens:** --retry-wave jumps directly to the specified wave without checking predecessors.
**How to avoid:** When --retry-wave is used, verify all predecessor waves (by wave ordering in STATE.json) are in `complete` state before proceeding. If not, inform the user which predecessor waves need attention first.
**Warning signs:** Executing a wave whose input artifacts (from prior waves) are missing or incomplete.

## Code Examples

### Example 1: Checking All Waves Are Discussed (Plan-Set Precondition)

```javascript
// Pattern for checking all waves in a set are discussed
// Used within Bash in plan-set skill after loading state
const state = JSON.parse(stateJson);
const milestone = state.milestones.find(m => m.id === state.currentMilestone);
const set = milestone.sets.find(s => s.id === setId);
const waves = set.waves || [];

const pendingWaves = waves.filter(w => w.status === 'pending');
const discussingWaves = waves.filter(w => w.status === 'discussing');
const planningWaves = waves.filter(w => w.status === 'planning');

if (pendingWaves.length > 0) {
  console.error(`Cannot plan set: ${pendingWaves.length} wave(s) not yet discussed:`);
  pendingWaves.forEach(w => console.error(`  - ${w.id} (status: pending)`));
  console.error('Run /rapid:discuss for each undiscussed wave first.');
  process.exit(1);
}

// Smart re-entry: skip already-planned waves
const wavesToPlan = discussingWaves.map(w => w.id);
const alreadyPlanned = planningWaves.map(w => w.id);
```

### Example 2: Wave Analyzer RAPID:RETURN Parsing

```javascript
// Parse analyzer return from agent output
// Agent output contains: <!-- RAPID:RETURN {...} -->
const returnMatch = agentOutput.match(/<!-- RAPID:RETURN (.*?) -->/s);
if (!returnMatch) {
  // Fallback: treat all waves as sequential (safest default)
  return waves.map(w => [w.id]); // Each wave in its own batch
}
const analyzerResult = JSON.parse(returnMatch[1]);

// Convert dependency edges to planning batches using dag.cjs pattern
const nodes = waves.map(w => ({ id: w.id }));
const edges = (analyzerResult.dependencies || []).map(d => ({
  from: d.from,
  to: d.to,
}));

// Use BFS-level assignment (same algorithm as dag.cjs assignWaves)
const waveAssignment = assignWaves(nodes, edges);
// Group by level: { 1: ['wave-1'], 2: ['wave-2', 'wave-4'], 3: ['wave-3'] }
const batches = {};
for (const [waveId, level] of Object.entries(waveAssignment)) {
  if (!batches[level]) batches[level] = [];
  batches[level].push(waveId);
}
// Execute batches in order: batch 1 first, then batch 2 (parallel within batch), etc.
```

### Example 3: Execute Auto-Advance (Modified Step 3i)

```markdown
### Step 3i: Auto-advance after wave reconciliation

**If PASS:**
Print inline: "Wave {waveId}: PASS. Continuing to wave {nextWaveId}..."
Proceed directly to Step 3a for the next wave. No AskUserQuestion.

**If PASS_WITH_WARNINGS:**
Print inline summary: "Wave {waveId}: PASS_WITH_WARNINGS ({softBlocks.length} soft blocks). Continuing..."
Proceed directly to Step 3a for the next wave. No AskUserQuestion.

**If FAIL:**
Use AskUserQuestion:
- **question:** "Wave {waveId} reconciliation failed"
- **options:**
  - "Retry failed jobs" -- "Re-execute failed jobs in this wave"
  - "Cancel execution" -- "Save state and exit"

This is the ONLY per-wave gate remaining.
```

### Example 4: Wave Transition Banner

```javascript
// Recommended banner format between waves (Claude's discretion area)
// Uses existing renderBanner from display.cjs with minor extension
// Add 'plan-set' to STAGE_VERBS and STAGE_BG:

// In display.cjs:
const STAGE_VERBS = {
  // ... existing entries ...
  'plan-set': 'PLANNING SET',
};
const STAGE_BG = {
  // ... existing entries ...
  'plan-set': '\x1b[104m',  // bright blue (planning stage group)
};

// Usage in plan-set skill between waves:
// node "${RAPID_TOOLS}" display banner plan-set "Wave 2/3: wave-api-layer"
```

### Example 5: Agent Registration for Wave Analyzer

```javascript
// Add to rapid-tools.cjs ROLE_* maps:

// ROLE_TOOLS:
'wave-analyzer': 'Read, Grep, Glob',

// ROLE_COLORS:
'wave-analyzer': 'blue',

// ROLE_DESCRIPTIONS:
'wave-analyzer': 'RAPID wave analyzer agent -- determines wave dependencies via LLM analysis of wave contexts',

// ROLE_CORE_MAP:
'wave-analyzer': ['core-identity.md', 'core-returns.md', 'core-context-loading.md'],
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-wave manual `/rapid:wave-plan` invocation | `/rapid:plan-set` auto-chains all waves | Phase 31 | Reduces N manual commands to 1 |
| Per-wave AskUserQuestion on PASS/PASS_WITH_WARNINGS | Auto-advance for non-failure results | Phase 31 | Eliminates N-1 unnecessary approval gates |
| All waves planned sequentially | Independent waves planned in parallel | Phase 31 | Faster total planning time for sets with independent waves |

**Key architectural constraints (unchanged):**
- Skills cannot invoke other skills (Claude Code limitation)
- Subagents cannot spawn sub-subagents (Claude Code hard constraint)
- Claude Code has a ~5 concurrent subagent ceiling (noted in STATE.md blockers)
- STATE.json is lock-protected and schema-validated (no direct edits)

## Open Questions

1. **Parallel wave planning via single vs multi-agent approach**
   - What we know: Plan-set needs to plan multiple waves in a batch simultaneously. Each wave's pipeline is multi-step (research -> plan -> job-plans -> verify -> validate).
   - What's unclear: Should plan-set spawn one Agent per wave in the parallel batch (that agent runs the full pipeline internally), or should plan-set try to interleave agent spawns across waves?
   - Recommendation: One Agent per wave in parallel batch. The agent receives the full pipeline instructions and executes sequentially within its context. This is simpler and avoids cross-wave interleaving complexity. The plan-set skill spawns N agents in parallel (one per independent wave), waits for all to complete, then processes the next batch. This mirrors the execute skill's pattern of spawning parallel job-executor agents per wave.

2. **Wave analyzer for 2-wave sets (trivial case)**
   - What we know: Many sets may have only 2 waves. Spawning an analyzer agent for 2 waves is overhead.
   - What's unclear: Should there be a shortcut for small sets?
   - Recommendation: For sets with only 1 wave, skip the analyzer entirely (nothing to analyze). For 2 waves, still run the analyzer -- the LLM analysis is fast and may catch non-obvious dependencies. For 3+ waves, always run the analyzer. The overhead is one agent call (~30 seconds) which is negligible compared to the total planning time.

3. **How plan-set handles plan verifier FAIL mid-chain**
   - What we know: User decided "if any wave's planning fails and user cancels re-plan, the entire chain stops."
   - What's unclear: Exactly how the re-plan retry works within plan-set (does the full pipeline re-run for that wave, or just job planners + verifier?).
   - Recommendation: Follow the same pattern as wave-plan Step 5.5: re-plan only failing jobs, re-verify, then if second FAIL offer only override/cancel. If cancel, stop the entire chain. If override, continue to next wave.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node.js v25.8.0) |
| Config file | None -- uses `node --test` directly |
| Quick run command | `node --test src/lib/display.test.cjs` |
| Full suite command | `node --test src/lib/*.test.cjs src/bin/*.test.cjs` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WAVE-01 | Plan-set iterates waves, calls pipeline per wave | manual-only | N/A (skill is a markdown orchestrator -- test via integration) | N/A |
| WAVE-01 | Precondition: all waves must be in `discussing` state | unit | `node --test src/lib/state-transitions.test.cjs` | Existing (covers `discussing -> planning`) |
| WAVE-02 | Wave analyzer dependency detection | manual-only | N/A (LLM agent -- test via manual invocation) | N/A |
| WAVE-02 | Dependency graph to planning batches conversion | unit | `node --test src/lib/dag.test.cjs` | Existing (covers `assignWaves`) |
| WAVE-03 | Sequential planning with predecessor artifacts | manual-only | N/A (skill orchestration flow) | N/A |
| WAVE-04 | Execute auto-advance on PASS/PASS_WITH_WARNINGS | manual-only | N/A (skill modification -- test via manual execution) | N/A |
| WAVE-04 | --retry-wave flag parsing | unit | `node --test src/bin/rapid-tools.test.cjs` | Existing (test file exists, new test cases needed) |
| ALL | display.cjs plan-set stage entry | unit | `node --test src/lib/display.test.cjs` | Existing |
| ALL | build-agents includes wave-analyzer | unit | `node --test src/lib/build-agents.test.cjs` | Existing |

### Sampling Rate
- **Per task commit:** `node --test src/lib/display.test.cjs src/lib/dag.test.cjs`
- **Per wave merge:** `node --test src/lib/*.test.cjs src/bin/*.test.cjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test cases in `src/lib/display.test.cjs` for `plan-set` stage rendering
- [ ] New test cases in `src/lib/build-agents.test.cjs` for `wave-analyzer` agent registration
- [ ] Justification for manual-only: Skills (SKILL.md) are Markdown-based orchestration instructions executed by Claude Code, not programmatic functions. They cannot be unit tested -- they require full Claude Code invocation to exercise.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all referenced files (skill files, lib modules, role modules, agent files)
- `src/lib/dag.cjs` -- verified `toposort`, `assignWaves` function signatures and behavior
- `src/lib/state-transitions.cjs` -- verified wave transition map: `discussing -> planning` is valid
- `src/lib/state-schemas.cjs` -- verified WaveState, SetState Zod schemas
- `src/lib/display.cjs` -- verified `renderBanner`, `STAGE_VERBS`, `STAGE_BG` exports
- `src/bin/rapid-tools.cjs` -- verified `ROLE_TOOLS`, `ROLE_COLORS`, `ROLE_DESCRIPTIONS`, `ROLE_CORE_MAP` structures
- `skills/wave-plan/SKILL.md` -- verified full pipeline: Steps 1-7 (env, resolve, research, wave-plan, job-plans, verify, validate, commit)
- `skills/execute/SKILL.md` -- verified Step 3i approval gate structure, Step 2 smart re-entry pattern

### Secondary (MEDIUM confidence)
- STATE.md blocker note: "Claude Code 5-subagent parallelism ceiling (Phase 31) needs testing with 2 waves first" -- verified in project state

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries/modules already exist in the project, no new dependencies
- Architecture: HIGH -- follows established skill/agent/role-module patterns used by 17 existing skills
- Pitfalls: HIGH -- derived from direct codebase analysis and understanding of Claude Code constraints

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable internal project -- no external API changes expected)
