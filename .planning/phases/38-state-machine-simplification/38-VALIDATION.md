---
phase: 38
slug: state-machine-simplification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in) |
| **Config file** | none — tests run via `node --test <file>` |
| **Quick run command** | `node --test src/lib/state-schemas.test.cjs src/lib/state-transitions.test.cjs src/lib/state-machine.test.cjs src/lib/lock.test.cjs` |
| **Full suite command** | `node --test src/lib/state-schemas.test.cjs src/lib/state-transitions.test.cjs src/lib/state-machine.test.cjs src/lib/state-machine.lifecycle.test.cjs src/lib/lock.test.cjs` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/state-schemas.test.cjs src/lib/state-transitions.test.cjs src/lib/state-machine.test.cjs src/lib/lock.test.cjs`
- **After every plan wave:** Run `node --test src/lib/state-schemas.test.cjs src/lib/state-transitions.test.cjs src/lib/state-machine.test.cjs src/lib/state-machine.lifecycle.test.cjs src/lib/lock.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | STATE-01 | unit | `node --test src/lib/state-schemas.test.cjs` | Will rewrite | ⬜ pending |
| 38-01-02 | 01 | 1 | STATE-01 | unit | `node --test src/lib/state-schemas.test.cjs` | Will rewrite | ⬜ pending |
| 38-01-03 | 01 | 1 | STATE-01 | unit | `node --test src/lib/state-machine.test.cjs` | Will rewrite | ⬜ pending |
| 38-01-04 | 01 | 1 | STATE-02 | unit | `node --test src/lib/state-schemas.test.cjs` | Will rewrite | ⬜ pending |
| 38-01-05 | 01 | 1 | STATE-02 | unit | `node --test src/lib/state-transitions.test.cjs` | Will rewrite | ⬜ pending |
| 38-01-06 | 01 | 1 | STATE-02 | unit | `node --test src/lib/state-transitions.test.cjs` | Will rewrite | ⬜ pending |
| 38-02-01 | 02 | 1 | STATE-03 | unit | `node --test src/lib/state-machine.test.cjs` | Will rewrite | ⬜ pending |
| 38-02-02 | 02 | 1 | STATE-03 | unit | `node --test src/lib/state-machine.test.cjs` | Will rewrite | ⬜ pending |
| 38-02-03 | 02 | 1 | STATE-03 | unit | `node --test src/lib/state-machine.test.cjs` | Will rewrite | ⬜ pending |
| 38-02-04 | 02 | 1 | STATE-03 | unit | `node --test src/lib/state-machine.test.cjs` | Will rewrite | ⬜ pending |
| 38-02-05 | 02 | 1 | STATE-03 | unit | `node --test src/lib/lock.test.cjs` | Will add | ⬜ pending |
| 38-03-01 | 03 | 1 | STATE-04 | unit | `node --test src/lib/state-machine.test.cjs` | Will add | ⬜ pending |
| 38-03-02 | 03 | 1 | STATE-04 | unit | `node --test src/lib/state-machine.test.cjs` | Will rewrite | ⬜ pending |
| 38-04-01 | 04 | 1 | STATE-05 | unit | `node --test src/lib/state-machine.test.cjs` | Will rewrite | ⬜ pending |
| 38-04-02 | 04 | 1 | STATE-05 | unit | `node --test src/lib/state-transitions.test.cjs` | Will rewrite | ⬜ pending |
| 38-04-03 | 04 | 1 | STATE-05 | unit | `node --test src/lib/state-machine.test.cjs` | Will add | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. Test files exist and will be rewritten in-place with new test cases matching the simplified state machine. No new framework installation or configuration needed.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
