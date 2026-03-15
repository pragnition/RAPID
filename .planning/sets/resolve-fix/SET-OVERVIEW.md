# SET-OVERVIEW: resolve-fix

## Approach

The `resolveSet` function currently resolves numeric indices (e.g., "1", "2") by listing `.planning/sets/` directories on the filesystem and sorting them alphabetically. This is fragile: when sets from a previous milestone are archived (moved out of `.planning/sets/`), the numeric indices shift unpredictably. For example, if set directories from v3.1.0 are archived, "set 3" in the current milestone suddenly maps to a different directory than the user expects.

The fix changes `resolveSet` to resolve numeric indices against the current milestone's `sets[]` array in STATE.json instead of the filesystem. The STATE.json array is the canonical source of truth for which sets belong to the current milestone and their ordering. String IDs continue to resolve via exact match against this same array. The `resolveWave` function already receives `state` as a parameter and delegates to `resolveSet` internally, so its changes are minimal -- just passing `state` through to the updated `resolveSet`.

The CLI call site in `rapid-tools.cjs` for `resolve set` will also need updating: it currently does not load STATE.json before calling `resolveSet`, but the new signature requires it. The `resolve wave` path already loads state, so it needs no structural change.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/resolve.cjs` | Core `resolveSet` and `resolveWave` functions | Existing -- modify |
| `src/lib/resolve.test.cjs` | Unit tests for both functions | Existing -- modify |
| `src/bin/rapid-tools.cjs` | CLI entry point (`resolve set` / `resolve wave` handlers) | Existing -- modify |
| `src/lib/plan.cjs` | Contains `listSets()` -- filesystem-based set listing | Existing -- no change (callers may still use it elsewhere) |

## Integration Points

- **Exports:**
  - `resolveSet(input, cwd, state?)` -- Updated signature adds optional `state` parameter. When provided, numeric resolution uses `state.milestones[current].sets[]`. When omitted, falls back to reading STATE.json from disk (so existing callers without state still work).
  - `resolveWave(input, state, cwd, setId?)` -- Unchanged signature, but internally calls the updated `resolveSet` with the `state` it already has.

- **Imports:** None. This set has no dependencies on other v3.2.0 sets.

- **Side Effects:**
  - `resolveSet` will now read STATE.json from disk when called without the `state` parameter (new I/O path for the `resolve set` CLI subcommand).
  - The `plan.listSets()` function is no longer called by resolve functions, removing the filesystem dependency for index resolution.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `resolveSet` callers outside `rapid-tools.cjs` that rely on the 2-arg signature | Medium | The `state` parameter is optional (3rd arg). Existing 2-arg calls fall back to reading STATE.json from disk. No breaking change. |
| Numeric index semantics change: indices now map to STATE.json order, not alphabetical directory order | Medium | These should be the same in practice (sets are added in order). Document the change. Tests verify the new behavior explicitly. |
| `resolve set` CLI subcommand needs STATE.json but it might not exist yet (pre-init) | Low | Preserve the "no sets found" error path. If STATE.json is missing or has no sets, throw the same user-friendly error as before. |
| String ID resolution must still work when the set has no directory (archived) | Low | String IDs match against `milestone.sets[].id` in STATE.json, not filesystem. This is the whole point of the fix. |

## Wave Breakdown (Preliminary)

- **Wave 1:** Update `resolveSet` to accept optional `state` parameter, resolve numeric indices against `milestone.sets[]` in STATE.json, fall back to reading STATE.json from disk when `state` is not provided. Update `resolveWave` to pass its `state` through to `resolveSet`. Update the `resolve set` CLI handler to load STATE.json before calling `resolveSet`.

- **Wave 2:** Update tests to verify archive-resilient resolution (numeric indices work without corresponding filesystem directories), backward-compatible string ID resolution, CLI integration, and edge cases (missing STATE.json, empty milestone, out-of-range indices).

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
