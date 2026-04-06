# Gaps: clear-guidance-and-display

## Gap 1: Review sub-steps include /clear reminder despite policy saying "review sub-steps: no"

**Skills affected:** unit-test, bug-hunt, uat
**Issue:** The ROADMAP success criteria state "/clear policy (lifecycle boundaries: yes, review sub-steps: no)" but all three review sub-pipeline skills (unit-test, bug-hunt, uat) use the footer without `--no-clear`, meaning they display the "/clear before continuing" reminder. These skills should use the `--no-clear` flag since review sub-steps happen within a single session and clearing context between them is counterproductive.
**Fix:** Add `--no-clear` flag to the `display footer` calls in `skills/unit-test/SKILL.md`, `skills/bug-hunt/SKILL.md`, and `skills/uat/SKILL.md`.
