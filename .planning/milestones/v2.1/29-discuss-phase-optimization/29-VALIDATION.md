---
phase: 29
slug: discuss-phase-optimization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node.js 18+) |
| **Config file** | None — uses node --test directly |
| **Quick run command** | `node --test ~/Projects/RAPID/src/lib/*.test.cjs` |
| **Full suite command** | `node --test ~/Projects/RAPID/src/lib/*.test.cjs` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** `grep -c "Round 1\|Round 2\|Interaction 1\|Interaction 2" ~/Projects/RAPID/skills/discuss/SKILL.md` (verify round structure exists)
- **After every plan wave:** Manual review of SKILL.md structure
- **Before `/gsd:verify-work`:** Full SKILL.md read-through verifying all 8 steps are intact and Step 5 uses the 2-round model
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | UX-05 | manual-only | Verify SKILL.md contains master toggle instruction | N/A | ⬜ pending |
| 29-01-02 | 01 | 1 | UX-05 | manual-only | Verify SKILL.md Step 5 describes Round 1 and Round 2 | N/A | ⬜ pending |
| 29-01-03 | 01 | 1 | UX-05 | manual-only | Verify SKILL.md instructions specify 2 interactions per area | N/A | ⬜ pending |
| 29-01-04 | 01 | 1 | UX-05 | manual-only | Verify SKILL.md explicitly states Round 2 runs for delegated areas | N/A | ⬜ pending |
| 29-01-05 | 01 | 1 | UX-05 | manual-only | `grep "empirical spike" .planning/STATE.md` returns no matches | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This phase has no automated tests because the changes are purely Markdown instruction files. Verification is structural (grep for expected content) and manual (read-through).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Step 4 has "Let Claude decide all" master toggle | UX-05 | Markdown instruction, not code | Read SKILL.md Step 4, verify master toggle option present |
| Step 5 uses 2-round structure | UX-05 | Markdown instruction, not code | Read SKILL.md Step 5, verify Round 1 and Round 2 structure |
| Each gray area gets exactly 2 interactions | UX-05 | Markdown instruction, not code | Read SKILL.md, verify "2 interactions per area" constraint stated |
| Round 2 always runs for delegated areas | UX-05 | Markdown instruction, not code | Read SKILL.md, verify explicit "always runs" instruction for delegated areas |
| STATE.md spike blocker removed | UX-05 | One-time cleanup | `grep "empirical spike" .planning/STATE.md` should return no matches |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
