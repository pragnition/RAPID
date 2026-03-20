# Stack Research: project-registry

## Core Stack Assessment

### Existing Stack (from service-infrastructure)
The service-infrastructure set has already established the core stack. All foundational dependencies are installed and configured. This assessment focuses on **new dependencies and patterns** required by project-registry.

| Technology | Installed Version | Status |
|-----------|------------------|--------|
| Python | 3.12.12 | Stable, matches `requires-python = ">=3.12"` |
| FastAPI | 0.135.1 | Latest stable |
| SQLModel | 0.0.37 | Latest stable |
| Pydantic | 2.12.5 | Stable (2.13.0 in beta) |
| Alembic | 1.18.4 | Latest stable |
| Uvicorn | 0.42.0 | Latest stable |
| pydantic-settings | 2.13.1 | Latest stable |
| pytest | 9.0.2 | Latest stable |
| httpx | 0.28.1 | Latest stable |

### watchdog (NEW DEPENDENCY -- not yet installed)
- **Required for:** FileWatcherService (STATE.json and REGISTRY.json monitoring)
- **Latest stable version:** 6.0.0
- **Python requirement:** >=3.9
- **Platform support:**
  - Linux: inotify (kernel 2.6+)
  - macOS: FSEvents
  - Windows: ReadDirectoryChangesW
  - All platforms: PollingObserver fallback
- **Key classes for this project:**
  - `watchdog.observers.Observer` -- platform-native watcher (inotify on Linux)
  - `watchdog.observers.polling.PollingObserver` -- cross-platform polling fallback
  - `watchdog.events.FileSystemEventHandler` -- base class for event callbacks
  - `watchdog.events.FileModifiedEvent`, `FileCreatedEvent`, `FileDeletedEvent`
- **Critical finding:** watchdog does NOT automatically fall back to polling when inotify watch limit is exhausted. It raises `OSError`. The FileWatcherService must catch this error explicitly and switch to `PollingObserver` manually.
- **inotify watch limit:** Default is 8192 per user on most Linux systems (`/proc/sys/fs/inotify/max_user_watches`). Each watched directory consumes one watch. For this project, we watch 1-2 files per project (STATE.json, REGISTRY.json), so the limit is unlikely to be hit unless the user has many inotify consumers running.
- **Thread safety:** Observer runs in its own daemon thread. File event callbacks execute in that thread. Database writes from callbacks must use their own Session (not share with request handlers).
- **Confirmed via:** PyPI, GitHub, watchdog API docs

### Existing Project Model (already in database.py)
The `Project` SQLModel is already defined in `web/backend/app/database.py`:
```
class Project(SQLModel, table=True):
    id: UUID (PK, auto-generated)
    name: str
    path: str (unique constraint)
    registered_at: datetime (auto UTC)
    last_seen_commit: str | None
    status: str (default "active")
```

**Gap analysis vs CONTRACT.json:**
- CONTRACT.json specifies `metadata_json` field -- this does NOT exist in the current model
- CONTRACT.json specifies `last_seen_at` -- the model has `last_seen_commit` instead
- CONTEXT.md specifies storing summary fields: current milestone ID, milestone name, total set count, active set count
- **Decision needed:** Either add `last_seen_at` and `metadata_json` columns via Alembic migration, or store STATE.json summary data in the existing fields creatively. Adding columns is the cleaner approach and aligns with the contract.

### Alembic Migration Status
- One migration exists: `0001_initial_schema.py` -- creates all tables (project, note, kanbanitem, syncstate, appconfig)
- The `project` table schema matches the current `Project` SQLModel
- A new migration (0002) will be needed if columns are added to the Project model
- Batch mode (`render_as_batch=True`) is already configured in `env.py`
- Naming convention is already set on `SQLModel.metadata`

