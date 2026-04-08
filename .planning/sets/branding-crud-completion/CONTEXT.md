# CONTEXT: branding-crud-completion

**Set:** branding-crud-completion
**Generated:** 2026-04-08
**Mode:** interactive

<domain>
## Set Boundary
Resolve the v6.2.0 audit gap on branding-overhaul's `/_artifacts` API. The shipped API supports POST (create), GET (read/list), and DELETE but not Update. Additionally, the branding-overhaul CONTEXT.md documents an `artifact-updated` SSE event type that is never emitted. This set adds true CRUD support by implementing a PATCH endpoint and making the `artifact-updated` SSE event functional.
</domain>

<decisions>
## Implementation Decisions

### CRUD vs CRD API Surface
- **True CRUD (path a):** Add a PATCH `/_artifacts` endpoint that updates manifest entries and emits the `artifact-updated` SSE event.
- **Rationale:** The user chose to complete the CRUD surface rather than simplify to CRD. This makes the `artifact-updated` SSE event real and aligns the implementation with the original branding-overhaul CONTEXT.md design intent.

### Update Semantics
- **PATCH (partial update):** The endpoint accepts only the fields being changed (e.g., just `description` or `type`). Unchanged fields are preserved from the existing entry.
- **No `updatedAt` field:** The `ArtifactEntrySchema` stays unchanged — no new timestamp field. The `createdAt` field remains the only temporal marker.
- **Rationale:** PATCH is more ergonomic than PUT for the typical use case of tweaking a description or type label. No `updatedAt` avoids schema migration complexity for marginal benefit in a local dev tool.

### Hub Page Event Listener Reconciliation
- **Keep full reload:** The existing `artifact-updated` listener in the hub page JS already calls `scheduleReload()`, consistent with all other SSE event handlers. No change needed — the listener becomes functional once the PATCH endpoint emits the event.
- **No visual distinction:** Updated artifacts look the same as other artifacts in the hub page. No transient highlight or badge — consistent with the no-`updatedAt` decision.
- **Rationale:** Full reload is consistent with the existing pattern for all SSE events (artifact-created, artifact-deleted, file-changed). The 200ms debounce already minimizes visual disruption. Without an `updatedAt` field there is no persistent state to distinguish updated artifacts.

### Historical Documentation Handling
- **Leave branding-overhaul CONTEXT.md as-is:** The CONTEXT.md specifics section lists `artifact-updated` as an SSE event type. Once this set implements it, the documentation becomes accurate. No annotation or rewrite needed.
- **Minimal documentation scope:** Only update this set's own CONTEXT.md and the test suites. No changes to README, hub page tooltips, or other external docs.
- **Rationale:** The branding server API is internal, consumed primarily by the branding skill. Over-documenting internal API details adds maintenance burden. The CONTEXT.md becomes truthful once the event is implemented.

### Claude's Discretion
- PATCH request body validation (which fields are patchable: type, filename, description)
- Error responses for invalid PATCH requests (missing id, non-existent artifact, empty body)
- `updateArtifact()` function implementation in branding-artifacts.cjs
- PATCH route handler implementation details in branding-server.cjs
- Test structure and assertions for the new endpoint
</decisions>

<specifics>
## Specific Ideas
- PATCH endpoint at `/_artifacts` with `?id=<uuid>` query parameter (consistent with DELETE)
- `updateArtifact(projectRoot, id, updates)` function in branding-artifacts.cjs — loads manifest, finds entry by id, merges changed fields, saves
- SSE event emission: `notifyClients('artifact-updated', updatedEntry)` after successful PATCH
- Patchable fields: `type`, `filename`, `description` — `id` and `createdAt` are immutable
- Hub page JS `artifact-updated` listener already wired up — no client changes needed
</specifics>

<code_context>
## Existing Code Insights
- `branding-artifacts.cjs` exports `loadManifest`, `saveManifest`, `createArtifact`, `getArtifact`, `deleteArtifact` — pattern is clear for adding `updateArtifact`
- `branding-server.cjs` `_handleRequest` dispatches on method + pathname — PATCH handler follows the same pattern as POST and DELETE
- `notifyClients(event, data)` is already exported and used by POST (artifact-created) and DELETE (artifact-deleted) handlers
- `_readRequestBody(req)` is already available for parsing PATCH request bodies
- Hub page JS (lines 334-337 in branding-server.cjs) already listens for `artifact-updated` — no client change needed
- ArtifactEntrySchema has: id, type, filename, createdAt, description — all validated by Zod
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
