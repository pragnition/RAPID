---
phase: 31
slug: wave-orchestration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node.js v25.8.0) |
| **Config file** | None — uses `node --test` directly |
| **Quick run command** | `node --test src/lib/display.test.cjs src/lib/dag.test.cjs` |
| **Full suite command** | `node --test src/lib/*.test.cjs src/bin/*.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/display.test.cjs src/lib/dag.test.cjs`
- **After every plan wave:** Run `node --test src/lib/*.test.cjs src/bin/*.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 1 | WAVE-02 | unit | `node --test src/lib/dag.test.cjs` | ✅ | ⬜ pending |
| 31-01-02 | 01 | 1 | WAVE-02 | unit | `node --test src/lib/build-agents.test.cjs` | ✅ | ⬜ pending |
| 31-01-03 | 01 | 1 | WAVE-01 | unit | `node --test src/lib/state-transitions.test.cjs` | ✅ | ⬜ pending |
| 31-01-04 | 01 | 1 | ALL | unit | `node --test src/lib/display.test.cjs` | ✅ | ⬜ pending |
| 31-02-01 | 02 | 1 | WAVE-01 | manual-only | N/A | N/A | ⬜ pending |
| 31-02-02 | 02 | 1 | WAVE-02 | manual-only | N/A | N/A | ⬜ pending |
| 31-02-03 | 02 | 1 | WAVE-03 | manual-only | N/A | N/A | ⬜ pending |
| 31-02-04 | 02 | 2 | WAVE-04 | manual-only | N/A | N/A | ⬜ pending |
| 31-02-05 | 02 | 2 | WAVE-04 | unit | `node --test src/bin/rapid-tools.test.cjs` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New test cases in `src/lib/display.test.cjs` for `plan-set` stage rendering
- [ ] New test cases in `src/lib/build-agents.test.cjs` for `wave-analyzer` agent registration
- [ ] New test cases in `src/bin/rapid-tools.test.cjs` for `--retry-wave` flag parsing

*Existing test infrastructure covers remaining requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Plan-set iterates waves, calls pipeline per wave | WAVE-01 | Skill is a Markdown orchestrator executed by Claude Code — not a programmatic function | Run `/rapid:plan-set 1` on a 2-wave set and verify both waves planned |
| Wave analyzer dependency detection | WAVE-02 | LLM agent — output depends on model inference | Run analyzer on set with known overlapping waves, verify dependency graph |
| Sequential planning with predecessor artifacts | WAVE-03 | Skill orchestration flow — requires full Claude Code execution | Plan a set with dependent waves, verify wave-2 planner receives wave-1 artifacts |
| Execute auto-advance on PASS/PASS_WITH_WARNINGS | WAVE-04 | Skill modification — requires full execute pipeline | Run `/rapid:execute` on multi-wave set, verify no approval gate between PASS waves |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
