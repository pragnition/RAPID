# SET-OVERVIEW: audit-version

## Approach

This set introduces a new read-only analysis command, `/rapid:audit-version`, that evaluates whether a completed milestone actually delivered on its planned requirements. The command reads ROADMAP.md, REQUIREMENTS.md, and STATE.json to build a picture of what was planned, then cross-references against actual set completion status and delivered artifacts to identify gaps. The output is a structured gap report written to `.planning/v{version}-AUDIT.md`.

The implementation follows RAPID's standard skill + role-module pattern: a SKILL.md drives the interactive flow, and a role-auditor.md provides the agent identity for analysis subagent work. A key architectural constraint is that the command is strictly read-only -- it never mutates STATE.json. When gaps are found, it offers remediation through the existing `/rapid:add-set` command or allows deferral with carry-forward context for the next version.

For milestones with many sets (5+), a two-pass strategy keeps context usage manageable: first a summary scan across all sets to flag potential gaps, then targeted deep-dives only on flagged sets.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| skills/audit-version/SKILL.md | Main skill defining the /rapid:audit-version workflow | New |
| src/modules/roles/role-auditor.md | Agent role module for the auditor persona | New |
| src/lib/display.cjs | Banner rendering -- needs `audit-version` stage entry | Existing (modify) |

## Integration Points

- **Exports:**
  - `/rapid:audit-version [version]` CLI command -- invocable by the user after a milestone ships
  - `.planning/v{version}-AUDIT.md` -- structured gap report artifact
- **Imports:**
  - `STATE.json` (baseline) -- reads milestone/set status to determine completion state
  - `ROADMAP.md` (baseline) -- reads planned scope per set for comparison
  - `REQUIREMENTS.md` (baseline) -- reads acceptance criteria for traceability
  - `/rapid:add-set` (baseline) -- existing command offered for remediation when gaps are found
- **Side Effects:** Writes a single new file (the audit report). No state mutations.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Context window overflow on large milestones (10+ sets) | High | Two-pass approach: summary scan first, deep-dive only on flagged sets |
| REQUIREMENTS.md may not exist for older milestones | Medium | Graceful fallback to ROADMAP.md-only analysis with warning in report |
| Acceptance criteria phrasing is ambiguous / hard to match automatically | Medium | Agent-driven semantic matching rather than exact string comparison |
| display.cjs modification conflicts with other sets | Low | Minimal change (add two map entries); all v4.2.0 sets are independent |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- Create role-auditor.md, create SKILL.md skeleton with environment setup and banner, add display.cjs stage entry for `audit-version`
- **Wave 2:** Core analysis -- Implement gap analysis logic (read state/roadmap/requirements, cross-reference planned vs delivered, classify as covered/uncovered/partial)
- **Wave 3:** Remediation and output -- Implement audit report generation (.planning/v{version}-AUDIT.md), remediation offer via /rapid:add-set, deferral with carry-forward context, two-pass optimization for large milestones

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
