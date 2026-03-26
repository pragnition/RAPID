# CONTEXT: branding-server

**Set:** branding-server
**Generated:** 2026-03-26
**Mode:** interactive

<domain>
## Set Boundary
Replace standalone HTML file generation in the branding skill with a lightweight Node.js HTTP server that serves `.planning/branding/` as a directory index. The server provides `start()`, `stop()`, `status()` API with PID-file-based lifecycle management at `.planning/branding/.server.pid`. Uses only `node:http` and `node:fs` — no new npm dependencies.
</domain>

<decisions>
## Implementation Decisions

### Server Process Model
- **Managed child process** — server runs as a child process tied to the skill session, not a detached daemon. When the user is satisfied with the branding preview, the agent should ask via AskUserQuestion whether to kill the server before ending.
- **Rationale:** Avoids orphan process risk and simplifies lifecycle. The user stays in control of when the server stops through an explicit prompt, rather than needing to remember a separate stop command.

### Stale PID Recovery
- **Signal check + port health probe** — on status/start, check that the PID is alive via `process.kill(pid, 0)` AND verify the port responds to an HTTP health probe. If either check fails, clean up the stale PID file.
- **Rationale:** Pure signal check is vulnerable to PID recycling on Linux/macOS. The dual check ensures we only consider the server "running" when the actual branding server process owns both the PID and the port.

### Directory Listing UX
- **Styled hub page** at root URL — a curated entry page linking to the visual branding preview (`index.html`) and individual assets (BRANDING.md, SVGs). Serves only `.planning/branding/` directory, not the project-root `branding/` folder.
- **Rationale:** The user wanted more than just serving index.html directly — a hub page provides discoverability of all branding artifacts while keeping the existing visual preview as the primary link. The `branding/` directory is out of scope (user-created folder unrelated to the server's purpose).

### SKILL.md Migration Strategy
- **Server only, no file:// fallback.** If the server fails to start, show a clear error. Do NOT auto-open the browser — instead, display a clickable localhost URL for the user to open manually.
- **When server is already running:** Reuse the existing server and notify the user it's already running on the current port. No kill-and-restart.
- **Rationale:** The user prefers explicit control — a clickable link is less intrusive than auto-opening a browser. The no-fallback approach keeps the skill simple; server failures on localhost are rare and should surface as actionable errors rather than silently degrading.

### Server Configuration Surface
- **Hardcoded default port 3141** with the `start(port?)` API parameter as the programmatic override. No environment variable configuration.
- **On port conflict:** the skill should prompt the user via AskUserQuestion to provide an alternative port, rather than crashing or auto-selecting.
- **Rationale:** Port 3141 (π) is uncommon and unlikely to conflict with standard dev servers. Interactive port conflict resolution gives the user control without adding env var complexity to a dev-only tool.

### Claude's Discretion
- No areas deferred to Claude's discretion — all 4 gray areas were discussed.
</decisions>

<specifics>
## Specific Ideas
- Agent should ask user via AskUserQuestion whether to kill the server when branding workflow is complete
- Port conflict UX: prompt user for alternative port rather than failing silently
- Hub page should link to index.html (visual preview) and list other artifacts like BRANDING.md
- Display clickable `http://localhost:3141` link instead of auto-opening browser
</specifics>

<code_context>
## Existing Code Insights
- Current branding skill at `skills/branding/SKILL.md` generates `index.html` via Write tool, then opens via `xdg-open`/`open` (Step 6-7)
- Existing `.planning/branding/index.html` is a self-contained HTML file with inline CSS/JS — no external dependencies
- The `branding/` directory at project root contains 17 SVG design sets (banner.svg + icon.svg each) — out of scope for this set
- CONTRACT.json exports: `{ start(port?: number): Promise<{pid, port}>, stop(): Promise<void>, status(): {running, pid?, port?} }`
- PID file location: `.planning/branding/.server.pid`
- No existing server infrastructure in the codebase to reuse — this is a new module
</code_context>

<deferred>
## Deferred Ideas
- Serve `branding/` SVG design directory alongside `.planning/branding/` for unified asset preview
- Auto-open browser as a configurable option (user chose link-only for now)
</deferred>
