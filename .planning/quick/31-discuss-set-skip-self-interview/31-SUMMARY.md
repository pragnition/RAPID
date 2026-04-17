# Quick Task 31: discuss-set-skip-self-interview

**Description:** Right now when discuss-set is called with --skip the agent just skips the discuss. This isn't ideal. Rewrite the prompt so that the agent asks itself the same questions it would have asked the user before, then answers its own questions. This dramatically improves performance.

**Date:** 2026-04-17
**Status:** COMPLETE
**Commits:** 7b02643, 8518309, ce12dad
**Files Modified:**
- skills/discuss-set/SKILL.md
- skills/discuss-set/SKILL.test.cjs

**Tests:** 20/20 passing (13 original + 7 new regression tests locking in self-interview protocol)

**Outcome:** `/rapid:discuss-set --skip <set>` now performs a self-interview (Phases A-D: gray-area identification via 4n heuristic, per-area self-deep-dive with Format A/B/C answers, deferred-item sweep against scope, CONTEXT.md write with all 5 XML tags populated with real rationales) instead of emitting a stub CONTEXT.md with blanket "Claude's Discretion" decisions.
