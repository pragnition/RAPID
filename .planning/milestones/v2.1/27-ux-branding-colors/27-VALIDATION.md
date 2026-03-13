---
phase: 27
slug: ux-branding-colors
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node:test`) |
| **Config file** | none — tests are standalone .cjs files |
| **Quick run command** | `node --test src/lib/display.test.cjs` |
| **Full suite command** | `node --test src/lib/display.test.cjs src/lib/assembler.test.cjs` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/display.test.cjs src/lib/assembler.test.cjs`
- **After every plan wave:** Run `node --test src/lib/*.test.cjs src/bin/*.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | UX-06 | unit | `node --test src/lib/display.test.cjs` | ❌ W0 | ⬜ pending |
| 27-01-02 | 01 | 1 | UX-06 | unit | `node --test src/lib/display.test.cjs` | ❌ W0 | ⬜ pending |
| 27-01-03 | 01 | 1 | UX-06 | unit | `node --test src/lib/display.test.cjs` | ❌ W0 | ⬜ pending |
| 27-01-04 | 01 | 1 | UX-06 | unit | `node --test src/bin/rapid-tools.test.cjs` | ✅ | ⬜ pending |
| 27-02-01 | 02 | 1 | UX-07 | unit | `node --test src/lib/assembler.test.cjs` | ✅ | ⬜ pending |
| 27-02-02 | 02 | 1 | UX-07 | unit | `node --test src/lib/assembler.test.cjs` | ✅ | ⬜ pending |
| 27-02-03 | 02 | 1 | UX-07 | unit | `node --test src/lib/assembler.test.cjs` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/display.test.cjs` — stubs for UX-06 (renderBanner unit tests)
- [ ] `src/lib/display.cjs` — new module (needed for tests to have something to test)

*Existing `assembler.test.cjs` covers UX-07 tests — modify existing file.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Banner visual appearance (colors, contrast) | UX-06 | Visual aesthetics cannot be unit tested | Run `node src/bin/rapid-tools.cjs display banner execute "Wave 1.1"` and confirm readability on dark/light terminal |
| Agent color badges in Claude Code UI | UX-07 | Requires Claude Code runtime | Assemble an agent, check `.claude/agents/` file has `color:` field, observe in Claude Code |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
