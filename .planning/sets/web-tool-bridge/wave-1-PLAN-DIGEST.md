# Wave 1 Plan Digest

**Objective:** Land the complete backend half of the ask-user bridge — AgentPrompt model, Alembic migration 0005, webui_ask_user/ask_free_text SDK MCP tools, can_use_tool AUQ interception, manager facade, and three router endpoints.
**Tasks:** 8 tasks completed
**Key files:** app/models/agent_prompt.py, alembic/versions/0005_agent_prompts.py, app/agents/tools/{__init__.py,ask_user.py}, app/agents/session.py, app/agents/session_manager.py, app/agents/permission_hooks.py, app/routers/agents.py, app/schemas/{sse_events,agents}.py, app/database.py, app/services/agent_service.py
**Approach:** Server-minted prompt_ids with per-run asyncio.Lock for race safety; PermissionResultDeny carrying JSON answers for AUQ interception; consumed_at column gates reopen 409 vs unwind.
**Status:** Complete
