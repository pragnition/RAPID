# Wave 1: Backend API + Frontend Data Layer

## Objective

Build the complete backend API surface (4 GET endpoints with schemas, services, and tests) and the frontend data layer (TypeScript types and TanStack Query hooks with 2-second polling). After this wave, all four endpoints serve real data and the frontend can fetch it.

## Dependencies to Install

### Backend (pyproject.toml)
Add to `[project.dependencies]`:
- `tree-sitter>=0.24,<1.0`
- `tree-sitter-python>=0.23,<1.0`
- `tree-sitter-javascript>=0.23,<1.0`
- `tree-sitter-go>=0.23,<1.0`
- `tree-sitter-rust>=0.23,<1.0`

### Frontend (package.json)
Add to `dependencies`:
- `cytoscape` (^3.33.1)
- `cytoscape-dagre` (^2.5.0)

Add to `devDependencies`:
- `@types/cytoscape-dagre` (^2.3.4)

Note: `cytoscape` ships built-in TypeScript types -- no separate `@types/cytoscape` needed.

---

## Task 1: Backend Schemas

**Files created:**
- `web/backend/app/schemas/views.py`

**Action:**
Create Pydantic response models for all four view endpoints. Follow the pattern in `schemas/project.py` (BaseModel with ConfigDict where needed).

**Models to define:**

```
# -- State View --
class SetState(BaseModel):
    id: str
    status: str  # pending | discussed | planned | executing | complete | merged
    waves: list[dict]  # pass through raw wave data

class MilestoneState(BaseModel):
    id: str
    name: str
    sets: list[SetState]

class ProjectState(BaseModel):
    version: int
    project_name: str
    current_milestone: str | None
    milestones: list[MilestoneState]

# -- Worktree View --
class WorktreeInfo(BaseModel):
    set_name: str
    branch: str
    path: str
    phase: str
    status: str
    wave: int | None = None
    created_at: str | None = None
    solo: bool = False
    merge_status: str | None = None
    merged_at: str | None = None
    merge_commit: str | None = None

class WorktreeRegistry(BaseModel):
    version: int
    worktrees: list[WorktreeInfo]

# -- DAG View --
class DagNode(BaseModel):
    id: str
    wave: int
    status: str

class DagEdge(BaseModel):
    source: str    # maps from JSON "from" field (use alias)
    target: str    # maps from JSON "to" field (use alias)

class DagWave(BaseModel):
    sets: list[str]
    checkpoint: dict = {}

class DagGraph(BaseModel):
    nodes: list[DagNode]
    edges: list[DagEdge]
    waves: dict[str, DagWave]
    metadata: dict = {}

# -- Codebase View --
class CodeSymbol(BaseModel):
    name: str
    kind: str  # function | class | method | module
    start_line: int
    end_line: int
    children: list["CodeSymbol"] = []

class CodeFile(BaseModel):
    path: str  # relative to project root
    language: str
    symbols: list[CodeSymbol]

class CodebaseTree(BaseModel):
    files: list[CodeFile]
    languages: list[str]
    total_files: int
    parse_errors: list[str] = []
```

**What NOT to do:**
- Do not add `from_attributes=True` -- these models are built from dicts, not ORM objects
- Do not import or reference the Project DB model in this file

**Verification:**
```bash
cd web/backend && python -c "from app.schemas.views import ProjectState, WorktreeRegistry, DagGraph, CodebaseTree; print('OK')"
```

---

## Task 2: Backend Services — State, Worktree, DAG

**Files created:**
- `web/backend/app/services/state_service.py`
- `web/backend/app/services/worktree_service.py`
- `web/backend/app/services/dag_service.py`

**Action:**
Create three service modules that read `.planning/` JSON files and return structured data. Follow the pattern in `project_service.py` (standalone functions taking a `project_path: Path` argument, returning dict or None on failure).

### state_service.py

```
def get_project_state(project_path: Path) -> dict | None:
    """Read .planning/STATE.json and return full state structure.

    Returns dict with keys: version, project_name, current_milestone, milestones.
    Each milestone contains id, name, and list of sets with id, status, waves.
    Returns None if file missing or malformed.
    """
```

Implementation notes:
- Read `project_path / ".planning" / "STATE.json"`
- Map `projectName` -> `project_name`, `currentMilestone` -> `current_milestone`
- Pass through milestones array with sets intact (sets have id, status, waves)
- Wrap in try/except for FileNotFoundError, OSError, json.JSONDecodeError -> return None

### worktree_service.py

