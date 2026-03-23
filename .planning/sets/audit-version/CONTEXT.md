# CONTEXT: audit-version

**Set:** audit-version
**Generated:** 2026-03-24
**Mode:** interactive

<domain>
## Set Boundary
New `/rapid:audit-version` command that reads milestone artifacts (ROADMAP.md, REQUIREMENTS.md, STATE.json, CONTRACT.json), cross-references planned requirements against actual delivery, produces a structured gap report at `.planning/v{version}-AUDIT.md`, and automatically creates remediation sets for identified gaps or defers items to the next version with carry-forward context. Strictly read-only against STATE.json — never mutates it. Assumes projects run RAPID v3.0.0+.
</domain>

<decisions>
## Implementation Decisions

### Gap Analysis Strategy
- Hybrid approach: structured field parsing first (CONTRACT.json acceptance criteria, STATE.json set statuses), then agent-driven semantic matching for unresolved/ambiguous items.
- **Rationale:** Structured parsing handles the common case fast and deterministically, while the agent pass catches paraphrase mismatches and partial coverage that mechanical matching would miss. Best accuracy-to-speed tradeoff.

### Audit Report Structure
- Severity-first organization: Uncovered > Partial > Covered sections, with set cross-references per item.
- **Rationale:** The developer's first question is "how bad is it?" — severity-first layout lets them quickly assess gap magnitude and jump to critical items without reading the full report.

### Two-Pass Architecture
- Flag on any non-trivial mismatch: when acceptance criteria count doesn't align with verification items, or when ROADMAP.md scope description seems broader than what was delivered.
- **Rationale:** False negatives (missed gaps) are worse than extra context usage. Aggressive flagging ensures gaps aren't silently missed, and the second pass only runs on flagged sets so context cost is bounded.

### Remediation Workflow
- Severity-tiered: individual prompts for critical/uncovered gaps, batch prompt for minor/partial gaps. The audit command should automatically create remediation sets (invoke add-set logic internally) rather than requiring the user to run `/rapid:add-set` manually.
- **Rationale:** Per-gap prompting for 20+ items is tedious, but critical gaps deserve individual attention. Auto-creating remediation sets eliminates friction — the user decides what to fix vs defer, and the command handles the rest.

### Missing Artifact Fallback
- Assume all projects run RAPID v3.0.0+ — ROADMAP.md and CONTRACT.json will be available. If REQUIREMENTS.md is missing, fall back to ROADMAP.md + CONTRACT.json with a warning in the report noting reduced confidence.
- **Rationale:** User confirmed projects will be on v3.0.0+, so the common case is covered. Graceful degradation for edge cases is still prudent.

### Deferral Context Format
- Both: write structured `.planning/v{version}-DEFERRED.md` with per-item entries AND append a "Deferred from v{X}" section to ROADMAP.md.
- **Rationale:** The structured file gives `/rapid:new-version` researchers a machine-discoverable artifact, while the ROADMAP.md section provides highest visibility for human reviewers scanning project history.

### Agent vs Skill Boundary
- Agent (role-auditor) handles all analysis: both passes of gap matching, report generation, severity classification. Skill (SKILL.md) orchestrates flow: version resolution, state validation, user prompts for remediation decisions, artifact commits.
- **Rationale:** The agent gets a fresh context window ideal for processing large milestone data without overflowing the skill's conversation context. Also makes the auditor reusable for future automated audit scenarios.

### Version Resolution
- Default to the most recently completed milestone (all sets merged). Explicit version argument always takes precedence.
- **Rationale:** The natural workflow is audit-then-new-version, so defaulting to the last completed milestone matches the common case. Explicit version supports retroactive audits of older milestones.

### Claude's Discretion
- No areas deferred to Claude's discretion — all 8 gray areas were discussed.
</decisions>

<specifics>
## Specific Ideas
- Remediation sets should be auto-created by the audit command itself, not require manual `/rapid:add-set` invocation
- Deferral writes to both `.planning/v{version}-DEFERRED.md` and a ROADMAP.md section for dual discoverability
- Two-pass threshold is intentionally aggressive (flag on any mismatch) to minimize false negatives
</specifics>

<code_context>
## Existing Code Insights
- Role modules live at `src/modules/roles/role-*.md` (CONTRACT.json incorrectly references `src/agents/roles/`)
- Display banners use `src/lib/display.cjs` with `STAGE_VERBS` and `STAGE_BG` maps — needs `audit-version` entries added
- Existing skills follow the pattern: `skills/{name}/SKILL.md` with env preamble and `node "${RAPID_TOOLS}"` CLI calls
- STATE.json milestone completion is determined by `sets.every(s => s.status === 'merged')` — no milestone-level status field
- 27 existing role modules and 27 existing skills provide pattern references
</code_context>

<deferred>
## Deferred Ideas
- Continuous audit hook: role-auditor agent reused by post-merge hook for auto-audit after each set completes
- New-version integration: `/rapid:new-version` researchers should auto-discover `v{version}-DEFERRED.md` files
</deferred>
