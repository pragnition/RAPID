# Bug Hunt Review - Set context-optimization

**Date:** 2026-03-17T00:00:00.000Z
**Cycles completed:** 1
**Scope:** 12 files across 4 concern groups

## Summary

| Ruling | Count |
|--------|-------|
| Accepted | 13 |
| Dismissed | 10 |
| Deferred | 0 |

## Findings and Rulings

### CON-1-F-2: Misleading comment about wave 0 behavior
- **File:** src/lib/compaction.cjs:136
- **Risk:** low | **Confidence:** high
- **Category:** logic-error
- **Concern:** compaction-engine
- **Originating wave:** unattributed
- **Hunter evidence:** Comment says 'Future wave or wave 0 (set-level): read full content' but wave 0 enters completed branch when activeWave >= 1
- **Advocate challenge:** Agrees. Code correct, comment misleading.
- **Ruling:** ACCEPTED
- **Reasoning:** Both sides agree the comment is misleading. Code is correct but comment causes maintenance confusion.

### CON-1-F-4: fireCompactionTrigger does not validate event names
- **File:** src/lib/compaction.cjs:191
- **Risk:** medium | **Confidence:** high
- **Category:** api-contract-mismatch
- **Concern:** compaction-engine
- **Originating wave:** unattributed
- **Hunter evidence:** registerCompactionTrigger validates events but fireCompactionTrigger does not. Typos silently fail.
- **Advocate challenge:** Agrees. Asymmetry is genuine.
- **Ruling:** ACCEPTED
- **Reasoning:** Both endpoints should validate event names against VALID_EVENTS.

### CON-2-F-1: Non-numeric --active-wave silently degrades
- **File:** src/commands/compact.cjs:18
- **Risk:** high | **Confidence:** high
- **Category:** logic-error
- **Concern:** compaction-cli
- **Originating wave:** unattributed
- **Hunter evidence:** parseInt on non-numeric produces NaN, all waves treated as future, digestsUsed: 0
- **Advocate challenge:** Tested and produces same behavior as default. Graceful degradation.
- **Ruling:** ACCEPTED
- **Reasoning:** CLI should reject invalid input with a clear error rather than silently degrading.

### CON-3-F-1: generateHandoff field name mismatch with protocol
- **File:** src/lib/execute.cjs:431
- **Risk:** high | **Confidence:** medium
- **Category:** api-contract-mismatch
- **Concern:** execution-pipeline
- **Originating wave:** unattributed
- **Hunter evidence:** Code reads checkpointData.decisions (array), protocol docs say handoff_decisions (string)
- **Advocate challenge:** Agrees naming discrepancy exists. Code internally consistent but diverges from docs.
- **Ruling:** ACCEPTED
- **Reasoning:** Protocol docs and code use different field names. Agents following docs would have decisions silently dropped.

### CON-3-F-2: parseHandoff section boundary detection fragile
- **File:** src/lib/execute.cjs:484
- **Risk:** medium | **Confidence:** medium
- **Category:** logic-error
- **Concern:** execution-pipeline
- **Originating wave:** unattributed
- **Hunter evidence:** lastIndexOf('## ') not anchored to line starts. Could break with ## mid-line.
- **Advocate challenge:** Safe for RAPID-generated content but fragile.
- **Ruling:** ACCEPTED (user decision)
- **Reasoning:** User accepted as real bug. Fragile boundary detection should be made robust.

### CON-3-F-3: reconcileJob readFileSync without try/catch
- **File:** src/lib/execute.cjs:887
- **Risk:** medium | **Confidence:** high
- **Category:** error-handling-gap
- **Concern:** execution-pipeline
- **Originating wave:** unattributed
- **Hunter evidence:** Missing job plan crashes entire wave reconciliation
- **Advocate challenge:** Agrees. Parameter-derived path, missing files realistic.
- **Ruling:** ACCEPTED
- **Reasoning:** Single file failure should not crash entire reconciliation.

