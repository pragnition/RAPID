# SET-OVERVIEW: branding-crud-completion

## Approach

This set resolves a gap identified in the v6.2.0 audit: the `/_artifacts` API shipped by `branding-overhaul` supports Create, Read, and Delete but not Update. Additionally, the branding-overhaul CONTEXT.md documents an `artifact-updated` SSE event type that is never emitted by any code path, creating an internal inconsistency between documentation and implementation.

The first task is a user decision point: choose between (a) adding true update support (PUT/PATCH endpoint + `artifact-updated` SSE emission) or (b) accepting CRD semantics and cleaning up documentation to remove the phantom `artifact-updated` event reference. The audit recommends Option B unless update semantics are specifically needed, since artifacts are file-backed and DELETE+POST achieves the same result. Once the direction is chosen, the implementation is straightforward -- either adding a route handler and manifest function, or removing stale documentation references.

Regardless of chosen path, the test suite must be updated to assert the final API surface, and CONTEXT.md must be aligned with shipped reality. This is a small, self-contained remediation set with no external dependencies.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/branding-artifacts.cjs` | Manifest CRUD logic (loadManifest, createArtifact, deleteArtifact) | Existing -- add `updateArtifact()` if path (a) |
| `src/lib/branding-server.cjs` | HTTP route handlers for `/_artifacts` (POST, GET, DELETE) | Existing -- add PUT/PATCH handler if path (a) |
| `src/lib/branding-artifacts.test.cjs` | Unit tests for artifact manifest operations | Existing -- update for chosen surface |
| `src/lib/branding-server.test.cjs` | Integration tests for `/_artifacts` routes and SSE events | Existing -- update for chosen surface |
| `.planning/sets/branding-overhaul/CONTEXT.md` | Documents SSE event types including phantom `artifact-updated` | Existing -- align with reality |

## Integration Points

- **Exports:** None. This set does not introduce new functions or types consumed by other sets.
- **Imports:** None. This set operates on code already merged from `branding-overhaul`.
- **Side Effects:** The `/_artifacts` API surface will change (either gaining PUT/PATCH or having its documentation narrowed to CRD). The SSE event model on `/_events` will either gain a real `artifact-updated` emission or lose the documented-but-unimplemented reference. The hub page JavaScript (`branding-server.cjs` inline HTML) already listens for `artifact-updated` events, so path (b) would also remove that listener.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Path (a) requires updating the ArtifactEntrySchema if `updatedAt` field is added | Low | Keep schema change minimal; only add fields if truly needed for update semantics |
| Hub page inline JS listens for `artifact-updated` -- removing it (path b) must not break event handling | Low | Verify `scheduleReload` still fires on `artifact-created`, `artifact-deleted`, and `file-changed` |
| Editing branding-overhaul CONTEXT.md after that set is merged may confuse future audits | Low | Add a clear annotation noting the remediation source |

## Wave Breakdown (Preliminary)

- **Wave 1:** Decision capture and core implementation -- confirm path (a) or (b) with user, then implement the chosen direction in `branding-artifacts.cjs` and `branding-server.cjs`
- **Wave 2:** Test updates and documentation alignment -- update test suites to assert final API surface, update CONTEXT.md and any hub page references

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
