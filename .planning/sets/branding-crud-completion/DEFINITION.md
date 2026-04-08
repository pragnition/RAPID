# Set: branding-crud-completion

**Created:** 2026-04-08 (via /add-set)
**Milestone:** v6.2.0

## Scope
Resolve branding-overhaul CRUD API gap. The shipped /_artifacts API supports POST (create), GET (read/list), and DELETE (delete) but is missing the U (update). Additionally, CONTEXT.md specifics list an `artifact-updated` SSE event type that no wave actually emits, creating an internal inconsistency.

Decide between two paths:
- **(a) Add update support:** add PUT/PATCH /_artifacts endpoint that updates manifest entries in `branding-artifacts.cjs` and emits the `artifact-updated` SSE event (true CRUD).
- **(b) Rename to CRD:** rename the API to CRD in all docs (CONTEXT.md, hub page tooltips, README references), remove the unused `artifact-updated` event type from CONTEXT.md specifics, and accept that file-backed artifacts can be replaced via DELETE+POST.

## Key Deliverables
1. Decide direction with user (path a vs path b).
2. Implement chosen path with tests.
3. Update branding-server tests to assert the chosen API surface.
4. Update CONTEXT.md to match shipped reality.

## Dependencies
None. This is a remediation set targeting work already merged in v6.2.0 (`branding-overhaul`).

## Files and Areas
Likely touched (final list determined during /rapid:plan-set):
- `src/branding/branding-artifacts.cjs` — manifest CRUD logic and SSE event emission
- `src/branding/branding-server.cjs` — `/_artifacts` route handlers
- Branding-server test suite — assertions for the chosen API surface
- `.planning/sets/branding-overhaul/CONTEXT.md` — align documented event types with reality
- README references and hub page tooltips — only if path (b) is chosen

## Source
Remediation artifact from `v6.2.0-AUDIT.md` (severity: medium).
