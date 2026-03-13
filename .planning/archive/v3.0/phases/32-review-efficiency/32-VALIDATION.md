---
phase: 32
slug: review-efficiency
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in) |
| **Config file** | none — standard Node test runner |
| **Quick run command** | `node --test src/lib/review.test.cjs` |
| **Full suite command** | `node --test src/lib/*.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/review.test.cjs`
- **After every plan wave:** Run `node --test src/lib/*.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | REV-01 | unit | `node --test src/lib/review.test.cjs` | Partially | ⬜ pending |
| 32-01-02 | 01 | 1 | REV-02 | unit | `node --test src/lib/review.test.cjs` | No — W0 | ⬜ pending |
| 32-01-03 | 01 | 1 | REV-03 | unit | `node --test src/lib/review.test.cjs` | No — W0 | ⬜ pending |
| 32-01-04 | 01 | 1 | REV-04 | unit | `node --test src/lib/review.test.cjs` | No — W0 | ⬜ pending |
| 32-01-05 | 01 | 1 | REV-01 | unit | `node --test src/lib/build-agents.test.cjs` | Partially | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/review.test.cjs` — new test cases for scopeByConcern, deduplicateFindings, normalizedLevenshtein, ScoperOutput schema, concern field on ReviewIssue
- [ ] `src/lib/build-agents.test.cjs` — scoper entry assertions in ROLE_CORE_MAP/ROLE_TOOLS/ROLE_COLORS/ROLE_DESCRIPTIONS

*Existing test infrastructure covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scoper agent produces correct concern categories for real-world file sets | REV-01 | LLM output non-deterministic | Run `/rapid:review` on a multi-concern set and verify scoper output is reasonable |
| Concern scope banner displays correctly during review | REV-03 | UI output verification | Run review and verify banner shows concern names and cross-cutting count |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
