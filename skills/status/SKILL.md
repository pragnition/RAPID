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

Run the Mark II status command:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
STATUS_V2=$(node "${RAPID_TOOLS}" worktree status-v2 2>/dev/null)
STATUS_EXIT=$?
```

Parse the JSON stdout for `{ table, actions, milestone }`.

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

3. Display the ASCII table from the `table` field. The table has columns:
   - **SET**: Set identifier (max 20 chars)
   - **STATUS**: Set status from STATE.json (pending, planning, executing, reviewing, merging, complete)
   - **WAVES**: Compact wave progress per set (e.g., "W1: 3/5 done, W2: 0/3 pending") or "-" for sets with no waves
   - **WORKTREE**: Worktree path from REGISTRY.json or "not created"
   - **UPDATED**: Relative time since last activity

This is read-only -- no state modification.

### Edge Cases

- **No sets exist** (table says "No sets found"): Display "No sets found in the current milestone. Run /rapid:init or /new-milestone to get started."
- **All sets complete**: Display "All sets are complete. Consider running /merge or /cleanup."

## Step 4: Present Next Actions via AskUserQuestion

Use the `actions` array from Step 2. Each action has `{ action, setName, description }`.

**If 4 or fewer actions:**

Use AskUserQuestion with one option per action plus a "Done" option:
- For each action:
  - name: the command (e.g., "/set-init auth")
  - description: what it does (e.g., "Initialize the auth set for development")
- Always include: name "Done -- no action needed", description "Exit status dashboard"

**If more than 4 actions:**

Show the top 4 via AskUserQuestion (same format as above, plus "Done" option). After the options, add a text note listing the remaining actions the user can run manually.

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
