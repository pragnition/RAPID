# Wave 1 Plan Digest

**Objective:** Create the centralized `tryLoadDAG(cwd)` function in `dag.cjs` and its full test suite
**Tasks:** 3 tasks completed
**Key files:** src/lib/dag.cjs, src/lib/dag.test.cjs
**Approach:** Added `fs`/`path` requires to dag.cjs, created `DAG_CANONICAL_SUBPATH` constant and `tryLoadDAG()` function that returns `{dag, path}` (null dag on ENOENT, throws on corruption), exported both. Added 5 test cases covering ENOENT, valid JSON, malformed JSON, path consistency, and constant value.
**Status:** Complete
