# Wave 3 — Skill Prose Patches (9 SKILL.md files)

## Objective

Patch 9 interactive skill files with inline `if [ "$RAPID_RUN_MODE" = "sdk" ]` bash branches that route to `mcp__rapid__webui_ask_user` when running under the SDK agent runtime, while retaining built-in `AskUserQuestion` calls verbatim in the `else` branch for CLI parity. Total: 118 call sites.

## Committed Decisions (carried forward from research)

- **Wrapper shape is an in-prose bash block** wrapping each AUQ call. Both branches remain visible to the agent. No wrapper macros, no `SKILL.cli.md`/`SKILL.sdk.md` splitting.
- **No file forking.** Each skill file stays a single file; only the prose around AUQ calls changes.
- **Env var read at call-site.** `$RAPID_RUN_MODE` is read inside the skill's bash blocks at runtime.
- **Splice design (a) means AUQ calls that fit in ≤4 questions need NO patching** — they are intercepted by `can_use_tool` in Wave 1. BUT: skill authors may still want explicit sdk-branch instructions for UX consistency (e.g. to format questions differently, include options). **Decision: patch ALL 118 sites for uniformity and explicitness.** The interception is belt-and-braces for CLI runs; the explicit prose is authoritative for SDK runs.

## Patch Shape

For each AUQ call site, wrap it so the agent sees:

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge. Use mcp__rapid__webui_ask_user.
  # Call mcp__rapid__webui_ask_user with:
  #   question: "<same question text>"
  #   options: [<same options or null>]
  #   allow_free_text: <true|false>
  # Wait for the answer, then continue as below.
else
  # CLI mode: use the built-in AskUserQuestion tool exactly as before.
  # <ORIGINAL AskUserQuestion call prose, unchanged>
