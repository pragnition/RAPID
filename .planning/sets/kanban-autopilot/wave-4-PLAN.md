<!-- gap-closure: true -->
# PLAN: kanban-autopilot / Wave 4 — SKILL.md + Commit-Trailer Traceability

## Objective

Close the two remaining gaps from GAPS.md:
1. **Gap 1 (Low):** Create `skills/autopilot/SKILL.md` as a documentation entry-point for the autopilot capability, following the existing SKILL.md frontmatter pattern.
2. **Gap 2 (Medium):** Implement commit-trailer injection so every `git commit` produced during an autopilot run automatically appends `Autopilot-Card-Id: <card_id>` and `Autopilot-Run-Id: <run_id>` trailers. This uses a `card_id_var` ContextVar bound during autopilot-dispatched sessions and a PreToolUse hook that detects Bash git-commit commands.

## Prerequisites

Waves 1-3 complete. The autopilot worker, card routing, session manager, correlation module, permission hooks, and sdk_options builder all exist and are functional.

## File Ownership

| File | Action |
|------|--------|
| `skills/autopilot/SKILL.md` | Create |
| `web/backend/app/agents/correlation.py` | Modify |
| `web/backend/app/agents/session_manager.py` | Modify |
| `web/backend/app/agents/permission_hooks.py` | Modify |
| `web/backend/app/agents/sdk_options.py` | Modify |
| `web/backend/tests/agents/test_correlation.py` | Modify |
| `web/backend/tests/agents/test_commit_trailers.py` | Create |

## Tasks

### Task 1: Create skills/autopilot/SKILL.md

**File:** `skills/autopilot/SKILL.md`

Create the directory `skills/autopilot/` and write a SKILL.md following the existing frontmatter pattern (reference `skills/execute-set/SKILL.md` or `skills/quick/SKILL.md` for format).

The SKILL.md should document that autopilot is a backend-managed poller, not a CLI-invoked skill. Required frontmatter fields:

```yaml
---
description: Backend-managed autopilot poller that claims kanban cards from autopilot-enabled columns and dispatches agent runs
allowed-tools: []
args: []
categories: [autonomous]
---
```

Body should briefly explain:
- The autopilot runs as a lifespan-managed background worker inside the RAPID web backend (`app/agents/autopilot_worker.py`)
- It polls autopilot-enabled columns for unclaimed cards, routes them to skills via `card_routing.py`, and dispatches runs via `AgentSessionManager.start_run()`
- It is NOT invoked via `/rapid:autopilot` in the CLI -- it runs automatically when the web backend is running
- Per-card retry limit: 3 attempts before moving to Blocked column
- Commit trailers (`Autopilot-Card-Id:`, `Autopilot-Run-Id:`) are automatically injected by the runtime on every git commit during autopilot-dispatched runs

**Verification:**
```bash
test -f skills/autopilot/SKILL.md && head -5 skills/autopilot/SKILL.md | grep -q "description:"
```

---

### Task 2: Add card_id_var ContextVar to correlation.py

**File:** `web/backend/app/agents/correlation.py`

Add a new ContextVar alongside the existing `run_id_var`:

```python
card_id_var: ContextVar[str | None] = ContextVar("rapid_card_id", default=None)
```

Add a getter function:

```python
def get_card_id() -> str | None:
    return card_id_var.get()
```

Add a context manager:

```python
@contextmanager
def bind_card_id(card_id: str) -> Iterator[None]:
    token = card_id_var.set(card_id)
    try:
        yield
    finally:
        card_id_var.reset(token)
```

Keep the existing `run_id_var`, `get_run_id`, `bind_run_id`, `RunIdLogFilter`, and `SAFE_ENV_KEYS` unchanged. The new exports are additive.

**Verification:**
```bash
cd web/backend && python -c "from app.agents.correlation import card_id_var, get_card_id, bind_card_id; print('OK')"
```

---

### Task 3: Bind card_id in session_manager._run_session for autopilot runs

**File:** `web/backend/app/agents/session_manager.py`

In `_run_session()`, after the existing `with bind_run_id(str(row.id)):` line (currently at line 244), add a nested `bind_card_id` context manager that activates only when the skill is autopilot-dispatched.

The card_id comes from `skill_args` (set by `card_routing.route_card_to_skill`), which stores `card_id` as a string key. Extract it with:

```python
card_id = json.loads(row.skill_args).get("card_id")
```

