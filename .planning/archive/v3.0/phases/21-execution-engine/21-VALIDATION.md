---
phase: 21
slug: execution-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in) |
| **Config file** | none — uses node --test directly |
| **Quick run command** | `node --test src/lib/execute.test.cjs` |
| **Full suite command** | `node --test src/lib/*.test.cjs src/bin/*.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/execute.test.cjs`
- **After every plan wave:** Run `node --test src/lib/*.test.cjs src/bin/*.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | EXEC-01 | unit | `node --test src/lib/execute.test.cjs` | Partial | ⬜ pending |
| 21-01-02 | 01 | 1 | EXEC-02 | unit | `node --test src/lib/execute.test.cjs` | Partial | ⬜ pending |
| 21-01-03 | 01 | 1 | EXEC-03 | unit | `node --test src/lib/state-machine.test.cjs` | Yes | ⬜ pending |
| 21-01-04 | 01 | 1 | EXEC-04 | unit | `node --test src/lib/execute.test.cjs` | No | ⬜ pending |
| 21-01-05 | 01 | 1 | UX-02 | unit | `node --test src/lib/execute.test.cjs` | No | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/execute.test.cjs` — extend with job-level reconciliation tests (reconcileJob, reconcileWaveJobs)
- [ ] `src/lib/execute.test.cjs` — add job-level handoff generation/parsing tests
- [ ] `src/lib/execute.test.cjs` — add precondition validation tests (missing JOB-PLAN.md detection)
- [ ] `src/lib/execute.test.cjs` — add re-entry logic tests (skip complete, retry failed, handle stale executing)
- [ ] `src/lib/teams.test.cjs` — extend with job-level teammate config tests (buildJobTeammateConfig, waveJobTeamMeta)
- [ ] `src/lib/assembler.test.cjs` — add 'job-executor' role registration test
- [ ] `src/lib/execute.test.cjs` — add progress banner generation test

*Existing infrastructure covers framework install — node:test is built-in.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual progress banners render correctly in terminal | UX-02 | Formatting depends on terminal width/rendering | Run `/rapid:execute` and visually confirm banner layout |
| Parallel subagent dispatch works under real API load | EXEC-01 | Requires live Claude Code API interaction | Execute a multi-job wave and confirm parallel dispatch |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
