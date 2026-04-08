# SET-OVERVIEW: branding-overhaul

## Approach

This set transforms the branding webserver from a simple static file server into a live-reloading artifact platform. The current `branding-server.cjs` serves files from `.planning/branding/` with a hub page that lists directory contents. The overhaul adds three major capabilities: (1) SSE-based auto-reload so the browser reflects file changes in near-real-time, (2) a structured artifact registry (`branding-artifacts.cjs`) with Zod-validated manifest CRUD, and (3) a redesigned hub page that renders typed artifact cards instead of a flat file list.

The implementation builds bottom-up: first the artifact registry module and SSE infrastructure (these are independent foundations), then the HTTP API endpoints that expose artifact CRUD over REST, then the hub page redesign that consumes the manifest, and finally the branding skill flow extension. All work stays within Node.js built-ins (`node:http`, `node:fs`) -- zero new npm dependencies is a hard contract constraint.

The server lifecycle additions (SSE connection tracking, fs.watch debouncing) require careful resource management. SSE connections must be tracked in a `Set` and cleaned up on server stop, capped at 10 concurrent. The fs.watch watcher must debounce events (200-500ms) and re-scan the directory rather than trusting the filename argument (which is unreliable across platforms).

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| src/lib/branding-server.cjs | HTTP server with SSE endpoint, hub page, static serving | Existing -- heavy modification |
| src/lib/branding-artifacts.cjs | Artifact manifest schema, CRUD operations, Zod validation | New |
| skills/branding/SKILL.md | Branding interview skill with sequential artifact generation flow | Existing -- extension |
| tests/branding-server.test.cjs | Server tests: SSE, fs.watch, hub page, XSS, connection limits | New |
| tests/branding-artifacts.test.cjs | Artifact registry tests: CRUD, schema validation, edge cases | New |

## Integration Points

- **Exports:**
  - `notifyClients(event, data)` -- Push SSE events to all connected browser clients for live-reload; consumed internally by the server's fs.watch handler and artifact CRUD endpoints
  - `src/lib/branding-artifacts.cjs` -- Artifact registry module providing manifest CRUD with Zod-validated `artifacts.json`; usable by any future RAPID module needing structured artifact tracking
  - `POST|GET|DELETE /_artifacts` -- HTTP endpoints for programmatic artifact management
  - `GET /_events` (text/event-stream) -- SSE endpoint for browser auto-reload and artifact change notifications
  - `_generateHubPage(manifest)` -- Redesigned hub page renderer producing artifact card gallery HTML from manifest data

- **Imports:** None -- this set is fully self-contained with no dependencies on other sets

- **Side Effects:**
  - fs.watch is started when the server starts and cleaned up on stop
  - SSE connections are held open until client disconnect or server stop
  - `artifacts.json` file is created/modified in `.planning/branding/` by artifact CRUD operations

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| fs.watch behavior varies across OS (Linux inotify vs macOS FSEvents vs Windows) | Medium | Ignore the filename argument entirely; re-scan directory on any event; debounce 200-500ms |
| SSE connection leak if clients disconnect without proper close | High | Track connections in a `Set`; handle `close` event on each response; enforce max 10 cap; clear all on server stop |
| XSS in hub page from artifact names/metadata | High | Escape all dynamic content before HTML insertion; enforce by test |
| Zod dependency -- must confirm it is already a project dependency | Medium | Verify Zod is in existing package.json before using; if not present, use manual validation (zero new deps constraint) |
| Race condition between fs.watch events and artifact CRUD writes | Low | Debounce covers this; CRUD endpoints can also directly call `notifyClients` after write rather than relying on fs.watch |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- Create `branding-artifacts.cjs` (Zod schema, manifest read/write, CRUD functions) and add SSE infrastructure to `branding-server.cjs` (connection tracking Set, `notifyClients`, `/_events` endpoint, fs.watch with debounce). Write tests for both modules.
- **Wave 2:** HTTP API and hub redesign -- Add `POST|GET|DELETE /_artifacts` endpoints to the server, wire them to the artifact registry. Redesign `_generateHubPage` to accept a manifest and render typed artifact cards with timestamps. Write integration tests.
- **Wave 3:** Skill flow and polish -- Extend `skills/branding/SKILL.md` to generate artifacts sequentially (theme -> logo -> wireframe -> guidelines), registering each via the artifact API. Verify XSS prevention, connection cleanup, and zero-dependency constraint across all paths.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
