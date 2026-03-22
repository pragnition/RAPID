# RAPID Issues TODO (pragnition/RAPID)

*Generated: 2026-03-22 | Issues with `<fix_planned>` in comments*

---

## Bugs

### #2 — DOCS.md contains incorrect clone URL
**URL:** https://github.com/pragnition/RAPID/issues/2

**Problem:** `DOCS.md` contains clone URL `https://github.com/fishjojo1/RAPID.git` pointing to a personal fork instead of the org repo `https://github.com/pragnition/RAPID.git`. Caused confusion during a `rapid:init` session where automated issue filing failed because the repo didn't exist at the referenced URL.

**Location:** `DOCS.md` — line with `git clone https://github.com/fishjojo1/RAPID.git`

**Fix:** Simple find-and-replace to `https://github.com/pragnition/RAPID.git`

**Plan comment (fishjojo1):**
> Change docs to reflect pragnition org repo
this repo should still live on fishjojo1/RAPID
---

### #3 — RAPID_TOOLS path resolution breaks in read-only/immutable installations (e.g. Nix)
**URL:** https://github.com/pragnition/RAPID/issues/3

**Problem (two sub-issues):**
1. **DAG generation uses broken path arithmetic:** `skills/init/SKILL.md` line ~856 uses `${RAPID_TOOLS}/../lib/add-set.cjs`. When `RAPID_TOOLS` is a file path like `/store/rapid/src/bin/rapid-tools.cjs`, Node resolves `rapid-tools.cjs/../lib/` as `src/bin/lib/` (treating `.cjs` file as a directory) instead of the intended `src/lib/`.
2. **RAPID_ROOT is computed but unused:** Every skill preamble computes `RAPID_ROOT` from `CLAUDE_SKILL_DIR` but then falls back to `.env` or `RAPID_TOOLS` env var. Could derive `RAPID_TOOLS` from `RAPID_ROOT` to eliminate `.env` requirement.

**Current workaround (NixOS):** Symlink `src/bin/lib -> ../../src/lib` in plugin derivation, set `RAPID_TOOLS` via Claude Code `settings.json` env config.

**Plan comment (fishjojo1):**
> 1. Not an issue, nix rare lol use symlink fix
> 2. Should remove RAPID_ROOT if not used anywhere, this was used in v1.0.0 but should have been deprecated >= v2.0.0. Need to sweep codebase for references.

**TODO:** Sweep codebase for `RAPID_ROOT` references and remove if unused.

---

### #7 — init skill: Step 4D writes REQUIREMENTS.md before Step 5 scaffold, which overwrites it
**URL:** https://github.com/pragnition/RAPID/issues/7

**Problem:** `/rapid:init` Step 4D writes acceptance criteria to `.planning/REQUIREMENTS.md`, then Step 5 runs `init scaffold` which creates a blank template `REQUIREMENTS.md`, overwriting the user's criteria.

**Suggested fixes:**
- Reorder so scaffold (Step 5) runs BEFORE writing acceptance criteria (Step 4D)
- Or: scaffold checks if REQUIREMENTS.md has non-template content and skips it (consistent with "additive-only" design)

**Plan comment (fishjojo1):**
> Check if this is legit and fix if it is.

**TODO:** Verify the bug exists, then reorder or add guard.

---

### #27 — review log-issue: CLI flags in skill docs don't match stdin-JSON implementation
**URL:** https://github.com/pragnition/RAPID/issues/27

**Problem:** Skill docs show CLI flags (`--set-id`, `--type`, `--severity`, etc.) but `src/commands/review.cjs` (lines 66-91) only parses `args[0]` as set ID and `--post-merge` flag, then reads a full JSON object from **stdin** via `readStdinSync()`. All other CLI flags are silently ignored.

**What docs say (fails):**
```bash
node "${RAPID_TOOLS}" review log-issue --set-id "my-set" --type "test" ...
# Error: {"error":"No data on stdin"}
```

**What actually works:**
```bash
echo '{"id":"issue-001","type":"test",...}' | node "${RAPID_TOOLS}" review log-issue "my-set"
```

**Files:**
- `src/commands/review.cjs` (handler, lines 66-91)
- `src/lib/review.cjs` (Zod schema, lines 39-54)
- `skills/unit-test/SKILL.md` (incorrect docs, lines 294-302)

**Plan comment (fishjojo1):**
> Update to use the structured format for multi arg probably.

**TODO:** Update implementation to parse CLI flags and auto-generate `id`/`createdAt`, or update skill docs to show stdin JSON format.

---

## Skill Improvements

### #19 — discuss-set: gray area questions need richer inline context for informed decisions
**URL:** https://github.com/pragnition/RAPID/issues/19

**Problem:** Gray area questions only provide "1-2 sentences explaining this specific tradeoff." Users can't make informed architectural decisions without external research. Many end up picking "Claude decides" for everything, defeating the purpose.

**Proposed format change:** Each question should include:
1. 3-5 sentence context with research findings and concrete references
2. Pros/cons table for each option
3. A tagged "(Recommended)" option with rationale

**Current instruction location:** `skills/discuss-set/SKILL.md` Step 6

**Depends on:** #18 (pre-discussion research step)

**Plan comment (fishjojo1):**
> Makes sense.

**TODO:** Update SKILL.md Step 6 question format to include richer context, pros/cons table, and recommended option tagging.

---

### #29 — unit-test skill: no guidance when concern groups exceed 5-group maximum
**URL:** https://github.com/pragnition/RAPID/issues/29

**Problem:** Unit-test skill caps concern groups at 5 (Step 3). When REVIEW-SCOPE.md produces more (e.g., a protobuf set produced 10), no merge/prioritize strategy exists. The orchestrator had to manually decide how to merge.

**Plan comment (fishjojo1):**
> Will remove the semantic 5 group limit and let the unit tester perform a more generic unit testing workflow.
> Consideration: token use.

**TODO:** Remove the 5-group limit. Redesign unit-test dispatching for a more generic workflow. Watch token usage.

---

### #31 — unit-test skill: hardcodes node --test instead of supporting language-native test runners
**URL:** https://github.com/pragnition/RAPID/issues/31

**Problem:** Forces `node --test` with `node:test` + `node:assert/strict` for all projects regardless of stack. Breaks for Rust (cargo test), Python (pytest), Go (go test), protobuf (buf lint/breaking). Tests end up shelling out via `execSync` anyway. ESM `.ts` files can't be `require()`d from CJS test files.

**Plan comment (fishjojo1):**
> Will make unit test framework agnostic. Will add testing to research too in init.

**TODO:** Make test runner auto-detected/configurable based on project stack. Add test framework detection to `rapid:init` research phase. Core value is the plan-approve-execute-report pipeline, not the specific runner.

---

**Summary: 7 issues (4 bugs, 3 skill improvements)**

| # | Type | Effort | Key action |
|---|------|--------|------------|
| 2 | Bug | Trivial | Find-and-replace clone URL in DOCS.md |
| 3 | Bug | Low | Sweep and remove unused `RAPID_ROOT` references |
| 7 | Bug | Low | Verify and reorder init steps 4D/5 |
| 27 | Bug | Medium | Align review log-issue CLI with implementation |
| 19 | Improvement | Medium | Enrich discuss-set question format with research context |
| 29 | Improvement | Medium | Remove 5-group limit, generalize unit-test dispatch |
| 31 | Improvement | High | Make unit-test framework-agnostic + init research |
