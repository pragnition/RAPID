# Phase 33: Merge State Schema & Infrastructure - Research

**Researched:** 2026-03-10
**Domain:** Zod schema extension, pure function design, RAPID:RETURN protocol, token budget estimation
**Confidence:** HIGH

## Summary

Phase 33 extends the existing MERGE-STATE.json Zod schema with two optional `agentPhase` tracking fields and adds three new pure functions to `merge.cjs`: `prepareMergerContext()` for assembling a launch briefing payload, `parseSetMergerReturn()` for validating merge subagent RAPID:RETURN results with default-to-BLOCKED safety, and `compressResult()` for producing compact JSON status entries. All changes are backward-compatible -- existing v2.1 MERGE-STATE.json files must validate without errors against the extended schema.

The codebase is well-established with clear patterns: Zod `z.object().optional()` for backward-compatible extensions, pure functions for testability, node:test with `assert/strict` for unit tests, and the RAPID:RETURN protocol (`<!-- RAPID:RETURN {...} -->`) parsed by `returns.cjs`. The implementation is infrastructure-only -- actual subagent dispatching is Phase 34.

**Primary recommendation:** Extend MergeStateSchema in merge.cjs with two optional enum fields and a compressedResult field, add three pure exported functions, and add comprehensive tests following the existing merge.test.cjs patterns.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **agentPhase tracking fields**: agentPhase1 (per-set merger) and agentPhase2 (per-conflict resolver) are simple status enums, not objects. agentPhase1 values: `idle` / `spawned` / `done` / `failed` -- 4-state minimal lifecycle. agentPhase2 values: same enum pattern, to be refined in Phase 35. Both fields are nested inside the 'resolving' main status -- they only have meaning when status='resolving'. Both fields are `.optional()` in Zod for backward compatibility -- user manages migration of existing files.
- **Context assembly (prepareMergerContext)**: Pure function: takes structured data as input, returns assembled string -- caller responsible for loading. Token budget: 1000 tokens (increased from original 500) -- 8 sets = ~8K orchestrator context. Payload style: file path pointers + 1-2 line inline summaries per file (e.g., "CONTRACT.json (3 interfaces, 2 with changes)"). Subagent reads full file details itself from worktree -- payload is a launch briefing, not complete context.
- **Compressed result format (compressResult)**: Structured JSON object: `{ setId, status, conflictCounts: { L1, L2, L3, L4, L5 }, resolutionCounts: { T1, T2, T3, escalated }, commitSha }`. Retains per-level detection counts and per-tier resolution counts -- enough for the final summary table in SKILL.md Step 8. Token estimation: heuristic `JSON.stringify(result).length / 4` -- simple chars/4 approximation. Target: ~100 tokens per set, verified against 8-set budget (~800 tokens total). Persisted: compressed result written to MERGE-STATE.json as a `compressedResult` field, in addition to orchestrator in-memory retention -- enables mid-pipeline restart.
- **Return validation (parseSetMergerReturn)**: Uses generic RAPID:RETURN parsing (existing `parseReturn()`) for the wrapper, then loose checks on `data.semantic_conflicts`, `data.resolutions`, `data.escalations` -- not a strict merge-specific Zod schema. Default-to-BLOCKED: missing or malformed returns produce `{ status: 'BLOCKED', reason: '<error description>' }` -- error reason only, no raw output excerpt. CHECKPOINT is treated as a valid intermediate state -- allows merger to save progress if it runs out of context on large sets. File location: Claude's discretion (merge.cjs or returns.cjs based on module cohesion).

### Claude's Discretion

- Exact agentPhase2 enum values (refined when Phase 35 requirements are clearer)
- Whether parseSetMergerReturn() lives in merge.cjs or returns.cjs
- Internal structure of the 1000-token launch payload template
- Exact fields in the compressedResult JSON shape
- Test structure and coverage for the three helper functions

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MERGE-04 | MERGE-STATE updated before spawning subagent (resolving) and after return (next status) for idempotent re-entry | Schema extension with agentPhase1/agentPhase2 optional enum fields enables tracking subagent lifecycle within the 'resolving' status. Existing `updateMergeState()` handles partial updates. |
| MERGE-05 | Orchestrator retains only compressed one-line status per completed set (~100 tokens), discarding full detection/resolution context | `compressResult()` function produces a compact JSON object with conflict/resolution counts + commitSha. Token estimation via `JSON.stringify().length / 4`. The `compressedResult` field in MERGE-STATE.json enables restart without re-reading full state. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 3.25.76 | Schema validation for MERGE-STATE.json and return parsing | Already used throughout RAPID -- MergeStateSchema, ReturnSchemas, state-schemas.cjs |
| node:test | Built-in (Node 25.8) | Unit test framework | Established pattern -- merge.test.cjs has 64 passing tests |
| node:assert/strict | Built-in | Assertions | Used in all existing RAPID tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:fs | Built-in | File I/O for MERGE-STATE.json read/write | Already used by readMergeState/writeMergeState |
| node:path | Built-in | Path resolution | Already used throughout merge.cjs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zod loose checks for return | Strict Zod discriminated union | User locked "loose checks" -- strict schema would reject valid agent variations; loose checks with default-to-BLOCKED is safer |
| JSON compressed result | Single-line string | JSON is parseable and can be directly used as input to Step 8 summary table; string would need re-parsing |

