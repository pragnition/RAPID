# Quick Task 26: kanban-card-modal-and-ignore-toggle

**Description:** Add a toggle to allow users to create kanban cards that the autopilot sweeper will ignore, and replace the inline card creation input with a modal that allows specifying both the card name and description.
**Date:** 2026-04-17
**Status:** COMPLETE
**Commits:** 1521bae
**Files Modified:** web/backend/app/database.py, web/backend/alembic/versions/0009_card_autopilot_ignore.py, web/backend/app/schemas/kanban.py, web/backend/app/services/kanban_service.py, web/backend/app/routers/kanban.py, web/backend/app/agents/autopilot_worker.py, web/frontend/src/types/api.ts, web/frontend/src/components/kanban/CreateCardModal.tsx, web/frontend/src/components/kanban/KanbanColumn.tsx, web/frontend/src/components/kanban/CardDetailModal.tsx, web/frontend/src/components/kanban/KanbanCard.tsx, web/frontend/src/pages/KanbanBoard.tsx, web/frontend/src/hooks/useKanban.ts, web/backend/tests/test_kanban_service.py, web/backend/tests/test_autopilot_worker.py
