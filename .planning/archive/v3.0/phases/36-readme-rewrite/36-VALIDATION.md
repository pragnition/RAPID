---
phase: 36
slug: readme-rewrite
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual validation (documentation phase) |
| **Config file** | N/A |
| **Quick run command** | Visual inspection of rendered README |
| **Full suite command** | Cross-reference each command row against `skills/<name>/SKILL.md` description frontmatter |
| **Estimated runtime** | ~30 seconds (manual review) |

---

## Sampling Rate

- **After every task commit:** Review rendered Markdown locally
- **After every plan wave:** Push to branch and view on GitHub
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 36-01-01 | 01 | 1 | DOC-01 | manual-only | Cross-reference command table against SKILL.md files | N/A | ⬜ pending |
| 36-01-02 | 01 | 1 | DOC-02 | manual-only | Visual inspection of architecture diagram and quick start | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

No test infrastructure needed for a documentation-only phase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| README.md accurately describes all capabilities through v2.2 | DOC-01 | Documentation correctness requires human judgment | Cross-reference each command row against `skills/<name>/SKILL.md` frontmatter description; verify subagent merge delegation is mentioned |
| Quick start walkthrough covers init through cleanup | DOC-02 | Workflow completeness requires reading comprehension | Walk through each step; verify command names match skill names; verify greenfield/brownfield paths are both present |
| Architecture diagram renders correctly | DOC-02 | Visual rendering is browser/font dependent | Push to branch, view on GitHub, verify box-drawing characters align |
| Command argument syntax is correct | DOC-01 | Argument syntax must match SKILL.md parsing | For each command row, verify arguments exist in the skill's argument parsing code |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
