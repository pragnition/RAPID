---
phase: 34
slug: core-merge-subagent-delegation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node:test) |
| **Config file** | None (uses node --test directly) |
| **Quick run command** | `node --test src/lib/merge.test.cjs` |
| **Full suite command** | `node --test src/lib/*.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/merge.test.cjs`
- **After every plan wave:** Run `node --test src/lib/*.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 34-01-01 | 01 | 1 | MERGE-01 | unit | `node --test src/lib/merge.test.cjs` (role file existence) | ❌ W0 | ⬜ pending |
| 34-01-02 | 01 | 1 | MERGE-01 | unit | `node --test src/lib/merge.test.cjs` (agent registration) | ❌ W0 | ⬜ pending |
| 34-01-03 | 01 | 1 | MERGE-01 | manual | Manual: run `/rapid:merge` and observe subagent spawn | N/A | ⬜ pending |
| 34-01-04 | 01 | 1 | MERGE-01 | manual | Manual: observe "[fast path]" for clean merges | N/A | ⬜ pending |
| 34-02-01 | 02 | 1 | MERGE-02 | unit | `node --test src/lib/merge.test.cjs` (parseSetMergerReturn) | ✅ Phase 33 | ⬜ pending |
| 34-02-02 | 02 | 1 | MERGE-02 | unit | `node --test src/lib/merge.test.cjs` (COMPLETE return parsed) | ✅ Phase 33 | ⬜ pending |
| 34-02-03 | 02 | 1 | MERGE-02 | manual | Manual: observe retry on CHECKPOINT return | N/A | ⬜ pending |
| 34-03-01 | 03 | 1 | MERGE-03 | manual | Manual: observe wave continues with remaining sets | N/A | ⬜ pending |
| 34-03-02 | 03 | 1 | MERGE-03 | manual | Manual: observe AskUserQuestion recovery prompt | N/A | ⬜ pending |
| 34-04-01 | 01 | 1 | MERGE-01 | unit | `node --test src/lib/merge.test.cjs` (agentPhase1 transitions) | ❌ W0 | ⬜ pending |
| 34-04-02 | 01 | 1 | MERGE-01 | unit | `node --test src/lib/merge.test.cjs` (prepareMergerContext) | ✅ Phase 33 | ⬜ pending |
| 34-04-03 | 01 | 1 | MERGE-01 | unit | `node --test src/lib/merge.test.cjs` (compressResult ~100 tokens) | ✅ Phase 33 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/merge.test.cjs` — add tests for build-agents registration of set-merger (ROLE_CORE_MAP entry exists)
- [ ] `src/lib/merge.test.cjs` — add tests for agentPhase1 update via update-status CLI
- [ ] `src/lib/merge.test.cjs` — add tests for `merge prepare-context` CLI subcommand
- [ ] Verify `role-set-merger.md` exists after build-agents run
- [ ] Verify `rapid-set-merger.md` generated with correct tools/color/description

*Existing Phase 33 infrastructure covers: prepareMergerContext, parseSetMergerReturn, compressResult*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Subagent spawns as distinct agent in Claude Code UI | MERGE-01 | Requires Claude Code runtime | Run `/rapid:merge`, observe separate agent instance |
| git merge-tree fast path skips subagent for clean merges | MERGE-01 | Requires real git repos with branches | Create clean merge scenario, observe "[fast path]" in output |
| CHECKPOINT return triggers auto-retry | MERGE-02 | Requires actual context exhaustion scenario | Force context limit, observe retry behavior |
| Blocked set does not block independent sets | MERGE-03 | Requires multi-set wave with one failure | Create failing set, observe other sets continue |
| Recovery options presented after wave | MERGE-03 | Requires UI interaction | After blocked set, verify AskUserQuestion shows recovery options |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
