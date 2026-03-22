# RAPID Issues with Fix Planned (pragnition/RAPID)

*Generated: 2026-03-22 | Only issues with `<fix_planned>` in comments*

---

## Bugs

| # | Title | Summary | URL |
|---|-------|---------|-----|
| 3 | RAPID_TOOLS path resolution breaks in read-only/immutable installations (e.g. Nix) | DAG generation uses `${RAPID_TOOLS}/../lib/` which treats the .cjs file as a directory. Also, RAPID_ROOT is computed but not used for binary discovery, requiring unnecessary .env setup. | [#3](https://github.com/pragnition/RAPID/issues/3) |
| 7 | init skill: Step 4D writes REQUIREMENTS.md before Step 5 scaffold, which overwrites it | Scaffold creates blank REQUIREMENTS.md, overwriting user's acceptance criteria from Step 4D. Fix: reorder so scaffold runs before writing criteria. | [#7](https://github.com/pragnition/RAPID/issues/7) |
| 27 | review log-issue: CLI flags in skill docs don't match stdin-JSON implementation | Skill docs show CLI flags but implementation reads JSON from stdin. Flags are silently ignored. | [#27](https://github.com/pragnition/RAPID/issues/27) |

## Skill Improvements

| # | Title | Summary | URL |
|---|-------|---------|-----|
| 19 | discuss-set: gray area questions need richer inline context for informed decisions | Questions only provide 1-2 sentences of context. Users need research summaries, pros/cons tables, and recommended options to make informed architectural decisions. | [#19](https://github.com/pragnition/RAPID/issues/19) |
| 29 | unit-test skill: no guidance when concern groups exceed 5-group maximum | When REVIEW-SCOPE.md produces >5 concern groups, no merge/prioritize strategy exists. Needs auto-merge step or higher limit. | [#29](https://github.com/pragnition/RAPID/issues/29) |
| 31 | unit-test skill: hardcodes node --test instead of supporting language-native test runners | Forces `node --test` for all projects regardless of stack. Should auto-detect and use cargo test, pytest, go test, etc. | [#31](https://github.com/pragnition/RAPID/issues/31) |

---

**Total with fix planned:** 7 (4 bugs, 3 skill improvements)
