# Wave 1 PLAN: Artifact Registry and SSE Infrastructure

**Set:** branding-overhaul
**Wave:** 1
**Objective:** Build the two foundational modules: `branding-artifacts.cjs` (artifact manifest CRUD with Zod validation) and the SSE infrastructure within `branding-server.cjs` (SSE endpoint, fs.watch auto-reload, connection tracking). These are prerequisites for Wave 2 (HTTP API + hub page) and Wave 3 (skill flow).

---

## Task 1: Create branding-artifacts.cjs -- Artifact Manifest CRUD

**Files:** `src/lib/branding-artifacts.cjs`

**Action:**

Create a new CommonJS module that manages a flat-array artifact manifest at `.planning/branding/artifacts.json`. The module provides CRUD operations for artifact entries.

### Schema (Zod)

Define a Zod schema for a single artifact entry:
```
{ id: string, type: string, filename: string, createdAt: string (ISO 8601), description: string }
```

Define a manifest schema as `z.array(ArtifactEntrySchema)`. The manifest file is the JSON-serialized array.

### Constants

- `MANIFEST_FILENAME` = `'artifacts.json'`
- `BRANDING_DIR` = `path.join('.planning', 'branding')`

### Functions to implement

1. **`getManifestPath(projectRoot)`** -- Returns absolute path to `artifacts.json` inside the branding directory. Pure path computation, no I/O.

2. **`loadManifest(projectRoot)`** -- Read and parse `artifacts.json`. If the file does not exist, return an empty array `[]`. If the file exists but fails Zod validation, throw an error with a clear message including the validation details. Use `fs.readFileSync` for simplicity.

3. **`saveManifest(projectRoot, manifest)`** -- Validate the manifest array with Zod, then write it to `artifacts.json` with 2-space indent + trailing newline. Throw if validation fails.

4. **`createArtifact(projectRoot, { type, filename, description })`** -- Generate an `id` using `crypto.randomUUID()`. Set `createdAt` to `new Date().toISOString()`. Load manifest, push new entry, save manifest. Return the created entry object.

5. **`listArtifacts(projectRoot)`** -- Load and return the manifest array. Alias for `loadManifest`.

6. **`getArtifact(projectRoot, id)`** -- Load manifest, find entry by `id`. Return the entry or `null` if not found.

7. **`deleteArtifact(projectRoot, id)`** -- Load manifest, find and remove entry by `id`. Save the updated manifest. Also delete the physical file from `.planning/branding/` if it exists (use `fs.unlinkSync` wrapped in try/catch). Return `{ deleted: true, entry }` if found, `{ deleted: false }` if not found.

8. **`listUntrackedFiles(projectRoot)`** -- Read the branding directory, load the manifest, and return filenames that exist on disk but are NOT in the manifest. Exclude `artifacts.json`, `.server.pid`, and `index.html` from the untracked list (these are infrastructure files).

### Exports

Export all 8 functions listed above, plus `MANIFEST_FILENAME` and the Zod schemas (`ArtifactEntrySchema`, `ManifestSchema`) for testing.

### What NOT to do

- Do NOT use async I/O. All file operations are synchronous (consistent with the rest of the codebase).
- Do NOT add any npm dependencies. Use `const { z } = require('zod')` (already a dependency) and `const crypto = require('node:crypto')`.
- Do NOT implement any SSE notification in this module -- that is the server's responsibility.

**Verification:**

```bash
node -e "const a = require('./src/lib/branding-artifacts.cjs'); console.log(Object.keys(a)); console.log('Schema:', a.ArtifactEntrySchema.shape); console.log('OK')"
```

**Done when:** Module exports all 8 functions and 3 constants/schemas, loads without error, and Zod schemas parse correctly.

---

## Task 2: Create branding-artifacts.test.cjs -- Artifact Registry Tests

**Files:** `src/lib/branding-artifacts.test.cjs`

**Action:**

Create a comprehensive test file using `node:test` and `node:assert/strict` (matching project convention). Use a temporary directory with `fs.mkdtempSync` in `beforeEach`, clean up with `fs.rmSync` in `afterEach`.

### Test structure

```
describe('branding-artifacts.cjs', () => {
  describe('getManifestPath()', ...)
  describe('loadManifest()', ...)
  describe('saveManifest()', ...)
  describe('createArtifact()', ...)
  describe('listArtifacts()', ...)
  describe('getArtifact()', ...)
  describe('deleteArtifact()', ...)
  describe('listUntrackedFiles()', ...)
})
```

### Required test cases

1. **getManifestPath** -- returns correct absolute path joining projectRoot + `.planning/branding/artifacts.json`

2. **loadManifest** -- returns empty array when `artifacts.json` does not exist

3. **loadManifest** -- returns parsed array when valid `artifacts.json` exists

4. **loadManifest** -- throws on invalid JSON in `artifacts.json` (e.g., `{not: "an array"}`)

