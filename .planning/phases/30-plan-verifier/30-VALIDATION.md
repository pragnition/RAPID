---
phase: 30
slug: plan-verifier
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in) |
| **Config file** | none — uses `node --test` CLI |
| **Quick run command** | `node --test src/lib/wave-planning.test.cjs` |
| **Full suite command** | `node --test src/lib/*.test.cjs src/bin/*.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/wave-planning.test.cjs`
- **After every plan wave:** Run `node --test src/lib/*.test.cjs src/bin/*.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 1 | PLAN-01 | manual-only | N/A — LLM agent semantic analysis | N/A | ⬜ pending |
| 30-01-02 | 01 | 1 | PLAN-02 | unit | `node --test src/lib/wave-planning.test.cjs` | ❌ W0 | ⬜ pending |
| 30-01-03 | 01 | 1 | PLAN-03 | unit | `node --test src/lib/wave-planning.test.cjs` | ❌ W0 | ⬜ pending |
| 30-01-04 | 01 | 1 | PLAN-04 | unit | `node --test src/lib/wave-planning.test.cjs` | ❌ W0 | ⬜ pending |
| 30-02-01 | 02 | 1 | PLAN-05 | manual-only | N/A — skill-level AskUserQuestion flow | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/modules/roles/role-plan-verifier.md` — new role module for plan verification agent
- [ ] Agent registration in `src/bin/rapid-tools.cjs` ROLE_* maps — `plan-verifier` entry
- [ ] Tests for file conflict detection and implementability check helpers in `src/lib/wave-planning.test.cjs`
- [ ] Integration test: `build-agents` generates `agents/rapid-plan-verifier.md`

*Wave 0 creates the agent infrastructure and test stubs before verification logic is implemented.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Coverage check via semantic analysis | PLAN-01 | LLM agent reasoning — cannot be unit tested | Run `/rapid:wave-plan` on a wave with intentionally missing coverage; verify VERIFICATION-REPORT.md identifies gaps |
| FAIL gate with re-plan/override/cancel | PLAN-05 | Skill-level AskUserQuestion interaction flow | Run `/rapid:wave-plan` on a wave with file conflicts; verify FAIL gate presents options and re-plan targets only failing jobs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
