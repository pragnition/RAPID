# Phase 13: Merge and Cleanup Skill Prompts - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace freeform yes/no prompts and bare STOP handling in merge and cleanup skills with structured AskUserQuestion prompts, add error recovery paths for conflicts and dirty worktrees, and explain reviewer verdicts clearly. Covers PROMPT-09 (merge confirmation), PROMPT-10 (conflict recovery), PROMPT-11 (cleanup confirmation), ERRR-01 (conflict recovery options), ERRR-02 (dirty worktree resolution), and ERRR-04 (verdict explanations). Changes are SKILL.md prose edits plus adding AskUserQuestion to allowed-tools.

</domain>

<decisions>
## Implementation Decisions

### Merge pipeline confirmation flow
- Single AskUserQuestion before pipeline starts with inline summary (set count, wave count, first wave's sets) in the option description — matches Phase 12's approve pattern
- Header: context-based (e.g., "Merge plan")
- Options: "Start merge" / "Cancel" — Start description includes inline summary
- Inter-wave prompts kept as AskUserQuestion: "Continue to Wave N+1" / "Pause pipeline" — natural checkpoint after integration gate passes
- No per-set confirmations — pipeline runs autonomously between wave gates

### Post-merge next-action routing
- After pipeline completes (Step 8), AskUserQuestion with "Run cleanup" / "View status" / "Done"
- Matches Phase 12's execution complete routing pattern

### Conflict & error recovery (PROMPT-10, ERRR-01)
- Merge conflict: AskUserQuestion with "Resolve manually" / "Show diff" / "Abort pipeline"
- "Resolve manually" flow: display conflicting file list + resolve commands (git add, git merge --continue), then second AskUserQuestion: "Resolved — continue pipeline" / "Still stuck — abort"
- Developer resolves in their terminal, comes back to confirm
- Merge error (non-conflict): same pattern — structured recovery, not bare STOP
- Integration gate failure: AskUserQuestion with "Investigate" / "Revert wave" / "Abort pipeline"
- "Investigate" shows test output and pauses for manual fix
- "Revert wave" triggers double confirmation: second AskUserQuestion listing which sets will be undone before actually reverting (destructive action = extra gate)

### Verdict explanations (ERRR-04)
- Verdict banner with emoji + findings summary: clear label (APPROVE/CHANGES REQUESTED/BLOCKED) followed by 2-3 line summary of key findings
- For CHANGES: shows fixable issue count and cleanup rounds remaining (e.g., "Round 1/2")
- Cleanup loop runs automatically (up to 2 rounds) with progress banners between rounds — developer only prompted if escalation
- BLOCK verdict: structured AskUserQuestion with "View full review" / "Skip set, continue pipeline" / "Abort pipeline"
- Cleanup escalation (still CHANGES after 2 rounds): AskUserQuestion with "Fix manually" / "Skip set" / "Abort pipeline" — matches conflict recovery pattern

### Cleanup worktree selection (PROMPT-11)
- AskUserQuestion with active worktrees as options (up to 4 worktrees). Each option shows set name + status
- If >4 worktrees: fall back to text list (matches Phase 11's assumptions <=4 pattern)
- Destructive removal confirmation: AskUserQuestion with "Remove worktree" / "Cancel" — Remove description explicitly lists what gets deleted ("Deletes .rapid-worktrees/{name} directory. Branch rapid/{name} preserved.")

### Dirty worktree recovery (ERRR-02)
- When dirty worktree blocks removal: AskUserQuestion with "Commit changes" / "Stash changes" / "Force remove" / "Cancel"
- Each option's description shows the specific commands (git add + commit, git stash, git worktree remove --force)
- "Force remove" triggers double confirmation: second AskUserQuestion "This permanently discards uncommitted changes in {name}. Confirm force / Cancel" — consistent with wave revert double-gate pattern

### STOP removal
- Remove all STOP/halt keywords from merge and cleanup SKILL.md files
- Replace with structured AskUserQuestion prompts at every exit path
- Consistent with Phases 11-12 approach

### Claude's Discretion
- Exact wording of option labels and consequence descriptions (within established patterns)
- Whether to use preview fields on any AskUserQuestion prompts
- Emoji choices for verdict banners
- How to format the inline merge plan summary in the confirmation prompt
- Progress banner format between cleanup rounds

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/merge/SKILL.md`: 8-step pipeline with 3 STOP points and 2 yes/no prompts to convert — currently uses Read, Write, Bash, Agent in allowed-tools
- `skills/cleanup/SKILL.md`: 5-step flow with 1 STOP point, freeform text input for set name, and yes/no confirmation — currently uses Bash, Read in allowed-tools
- `src/bin/rapid-tools.cjs`: CLI entry point for merge and worktree subcommands
- `src/lib/execute.cjs`: Execution library with wave-status used by merge pipeline

### Established Patterns
- Phase 10/11/12 established: consequence-focused descriptions, context-based headers, AskUserQuestion in allowed-tools frontmatter
- Phase 12 established: dynamic state-dependent options (reconciliation), auto-run with status updates (progress indicators)
- Phase 12 established: "Pause here" instead of "Stop here" to eliminate stop/halt keywords
- Phase 11 established: <=4 items as AskUserQuestion options, >4 falls back to text list
- Skills use `disable-model-invocation: true` — instruction templates, not executable code
- All skills load .env fallback for RAPID_TOOLS at the top of bash blocks
- Destructive actions (wave revert, force remove) get double confirmation gates

### Integration Points
- Merge SKILL.md Step 1: merge plan display -> AskUserQuestion for Start/Cancel (PROMPT-09)
- Merge SKILL.md Step 4: reviewer verdict -> verdict banner + conditional AskUserQuestion for BLOCK (ERRR-04)
- Merge SKILL.md Step 5: cleanup escalation -> AskUserQuestion for Fix/Skip/Abort (ERRR-04)
- Merge SKILL.md Step 6: merge conflict -> AskUserQuestion for Resolve/Show diff/Abort (PROMPT-10, ERRR-01)
- Merge SKILL.md Step 7: integration gate failure -> AskUserQuestion for Investigate/Revert/Abort (ERRR-01)
- Merge SKILL.md Step 7: wave complete -> AskUserQuestion for Continue/Pause
- Merge SKILL.md Step 8: pipeline complete -> AskUserQuestion for next-action routing
- Cleanup SKILL.md Step 1: no worktrees -> text message (replace STOP)
- Cleanup SKILL.md Step 2: worktree selection -> AskUserQuestion with worktree list (PROMPT-11)
- Cleanup SKILL.md Step 3: removal confirmation -> AskUserQuestion with explicit deletion list (PROMPT-11)
- Cleanup SKILL.md Step 5: dirty worktree -> AskUserQuestion for Commit/Stash/Force/Cancel (ERRR-02)

</code_context>

<specifics>
## Specific Ideas

- Phase 10-12 patterns carry forward: context-based headers, consequence descriptions, structured gate then freeform, dynamic options
- Double confirmation gates for destructive actions (wave revert, force remove) — consistent new pattern established in this phase
- Cleanup auto-runs during merge (up to 2 rounds) without developer prompts — only escalation interrupts the flow
- Verdict banners should feel informative, not alarming — CHANGES is a normal part of the pipeline, not a failure
- Merge conflict resolution assumes developer works in their own terminal — Claude shows the info and waits

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-merge-and-cleanup-skill-prompts*
*Context gathered: 2026-03-06*
