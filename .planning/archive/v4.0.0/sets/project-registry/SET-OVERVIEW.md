# SET-OVERVIEW: project-registry

## Approach

This set builds the project registration and lifecycle management layer for RAPID Web. The core problem is giving the web UI a way to discover, track, and stay synchronized with RAPID projects on the local filesystem. Users register a project by path; the backend reads its `.planning/STATE.json`, persists metadata to SQLite, and keeps it up-to-date via file watchers.

The implementation follows a layered pattern: Pydantic schemas for request/response validation, a service layer for business logic (registration idempotency, STATE.json parsing, sync integration), FastAPI router for the REST API, and a FileWatcherService that runs in a background thread to detect filesystem changes. The existing `Project` SQLModel in `database.py` and the `SyncEngine` in `sync_engine.py` (both from service-infrastructure) are already in place and will be consumed directly.

Work sequences naturally: define schemas first, then the service layer, then the router that wires them together, and finally the file watcher that keeps data fresh. The file watcher is the most complex piece since it must be non-blocking (threaded or polling) and handle inotify exhaustion gracefully.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| web/backend/app/schemas/project.py | Pydantic request/response models for project endpoints | New |
| web/backend/app/services/project_service.py | Business logic: register, deregister, list, get, STATE.json parsing | New |
| web/backend/app/services/file_watcher.py | FileWatcherService: watches STATE.json/REGISTRY.json per project | New |
| web/backend/app/routers/projects.py | FastAPI router: CRUD endpoints with pagination | New |
| web/backend/app/models/project.py | Re-export or extend Project model if needed (model lives in database.py) | New |
| web/backend/app/database.py | Existing Project SQLModel (from service-infrastructure) | Existing |
| web/backend/app/sync_engine.py | Existing SyncEngine (from service-infrastructure) | Existing |
| web/backend/app/main.py | Wire projects router into the app factory | Existing |

## Integration Points

- **Exports:**
  - `POST /api/projects` -- register a project by path, reads STATE.json, returns project record
  - `GET /api/projects` -- paginated project list (default page=1, per_page=20, includes total count)
  - `GET /api/projects/{id}` -- single project with full metadata snapshot
  - `DELETE /api/projects/{id}` -- deregister (removes from DB, does not touch project files)
  - `FileWatcherService` -- background service with start/stop/add_project/remove_project interface

- **Imports (from service-infrastructure):**
  - `create_app()` from `app.main` -- the FastAPI application factory where the projects router must be registered
  - `get_session()` / `get_db()` from `app.database` / `app.main` -- request-scoped SQLModel session dependency
  - `SyncEngine` from `app.sync_engine` -- write-through persistence to `.rapid-web/` directory

- **Side Effects:**
  - Registration reads the target project's `.planning/STATE.json` from disk
  - FileWatcherService spawns a background thread (or polling loop) that must be started in the app lifespan and stopped on shutdown
  - SyncEngine writes JSON files to `{project_path}/.rapid-web/projects/` on registration and updates

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| inotify watch limit exhaustion on systems with many projects | Medium | Implement polling fallback at 5s interval as specified in behavioral contract |
| File watcher thread blocking the FastAPI event loop | High | Run watcher in a dedicated daemon thread; communicate via thread-safe queue or direct DB writes |
| Race between file watcher updates and concurrent API requests | Medium | Use SQLite WAL mode (already configured) and session-per-request pattern; watcher gets its own session |
| STATE.json missing or malformed in registered projects | Low | Graceful degradation: register project with status "unreachable", retry on next watch cycle |
| Project path no longer exists after registration | Low | FileWatcherService detects missing path, marks project status as "unreachable" |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- Pydantic schemas (`project.py` schemas), project model re-exports/extensions if needed, and the `project_service.py` with core CRUD logic (register, get, list, deregister, STATE.json reader)
- **Wave 2:** API layer -- FastAPI router with all endpoints, pagination support, wire router into `create_app()`, integration with SyncEngine for write-through
- **Wave 3:** File watching -- `FileWatcherService` implementation with inotify + polling fallback, lifespan integration (start on startup, stop on shutdown), background update loop

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
