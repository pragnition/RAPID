# CONTEXT: web-install-bugfix

**Set:** web-install-bugfix
**Generated:** 2026-03-21
**Mode:** interactive

<domain>
## Set Boundary
Fix 5 interconnected web installation issues that prevent rapid-web from working as a self-contained production service. Covers the full install-to-serve pipeline: Python package discovery (pyproject.toml), Alembic migration path resolution (database.py), systemd service file configuration (rapid-web.service), frontend build integration (setup.sh), TypeScript compilation errors (useKanban.ts, KnowledgeGraphPage.tsx), and static file serving with SPA fallback (main.py). Partial fixes already applied to pyproject.toml and main.py — remaining work is Alembic paths, service file, TS errors, and setup.sh frontend build step.
</domain>

<decisions>
## Implementation Decisions

### Alembic Path Resolution

- Use editable install (`uv pip install -e .`) into a local `.venv` so `__file__` resolves back to the source tree where `alembic.ini` lives
- Combined with `WorkingDirectory` in the systemd service file to ensure correct cwd
- Add a fallback path resolution: try `__file__`-based path first, fall back to cwd-relative `alembic.ini`, and log a warning if the fallback is used

### Service File Configuration

- Use a template approach with placeholders (e.g., `__RAPID_ROOT__`) in the service file
- `setup.sh` runs `sed` to fill in actual paths at install time and generates the filled-in service file
- Do NOT auto-install or auto-enable the systemd service — just generate the filled file and print instructions for the user to install/enable manually

### TypeScript Error Strategy

- Fix the actual TypeScript errors properly with correct type annotations:
  - `useKanban.ts`: type the `onMutate` context return so `previous` is recognized
  - `KnowledgeGraphPage.tsx`: handle `string | undefined` properly
- Keep `tsc -b && vite build` as the build script — do not remove type checking from the build pipeline

### Frontend Build Integration

- Add frontend build step (`npm install && npx vite build`) to `setup.sh` as a new numbered step
- npm is a hard prerequisite — `setup.sh` fails if npm is not installed (same as the existing Node.js check)
- No graceful skip; frontend is a required component of the web dashboard
</decisions>

<specifics>
## Specific Ideas
- The pyproject.toml fix (`[tool.setuptools.packages.find]` with `include = ["app*"]`) is already applied
- The main.py SPA fallback code is already applied — verify it works with the built frontend
- Service file template should use `__RAPID_ROOT__` placeholder that setup.sh replaces with `$SCRIPT_DIR`
- The venv should be at `web/backend/.venv` and ExecStart should point to `.venv/bin/rapid-web`
- Alembic fallback should try: (1) `Path(__file__).parent.parent / "alembic.ini"`, (2) `Path.cwd() / "alembic.ini"`, with warning log on fallback
</specifics>

<code_context>
## Existing Code Insights

- `web/backend/pyproject.toml` already has `[tool.setuptools.packages.find]` with `include = ["app*"]` — Issue 1 is resolved
- `web/backend/app/main.py` already has static file serving + SPA fallback at lines 158-169 — Issue 3 is partially resolved
- `web/backend/app/database.py` line 150: `alembic_ini = Path(__file__).resolve().parent.parent / "alembic.ini"` — needs fallback logic
- `web/backend/service/rapid-web.service` uses `ExecStart=%h/.local/bin/rapid-web` with no WorkingDirectory — needs template placeholders
- `web/frontend/package.json` build script: `"build": "tsc -b && vite build"` — keep as-is after fixing TS errors
- `useKanban.ts` line 194: `onError` callback uses `context?.previous` but TypeScript doesn't infer the context type from `onMutate` return
- `KnowledgeGraphPage.tsx`: `activeProjectId` is `string | null` from zustand store, passed to hooks that may expect `string`
- `setup.sh` has 5 steps currently — frontend build will be added as a new step
- `web/Makefile` exists as a dev convenience but is not part of the install path
- `web/frontend/vite.config.ts` uses `tsconfigPaths: true` for path aliases
</code_context>

<deferred>
## Deferred Ideas
- Automated end-to-end install test that runs setup.sh in a clean environment
- Launchd service template for macOS (currently only systemd for Linux)
- Frontend hot-reload proxy in production mode
</deferred>
