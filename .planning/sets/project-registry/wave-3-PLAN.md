# PLAN: project-registry / Wave 3 — File Watcher

**Objective:** Implement FileWatcherService that monitors STATE.json and REGISTRY.json for registered projects, updates the database on changes, and integrates with the FastAPI lifespan for start/stop. Handles inotify exhaustion gracefully by falling back to polling.

## Prerequisites
- Wave 2 complete (router wired, service layer functional, all tests passing)

## Tasks

### Task 1: Implement FileWatcherService

**File:** `web/backend/app/services/file_watcher.py` (new file)

**Action:** Implement a `FileWatcherService` class that watches `.planning/STATE.json` and `.planning/REGISTRY.json` for each registered project.

Class design:

```
class FileWatcherService:
    def __init__(self, engine: sqlalchemy.Engine):
        # Store engine (NOT a session -- create sessions per-callback)
        # Initialize watchdog Observer (try native, fall back to PollingObserver)
        # Internal dict mapping project_id -> watched paths

    def start(self) -> None:
        # Load all projects from DB with status != "deregistered"
        # Schedule watches for each project's .planning/ directory
        # Start the observer in a daemon thread

    def stop(self) -> None:
        # Stop the observer, join the thread

    def add_project(self, project_id: UUID, project_path: str) -> None:
        # Schedule a new watch for the project's .planning/ directory
        # Called when a project is registered at runtime

    def remove_project(self, project_id: UUID) -> None:
        # Unschedule the watch for this project
        # Called when a project is deregistered at runtime

    def _on_file_changed(self, event) -> None:
        # Callback for watchdog events
        # Filter: only react to STATE.json or REGISTRY.json modifications
        # Create a NEW Session from self.engine (never reuse)
        # Parse STATE.json, update project.metadata_json and project.last_seen_at
        # If path no longer exists, call mark_unreachable
        # Commit and close session in finally block
```

Key implementation details:

1. **Observer creation with fallback:**
   ```python
   try:
       from watchdog.observers import Observer
       self._observer = Observer()
   except OSError:
       from watchdog.observers.polling import PollingObserver
       self._observer = PollingObserver(timeout=5)
   ```
   Also wrap `observer.schedule()` calls — if scheduling a native watch raises `OSError` (inotify limit), log a warning and switch the entire observer to `PollingObserver`, re-scheduling all existing watches.

2. **Event handler:** Create a custom `FileSystemEventHandler` subclass (or use `PatternMatchingEventHandler`) that filters for files named `STATE.json` or `REGISTRY.json`. On `on_modified` and `on_created`, call `_on_file_changed`.

3. **Session management:** The watcher thread MUST create its own sessions. Use `Session(self.engine)` in a `with` block inside the callback. Never store a session on the instance.

4. **Thread safety:** The observer runs in a daemon thread. DB writes use SQLite WAL mode (already configured). The `add_project`/`remove_project` methods may be called from the main thread — use a `threading.Lock` to protect the internal watch registry dict.

5. **Error resilience:** Wrap the entire `_on_file_changed` callback in try/except. Log errors but never let them crash the watcher thread.

