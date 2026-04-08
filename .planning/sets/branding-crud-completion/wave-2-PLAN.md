# PLAN: branding-crud-completion -- Wave 2

**Objective:** Add comprehensive test coverage for the `updateArtifact()` function and the PATCH `/_artifacts` endpoint, including SSE event verification.

**Wave scope:** Test files only. Implementation files (branding-artifacts.cjs, branding-server.cjs) are owned by Wave 1 and must NOT be modified in this wave.

**Prerequisite:** Wave 1 must be complete (updateArtifact exported, PATCH handler wired).

---

## Task 1: Add `updateArtifact()` unit tests to branding-artifacts.test.cjs

**File:** `src/lib/branding-artifacts.test.cjs`

**Action:** Add a new `describe('updateArtifact()', ...)` block after the existing `deleteArtifact()` describe block (ends at line 214) and before the `listUntrackedFiles()` describe block (starts at line 220). Follow the exact test style: `node:test` (describe, it, beforeEach, afterEach), `node:assert/strict`, using the shared `tmpDir` variable.

**Tests to add (6 tests):**

1. **`it('updates type field and preserves other fields')`**
   - Create an artifact via `artifacts.createArtifact(tmpDir, { type: 'logo', filename: 'logo.svg', description: 'Original' })`.
   - Call `artifacts.updateArtifact(tmpDir, entry.id, { type: 'icon' })`.
   - Assert `result.updated === true`.
   - Assert `result.entry.type === 'icon'` (changed).
   - Assert `result.entry.filename === 'logo.svg'` (preserved).
   - Assert `result.entry.description === 'Original'` (preserved).
   - Assert `result.entry.id === entry.id` (immutable).
   - Assert `result.entry.createdAt === entry.createdAt` (immutable).

2. **`it('updates filename field')`**
   - Create artifact, call `updateArtifact(tmpDir, entry.id, { filename: 'new-logo.svg' })`.
   - Assert `result.updated === true`.
   - Assert `result.entry.filename === 'new-logo.svg'`.
   - Assert other fields unchanged.

3. **`it('updates description field')`**
   - Create artifact, call `updateArtifact(tmpDir, entry.id, { description: 'Updated description' })`.
   - Assert `result.updated === true`.
   - Assert `result.entry.description === 'Updated description'`.

4. **`it('updates multiple fields at once')`**
   - Create artifact, call `updateArtifact(tmpDir, entry.id, { type: 'font', filename: 'heading.woff2', description: 'Changed all' })`.
   - Assert all three fields are updated.
   - Assert `id` and `createdAt` are unchanged.

5. **`it('returns { updated: false } for non-existent id')`**
   - Call `artifacts.updateArtifact(tmpDir, 'no-such-id', { type: 'icon' })`.
   - Assert `result.updated === false`.
   - Assert `result.entry === undefined`.

6. **`it('allows setting fields to empty strings')`**
   - Create artifact, call `updateArtifact(tmpDir, entry.id, { description: '' })`.
   - Assert `result.updated === true`.
   - Assert `result.entry.description === ''`.
   - This verifies the `!== undefined` check (not truthiness).

7. **`it('ignores immutable fields (id, createdAt) in updates')`**
   - Create artifact, capture original `id` and `createdAt`.
   - Call `updateArtifact(tmpDir, entry.id, { id: 'hacked-id', createdAt: '2000-01-01T00:00:00Z', type: 'icon' })`.
   - Assert `result.entry.id === entry.id` (original, NOT 'hacked-id').
   - Assert `result.entry.createdAt === entry.createdAt` (original).
   - Assert `result.entry.type === 'icon'` (the patchable field DID update).

8. **`it('persists updates to manifest on disk')`**
   - Create artifact, call `updateArtifact(tmpDir, entry.id, { type: 'wireframe' })`.
   - Reload manifest via `artifacts.loadManifest(tmpDir)`.
   - Find the entry by id, assert `type === 'wireframe'`.

**What NOT to do:**
- Do NOT modify the `beforeEach` or `afterEach` hooks -- they already set up the temp directory correctly.
- Do NOT import any new modules -- `artifacts` is already imported.

