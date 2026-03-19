# Wave 2 Plan Digest

**Objective:** Migrate all DAG.json consumers to use `tryLoadDAG()`, fix wrong DAG path in merge.cjs, restructure execute-set Step 6, and add DAG creation to init flow
**Tasks:** 6 tasks completed
**Key files:** src/lib/merge.cjs, src/lib/merge.test.cjs, skills/execute-set/SKILL.md, skills/init/SKILL.md, src/lib/plan.cjs
**Approach:** Migrated getMergeOrder and detectCascadeImpact to tryLoadDAG (fixing .planning/DAG.json bug), added 4 merge tests, restructured Step 6 with retry logic and resilient commit, added recalculateDAG call to init flow, used DAG_CANONICAL_SUBPATH in plan.cjs writeDAG.
**Status:** Complete
