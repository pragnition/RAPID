# Phase 12: Execute Skill Prompts and Progress - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace freeform text prompts in the execute skill with structured AskUserQuestion prompts at all decision points, add progress indicators during subagent execution, and remove all STOP keywords. Covers PROMPT-05 (execution mode choice), PROMPT-06 (paused set handling), PROMPT-07 (planning gate override), PROMPT-08 (wave reconciliation next steps), and PROG-01 (execution progress). Changes are SKILL.md prose edits plus adding AskUserQuestion to allowed-tools.

</domain>

<decisions>
## Implementation Decisions

### Execution mode prompt (PROMPT-05)
- Header: "Exec mode"
- Agent Teams as first/recommended option, Subagents as second
- Consequence-focused descriptions: Teams = faster parallel execution, Subagents = proven stable execution
- One option's description mentions "locked for entire run" so developer knows this is a one-time choice
- Two options only (Agent Teams / Subagents) — no auto-select option
- When only subagents available (no agent teams): silent, no prompt. Subagents used automatically. Don't surface what's unavailable.

### Paused set handling (PROMPT-06)
- One AskUserQuestion per paused set (individual prompts, not batch)
- Header: set name or "Paused set"
- Options: Resume / Restart / Skip with progress-focused consequence descriptions:
  - Resume: "Continues from task 3/7 — completed work preserved"
  - Restart: "Discards handoff, re-executes all tasks from scratch"
  - Skip: "Left paused for later /rapid:execute run"
- Each prompt shows set name and progress (tasks completed/total)

### Planning gate override (PROMPT-07)
- Header: "Planning gate"
- Options: Override / Cancel (or Run planning first)
- Risk warning inline in Override option description: "Proceeds without complete plans — sets may fail or produce incomplete work"
- Override description includes list of unplanned sets: "Unplanned sets: X, Y"
- No separate warning block before the prompt — everything in the option descriptions

### Wave reconciliation next steps (PROMPT-08)
- Header: "Reconciliation"
- Dynamic options based on reconciliation result status:
  - PASS: "Continue to Wave N+1" / "Stop here"
  - Hard blocks: "Fix failed sets" / "Cancel execution"
  - Soft blocks: "Proceed anyway" / "Fix first" / "Cancel"
- Always prompt even on PASS — developer confirms before next wave starts
- Consequence descriptions explain what each option triggers

### Execution complete routing
- After final summary (Step 9), use AskUserQuestion for next steps
- Options: "View status" / "Start merge" / "Done"
- Matches Phase 11's status routing pattern — structured next-action after summary

### STOP removal
- Remove all STOP/halt keywords from execute SKILL.md
- Replace with structured AskUserQuestion prompts or explicit exit text at every exit path
- Consistent with Phase 11's approach to plan/assumptions/status skills

### Progress indicators (PROG-01)
- Print progress text between subagent calls (before spawning each subagent, after each returns)
- For parallel sets in a wave: print before the batch and after each completes
- Multi-line block format:
  ```
  Wave 1 (1/3 sets done)
    auth-api: Executing (3/7 tasks)
    ui-components: Planning
  [14:32]
  ```
- Each progress block includes: set name + phase, timestamp, task progress (when available during execution), wave context (N/M sets done)
- No polling or real-time streaming — natural insertion points between subagent lifecycle calls

### Claude's Discretion
- Exact wording of option labels and consequence descriptions (within established patterns)
- Whether to use preview fields on any AskUserQuestion prompts
- How to format the multi-line progress block (exact spacing, indentation)
- How to derive task progress counts from subagent return data vs registry

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/execute/SKILL.md`: 9-step flow with 5+ decision points currently using freeform numbered options or yes/no text
- `src/bin/rapid-tools.cjs`: CLI entry point for execute subcommands (detect-mode, wave-status, resume, pause, reconcile, verify, update-phase)
- `src/lib/execute.cjs`: Execution library with detect-mode, wave-status, resume, pause, reconcile, verify, generate-stubs, cleanup-stubs

### Established Patterns
- Phase 10/11 established: consequence-focused descriptions, context-based headers, AskUserQuestion in allowed-tools frontmatter
- Skills use `disable-model-invocation: true` — instruction templates, not executable code
- All skills load .env fallback for RAPID_TOOLS at the top of bash blocks
- Phase 11 removed STOP keywords from plan/assumptions/status — same pattern applies here
- Phase 11 used dynamic state-dependent options (status skill) — reconciliation prompt follows same pattern

### Integration Points
- Execute SKILL.md Step 0: `node "${RAPID_TOOLS}" execute detect-mode` → AskUserQuestion if teams available (PROMPT-05)
- Execute SKILL.md Step 1.5: HANDOFF.md parsing → per-set AskUserQuestion for Resume/Restart/Skip (PROMPT-06)
- Execute SKILL.md Step 2: `node "${RAPID_TOOLS}" plan check-gate` → AskUserQuestion for Override/Cancel (PROMPT-07)
- Execute SKILL.md Step 8: `node "${RAPID_TOOLS}" execute reconcile` → dynamic AskUserQuestion based on result (PROMPT-08)
- Execute SKILL.md Step 9: final summary → AskUserQuestion for next-action routing
- Execute SKILL.md Steps 5-7: subagent spawn/return points → progress text insertion points (PROG-01)

</code_context>

<specifics>
## Specific Ideas

- Phase 10/11 patterns carry forward: context-based headers, consequence descriptions, structured gate then freeform
- Progress blocks should feel informative, not noisy — multi-line format chosen over compact one-liners for readability with multiple parallel sets
- Execution mode lock should be transparent: developer knows upfront this is a one-time choice
- Planning gate override should make risk visible without being a separate warning wall

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-execute-skill-prompts-and-progress*
*Context gathered: 2026-03-06*
