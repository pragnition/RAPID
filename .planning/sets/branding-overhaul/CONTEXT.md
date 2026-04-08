# CONTEXT: branding-overhaul

**Set:** branding-overhaul
**Generated:** 2026-04-07
**Mode:** interactive

<domain>
## Set Boundary
Complete overhaul of the branding webserver: SSE auto-reload, artifact registry system with branding-artifacts.cjs, hub page redesign to artifact card gallery, extended branding skill flow for logo/wireframe/guidelines generation. All work stays within Node.js built-ins (node:http, node:fs) — zero new npm dependencies.
</domain>

<decisions>
## Implementation Decisions

### Artifact Manifest Structure
- Flat array with type field — single array in artifacts.json, each entry has a `type` field for filtering
- Moderate metadata per entry: id, type, filename, createdAt, description
- **Rationale:** Flat arrays are simple to iterate and filter with `.filter()`. Moderate metadata provides enough for rich hub page cards without over-engineering or excessive maintenance burden.

### SSE Event Model
- Typed events — separate event types per action (artifact-created, artifact-updated, artifact-deleted, file-changed)
- Reference payload — include id + type + filename in each event, enough for targeted DOM updates without full schema coupling
- **Rationale:** Typed events enable surgical DOM updates and animations. Reference payloads balance latency (no re-fetch needed for targeting) with decoupling (not embedding full schema in SSE format).

### File Watcher vs API-Driven Notifications
- Dual with API-primary — CRUD endpoints push SSE events immediately for low latency; fs.watch catches external file changes
- Root-only watching — watch .planning/branding/ root only, no recursive monitoring
- **Rationale:** Dual-source ensures both API-driven and external file changes trigger SSE. Root-only avoids Linux inotify limitations with `fs.watch({ recursive: true })` and matches the current flat directory structure. Zero-dependency constraint prevents using chokidar.

### Artifact Type System
- Fully open string — any string accepted as artifact type, no enum validation
- Uniform cards — all cards look identical regardless of type, type shown as text label only
- **Rationale:** Open types maximize flexibility for future artifact kinds without requiring code changes. Uniform cards keep the hub page simple and maintainable, consistent with the open type philosophy.

### Hub Page Architecture
- Hybrid with live DOM patching — server renders initial HTML, embedded client-side JS patches DOM on SSE events
- Reconnect and refresh — use native EventSource auto-reconnect, trigger full page reload on reconnection to sync state
- **Rationale:** Live DOM patching provides smooth updates without page flash during active branding work. Full refresh on reconnect is pragmatic for a local dev tool — avoids complex event catch-up logic while ensuring consistent state.

### Hub Page Card Gallery
- Responsive CSS grid layout, 2-3 columns reflowing based on viewport width
- Medium richness per card: type label, artifact name, relative timestamp, clickable link
- **Rationale:** Grid layout scales well with varying artifact counts and provides visual balance. Medium richness gives enough at-a-glance information without overwhelming the gallery.

### Branding Skill Artifact Generation
- Incremental with live preview — server runs during skill execution, artifacts appear in real-time via SSE as each is generated
- Direct module calls — skill requires branding-artifacts.cjs and calls functions directly for registration
- **Rationale:** Live preview lets users see artifacts appearing in real-time during the branding interview. Direct module calls are simpler than HTTP and don't add server dependency for the registration step itself.

### Artifact Delete Behavior
- Manifest + filesystem — DELETE removes both the manifest entry and the actual file
- Show untracked files — files not in manifest are displayed in hub page with 'untracked' indicator, not auto-registered
- **Rationale:** Full delete keeps the directory clean and behavior intuitive. Showing untracked files preserves backward compatibility with the current hub page (which shows all files) while distinguishing managed vs. unmanaged artifacts.

### Claude's Discretion
- SSE deduplication strategy for dual-source events (API + fs.watch)
- fs.watch debounce timing within the 200-500ms contract range
- SSE connection tracking data structure and max-10 enforcement
- XSS escaping implementation details
- Artifact ID generation strategy
- CRUD HTTP endpoint error response format
- Hub page CSS styling details (colors, spacing, typography)
- Client-side JS implementation for DOM patching logic
</decisions>

<specifics>
## Specific Ideas
- SSE event types should include: artifact-created, artifact-updated, artifact-deleted, file-changed
- Artifact manifest entries: { id, type, filename, createdAt, description }
- Hub page cards show: type label + name + relative timestamp + clickable link
- Branding skill flow: start server → generate theme → register → generate logo → register → generate wireframe → register → generate guidelines → register (each step visible in real-time)
- Untracked files in hub page should be visually distinct from registered artifacts
</specifics>

<code_context>
## Existing Code Insights
- `branding-server.cjs` already has: HTTP server lifecycle (start/stop/status), PID file management, static file serving, path traversal prevention, hub page generation, health endpoint
- `_generateHubPage(brandingDir)` currently takes a directory path and reads files — needs to change to accept a manifest object
- Server already listens on 127.0.0.1 with configurable port (default 3141)
- MIME type mapping already supports .html, .css, .js, .json, .md, .svg, .png, .jpg
- `_handleRequest` dispatches on method + pathname — new SSE and CRUD routes can follow the same pattern
- Branding skill (SKILL.md) already starts/stops the server and generates index.html — extension point is after artifact generation steps
- Existing exports include internal helpers prefixed with `_` for testing
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
