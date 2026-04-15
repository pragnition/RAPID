# Wave 4 Plan Digest

**Objective:** Cross-cutting tests — backend unit tests for the new tool module and manager facade, integration tests for reopen consume-race matrix, router tests, and Node-based skill-prose lint.
**Tasks:** 8 tasks completed
**Key files:** tests/agents/{test_agent_prompt_model,test_migration_0005,test_ask_user_tool,test_auq_interception,test_prompt_manager_facade,test_prompt_reopen_matrix,test_prompts_router,test_prompt_roundtrip_integration}.py, tests/cli-parity-lint.test.cjs
**Approach:** 177/177 agents tests pass (125 pre-existing + 52 new). 128/128 Node lint tests pass (118 per-call-site structural checks + 9 per-file counts + 1 blacklist). Integration test drives real SSE + TestClient round-trip; fake-SDK-client approach swapped for direct tool-body-to-HTTP path.
**Status:** Complete. Documented gaps in reopen matrix Case 5 + resolve idempotency (pinned to current behavior, no production changes).
