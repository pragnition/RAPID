# PLAN: branding-crud-completion -- Wave 1

**Objective:** Add the `updateArtifact()` function and PATCH `/_artifacts` route handler to complete the CRUD surface. Wire up the `artifact-updated` SSE event.

**Wave scope:** Core implementation only. Test files are owned by Wave 2.

---

## Task 1: Add `updateArtifact()` to branding-artifacts.cjs

**File:** `src/lib/branding-artifacts.cjs`

**Action:** Add a new `updateArtifact(projectRoot, id, updates)` function between `deleteArtifact` (line 161) and `listUntrackedFiles` (line 169). Follow the exact same load-mutate-save-return pattern used by `createArtifact` and `deleteArtifact`.

**Implementation details:**

1. Define `function updateArtifact(projectRoot, id, updates)`.
2. Call `loadManifest(projectRoot)` to get the current manifest array.
3. Find the index of the entry with matching `id` via `manifest.findIndex((e) => e.id === id)`.
4. If not found (`idx === -1`), return `{ updated: false }`.
5. Define the patchable fields as `['type', 'filename', 'description']`. The `id` and `createdAt` fields are immutable and must NOT be updated even if present in `updates`.
6. Iterate over patchable fields. For each field, if `updates[key] !== undefined` (use strict `!== undefined` check, NOT truthiness, to allow setting fields to empty strings), assign `manifest[idx][key] = updates[key]`.
7. Call `saveManifest(projectRoot, manifest)` to persist. This provides Zod validation automatically.
8. Return `{ updated: true, entry: manifest[idx] }`.

**Export:** Add `updateArtifact` to the `module.exports` object (alphabetical position between `saveManifest` and `listArtifacts` in the existing exports list -- actually, place it after `listUntrackedFiles` or in logical CRUD order: after `getArtifact` and before `deleteArtifact`). The exact export order does not matter as long as it is exported.

**JSDoc:** Add a JSDoc block matching the style of existing functions:
```
/**
 * Update an existing artifact entry by id (partial update).
 * Only 'type', 'filename', and 'description' are patchable.
 * @param {string} projectRoot
 * @param {string} id
 * @param {{ type?: string, filename?: string, description?: string }} updates
 * @returns {{ updated: boolean, entry?: z.infer<typeof ArtifactEntrySchema> }}
 */
```

**What NOT to do:**
- Do NOT modify `ArtifactEntrySchema` or `ManifestSchema` -- no schema changes needed.
- Do NOT add an `updatedAt` field.
- Do NOT rename or move physical files on disk when `filename` is updated (consistent with how `createArtifact` does not create physical files).
- Do NOT change any existing function signatures or behavior.

**Verification:**
```bash
node -e "const a = require('./src/lib/branding-artifacts.cjs'); console.log(typeof a.updateArtifact);"
# Expected: "function"
```

---

## Task 2: Add PATCH handler to branding-server.cjs

**File:** `src/lib/branding-server.cjs`

**Action:** Add a PATCH `/_artifacts` route handler in the `_handleRequest` function, between the DELETE handler (ends at line 576) and the Hub page handler (starts at line 579). The handler combines the POST pattern (async body reading) with the DELETE pattern (`?id=` query parameter).

**Implementation details:**

1. Add a new `if` block: `if (req.method === 'PATCH' && pathname === '/_artifacts')`.
2. Extract the `id` from the query string: `const id = url.searchParams.get('id');`.
3. If `id` is missing, respond with 400: `{ error: 'Missing required query parameter: id' }`.
4. Call `_readRequestBody(req)` (async, use `.then()` chain matching the POST handler pattern).
5. Parse the body. If the body is empty or has no patchable fields (`type`, `filename`, `description`), respond with 400: `{ error: 'Request body must include at least one patchable field: type, filename, description' }`.
   - Check: `const patchable = ['type', 'filename', 'description']; const hasUpdates = patchable.some(k => body[k] !== undefined);`
   - If `!hasUpdates`, respond 400.
6. Call `artifacts.updateArtifact(projectRoot, id, body)`.
7. If `result.updated` is false, respond with 404: `{ error: 'Artifact not found', id }` (matching DELETE's 404 pattern).
8. If `result.updated` is true:
   - Call `notifyClients('artifact-updated', result.entry)` to fire the SSE event.
   - Respond with 200: `JSON.stringify(result.entry)`.
9. Wrap in `.catch()` for 500 errors (matching POST handler pattern).

**Error response format:** Match existing patterns exactly:
- 400: `{ "error": "..." }`
- 404: `{ "error": "Artifact not found", "id": "..." }`
- 500: `{ "error": "<err.message>" }`

**What NOT to do:**
- Do NOT modify any existing route handlers.
- Do NOT change the hub page JS -- `artifact-updated` listener is already wired at line 335.
- Do NOT add PATCH to the exports -- it is an internal route handler.
- Do NOT add CORS headers to the PATCH response (none of the existing handlers do this except SSE).

**Verification:**
```bash
node -e "
const http = require('node:http');
const src = require('fs').readFileSync('./src/lib/branding-server.cjs', 'utf-8');
console.log(src.includes(\"'PATCH'\") ? 'PATCH handler found' : 'PATCH handler MISSING');
console.log(src.includes(\"artifact-updated\") ? 'SSE event found' : 'SSE event MISSING');
"
# Expected: both "found"
```

---

## Success Criteria

1. `updateArtifact` is exported from `branding-artifacts.cjs` and follows the load-mutate-save-return pattern.
2. PATCH `/_artifacts?id=<uuid>` route exists in `branding-server.cjs` dispatching between DELETE and Hub page handlers.
3. Successful PATCH emits `artifact-updated` SSE event via `notifyClients`.
4. Error responses (missing id, missing body fields, not found) return appropriate HTTP status codes.
5. All 49 existing tests still pass: `node --test src/lib/branding-artifacts.test.cjs src/lib/branding-server.test.cjs`
