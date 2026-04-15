---
description: Ad-hoc changes without set structure -- planner, verifier, executor pipeline
allowed-tools: Bash(rapid-tools:*), Agent, AskUserQuestion, mcp__rapid__webui_ask_user, Read, Write, Glob, Grep
---

# /rapid:quick -- Quick Task

You are the RAPID quick task runner. This skill enables ad-hoc fire-and-forget changes without requiring full set lifecycle. It runs a 3-agent pipeline (planner -> plan-verifier -> executor) in-place on the current branch.

**Dual-mode operation:** Every interactive prompt below checks `$RAPID_RUN_MODE`. When `RAPID_RUN_MODE=sdk`, the prompt is routed through the web bridge (free-form prompts use a dedicated MCP tool); otherwise the built-in tool is used. Treat the `RAPID_RUN_MODE=sdk` branch and the CLI else branch as two renderings of the same question.

Follow these steps IN ORDER. Do not skip steps. The flow is fully autonomous after the initial task description -- do NOT prompt the user between pipeline steps.

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
node "${RAPID_TOOLS}" display banner quick
```

---

## Step 1: Gather Task Description

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__ask_free_text with:
  #   question: "Describe what you'd like to do. Be specific about the changes needed -- files, behavior, constraints."
  # Wait for the free-form text answer, then continue as below.
else
  # CLI mode: use the built-in tool exactly as before.
  # Use AskUserQuestion (freeform):
  # > "Describe what you'd like to do. Be specific about the changes needed -- files, behavior, constraints."
fi
```

Record the user's task description verbatim. This is the sole input -- no further user interaction during the pipeline.

---

## Step 2: Create Quick Task Directory

Compute the next ID using the monotonic counter from the JSONL log:

```bash
# (env preamble here)
LAST_ENTRY=$(node "${RAPID_TOOLS}" quick list --limit 1 2>/dev/null)
# Parse the max ID from the most recent entry (list returns descending by ID)
NEXT_ID=$(echo "$LAST_ENTRY" | node -e "
  const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8'));
  console.log(Array.isArray(data) && data.length > 0 ? data[0].id + 1 : 1);
")
echo "Next quick task ID: $NEXT_ID"
```

Generate a slug from the task description:
- Lowercase, replace spaces with hyphens, strip non-alphanumeric characters (except hyphens)
- Truncate to 40 characters

Create the directory:

```bash
mkdir -p ".planning/quick/${NEXT_ID}-${SLUG}"
```

Record `TASK_DIR=".planning/quick/${NEXT_ID}-${SLUG}"` and `NEXT_ID` for subsequent steps.

---

## Step 3: Spawn Planner Agent

Display: "Planning quick task..."

Spawn the **rapid-planner** agent with this task:

```
Plan a quick task for in-place execution (no worktree, no set lifecycle).

## Task Description
{user's task description from Step 1}

## Instructions
1. Analyze the task and determine which files need modification
2. Produce a single PLAN.md with 1-3 tasks (keep it focused -- this is a quick task, not a multi-wave set)
3. Write the plan to {TASK_DIR}/{NEXT_ID}-PLAN.md
4. Each task should have:
   - Name and files to modify
   - Clear action description
   - Verification command (automated where possible)
   - Done criteria

## Working Directory
{projectRoot}

<!-- RAPID:RETURN {"status":"COMPLETE","artifacts":["{TASK_DIR}/{NEXT_ID}-PLAN.md"]} -->
```

Parse RAPID:RETURN from the planner's output.

**If planner fails:**
Display error breadcrumb and STOP:
```
[RAPID ERROR] Quick task planner failed.
What's done: Task directory created at {TASK_DIR}
Next: Re-run /rapid:quick to try again
```

Verify the PLAN.md was written:

```bash
[ -f "{TASK_DIR}/{NEXT_ID}-PLAN.md" ] && echo "PLAN.md created" || echo "ERROR: PLAN.md not found"
```

If PLAN.md is missing, display error and STOP.

---

## Step 4: Spawn Plan Verifier Agent

Display: "Verifying plan..."

Read the PLAN.md content:

```bash
cat "{TASK_DIR}/{NEXT_ID}-PLAN.md"
```

Spawn the **rapid-plan-verifier** agent with this task:

```
Verify the quick task plan.

## Plan
{Full content of {NEXT_ID}-PLAN.md}

## Working Directory
{projectRoot}

## Output
Write VERIFICATION-REPORT.md to {TASK_DIR}/VERIFICATION-REPORT.md
```

Parse RAPID:RETURN for verdict.

**If FAIL:**
Display the issues from the verification report.

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with:
  #   question: "Plan verification failed for quick task {NEXT_ID}. Issues: {summary from VERIFICATION-REPORT.md}. What would you like to do?"
  #   options: ["Override", "Cancel"]
  #   allow_free_text: false
  # Wait for the answer, then continue as below.
else
  # CLI mode: use the built-in tool exactly as before.
  # Use AskUserQuestion:
  # "Plan verification failed for quick task {NEXT_ID}.
  #
  # Issues: {summary from VERIFICATION-REPORT.md}
  #
  # What would you like to do?"
  # Options:
  # - "Override" -- "Execute the plan despite verification failures"
  # - "Cancel" -- "Cancel this quick task"