5. **saveManifest** -- writes valid manifest to disk, re-readable by `loadManifest`

6. **saveManifest** -- throws when given invalid data (e.g., entry missing `id` field)

7. **createArtifact** -- creates entry with UUID id, ISO createdAt, correct type/filename/description

8. **createArtifact** -- appends to existing manifest without clobbering

9. **listArtifacts** -- returns all entries from manifest

10. **getArtifact** -- returns entry by id, null for missing id

11. **deleteArtifact** -- removes entry from manifest and deletes physical file

12. **deleteArtifact** -- returns `{ deleted: false }` for non-existent id

13. **deleteArtifact** -- succeeds even when physical file does not exist (manifest-only entry)

14. **listUntrackedFiles** -- returns files not in manifest, excludes infrastructure files (`artifacts.json`, `.server.pid`, `index.html`)

15. **listUntrackedFiles** -- returns empty array when all files are tracked

### Setup helper

Each test's `beforeEach` must create the temp directory structure:
```javascript
tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-artifacts-test-'));
const brandingDir = path.join(tmpDir, '.planning', 'branding');
fs.mkdirSync(brandingDir, { recursive: true });
```

**Verification:**

```bash
cd /home/kek/Projects/RAPID && node --test src/lib/branding-artifacts.test.cjs
```

**Done when:** All 15 test cases pass. Zero failures, zero skips.

---

## Task 3: Add SSE Infrastructure to branding-server.cjs

**Files:** `src/lib/branding-server.cjs`

**Action:**

Add SSE endpoint, connection tracking, fs.watch auto-reload, and the `notifyClients` function to the existing server module. This modifies the existing file -- do NOT rewrite it from scratch.

### Module-level state (add near top, after existing `_activeServer`)

```javascript
/** @type {Set<import('node:http').ServerResponse>} */
let _sseClients = new Set();
const MAX_SSE_CLIENTS = 10;

/** @type {import('node:fs').FSWatcher|null} */
let _fsWatcher = null;

/** @type {NodeJS.Timeout|null} */
let _debounceTimer = null;
const DEBOUNCE_MS = 300;
```

### New internal functions

1. **`_escapeHtml(str)`** -- Escape `&`, `<`, `>`, `"`, `'` characters. Return the escaped string. This is critical for XSS prevention in the hub page.

2. **`notifyClients(event, data)`** -- Iterate over `_sseClients`. For each client response, write SSE-formatted data:
   ```
   event: {event}\ndata: {JSON.stringify(data)}\n\n
   ```
   If `res.writableEnded` is true, remove it from the set. This handles stale connections.

3. **`_handleSSE(req, res)`** -- SSE endpoint handler:
   - If `_sseClients.size >= MAX_SSE_CLIENTS`, respond 503 with JSON error body.
   - Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `Access-Control-Allow-Origin: *`.
   - Write initial `: connected\n\n` comment as keep-alive.
   - Add `res` to `_sseClients`.
   - On `req.on('close')`, remove `res` from `_sseClients`.

4. **`_startFileWatcher(brandingDir)`** -- Start `fs.watch(brandingDir, { recursive: false })` with an AbortController signal stored for cleanup. On any event, debounce with `clearTimeout`/`setTimeout` at `DEBOUNCE_MS`. When the debounce fires, call `notifyClients('file-changed', { directory: brandingDir, timestamp: new Date().toISOString() })`. Ignore the `filename` argument from fs.watch (per research findings -- re-scan is done by the hub page on reload). Store watcher reference in `_fsWatcher`.

5. **`_stopFileWatcher()`** -- Close the watcher if active. Clear debounce timer. Set `_fsWatcher = null`.

6. **`_closeAllSSEClients()`** -- Iterate `_sseClients`, call `res.end()` on each, then `_sseClients.clear()`.

### Modifications to existing functions

1. **`_handleRequest`** -- Add two new route branches BEFORE the static file catch-all:
   - `GET /_events` -> call `_handleSSE(req, res); return;`
   - Routes for `POST /_artifacts`, `GET /_artifacts`, `DELETE /_artifacts` will be added in Wave 2 -- do NOT add them now. Instead, add a comment placeholder: `// Wave 2: artifact CRUD endpoints go here`

2. **`start()`** -- After `server.listen()` succeeds and before `resolve()`:
   - Call `_startFileWatcher(brandingDir)` to begin watching for file changes.
   - The watcher must start AFTER the server is listening.

3. **`stop()`** -- Before `_activeServer.close()`:
   - Call `_closeAllSSEClients()` to cleanly close all SSE connections.
   - Call `_stopFileWatcher()` to stop the file watcher.

### Updated exports

Add these to the `module.exports` object:
- `notifyClients` (public API -- used by branding skill and artifact CRUD)
- `_escapeHtml` (testing)
- `_sseClients` getter or direct reference (testing -- for connection count assertions)
- `MAX_SSE_CLIENTS` (testing)

### SSE deduplication note

