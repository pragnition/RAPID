# Wave 1 PLAN: Foundation

**Set:** agent-runtime-foundation
**Wave:** 1 of 4 — Foundation (pure-schema, no SDK dependency)
**Working root:** `web/backend/` (all paths below are relative to this root unless marked ABSOLUTE)

## Objective

Lock the contract surface that every downstream wave and every downstream set (web-tool-bridge, skill-invocation-ui, kanban-autopilot, agents-chats-tabs) depends on. This wave produces only pure-Python schemas, SQLModel tables, the Alembic migration, the `run_id` correlation machinery, and the data-only permission policy. No live SDK calls, no long-lived runtime. After this wave the interface is frozen: the `AgentRun`/`AgentEvent` row shapes, the SSE event discriminated union, the `PERMISSION_POLICY` table, the `DESTRUCTIVE_PATTERNS` regex list, and the `run_id` ContextVar + logger-filter wiring.

## Tasks

### Task 1 — Create the `app/agents/` package with error taxonomy

**Action:** Create the package directory and the error hierarchy used by every downstream wave.

**Files to create:**
- `app/agents/__init__.py` — empty package init
- `app/agents/errors.py`

**`app/agents/errors.py` requirements:**
- Define exactly these classes, all inheriting from the base:

  ```python
  class AgentBaseError(Exception):
      """Base class for the agent-runtime error taxonomy."""
      error_code: str = "agent_error"
      http_status: int = 500

      def __init__(self, message: str, detail: dict | None = None) -> None:
          super().__init__(message)
          self.message = message
          self.detail = detail or {}

  class SdkError(AgentBaseError):
      error_code = "sdk_error"
      http_status = 502  # retryable

  class RunError(AgentBaseError):
      error_code = "run_error"
      http_status = 500

  class StateError(AgentBaseError):
      error_code = "state_error"
      http_status = 409

  class ToolError(AgentBaseError):
      error_code = "tool_error"
      http_status = 422

  class UserError(AgentBaseError):
      error_code = "user_error"
      http_status = 400
  ```

- Add a module-level constant `RETRYABLE_ERROR_CODES: frozenset[str] = frozenset({"sdk_error"})`.

### Task 2 — `run_id` correlation ContextVar + logger filter

**Files to create:**
- `app/agents/correlation.py`

**Requirements:**
- Declare `run_id_var: ContextVar[str | None] = ContextVar("rapid_run_id", default=None)` at module level (use the exact var name `rapid_run_id` as specified in CONTEXT).
- Provide `def get_run_id() -> str | None: return run_id_var.get()`.
- Provide a context manager:

  ```python
  from contextlib import contextmanager
  @contextmanager
  def bind_run_id(run_id: str) -> Iterator[None]:
      token = run_id_var.set(run_id)
      try:
          yield
      finally:
          run_id_var.reset(token)
  ```

- Provide a `logging.Filter` subclass `RunIdLogFilter` whose `filter(record)` method sets `record.run_id = run_id_var.get() or "-"` and always returns `True`.
- Export SAFE_ENV_KEYS here so downstream modules share one source of truth:

  ```python
  SAFE_ENV_KEYS: frozenset[str] = frozenset({"PATH", "HOME", "TERM", "LANG", "LC_ALL"})
  ```

### Task 3 — Edit `app/logging_config.py` to install the filter

**File to edit:** `app/logging_config.py` (existing file — owned EXCLUSIVELY by this wave)

**Changes:**
- Import `from app.agents.correlation import RunIdLogFilter` at the top.
- Inside `setup_logging`, after creating `file_handler` and `stream_handler` but before `root.addHandler(...)`, attach a single shared filter instance to both handlers:

  ```python
  run_id_filter = RunIdLogFilter()
  file_handler.addFilter(run_id_filter)
  stream_handler.addFilter(run_id_filter)
  ```

- Update the JsonFormatter invocation to include `run_id` in the output:

  ```python
  file_handler.setFormatter(JsonFormatter("%(asctime)s %(name)s %(levelname)s %(run_id)s %(message)s"))
  ```

