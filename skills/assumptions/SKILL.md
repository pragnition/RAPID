---
description: Surface Claude's mental model and assumptions about a set before execution begins
disable-model-invocation: true
allowed-tools: Read, Bash
args: []
categories: [autonomous]
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


# /rapid:assumptions -- Surface Set Assumptions for Developer Review

You are the RAPID assumptions reviewer. This skill surfaces Claude's mental model about how a set will be implemented, so the developer can catch misunderstandings before execution begins. This skill is **read-only** -- it reviews set definitions and contracts but never modifies them. Follow these steps IN ORDER.

**Dual-mode operation:** Every interactive prompt below checks `$RAPID_RUN_MODE`. When `RAPID_RUN_MODE=sdk`, the prompt is routed through the web bridge; otherwise the built-in tool is used. The if/else branches at each call site make both modes explicit.

## Step 1: Identify Target Set

Check if a set name was provided by the user in their invocation (e.g., `/rapid:assumptions auth-system` or `/rapid:assumptions 1`).

### Resolve Set Reference

If a set argument was provided, resolve it through the numeric ID resolver:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
RESOLVE_RESULT=$(node "${RAPID_TOOLS}" resolve set "<user-input>" 2>&1)
RESOLVE_EXIT=$?
if [ $RESOLVE_EXIT -ne 0 ]; then
  echo "$RESOLVE_RESULT"
  # Display the error message from the JSON and STOP
fi
SET_NAME=$(echo "$RESOLVE_RESULT" | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.resolvedId)")
```

Use `SET_NAME` for all subsequent operations. Continue to Step 2.

**If no set name was provided:**

Run the assumptions command with no arguments to list available sets:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" assumptions
```

Parse the JSON output. The response contains `availableSets` (array of set names) and `usage` (string).

- If the `availableSets` array is empty or the command errors with "No sets found": Display this message and end the skill:
  > No sets have been defined yet. Run `/rapid:plan` first to decompose the project into sets.

- If sets exist and there are **4 or fewer**:
  ```
  if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
    # SDK mode: route through the web bridge.
    # Call mcp__rapid__webui_ask_user with:
    #   question: "Select set"
    #   options: [each set name, plus "Other"]
    #   allow_free_text: true
    # Wait for the answer, then continue as below.
  else
    # CLI mode: use the built-in tool exactly as before.
    # Use AskUserQuestion with:
    # - question: "Select set"
    # - Options: Each set name as an option label (no consequence description needed since options are just names)
    # - Add an "Other" option with description "Type a set name manually"
  fi
  ```

  Map the user's selection to a set name. If they select "Other", ask them in plain text: "Which set would you like to review?" and accept their input.

- If sets exist and there are **more than 4**: Display the available sets as a numbered list and ask the user which set they want to review:
  > **Available sets:**
  > 1. {set-name-1}
  > 2. {set-name-2}
  > ...
  >
  > Which set would you like to review assumptions for? (Enter the name or number)

  Wait for the user's response. Map their answer to a set name (accept both the number and the name).

**If a set name was provided:**
Continue directly to Step 2 with that set name.

## Step 2: Surface Assumptions

Run the assumptions command for the specific set:

```bash
node "${RAPID_TOOLS}" assumptions <set-name>
```

Parse the output. The command returns structured text (not JSON) with sections covering scope understanding, file boundaries, contract assumptions, dependency assumptions, and risk factors.

**If the command fails** (set not found, file read error):
Display the error message, then list available sets by running:

```bash
node "${RAPID_TOOLS}" assumptions
```

Show the available sets and tell the user: "Set not found. Available sets are listed above. Run `/rapid:assumptions <set-name>` with a valid set name." End the skill.

**If successful:** Continue to Step 3 with the assumptions text.

## Step 3: Present Assumptions

Display the assumptions to the developer in a clear, readable format with section headers:

> ## Assumptions for Set: {set-name}
>
> ### Scope Understanding
> {scope analysis from the assumptions output}
>
> ### File Boundaries
> {owned files and boundary concerns}
>
> ### Contract Assumptions
> {exports, imports, behavioral expectations}
>
> ### Dependency Assumptions
> {upstream and downstream dependencies}
>
> ### Risk Factors
> {potential issues identified}

Present the assumptions exactly as surfaced by the CLI. Do not add interpretation or modify the content -- the point is to show Claude's raw mental model so the developer can validate it.

## Step 4: Developer Feedback

After presenting assumptions, collect developer feedback:

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with:
  #   question: "Assumptions"
  #   options: ["Correct assumptions", "Note for execution", "Looks good"]
  #   allow_free_text: false
  # Wait for the answer, then continue as below.
else
  # CLI mode: use the built-in tool exactly as before.
  # Use AskUserQuestion with:
  # - question: "Assumptions"
  # - Options:
  #   - "Correct assumptions" -- "Describe what needs to change -- you will need to re-run /rapid:plan to modify set definitions"
  #   - "Note for execution" -- "Add notes to the set's DEFINITION.md for the executor to see during implementation"
  #   - "Looks good" -- "Assumptions are correct, proceed with confidence"
fi
```

Then, follow up:

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: the same mcp__rapid__webui_ask_user call collects the developer's choice.
else
  # CLI mode:
  # Use AskUserQuestion to collect feedback.
fi
```

Wait for the developer's response.

**If the developer selects "Correct assumptions":**
Ask in plain text: "What specifically needs to change about these assumptions?" Collect their response. Then tell them:

> To apply these corrections, run `/rapid:plan` again and select **Re-plan**. The planner subagent will propose updated sets. The `/rapid:assumptions` skill is read-only by design -- it surfaces the model but does not modify set definitions or contracts.

End the skill.

**If the developer selects "Note for execution":**
Suggest they add notes directly to the set's DEFINITION.md file:

> You can add executor notes to `.planning/sets/{set-name}/DEFINITION.md` under a new `## Executor Notes` section. The executor agent will read this file as context during implementation.

End the skill.

**If the developer selects "Looks good":**

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with:
  #   question: "Continue"
  #   options: ["Review another set", "Done"]
  #   allow_free_text: false
  # Wait for the answer, then continue as below.
else
  # CLI mode: use the built-in tool exactly as before.
  # Show a SECOND AskUserQuestion with:
  # - question: "Continue"
  # - Options:
  #   - "Review another set" -- "Go back to set selection"
  #   - "Done" -- "Finish reviewing assumptions"
fi
```

- If **Review another set**: Loop back to Step 1 set selection (re-run the assumptions listing and present the set selection prompt again).
- If **Done**: Display "Assumptions review complete." and end the skill.

## Important Notes

- **Read-only skill:** This skill never writes files. It only reads DEFINITION.md and CONTRACT.json via the CLI and presents the results. The allowed-tools list intentionally excludes Write, Glob, Grep, and Agent.
- **Pre-execution review:** The primary use case is reviewing assumptions BEFORE execution starts. Once an executor is working on a set, assumptions have already been baked in.
- **Surfaced model:** The assumptions output is generated by `plan.surfaceAssumptions()` which parses the set's DEFINITION.md sections and CONTRACT.json structure. It reflects what the CLI believes about the set based on its definition.
- **No modification path:** If assumptions are wrong, the fix is to re-run `/rapid:plan` (re-plan option), not to edit files through this skill. This separation of concerns keeps the assumptions skill simple and safe.
