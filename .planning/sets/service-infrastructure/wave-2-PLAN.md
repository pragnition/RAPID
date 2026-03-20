# PLAN: service-infrastructure — Wave 2 (Application Core)

## Objective

Build the FastAPI application factory with lifespan management, CORS configuration, exception handlers, and health/readiness endpoints. After this wave, the service can start, respond to health checks, and shut down gracefully.

## Prerequisites

- Wave 1 complete: `config.py`, `database.py`, `logging_config.py` all importable
- `uv sync` has been run in `web/backend/`

## Tasks

### Task 1: Create main.py — Application Factory and Lifespan

**File:** `web/backend/app/main.py`
**Action:** Create the FastAPI application factory with all middleware, exception handlers, and lifespan management.

The file must contain:

**1. Lifespan context manager:**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    ...
    yield
    # Shutdown
    ...
```
- On startup:
  - Call `setup_logging(settings.rapid_web_log_dir, settings.rapid_web_log_level)`
  - Create engine via `get_engine()`
  - Run migrations via `run_migrations(engine)`
  - Store engine in `app.state.engine`
  - Store startup time in `app.state.start_time` (use `time.time()`)
  - Log `"RAPID Web service started"` with port and db_path info
- On shutdown:
  - Dispose engine via `app.state.engine.dispose()`
  - Log `"RAPID Web service stopped"`

**2. Application factory `create_app() -> FastAPI`:**
- Create `FastAPI(title="RAPID Web", version=__version__, lifespan=lifespan)`
- Add CORS middleware:
  - `allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"]` (Vite dev server)
  - `allow_methods=["*"]`
  - `allow_headers=["*"]`
  - `allow_credentials=True`
- Add global exception handler for `Exception` that returns JSON `{"detail": str(exc)}` with 500 status, and logs the traceback
- Add `HTTPException` handler that returns structured JSON error response
- Register health router (see Task 2)
- Return the app

**3. Session dependency override:**
- Create a `get_db()` dependency generator that uses the engine from `request.app.state.engine`:
  ```python
  def get_db(request: Request):
      engine = request.app.state.engine
      with Session(engine) as session:
          yield session
  ```
- This replaces the standalone `get_session()` from database.py for request-scoped use

**4. Port conflict detection:**
- Function `check_port_available(host: str, port: int) -> None`:
  - Try `socket.bind((host, port))` then close
  - On failure, raise `SystemExit` with a clear message: "Port {port} is already in use. Check with: lsof -i :{port}"

**5. CLI entry point `cli_entry()`:**
- Called by the `rapid-web` script entry point
- Check `settings.rapid_web` is True, exit with message if not
- Call `check_port_available(settings.rapid_web_host, settings.rapid_web_port)`
- Run `uvicorn.run("app.main:app", host=settings.rapid_web_host, port=settings.rapid_web_port, log_level="warning")`
- Module-level `app = create_app()` for uvicorn import

**What NOT to do:**
- Do not use the deprecated `@app.on_event("startup")` / `@app.on_event("shutdown")` pattern -- use `lifespan` only
- Do not bind to `0.0.0.0` -- always `127.0.0.1` (localhost only per contract)
- Do not auto-increment port on conflict -- fail with clear error message
- Do not import `get_session` from database.py for request handling -- use the request-scoped `get_db` dependency that accesses `app.state.engine`

**Verification:**
```bash
cd web/backend && uv run python -c "
from app.main import create_app
app = create_app()
print('App title:', app.title)
print('Routes:', [r.path for r in app.routes])
assert any('/api/health' in str(r.path) for r in app.routes), 'Health route missing'
print('OK: app factory works')
"
```

### Task 2: Create Health and Readiness Endpoints

**File:** `web/backend/app/main.py` (same file as Task 1, defined as a router)
**Action:** Add health and readiness endpoints as an APIRouter included by `create_app()`.

Define a router `health_router = APIRouter(prefix="/api", tags=["health"])`:

**GET /api/health:**
- Returns `{"status": "ok", "version": __version__, "uptime": time.time() - request.app.state.start_time}`
- Response model: define a `HealthResponse(BaseModel)` with `status: str`, `version: str`, `uptime: float`
- Must respond within 100ms (no DB queries)

**GET /api/ready:**
- Performs a lightweight DB check: `SELECT 1` via the engine
- Returns `{"status": "ready", "database": "connected"}` on success
- Returns 503 with `{"status": "not_ready", "database": "disconnected"}` on failure
- Response model: define a `ReadyResponse(BaseModel)` with `status: str`, `database: str`

Include the router in the app via `app.include_router(health_router)`.

**Verification:**
```bash
cd web/backend && RAPID_WEB=true uv run python -c "
from httpx import AsyncClient, ASGITransport
from app.main import create_app
import asyncio, tempfile, os
os.environ['RAPID_WEB_DB_PATH'] = tempfile.mktemp(suffix='.db')
app = create_app()
async def test():
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        r = await client.get('/api/health')
        assert r.status_code == 200
        data = r.json()
        assert data['status'] == 'ok'
        assert 'uptime' in data
        print('Health:', data)
        r2 = await client.get('/api/ready')
        assert r2.status_code == 200
        print('Ready:', r2.json())
asyncio.run(test())
print('OK: endpoints working')
"
```

## File Ownership Summary

| File | Action |
|------|--------|
| `web/backend/app/main.py` | Create |

Note: This wave only creates one file. Tasks 1 and 2 are logically separate concerns within the same file, broken out for clarity of implementation.

## Success Criteria

1. `create_app()` returns a configured FastAPI instance with CORS and exception handlers
2. `GET /api/health` returns 200 with status, version, and uptime
3. `GET /api/ready` returns 200 with database connectivity status
4. Lifespan runs migrations on startup and disposes engine on shutdown
5. Port conflict detection raises `SystemExit` with actionable error message
6. `cli_entry()` starts uvicorn bound to 127.0.0.1:8998
