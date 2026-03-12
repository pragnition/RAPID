# Phase 35: Adaptive Conflict Resolution - Research

**Researched:** 2026-03-11
**Domain:** Merge pipeline subagent delegation -- conflict resolver agents for mid-confidence escalations
**Confidence:** HIGH

## Summary

Phase 35 adds a second tier of subagent delegation to the RAPID merge pipeline. Currently, when a rapid-set-merger returns escalations (conflicts with confidence below 0.7), they go directly to the human via AskUserQuestion in Step 3e. This phase introduces rapid-conflict-resolver agents that intercept escalations in the 0.3-0.8 confidence band before they reach the human, performing deeper analysis with full file history and cross-set context. Conflicts below 0.3 or involving API-signature changes bypass the resolver entirely and go straight to a human decision gate.

The implementation touches four files: a new role module (`role-conflict-resolver.md`), the merge SKILL.md (Step 3e rewrite), the MergeStateSchema in `merge.cjs` (agentPhase2 shape change from enum to object map), and the build-agents infrastructure (new role registration). The pattern closely mirrors Phase 34's set-merger delegation -- dispatch agent, collect RAPID:RETURN, route based on result -- but operates per-conflict rather than per-set, with parallel dispatch.

**Primary recommendation:** Follow the Phase 34 dispatch-collect pattern exactly. The resolver is a leaf agent (cannot spawn sub-subagents) that reads deeper context, tries multiple resolution strategies, applies the best one directly to the worktree, and returns a structured RAPID:RETURN. The orchestrator routes based on resolver confidence: >= 0.7 auto-accept, < 0.7 escalate to human with the resolver's deeper analysis attached.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Confidence band routing:** Lower bound 0.3 (hard cutoff), upper bound 0.8 (raised from 0.7). Resolver band: 0.3-0.8. API-signature changes always go to human regardless of confidence (API rule wins over confidence band). Human direction gate for API conflicts: user sees "Keep Set A / Keep Set B / Merge both" -- system executes chosen direction automatically.
- **Resolver agent behavior:** One agent per conflict (not batched) -- single conflict focus, parallelizable. New role module: `role-conflict-resolver.md`. Deeper analysis: reads full file history, both sets' CONTEXT.md/plans, cross-set contract implications. Multiple resolution strategies: tries 2-3 approaches, scores each, picks best. Applies resolution directly to worktree (not propose-only). Returns structured RAPID:RETURN with resolution details and confidence score.
- **Resolution acceptance:** Auto-accept threshold: 0.7. Below 0.7: escalate to human with resolver's deeper analysis + proposed resolution. Human presentation: show diff of proposed code change + options (Accept / Reject / Edit manually). If resolver fails or returns BLOCKED: escalate to human immediately (no retry).
- **Parallelism & state tracking:** Multiple resolvers run in parallel for the same set. agentPhase2 enum values: idle / spawned / done / failed (same pattern as agentPhase1). agentPhase2 shape: object map `{ [conflictId]: 'idle'|'spawned'|'done'|'failed' }` -- tracks each conflict independently. No retry for failed resolvers.

### Claude's Discretion
- Exact role-conflict-resolver.md prompt structure and analysis instructions
- How conflict IDs are generated (file path hash, sequential, etc.)
- Resolver's RAPID:RETURN data schema (fields for resolution strategies tried, selected strategy, confidence)
- How "show diff" is presented to the user (inline code block, file reference, etc.)
- Whether to run the programmatic gate after resolver applies changes
- Exact SKILL.md Step 3e restructuring flow

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MERGE-06 | When merger returns mid-confidence escalations (0.4-0.7), orchestrator spawns rapid-conflict-resolver agents per conflict for deeper analysis | Full routing logic documented: escalations from set-merger return data are filtered by confidence band (0.3-0.8 per CONTEXT.md updated bounds) and API-signature flag, then dispatched to per-conflict resolver agents. Schema change (agentPhase2 to object map), new role module, SKILL.md Step 3e rewrite, and build-agents registration all documented. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^3.25.76 | Schema validation for agentPhase2 object map | Already used throughout merge.cjs for MergeStateSchema |
| Node.js test runner | built-in | Unit tests for schema changes and routing logic | Established pattern in merge.test.cjs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| returns.cjs | internal | parseReturn() for resolver RAPID:RETURN parsing | Parsing resolver agent output |
| merge.cjs | internal | updateMergeState(), readMergeState(), applyAgentResolutions() | State tracking and resolution application |

