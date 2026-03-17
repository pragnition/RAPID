# SET-OVERVIEW: foundation-hardening

## Approach

This set addresses foundational reliability and hygiene issues that other v3.3.0 sets depend on. The core problems are: (1) Zod schemas silently strip unknown fields from STATE.json, making forward-compatible schema evolution impossible; (2) version numbers are inconsistent across package.json (3.0.0) and plugin.json (3.2.0), and STATE.json has no `rapidVersion` field for migration tooling; (3) `writeRegistry()` uses bare `fs.writeFileSync()` instead of the atomic tmp+rename pattern that `writeState()` already uses; and (4) there is no `npm test` script despite 27+ test files.

The implementation strategy is bottom-up: fix the Zod schema stripping first (`.passthrough()` on all state schemas), then layer on the version synchronization and `rapidVersion` field, make `writeRegistry()` atomic, and finally wire up the `npm test` script. Each change is small and independently testable. The schema versioning strategy (`z.literal(1)` to `z.number().min(1)`) is also in scope as a prerequisite for the `/migrate` command in the version-migration set.

All changes are confined to library modules and package manifests. No skill or agent prompt files are modified. No new dependencies are introduced.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/state-schemas.cjs` | Zod schemas for ProjectState, SetState, etc. | Existing -- add `.passthrough()` |
| `src/lib/state-schemas.test.cjs` | Schema tests | Existing -- add passthrough tests |
| `src/lib/state-machine.cjs` | `readState()`, `writeState()` -- uses `ProjectState.parse()` | Existing -- verify passthrough behavior |
| `src/lib/worktree.cjs` | `writeRegistry()` at line 225 | Existing -- make atomic |
| `src/lib/worktree.test.cjs` | Worktree tests | Existing -- add atomic write test |
| `src/lib/version.cjs` | `getVersion()` reads from package.json | Existing -- verify correctness |
| `src/lib/version.test.cjs` | Version tests | Existing -- extend |
| `package.json` | Version field (currently 3.0.0), no test script | Existing -- sync version, add `npm test` |
| `.claude-plugin/plugin.json` | Version field (currently 3.2.0) | Existing -- sync version |

## Integration Points

- **Exports:**
  - `stateSchemaPassthrough` -- All Zod schemas in `state-schemas.cjs` use `.passthrough()` so unknown fields survive parse/validate cycles. This is critical for the version-migration set which adds new fields.
  - `rapidVersionField` -- New `rapidVersion` field in STATE.json, populated during init. The version-migration set's `/migrate` command reads this to determine which migrations to apply.
  - `atomicWriteRegistry` -- `writeRegistry()` uses tmp+rename. Consumed by all code paths that update REGISTRY.json (worktree creation, reconciliation, set init).
  - `npmTestScript` -- `npm test` runs all `*.test.cjs` files via `node --test`. Other sets can rely on this for CI and verification.
  - `versionSync` -- Single source of truth for version number across package.json, plugin.json, and `version.cjs`.

- **Imports:** None. This set has zero dependencies on other sets.

- **Side Effects:**
  - Existing STATE.json files will no longer have unknown fields stripped on read/write cycles.
  - The `version` schema field changes from `z.literal(1)` to `z.number().min(1)`, allowing future schema version bumps without breaking existing state files.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `.passthrough()` changes Zod parse output shape, potentially surfacing unexpected fields to downstream consumers | Medium | Add tests asserting unknown fields are preserved; audit all `ProjectState.parse()` call sites in `state-machine.cjs` |
| Changing `z.literal(1)` to `z.number().min(1)` allows invalid schema versions (e.g., 999) to pass validation | Low | Add `.max()` bound or use `z.union([z.literal(1), z.literal(2)])` if a closed set is preferred |
| Version sync between package.json and plugin.json could drift again after this set | Low | Add a test that asserts both files contain the same version string |
| `npm test` glob pattern may miss test files in new directories added by cli-restructuring set | Low | Use a recursive glob (`src/**/*.test.cjs`) in the test script |

## Wave Breakdown (Preliminary)

- **Wave 1:** Schema hardening -- add `.passthrough()` to all Zod schemas in `state-schemas.cjs`, change `z.literal(1)` to `z.number().min(1)`, add `rapidVersion` field with `.optional().default(undefined)`, write comprehensive tests proving unknown field preservation
- **Wave 2:** Atomic writes and version sync -- make `writeRegistry()` use tmp+rename pattern, synchronize package.json and plugin.json version numbers, add `npm test` script, add version sync test
- **Wave 3:** Integration validation -- verify `readState()`/`writeState()` round-trip preserves unknown fields end-to-end, run full test suite via `npm test`, confirm no regressions

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