```
def get_worktree_registry(project_path: Path) -> dict | None:
    """Read .planning/worktrees/REGISTRY.json and return worktree list.

    Returns dict with keys: version, worktrees (as list, not dict).
    Each worktree has: set_name, branch, path, phase, status, wave,
    created_at, solo, merge_status, merged_at, merge_commit.
    Returns None if file missing or malformed.
    """
```

Implementation notes:
- Read `project_path / ".planning" / "worktrees" / "REGISTRY.json"`
- The raw JSON has `worktrees` as a dict keyed by set name. Convert to a list where each item includes `set_name` from the key.
- Map camelCase keys to snake_case: `setName`->`set_name`, `mergeStatus`->`merge_status`, `mergedAt`->`merged_at`, `mergeCommit`->`merge_commit`, `createdAt`->`created_at`
- Default `solo` to `False` when not present
- Default `wave` to `None` when not present

### dag_service.py

```
def get_dag_graph(project_path: Path) -> dict | None:
    """Read .planning/sets/DAG.json and return graph structure.

    Returns dict with keys: nodes, edges, waves, metadata.
    Returns None if file missing or malformed.
    """
```

Implementation notes:
- Read `project_path / ".planning" / "sets" / "DAG.json"`
- Edges in the JSON may use `from`/`to` keys. Map these to `source`/`target` for the response.
- Pass through nodes, waves, and metadata as-is (they already match our schema format)

**What NOT to do:**
- Do not import the database module or Session -- these services are pure filesystem readers
- Do not cache anything in this wave (caching is only needed for codebase service)

**Verification:**
```bash
cd web/backend && python -c "
from app.services.state_service import get_project_state
from app.services.worktree_service import get_worktree_registry
from app.services.dag_service import get_dag_graph
print('Imports OK')
"
```

---

## Task 3: Backend Service — Codebase (tree-sitter)

**Files created:**
- `web/backend/app/services/codebase_service.py`

**Action:**
Create the codebase parsing service using tree-sitter. This is the most complex service -- it walks the project directory, parses supported files, and extracts symbol trees.

```
# Module-level cache: dict mapping (filepath, mtime) -> list of symbols
_parse_cache: dict[tuple[str, float], list[dict]] = {}

SUPPORTED_LANGUAGES: dict[str, tuple[str, list[str]]] = {
    "python": ("tree_sitter_python", [".py"]),
    "javascript": ("tree_sitter_javascript", [".js", ".jsx", ".ts", ".tsx"]),
    "go": ("tree_sitter_go", [".go"]),
    "rust": ("tree_sitter_rust", [".rs"]),
}

# Node types to extract per language
SYMBOL_QUERIES: dict[str, list[str]] = {
    "python": ["function_definition", "class_definition"],
    "javascript": ["function_declaration", "class_declaration", "arrow_function", "method_definition"],
    "go": ["function_declaration", "method_declaration", "type_declaration"],
    "rust": ["function_item", "struct_item", "impl_item", "enum_item"],
}

def get_codebase_tree(project_path: Path, max_files: int = 500) -> dict:
    """Walk project directory, parse supported files with tree-sitter, return symbol tree.

    Returns dict with keys: files, languages, total_files, parse_errors.

    Skips directories: .git, .rapid-worktrees, .planning, node_modules,
    __pycache__, .venv, venv, target, dist, build
    """
```

Implementation notes:
- Use `tree_sitter.Language` and `tree_sitter.Parser` from the tree-sitter 0.24+ API
- Load each grammar via its package: e.g., `import tree_sitter_python; lang = Language(tree_sitter_python.language())`
- Walk the project directory using `os.walk()`, filtering by supported extensions
- For each file: check mtime against `_parse_cache`. If cache hit, use cached result.
- If cache miss: read file, parse with tree-sitter, walk the AST to extract top-level symbols
- Extract symbol name from the first `identifier` (or `type_identifier` for Rust struct/enum) child node
- For classes/structs, recurse one level to find method children
- Limit to `max_files` files total to bound response size
- Collect parse errors (files that fail to parse) in a separate list
- Return `languages` as the set of languages actually found

**What NOT to do:**
- Do not use tree-sitter WASM builds -- use native Python tree-sitter
- Do not parse files larger than 1MB (skip with a note in parse_errors)
- Do not follow symlinks during directory walk
- Do not import database models

**Verification:**
```bash
cd web/backend && python -c "from app.services.codebase_service import get_codebase_tree; print('Import OK')"
```

---

## Task 4: Backend Routers

**Files created:**
- `web/backend/app/routers/views.py`

**File modified:**
- `web/backend/app/main.py` (add router import and `include_router`)

**Action:**
Create a single router module with four GET endpoints. Follow the pattern from `routers/projects.py` (use `APIRouter`, `Depends(get_db)`, `HTTPException`).

### views.py

