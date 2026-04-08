# Wave 3 Plan Digest

**Objective:** Wire wave-2 CLI surface into user-facing skills and gitignore the install metadata file.
**Tasks:** 3 tasks completed
**Key files:** skills/status/SKILL.md, skills/install/SKILL.md, .gitignore
**Approach:** Appended "Step 5: Update Reminder" to status SKILL.md (between Step 4 and Important Notes) and "Step 6: Update Reminder" to install SKILL.md as the new final section. Both contain the standard env preamble plus `node "${RAPID_TOOLS}" display update-reminder`. Added `.rapid-install-meta.json` gitignore entry after the `.env` block. End-to-end chain verified: `[RAPID] Your install is 8 days old. Run /rapid:install to refresh.`
**Status:** Complete
