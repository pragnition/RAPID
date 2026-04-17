# Quick Task 21: Add Logging to Backend

## Objective

The user cannot see when agent runs happen -- there is no visibility into agent lifecycle events (start, progress, completion, errors) or key backend operations. The logging infrastructure already exists (`logging_config.py`, `RunIdLogFilter`, JSON structured logging), but most modules use their logger for nearly nothing. This task adds structured log statements at critical points in the agent runtime and service layer so that every agent run leaves a traceable log trail.

## Task 1: Add Agent Run Lifecycle Logging

**Files to modify:**
- `web/backend/app/agents/session_manager.py`
- `web/backend/app/agents/session.py`
- `web/backend/app/services/agent_service.py`

**Actions:**

### session_manager.py

Add an INFO log at the top of `start_run()` (after parameter validation, before DB insert) that records the intent:
```
logger.info("starting agent run", extra={"project_id": str(project_id), "skill_name": skill_name, "set_id": set_id})
```

Add an INFO log after the run row is inserted and the task is dispatched (before return):
```
logger.info("agent run dispatched", extra={"run_id": str(run_id), "skill_name": skill_name, "set_id": set_id})
```

Add an INFO log at the top of `_run_session()` when the semaphore is acquired (inside `async with sem:`):
```
logger.info("agent run acquired semaphore", extra={"run_id": str(row.id), "skill_name": row.skill_name})
```

In the `finally` block of `_run_session()`, add an INFO log:
```
logger.info("agent run session ended", extra={"run_id": str(row.id)})
```

In the `stop()` method, add a log at entry with the count of live sessions:
```
logger.info("shutting down agent manager", extra={"live_sessions": len(self._sessions)})
```

### session.py

In `__aenter__`, after the status event is emitted (at the end of the method, before return), add:
```
logger.info("agent session connected", extra={"run_id": str(self.run_id), "skill_name": self.skill_name, "pid": self.pid})
```

In `run()`, at the very start (after `bind_run_id` context enters, before `_client.query`), add:
```
logger.info("agent run pump starting", extra={"run_id": str(self.run_id), "prompt_length": len(self.prompt)})
```

In `_handle_message` for the `ResultMessage` branch, after `_run_complete_emitted = True`, add a summary log:
```
logger.info("agent run completed", extra={"run_id": str(self.run_id), "status": status_text, "cost_usd": cost, "turns": turn_count, "wall_s": round(wall, 2), "active_s": round(active, 2)})
```

In `_emit_run_complete` (the synthesized terminal emission helper), after `_run_complete_emitted = True`, add:
```
logger.info("agent run terminal", extra={"run_id": str(self.run_id), "status": status_text, "error_code": error_code})
```

In `interrupt()`, add at entry:
```
logger.info("agent session interrupt requested", extra={"run_id": str(self.run_id)})
```

### agent_service.py

Add INFO logs in the service facade for key operations. The service layer is the boundary between HTTP and the runtime, so logging here gives a clean audit trail:

In `start_run()`, before calling `mgr.start_run()`:
```
logger.info("start_run request", extra={"project_id": str(project_id), "skill_name": skill_name, "set_id": set_id})
```

In `start_run()`, after the call succeeds, log the returned run_id:
```
logger.info("start_run accepted", extra={"run_id": str(row.id), "skill_name": skill_name})
```

In `interrupt()`:
```
logger.info("interrupt request", extra={"run_id": str(run_id)})
```

In `send_input()`:
```
logger.info("send_input request", extra={"run_id": str(run_id), "text_length": len(text)})
```

In `resolve_prompt()`:
```
logger.info("resolve_prompt request", extra={"run_id": str(run_id), "prompt_id": prompt_id})
```

**What NOT to do:**
- Do NOT log the full prompt text or user input content -- only lengths. Prompts may contain sensitive project data.
- Do NOT add DEBUG-level logs to hot paths like `_handle_message` for `AssistantMessage` or `UserMessage` -- these fire per-turn and would be very noisy. The existing SSE event bus already captures these.
- Do NOT change the logger names -- they are already correctly namespaced (e.g., `rapid.agents.manager`, `rapid.agents.session`, `rapid.agents.service`).
- Do NOT modify `logging_config.py` -- the infrastructure is already correct.

**Verification:**
```bash
cd ~/Projects/RAPID/web/backend && uv run python -c "
from app.agents.session_manager import AgentSessionManager
from app.agents.session import AgentSession
from app.services import agent_service
import logging
# Verify all modules have loggers and the new log points compile
print('session_manager logger:', logging.getLogger('rapid.agents.manager').name)
print('session logger:', logging.getLogger('rapid.agents.session').name)
print('agent_service logger:', logging.getLogger('rapid.agents.service').name)
print('All modules import cleanly')
"
```

