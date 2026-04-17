# Quick Task 30: add-set shows dropdown of existing sets instead of a textarea

## Problem

When `/rapid:add-set` is invoked through the RAPID web UI (SDK web bridge), the
first interactive question ("What should this new set accomplish?") renders as a
**radio-button list of the existing set IDs** instead of a free-form textarea.
The user expects to type a free-form description of the new set.

## Root Cause Analysis

The SDK → web bridge has two MCP tools that drive the `AskUserModal` frontend:

- `mcp__rapid__ask_free_text(question)` — no options → frontend renders a
  `<textarea>` (see `AskUserModal.tsx` line 200 — the `!hasOptions` branch).
- `mcp__rapid__webui_ask_user(question, options, allow_free_text, ...)` — when
  `options` is a non-empty array, the frontend renders a radio list (see
  `AskUserModal.tsx` line 144 — the `hasOptions` branch).

Built-in `AskUserQuestion` calls are intercepted by
`can_use_tool_hook_bound` in `permission_hooks.py` and converted into a
multi-question bridge prompt; AUQ **always** carries options, so any AUQ call
also renders as radio/dropdown.

The add-set SKILL.md is supposed to emit a **free-text** prompt at Step 2, and
its `allowed-tools` frontmatter already excludes `AskUserQuestion`. But when
the skill body is injected into the agent prompt (see
`AgentSessionManager._enrich_prompt_with_skill`), Step 1 first prints the list
of existing sets:

```
Existing sets:
  1. {set-id-1} ({status})
  2. {set-id-2} ({status})
```

Immediately above Step 2's "Ask what this new set should accomplish" block.
The skill body also hosts a top-level "Dual-Mode Operation Reference" template
that literally says:

> Call mcp__rapid__webui_ask_user with the question/options below.

With that template fresh in context, plus a visible list of set IDs, the model
confuses the listing for candidate options and calls `webui_ask_user` with
`options=[existing set IDs]` instead of `ask_free_text(question=...)` as Step 2
explicitly instructs. The result: a radio list of existing sets.

This is a prompt-clarity bug in `skills/add-set/SKILL.md`. The fix is to make
Step 2 (and every other free-form question in add-set) unambiguous about which
MCP tool to call and to delete the misleading generic template from the top.

The same ambiguity affects Step 3 ("Custom ID") and the duplicate-ID retry
prompt and Step 2 Q2 — each already names `mcp__rapid__ask_free_text` in its
SDK branch, so they're correct but still live under the misleading
"Dual-Mode Operation Reference" that names `webui_ask_user`.

## Files to Modify

- `skills/add-set/SKILL.md` — tighten Step 2 prompts and the top-level
  dual-mode reference so the SDK branch unambiguously selects
  `mcp__rapid__ask_free_text` for free-form questions.

## Tasks

### Task 1: Fix the Dual-Mode Operation Reference at the top of add-set SKILL.md

**Files:** `skills/add-set/SKILL.md` (lines ~13-26, 35)

**Action:** Replace the generic "Call mcp__rapid__webui_ask_user" reference
template with a split that names the right MCP tool per question shape. The
current template reads:

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode: use the built-in tool exactly as before.
  # Use AskUserQuestion with the question/options below.
fi
```

Update it to explicitly state:

- Free-form (no options) questions MUST use `mcp__rapid__ask_free_text`
  (renders as a textarea).
- Multiple-choice questions (with fixed options) MUST use
  `mcp__rapid__webui_ask_user` (renders as a radio list).
- Call each per the Step-N instructions below; do NOT substitute.

Also update the paragraph immediately after ("Dual-mode operation: ...") to
mirror the same two-tool distinction so the model sees it twice.

**Done criteria:**
- The top-level template no longer mentions `webui_ask_user` as the sole SDK
  routing target.
- Both `ask_free_text` and `webui_ask_user` are named with a one-line rule for
  when each applies.

**Verify:**
```bash
grep -n "ask_free_text" skills/add-set/SKILL.md | head
grep -n "webui_ask_user" skills/add-set/SKILL.md | head
# Both terms should appear in the top-level reference section.
```

### Task 2: Harden Step 2 prompts against options-injection

**Files:** `skills/add-set/SKILL.md` (Step 2, lines ~164-200)

**Action:** For both Question 1 and Question 2 in Step 2, add an explicit
inline negative constraint so the model cannot confuse the Step 1 set listing
with answer options. Each SDK branch should read like:

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: this is a FREE-FORM question -- the user types their own answer.
  # Call mcp__rapid__ask_free_text with:
  #   question: "What should this new set accomplish? ..."
  # DO NOT call mcp__rapid__webui_ask_user here. DO NOT pass existing set IDs
  # (or any other values) as options -- this question has NO options.
```

