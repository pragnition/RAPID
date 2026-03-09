---
phase: 25
slug: gsd-decontamination
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` (Node 18+) |
| **Config file** | None — tests are self-contained `.test.cjs` files |
| **Quick run command** | `node --test src/lib/init.test.cjs` |
| **Full suite command** | `node --test src/lib/init.test.cjs && node --test src/lib/assembler.test.cjs` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/init.test.cjs`
- **After every plan wave:** Run `node --test src/lib/init.test.cjs && node --test src/lib/assembler.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 0 | CLEAN-01 | unit | `node --test src/lib/init.test.cjs` | ❌ W0 | ⬜ pending |
| 25-01-02 | 01 | 1 | CLEAN-01 | unit | `node --test src/lib/init.test.cjs` | ✅ (update) | ⬜ pending |
| 25-01-03 | 01 | 1 | CLEAN-01 | unit | `grep -c rapid_state_version test/.planning/STATE.md` | ✅ (update) | ⬜ pending |
| 25-01-04 | 01 | 1 | CLEAN-01 | unit | `node --test src/lib/init.test.cjs` | ❌ W0 | ⬜ pending |
| 25-02-01 | 02 | 1 | CLEAN-01 | shell | `git log --oneline .archive/` | N/A | ⬜ pending |
| 25-02-02 | 02 | 1 | CLEAN-02 | unit | `node --test src/lib/assembler.test.cjs` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Migration function tests in `src/bin/rapid-tools.test.cjs` or inline:
  - Test: migration rewrites `gsd_state_version` to `rapid_state_version`
  - Test: migration preserves version number
  - Test: migration is no-op when `rapid_state_version` already present
  - Test: migration is no-op when STATE.md does not exist
  - Test: migration does not corrupt other STATE.md content

*Existing infrastructure covers CLEAN-02 (assembler tests already passing).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Running any skill shows `rapid-{role}` in Claude Code UI | CLEAN-02 | Requires visual inspection of Claude Code agent label | Run `/rapid:status` and verify agent spinner shows `rapid-*` name |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