### Alternatives Considered
None -- this phase uses only existing project infrastructure. No new external dependencies needed.

## Architecture Patterns

### Recommended File Changes
```
src/
  modules/
    roles/
      role-conflict-resolver.md   # NEW: resolver agent role definition
  lib/
    merge.cjs                     # MODIFIED: agentPhase2 schema change (enum -> object map)
    merge.test.cjs                # MODIFIED: tests for new schema + routing helpers
  bin/
    rapid-tools.cjs               # MODIFIED: build-agents registration + update-status CLI extension
agents/
  rapid-conflict-resolver.md      # NEW: generated by build-agents
skills/
  merge/
    SKILL.md                      # MODIFIED: Step 3e rewrite with routing logic
```

### Pattern 1: Dispatch-Collect (from Phase 34)
**What:** Orchestrator spawns an agent, collects its RAPID:RETURN, and routes based on the result.
**When to use:** Any time work needs delegation to a focused subagent.
**How Phase 35 adapts it:** Instead of one agent per set, Phase 35 dispatches one agent per conflict (potentially multiple per set, in parallel). The routing is simpler (no CHECKPOINT retry -- resolver failures go straight to human).

**Existing pattern in SKILL.md Step 3c-3d:**
```
1. Update status (spawned)
2. Prepare context (launch briefing)
3. Spawn agent with Agent tool
4. Parse RAPID:RETURN
5. Route based on status (COMPLETE/CHECKPOINT/BLOCKED)
6. Update status (done/failed)
```

**Phase 35 adaptation for Step 3e:**
```
1. Filter escalations from set-merger return
2. Classify each: API-signature -> human gate, confidence < 0.3 -> human gate, 0.3-0.8 -> resolver
3. Update agentPhase2[conflictId] = 'spawned' for each resolver-bound conflict
4. Spawn all resolver agents in parallel (Agent tool x N)
5. Collect returns, parse each
6. Route: resolver confidence >= 0.7 -> auto-accept, < 0.7 -> human with analysis, BLOCKED -> human
7. Update agentPhase2[conflictId] = 'done'/'failed'
8. Present remaining human-bound conflicts via AskUserQuestion
```

### Pattern 2: Per-Conflict Object Map State Tracking
**What:** agentPhase2 changes from a single enum to `{ [conflictId]: 'idle'|'spawned'|'done'|'failed' }`.
**When to use:** When tracking lifecycle state for multiple parallel items within a single set.
**Schema change:**

```javascript
// BEFORE (Phase 33 -- single enum):
agentPhase2: AgentPhaseEnum.optional(),  // z.enum(['idle', 'spawned', 'done', 'failed'])

// AFTER (Phase 35 -- per-conflict map):
agentPhase2: z.record(z.string(), AgentPhaseEnum).optional(),
```

**Backward compatibility:** The field was previously optional and only tested with enum values. The change from `AgentPhaseEnum.optional()` to `z.record(z.string(), AgentPhaseEnum).optional()` breaks existing tests that pass a bare string. Existing tests must be updated. Since agentPhase2 has never been used in production (Phase 35 is its first real consumer), this is safe.

### Pattern 3: Conflict ID Generation
**What:** Each escalation needs a unique ID for agentPhase2 tracking.
**Recommendation:** Use the file path as the conflict ID since escalations are per-file and the set-merger already returns `file` in the escalation object. If a file has multiple escalations (unlikely but possible), append a sequential suffix: `src/lib/merge.cjs:1`, `src/lib/merge.cjs:2`.

```javascript
function generateConflictId(escalation, index) {
  return escalation.file || `conflict-${index}`;
}
```

