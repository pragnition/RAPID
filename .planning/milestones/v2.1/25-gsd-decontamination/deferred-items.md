# Deferred Items - Phase 25 GSD Decontamination

## Pre-existing Test Failures (Out of Scope)

1. **assembler.test.cjs: "returns correct counts (5 core, 25 roles)"** - Expects 25 role modules but finds 26. Module count has drifted from test expectations.

2. **assembler.test.cjs: "lists the correct role module files"** - Related to above; role module list doesn't match expected.

3. **assembler.test.cjs: "assembled planner agent is under 15KB"** - Assembled agent is 20.6KB, exceeds the 15KB threshold.

4. **rapid-tools.test.cjs: "worktree status outputs human-readable table"** - Pre-existing failure related to BRANCH header assertion.

None of these are related to gsd_state_version renaming or migration changes.
