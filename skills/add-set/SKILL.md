---
description: Add a new set to an existing project mid-milestone with discovery and contract generation
allowed-tools: Bash(rapid-tools:*), Read, Write, Glob, Grep
---


## Dual-Mode Operation Reference

This skill supports both Claude Code CLI mode and the SDK web bridge. Every interactive prompt
follows the dual-mode pattern shown below; each call site wraps its own `if/else/fi` block.

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode: use the built-in tool exactly as before.
  # Use AskUserQuestion with the question/options below.
fi
```


# /rapid:add-set -- Add Set Mid-Milestone

You are the RAPID set adder. This skill adds a new set to the current milestone through a lightweight interactive discovery flow. It creates a set directory with DEFINITION.md and CONTRACT.json, updates STATE.json and ROADMAP.md, and suggests `/rapid:start-set` as the next action.

Follow these steps IN ORDER. Do not skip steps. This is a lightweight interactive command -- no subagent spawns.

**Dual-mode operation:** Every interactive prompt below checks `$RAPID_RUN_MODE`. When `RAPID_RUN_MODE=sdk`, the prompt is routed through the web bridge (free-form prompts use a dedicated MCP tool); otherwise the built-in tool is used. The if/else branches at each call site make both modes explicit.

## Step 0: Environment Setup + Banner

Load environment variables before any CLI calls:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill. Every `node "${RAPID_TOOLS}"` call must be preceded by the env loading block above in the same Bash invocation.

Display the stage banner:

```bash
# (env preamble here)
node "${RAPID_TOOLS}" display banner add-set
```

---

## Step 1: Load State and Validate

Load the full project state:

```bash
# (env preamble here)
STATE_JSON=$(node "${RAPID_TOOLS}" state get --all 2>/dev/null)
echo "$STATE_JSON"
```

Parse the JSON to extract:
- `MILESTONE_ID`: Current milestone ID
- `MILESTONE_NAME`: Current milestone name
- `EXISTING_SETS`: Array of existing sets with their statuses

Display current milestone context:

```
Milestone: {MILESTONE_ID} ({MILESTONE_NAME})
Existing sets:
  1. {set-id-1} ({status})
  2. {set-id-2} ({status})
  ...
```

**If STATE.json is missing or invalid:** Display error and suggest `/rapid:init`. STOP.

---

## Step 1.5: Check for Pending Remediation Artifacts

Check if any remediation artifacts exist from a previous `/rapid:audit-version` run:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
PENDING_DIR=".planning/pending-sets"
if [ -d "$PENDING_DIR" ]; then
  ARTIFACTS=$(ls "$PENDING_DIR"/*.json 2>/dev/null | wc -l)
  if [ "$ARTIFACTS" -gt 0 ]; then
    echo "PENDING_ARTIFACTS=$ARTIFACTS"
    ls "$PENDING_DIR"/*.json
  else
    echo "PENDING_ARTIFACTS=0"
  fi
else
  echo "PENDING_ARTIFACTS=0"
fi
```

**If PENDING_ARTIFACTS is 0:** Skip to Step 2 (standard interactive discovery). This is the graceful fallback path.

**If PENDING_ARTIFACTS is 1:** Read the single artifact file using the Read tool. Parse the JSON to extract `setName`, `scope`, `severity`, and `source`. Display the artifact context:

```
--- Pending Remediation Found ---
Set Name: {setName}
Scope: {scope}
Severity: {severity}
Source: {source}
---------------------------------
```

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with:
  #   question: "A remediation artifact was found from {source}. Use this to pre-populate the new set?"
  #   options: ["Yes -- use artifact", "No -- start fresh"]
  #   allow_free_text: false
  # Wait for the answer, then continue as below.
else
  # CLI mode: use the built-in tool exactly as before.
  # Use AskUserQuestion to confirm:
  # > "A remediation artifact was found from {source}. Use this to pre-populate the new set?"
  # > Options: ["Yes -- use artifact", "No -- start fresh"]
fi
```

- If "Yes": Set `SET_SCOPE = artifact.scope`, `SET_FILES_AND_DEPS = "Files: " + artifact.files.join(", ") + " | Deps: " + artifact.deps.join(", ")`, and `ARTIFACT_SET_NAME = artifact.setName`. Skip Step 2 (interactive discovery) and proceed to Step 3 with the artifact's set name pre-filled.
- If "No": Proceed to Step 2 as normal.

**If PENDING_ARTIFACTS is more than 1:** Read all artifact files. Present a selection list:

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with:
  #   question: "Multiple remediation artifacts found. Which one should be used for this set?"
  #   options: [one per artifact "{setName} -- {scope} ({severity})", plus "None -- start fresh"]
  #   allow_free_text: false
  # Wait for the answer, then continue as below.
else
  # CLI mode: use the built-in tool exactly as before.
  # Present a selection list using AskUserQuestion:
  # > "Multiple remediation artifacts found. Which one should be used for this set?"
  # > Options: One option per artifact formatted as "{setName} -- {scope} ({severity})" plus a final "None -- start fresh" option.
fi
```