fi
```

- If "Cancel": Display "Quick task {NEXT_ID} cancelled." and STOP.
- If "Override": Continue to Step 5.

**If PASS or PASS_WITH_GAPS:** Continue to Step 5.

---

## Step 5: Spawn Executor Agent

Display: "Executing quick task..."

Read the PLAN.md content again (in case verifier modified it).

Spawn the **rapid-executor** agent with this task:

```
Implement the quick task plan.

## Your PLAN
{Full content of {NEXT_ID}-PLAN.md}

## Commit Convention
After each task, commit with: quick({SLUG}): description

## Working Directory
{projectRoot}
```

**IMPORTANT:** No worktree path -- the executor works in the current directory (project root). This is in-place execution on the current branch.

Parse RAPID:RETURN from the executor's output. Extract:
- `status`: COMPLETE, CHECKPOINT, or BLOCKED
- `commits`: array of commit hashes
- `artifacts`: array of files modified

**If CHECKPOINT:**
Write a handoff file to `{TASK_DIR}/HANDOFF.md` with the executor's checkpoint details.
Display:
```
Quick task {NEXT_ID} paused at checkpoint.
Directory: {TASK_DIR}
Re-run /rapid:quick to continue.
```
STOP.

**If BLOCKED:**
Display the blocker details from RAPID:RETURN.
Display:
```
Quick task {NEXT_ID} blocked.
Blocker: {blocker description}
Directory: {TASK_DIR}
```
STOP.

---

## Step 6: Write Summary and Complete

Write `{TASK_DIR}/{NEXT_ID}-SUMMARY.md` with:

```markdown
# Quick Task {NEXT_ID}: {SLUG}

**Description:** {task description from Step 1}
**Date:** {ISO date}
**Status:** {COMPLETE/CHECKPOINT/BLOCKED from executor return}
**Commits:** {commit hashes from executor return}
**Files Modified:** {artifacts from executor return}
```

### Append to Quick Task Log

Record this task execution in the persistent JSONL log:

```bash
# (env preamble here)
node "${RAPID_TOOLS}" quick log \
  --description "{task description from Step 1}" \
  --outcome "{COMPLETE/CHECKPOINT/BLOCKED from executor return}" \
  --slug "${SLUG}" \
  --branch "$(git branch --show-current)"
```

This creates an append-only log entry at `.planning/memory/quick-tasks.jsonl` for future querying via `rapid-tools quick list` and `rapid-tools quick show`.

### Commit

Commit the quick task directory and JSONL log:

```bash
git add "{TASK_DIR}"
git add ".planning/memory/quick-tasks.jsonl"
git commit -m "quick({SLUG}): complete quick task {NEXT_ID}"
```

Display completion:

```
Quick task {NEXT_ID} complete.
Directory: {TASK_DIR}
```

Display the completion footer:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display footer "/rapid:status"
```

Do NOT add to STATE.json sets array (quick tasks are not sets -- avoids polluting /status).

---

## Error Handling

### Critical Errors (STOP immediately)

- `RAPID_TOOLS` not set: Show error and suggest `/rapid:install`
- `.planning/` directory missing: Show error and suggest `/rapid:init`

### Pipeline Failures

- Planner agent fails: STOP with error breadcrumb
- Verifier returns FAIL: Offer Override/Cancel via AskUserQuestion (when `RAPID_RUN_MODE=sdk`, routes to `mcp__rapid__webui_ask_user`)
- Executor returns CHECKPOINT: Write handoff file, suggest re-running `/rapid:quick`
- Executor returns BLOCKED: Display blocker details, STOP

### Error Breadcrumb

On ANY error, show the failure point:

```
[RAPID ERROR] Quick task failed at: {step name}
What's done: {what completed before failure}
Next: {what to run to recover}
```

---

## Anti-Patterns -- Do NOT Do These

- Do NOT create a worktree -- quick tasks execute in-place on the current branch
- Do NOT add full set lifecycle state to STATE.json (no `state transition set` calls)
- Do NOT use `state transition set` -- quick tasks have no set lifecycle state transitions
- Do NOT run discuss-set flow -- the user's task description IS the context
- Do NOT prompt between pipeline steps (fully autonomous after initial task description)
- Do NOT suggest /rapid:review after quick task (not a set, not reviewable via standard pipeline)
- Do NOT spawn per-wave researchers or decompose into waves -- this is a single plan, single execution pass
- Do NOT reference worktree paths in executor spawn -- executor works at project root

## Key Principles

- **Fire-and-forget:** User describes task, three agents handle the rest without further interaction
- **In-place execution:** Current branch, no worktree, no set lifecycle overhead
- **3-agent pipeline:** rapid-planner -> rapid-plan-verifier -> rapid-executor
- **Artifacts stored in `.planning/quick/`:** For auditability and history
- **No set lifecycle:** No STATE.json set entries, no state transitions, no worktrees
- **Fully autonomous:** After the initial task description, no user prompts until completion (exception: verification failure override)
