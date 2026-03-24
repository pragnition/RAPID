# Wave 2 Plan Digest

**Objective:** Propagate resolveProjectRoot(), DAG_SUBPATH, ensureDagExists() to all consumers; fix DAG path bug in merge.cjs
**Tasks:** 9 tasks completed
**Key files:** src/lib/plan.cjs, src/lib/ui-contract.cjs, src/commands/merge.cjs, src/commands/execute.cjs, src/lib/dag.cjs, src/bin/rapid-tools.cjs, src/commands/misc.cjs, skills/new-version/SKILL.md, tests/merge-regression.test.cjs
**Approach:** Removed local resolveProjectRoot definitions in plan.cjs and ui-contract.cjs, replaced with core.cjs imports. Fixed DAG path bug in merge.cjs. Replaced inline DAG checks with ensureDagExists in execute.cjs. Added backward-compat alias for DAG_CANONICAL_SUBPATH in dag.cjs.
**Status:** Complete