- If user selects an artifact: Pre-populate as described above for the single-artifact case.
- If user selects "None -- start fresh": Proceed to Step 2 as normal.

Record `CONSUMED_ARTIFACT_NAME` (the setName of the consumed artifact, or null if none was used). This is needed for cleanup in Step 7.

---

## Step 2: Interactive Discovery (Mini Discuss-Set)

Ask the user 2 focused questions to understand the new set's scope.

**Question 1**:

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__ask_free_text with:
  #   question: "What should this new set accomplish? Describe the scope, goals, and key deliverables."
  # Wait for the free-form text answer, then continue as below.
else
  # CLI mode: use the built-in tool exactly as before.
  # Use AskUserQuestion (freeform):
  # > "What should this new set accomplish? Describe the scope, goals, and key deliverables."
fi
```

Record the answer as `SET_SCOPE`.

**Question 2**:

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__ask_free_text with:
  #   question: "What files or areas of the codebase will this set modify? Are there dependencies on existing sets?"
  # Wait for the free-form text answer, then continue as below.
else
  # CLI mode: use the built-in tool exactly as before.
  # Use AskUserQuestion (freeform):
  # > "What files or areas of the codebase will this set modify? Are there dependencies on existing sets?"
fi
```

Record the answer as `SET_FILES_AND_DEPS`.

---

## Step 3: Generate Set ID

If `ARTIFACT_SET_NAME` was set in Step 1.5 (from a consumed remediation artifact), propose that name as the set ID instead of deriving one from the scope description. The user still confirms or customizes the ID as normal.

Derive a kebab-case set ID from the user's scope description:
- Extract key nouns/verbs from the description
- Convert to lowercase, hyphen-separated
- Truncate to a reasonable length (e.g., "add payment processing" -> "payment-processing")

Display the proposed set ID.

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with:
  #   question: "Use set ID '{proposed-id}'?"
  #   options: ["Yes", "Custom ID"]
  #   allow_free_text: false
  # Wait for the answer, then continue as below.
else
  # CLI mode: use the built-in tool exactly as before.
  # Use AskUserQuestion:
  # "Use set ID '{proposed-id}'?"
  # Options:
  # - "Yes" -- "Use this set ID"
  # - "Custom ID" -- "I'll provide a different ID"
fi
```

- If "Yes": Use the proposed ID.
- If "Custom ID":
  ```
  if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
    # SDK mode: route through the web bridge.
    # Call mcp__rapid__ask_free_text with:
    #   question: "Enter your preferred set ID (kebab-case):"
    # Wait for the free-form text answer, then use it.
  else
    # CLI mode: use the built-in tool exactly as before.
    # Use AskUserQuestion (freeform): "Enter your preferred set ID (kebab-case):" and use the user's input.
  fi
  ```

### Validate Uniqueness

Check that the set ID is not already in use:

```bash
# (env preamble here)
STATE_JSON=$(node "${RAPID_TOOLS}" state get --all 2>/dev/null)
echo "$STATE_JSON"
```

Parse the JSON and check if any existing set has the same ID.

**If duplicate:** Display: "Set ID '{SET_ID}' already exists. Please choose a different ID."

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__ask_free_text with:
  #   question: "Enter a different set ID (kebab-case):"
  # Wait for the free-form text answer, then re-validate.
else
  # CLI mode: use the built-in tool exactly as before.
  # Use AskUserQuestion (freeform) to get a new ID. Re-validate until unique.
fi
```

Record `SET_ID` for subsequent steps.

---

## Step 4: Create Set Directory and Artifacts

Create the set directory structure:

```bash
mkdir -p ".planning/sets/${SET_ID}"
```

### Write DEFINITION.md

Write `.planning/sets/${SET_ID}/DEFINITION.md` using the Write tool:

```markdown
# Set: {SET_ID}

**Created:** {ISO date} (via /add-set)
**Milestone:** {MILESTONE_ID}

## Scope
{SET_SCOPE from Step 2, Question 1}

## Key Deliverables
{Extracted key deliverables from user's scope description}

## Dependencies
{Cross-set dependencies mentioned in Step 2, Question 2, or "None" if none mentioned}

## Files and Areas
{SET_FILES_AND_DEPS from Step 2, Question 2}
```

### Write CONTRACT.json

Write `.planning/sets/${SET_ID}/CONTRACT.json` using the Write tool:

```json
{
  "setId": "{SET_ID}",
  "milestone": "{MILESTONE_ID}",
  "created": "{ISO date}",
  "exports": { "functions": [], "types": [] },
  "imports": { "functions": [], "types": [] },
  "fileOwnership": []
}
```

Note: CONTRACT.json starts with empty arrays. File ownership, exports, and imports are populated during `/rapid:plan-set` when the planner analyzes the set in detail.

---

## Step 5: Update STATE.json and Recalculate DAG

Add the new set to the current milestone atomically using the CLI command. This uses `withStateTransaction` internally for safe mutation and automatically recalculates DAG.json and OWNERSHIP.json.

Determine dependencies from the user's `SET_FILES_AND_DEPS` answer in Step 2. If the user mentioned dependencies on existing sets, extract the set IDs and format them as a comma-separated list for the `--deps` flag. If no dependencies were mentioned, omit the `--deps` flag.