```python
router = APIRouter(prefix="/api/projects", tags=["views"])

# 1. GET /api/projects/{project_id}/state -> ProjectState
# 2. GET /api/projects/{project_id}/worktrees -> WorktreeRegistry
# 3. GET /api/projects/{project_id}/dag -> DagGraph
# 4. GET /api/projects/{project_id}/codebase -> CodebaseTree
```

Each endpoint:
1. Look up project from DB by UUID (reuse `get_db` dependency from `routers/projects.py` or define the same pattern)
2. If project not found, return 404
3. Call the corresponding service function with `Path(project.path)`
4. If service returns None, return 404 with detail like "STATE.json not found"
5. Validate through the Pydantic schema and return

For the codebase endpoint, add an optional `max_files: int = 500` query parameter.

### main.py modification

Add after the existing `projects_router` import:
```python
from app.routers.views import router as views_router
```

Add after the existing `app.include_router(projects_router)`:
```python
app.include_router(views_router)
```

**What NOT to do:**
- Do not add POST/PUT/DELETE/PATCH endpoints -- this set is GET-only
- Do not duplicate the `get_db` dependency -- import it from where it is defined or define it identically

**Verification:**
```bash
cd web/backend && python -c "from app.routers.views import router; print(f'Routes: {[r.path for r in router.routes]}')"
```

---

## Task 5: Backend Tests

**Files created:**
- `web/backend/tests/test_views_api.py`

**Action:**
Write integration tests for all four view endpoints. Follow the exact pattern from `test_projects_api.py` (use `test_engine`, `test_app`, `async_client`, `project_dir` fixtures).

### Test structure:

```
class TestStateEndpoint:
    async test_state_200(async_client, project_dir):
        # Register project, GET /api/projects/{id}/state, assert 200
        # Assert response has version, project_name, milestones

    async test_state_404_no_project(async_client):
        # GET with random UUID -> 404

    async test_state_404_missing_file(async_client, project_dir_no_state):
        # Register, delete STATE.json, GET -> 404 or empty

class TestWorktreeEndpoint:
    async test_worktrees_200(async_client, project_dir):
        # Create project_dir with .planning/worktrees/REGISTRY.json
        # Register, GET /api/projects/{id}/worktrees, assert 200
        # Assert response has version, worktrees list

    async test_worktrees_404_no_registry(async_client, project_dir):
        # No REGISTRY.json -> 404

class TestDagEndpoint:
    async test_dag_200(async_client, project_dir):
        # Create project_dir with .planning/sets/DAG.json
        # Register, GET /api/projects/{id}/dag, assert 200
        # Assert response has nodes, edges, waves

    async test_dag_404_no_dag_file(async_client, project_dir):
        # No DAG.json -> 404

class TestCodebaseEndpoint:
    async test_codebase_200(async_client, project_dir):
        # Create a .py file in project_dir
        # Register, GET /api/projects/{id}/codebase, assert 200
        # Assert response has files, languages, total_files

    async test_codebase_max_files_param(async_client, project_dir):
        # GET with ?max_files=1, verify truncation

class TestViewsReadOnly:
    async test_no_post_on_state(async_client, project_dir):
        # POST /api/projects/{id}/state -> 405 Method Not Allowed

    async test_no_put_on_worktrees(async_client, project_dir):
        # PUT /api/projects/{id}/worktrees -> 405 Method Not Allowed

    async test_no_delete_on_dag(async_client, project_dir):
        # DELETE /api/projects/{id}/dag -> 405 Method Not Allowed
```

**Fixtures needed (add to the test file):**
- Reuse `test_engine`, `test_app`, `async_client` pattern from `test_projects_api.py`
- Create `project_dir` that sets up STATE.json, REGISTRY.json, DAG.json, and a sample .py file
- Each fixture creates the required `.planning/` subfiles

**What NOT to do:**
- Do not test tree-sitter parsing in detail here -- just verify the endpoint returns data
- Do not test service internals -- these are endpoint integration tests

**Verification:**
```bash
cd web/backend && python -m pytest tests/test_views_api.py -v --tb=short 2>&1 | tail -30
```

---

## Task 6: Frontend Types + Hooks

**File modified:**
- `web/frontend/src/types/api.ts` (append new interfaces)

**Files created:**
- `web/frontend/src/hooks/useViews.ts`

### api.ts additions

Append these interfaces after the existing ones:

