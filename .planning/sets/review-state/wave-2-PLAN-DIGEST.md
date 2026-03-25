# Wave 2 Plan Digest

**Objective:** Wire review state library into CLI command handler and all four SKILL.md files
**Tasks:** 6 tasks completed
**Key files:** src/commands/review.cjs, src/commands/review.test.cjs, skills/review/SKILL.md, skills/unit-test/SKILL.md, skills/bug-hunt/SKILL.md, skills/uat/SKILL.md
**Approach:** Added `state` and `mark-stage` CLI subcommands to review command handler with tests; updated all four skill files with entry-point state checks (skip/re-run prompts via AskUserQuestion) and exit-point state writes (mark-stage calls), all gated on POST_MERGE flag
**Status:** Complete
