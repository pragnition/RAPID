<!-- gap-closure: true -->
# Wave 5 PLAN: Gap Closure — CORS Config from Environment

**Set:** agent-runtime-foundation
**Wave:** 5 of 5 — Gap Closure (Criterion 13)
**Working root:** `web/backend/`
**Mode:** Gap-closure. Waves 1-4 are merged; this wave closes one narrow unresolved gap from `GAPS.md`.

## Objective

Close **Criterion 13 — CORS config from env — FAIL** from `.planning/sets/agent-runtime-foundation/GAPS.md`. Make the FastAPI CORS `allow_origins` list configurable from the environment instead of hardcoded in `app/main.py`.

The current state (`web/backend/app/main.py:143-149`) hardcodes `allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"]`, which works for local Vite dev but violates the ROADMAP success criterion that CORS must be env-configurable. No CORS field currently exists on `Settings`.

This is intentionally a small, surgical fix (3 files, ~15 LOC). Do NOT expand scope.

## Scope & File Ownership

Wave 5 owns exclusively:

| File | Action |
|------|--------|
| `web/backend/app/config.py` | Edit — add one field to `Settings` |
| `web/backend/app/main.py` | Edit — replace hardcoded list with `settings.rapid_web_cors_allow_origins` |
| `web/backend/tests/agents/test_cors_config.py` | Create — two tests covering env parsing and middleware wiring |

No other files are touched. Waves 1-4 are merged and their files are not modified here.

## Naming Decision (override GAPS.md)

`GAPS.md` suggests `rapid_cors_allow_origins`. **Use `rapid_web_cors_allow_origins` instead.** Rationale:

- Existing web-tier settings in `Settings` all use the `rapid_web_*` prefix (`rapid_web_port`, `rapid_web_host`, `rapid_web_db_path`, `rapid_web_log_dir`, `rapid_web_log_level`, `rapid_web_projects_file`, `rapid_web_sync_interval`).
- Agent-runtime settings use the `rapid_agent_*` prefix.
- CORS is a web-tier concern, so `rapid_web_cors_allow_origins` preserves convention and groups cleanly in the web block.
- Corresponding env var: `RAPID_WEB_CORS_ALLOW_ORIGINS`.

## Tasks

### Task 1 — Add `rapid_web_cors_allow_origins` field to `Settings`

**File:** `web/backend/app/config.py`

**Change:** Add the field to the web-tier block (immediately BEFORE the `# --- agent runtime ---` comment, keeping the web-tier fields contiguous). The default MUST match the current hardcoded value exactly so behaviour is unchanged when no env var is set.

Insert after the existing `rapid_web_sync_interval: float = 5.0` line (currently line 18), before the blank line separating the agent-runtime block:

```python
    # CORS allow-origins for the web tier. Parsed as JSON when set via env:
    # RAPID_WEB_CORS_ALLOW_ORIGINS='["https://app.example.com","https://admin.example.com"]'
    # Note: combining allow_credentials=True with ["*"] is silently downgraded by Starlette;
    # always enumerate explicit origins when credentials are enabled.
    rapid_web_cors_allow_origins: list[str] = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ]
```

**Constraints:**
- Use `default=` style (no `default_factory=`) to match the rest of the class.
- Do NOT add `env_prefix` to `SettingsConfigDict` — the field name already carries the `rapid_web_` prefix, matching how every other field is named.
- Do NOT change `SettingsConfigDict` options.
- Do NOT add an `env=` alias; pydantic-settings derives the env var from the field name with `case_sensitive=False`.

### Task 2 — Wire the setting into CORS middleware

**File:** `web/backend/app/main.py`

**Change:** Replace the hardcoded `allow_origins=[...]` literal at lines 144-145 with `settings.rapid_web_cors_allow_origins`. `settings` is already imported at line 26 (verify before editing).

Resulting block (lines 142-149):

```python
    # CORS — origins configurable via RAPID_WEB_CORS_ALLOW_ORIGINS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.rapid_web_cors_allow_origins,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=True,
    )
```

**Constraints:**
- Do NOT move the middleware registration.
- Do NOT change `allow_methods`, `allow_headers`, or `allow_credentials`.
- Do NOT introduce a module-level alias for the origins list — read from `settings` at `create_app()` build time so `monkeypatch.setattr(app_config.settings, ...)` in tests works.

### Task 3 — Add `tests/agents/test_cors_config.py`

**File to create:** `web/backend/tests/agents/test_cors_config.py`

The test file contains **exactly two tests**. Follow the patterns from `tests/test_config.py:49-62` (env-parse pattern) and `tests/agents/test_main_lifespan.py:11-39` / `tests/agents/test_cors_sse.py:26-41` (middleware-integration pattern).

