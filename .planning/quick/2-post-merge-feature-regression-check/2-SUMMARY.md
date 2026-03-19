# Quick Task 2: post-merge-feature-regression-check

**Description:** Add automatic post-merge feature regression detection. After git merge succeeds, compare exported symbols from both branches against the merged result. If any symbols are lost, revert the merge and return feature_regression.
**Date:** 2026-03-19
**Status:** COMPLETE
**Commits:** 76eeb5a, 093d007, a1f445f
**Files Modified:** src/lib/merge.cjs, src/commands/merge.cjs, skills/merge/SKILL.md, agents/rapid-set-merger.md, tests/merge-regression.test.cjs
