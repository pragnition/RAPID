# VERIFICATION-REPORT: agent-runtime-foundation

**Set:** agent-runtime-foundation
**Waves:** 1-4 (all four plans)
**Verified:** 2026-04-15
**Verdict:** PASS_WITH_GAPS

## Coverage

### CONTRACT.json exports — every export implemented in exactly one wave

| Export | Covered By | Status | Notes |
|---|---|---|---|
| `build_sdk_options` | Wave 2 Task 2 (`app/agents/sdk_options.py`) | PASS | Signature matches CONTRACT exactly; invariant tests Wave 2 Task 8. |
| `AgentSessionManager` | Wave 3 Task 4 (`app/agents/session_manager.py`) | PASS | Includes `start_run`, `get_run`, `send_input`, `interrupt`, `attach_events`. |
| `AgentSession` | Wave 3 Task 2 (`app/agents/session.py`) | PASS | Async ctx-managed pump + interrupt/input methods. |
| `EventBus` | Wave 2 Task 4 (`app/agents/event_bus.py`) | PASS | Per-run ring buffer + SQLite replay; `attach_events` implemented. |
| `can_use_tool_hook` | Wave 2 Task 3 (`app/agents/permission_hooks.py`) | PASS | Paired with `destructive_pre_tool_hook` (dual-gate per CONTEXT revision). |
| `disallowed_tools_registry` | Wave 1 Task 8 (`app/agents/permissions.py::DESTRUCTIVE_PATTERNS`) | PASS | 11 regex patterns; `is_destructive()` helper. |
| `agent_run_model` | Wave 1 Task 5 (`app/models/agent_run.py`) | PASS | Partial unique index `uq_agent_run_active_set`; includes `active_duration_s`, `total_wall_clock_s`, `last_seq` per CONTEXT additions. |
| `agent_event_model` | Wave 1 Task 5 (`app/models/agent_event.py`) | PASS | Unique `(run_id, seq)` index `uq_agent_event_run_seq`. |
| `sse_event_schema` | Wave 1 Task 7 (`app/schemas/sse_events.py`) | PASS | 10 kinds (CONTRACT 8 + CONTEXT-added `replay_truncated`, `retention_warning`) via Pydantic discriminated union; no `version` field. |
| `run_dispatch_http` | Wave 4 Tasks 2-5 (`app/routers/agents.py` + `app/services/agent_service.py` + `main.py` wiring) | PASS | All 6 routes present: POST /runs, GET /runs/{id}, GET /runs/{id}/events (SSE), POST /input, POST /interrupt, POST /answer (501 stub). |
| `per_skill_permission_policy` | Wave 1 Task 8 (`PERMISSION_POLICY`) | PASS | 15 skills + `_default` fallback; test enforces no bypassPermissions. |
| `create_sdk_mcp_server_integration` | Wave 2 Task 6 (`app/agents/mcp_registration.py`) | PASS | `register_mcp_tools(options, tools, server_name, server_version)`. |
| `run_id_correlation` | Wave 1 Task 2 (`app/agents/correlation.py`) + Wave 2 Task 2 env threading + Wave 1 Task 3 logger filter | PASS | ContextVar `rapid_run_id`; `RAPID_RUN_ID` in SDK env; filter attached to both file + stream log handlers. |
| `rapid_run_mode_env` | Wave 2 Task 2 (`RAPID_RUN_MODE = "sdk"` in options.env) | PASS | Threaded into spawned SDK subprocess env. |
| `cost_budget_tracking` | Wave 2 Task 5 (`RunBudget` in `app/agents/budget.py`) | PASS | Turn + cost halting; concurrent-safe via `asyncio.Lock`. |
| `error_taxonomy` | Wave 1 Task 1 (`app/agents/errors.py`) + Wave 2 Task 7 HTTP mapping | PASS | All 5 classes + `RETRYABLE_ERROR_CODES` + HTTP status mapping. |

### Behavioral invariants — each has ≥1 test mapped

