# PLAN: project-registry / Wave 1 — Foundation

**Objective:** Define Pydantic request/response schemas, add missing Project model columns via Alembic migration, and implement the project service layer with core business logic (register, deregister, list, get, STATE.json parsing). Also add `watchdog` dependency.

## Prerequisites
- service-infrastructure set merged (database.py, sync_engine.py, main.py, config.py exist)
- Alembic migration 0001 applied

## Tasks

### Task 1: Add watchdog dependency to pyproject.toml

**File:** `web/backend/pyproject.toml`

**Action:** Add `"watchdog>=6.0,<7.0"` to the `dependencies` list. Then run `cd /home/kek/Projects/RAPID/web/backend && uv sync` to install it.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "import watchdog; print(watchdog.__version__)"
```
Must print a version number without error.

**Commit:** `feat(project-registry): add watchdog dependency`

---

### Task 2: Alembic migration 0002 — add last_seen_at and metadata_json to project table

**File:** `web/backend/alembic/versions/0002_project_registry_columns.py`

**Action:** Create migration that adds two columns to the `project` table:
- `last_seen_at` — `sa.DateTime()`, nullable=True
- `metadata_json` — `sa.String()`, nullable=True, server_default='{}' (stores JSON string of STATE.json summary)

Use `op.batch_alter_table("project")` since SQLite requires batch mode for ALTER TABLE (this is why `render_as_batch=True` is set in env.py).

Set `revision = "0002"`, `down_revision = "0001"`.

Also update the `Project` model in `web/backend/app/database.py` to add the two new fields:
```python
last_seen_at: datetime | None = None
metadata_json: str = Field(default="{}")
```

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run pytest tests/test_migrations.py -v
```
Existing migration tests should still pass. Additionally:
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "
from app.database import Project
p = Project(name='test', path='/tmp/test')
assert hasattr(p, 'last_seen_at')
assert hasattr(p, 'metadata_json')
print('OK: Project model has new fields')
"
```

**Commit:** `feat(project-registry): add last_seen_at and metadata_json columns via migration 0002`

---

### Task 3: Create Pydantic schemas for project endpoints

**File:** `web/backend/app/schemas/project.py` (new file)

Also create `web/backend/app/schemas/__init__.py` (empty or re-export).

**Action:** Define these Pydantic models (NOT SQLModel — pure Pydantic BaseModel for API layer):

1. `ProjectCreate` — request body for POST /api/projects
   - `path: str` (required, must be absolute path)
   - `name: str | None = None` (optional override, auto-detected from STATE.json)
   - Add a field validator on `path` to ensure it is absolute (starts with `/`)

2. `ProjectSummary` — response for list endpoint items
   - `id: UUID`
   - `name: str`
   - `path: str`
   - `status: str`
   - `current_milestone: str | None` (extracted from metadata_json)
   - `set_count: int` (extracted from metadata_json)
   - `registered_at: datetime`
   - `last_seen_at: datetime | None`
   - Use `model_config = ConfigDict(from_attributes=True)` for ORM compatibility

3. `ProjectDetail` — response for single project endpoint (extends summary)
   - All fields from ProjectSummary
   - `milestones: list[dict]` (parsed fresh from STATE.json on disk at request time)
   - `metadata_json: str` (raw stored metadata)

4. `ProjectListResponse` — paginated list response
   - `items: list[ProjectSummary]`
   - `total: int`
   - `page: int`
   - `per_page: int`

5. `ProjectStatusResponse` — simple status response for POST/DELETE
   - `id: UUID`
   - `status: str`
   - `message: str | None = None`

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "
from app.schemas.project import ProjectCreate, ProjectSummary, ProjectDetail, ProjectListResponse, ProjectStatusResponse
from uuid import uuid4
from datetime import datetime
# Validate create schema
pc = ProjectCreate(path='/tmp/test')
assert pc.name is None
# Validate summary
ps = ProjectSummary(id=uuid4(), name='test', path='/tmp/test', status='active', current_milestone=None, set_count=0, registered_at=datetime.now(), last_seen_at=None)
print('OK: All schemas validate')
"
```

**Commit:** `feat(project-registry): define Pydantic request/response schemas`

---

### Task 4: Implement project_service.py — core business logic

**File:** `web/backend/app/services/project_service.py` (new file)

Also create `web/backend/app/services/__init__.py` (empty).

**Action:** Implement a service module with these functions (all take a `Session` parameter — no global state):

1. `parse_state_json(project_path: Path) -> dict | None`
   - Read `.planning/STATE.json` from the given path
   - Return parsed dict or None if file missing/malformed
   - Extract summary: `projectName`, current milestone ID/name, total set count, active set count
   - Return format: `{"project_name": str, "current_milestone": str | None, "milestone_name": str | None, "total_sets": int, "active_sets": int}`

