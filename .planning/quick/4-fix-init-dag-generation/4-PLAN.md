# Quick Task Plan: Fix Init DAG Generation

## Objective

The RAPID init skill (`skills/init/SKILL.md`) does not reliably generate DAG.json during initialization. Step 9d generates the DAG via an inline `node -e` command wrapped in a try/catch that silently swallows errors, and the skill instructions explicitly say "do NOT fail init" if DAG generation fails. This means projects can complete init without a DAG, requiring manual `dag generate` afterwards.

The fix: make DAG generation a mandatory, retried step in the init flow rather than a best-effort afterthought.

## Files to Modify

- `skills/init/SKILL.md` (lines ~899-905, and ~1018)

## Task 1: Make DAG generation mandatory with retry logic in Step 9d

**File:** `skills/init/SKILL.md`

**Action:**

Replace the current Step 9d DAG generation block (lines 899-905) which reads:

```
d) Generate DAG.json and OWNERSHIP.json from the newly written STATE.json and CONTRACT.json files:
   ```bash
   node -e "const { recalculateDAG } = require('${RAPID_TOOLS}/../lib/add-set.cjs'); recalculateDAG(process.cwd(), '{milestoneId}').then(() => console.log('DAG.json created.')).catch(e => console.error('Warning: DAG generation failed:', e.message))"
   ```
   Where `{milestoneId}` is the milestone ID from the roadmapper's `state.currentMilestone` field.

   If this command fails (prints a warning), do NOT fail init. The DAG will be generated automatically by the first `state add-set` call or can be triggered manually later.
```

With a new version that:

1. Uses the CLI command `node "${RAPID_TOOLS}" dag generate` instead of the inline `node -e` one-liner (this is cleaner and uses the same code path as manual DAG generation).
2. Checks the exit code. If it fails, retries once after a brief pause.
3. If both attempts fail, uses AskUserQuestion to offer the user "Retry" / "Skip DAG" / "Cancel init" options, making it explicit that the DAG was not generated rather than silently continuing.
4. Removes the language "do NOT fail init" -- DAG generation should be treated as an expected outcome, not optional.

The replacement text should be:

```
d) Generate DAG.json and OWNERSHIP.json from the newly written STATE.json and CONTRACT.json files:

   ```bash
   if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
   node "${RAPID_TOOLS}" dag generate
   ```

   Where the CLI reads STATE.json to find the current milestone and generates DAG.json and OWNERSHIP.json from the set contracts.

   Verify DAG.json was created:

   ```bash
   if [ -f .planning/sets/DAG.json ]; then
     echo "DAG.json created successfully."
   else
     echo "DAG.json NOT found after generation."
     exit 1
   fi
   ```

   If the verification fails (DAG.json does not exist), retry the generation command once:

   ```bash
   if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
   node "${RAPID_TOOLS}" dag generate
   ```

   If the second attempt also fails, use AskUserQuestion with:
   - question: "DAG.json generation failed after two attempts. The project was initialized but the dependency graph is missing."
   - Options:
     - "Retry" -- "Try generating DAG.json again"
     - "Skip" -- "Continue without DAG.json. Run /rapid:status then `dag generate` manually later."
     - "Cancel" -- "Exit initialization. Planning files are preserved on disk."
   - If "Retry": Loop back and attempt DAG generation again.
   - If "Skip": Log a warning "WARNING: DAG.json was not generated. Run `dag generate` before starting sets." and continue to Step 10.
   - If "Cancel": End the skill with "Cancelled. Planning files preserved."
```

**Verification:**
- Read `skills/init/SKILL.md` and confirm the old permissive error-handling text is gone
- Confirm the new block uses `node "${RAPID_TOOLS}" dag generate` (the CLI command)
- Confirm there is a file-existence check after generation
- Confirm there is retry logic and an AskUserQuestion fallback

**Done when:** The init skill instructions mandate DAG generation with retry and explicit user choice on failure, instead of silently continuing.

## Task 2: Verify DAG.json is listed in the completion summary

**File:** `skills/init/SKILL.md`

**Action:**

Confirm that line ~1018 already lists `.planning/sets/DAG.json` in the Step 11 completion summary (it does based on current reading). No change needed here -- this is a verification-only task to ensure the completion output is consistent with the new mandatory behavior.

If for some reason it is missing, add it to the "Files Created" list.

**Verification:**
```bash
grep -n 'DAG.json' skills/init/SKILL.md
```
Should show DAG.json referenced in both the generation step and the completion summary.

**Done when:** DAG.json appears in both the Step 9d generation instructions and the Step 11 file listing.

## Success Criteria

1. The init skill no longer silently swallows DAG generation failures
2. DAG generation uses the canonical `dag generate` CLI command
3. There is a file-existence verification after generation
4. Failed DAG generation retries once automatically, then prompts the user
5. The user always knows whether DAG.json was created or not
