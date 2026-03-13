# Phase 15: Global Error Recovery and Progress - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace all remaining bare STOP/halt error handling across all skills with structured recovery options, and add progress indicators to context and merge skills during long subagent operations. Covers ERRR-03 (global STOP replacement), PROG-02 (context analysis progress), and PROG-03 (merge subagent progress). Changes are SKILL.md prose edits.

</domain>

<decisions>
## Implementation Decisions

### STOP replacement strategy
- 6 confirmed STOP points across 2 skills (init: 3, context: 3)
- Full audit of all 11 SKILL.md files for any subtle stop patterns beyond the 6 confirmed — thoroughness for final v1.1 phase
- 3-tier recovery pattern applied consistently across all skills:
  - **Tier 1 (actionable errors):** AskUserQuestion with retry/help/cancel — e.g., missing prereqs get "Retry check" / "View install guide" / "Cancel init" with install commands inline in descriptions (like Phase 13's git commands)
  - **Tier 2 (missing state):** Graceful exit with next-command hint — e.g., no `.planning/` shows "No RAPID project found. Run `/rapid:init` first." No prompt needed, just a text message
  - **Tier 3 (user cancels):** Clean confirmation message — "Cancelled. No changes made." User already chose cancel via AskUserQuestion, just confirm and end
- Git init decline: graceful exit with hint ("RAPID requires a git repo. Run git init when ready, then /rapid:init again.") — no AskUserQuestion needed
- All STOP/halt keywords fully removed from every SKILL.md file

### Context analysis progress (PROG-02)
- Stage-based text banners during codebase analysis subagent
- 3 stages: "Scanning project..." -> "Analyzing patterns..." -> "Generating files..."
- Unified banner format shared with merge skill (consistent feel across all skills)
- No file counts or timestamps — keep it simple

### Merge subagent progress (PROG-03)
- Reviewer progress: set name + review stage banners (e.g., "Reviewing set: auth-api..." -> "Checking contracts...")
- Cleanup progress: round number + action (e.g., "Cleanup round 1/2: fixing style issues...")
- Same unified banner format as context skill
- No timestamps — matches Phase 12's execute progress pattern

### Recovery option design
- Consistent 3-tier system (see STOP replacement above) applied globally
- Tier 1 options show inline install/fix commands in AskUserQuestion descriptions — developer can copy-paste immediately
- No external doc links — everything self-contained in the prompt

### Claude's Discretion
- Exact banner format character (arrow, bullet, etc.) for unified progress style
- Exact wording of graceful exit messages
- Whether any edge cases in the 11-skill audit warrant Tier 1 vs Tier 2 treatment
- Specific stage names for merge reviewer substages

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/init/SKILL.md`: 3 STOP points — lines 31 (prereqs), 48 (git decline), 190 (cancel mode)
- `skills/context/SKILL.md`: 3 STOP points — lines 31 (cancel), 50 (no .planning/), 111 (cancel)
- `skills/execute/SKILL.md`: Phase 12's progress indicator pattern — established reference for unified banners
- `skills/merge/SKILL.md`: Already has `Display progress:` patterns at wave level — needs subagent-level progress added

### Established Patterns
- Phase 12: "Pause here" replaces "Stop here" — no stop/halt keywords anywhere
- Phase 12: Progress indicators during subagent execution with last activity updates
- Phase 13: Inline git commands in AskUserQuestion descriptions for recovery options
- Phase 13: Cleanup rounds shown as "Round 1/2" — established round tracking pattern
- Phase 10-13: consequence-focused descriptions, context-based headers, AskUserQuestion in allowed-tools frontmatter

### Integration Points
- Init SKILL.md line 31: prereq blocker -> Tier 1 AskUserQuestion (retry/guide/cancel)
- Init SKILL.md line 48: git decline -> Tier 2 graceful exit with hint
- Init SKILL.md line 190: cancel mode -> Tier 3 clean confirmation
- Context SKILL.md line 31: cancel selection -> Tier 3 clean confirmation
- Context SKILL.md line 50: no .planning/ -> Tier 2 graceful exit with /rapid:init hint
- Context SKILL.md line 111: cancel selection -> Tier 3 clean confirmation
- Context SKILL.md: new progress banners before subagent invocation (3 stages)
- Merge SKILL.md: new progress banners around reviewer and cleanup subagent calls

</code_context>

<specifics>
## Specific Ideas

- Unified progress banner format should match Phase 12's execute progress feel — short, informative, not chatty
- The 3-tier system means most STOP removals are simple text replacements (Tier 2 and 3), only prereq failure needs a full AskUserQuestion prompt (Tier 1)
- The 11-skill audit ensures nothing slips through as the final v1.1 phase — clean sweep

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-global-error-recovery-and-progress*
*Context gathered: 2026-03-06*
