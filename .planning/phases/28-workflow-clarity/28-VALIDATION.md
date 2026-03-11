---
phase: 28
slug: workflow-clarity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in) |
| **Config file** | none |
| **Quick run command** | `node --test ~/Projects/RAPID/src/lib/resolve.test.cjs` |
| **Full suite command** | `node --test ~/Projects/RAPID/src/lib/resolve.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test ~/Projects/RAPID/src/lib/resolve.test.cjs`
- **After every plan wave:** Run `node --test ~/Projects/RAPID/src/lib/resolve.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 28-01-01 | 01 | 1 | FLOW-01 | unit | `node --test ~/Projects/RAPID/src/lib/resolve.test.cjs` | ❌ W0 | ⬜ pending |
| 28-01-02 | 01 | 1 | FLOW-01 | unit | `node --test ~/Projects/RAPID/src/lib/resolve.test.cjs` | ❌ W0 | ⬜ pending |
| 28-02-01 | 02 | 1 | FLOW-02 | manual | N/A -- Markdown propagation | N/A | ⬜ pending |
| 28-02-02 | 02 | 1 | FLOW-03 | manual | N/A -- Markdown edit | N/A | ⬜ pending |
| 28-02-03 | 02 | 1 | UX-04 | manual | N/A -- Markdown edit | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/resolve.test.cjs` — stubs for FLOW-01 (resolveWave --set flag)
- [ ] Existing test infrastructure covers remaining requirements

*Most changes are Markdown-only edits that don't require automated tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canonical workflow order in agent prompts | FLOW-02 | Markdown template propagation -- no runtime logic | Run `build-agents`, grep agent files for workflow section |
| Job granularity guidance in role modules | FLOW-03 | Markdown instruction -- no runtime logic | Read role-roadmapper.md and role-wave-planner.md, verify 2-4 jobs guidance |
| Next-step output at end of skills | UX-04 | Markdown skill instructions -- no runtime logic | Run each skill, verify next-step output printed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