```typescript
// -- State View --
export interface SetState {
  id: string;
  status: string;
  waves: Record<string, unknown>[];
}

export interface MilestoneState {
  id: string;
  name: string;
  sets: SetState[];
}

export interface ProjectState {
  version: number;
  project_name: string;
  current_milestone: string | null;
  milestones: MilestoneState[];
}

// -- Worktree View --
export interface WorktreeInfo {
  set_name: string;
  branch: string;
  path: string;
  phase: string;
  status: string;
  wave: number | null;
  created_at: string | null;
  solo: boolean;
  merge_status: string | null;
  merged_at: string | null;
  merge_commit: string | null;
}

export interface WorktreeRegistry {
  version: number;
  worktrees: WorktreeInfo[];
}

// -- DAG View --
export interface DagNode {
  id: string;
  wave: number;
  status: string;
}

export interface DagEdge {
  source: string;
  target: string;
}

export interface DagWave {
  sets: string[];
  checkpoint: Record<string, unknown>;
}

export interface DagGraph {
  nodes: DagNode[];
  edges: DagEdge[];
  waves: Record<string, DagWave>;
  metadata: Record<string, unknown>;
}

// -- Codebase View --
export interface CodeSymbol {
  name: string;
  kind: string;
  start_line: number;
  end_line: number;
  children: CodeSymbol[];
}

export interface CodeFile {
  path: string;
  language: string;
  symbols: CodeSymbol[];
}

export interface CodebaseTree {
  files: CodeFile[];
  languages: string[];
  total_files: number;
  parse_errors: string[];
}
```

### useViews.ts

Create hooks following the `useProjects` / `useProjectDetail` pattern. Each hook:
- Takes `projectId: string | null`
- Uses `enabled: projectId !== null` to prevent fetching without a selection
- Sets `refetchInterval: 2000` for 2-second auto-refresh polling
- Sets `staleTime: 1000` so data is considered stale after 1s (ensures refetch cycle)

```typescript
export function useProjectState(projectId: string | null) { ... }
export function useWorktreeRegistry(projectId: string | null) { ... }
export function useDagGraph(projectId: string | null) { ... }
export function useCodebaseTree(projectId: string | null, maxFiles?: number) { ... }
```

Query keys: `["project-state", projectId]`, `["worktree-registry", projectId]`, `["dag-graph", projectId]`, `["codebase-tree", projectId, maxFiles]`.

**What NOT to do:**
- Do not use WebSocket or SSE -- polling only per CONTEXT.md decision
- Do not set `refetchOnWindowFocus: false` -- keep the default (true) for better UX

**Verification:**
```bash
cd web/frontend && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 7: Install Dependencies

**Files modified:**
- `web/backend/pyproject.toml`
- `web/frontend/package.json`

**Action:**

### Backend
Add to the `dependencies` list in `pyproject.toml`:
```
"tree-sitter>=0.24,<1.0",
"tree-sitter-python>=0.23,<1.0",
"tree-sitter-javascript>=0.23,<1.0",
"tree-sitter-go>=0.23,<1.0",
"tree-sitter-rust>=0.23,<1.0",
```

Then run: `cd web/backend && pip install -e .` (or `uv pip install -e .` if using uv)

### Frontend
Run from `web/frontend/`:
```bash
npm install cytoscape@^3.33.1 cytoscape-dagre@^2.5.0
npm install -D @types/cytoscape-dagre@^2.3.4
```

**Verification:**
```bash
cd web/backend && python -c "import tree_sitter; import tree_sitter_python; print('Backend deps OK')"
cd web/frontend && node -e "require('cytoscape'); console.log('Frontend deps OK')"
```

---

## Success Criteria

1. All four backend endpoints return 200 with correct data shape when given a project with the corresponding `.planning/` files
2. All four endpoints return 404 when project or data file is missing
3. POST/PUT/DELETE on view endpoints return 405
4. Backend test suite passes: `python -m pytest tests/test_views_api.py -v`
5. Frontend TypeScript compiles without errors: `npx tsc --noEmit`
6. Frontend hooks export correctly: `import { useProjectState, useWorktreeRegistry, useDagGraph, useCodebaseTree } from "@/hooks/useViews"`
7. All dependencies installed and importable

## File Ownership Summary

**New files (this wave only):**
- `web/backend/app/schemas/views.py`
- `web/backend/app/services/state_service.py`
- `web/backend/app/services/worktree_service.py`
- `web/backend/app/services/dag_service.py`
- `web/backend/app/services/codebase_service.py`
- `web/backend/app/routers/views.py`
- `web/backend/tests/test_views_api.py`
- `web/frontend/src/hooks/useViews.ts`

**Modified files (this wave only):**
- `web/backend/app/main.py` (add router import + include_router)
- `web/backend/pyproject.toml` (add tree-sitter deps)
- `web/frontend/src/types/api.ts` (append interfaces)
- `web/frontend/package.json` (add cytoscape deps, via npm install)