### Pattern 4: API-Signature Detection for Routing
**What:** Escalations involving API-signature changes must bypass the resolver and go directly to human.
**How to detect:** Check the set-merger's return data. The set-merger's T4 escalation rules already state: "If a resolution would change API signatures, public exports, or observable behavior beyond what either set intended, escalate rather than apply." The escalation's `reason` field indicates why it was escalated. Check for API-related keywords in the reason field OR cross-reference with L4 API detection results from MERGE-STATE.

**Recommended approach:** Cross-reference escalation file paths against L4 API conflict detection results stored in MERGE-STATE.json `detection.api.conflicts[]`. If the escalated file appears in L4 API conflicts, route to human. This is more reliable than keyword matching on the reason string.

```javascript
function isApiSignatureConflict(escalation, mergeState) {
  const apiConflicts = mergeState?.detection?.api?.conflicts || [];
  return apiConflicts.some(c => c.file === escalation.file);
}
```

### Anti-Patterns to Avoid
- **Batching conflicts into a single resolver:** User locked "one agent per conflict" -- each conflict gets its own focused agent. This enables parallelism and prevents cross-contamination of analysis.
- **Retry on resolver failure:** User locked "no retry for failed resolvers" -- they are already a second pass. If even focused deep analysis cannot resolve, escalate to human immediately.
- **Proposing without applying:** User locked "resolver applies its resolution directly to the worktree" -- the resolver is not propose-only. It edits files and returns what it did.
- **Sequential resolver dispatch:** Multiple resolvers should run in parallel since conflicts are independent. Use multiple Agent tool calls in a single response.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RAPID:RETURN parsing | Custom regex for resolver output | `returns.parseReturn()` + merge-specific wrapper | Handles edge cases (unclosed markers, invalid JSON, missing status) |
| Agent phase tracking | Custom file-based tracking | `merge.updateMergeState()` with agentPhase2 object | Zod-validated, backward-compatible, supports partial updates |
| Resolution confidence routing | Inline threshold checks scattered in SKILL.md | `applyAgentResolutions()` with configurable threshold | Already handles T3/T4 categorization with confidence threshold |
| Launch briefing assembly | Manual string concatenation | Pattern from `prepareMergerContext()` -- create analogous `prepareResolverContext()` | Consistent format, truncation handling, reference paths |

**Key insight:** The resolver follows the same agent lifecycle as the set-merger. Reuse the dispatch-collect pattern, return parsing, and state tracking infrastructure -- only the context assembly, role prompt, and routing logic are new.

## Common Pitfalls

### Pitfall 1: Worktree Conflicts Between Parallel Resolvers
**What goes wrong:** Multiple resolver agents running in parallel on the same set may both try to edit overlapping regions of the same file, causing write conflicts.
**Why it happens:** Resolvers apply changes directly to the worktree. If two escalations involve the same file (e.g., different functions in `merge.cjs`), their edits could collide.
**How to avoid:** Escalations are per-file and the set-merger escalates at file granularity. If two escalations share the same file, they should be serialized rather than parallelized. Group escalations by file and serialize within-file, parallelize across files.
**Warning signs:** File write errors, corrupted edits, or "file changed since read" errors from resolver agents.

### Pitfall 2: agentPhase2 Schema Migration Breaking Existing Tests
**What goes wrong:** Changing agentPhase2 from `AgentPhaseEnum.optional()` to `z.record(z.string(), AgentPhaseEnum).optional()` causes existing tests that pass a bare string (e.g., `agentPhase2: 'done'`) to fail Zod validation.
**Why it happens:** Zod `z.record()` expects an object, not a string.
**How to avoid:** Update all existing agentPhase2 tests in merge.test.cjs simultaneously with the schema change. The tests at lines 1722-1756 and 1830-1843 need to change from `agentPhase2: 'done'` to `agentPhase2: { 'conflict-1': 'done' }`.
**Warning signs:** Test failures immediately after schema change.

