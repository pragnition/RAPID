# Wave 1 Plan Digest

**Objective:** Fix all 4 broken `require('${RAPID_TOOLS}/../lib/...')` calls with `path.dirname()`-based resolution
**Tasks:** 4 tasks completed
**Key files:** skills/init/SKILL.md, skills/register-web/SKILL.md
**Approach:** Replaced `require('${RAPID_TOOLS}/../lib/...')` with `require(path.join(path.dirname('${RAPID_TOOLS}'), '..', 'lib', '...'))` in 4 locations across 2 files
**Status:** Complete
