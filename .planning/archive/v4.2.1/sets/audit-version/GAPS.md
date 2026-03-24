# Gaps: audit-version

## Gap 1: Integration test not updated for auditor role

**File:** `src/bin/rapid-tools.test.cjs` lines 18-28
**Issue:** Test expects 26 agent files and "Built 22 agents" but auditor addition makes it 27/23.
**Severity:** Low (unit tests pass; only integration test is stale)
**Remediation:** Update the expected counts in `rapid-tools.test.cjs`
