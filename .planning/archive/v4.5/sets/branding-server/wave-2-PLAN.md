# PLAN: branding-server / Wave 2 -- Tests and Skill Integration

## Objective

Write comprehensive unit tests for the branding server module, then update the branding SKILL.md to replace the static HTML file-open workflow with the new server-based workflow. This wave depends on Wave 1 (`branding-server.cjs` existing and exporting the full API).

## Owned Files

| File | Action |
|------|--------|
| `src/lib/branding-server.test.cjs` | Create |
| `skills/branding/SKILL.md` | Modify |

## Prerequisites

- Wave 1 complete: `src/lib/branding-server.cjs` exists with `start`, `stop`, `status` exports.

## Tasks

### Task 1: Create `src/lib/branding-server.test.cjs`

Write unit tests using `node:test` and `node:assert/strict` following the project's co-located test conventions (see `web-client.test.cjs`, `lock.test.cjs` for patterns).

**Test setup pattern:**
```javascript
'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
```

**Test scaffolding:** Each test group that needs a branding directory should:
- Create a temp directory via `fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-branding-test-'))`
- Create `.planning/branding/` inside it with `fs.mkdirSync(..., { recursive: true })`
- Write a minimal `index.html` file (just `<h1>Test</h1>`)
- Clean up in `afterEach`: stop any running server, remove temp dir recursively

**CRITICAL: Port selection.** All tests MUST use port `0` (OS-assigned random port) to avoid port conflicts between parallel test runs. After `start()` returns, use the returned `port` value for assertions and HTTP requests. Never hardcode port 3141 in tests.

**Test cases to implement (10 tests across 6 describe blocks):**

#### `describe('start()')`

1. **starts server and returns pid and port** -- Call `start(tmpDir, 0)`. Assert result has `pid` (number), `port` (number > 0), `server` (object). Verify PID file exists at `.planning/branding/.server.pid`. Read PID file and verify it contains the correct pid and port.

2. **returns error when branding directory does not exist** -- Call `start(tmpDir)` where `.planning/branding/` was NOT created. Assert result has `error` containing "Branding directory".

3. **returns already_running when server is active** -- Call `start()` once (port 0), then call `start()` again with the same `projectRoot`. Assert second call returns `{ error: 'already_running', pid, port }`.

4. **returns port_in_use when port is occupied** -- Start a dummy `http.createServer()` on a random port. Then call `start(tmpDir, thatPort)`. Assert result has `error: 'port_in_use'`. Clean up the dummy server.

#### `describe('stop()')`

5. **stops running server and removes PID file** -- Start server, then call `stop()`. Assert result is `{ stopped: true }`. Assert PID file no longer exists. Make an HTTP request to the old port and verify it fails (connection refused).

6. **returns not_running when no server is active** -- Call `stop()` without starting. Assert result has `error: 'not_running'`.

#### `describe('status()')`

7. **returns running state when server is active** -- Start server (port 0), call `status()`. Assert `{ running: true, pid: <number>, port: <number> }`.

8. **returns not-running when no server** -- Call `status()` on a fresh tmpDir. Assert `{ running: false }`.

9. **cleans up stale PID file** -- Manually write a PID file with a non-existent PID (use a very high PID number like 999999). Call `status()`. Assert it returns `{ running: false }`. Assert PID file was removed (stale cleanup).

#### `describe('_getMimeType()')`

10. **returns correct MIME types** -- Test the following mappings:
    - `'foo.html'` -> `'text/html'`
    - `'foo.css'` -> `'text/css'`
    - `'foo.js'` -> `'application/javascript'`
    - `'foo.json'` -> `'application/json'`
    - `'foo.md'` -> `'text/plain; charset=utf-8'`
    - `'foo.svg'` -> `'image/svg+xml'`
    - `'foo.png'` -> `'image/png'`
    - `'foo.xyz'` -> `'application/octet-stream'`

#### `describe('HTTP serving')`

11. **serves files from branding directory** -- Start server (port 0). Make HTTP GET to `/index.html`. Assert 200 status and body contains the test HTML content.

12. **returns hub page at root** -- Start server (port 0). Make HTTP GET to `/`. Assert 200 status and body contains "RAPID Branding Hub" and a link to `/index.html`.

13. **returns 404 for missing files** -- Start server (port 0). Make HTTP GET to `/nonexistent.txt`. Assert 404 status.

14. **blocks path traversal** -- Start server (port 0). Make HTTP GET to `/../../../etc/passwd`. Assert 403 status.

15. **health endpoint returns 200** -- Start server (port 0). Make HTTP GET to `/_health`. Assert 200 status and JSON body `{"status":"ok"}`.

**Helper for HTTP requests in tests:** Write a small `_fetch(port, path)` helper inside the test file that returns a Promise resolving to `{ status, headers, body }` using `http.get()`. This avoids repeating boilerplate.

**What NOT to do:**
- Do NOT use port 3141 in any test. Always use port 0.
- Do NOT leave servers running after tests. Every `afterEach` must call `stop()`.
- Do NOT import or mock external npm packages. The module uses only Node.js built-ins.
- Do NOT test the hub page's CSS/styling. Only test that it contains the expected links and text.

**Verification:**

