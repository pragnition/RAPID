# Wave 2 PLAN: SDK Core

**Set:** agent-runtime-foundation
**Wave:** 2 of 4 — SDK Core (SDK primitives, no long-lived sessions)
**Working root:** `web/backend/`

## Objective

Wire the Claude Agent SDK primitives into testable, session-less helpers: the centralized `build_sdk_options()` factory, the destructive-command firewall (dual-gated via `can_use_tool` **and** a `PreToolUse` hook to defeat the SDK's silent short-circuit), the `EventBus` (ring buffer + per-run SQLite writer task + replay with ring/SQLite dedup + `replay_truncated` emission), `RunBudget` cost/turn tracking, the `register_mcp_tools()` stub, and the error-taxonomy-to-HTTPException mapping helper. Everything in this wave is unit-testable without FastAPI, uvicorn, or a live agent process.

## Prerequisite: Wave 1 artifacts must exist

Before starting Wave 2, verify: `app/agents/errors.py`, `app/agents/correlation.py`, `app/agents/permissions.py` (data + `is_destructive`), `app/models/agent_run.py`, `app/models/agent_event.py`, `app/schemas/sse_events.py`, migration `0004_agent_runtime.py`.

## Tasks

### Task 1 — Register the `claude-agent-sdk` dependency locally for development

**Action:** Temporarily edit `web/backend/pyproject.toml` ONLY if Wave 4 has not yet committed the dep. **Default: DO NOT edit pyproject.toml in Wave 2 — defer to Wave 4.** Instead, `uv add --dev` is disallowed because it mutates the lockfile outside Wave 4's ownership.

**What to do:** Install the SDK in the worktree venv **transiently** for the duration of testing using `uv pip install --no-deps claude-agent-sdk>=0.1.59,<0.2` so imports resolve. Do NOT commit the change — Wave 4 owns the pyproject edit. If the executor encounters a lockfile-changed situation, revert with `git checkout -- web/backend/uv.lock web/backend/pyproject.toml` before commit.

**Rationale:** File-ownership integrity. Wave 4 adds the dep as part of its dependency declaration. Wave 2 needs the SDK installed to run tests but does not own the manifest.

### Task 2 — `app/agents/sdk_options.py` — centralized `build_sdk_options()`

**File to create:** `app/agents/sdk_options.py`

**Requirements:**

- Imports:

  ```python
  from __future__ import annotations
  import os
  from pathlib import Path
  from typing import Any

  from claude_agent_sdk import ClaudeAgentOptions, HookMatcher

  from app.agents.correlation import SAFE_ENV_KEYS
  from app.agents.permissions import resolve_policy
  from app.agents.permission_hooks import can_use_tool_hook, destructive_pre_tool_hook
  ```

- Top-level constant:

  ```python
  RAPID_RUN_MODE = "sdk"  # threaded into ClaudeAgentOptions.env['RAPID_RUN_MODE']
  ```

- Function signature (MATCH EXACTLY — contract surface):

  ```python
  def build_sdk_options(
      project_root: Path,
      worktree: Path | None,
      skill_name: str,
      skill_args: dict[str, Any],
      run_id: str,
  ) -> ClaudeAgentOptions:
      ...
  ```

- Invariants implemented in the body (each covered by a test in Task 7):
  1. `project_root` must be absolute. Raise `ValueError("project_root must be absolute")` if `not project_root.is_absolute()`.
  2. If `worktree is not None`, also must be absolute; else raise `ValueError`.
  3. Resolve per-skill policy: `policy = resolve_policy(skill_name)`.
  4. Compute the scrubbed env:

     ```python
     env = {
         "RAPID_RUN_MODE": RAPID_RUN_MODE,
         "RAPID_RUN_ID": run_id,
         **{k: os.environ[k] for k in SAFE_ENV_KEYS if k in os.environ},
     }
     ```

     Explicitly: no `ANTHROPIC_API_KEY`, no `*_TOKEN`, no `*_KEY`, no `*_SECRET` leak.
  5. Compose:

     ```python
     options = ClaudeAgentOptions(
         cwd=str(project_root),
         add_dirs=[str(worktree)] if worktree is not None else [],
         setting_sources=["project"],
         permission_mode=policy["permission_mode"],  # 'default' | 'acceptEdits' only
         allowed_tools=list(policy["allowed_tools"]),
         disallowed_tools=list(policy["disallowed_tools"]),
         max_turns=int(policy["max_turns"]),
         env=env,
         can_use_tool=can_use_tool_hook,
         hooks={
             "PreToolUse": [HookMatcher(matcher="Bash", hooks=[destructive_pre_tool_hook])],
         },
         max_budget_usd=float(settings.rapid_agent_daily_cap_usd),
     )
     return options
     ```

  6. Assert-style invariant on the way out (runtime safety belt — never raised in prod but catches regressions):

     ```python
     assert options.setting_sources == ["project"], "setting_sources invariant broken"
     assert options.permission_mode in {"default", "acceptEdits"}, "unexpected permission_mode"
     ```

- Do not import `bypassPermissions` anywhere. Do not reference `SettingSource` strings other than `"project"`. Do not set `permission_mode="bypassPermissions"`. The test in Task 7 greps the source file to enforce.

- `settings` import must be lazy inside the function or at module import from `app.config`:

  ```python
  from app.config import settings
  ```

### Task 3 — `app/agents/permission_hooks.py` — destructive firewall, dual-gated

**File to create:** `app/agents/permission_hooks.py`

**Requirements:**

- The `can_use_tool` callback AND the `PreToolUse` hook both enforce the destructive firewall. Per CONTEXT.md: "The PreToolUse hook is NOT a no-op — it IS the destructive firewall." It exists because `can_use_tool` does not fire in `acceptEdits` mode for file-edit tools or when tools are explicitly allowed. This is belt-and-suspenders.

- Imports:

  ```python
  from __future__ import annotations
  import logging
  from typing import Any

  from claude_agent_sdk import (
      ToolPermissionContext, PermissionResultAllow, PermissionResultDeny,
      HookContext,
  )

  from app.agents.permissions import is_destructive
  from app.agents.correlation import get_run_id

  logger = logging.getLogger("rapid.agents.permissions")
  ```

- `async def can_use_tool_hook(tool_name: str, input_data: dict[str, Any], context: ToolPermissionContext) -> PermissionResultAllow | PermissionResultDeny`:

  ```python
  if tool_name == "Bash":
      cmd = str(input_data.get("command", ""))
      blocked, matched = is_destructive(cmd)
      if blocked:
          logger.warning(
              "destructive bash blocked",
              extra={"tool": tool_name, "pattern": matched, "tool_use_id": context.tool_use_id},
          )
          return PermissionResultDeny(
              behavior="deny",
              message=f"Destructive command blocked by RAPID firewall: {matched}",
              interrupt=False,
          )
  # Trust-all-tools policy: everything else is allowed. permission_req is emitted
  # as an info-only event by the session pump when we get here (Wave 3 wires that).
  return PermissionResultAllow(behavior="allow", updated_input=input_data)
  ```

- `async def destructive_pre_tool_hook(input_data: dict, tool_use_id: str | None, context: HookContext) -> dict`:

  ```python
  tool_name = input_data.get("tool_name", "")
  tool_input = input_data.get("tool_input", {})
  if tool_name == "Bash":
      cmd = str(tool_input.get("command", ""))
      blocked, matched = is_destructive(cmd)
      if blocked:
          logger.warning(
              "destructive bash blocked via PreToolUse",
              extra={"tool": tool_name, "pattern": matched, "tool_use_id": tool_use_id},
          )
          return {
              "hookSpecificOutput": {
                  "hookEventName": "PreToolUse",
                  "permissionDecision": "deny",
                  "permissionDecisionReason": f"Destructive command blocked: {matched}",
              }
          }
  return {}
  ```

- Both callables are `async` even if the body is synchronous — the SDK awaits them.

### Task 4 — `app/agents/event_bus.py` — ring buffer + SQLite writer + replay

**File to create:** `app/agents/event_bus.py`

**Requirements:**

- Imports (no FastAPI dependency):

  ```python
  from __future__ import annotations
  import asyncio
  import json
  import logging
  from collections import deque
  from datetime import datetime, timezone
  from pathlib import Path
  from typing import AsyncIterator, Deque
  from uuid import UUID

  from sqlalchemy import text
  import sqlalchemy
  from sqlmodel import Session, select

  from app.agents.correlation import get_run_id
  from app.config import settings
  from app.models.agent_event import AgentEvent
  from app.schemas.sse_events import SseEvent, EVENT_KINDS, serialize_event

  logger = logging.getLogger("rapid.agents.event_bus")
  ```

- Constants (use settings values):

  ```python
  RING_BUFFER_SIZE = settings.rapid_agent_ring_buffer_size  # default 1000
  BATCH_INTERVAL_S = 1.0
  CRITICAL_KINDS = frozenset({"permission_req", "ask_user", "run_complete", "status"})
  # tool_use events for DESTRUCTIVE blocked actions are flagged critical by the session.
  ```

- Class `RunChannel`:

  ```python
  class RunChannel:
      """Per-run pub/sub primitive. One per run_id."""
      def __init__(self, run_id: UUID, engine: sqlalchemy.Engine) -> None:
          self.run_id = run_id
          self._engine = engine
          self._ring: Deque[SseEvent] = deque(maxlen=RING_BUFFER_SIZE)
          self._subscribers: list[asyncio.Queue[SseEvent]] = []
          self._seq = 0
          self._pending_batch: list[SseEvent] = []
          self._pending_lock = asyncio.Lock()
          self._writer_task: asyncio.Task | None = None
          self._closed = asyncio.Event()
          self._max_flushed_seq = 0  # highest seq persisted to SQLite

      async def start_writer(self) -> None:
          self._writer_task = asyncio.create_task(self._writer_loop())

      async def close(self) -> None:
          self._closed.set()
          if self._writer_task:
              await self._writer_task
          await self._flush_batch()  # final flush

      def next_seq(self) -> int:
          self._seq += 1
          return self._seq

      async def publish(self, event: SseEvent) -> None:
          # ring buffer (live subscribers read from fanout queues)
          self._ring.append(event)
          # fanout
          for q in list(self._subscribers):
              await q.put(event)
          # persist
          if event.kind in CRITICAL_KINDS:
              await self._flush_single(event)  # synchronous sqlite write
          else:
              async with self._pending_lock:
                  self._pending_batch.append(event)

      async def subscribe(self) -> asyncio.Queue[SseEvent]:
          q: asyncio.Queue[SseEvent] = asyncio.Queue()
          self._subscribers.append(q)
          return q

      def unsubscribe(self, q: asyncio.Queue[SseEvent]) -> None:
          try:
              self._subscribers.remove(q)
          except ValueError:
              pass

      async def _writer_loop(self) -> None:
          try:
              while not self._closed.is_set():
                  try:
                      await asyncio.wait_for(self._closed.wait(), timeout=BATCH_INTERVAL_S)
                  except asyncio.TimeoutError:
                      pass
                  await self._flush_batch()
          except Exception:
              logger.exception("event writer loop crashed", extra={"run_id": str(self.run_id)})

      async def _flush_single(self, event: SseEvent) -> None:
          def _write() -> None:
              with Session(self._engine) as s:
                  s.add(AgentEvent(
                      run_id=self.run_id,
                      seq=event.seq,
                      ts=event.ts,
                      kind=event.kind,
                      payload=json.dumps(serialize_event(event)),
                  ))
                  s.commit()
          await asyncio.to_thread(_write)
          if event.seq > self._max_flushed_seq:
              self._max_flushed_seq = event.seq

      async def _flush_batch(self) -> None:
          async with self._pending_lock:
              if not self._pending_batch:
                  return
              batch = self._pending_batch
              self._pending_batch = []
          def _write() -> None:
              with Session(self._engine) as s:
                  for evt in batch:
                      s.add(AgentEvent(
                          run_id=self.run_id,
                          seq=evt.seq,
                          ts=evt.ts,
                          kind=evt.kind,
                          payload=json.dumps(serialize_event(evt)),
                      ))
                  s.commit()
          await asyncio.to_thread(_write)
          new_max = max((e.seq for e in batch), default=0)
          if new_max > self._max_flushed_seq:
              self._max_flushed_seq = new_max

      async def replay(self, since: int) -> AsyncIterator[SseEvent]:
          """Replay events from `since` (exclusive). Yields ReplayTruncatedEvent
          first if `since` is older than the oldest available data, then SQLite
          backfill, then hands off to live subscription with dedup."""
          # Wave 3 owns the public attach; this method is called by the session
          # manager-facing facade only.
          raise NotImplementedError("use EventBus.attach_events via manager")
  ```

- Class `EventBus`:

  ```python
  class EventBus:
      def __init__(self, engine: sqlalchemy.Engine) -> None:
          self._engine = engine
          self._channels: dict[UUID, RunChannel] = {}
          self._lock = asyncio.Lock()

      async def get_or_create_channel(self, run_id: UUID) -> RunChannel:
          async with self._lock:
              ch = self._channels.get(run_id)
              if ch is None:
                  ch = RunChannel(run_id, self._engine)
                  await ch.start_writer()
                  self._channels[run_id] = ch
              return ch

      async def publish(self, run_id: UUID, event: SseEvent) -> None:
          ch = await self.get_or_create_channel(run_id)
          await ch.publish(event)

      async def close_channel(self, run_id: UUID) -> None:
          async with self._lock:
              ch = self._channels.pop(run_id, None)
          if ch:
              await ch.close()

      async def close(self) -> None:
          # Shutdown all channels
          channels = list(self._channels.values())
          self._channels.clear()
          await asyncio.gather(*(ch.close() for ch in channels), return_exceptions=True)

      async def attach_events(
          self, run_id: UUID, since: int = 0
      ) -> AsyncIterator[SseEvent]:
          """SSE-facing replay. Yields:
             1. replay_truncated (if since < oldest available in SQLite after retention)
             2. SQLite backfill WHERE seq > since
             3. Live ring/subscriber events with seq > max_backfill_seq (dedup)
          """
          from app.schemas.sse_events import ReplayTruncatedEvent  # local to avoid cycle

          ch = await self.get_or_create_channel(run_id)

          # --- Step 1: determine oldest available seq in SQLite for this run ---
          def _query_bounds() -> tuple[int, int]:
              with Session(self._engine) as s:
                  row = s.exec(
                      text(
                          "SELECT MIN(seq), MAX(seq) FROM agentevent WHERE run_id = :rid"
                      ).bindparams(rid=str(run_id))
                  ).one()
                  return (row[0] or 0, row[1] or 0)

          oldest, newest = await asyncio.to_thread(_query_bounds)
          if since > 0 and oldest > 0 and since < oldest - 1:
              yield ReplayTruncatedEvent(
                  seq=0,
                  ts=datetime.now(timezone.utc),
                  run_id=run_id,
                  kind="replay_truncated",
                  oldest_available_seq=oldest,
                  requested_since_seq=since,
                  reason="retention_cap",
              )

          # --- Step 2: SQLite backfill ---
          def _load_backfill() -> list[dict]:
              with Session(self._engine) as s:
                  rows = s.exec(
                      select(AgentEvent)
                      .where(AgentEvent.run_id == run_id)
                      .where(AgentEvent.seq > since)
                      .order_by(AgentEvent.seq)
                  ).all()
                  return [
                      {"seq": r.seq, "ts": r.ts, "kind": r.kind, "payload": json.loads(r.payload)}
                      for r in rows
                  ]

          backfill = await asyncio.to_thread(_load_backfill)
          max_backfill_seq = since
          for row in backfill:
              # Reconstruct the pydantic event from payload (stored as serialized dict).
              evt = _deserialize_stored_event(row["payload"])
              max_backfill_seq = max(max_backfill_seq, evt.seq)
              yield evt

          # --- Step 3: live subscription, dedup by seq > max_backfill_seq ---
          q = await ch.subscribe()
          try:
              while True:
                  evt = await q.get()
                  if evt.seq <= max_backfill_seq:
                      continue  # SQLite already replayed this one
                  yield evt
                  if evt.kind == "run_complete":
                      return
          finally:
              ch.unsubscribe(q)
  ```

- Module-level helper:

  ```python
  def _deserialize_stored_event(payload: dict) -> SseEvent:
      from pydantic import TypeAdapter
      from app.schemas.sse_events import SseEvent as _SseEvent
      return TypeAdapter(_SseEvent).validate_python(payload)
  ```

- Retention enforcement (exposed but scheduled by the session manager in Wave 3):

  ```python
  async def enforce_retention(self, run_id: UUID) -> None:
      def _count_and_trim() -> int:
          with Session(self._engine) as s:
              count = s.exec(
                  text("SELECT COUNT(*) FROM agentevent WHERE run_id = :rid").bindparams(rid=str(run_id))
              ).one()[0]
              cap = settings.rapid_agent_event_retention_rows
              if count > cap:
                  excess = count - cap
                  s.exec(text(
                      "DELETE FROM agentevent WHERE id IN ("
                      "  SELECT id FROM agentevent WHERE run_id = :rid ORDER BY seq ASC LIMIT :n"
                      ")"
                  ).bindparams(rid=str(run_id), n=excess))
                  s.commit()
                  return excess
              return 0
      pruned = await asyncio.to_thread(_count_and_trim)
      return pruned
  ```

  (Archive-to-JSONL logic is Wave 3. Wave 2 only enforces the per-run row cap.)

### Task 5 — `app/agents/budget.py` — `RunBudget`

**File to create:** `app/agents/budget.py`

**Requirements:**

- Imports:

  ```python
  from __future__ import annotations
  import asyncio
  from dataclasses import dataclass
  from typing import Literal

  from app.agents.errors import RunError
  from app.config import settings
  ```

- Class:

  ```python
  @dataclass
  class BudgetStatus:
      turns_used: int
      turns_remaining: int
      cost_used_usd: float
      cost_cap_usd: float
      cost_remaining_usd: float
      halted: bool
      halt_reason: Literal["none", "turns_exceeded", "cost_exceeded"] = "none"

  class RunBudget:
      def __init__(self, max_turns: int, daily_cap_usd: float | None = None) -> None:
          self.max_turns = max_turns
          self.cost_cap_usd = daily_cap_usd if daily_cap_usd is not None else settings.rapid_agent_daily_cap_usd
          self._turns = 0
          self._cost = 0.0
          self._lock = asyncio.Lock()
          self._halted = False
          self._halt_reason: str = "none"

      async def record_turn(self, cost_usd: float) -> None:
          async with self._lock:
              self._turns += 1
              self._cost += cost_usd
              if self._turns >= self.max_turns:
                  self._halted = True
                  self._halt_reason = "turns_exceeded"
              elif self._cost >= self.cost_cap_usd:
                  self._halted = True
                  self._halt_reason = "cost_exceeded"

      async def check(self) -> BudgetStatus:
          async with self._lock:
              return BudgetStatus(
                  turns_used=self._turns,
                  turns_remaining=max(0, self.max_turns - self._turns),
                  cost_used_usd=round(self._cost, 4),
                  cost_cap_usd=self.cost_cap_usd,
                  cost_remaining_usd=round(max(0.0, self.cost_cap_usd - self._cost), 4),
                  halted=self._halted,
                  halt_reason=self._halt_reason,
              )
  ```

- `RunBudget` is the Python-side halt; `build_sdk_options()` also sets `max_budget_usd` on the SDK options as a floor. Per CONTEXT: the Python budget halts first with a graceful status event; the SDK cap is a safety net.

### Task 6 — `app/agents/mcp_registration.py` — `register_mcp_tools()` stub

**File to create:** `app/agents/mcp_registration.py`

**Requirements:**

- Imports:

  ```python
  from __future__ import annotations
  from typing import Any

  from claude_agent_sdk import ClaudeAgentOptions, create_sdk_mcp_server
  ```

- Function:

  ```python
  def register_mcp_tools(
      options: ClaudeAgentOptions,
      tools: list[Any],
      server_name: str = "rapid",
      server_version: str = "1.0.0",
  ) -> ClaudeAgentOptions:
      """Mutate options in place: add an in-process SDK MCP server exposing `tools`
      and append the corresponding mcp__{server_name}__{tool_name} entries to
      allowed_tools. Must be called BEFORE session.connect() -- options must be
      fully assembled before SDK client creation per SDK docs.

      Downstream sets (web-tool-bridge, kanban-autopilot) call this with their
      @tool-decorated functions. Wave 2 provides the wiring; tools come later.
      """
      if not tools:
          return options
      server = create_sdk_mcp_server(name=server_name, version=server_version, tools=list(tools))
      existing = dict(getattr(options, "mcp_servers", {}) or {})
      existing[server_name] = server
      options.mcp_servers = existing

      allowed = list(options.allowed_tools or [])
      for t in tools:
          tool_name = getattr(t, "name", None) or getattr(t, "__name__", None)
          if not tool_name:
              continue
          fqn = f"mcp__{server_name}__{tool_name}"
          if fqn not in allowed:
              allowed.append(fqn)
      options.allowed_tools = allowed
      return options
  ```

- Do NOT import or call `ClaudeSDKClient` here. Only options mutation.

### Task 7 — `app/agents/error_mapping.py` — taxonomy → HTTPException helper

**File to create:** `app/agents/error_mapping.py`

**Requirements:**

- Imports:

  ```python
  from fastapi import HTTPException
  from fastapi.responses import JSONResponse

  from app.agents.errors import (
      AgentBaseError, SdkError, RunError, StateError, ToolError, UserError,
      RETRYABLE_ERROR_CODES,
  )
  ```

- Function:

  ```python
  def to_http_exception(exc: AgentBaseError) -> HTTPException:
      """Map taxonomy errors → HTTPException with {error_code, message, detail}
      envelope. Retryable errors (sdk_error) get a Retry-After header seed in
      detail; the response generator can promote it to a header."""
      envelope = {
          "error_code": exc.error_code,
          "message": exc.message,
          "detail": exc.detail,
      }
      headers: dict[str, str] | None = None
      if exc.error_code in RETRYABLE_ERROR_CODES:
          headers = {"Retry-After": "5"}
      return HTTPException(status_code=exc.http_status, detail=envelope, headers=headers)
  ```

- Provide `def install_agent_error_handlers(app)` that registers an `@app.exception_handler(AgentBaseError)` delegating to `to_http_exception` and returning the resulting `HTTPException`'s body as `JSONResponse` (signature that Wave 4 calls in `create_app`).

### Task 8 — Wave 2 tests

**File to create:** `tests/agents/test_sdk_options.py`

- `test_setting_sources_project_only()` — call `build_sdk_options(...)`. Assert `options.setting_sources == ["project"]`.
- `test_cwd_is_absolute_project_root(tmp_path)` — pass `tmp_path` as `project_root`; assert `options.cwd == str(tmp_path)`.
- `test_worktree_adds_additional_directory(tmp_path)` — pass `worktree=tmp_path / "worktrees/x"` (create it); assert `options.add_dirs == [str(tmp_path / "worktrees/x")]`.
- `test_rejects_relative_project_root()` — call with `Path("rel/path")`; expect `ValueError`.
- `test_env_scrubs_credentials(monkeypatch)` — set `monkeypatch.setenv("ANTHROPIC_API_KEY", "secret")`, `monkeypatch.setenv("GITHUB_TOKEN", "ghp_x")`, `monkeypatch.setenv("PATH", "/usr/bin")`. Build options. Assert `"ANTHROPIC_API_KEY" not in options.env`, `"GITHUB_TOKEN" not in options.env`, `options.env["PATH"] == "/usr/bin"`, `options.env["RAPID_RUN_MODE"] == "sdk"`, `options.env["RAPID_RUN_ID"] == "<passed-run-id>"`.
- `test_no_bypass_permissions_anywhere()` — call `build_sdk_options` with every skill name in `PERMISSION_POLICY`. For each, assert `options.permission_mode in {"default", "acceptEdits"}`. Then:

  ```python
  import pathlib
  src = pathlib.Path("app/agents/sdk_options.py").read_text()
  assert "bypassPermissions" not in src
  ```

- `test_pretooluse_hook_registered()` — assert `"PreToolUse" in options.hooks` and the matcher is for `"Bash"`.
- `test_can_use_tool_callback_is_our_hook()` — `assert options.can_use_tool is can_use_tool_hook`.
- `test_max_turns_from_policy()` — for skill `execute-set` assert `options.max_turns == 200`.
- `test_max_budget_usd_from_settings()` — patch `settings.rapid_agent_daily_cap_usd = 25.0`; assert `options.max_budget_usd == 25.0`.

**File to create:** `tests/agents/test_permission_hooks.py`

- `test_can_use_tool_blocks_rm_rf()` — `await can_use_tool_hook("Bash", {"command":"rm -rf /"}, fake_ctx())` returns `PermissionResultDeny` with `behavior == "deny"`.
- `test_can_use_tool_allows_ls()` — returns `PermissionResultAllow`.
- `test_can_use_tool_allows_non_bash(...)` — tool_name `"Edit"` with `{"file_path":"foo.py"}` returns `PermissionResultAllow`.
- `test_pretooluse_blocks_force_push()` — `await destructive_pre_tool_hook({"tool_name":"Bash","tool_input":{"command":"git push --force origin main"}}, "use-1", fake_hook_ctx())` returns a dict with `hookSpecificOutput.permissionDecision == "deny"`.
- `test_pretooluse_passes_through_safe()` — returns `{}` (empty = allow).
- `test_firewall_dual_gate_source_presence()` — `from app.agents.sdk_options import build_sdk_options` then assert `options.can_use_tool is can_use_tool_hook` AND `options.hooks["PreToolUse"][0].hooks[0] is destructive_pre_tool_hook`.

Provide a minimal `fake_ctx()` / `fake_hook_ctx()` that returns an object with `tool_use_id="t-1"` attribute — use `types.SimpleNamespace`.

**File to create:** `tests/agents/test_event_bus.py`

- `test_publish_increments_seq(tables, session)` — create `EventBus(engine)`; create a `RunChannel` via `get_or_create_channel(UUID)`; publish three `StatusEvent`s assigning seq via `channel.next_seq()`. Query `AgentEvent` table rows — assert `{1,2,3}` persisted.
- `test_critical_kind_synchronous_flush(tables, session)` — publish a `PermissionReqEvent`; WITHOUT awaiting the batch interval, query the table — assert the row is there.
- `test_non_critical_kind_batched(tables)` — publish an `AssistantTextEvent`. Query the table — row should NOT be there yet. `await asyncio.sleep(1.2)` (or manually call `_flush_batch`) — row is now there.
- `test_ring_buffer_bounded()` — publish 1200 events with `RING_BUFFER_SIZE=1000`; assert `len(channel._ring) == 1000`.
- `test_attach_replay_backfill_and_live(tables)` — publish 5 events, force flush, then subscribe with `since=2`. Expected yield: events 3, 4, 5 from backfill (no live events yet). Then publish event 6. Expected yield: event 6 (from live subscription). Ensure no duplicate.
- `test_attach_emits_replay_truncated(tables)` — manually delete rows with `seq < 3`, then attach with `since=0`. First yielded event kind == `replay_truncated`.
- `test_enforce_retention_prunes_oldest(tables, monkeypatch)` — monkeypatch `settings.rapid_agent_event_retention_rows = 100`; insert 150 rows; call `bus.enforce_retention(run_id)`; query — 100 rows remain; the surviving rows are seq 51..150 (oldest pruned).

**File to create:** `tests/agents/test_budget.py`

- `test_initial_state()` — `RunBudget(max_turns=10)`: `await check()` → `turns_used=0`, `halted=False`.
- `test_turns_exceeded_halts()` — max_turns=3; record 3 turns; `halted=True`, `halt_reason="turns_exceeded"`.
- `test_cost_exceeded_halts()` — max_turns=100, daily_cap_usd=1.0; record one turn with cost=1.5; `halted=True`, `halt_reason="cost_exceeded"`.
- `test_concurrent_record_turn_is_safe()` — `asyncio.gather(*[record_turn(0.01) for _ in range(50)])`; final `turns_used == 50`, `cost_used_usd ≈ 0.50`.

**File to create:** `tests/agents/test_mcp_registration.py`

- `test_register_noop_when_empty()` — call with `tools=[]`; options unchanged.
- `test_register_appends_allowed_tools(monkeypatch)` — stub `create_sdk_mcp_server` via monkeypatch to return `object()`. Provide fake tools with `.name = "ask_user"`. After `register_mcp_tools(options, [tool])`: `"mcp__rapid__ask_user" in options.allowed_tools` and `options.mcp_servers["rapid"]` is the stub.
- `test_register_idempotent()` — call twice with same tool; `options.allowed_tools.count("mcp__rapid__ask_user") == 1`.

**File to create:** `tests/agents/test_error_mapping.py`

- `test_sdk_error_maps_502_retryable()` — `to_http_exception(SdkError("boom")).status_code == 502` and `.headers.get("Retry-After") == "5"`.
- `test_state_error_maps_409()` — `StateError` → 409, no `Retry-After`.
- `test_user_error_maps_400()` → 400.
- `test_install_agent_error_handlers_registers_handler()` — build a bare FastAPI app; call `install_agent_error_handlers(app)`; route that raises `RunError("x")`; client gets 500 with envelope `{"error_code":"run_error", ...}`.

### Task 9 — WAVE-2-COMPLETE.md

**File to create:** `.planning/sets/agent-runtime-foundation/WAVE-2-COMPLETE.md` — record files created, test count, SDK pin verified.

## What NOT to do

- Do NOT edit `web/backend/pyproject.toml` in this wave. Dep addition is Wave 4's commit. For local SDK availability during test runs, use a transient `uv pip install` that is reverted before commit.
- Do NOT touch `app/main.py`, `app/routers/`, or `app/services/` in Wave 2. HTTP surface is Wave 4.
- Do NOT implement `AgentSession`, `AgentSessionManager`, `send_input`, `interrupt`, or the orphan sweeper. Those are Wave 3.
- Do NOT add an archive-to-JSONL task here — retention **enforcement** (row-cap prune) is here; the archive job is Wave 3 (owned by session manager).
- Do NOT set `permission_mode="bypassPermissions"` anywhere.
- Do NOT set `options.env = dict(os.environ)`. Always explicit-allowlist via `SAFE_ENV_KEYS`.
- Do NOT import `ClaudeSDKClient` in this wave — Wave 3 owns live-session code.
- Do NOT modify any file owned by Wave 1 (see Wave 1 ownership list).

## Verification

Run from `web/backend/`:

```bash
# 0. Install SDK transiently for test run (reverted before commit)
uv pip install 'claude-agent-sdk>=0.1.59,<0.2'

# 1. All Wave 2 tests pass, Wave 1 tests still pass
uv run pytest tests/agents/ -v

# 2. No-bypass invariant across all app/agents/*
! grep -RIn "bypassPermissions" app/agents/ app/schemas/

# 3. No ClaudeSDKClient import in Wave 2 files
! grep -In "ClaudeSDKClient" app/agents/sdk_options.py app/agents/permission_hooks.py \
    app/agents/event_bus.py app/agents/budget.py app/agents/mcp_registration.py \
    app/agents/error_mapping.py

# 4. Dual firewall presence (both can_use_tool AND PreToolUse hook)
uv run python -c "
from pathlib import Path
from unittest.mock import patch
from app.agents.sdk_options import build_sdk_options
from app.agents.permission_hooks import can_use_tool_hook, destructive_pre_tool_hook
opts = build_sdk_options(Path('/tmp').resolve(), None, 'execute-set', {}, 'rid-1')
assert opts.can_use_tool is can_use_tool_hook, 'can_use_tool not wired'
hk = opts.hooks['PreToolUse'][0]
assert destructive_pre_tool_hook in hk.hooks, 'PreToolUse hook not wired'
print('dual firewall OK')
"

# 5. Env scrub smoke test
uv run python -c "
import os
os.environ['ANTHROPIC_API_KEY'] = 'SECRET_SHOULD_NOT_LEAK'
from pathlib import Path
from app.agents.sdk_options import build_sdk_options
opts = build_sdk_options(Path('/tmp').resolve(), None, 'plan-set', {}, 'r1')
assert 'ANTHROPIC_API_KEY' not in opts.env, 'credential leaked into options.env'
assert opts.env.get('RAPID_RUN_MODE') == 'sdk'
assert opts.env.get('RAPID_RUN_ID') == 'r1'
print('scrub OK')
"

# 6. Revert any pyproject/lockfile changes before commit
git -C .. status web/backend/pyproject.toml web/backend/uv.lock
git -C .. checkout -- web/backend/pyproject.toml web/backend/uv.lock 2>/dev/null || true
```

## Success Criteria

- [ ] `uv run pytest tests/agents/ -v` passes; Wave 2 adds at least 28 new tests.
- [ ] `options.setting_sources == ["project"]` on every code path (test-enforced).
- [ ] `"bypassPermissions"` does not appear in any file under `app/agents/` (grep-enforced).
- [ ] Credential env vars scrubbed; `RAPID_RUN_MODE` + `RAPID_RUN_ID` + `SAFE_ENV_KEYS` only.
- [ ] `can_use_tool_hook` AND `destructive_pre_tool_hook` BOTH present on every built `ClaudeAgentOptions`.
- [ ] Destructive patterns block `rm -rf /`, `git push --force`, `cat .env`, `printenv`. `env | grep PATH` is allowed.
- [ ] `RunChannel` publishes critical events synchronously to SQLite; non-critical events batch every ~1s.
- [ ] `EventBus.attach_events(since=N)` emits `replay_truncated` when `since` is older than retention, then SQLite backfill, then live events with dedup.
- [ ] Retention row-cap prune removes oldest events first.
- [ ] `RunBudget.record_turn(cost)` halts on turns_exceeded or cost_exceeded; status reflects reason.
- [ ] `register_mcp_tools()` mutates options in place and is idempotent.
- [ ] `to_http_exception` maps the full taxonomy (502/500/409/422/400).
- [ ] Wave 2 artifacts committed as one commit `feat(agent-runtime-foundation): wave 2 sdk core — options, firewall, event bus, budget, mcp`.
- [ ] `pyproject.toml` and `uv.lock` are UNCHANGED in Wave 2's commit.

## Files Owned Exclusively by Wave 2

- `app/agents/sdk_options.py`
- `app/agents/permission_hooks.py`
- `app/agents/event_bus.py`
- `app/agents/budget.py`
- `app/agents/mcp_registration.py`
- `app/agents/error_mapping.py`
- `tests/agents/test_sdk_options.py`
- `tests/agents/test_permission_hooks.py`
- `tests/agents/test_event_bus.py`
- `tests/agents/test_budget.py`
- `tests/agents/test_mcp_registration.py`
- `tests/agents/test_error_mapping.py`

No other wave may modify any of the above files.
