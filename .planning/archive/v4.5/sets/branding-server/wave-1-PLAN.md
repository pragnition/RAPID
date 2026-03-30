# PLAN: branding-server / Wave 1 -- Core Server Module

## Objective

Build `src/lib/branding-server.cjs` -- a lightweight Node.js HTTP server that serves `.planning/branding/` as a styled directory index with PID-file-based lifecycle management. This wave produces the complete module with `start()`, `stop()`, `status()` API. No tests or SKILL.md changes in this wave.

## Owned Files

| File | Action |
|------|--------|
| `src/lib/branding-server.cjs` | Create |

## Prerequisites

- None. This set has no imports from other sets.

## Tasks

### Task 1: Create `src/lib/branding-server.cjs` with full server API

Create the module following the project's CommonJS conventions (`'use strict'`, `require()`, JSDoc, `module.exports` at bottom, `_` prefix for internal helpers).

**Module structure:**

```
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
```

**Constants:**
- `DEFAULT_PORT = 3141`
- `PID_FILE_NAME = '.server.pid'`
- `BRANDING_DIR_NAME = '.planning/branding'`
- `HEALTH_PROBE_TIMEOUT = 1000` (ms)

**PID file format** (JSON):
```json
{ "pid": 12345, "port": 3141, "startedAt": "2026-03-26T..." }
```

PID file location: `<projectRoot>/.planning/branding/.server.pid`

**Internal helpers to implement:**

1. `_getBrandingDir(projectRoot)` -- Returns absolute path to `.planning/branding/` directory. Validates it exists, returns `null` if not.

2. `_getPidFilePath(projectRoot)` -- Returns absolute path to the PID file.

3. `_readPidFile(projectRoot)` -- Reads and parses the PID file. Returns `null` if file does not exist or is malformed JSON. Never throws.

4. `_writePidFile(projectRoot, pid, port)` -- Writes PID file with `{ pid, port, startedAt: new Date().toISOString() }`.

5. `_removePidFile(projectRoot)` -- Removes PID file if it exists. Never throws.

6. `_isProcessAlive(pid)` -- Uses `process.kill(pid, 0)` wrapped in try/catch. Returns `true` if the process is running, `false` otherwise.

7. `_httpHealthProbe(port)` -- Makes an HTTP GET to `http://localhost:{port}/_health` with a 1-second timeout. Returns `true` if it gets a 200 response, `false` otherwise. Uses `node:http.get()`. The probe must clean up the socket on timeout/error.

8. `_isStale(pidData)` -- Combines `_isProcessAlive(pidData.pid)` AND `_httpHealthProbe(pidData.port)`. If EITHER check fails, the PID is stale. Returns `Promise<boolean>` (true = stale).

9. `_getMimeType(filePath)` -- Returns MIME type string based on file extension. Support these extensions:
   - `.html` -> `text/html`
   - `.css` -> `text/css`
   - `.js` -> `application/javascript`
   - `.json` -> `application/json`
   - `.md` -> `text/plain; charset=utf-8`
   - `.svg` -> `image/svg+xml`
   - `.png` -> `image/png`
   - `.jpg`/`.jpeg` -> `image/jpeg`
   - Default: `application/octet-stream`

10. `_generateHubPage(brandingDir)` -- Reads the directory listing of `brandingDir` using `fs.readdirSync()`. Returns an HTML string styled with a dark theme (matching the existing `index.html` palette: `#0d1117` background, `#c9d1d9` text, `#58a6ff` accent). The hub page should:
    - Have a title "RAPID Branding Hub"
    - Link to `/index.html` prominently as "Visual Preview"
    - List all other files in the directory as links (skip `.server.pid`)
    - Use inline CSS, no external dependencies
    - Be self-contained HTML

11. `_handleRequest(req, res, brandingDir)` -- The HTTP request handler:
    - `GET /_health` -> respond 200 with `{"status":"ok"}`
    - `GET /` -> respond with the hub page from `_generateHubPage()`
    - `GET /<file>` -> serve the file from `brandingDir` using `fs.createReadStream().pipe(res)`
    - **Path traversal prevention:** Resolve the requested path with `path.resolve(brandingDir, ...)` and verify the result `startsWith(brandingDir)`. If not, respond 403.
    - If file does not exist, respond 404 with a simple HTML error page.
    - Set correct `Content-Type` header using `_getMimeType()`.
    - Only serve files, not subdirectories (no recursive directory listing).

**Public API to implement:**

