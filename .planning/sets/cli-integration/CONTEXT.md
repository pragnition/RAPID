# CONTEXT: cli-integration

**Set:** cli-integration
**Generated:** 2026-03-21
**Mode:** interactive

<domain>
## Set Boundary
Bridges the existing RAPID Node.js CLI with the Python web service introduced in v4.0.0. All web integration is gated behind `RAPID_WEB=true` and must degrade gracefully when the service is unavailable. The set owns `src/lib/web-client.cjs` (new HTTP client module), `skills/register-web/SKILL.md` (new command), and modifications to install/init skills and prereqs.cjs for doctor checks. Existing CLI behavior must remain identical when `RAPID_WEB` is unset.
</domain>

<decisions>
## Implementation Decisions

### HTTP Client Strategy

- Use Node.js native `fetch` (available since Node 18, which RAPID already requires). No external dependencies.
- AbortController with 2-second timeout for all requests. Single attempt, no retries -- fail fast to keep CLI snappy.
- Error shape: `{success: boolean, error?: string}`. Simple, matches CONTRACT.json signature. Callers just check `.success`.

### Install Flow UX

- After core install completes, present an AskUserQuestion gate: "Enable RAPID Mission Control web dashboard?" with Yes/No. Only proceeds if user opts in.
- Persist `RAPID_WEB=true` to **both** the RAPID plugin `.env` file (for immediate use by env preamble) and the user's shell rc file (for persistence across sessions).
- Generate and enable a **systemd user service** for the web backend. Auto-starts on login, proper lifecycle management.

### Registration Timing

- During `/rapid:init` with `RAPID_WEB=true`, call `registerProjectWithWeb()` at the end and display a brief feedback message: "Registered with Mission Control" or "Mission Control unavailable, run /register-web later".
- `/rapid:register-web` is **idempotent** -- always POSTs to the backend, which upserts. Re-registering is safe and refreshes project metadata.
- `/rapid:register-web` operates on the **current working directory only**. No path argument. Matches how other RAPID commands work.

### Doctor Check Depth

- Full 3-check suite: service running (GET /api/health), DB accessible (from health response), port 8998 available. Matches CONTRACT.json spec.
- Web checks are **gated** behind `RAPID_WEB=true`. When unset, no web rows appear in doctor output.
- Web check results appear as **new rows in the existing doctor table** using the same format (status/tool/version/reason columns). No separate section.

### Claude's Discretion

- (None -- user provided input on all areas)
</decisions>

<specifics>
## Specific Ideas
- Use the existing env preamble pattern for loading RAPID_WEB from .env
- The health endpoint at GET /api/health already returns `{status, version, uptime}` -- leverage this for both service-running and version display in doctor
- Port check can use a simple TCP connect attempt to 127.0.0.1:8998
</specifics>

<code_context>
## Existing Code Insights

- **prereqs.cjs** (`src/lib/prereqs.cjs`): Uses `execSync` with 5-second timeout for tool checks. Has `checkTool()` and `compareVersions()` helpers. Doctor checks return `{name, status, version, minVersion, required, reason, message}` shape -- web checks should match this.
- **Health endpoint**: `GET /api/health` at `web/backend/app/main.py:48`, returns `HealthResponse` with status, version, uptime fields.
- **Projects endpoint**: `POST /api/projects` in `web/backend/app/routers/projects.py`, expects `{path, name}`, returns `{id, status}`.
- **Install skill** (`skills/install/SKILL.md`): Already uses AskUserQuestion for decisions. Handles shell detection (bash/zsh/fish). Has version-aware path management.
- **Init skill** (`skills/init/SKILL.md`): Runs prereq checks then multi-agent pipeline. Registration call should go at the end after successful init completion.
- **RAPID requires Node 18+**: Enforced in prereqs.cjs, so native `fetch` is available without polyfill.
- **Env preamble pattern**: All skills load from `.env` file first, then check env vars. Web client should follow the same pattern for `RAPID_WEB`.
</code_context>

<deferred>
## Deferred Ideas
- WebSocket-based live sync between CLI state changes and web dashboard (future milestone)
- Batch registration of multiple projects at once
- Web service auto-discovery without explicit RAPID_WEB flag
</deferred>
