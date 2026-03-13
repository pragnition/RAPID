---
phase: 33
slug: merge-state-schema-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node 25.8) |
| **Config file** | none — direct invocation |
| **Quick run command** | `node --test src/lib/merge.test.cjs` |
| **Full suite command** | `node --test src/lib/merge.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/merge.test.cjs`
- **After every plan wave:** Run `node --test src/lib/merge.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 1 | MERGE-04 | unit | `node --test --test-name-pattern="agentPhase" src/lib/merge.test.cjs` | Extends existing | ⬜ pending |
| 33-01-02 | 01 | 1 | MERGE-04 | unit | `node --test --test-name-pattern="backward" src/lib/merge.test.cjs` | Extends existing | ⬜ pending |
| 33-01-03 | 01 | 1 | MERGE-04 | unit | `node --test --test-name-pattern="agentPhase" src/lib/merge.test.cjs` | Extends existing | ⬜ pending |
| 33-02-01 | 02 | 1 | MERGE-05 | unit | `node --test --test-name-pattern="compressResult" src/lib/merge.test.cjs` | Extends existing | ⬜ pending |
| 33-02-02 | 02 | 1 | MERGE-05 | unit | `node --test --test-name-pattern="token" src/lib/merge.test.cjs` | Extends existing | ⬜ pending |
| 33-02-03 | 02 | 1 | MERGE-05 | unit | `node --test --test-name-pattern="budget" src/lib/merge.test.cjs` | Extends existing | ⬜ pending |
| 33-03-01 | 03 | 1 | SC-2 | unit | `node --test --test-name-pattern="prepareMerger" src/lib/merge.test.cjs` | Extends existing | ⬜ pending |
| 33-04-01 | 04 | 1 | SC-3 | unit | `node --test --test-name-pattern="parseSetMerger" src/lib/merge.test.cjs` | Extends existing | ⬜ pending |
| 33-04-02 | 04 | 1 | SC-3 | unit | `node --test --test-name-pattern="parseSetMerger" src/lib/merge.test.cjs` | Extends existing | ⬜ pending |
| 33-04-03 | 04 | 1 | SC-3 | unit | `node --test --test-name-pattern="parseSetMerger" src/lib/merge.test.cjs` | Extends existing | ⬜ pending |
| 33-04-04 | 04 | 1 | SC-3 | unit | `node --test --test-name-pattern="parseSetMerger" src/lib/merge.test.cjs` | Extends existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

Existing `src/lib/merge.test.cjs` (64 tests) uses `node:test` and `node:assert/strict`. New tests will be appended following established patterns.

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
