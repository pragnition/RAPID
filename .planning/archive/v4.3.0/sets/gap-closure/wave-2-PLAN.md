# Wave 2: End-to-End Verification and Edge Case Handling

## Objective

Verify the gap-closure workflow end-to-end and ensure edge cases are handled correctly. This wave validates the three behavioral invariants from CONTRACT.json and adds any missing guard clauses discovered during Wave 1 implementation.

## Dependencies

- Wave 1 must be complete (SKILL.md modifications in place)

## Owned Files

- `skills/plan-set/SKILL.md` (minor refinements only -- guards and error messages)
- `skills/execute-set/SKILL.md` (minor refinements only -- guards and error messages)

**Note:** This wave makes targeted refinements to the same files as Wave 1. The executor should read the Wave 1 output (the modified SKILL.md files) before making changes.

---

## Task 1: Verify behavioral invariant -- merged status preserved

**What to verify:** The gap-closure workflow never changes a set's status from `merged`. This means no `state transition set` command is ever called when `GAPS_MODE=true`.

### Verification Steps

```bash
# In plan-set/SKILL.md, verify state transition is conditional
# Search for the state transition command and confirm it's inside a gaps-mode guard
grep -A 5 "state transition set.*planned" skills/plan-set/SKILL.md
# Expected: The transition is wrapped in "If GAPS_MODE=false" or equivalent

# In execute-set/SKILL.md, verify BOTH transitions are conditional
grep -A 5 "state transition set.*executed" skills/execute-set/SKILL.md
grep -A 5 "state transition set.*complete" skills/execute-set/SKILL.md
# Expected: Both transitions are wrapped in gaps-mode guards

# Verify solo auto-merge is also guarded
grep -B 2 -A 5 "auto-transition.*merged\|auto-merge" skills/execute-set/SKILL.md
# Expected: Auto-merge block is inside the GAPS_MODE=false guard
```

**If any transition is NOT guarded:** Add the missing guard. The pattern is:
- Before the transition: "If `GAPS_MODE=true`: Skip. Display: 'Gap-closure mode: skipping state transition.'"
- Keep the existing transition in an else branch.

---

## Task 2: Verify behavioral invariant -- gap waves numbered after existing

**What to verify:** Gap-closure waves are numbered sequentially after the last existing wave. If a set had waves 1-2, gap-closure waves become wave-3, wave-4, etc.

### Verification Steps

```bash
# In plan-set/SKILL.md, verify wave numbering instructions exist
grep -c "highest.*wave\|max.*wave\|increment\|next wave number\|globbing.*wave" skills/plan-set/SKILL.md
# Expected: >= 1 reference to determining next wave number from existing files

# Verify the planner prompt includes wave numbering instructions
grep -B 2 -A 5 "wave-\*-PLAN.md\|next wave number" skills/plan-set/SKILL.md
# Expected: Instructions to glob existing wave plans and continue numbering
```

**If wave numbering is unclear or missing:** Ensure the planner prompt in Step 4 (gaps mode) explicitly states:
- "Glob `.planning/sets/${SET_ID}/wave-*-PLAN.md` to find the highest wave number N"
- "Number gap-closure waves starting from N+1"
- "Example: if wave-1-PLAN.md and wave-2-PLAN.md exist, gap-closure plans start at wave-3-PLAN.md"

---

## Task 3: Verify behavioral invariant -- no re-execution of completed waves

**What to verify:** `execute-set --gaps` only executes gap-closure waves, never re-executes previously completed waves.

### Verification Steps

```bash
# In execute-set/SKILL.md, verify the re-entry detection handles gap-closure
grep -B 2 -A 10 "WAVE.*COMPLETE\|re-entry\|gap-closure mode note" skills/execute-set/SKILL.md
# Expected: Clear documentation that WAVE-COMPLETE markers from original execution cause those waves to be skipped

# Verify gap-closure wave identification
grep -c "gap-closure.*wave\|without markers\|newly planned" skills/execute-set/SKILL.md
# Expected: >= 1 reference explaining which waves are gap-closure waves
```

**If re-execution guard is unclear:** Ensure Step 2 in execute-set/SKILL.md explicitly states that in gap-closure mode, the re-entry detection's existing marker-based skip logic naturally prevents re-execution of original waves.

---

## Task 4: Verify edge case -- all gaps already resolved

**What to verify:** If `execute-set --gaps` is invoked but all gap-closure waves already have WAVE-COMPLETE.md markers, it should display "All gap-closure waves already complete" and STOP gracefully.

### Verification Steps

```bash
# Check if the "ALL waves complete" handling in Step 2 works for gap-closure
grep -B 2 -A 5 "ALL waves complete\|all.*waves.*complete" skills/execute-set/SKILL.md
# Expected: The existing "All waves complete" handler naturally covers this case
```

**If not handled:** The existing logic at the end of Step 2 ("If ALL waves complete: Display 'All waves in set already complete.' STOP.") should cover this naturally. Verify it works for gap-closure mode and add a gaps-specific message if needed: "All gap-closure waves already complete. Gaps may be resolved -- check GAPS.md."

---

## Task 5: Verify edge case -- GAPS.md missing

**What to verify:** Both `plan-set --gaps` and `execute-set --gaps` fail fast with clear error messages when GAPS.md does not exist.

### Verification Steps

```bash
# Verify plan-set checks for GAPS.md
grep -c "GAPS.md.*not found\|No GAPS.md" skills/plan-set/SKILL.md
# Expected: >= 1

# Verify execute-set checks for GAPS.md
grep -c "GAPS.md.*not found\|No GAPS.md" skills/execute-set/SKILL.md
# Expected: >= 1
```

**If either check is missing:** Add fail-fast validation before proceeding with gap-closure logic.

---

## Task 6: Verify edge case -- --gaps without valid status

**What to verify:** `plan-set --gaps` on a set in `pending` or `discussed` status shows a clear error explaining that `--gaps` is only for `complete`/`merged` sets.

### Verification Steps

```bash
# Verify plan-set rejects --gaps for non-complete/merged status
grep -c "only valid for.*complete.*merged\|--gaps.*only.*complete" skills/plan-set/SKILL.md
# Expected: >= 1

# Verify execute-set has similar guard
grep -c "only valid for.*complete.*merged\|--gaps.*only.*complete\|--gaps.*accepted" skills/execute-set/SKILL.md
# Expected: >= 1
```

---

## Success Criteria

1. All three behavioral invariants from CONTRACT.json are verifiable through grep checks
2. Every `state transition set` call in both SKILL.md files is gated behind `GAPS_MODE` checks
3. Wave numbering instructions are explicit and unambiguous in the planner prompt
4. Re-entry detection documentation clearly explains gap-closure wave identification
5. Edge cases (all gaps resolved, GAPS.md missing, wrong status) have explicit error handling
6. No functional regressions in non-gaps mode (all changes behind flag guards)
