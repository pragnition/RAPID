# REVIEW-SCOPE: service-infrastructure

<!-- SCOPE-META {"setId":"service-infrastructure","date":"2026-03-20T16:00:00.000Z","postMerge":true,"worktreePath":".","totalFiles":27,"useConcernScoping":true} -->

## Set Metadata
| Field | Value |
|-------|-------|
| Set ID | service-infrastructure |
| Date | 2026-03-20T16:00:00.000Z |
| Post-Merge | true |
| Worktree Path | . |
| Total Files | 27 |
| Concern Scoping | true |

## Changed Files
| File | Wave Attribution |
|------|-----------------|
| `.planning/STATE.json` | unattributed |
| `.planning/sets/service-infrastructure/CONTEXT.md` | unattributed |
| `.planning/sets/service-infrastructure/VERIFICATION-REPORT.md` | unattributed |
| `.planning/sets/service-infrastructure/WAVE-1-COMPLETE.md` | unattributed |
| `.planning/sets/service-infrastructure/WAVE-2-COMPLETE.md` | unattributed |
| `.planning/sets/service-infrastructure/WAVE-3-COMPLETE.md` | unattributed |
| `.planning/sets/service-infrastructure/wave-1-PLAN-DIGEST.md` | unattributed |
| `.planning/sets/service-infrastructure/wave-1-PLAN.md` | unattributed |
| `.planning/sets/service-infrastructure/wave-2-PLAN-DIGEST.md` | unattributed |
| `.planning/sets/service-infrastructure/wave-2-PLAN.md` | unattributed |
| `.planning/sets/service-infrastructure/wave-3-PLAN-DIGEST.md` | unattributed |
| `.planning/sets/service-infrastructure/wave-3-PLAN.md` | unattributed |
| `web/backend/alembic.ini` | unattributed |
| `web/backend/alembic/README` | unattributed |
| `web/backend/alembic/env.py` | unattributed |
| `web/backend/alembic/script.py.mako` | unattributed |
| `web/backend/alembic/versions/0001_initial_schema.py` | unattributed |
| `web/backend/app/__init__.py` | unattributed |
| `web/backend/app/config.py` | unattributed |
| `web/backend/app/database.py` | unattributed |
| `web/backend/app/logging_config.py` | unattributed |
| `web/backend/app/main.py` | unattributed |
| `web/backend/app/sync_engine.py` | unattributed |
| `web/backend/pyproject.toml` | unattributed |
| `web/backend/service/com.rapid.web.plist` | unattributed |
| `web/backend/service/rapid-web.service` | unattributed |
| `web/backend/uv.lock` | unattributed |

## Dependent Files
| File |
|------|
| (none) |

## Directory Chunks
### Chunk 1: .planning/sets/service-infrastructure
- `.planning/sets/service-infrastructure/CONTEXT.md`
- `.planning/sets/service-infrastructure/VERIFICATION-REPORT.md`
- `.planning/sets/service-infrastructure/WAVE-1-COMPLETE.md`
- `.planning/sets/service-infrastructure/WAVE-2-COMPLETE.md`
- `.planning/sets/service-infrastructure/WAVE-3-COMPLETE.md`
- `.planning/sets/service-infrastructure/wave-1-PLAN-DIGEST.md`
- `.planning/sets/service-infrastructure/wave-1-PLAN.md`
- `.planning/sets/service-infrastructure/wave-2-PLAN-DIGEST.md`
- `.planning/sets/service-infrastructure/wave-2-PLAN.md`
- `.planning/sets/service-infrastructure/wave-3-PLAN-DIGEST.md`
- `.planning/sets/service-infrastructure/wave-3-PLAN.md`

### Chunk 2: web/backend
- `web/backend/alembic.ini`
- `web/backend/pyproject.toml`
- `web/backend/uv.lock`

### Chunk 3: web/backend/alembic
- `web/backend/alembic/README`
- `web/backend/alembic/env.py`
- `web/backend/alembic/script.py.mako`

### Chunk 4: web/backend/app
- `web/backend/app/__init__.py`
- `web/backend/app/config.py`
- `web/backend/app/database.py`
- `web/backend/app/logging_config.py`
- `web/backend/app/main.py`
- `web/backend/app/sync_engine.py`
- `.planning/STATE.json`
- `web/backend/alembic/versions/0001_initial_schema.py`
- `web/backend/service/com.rapid.web.plist`
- `web/backend/service/rapid-web.service`

