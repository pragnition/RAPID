# Quick Task 1: fix-merge-clobber-protection

**Description:** Fix the merge system's clobber bug where Tier 2 heuristic resolution auto-resolves conflicts by preferring the file owner's version or earlier-wave version, even when those versions are stubs and the other set has working implementations.
**Date:** 2026-03-19
**Status:** COMPLETE
**Commits:** 302bedd, 868c6a4, dbe29d0
**Files Modified:** src/lib/merge.cjs, src/commands/merge.cjs, agents/rapid-set-merger.md, agents/rapid-conflict-resolver.md