### CON-3-F-4: reconcileWaveJobs filesPlanned undercounting
- **File:** src/lib/execute.cjs:945
- **Risk:** low | **Confidence:** medium
- **Category:** logic-error
- **Concern:** execution-pipeline
- **Originating wave:** unattributed
- **Hunter evidence:** Modify-action missing files excluded from both passed and failed counts
- **Advocate challenge:** Agrees undercounting is real.
- **Ruling:** ACCEPTED
- **Reasoning:** filesPlanned metric is inaccurate when Modify targets are missing.

### CON-3-F-7: reconcileWaveJobs readdirSync without try/catch
- **File:** src/lib/execute.cjs:934
- **Risk:** medium | **Confidence:** medium
- **Category:** error-handling-gap
- **Concern:** execution-pipeline
- **Originating wave:** unattributed
- **Hunter evidence:** Missing wave directory throws unhandled ENOENT
- **Advocate challenge:** Agrees. Same class as CON-3-F-3.
- **Ruling:** ACCEPTED
- **Reasoning:** Parameter-derived path, missing directory realistic. No try/catch.

### CON-3-F-8: execute resume missing --info-only support
- **File:** src/commands/execute.cjs:243
- **Risk:** low | **Confidence:** medium
- **Category:** api-contract-mismatch
- **Concern:** execution-pipeline
- **Originating wave:** unattributed
- **Hunter evidence:** execute resume omits options, --info-only unsupported
- **Advocate challenge:** Agrees. Two CLI paths, different capabilities.
- **Ruling:** ACCEPTED
- **Reasoning:** Inconsistent CLI surface. Same operation should have same capabilities.

### CON-4-F-1: routeEscalation undefined confidence auto-accepts
- **File:** src/lib/merge.cjs:428
- **Risk:** medium | **Confidence:** high
- **Category:** null-risk
- **Concern:** downstream-consumers
- **Originating wave:** unattributed
- **Hunter evidence:** undefined < 0.3 is false, undefined <= 0.8 is false, falls to auto-accept
- **Advocate challenge:** Agrees. Exported function should guard undefined.
- **Ruling:** ACCEPTED
- **Reasoning:** Defaulting to most permissive outcome on missing data is dangerous for merge conflict routing.

### CON-4-F-2: walkDir skip list missing .rapid-worktrees
- **File:** src/lib/review.cjs:205
- **Risk:** medium | **Confidence:** high
- **Category:** logic-error
- **Concern:** downstream-consumers
- **Originating wave:** unattributed
- **Hunter evidence:** Skip list has .worktrees but project uses .rapid-worktrees. findDependents recurses into worktrees.
- **Advocate challenge:** Agrees. includes() requires exact match.
- **Ruling:** ACCEPTED
- **Reasoning:** .worktrees doesn't match .rapid-worktrees. Inflates dependent file list.

### CON-4-F-4: scopeSetPostMerge git diff not in try/catch
- **File:** src/lib/review.cjs:157
- **Risk:** low | **Confidence:** high
- **Category:** error-handling-gap
- **Concern:** downstream-consumers
- **Originating wave:** unattributed
- **Hunter evidence:** execSync git diff not wrapped, adjacent git commands are
- **Advocate challenge:** Agrees. Inconsistency with adjacent error handling.
- **Ruling:** ACCEPTED
- **Reasoning:** Inconsistent defensive style. git diff could fail in degraded repo.

### CON-4-F-5: findDependents dead searchPatterns array
- **File:** src/lib/review.cjs:193
- **Risk:** low | **Confidence:** high
- **Category:** logic-error
- **Concern:** downstream-consumers
- **Originating wave:** unattributed
- **Hunter evidence:** searchPatterns populated but never referenced. Matching re-derives values.
- **Advocate challenge:** Agrees. Dead code from incomplete refactoring.
- **Ruling:** ACCEPTED
- **Reasoning:** Dead code confirmed by both sides.