**Installation:**
No new dependencies needed. All required libraries are already in place.

## Architecture Patterns

### Existing Module Structure (merge.cjs)
```
src/lib/merge.cjs            # ~1600 lines, extends with 3 new functions
src/lib/returns.cjs           # 289 lines, parseReturn() + validateHandoff()
src/lib/state-schemas.cjs     # 60 lines, project state schemas (separate from merge)
src/lib/merge.test.cjs        # ~1745 lines, 64 tests, extends with new test suites
```

### Schema Extension Pattern
```
MergeStateSchema = z.object({
  // existing fields...
  status: z.enum([...]),
  detection: z.object({...}).optional(),
  resolution: z.object({...}).optional(),
  bisection: z.object({...}).optional(),

  // NEW Phase 33 fields (all .optional() for backward compatibility)
  agentPhase1: z.enum(['idle', 'spawned', 'done', 'failed']).optional(),
  agentPhase2: z.enum(['idle', 'spawned', 'done', 'failed']).optional(),
  compressedResult: z.object({...}).optional(),
});
```

### Pattern 1: Backward-Compatible Schema Extension
**What:** Add new `.optional()` fields to an existing Zod schema. Existing JSON files that lack these fields continue to validate without errors.
**When to use:** Every schema extension in RAPID that must not break existing state files.
**Example:**
```javascript
// Existing pattern from merge.cjs (lines 50-109)
const MergeStateSchema = z.object({
  setId: z.string(),
  status: z.enum([...]),
  startedAt: z.string().optional(),     // optional since v2.0
  detection: z.object({...}).optional(), // optional since v2.0
  // Each sub-section is independently optional
});

// Extension pattern: add at same level as detection/resolution/bisection
// agentPhase1 and agentPhase2 are top-level optional fields
```

### Pattern 2: Pure Function Design
**What:** Functions take structured data as input, return structured data, with no side effects (no file I/O, no git calls).
**When to use:** All three new functions. The caller (`/rapid:merge` skill) handles loading data and persisting results.
**Example:**
```javascript
// Existing pattern from contract.cjs
function compileContract(definition) {
  // pure: takes object, returns object
  return { exports: {...}, imports: {...} };
}

// New functions follow same pattern:
// prepareMergerContext(structuredData) -> string
// parseSetMergerReturn(agentOutput) -> { status, data? }
// compressResult(mergeState) -> compressedResultObject
```

### Pattern 3: Default-to-BLOCKED Safety
**What:** When parsing agent returns, any failure mode (missing marker, malformed JSON, unexpected structure) defaults to BLOCKED status with descriptive reason.
**When to use:** `parseSetMergerReturn()` -- ensures the orchestrator never silently proceeds on bad data.
**Example:**
```javascript
// Wraps existing parseReturn() from returns.cjs
function parseSetMergerReturn(agentOutput) {
  const result = parseReturn(agentOutput);
  if (!result.parsed) {
    return { status: 'BLOCKED', reason: result.error };
  }
  // loose checks on data fields...
  if (!result.data.status) {
    return { status: 'BLOCKED', reason: 'Missing status field in return data' };
  }
  // CHECKPOINT is valid intermediate state
  if (result.data.status === 'CHECKPOINT') {
    return { status: 'CHECKPOINT', data: result.data };
  }
  return { status: result.data.status, data: result.data };
}
```

