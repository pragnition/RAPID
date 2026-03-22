# SET-OVERVIEW: service-infrastructure

## Approach

This set establishes the foundational Python backend service for RAPID's web interface. The core deliverable is a FastAPI application that serves as the host process for all subsequent web features (dashboard endpoints, project APIs, etc.) built by other sets. The approach is "infrastructure first" -- standing up the application shell, database layer, and operational plumbing before any business logic exists.

The implementation follows a bottom-up strategy: database and configuration come first (since everything depends on them), then the application factory that wires middleware and lifespan events, then the sync engine that bridges SQLite state with the `.rapid-web/` filesystem directory, and finally the operational layer (logging, health checks, service registration). This ordering ensures each layer has a stable foundation beneath it.

SQLite with WAL mode is the deliberate choice for a single-user local service -- it avoids the operational overhead of a database server while supporting concurrent reads from the sync engine. The SyncEngine is the most architecturally significant component: it maintains bidirectional consistency between the database (source of truth for the web UI) and the filesystem directory (source of truth for CLI/agent workflows).

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `web/backend/app/main.py` | FastAPI application factory, lifespan events, CORS setup | New |
| `web/backend/app/config.py` | Pydantic settings: port, db path, log dir, environment | New |
| `web/backend/app/database.py` | SQLite engine (WAL mode), session dependency, connection pool | New |
| `web/backend/app/sync_engine.py` | Bidirectional SQLite <-> .rapid-web/ synchronization | New |
| `web/backend/app/logging_config.py` | JSON-structured logger with file rotation | New |
| `web/backend/app/__init__.py` | Package init, re-exports public API | New |
| `web/backend/alembic.ini` | Alembic configuration pointing to SQLite DB | New |
| `web/backend/alembic/` | Migration env, versions directory, initial schema | New |
| `web/backend/pyproject.toml` | Python project metadata, dependencies, scripts | New |
| `web/backend/service/rapid-web.service` | systemd user unit template | New |
| `web/backend/service/com.rapid.web.plist` | macOS launchd plist template | New |

## Integration Points

- **Exports:**
  - `create_app()` -- Factory function returning the configured FastAPI instance. Other sets mount their routers onto this app.
  - `get_engine()` / `get_session()` -- Database access primitives consumed by every set that reads/writes data.
  - `run_migrations()` -- Called at startup; other sets contribute Alembic migration scripts to the shared versions directory.
  - `SyncEngine` -- Used by sets that need to reconcile filesystem and database state.
  - `get_logger()` -- Shared structured logging for all backend modules.
  - `GET /api/health` -- Liveness probe for service monitoring and systemd watchdog.
  - `rapid-web.service` / `com.rapid.web.plist` -- Service registration templates.

- **Imports:** None. This is a leaf dependency with no upstream requirements.

- **Side Effects:**
  - Creates `~/.rapid/rapid.db` on first run (SQLite database file).
  - Creates `~/.rapid/logs/` directory for rotated JSON log files.
  - Binds TCP port 8998 on 127.0.0.1 when the service starts.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| SyncEngine conflict resolution between DB and filesystem edits | High | Define clear precedence rules (DB wins on conflict); add last-modified timestamps to both stores |
| Alembic migration ordering when multiple sets contribute schemas | Medium | Use a single shared `alembic/versions/` directory; document migration naming convention with timestamp prefixes |
| SQLite busy errors under concurrent sync + web request load | Medium | WAL mode + busy_timeout=5000ms (per behavioral contract); connection pooling with limited pool size |
| Service template portability across distros and macOS versions | Low | Keep templates minimal; document manual steps for non-standard init systems |
| Resource budget (<50 MB idle) may be tight with FastAPI + SQLAlchemy loaded | Low | Profile baseline memory on startup; use lazy imports if needed |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- `pyproject.toml` with dependencies, `config.py` (Pydantic settings), `database.py` (engine, session, WAL mode), `alembic/` scaffolding with initial empty migration
- **Wave 2:** Application core -- `main.py` (app factory, CORS, lifespan, exception handlers), `logging_config.py` (JSON logger with rotation), health/readiness endpoints
- **Wave 3:** Sync and operations -- `sync_engine.py` (bidirectional sync logic), systemd/launchd service templates, integration smoke test

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
