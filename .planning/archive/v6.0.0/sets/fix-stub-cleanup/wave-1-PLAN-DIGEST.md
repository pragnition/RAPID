# Wave 1 Plan Digest

**Objective:** Close all three actionable gaps from the v6.0.0 audit report -- wire cleanupStubSidecars() into merge pipeline, fix two stale CONTRACT.json metadata values
**Tasks:** 4 tasks completed
**Key files:** src/lib/merge.cjs, src/lib/merge.test.cjs, .planning/sets/dag-central-grouping/CONTRACT.json, .planning/sets/init-enhancements/CONTRACT.json
**Approach:** Added doStubCleanup() helper inside mergeSet() called in both solo-mode and normal-mode success paths; added 3 integration tests; fixed CONTRACT.json export name and budget value
**Status:** Complete
