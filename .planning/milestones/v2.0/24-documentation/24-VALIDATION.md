---
phase: 24
slug: documentation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual content verification (documentation phase) |
| **Config file** | none |
| **Quick run command** | `grep -c "##" DOCS.md` |
| **Full suite command** | `node ~/.claude/get-shit-done/bin/gsd-tools.cjs validate-docs 2>/dev/null || echo "manual review"` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `grep -c "##" DOCS.md` (verify section count growing)
- **After every plan wave:** Verify all required sections present in both DOCS.md and README.md
- **Before `/gsd:verify-work`:** Full content review against inventory
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | DOCS-01 | content | `grep -c "/rapid:" DOCS.md` | N/A | ⬜ pending |
| 24-01-02 | 01 | 1 | DOCS-01 | content | `grep -c "Agent Role" DOCS.md \|\| grep -c "agent" DOCS.md` | N/A | ⬜ pending |
| 24-02-01 | 02 | 1 | DOCS-02 | content | `grep -c "##" README.md` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. This is a documentation-only phase — no test framework installation needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DOCS.md covers all 17 commands | DOCS-01 | Content accuracy requires human review | Compare documented commands against skill inventory in research |
| DOCS.md covers all 26 agent roles | DOCS-01 | Content accuracy requires human review | Compare documented roles against role module inventory |
| DOCS.md covers state machine architecture | DOCS-01 | Architectural accuracy requires human review | Verify hierarchy, transitions, and schemas documented |
| README.md has getting started guide | DOCS-02 | UX quality requires human review | Walk through guide as a new user |
| README.md has Mark II hierarchy | DOCS-02 | Content accuracy requires human review | Verify Sets/Waves/Jobs hierarchy explained |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
