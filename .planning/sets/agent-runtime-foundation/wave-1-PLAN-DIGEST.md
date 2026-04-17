# Wave 1 Plan Digest

**Objective:** Lock pure-schema contract surface (no SDK dependency) for every downstream wave and set.
**Tasks:** 10 tasks completed (error taxonomy, correlation, config, tables, migration, SSE union, permissions, tests, complete marker).
**Key files:** app/agents/{errors,correlation,permissions}.py, app/models/{agent_run,agent_event}.py, app/schemas/sse_events.py, alembic/versions/0004_agent_runtime.py, app/logging_config.py, app/config.py.
**Approach:** Created app/agents/ package with data-only types. Registered SQLModel tables via `from app.models import ...` re-export + bottom-of-database.py re-import to avoid circular import. Hand-wrote Alembic migration with partial unique index `uq_agent_run_active_set`. SSE discriminated union with 10 event kinds, no version field, extra=allow. 15 RAPID skills + `_default` in PERMISSION_POLICY; 11 destructive regex patterns with `env | grep` allow-exception.
**Deviation:** `_utcnow` defined locally in both agent-model files (not imported from app.database) to break circular import. Functionally identical.
**Tests:** 26 tests added under tests/agents/. Migration roundtrip verified. All source-grep invariants hold (no `bypassPermissions`, no `claude_agent_sdk` imports).
**Status:** Complete (commit 240a2f9).
