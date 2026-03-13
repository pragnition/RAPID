---
phase: 41
slug: build-pipeline-generated-agents
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node:test) |
| **Config file** | None (uses node --test directly) |
| **Quick run command** | `node --test src/lib/build-agents.test.cjs` |
| **Full suite command** | `node --test src/lib/build-agents.test.cjs src/lib/tool-docs.test.cjs src/lib/teams.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/build-agents.test.cjs src/lib/tool-docs.test.cjs`
- **After every plan wave:** Run `node --test src/lib/build-agents.test.cjs src/lib/tool-docs.test.cjs src/lib/teams.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 41-01-01 | 01 | 1 | AGENT-03 | unit | `node --test src/lib/build-agents.test.cjs` | ✅ (needs update) | ⬜ pending |
| 41-01-02 | 01 | 1 | AGENT-03 | unit | `node --test src/lib/build-agents.test.cjs` | ❌ W0 | ⬜ pending |
| 41-01-03 | 01 | 1 | AGENT-04 | unit | `node --test src/lib/build-agents.test.cjs` | ❌ W0 | ⬜ pending |
| 41-01-04 | 01 | 1 | AGENT-04 | unit | `node --test src/lib/build-agents.test.cjs` | ❌ W0 | ⬜ pending |
| 41-02-01 | 02 | 1 | AGENT-06 | unit | `node --test src/lib/build-agents.test.cjs` | ❌ W0 | ⬜ pending |
| 41-02-02 | 02 | 1 | AGENT-06 | unit | `node --test src/lib/tool-docs.test.cjs` | ✅ (needs update) | ⬜ pending |
| 41-03-01 | 03 | 1 | -- | unit | `node --test src/lib/build-agents.test.cjs src/lib/tool-docs.test.cjs` | ✅ (needs update) | ⬜ pending |
| 41-03-02 | 03 | 1 | -- | unit | `node --test src/lib/teams.test.cjs` | ✅ (needs update) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Update `ALL_31_ROLES` array in `build-agents.test.cjs` -> `ALL_27_ROLES` (remove 5, add 1)
- [ ] Update `EXPECTED_ROLE_CORE_MAP` in `build-agents.test.cjs` (remove 5, add 1)
- [ ] Update `generates exactly 31 .md files` assertion -> 27
- [ ] Add tests for SKIP_GENERATION behavior (core agents skipped, stubs written)
- [ ] Add tests for stub file format (STUB comment, frontmatter, tools, placeholder role)
- [ ] Update `tool-docs.test.cjs` expected roles list (remove wave-planner, job-planner, wave-analyzer, job-executor)
- [ ] Update `tool-docs.test.cjs` excluded roles list (remove wave-researcher, add research-ux)
- [ ] Update `teams.test.cjs` to remove job-executor agent registration tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Init skill spawns 6 researchers | AGENT-06 | Skill is markdown read by Claude Code, not executable code | Verify SKILL.md Step 7 has 6 spawn blocks and Step 8 lists 6 files |
| Synthesizer reads 6 files | AGENT-06 | Role module is prompt text, not executable | Verify role-research-synthesizer.md references 6 inputs including UX.md |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
