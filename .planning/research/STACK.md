# Stack Research: cli-integration

## Core Stack Assessment

### Node.js (Runtime)
- **Detected version:** v25.8.0 (system), minimum enforced: 18+ (prereqs.cjs)
- **Latest stable:** v25.x (current LTS track)
- **Key features relevant:** Native `fetch()` (stable since Node 18), `AbortController` and `AbortSignal.timeout()` (stable since Node 18), `net.Socket` for TCP port checks, `node:test` built-in test runner with `mock` support, `node:fs` for .env file parsing
- **Known limitations at this version:** None relevant. All required APIs are stable and unflagged.
- **Confirmed:** `typeof fetch === 'function'`, `typeof AbortController === 'function'`, `typeof AbortSignal.timeout === 'function'` -- all verified on the running system.

### RAPID CLI (Node.js CJS Modules)
- **Version:** 4.0.0 (package.json)
- **Module format:** CommonJS (.cjs files throughout src/lib/)
- **Test framework:** `node:test` built-in (no external test runner)
- **Dependencies:** ajv ^8.17.1, ajv-formats ^3.0.1, proper-lockfile ^4.1.2, zod ^3.25.76
- **No external HTTP client needed:** Native `fetch` eliminates the need for `node-fetch`, `axios`, or `got`. Zero new dependencies required for web-client.cjs.

### FastAPI Web Backend
- **Version:** 4.0.0 (confirmed via `GET /api/health` response: `{"status":"ok","version":"4.0.0","uptime":...}`)
- **Host/Port:** 127.0.0.1:8998 (from config.py defaults and systemd service file)
- **Health endpoint:** `GET /api/health` returns `{status: "ok", version: "4.0.0", uptime: <float>}` -- lightweight liveness probe, no DB access
- **Ready endpoint:** `GET /api/ready` returns `{status: "ready", database: "connected"}` or `{status: "not_ready", database: "disconnected"}` with HTTP 503 -- includes DB connectivity check
- **Register endpoint:** `POST /api/projects` accepts `{path: <absolute_path>, name?: <string>}`, returns `{id: <uuid>, status: "active"|"registered", message: "registered"}` with HTTP 201. Returns HTTP 422 if path is not absolute or `.planning/STATE.json` is missing.
- **Idempotent registration:** The `register_project` service function checks for existing project by path and upserts (updates metadata + last_seen_at) rather than creating duplicates. Confirmed in `project_service.py:84-96`.

### systemd User Service
- **Service file:** `web/backend/service/rapid-web.service`
- **ExecStart:** `%h/.local/bin/rapid-web` (user-local pip-installed entry point)
- **Environment vars:** `RAPID_WEB=true`, `RAPID_WEB_PORT=8998`, `RAPID_WEB_HOST=127.0.0.1`
- **Restart policy:** `on-failure` with 5-second delay
- **Install target:** `default.target` (starts on user login via `systemctl --user`)

## Dependency Health

### No New Dependencies Required

The cli-integration set requires **zero new npm packages**. All functionality is built on Node.js built-ins:

| Capability | Node.js Built-in | Status | Notes |
|------------|------------------|--------|-------|
| HTTP client | `globalThis.fetch` | Stable (Node 18+) | Undici-powered, browser-compatible API |
| Request timeout | `AbortSignal.timeout(ms)` | Stable (Node 18+) | Returns AbortSignal that auto-aborts after delay |
| TCP port check | `net.Socket` | Stable | Connect + destroy pattern for port availability |
| .env parsing | `fs.readFileSync` | Stable | Simple line-by-line key=value parsing |
| Unit tests | `node:test` + `node:assert/strict` | Stable | Built-in describe/it/mock/beforeEach/afterEach |

### Existing Dependencies (Unmodified)

| Package | Current | Status | Impact on This Set |
|---------|---------|--------|--------------------|
| ajv ^8.17.1 | Active | None -- not used by web-client |
| proper-lockfile ^4.1.2 | Active | None -- not used by web-client |
| zod ^3.25.76 | Active | None -- not used by web-client |

## Compatibility Matrix

### Node.js fetch + AbortSignal.timeout

