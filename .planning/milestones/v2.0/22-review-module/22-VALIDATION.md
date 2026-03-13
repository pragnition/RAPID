---
phase: 22
slug: review-module
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, already used across 25+ test files) |
| **Config file** | none — existing infrastructure |
| **Quick run command** | `node --test src/lib/review.test.cjs` |
| **Full suite command** | `node --test src/lib/review.test.cjs src/lib/assembler.test.cjs` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/review.test.cjs`
- **After every plan wave:** Run `node --test src/lib/review.test.cjs src/lib/assembler.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | REVW-01, REVW-04, REVW-07, REVW-08 | unit (TDD) | `node --test src/lib/review.test.cjs` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 1 | REVW-02, REVW-03, REVW-05, REVW-06, REVW-08 | structural | `grep -l 'RAPID:RETURN' src/modules/roles/role-*.md \| wc -l` | ❌ W0 | ⬜ pending |
| 22-02-02 | 02 | 1 | REVW-02, REVW-09 | unit | `node --test src/lib/assembler.test.cjs` | ✅ exists | ⬜ pending |
| 22-03-01 | 03 | 2 | REVW-01, REVW-07 | unit | `node src/bin/rapid-tools.cjs review --help` | ❌ | ⬜ pending |
| 22-03-02 | 03 | 2 | REVW-07 | structural | `grep -c 'lean review' skills/execute/SKILL.md` | ❌ | ⬜ pending |
| 22-04-01 | 04 | 3 | REVW-01 through REVW-09 | structural | `wc -l skills/review/SKILL.md` | ❌ | ⬜ pending |
| 22-04-02 | 04 | 3 | All | checkpoint | human-verify | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/review.test.cjs` — TDD stub created by Plan 01 Task 1 (write tests first)

*Plan 01 uses TDD approach — test file is created as part of the task, serving as implicit Wave 0.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UAT human step prompts | REVW-06 | Requires developer interaction at terminal | 1. Run `/rapid:review --uat` 2. Verify human-tagged steps prompt in terminal 3. Confirm skip/complete options work |
| Playwright browser interaction | REVW-06 | Requires running browser with MCP | 1. Configure Playwright MCP 2. Run UAT with automated steps 3. Verify browser actions execute |
| HITL contested findings | REVW-04 | Requires developer judgment call | 1. Run bug hunt with contested finding 2. Verify judge escalates to developer 3. Confirm accept/dismiss works |
| Full pipeline end-to-end | REVW-01 | Requires built code to review | 1. Complete a phase execution 2. Run `/rapid:review` 3. Verify all 3 stages run in order |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