**Contents:**

```python
"""Tests for Criterion 13 — CORS origins configurable from environment."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app import config as app_config
from app import main as app_main
from app.config import Settings


def test_cors_allow_origins_parsed_from_env(monkeypatch):
    """RAPID_WEB_CORS_ALLOW_ORIGINS is JSON-parsed into a list[str]."""
    monkeypatch.setenv(
        "RAPID_WEB_CORS_ALLOW_ORIGINS",
        '["https://a.example.com","https://b.example.com"]',
    )
    s = Settings()
    assert s.rapid_web_cors_allow_origins == [
        "https://a.example.com",
        "https://b.example.com",
    ]


def test_cors_middleware_honors_settings_override(monkeypatch):
    """CORSMiddleware picks up the configured origins at create_app() time."""
    monkeypatch.setattr(
        app_config.settings,
        "rapid_web_cors_allow_origins",
        ["https://app.example.com"],
    )
    app = app_main.create_app()
    with TestClient(app) as client:
        # Allowed origin — preflight must echo it back.
        allowed = client.options(
            "/health",
            headers={
                "Origin": "https://app.example.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert allowed.headers.get("access-control-allow-origin") == "https://app.example.com"

        # Disallowed origin (the old default) — header must be absent.
        denied = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert "access-control-allow-origin" not in denied.headers
```

**Constraints:**
- Do NOT import or instantiate `AgentSessionManager` — these tests are pure CORS wiring, no agent-runtime dependencies.
- Do NOT test against `/agents/*` endpoints; use `/health` (already in the app) to avoid coupling to agent-router internals.
- Both tests must be self-contained — no fixtures beyond pytest's `monkeypatch`.
- If `/health` is not a registered route, substitute the simplest GET route already wired (verify with `grep -n '@app.get\|app.add_api_route' web/backend/app/main.py` before writing). Do NOT add a new route for the test.

## Verification

All commands run from `web/backend/`.

1. **New test file passes in isolation:**
   ```bash
   uv run pytest tests/agents/test_cors_config.py -v
   ```
   Expect: 2 passed.

2. **No regression in the wider agent-runtime + config suites:**
   ```bash
   uv run pytest tests/test_config.py tests/agents/ -v
   ```
   Expect: all pre-existing tests still pass, plus the 2 new ones.

3. **Full backend suite green:**
   ```bash
   uv run pytest
   ```
   Expect: no new failures vs. the pre-wave-5 baseline.

4. **Hardcoded origins are gone from `main.py`:**
   ```bash
   ! grep -nE '"http://(127\.0\.0\.1|localhost):5173"' web/backend/app/main.py
   ```
   Expect: exit code 0 (no matches). The hardcoded literal must live ONLY in `config.py` as the field default.

5. **Settings field present and typed correctly:**
   ```bash
   grep -n 'rapid_web_cors_allow_origins' web/backend/app/config.py
   ```
   Expect: one match showing `rapid_web_cors_allow_origins: list[str] = [...]`.

## Success Criteria

1. `Settings().rapid_web_cors_allow_origins` defaults to `["http://127.0.0.1:5173", "http://localhost:5173"]` — behaviour is unchanged when no env var is set.
2. Setting `RAPID_WEB_CORS_ALLOW_ORIGINS='["https://a","https://b"]'` in the environment causes `Settings().rapid_web_cors_allow_origins == ["https://a", "https://b"]` (pydantic-settings JSON-parses `list[str]` env vars).
3. `create_app()` registers `CORSMiddleware` with the value of `settings.rapid_web_cors_allow_origins` at build time; monkeypatching `app_config.settings.rapid_web_cors_allow_origins` before `create_app()` changes which origins are accepted on preflight.
4. `grep` finds no hardcoded `http://127.0.0.1:5173` or `http://localhost:5173` literal in `web/backend/app/main.py`.
5. Full pytest suite (`uv run pytest`) passes with no new failures compared to the pre-wave-5 baseline; the 2 new tests in `tests/agents/test_cors_config.py` pass.

## Out of Scope

- Adding a `.env.example` file — no backend `.env.example` exists today and introducing one selectively for a single field would create asymmetry. Track separately if desired.
- Changing `allow_credentials`, `allow_methods`, or `allow_headers` — the gap is strictly about origin configurability.
- Validating or rejecting `["*"]` with `allow_credentials=True` — Starlette already silently downgrades this; a field comment warns future readers, no runtime guard is added.
- Any other criterion from `GAPS.md` — only Criterion 13 is unresolved per the set context summary.
