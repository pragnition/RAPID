# Wave 3 Plan: Skill Integration + .gitignore

**Set:** update-reminder
**Wave:** 3 of 3
**Owner:** rapid-executor
**Estimated tasks:** 3
**Depends on:** Wave 2 (must be merged into the set branch first)

## Objective

Wire the wave-2 CLI surface into the user-facing skills, and gitignore the install metadata file:

1. Append a deferred update-reminder bash block to the end of `skills/status/SKILL.md` so every status check ends with the (possibly empty) banner.
2. Append the same deferred update-reminder bash block to the end of `skills/install/SKILL.md` so a fresh install acknowledges the just-recorded timestamp.
3. Add `.rapid-install-meta.json` to `.gitignore` so locally-recorded install timestamps are never committed.

After this wave, the full chain works end-to-end: install records the timestamp -> CLI exposes it -> skills emit the banner -> users see "your install is N days old" after running `/rapid:status` or `/rapid:install` once it ages past 7 days.

## Notes for the Executor

- **The bash block in each SKILL.md must be the LAST instruction before any closing notes section.** It must not appear before "Important Notes", because the banner is meant to be deferred -- it appears after primary skill output, not before.
- **Both blocks share an identical env-loading preamble** (the standard RAPID skill preamble). This is required because skills can be invoked either by the harness (which passes `RAPID_TOOLS` directly) or by users running `node "${RAPID_TOOLS}" ...` after sourcing `.env`. The preamble handles both paths.
- **Use literal backticks in the SKILL.md fenced bash blocks**, not escaped backticks. The CONTEXT.md examples used `\``` to escape inside its own fenced block; in the actual SKILL.md edit, the bash block uses three real backticks.
- **`.gitignore` is NOT in CONTRACT.json `ownedFiles`** -- the planner has authorized this as part of the technical decomposition. Without the gitignore entry, every developer who runs setup.sh would dirty their working tree with a `.rapid-install-meta.json` file.

## File Ownership

This wave creates or modifies exactly these files. No other files may be touched in wave 3.

| File | Action |
|------|--------|
| `skills/status/SKILL.md` | Modify -- append "Step 5: Update Reminder" section before "Important Notes" |
| `skills/install/SKILL.md` | Modify -- append "Step 6: Update Reminder" section after Step 5 |
| `.gitignore` | Modify -- add `.rapid-install-meta.json` entry |

## Tasks

### Task 1: Append Step 5 to `skills/status/SKILL.md`

**File:** `skills/status/SKILL.md` (currently 252 lines)

**Step 1.1 -- Insert a new "## Step 5: Update Reminder" section between Step 4 and "## Important Notes".**

The current structure ends with:

```markdown
- Option: "Done viewing" -- "Exit status"

## Important Notes
```

(line 243 ends Step 4's fallback, line 245 starts "## Important Notes").

Insert this block immediately AFTER the fallback content (after line 243) and BEFORE "## Important Notes" (currently line 245):

````markdown
## Step 5: Update Reminder

After the dashboard renders and any user action prompt is handled, emit the deferred update-reminder banner. This is a one-shot bash block at the very end of the skill -- it produces no output when the install is fresh, when stdout is non-TTY, or when `NO_UPDATE_NOTIFIER` is set, and a single dim line otherwise.

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
node "${RAPID_TOOLS}" display update-reminder
```

Do not interpret or react to the output. The CLI handles all gating internally; this skill only invokes it.
````

(Note for the executor: in the actual SKILL.md, use real triple-backticks, not escaped quad-backticks. The quad-backticks above are only because this plan file is itself a markdown document.)

**Step 1.2 -- Confirm structural integrity.** After the edit, the document should read in order:
1. ... (existing Steps 1-4)
2. `## Step 5: Update Reminder` (new)
3. The bash code block
4. The "Do not interpret or react..." sentence
5. `## Important Notes`
6. ... (existing notes)

The "Important Notes" section MUST come AFTER Step 5, not before. Verify with `grep -n "## " skills/status/SKILL.md` -- the headings should appear in order: ... Step 4 ..., Step 5: Update Reminder, Important Notes.

### Task 2: Append Step 6 to `skills/install/SKILL.md`

**File:** `skills/install/SKILL.md` (currently 332 lines)

**Step 2.1 -- Append a new "## Step 6: Update Reminder" section AFTER the existing Step 5.**

Step 5 currently ends at line 331:

```markdown
If "Done": display "RAPID v6.1.0 is ready. Happy building!"
```

Append the following AFTER that line (i.e., starting on what is currently line 332, the empty trailing line):

````markdown

## Step 6: Update Reminder

After the post-install action prompt is handled (or "Done" is selected), emit the deferred update-reminder banner. On a fresh install this is always a no-op (the timestamp was just written -- the install is 0 days old), but the call is unconditional so that re-running `/rapid:install` after months without setup.sh produces the right banner. The CLI handles all gating internally.

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
node "${RAPID_TOOLS}" display update-reminder
```

Do not interpret or react to the output. The CLI handles all gating internally; this skill only invokes it.
````

(Same note as Task 1: in the actual SKILL.md use real triple-backticks. Quad-backticks here are only because this plan file is itself markdown.)

**Step 2.2 -- Confirm Step 6 is the new file ending.** After the edit, `skills/install/SKILL.md` should end with the bash block + the "Do not interpret..." sentence. There should be no further sections after Step 6.

### Task 3: Add `.rapid-install-meta.json` to `.gitignore`

**File:** `.gitignore` (currently 33 lines)

**Step 3.1 -- Insert a new gitignore section after the existing `.env` block.**

Find this region (currently lines 13-15):

```
# Environment (generated by setup.sh, contains local paths)
.env
```

Insert immediately after line 14 (`.env`), preserving the existing trailing blank line:

```

