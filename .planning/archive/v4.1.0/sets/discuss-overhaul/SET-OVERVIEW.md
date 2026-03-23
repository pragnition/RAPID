# SET-OVERVIEW: discuss-overhaul

## Approach

This set overhauls the `/rapid:discuss-set` skill to produce higher-quality discussion output. The current implementation asks exactly 4 gray areas with a fixed structure. The overhaul shifts gray area focus from implementation/coding questions to architect-level and UI/UX questions, makes the gray area count variable (multiples of 4 scaling with set complexity), enriches each question with inline context (pros/cons tables, recommended option tagging), and introduces a DEFERRED.md file for capturing out-of-scope decisions that surface during discussion.

The work is contained entirely within a single skill file (`skills/discuss-set/SKILL.md`) and its output artifacts. The core challenge is restructuring the gray area identification logic and question format within the skill's prompt-based architecture, since discuss-set is a prompt-driven skill (not a .cjs module). All changes are instructional -- modifying how the agent identifies, presents, and records gray areas.

The enhanced CONTEXT.md output adds structured sections for architectural vision, UI/UX specifics, decision rationale, and a deferred items summary, giving downstream plan-set richer material to work with.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| skills/discuss-set/SKILL.md | Main skill definition -- all discussion logic | Existing (major rewrite) |
| .planning/sets/{set-id}/CONTEXT.md | Output artifact -- enhanced structure | Existing format (schema change) |
| .planning/sets/{set-id}/DEFERRED.md | New output artifact for deferred decisions | New |

## Integration Points

- **Exports:**
  - Architect-level gray areas focused on architecture and UI/UX (not coding details)
  - Variable gray area count (4n where n >= 1) with n AskUserQuestion selection prompts
  - Rich question format: 3-5 sentence context, pros/cons table, (Recommended) tag per option
  - DEFERRED.md file at `.planning/sets/{set-id}/DEFERRED.md`
  - Enhanced CONTEXT.md with architectural vision, UI/UX specifics, deferred items summary, decision rationale
- **Imports:** None -- this set has no dependencies on other sets
- **Side Effects:** Downstream consumers of CONTEXT.md (primarily plan-set) will receive richer input; DEFERRED.md is a new artifact that future milestone planning could consume

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Variable gray area count (4n) breaks AskUserQuestion's 4-option constraint | High | Each AskUserQuestion batch presents exactly 4 options; multiple batches handle n > 1 |
| Complexity-based scaling heuristic is subjective | Medium | Define clear criteria in SKILL.md (e.g., file count, task count, import count from CONTRACT.json) |
| Richer question format makes prompts too long for user attention | Medium | Keep context to 3-5 sentences max; use tables for scanability |
| DEFERRED.md introduces a new artifact with no downstream consumer yet | Low | Document format clearly; deferred items are informational and do not block any workflow |
| CONTEXT.md schema change could break plan-set parsing | Medium | Plan-set reads CONTEXT.md as freeform markdown with XML tags; new sections are additive, not breaking |

## Wave Breakdown (Preliminary)

- **Wave 1:** Restructure gray area identification to focus on architecture/UI/UX; define complexity heuristic for variable count (4n)
- **Wave 2:** Implement rich question format (inline context, pros/cons tables, recommended tags) and multi-batch AskUserQuestion flow
- **Wave 3:** Add DEFERRED.md capture logic and enhance CONTEXT.md output template with new structured sections

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
