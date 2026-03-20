# CONTEXT: project-registry

**Set:** project-registry
**Generated:** 2026-03-21
**Mode:** interactive

<domain>
## Set Boundary
Project registration and lifecycle management for RAPID Web. REST API endpoints for CRUD on RAPID projects with pagination. FileWatcherService for detecting STATE.json and REGISTRY.json changes on disk. SQLite models for projects. Integration with the .rapid-web/ sync layer for portability. Builds on service-infrastructure's FastAPI app factory, database engine, and SyncEngine.
</domain>

<decisions>
## Implementation Decisions

### STATE.json Parsing Depth

- Store summary fields only: current milestone ID, milestone name, total set count, active set count
- Do NOT parse ROADMAP.md — only structured STATE.json data
- Full STATE.json details fetched on-demand from disk (used by the detail endpoint)

### File Watcher Strategy

- Use watchdog library with inotify on Linux / FSEvents on macOS
- Fall back to 5-second polling if inotify watch limit is exhausted
- FileWatcherService exposes add_project() and remove_project() for dynamic runtime updates without restart
- Watcher runs in a dedicated daemon thread, started in app lifespan, stopped on shutdown

### Registration & Discovery UX

- Require .planning/STATE.json to exist at registration time — reject paths without it
- Auto-detect project name from STATE.json `projectName` field, fall back to directory name. Allow user override via optional `name` field in request body
- Registration is idempotent — re-registering an existing path updates metadata
- Mark projects as "unreachable" when their path disappears from disk (detected by file watcher). Keep the record for user visibility; user can manually deregister

### API Response Shape

- List endpoint (GET /api/projects): lightweight summary — id, name, path, status, current_milestone, set_count, registered_at, last_seen_at
- Detail endpoint (GET /api/projects/{id}): adds milestone/set breakdown parsed fresh from STATE.json on disk at request time
- All list endpoints default to page=1, per_page=20 with total count in response

### Claude's Discretion

- Internal service layer organization (project_service.py structure)
- Pydantic schema field naming and validation details
- Error response format and HTTP status codes for edge cases
- SyncEngine integration details (when/how to call sync_to_disk)
- File watcher thread communication mechanism (direct DB writes vs queue)
</decisions>

<specifics>
## Specific Ideas
- None captured — all decisions covered by gray area discussion
</specifics>

<code_context>
## Existing Code Insights

- **Project model** already exists in `web/backend/app/database.py` with fields: id (UUID), name, path (unique), registered_at, last_seen_commit, status
- **SyncEngine** in `web/backend/app/sync_engine.py` supports sync_to_disk(), sync_from_disk(), delete_from_disk(), and update_sync_state() — already handles "project" entity type mapped to "projects/" subdirectory
- **get_db()** dependency in `web/backend/app/main.py` yields request-scoped Session from app.state.engine
- **create_app()** in main.py uses `app.include_router()` pattern — projects router should follow the same pattern
- **Lifespan** context manager in main.py handles startup/shutdown — FileWatcherService start/stop should be wired here
- **SQLite WAL mode** already configured via _set_sqlite_pragmas event listener
- **Alembic** migrations are in place — new columns (if needed) require a migration
- Project model has `last_seen_commit` but no `last_seen_at` or `metadata_json` — summary fields (current_milestone, set_count) may need to be added as columns or stored in a JSON column
</code_context>

<deferred>
## Deferred Ideas
- WebSocket push notifications for real-time project status updates (future set)
- Project grouping/tagging for organization
- Bulk registration via directory scanning
</deferred>
