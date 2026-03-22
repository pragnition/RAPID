# SET-OVERVIEW: cli-integration

## Approach

This set bridges the existing RAPID Node.js CLI with the new Python web service introduced in v4.0.0. The core challenge is adding web service awareness to the CLI without altering any existing behavior -- all web integration is gated behind the `RAPID_WEB=true` environment variable and must degrade gracefully when the service is unavailable.

The implementation centers on a new `src/lib/web-client.cjs` module that provides non-blocking HTTP helpers with a strict 2-second timeout. This module is the single point of contact between the Node.js CLI and the Python backend. All outbound calls use fire-and-forget semantics so that the CLI never hangs waiting for the web service. Around this core module, three integration points are wired in: the `/rapid:install` skill gains an optional web service setup flow, the `/rapid:init` skill gains auto-registration of projects, and a new `/rapid:register-web` skill handles legacy project registration.

The guiding principle is strict additivity -- the CLI must behave identically with or without `RAPID_WEB` set. This is enforced by tests that run every existing command with the variable unset and verify unchanged output.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/web-client.cjs` | Non-blocking HTTP client with `RAPID_WEB` detection, `registerProject()`, `isWebEnabled()`, `doctorChecks()` | New |
| `src/lib/web-client.test.cjs` | Unit tests for web-client covering timeouts, graceful failure, env gating | New |
| `skills/register-web/SKILL.md` | Skill definition for `/rapid:register-web` command | New |
| `skills/install/SKILL.md` | Extended to include optional web service setup (systemd enable, env var) | Existing (modify) |
| `skills/init/SKILL.md` | Extended to call `registerProject()` when `RAPID_WEB=true` after init | Existing (modify) |
| `src/lib/prereqs.cjs` | Extended with web service health checks for doctor-like diagnostics | Existing (modify) |

## Integration Points

- **Exports:**
  - `registerProjectWithWeb(projectRoot)` -- Non-blocking HTTP POST to register a project with the web service; returns `{success, error?}`
  - `isWebEnabled()` -- Checks `RAPID_WEB=true` in environment or `.env` file
  - `doctor_web_checks()` -- Health checks returning `{service_running, db_accessible, port_available}`
  - `skills/register-web/SKILL.md` -- New skill for `/rapid:register-web` command
  - Install skill extension -- Additions to `/rapid:install` for optional web service setup

- **Imports (from other sets):**
  - `GET /api/health` (from **service-infrastructure**) -- Used by `doctor_web_checks()` to verify service liveness, version, and uptime
  - `POST /api/projects` (from **project-registry**) -- Used by `registerProjectWithWeb()` to register projects; expects `{path, name}`, returns `{id, status}`

- **Side Effects:**
  - When `RAPID_WEB=true`, project init triggers a background HTTP POST to the web service (fire-and-forget)
  - Install may write `RAPID_WEB=true` to shell config files if user opts in
  - Doctor output gains additional rows for web service health when `RAPID_WEB` is set

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| HTTP calls blocking CLI when web service is slow or unreachable | High | Enforce 2-second timeout on all HTTP calls; use `AbortController` with `setTimeout`; test with simulated slow/down service |
| Modifying install/init skills introduces regressions | Medium | Changes are purely additive (new conditional blocks); test both `RAPID_WEB=true` and unset paths; keep modifications minimal |
| Race between CLI registration and web service not yet started | Low | `registerProjectWithWeb` returns `{success: false}` silently; user can run `/rapid:register-web` later |
| Port 8998 conflict with other local services | Low | Doctor checks report port availability; install skill warns if port is occupied |
| Node.js `fetch` availability (requires Node 18+) | Low | RAPID already requires Node 18+ (enforced in `prereqs.cjs`); use native `fetch` without polyfill |

## Wave Breakdown (Preliminary)

- **Wave 1:** Core web client module -- Implement `src/lib/web-client.cjs` with `isWebEnabled()`, non-blocking HTTP helpers, `registerProjectWithWeb()`, and `doctorChecks()`. Write comprehensive unit tests in `src/lib/web-client.test.cjs` covering timeout behavior, graceful failure, and env-var gating.

- **Wave 2:** Skill integration -- Create `skills/register-web/SKILL.md` for legacy project registration. Modify `skills/install/SKILL.md` to add optional web service setup flow (systemd enable, `RAPID_WEB=true` to shell config). Modify `skills/init/SKILL.md` to call `registerProjectWithWeb()` after successful init when `RAPID_WEB=true`.

- **Wave 3:** Doctor integration and end-to-end validation -- Extend `src/lib/prereqs.cjs` with web service health checks (service running, DB accessible, port available). Verify all existing CLI commands behave identically with `RAPID_WEB` unset. Integration test with actual web service endpoints.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
