# SET-OVERVIEW: branding-server

## Approach

The branding skill currently generates a standalone HTML file (`branding/index.html` and `.planning/branding/index.html`) that users open via `file://` protocol. This set replaces that static approach with a lightweight Node.js HTTP server that serves the `.planning/branding/` directory as a live directory index. The server provides a clean API surface -- `start()`, `stop()`, `status()` -- with PID-file-based lifecycle management.

The implementation strategy is straightforward: build the HTTP server module first with full lifecycle management (PID file create/remove/stale-detection, port conflict handling), then update the branding skill to spawn the server and open a browser to the localhost URL instead of generating standalone HTML. The server uses only `node:http` and `node:fs` -- no new npm dependencies.

The core design challenge is robust PID lifecycle management: detecting stale PIDs where the process has exited but the PID file remains, handling port conflicts gracefully with clear error messages, and ensuring clean shutdown removes the PID file.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| src/lib/branding-server.cjs | HTTP server module with start/stop/status API | New |
| src/lib/branding-server.test.cjs | Unit tests for server lifecycle | New |
| skills/branding/SKILL.md | Branding interview skill -- update to use server | Existing |

## Integration Points

- **Exports:** `branding-server-module` -- a module exporting `{ start(port?), stop(), status() }` for programmatic server management
- **Imports:** None -- this set has no dependencies on other sets
- **Side Effects:** Creates/removes `.planning/branding/.server.pid` file during lifecycle; binds to a localhost port while running

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Port conflict with other local services | Medium | Behavioral constraint requires graceful reporting, not crashing; implement clear error message with the conflicting port |
| Stale PID file after unclean shutdown | Medium | Status check must verify the PID is actually running (e.g., `process.kill(pid, 0)`); clean up stale files automatically |
| Directory listing security | Low | Server only binds to localhost; serves only `.planning/branding/` directory |
| SKILL.md update breaks existing branding workflow | Medium | Keep the skill backward-compatible -- if server fails to start, fall back to file:// open |

## Wave Breakdown (Preliminary)

- **Wave 1:** Core server module (`branding-server.cjs`) -- HTTP server with directory listing, PID file management, start/stop/status API, port conflict handling
- **Wave 2:** Tests and skill integration -- unit tests for all lifecycle scenarios, update `SKILL.md` to spawn server instead of opening static HTML

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
