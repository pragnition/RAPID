# CONTEXT: ux-improvements

**Set:** ux-improvements
**Generated:** 2026-03-15
**Mode:** interactive

<domain>
## Set Boundary
Rewrite discuss-set AskUserQuestion UX, audit all skills for pre-filled options, and change banner colors from bright blue to dark purple. All changes are surface-level -- SKILL.md files and `src/lib/display.cjs` only. No state machine, CLI command, or agent framework modifications.
</domain>

<decisions>
## Implementation Decisions

### Banner Color & Escape Hatch UX
- Use dark purple (`\x1b[45m` / standard magenta) for all 9 planning-stage backgrounds in `STAGE_BG`
- Execution stages remain bright green (`\x1b[102m`), review stages remain bright red (`\x1b[101m`)
- The "I'll answer in my own words" escape hatch option goes in the LAST position on every freeform AskUserQuestion call

### Discuss-set Batching Strategy
- Each gray area gets 2-3 concrete pre-filled approach options (radio-style) plus an "I'll answer in my own words" escape hatch as the last option
- Each area should present 4-5 questions (not 2-3) to fully capture the user's vision
- Remove the global "Let Claude decide all" top-level choice from Step 5
- Keep "Claude decides" as a per-area option only (available within each individual gray area question)

### Audit Scope Boundaries
- Full 17-skill sweep: audit every skill that has AskUserQuestion calls
- Verify all 129 references across all 17 skills meet the "at least 2 pre-filled options" minimum
- Do not trust existing skills -- verify each one regardless of SET-OVERVIEW listing

### Claude's Discretion
- Specific ANSI code choices for non-planning stages (already settled: green for execution, red for review)
- Internal wave/job decomposition for the audit work
</decisions>

<specifics>
## Specific Ideas
- User wants 4-5 questions per gray area in discuss-set (more thorough than the current 2-3 spec)
- Per-area "Claude decides" preserves user autonomy while removing the global skip that could bypass all discussion
</specifics>

<code_context>
## Existing Code Insights
- `src/lib/display.cjs` has 14 STAGE_BG entries: 9 planning (bright blue `\x1b[104m`), 3 execution (bright green `\x1b[102m`), 2 review (bright red `\x1b[101m`)
- 17 skills contain AskUserQuestion references with 129 total occurrences
- Skills with highest AskUserQuestion density: init (20), merge (17), new-version (14), review (12)
- The discuss-set SKILL.md already describes batching in Steps 5-6 but the actual AskUserQuestion invocations need concrete option arrays added
- SET-OVERVIEW identifies 6-8 specific files with known gaps, but full sweep covers all 17
</code_context>

<deferred>
## Deferred Ideas
- None identified during discussion
</deferred>
