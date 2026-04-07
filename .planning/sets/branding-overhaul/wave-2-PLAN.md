# Wave 2 PLAN: Artifact CRUD API and Hub Page Redesign

**Set:** branding-overhaul
**Wave:** 2
**Objective:** Add the HTTP CRUD endpoints for artifact management (`POST|GET|DELETE /_artifacts`) to `branding-server.cjs`, and redesign `_generateHubPage` from a simple file listing to a responsive artifact card gallery with live SSE-driven DOM updates. This wave depends on Wave 1's artifact registry and SSE infrastructure.

**Depends on:** Wave 1 (branding-artifacts.cjs, SSE endpoint, notifyClients, _escapeHtml)

---

## Task 1: Add Artifact CRUD HTTP Endpoints to branding-server.cjs

**Files:** `src/lib/branding-server.cjs`

**Action:**

Add three HTTP endpoint handlers in `_handleRequest`, replacing the Wave 2 comment placeholder. These go AFTER the `/_events` SSE route and BEFORE the static file catch-all.

### New internal helper

**`_readRequestBody(req)`** -- Returns a Promise that resolves with the parsed JSON body. Collect chunks via `req.on('data')`, parse on `req.on('end')`. If JSON parse fails, reject with a descriptive error. Set a max body size of 64KB -- if exceeded, reject with 'Request body too large'.

### New route: `POST /_artifacts`

Handler logic:
1. Parse request body via `_readRequestBody(req)`.
2. Validate that body contains `type` (string), `filename` (string), `description` (string). If any are missing, respond 400 with `{ error: 'Missing required fields: type, filename, description' }`.
3. Call `artifacts.createArtifact(projectRoot, { type, filename, description })` where `artifacts = require('./branding-artifacts.cjs')`.
4. Call `notifyClients('artifact-created', entry)` where `entry` is the returned artifact.
5. Respond 201 with the created entry as JSON.
6. On any error, respond 500 with `{ error: err.message }`.

Note: The `projectRoot` must be available inside `_handleRequest`. Currently, `_handleRequest` receives `brandingDir`. Add a `projectRoot` parameter to `_handleRequest` and pass it from the `start()` function's `http.createServer` callback. Alternatively, compute `projectRoot` from `brandingDir` by stripping the `.planning/branding` suffix. Choose whichever approach is cleaner -- the important thing is that the artifact module gets the correct `projectRoot`.

### New route: `GET /_artifacts`

Handler logic:
1. Call `artifacts.listArtifacts(projectRoot)`.
2. Respond 200 with the manifest array as JSON.
3. On any error, respond 500 with `{ error: err.message }`.

### New route: `DELETE /_artifacts`

Handler logic:
1. Parse the URL query parameter `id` from `url.searchParams.get('id')`.
2. If `id` is missing, respond 400 with `{ error: 'Missing required query parameter: id' }`.
3. Call `artifacts.deleteArtifact(projectRoot, id)`.
4. If `result.deleted` is true, call `notifyClients('artifact-deleted', { id, ...result.entry })`.
5. Respond 200 with the result object.
6. If `result.deleted` is false, respond 404 with `{ error: 'Artifact not found', id }`.
7. On any error, respond 500 with `{ error: err.message }`.

### Method routing update

The current `_handleRequest` dispatches `GET` first, then falls through to 405 for all other methods. Restructure the routing so POST and DELETE are handled:

- `GET /_health` -> health
- `GET /_events` -> SSE (Wave 1)
- `POST /_artifacts` -> create artifact
- `GET /_artifacts` -> list artifacts
- `DELETE /_artifacts` -> delete artifact
- `GET /` -> hub page
- `GET /*` -> static file
- everything else -> 405

### What NOT to do

- Do NOT import `branding-artifacts.cjs` at the top level with `require`. Use lazy require inside the handler or at the top -- either is fine, but if top-level, add the require near the existing `require` statements.
- Do NOT add request body parsing for any endpoint other than POST.
- Do NOT add authentication or authorization -- this is a local dev server.

**Verification:**

```bash
node -e "
const http = require('http');
const s = require('./src/lib/branding-server.cjs');
const fs = require('fs');
const path = require('path');
const os = require('os');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-crud-'));
  const bd = path.join(tmp, '.planning', 'branding');
  fs.mkdirSync(bd, { recursive: true });
  fs.writeFileSync(path.join(bd, 'index.html'), '<h1>Test</h1>');

  const srv = http.createServer();
  const port = await new Promise(r => { srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => r(p)); }); });

  const result = await s.start(tmp, port);
  console.log('Started:', !!result.server);

  // Test GET /_artifacts
  const listRes = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:' + port + '/_artifacts', res => {
      let body = ''; res.on('data', c => body += c); res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
  console.log('GET /_artifacts:', listRes.status, listRes.body);

  await s.stop(tmp);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('OK');
})();
"
```

