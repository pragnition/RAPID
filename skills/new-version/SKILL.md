---
description: Start a new milestone/version cycle, archiving current work and planning new scope
disable-model-invocation: true
allowed-tools: Bash(rapid-tools:*), Agent, AskUserQuestion, Read, Write
---

# /rapid:new-version -- New Milestone Lifecycle

You are the RAPID milestone manager. This skill creates a new milestone -- archiving the current milestone context, bumping the version, gathering new goals from the user, and re-running the research > roadmapper pipeline for new scope.

## Step 0: Load Environment

Load RAPID_TOOLS from .env if not set:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
echo "RAPID_TOOLS=$RAPID_TOOLS"
```

## Step 1: Read Current State

Read the current project state to understand where things stand:

```bash
node "${RAPID_TOOLS}" state get --all
```

Parse the JSON output. Display a summary to the user:

- **Current milestone:** {currentMilestone}
- **Number of sets:** {milestones[current].sets.length}
- **Set statuses:** List each set with its id and status (pending/executing/complete)

If state cannot be read, display the error and use AskUserQuestion:

- question: "Project state unavailable"
- Options:
  - "Retry" -- "Attempt to read project state again"
  - "Cancel" -- "Exit without changes"

## Step 2: Get New Milestone Details

Use AskUserQuestion to gather details about the new milestone:

**Question A: Milestone ID/Version**

Use AskUserQuestion with:
- question: "New milestone version"
- Options:
  - Suggest the next logical version based on current milestone (e.g., if current is "v1.0", suggest "v2.0")
  - "Other" -- "Enter a custom milestone ID/version"

If "Other" is selected, ask freeform: "What version/ID should the new milestone have?"

**Question B: Milestone Name**

Ask freeform: "Give a short name or description for this milestone (e.g., 'Mark III', 'API Rewrite', 'Performance Overhaul')."

**Question C: Milestone Goals**

Ask freeform: "Describe the goals for this milestone. What should be achieved? What features, improvements, or changes are in scope? Be as specific as possible -- this will guide the research and roadmap generation."

Store these values for use in subsequent steps.

## Step 3: Handle Unfinished Sets

Check the current milestone for sets that are NOT in "complete" status.

If ALL sets are complete (or there are no sets):
- Display: "All sets in {currentMilestone} are complete. Ready to move forward."
- Skip to Step 4.

If there are unfinished sets, display them:

| Set ID | Status | Waves | Description |
|--------|--------|-------|-------------|
| (from state) | ... | ... | ... |

Then use AskUserQuestion with:
- question: "Unfinished sets found"
- Options:
  - "Carry all forward" -- "Move all unfinished sets to the new milestone. They will be included in the new milestone's scope alongside new work."
  - "Select which to carry" -- "Choose which unfinished sets to bring forward. Others will remain in the current milestone as-is."
  - "Start fresh" -- "Leave all sets in the current milestone. The new milestone starts with a clean slate."

If "Carry all forward": Collect all unfinished sets as carryForwardSets.

If "Select which to carry": For each unfinished set, use AskUserQuestion:
- question: "Carry forward set '{set.id}'?"
- Options:
  - "Yes, carry forward" -- "Include this set in the new milestone"
  - "No, leave behind" -- "Keep this set in the current milestone"

Collect the selected sets as carryForwardSets.

If "Start fresh": Set carryForwardSets to empty array.

## Step 4: Create New Milestone

Run the add-milestone command. If there are carry-forward sets, pipe them as JSON stdin:

**Without carry-forward sets:**
```bash
node "${RAPID_TOOLS}" state add-milestone --id "{milestoneId}" --name "{milestoneName}"
```

**With carry-forward sets:**
```bash
echo '{carryForwardSetsJson}' | node "${RAPID_TOOLS}" state add-milestone --id "{milestoneId}" --name "{milestoneName}"
```

Replace `{milestoneId}`, `{milestoneName}`, and `{carryForwardSetsJson}` with actual values from Steps 2-3.

Parse the JSON result and confirm:
- "Created milestone {milestoneId} ({milestoneName})"
- "{setsCarried} sets carried forward" (if any)

If the command fails (e.g., duplicate milestone ID), display the error and use AskUserQuestion:
- question: "Milestone creation failed"
- Options:
  - "Try different ID" -- "Choose a different milestone ID/version"
  - "Cancel" -- "Exit without creating the milestone"

If "Try different ID": Loop back to Step 2 Question A only.

## Step 5: Run Research Pipeline

Spawn 5 parallel research agents to explore the new milestone's scope. Use the milestone goals from Step 2 as the research context.

Spawn the following **rapid-research-*** agents in parallel, each with a focused research question derived from the milestone goals:

1. Spawn the **rapid-research-stack** agent with this task:
   - Research technology stack implications for the milestone goals
   - Write findings to `.planning/research/{milestoneId}-research-stack.md`

2. Spawn the **rapid-research-features** agent with this task:
   - Analyze feature requirements and implementation approaches
   - Write findings to `.planning/research/{milestoneId}-research-features.md`

3. Spawn the **rapid-research-architecture** agent with this task:
   - Evaluate architecture patterns and design decisions
   - Write findings to `.planning/research/{milestoneId}-research-architecture.md`

4. Spawn the **rapid-research-pitfalls** agent with this task:
   - Identify common pitfalls and anti-patterns to avoid
   - Write findings to `.planning/research/{milestoneId}-research-pitfalls.md`

5. Spawn the **rapid-research-oversights** agent with this task:
   - Discover overlooked concerns and edge cases
   - Write findings to `.planning/research/{milestoneId}-research-oversights.md`

After all 5 agents complete, spawn the **rapid-research-synthesizer** agent with this task:
- Combine all research findings into coherent recommendations
- Input: `.planning/research/{milestoneId}-research-*.md`
- Output: `.planning/research/{milestoneId}-synthesis.md`

If any research agent fails, use AskUserQuestion:
- question: "Research agent {N} failed"
- Options:
  - "Retry" -- "Re-run the failed research agent"
  - "Skip" -- "Continue without this research thread"
  - "Cancel" -- "Exit the milestone creation flow"

## Step 6: Run Roadmapper Pipeline

Spawn the **rapid-roadmapper** agent with this task:
- Create a roadmap for the new milestone using the research synthesis
- Input: `.planning/research/{milestoneId}-synthesis.md`
- Milestone goals: {goals}
- Milestone name: {milestoneName}
- Output: Proposed roadmap sets and waves

The roadmapper should produce:
- A list of proposed sets (groupings of related work)
- Waves within each set (parallelizable units)
- Job descriptions for each wave
- Dependency relationships between sets

## Step 7: Propose and Approve Roadmap

Display the proposed roadmap to the user in a readable format:

```
## Proposed Roadmap for {milestoneName}

