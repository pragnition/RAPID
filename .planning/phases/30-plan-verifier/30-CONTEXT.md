# Phase 30: Plan Verifier - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate JOB-PLAN.md files for coverage gaps, file conflicts, and implementability before execution begins. A dedicated plan verifier agent runs automatically at the end of wave-plan, can auto-fix minor issues, and blocks state transition on hard failures. Requirements: PLAN-01 through PLAN-05.

</domain>

<decisions>
## Implementation Decisions

### Invocation Point
- Verifier runs automatically as the final step of `/rapid:wave-plan` — no separate command
- On FAIL: wave state stays in 'discussing' (does not transition to 'planning') — blocks execute
- On PASS or PASS_WITH_GAPS: wave transitions to 'planning' normally
- Verifier is a dedicated subagent (`rapid-plan-verifier`), not inline logic
- Verifier has read + edit access to JOB-PLAN.md files — can auto-fix minor issues directly

### Coverage Detection
- Semantic analysis by the verifier agent (LLM reasoning, not string matching)
- Source of truth: both WAVE-PLAN.md (structural coverage) and WAVE-CONTEXT.md (decision compliance)
- Verifier reads all JOB-PLAN.md files holistically against these two sources
- File ownership overlap within a wave: verifier flags conflicts AND suggests which job should own the contested file, auto-fixing if the choice is clear

### Implementability Checks
- Verifier scans the actual codebase (Glob/Read) to confirm files marked 'Modify' exist on disk
- Files marked 'Create' checked to not already exist (catches stale plans)
- Cross-job dependency ordering checked logically (Job B references file Job A creates → A must come first)

### Verdict Thresholds
- **PASS**: All requirements covered, no file conflicts, all references valid
- **PASS_WITH_GAPS**: Minor gaps — requirement partially addressed, non-critical section missing, but structurally sound
- **FAIL**: File ownership conflicts, requirements entirely missing, referenced files don't exist, structural issues the verifier can't auto-fix

### PASS_WITH_GAPS Handling
- Auto-proceed with warning — no user gate
- Gaps logged in VERIFICATION-REPORT.md
- Wave transitions normally; gaps often resolve during implementation

### FAIL Decision Gate
- Three options: Re-plan / Override / Cancel
- Re-plan: re-runs job planners only for failing jobs (not entire wave)
- Override: proceed despite failures (user takes responsibility)
- Cancel: stop and let user investigate

### Claude's Discretion
- Exact criteria thresholds for PASS_WITH_GAPS vs FAIL edge cases
- Agent prompt structure and check ordering
- How to handle edge cases in cross-job dependency analysis

</decisions>

<specifics>
## Specific Ideas

- Verifier should be able to make minor edits to plans (corrective editor) — only hard FAIL when the plan is clearly wrong
- Re-plan scope targets failing jobs only, preserving good plans

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `validateJobPlans()` in `src/lib/wave-planning.cjs`: existing contract-level validation (export coverage, cross-set imports) — can run alongside or before the verifier agent
- `parseJobPlanFiles()` in `src/lib/execute.cjs`: parses `## Files to Create/Modify` table from JOB-PLAN.md — verifier can reuse this
- `rapid-verifier.md` agent: post-execution verifier with pass/fail report format — provides pattern for report structure
- VALIDATION-REPORT.md: existing report at `.planning/sets/{setId}/` — pattern for verdict + evidence format

### Established Patterns
- Agent spawning: wave-plan skill uses `Spawn the **rapid-{role}** agent with this task:` pattern
- Structured return: `<!-- RAPID:RETURN {...} -->` protocol for agent verdicts
- State transitions: `wave-planning.cjs` handles state machine transitions after validation

### Integration Points
- Wave-plan skill (SKILL.md): new step after job planner parallel fan-out, before state transition
- State machine: verification failure blocks `discussing` → `planning` transition
- FAIL gate: AskUserQuestion with re-plan/override/cancel options, re-plan triggers selective job planner re-spawn

</code_context>

<report_format>
## Report Format Decisions

### Location
- Per-wave: `.planning/waves/{setId}/{waveId}/VERIFICATION-REPORT.md`
- One report per wave, alongside the JOB-PLAN.md files it verified

### Content Structure
- Summary + per-check breakdown (not full per-file analysis)
- Sections: Coverage, Implementability, Consistency (file conflicts)
- Each section: pass/fail per item with brief notes

### Edit Tracking
- Brief summaries of changes made — mention files changed and what changed
- Not full before/after diffs (prevents context explosion)

### Terminal Output
- Condensed verdict banner + any issues/gaps shown inline in terminal
- Full details in VERIFICATION-REPORT.md file

</report_format>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 30-plan-verifier*
*Context gathered: 2026-03-10*