### Anti-Patterns to Avoid
- **Deep nesting for agentPhase fields:** User explicitly decided these are simple enums at the top level of MergeStateSchema, NOT nested objects with timestamps/metadata. Keep them flat.
- **Strict Zod schema for return validation:** User locked "loose checks" -- do not create a discriminated union or strict field validation for the merge-specific return data. Use `parseReturn()` + property existence checks.
- **Including full file contents in prepareMergerContext payload:** The payload is a "launch briefing" with pointers, NOT a context dump. The subagent reads full files itself from the worktree.
- **Token counting with a real tokenizer:** User locked `JSON.stringify(result).length / 4` as the heuristic. Do not import tiktoken or any tokenizer library.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RAPID:RETURN parsing | Custom marker regex | `returns.cjs` `parseReturn()` | Already handles edge cases (missing marker, unclosed marker, invalid JSON) |
| Zod schema validation | Manual field checking | `MergeStateSchema.parse()` / `.safeParse()` | Existing pattern, provides structured error messages |
| State file I/O | Direct fs.read/write with manual path construction | `readMergeState()` / `writeMergeState()` / `updateMergeState()` | Already handle directory creation, validation, ISO timestamps |
| JSON serialization for compressed results | Custom format | `JSON.stringify()` | Standard, parseable, predictable token count |

**Key insight:** The three new functions are thin wrappers around existing infrastructure. `parseSetMergerReturn()` wraps `parseReturn()` with loose checks and BLOCKED default. `prepareMergerContext()` is a template string assembler. `compressResult()` is a field extractor/summarizer. None require new libraries or complex logic.

## Common Pitfalls

### Pitfall 1: Schema Validation Breaks on Existing Files
**What goes wrong:** Adding required fields to MergeStateSchema causes `readMergeState()` to throw on existing v2.1 MERGE-STATE.json files that lack `agentPhase1`/`agentPhase2`/`compressedResult`.
**Why it happens:** Using `z.string()` instead of `z.string().optional()` for new fields.
**How to avoid:** Every new field MUST use `.optional()`. Test by parsing a minimal v2.1-era state object (just `setId`, `status`, `lastUpdatedAt`) against the new schema.
**Warning signs:** `readMergeState()` returns null where it previously returned valid state.

### Pitfall 2: Token Budget Overflow in prepareMergerContext
**What goes wrong:** Including too much detail (full file contents, full conflict descriptions) in the payload causes it to exceed 1000 tokens, which at 8 sets means >8K orchestrator context.
**Why it happens:** Treating the payload as a context dump instead of a launch briefing.
**How to avoid:** Use file path pointers with 1-2 line summaries. Validate with the `JSON.stringify().length / 4` heuristic in tests.
**Warning signs:** Test shows token estimate > 1000 for a typical set with 5-10 files.

### Pitfall 3: Swallowing CHECKPOINT Status
**What goes wrong:** `parseSetMergerReturn()` treats CHECKPOINT as an error and defaults to BLOCKED.
**Why it happens:** Only checking for COMPLETE status and treating everything else as failure.
**How to avoid:** Explicitly handle CHECKPOINT as a valid intermediate state. The merger subagent may return CHECKPOINT when it runs out of context on large sets and needs to save progress.
**Warning signs:** Large sets always show BLOCKED even though the merger returned CHECKPOINT with partial progress.

### Pitfall 4: compressResult Token Estimate Exceeding Budget
**What goes wrong:** The compressed result JSON object exceeds ~100 tokens (400 characters) per set.
**Why it happens:** Including string descriptions, arrays, or nested objects beyond the specified shape.
**How to avoid:** Stick to the locked shape: `{ setId, status, conflictCounts: { L1, L2, L3, L4, L5 }, resolutionCounts: { T1, T2, T3, escalated }, commitSha }`. This is mostly small integers and short strings.
**Warning signs:** `JSON.stringify(compressed).length / 4` exceeds 120 for a typical set.

### Pitfall 5: Shallow Merge Losing Nested State
**What goes wrong:** `updateMergeState()` uses spread (`{ ...current, ...updates }`) which only does shallow merge. If `compressedResult` is updated, it replaces the entire object correctly (fine). But if someone tries to partially update `detection` or `resolution` via updates, the nested object is replaced wholesale.
**Why it happens:** This is an existing behavior of `updateMergeState()`, not a new issue.
**How to avoid:** Document that `compressedResult` should always be written as a complete object, never partially updated. This matches the existing pattern for `detection` and `resolution`.
**Warning signs:** Test for `updateMergeState` with compressedResult shows fields unexpectedly missing.

## Code Examples

Verified patterns from existing codebase:

### MergeStateSchema Extension (adding optional fields)
```javascript
// Source: merge.cjs lines 38-111 (existing pattern)
// New fields follow the same .optional() pattern as detection/resolution/bisection

const AgentPhaseEnum = z.enum(['idle', 'spawned', 'done', 'failed']);

// Added to MergeStateSchema z.object():
//   agentPhase1: AgentPhaseEnum.optional(),
//   agentPhase2: AgentPhaseEnum.optional(),
//   compressedResult: z.object({
//     setId: z.string(),
//     status: z.string(),
//     conflictCounts: z.object({
//       L1: z.number(), L2: z.number(), L3: z.number(), L4: z.number(), L5: z.number(),
//     }),
//     resolutionCounts: z.object({
//       T1: z.number(), T2: z.number(), T3: z.number(), escalated: z.number(),
//     }),
//     commitSha: z.string().optional(),
//   }).optional(),
```

### parseReturn() Usage (from returns.cjs)
```javascript
// Source: returns.cjs lines 26-46
function parseReturn(agentOutput) {
  const markerIndex = agentOutput.indexOf(RETURN_MARKER);
  if (markerIndex === -1) {
    return { parsed: false, error: 'No RAPID:RETURN marker found' };
  }
  // ... extracts JSON, parses ...
  return { parsed: true, data };
}

// parseSetMergerReturn wraps this:
// 1. Call parseReturn(agentOutput)
// 2. If !parsed, return { status: 'BLOCKED', reason: error }
// 3. Check data.status exists
// 4. Loose checks on data.semantic_conflicts, data.resolutions, data.escalations (arrays if present)
// 5. Return structured result
```

### Test Pattern (node:test + assert/strict + tmpDir)
```javascript
// Source: merge.test.cjs lines 610-728
describe('MergeStateSchema', () => {
  it('validates correct merge state object', () => {
    const merge = require('./merge.cjs');
    const valid = {
      setId: 'auth-core',
      status: 'pending',
      lastUpdatedAt: new Date().toISOString(),
    };
    const result = merge.MergeStateSchema.parse(valid);
    assert.equal(result.setId, 'auth-core');
  });

  it('rejects invalid status values', () => {
    const merge = require('./merge.cjs');
    assert.throws(() => merge.MergeStateSchema.parse({
      setId: 'x', status: 'bogus', lastUpdatedAt: new Date().toISOString(),
    }));
  });
});
```