### Pitfall 3: Resolver Applying Changes to Wrong Worktree Path
**What goes wrong:** Resolver agent edits files relative to project root instead of the set's worktree path.
**Why it happens:** The resolver is spawned by the orchestrator, which operates at project root. If the worktree path is not explicitly passed and enforced, the resolver's file edits land in the wrong location.
**How to avoid:** The launch briefing MUST include the worktree path, and the resolver role instructions MUST mandate `cd` to worktree before any file operations. This is already the established pattern in `core-identity.md`.
**Warning signs:** Files modified at project root, resolver returning BLOCKED because target file not found.

### Pitfall 4: Missing Gate Re-run After Resolver Applies Changes
**What goes wrong:** Resolver applies code changes to the worktree, but the programmatic gate is not re-run after resolver edits. The gate result from the set-merger's initial run may be stale.
**Why it happens:** The programmatic gate was already run by the set-merger (Step 3 in set-merger). After the resolver modifies files, the gate result may no longer be valid.
**How to avoid:** Re-run the programmatic gate after all resolvers complete and before proceeding to Step 6 (merge execute). The CONTEXT.md lists this as Claude's discretion -- recommend running it.
**Warning signs:** Merge passes but integration tests fail due to issues the gate would have caught.

### Pitfall 5: Forgetting to Register New Agent in build-agents
**What goes wrong:** `role-conflict-resolver.md` exists but `agents/rapid-conflict-resolver.md` is never generated because the role is not registered in `handleBuildAgents()`.
**Why it happens:** Four registration maps must be updated in rapid-tools.cjs: `ROLE_TOOLS`, `ROLE_COLORS`, `ROLE_DESCRIPTIONS`, and `ROLE_CORE_MAP`.
**How to avoid:** Add entries to all four maps. Verify by running `node ~/Projects/RAPID/src/bin/rapid-tools.cjs build-agents` and confirming `agents/rapid-conflict-resolver.md` is generated.
**Warning signs:** Agent tool call fails with "agent not found" or "no such agent."

## Code Examples

### Example 1: agentPhase2 Schema Change

```javascript
// Source: Derived from existing merge.cjs line 40-41, 116
// Current schema (Phase 33):
const AgentPhaseEnum = z.enum(['idle', 'spawned', 'done', 'failed']);
// agentPhase2: AgentPhaseEnum.optional(),

// Phase 35 replacement:
// agentPhase2 becomes a per-conflict map
agentPhase2: z.record(z.string(), AgentPhaseEnum).optional(),
// Example value: { "src/lib/auth.cjs": "spawned", "src/lib/db.cjs": "done" }
```

### Example 2: Escalation Routing Logic (Step 3e)

```javascript
// Pseudocode for SKILL.md Step 3e routing
// Source: Derived from CONTEXT.md decisions + existing SKILL.md Step 3e

function routeEscalation(escalation, mergeState) {
  const isApiConflict = isApiSignatureConflict(escalation, mergeState);

  if (isApiConflict) {
    return 'human-api-gate';  // "Keep Set A / Keep Set B / Merge both"
  }

  if (escalation.confidence < 0.3) {
    return 'human-direct';    // Too low for any automated resolution
  }

  if (escalation.confidence <= 0.8) {
    return 'resolver-agent';  // Dispatch rapid-conflict-resolver
  }

  // confidence > 0.8 should not reach here (set-merger auto-applies >= 0.7)
  // but if it does, auto-accept
  return 'auto-accept';
}
```

### Example 3: Resolver RAPID:RETURN Schema

```javascript
// Source: Derived from set-merger return schema + CONTEXT.md requirements

// Resolver returns for a single conflict:
// <!-- RAPID:RETURN {"status":"COMPLETE","data":{
//   "conflict_id": "src/lib/auth.cjs",
//   "strategies_tried": [
//     {"approach": "preserve-both", "confidence": 0.45, "reason": "semantic overlap too deep"},
//     {"approach": "prioritize-set-a", "confidence": 0.72, "reason": "set A's intent is primary"},
//     {"approach": "hybrid-merge", "confidence": 0.81, "reason": "combines both sets' key changes"}
//   ],
//   "selected_strategy": "hybrid-merge",
//   "resolution_summary": "Combined set A's auth middleware changes with set B's error handling",
//   "confidence": 0.81,
//   "files_modified": ["src/lib/auth.cjs"],
//   "applied": true
// }} -->

// Or if blocked:
// <!-- RAPID:RETURN {"status":"BLOCKED","reason":"Cannot resolve: both sets fundamentally change the return type contract"} -->
```