- Update the stream handler format string to include `run_id`:

  ```python
  stream_handler.setFormatter(
      logging.Formatter("%(asctime)s %(levelname)-8s %(name)s [run=%(run_id)s] — %(message)s")
  )
  ```

- Do NOT modify any other function. No other waves touch this file.

### Task 4 — Extend `app/config.py` with agent-runtime knobs

**File to edit:** `app/config.py` (existing file — owned EXCLUSIVELY by this wave)

**Add inside the `Settings` class** (preserve existing fields verbatim, append at the bottom before the closing of the class body):

```python
# --- agent runtime ---
rapid_agent_max_concurrent: int = 3
rapid_agent_daily_cap_usd: float = 10.0
rapid_agent_orphan_sweep_interval_s: float = 60.0
rapid_agent_archive_dir: Path = RAPID_DIR / "archive"
rapid_agent_event_retention_rows: int = 50_000
rapid_agent_event_retention_days: int = 30
rapid_agent_ring_buffer_size: int = 1000
rapid_agent_default_max_turns: int = 40
```

Do not change any other field. Do not modify `settings = Settings()` or `get_settings`. Later waves read these via `from app.config import settings`.

### Task 5 — `AgentRun` and `AgentEvent` SQLModel tables

**File to create:** `app/models/agent_run.py`

**Requirements:**
- Import:

  ```python
  from datetime import datetime
  from typing import Literal
  from uuid import UUID, uuid4

  from sqlalchemy import Index, text
  from sqlmodel import Field, SQLModel

  from app.database import _utcnow
  ```

- `class AgentRun(SQLModel, table=True):` with these columns exactly:

  | field | type | notes |
  |---|---|---|
  | `id` | `UUID = Field(default_factory=uuid4, primary_key=True)` | |
  | `project_id` | `UUID = Field(foreign_key="project.id", index=True)` | |
  | `set_id` | `str | None = Field(default=None, index=True)` | nullable for ad-hoc runs |
  | `skill_name` | `str` | |
  | `skill_args` | `str = Field(default="{}")` | JSON-as-str, matches project convention |
  | `status` | `str = Field(default="pending", index=True)` | values: pending/running/waiting/interrupted/failed/completed |
  | `pid` | `int | None = Field(default=None)` | |
  | `started_at` | `datetime = Field(default_factory=_utcnow)` | |
  | `ended_at` | `datetime | None = None` | |
  | `active_duration_s` | `float = Field(default=0.0)` | |
  | `total_wall_clock_s` | `float = Field(default=0.0)` | |
  | `total_cost_usd` | `float = Field(default=0.0)` | |
  | `max_turns` | `int = Field(default=40)` | |
  | `turn_count` | `int = Field(default=0)` | |
  | `error_code` | `str | None = None` | |
  | `error_detail` | `str = Field(default="{}")` | JSON-as-str |
  | `last_seq` | `int = Field(default=0)` | last emitted EventBus seq |

- Declare the partial unique index as `__table_args__`:

  ```python
  __table_args__ = (
      Index(
          "uq_agent_run_active_set",
          "project_id",
          "set_id",
          unique=True,
          sqlite_where=text("status IN ('running','waiting')"),
      ),
  )
  ```

  This is the mutex backstop. The handler-level Python lock is the fast path; the DB index is correctness.

**File to create:** `app/models/agent_event.py`

**Requirements:**
- Imports similar to above.
- `class AgentEvent(SQLModel, table=True):`:

  | field | type |
  |---|---|
  | `id` | `int | None = Field(default=None, primary_key=True)` |
  | `run_id` | `UUID = Field(foreign_key="agentrun.id", index=True)` |
  | `seq` | `int = Field(index=True)` |
  | `ts` | `datetime = Field(default_factory=_utcnow)` |
  | `kind` | `str = Field(index=True)` |
  | `payload` | `str = Field(default="{}")` |

- `__table_args__ = (Index("uq_agent_event_run_seq", "run_id", "seq", unique=True),)`

**File to edit:** `app/models/__init__.py`