### Existing updateMergeState Pattern
```javascript
// Source: merge.cjs lines 159-166
function updateMergeState(cwd, setId, updates) {
  const current = readMergeState(cwd, setId);
  if (!current) {
    throw new Error(`No MERGE-STATE.json found for set ${setId}`);
  }
  const merged = { ...current, ...updates, lastUpdatedAt: new Date().toISOString() };
  writeMergeState(cwd, setId, merged);
}
// agentPhase1 and compressedResult can be added via updateMergeState
// since they are top-level optional fields
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline merge processing in skill | Subagent delegation (Phase 34) | v2.2 (this milestone) | Phase 33 builds the infrastructure that Phase 34 uses |
| Full context retained per set during merge | Compressed ~100 token result retained | v2.2 (this milestone) | Enables 8-set merges without exhausting orchestrator context |
| No subagent lifecycle tracking | agentPhase1/agentPhase2 enum fields | v2.2 (this milestone) | Enables idempotent re-entry: skip sets whose subagent already completed |

**Note on success criteria discrepancy:** The ROADMAP.md success criterion #2 says "under 500 tokens" for `prepareMergerContext()`, but the CONTEXT.md discussion increased this to 1000 tokens. The CONTEXT.md decision (1000 tokens) takes precedence as it represents the user's final decision after discussion.

## Open Questions

1. **agentPhase2 enum values**
   - What we know: Same 4-state pattern as agentPhase1 (`idle` / `spawned` / `done` / `failed`) for now
   - What's unclear: Phase 35 may need additional states (e.g., `partial` for conflicts where some resolved and some didn't)
   - Recommendation: Use the same 4-state enum for now. Phase 35 can extend with `.or()` or replace the enum if needed -- the field is `.optional()` so this won't break compatibility.

2. **parseSetMergerReturn location**
   - What we know: Could live in merge.cjs (cohesion with merge pipeline) or returns.cjs (cohesion with return parsing)
   - What's unclear: Future phases may add more return parsers -- would returns.cjs become a dumping ground?
   - Recommendation: Place in merge.cjs. It uses merge-specific knowledge (semantic_conflicts, resolutions, escalations field names) and will be called from the merge skill only. returns.cjs stays as generic RAPID:RETURN infrastructure.

3. **compressedResult exact shape**
   - What we know: User locked `{ setId, status, conflictCounts: { L1, L2, L3, L4, L5 }, resolutionCounts: { T1, T2, T3, escalated }, commitSha }`
   - What's unclear: Whether additional metadata (e.g., `completedAt` timestamp) is useful
   - Recommendation: Stick with the locked shape. If Phase 34 needs more fields, they can be added as optional. Keep it minimal to stay under ~100 tokens.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node 25.8) |
| Config file | none -- direct invocation |
| Quick run command | `node --test src/lib/merge.test.cjs` |
| Full suite command | `node --test src/lib/merge.test.cjs` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MERGE-04 | MergeStateSchema validates with agentPhase1/agentPhase2 present | unit | `node --test --test-name-pattern="agentPhase" src/lib/merge.test.cjs` | Extends existing file |
| MERGE-04 | MergeStateSchema validates v2.1-era state without new fields | unit | `node --test --test-name-pattern="backward" src/lib/merge.test.cjs` | Extends existing file |
| MERGE-04 | updateMergeState works with agentPhase fields | unit | `node --test --test-name-pattern="agentPhase" src/lib/merge.test.cjs` | Extends existing file |
| MERGE-05 | compressResult produces correct shape from MERGE-STATE | unit | `node --test --test-name-pattern="compressResult" src/lib/merge.test.cjs` | Extends existing file |
| MERGE-05 | compressResult stays under ~100 tokens (~400 chars) | unit | `node --test --test-name-pattern="token" src/lib/merge.test.cjs` | Extends existing file |
| MERGE-05 | 8-set budget stays under ~800 tokens | unit | `node --test --test-name-pattern="budget" src/lib/merge.test.cjs` | Extends existing file |
| SC-2 | prepareMergerContext assembles payload under 1000 tokens | unit | `node --test --test-name-pattern="prepareMerger" src/lib/merge.test.cjs` | Extends existing file |
| SC-3 | parseSetMergerReturn defaults to BLOCKED on missing return | unit | `node --test --test-name-pattern="parseSetMerger" src/lib/merge.test.cjs` | Extends existing file |
| SC-3 | parseSetMergerReturn defaults to BLOCKED on malformed return | unit | `node --test --test-name-pattern="parseSetMerger" src/lib/merge.test.cjs` | Extends existing file |
| SC-3 | parseSetMergerReturn accepts CHECKPOINT as valid | unit | `node --test --test-name-pattern="parseSetMerger" src/lib/merge.test.cjs` | Extends existing file |
| SC-3 | parseSetMergerReturn accepts COMPLETE with expected data | unit | `node --test --test-name-pattern="parseSetMerger" src/lib/merge.test.cjs` | Extends existing file |

### Sampling Rate
- **Per task commit:** `node --test src/lib/merge.test.cjs`
- **Per wave merge:** `node --test src/lib/merge.test.cjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None -- existing test infrastructure (`src/lib/merge.test.cjs`) covers all phase requirements. Tests will be appended to the existing file using the established `describe`/`it` patterns with `node:test` and `node:assert/strict`.

## Sources

### Primary (HIGH confidence)
- `/home/kek/Projects/RAPID/src/lib/merge.cjs` -- MergeStateSchema (lines 38-111), CRUD functions (lines 117-166), module exports (lines 1585-1634)
- `/home/kek/Projects/RAPID/src/lib/returns.cjs` -- parseReturn() (lines 26-46), validateHandoff() (lines 270-287), ReturnSchemas (lines 217-258)
- `/home/kek/Projects/RAPID/src/lib/state-schemas.cjs` -- .optional()/.default() patterns for backward compatibility
- `/home/kek/Projects/RAPID/src/lib/merge.test.cjs` -- test patterns (64 tests, node:test framework, tmpDir pattern)
- `/home/kek/Projects/RAPID/src/modules/roles/role-merger.md` -- RAPID:RETURN data schema (semantic_conflicts, resolutions, escalations)
- `/home/kek/Projects/RAPID/skills/merge/SKILL.md` -- merge pipeline orchestration flow, Step 8 summary table format
- `/home/kek/Projects/RAPID/package.json` -- zod 3.25.76, no new dependencies needed

### Secondary (MEDIUM confidence)
- `/home/kek/Projects/RAPID/.planning/phases/33-merge-state-schema-infrastructure/33-CONTEXT.md` -- user decisions and constraints (1000 token budget, loose checks pattern, 4-state enum)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- three pure functions following established patterns, schema extension uses proven .optional() approach
- Pitfalls: HIGH -- all pitfalls derived from direct code analysis and concrete failure modes
- Test coverage: HIGH -- existing test file with 64 tests, clear patterns to follow

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- all patterns internal to RAPID, no external API changes expected)
