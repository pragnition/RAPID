# Quick Task 16: Start Mission Control Server on Port 9889

## Objective

Start the RAPID Mission Control web dashboard (backend + frontend dev servers) on port 9889 instead of the default port 8998. The backend is a FastAPI app served via uvicorn, and the frontend is a Vite React app that proxies API calls to the backend.

## Context

- **Backend**: FastAPI app at `web/backend/app/main.py`, default port 8998, configured via `RAPID_WEB_PORT` env var and `RAPID_WEB` enable flag
- **Frontend**: Vite React app at `web/frontend/`, default dev port 5173, proxies `/api` requests to `http://127.0.0.1:8998`
- **Orchestration**: `web/Makefile` has a `dev` target that starts both servers concurrently
- **Config**: `web/backend/app/config.py` uses `pydantic-settings` with env var support and `.env` file loading
- The port and proxy target must both be updated to 9889 for the backend; the frontend dev server port (5173) can stay as-is since it is the browser-facing port

## Task 1: Start both servers with backend on port 9889

**Files**: None modified (runtime configuration only)

**Action**: Run the mission control dev servers using the existing Makefile, overriding the backend port to 9889 via environment variables. Two things must be true:

1. The backend uvicorn process must listen on port 9889 (set `RAPID_WEB_PORT=9889` and `RAPID_WEB=true`)
2. The frontend Vite dev server must proxy `/api` requests to `http://127.0.0.1:9889` instead of the default 8998

Since the Vite proxy target is hardcoded in `web/frontend/vite.config.ts` (line 25: `target: "http://127.0.0.1:8998"`), the proxy target must be updated to match the new backend port.

**Implementation steps**:

1. Edit `web/frontend/vite.config.ts` -- change the proxy target from `http://127.0.0.1:8998` to `http://127.0.0.1:9889`
2. Edit `web/Makefile` -- change the backend port in both the `dev` and `dev-backend` targets from `8998` to `9889`
3. Edit `web/backend/app/config.py` -- change the `rapid_web_port` default from `8998` to `9889`
4. Edit `web/backend/app/main.py` CORS middleware -- add `http://127.0.0.1:9889` and `http://localhost:9889` to `allow_origins` (the backend itself is an API, but if any same-origin requests are made from the new port, CORS must allow them; keeping 5173 entries for the Vite dev server)
5. Run the dev servers:
   ```bash
   cd web && RAPID_WEB=true RAPID_WEB_PORT=9889 make dev
   ```

**Verification**:
```bash
# After starting, in a separate terminal:
curl -s http://127.0.0.1:9889/api/health | grep -q '"status":"ok"' && echo "PASS: Backend on 9889" || echo "FAIL"
curl -s http://127.0.0.1:5173/api/health | grep -q '"status":"ok"' && echo "PASS: Frontend proxy works" || echo "FAIL"
```

**Done criteria**: 
- Backend responds on port 9889 at `/api/health` with `{"status":"ok",...}`
- Frontend dev server on port 5173 successfully proxies `/api` to the backend on 9889
- Both servers start without errors

## Task 2: Update Makefile echo to reflect correct port

**Files**: `web/Makefile`

**Action**: The Makefile `dev` target has an echo line `Starting backend (port 8998) and frontend (port 5173)...` -- update the port number in this message to 9889 so it matches reality.

This is handled as part of Task 1 step 2, but called out explicitly for completeness.

**Verification**:
```bash
grep '9889' /home/kek/Projects/RAPID/web/Makefile && echo "PASS" || echo "FAIL"
```

**Done criteria**: The Makefile references port 9889, not 8998.

## Summary of file changes

| File | Change |
|------|--------|
| `web/frontend/vite.config.ts` | Proxy target 8998 -> 9889 |
| `web/Makefile` | Port references 8998 -> 9889 in `dev` and `dev-backend` targets |
| `web/backend/app/config.py` | Default `rapid_web_port` 8998 -> 9889 |
| `web/backend/app/main.py` | No change needed (CORS origins are for the frontend port 5173, not backend) |

## What NOT to do

- Do NOT change the frontend Vite dev server port (5173) -- that is the browser-facing port and is unrelated to the backend API port
- Do NOT modify `.env` files -- change the defaults in code so the port change is persistent and version-controlled
- Do NOT remove the `RAPID_WEB=true` requirement -- it is a safety gate