```bash
cd /home/kek/Projects/RAPID && node --test src/lib/branding-server.test.cjs
```

Expected: All tests pass. Zero failures.

---

### Task 2: Update `skills/branding/SKILL.md` to use server

Modify the existing SKILL.md to replace the static file workflow with the branding server. The changes are localized to Steps 6, 7, and a new Step 8.

**Changes to make:**

#### Replace Step 6 (currently "Generate Static HTML Branding Page")

Keep the existing Step 6 content that generates `index.html` via the Write tool -- the HTML file is still generated as before. But ADD a new sub-step at the end of Step 6:

After the `index.html` is written, start the branding server:

````markdown
### Start Branding Server

After writing `index.html`, start the branding server to serve the artifacts:

```bash
# (env preamble here)
node -e "
const server = require('./src/lib/branding-server.cjs');
(async () => {
  const result = await server.start(process.cwd());
  if (result.error === 'already_running') {
    console.log('Branding server already running at http://localhost:' + result.port);
  } else if (result.error === 'port_in_use') {
    console.log('PORT_CONFLICT:' + 3141);
  } else if (result.error) {
    console.log('SERVER_ERROR:' + result.error);
  } else {
    console.log('Branding server started at http://localhost:' + result.port);
  }
})();
"
```

**Handle server start results:**
- If output contains `PORT_CONFLICT`: Use AskUserQuestion to prompt the user for an alternative port:
  ```
  "Port 3141 is already in use. Which port should the branding server use?"
  Options:
  - "3142" -- "Try the next port"
  - "8080" -- "Use common alternative port"
  - "Other" -- "Enter a custom port number"
  ```
  Then retry `server.start(process.cwd(), <chosen_port>)`.
- If output contains `SERVER_ERROR`: Display the error message clearly: `"[RAPID ERROR] Branding server failed to start: {error}. The branding artifacts are still available at .planning/branding/ but cannot be served via HTTP."` Do NOT attempt a file:// fallback.
- If output contains `already running`: Display the URL and continue.
- If server started successfully: Display `"Branding preview available at http://localhost:{port}"`.
````

#### Replace Step 7 (currently "Auto-Open HTML Page")

Replace the entire Step 7 content with:

````markdown
## Step 7: Display Server URL

Display the branding server URL for the user. Do NOT auto-open the browser.

```
Branding preview available at: http://localhost:{port}

Open this URL in your browser to view the branding guidelines.
The server will remain running until you stop it.
```
````

#### Add new Step 8 (before the existing commit step)

Renumber the existing Step 8 (Commit and Summary) to Step 9. Insert a new Step 8:

````markdown
## Step 8: Server Lifecycle

After the user has reviewed the branding preview, use AskUserQuestion to ask:

```
"Would you like to stop the branding server?"
Options:
- "Yes, stop it" -- "Shut down the branding preview server"
- "No, keep it running" -- "Leave the server running for continued preview"
```

If the user chooses to stop:

```bash
node -e "
const server = require('./src/lib/branding-server.cjs');
server.stop(process.cwd()).then(r => console.log(JSON.stringify(r)));
"
```

If the user chooses to keep running, note in the summary that the server is still active.
````

#### Update Step 9 (formerly Step 8, Commit and Summary)

Update the summary output to mention the server status:

```
Branding artifacts generated:
- .planning/branding/BRANDING.md -- Authoritative branding guidelines ({line_count} lines)
- .planning/branding/index.html -- Visual branding reference page
- Branding server: {running|stopped} (http://localhost:{port})

Branding context will be automatically injected into all future RAPID execution prompts.
```

**What NOT to do:**
- Do NOT remove the existing HTML generation logic in Step 6. The `index.html` is still generated -- the server serves it.
- Do NOT change Steps 1-5. They are unmodified.
- Do NOT add `branding-server.cjs` to the git add in the commit step -- it is committed separately by the set workflow.
- Do NOT add a `file://` fallback. The CONTEXT.md explicitly says "Server only, no file:// fallback."
- Do NOT auto-open the browser. Display the URL only.

**Verification:**

```bash
cd /home/kek/Projects/RAPID && head -5 skills/branding/SKILL.md
```

Confirm the file still has the correct YAML frontmatter.

```bash
cd /home/kek/Projects/RAPID && grep -c "branding-server" skills/branding/SKILL.md
```

Expected: At least 2 occurrences (server start and server stop references).

```bash
cd /home/kek/Projects/RAPID && grep -n "Step [0-9]" skills/branding/SKILL.md
```

Expected: Steps 1 through 9 in order.

## Success Criteria

- [ ] `src/lib/branding-server.test.cjs` exists with 15 test cases
- [ ] All tests pass: `node --test src/lib/branding-server.test.cjs` exits 0
- [ ] `skills/branding/SKILL.md` references `branding-server.cjs` for server lifecycle
- [ ] Step 7 displays URL instead of auto-opening browser
- [ ] Step 8 asks user about stopping the server via AskUserQuestion
- [ ] Steps 1-5 are unchanged
- [ ] No `xdg-open` or `open` commands remain in the skill
- [ ] No `file://` fallback logic exists
- [ ] Port conflict handling prompts user for alternative port