When both fs.watch and CRUD API can fire events, the CRUD API should call `notifyClients` with typed events (`artifact-created`, etc.) while fs.watch always fires `file-changed`. The client-side JS (Wave 2) handles dedup by debouncing incoming events before triggering a refresh. No server-side dedup needed.

### What NOT to do

- Do NOT modify `_generateHubPage` in this wave -- that is Wave 2.
- Do NOT add CRUD endpoint handlers in this wave -- that is Wave 2.
- Do NOT change the existing test file in this wave -- new SSE tests are in Task 4.

**Verification:**

```bash
node -e "const s = require('./src/lib/branding-server.cjs'); console.log('notifyClients:', typeof s.notifyClients); console.log('_escapeHtml:', typeof s._escapeHtml); console.log('MAX_SSE_CLIENTS:', s.MAX_SSE_CLIENTS); console.log('OK')"
```

**Done when:** Module loads without error. `notifyClients`, `_escapeHtml`, and `MAX_SSE_CLIENTS` are exported. Existing tests still pass.

---

## Task 4: Add SSE and fs.watch tests to branding-server.test.cjs

**Files:** `src/lib/branding-server.test.cjs`

**Action:**

Extend the existing test file with new `describe` blocks for SSE and fs.watch functionality. Do NOT remove or modify any existing tests.

### New helper function

Add a helper to connect to the SSE endpoint and collect events:

```javascript
function _connectSSE(port) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/_events`, (res) => {
      const events = [];
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk;
        // Parse SSE events from buffer
        const parts = buffer.split('\n\n');
        buffer = parts.pop(); // keep incomplete part
        for (const part of parts) {
          if (part.startsWith(':')) continue; // comment
          const lines = part.split('\n');
          const event = {};
          for (const line of lines) {
            if (line.startsWith('event: ')) event.type = line.slice(7);
            if (line.startsWith('data: ')) event.data = JSON.parse(line.slice(6));
          }
          if (event.type || event.data) events.push(event);
        }
      });
      resolve({ res, events });
    }).on('error', reject);
  });
}
```

### New test cases

Add these inside the existing `describe('branding-server.cjs', ...)` block:

**describe('SSE endpoint (/_events)')**

1. **'connects and receives initial comment'** -- Start server, GET `/_events`, verify response status is 200, `Content-Type` is `text/event-stream`, and the first data received starts with `: connected`.

2. **'receives events from notifyClients'** -- Start server, connect to SSE, call `server.notifyClients('artifact-created', { id: 'test-1', type: 'logo' })`. Verify the SSE client receives an event with type `artifact-created` and data containing `id: 'test-1'`. Use a short `setTimeout` (50ms) to allow event propagation.

3. **'enforces max 10 concurrent connections'** -- Start server, open 10 SSE connections, attempt an 11th. Verify the 11th returns status 503.

4. **'cleans up connections on client disconnect'** -- Start server, open SSE connection, verify `_sseClients.size` is 1. Destroy the client request. Wait 50ms. Verify `_sseClients` set is cleaned up on next `notifyClients` call (stale connection removal).

5. **'stop() closes all SSE connections'** -- Start server, open 2 SSE connections. Call `server.stop()`. Verify all connections are ended.

**describe('_escapeHtml()')**

6. **'escapes HTML special characters'** -- Verify `_escapeHtml('<script>alert("xss")</script>')` returns `'&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'`. Also test `&` -> `&amp;` and `'` -> `&#39;`.

7. **'returns safe strings unchanged'** -- Verify `_escapeHtml('hello world')` returns `'hello world'`.

**describe('fs.watch integration')**

8. **'file changes trigger SSE events'** -- Start server, connect to SSE. Write a new file to the branding directory. Wait 500ms (debounce + propagation). Verify SSE client received a `file-changed` event.

### Important test conventions

- Use the existing `_getFreePort()` helper for port allocation.
- Use the existing `tmpDir` setup/teardown from `beforeEach`/`afterEach`.
- Always call `server.stop(tmpDir)` in `afterEach` (already present).
- For SSE tests, always destroy the client response in `afterEach` to prevent hanging connections.

**Verification:**

```bash
cd /home/kek/Projects/RAPID && node --test src/lib/branding-server.test.cjs
```

**Done when:** All existing tests still pass. All 8 new tests pass. Zero failures.

---

## Success Criteria

- [ ] `branding-artifacts.cjs` exports 8 functions + 3 constants/schemas, loads without error
- [ ] `branding-artifacts.test.cjs` has 15 test cases, all passing
- [ ] `branding-server.cjs` has SSE endpoint at `/_events`, connection tracking, fs.watch, `notifyClients`
- [ ] `branding-server.test.cjs` has 8 new test cases (SSE, escaping, fs.watch), all passing
- [ ] All existing branding-server tests still pass (no regressions)
- [ ] Zero new npm dependencies added
- [ ] `node --test src/lib/branding-artifacts.test.cjs src/lib/branding-server.test.cjs` exits 0