The recommended timeout pattern for native `fetch` in Node.js:

```javascript
const response = await fetch(url, {
  signal: AbortSignal.timeout(2000), // 2-second timeout
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

When `AbortSignal.timeout()` fires, `fetch` throws a `DOMException` with `name === 'TimeoutError'`. When the server is unreachable, `fetch` throws a `TypeError` with `cause.code === 'ECONNREFUSED'`. Both must be caught for graceful failure.

**Confirmed via docs:** `AbortSignal.timeout(delay)` is a static factory that creates an auto-aborting signal. It is simpler and more reliable than manually wiring `AbortController` + `setTimeout` + `clearTimeout`, because it handles cleanup automatically and avoids timer leaks.

### CJS Module Compatibility

The web-client.cjs must be CommonJS (`.cjs` extension, `require()`/`module.exports`). Native `fetch` is a global in Node 18+ and does not need to be `require()`'d. `AbortSignal` and `AbortController` are also globals.

However, `fetch` returns a `Promise`, so all HTTP functions in web-client.cjs must be `async`. The callers (install skill, init skill, register-web skill) invoke these via Bash `node -e "..."` one-liners, which naturally support `await` at the top level.

### .env File Loading Pattern

The existing RAPID pattern for loading environment variables from `.env`:

```bash
# In skill preamble (bash):
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then
  export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs)
