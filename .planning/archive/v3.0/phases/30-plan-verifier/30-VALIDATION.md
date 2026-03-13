---
phase: 30
slug: plan-verifier
status: draft
nyquist_compliant: true
wave_0_complete: true
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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 30-01-T1 | 01 | 1 | PLAN-01, PLAN-02, PLAN-03, PLAN-04 | manual-only | N/A — LLM agent role module (semantic content, not unit-testable) | pending |
| 30-01-T2 | 01 | 1 | PLAN-01, PLAN-02, PLAN-03, PLAN-04 | automated | `cd /home/kek/Projects/RAPID && node src/bin/rapid-tools.cjs build-agents && test -f agents/rapid-plan-verifier.md && head -6 agents/rapid-plan-verifier.md \| grep -q "rapid-plan-verifier" && echo "PASS" \|\| echo "FAIL"` | pending |
| 30-02-T1 | 02 | 2 | PLAN-04, PLAN-05 | manual-only | N/A — skill-level LLM agent orchestration + AskUserQuestion flow | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

No Wave 0 stubs are needed for this phase.

**Rationale:** Phase 30 creates a new LLM agent (role module + agent registration) and integrates it into a skill pipeline. The verification logic is entirely semantic (LLM reasoning about plan coverage, implementability, and consistency) -- not algorithmic code with testable helper functions. The `build-agents` command and ROLE_* map registration are verified by the automated commands in Plan 01 Task 2. The skill-level orchestration in Plan 02 is a Markdown instruction file, not executable code.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Role module covers all three verification dimensions with correct instructions | PLAN-01, PLAN-02, PLAN-03 | LLM agent role module -- content is natural language instructions, not executable code | Read `src/modules/roles/role-plan-verifier.md`; verify it has Coverage Check, Implementability Check, Consistency Check sections with correct logic |
| Agent spawning and verdict handling in wave-plan pipeline | PLAN-04, PLAN-05 | Skill-level agent orchestration -- Markdown instructions for Claude, not executable code | Run `/rapid:wave-plan` on a wave with intentionally missing coverage or file conflicts; verify VERIFICATION-REPORT.md is produced and FAIL gate presents re-plan/override/cancel |
| FAIL gate blocks state transition, PASS proceeds normally | PLAN-05 | State machine interaction requires live wave-plan execution | Run `/rapid:wave-plan` on a passing wave; verify state transitions to `planning`. Run on a failing wave with Cancel; verify state stays in `discussing` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are marked manual-only with rationale
- [x] Sampling continuity: manual-only tasks are sandwiched between automated checks
- [x] Wave 0 not needed -- no unit-testable helpers (pure LLM agent + skill pipeline)
- [x] No watch-mode flags
- [x] Feedback latency < 10s for automated checks
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