# RAPID install metadata (generated by setup.sh, contains local install timestamp)
.rapid-install-meta.json
```

The result should be:

```
# Environment (generated by setup.sh, contains local paths)
.env

# RAPID install metadata (generated by setup.sh, contains local install timestamp)
.rapid-install-meta.json

# Dependencies
node_modules/
```

**Step 3.2 -- Verify .gitignore takes effect.** If a `.rapid-install-meta.json` file exists in the working tree from earlier wave-2 testing, run:

```bash
git check-ignore /home/kek/Projects/RAPID/.rapid-install-meta.json
```

This must print the filename and exit 0 (meaning the file IS ignored). If the file is currently tracked from accidental staging, untrack it with `git rm --cached .rapid-install-meta.json` (note: this is the only acceptable use of `git rm` in this wave, and only for an accidentally-tracked file).

## Verification

Run all of the following from `/home/kek/Projects/RAPID`. Each must exit 0.

**Step A -- Test suite still passes.** (Wave 3 doesn't add tests, but it must not break wave 1 tests.)

```bash
npm test
```

**Step B -- Status SKILL.md contains Step 5 in the correct position.**

```bash
grep -n "^## " /home/kek/Projects/RAPID/skills/status/SKILL.md
```

Expected: the headings appear in the order documented in Task 1 step 1.2 -- specifically, "## Step 5: Update Reminder" must precede "## Important Notes".

**Step C -- Status SKILL.md contains the display invocation.**

```bash
grep -n "display update-reminder" /home/kek/Projects/RAPID/skills/status/SKILL.md
```

Expected: at least one matching line. Exit code 0.

**Step D -- Install SKILL.md contains Step 6 at the end.**

```bash
grep -n "^## Step" /home/kek/Projects/RAPID/skills/install/SKILL.md
```

Expected: the LAST `## Step` heading is "## Step 6: Update Reminder".

**Step E -- Install SKILL.md contains the display invocation.**

```bash
grep -n "display update-reminder" /home/kek/Projects/RAPID/skills/install/SKILL.md
```

Expected: at least one matching line. Exit code 0.

**Step F -- .gitignore contains the new entry.**

```bash
grep -n "rapid-install-meta" /home/kek/Projects/RAPID/.gitignore
```

Expected: one matching line. Exit code 0.

**Step G -- The new entry actually ignores the file.** Create a test fixture, then verify:

```bash
node -e "require('./src/lib/version.cjs').writeInstallTimestamp('/home/kek/Projects/RAPID')"
git check-ignore /home/kek/Projects/RAPID/.rapid-install-meta.json
```

Expected: `git check-ignore` prints the path and exits 0 (file IS ignored).

**Step H -- End-to-end smoke (the full chain).** Force a stale timestamp and emit through the CLI:

```bash
node -e "
const fs = require('fs');
const ts = new Date(Date.now() - 8 * 86400000).toISOString();
fs.writeFileSync('/home/kek/Projects/RAPID/.rapid-install-meta.json', JSON.stringify({installedAt: ts}));
"
node /home/kek/Projects/RAPID/src/bin/rapid-tools.cjs state install-meta
NO_COLOR=1 node /home/kek/Projects/RAPID/src/bin/rapid-tools.cjs display update-reminder
```

Expected outputs:
- `state install-meta` returns JSON with non-null `timestamp`, `isStale: true`, `thresholdDays: 7`.
- `display update-reminder` prints `[RAPID] Your install is 8 days old. Run /rapid:install to refresh.` (no ANSI codes due to NO_COLOR).

**Step I -- Cleanup the test fixture.**

```bash
rm -f /home/kek/Projects/RAPID/.rapid-install-meta.json
```

**Step J -- Verify the working tree is clean (apart from this wave's edits).**

```bash
git status --short
```

Expected: only the three wave-3 file modifications appear (`.gitignore`, `skills/status/SKILL.md`, `skills/install/SKILL.md`). No `.rapid-install-meta.json` is tracked or untracked.

## Success Criteria

- `skills/status/SKILL.md` ends with a "Step 5: Update Reminder" section that contains the env-loading preamble and the `node "${RAPID_TOOLS}" display update-reminder` invocation, positioned BEFORE "Important Notes" (Steps B and C pass).
- `skills/install/SKILL.md` ends with a "Step 6: Update Reminder" section containing the same preamble and invocation, positioned as the LAST step in the file (Steps D and E pass).
- `.gitignore` contains a section header comment and the `.rapid-install-meta.json` line (Step F passes).
- `git check-ignore` confirms `.rapid-install-meta.json` is actually ignored (Step G passes).
- The end-to-end smoke (Step H) produces a recognizable banner string with `8 days old` and the `Run /rapid:install` call-to-action.
- `npm test` exits 0 (Step A passes; wave 1 tests still green).
- The test fixture `.rapid-install-meta.json` is cleaned up before commit (Step I).
- `git diff --stat` shows exactly three files changed: `skills/status/SKILL.md`, `skills/install/SKILL.md`, `.gitignore`.
