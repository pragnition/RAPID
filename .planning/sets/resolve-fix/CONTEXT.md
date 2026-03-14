# CONTEXT: resolve-fix

**Set:** resolve-fix
**Generated:** 2026-03-14
**Mode:** interactive

<domain>
## Set Boundary
Switch `resolveSet()` from filesystem-based resolution (`plan.listSets()`) to STATE.json-based resolution (`milestone.sets[]` array). This makes numeric set indices resilient to archival of previous milestones' set directories. Also update `resolveWave()` to eliminate its remaining `listSets()` call. Update the CLI handler in `rapid-tools.cjs` to load STATE.json before calling `resolveSet`. Update tests to cover both STATE.json-based and fallback paths.
</domain>

<decisions>
## Implementation Decisions

### Backward Compat & listSets Cleanup
- `state` parameter on `resolveSet` is **optional** (3rd arg). When omitted, falls back to reading STATE.json from disk.
- Remove **ALL** `plan.listSets()` calls from `resolve.cjs`, including the one in `resolveWave`'s string-ID lookup path (line 166). Make resolve.cjs fully STATE.json-based.
- Leave `plan.listSets()` itself untouched — it's still used by other callers outside resolve.cjs.

### Test Migration Approach
- **Dual coverage**: Keep existing filesystem-based tests to verify the disk-fallback path (when `state` is not passed). Add new STATE.json-based tests alongside.
- Add an explicit **archive-resilient** test: STATE.json has sets but no corresponding filesystem directories exist — numeric indices still resolve correctly.
- Update test descriptions where they reference "alphabetically-sorted" to reflect STATE.json ordering.

### Error Message Wording
- Keep **user-facing friendly** wording but **add milestone context** where relevant.
- Example: "No sets found in current milestone 'v3.2.0'. Run /rapid:init first."
- Don't mention STATE.json internals in user-facing errors.
</decisions>

<specifics>
## Specific Ideas
- The `cwd` parameter remains for the disk-fallback path (reading STATE.json from disk when `state` is omitted).
- `resolveWave`'s string-ID path (line 166) currently calls `plan.listSets(cwd)` just to get `setIndex` — switch this to use `milestone.sets.findIndex()` instead.
- The `resolve set` CLI handler needs to load STATE.json (like the `resolve wave` handler already does) and pass it to `resolveSet`.
</specifics>

<code_context>
## Existing Code Insights
- `resolveWave` already receives `state` as a parameter and has access to milestone data — minimal changes needed there.
- The `resolve wave` CLI handler already loads STATE.json via `sm.readState(cwd)` (line 2635-2638) — the `resolve set` handler should follow the same pattern.
- `makeState()` helper already exists in tests and can be reused for new resolveSet STATE.json tests.
- `plan.listSets()` (plan.cjs:169) reads `.planning/sets/` directory and sorts alphabetically — this is the fragile behavior being replaced.
</code_context>

<deferred>
## Deferred Ideas
- Deprecating `plan.listSets()` globally is out of scope for this set — other callers may still need it.
- Adding milestone-aware resolution to other commands (e.g., `status`, `start-set`) is separate work.
</deferred>
