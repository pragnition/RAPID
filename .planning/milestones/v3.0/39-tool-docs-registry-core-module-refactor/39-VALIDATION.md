---
phase: 39
slug: tool-docs-registry-core-module-refactor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node:test) v22+ |
| **Config file** | None — uses node --test directly |
| **Quick run command** | `node --test src/lib/tool-docs.test.cjs` |
| **Full suite command** | `node --test src/lib/build-agents.test.cjs src/lib/tool-docs.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/tool-docs.test.cjs`
- **After every plan wave:** Run `node --test src/lib/build-agents.test.cjs src/lib/tool-docs.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 1 | AGENT-01 | unit | `node --test src/lib/tool-docs.test.cjs` | ❌ W0 | ⬜ pending |
| 39-01-02 | 01 | 1 | AGENT-05 | unit | `node --test src/lib/tool-docs.test.cjs` | ❌ W0 | ⬜ pending |
| 39-01-03 | 01 | 1 | AGENT-05 | unit | `node --test src/lib/tool-docs.test.cjs` | ❌ W0 | ⬜ pending |
| 39-02-01 | 02 | 1 | AGENT-02 | integration | `node --test src/lib/build-agents.test.cjs` | ✅ needs update | ⬜ pending |
| 39-02-02 | 02 | 1 | AGENT-02 | unit | `node --test src/lib/tool-docs.test.cjs` | ❌ W0 | ⬜ pending |
| 39-03-01 | 03 | 1 | AGENT-01 | integration | `node --test src/lib/build-agents.test.cjs` | ✅ needs update | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/tool-docs.test.cjs` — stubs for AGENT-01, AGENT-05 (tool-docs module tests)
- [ ] `src/lib/build-agents.test.cjs` — update existing tests to reflect new 3-module core, 5-tag XML schema, tool injection (covers AGENT-02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Token count under 1000 per role | AGENT-01 | Heuristic only (chars/4) | Spot-check 3 roles with Claude tokenizer |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
