# Wave 2 Plan Digest

**Objective:** Wire Claude Agent SDK primitives into testable, session-less helpers (no FastAPI/uvicorn/live sessions yet).
**Tasks:** 10 tasks completed — centralized options factory, dual-gated destructive firewall, event bus, budget, MCP stub, error mapping + tests.
**Key files:** app/agents/{sdk_options,permission_hooks,event_bus,budget,mcp_registration,error_mapping}.py + matching tests.
**Approach:** `build_sdk_options()` is the single source of truth for `ClaudeAgentOptions` — always `setting_sources=['project']`, scrubs credential env, threads `RAPID_RUN_ID`/`RAPID_RUN_MODE`, forbids `bypassPermissions`. Dual-gate: every `can_use_tool` registration paired with a no-op `PreToolUse` hook (SDK quirk). EventBus = per-run pub/sub + ring buffer + SQLite writer task + `?since=<seq>` replay (ring + SQLite dedup + `replay_truncated` emission). RunBudget tracks turns + per-project daily USD cap.
**Deviations:** (1) Event-bus text queries use `run_id.hex` (SQLModel stores SQLite UUIDs as 32-char hex) — Wave 3 must match. (2) Added `since==0 and oldest>1` branch to `attach_events` for full-history replay against pruned runs.
**Tests:** 48 tests added (74 total in tests/agents/). `pyproject.toml`/`uv.lock` unchanged (deferred to Wave 4).
**Status:** Complete (commit 5180afb).
