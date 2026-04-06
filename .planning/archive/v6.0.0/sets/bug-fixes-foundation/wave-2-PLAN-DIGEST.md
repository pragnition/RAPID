# Wave 2 Plan Digest

**Objective:** Fix three core bugs — REQUIREMENTS.md overwrite by scaffold, roadmapper STATE.json overwrite, and recalculateDAG() annotation stripping
**Tasks:** 4 tasks completed
**Key files:** src/lib/init.cjs, src/lib/init.test.cjs, src/lib/state-machine.cjs, src/lib/state-machine.test.cjs, src/lib/add-set.cjs, src/lib/add-set.test.cjs, skills/init/SKILL.md
**Approach:** Added content guard in fresh-mode scaffolding loop, implemented mergeStatePartial() using withStateTransaction for safe partial state updates, added tryLoadDAG lookup with object spread to preserve DAG node annotations, updated SKILL.md Step 9c to reference merge semantics
**Status:** Complete
