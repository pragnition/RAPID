# CONTEXT: state-consistency

**Set:** state-consistency
**Generated:** 2026-03-14
**Mode:** interactive

<domain>
## Set Boundary
Fix root-cause mismatch between skill-layer status literals (present-tense) and the state machine's past-tense statuses. The canonical SET_TRANSITIONS map in `src/lib/state-transitions.cjs` uses: `pending -> discussed -> planned -> executed -> complete -> merged`. Four SKILL.md files still issue `state transition set` calls using present-tense names (`discussing`, `planning`, `executing`, `reviewing`) that don't exist in SET_TRANSITIONS. This set corrects all transition calls, updates prose references, and adds a regression test.
</domain>

<decisions>
## Implementation Decisions

### Error Suppression Cleanup
- Allow `discussed -> discussed` as a valid self-transition in SET_TRANSITIONS (add `'discussed'` to the `discussed` allowed transitions array)
- discuss-set already prompts the user to confirm re-discuss via AskUserQuestion — the self-transition supports that re-entry path
- Remove `2>/dev/null || true` from discuss-set transition call since the transition will now succeed in both fresh and re-entry scenarios
- No error suppression changes needed in other skills (plan-set, execute-set) — they don't support re-entry

### Review Skill Transition
- Remove the `reviewing` transition call from review/SKILL.md entirely — do NOT replace it with a new status
- Review is optional in the workflow; adding a `reviewed`/`complete` gate would complicate merge (merge agent would reject `executed` but not `reviewed` sets)
- The review skill should run without modifying set status at all

### Regression Test Strategy
- Add Node.js regression test to existing `src/lib/state-schemas.test.cjs`
- Test greps all SKILL.md and agent .md files for `state transition set` calls containing invalid present-tense status literals (`discussing`, `planning`, `executing`, `reviewing`)
- Fails if any match found

### Prose Update Scope
- Full sweep: update ALL mentions of present-tense statuses across both `skills/` and `agents/` directories
- Not just `state transition set` calls — also prose like "move from pending to discussing" -> "move from pending to discussed"
- Covers all 24 SKILL.md files and all agent .md files

### Claude's Discretion
- Exact regex patterns for the regression test
- Order of file edits within each wave
- Handling of edge cases in prose (e.g., "discuss" as a verb vs "discussing" as a status)
</decisions>

<specifics>
## Specific Ideas
- Self-transition: Add `discussed` to `SET_TRANSITIONS.discussed` array so re-discuss works cleanly
- Remove `|| true` error suppression in discuss-set after fixing the status literal
- The `reviewing` status line in review/SKILL.md should be deleted, not replaced
</specifics>

<code_context>
## Existing Code Insights
- `src/lib/state-transitions.cjs`: SET_TRANSITIONS map is the single source of truth (lines 3-9)
- `discuss-set/SKILL.md:268`: `state transition set ... discussing 2>/dev/null || true`
- `plan-set/SKILL.md:286`: `state transition set ... planning`
- `execute-set/SKILL.md:148`: `state transition set ... executing`
- `execute-set/SKILL.md:332`: `state transition set ... complete` (this one is already correct)
- `review/SKILL.md:90`: `state transition set ... reviewing` (status removed in v3)
- `plan-set/SKILL.md:365`: prose references "discussing -> planning"
- `discuss-set/SKILL.md:324,334`: prose references "discussing"
- `src/lib/state-schemas.test.cjs`: existing test file for state validation — extend here
- `merge/SKILL.md:364`: `state transition set ... merged` (already correct)
</code_context>

<deferred>
## Deferred Ideas
- None identified during discussion
</deferred>