Append (or create if empty) re-exports so `from app.models import AgentRun, AgentEvent` works and so Alembic autogen sees the tables registered on `SQLModel.metadata` at import time:

```python
from app.models.agent_run import AgentRun  # noqa: F401
from app.models.agent_event import AgentEvent  # noqa: F401
```

**File to edit:** `app/database.py` (MINIMAL edit — add a single import line at the bottom of the models section)

Immediately after the `class AppConfig` block, add:

```python
# Register agent-runtime tables so SQLModel.metadata contains them.
# Triggered by importing the module — do NOT move to top of file
# (avoids circular import with app.agents.correlation → app.config → app.database).
from app.models.agent_run import AgentRun  # noqa: E402, F401
from app.models.agent_event import AgentEvent  # noqa: E402, F401
```

No other changes to `app/database.py`. No other wave modifies it.

### Task 6 — Alembic migration 0004_agent_runtime.py (HAND-WRITTEN)

**File to create:** `alembic/versions/0004_agent_runtime.py`

**Requirements:**
- `revision = "0004"`, `down_revision = "0003"`, branch_labels and depends_on `= None`.
- Do NOT autogenerate. The partial unique index requires hand-written SQL and SQLModel autogen does not round-trip it cleanly.
- `upgrade()` creates table `agentrun` with all columns from Task 5, a regular index on `project_id`, a regular index on `set_id`, a regular index on `status`, and the partial unique index:

  ```python
  op.create_index(
      "uq_agent_run_active_set",
      "agentrun",
      ["project_id", "set_id"],
      unique=True,
      sqlite_where=sa.text("status IN ('running','waiting')"),
  )
  ```

- `upgrade()` creates table `agentevent` with all columns from Task 5, a regular index on `run_id`, a regular index on `kind`, and the unique `(run_id, seq)` index named `uq_agent_event_run_seq`.
- FKs:
  - `agentrun.project_id → project.id` named via `op.f("fk_agentrun_project_id_project")`.
  - `agentevent.run_id → agentrun.id` named via `op.f("fk_agentevent_run_id_agentrun")`.
- Column types: `sa.Uuid()` for UUID columns, `sa.String()` for `skill_name/skill_args/status/error_code/error_detail/kind/payload/set_id`, `sa.Integer()` for integer columns, `sa.Float()` for float columns, `sa.DateTime()` for datetime columns.
- `downgrade()` drops indexes then tables in reverse order (`agentevent` then `agentrun`).
- Follow the style of `alembic/versions/0003_kanban_column_card.py` exactly (use `op.f("pk_...")`, `op.f("fk_...")`, `op.f("ix_...")` for auto-named constraints).

### Task 7 — Pydantic SSE event discriminated union

**File to create:** `app/schemas/sse_events.py`

**Requirements:**
- `from __future__ import annotations`
- Use Pydantic v2 idioms (`BaseModel`, `Field`, `ConfigDict`, `Discriminator`, `Tag`).
- Base:

  ```python
  class _BaseEvent(BaseModel):
      model_config = ConfigDict(extra="allow")  # forward-compat: additive-only schema
      seq: int
      ts: datetime
      run_id: UUID
  ```

- Exactly these event classes (each with a `kind: Literal["..."]` discriminator):

  | class | kind |
  |---|---|
  | `AssistantTextEvent` | `assistant_text` — payload: `text: str` |
  | `ThinkingEvent` | `thinking` — payload: `text: str` |
  | `ToolUseEvent` | `tool_use` — payload: `tool_name: str`, `tool_use_id: str`, `input: dict` |
  | `ToolResultEvent` | `tool_result` — payload: `tool_use_id: str`, `output: dict | str | None`, `is_error: bool = False` |
  | `AskUserEvent` | `ask_user` — payload: `tool_use_id: str`, `question: str`, `options: list[str] | None = None`, `allow_free_text: bool = True` |
  | `PermissionReqEvent` | `permission_req` — payload: `tool_name: str`, `tool_use_id: str`, `reason: str`, `blocked: bool` |
  | `StatusEvent` | `status` — payload: `status: Literal['pending','running','waiting','interrupted','failed','completed']`, `detail: str | None = None` |
  | `RunCompleteEvent` | `run_complete` — payload: `status: Literal['completed','failed','interrupted']`, `total_cost_usd: float`, `turn_count: int`, `duration_s: float`, `error_code: str | None = None`, `error_detail: dict | None = None` |
  | `ReplayTruncatedEvent` | `replay_truncated` — payload: `oldest_available_seq: int`, `requested_since_seq: int`, `reason: Literal['retention_cap','archived']` |
  | `RetentionWarningEvent` | `retention_warning` — payload: `event_count: int`, `cap: int` |

