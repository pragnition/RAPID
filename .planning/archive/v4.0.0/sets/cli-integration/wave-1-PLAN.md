# Wave 1 PLAN: Core Web Client Module

## Objective

Create `src/lib/web-client.cjs` -- the single point of contact between the Node.js CLI and the Python web backend. This module provides `isWebEnabled()`, `registerProjectWithWeb()`, and `checkWebService()` with strict 2-second timeouts, graceful failure, and `RAPID_WEB=true` gating. Wave 2 consumes this module from skill files and prereqs.cjs.

Also create `src/lib/web-client.test.cjs` with comprehensive unit tests covering timeouts, env gating, graceful failure, and successful paths.

## Tasks

### Task 1: Implement `src/lib/web-client.cjs`

**File:** `src/lib/web-client.cjs` (NEW)

**Implementation:**

Create a CommonJS module exporting these functions:

1. **`isWebEnabled()`** -- Returns `boolean`.
   - Check `process.env.RAPID_WEB`. If it equals `'true'` (case-insensitive), return `true`.
   - If env var is not set, attempt to load from the `.env` file at the RAPID plugin root. The plugin root is determined by: look for `RAPID_TOOLS` env var and resolve `path.resolve(path.dirname(RAPID_TOOLS), '../..')`. If `RAPID_TOOLS` is not set, return `false`.
   - Read the `.env` file, find the `RAPID_WEB=true` line (if present), return `true`. Otherwise `false`.
   - Must NEVER throw. Catch all errors and return `false`.

2. **`getWebBaseUrl()`** -- Returns `string`. Internal helper, not exported.
   - Check `process.env.RAPID_WEB_HOST` and `process.env.RAPID_WEB_PORT`.
   - Default to `http://127.0.0.1:8998`.
   - Return `http://${host}:${port}`.

3. **`registerProjectWithWeb(projectRoot)`** -- Returns `Promise<{success: boolean, error?: string}>`.
   - If `!isWebEnabled()`, return `{success: false, error: 'RAPID_WEB not enabled'}` immediately. Do NOT make any HTTP call.
   - Derive project name from `path.basename(projectRoot)`.
   - Make a POST to `${getWebBaseUrl()}/api/projects` with JSON body `{path: projectRoot, name: projectName}`.
   - Use `AbortSignal.timeout(2000)` for the 2-second timeout.
   - On success (status 2xx), return `{success: true}`.
   - On ANY error (network, timeout, non-2xx status), return `{success: false, error: err.message}`. Never throw.

4. **`checkWebService()`** -- Returns `Promise<{service_running: boolean, version?: string, db_accessible: boolean, port_available: boolean}>`.
   - If `!isWebEnabled()`, return `{service_running: false, db_accessible: false, port_available: false}` immediately.
   - **Service running check:** GET `${getWebBaseUrl()}/api/health` with `AbortSignal.timeout(2000)`. If 200 and JSON body has `status === 'ok'`, set `service_running: true` and capture `version` from the response.
   - **DB accessible check:** GET `${getWebBaseUrl()}/api/ready` with `AbortSignal.timeout(2000)`. If 200 and JSON body has `database === 'connected'`, set `db_accessible: true`.
   - **Port available check:** Use `net.Socket()` to attempt a TCP connection to `127.0.0.1:8998` with a 1-second timeout. If the connection succeeds, the port is in use (meaning the service is listening), set `port_available: true` (meaning the port is responding). If it fails, `port_available: false`.
   - Run all three checks concurrently with `Promise.allSettled`. Never throw -- catch all errors per-check and return the partial result.

**Module structure:**
```
'use strict';

const path = require('path');
const fs = require('fs');
const net = require('net');

// ... functions ...

module.exports = { isWebEnabled, registerProjectWithWeb, checkWebService };
```