## Dependency Health

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| fastapi[standard] | 0.135.1 | 0.135.1 | Current | No action needed |
| sqlmodel | 0.0.37 | 0.0.37 | Current | No action needed |
| pydantic | 2.12.5 | 2.12.5 stable / 2.13.0b2 beta | Current | Stay on stable |
| alembic | 1.18.4 | 1.18.4 | Current | No action needed |
| pydantic-settings | 2.13.1 | 2.13.1 | Current | No action needed |
| uvicorn | 0.42.0 | 0.42.0 | Current | No action needed |
| watchdog | NOT INSTALLED | 6.0.0 | **Must add** | Required for FileWatcherService |
| pytest | 9.0.2 | 9.0.2 | Current | No action needed |
| httpx | 0.28.1 | 0.28.1 | Current | No action needed |
| pytest-asyncio | 0.25.x | 0.25.x | Current | No action needed |

## Compatibility Matrix

| Constraint | Requirement | Status |
|------------|-------------|--------|
| watchdog + Python 3.12 | watchdog 6.0.0 requires >=3.9 | Compatible |
| watchdog + SQLite threading | Watcher thread needs own Session | Manual wiring required |
| watchdog + FastAPI lifespan | Start in lifespan startup, stop in shutdown | Manual wiring required |
| SQLModel + Alembic batch mode | Already configured | Compatible |
| Pydantic v2 schemas + SQLModel models | Use separate Pydantic models for API, SQLModel for DB | Compatible |

## Key Implementation Patterns

### 1. Pydantic Schemas (API layer) vs SQLModel (DB layer)
The existing codebase uses SQLModel for the database. For the API layer, the project-registry needs separate Pydantic `BaseModel` schemas for request/response validation. This is the FastAPI-recommended pattern:
- `ProjectCreate(BaseModel)` for POST request body
- `ProjectRead(BaseModel)` for list responses (lightweight summary)
- `ProjectDetail(BaseModel)` for detail responses (includes STATE.json data)
- `PaginatedResponse(BaseModel, Generic[T])` for paginated list wrapper

### 2. Pagination Pattern
SQLModel/SQLAlchemy pagination uses `.offset()` and `.limit()`:
```python
statement = select(Project).offset((page - 1) * per_page).limit(per_page)
count_statement = select(func.count()).select_from(Project)
```
The CONTEXT.md specifies default `page=1, per_page=20` with total count in response.

### 3. FileWatcherService Threading Model
- watchdog Observer runs as a daemon thread (auto-stops when main thread exits)
- Event handler callbacks run in the observer thread
- Database writes from callbacks need a fresh Session (not the request-scoped one)
- Use `get_engine()` to get the cached engine, create a new `Session(engine)` per callback
- **Race condition mitigation:** SQLite WAL mode (already configured) allows concurrent reads while writing

### 4. STATE.json Parsing
From the actual STATE.json structure observed in this project:
```json
{
  "version": 1,
  "projectName": "RAPID",
  "currentMilestone": "v4.0.0",
  "milestones": [
    {
      "id": "v4.0.0",
      "name": "Mission Control",
      "sets": [
        {"id": "service-infrastructure", "status": "merged", ...},
        {"id": "project-registry", "status": "discussed", ...}
      ]
    }
  ]
}
```
Summary extraction logic:
- `projectName` -> project name (fallback to directory name)
- Find milestone matching `currentMilestone` -> milestone ID and name
- Count sets in current milestone -> total set count
- Count sets with status != "merged" and != "pending" -> active set count

### 5. Router Wiring Pattern
The existing `main.py` uses `app.include_router(health_router)`. The projects router should follow the same pattern:
```python
from app.routers.projects import router as projects_router
app.include_router(projects_router)
```

### 6. Dependency Injection Pattern
The existing `get_db()` function in `main.py` yields a request-scoped Session from `app.state.engine`. The projects router should use `Depends(get_db)` for all endpoints. This is already established in the codebase.

