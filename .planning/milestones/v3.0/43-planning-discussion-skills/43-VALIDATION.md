---
phase: 43
slug: planning-discussion-skills
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in) + node:assert/strict |
| **Config file** | none — uses node --test flag |
| **Quick run command** | `node --test src/lib/state-transitions.test.cjs && node --test src/lib/contract.test.cjs` |
| **Full suite command** | `node --test src/lib/*.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/state-transitions.test.cjs && node --test src/lib/contract.test.cjs`
- **After every plan wave:** Run `node --test src/lib/*.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 43-01-01 | 01 | 1 | CMD-01 | integration | Manual verification — skill orchestration | N/A (skill test) | ⬜ pending |
| 43-01-02 | 01 | 1 | CMD-01 | unit | `node --test src/lib/init.test.cjs` | ❌ W0 | ⬜ pending |
| 43-02-01 | 02 | 1 | CMD-02 | integration | Manual verification — skill orchestration | N/A (skill test) | ⬜ pending |
| 43-02-02 | 02 | 1 | CMD-02 | unit | `node --test src/lib/worktree.test.cjs` | ✅ | ⬜ pending |
| 43-03-01 | 03 | 1 | CMD-03 | integration | Manual verification — skill orchestration | N/A (skill test) | ⬜ pending |
| 43-03-02 | 03 | 1 | PLAN-02 | integration | Manual verification — CONTEXT.md output | N/A (skill test) | ⬜ pending |
| 43-03-03 | 03 | 1 | PLAN-03 | integration | Manual verification — --skip auto-context | N/A (skill test) | ⬜ pending |
| 43-04-01 | 04 | 2 | CMD-04 | integration | Manual verification — skill orchestration | N/A (skill test) | ⬜ pending |
| 43-04-02 | 04 | 2 | PLAN-01 | integration | Manual verification — count spawns | N/A (skill test) | ⬜ pending |
| 43-04-03 | 04 | 2 | PLAN-04 | unit | `node --test src/lib/contract.test.cjs` | ✅ | ⬜ pending |
| 43-04-04 | 04 | 2 | PLAN-05 | unit | `node --test src/lib/wave-planning.test.cjs` | ✅ | ⬜ pending |
| 43-05-01 | 05 | 2 | UX-01 | manual-only | Visual inspection | N/A | ⬜ pending |
| 43-05-02 | 05 | 2 | UX-02 | manual-only | Visual inspection | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No automated tests for SKILL.md files — these are declarative orchestration documents tested via manual end-to-end runs
- [ ] `validateJobPlans()` may need additional test cases for wave-level (vs job-level) file list extraction
- [ ] Breadcrumb rendering has no test infrastructure — verify visually

*Existing infrastructure covers most phase requirements. Skills are tested via manual end-to-end execution.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Progress breadcrumb rendering | UX-01 | Visual formatting, no programmatic check | Run each skill command, verify breadcrumb shows done/missing/next |
| One suggested next action | UX-02 | Output text pattern, varies by context | Run each skill, verify exactly one `/rapid:*` suggestion at end |
| 6-researcher pipeline produces roadmap | CMD-01 | End-to-end skill orchestration | Run `/rapid:init` on greenfield project, verify 6 researchers spawn |
| discuss-set captures vision into CONTEXT.md | CMD-03 | Interactive Q&A flow | Run `/rapid:discuss-set`, verify 4-area Q&A model and CONTEXT.md output |
| plan-set autonomous 2-4 spawns | PLAN-01 | Agent spawn count verification | Run `/rapid:plan-set`, count Agent tool calls in output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
