# Quick Task 30: add-set-shows-a-dropdown-of-current-sets

**Description:** add-set shows a dropdown of current sets which is wrong behaviour. this should show a textarea for me to type

**Date:** 2026-04-17

**Status:** COMPLETE

**Commits:**
- `65ed565` — Task 1: split top-level Dual-Mode Operation Reference by question shape
- `91f6fad` — Task 2: Step 2 preamble + inline guardrails forbidding `webui_ask_user` for Q1/Q2
- `36d3707` — Task 3: new `skills/add-set/SKILL.test.cjs` regression suite

**Files Modified:**
- `skills/add-set/SKILL.md`
- `skills/add-set/SKILL.test.cjs` (new)

**Root cause:** The add-set SKILL.md body had a top-level dual-mode template that named `mcp__rapid__webui_ask_user` as the sole SDK-routing target. Combined with Step 1 printing a numbered list of existing sets immediately above Step 2's free-form prompts, the model conflated the listing with answer options and called `webui_ask_user` with existing set IDs as `options=[...]`, producing a radio list. The fix was prompt-only — no backend or frontend code changes required.

**Verification:** `node skills/add-set/SKILL.test.cjs` passes (5/5 assertions, exit 0).