### Set 1: {set name}
  Wave 1: {wave description}
    - Job: {job description}
    - Job: {job description}
  Wave 2: ...

### Set 2: {set name}
  ...
```

Use AskUserQuestion with:
- question: "Accept this roadmap?"
- Options:
  - "Accept" -- "Approve the roadmap and write it to project state. Sets and waves will be created in STATE.json."
  - "Revise" -- "Provide feedback for the roadmapper to adjust the plan"
  - "Cancel" -- "Discard the proposed roadmap. The milestone exists but has no planned work."

If "Accept":
- Write the roadmap content to ROADMAP.md (append new milestone section)
- Update STATE.json with the sets, waves, and jobs via rapid-tools CLI
- Confirm: "Roadmap written and state updated."

If "Revise":
- Ask freeform: "What changes would you like to the roadmap?"
- Re-run the roadmapper agent with the feedback as additional context
- Loop back to display and re-prompt

If "Cancel":
- Display: "Roadmap discarded. Milestone {milestoneId} exists with no planned sets. You can run /rapid:new-version again or manually add sets."
- Proceed to Step 8.

## Step 8: Completion Summary

Display the final summary:

```
## New Milestone Created

**Milestone:** {milestoneId} -- {milestoneName}
**Sets planned:** {number of sets}
**Carried forward:** {number of carried sets} from {previousMilestone}
**Goals:** {brief goals summary}

### Next Steps
- Run `/rapid:status` to see the new milestone dashboard
- Run `/rapid:start-set` to begin working on a set
- Run `/rapid:execute-set` to begin executing planned work
```
