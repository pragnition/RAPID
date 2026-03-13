---
phase: 17
slug: dependency-audit-and-adapter-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node 18+) |
| **Config file** | None needed — uses `node --test` runner |
| **Quick run command** | `node --test src/lib/state-machine.test.cjs` |
| **Full suite command** | `node --test src/lib/*.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/lib/state-machine.test.cjs`
- **After every plan wave:** Run `node --test src/lib/*.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | STATE-04a | Documentation | Manual verification of dependency map | N/A | ⬜ pending |
| 17-01-02 | 01 | 1 | STATE-04b | Integration | `node -e "try{require('./src/lib/state.cjs');process.exit(1)}catch{}"` | ❌ W0 | ⬜ pending |
| 17-01-03 | 01 | 1 | STATE-04c | Integration | `node --test src/lib/state-machine.test.cjs` | ✅ | ⬜ pending |
| 17-01-04 | 01 | 1 | STATE-04d | Unit | `node --test src/lib/init.test.cjs` | ✅ (needs update) | ⬜ pending |
| 17-01-05 | 01 | 1 | STATE-04e | Integration | `node --test src/lib/state-machine.lifecycle.test.cjs` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Update `src/lib/init.test.cjs` — verify STATE.json is created during scaffolding
- [ ] Create integration test verifying state.cjs is fully removed and no modules import it
- [ ] Update rapid-tools.cjs CLI tests (if any) to test new hierarchy-aware state commands

*Existing test infrastructure covers most phase requirements — Wave 0 fills gaps.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dependency map completeness | STATE-04a | Documentation artifact, not code behavior | Review 17-DEPENDENCY-MAP.md against actual module imports via grep |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
