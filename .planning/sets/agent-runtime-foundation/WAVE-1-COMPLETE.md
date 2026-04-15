# Wave 1 Complete — Foundation

**Set:** agent-runtime-foundation
**Wave:** 1 of 4 (Foundation — pure-schema, no SDK dependency)
**Alembic revision:** `0004` (down_revision: `0003`)
**Migration round-trip:** verified (`upgrade head → downgrade -1 → upgrade head` succeeds)
**Tests added:** 26 (all passing)

## Files created

Source (application):
- `web/backend/app/agents/__init__.py` — empty package init
- `web/backend/app/agents/errors.py` — `AgentBaseError`, `SdkError`, `RunError`, `StateError`, `ToolError`, `UserError`, `RETRYABLE_ERROR_CODES`
- `web/backend/app/agents/correlation.py` — `run_id_var`, `bind_run_id`, `get_run_id`, `RunIdLogFilter`, `SAFE_ENV_KEYS`
- `web/backend/app/agents/permissions.py` — `DESTRUCTIVE_PATTERNS`, `is_destructive`, `PERMISSION_POLICY`, `resolve_policy`
- `web/backend/app/models/agent_run.py` — `AgentRun` SQLModel with partial unique index `uq_agent_run_active_set`
- `web/backend/app/models/agent_event.py` — `AgentEvent` SQLModel with `uq_agent_event_run_seq` unique index
- `web/backend/app/schemas/sse_events.py` — 10-event discriminated union, `EVENT_KINDS`, `serialize_event`
- `web/backend/alembic/versions/0004_agent_runtime.py` — hand-written migration

Source (edits):
- `web/backend/app/logging_config.py` — attach `RunIdLogFilter`, include `%(run_id)s` in both handlers
- `web/backend/app/config.py` — added 8 `rapid_agent_*` settings
- `web/backend/app/models/__init__.py` — re-export `AgentRun` + `AgentEvent`
- `web/backend/app/database.py` — bottom-of-file re-import of both agent models

Tests (all in `web/backend/tests/agents/`):
- `__init__.py`
- `test_errors.py` — 4 tests
- `test_correlation.py` — 4 tests
- `test_sse_schemas.py` — 4 tests
- `test_permissions_policy.py` — 8 tests
- `test_models_schema.py` — 4 tests
- `test_migration_0004.py` — 2 tests

## Verification results

- `uv run pytest tests/agents/ -v` → **26 passed**
- Alembic round-trip (upgrade → downgrade → upgrade) → **OK**
- `grep "bypassPermissions" app/agents/` → nothing (invariant held)
- `grep "claude_agent_sdk" app/` → nothing (no SDK import in Wave 1)
- `from app.schemas.sse_events import SseEvent, EVENT_KINDS, serialize_event` → OK
- `_BaseEvent.model_fields` does not contain `"version"` → OK
- Bound `run_id` appears in stderr log lines as `run=abc-123` → OK
- `alembic history` shows `0003 -> 0004 (head)` → OK

## Notes / deviations

- `_utcnow` is defined locally in `app/models/agent_run.py` and `app/models/agent_event.py` (mirroring the one in `app/database.py`) to break the `app.models ↔ app.database` top-level circular import. The plan's stated import (`from app.database import _utcnow`) collides with the plan's own bottom-of-`database.py` re-import when the import entry point is `app.models.*` directly. The local copy is functionally identical (`datetime.now(timezone.utc)`) and preserves the spirit of the contract.

## Interface frozen

Downstream waves and sets may now rely on:
- `AgentRun` / `AgentEvent` row shapes (exact columns & indexes)
- SSE discriminated union (10 event `kind`s, no `version` field, `extra="allow"`)
- `PERMISSION_POLICY` table (15 RAPID skills + `_default`)
- `DESTRUCTIVE_PATTERNS` regex list
- `run_id_var` ContextVar + `RunIdLogFilter`
- Error taxonomy (`AgentBaseError` + 5 concrete classes, `RETRYABLE_ERROR_CODES`)
