---
phase: 35
slug: adaptive-conflict-resolution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node:test) |
| **Config file** | None — uses `node --test` directly |
| **Quick run command** | `node --test --test-name-pattern="agentPhase2\|resolver\|routeEscalation\|isApiSignature\|generateConflictId" src/lib/merge.test.cjs` |
| **Full suite command** | `node --test src/lib/merge.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test --test-name-pattern="agentPhase2\|resolver\|routeEscalation\|isApiSignature\|generateConflictId" src/lib/merge.test.cjs`
- **After every plan wave:** Run `node --test src/lib/merge.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 35-01-01 | 01 | 0 | MERGE-06 | unit | `node --test --test-name-pattern="agentPhase2.*map" src/lib/merge.test.cjs` | ❌ W0 | ⬜ pending |
| 35-01-02 | 01 | 0 | MERGE-06 | unit | `node --test --test-name-pattern="routeEscalation" src/lib/merge.test.cjs` | ❌ W0 | ⬜ pending |
| 35-01-03 | 01 | 0 | MERGE-06 | unit | `node --test --test-name-pattern="prepareResolverContext" src/lib/merge.test.cjs` | ❌ W0 | ⬜ pending |
| 35-01-04 | 01 | 0 | MERGE-06 | unit | `node --test --test-name-pattern="parseConflictResolverReturn" src/lib/merge.test.cjs` | ❌ W0 | ⬜ pending |
| 35-01-05 | 01 | 0 | MERGE-06 | unit | `node --test --test-name-pattern="isApiSignatureConflict" src/lib/merge.test.cjs` | ❌ W0 | ⬜ pending |
| 35-01-06 | 01 | 0 | MERGE-06 | unit | `node --test --test-name-pattern="generateConflictId" src/lib/merge.test.cjs` | ❌ W0 | ⬜ pending |
| 35-02-01 | 02 | 1 | MERGE-06 | smoke | `node ~/Projects/RAPID/src/bin/rapid-tools.cjs build-agents && test -f agents/rapid-conflict-resolver.md` | ❌ W0 | ⬜ pending |
| 35-03-01 | 03 | 2 | MERGE-06 | manual-only | N/A — SKILL.md is a markdown prompt | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Update existing agentPhase2 tests (lines 1722-1756, 1830-1843) to use object map shape instead of enum string
- [ ] Add new test group: `routeEscalation` — tests for confidence band + API-signature routing
- [ ] Add new test group: `prepareResolverContext` — tests for resolver launch briefing assembly
- [ ] Add new test group: `parseConflictResolverReturn` — tests for resolver return parsing
- [ ] Add new test group: `isApiSignatureConflict` — tests for API detection cross-reference
- [ ] Add new test group: `generateConflictId` — tests for conflict ID generation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Step 3e in SKILL.md references correct routing and dispatch pattern | MERGE-06 | SKILL.md is a markdown prompt, not executable code | Review SKILL.md Step 3e for correct confidence band routing (0.3-0.8), API-signature bypass, and resolver dispatch pattern |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