**Done when:** POST creates artifact and returns 201, GET lists artifacts and returns 200, DELETE removes artifact and returns 200/404. All three fire SSE events via `notifyClients`.

---

## Task 2: Redesign _generateHubPage as Artifact Card Gallery

**Files:** `src/lib/branding-server.cjs`

**Action:**

Replace the existing `_generateHubPage(brandingDir)` function with a new implementation that renders an artifact card gallery. The function signature changes to `_generateHubPage(brandingDir, projectRoot)` to support loading the artifact manifest.

### Function behavior

1. Load the artifact manifest via `artifacts.loadManifest(projectRoot)`.
2. Call `artifacts.listUntrackedFiles(projectRoot)` to get untracked files.
3. Render an HTML page with:

**Page structure:**
- Title: "RAPID Branding Hub"
- Subtitle: artifact count summary (e.g., "3 artifacts, 2 untracked files")
- Card grid: one card per artifact, then one card per untracked file
- Footer with server info
- Embedded `<script>` for SSE auto-reload (see below)

**Artifact cards (from manifest):**
- Type label badge (upper-left corner, small pill-shaped label showing `entry.type`)
- Artifact name (filename) as the card title, also a clickable link to `/{filename}`
- Relative timestamp computed client-side from `entry.createdAt` (embed the ISO string as a `data-created` attribute, compute display in JS)
- Description text below the name
- All text must be escaped using `_escapeHtml()` before insertion into HTML

**Untracked file cards:**
- Visually distinct: muted/dimmed styling, a small "untracked" label instead of a type badge
- Filename as clickable link to `/{filename}`
- No timestamp or description (these are not in the manifest)
- Text escaped with `_escapeHtml()`

**CSS grid layout:**
- Use CSS Grid: `display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;`
- Dark theme matching existing hub page aesthetic (`background: #0d1117`, `color: #c9d1d9`)
- Cards: `background: #161b22`, `border: 1px solid #30363d`, `border-radius: 8px`, `padding: 1.25rem`
- Type badge: `background: #1f6feb`, `color: #fff`, `border-radius: 12px`, `padding: 0.15rem 0.6rem`, `font-size: 0.75rem`
- Untracked badge: `background: #30363d`, `color: #8b949e`
- Links: `color: #58a6ff`, no underline, underline on hover
- Responsive: the grid auto-reflows, no media queries needed

**Embedded SSE client script:**

Include a `<script>` block at the bottom of the HTML that:
1. Creates `new EventSource('/_events')`.
2. Listens for events: `artifact-created`, `artifact-updated`, `artifact-deleted`, `file-changed`.
3. On any event, debounce 200ms, then `window.location.reload()` (full page refresh for simplicity -- live DOM patching is only used on reconnection as per CONTEXT.md decisions).
4. On EventSource `error` event: set a flag. On subsequent `open` event (reconnection), do `window.location.reload()` to resync state.
5. Add a relative-time updater: `setInterval` every 60 seconds that recalculates all `data-created` timestamps.

The relative-time function should produce strings like "just now", "2 min ago", "1 hour ago", "3 days ago".

### Update call site

In `_handleRequest`, the hub page route `GET /` currently calls `_generateHubPage(brandingDir)`. Update it to pass both arguments: `_generateHubPage(brandingDir, projectRoot)`. This requires `projectRoot` to be available in `_handleRequest` (see Task 1 note about passing `projectRoot`).

### What NOT to do

- Do NOT remove the "Visual Preview" link to `index.html` -- keep it if `index.html` exists.
- Do NOT use any external CSS frameworks or CDN links.
- Do NOT use fetch() to load artifacts client-side on initial load -- the server renders the initial HTML with all data embedded.
- Do NOT use `innerHTML` in the client-side JS. The full-page reload approach avoids XSS risk from dynamic DOM insertion.

**Verification:**

