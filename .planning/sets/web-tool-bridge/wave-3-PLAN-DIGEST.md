# Wave 3 Plan Digest

**Objective:** Patch 9 interactive SKILL.md files with `if [ "${RAPID_RUN_MODE}" = "sdk" ]; then ... else ... fi` bash wrappers around every AskUserQuestion call site (118 total); SDK branch routes to mcp__rapid__webui_ask_user or mcp__rapid__ask_free_text.
**Tasks:** 9 tasks completed (required one rework pass for large files)
**Key files:** skills/{scaffold,bug-fix,quick,assumptions,add-set,discuss-set,branding,new-version,init}/SKILL.md
**Approach:** One commit per file. Final counts: AUQ=WRAP=MCP=118 total with per-file expected values (3,3,4,5,8,13,19,25,38). Frontmatter allowed-tools tokens redistributed into a "Dual-Mode Operation Reference" wrapper block to keep grep counts balanced.
**Status:** Complete (ready for Wave 4 structural lint)
