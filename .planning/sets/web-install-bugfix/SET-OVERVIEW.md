# SET-OVERVIEW: web-install-bugfix

## Approach

This set addresses five interconnected installation issues that prevent `rapid-web` from working as a production-ready, self-contained service. The bugs span the full install-to-serve pipeline: Python package discovery, Alembic migration path resolution, frontend build integration, TypeScript compilation errors, and static file serving with SPA fallback.

The issues have a natural dependency chain. Package discovery (Issue 1) must be correct before installation works at all. Alembic path resolution (Issue 2) must work for the service to start. The frontend must build without errors (Issue 5) before it can be integrated into the install workflow (Issue 4). And static file serving (Issue 3) ties everything together by making the backend serve the built frontend in production.

Some fixes have already been partially applied on the working tree (pyproject.toml package discovery and main.py static serving), so the implementation must audit what is already done, complete the remaining gaps (service file, install workflow, TS errors), and verify the entire pipeline end-to-end.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `web/backend/pyproject.toml` | Package discovery config for setuptools | Existing (partial fix applied) |
| `web/backend/app/main.py` | Static file serving + SPA fallback | Existing (partial fix applied) |
| `web/backend/app/database.py` | Alembic migration path resolution (line 150) | Existing (needs fix) |
| `web/backend/service/rapid-web.service` | Systemd service unit (WorkingDirectory, ExecStart) | Existing (needs fix) |
| `web/frontend/src/hooks/useKanban.ts` | TS error: `previous` on `{}` (line ~192) | Existing (needs fix) |
| `web/frontend/src/pages/KnowledgeGraphPage.tsx` | TS error: `string \| undefined` not assignable (line ~143) | Existing (needs fix) |
| `web/frontend/package.json` | Build script (currently `tsc -b && vite build`) | Existing (may need adjustment) |
| `setup.sh` | Plugin install script (no frontend build step) | Existing (needs frontend build step) |
| `web/Makefile` | Dev/build convenience targets | Existing (reference only) |

## Integration Points

- **Exports:** None. This is a self-contained bugfix set with no function or type exports.
- **Imports:** None. No dependencies on other sets.
- **Side Effects:** After this set, `setup.sh` will additionally install and build the frontend. The systemd service file will use a venv-relative `ExecStart` and explicit `WorkingDirectory`, changing how the service is deployed. The backend will serve frontend assets at non-API routes, changing the HTTP response surface.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Alembic path resolution differs between editable install and uv tool install | High | Use editable install (`uv pip install -e .`) as the recommended path; set WorkingDirectory in service file so relative paths resolve correctly |
| TypeScript errors may mask deeper type issues beyond the two known sites | Medium | Fix the two known errors first; run full `tsc -b` to verify no hidden errors remain |
| Frontend `dist/` path in main.py uses `__file__`-relative resolution | Medium | Verify the path resolves correctly in both dev (source tree) and editable-install contexts; add a startup log line showing the resolved path |
| setup.sh frontend build adds npm as a hard dependency for all users | Low | Gate the frontend build step behind a check for npm availability; skip gracefully if not installed |
| SPA catch-all route could shadow future API routes if ordering is wrong | Low | Mount SPA route last (after all API routers) and ensure `/api` prefix is excluded from the catch-all |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation fixes -- pyproject.toml package discovery (verify existing fix), Alembic path resolution in database.py, service file WorkingDirectory/ExecStart updates
- **Wave 2:** Frontend fixes -- TypeScript errors in useKanban.ts and KnowledgeGraphPage.tsx, build script adjustment in package.json if needed
- **Wave 3:** Integration -- frontend build step in setup.sh, verify static file serving in main.py (existing fix), end-to-end validation that install + start + serve all work

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
