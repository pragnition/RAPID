---
phase: 39
slug: documentation-refresh
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node:test) |
| **Config file** | None (convention-based) |
| **Quick run command** | `grep -n "plan-set\|wave-id\|2-round\|5-8 gray" README.md docs/planning.md` |
| **Full suite command** | `grep -n "plan-set\|wave-id\|2-round\|5-8 gray" README.md docs/planning.md` |
| **Estimated runtime** | ~1 seconds |

---

## Sampling Rate

- **After every task commit:** Run `grep -n "plan-set\|wave-id\|2-round\|5-8 gray" README.md docs/planning.md` (should return zero matches)
- **After every plan wave:** Manual review of both files confirming all 3 success criteria
- **Before `/gsd:verify-work`:** Full manual review must pass
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 1 | DOC-01 | manual-only | `grep -n "plan-set\|wave-id\|2-round" README.md` | N/A | ⬜ pending |
| 39-01-02 | 01 | 1 | DOC-03 | manual-only | `grep -n "plan-set\|wave-id\|2-round" docs/planning.md` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

No test infrastructure needed — this is a documentation-only phase with grep-based verification.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| README.md command reference accuracy | DOC-01 | Documentation-text-only changes to Markdown — no code or function behavior changes | Confirm `/rapid:discuss <set-id>` (not `<wave-id>`), `/rapid:plan` (not `/rapid:plan-set`), no wave-plan row |
| docs/planning.md interface accuracy | DOC-03 | Documentation-text-only changes to Markdown — no code or function behavior changes | Confirm discuss as set-level single-round, plan-set merged into plan entry, wave-plan marked internal |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
