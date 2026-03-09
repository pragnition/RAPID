---
description: Show cross-set dashboard with set > wave > job hierarchy, progress, and actionable next steps
allowed-tools: Bash, Read, AskUserQuestion
---

# /rapid:status -- Mark II Set Dashboard

You are the RAPID status viewer. This skill shows a Mark II hierarchy dashboard of all sets, their wave progress, and actionable next steps. This skill is **read-only** and never modifies any state. Follow these steps IN ORDER.

## Step 1: Load Environment

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

## Step 2: Load Dashboard Data

Run the Mark II status command and load the set list for numeric index mapping:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
STATUS_V2=$(node "${RAPID_TOOLS}" worktree status-v2 2>/dev/null)
STATUS_EXIT=$?
SETS_LIST=$(node "${RAPID_TOOLS}" plan list-sets 2>/dev/null)
```

Parse the JSON stdout for `{ table, actions, milestone }`. Also parse `SETS_LIST` as a JSON array of set directory names (alphabetically sorted). This array provides the 1-based numeric index mapping: the first entry is index 1, the second is index 2, etc.

**If STATE.json is missing or invalid** (exit code non-zero or empty output), fall back to legacy status:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
node "${RAPID_TOOLS}" worktree status
```

If falling back, inform the user: "STATE.json not found -- showing legacy status. Run /rapid:init to set up Mark II state." Then show the legacy table and skip Steps 3-4. Use Step 4 fallback instead.

## Step 3: Display Dashboard

If status-v2 succeeded:

1. Parse the JSON from `STATUS_V2`. Extract `table`, `actions`, and `milestone` fields.
2. Show the milestone name as a header:

   > ## {milestone} -- Set Dashboard

3. Display the set/wave/job hierarchy with **numeric index prefixes**. Using the sorted set list from Step 2, compute the 1-based index for each set and prefix all display lines:

   **Sets** -- prefix with `{N}:` where N is the 1-based alphabetical index:
   ```
   1: set-01-foundation [executing]
   2: set-02-api [pending]
   3: set-03-ui [planning]
   ```

   **Waves** -- prefix with `{setIndex}.{waveIndex}:` indented under their set:
   ```
   1: set-01-foundation [executing]
     1.1: wave-01 [complete]    3/3 jobs done
     1.2: wave-02 [executing]   1/4 jobs done
   2: set-02-api [pending]
     2.1: wave-01 [pending]     0/2 jobs
   ```

   **Jobs** -- prefix with `{setIndex}.{waveIndex}.{jobIndex}:` indented under their wave (display only, not a functional reference):
   ```
   1: set-01-foundation [executing]
     1.1: wave-01 [complete]
       1.1.1: job-setup [complete]
       1.1.2: job-models [complete]
       1.1.3: job-tests [complete]
     1.2: wave-02 [executing]
       1.2.1: job-api [executing]
       1.2.2: job-auth [pending]
   ```

4. Also display the standard table columns for additional context:
   - **STATUS**: Set status from STATE.json (pending, planning, executing, reviewing, merging, complete)
   - **WORKTREE**: Worktree path from REGISTRY.json or "not created"
   - **UPDATED**: Relative time since last activity

5. After the dashboard, display a tip line:

   > **Tip:** Use numeric shorthand (e.g., `/rapid:set-init 1`, `/rapid:wave-plan 1.1`) instead of full set/wave names.

This is read-only -- no state modification.

### Edge Cases

- **No sets exist** (table says "No sets found"): Display "No sets found in the current milestone. Run /rapid:init or /new-milestone to get started."
- **All sets complete**: Display "All sets are complete. Consider running /merge or /cleanup."

## Step 4: Present Next Actions via AskUserQuestion

Use the `actions` array from Step 2. Each action has `{ action, setName, description }`.

### Convert actions to numeric shorthand

Before presenting actions, replace set/wave references with their numeric equivalents using the sorted set list from Step 2:
- `/rapid:set-init auth-system` becomes `/rapid:set-init 1` (where auth-system is set index 1)
- `/rapid:wave-plan auth wave-1` becomes `/rapid:wave-plan 1.1` (where auth is set 1 and wave-1 is wave 1 within that set)
- `/rapid:execute data-layer` becomes `/rapid:execute 2` (where data-layer is set index 2)
- `/rapid:discuss auth wave-2` becomes `/rapid:discuss 1.2`

Keep the description text readable (include the full set name for clarity), but use numeric shorthand in the command name itself.

**If 4 or fewer actions:**

Use AskUserQuestion with one option per action plus a "Done" option:
- For each action:
  - name: the command with numeric shorthand (e.g., "/rapid:set-init 1")
  - description: what it does, including full name for context (e.g., "Initialize set-01-foundation for development")
- Always include: name "Done -- no action needed", description "Exit status dashboard"

**If more than 4 actions:**

Show the top 4 via AskUserQuestion (same format as above, plus "Done" option). After the options, add a text note listing the remaining actions the user can run manually (also using numeric shorthand).

**After user selects an action:**

- If the developer selects an action option (not "Done"): display the command they should run as guidance text: "Run: `{action}`" -- do NOT execute it automatically. The status skill is read-only.
- If the developer selects "Done -- no action needed": display "Status check complete." and end the skill.

**Fallback (legacy mode, no actions array):**

Use AskUserQuestion with:
- Option: "Run /rapid:init" -- "Set up Mark II state tracking"
- Option: "Done viewing" -- "Exit status"

## Important Notes

- **Read-only skill:** This skill only reads state. It never creates, modifies, or removes worktrees or state.
- **Data sources:** Mark II reads from STATE.json (set > wave > job hierarchy) and REGISTRY.json (worktree paths). Legacy reads from REGISTRY.json only.
- **Reconciliation:** The legacy status command automatically reconciles the registry with actual git state. Mark II status-v2 reads state as-is.
- **AskUserQuestion:** Always used for next-action routing (UX-01 pattern). Dashboard format is docker-ps-style compact ASCII table.