- Export:

  ```python
  SseEvent = Annotated[
      Union[
          AssistantTextEvent, ThinkingEvent, ToolUseEvent, ToolResultEvent,
          AskUserEvent, PermissionReqEvent, StatusEvent, RunCompleteEvent,
          ReplayTruncatedEvent, RetentionWarningEvent,
      ],
      Field(discriminator="kind"),
  ]
  ```

- Provide a helper `def serialize_event(evt: SseEvent) -> dict: return evt.model_dump(mode="json")`.
- Provide `EVENT_KINDS: frozenset[str]` with all ten string literals for cheap validation in the EventBus without importing the full model machinery.
- DO NOT add a version field. SSE evolution is additive-only per CONTEXT.

### Task 8 — Permission policy and destructive patterns (data-only)

**File to create:** `app/agents/permissions.py`

**Requirements:**

- `DESTRUCTIVE_PATTERNS: list[re.Pattern]` — compile exactly these patterns at module import (use `re.compile(..., re.IGNORECASE)`):

  | pattern source | intent |
  |---|---|
  | `r"\brm\s+-rf\s+/"` | `rm -rf /` and friends |
  | `r"\bgit\s+push\s+.*--force\b"` | `git push --force` / `-f` short form covered below |
  | `r"\bgit\s+push\s+.*(?:-f|--force-with-lease)\b"` | force variants |
  | `r"\bgit\s+branch\s+-D\b"` | force-delete branch |
  | `r"\bgit\s+reset\s+--hard\s+origin\b"` | hard reset to remote |
  | `r"\bgit\s+clean\s+-[fdx]{1,3}\b"` | dangerous clean |
  | `r"\benv\b(?!\s*\|\s*grep)"` | `env` (prints creds) — allow `env | grep` trace |
  | `r"\bcat\s+.*\.env\b"` | credential file reads |
  | `r"\bprintenv\b"` | |
  | `r"\bdd\s+if=.*of=/dev/"` | raw disk writes |
  | `r"\b:\s*\(\)\s*{\s*:\s*\|\s*:\s*&\s*}\s*;"` | fork bomb |

- `def is_destructive(command: str) -> tuple[bool, str | None]` — returns `(True, pattern_source)` on first match, else `(False, None)`. Pure function, no I/O, no SDK imports.
- `PERMISSION_POLICY: dict[str, dict]` — one entry per RAPID skill. Shape:

  ```python
  {
      "permission_mode": Literal["default", "acceptEdits"],
      "allowed_tools": list[str],       # empty = allow all not explicitly disallowed
      "disallowed_tools": list[str],
      "max_turns": int,
  }
  ```

- Entries (fill exactly — executor: do not substitute values):

  | skill | permission_mode | allowed_tools | disallowed_tools | max_turns |
  |---|---|---|---|---|
  | `plan-set` | `acceptEdits` | `[]` | `["WebSearch"]` | 80 |
  | `execute-set` | `acceptEdits` | `[]` | `[]` | 200 |
  | `discuss-set` | `default` | `[]` | `[]` | 40 |
  | `review` | `default` | `[]` | `[]` | 60 |
  | `merge` | `default` | `[]` | `[]` | 80 |
  | `cleanup` | `default` | `[]` | `[]` | 20 |
  | `init` | `default` | `[]` | `[]` | 80 |
  | `start-set` | `default` | `[]` | `[]` | 20 |
  | `unit-test` | `acceptEdits` | `[]` | `[]` | 60 |
  | `bug-hunt` | `default` | `[]` | `[]` | 60 |
  | `uat` | `default` | `[]` | `[]` | 40 |
  | `status` | `default` | `[]` | `[]` | 10 |
  | `audit-version` | `default` | `[]` | `[]` | 60 |
  | `quick` | `acceptEdits` | `[]` | `[]` | 60 |
  | `bug-fix` | `acceptEdits` | `[]` | `[]` | 60 |

  Also add a `"_default"` key matching `{"permission_mode": "default", "allowed_tools": [], "disallowed_tools": [], "max_turns": settings.rapid_agent_default_max_turns}`. Resolver used in Wave 2 will fall back to `_default` for unknown skill names.

