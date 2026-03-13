---
phase: 19
slug: set-lifecycle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node.js 18+) |
| **Config file** | none — uses built-in runner |
| **Quick run command** | `node --test src/lib/worktree.test.cjs` |
| **Full suite command** | `node --test src/lib/*.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/worktree.test.cjs`
- **After every plan wave:** Run `node --test src/lib/*.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | SETL-01 | unit | `node --test src/lib/worktree.test.cjs` | Partially | pending |
| 19-01-02 | 01 | 1 | SETL-02 | unit | `node --test src/lib/worktree.test.cjs` | Partially | pending |
| 19-01-03 | 01 | 1 | SETL-03 | manual-only | N/A (agent subagent) | N/A | pending |
| 19-02-01 | 02 | 1 | SETL-04 | unit | `node --test src/lib/worktree.test.cjs` | Partially | pending |
| 19-02-02 | 02 | 1 | SETL-05 | unit | `node --test src/lib/execute.test.cjs` | Partially | pending |
| 19-02-03 | 02 | 1 | SETL-06 | unit | `node --test src/lib/worktree.test.cjs` | Partially | pending |
| 19-02-04 | 02 | 1 | SETL-07 | unit | `node --test src/lib/context.test.cjs` | Yes | pending |
| 19-xx-xx | xx | x | UX-01 | manual-only | N/A (Claude tool) | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] New tests for STATE.json-based status reading in worktree.test.cjs
- [ ] New tests for set-init orchestration function (worktree create + scoped CLAUDE.md + registry update)
- [ ] New tests for /resume CLI command logic
- [ ] New tests for branch deletion function (if added to worktree.cjs)
- [ ] Verify existing generateHandoff/parseHandoff test coverage in execute.test.cjs

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Set planner produces SET-OVERVIEW.md | SETL-03 | Requires Agent tool subagent spawning | Run /set-init on a test set, verify SET-OVERVIEW.md created with approach summary |
| AskUserQuestion at decision gates | UX-01 | Requires Claude interactive tool | Run each lifecycle command, verify prompts appear at decision points |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