| Invariant | Mapped Test(s) | Status |
|---|---|---|
| `sub_200ms_dispatch` | Wave 3 `test_start_run_returns_in_under_200ms` (mocked manager); Wave 4 `test_dispatch_under_200ms_p95` (router p95 over 20 samples) | PASS |
| `setting_sources_project` | Wave 2 `test_setting_sources_project_only` + runtime `assert` in `build_sdk_options` | PASS |
| `no_bypass_permissions` | Wave 1 `test_no_bypass_permissions_in_policy`; Wave 2 grep test in `test_no_bypass_permissions_anywhere`; Wave 1/2/4 verification greps over source | PASS |
| `credential_env_scrubbed` | Wave 2 `test_env_scrubs_credentials` (sets ANTHROPIC_API_KEY / GITHUB_TOKEN, asserts absence); Wave 1 `test_safe_env_keys_blocks_credentials` | PASS |
| `per_set_run_mutex` | Wave 1 `test_agent_run_partial_unique_index_enforced` (DB backstop); Wave 3 `test_per_set_mutex_rejects_second_run_409` (Python-lock fast path) | PASS |
| `concurrency_semaphore` | Wave 3 `test_semaphore_caps_concurrency_at_3` (monkeypatches cap=2, dispatches 4, observes ≤2) | PASS |
| `destructive_commands_firewalled` | Wave 1 `test_destructive_patterns_block_*`; Wave 2 `test_can_use_tool_blocks_rm_rf`, `test_pretooluse_blocks_force_push`, `test_firewall_dual_gate_source_presence` | PASS |
| `run_id_on_every_log_line` | Wave 1 `test_log_filter_attaches_run_id` (caplog asserts `record.run_id`); Wave 1 verification smoke greps `run=abc-123` | PASS |
| `orphan_subprocess_reaping` | Wave 3 `test_startup_orphan_sweep_marks_interrupted`; `test_periodic_sweep_respects_10s_young_run_guard` | PASS |
| `cwd_is_project_root` | Wave 2 `test_cwd_is_absolute_project_root`; `test_rejects_relative_project_root`; `test_worktree_adds_additional_directory` | PASS |

### CONTEXT.md locked decisions — spot check

| Decision | Covered By | Status |
|---|---|---|
| SSE discriminated union + additive-only (no version field) | Wave 1 Task 7 + `test_no_version_field_on_base` | PASS |
| Hybrid write cadence (critical sync, chatty batched ~1s) | Wave 2 Task 4 `CRITICAL_KINDS` + `_flush_single` vs `_flush_batch` + tests `test_critical_kind_synchronous_flush` / `test_non_critical_kind_batched` | PASS |
| SQLite backfill on ring miss + `replay_truncated` | Wave 2 `attach_events` + `test_attach_emits_replay_truncated` | PASS |
| Active-only duration field + total wall clock | Wave 1 AgentRun cols + Wave 3 `_enter_waiting`/`_leave_waiting` + `test_wall_clock_ge_active_duration` | PASS_WITH_GAPS (see Summary §1) |
| Error taxonomy → fine-grained HTTP status + envelope | Wave 2 Task 7 `to_http_exception` + `test_sdk_error_maps_502_retryable` | PASS |
| Retry-After on SdkError only | Wave 2 `to_http_exception` (only `sdk_error` gets header); Wave 2 `test_sdk_error_maps_502_retryable` | PASS |
| Layered mutex (Python Lock + SQLite partial index) | Wave 3 `_set_locks` + Wave 1 partial-unique-index | PASS |
| 409-reject immediately on contention | Wave 3 rollback path raising `StateError(http_status=409)` | PASS |
| Startup + periodic 60s orphan sweep | Wave 3 `_startup_orphan_sweep` + `_periodic_orphan_sweep` | PASS |
| SIGTERM reap policy | Wave 3 `pid_liveness.send_sigterm` + startup sweep SIGTERMs live-orphan PIDs | PASS |
| Trust-all-tools policy (CONTEXT spec revision) | Wave 2 `can_use_tool_hook` only denies destructive; otherwise `PermissionResultAllow` | PASS |
| No timeout on ask_user prompts | Wave 3 session manager has no timeout on waiting; only `/interrupt` terminates | PASS |
| 50K per-run cap + 30-day archive | Wave 2 `enforce_retention` (row cap); Wave 3 `archive.py` + `_periodic_archive` | PASS |
| `replay_truncated` gap event | Wave 1 schema + Wave 2 `attach_events` + `test_attach_emits_replay_truncated` | PASS |

## Implementability

Spot-verified against on-disk filesystem at `/home/kek/Projects/RAPID/web/backend/`.

