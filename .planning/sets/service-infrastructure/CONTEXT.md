# CONTEXT: service-infrastructure

**Set:** service-infrastructure
**Generated:** 2026-03-20
**Mode:** interactive

<domain>
## Set Boundary
Foundational Python backend service for RAPID's web dashboard (v4.0.0 Mission Control). Delivers the FastAPI application shell, SQLite database with WAL mode and Alembic migrations, SyncEngine for write-through DB + .rapid-web/ synchronization, systemd/launchd service templates, structured JSON logging, and health endpoints. This is a leaf dependency with no upstream requirements -- all other v4.0.0 sets depend on the exports from this set.
</domain>

<decisions>
## Implementation Decisions

### SyncEngine Strategy

- **Conflict resolution:** DB wins on conflict. .rapid-web/ is never written to independently by application code.
- **Sync direction:** Write-through -- all writes go to both SQLite and .rapid-web/ simultaneously. Not bidirectional in the traditional sense.
- **Bootstrap/import:** Store the git commit hash of the project state in the DB. On clone or first startup, if .rapid-web/ comes from a later commit than what's recorded in the DB, import from .rapid-web/ to bootstrap the database.
- **Change detection:** Polling with checksums (periodic scan comparing file hashes, ~5s interval). Cross-platform, no native dependencies.
- **File granularity:** One JSON file per entity (e.g. .rapid-web/projects/{id}.json, .rapid-web/notes/{id}.json). Git-friendly, easy to diff.

### Database & Migrations

- **Migration strategy:** Single shared `web/backend/alembic/versions/` directory with timestamp-prefixed migration files. All sets contribute to the same linear migration history.
- **Initial schema:** All known tables pre-created (projects, notes, kanban items, sync_state, app_config) based on the full v4.0.0 roadmap. Front-loads schema decisions to avoid migration churn.
- **ORM layer:** SQLModel (Pydantic + SQLAlchemy hybrid). Models double as API response schemas.

### Service Lifecycle

- **Port conflict:** Fail with a clear error message showing what process is using port 8998 and how to resolve. No auto-increment or recovery.
- **Auto-start:** Explicit setup only. User must run a setup command to install the systemd/launchd unit. Service never starts implicitly.
- **Feature gate:** RAPID_WEB=true environment variable only. No config file layer -- simple 12-factor style.

### Config & Path Layout

- **Database location:** ~/.rapid/rapid.db (central, shared across all projects).
- **Project discovery:** CLI registration via /init or /register-web. Service reads a registry file (~/.rapid/projects.json).
- **Config structure:** Flat environment variables via Pydantic Settings (RAPID_WEB_PORT, RAPID_WEB_DB_PATH, etc.). 12-factor compliant, no config file parser needed.
</decisions>

<specifics>
## Specific Ideas
- Store git commit hash in DB to enable smart .rapid-web/ import on clone
- Write-through pattern avoids complexity of true bidirectional sync while maintaining .rapid-web/ portability
- Pre-creating all v4.0.0 tables in the initial migration avoids cross-set migration coordination issues
</specifics>

<code_context>
## Existing Code Insights

All target files are new (greenfield). No existing backend code in the repository.

- Project is a Claude Code plugin (Node.js/CJS) -- the Python backend is a new companion service
- Existing .planning/ directory structure is well-established with STATE.json, ROADMAP.md, CONTRACT.json per set
- The CLI integration (Set 6) will use a web-client.cjs helper to communicate with this service's API
- ~/.rapid/ directory is already used by the plugin for logs and configuration
</code_context>

<deferred>
## Deferred Ideas
- WebSocket support for real-time UI updates (may be needed by read-only-views or interactive-features sets)
- Authentication/multi-user support (out of scope for v4.0.0 which is single-user local)
- Database backup/export tooling
</deferred>
