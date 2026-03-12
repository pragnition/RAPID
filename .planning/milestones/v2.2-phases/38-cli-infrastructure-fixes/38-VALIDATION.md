---
phase: 38
slug: cli-infrastructure-fixes
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
| **Framework** | node:test (Node.js built-in, v25.8.0) |
| **Config file** | none — built-in, no config needed |
| **Quick run command** | `node --test src/lib/display.test.cjs src/lib/quick.test.cjs` |
| **Full suite command** | `node --test src/lib/*.test.cjs src/bin/*.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/display.test.cjs src/lib/quick.test.cjs`
- **After every plan wave:** Run `node --test src/lib/*.test.cjs src/bin/*.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | FIX-03a | unit | `node --test src/lib/display.test.cjs` | ✅ (needs update: 8→10 stages) | ⬜ pending |
| 38-01-02 | 01 | 1 | FIX-04a | unit | `node --test src/lib/display.test.cjs` | ✅ (needs update: 8→10 stages) | ⬜ pending |
| 38-01-03 | 01 | 1 | FIX-03b | unit | `node --test src/lib/quick.test.cjs` | ✅ (library-level exists, CLI-level needed) | ⬜ pending |
| 38-01-04 | 01 | 1 | FIX-03c | unit | `node --test src/lib/quick.test.cjs` | ✅ (library-level exists, CLI-level needed) | ⬜ pending |
| 38-01-05 | 01 | 1 | FIX-04b | manual | Read SKILL.md, verify no `display status` | N/A (prose fix) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/display.test.cjs` — update stage count from 8 to 10, add migrate/quick to all stage lists
- [ ] CLI-level test for `handleQuick add` with --commit/--dir flags (add to quick.test.cjs or rapid-tools.test.cjs)

*Existing infrastructure covers framework and fixture needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| migrate SKILL.md Step 7 uses valid subcommand | FIX-04b | Prose content in .md file, not runtime code | Read skills/migrate/SKILL.md, confirm no `display status` call |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
