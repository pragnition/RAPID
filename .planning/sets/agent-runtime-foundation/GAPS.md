# Gaps: agent-runtime-foundation

**Set:** agent-runtime-foundation
**Milestone:** v7.0.0
**Verification run:** 2026-04-15
**Criteria passed:** 15/16
**Tests:** 122/122 pass

## Unresolved Gaps

### Criterion 13 — CORS config from env — FAIL

**Location:** `web/backend/app/main.py:144-145`

**Detail:** `allow_origins` is hardcoded to `["http://127.0.0.1:5173", "http://localhost:5173"]`. No CORS-related setting exists in `web/backend/app/config.py` (no `cors_allow_origins` / `RAPID_CORS_ORIGINS` env variable). Functions for local dev but is not configurable from the environment per the ROADMAP success criterion.

**Suggested fix (for gap-closure wave):**
- Add `rapid_cors_allow_origins: list[str] = ["http://127.0.0.1:5173", "http://localhost:5173"]` to `Settings` in `app/config.py`.
- Replace the hardcoded list in `app/main.py` with `settings.rapid_cors_allow_origins`.
- Add a `tests/agents/test_cors_config.py` case that overrides the env var and asserts the list flows through.

## Close-the-gap commands

```
/rapid:plan-set 1 --gaps
/rapid:execute-set 1 --gaps
```
