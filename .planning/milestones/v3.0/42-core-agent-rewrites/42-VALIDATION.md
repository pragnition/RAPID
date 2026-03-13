---
phase: 42
slug: core-agent-rewrites
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node:test`) |
| **Config file** | none — tests run directly |
| **Quick run command** | `node --test src/lib/build-agents.test.cjs` |
| **Full suite command** | `node --test src/lib/build-agents.test.cjs src/lib/merge.test.cjs src/lib/tool-docs.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/build-agents.test.cjs`
- **After every plan wave:** Run `node --test src/lib/build-agents.test.cjs src/lib/merge.test.cjs src/lib/tool-docs.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 42-01-01 | 01 | 1 | AGENT-04a | unit | `node --test src/lib/build-agents.test.cjs` | Exists (needs update) | ⬜ pending |
| 42-01-02 | 01 | 1 | AGENT-04b | unit | `node --test src/lib/build-agents.test.cjs` | Exists | ⬜ pending |
| 42-01-03 | 01 | 1 | AGENT-04c | unit | `node --test src/lib/build-agents.test.cjs src/lib/tool-docs.test.cjs` | Exists (needs update) | ⬜ pending |
| 42-01-04 | 01 | 1 | AGENT-04d | unit | `node --test src/lib/merge.test.cjs` | Exists | ⬜ pending |
| 42-01-05 | 01 | 1 | AGENT-04e | unit | `node --test src/lib/build-agents.test.cjs` | Needs new test | ⬜ pending |
| 42-01-06 | 01 | 1 | AGENT-04f | unit | `node --test src/lib/build-agents.test.cjs` | Exists (needs count update) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Update `build-agents.test.cjs` assertions: 27 -> 26 roles, 5 -> 4 core agents, remove orchestrator from ALL_27_ROLES and EXPECTED_ROLE_CORE_MAP
- [ ] Update `build-agents.test.cjs` STUB comment assertion to expect new CORE comment
- [ ] Update `build-agents.test.cjs` "Phase 42 TODO" assertion to verify role content exists (not TODO)
- [ ] Add assertion that core-identity.md contains v3 workflow terms (plan-set, execute-set, start-set)
- [ ] Update `tool-docs.test.cjs` expected roles to exclude orchestrator
- [ ] Verify size limit test handles 12KB cap correctly

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GUIDED classification feels right in practice | AGENT-04 | Subjective agent behavior | Spawn each core agent via its skill and verify it follows guidance without being overly rigid |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