6. **Path validation in callback:** Before processing, check `Path(project_path).exists()`. If the project directory has been deleted, mark the project as unreachable instead of trying to parse STATE.json.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "
from app.services.file_watcher import FileWatcherService
print('OK: FileWatcherService imports')
"
```

**Commit:** `feat(project-registry): implement FileWatcherService with inotify/polling fallback`

---

### Task 2: Integrate FileWatcherService into app lifespan

**File:** `web/backend/app/main.py`

**Action:** Modify the `lifespan` async context manager to start and stop the FileWatcherService:

1. After `app.state.start_time = time.time()`, add:
   ```python
   from app.services.file_watcher import FileWatcherService
   watcher = FileWatcherService(engine)
   watcher.start()
   app.state.file_watcher = watcher
   ```

2. In the shutdown section (after `yield`), before `app.state.engine.dispose()`, add:
   ```python
   if hasattr(app.state, 'file_watcher') and app.state.file_watcher:
       app.state.file_watcher.stop()
   ```

3. Also update the router's register/deregister endpoints to notify the watcher:
   - In the projects router POST endpoint, after registration, call `request.app.state.file_watcher.add_project(project.id, project.path)` if `hasattr(request.app.state, 'file_watcher') and request.app.state.file_watcher`.
   - In the projects router DELETE endpoint, after deregistration, call `request.app.state.file_watcher.remove_project(project.id)` with the same guard.

Note: The guard (`hasattr` check) ensures tests that don't set up file_watcher still work.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run pytest tests/test_main.py -v
```
Existing tests must still pass (they don't go through lifespan so the watcher is never started).

**Commit:** `feat(project-registry): integrate file watcher into app lifespan`

---

### Task 3: Write unit tests for FileWatcherService

**File:** `web/backend/tests/test_file_watcher.py` (new file)

**Action:** Test the FileWatcherService in isolation. Use tmp_path to create fake project directories and the existing `engine`/`tables`/`session` fixtures from conftest.

Test cases:

1. `test_file_watcher_starts_and_stops` — instantiate with engine, start(), stop(). No crash.

2. `test_add_and_remove_project` — start watcher, add_project with a tmp project dir, remove_project. No crash.

3. `test_state_json_change_updates_db` — register a project in DB, start watcher with that project, modify STATE.json on disk, wait up to 10 seconds (use polling with sleep), verify project.metadata_json updated in DB. Use `PollingObserver` explicitly for test reliability.

4. `test_project_path_disappears_marks_unreachable` — register a project, start watcher, delete the project directory, wait up to 10 seconds, verify project status is "unreachable" in DB.

5. `test_fallback_to_polling_on_oserror` — mock `Observer.__init__` to raise OSError, verify FileWatcherService falls back to PollingObserver without crashing.

6. `test_callback_error_does_not_crash_watcher` — mock the DB session to raise on commit, trigger a file change, verify watcher is still running after the error.

Important test setup detail: For tests that need to observe file changes, set the PollingObserver timeout to 1 second for faster tests. The watcher must be started BEFORE the file modification.

Each test must clean up by calling `watcher.stop()` in a finally block or via a fixture.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run pytest tests/test_file_watcher.py -v
```
All tests must pass.

**Commit:** `test(project-registry): add unit tests for FileWatcherService`

---

### Task 4: Create project model re-export module

**File:** `web/backend/app/models/project.py` (new file)

Also create `web/backend/app/models/__init__.py` (empty).

**Action:** This file re-exports the Project model from database.py for cleaner import paths. It exists to satisfy the CONTRACT.json ownedFiles list and provide a conventional import location:

```python
"""Re-export Project model from database for conventional import path."""
from app.database import Project

__all__ = ["Project"]
```

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "
from app.models.project import Project
p = Project(name='test', path='/tmp/test')
print(f'OK: Project imported from models, id={p.id}')
"
```

**Commit:** `feat(project-registry): add project model re-export module`

---

### Task 5: Run full test suite

**Files:** None modified — verification only.

**Action:** Run the complete test suite to ensure all waves integrate correctly and nothing is broken.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run pytest -v
```
All tests across all test files must pass.

No commit for this task — it is verification only.

---

## File Ownership (Wave 3)
| File | Action |
|------|--------|
| `web/backend/app/services/file_watcher.py` | New |
| `web/backend/app/main.py` | Modified (lifespan + watcher notify) |
| `web/backend/app/routers/projects.py` | Modified (watcher notify on register/deregister) |
| `web/backend/app/models/__init__.py` | New |
| `web/backend/app/models/project.py` | New |
| `web/backend/tests/test_file_watcher.py` | New |

## Note on main.py and routers/projects.py
These files are also modified in Wave 2. This is acceptable because Waves are sequential within a set (not parallel). Wave 3 builds on the exact state Wave 2 leaves them in.

## Success Criteria
- [ ] FileWatcherService starts and stops cleanly
- [ ] File changes to STATE.json are detected and DB updated
- [ ] Disappearing project paths result in "unreachable" status
- [ ] inotify OSError triggers graceful fallback to polling
- [ ] Watcher thread errors are caught and logged, not fatal
- [ ] add_project/remove_project work at runtime
- [ ] Full test suite passes (all test files)
