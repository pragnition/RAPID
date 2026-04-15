# Wave 3 Complete — Session Lifecycle

**Set:** agent-runtime-foundation
**Wave:** 3 of 4

## Files Created

- `web/backend/app/agents/pid_liveness.py` — OS-level `is_pid_alive` + `send_sigterm` (stdlib-only).
- `web/backend/app/agents/session.py` — `AgentSession` async-context wrapper around `ClaudeSDKClient`, with message-kind dispatch (`AssistantMessage`/`UserMessage`/`SystemMessage`/`ResultMessage`), dual wall-clock / active-duration tracking (wall minus sum-of-waiting intervals), and interrupt-timeout synthesis of `RunCompleteEvent(status="interrupted", error_code="interrupt_timeout")`.
- `web/backend/app/agents/session_manager.py` — `AgentSessionManager` lifespan singleton: per-project `asyncio.Semaphore`, per-set `asyncio.Lock` registry fronting the DB partial unique index, startup + periodic 60s orphan sweep with 10s young-run guard, hourly archive pass, `send_input` / `interrupt` / `attach_events` / `get_run` facade, and `<200ms` dispatch contract.
- `web/backend/app/agents/archive.py` — 30-day JSONL archive-and-delete job (tempfile + `os.replace` atomic write, per-run directory under `settings.rapid_agent_archive_dir/<project_id>/`).
- `web/backend/app/agents/__init__.py` — filled in with the full public contract surface (errors, correlation, permissions, sdk_options, event_bus, budget, mcp, error_mapping, session, session_manager).

## Tests Added (31 new, 105 total passing)

- `tests/agents/conftest.py` — `manager` fixture.
- `tests/agents/test_pid_liveness.py` — 7 tests: None / 0 / negative / current-pid / nonexistent-pid / send_sigterm-on-dead / send_sigterm-on-zero.
- `tests/agents/test_session.py` — 9 tests: text-block / tool-use / result-updates-db / is-error-marks-failed / interrupt-timeout-synth / wall ≥ active invariant / run_complete idempotency / send_input-without-client / enter-emits-status-running.
- `tests/agents/test_session_manager.py` — 11 tests: <200ms dispatch / pending-row-inserted / per-set-mutex-409 / different-sets-parallel / semaphore-caps-concurrency-at-2 / startup-sweep-marks-interrupted / periodic-sweep-10s-young-guard / interrupt-unknown / send_input-unknown / get_run-unknown / attach-events-streams-from-bus.
- `tests/agents/test_archive.py` — 4 tests: skips-active-runs / writes-jsonl-and-deletes / idempotent / atomic-tempfile-rename (no half-written file on failure).

## Invariants Verified

- `total_wall_clock_s >= active_duration_s >= 0` on every finished run (test_wall_clock_ge_active_duration).
- Per-set mutex rejects a second active run with `StateError(http_status=409)`.
- Per-project `asyncio.Semaphore(settings.rapid_agent_max_concurrent)` enforced — observed concurrency never exceeded the cap (test_semaphore_caps_concurrency with cap=2, 4 dispatched runs).
- Startup orphan sweep marks every `running`/`waiting` row with a dead PID as `interrupted`, `error_code="orphaned"`.
- Periodic sweep respects 10s young-run guard — runs whose `started_at > now - 10s` are left alone.
- `interrupt()` with a hanging SDK subprocess times out after 10s and synthesizes `RunCompleteEvent(status="interrupted", error_code="interrupt_timeout")`.
- 30-day archive writes atomically (tempfile + `os.replace`): on replace failure no partial JSONL file exists at the target path, event rows remain intact for retry.
- Dispatch latency: `AgentSessionManager.start_run(...)` returned in 4.8ms in the local smoke test (<200ms contract).

## Notes

- Event-bus SQLite queries continue to use `run_id.hex` per the Wave 2 convention. Archive's `agentevent` SELECT/DELETE statements follow the same convention.
- No psutil — liveness uses `os.kill(pid, 0)` only.
- `pyproject.toml` and `uv.lock` untouched (Wave 4 owns SDK install + `app/main.py` lifespan wiring).
- `app/main.py`, `app/routers/`, `app/services/` untouched.
