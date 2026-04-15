# Wave 3 Plan Digest

**Objective:** Long-lived runtime layer — AgentSession, AgentSessionManager, orphan sweep, archive.
**Tasks:** Completed — pid liveness, async-context session with dual wall-clock/active tracking, manager singleton w/ per-project semaphore + per-set mutex + DB partial-index backstop, 30-day JSONL archive with atomic replace, send_input/interrupt.
**Key files:** app/agents/{pid_liveness,session,session_manager,archive}.py; app/agents/__init__.py (full public surface).
**Approach:** Per-project `asyncio.Semaphore(3)`, per-set `asyncio.Lock` registry fronting the `uq_agent_run_active_set` index. Orphan sweeper reconciles PID liveness at startup + 60s periodic. Session pump task emits events to EventBus and tracks both `wall_clock_s` and `active_duration_s` (invariant: `wall >= active >= 0`). Archive uses `tempfile + os.replace` for atomicity; `run_id.hex` used for agentevent queries (Wave 2 convention preserved).
**Deviations:** (1) Replaced `_leave_waiting` stub with `wall - _waiting_total_s` (plan permitted). (2) `_emit_run_complete` guarded by `_run_complete_emitted` flag so interrupt-after-completion is a no-op. (3) `_periodic_sweep_once` extracted for testability.
**Tests:** 31 tests added (105 total in tests/agents/). Dispatch latency 4.8ms (<200ms). No pyproject/lockfile/main.py edits.
**Status:** Complete (commit 52b26a2).
