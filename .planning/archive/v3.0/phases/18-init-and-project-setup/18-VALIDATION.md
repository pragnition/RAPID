---
phase: 18
slug: init-and-project-setup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` (v25.8.0) |
| **Config file** | None needed — native to Node.js |
| **Quick run command** | `node --test src/lib/init.test.cjs` |
| **Full suite command** | `node --test src/lib/*.test.cjs src/bin/*.test.cjs` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/init.test.cjs`
- **After every plan wave:** Run `node --test src/lib/*.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | INIT-01 | unit | `node --test src/lib/init.test.cjs` | Exists (extend) | ⬜ pending |
| 18-01-02 | 01 | 1 | INIT-02 | unit | `node --test src/lib/init.test.cjs` | Needs new | ⬜ pending |
| 18-02-01 | 02 | 1 | INIT-03 | unit | `node --test src/lib/context.test.cjs` | Exists (extend) | ⬜ pending |
| 18-02-02 | 02 | 1 | INIT-04 | unit | `node --test src/lib/init.test.cjs` | Needs new | ⬜ pending |
| 18-02-03 | 02 | 1 | INIT-05 | unit | `node --test src/lib/init.test.cjs` | Needs new | ⬜ pending |
| 18-03-01 | 03 | 2 | INIT-06 | unit+integration | `node --test src/lib/init.test.cjs` | Needs new | ⬜ pending |
| 18-03-02 | 03 | 2 | INIT-07 | manual-only | N/A | N/A | ⬜ pending |
| 18-03-03 | 03 | 2 | INIT-08 | unit | `node --test src/lib/state-machine.test.cjs` | Needs new | ⬜ pending |
| 18-03-04 | 03 | 2 | UX-04 | manual-only | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/init.test.cjs` — extend with model selection, research dir creation, roadmap write tests
- [ ] `src/lib/state-machine.test.cjs` — extend with addMilestone/archiveMilestone tests
- [ ] `src/bin/rapid-tools.test.cjs` — extend with new init subcommand tests (research-dir, write-roadmap, etc.)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| /install preserves env var methodology | INIT-07 | Shell interaction required | Run `/rapid:install` in bash/zsh/fish, verify PATH and env vars are set correctly |
| /help shows Mark II commands | UX-04 | Static output verification | Run `/rapid:help`, verify commands grouped by lifecycle stage with new hierarchy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