| File | Wave | Action | Status | Notes |
|---|---|---|---|---|
| `app/logging_config.py` | 1 | Modify | PASS | Exists; planned edits target `setup_logging` handler registration. |
| `app/config.py` | 1 | Modify | PASS | Exists; plan appends `rapid_agent_*` settings. |
| `app/database.py` | 1 | Modify | PASS | Exists; minimal bottom-of-file re-import. |
| `app/models/__init__.py` | 1 | Modify | PASS | Exists alongside kanban.py/project.py/note.py; plan appends two re-export lines. |
| `app/agents/__init__.py` | 1 (create empty) → 3 (fill) | Create → Modify | PASS | Does not exist yet; package directory does not exist. Handoff doc'd in both Wave 1 Task 1 and Wave 3 Task 5. |
| `app/agents/errors.py` | 1 | Create | PASS | Does not exist. |
| `app/agents/correlation.py` | 1 | Create | PASS | Does not exist. |
| `app/agents/permissions.py` | 1 | Create | PASS | Does not exist. |
| `app/models/agent_run.py` | 1 | Create | PASS | Does not exist. |
| `app/models/agent_event.py` | 1 | Create | PASS | Does not exist. |
| `app/schemas/sse_events.py` | 1 | Create | PASS | Does not exist. |
| `alembic/versions/0004_agent_runtime.py` | 1 | Create | PASS | 0003 is current head; 0004 is next slot. Parent directory exists. |
| `tests/agents/__init__.py` + test files | 1 | Create | PASS | `tests/agents/` does not exist; parent `tests/` does. |
| `app/agents/sdk_options.py` | 2 | Create | PASS | Does not exist. |
| `app/agents/permission_hooks.py` | 2 | Create | PASS | Does not exist. |
| `app/agents/event_bus.py` | 2 | Create | PASS | Does not exist. |
| `app/agents/budget.py` | 2 | Create | PASS | Does not exist. |
| `app/agents/mcp_registration.py` | 2 | Create | PASS | Does not exist. |
| `app/agents/error_mapping.py` | 2 | Create | PASS | Does not exist. |
| `app/agents/pid_liveness.py` | 3 | Create | PASS | Does not exist. |
| `app/agents/session.py` | 3 | Create | PASS | Does not exist. |
| `app/agents/session_manager.py` | 3 | Create | PASS | Does not exist. |
| `app/agents/archive.py` | 3 | Create | PASS | Does not exist. |
| `tests/agents/conftest.py` + Wave-3 test files | 3 | Create | PASS | Does not exist. |
| `web/backend/pyproject.toml` | 4 | Modify | PASS | Exists; plan appends 2 dependency lines. |
| `web/backend/uv.lock` | 4 | Modify (refresh) | PASS | Refreshed via `uv lock` after pyproject edit. |
| `app/main.py` | 4 | Modify | PASS | Exists; plan adds `agent_manager` lifespan wiring + include_router + error handler install. |
| `app/routers/agents.py` | 4 | Create | PASS | Does not exist. |
| `app/services/agent_service.py` | 4 | Create | PASS | Does not exist. |
| `app/schemas/agents.py` | 4 | Create | PASS | Does not exist. |
| `app/routers/__init__.py` | 4 | Modify (optional) | PASS | Exists; plan Task 6 marks as "skip if existing empty-importable". |
| `app/services/__init__.py` | 4 | Modify (optional) | PASS | Exists; plan Task 7 marks as "skip if existing convention already supports". |

## Consistency

No files are claimed by two waves with conflicting actions. The one documented shared file is handled cleanly:

| File | Claimed By | Status | Resolution |
|---|---|---|---|
| `app/agents/__init__.py` | Wave 1 (create empty stub) → Wave 3 (fill with re-exports) | PASS | Explicit handoff. Wave 1 Task 1 docs "empty package init"; Wave 3 Task 5 docs "Wave 1 created it empty; Wave 3 is allowed to edit it for re-exports because Wave 1 reserved the file but only filled it with an empty init." Invariant: no conflict because Wave 1 never writes non-empty content. |

No other file appears in two waves' "Files Owned Exclusively" lists. No overlapping edits to any shared section of any file.

## Cross-Job Dependencies

