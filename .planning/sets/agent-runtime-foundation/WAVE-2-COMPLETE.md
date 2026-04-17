# Wave 2 — SDK Core — COMPLETE

**Set:** agent-runtime-foundation
**Wave:** 2 of 4
**Status:** COMPLETE

## Files Created

### Production code (`web/backend/app/agents/`)
- `sdk_options.py` — centralized `build_sdk_options()` factory
- `permission_hooks.py` — dual-gated destructive firewall (`can_use_tool_hook` + `destructive_pre_tool_hook`)
- `event_bus.py` — `RunChannel`, `EventBus`, ring buffer + batched SQLite writer + `attach_events` replay with `replay_truncated`
- `budget.py` — `RunBudget` with async lock and `BudgetStatus` dataclass
- `mcp_registration.py` — `register_mcp_tools()` stub (idempotent in-process MCP server wiring)
- `error_mapping.py` — `to_http_exception()` + `install_agent_error_handlers()`

### Tests (`web/backend/tests/agents/`)
- `test_sdk_options.py` — 12 tests
- `test_permission_hooks.py` — 10 tests
- `test_event_bus.py` — 8 tests
- `test_budget.py` — 5 tests
- `test_mcp_registration.py` — 6 tests
- `test_error_mapping.py` — 7 tests

## Test counts

- Wave 2 tests added: **48**
- Full `tests/agents/` (Wave 1 + Wave 2): **74 passed**
- Plan target (≥28 new tests): exceeded

## Invariants verified

- `grep -RIn "bypassPermissions" app/agents/ app/schemas/` → no matches
- `grep -In "ClaudeSDKClient" app/agents/{sdk_options,permission_hooks,event_bus,budget,mcp_registration,error_mapping}.py` → no matches
- Dual-gate smoke test passes (`opts.can_use_tool is can_use_tool_hook` AND `destructive_pre_tool_hook in opts.hooks['PreToolUse'][0].hooks`)
- Env-scrub smoke test passes (`ANTHROPIC_API_KEY` removed, `RAPID_RUN_MODE='sdk'`, `RAPID_RUN_ID='r1'`)
- `setting_sources == ["project"]` on every code path (test-enforced across all policies)
- `permission_mode` restricted to `{"default", "acceptEdits"}` across every skill in `PERMISSION_POLICY`
- Critical-kind events flush synchronously to SQLite; non-critical events batch (≥1 s interval)
- `attach_events(since=N)` emits `replay_truncated` when `since` precedes retention and backfills via SQLite before handing off to live subscription with seq dedup
- `enforce_retention` prunes oldest events first (seq-ascending)
- `RunBudget.record_turn(cost)` halts on `turns_exceeded` / `cost_exceeded` under `asyncio.gather` concurrency
- `register_mcp_tools()` is idempotent; no-op on empty tool list
- `to_http_exception()` maps the taxonomy to 400/409/422/500/502; retryable `sdk_error` seeds `Retry-After: 5`

## SDK dependency

- `claude-agent-sdk>=0.1.59,<0.2` installed **transiently** in `.venv` for local test runs.
- `web/backend/pyproject.toml` and `web/backend/uv.lock` are **unchanged** in this wave's commit — Wave 4 owns the pyproject edit per file-ownership rules.

## Notes / deviations

- Event-bus text queries use `run_id.hex` (no dashes) because SQLModel's `Uuid` column stores UUIDs as 32-char hex strings in SQLite. `str(run_id)` (dashed form) returned no matches. This is a hidden contract between SQLModel and SQLite that Wave 3 must respect when it adds the orphan sweeper / archive job.
- `EventBus.attach_events` emits `replay_truncated` both when `since > 0 and since < oldest - 1` (per-plan branch) **and** when `since == 0 and oldest > 1` (full-history request against a pruned run) — the latter is necessary for the retention-truncated test case and matches the documented spec.
- Per-test `_seed_run(engine, rid)` helper in `test_event_bus.py` inserts a `Project` + `AgentRun` so the `AgentEvent` foreign-key constraint is satisfied without disabling `PRAGMA foreign_keys=ON`.

## Handoff to Wave 3

Wave 3 (Session + Manager) will:
- Own `AgentSession`, `AgentSessionManager`, `send_input`, `interrupt`, orphan sweeper, archive-to-JSONL.
- Consume `build_sdk_options()`, `EventBus.publish` + `attach_events`, `RunBudget.record_turn`, `register_mcp_tools()`, and `to_http_exception()` unchanged.