**Done criteria:**
- Every agent run start logs skill_name, project_id, run_id at INFO level
- Every agent run completion logs status, cost, turns, duration at INFO level
- Every interrupt/error logs at INFO or ERROR level with run_id
- Service facade logs all mutation operations (start, interrupt, input, prompt resolution)
- No prompt/input content is logged (only lengths)

---

## Task 2: Add Request Logging Middleware

**Files to modify:**
- `web/backend/app/main.py`

**Actions:**

Add a lightweight request/response logging middleware to the FastAPI app in `create_app()`. This goes AFTER the CORS middleware and BEFORE the exception handlers (so it wraps them). Add it using `@app.middleware("http")`:

```python
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000
    # Skip health/ready probes and static assets to reduce noise
    path = request.url.path
    if not path.startswith(("/api/health", "/api/ready", "/assets/")):
        logger.info(
            "request",
            extra={
                "method": request.method,
                "path": path,
                "status": response.status_code,
                "duration_ms": round(duration_ms, 1),
            },
        )
    return response
```

Place this middleware registration inside `create_app()`, after the CORS middleware block and before the exception handler registrations.

**What NOT to do:**
- Do NOT log request bodies -- they may contain prompts and sensitive data.
- Do NOT log query parameters -- the `since` param on SSE streams is fine but we keep it simple.
- Do NOT log SSE streaming endpoints (`/api/agents/runs/{id}/events`) as "request" -- they are long-lived. The middleware will log them when the connection closes, which is acceptable.
- Do NOT add a separate middleware module -- this is a single function that belongs in `main.py`.

**Verification:**
```bash
cd ~/Projects/RAPID/web/backend && uv run python -c "
from app.main import create_app
app = create_app()
# Verify middleware is registered
middleware_names = [m.__class__.__name__ if hasattr(m, '__class__') else str(m) for m in app.middleware_stack.__dict__.get('app', [])] if hasattr(app, 'middleware_stack') else []
print('App created successfully with middleware')
print('Routes:', len(app.routes))
"
```

Additionally, run the existing test suite to confirm nothing breaks:
```bash
cd ~/Projects/RAPID/web/backend && uv run pytest tests/ -x -q 2>&1 | tail -20
```

**Done criteria:**
- Every non-health API request is logged with method, path, status code, and duration
- Health probes and static assets are excluded from request logging
- No request bodies or query parameters are logged
- Existing tests pass

---

## Task 3: Add Autopilot and Startup Logging

**Files to modify:**
- `web/backend/app/agents/autopilot_worker.py`
- `web/backend/app/main.py` (lifespan function only)

**Actions:**

### autopilot_worker.py

In `_poll_once()`, add an INFO log at the start of each poll cycle with candidate count:
```
logger.info("autopilot poll cycle", extra={"candidates": len(candidates)})
```

Change the existing `logger.info("autopilot cycle dispatched %d runs", dispatched)` to use structured extras instead of %-formatting for consistency:
```
logger.info("autopilot cycle complete", extra={"dispatched": dispatched, "candidates": len(candidates)})
```

In `start()`, add:
```
logger.info("autopilot worker started", extra={"interval_s": self.interval_s})
```

In `stop()`, add:
```
logger.info("autopilot worker stopping")
```

### main.py (lifespan function)

The lifespan already logs "RAPID Web service started" and "RAPID Web service stopped". Enhance the startup log to include more context. After each subsystem starts, add a brief log:

After `run_migrations(engine)`:
```
logger.info("database migrations complete")
```

After `watcher.start()`:
```
logger.info("file watcher started")
```

After `await agent_manager.start()`:
```
logger.info("agent session manager started")
```

After `await autopilot.start()`:
```
logger.info("autopilot worker started")
```

After `skill_catalog_service.load_initial(skills_root)`:
```
logger.info("skill catalog loaded", extra={"skills_root": str(skills_root)})
```

These give a clear startup sequence in the log so when something hangs during boot, the user can see exactly which subsystem stalled.

**What NOT to do:**
- Do NOT change the autopilot poll interval or any behavioral logic.
- Do NOT add per-card logging in `_find_candidates()` -- this runs in a thread and the existing per-card dispatch logging in `_dispatch_card()` is sufficient.
- Do NOT duplicate the "autopilot worker started" log (it is already in `main.py` lifespan via `await autopilot.start()` -- coordinate: either log in `start()` or in the lifespan, not both). Prefer logging in `start()` since it owns the lifecycle, and keep the lifespan log as a higher-level "subsystem ready" marker only if it adds context.

**Verification:**
```bash
cd ~/Projects/RAPID/web/backend && uv run pytest tests/ -x -q 2>&1 | tail -20
```

**Done criteria:**
- Every lifespan subsystem startup is individually logged
- Autopilot poll cycles log candidate count and dispatch count
- Autopilot start/stop is logged
- Existing tests pass