- **Explicit negative invariant (enforced by Wave 2 test):** no entry's `permission_mode` may equal `"bypassPermissions"`. Do not import any string that contains `bypassPermissions` anywhere in this file.

- `def resolve_policy(skill_name: str) -> dict` — returns `PERMISSION_POLICY.get(skill_name, PERMISSION_POLICY["_default"])`.

### Task 9 — Wave 1 tests

Tests live in `web/backend/tests/agents/` (create the dir + `__init__.py`).

**File to create:** `tests/agents/__init__.py` (empty)

**File to create:** `tests/agents/test_errors.py`
- `test_error_taxonomy_classes_exist()` — import each class, assert it subclasses `AgentBaseError`.
- `test_error_http_status_mapping()` — assert `SdkError().http_status == 502`, `StateError().http_status == 409`, `ToolError().http_status == 422`, `UserError().http_status == 400`, `RunError().http_status == 500`.
- `test_error_code_unique_mapping()` — assert `{e.error_code for e in (SdkError(""), RunError(""), StateError(""), ToolError(""), UserError(""))}` has length 5.
- `test_retryable_only_sdk_error()` — assert `"sdk_error" in RETRYABLE_ERROR_CODES` and length is 1.

**File to create:** `tests/agents/test_correlation.py`
- `test_run_id_var_default_none()` — fresh process: `get_run_id()` is `None`.
- `test_bind_run_id_restores()` — enter `bind_run_id("abc")`, assert inside → `"abc"`; after exit → `None`.
- `test_log_filter_attaches_run_id(caplog)` — install `RunIdLogFilter` on `caplog.handler`, bind run_id, emit a log record, assert the record has attribute `run_id == "test-run"` and outside the bind block it equals `"-"`.
- `test_safe_env_keys_blocks_credentials()` — assert `"ANTHROPIC_API_KEY" not in SAFE_ENV_KEYS` and `"GITHUB_TOKEN" not in SAFE_ENV_KEYS` and `"PATH" in SAFE_ENV_KEYS`.

**File to create:** `tests/agents/test_sse_schemas.py`
- `test_all_event_kinds_present()` — assert `EVENT_KINDS == {"assistant_text","thinking","tool_use","tool_result","ask_user","permission_req","status","run_complete","replay_truncated","retention_warning"}`.
- `test_discriminator_roundtrip()` — construct one of each event, `serialize_event` then `TypeAdapter(SseEvent).validate_python(dumped)` returns the same class.
- `test_extra_fields_allowed()` — construct a `StatusEvent` payload with an unknown key; assert it validates (forward-compat).
- `test_no_version_field_on_base()` — assert `"version" not in _BaseEvent.model_fields` (enforces "no version field" policy).