fi
```

Both branches are readable by the agent. The `else` branch preserves the original prose byte-for-byte; the `if` branch mirrors intent in parallel.

For **freeform text** call sites (marked in research), substitute `mcp__rapid__ask_free_text` for `mcp__rapid__webui_ask_user` in the sdk branch.

## Files Owned by this Wave (exclusive)

Edit only:
- `skills/discuss-set/SKILL.md` — 13 AUQ sites
- `skills/init/SKILL.md` — 38 AUQ sites
- `skills/new-version/SKILL.md` — 25 AUQ sites
- `skills/bug-fix/SKILL.md` — 3 AUQ sites (1 freeform at line 195)
- `skills/scaffold/SKILL.md` — 3 AUQ sites
- `skills/branding/SKILL.md` — 19 AUQ sites
- `skills/quick/SKILL.md` — 4 AUQ sites (1 freeform at line 34)
- `skills/assumptions/SKILL.md` — 5 AUQ sites
- `skills/add-set/SKILL.md` — 8 AUQ sites (3 freeform at lines 118, 124, 151)

**Do NOT:** touch any other skill files (`audit-version`, `backlog`, `bug-hunt`, `cleanup`, `context`, `execute-set`, `install`, `merge`, `migrate`, `pause`, `plan-set`, `resume`, `review`, `start-set`, `status`, `uat`, `unit-test`). Those files may `grep` as having AUQ in research finding 5 but CONTEXT.md narrows the scope to the 9 interactive skills listed above.

## Tasks

One task per skill file. Each task has the same shape:

### Task 1 — Patch `skills/discuss-set/SKILL.md` (13 sites)

1. Read the file in full.
2. For each AskUserQuestion call site: wrap with the `if [ "${RAPID_RUN_MODE}" = "sdk" ]; then ... else ... fi` bash block per the shape above.
3. For each, preserve the exact original text in the `else` branch.
4. In the `if` branch, translate the question(s) into the `mcp__rapid__webui_ask_user` invocation pattern. If the original AUQ call has `>4` questions batched (discuss-set does this), the sdk branch can still call `webui_ask_user` with all of them — Wave 1's >4 split handles chunking, OR the skill author may choose to emit N separate calls. **Prefer a single call with all questions; let the backend split.**
5. After editing: re-count AUQ sites. Original `AskUserQuestion` count should remain the same (only moved into `else` branches), and `mcp__rapid__webui_ask_user` count should equal the original AUQ count.

**Verification:**
```bash
grep -c "AskUserQuestion" skills/discuss-set/SKILL.md  # expect 13
grep -c "mcp__rapid__webui_ask_user\|mcp__rapid__ask_free_text" skills/discuss-set/SKILL.md  # expect 13
grep -c 'RAPID_RUN_MODE.*=.*sdk' skills/discuss-set/SKILL.md  # expect 13
```

### Task 2 — Patch `skills/init/SKILL.md` (38 sites)

Same shape. Expected post-counts: AUQ=38, webui_ask_user+ask_free_text=38, `RAPID_RUN_MODE=sdk`=38.

### Task 3 — Patch `skills/new-version/SKILL.md` (25 sites)

Same shape. Expected post-counts: AUQ=25, webui+free_text=25, RAPID_RUN_MODE=25.

### Task 4 — Patch `skills/bug-fix/SKILL.md` (3 sites)

Same shape. Line 195 is freeform — use `mcp__rapid__ask_free_text` in the sdk branch. Other 2 sites use `mcp__rapid__webui_ask_user`.
Expected: AUQ=3, webui+free_text=3 (ask_free_text=1, webui=2), RAPID_RUN_MODE=3.

### Task 5 — Patch `skills/scaffold/SKILL.md` (3 sites)

Same shape. Expected: AUQ=3, webui+free_text=3, RAPID_RUN_MODE=3.

### Task 6 — Patch `skills/branding/SKILL.md` (19 sites)

Same shape. Expected: AUQ=19, webui+free_text=19, RAPID_RUN_MODE=19.

### Task 7 — Patch `skills/quick/SKILL.md` (4 sites)

Line 34 is freeform. Expected: AUQ=4, webui+free_text=4 (ask_free_text=1, webui=3), RAPID_RUN_MODE=4.

### Task 8 — Patch `skills/assumptions/SKILL.md` (5 sites)

Same shape. Expected: AUQ=5, webui+free_text=5, RAPID_RUN_MODE=5.

### Task 9 — Patch `skills/add-set/SKILL.md` (8 sites)

Lines 118, 124, 151 are freeform. Expected: AUQ=8, webui+free_text=8 (ask_free_text=3, webui=5), RAPID_RUN_MODE=8.

## Success Criteria

- For each of the 9 files: grep counts match the expected values shown in each task.
- **Skills not listed are untouched.** Verify with `git diff --name-only -- skills/` and compare to the whitelist.
- **Every AskUserQuestion reference lives inside an `else` branch** of a `RAPID_RUN_MODE = sdk` if/else. Verified by a structural lint test in Wave 4, but you can spot-check with:
  ```bash
  # For each patched file, find AUQ references that are NOT preceded by "else" within 10 lines.
  # (The lint test does this rigorously; manual spot-check for one or two sites suffices.)
  ```
- No accidental edits to non-AUQ prose — use a careful diff review before committing.

## Out of Scope (do NOT touch in this wave)

- Backend code (Wave 1).
- Frontend code (Wave 2).
- Test files (Wave 4).
- Skill files outside the 9-file whitelist above.
- Any refactor of skill logic beyond wrapping AUQ calls.

## Implementation Notes

- **Work one file at a time.** The diffs are mechanical but error-prone at 118 sites. Commit after each file (one commit per skill file, matching RAPID atomic-commit discipline).
- **Commit message format:** `docs(web-tool-bridge): add sdk branch to <skill-name> SKILL.md` (`docs` because this is prose, not code).
- **Recommended order:** smallest files first (scaffold, bug-fix, quick, assumptions, add-set) before tackling the large ones (init=38, new-version=25, branding=19, discuss-set=13). Build muscle memory on small ones.
