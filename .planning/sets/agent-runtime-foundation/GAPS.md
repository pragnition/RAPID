# Gaps: agent-runtime-foundation

**Set:** agent-runtime-foundation
**Milestone:** v7.0.0
**Verification run:** 2026-04-15
**Criteria passed:** 15/16 → **16/16** after gap-closure
**Tests:** 122/122 pass → **124/124** after gap-closure (2 new tests added)
**Gap-closure run:** 2026-04-15 (wave 5, commit b8338c7)

## Resolved Gaps

### Criterion 13 — CORS config from env — RESOLVED

**Status:** Resolved (gap-closure wave 5, commit b8338c7)

**Resolution:**
- Added `rapid_web_cors_allow_origins: list[str]` field to `Settings` in `web/backend/app/config.py` (default preserves prior hardcoded behaviour).
- Replaced hardcoded list in `web/backend/app/main.py` `create_app()` with `settings.rapid_web_cors_allow_origins`.
- Env var `RAPID_WEB_CORS_ALLOW_ORIGINS` JSON-parsed into `list[str]` by pydantic-settings.
- Added `web/backend/tests/agents/test_cors_config.py` with 2 tests (env parse + middleware integration).

**Verification (2026-04-15):** All 4 checks pass — field present, hardcoded literals removed from `main.py`, tests pass (2/2), env var flows through.

## Close-the-gap commands

All gaps resolved. No further action required; set is ready for final sign-off.
