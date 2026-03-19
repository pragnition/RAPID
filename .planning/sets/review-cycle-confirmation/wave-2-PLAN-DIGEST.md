# Wave 2 Plan Digest

**Objective:** Add retry-on-failure confirmation gates to unit-test and UAT skills, update CONTRACT.json
**Tasks:** 5 tasks completed
**Key files:** skills/unit-test/SKILL.md, skills/uat/SKILL.md, .planning/sets/review-cycle-confirmation/CONTRACT.json
**Approach:** Inserted Step 5a retry gate in unit-test skill and Step 7a in UAT skill. Both prompt user to retry (test code fixes only) or accept, with max 2 retries. UAT explicitly excludes human verification failures from retry. Updated CONTRACT.json with UAT file ownership and acceptance criteria.
**Status:** Complete
