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
| **Quick run command** | `node --test tests/unit/review/*.test.js` |
| **Full suite command** | `node --test tests/unit/review/*.test.js tests/integration/review/*.test.js` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/unit/review/*.test.js`
- **After every plan wave:** Run `node --test tests/unit/review/*.test.js tests/integration/review/*.test.js`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | REVW-01 | unit | `node --test tests/unit/review/orchestrator.test.js` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 1 | REVW-02 | unit | `node --test tests/unit/review/scoping.test.js` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 1 | REVW-03 | unit | `node --test tests/unit/review/unit-test-agent.test.js` | ❌ W0 | ⬜ pending |
| 22-02-02 | 02 | 1 | REVW-04 | unit | `node --test tests/unit/review/bug-hunt.test.js` | ❌ W0 | ⬜ pending |
| 22-02-03 | 02 | 1 | REVW-05 | unit | `node --test tests/unit/review/bugfix.test.js` | ❌ W0 | ⬜ pending |
| 22-03-01 | 03 | 2 | REVW-06 | unit | `node --test tests/unit/review/uat-agent.test.js` | ❌ W0 | ⬜ pending |
| 22-03-02 | 03 | 2 | REVW-07 | integration | `node --test tests/integration/review/pipeline.test.js` | ❌ W0 | ⬜ pending |
| 22-03-03 | 03 | 2 | REVW-08 | integration | `node --test tests/integration/review/artifacts.test.js` | ❌ W0 | ⬜ pending |
| 22-03-04 | 03 | 2 | REVW-09 | integration | `node --test tests/integration/review/iteration.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/review/` — directory creation
- [ ] `tests/integration/review/` — directory creation
- [ ] `tests/unit/review/orchestrator.test.js` — stubs for REVW-01
- [ ] `tests/unit/review/scoping.test.js` — stubs for REVW-02
- [ ] `tests/unit/review/unit-test-agent.test.js` — stubs for REVW-03
- [ ] `tests/unit/review/bug-hunt.test.js` — stubs for REVW-04
- [ ] `tests/unit/review/bugfix.test.js` — stubs for REVW-05
- [ ] `tests/unit/review/uat-agent.test.js` — stubs for REVW-06
- [ ] `tests/integration/review/pipeline.test.js` — stubs for REVW-07
- [ ] `tests/integration/review/artifacts.test.js` — stubs for REVW-08
- [ ] `tests/integration/review/iteration.test.js` — stubs for REVW-09

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UAT human step prompts | REVW-06 | Requires developer interaction at terminal | 1. Run `/rapid:review --uat` 2. Verify human-tagged steps prompt in terminal 3. Confirm skip/complete options work |
| Playwright browser interaction | REVW-06 | Requires running browser with MCP | 1. Configure Playwright MCP 2. Run UAT with automated steps 3. Verify browser actions execute |
| HITL contested findings | REVW-04 | Requires developer judgment call | 1. Run bug hunt with contested finding 2. Verify judge escalates to developer 3. Confirm accept/dismiss works |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
