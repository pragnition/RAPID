# Wave 2 Plan Digest

**Objective:** Wire test framework detection into init skill, remove 5-concern-group cap from unit-test skill, replace hardcoded node --test with config-based runner
**Tasks:** 3 tasks completed
**Key files:** skills/init/SKILL.md, skills/unit-test/SKILL.md
**Approach:** Added Step 6a to init skill for detectTestFrameworks + write-config integration, replaced hardcoded 5-group cap with dynamic ceil(totalGroups/3) batching with failure gates, replaced all hardcoded node --test references with config-based {runner}/{framework} lookup with autonomous fallback
**Status:** Complete
