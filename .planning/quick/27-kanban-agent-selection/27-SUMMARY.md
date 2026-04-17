# Quick Task 27: kanban-agent-selection

**Description:** When creating a card meant for autopilot, the user should be able to choose which agent (quick or bug-fix) will act on the card. When creating a kanban column, the user should also be able to choose the default agent type. Available agents: quick, bug-fix.
**Date:** 2026-04-17
**Status:** COMPLETE
**Commits:** 1158b3b, 4a84f16, cfca123
**Files Modified:** web/backend/app/database.py, web/backend/app/schemas/kanban.py, web/backend/app/services/kanban_service.py, web/backend/app/routers/kanban.py, web/backend/app/agents/card_routing.py, web/backend/app/agents/autopilot_worker.py, web/backend/alembic/versions/0010_card_and_column_agent_type.py, web/frontend/src/types/api.ts, web/frontend/src/hooks/useKanban.ts, web/frontend/src/components/kanban/CreateCardModal.tsx, web/frontend/src/components/kanban/CardDetailModal.tsx, web/frontend/src/components/kanban/KanbanColumn.tsx, web/frontend/src/components/kanban/KanbanCard.tsx, web/frontend/src/components/kanban/AddColumnButton.tsx, web/frontend/src/pages/KanbanBoard.tsx, web/backend/tests/test_kanban_service.py, web/backend/tests/test_autopilot_worker.py
