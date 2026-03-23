# Web Install Issues — v4.1.0

## Issue 1: `pyproject.toml` missing package discovery config

**Symptom:** `uv tool install` and `pip install` fail with:
```
error: Multiple top-level packages discovered in a flat-layout: ['app', 'alembic', 'service'].
```

**Cause:** `web/backend/` has three top-level directories (`app/`, `alembic/`, `service/`) but no `[tool.setuptools.packages.find]` in `pyproject.toml`. Setuptools refuses to auto-discover in flat layouts with multiple candidates.

**Fix:** Add to `web/backend/pyproject.toml`:
```toml
[tool.setuptools.packages.find]
include = ["app*"]
```

---

## Issue 2: Alembic migrations fail when installed as `uv tool`

**Symptom:** Service crashes on startup:
```
alembic.util.exc.CommandError: No 'script_location' key found in configuration.
```

**Cause:** `database.py:150` resolves `alembic.ini` via `Path(__file__).resolve().parent.parent / "alembic.ini"`. When installed as a `uv tool`, `__file__` points to `~/.local/share/uv/tools/rapid-web/lib/python3.13/site-packages/app/database.py` — two parents up is `site-packages/`, which has no `alembic.ini` or `alembic/` directory since neither is included as package data.

**Fix options:**
1. **Recommended:** Use `uv pip install -e .` into a local `.venv` instead of `uv tool install`, and set `WorkingDirectory` in the systemd service to `web/backend/`. The editable install resolves `__file__` back to the source tree where `alembic.ini` lives.
2. **Alternative:** Bundle `alembic.ini` and `alembic/` as package data, or resolve the migration path from an env var / config setting rather than `__file__`.

**Service file change needed** (either way):
```ini
WorkingDirectory=%h/.claude/plugins/cache/joey-plugins/rapid/4.1.0/web/backend
ExecStart=%h/.claude/plugins/cache/joey-plugins/rapid/4.1.0/web/backend/.venv/bin/rapid-web
```

---

## Issue 3: Backend does not serve frontend — 404 on `/`

**Symptom:** `curl http://127.0.0.1:8998/` returns `{"detail":"Not Found"}`. API endpoints like `/api/health` work fine.

**Cause:** `create_app()` in `main.py` only mounts API routers. There is no static file serving or SPA fallback. The frontend Vite config (`vite.config.ts`) proxies `/api` to `:8998`, implying a two-server dev setup, but there is no production path where the backend serves the built frontend.

**Fix:** After all API routers, mount the frontend `dist/` directory:
```python
from pathlib import Path
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# At end of create_app(), before return:
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.is_dir():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="static")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")
```

**Also needed:** The install skill must run `npm install && npx vite build` in `web/frontend/` to produce the `dist/` directory. Currently the skill never builds the frontend.

---

## Issue 4: `setup.sh` install skill doesn't build frontend

**Symptom:** Even after fixing issues 1-3, the frontend `dist/` directory doesn't exist unless manually built.

**Fix:** Add a frontend build step to `setup.sh` or the `/rapid:install` skill:
```bash
cd "$RAPID_ROOT/web/frontend" && npm install && npx vite build
```

---

## Issue 5: TypeScript errors block `npm run build`

**Symptom:** `tsc -b && vite build` fails:
```
src/hooks/useKanban.ts(196,20): error TS2339: Property 'previous' does not exist on type '{}'.
src/pages/KnowledgeGraphPage.tsx(143,29): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
```

**Fix:** Either fix the TS errors, or change the build script to skip type checking:
```json
"build": "vite build"
```
(Workaround used during install: ran `npx vite build` directly, bypassing `tsc`.)

---

## Summary of files changed

| File | Change |
|------|--------|
| `web/backend/pyproject.toml` | Added `[tool.setuptools.packages.find]` with `include = ["app*"]` |
| `web/backend/app/main.py` | Added static file serving + SPA fallback for frontend `dist/` |
| `web/backend/service/rapid-web.service` | Needs `WorkingDirectory` and venv-aware `ExecStart` |
