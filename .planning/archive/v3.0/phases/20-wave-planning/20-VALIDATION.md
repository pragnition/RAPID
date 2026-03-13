---
phase: 20
slug: wave-planning
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node:test) |
| **Config file** | None -- uses CLI flags |
| **Quick run command** | `node --test src/lib/wave-planning.test.cjs` |
| **Full suite command** | `node --test src/lib/*.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/wave-planning.test.cjs`
- **After every plan wave:** Run `node --test src/lib/*.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | WAVE-01 | integration | `node --test src/lib/wave-planning.test.cjs` | ❌ W0 | ⬜ pending |
| 20-01-02 | 01 | 1 | WAVE-02 | unit | `node --test src/lib/wave-planning.test.cjs` | ❌ W0 | ⬜ pending |
| 20-02-01 | 02 | 1 | WAVE-03 | integration | Manual -- requires Agent tool | ❌ W0 | ⬜ pending |
| 20-02-02 | 02 | 1 | WAVE-04 | integration | Manual -- requires Agent tool | ❌ W0 | ⬜ pending |
| 20-02-03 | 02 | 1 | WAVE-05 | integration | Manual -- requires Agent tool | ❌ W0 | ⬜ pending |
| 20-02-04 | 02 | 1 | WAVE-06 | unit | `node --test src/lib/wave-planning.test.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/wave-planning.cjs` -- core wave planning logic (state transitions, validation, artifact management)
- [ ] `src/lib/wave-planning.test.cjs` -- unit tests for WAVE-01, WAVE-02, WAVE-06
- [ ] `skills/discuss/SKILL.md` -- /rapid:discuss skill file
- [ ] `skills/wave-plan/SKILL.md` -- /rapid:wave-plan skill file
- [ ] `src/modules/roles/role-wave-researcher.md` -- wave research agent role
- [ ] `src/modules/roles/role-wave-planner.md` -- wave planner agent role
- [ ] `src/modules/roles/role-job-planner.md` -- job planner agent role

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Research agent produces WAVE-RESEARCH.md | WAVE-03 | Requires Agent tool spawning | Run `/rapid:wave-plan` on a test wave, verify WAVE-RESEARCH.md created |
| Wave Planner produces WAVE-PLAN.md | WAVE-04 | Requires Agent tool spawning | Verify WAVE-PLAN.md has per-job summaries after wave-plan run |
| Job Planner produces JOB-PLAN.md per job | WAVE-05 | Requires Agent tool spawning | Verify JOB-PLAN.md files created for each job after wave-plan run |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
