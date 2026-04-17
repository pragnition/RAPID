# Wave 1 Plan Digest

**Objective:** Evolve KanbanCard and KanbanColumn SQLModels into agent-aware structures with optimistic concurrency control
**Tasks:** 5 tasks completed
**Key files:** web/backend/app/database.py, web/backend/alembic/versions/0006_kanban_v2_autopilot.py, web/backend/app/services/kanban_service.py, web/backend/app/schemas/kanban.py, web/backend/tests/test_kanban_service.py
**Approach:** Added rev, agent_status, locked_by_run_id, completed_by_run_id, agent_run_id, retry_count, created_by, metadata_json fields to KanbanCard; is_autopilot to KanbanColumn. Service layer extended with lock_card (atomic CAS), unlock_card, set_card_agent_status, update_column_autopilot, StaleRevisionError, and rev-aware move/update. Pydantic schemas extended with all agent fields. 15 unit tests cover all new service functions.
**Status:** Complete
