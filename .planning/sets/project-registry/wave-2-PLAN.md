# PLAN: project-registry / Wave 2 — API Layer

**Objective:** Implement the FastAPI projects router with CRUD endpoints, pagination, and wire it into the app factory. Integrate SyncEngine calls into registration and deregistration flows. Write endpoint integration tests.

## Prerequisites
- Wave 1 complete (schemas, service, model fields, migration all in place)

## Tasks

### Task 1: Create the projects router

**File:** `web/backend/app/routers/projects.py` (new file)

Also create `web/backend/app/routers/__init__.py` (empty).

**Action:** Implement a FastAPI APIRouter with prefix `/api/projects` and tag `projects`.

Use `Depends(get_db)` from `app.main` for session injection (the `get_db` generator that yields a Session from `request.app.state.engine`). Import schemas from `app.schemas.project` and service functions from `app.services.project_service`.

Endpoints:

1. **POST /api/projects** — Register a project
   - Request body: `ProjectCreate`
   - Call `project_service.register_project(session, body.path, body.name)`
   - On success, sync to disk via SyncEngine: create a `SyncEngine(Path(project.path), session)` and call `sync_to_disk("project", str(project.id), project.model_dump(mode="json"))`. Then call `update_sync_state(str(project.id))`.
   - Return `ProjectStatusResponse` with status 201
   - On ValueError (no STATE.json), return 422 with error detail
   - On unexpected error, let the global handler catch it (500)

2. **GET /api/projects** — List projects (paginated)
   - Query params: `page: int = 1`, `per_page: int = 20`
   - Call `project_service.list_projects(session, page, per_page)`
   - For each project, parse `metadata_json` to extract `current_milestone` and `set_count` for the summary
   - Return `ProjectListResponse`

3. **GET /api/projects/{project_id}** — Get project detail
   - Path param: `project_id: UUID`
   - Call `project_service.get_project_detail(session, project_id)`
   - Return 404 if None
   - Return `ProjectDetail` with milestones parsed fresh from disk

4. **DELETE /api/projects/{project_id}** — Deregister a project
   - Path param: `project_id: UUID`
   - Call `project_service.deregister_project(session, project_id)`
   - On success, delete from disk via SyncEngine: `SyncEngine(Path(project.path), session).delete_from_disk("project", str(project.id))`
   - Return 404 if project not found
   - Return `ProjectStatusResponse` with message "deregistered"

Helper function in the router module:
- `_project_to_summary(project: Project) -> ProjectSummary` — parse project.metadata_json to extract current_milestone and set_count, construct and return a ProjectSummary

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "
from app.routers.projects import router
print(f'Router prefix: {router.prefix}')
print(f'Routes: {[r.path for r in router.routes]}')
"
```

**Commit:** `feat(project-registry): implement projects REST API router`

---

### Task 2: Wire router into app factory

**File:** `web/backend/app/main.py`

**Action:** Add one import and one `app.include_router()` call in `create_app()`:

1. Add import at top: `from app.routers.projects import router as projects_router`
2. In `create_app()`, after `app.include_router(health_router)`, add: `app.include_router(projects_router)`

Do NOT modify any other part of main.py.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "
from app.main import create_app
app = create_app()
paths = [r.path for r in app.routes]
assert '/api/projects' in paths or '/api/projects/' in paths, f'Missing /api/projects in {paths}'
print('OK: projects router wired')
"
```

Also verify existing tests still pass:
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run pytest tests/test_main.py -v
```

**Commit:** `feat(project-registry): wire projects router into app factory`

---

### Task 3: Write endpoint integration tests

**File:** `web/backend/tests/test_projects_api.py` (new file)

**Action:** Write async integration tests using the same pattern as `test_main.py` — create a `test_engine`, `test_app`, and `async_client` fixture set. Create temporary project directories with STATE.json for registration tests.

Fixtures needed:
- `test_engine(tmp_path)` — SQLite engine with all tables created
- `test_app(test_engine)` — FastAPI app with engine set on state
- `async_client(test_app)` — httpx AsyncClient with ASGITransport
- `project_dir(tmp_path)` — creates a temp directory with `.planning/STATE.json`

Test cases:

**Registration:**
1. `test_register_project_201` — POST with valid path, get 201 with id and status
2. `test_register_project_422_no_state_json` — POST with path lacking STATE.json, get 422
3. `test_register_project_idempotent` — POST same path twice, second returns same id
4. `test_register_project_custom_name` — POST with name override, verify name in response

**Listing:**
5. `test_list_projects_empty` — GET /api/projects returns items=[], total=0
6. `test_list_projects_returns_registered` — register 1, list returns it
7. `test_list_projects_pagination` — register 3, request page=1&per_page=2, verify 2 items and total=3
8. `test_list_projects_page_2` — register 3, request page=2&per_page=2, verify 1 item

**Detail:**
9. `test_get_project_detail` — register, then GET by id, verify all fields including milestones
10. `test_get_project_not_found_404` — GET with random UUID, verify 404

**Deregistration:**
11. `test_deregister_project_200` — register then DELETE, verify response
12. `test_deregister_project_not_found_404` — DELETE with random UUID, verify 404
13. `test_deregister_then_list_empty` — register, deregister, list returns empty

All tests use `@pytest.mark.asyncio` decorator.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run pytest tests/test_projects_api.py -v
```
All tests must pass.

**Commit:** `test(project-registry): add endpoint integration tests for projects API`

---

## File Ownership (Wave 2)
| File | Action |
|------|--------|
| `web/backend/app/routers/__init__.py` | New |
| `web/backend/app/routers/projects.py` | New |
| `web/backend/app/main.py` | Modified (add router include) |
| `web/backend/tests/test_projects_api.py` | New |

## Success Criteria
- [ ] All 4 CRUD endpoints respond correctly
- [ ] Pagination returns correct total and page slices
- [ ] SyncEngine is called on register and deregister
- [ ] 404 returned for unknown project IDs
- [ ] 422 returned for invalid registration (no STATE.json)
- [ ] All 13 endpoint tests pass
- [ ] All existing tests still pass (test_main.py, test_project_service.py)
