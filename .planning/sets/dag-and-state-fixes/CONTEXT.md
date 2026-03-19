# CONTEXT: dag-and-state-fixes

**Set:** dag-and-state-fixes
**Generated:** 2026-03-19
**Mode:** interactive

<domain>
## Set Boundary
Fix DAG.json lifecycle gaps that cause downstream failures across the RAPID pipeline. Scope includes: path consolidation (`.planning/DAG.json` vs `.planning/sets/DAG.json`), centralized `tryLoadDAG()` function, ENOENT defensive handling across all consumers (merge.cjs, plan.cjs, add-set.cjs), execute-set state-to-complete transition reliability in SKILL.md Step 6, and DAG.json creation at init time via `recalculateDAG()`.
</domain>

<decisions>
## Implementation Decisions

### tryLoadDAG API Shape

- Return `{ dag: object|null, path: string }` — consumers get the canonical path for logging/error messages
- No auto-regeneration inside tryLoadDAG — return null on ENOENT, callers handle regeneration themselves
- No caching — always read from disk; DAG.json is small and reads are infrequent
- Just parse JSON, no schema validation — tryLoadDAG is a loader, not a validator

### ENOENT Fallback Behavior

- When tryLoadDAG returns null, consumers should log an informational warning (e.g., "DAG.json not found, regenerating...") then attempt `recalculateDAG()`
- If regeneration also fails (e.g., no STATE.json yet), gracefully degrade — skip DAG-dependent features with informational messages rather than crashing

### State-Before-Commit Recovery

- Execute-set Step 6: transition state to 'complete' BEFORE git commit operations
- If git commit fails after state transition, leave state as 'complete' (the work IS done) but retry the commit
- Simple retry (2-3 attempts with short delay) for STATE.json lock contention during write — handles race condition from parallel wave execution

### Old Path Migration

- Just fix the code — change merge.cjs line 2007 from `.planning/DAG.json` to `.planning/sets/DAG.json`
- No migration logic for old path files — the old path was already wrong, no valid DAG.json exists there
</decisions>

<specifics>
## Specific Ideas
- Callers of tryLoadDAG should attempt auto-regeneration when null is returned, rather than tryLoadDAG handling it internally (avoids circular dependency between dag.cjs and add-set.cjs)
- The commit retry after state transition should be a simple re-attempt, not a complex retry framework
</specifics>

<code_context>
## Existing Code Insights

- **merge.cjs** has two DAG.json references: line 1580 (correct `.planning/sets/DAG.json`) and line 2007 in `detectCascadeImpact()` (wrong `.planning/DAG.json`)
- **plan.cjs** uses correct canonical path at line 258 via `writeDAG()` — needs migration to tryLoadDAG for reads
- **add-set.cjs** contains `recalculateDAG(cwd, milestoneId)` which rebuilds DAG.json and OWNERSHIP.json from STATE.json and CONTRACT.json files — this is the function to call from init SKILL.md
- **dag.cjs** currently has toposort, wave assignment, DAG creation/validation but no centralized loader
- **execute-set SKILL.md** Step 6 (line 380+) runs state transition at line 386 after git operations — needs reordering
- No existing tryLoadDAG function — this is net-new code in dag.cjs
</code_context>

<deferred>
## Deferred Ideas
- Full DAG schema validation (Ajv/Zod) could be added later but is out of scope for this fix-focused set
- DAG.json file watcher for live invalidation is unnecessary given current usage patterns
</deferred>