1. `async function start(projectRoot, port)`:
   - Default `port` to `DEFAULT_PORT` if not provided.
   - Check `_getBrandingDir(projectRoot)`. If null, return `{ error: 'Branding directory does not exist. Run /rapid:branding first.' }`.
   - Read existing PID file via `_readPidFile()`.
   - If PID data exists, check staleness via `_isStale()`:
     - If NOT stale (server is already running): return `{ error: 'already_running', pid: pidData.pid, port: pidData.port }`. Do NOT kill and restart.
     - If stale: clean up via `_removePidFile()` and continue.
   - Create HTTP server via `http.createServer()` with `_handleRequest` as the handler.
   - Call `server.listen(port, '127.0.0.1')`.
   - Handle `'error'` event on the server. If `error.code === 'EADDRINUSE'`, return `{ error: 'port_in_use', port }`. For other errors, return `{ error: error.message }`.
   - On `'listening'` event: write PID file via `_writePidFile(projectRoot, process.pid, port)`.
   - Return `{ pid: process.pid, port, server }` on success. The `server` reference is needed for `stop()`.
   - Store the server reference in a module-level variable `_activeServer` so `stop()` can close it.

2. `async function stop(projectRoot)`:
   - Read PID file. If no PID file, return `{ error: 'not_running' }`.
   - If `_activeServer` exists (same process), call `_activeServer.close()` and set `_activeServer = null`.
   - If PID file exists but `_activeServer` is null (different process or stale), just remove PID file.
   - Remove PID file via `_removePidFile()`.
   - Return `{ stopped: true }`.

3. `function status(projectRoot)`:
   - Read PID file. If no PID file, return `{ running: false }`.
   - Check if process is alive via `_isProcessAlive(pidData.pid)`.
   - If alive, return `{ running: true, pid: pidData.pid, port: pidData.port }`.
   - If not alive, clean up stale PID file and return `{ running: false }`.
   - Note: `status()` is synchronous except for the stale check. Since `_httpHealthProbe` is async, make `status()` synchronous by only checking `_isProcessAlive()` (the process signal check). The full stale check (with HTTP probe) is only used in `start()`.

**Module exports:**
```javascript
module.exports = {
  start,
  stop,
  status,
  DEFAULT_PORT,
  // Export internals for testing (prefixed):
  _isProcessAlive,
  _httpHealthProbe,
  _getMimeType,
  _generateHubPage,
  _readPidFile,
  _writePidFile,
  _removePidFile,
};
```

Export the `_` prefixed helpers so the test file in Wave 2 can unit-test them individually.

**What NOT to do:**
- Do NOT use `child_process.spawn` or `child_process.fork`. The server runs in-process.
- Do NOT use any npm packages. Only `node:http`, `node:fs`, `node:path`.
- Do NOT serve files outside `.planning/branding/`. The path traversal check is critical.
- Do NOT auto-open the browser from this module. That is the SKILL.md's responsibility.
- Do NOT make `status()` async -- keep it synchronous with just the PID signal check.

**Verification:**

```bash
cd /home/kek/Projects/RAPID && node -e "const m = require('./src/lib/branding-server.cjs'); console.log(Object.keys(m));"
```

Expected output should include: `start`, `stop`, `status`, `DEFAULT_PORT`, `_isProcessAlive`, `_httpHealthProbe`, `_getMimeType`, `_generateHubPage`, `_readPidFile`, `_writePidFile`, `_removePidFile`.

```bash
cd /home/kek/Projects/RAPID && node -e "
const m = require('./src/lib/branding-server.cjs');
(async () => {
  const result = await m.start(process.cwd());
  if (result.error) { console.log('Start error:', result.error); process.exit(0); }
  console.log('Started on port', result.port, 'pid', result.pid);
  const s = m.status(process.cwd());
  console.log('Status:', JSON.stringify(s));
  const stopResult = await m.stop(process.cwd());
  console.log('Stop:', JSON.stringify(stopResult));
  const s2 = m.status(process.cwd());
  console.log('After stop:', JSON.stringify(s2));
})();
"
```

Expected: Server starts on port 3141, status shows running, stop succeeds, status shows not running.

## Success Criteria

- [ ] `src/lib/branding-server.cjs` exists and exports `start`, `stop`, `status`, `DEFAULT_PORT`
- [ ] Server starts on default port 3141, serves `.planning/branding/` files
- [ ] Hub page at `/` lists branding artifacts with links
- [ ] `/_health` endpoint returns 200 JSON
- [ ] PID file created on start, removed on stop
- [ ] Path traversal is blocked (requests for `../` return 403)
- [ ] Port conflict returns `{ error: 'port_in_use' }` instead of crashing
- [ ] Already-running server returns `{ error: 'already_running' }` instead of restarting
- [ ] Stale PID files are detected and cleaned up
- [ ] No new npm dependencies
- [ ] Module loads without errors: `node -e "require('./src/lib/branding-server.cjs')"`