### 7. SyncEngine Integration
The SyncEngine expects `(project_path: Path, session: Session)`. For the project-registry:
- On register: call `sync_to_disk("project", str(project.id), project.model_dump())`
- On deregister: call `delete_from_disk("project", str(project.id))`
- On update (from file watcher): call `sync_to_disk(...)` after updating DB

## Tooling Assessment

### Build & Package Management
- `uv` is the package manager (per pyproject.toml structure)
- watchdog must be added to `[project].dependencies` in pyproject.toml
- Run: `uv add watchdog` or manually add `"watchdog>=6.0,<7.0"` to dependencies

### Testing
- Existing test patterns use `pytest` with sync tests and `@pytest.mark.asyncio` for async endpoint tests
- `conftest.py` provides `db_path`, `engine`, `tables`, `session` fixtures
- `test_main.py` provides pattern for `test_engine`, `test_app`, `async_client` fixtures
- FileWatcherService tests will need `tmp_path` for creating fake project directories with STATE.json files
- Consider `unittest.mock.patch` for mocking inotify failures to test polling fallback

### Linting
- `ruff` is configured in pyproject.toml: `line-length = 100`, `target-version = "py312"`

## Stack Risks

1. **watchdog inotify limit exhaustion:** Impact: Medium -- FileWatcherService crashes if not handled. Mitigation: Catch `OSError` from Observer.start(), fall back to `PollingObserver(timeout=5)`. Log the fallback clearly.

2. **File watcher thread database session lifecycle:** Impact: High -- sharing a Session between threads causes SQLAlchemy `DetachedInstanceError` or `ProgrammingError`. Mitigation: Create a new `Session(engine)` inside each event handler callback, commit and close immediately. Never pass Session objects across threads.

3. **Race between file watcher and API requests:** Impact: Medium -- watcher thread and request thread may try to update the same Project row simultaneously. Mitigation: SQLite WAL mode (already enabled) allows concurrent reads. For writes, the `busy_timeout=5000` pragma (already configured) handles lock contention. Session-per-operation pattern prevents stale state.

4. **STATE.json missing or malformed at registration:** Impact: Low -- user registers a path without valid STATE.json. Mitigation: CONTEXT.md says to reject paths without STATE.json. Return 422 with clear error message. Validate JSON structure before persisting.

5. **Project path disappears after registration:** Impact: Low -- directory deleted or unmounted. Mitigation: FileWatcherService detects the disappearance, marks project status as "unreachable". Keep record for user visibility per CONTEXT.md decision.

6. **Project model schema gap (CONTRACT.json vs actual model):** Impact: Medium -- CONTRACT.json specifies `metadata_json` and `last_seen_at` fields not present in current model. Mitigation: Add these fields via Alembic migration 0002. Use nullable columns with defaults to avoid breaking existing data.

## Recommendations

1. **Add watchdog dependency:** Add `"watchdog>=6.0,<7.0"` to `pyproject.toml` dependencies. Priority: critical.

2. **Create Alembic migration for Project model changes:** Add `last_seen_at` (DateTime, nullable) and `metadata_json` (String, default "{}") columns to the project table. Priority: critical.

3. **Implement explicit inotify-to-polling fallback:** Do not rely on watchdog auto-detection. Catch `OSError` on `Observer.start()` and switch to `PollingObserver`. Priority: high.

4. **Use separate Pydantic schemas for API layer:** Do not return SQLModel instances directly from endpoints. Create dedicated request/response schemas for clean API boundaries. Priority: high.

5. **Create per-callback database sessions in FileWatcherService:** Never share the request-scoped Session with the watcher thread. Use `Session(engine)` as a context manager inside each event handler. Priority: high.

6. **Follow existing test patterns:** Use the established `conftest.py` fixtures, the `test_app`/`async_client` pattern from `test_main.py`, and class-based test organization. Priority: medium.

7. **Wire FileWatcherService into FastAPI lifespan:** Start watcher in the lifespan startup phase (after engine and migrations), stop in shutdown. Store on `app.state.file_watcher` for access. Priority: medium.
