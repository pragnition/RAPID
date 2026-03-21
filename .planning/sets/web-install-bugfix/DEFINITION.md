# Set: web-install-bugfix

**Created:** 2026-03-21 (via /add-set)
**Milestone:** v4.0.0

## Scope
Fix all 5 web installation issues documented in web-install.md:
1. `pyproject.toml` missing package discovery config — setuptools fails with multiple top-level packages
2. Alembic migrations fail when installed as `uv tool` — `__file__` resolves to wrong path
3. Backend does not serve frontend — no static file serving or SPA fallback
4. Install skill doesn't build frontend — `dist/` directory never created
5. TypeScript errors block `npm run build` — `tsc` fails on type errors

## Key Deliverables
- Working `uv pip install -e .` with correct package discovery
- Alembic migrations that resolve correctly in both dev and installed contexts
- Backend serves built frontend with SPA fallback routing
- Frontend build integrated into install workflow
- TypeScript errors fixed or build script adjusted to bypass tsc

## Dependencies
None

## Files and Areas
- `web/backend/pyproject.toml` — package discovery config
- `web/backend/app/main.py` — static file serving + SPA fallback
- `web/backend/app/database.py` — alembic path resolution
- `web/backend/service/rapid-web.service` — WorkingDirectory and ExecStart
- `web/frontend/src/hooks/useKanban.ts` — TS error fix
- `web/frontend/src/pages/KnowledgeGraphPage.tsx` — TS error fix
- Other files as necessary
