# Gaps: parallel-waves

## Gap 1: Cross-set test conflict (merge-time)

**Severity:** Low (merge-time concern, not a defect)
**Details:** The `status-rename.test.cjs` grep filter does not fully exclude wave/job-level uses of "executing" introduced by parallel-waves. The filter handles `{ id: 'w` and `{ id: 'j` patterns but misses `WaveStatus`, `WAVE_TRANSITIONS`, and `JOB_TRANSITIONS` map entries.
**Resolution:** Update the status-rename exclusion filter during merge to account for legitimate wave/job "executing" status values.