Apply the same pattern to Q2 ("What files or areas...").

Also add a single line at the start of Step 2, above Question 1, stating:

> Both questions in this step are free-form text prompts. Do not reuse the
> existing-sets listing from Step 1 as answer choices -- the user types a
> fresh description.

**Done criteria:**
- Both Q1 and Q2 SDK branches call out `ask_free_text` by name and explicitly
  forbid using `webui_ask_user` or passing options.
- Step 2 has a preamble warning against reusing the Step 1 set listing.

**Verify:**
```bash
# Both SDK branches in Step 2 must explicitly name ask_free_text and DO NOT.
grep -c "DO NOT call mcp__rapid__webui_ask_user" skills/add-set/SKILL.md
# Expect: 2 (one per Step 2 question). This is a grep-based sanity check --
# the skill body is prose, not code, so any count >= 2 means both prompts
# got the guardrail.
```

### Task 3: Unit test for the dual-mode reference structure

**Files:** `skills/add-set/SKILL.test.cjs` (new or extended)

**Action:** Add a Node `assert` test (following the same shape as
`skills/uat/SKILL.test.cjs` and `skills/branding/SKILL.test.cjs`) that
verifies:

1. `skills/add-set/SKILL.md` frontmatter `allowed-tools` does NOT include
   `AskUserQuestion` (regression guard — the bridge must route AUQ, but the
   skill body itself should prefer the explicit MCP tools so the model has the
   clearest signal).
2. The file contains at least two occurrences of `mcp__rapid__ask_free_text`
   (Q1 and Q2 in Step 2), plus the custom-ID and retry prompts in Step 3.
3. The Step 2 free-text prompts are accompanied by an inline
   `DO NOT call mcp__rapid__webui_ask_user` guardrail.

The test should be runnable via `node skills/add-set/SKILL.test.cjs` with no
extra dependencies (use the built-in `node:test` + `node:assert/strict`
modules as the existing SKILL tests do).

**Done criteria:**
- `node skills/add-set/SKILL.test.cjs` passes.
- Tests cover (a) frontmatter lacks `AskUserQuestion`, (b) at least 4
  occurrences of `mcp__rapid__ask_free_text` in the body, (c) the guardrail
  phrase appears at least twice in Step 2.

**Verify:**
```bash
node skills/add-set/SKILL.test.cjs
# Expect: all tests pass, exit code 0.
```

## Success Criteria

- When `/rapid:add-set` is triggered from the web UI, the first prompt
  ("What should this new set accomplish?") renders as a textarea (no radio
  list of existing set IDs).
- The second prompt ("What files or areas...") also renders as a textarea.
- CLI mode is unaffected (still uses built-in `AskUserQuestion`, which the
  CLI renders natively).
- `node skills/add-set/SKILL.test.cjs` passes.
- No backend or frontend code changes required — the bug is entirely in the
  skill prompt. The frontend already renders textarea correctly when
  `options` is null; the backend already exposes both MCP tools. Fixing the
  skill prompt is the minimal and correct fix.

## Out of Scope

- Do NOT change the backend MCP tool signatures (`ask_user.py`).
- Do NOT change the frontend modal (`AskUserModal.tsx`).
- Do NOT touch the permission policy for add-set (falling through to
  `_default` is correct).
- Do NOT modify other skills' free-form prompts (e.g. discuss-set, quick) --
  only scope is add-set.
