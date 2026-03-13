---
phase: 26
slug: numeric-id-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` (Node 25.8) |
| **Config file** | none — uses `node --test` directly |
| **Quick run command** | `node --test src/lib/resolve.test.cjs` |
| **Full suite command** | `node --test src/lib/resolve.test.cjs src/lib/wave-planning.test.cjs src/lib/plan.test.cjs` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/resolve.test.cjs`
- **After every plan wave:** Run `node --test src/lib/resolve.test.cjs src/lib/wave-planning.test.cjs src/lib/plan.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | UX-01 | unit | `node --test src/lib/resolve.test.cjs` | ❌ W0 | ⬜ pending |
| 26-01-02 | 01 | 1 | UX-02 | unit | `node --test src/lib/resolve.test.cjs` | ❌ W0 | ⬜ pending |
| 26-01-03 | 01 | 1 | UX-03 | unit | `node --test src/lib/resolve.test.cjs` | ❌ W0 | ⬜ pending |
| 26-01-04 | 01 | 1 | UX-01 | integration | `node --test src/bin/rapid-tools.test.cjs` | ❌ W0 | ⬜ pending |
| 26-01-05 | 01 | 1 | UX-02 | integration | `node --test src/bin/rapid-tools.test.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/resolve.test.cjs` — unit tests for resolveSet() and resolveWave()
- [ ] Test fixtures: mock `.planning/sets/` directory structure with 3+ sets
- [ ] Test fixtures: mock STATE.json with sets containing waves

*Existing test infrastructure (node:test) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Skills show numeric IDs in suggestions | UX-01, UX-02 | SKILL.md prompt changes are tested via manual invocation | Run `/rapid:status` and verify indices appear inline |
| Backward compat with full string IDs | UX-03 | End-to-end skill invocation | Run `/rapid:discuss set-01-foundation` and verify it works |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
