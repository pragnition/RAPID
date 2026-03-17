# SET-OVERVIEW: state-consistency

## Approach

The state machine in `src/lib/state-transitions.cjs` defines the canonical set lifecycle using past-tense status literals: `pending -> discussed -> planned -> executed -> complete -> merged`. However, four SKILL.md files still issue `state transition set` calls using present-tense status names (`discussing`, `planning`, `executing`, `reviewing`) that do not exist in `SET_TRANSITIONS`. This causes silent failures or errors at runtime whenever those skills attempt a state transition.

The fix is surgical: update every `state transition set` call in the skill layer to use the past-tense literals that the state machine actually accepts. Additionally, status documentation strings scattered across skills (status/SKILL.md, new-version/SKILL.md) that enumerate present-tense statuses as valid values need correction. The `reviewing` status was removed entirely in v3 and must be deleted from the review skill's transition logic. Finally, a regression test will be added to verify that no SKILL.md or agent .md file contains a `state transition set` call with an invalid status literal.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/state-transitions.cjs` | Canonical SET_TRANSITIONS map (source of truth) | Existing -- no changes needed |
| `skills/discuss-set/SKILL.md` | Transitions to `discussing` -- should be `discussed` | Existing -- fix transition call |
| `skills/plan-set/SKILL.md` | Transitions to `planning` -- should be `planned` | Existing -- fix transition call |
| `skills/execute-set/SKILL.md` | Transitions to `executing` -- should be `executed` | Existing -- fix transition call |
| `skills/review/SKILL.md` | Transitions to `reviewing` -- status removed in v3 | Existing -- remove transition call |
| `skills/status/SKILL.md` | Documents present-tense status list | Existing -- fix documentation |
| `skills/new-version/SKILL.md` | Documents present-tense status list | Existing -- fix documentation |
| `skills/discuss-set/SKILL.md` (lines 324, 334) | References `discussing` in prose guidance | Existing -- fix prose |
| `skills/plan-set/SKILL.md` (line 365) | References `discussing -> planning` in prose | Existing -- fix prose |
| `src/lib/state-schemas.test.cjs` | Already has test rejecting `reviewing` | Existing -- extend with sweep test |

## Integration Points

- **Exports:**
  - `canonical-status-literals`: The `SET_TRANSITIONS` map in `src/lib/state-transitions.cjs` (unchanged, serves as the single source of truth)
  - `corrected-skill-transitions`: All 24 SKILL.md files updated to use past-tense status literals matching SET_TRANSITIONS

- **Imports:** None -- this set has no dependencies on other sets

- **Side Effects:**
  - After this set lands, `state transition set` calls in discuss-set, plan-set, execute-set, and review will succeed on first attempt instead of failing or being silently swallowed by `|| true`
  - The review skill will no longer attempt an invalid `reviewing` transition (that status does not exist in v3)
  - Status display in `/rapid:status` will show past-tense labels (`discussed`, `planned`, `executed`) instead of present-tense

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missed present-tense reference in a skill or agent file | Medium -- would leave an inconsistent transition call that fails at runtime | Add a grep-based regression test that scans all .md files for `state transition set .* (discussing\|executing\|planning\|reviewing)` and fails if any match |
| Prose references to old status names confuse agents | Low -- agents may still use old terminology in free-form text | Sweep all SKILL.md files for present-tense status enumerations in documentation strings, not just transition calls |
| Review skill losing its pre-review state gate | Medium -- review currently tries to transition to `reviewing` as a guard; removing it changes behavior | The `executed -> complete` transition already gates review entry (review only runs on `complete` sets). The `reviewing` status never existed in SET_TRANSITIONS, so the guard was never functional. Remove it cleanly. |
| Discuss-set `|| true` masking the fix | Low -- the error suppression on line 268 hides whether the fix works | Remove `2>/dev/null \|\| true` after fixing to `discussed`, since the transition should now succeed cleanly |

## Wave Breakdown (Preliminary)

- **Wave 1:** Fix all `state transition set` calls in the four affected SKILL.md files (discuss-set, plan-set, execute-set, review). Fix status enumeration documentation in status/SKILL.md and new-version/SKILL.md. Fix prose references to old status names in discuss-set and plan-set guidance sections.
- **Wave 2:** Add regression test that sweeps all SKILL.md and agent .md files for invalid status literals in `state transition set` calls. Verify no other files reference the removed `reviewing` status as a valid state.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
