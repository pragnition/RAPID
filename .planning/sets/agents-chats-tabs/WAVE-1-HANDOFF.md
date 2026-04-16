# Wave 1 Handoff -- Backend Foundation

**Set:** agents-chats-tabs
**Wave:** 1 of 3
**Status:** COMPLETE
**Date:** 2026-04-16

## Summary

Wave 1 ships the complete backend foundation for the chat persistence and consolidated dashboard features. All 10 tasks implemented, 54 tests passing, 10 atomic commits.

## Deliverables

| Artifact | Status |
|----------|--------|
| `app/models/chat.py` (Chat, ChatMessage, ChatAttachment, AttachmentKind) | Done |
| `app/database.py` (chat model registration at bottom) | Done |
| `alembic/versions/0007_chat_persistence.py` (revision 0007) | Done |
| `app/schemas/chats.py` (request/response Pydantic schemas) | Done |
| `app/schemas/dashboard.py` (DashboardResponse + sub-schemas) | Done |
| `app/services/chat_service.py` (6 public functions + materialize helper) | Done |
| `app/routers/chats.py` (7 endpoints under /api/chats) | Done |
| `app/routers/dashboard.py` (1 endpoint, 1s LRU cache) | Done |
| `app/main.py` (chats + dashboard routers registered) | Done |
| 5 test files (54 tests total) | Done |

## Key Decisions

1. **Local `get_db` per router** -- Avoided circular import (`app.main` imports routers, routers import `get_db` from `app.main`) by defining `get_db` locally in each new router module, matching the existing pattern in kanban, notes, views, projects, and skills routers.

2. **SSE stream placeholder** -- The `/api/chats/{chat_id}/events` endpoint currently returns an empty stream since chat-to-run binding is not yet wired. Full session-binding (chat_id -> active_run_id) will evolve in later waves. The endpoint structure and headers are correct.

3. **`func.iif` for SQLite** -- Dashboard chat summary uses `func.iif` (SQLite-native) for conditional counting instead of `CASE WHEN` expressions, which is simpler and works correctly with SQLModel.

4. **Dashboard cache** -- Module-level dict with 1s TTL, capped at 64 entries. Exposes `_clear_cache()` and `_invalidate_cache()` for test isolation.

5. **ChatAttachment as stub** -- All non-PK fields nullable per plan. No upload/storage logic -- deferred to v7.1.

## Commits

| Hash | Message |
|------|---------|
| `23fae5c` | feat: add Chat, ChatMessage, ChatAttachment SQLModel tables |
| `8ab77b6` | feat: register chat models in database.py metadata |
| `4e3c396` | feat: add Alembic migration 0007 for chat persistence tables |
| `a1f862b` | feat: add chat request/response Pydantic schemas |
| `828efae` | feat: add dashboard response Pydantic schemas |
| `474caee` | feat: add chat service layer with thread CRUD and message persistence |
| `c583525` | feat: add /api/chats router with 7 endpoints |
| `4fd1bf5` | feat: add consolidated /api/dashboard endpoint with 1s cache |
| `33910eb` | feat: register chats + dashboard routers in app/main.py |
| `20a08b2` | test: add backend tests for chat models, migration, service, and routers |

## Test Coverage

- **test_chat_models.py** (9 tests): model metadata, FK wiring, unique index, nullable fields, enum values, defaults
- **test_migration_0007.py** (6 tests): table creation, column sets, unique index, round-trip downgrade/upgrade, revision metadata
- **test_chat_service.py** (16 tests): thread CRUD, lifecycle (active/idle/archived), message persistence, seq monotonicity, temp_id, auto-title, materialize_assistant_turn
- **test_chats_router.py** (14 tests): all 7 endpoints including validation errors, 404/409 responses, SSE headers
- **test_dashboard_router.py** (9 tests): zero counts, status bucketing, recent limits, activity merge, budget cap, cache hit/miss, kanban summary

## Notes for Wave 2

- Frontend hooks should target `GET /api/chats`, `POST /api/chats`, `GET /api/chats/{id}`, `POST /api/chats/{id}/messages`, `GET /api/chats/{id}/messages`, `GET /api/dashboard`.
- SSE at `/api/chats/{id}/events` returns empty stream until session-binding is wired (Wave 3 or later).
- `ChatMessageResponse.tool_calls` is a decoded `list[dict]` (JSON-decoded from the DB string column).
- `ChatListResponse` has `items` and `total` fields.
- `DashboardResponse` has `runs_summary`, `chats_summary`, `kanban_summary`, `budget_remaining`, `recent_activity`.
