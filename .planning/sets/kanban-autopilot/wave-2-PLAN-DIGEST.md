# Wave 2 Plan Digest

**Objective:** Build the agent-facing layer: MCP tools, card-to-skill routing, autopilot poller, and HTTP router extensions
**Tasks:** 10 tasks completed
**Key files:** web/backend/app/agents/tools/kanban_tools.py, web/backend/app/agents/card_routing.py, web/backend/app/agents/autopilot_worker.py, web/backend/app/agents/permissions.py, web/backend/app/routers/kanban.py, web/backend/app/main.py, web/backend/tests/test_kanban_tools.py, web/backend/tests/test_card_routing.py, web/backend/tests/test_autopilot_worker.py
**Approach:** Created 6 kanban agent tools (list/get/add/move/update/comment) with untrusted-tag wrapping on descriptions. Label-based card-to-skill routing (bug→bug-fix, feature→add-set, chore→quick). AutopilotWorker lifespan poller with _poll_once for testability, 60s interval, retry_count>=3 skip, atomic lock_card CAS. HTTP router extended with rev-aware move (409 on stale), column autopilot toggle endpoint. Autopilot permission policy added. 19 new tests across 3 test files.
**Status:** Complete