### Example 4: build-agents Registration

```javascript
// Source: rapid-tools.cjs lines 460-598
// Add to all four maps:

// ROLE_TOOLS:
'conflict-resolver': 'Read, Write, Edit, Bash, Grep, Glob',

// ROLE_COLORS:
'conflict-resolver': 'yellow',  // distinct from green (merger) and red (reviewer)

// ROLE_DESCRIPTIONS:
'conflict-resolver': 'RAPID conflict resolver agent -- deep analysis and resolution of mid-confidence merge conflicts',

// ROLE_CORE_MAP:
'conflict-resolver': ['core-identity.md', 'core-returns.md', 'core-git.md'],
```

### Example 5: Update-Status CLI Extension for agentPhase2

```javascript
// Source: rapid-tools.cjs lines 2350-2400
// Extend update-status to support --agent-phase2 flag with per-conflict tracking

// New flag: --agent-phase2 <conflictId> <phase>
// Usage: node "${RAPID_TOOLS}" merge update-status {setName} resolving --agent-phase2 src/lib/auth.cjs spawned
// This updates agentPhase2 object map: { "src/lib/auth.cjs": "spawned" }
```

### Example 6: Parallel Resolver Dispatch in SKILL.md

```
// SKILL.md Step 3e pattern -- dispatch all resolver-bound conflicts in parallel:
//
// For each escalation classified as 'resolver-agent':
//   1. Update agentPhase2[conflictId] = 'spawned'
//   2. Prepare resolver context (launch briefing with conflict details)
//   3. Spawn rapid-conflict-resolver agent
//
// ALL Agent tool calls happen in the same response (parallel dispatch).
// Then collect all returns and route each result.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All T4 escalations go to human (Step 3e) | Resolver agents handle 0.3-0.8 band, only hard cases reach human | Phase 35 | Reduces human interruptions, provides deeper analysis on mid-confidence conflicts |
| agentPhase2 is a single enum | agentPhase2 is per-conflict object map | Phase 35 | Enables tracking multiple resolver agents per set independently |
| Set-merger upper threshold 0.7 | Resolver covers up to 0.8 (second opinion on set-merger's marginal calls) | Phase 35 | More conflicts get automated resolution |

**Key context change from REQUIREMENTS.md vs CONTEXT.md:**
- REQUIREMENTS.md (MERGE-06) specifies confidence band 0.4-0.7
- CONTEXT.md (user's discuss session) updated to 0.3-0.8
- CONTEXT.md decisions override REQUIREMENTS.md -- use 0.3-0.8

## Open Questions

1. **Should the programmatic gate re-run after resolvers apply changes?**
   - What we know: The set-merger already runs the gate (Step 3 in its pipeline). After resolvers modify files, the gate result may be stale. CONTEXT.md lists this as Claude's discretion.
   - Recommendation: YES -- re-run the gate after all resolvers complete and before Step 6 (merge execute). This adds one CLI call but catches issues introduced by resolver edits. The gate is fast (runs existing tests + linting).

2. **How to handle same-file escalations in parallel?**
   - What we know: If two escalations involve the same file, parallel resolvers could produce conflicting edits.
   - What's unclear: How often this occurs in practice.
   - Recommendation: Group escalations by file. If a file has multiple escalations, dispatch them sequentially (or combine into a single resolver dispatch for that file). Parallelize only across different files.

3. **What context does the resolver's launch briefing include?**
   - What we know: CONTEXT.md says "reads full file history, both sets' CONTEXT.md/plans, cross-set contract implications" -- this is deeper than the set-merger's context.
   - Recommendation: Create a `prepareResolverContext()` helper in merge.cjs that assembles: (a) the specific conflict details from the escalation, (b) the set-merger's original analysis/reasoning, (c) paths to both sets' CONTEXT.md files, (d) the file's git log (recent commits), (e) any related L4 API detection data. The resolver reads these files itself; the briefing just provides paths and context pointers.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) |
| Config file | None -- uses `node --test` directly |
| Quick run command | `node --test --test-name-pattern="agentPhase2" src/lib/merge.test.cjs` |
| Full suite command | `node --test src/lib/merge.test.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MERGE-06-schema | agentPhase2 accepts object map `{conflictId: phase}` | unit | `node --test --test-name-pattern="agentPhase2.*map" src/lib/merge.test.cjs` | Needs update (existing tests use enum) |
| MERGE-06-routing | Escalations routed correctly by confidence + API flag | unit | `node --test --test-name-pattern="routeEscalation" src/lib/merge.test.cjs` | New |
| MERGE-06-resolver-context | prepareResolverContext() produces correct launch briefing | unit | `node --test --test-name-pattern="prepareResolverContext" src/lib/merge.test.cjs` | New |
| MERGE-06-resolver-parse | parseConflictResolverReturn() handles COMPLETE/BLOCKED/malformed | unit | `node --test --test-name-pattern="parseConflictResolverReturn" src/lib/merge.test.cjs` | New |
| MERGE-06-api-check | isApiSignatureConflict() correctly detects API conflicts | unit | `node --test --test-name-pattern="isApiSignatureConflict" src/lib/merge.test.cjs` | New |
| MERGE-06-conflict-id | Conflict ID generation from escalation data | unit | `node --test --test-name-pattern="generateConflictId" src/lib/merge.test.cjs` | New |
| MERGE-06-build-agents | build-agents generates rapid-conflict-resolver.md | smoke | `node ~/Projects/RAPID/src/bin/rapid-tools.cjs build-agents && test -f agents/rapid-conflict-resolver.md` | New |
| MERGE-06-skill-flow | Step 3e in SKILL.md references correct routing and dispatch pattern | manual-only | N/A -- SKILL.md is a markdown prompt, not executable code | N/A |

