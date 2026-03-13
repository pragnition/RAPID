---
phase: 16
slug: state-machine-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node.js 20+) |
| **Config file** | none — tests run via `node --test src/lib/*.test.cjs` |
| **Quick run command** | `node --test src/lib/state-machine.test.cjs src/lib/state-schemas.test.cjs src/lib/state-transitions.test.cjs` |
| **Full suite command** | `node --test src/lib/*.test.cjs` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/state-machine.test.cjs src/lib/state-schemas.test.cjs src/lib/state-transitions.test.cjs`
- **After every plan wave:** Run `node --test src/lib/*.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 0 | STATE-01 | unit | `node --test src/lib/state-schemas.test.cjs` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 0 | STATE-02 | unit | `node --test src/lib/state-transitions.test.cjs` | ❌ W0 | ⬜ pending |
| 16-01-03 | 01 | 0 | STATE-01, UX-03 | unit | `node --test src/lib/state-machine.test.cjs` | ❌ W0 | ⬜ pending |
| 16-01-04 | 01 | 1 | STATE-01 | unit | `node --test src/lib/state-schemas.test.cjs` | ❌ W0 | ⬜ pending |
| 16-01-05 | 01 | 1 | STATE-02 | unit | `node --test src/lib/state-transitions.test.cjs` | ❌ W0 | ⬜ pending |
| 16-01-06 | 01 | 1 | STATE-01, UX-03 | unit | `node --test src/lib/state-machine.test.cjs` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | STATE-03 | unit | `node --test src/lib/dag.test.cjs` | ✅ | ⬜ pending |
| 16-02-02 | 02 | 1 | STATE-05 | unit | `node --test src/lib/returns.test.cjs` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/state-schemas.test.cjs` — stubs for STATE-01 schema validation
- [ ] `src/lib/state-transitions.test.cjs` — stubs for STATE-02 transition enforcement
- [ ] `src/lib/state-machine.test.cjs` — stubs for STATE-01 read/write, UX-03 corruption detection
- [ ] `zod@3.24.4` installation — `npm install zod@3.24.4`
- [ ] `.planning/.gitignore` entry for `STATE.json.tmp`

*Existing `src/lib/dag.test.cjs` and `src/lib/returns.test.cjs` cover STATE-03 and STATE-05.*

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