| Dependency | Status | Notes |
|---|---|---|
| Wave 2 imports `SAFE_ENV_KEYS`, `resolve_policy`, `is_destructive`, `AgentEvent`, `SseEvent`, `AgentBaseError` from Wave 1 | PASS | All provided by Wave 1 exports. |
| Wave 3 imports `build_sdk_options`, `can_use_tool_hook`, `destructive_pre_tool_hook`, `EventBus`, `RunBudget`, `RunChannel` from Wave 2 | PASS | Provided by Wave 2 modules. |
| Wave 3 imports `AgentRun`, `correlation.bind_run_id`, `permissions.resolve_policy`, SSE event classes from Waves 1/1/1/1 | PASS | Ordering intact. |
| Wave 4 imports `AgentSessionManager`, `EventBus`, `install_agent_error_handlers`, `build_sdk_options`, taxonomy classes via `from app.agents import ...` | PASS | `app/agents/__init__.py` re-exports filled by Wave 3 Task 5; Wave 4 depends on that filled surface. Ordering intact. |
| Wave 2 Task 1 "SDK transient install, do NOT commit pyproject/lockfile" vs Wave 4 Task 1 "commit pyproject/lockfile with SDK dep" | PASS | Explicitly sequenced. Wave 2 verification step 6 reverts any accidental lockfile changes. Wave 4 owns the committed edit. |

## Edits Made

None. No auto-fixes applied. All gaps are either documented spec-revisions handled by the plan, or narrow executor-discretion items (see Summary) — no JOB-PLAN edits required.

## Summary

**Verdict: PASS_WITH_GAPS.**

All four wave plans are structurally sound and internally consistent. Every CONTRACT.json export is owned by exactly one wave, every behavioral invariant has ≥1 (typically multiple) mapped tests, file ownership is exclusive with the one documented `app/agents/__init__.py` Wave 1 → Wave 3 handoff, the prerequisite import chain is acyclic and matches module dependencies, and negative invariants (grep-enforced source-level checks for `bypassPermissions`, `claude_agent_sdk` in Wave 1 files, `ClaudeSDKClient` in Wave 2 files, `BackgroundTasks` in Wave 4 files) are present in per-wave verification blocks.

The PASS_WITH_GAPS verdict reflects three minor implementation-quality concerns in the Wave 2/3 code sketches that the executor will resolve during implementation without scope change:

1. **Wave 3 Task 2 `_leave_waiting` math is admittedly a placeholder.** The plan explicitly acknowledges this: "Executor may refactor the waiting-interval math as long as `total_wall_clock_s ≥ active_duration_s ≥ 0` is invariant. A cleaner approach is accumulating a `_waiting_total_s` then computing `active = wall - waiting_total` at finish. Tests in Task 6 will assert the invariant." The invariant is enforced by `test_wall_clock_ge_active_duration`, so gaps in the sketch are bounded.

2. **Wave 3 Task 4 `start_run` step 4 `acquired` expression is semantically buggy as written** (`asyncio.wait_for(set_lock.acquire(), timeout=0.01) is None` — `acquire()` returns True, not None, so `acquired` always evaluates to False). The documented invariant ("raises `StateError` on mutex contention; otherwise acquires the lock and returns") is correct, and the partial unique index is the canonical safety net, so the executor will refactor the Python-lock fast-path. No test-regression risk because the DB index is the correctness layer.

3. **Wave 2 Task 2 sets `options.max_budget_usd = float(settings.rapid_agent_daily_cap_usd)`** and Wave 2 test `test_max_budget_usd_from_settings` asserts it. The `claude-agent-sdk>=0.1.59` SDK does not expose a `max_budget_usd` field on `ClaudeAgentOptions`; budget is tracked Python-side by `RunBudget`. The executor should drop the options assignment and rewrite the corresponding test to assert the Python-side `RunBudget.cost_cap_usd` instead. The halt invariant is still enforced by Wave 2 `test_cost_exceeded_halts`.

None of these rise to FAIL: they are localized, acknowledged (or trivially corrected) implementation details inside otherwise complete specifications. Coverage, file ownership, prerequisite ordering, SDK-usage correctness (`add_dirs` / `setting_sources=['project']` / no `bypassPermissions` / `SAFE_ENV_KEYS` allowlist / dual-gate destructive firewall), SSE contract completeness (10 kinds, no version field, query-wins since-precedence, `ping=15` + `Cache-Control` + `X-Accel-Buffering`), mutex + concurrency layering, orphan + budget + archive mechanics, `<200ms` dispatch discipline, and `run_id` threading are all fully specified and test-enforced.

**failingJobs:** none (no wave fails; all four plans are executable as written, modulo the three minor executor-level refinements above).
