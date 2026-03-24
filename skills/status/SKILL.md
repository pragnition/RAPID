---
description: Show project dashboard with set statuses, last activity, and next actions
allowed-tools: Bash, Read, AskUserQuestion
---

# /rapid:status -- v4.2.1 Set Dashboard

You are the RAPID status viewer. This skill shows a set-level dashboard of all sets with their statuses, last git activity, and actionable next steps using v4.2.1 command names. This skill is **read-only** and never modifies any state. Follow these steps IN ORDER.

## Step 1: Load Environment

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

## Step 2: Load Dashboard Data

Read the full state to get milestone and set information:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
STATE_JSON=$(node "${RAPID_TOOLS}" state get --all 2>/dev/null)
STATE_EXIT=$?
echo "$STATE_JSON"
```

Parse the JSON output. The state contains the current milestone with its sets. Each set has a `name` and `status` field. The set statuses are: `pending`, `discussed`, `planned`, `executed`, `complete`, `merged`.

Also attempt to load DAG.json for wave-ordered display:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
DAG_JSON=$(node "${RAPID_TOOLS}" dag show 2>/dev/null)
DAG_EXIT=$?
echo "DAG_EXIT=$DAG_EXIT"
if [ $DAG_EXIT -eq 0 ]; then
  echo "$DAG_JSON"
fi
```

If `DAG_EXIT` is 0, the DAG was loaded successfully. Parse the output to determine wave groupings for display ordering. If `DAG_EXIT` is non-zero, fall back to canonical insertion order from STATE.json (the existing behavior).

**If STATE.json is missing or invalid** (exit code non-zero or empty output), display:

> "STATE.json not found. Run `/rapid:init` to initialize."

Then skip to the fallback in Step 4.

**If STATE.json loaded successfully**, also get last git activity for each set's branch:

For each set in the state, run:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
# Get last git activity for each set branch
# Replace {setName} with the actual set name for each set
for SET_NAME in {list of set names from state}; do
    LAST_ACTIVITY=$(git log -1 --format="%ci|%s" "rapid/$SET_NAME" 2>/dev/null || echo "no-branch")
    echo "$SET_NAME|$LAST_ACTIVITY"
done
```

Construct the actual bash command by substituting the real set names from the parsed state. Collect the results to build the dashboard.

## Step 3: Display Dashboard

Using the parsed state and git activity data, display a compact set-level dashboard.

1. Extract the current milestone name from the state.
2. Show the milestone name as a header:

   > ## {milestoneName} -- Set Dashboard

3. Display a set-level table (NO wave/job hierarchy):

   ```
   | # | Set | Status | Last Activity | Branch |
   |---|-----|--------|---------------|--------|
   | 1 | set-name | executing | 2h ago: "commit msg" | rapid/set-name |
   | 2 | other-set | pending | no branch | -- |
   | 3 | third-set | merged | 1d ago: "final fix" | rapid/third-set |
   ```

   - **Set ordering:** If DAG.json was loaded successfully in Step 2:
     - Group sets under wave headers: `**Wave 1:**`, `**Wave 2:**`, etc.
     - Within each wave, list sets in the order they appear in the DAG
     - The table format remains the same but rows are grouped under wave headers:

     ```
     **Wave 1:**
     | # | Set | Status | Last Activity | Branch |
     |---|-----|--------|---------------|--------|
     | 1 | foundation | merged | 2d ago: "final" | rapid/foundation |
     | 2 | core-lib | complete | 1d ago: "tests" | rapid/core-lib |

     **Wave 2:**
     | # | Set | Status | Last Activity | Branch |
     |---|-----|--------|---------------|--------|
     | 3 | api-layer | executing | 2h ago: "endpoints" | rapid/api-layer |
     | 4 | ui-shell | planned | no branch | -- |
     ```

     If DAG.json was NOT loaded (DAG_EXIT non-zero or DAG not available), fall back to canonical insertion order from STATE.json (NOT alphabetical). Use a single table without wave headers -- this is the existing behavior.
   - **Set**: The set name
   - **Status**: Set status from STATE.json (pending, discussed, planned, executed, complete, merged)
   - **Last Activity**: Relative time + commit message from the set's git branch, or "no branch" if no branch exists
   - **Branch**: `rapid/{setName}` if branch exists, `--` if not

4. After the table, display a tip line:

   > **Tip:** Use numeric shorthand with commands (e.g., `/rapid:start-set 1`, `/rapid:discuss-set 2`).

This is read-only -- no state modification.

### Edge Cases

- **No sets exist**: Display "No sets found. Run `/rapid:init` to get started."
- **All sets merged**: Display "All sets merged! Run `/rapid:new-version` to start the next milestone."
- **STATE.json missing**: Already handled in Step 2 -- display error message and skip to Step 4 fallback.

## Step 4: Per-Set Next Actions via AskUserQuestion

Based on each set's status, determine the suggested v4.2.1 next action:

| Set Status | Suggested Action         |
| ---------- | ------------------------ |
| pending    | `/rapid:start-set {N}`   |
| discussed  | `/rapid:discuss-set {N}` |
| planned    | `/rapid:plan-set {N}`    |
| executed   | `/rapid:execute-set {N}` |
| complete   | `/rapid:review {N}`      |
| merged     | (done)                   |

Where `{N}` is the 1-based numeric index of the set.

### Present actions

Collect all non-merged sets that have a suggested action. These are the actionable items.

**If 4 or fewer actionable sets:**

Use AskUserQuestion with one option per action plus a "Done" option:

- For each actionable set:
  - name: the v4.2.1 command with numeric shorthand (e.g., "/rapid:start-set 1")
  - description: what it does, including the full set name (e.g., "Start set-01-foundation for development")
- Always include: name "Done -- no action needed", description "Exit status dashboard"

**If more than 4 actionable sets:**

Show the top 4 via AskUserQuestion (same format, plus "Done" option). After the options, add a text note listing the remaining actions the user can run manually.

**After user selects an action:**

- If the developer selects an action option (not "Done"): display the command they should run as guidance text: "Run: `{action}`" -- do NOT execute it automatically. The status skill is read-only.
- If the developer selects "Done -- no action needed": display "Status check complete." and end the skill.

**Fallback (STATE.json missing, no state data):**

Use AskUserQuestion with:

- Option: "Run /rapid:init" -- "Initialize project state and planning infrastructure"
- Option: "Done viewing" -- "Exit status"

## Important Notes

- **Read-only skill:** This skill only reads state and git history. It never creates, modifies, or removes worktrees or state.
- **Data source:** STATE.json is the single source for set statuses (via `state get --all`). Git log provides last activity per branch.
- **Set-level only:** No wave or job information is displayed. The dashboard shows sets and their statuses directly.
- **v4.2.1 commands:** All suggested actions use v4.2.1 command names: start-set, discuss-set, plan-set, execute-set, review, merge, new-version.
- **AskUserQuestion:** Always used for next-action routing. Users pick from suggested commands or exit.
