# Wave 4 Plan Digest

**Objective:** Embed SkillGallery and RunLauncher into AgentsPage and ChatsPage with category-appropriate default filters, wire submit→dispatch→navigate flow, add end-to-end tests.
**Tasks:** 6 tasks completed
**Key files:** web/frontend/src/pages/AgentsPage.tsx, web/frontend/src/pages/ChatsPage.tsx, web/frontend/src/pages/__tests__/AgentsPage.integration.test.tsx, web/frontend/src/pages/__tests__/ChatsPage.integration.test.tsx, web/backend/tests/test_skills_end_to_end.py, web/backend/tests/test_skills_router.py
**Approach:** AgentsPage defaults to autonomous+human-in-loop filters; ChatsPage defaults to interactive+human-in-loop; both have "All skills" toggle; card click opens RunLauncher modal; submit dispatches to /api/agents/runs and navigates to /chats/{runId} on 201; backend E2E test covers catalog→sanitize→build_prompt→dispatch path.
**Status:** Complete