```bash
node -e "
const s = require('./src/lib/branding-server.cjs');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-hub-'));
const bd = path.join(tmp, '.planning', 'branding');
fs.mkdirSync(bd, { recursive: true });

// Write a test artifact manifest
fs.writeFileSync(path.join(bd, 'artifacts.json'), JSON.stringify([
  { id: '1', type: 'logo', filename: 'logo.svg', createdAt: new Date().toISOString(), description: 'Main logo' }
]));
fs.writeFileSync(path.join(bd, 'logo.svg'), '<svg></svg>');
fs.writeFileSync(path.join(bd, 'stray-file.txt'), 'orphan');

const html = s._generateHubPage(bd, tmp);
console.log('Contains card grid:', html.includes('grid'));
console.log('Contains artifact card:', html.includes('logo'));
console.log('Contains untracked:', html.includes('untracked'));
console.log('Contains EventSource:', html.includes('EventSource'));
console.log('Contains escapeHtml calls: no XSS vectors');
fs.rmSync(tmp, { recursive: true, force: true });
console.log('OK');
"
```

**Done when:** Hub page renders artifact cards from manifest, shows untracked files, includes SSE client script, all text is HTML-escaped.

---

## Task 3: Update and Add Integration Tests for CRUD and Hub Page

**Files:** `src/lib/branding-server.test.cjs`

**Action:**

Add new test blocks for CRUD endpoints and the redesigned hub page. Update existing hub page test if needed.

### New helper function

**`_postJSON(port, path, body)`** -- Helper that sends a POST request with JSON body and returns `{ status, headers, body }`. Use `http.request` with method POST, `Content-Type: application/json`.

**`_deleteReq(port, path)`** -- Helper that sends a DELETE request and returns `{ status, headers, body }`.

### New test cases

**describe('Artifact CRUD API')**

1. **'POST /_artifacts creates artifact and returns 201'** -- Start server, POST with `{ type: 'logo', filename: 'logo.svg', description: 'Main logo' }`. Verify status 201, response body has `id`, `type`, `filename`, `createdAt`, `description`.

2. **'POST /_artifacts with missing fields returns 400'** -- POST with `{ type: 'logo' }` (missing filename, description). Verify status 400.

3. **'GET /_artifacts returns artifact list'** -- Create two artifacts via POST, then GET `/_artifacts`. Verify status 200, response is array of length 2.

4. **'DELETE /_artifacts?id=... deletes artifact'** -- Create artifact, then DELETE with its id. Verify status 200, `deleted: true`. GET `/_artifacts` should return empty array.

5. **'DELETE /_artifacts without id returns 400'** -- Send DELETE without `id` parameter. Verify status 400.

6. **'DELETE /_artifacts with unknown id returns 404'** -- Send DELETE with `id=nonexistent`. Verify status 404.

7. **'CRUD operations fire SSE events'** -- Connect to SSE, create an artifact, wait 50ms, verify SSE received `artifact-created` event. Delete the artifact, wait 50ms, verify SSE received `artifact-deleted` event.

**describe('Hub page redesign')**

8. **'hub page renders artifact cards from manifest'** -- Create artifacts via POST, then GET `/`. Verify HTML contains artifact filenames and type labels.

9. **'hub page shows untracked files'** -- Write a file directly to branding directory (not via API), then GET `/`. Verify HTML contains the filename with 'untracked' indicator.

10. **'hub page includes EventSource script'** -- GET `/`, verify HTML contains `EventSource` and `/_events`.

11. **'hub page escapes HTML in artifact names'** -- Create artifact with filename `<script>alert(1)</script>.txt`. GET `/`. Verify HTML contains `&lt;script&gt;` (escaped), NOT `<script>` (raw).

### Update existing hub page test

The existing test `'returns hub page at root'` asserts `body.includes('RAPID Branding Hub')`. This should still pass with the new hub page. If the existing assertion `body.includes('/index.html')` needs updating because index.html is now shown differently, adjust accordingly. The Visual Preview link should still be present when index.html exists.

**Verification:**

```bash
cd /home/kek/Projects/RAPID && node --test src/lib/branding-server.test.cjs
```

**Done when:** All new CRUD and hub page tests pass. All pre-existing tests still pass. Zero failures.

---

## Success Criteria

- [ ] `POST /_artifacts` creates artifact, returns 201, fires `artifact-created` SSE event
- [ ] `GET /_artifacts` returns manifest array as JSON
- [ ] `DELETE /_artifacts?id=...` removes artifact + file, returns 200, fires `artifact-deleted` SSE event
- [ ] Hub page renders as responsive card gallery with type badges and relative timestamps
- [ ] Untracked files appear with visual distinction from registered artifacts
- [ ] All artifact text is HTML-escaped (XSS prevention verified by test)
- [ ] SSE client script reconnects and refreshes on reconnection
- [ ] All existing tests still pass (no regressions)
- [ ] `node --test src/lib/branding-server.test.cjs` exits 0