**File to create:** `tests/agents/test_permissions_policy.py`
- `test_permission_policy_has_all_rapid_skills()` — assert every skill name in the table above is present.
- `test_no_bypass_permissions_in_policy()` — assert `"bypassPermissions" not in {entry["permission_mode"] for entry in PERMISSION_POLICY.values()}`.
- `test_permission_modes_are_restricted_set()` — assert `{entry["permission_mode"] for entry in PERMISSION_POLICY.values()} <= {"default", "acceptEdits"}`.
- `test_destructive_patterns_block_rm_rf_root()` — assert `is_destructive("rm -rf /")[0] is True`.
- `test_destructive_patterns_block_force_push()` — assert `is_destructive("git push origin main --force")[0] is True` and `is_destructive("git push -f origin main")[0] is True`.
- `test_destructive_patterns_block_env_cat()` — assert `is_destructive("cat .env.local")[0] is True` and `is_destructive("printenv | grep KEY")[0] is True`.
- `test_destructive_patterns_allow_safe_bash()` — assert `is_destructive("ls -la")[0] is False`, `is_destructive("git status")[0] is False`, `is_destructive("pytest tests/")[0] is False`, `is_destructive("env | grep PATH")[0] is False` (the `env | grep` exception must actually work).
- `test_resolve_policy_falls_back_to_default()` — `resolve_policy("nonexistent-skill") is PERMISSION_POLICY["_default"]`.

**File to create:** `tests/agents/test_models_schema.py`
- `test_agent_run_table_registered(tables)` — use the existing `tables` fixture (creates all SQLModel tables in SQLite). Import `AgentRun`, insert a row with `project_id=<UUID from Project fixture>`, `skill_name="plan-set"`. Query back, assert `status == "pending"`, `turn_count == 0`.
- `test_agent_run_partial_unique_index_enforced(session)` — insert a `Project`, insert two `AgentRun` rows with same `(project_id, set_id="wave-1")` and `status="running"`. Second insert must raise `sqlalchemy.exc.IntegrityError`. A row with `status="completed"` after a `status="running"` row with the same `(project_id, set_id)` must SUCCEED (because of partial index).
- `test_agent_event_unique_seq(session)` — insert two `AgentEvent` rows with same `(run_id, seq)`. Second raises `IntegrityError`.
- `test_agent_event_fk_cascade_guard(session)` — insert `AgentEvent` with `run_id` pointing to non-existent run; raises `IntegrityError` (because `foreign_keys=ON`).

**File to create:** `tests/agents/test_migration_0004.py`
- Follow style of `tests/test_migrations.py`.
- `test_upgrade_downgrade_upgrade_roundtrip(tmp_path)` — create engine against tmp db, run `alembic upgrade head`, assert `agentrun` and `agentevent` tables exist and the `uq_agent_run_active_set` index exists via `PRAGMA index_info`. Run `alembic downgrade -1`, assert tables removed. Run `alembic upgrade head` again, assert re-created.
- `test_partial_index_sql_shape(engine_at_head)` — query `sqlite_master` WHERE `type='index' AND name='uq_agent_run_active_set'`, assert the DDL contains `"status" IN ('running','waiting')` (case-insensitive).

### Task 10 — CONTRACT.json freeze + Wave 1 SUMMARY

**File to edit:** None (CONTRACT.json is already authored; Wave 1 must not modify it).

**File to create:** `.planning/sets/agent-runtime-foundation/WAVE-1-COMPLETE.md` (ABSOLUTE path: `/home/kek/Projects/RAPID/.planning/sets/agent-runtime-foundation/WAVE-1-COMPLETE.md`)

- Record: list of files created, count of tests added, Alembic revision number, migration roundtrip verified.

## What NOT to do

- Do NOT import `claude_agent_sdk` anywhere in Wave 1. This wave has zero SDK dependency.
- Do NOT edit `app/main.py` in Wave 1. The lifespan wiring belongs to Wave 4.
- Do NOT edit `web/backend/pyproject.toml` in Wave 1. Deps are added in Wave 4.
- Do NOT autogenerate the Alembic migration. Hand-write every line. `render_as_batch=True` is already set in `env.py`; you do not need to change it.
- Do NOT add a `version` field to any SSE event class.
- Do NOT implement `build_sdk_options`, `can_use_tool`, `EventBus`, `RunBudget`, `AgentSession`, or `AgentSessionManager` — those belong to Waves 2 and 3.
- Do NOT add fields to `AgentRun` or `AgentEvent` beyond what is listed. Downstream waves assume this exact shape.

## Verification

Run from `web/backend/`:

```bash
# 1. Tests pass
uv run pytest tests/agents/ -v

# 2. Migration round-trips cleanly against a temp DB
uv run python -c "
import os, tempfile, pathlib
from alembic.config import Config
from alembic import command
tmp = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
os.environ['RAPID_WEB_DB_PATH'] = tmp.name
cfg = Config('alembic.ini')
command.upgrade(cfg, 'head')
command.downgrade(cfg, '-1')
command.upgrade(cfg, 'head')
print('roundtrip OK')
"

# 3. Source-grep invariants (must print nothing)
! grep -RIn "bypassPermissions" app/agents/ app/schemas/sse_events.py app/models/agent_run.py app/models/agent_event.py
! grep -RIn "claude_agent_sdk" app/agents/ app/schemas/sse_events.py app/models/agent_run.py app/models/agent_event.py app/logging_config.py app/config.py

# 4. No accidental top-level SDK import
uv run python -c "import app.agents.errors, app.agents.correlation, app.agents.permissions, app.schemas.sse_events, app.models.agent_run, app.models.agent_event; print('imports OK')"

# 5. Version field negative invariant
uv run python -c "from app.schemas.sse_events import _BaseEvent; assert 'version' not in _BaseEvent.model_fields, 'version field leaked'; print('ok')"

# 6. Logger filter actually attaches run_id
uv run python -c "
import logging
from app.logging_config import setup_logging
from app.agents.correlation import bind_run_id
from app.config import settings
setup_logging(settings.rapid_web_log_dir, 'INFO')
with bind_run_id('abc-123'):
    logging.getLogger('rapid.smoke').info('hello')
print('ok')
" 2>&1 | grep -q 'run=abc-123' && echo 'run_id in stderr: OK'

# 7. Alembic revision chain intact
uv run alembic history | grep -E '0003 -> 0004' && echo 'revision chain OK'
```

## Success Criteria

- [ ] `uv run pytest tests/agents/ -v` passes with at least 20 tests.
- [ ] `alembic upgrade head && alembic downgrade -1 && alembic upgrade head` succeeds.
- [ ] `SQLModel.metadata.tables` contains `agentrun` and `agentevent`.
- [ ] Partial unique index `uq_agent_run_active_set` exists and its DDL contains `status IN ('running','waiting')`.
- [ ] `from app.schemas.sse_events import SseEvent, EVENT_KINDS, serialize_event` works with no SDK imports.
- [ ] `grep -RIn "bypassPermissions" app/agents/` returns nothing.
- [ ] `grep -RIn "claude_agent_sdk" app/` returns nothing (SDK integration is Waves 2-4).
- [ ] `from app.agents.errors import SdkError, RunError, StateError, ToolError, UserError, RETRYABLE_ERROR_CODES` succeeds.
- [ ] A bound `run_id` appears on both JSON-file and stderr log records.
- [ ] Wave 1 artifacts committed as a single commit `feat(agent-runtime-foundation): wave 1 foundation — models, schemas, migration, correlation` from the set's worktree.
- [ ] `.planning/sets/agent-runtime-foundation/WAVE-1-COMPLETE.md` exists.

## Files Owned Exclusively by Wave 1

- `app/agents/__init__.py`
- `app/agents/errors.py`
- `app/agents/correlation.py`
- `app/agents/permissions.py` (data-only — logic added in Wave 2 is a separate file `app/agents/permission_hooks.py`)
- `app/models/agent_run.py`
- `app/models/agent_event.py`
- `app/models/__init__.py` (edit: add two re-export lines)
- `app/database.py` (edit: bottom two-line re-import of the two models)
- `app/schemas/sse_events.py`
- `app/logging_config.py` (edit: install filter)
- `app/config.py` (edit: add knobs)
- `alembic/versions/0004_agent_runtime.py`
- `tests/agents/__init__.py`
- `tests/agents/test_errors.py`
- `tests/agents/test_correlation.py`
- `tests/agents/test_sse_schemas.py`
- `tests/agents/test_permissions_policy.py`
- `tests/agents/test_models_schema.py`
- `tests/agents/test_migration_0004.py`

No other wave may modify any of the above files.
