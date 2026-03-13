# Phase 11: Planning and Status Skill Prompts - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace freeform text prompts in plan, assumptions, and status skills with structured AskUserQuestion prompts for all decision gates and next-action routing. Covers PROMPT-04 (plan re-plan/view/cancel gate), PROMPT-12 (assumptions set selection and feedback), and PROMPT-14 (status next-action prompt). Changes are SKILL.md prose edits plus adding AskUserQuestion to allowed-tools. All STOP keywords removed from these three skills.

</domain>

<decisions>
## Implementation Decisions

### Plan skill gates
- Step 1 (existing sets detected): AskUserQuestion with Re-plan / View current / Cancel — same three options, converted with consequence-focused descriptions
- Header: "Existing sets" (context-based, matches Phase 10's "Existing project" pattern)
- View option: after displaying set details, returns to a second AskUserQuestion with Re-plan / Cancel so developer can act without re-running the command
- Step 4 (proposal review): AskUserQuestion with Approve / Modify / Cancel
- Approve description includes inline set name + wave summary so developer sees what they're approving without scrolling
- Modify: structured gate then freeform — developer picks Modify via AskUserQuestion, then plain text prompt for describing changes (consistent with Phase 10's project description pattern)

### Assumptions flow
- Set selection (Step 1): AskUserQuestion when <=4 sets, fall back to numbered text list when >4. User can always type via "Other"
- Header for set selection: use set names as option labels directly
- Feedback (Step 4): AskUserQuestion with Correct assumptions / Note for execution / Looks good
- Header: "Assumptions" (matches skill name)
- Correct assumptions: structured gate then freeform — developer picks Correct, then plain text prompt for what's wrong
- After "Looks good": structured AskUserQuestion with "Review another set" / "Done" — loops back to set selection if reviewing another

### Status next-action routing
- Fully dynamic options based on 5 detected states:
  1. No sets exist → options route to /rapid:plan
  2. Sets defined but not executing → options route to /rapid:execute or /rapid:assumptions
  3. Executing → show active set info, options for viewing details
  4. Gate blocked → show which sets need planning, route to /rapid:plan
  5. All done → route to /rapid:merge
- Header changes per state: "Next step", "Gate blocked", "Ready to merge", etc. — gives immediate signal
- Always includes a "Done viewing" dismiss option so developers can exit without triggering another command

### Freeform fallback pattern
- Universal rule: any option needing open-ended follow-up uses structured AskUserQuestion gate → plain text prompt
- Applies to: Plan Step 4 Modify, Assumptions Step 4 Correct
- Consistent with Phase 10's project description pattern

### STOP removal
- Remove all STOP keywords from plan, assumptions, and status SKILL.md files
- Replace with explicit exit text or structured prompts at every exit path
- Error states (RAPID_TOOLS not set, no sets found, etc.) stay as text messages with clear guidance — full error recovery with AskUserQuestion deferred to Phase 15

### Claude's Discretion
- Exact wording of option labels and consequence descriptions (within established patterns)
- Whether to use preview fields on any AskUserQuestion prompts
- Specific option combinations for each of the 5 status states
- How to format the inline set summary in Plan Step 4's Approve description

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/plan/SKILL.md`: 6-step flow with 2 decision gates (Step 1: existing sets, Step 4: proposal review) — both currently numbered text options
- `skills/assumptions/SKILL.md`: 4-step flow with set selection (Step 1: numbered list) and feedback (Step 4: 3 options) — both currently text
- `skills/status/SKILL.md`: 5-step read-only dashboard with text guidance in Step 4 — currently no structured prompt
- `src/bin/rapid-tools.cjs`: CLI entry point for all subcommands used by these skills

### Established Patterns
- Phase 10 established: consequence-focused descriptions, context-based headers, AskUserQuestion in allowed-tools frontmatter
- Skills use `disable-model-invocation: true` — instruction templates, not executable code
- All skills load .env fallback for RAPID_TOOLS at the top of bash blocks
- STOP keyword used for exit paths in all three skills — will be replaced

### Integration Points
- Plan SKILL.md Step 1: `node "${RAPID_TOOLS}" plan list-sets` → parse JSON → AskUserQuestion if sets exist (PROMPT-04)
- Plan SKILL.md Step 4: proposal display → AskUserQuestion for Approve/Modify/Cancel
- Assumptions SKILL.md Step 1: `node "${RAPID_TOOLS}" assumptions` → parse availableSets → AskUserQuestion if <=4 sets (PROMPT-12)
- Assumptions SKILL.md Step 4: assumptions display → AskUserQuestion for feedback (PROMPT-12)
- Status SKILL.md Step 4: dashboard display → dynamic AskUserQuestion based on detected state (PROMPT-14)

</code_context>

<specifics>
## Specific Ideas

- Phase 10 patterns carry forward: "Existing sets" header mirrors "Existing project", consequence descriptions explain what happens
- Plan View option should feel like a preview — see sets, then decide — not a terminal action
- Status dismiss option respects that status is often just a check-in, not a routing decision
- Assumptions "Review another set" loop should feel natural, not forced

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-planning-and-status-skill-prompts*
*Context gathered: 2026-03-06*
