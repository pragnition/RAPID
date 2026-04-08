# Wave 2 Plan Digest

**Objective:** Standardize breadcrumb format across error messages and create ux-audit test suite.
**Tasks:** 5 tasks completed
**Key files:** src/lib/errors.cjs, src/lib/state-machine.cjs, src/lib/state-transitions.cjs, src/commands/state.cjs, tests/ux-audit.test.cjs
**Approach:** Added formatBreadcrumb() helper to errors.cjs producing compact `{context}. Run: {recovery}` format. Updated exitWithError to use red ANSI [ERROR] label with NO_COLOR support. Modernized REMEDIATION_HINTS from `\nRemediation:` to breadcrumb format. Enriched state transition and CliError messages with recovery hints. Created 13 tests covering breadcrumb formatting, state errors, transition errors, auto-regroup wiring, teamSize storage, and audit report structure.
**Status:** Complete