**Verification:**
```bash
node --test src/lib/branding-artifacts.test.cjs 2>&1 | tail -5
# Expected: all tests pass, including new updateArtifact tests
```

---

## Task 2: Add PATCH endpoint integration tests to branding-server.test.cjs

**File:** `src/lib/branding-server.test.cjs`

**Action:** Add two things:
1. A `_patchJSON()` helper function alongside the existing `_postJSON()` and `_deleteReq()` helpers (after line 499, before the "Artifact CRUD API" describe block).
2. New test cases inside the existing `describe('Artifact CRUD API', ...)` block (after the DELETE tests, before the SSE test at line 593).

**Helper function to add (`_patchJSON`):**

Add after `_deleteReq` (line 499), before the `describe('Artifact CRUD API', ...)` block:

```javascript
/**
 * Helper: send a PATCH request with JSON body.
 * @param {number} port
 * @param {string} urlPath
 * @param {*} body
 * @returns {Promise<{ status: number, headers: object, body: string }>}
 */
function _patchJSON(port, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: urlPath,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: responseBody });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
```

This mirrors `_postJSON` exactly, with only `method: 'PATCH'` changed.

**Integration tests to add (5 tests):**

1. **`it('PATCH /_artifacts?id=... updates artifact and returns 200')`**
   - Start server, POST to create an artifact.
   - PATCH `/_artifacts?id=${entry.id}` with body `{ description: 'Updated description' }`.
   - Assert status 200.
   - Parse response body, assert `description === 'Updated description'`.
   - Assert `id`, `type`, `filename`, `createdAt` unchanged from original.

2. **`it('PATCH /_artifacts without id returns 400')`**
   - Start server, PATCH `/_artifacts` (no query param) with body `{ type: 'icon' }`.
   - Assert status 400.
   - Assert body error mentions 'Missing required query parameter'.

3. **`it('PATCH /_artifacts with unknown id returns 404')`**
   - Start server, PATCH `/_artifacts?id=nonexistent` with body `{ type: 'icon' }`.
   - Assert status 404.
   - Assert body error mentions 'Artifact not found'.

4. **`it('PATCH /_artifacts with empty body returns 400')`**
   - Start server, PATCH `/_artifacts?id=some-id` with body `{}`.
   - Assert status 400.
   - Assert body error mentions 'patchable field'.

5. **`it('PATCH /_artifacts fires artifact-updated SSE event')`**
   - Start server, connect SSE via `_connectSSE(port)`.
   - Wait 50ms for connection.
   - POST to create an artifact.
   - PATCH `/_artifacts?id=${entry.id}` with body `{ type: 'icon' }`.
   - Wait 50ms for event propagation.
   - Find event with `type === 'artifact-updated'` in the events array.
   - Assert event exists.
   - Assert `event.data.id === entry.id`.
   - Assert `event.data.type === 'icon'`.
   - Destroy SSE connection in finally block.

**Where to insert tests:** Inside the existing `describe('Artifact CRUD API', ...)` block, after the `it('DELETE /_artifacts with unknown id returns 404')` test (line 591) and before the `it('CRUD operations fire SSE events')` test (line 593). Alternatively, the SSE test for PATCH can be appended after the existing `it('CRUD operations fire SSE events')` test (line 624).

**What NOT to do:**
- Do NOT modify any existing tests -- only add new ones.
- Do NOT change the `beforeEach` or `afterEach` hooks.
- Do NOT add new describe blocks -- add within the existing `Artifact CRUD API` block.

**Verification:**
```bash
node --test src/lib/branding-server.test.cjs 2>&1 | tail -5
# Expected: all tests pass, including new PATCH tests
```

---

## Success Criteria

1. `branding-artifacts.test.cjs` has 8 new tests under `describe('updateArtifact()')`, all passing.
2. `branding-server.test.cjs` has a `_patchJSON` helper and 5 new PATCH tests, all passing.
3. All pre-existing tests (49) continue to pass.
4. Full test suite: `node --test src/lib/branding-artifacts.test.cjs src/lib/branding-server.test.cjs` passes with 0 failures.
5. The `artifact-updated` SSE event is verified end-to-end via the PATCH integration test.