2. `register_project(session: Session, path: str, name: str | None = None) -> Project`
   - Validate that `Path(path) / ".planning" / "STATE.json"` exists; raise ValueError if not
   - Parse STATE.json to extract project name (fall back to directory basename, fall back to user-provided name)
   - Check if project with this path already exists (idempotent): if so, update metadata and last_seen_at, return existing
   - Otherwise create new Project record with status="active"
   - Store parsed STATE.json summary in metadata_json field as JSON string
   - Commit and return the Project

3. `list_projects(session: Session, page: int = 1, per_page: int = 20) -> tuple[list[Project], int]`
   - Return paginated list of projects ordered by registered_at desc
   - Return (items, total_count) tuple
   - Validate page >= 1, per_page >= 1 and per_page <= 100

4. `get_project(session: Session, project_id: UUID) -> Project | None`
   - Return single project by UUID or None

5. `get_project_detail(session: Session, project_id: UUID) -> dict | None`
   - Get project, then read STATE.json fresh from disk at project.path
   - Return dict with all project fields plus `milestones` list parsed from STATE.json
   - If STATE.json is missing/unreadable, still return project but with empty milestones

6. `deregister_project(session: Session, project_id: UUID) -> Project | None`
   - Delete project by UUID, return the deleted Project or None if not found
   - Commit the deletion

7. `mark_unreachable(session: Session, project_id: UUID) -> None`
   - Set project status to "unreachable" and commit

8. `mark_active(session: Session, project_id: UUID) -> None`
   - Set project status to "active", update last_seen_at to now, commit

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run pytest tests/test_project_service.py -v
```

**Commit:** `feat(project-registry): implement project service layer`

---

### Task 5: Write unit tests for project_service.py

**File:** `web/backend/tests/test_project_service.py` (new file)

**Action:** Write tests using the existing conftest.py `session` fixture. Create temporary directories with `.planning/STATE.json` files using `tmp_path`.

Test cases to cover:
1. `test_parse_state_json_valid` — create a valid STATE.json, verify parsed output
2. `test_parse_state_json_missing` — non-existent path returns None
3. `test_parse_state_json_malformed` — invalid JSON returns None
4. `test_register_project_success` — register a project with valid STATE.json, verify fields
5. `test_register_project_auto_name` — name auto-detected from STATE.json projectName
6. `test_register_project_name_override` — user-supplied name takes precedence when provided
7. `test_register_project_no_state_json` — raises ValueError when STATE.json missing
8. `test_register_project_idempotent` — registering same path twice updates rather than duplicates
9. `test_list_projects_pagination` — create 5 projects, verify page=1,per_page=2 returns 2 items and total=5
10. `test_list_projects_empty` — returns ([], 0) on empty DB
11. `test_get_project_found` — returns project by ID
12. `test_get_project_not_found` — returns None for unknown UUID
13. `test_deregister_project` — removes project, returns it
14. `test_deregister_project_not_found` — returns None for unknown UUID
15. `test_mark_unreachable` — sets status to "unreachable"
16. `test_mark_active` — sets status to "active" and updates last_seen_at

Helper: Create a fixture `project_dir(tmp_path)` that creates `tmp_path / "myproject" / ".planning" / "STATE.json"` with content:
```json
{
  "projectName": "TestProject",
  "milestones": [{"id": "m1", "name": "MVP", "sets": [{"id": "s1", "status": "active"}, {"id": "s2", "status": "complete"}]}]
}
```

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run pytest tests/test_project_service.py -v
```
All tests must pass.

**Commit:** `test(project-registry): add unit tests for project service`

---

## File Ownership (Wave 1)
| File | Action |
|------|--------|
| `web/backend/pyproject.toml` | Modified (add watchdog) |
| `web/backend/app/database.py` | Modified (add 2 fields to Project) |
| `web/backend/alembic/versions/0002_project_registry_columns.py` | New |
| `web/backend/app/schemas/__init__.py` | New |
| `web/backend/app/schemas/project.py` | New |
| `web/backend/app/services/__init__.py` | New |
| `web/backend/app/services/project_service.py` | New |
| `web/backend/tests/test_project_service.py` | New |

## Success Criteria
- [ ] `watchdog` installs successfully
- [ ] Migration 0002 applies cleanly on top of 0001
- [ ] Project model has `last_seen_at` and `metadata_json` fields
- [ ] All 5 Pydantic schemas instantiate correctly
- [ ] All 16 service tests pass
- [ ] Existing tests (`test_main.py`, `test_database.py`, `test_migrations.py`) still pass
