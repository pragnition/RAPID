---
phase: 25
slug: gsd-decontamination
status: draft
nyquist_compliant: true
wave_0_complete: true
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
| **Full suite command** | `node --test src/lib/init.test.cjs && node --test src/bin/rapid-tools.test.cjs && node --test src/lib/assembler.test.cjs` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/init.test.cjs`
- **After every plan wave:** Run `node --test src/lib/init.test.cjs && node --test src/bin/rapid-tools.test.cjs && node --test src/lib/assembler.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-01-T1 | 01 | 1 | CLEAN-01 | unit | `node --test src/lib/init.test.cjs` | ✅ (update) | ⬜ pending |
| 25-01-T1 | 01 | 1 | CLEAN-01 | fixture | `grep -c 'rapid_state_version: 1.0' test/.planning/STATE.md` | ✅ (update) | ⬜ pending |
| 25-01-T2 | 01 | 1 | CLEAN-01 | unit | `node --test src/bin/rapid-tools.test.cjs` | ✅ (extend) | ⬜ pending |
| 25-01-T2 | 01 | 1 | CLEAN-01 | shell | `test -d .archive/mark2-plans && test -d .archive/review` | N/A | ⬜ pending |
| 25-01-T2 | 01 | 1 | CLEAN-02 | unit | `node --test src/lib/assembler.test.cjs` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Note:** Migration function tests (migrateStateVersion) are created inline via TDD in Plan 01 Task 2. They are added as a new `describe` block in the existing `src/bin/rapid-tools.test.cjs` file (which already contains handleAssembleAgent tests). No separate Wave 0 plan is needed.

---

## Wave 0 Requirements

All Wave 0 gaps are covered inline by Plan 01's TDD tasks:

- [x] Migration function tests in `src/bin/rapid-tools.test.cjs` (Plan 01, Task 2 — TDD Red phase creates these before implementation):
  - Test: migration rewrites `gsd_state_version` to `rapid_state_version`
  - Test: migration preserves version number
  - Test: migration is no-op when `rapid_state_version` already present
  - Test: migration is no-op when STATE.md does not exist
  - Test: migration does not corrupt other STATE.md content
  - Test: migration is no-op when .planning/ directory does not exist

*Existing infrastructure covers CLEAN-02 (assembler tests already passing).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Running any skill shows `rapid-{role}` in Claude Code UI | CLEAN-02 | Requires visual inspection of Claude Code agent label | Run `/rapid:status` and verify agent spinner shows `rapid-*` name |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (handled inline by TDD tasks)
- [x] No watch-mode flags
- [x] Feedback latency < 3s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
