---
description: Complete current milestone and start a new version with 6-researcher pipeline and roadmap generation
allowed-tools: Bash(rapid-tools:*), Agent, AskUserQuestion, Read, Write, Glob, Grep
---

# /rapid:new-version -- New Milestone Lifecycle

You are the RAPID milestone manager. This skill creates a new milestone -- archiving the current milestone context, bumping the version, gathering new goals from the user, and re-running the 6-researcher > synthesizer > roadmapper pipeline for new scope.

Follow these steps IN ORDER. Do not skip steps. Use AskUserQuestion at every decision point.

## Step 0: Environment Setup + Banner

Load environment variables before any CLI calls:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill. Every `node "${RAPID_TOOLS}"` call must be preceded by the env loading block above in the same Bash invocation.

Display the stage banner:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display banner new-version
```

---

## Step 1: Read Current State

Read the current project state to understand where things stand:

```bash
node "${RAPID_TOOLS}" state get --all
```

Parse the JSON output. Display a summary to the user:

- **Current milestone:** {currentMilestone}
- **Number of sets:** {milestones[current].sets.length}
- **Set statuses:** List each set with its id and status (pending/discussed/planned/executed/complete/merged)

If state cannot be read, display the error and use AskUserQuestion:

- question: "Project state unavailable"
- Options:
  - "Retry" -- "Attempt to read project state again"
  - "Cancel" -- "Exit without changes"

**On error:** Show progress breadcrumb: `new-version [state read failed] > start-set > discuss-set > plan-set > execute-set > review > merge`

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

**Question C: Milestone Goals (Structured Categories)**

Gather goals across 5 categories using sequential AskUserQuestion prompts. Each category collects freeform input. Initialize an empty goals collection object with keys: features, bugFixes, techDebt, uxImprovements, deferredDecisions.

**Step 2C-i: Features**

Use AskUserQuestion with:
- question: "Category 1/5: New Features -- What new features or capabilities should this milestone deliver?"
- Options:
  - "Nothing for this category" -- "Skip -- no new features planned"
  - "Enter features" -- "Describe new features for this milestone"

If "Enter features": Ask freeform: "Describe the new features for this milestone. Be specific about what each feature should do."
Store response in goals.features.

**Step 2C-ii: Bug Fixes**

Use AskUserQuestion with:
- question: "Category 2/5: Bug Fixes -- Are there known bugs or issues to address in this milestone?"
- Options:
  - "Nothing for this category" -- "Skip -- no bug fixes planned"
  - "Enter bug fixes" -- "Describe bugs to fix in this milestone"

If "Enter bug fixes": Ask freeform: "Describe the bugs or issues to fix. Include reproduction steps or symptoms if known."
Store response in goals.bugFixes.

**Step 2C-iii: Tech Debt**

Use AskUserQuestion with:
- question: "Category 3/5: Tech Debt -- Any refactoring, cleanup, or infrastructure improvements?"
- Options:
  - "Nothing for this category" -- "Skip -- no tech debt work planned"
  - "Enter tech debt items" -- "Describe tech debt to address in this milestone"

If "Enter tech debt items": Ask freeform: "Describe the tech debt or infrastructure improvements to tackle."
Store response in goals.techDebt.

**Step 2C-iv: UX Improvements**

Use AskUserQuestion with:
- question: "Category 4/5: UX Improvements -- Any user experience, developer experience, or workflow improvements?"
- Options:
  - "Nothing for this category" -- "Skip -- no UX improvements planned"
  - "Enter UX improvements" -- "Describe UX improvements for this milestone"

If "Enter UX improvements": Ask freeform: "Describe the UX or developer experience improvements to make."
Store response in goals.uxImprovements.

**Step 2C-v: Deferred Decisions from Previous Milestone**

Read all DEFERRED.md files from previous milestone sets:

```bash
# Find all DEFERRED.md files
DEFERRED_FILES=$(find .planning/sets/*/DEFERRED.md 2>/dev/null)
```

**If no DEFERRED.md files exist (or all contain empty tables):**
Display: "Category 5/5: Deferred Decisions -- No deferred decisions found from previous milestone."
Set goals.deferredDecisions to empty.

**If DEFERRED.md files exist with content:**
Parse each DEFERRED.md file. The format is a markdown table with columns: #, Decision/Idea, Source, Suggested Target.

Collect all non-empty deferred items into a list. For each item, format as: "{Decision/Idea} (from set: {source set ID})".

Use AskUserQuestion with:
- question: "Category 5/5: Deferred Decisions -- Select which deferred items to include as goals for this milestone"
- multiSelect: true
- Options: one option per deferred item, formatted as "{Decision/Idea} (from set: {source set ID})" with description "{Suggested Target}"
- Plus a final option: "None of these" -- "Skip all deferred items"

Store selected items in goals.deferredDecisions.

**Step 2C-vi: Completeness Confirmation**

Display a consolidated summary of all captured goals, grouped by category:

```
## Goal Summary for {milestoneName}

### Features
{goals.features or "-- none --"}

### Bug Fixes
{goals.bugFixes or "-- none --"}

### Tech Debt
{goals.techDebt or "-- none --"}

### UX Improvements
{goals.uxImprovements or "-- none --"}

### Deferred Decisions (Carried Forward)
{goals.deferredDecisions formatted as bullet list, or "-- none --"}
```

Use AskUserQuestion with:
- question: "Is this complete? Review the goals above."
- Options:
  - "Yes, proceed" -- "All requirements captured. Continue to research pipeline."
  - "Add more" -- "Add additional goals (freeform, no category constraints)"

**If "Add more":**
Ask freeform: "What additional goals should be included? (These will be added as general goals without a specific category.)"
Store the response as goals.additionalGoals.
Redisplay the updated summary with a new section "### Additional Goals" and re-prompt the completeness confirmation. Loop until user selects "Yes, proceed".

**If "Yes, proceed":**
Continue to Step 3.

**Store the final goals:** After confirmation, compose the category-tagged goals string for downstream use. Format as:

```
## Features
{goals.features}

## Bug Fixes
{goals.bugFixes}

## Tech Debt
{goals.techDebt}

## UX Improvements
{goals.uxImprovements}

## Deferred Decisions
{goals.deferredDecisions}

## Additional Goals
{goals.additionalGoals}
```

This category-tagged string replaces `{goals from Step 2}` in all downstream references (Steps 5, 6, 7). Empty categories are omitted from the output.

## Step 3: Handle Unfinished Sets

Check the current milestone for sets that are NOT in "complete" or "merged" status.

If ALL sets are complete/merged (or there are no sets):
- Display: "All sets in {currentMilestone} are complete. Ready to move forward."
- Skip to Step 4.

If there are unfinished sets, display them:

| Set ID | Status | Description |
|--------|--------|-------------|
| (from state) | ... | ... |

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

## Step 4.5: Archive Old Milestone (Optional)

After creating the new milestone, offer the user the option to archive the old milestone's planning artifacts.

Use AskUserQuestion with:
- question: "Archive old milestone '{previousMilestone}' planning artifacts?"
- Options:
  - "Archive" -- "Move old planning artifacts to .planning/archive/{previousMilestone}/"
  - "Keep" -- "Leave artifacts in place. You can archive later."

**If "Archive":**

1. Create the archive directory structure:
```bash
mkdir -p .planning/archive/{previousMilestone}/sets
mkdir -p .planning/archive/{previousMilestone}/research
```

2. Move set artifacts from the old milestone to the archive:
```bash
# Move old set directories
# For each set that belonged to the previous milestone:
mv .planning/sets/{oldSetId} .planning/archive/{previousMilestone}/sets/
```

3. Move research files associated with the old milestone:
```bash
# Move milestone-prefixed research files
mv .planning/research/{previousMilestone}-* .planning/archive/{previousMilestone}/research/ 2>/dev/null
```

4. Move quick task artifacts if any exist:
```bash
if [ -d ".planning/quick" ] && [ "$(ls -A .planning/quick 2>/dev/null)" ]; then
  mkdir -p .planning/archive/{previousMilestone}/quick
  mv .planning/quick/* .planning/archive/{previousMilestone}/quick/
fi
```

5. Display: "Archived {N} artifacts to .planning/archive/{previousMilestone}/"

**Important:** Do NOT archive STATE.json (accumulates across milestones), config.json (global), or PROJECT.md (global).

**If "Keep":**

Display: "Artifacts kept in place." Continue to Step 5.

## Step 5: Run Research Pipeline

Spawn ALL 6 research agents in parallel to explore the new milestone's scope. Use the milestone goals from Step 2 as the research context.

Ensure `.planning/research/` exists:

```bash
mkdir -p .planning/research
```

**1. Spawn the **rapid-research-stack** agent with this task:**
```
Research technology stack implications for this milestone.

## Milestone Brief
Name: {milestoneName}
Goals: {category-tagged goals from Step 2C-vi}

## Brownfield Context
Read .planning/research/CODEBASE-ANALYSIS.md if it exists for existing codebase analysis. If it does not exist, treat this as building on the existing codebase.

## Carry-Forward Context
{If carryForwardSets is non-empty, list each carried-forward set with its ID, status, and description. If empty, state "No carry-forward sets from previous milestone."}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/{milestoneId}-research-stack.md
```

**2. Spawn the **rapid-research-features** agent with this task:**
```
Research feature implementation approach for this milestone.

## Milestone Brief
Name: {milestoneName}
Goals: {category-tagged goals from Step 2C-vi}

## Brownfield Context
Read .planning/research/CODEBASE-ANALYSIS.md if it exists for existing codebase analysis. If it does not exist, treat this as building on the existing codebase.

## Carry-Forward Context
{If carryForwardSets is non-empty, list each carried-forward set with its ID, status, and description. If empty, state "No carry-forward sets from previous milestone."}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/{milestoneId}-research-features.md
```

**3. Spawn the **rapid-research-architecture** agent with this task:**
```
Research architecture patterns and design decisions for this milestone.

## Milestone Brief
Name: {milestoneName}
Goals: {category-tagged goals from Step 2C-vi}

## Brownfield Context
Read .planning/research/CODEBASE-ANALYSIS.md if it exists for existing codebase analysis. If it does not exist, treat this as building on the existing codebase.

## Carry-Forward Context
{If carryForwardSets is non-empty, list each carried-forward set with its ID, status, and description. If empty, state "No carry-forward sets from previous milestone."}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/{milestoneId}-research-architecture.md
```

**4. Spawn the **rapid-research-pitfalls** agent with this task:**
```
Research potential pitfalls and anti-patterns to avoid for this milestone.

## Milestone Brief
Name: {milestoneName}
Goals: {category-tagged goals from Step 2C-vi}

## Brownfield Context
Read .planning/research/CODEBASE-ANALYSIS.md if it exists for existing codebase analysis. If it does not exist, treat this as building on the existing codebase.

## Carry-Forward Context
{If carryForwardSets is non-empty, list each carried-forward set with its ID, status, and description. If empty, state "No carry-forward sets from previous milestone."}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/{milestoneId}-research-pitfalls.md
```

**5. Spawn the **rapid-research-oversights** agent with this task:**
```
Research overlooked concerns, edge cases, and blind spots for this milestone.

## Milestone Brief
Name: {milestoneName}
Goals: {category-tagged goals from Step 2C-vi}

## Brownfield Context
Read .planning/research/CODEBASE-ANALYSIS.md if it exists for existing codebase analysis. If it does not exist, treat this as building on the existing codebase.

## Carry-Forward Context
{If carryForwardSets is non-empty, list each carried-forward set with its ID, status, and description. If empty, state "No carry-forward sets from previous milestone."}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/{milestoneId}-research-oversights.md
```

**6. Spawn the **rapid-research-ux** agent with this task:**
```
Research domain conventions and UX patterns for this milestone.

## Milestone Brief
Name: {milestoneName}
Goals: {category-tagged goals from Step 2C-vi}

## Brownfield Context
Read .planning/research/CODEBASE-ANALYSIS.md if it exists for existing codebase analysis. If it does not exist, treat this as building on the existing codebase.

## Carry-Forward Context
{If carryForwardSets is non-empty, list each carried-forward set with its ID, status, and description. If empty, state "No carry-forward sets from previous milestone."}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/{milestoneId}-research-ux.md
```

**Parallel spawning:** Spawn all 6 agents in a single response using 6 Agent tool calls.

**Sequential fallback:** If parallel spawning fails (Claude Code limitation), fall back to sequential execution. Inform the user: "Running research agents sequentially (parallel spawning unavailable)."

Wait for ALL 6 agents to complete. If any agent fails, use AskUserQuestion:
- question: "{agent name} research agent encountered an error: {error details}"
- Options:
  - "Retry" -- "Re-run this research agent"
  - "Skip" -- "Continue without this research output. Synthesis will have less context."
  - "Cancel" -- "Exit the milestone creation flow"

**On error:** Show progress breadcrumb: `new-version [research failed ({agent name})] > start-set > discuss-set > plan-set > execute-set > review > merge`

## Step 6: Research Synthesis

Spawn the **rapid-research-synthesizer** agent with this task:

```
Synthesize all research outputs into a unified research summary for milestone '{milestoneId}'.

## Research Files to Read
- .planning/research/{milestoneId}-research-stack.md
- .planning/research/{milestoneId}-research-features.md
- .planning/research/{milestoneId}-research-architecture.md
- .planning/research/{milestoneId}-research-pitfalls.md
- .planning/research/{milestoneId}-research-oversights.md
- .planning/research/{milestoneId}-research-ux.md

## Working Directory
{projectRoot}

## Output
Write synthesized summary to .planning/research/{milestoneId}-synthesis.md
```

Wait for completion. If it fails, use AskUserQuestion with Retry/Skip/Cancel options (same pattern as Step 5).

After completion, read `.planning/research/{milestoneId}-synthesis.md` to pass its content to the roadmapper.

**On error:** Show progress breadcrumb: `new-version [research done, synthesis failed] > start-set > discuss-set > plan-set > execute-set > review > merge`

## Step 7: Roadmapper Pipeline

Read `.planning/research/{milestoneId}-synthesis.md` (the synthesized research output).

Spawn the **rapid-roadmapper** agent with this task:

```
Create a roadmap for milestone '{milestoneId}'.

## Research Synthesis
{Full synthesis content from Step 6}

## Milestone Goals
{category-tagged goals from Step 2C-vi}

## Milestone Name
{milestoneName}

## Working Directory
{projectRoot}

## CRITICAL: Sets-Only Output
Output sets ONLY -- do NOT include wave or job structure. Waves are determined later during /plan-set. The return JSON structure should be: { roadmap, state, contracts } where state contains project > milestone > sets (no waves key, no jobs key).

## Instructions
1. Decompose the milestone into sets (groupings of related work)
2. Each set should be independent and parallelizable
3. Output SETS ONLY -- do NOT decompose into waves or jobs
4. Wave decomposition happens later in /plan-set
5. For each set: provide id, description, success criteria, and estimated complexity
```

Wait for the agent to complete. If it fails, use AskUserQuestion with Retry/Skip/Cancel options (same pattern as Step 5).

Parse the roadmapper's JSON response.

**On error:** Show progress breadcrumb: `new-version [research done, synthesis done, roadmap failed] > start-set > discuss-set > plan-set > execute-set > review > merge`

## Step 8: Propose and Approve Roadmap

Display the proposed roadmap to the user in a readable format:

```
## Proposed Roadmap for {milestoneName}

### Set 1: {set name}
  Description: ...
  Success Criteria: ...

### Set 2: {set name}
  Description: ...
  Success Criteria: ...

...
```

Use AskUserQuestion with:
- question: "Accept this roadmap?"
- Options:
  - "Accept" -- "Approve the roadmap and write it to project state. Sets will be created in STATE.json."
  - "Revise" -- "Provide feedback for the roadmapper to adjust the plan"
  - "Cancel" -- "Discard the proposed roadmap. The milestone exists but has no planned work."

**If "Accept":**

1. Write the roadmap content to ROADMAP.md (append new milestone section):
   Use the Write tool to update `.planning/ROADMAP.md` with the roadmapper's `roadmap` content.

2. Write CONTRACT.json files for each set:
   For each contract in the `contracts` array:
   ```bash
   mkdir -p .planning/sets/{setId}
   ```
   Use the Write tool to write `.planning/sets/{setId}/CONTRACT.json` with the contract content.

3. Write STATE.json with the project > milestone > sets structure:
   Use the Write tool to update `.planning/STATE.json` with the roadmapper's `state` content.
   Each set has only `{ id, name, status: "pending", branch }` -- no waves or jobs arrays.

Confirm: "Roadmap written and state updated."

**If "Revise":**

Ask freeform: "What changes would you like to the roadmap?"

Re-spawn the roadmapper agent with:
- All original context (synthesis, milestone goals, milestone name)
- The user's change request as additional feedback
- The previous roadmap proposal for reference
- The same CRITICAL sets-only instruction (no waves or jobs)

Loop back to display and re-prompt with the revised roadmap.

**If "Cancel":**

Display: "Roadmap discarded. Milestone {milestoneId} exists with no planned sets. You can run /rapid:new-version again or manually add sets."

Proceed to Step 9.

## Step 9: Completion Summary

Display the final summary:

```
New Milestone Created.

Milestone: {milestoneId} -- {milestoneName}
Sets planned: {count}
Carried forward: {count} from {previousMilestone}

Next step: /rapid:start-set 1
```

If no sets were planned (roadmap cancelled), display:

```
New Milestone Created.

Milestone: {milestoneId} -- {milestoneName}
Sets planned: 0
Carried forward: {count} from {previousMilestone}

Next step: /rapid:status
```

Show progress breadcrumb at the end:

```
new-version [done] > start-set > discuss-set > plan-set > execute-set > review > merge
```

---

## Important Constraints

- **Agents must NOT write STATE.json directly.** The SKILL.md orchestrator writes STATE.json using the Write tool with validated roadmapper output.
- **All 6 research agents are independent.** No research agent reads another research agent's output. They only share the milestone brief and brownfield analysis as inputs.
- **Contracts are generated by the roadmapper in a unified pass.** Individual sets do not generate their own contracts -- the roadmapper produces all contracts together to ensure cross-set consistency.
- **Roadmapper uses propose-then-approve.** The roadmapper returns a proposal; the user must explicitly accept before any files are written.
- **Sets only in state.** STATE.json contains project > milestone > sets hierarchy. Do NOT include waves or jobs in STATE.json -- wave decomposition happens later during /plan-set.
- **Archive is optional.** The user chooses whether to archive. Do NOT force archiving.

## Anti-Patterns -- Do NOT Do These

- Do NOT reference `state transition wave` or `state transition job` -- these state commands do not exist in v3. Only set-level state transitions exist (via `state transition set`).
- Do NOT ask the roadmapper to produce waves or jobs -- v3 defers wave decomposition to /plan-set. The roadmapper outputs sets only.
- Do NOT reference WAVE-CONTEXT.md or wave directories -- v3 uses set-level CONTEXT.md only.
- Do NOT reference `/rapid:set-init` -- the v3 command is `/rapid:start-set`.
- Do NOT include "waves" or "total jobs" counts in the completion summary or roadmap presentation -- only show "N sets planned".
- Do NOT write waves or jobs arrays into STATE.json -- each set has only `{ id, name, status: "pending", branch }`.
- Do NOT spawn only 5 researchers -- MUST spawn all 6 (stack, features, architecture, pitfalls, oversights, ux).
- Do NOT skip the UX researcher (rapid-research-ux) -- it is required for complete research coverage matching /init.
- Do NOT force archiving -- user explicitly chooses via AskUserQuestion.
