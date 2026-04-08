# Gaps: readme-and-onboarding

## Gap 1: Footer command count off by one (LOW)

**Files:** README.md, DOCS.md
**Detail:** Both README.md and DOCS.md say "17 of 28" commands show the /clear footer, but the actual enumerated list in DOCS.md contains 18 commands (matching CLEAR-POLICY.md which lists 18 "Yes" entries). The `bug-fix` command appears to be the 18th footer command but the count was not incremented from the plan's original "17".
**Severity:** LOW -- the body content listing is correct, only the heading/prose number is off by one.
