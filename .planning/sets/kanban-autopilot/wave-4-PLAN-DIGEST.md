# Wave 4 Plan Digest

**Objective:** Close remaining gaps: create skills/autopilot/SKILL.md and implement commit-trailer traceability
**Tasks:** 7 tasks completed
**Key files:** skills/autopilot/SKILL.md, web/backend/app/agents/correlation.py, web/backend/app/agents/session_manager.py, web/backend/app/agents/permission_hooks.py, web/backend/app/agents/sdk_options.py, web/backend/tests/agents/test_correlation.py, web/backend/tests/agents/test_commit_trailers.py
**Approach:** Added card_id_var ContextVar to correlation module, bound it in session_manager during autopilot runs via skill_args, implemented PreToolUse hook that injects --trailer flags into simple git commit commands, registered hook in sdk_options. Created SKILL.md documenting the backend-managed autopilot poller.
**Status:** Complete