If `card_id` is not None, nest `bind_card_id(card_id)` inside the existing `bind_run_id`. If None (non-autopilot runs), skip the binding.

Import `bind_card_id` from `app.agents.correlation` alongside the existing `bind_run_id` import (line 34).

The modified section of `_run_session` should look like:

```python
with bind_run_id(str(row.id)):
    # Autopilot runs carry a card_id in skill_args for trailer injection.
    _card_id = json.loads(row.skill_args).get("card_id")
    _card_ctx = bind_card_id(_card_id) if _card_id else nullcontext()
    with _card_ctx:
        async with AgentSession(...) as session:
            ...
```

Import `nullcontext` from `contextlib` (add to existing contextlib imports or add new import).

Do NOT change any other part of `_run_session`. The `bind_card_id` context manager simply sets the ContextVar for the duration of the session run, making it available to hooks.

**Verification:**
```bash
cd web/backend && python -c "
from app.agents.session_manager import AgentSessionManager
import inspect
src = inspect.getsource(AgentSessionManager._run_session)
assert 'bind_card_id' in src, 'bind_card_id not found in _run_session'
assert 'card_id' in src, 'card_id not found in _run_session'
print('OK')
"
```

---

### Task 4: Implement commit-trailer PreToolUse hook

**File:** `web/backend/app/agents/permission_hooks.py`

Add a new async function `inject_commit_trailers` that serves as a PreToolUse hook for Bash tool use. This hook detects git commit commands and appends `--trailer` flags.

```python
async def inject_commit_trailers(
    input_data: dict,
    tool_use_id: str | None,
    context: HookContext,
) -> dict:
    """PreToolUse hook: inject Autopilot-Card-Id and Autopilot-Run-Id trailers
    into git commit commands when running inside an autopilot session."""
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    if tool_name != "Bash":
        return {}

    cmd = str(tool_input.get("command", ""))

    # Only inject on simple git commit commands (not piped, not multi-command).
    # Match: git commit, git commit -m, git commit --amend, etc.
    # Skip: commands with pipes, semicolons, &&, || that make parsing unsafe.
    if not _is_simple_git_commit(cmd):
        return {}

    card_id = get_card_id()
    run_id = get_run_id()
    if card_id is None and run_id is None:
        return {}

    trailers = []
    if card_id is not None:
        trailers.append(f'--trailer "Autopilot-Card-Id: {card_id}"')
    if run_id is not None:
        trailers.append(f'--trailer "Autopilot-Run-Id: {run_id}"')

    updated_cmd = cmd.rstrip() + " " + " ".join(trailers)
    updated_input = dict(input_data)
    updated_input["tool_input"] = {**tool_input, "command": updated_cmd}
    return {"updatedInput": updated_input}
```

Add the helper function `_is_simple_git_commit`:

```python
import re

_GIT_COMMIT_RE = re.compile(
    r"^\s*git\s+commit\b",
    re.MULTILINE,
)

def _is_simple_git_commit(cmd: str) -> bool:
    """Return True if cmd is a simple git commit (no pipes, no chaining)."""
    # Reject multi-command strings
    if any(sep in cmd for sep in ("|", "&&", "||", ";")):
        return False
    return bool(_GIT_COMMIT_RE.search(cmd))
```

Import `get_card_id` from `app.agents.correlation` alongside the existing `get_run_id` import (line 32). Add the `re` import at the top of the file.

Do NOT modify the existing `can_use_tool_hook`, `can_use_tool_hook_bound`, or `destructive_pre_tool_hook` functions.

**Verification:**
```bash
cd web/backend && python -c "
from app.agents.permission_hooks import inject_commit_trailers, _is_simple_git_commit
assert _is_simple_git_commit('git commit -m \"test\"')
assert not _is_simple_git_commit('echo x && git commit -m y')
assert not _is_simple_git_commit('git log | head')
print('OK')
"
```

---

### Task 5: Register the commit-trailer hook in sdk_options.py

**File:** `web/backend/app/agents/sdk_options.py`

Add the `inject_commit_trailers` hook to the `hooks` dict in `build_sdk_options()`.

Currently (line 64-66):
```python
hooks={
    "PreToolUse": [HookMatcher(matcher="Bash", hooks=[destructive_pre_tool_hook])],
},
```