### Sampling Rate
- **Per task commit:** `node --test --test-name-pattern="agentPhase2\|resolver\|routeEscalation\|isApiSignature\|generateConflictId" src/lib/merge.test.cjs`
- **Per wave merge:** `node --test src/lib/merge.test.cjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Update existing agentPhase2 tests (lines 1722-1756, 1830-1843) to use object map shape instead of enum string
- [ ] Add new test group: `routeEscalation` -- tests for confidence band + API-signature routing
- [ ] Add new test group: `prepareResolverContext` -- tests for resolver launch briefing assembly
- [ ] Add new test group: `parseConflictResolverReturn` -- tests for resolver return parsing
- [ ] Add new test group: `isApiSignatureConflict` -- tests for API detection cross-reference
- [ ] Add new test group: `generateConflictId` -- tests for conflict ID generation

## Sources

### Primary (HIGH confidence)
- `src/lib/merge.cjs` -- MergeStateSchema (line 42-141), agentPhase2 (line 116), compressResult (line 205), parseSetMergerReturn (line 239), prepareMergerContext (line 282), applyAgentResolutions (line 1698)
- `src/lib/merge.test.cjs` -- Existing agentPhase2 tests (lines 1722-1843)
- `src/lib/returns.cjs` -- parseReturn(), RAPID:RETURN protocol
- `skills/merge/SKILL.md` -- Full orchestrator flow, Step 3e current implementation (lines 239-258)
- `src/modules/roles/role-set-merger.md` -- Set-merger role prompt, escalation data schema, T4 escalation rules
- `src/bin/rapid-tools.cjs` -- build-agents registration (lines 450-599), update-status CLI (lines 2350-2400)

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` -- Original architecture design showing Phase 2 (resolver) data flow (lines 370-389)
- `.planning/ROADMAP.md` -- Phase 35 success criteria (lines 73-81)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all infrastructure already exists, no new dependencies
- Architecture: HIGH -- follows established Phase 34 dispatch-collect pattern, all integration points verified in source
- Pitfalls: HIGH -- identified from actual code analysis (schema migration, worktree paths, parallel edit conflicts, build-agents registration)

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable -- this is internal infrastructure, not external dependency)
