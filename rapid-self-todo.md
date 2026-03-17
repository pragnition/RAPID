# RAPID Self-Improvement TODOs

Issues encountered during RAPID usage that should be addressed.

---

## Executor Agent Spurious Test Modifications

**Encountered:** 2026-03-16, execute-set data-integrity (wave 2)
**Severity:** Medium — causes test regressions that require manual cleanup

The `rapid-executor` agent modified 3 pre-existing test assertions that were unrelated to its wave plan:

1. **merge.test.cjs:2309** — Changed `<conventions>` to `<git>` in the ROLE_CORE_MAP test assertion. The agent presumably misread the source and "corrected" the test to match what it thought the code should produce.
2. **rapid-tools.test.cjs:24** — Changed `'Built 22 agents'` to `'Built 26 agents'`. The source code still produces 22; the agent incorrectly updated the assertion count.
3. **rapid-tools.test.cjs:465** — Changed `'WAVE'` header to `'BRANCH'` header in the worktree status table test. The source still outputs `WAVE`.

**Root cause:** The executor agent modified test files beyond its wave plan scope. It touched assertions in pre-existing tests instead of only adding new test blocks.

**Potential fix:** The executor agent prompt or plan should include a stronger constraint: "When adding new tests to an existing test file, do NOT modify any pre-existing test code. Only append new describe/it blocks." This could be enforced in the wave plan template or in the rapid-executor agent definition.

---

## State Transition CWD Sensitivity

**Encountered:** 2026-03-16, execute-set data-integrity (step 6)
**Severity:** Low — easily recoverable but confusing

After executing waves in the worktree, the shell CWD drifted to the worktree path. Running `node "${RAPID_TOOLS}" state transition set ... complete` from the worktree CWD read the worktree's STATE.json (which still showed `pending`) instead of the main project's STATE.json (which was correctly at `executed`). The transition failed with "Invalid transition: pending -> complete".

**Root cause:** `state transition` operates on whichever STATE.json is in the CWD. The orchestrator's earlier transition (planned -> executed) ran from main, but subsequent commands ran from the worktree.

**Potential fix:** The execute-set skill should explicitly `cd` to the main project root before state transitions, or the state CLI should accept a `--cwd` flag to avoid ambient CWD dependency.

---

## Verifier False Positive on Pre-Existing Failures

**Encountered:** 2026-03-16, execute-set data-integrity (verification step)
**Severity:** Low — informational

The `rapid-verifier` correctly identified 3 test failures but initially characterized them as "pre-existing tests that were incorrectly modified" without being able to confirm they passed on main. I had to manually diff against main to confirm the executor introduced the regressions (main had 0 failures).

**Note:** The verifier's gap report was accurate and actionable — it correctly identified which lines were wrong and what they should be reverted to. The issue is just that it couldn't distinguish "pre-existing failure" from "executor-introduced regression" without access to the main branch test results.

---

## State Desync Between Worktree and Main During execute-set

**Encountered:** 2026-03-16, execute-set bug-fixes (step 3 / step 6)
**Severity:** Medium — requires manual multi-step state recovery

During execute-set for bug-fixes, the `state transition set v3.3.0 bug-fixes executed` command in Step 3 reported success (`{"transitioned":true}`), but when Step 6 later ran `state transition set v3.3.0 bug-fixes complete`, the state was back to `pending`. The transition failed with "Invalid transition: pending -> complete".

**What happened:** The Step 3 transition ran while the shell CWD was the worktree (`.rapid-worktrees/bug-fixes/`), so it wrote to the worktree's copy of STATE.json. When Step 6 ran from the main project root, it read the main STATE.json which never received the `executed` transition — it was still at `pending`.

**Recovery applied:** Manually walked through all intermediate transitions (`pending -> discussed -> planned -> executed -> complete`) from the main project root.

**Relation to existing issue:** This is the same root cause as "State Transition CWD Sensitivity" above but with a worse outcome — the earlier issue was a single CWD drift at Step 6, while this one shows the desync happening as early as Step 3 with the orchestrator unaware until completion.

**Potential fix options:**
1. The execute-set skill should always prefix state CLI calls with an explicit `cd` to the main project root (not the worktree).
2. The `state transition` CLI command should resolve the project root via `git rev-parse --git-common-dir` (the same approach Wave 1 just implemented for `loadSet`) so it always writes to the canonical STATE.json regardless of CWD.
3. The orchestrator env preamble should capture and enforce `PROJECT_ROOT` at the start and use it for all state operations.
