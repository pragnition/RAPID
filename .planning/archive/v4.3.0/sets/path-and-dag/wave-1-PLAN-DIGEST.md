# Wave 1 Plan Digest

**Objective:** Extract resolveProjectRoot(), DAG_SUBPATH, ensureDagExists() into core.cjs and deprecate findProjectRoot()
**Tasks:** 5 tasks completed
**Key files:** src/lib/core.cjs, src/lib/core.test.cjs
**Approach:** Ported resolveProjectRoot from plan.cjs to core.cjs, added DAG_SUBPATH constant and ensureDagExists guard, converted findProjectRoot to deprecation wrapper, wrote 8 comprehensive test cases
**Status:** Complete