**What NOT to do:**
- Do NOT use `AbortController` manually -- use `AbortSignal.timeout(ms)` which is cleaner and available in Node 18+.
- Do NOT retry failed requests. Single attempt, fail fast.
- Do NOT import any external dependencies. Only use Node.js builtins and native `fetch`.
- Do NOT use `http` or `https` modules -- use native `fetch`.
- Do NOT log to stdout/stderr. Return error information in the result object. Callers decide whether to display.

**Verification:**
```bash
node -e "const wc = require('./src/lib/web-client.cjs'); console.log(typeof wc.isWebEnabled, typeof wc.registerProjectWithWeb, typeof wc.checkWebService)"
```
Expected output: `function function function`

---

### Task 2: Implement `src/lib/web-client.test.cjs`

**File:** `src/lib/web-client.test.cjs` (NEW)

**Implementation:**

Use `node:test` with `describe/it/mock/beforeEach/afterEach` (matching the pattern in `errors.test.cjs` and `prereqs.test.cjs`). Use `node:assert/strict`.

**Test groups:**

1. **`isWebEnabled()`** tests:
   - Returns `true` when `process.env.RAPID_WEB = 'true'`.
   - Returns `true` when `process.env.RAPID_WEB = 'TRUE'` (case-insensitive).
   - Returns `false` when `process.env.RAPID_WEB` is unset and `RAPID_TOOLS` is not set (cannot find .env).
   - Returns `false` when `process.env.RAPID_WEB = 'false'`.
   - Returns `false` when `process.env.RAPID_WEB` is unset and .env file does not contain `RAPID_WEB`.
   - Returns `true` when env var is unset but .env file at RAPID root contains `RAPID_WEB=true`. Test this by setting `process.env.RAPID_TOOLS` to point at a temp directory with a `.env` file.
   - Never throws -- test with corrupted/missing .env file path (set `RAPID_TOOLS` to a nonexistent path).

   For each test, save/restore `process.env.RAPID_WEB` and `process.env.RAPID_TOOLS` in `beforeEach`/`afterEach`.

2. **`registerProjectWithWeb()`** tests:
   - Returns `{success: false, error: 'RAPID_WEB not enabled'}` when `RAPID_WEB` is not set.
   - Returns `{success: true}` when `RAPID_WEB=true` and `fetch` succeeds (mock `global.fetch` to resolve with `{ok: true, json: () => ({id: 'abc', status: 'active'})}`).
   - Returns `{success: false, error: ...}` when `fetch` rejects (mock `global.fetch` to reject with a network error).
   - Returns `{success: false, error: ...}` when `fetch` returns non-2xx (mock `global.fetch` to resolve with `{ok: false, status: 500, statusText: 'Server Error'}`).
   - Verify that `fetch` is called with the correct URL and body (capture call args from mock).
   - Verify `AbortSignal.timeout(2000)` is used (check `signal` in fetch options).

   For fetch mocking: save `global.fetch` in `beforeEach`, replace with `mock.fn()`, restore in `afterEach`.

3. **`checkWebService()`** tests:
   - Returns all-false when `RAPID_WEB` is not set (no fetch calls made).
   - Returns `{service_running: true, version: '...', db_accessible: true, port_available: true}` when all checks pass (mock fetch for health and ready, mock `net.Socket` for port check).
   - Returns partial results when some checks fail (e.g., health passes but ready fails).
   - Never throws even when all checks fail simultaneously.

   For the port check mock: use `mock.method(net, 'Socket')` or create a mock Socket class. The simpler approach is to test the port check against localhost:8998 directly (it will either connect or not -- both are valid test outcomes). For deterministic tests, mock `net.Socket`.

**Verification:**
```bash
node --test src/lib/web-client.test.cjs
```
Expected: All tests pass.

---

## Success Criteria

- `src/lib/web-client.cjs` exports `isWebEnabled`, `registerProjectWithWeb`, `checkWebService`.
- All HTTP calls use `AbortSignal.timeout(2000)`.
- When `RAPID_WEB` is not `'true'`, no HTTP calls are made.
- All functions never throw -- they return error states instead.
- `node --test src/lib/web-client.test.cjs` passes all tests.
- No external dependencies added to `package.json`.