Change to:
```python
hooks={
    "PreToolUse": [
        HookMatcher(matcher="Bash", hooks=[destructive_pre_tool_hook, inject_commit_trailers]),
    ],
},
```

Import `inject_commit_trailers` from `app.agents.permission_hooks` alongside the existing imports from that module (line 19):

```python
from app.agents.permission_hooks import can_use_tool_hook, destructive_pre_tool_hook, inject_commit_trailers
```

The hook ordering matters: `destructive_pre_tool_hook` runs first (may deny the command), then `inject_commit_trailers` runs second (modifies the command only if allowed). The SDK processes hooks in list order.

**Verification:**
```bash
cd web/backend && python -c "
import inspect
from app.agents.sdk_options import build_sdk_options
src = inspect.getsource(build_sdk_options)
assert 'inject_commit_trailers' in src, 'hook not registered'
print('OK')
"
```

---

### Task 6: Write tests for correlation card_id additions

**File:** `web/backend/tests/agents/test_correlation.py`

Add tests alongside the existing ones:

1. `test_card_id_var_default_none` -- `get_card_id()` returns `None` by default
2. `test_bind_card_id_restores` -- value is set inside context, restored to None after
3. `test_bind_card_id_nested_with_run_id` -- both `bind_run_id` and `bind_card_id` can be nested; each ContextVar is independent

Import the new symbols: `card_id_var`, `get_card_id`, `bind_card_id`.

**Verification:**
```bash
cd web/backend && uv run python -m pytest tests/agents/test_correlation.py -v --tb=short
```

---

### Task 7: Write tests for commit-trailer injection

**File:** `web/backend/tests/agents/test_commit_trailers.py` (create)

Test the `inject_commit_trailers` hook and `_is_simple_git_commit` helper:

1. `test_is_simple_git_commit_positive` -- matches `git commit -m "msg"`, `git commit --amend`, `git commit`
2. `test_is_simple_git_commit_negative` -- rejects piped commands (`git log | head`), chained commands (`echo x && git commit`), semicolon-separated (`ls; git commit`)
3. `test_inject_trailers_no_context` -- when no card_id or run_id is set, returns empty dict (no modification)
4. `test_inject_trailers_with_card_id` -- set card_id_var via `bind_card_id`, call the hook with a git commit command, verify the returned `updatedInput` contains the `--trailer` flag with the card_id
5. `test_inject_trailers_with_both` -- set both card_id and run_id, verify both trailers are appended
6. `test_inject_trailers_non_bash_tool` -- tool_name is not "Bash", returns empty dict
7. `test_inject_trailers_non_commit_command` -- Bash command is `git push`, returns empty dict (no trailers)

Use `asyncio` to call the async `inject_commit_trailers` function. Create mock `HookContext` objects (or use `unittest.mock.MagicMock`).

**Verification:**
```bash
cd web/backend && uv run python -m pytest tests/agents/test_commit_trailers.py -v --tb=short
```

---

## Success Criteria

1. `skills/autopilot/SKILL.md` exists with valid YAML frontmatter and `categories: [autonomous]`
2. `correlation.py` exports `card_id_var`, `get_card_id`, `bind_card_id` alongside existing run_id symbols
3. `session_manager._run_session()` binds `card_id` from `skill_args` during autopilot runs
4. `permission_hooks.inject_commit_trailers` correctly appends `--trailer` flags to simple git commit commands when card_id/run_id ContextVars are set
5. `sdk_options.build_sdk_options()` registers `inject_commit_trailers` in the PreToolUse hook list
6. All correlation tests pass: `uv run python -m pytest tests/agents/test_correlation.py -v`
7. All commit-trailer tests pass: `uv run python -m pytest tests/agents/test_commit_trailers.py -v`
8. Existing tests remain green: `uv run python -m pytest tests/ -x --tb=short` (no regressions)

## What NOT To Do

- Do NOT modify `autopilot_worker.py` -- the card_id already flows through `skill_args` via `card_routing.route_card_to_skill`; no changes needed there
- Do NOT modify `can_use_tool_hook` or `destructive_pre_tool_hook` -- these existing hooks are unchanged
- Do NOT inject trailers into multi-command or piped bash strings -- only simple `git commit` invocations
- Do NOT add trailers to non-autopilot runs -- the hook is a no-op when card_id_var is None
- Do NOT create the skill directory at `skills/rapid:autopilot/` -- use `skills/autopilot/` (colons are problematic in filesystem paths)