fi
```

For the CJS module (web-client.cjs), the equivalent must be done in JavaScript since skills call `node -e "const { isWebEnabled } = require('./web-client.cjs'); ..."`. The module must read `.env` at require-time or at function call time. **Recommendation:** Read `.env` lazily at function call time (inside `isWebEnabled()`) to avoid side effects on `require()`.

The `.env` file currently contains only `RAPID_TOOLS=...`. The install skill will append `RAPID_WEB=true` to this file when the user opts in.

### Doctor Check Integration

Existing `prereqs.cjs` pattern for check results:

```javascript
{ name, status, version, minVersion, required, reason, message }
```

Where `status` is one of: `'pass'`, `'fail'`, `'warn'`, `'error'`.

Web doctor checks should return the same shape. The three web checks are:
1. **Service running:** `GET /api/health` succeeds -> `{name: 'RAPID Web', status: 'pass', version: '4.0.0', ...}`
2. **Database accessible:** `GET /api/ready` returns `database: 'connected'` -> `{name: 'RAPID Web DB', status: 'pass', ...}`
3. **Port available/in-use:** TCP connect to 127.0.0.1:8998 -> reports whether port is in use (expected when service is running)

**Important nuance:** The port check semantics differ from other prereqs. When the service is running, the port being "in use" is the *expected* state (pass). When the service is NOT running but the port is in use by something else, that is a conflict (warn). When the service is not running and the port is free, that is informational (pass -- port available for service start).

## Upgrade Paths

### No Upgrades Required

All technologies used by this set are current:
- Node.js v25.8.0 is well above the minimum 18+ requirement
- The `fetch` API has been stable since Node 18 and requires no polyfill
- The systemd service template uses standard systemd user service conventions
- The FastAPI backend endpoints are already deployed and tested

### Future Consideration: RAPID_WEB Auto-Discovery

Currently, web integration requires explicit `RAPID_WEB=true`. A future enhancement could auto-discover the web service by probing `127.0.0.1:8998/api/health` and caching the result. This would eliminate the need for the env var flag. **Deferred** per CONTEXT.md decisions.

## Tooling Assessment

### Build Tools
- **No build step needed for web-client.cjs:** CJS modules are loaded directly by Node.js. No transpilation, bundling, or compilation required.
- **Test runner:** `node --test 'src/**/*.test.cjs'` (configured in package.json `scripts.test`). The new `web-client.test.cjs` will be automatically picked up by the glob pattern.

### Test Strategy for HTTP Client

Testing `web-client.cjs` presents a challenge: the functions make real HTTP calls to `127.0.0.1:8998`. For unit tests, we need to mock `fetch` without depending on the web service being running.

**Available mocking approaches in `node:test`:**

1. **`mock.method(globalThis, 'fetch', fn)`** -- Mock the global `fetch`. Available in Node 20+ via `node:test` mock API. Confirmed the project already uses `mock` from `node:test` (see `errors.test.cjs:3`).

2. **Environment variable manipulation** -- Set/unset `RAPID_WEB` via `process.env` in `beforeEach`/`afterEach` to test gating behavior. Confirmed pattern used in `worktree.test.cjs:1725-1733`.

**Recommended test structure:**
- `isWebEnabled()` tests: manipulate `process.env.RAPID_WEB` and mock `.env` file reads
- `registerProjectWithWeb()` tests: mock `globalThis.fetch` to simulate success, failure, timeout, and service-down scenarios
- `doctorWebChecks()` tests: mock both `fetch` and `net.Socket` for health/ready/port check scenarios
- Timeout tests: mock `fetch` with a delayed promise to verify 2-second timeout fires

### Shell Config Modification (Install Skill)

The install skill already handles shell detection for bash/zsh/fish and writes to the appropriate rc file. Extending it to write `RAPID_WEB=true` follows the exact same pattern:

- **bash/zsh:** `export RAPID_WEB=true` appended to `~/.bashrc` / `~/.zshrc`
- **fish:** `set -gx RAPID_WEB true` appended to `~/.config/fish/config.fish`
- **.env file:** `RAPID_WEB=true` appended to `$RAPID_ROOT/.env`

The existing install skill already does shell detection, file selection via AskUserQuestion, and rc file writing. The web setup flow should reuse these patterns.

### systemd Service Management

The install skill needs to:
1. Copy `rapid-web.service` to `~/.config/systemd/user/`
2. Run `systemctl --user daemon-reload`
3. Run `systemctl --user enable --now rapid-web`

**Edge cases to handle:**
- `systemctl` not available (non-Linux or containerized): skip systemd setup, inform user to start service manually
- `~/.config/systemd/user/` directory doesn't exist: create it with `mkdir -p`
- Service already enabled: `enable --now` is idempotent, safe to re-run
- `rapid-web` binary not installed: `pip install` of the backend package must happen first. The ExecStart path is `%h/.local/bin/rapid-web` which requires `pip install --user` or `pipx install`.

**Important:** The systemd service file's `ExecStart=%h/.local/bin/rapid-web` assumes the backend was installed via `pip install --user` from `web/backend/`. The install skill should verify this binary exists before enabling the service.

## Stack Risks

1. **fetch timeout error handling across Node versions** (Low): `AbortSignal.timeout()` throws `DOMException` with `name === 'TimeoutError'` in newer Node versions but may throw `AbortError` in older Node 18.x builds. Since RAPID requires Node 18+ but doesn't pin to a specific minor, the catch block should handle both error names. **Mitigation:** Catch all errors generically (any thrown error = `{success: false, error: err.message}`), don't rely on specific error class checks.

2. **Race condition: init registration before STATE.json exists** (Medium): The `POST /api/projects` endpoint requires `.planning/STATE.json` to exist (returns 422 otherwise). During `/rapid:init`, registration must happen AFTER the roadmap is written (Step 9) and STATE.json is committed (Step 10). **Mitigation:** Place the `registerProjectWithWeb()` call after STATE.json is confirmed written, between Steps 10 and 11 of the init skill.

3. **Shell rc file pollution** (Low): Appending `RAPID_WEB=true` to shell rc adds another line. If the user reinstalls, duplicate lines may accumulate. **Mitigation:** Check if `RAPID_WEB` is already present in the rc file before appending (same pattern used for `RAPID_TOOLS` in the existing install skill, line 86-91).

4. **.env file vs shell env precedence** (Low): If `RAPID_WEB=false` is in .env but `RAPID_WEB=true` is in the shell environment (or vice versa), behavior could be confusing. **Mitigation:** Document that `process.env` takes precedence over `.env` file values. In `isWebEnabled()`, check `process.env.RAPID_WEB` first, fall back to `.env` file parsing only if the env var is not set.

5. **rapid-web binary not installed** (Medium): The systemd service assumes `~/.local/bin/rapid-web` exists. If the Python backend package was not installed (e.g., user skipped `pip install`), the service will fail to start. **Mitigation:** The install skill should check for the binary before enabling the service, and guide the user through `pip install` if needed.

6. **Port 8998 conflicts** (Low): Another local service could occupy port 8998. **Mitigation:** Doctor check detects this case (port in use but health endpoint not responding). The install skill should also check port availability before enabling the service.

## Recommendations

1. **Use `AbortSignal.timeout(2000)` for all fetch calls:** Simpler than manual `AbortController` + `setTimeout` wiring. Auto-cleans up, no timer leaks. Available in Node 18+. -- **Priority: critical**

2. **Catch all errors generically in HTTP helpers:** Do not rely on specific error types (`TimeoutError`, `TypeError`, `DOMException`). Any thrown error from `fetch` should result in `{success: false, error: err.message}`. This handles timeout, connection refused, DNS failure, and unexpected errors uniformly. -- **Priority: critical**

3. **Load `.env` lazily in `isWebEnabled()`:** Parse the `.env` file only when `isWebEnabled()` is called, not at `require()` time. Check `process.env.RAPID_WEB` first (takes precedence), then fall back to `.env` file. This avoids side effects on module load and respects the existing env preamble pattern. -- **Priority: high**

4. **Place registration call after STATE.json is written in init skill:** The backend requires `.planning/STATE.json` to exist. In the init skill, the registration call should go between Step 10 (auto-commit) and Step 11 (completion summary). This ensures all planning artifacts exist before the HTTP call. -- **Priority: high**

5. **Use `GET /api/ready` (not `/api/health`) for DB accessibility check:** The `/api/health` endpoint is a liveness probe only (no DB access). The `/api/ready` endpoint verifies database connectivity and returns `database: "connected"` or `"disconnected"`. Use both endpoints in doctor checks: health for service liveness, ready for DB status. -- **Priority: high**

6. **Mock `globalThis.fetch` in unit tests using `node:test` mock API:** Use `mock.method(globalThis, 'fetch', mockFn)` for HTTP tests. Use `process.env` manipulation for env-gating tests. Both patterns are already established in the existing test suite. -- **Priority: high**

7. **Check for `rapid-web` binary before enabling systemd service:** Verify `~/.local/bin/rapid-web` exists. If not, guide user through installation (`cd web/backend && pip install --user .`). -- **Priority: medium**

8. **Guard against duplicate rc file entries:** Before appending `RAPID_WEB=true` to shell rc, check if it already exists (grep pattern). Same deduplication pattern used for `RAPID_TOOLS` in the existing install skill. -- **Priority: medium**

9. **Use TCP `net.Socket` connect for port check, not `execSync('lsof ...')`:** A direct TCP connect to 127.0.0.1:8998 is cross-platform, requires no external tools, and completes in milliseconds. Pattern: create socket, set 500ms timeout, attempt connect, interpret result. -- **Priority: medium**

## API Contract Reference

For implementer convenience, the exact HTTP contracts:

### GET /api/health
```
Request: GET http://127.0.0.1:8998/api/health
Response 200: {"status": "ok", "version": "4.0.0", "uptime": 2337.42}
Response (unreachable): fetch throws TypeError (ECONNREFUSED)
```

### GET /api/ready
```
Request: GET http://127.0.0.1:8998/api/ready
Response 200: {"status": "ready", "database": "connected"}
Response 503: {"status": "not_ready", "database": "disconnected"}
```

### POST /api/projects
```
Request: POST http://127.0.0.1:8998/api/projects
Headers: Content-Type: application/json
Body: {"path": "/absolute/path/to/project", "name": "optional-name"}
Response 201: {"id": "uuid-string", "status": "active", "message": "registered"}
Response 422: {"detail": "path must be an absolute path (starts with '/')"}
Response 422: {"detail": "No .planning/STATE.json found at /path"}
```

### Idempotency Note
Re-POSTing the same path updates `metadata_json`, `last_seen_at`, and `name` on the existing record rather than creating a duplicate. This makes `/rapid:register-web` safe to run multiple times.
