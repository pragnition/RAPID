---
phase: 23
slug: merge-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 23 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node.js 18+) |
| **Config file** | none -- tests run directly with `node --test` |
| **Quick run command** | `node --test src/lib/merge.test.cjs` |
| **Full suite command** | `node --test src/lib/*.test.cjs` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/merge.test.cjs`
- **After every plan wave:** Run `node --test src/lib/*.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 23-01-F1 | 01 (TDD) | 1 | MERG-01, MERG-02, MERG-03, MERG-04 | unit | `node --test src/lib/merge.test.cjs` | W0 | pending |
| 23-02-01 | 02 | 1 | MERG-01, MERG-02 | smoke | `node -e "const a=require('./src/lib/assembler.cjs');const fm=a.generateFrontmatter('merger');if(!fm.includes('semantic conflict detection'))process.exit(1)"` | n/a | pending |
| 23-03-F1 | 03 (TDD) | 2 | MERG-05, MERG-06 | unit | `node --test src/lib/merge.test.cjs` | W0 | pending |
| 23-04-01 | 04 | 3 | MERG-01-06 | smoke | `node src/bin/rapid-tools.cjs merge 2>&1` | n/a | pending |
| 23-04-02 | 04 | 3 | MERG-01-06 | integration | `grep -c "AskUserQuestion" skills/merge/SKILL.md` | n/a | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/merge.test.cjs` -- complete rewrite with stubs for MERG-01 through MERG-06
- No new framework install needed -- node:test already used project-wide
- No new test infrastructure needed -- existing patterns (createMockProject, createGitProject) serve as templates

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Human escalation UX flow | MERG-02 (tier 4) | AskUserQuestion interaction cannot be automated | Trigger low-confidence resolution, verify prompt appears with conflict context |
| Semantic conflict detection accuracy | MERG-01 (level 5) | Requires agent judgment evaluation | Review merger agent output on known semantic conflicts |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