## Wave Attribution
| File | Wave |
|------|------|
| (post-merge mode -- wave attribution unavailable) | |

## Concern Scoping

### Concern: planning-state
- `.planning/STATE.json`
- `web/backend/pyproject.toml` *(cross-cutting)*
- `web/backend/uv.lock` *(cross-cutting)*

### Concern: planning-documentation
- `.planning/sets/service-infrastructure/CONTEXT.md`
- `.planning/sets/service-infrastructure/VERIFICATION-REPORT.md`
- `.planning/sets/service-infrastructure/WAVE-1-COMPLETE.md`
- `.planning/sets/service-infrastructure/WAVE-2-COMPLETE.md`
- `.planning/sets/service-infrastructure/WAVE-3-COMPLETE.md`
- `.planning/sets/service-infrastructure/wave-1-PLAN-DIGEST.md`
- `.planning/sets/service-infrastructure/wave-1-PLAN.md`
- `.planning/sets/service-infrastructure/wave-2-PLAN-DIGEST.md`
- `.planning/sets/service-infrastructure/wave-2-PLAN.md`
- `.planning/sets/service-infrastructure/wave-3-PLAN-DIGEST.md`
- `.planning/sets/service-infrastructure/wave-3-PLAN.md`
- `web/backend/pyproject.toml` *(cross-cutting)*
- `web/backend/uv.lock` *(cross-cutting)*

### Concern: database-and-migrations
- `web/backend/app/database.py`
- `web/backend/alembic.ini`
- `web/backend/alembic/README`
- `web/backend/alembic/env.py`
- `web/backend/alembic/script.py.mako`
- `web/backend/alembic/versions/0001_initial_schema.py`
- `web/backend/pyproject.toml` *(cross-cutting)*
- `web/backend/uv.lock` *(cross-cutting)*

### Concern: application-core
- `web/backend/app/__init__.py`
- `web/backend/app/config.py`
- `web/backend/app/logging_config.py`
- `web/backend/app/main.py`
- `web/backend/pyproject.toml` *(cross-cutting)*
- `web/backend/uv.lock` *(cross-cutting)*

### Concern: sync-engine
- `web/backend/app/sync_engine.py`
- `web/backend/pyproject.toml` *(cross-cutting)*
- `web/backend/uv.lock` *(cross-cutting)*

### Concern: service-templates
- `web/backend/service/com.rapid.web.plist`
- `web/backend/service/rapid-web.service`
- `web/backend/pyproject.toml` *(cross-cutting)*
- `web/backend/uv.lock` *(cross-cutting)*

### Cross-Cutting Files
- `web/backend/pyproject.toml` -- Project manifest defining all dependencies, entry points, and tooling config
- `web/backend/uv.lock` -- Lockfile pinning all transitive dependencies

## Acceptance Criteria
1. [wave-1] `uv sync` completes without errors in `web/backend/`
2. [wave-1] All SQLModel classes importable and create valid tables
3. [wave-1] SQLite engine uses WAL mode (verified via PRAGMA query)
4. [wave-1] Alembic migration runs to head and creates all 5 tables
5. [wave-1] Structured JSON logging writes to a file with rotation
6. [wave-1] Settings load from environment variables correctly
7. [wave-2] `create_app()` returns a configured FastAPI instance with CORS and exception handlers
8. [wave-2] `GET /api/health` returns 200 with status, version, and uptime
9. [wave-2] `GET /api/ready` returns 200 with database connectivity status
10. [wave-2] Lifespan runs migrations on startup and disposes engine on shutdown
11. [wave-2] Port conflict detection raises `SystemExit` with actionable error message
12. [wave-2] `cli_entry()` starts uvicorn bound to 127.0.0.1:8998
13. [wave-3] SyncEngine writes entity JSON files to `.rapid-web/` subdirectories
14. [wave-3] SyncEngine reads from `.rapid-web/` and imports into database (bootstrap)
15. [wave-3] SyncEngine computes file checksums for change detection
16. [wave-3] SyncEngine tracks sync state per project
17. [wave-3] systemd unit template has correct ExecStart, restart policy, and environment
18. [wave-3] launchd plist template has correct label, keep-alive, and log paths
19. [wave-3] All contract exports from this set are now implemented and importable
