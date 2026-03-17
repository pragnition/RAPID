# Bug Hunt Review

**Set:** context-optimization
**Date:** 2026-03-17
**Cycle:** 2
**Findings:** 3 | Accepted: 3 | Dismissed: 0 | Deferred: 0

## Accepted Bugs

### BUG-001 [Priority 3] - reconcileWaveJobs filesPlanned undercounts when missing_modify_file failures exist
- **File:** src/lib/execute.cjs:966
- **Category:** logic-error
- **Hunter evidence:** `filesPlanned` at line 966-967 sums `file_exists` (passed) and `missing_file` (failed) but ignores `missing_modify_file` failures. When a Modify-action file is absent from the worktree, `reconcileJob` pushes `{ type: 'missing_modify_file' }` at line 916, but `reconcileWaveJobs` never counts it. The planned file total is therefore understated.
- **Advocate response:** Agrees. All three types originate from the `plannedFiles` loop (lines 909-917). `missing_modify_file` should contribute to the count. No tests exist for this path.
- **Ruling:** ACCEPTED -- The code unambiguously excludes `missing_modify_file` from the `filesPlanned` sum. Since every entry in `plannedFiles` is either `file_exists`, `missing_file`, or `missing_modify_file`, the arithmetic is incomplete. This produces an inaccurate reconciliation report. Priority 3 because the count is informational and does not block execution, but it misleads the operator about wave completion status.

### BUG-002 [Priority 2] - missing_modify_file failures silently dropped from all output fields
- **File:** src/lib/execute.cjs:969
- **Category:** logic-error
- **Hunter evidence:** `missingFiles` at line 969 filters only `missing_file`. The `softBlocks` loop at line 974 also only iterates `missing_file`. There is zero handling for `missing_modify_file` -- it exists in `result.failed` but is never surfaced in `jobResults.missingFiles`, `softBlocks`, `hardBlocks`, or any output path.
- **Advocate response:** Agrees. `missing_modify_file` never surfaces in any output field. It is completely invisible in wave results.
- **Ruling:** ACCEPTED -- This is the more severe companion to BUG-001. Not only is the count wrong, but the actual file paths of failed Modify-action reconciliations are completely invisible. An operator reviewing wave results would see no indication that a Modify file was expected but absent. This silently masks a real reconciliation failure. Priority 2 because it hides actionable information about missing deliverables during wave execution.

### BUG-003 [Priority 3] - generateJobHandoff lacks handoff_decisions fallback present in generateHandoff
- **File:** src/lib/execute.cjs:1068
- **Category:** api-contract-mismatch
- **Hunter evidence:** `generateHandoff` (set-level, lines 431-438) supports both `checkpointData.decisions` (array) and `checkpointData.handoff_decisions` (string or array) via explicit fallback logic. `generateJobHandoff` (job-level, line 1068) only checks `checkpointData.decisions` -- no fallback to `handoff_decisions`.
- **Advocate response:** Agrees. The RAPID structured return protocol specifies `handoff_decisions` as the standard field name. The set-level function handles both, but the job-level function does not.
- **Ruling:** ACCEPTED -- The asymmetry is clear from direct comparison. Agents producing CHECKPOINT returns with the protocol-standard `handoff_decisions` field will have their decisions preserved in set-level HANDOFF.md but silently lost in job-level HANDOFF.md. Priority 3 because job-level handoffs are less common than set-level ones, but when they occur, losing decision context degrades the resume experience for the next agent.

## Dismissed Findings

(none)

## Deferred (Needs Human Review)

(none)
