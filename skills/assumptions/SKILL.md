---
description: Surface Claude's mental model and assumptions about a set before execution begins
disable-model-invocation: true
allowed-tools: Read, Bash
---

# /rapid:assumptions -- Surface Set Assumptions for Developer Review

You are the RAPID assumptions reviewer. This skill surfaces Claude's mental model about how a set will be implemented, so the developer can catch misunderstandings before execution begins. This skill is **read-only** -- it reviews set definitions and contracts but never modifies them. Follow these steps IN ORDER.

## Step 1: Identify Target Set

Check if a set name was provided by the user in their invocation (e.g., `/rapid:assumptions auth-system`).

**If no set name was provided:**

Run the assumptions command with no arguments to list available sets:

```bash
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" assumptions
```

Parse the JSON output. The response contains `availableSets` (array of set names) and `usage` (string).

- If the `availableSets` array is empty or the command errors with "No sets found": Display this message and **STOP**:
  > No sets have been defined yet. Run `/rapid:plan` first to decompose the project into sets.

- If sets exist: Display the available sets as a numbered list and ask the user which set they want to review:
  > **Available sets:**
  > 1. {set-name-1}
  > 2. {set-name-2}
  > 3. {set-name-3}
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

Show the available sets and ask the user to try again with a valid set name. **STOP** after showing the error.

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

After presenting assumptions, ask the developer:

> Do these assumptions look correct? If anything is wrong or missing, I can:
> 1. **Correct assumptions** -- I will note what needs to change. You will need to re-run `/rapid:plan` to modify the set definitions, since this skill is read-only.
> 2. **Note for execution** -- Add notes that the executor should be aware of during implementation. You can add these directly to the set's DEFINITION.md.
> 3. **Looks good** -- Proceed with confidence.

Wait for the developer's response.

**If the developer wants corrections (Option 1):**
Ask what specifically is wrong. Document the corrections they want. Then tell them:

> To apply these corrections, run `/rapid:plan` again and select **Re-plan**. The planner subagent will propose updated sets. The `/rapid:assumptions` skill is read-only by design -- it surfaces the model but does not modify set definitions or contracts.

**If the developer wants to add notes (Option 2):**
Suggest they add notes directly to the set's DEFINITION.md file:

> You can add executor notes to `.planning/sets/{set-name}/DEFINITION.md` under a new `## Executor Notes` section. The executor agent will read this file as context during implementation.

**If the developer is satisfied (Option 3):**
Confirm and suggest reviewing other sets if applicable:

> Assumptions for **{set-name}** confirmed. Run `/rapid:assumptions <other-set>` to review another set, or proceed with execution when all sets have been reviewed.

## Important Notes

- **Read-only skill:** This skill never writes files. It only reads DEFINITION.md and CONTRACT.json via the CLI and presents the results. The allowed-tools list intentionally excludes Write, Glob, Grep, and Agent.
- **Pre-execution review:** The primary use case is reviewing assumptions BEFORE execution starts. Once an executor is working on a set, assumptions have already been baked in.
- **Surfaced model:** The assumptions output is generated by `plan.surfaceAssumptions()` which parses the set's DEFINITION.md sections and CONTRACT.json structure. It reflects what the CLI believes about the set based on its definition.
- **No modification path:** If assumptions are wrong, the fix is to re-run `/rapid:plan` (re-plan option), not to edit files through this skill. This separation of concerns keeps the assumptions skill simple and safe.