```bash
# (env preamble here)
node "${RAPID_TOOLS}" state add-set \
  --milestone "${MILESTONE_ID}" \
  --set-id "${SET_ID}" \
  --set-name "${SET_ID}" \
  [--deps "dep1,dep2"]
```

Parse the JSON output to confirm success. The output will be:
```json
{
  "setId": "...",
  "milestoneId": "...",
  "depsValidated": [...]
}
```

Commit the state change:

```bash
# (env preamble here)
node "${RAPID_TOOLS}" execute commit-state "add-set(${SET_ID}): add new set to milestone"
```

**If the CLI command fails:** Display the error message from stderr. Common failures:
- "Set X already exists" -- the set ID is a duplicate, ask user for a new ID
- "Dependency X not found" -- a referenced dependency does not exist in the milestone
- "STATE.json not found" -- project not initialized, suggest `/rapid:init`

Display: "Failed to add set to STATE.json. Your set artifacts were created at .planning/sets/${SET_ID}/ but state was not updated. Try re-running /rapid:add-set or manually add the set." STOP.

---

## Step 6: Update ROADMAP.md

Read `.planning/ROADMAP.md` using the Read tool.

Find the current milestone section in the ROADMAP.

Append a new set entry with the user's description. The format should match existing set entries in the ROADMAP.

Write the updated ROADMAP.md using the Write tool.

---

## Step 7: Commit and Next Steps

### Commit Artifacts

```bash
git add ".planning/sets/${SET_ID}/"
git add ".planning/ROADMAP.md"
git commit -m "add-set(${SET_ID}): add set to ${MILESTONE_ID}"
```

### Clean Up Consumed Artifact

If `CONSUMED_ARTIFACT_NAME` is set (a remediation artifact was used):

```bash
ARTIFACT_FILE=".planning/pending-sets/${CONSUMED_ARTIFACT_NAME}.json"
if [ -f "$ARTIFACT_FILE" ]; then
  rm "$ARTIFACT_FILE"
  echo "Cleaned up remediation artifact: $ARTIFACT_FILE"
fi
```

This ensures consumed artifacts are deleted after the set is successfully committed. If add-set fails before this point, the artifact survives for retry.

### Display Confirmation

```
Set '{SET_ID}' added to milestone '{MILESTONE_ID}'.
Status: pending
```

### Footer

Determine the new set's numeric index (position in the milestone's sets array).

Display the completion footer:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display footer "/rapid:start-set {SET_INDEX}"
```

---

## Error Handling

### Critical Errors (STOP immediately)

- `RAPID_TOOLS` not set: Show error and suggest `/rapid:install`
- `STATE.json` missing or invalid: Show error and suggest `/rapid:init`

### Recoverable Errors

- Duplicate set ID: Suggest alternative ID
- STATE.json write failure: Display error with manual recovery steps
- ROADMAP.md write failure: Display error (set was already added to STATE.json -- only ROADMAP.md is missing)

### Error Breadcrumb

On ANY error, show the failure point:

```
[RAPID ERROR] add-set failed at: {step name}
What's done: {what completed before failure}
Next: {what to run to recover}
```

---

## Anti-Patterns -- Do NOT Do These

- Do NOT auto-start the set -- the user runs `/rapid:start-set` separately (locked decision)
- Do NOT run a full discuss-set flow -- keep discovery to exactly 2 questions
- Do NOT spawn subagents -- this is a lightweight interactive skill (no Agent tool calls)
- Do NOT create a worktree -- worktree creation happens in `/rapid:start-set`
- Do NOT write wave PLAN.md files -- wave planning happens in `/rapid:plan-set`
- Do NOT use `state transition set` -- the new set is written directly to STATE.json as `pending`
- Do NOT modify existing sets -- only add the new set to the milestone
- Do NOT use the Write tool to modify STATE.json directly -- always use `state add-set` CLI command which provides atomic transactions via `withStateTransaction`
- Do NOT read STATE.json with `state get --all` and then write it back manually -- this creates race conditions and bypasses validation
- Do NOT skip the DAG recalculation -- `state add-set` handles this automatically; manual STATE.json edits would leave DAG.json inconsistent

## Key Principles

- **Mini discovery:** 2 focused questions to understand scope (not a full discuss-set flow)
- **CONTRACT.json generated:** Initially empty -- populated during `/rapid:plan-set`
- **STATE.json updated:** New set added with `pending` status to the current milestone's sets array
- **ROADMAP.md updated:** Set description appended to the current milestone section
- **Suggests `/rapid:start-set`:** Explicit next action, not auto-started (locked decision)
- **No subagent spawns:** Lightweight interactive command -- direct file creation and state mutation
- **Progress breadcrumb:** Shown at completion to orient the user in the workflow
- **Atomic state mutation:** STATE.json is mutated via `state add-set` CLI command, which uses `withStateTransaction` for lock-protected atomic writes with Zod validation
- **DAG consistency:** DAG.json and OWNERSHIP.json are automatically recalculated after every `state add-set` call
