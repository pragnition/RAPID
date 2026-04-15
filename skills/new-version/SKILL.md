---
description: Complete current milestone and start a new version with adaptive research pipeline and roadmap generation
allowed-tools: Bash(rapid-tools:*), Agent, Read, Write, Glob, Grep
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


# /rapid:new-version -- New Milestone Lifecycle

You are the RAPID milestone manager. This skill creates a new milestone -- archiving the current milestone context, bumping the version, gathering new goals from the user, and re-running the adaptive research > synthesizer > roadmapper pipeline for new scope.

**Dual-mode operation:** Every interactive prompt below checks `$RAPID_RUN_MODE`. When `RAPID_RUN_MODE=sdk`, the prompt is routed through the web bridge (with `allow_free_text` flagged per prompt); otherwise the built-in tool is used. Inline annotations on each prompt mention below make the dual routing explicit.

Follow these steps IN ORDER. Do not skip steps. At every decision point:

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the decision-point question and options.
else
  # CLI mode:
  # Use AskUserQuestion.
fi
```

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

### Step 0.5: Parse Optional Arguments

If the user invoked `/new-version` with arguments, parse them here. The supported argument is `--spec <path>` which provides a structured Markdown file to pre-populate milestone goals.

**Argument parsing instructions:**

1. Check if the skill was invoked with arguments (the user's input after `/rapid:new-version`).
2. If the input contains a file path argument (with or without the `--spec` prefix), treat it as a spec file path.
   - With prefix: `/rapid:new-version --spec path/to/spec.md`
   - Without prefix: `/rapid:new-version path/to/spec.md`
3. Read the spec file using the Read tool.
   - If the file does not exist or cannot be read, display a warning: **"Spec file not found at {path}. Falling back to interactive goal-gathering."** and set `specContent = null`.
   - If the file is read successfully, store its full content as `specContent` for use in Step 2C.
4. If no arguments were provided, set `specContent = null`. This is the backward-compatible default.

When `specContent` is null, all subsequent steps behave identically to the original flow.

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

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
If state cannot be read, display the error and use AskUserQuestion :

- question: "Project state unavailable"
- Options:
  - "Retry" -- "Attempt to read project state again"
  - "Cancel" -- "Exit without changes"
fi
```

**On error:** Show progress breadcrumb: `new-version [state read failed] > start-set > discuss-set > plan-set > execute-set > review > merge`

## Step 2: Get New Milestone Details

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
Use AskUserQuestion to gather details about the new milestone:

fi
```
**Question A: Milestone ID/Version**

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
Use AskUserQuestion with:
- question: "New milestone version"
- Options:
  - Suggest the next logical version based on current milestone (e.g., if current is "v1.0", suggest "v2.0")
  - "Other" -- "Enter a custom milestone ID/version"
fi
```

If "Other" is selected, ask freeform: "What version/ID should the new milestone have?"

**Question B: Milestone Name**

Ask freeform: "Give a short name or description for this milestone (e.g., 'Mark III', 'API Rewrite', 'Performance Overhaul')."

**Question C: Milestone Goals (Structured Categories)**

Gather goals across 5 categories using sequential prompts:

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: substitute mcp__rapid__webui_ask_user for each category prompt.
else
  # CLI mode:
  # Use sequential AskUserQuestion prompts, one per category.
fi
```

Each category collects freeform input. Initialize an empty goals collection object with keys: features, bugFixes, techDebt, uxImprovements, deferredDecisions.

**If `specContent` is not null, execute the Spec-Aware Goal Extraction flow instead of Steps 2C-i through 2C-v:**

#### Spec-Aware Goal Extraction

1. **Semantic Category Extraction:** Read `specContent` and semantically map its content to the 5 goal categories: `features`, `bugFixes`, `techDebt`, `uxImprovements`, `deferredDecisions`. The spec file uses structured Markdown with category headings (e.g., `## Features`, `## Bug Fixes`, `## Technical Debt`, etc.). Use LLM understanding to match headings to categories even if the exact heading text differs (e.g., "## New Capabilities" maps to features, "## Cleanup" maps to techDebt). Content under unrecognized headings should be placed in `additionalGoals`.

2. **Deferred Items Injection:** Before presenting the extracted goals, also run the DEFERRED.md auto-discovery from Step 2C-v (including the expanded archive discovery). Append any discovered deferred items to the `deferredDecisions` category automatically.

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
3. **Single Confirmation Prompt:** Display the extracted goals in the same summary format as Step 2C-vi (the category-grouped summary). Then use AskUserQuestion with:
   - question: "Goals extracted from spec file. Review and confirm."
   - Options:
     - "Accept all" -- "Proceed with these goals as-is"
     - "Review individually" -- "Step through each category with Accept/Augment/Replace options"
     - "Add more" -- "Add additional goals beyond what the spec contains"
fi
```

4. **If "Accept all":** Set all goal categories from extracted content. Skip to Step 2C-vi completeness confirmation (the "Yes, proceed" gate).

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
5. **If "Review individually":** For each of the 5 categories, display the extracted content (or "-- empty --" if spec had nothing for that category) and use AskUserQuestion with:
   - question: "Category {N}/5: {categoryName}"
   - Options:
     - "Accept" -- "Keep extracted content as-is"
     - "Augment" -- "Add to the extracted content"
     - "Replace" -- "Discard extracted content and enter new content"
   - If "Augment": Ask freeform "What would you like to add to this category?" and append the response to the extracted content.
   - If "Replace": Ask freeform "Enter new content for this category." and replace the extracted content entirely.
   - If the category was empty in the spec, fall back to the original interactive prompt for that category (the existing Step 2C-i through 2C-v behavior for that single category).
   After all 5 categories reviewed, proceed to Step 2C-vi completeness confirmation.
fi
```

6. **If "Add more":** Same behavior as the existing "Add more" in Step 2C-vi -- ask freeform and append to additionalGoals, then re-display and re-prompt.

**If `specContent` is null, proceed with the original Steps 2C-i through 2C-v as written below.**

**Step 2C-i: Features**

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
Use AskUserQuestion with:
- question: "Category 1/5: New Features -- What new features or capabilities should this milestone deliver?"
- Options:
  - "Nothing for this category" -- "Skip -- no new features planned"
  - "Enter features" -- "Describe new features for this milestone"
fi
```

If "Enter features": Ask freeform: "Describe the new features for this milestone. Be specific about what each feature should do."
Store response in goals.features.

**Step 2C-ii: Bug Fixes**

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
Use AskUserQuestion with:
- question: "Category 2/5: Bug Fixes -- Are there known bugs or issues to address in this milestone?"
- Options:
  - "Nothing for this category" -- "Skip -- no bug fixes planned"
  - "Enter bug fixes" -- "Describe bugs to fix in this milestone"
fi
```

If "Enter bug fixes": Ask freeform: "Describe the bugs or issues to fix. Include reproduction steps or symptoms if known."
Store response in goals.bugFixes.

**Step 2C-iii: Tech Debt**

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
Use AskUserQuestion with:
- question: "Category 3/5: Tech Debt -- Any refactoring, cleanup, or infrastructure improvements?"
- Options:
  - "Nothing for this category" -- "Skip -- no tech debt work planned"
  - "Enter tech debt items" -- "Describe tech debt to address in this milestone"
fi
```

If "Enter tech debt items": Ask freeform: "Describe the tech debt or infrastructure improvements to tackle."
Store response in goals.techDebt.

**Step 2C-iv: UX Improvements**

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
Use AskUserQuestion with:
- question: "Category 4/5: UX Improvements -- Any user experience, developer experience, or workflow improvements?"
- Options:
  - "Nothing for this category" -- "Skip -- no UX improvements planned"
  - "Enter UX improvements" -- "Describe UX improvements for this milestone"
fi
```

If "Enter UX improvements": Ask freeform: "Describe the UX or developer experience improvements to make."
Store response in goals.uxImprovements.

**Step 2C-v: Deferred Decisions from Previous Milestone**

Read all DEFERRED.md files from both active sets and the previous milestone's archive:

```bash
# Find DEFERRED.md files from active sets
DEFERRED_ACTIVE=$(find .planning/sets/*/DEFERRED.md 2>/dev/null)

# Find previous milestone ID from STATE.json for archive scanning
PREV_MILESTONE=$(node "${RAPID_TOOLS}" state get --all 2>/dev/null | node -e "
  const s = require('fs').readFileSync('/dev/stdin','utf8');
  const j = JSON.parse(s);
  const ms = j.milestones || [];
  const ci = ms.findIndex(m => m.id === j.currentMilestone);
  if (ci > 0) console.log(ms[ci-1].id);
" 2>/dev/null)

# Find DEFERRED.md files from previous milestone archive (if it exists)
DEFERRED_ARCHIVE=""
if [ -n "${PREV_MILESTONE}" ]; then
  DEFERRED_ARCHIVE=$(find .planning/archive/${PREV_MILESTONE}/sets/*/DEFERRED.md 2>/dev/null)
fi

# Combine both sources
DEFERRED_FILES="${DEFERRED_ACTIVE}
${DEFERRED_ARCHIVE}"
DEFERRED_FILES=$(echo "${DEFERRED_FILES}" | grep -v '^$')
```

This discovers deferred items from both active sets in the current milestone and the immediately previous milestone's archive. If this is the first-ever milestone (no previous milestone exists), only active sets are scanned.

**If no DEFERRED.md files exist (or all contain empty tables):**
Display: "Category 5/5: Deferred Decisions -- No deferred decisions found from previous milestone."
Set goals.deferredDecisions to empty.

**If DEFERRED.md files exist with content:**
Parse each DEFERRED.md file. The format is a markdown table with columns: #, Decision/Idea, Source, Suggested Target.

Collect all non-empty deferred items into a list. For each item, format as: "{Decision/Idea} (from set: {source set ID})".

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
Use AskUserQuestion with:
- question: "Category 5/5: Deferred Decisions -- Select which deferred items to include as goals for this milestone"
- multiSelect: true
- Options: one option per deferred item, formatted as "{Decision/Idea} (from set: {source set ID})" with description "{Suggested Target}"
- Plus a final option: "None of these" -- "Skip all deferred items"
fi
```

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

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
Use AskUserQuestion with:
- question: "Is this complete? Review the goals above."
- Options:
  - "Yes, proceed" -- "All requirements captured. Continue to research pipeline."
  - "Add more" -- "Add additional goals (freeform, no category constraints)"
fi
```

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

### Step 2D: Set Count Granularity

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
Use AskUserQuestion with:
- question: "Set count granularity -- How many sets should the roadmapper target for this milestone?"
- Options (4 total):
  - "Compact (3-5 sets)" -- "Fewer, larger sets. Good for small milestones or solo developers."
  - "Standard (6-10 sets)" -- "Balanced decomposition. Good for most projects."
  - "Granular (11-15 sets)" -- "Many small sets. Good for large teams or highly parallel work."
  - "Auto" -- "Let the roadmapper decide based on project complexity and scope."
fi
```

**Value mapping:**
- "Compact (3-5 sets)" maps to `targetSetCount = "3-5"`
- "Standard (6-10 sets)" maps to `targetSetCount = "6-10"`
- "Granular (11-15 sets)" maps to `targetSetCount = "11-15"`
- "Auto" maps to `targetSetCount = "auto"`

Store the result as `targetSetCount` for use in Step 7.

## Step 3: Handle Unfinished Sets

Check the current milestone for sets that are NOT in "complete" or "merged" status.

If ALL sets are complete/merged (or there are no sets):
- Display: "All sets in {currentMilestone} are complete. Ready to move forward."
- Skip to Step 4.

If there are unfinished sets, display them:

| Set ID | Status | Description |
|--------|--------|-------------|
| (from state) | ... | ... |

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
Then use AskUserQuestion with:
- question: "Unfinished sets found"
- Options:
  - "Carry all forward" -- "Move all unfinished sets to the new milestone. They will be included in the new milestone's scope alongside new work."
  - "Select which to carry" -- "Choose which unfinished sets to bring forward. Others will remain in the current milestone as-is."
  - "Start fresh" -- "Leave all sets in the current milestone. The new milestone starts with a clean slate."
fi
```

If "Carry all forward": Collect all unfinished sets as carryForwardSets.

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
If "Select which to carry": For each unfinished set, use AskUserQuestion :
- question: "Carry forward set '{set.id}'?"
- Options:
  - "Yes, carry forward" -- "Include this set in the new milestone"
  - "No, leave behind" -- "Keep this set in the current milestone"
fi
```

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

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
If the command fails (e.g., duplicate milestone ID), display the error and use AskUserQuestion :
- question: "Milestone creation failed"
- Options:
  - "Try different ID" -- "Choose a different milestone ID/version"
  - "Cancel" -- "Exit without creating the milestone"
fi
```

If "Try different ID": Loop back to Step 2 Question A only.

## Step 4.5: Archive Old Milestone (Optional)

After creating the new milestone, offer the user the option to archive the old milestone's planning artifacts.

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
Use AskUserQuestion with:
- question: "Archive old milestone '{previousMilestone}' planning artifacts?"
- Options:
  - "Archive" -- "Move old planning artifacts to .planning/archive/{previousMilestone}/"
  - "Keep" -- "Leave artifacts in place. You can archive later."
fi
```

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

Analyze milestone goals and selectively spawn research agents to explore the new milestone's scope. Use the milestone goals from Step 2 as the research context.

Ensure `.planning/research/` exists:

```bash
mkdir -p .planning/research
```

### Step 5A: Agent Selection

Before spawning any agents, analyze the category-tagged goals from Step 2C-vi and determine which research domains are relevant. The 6 available research agents are:

| # | Agent | Domain | Spawn when... |
|---|-------|--------|---------------|
| 1 | rapid-research-stack | Technology stack, dependencies, compatibility | Goals mention new dependencies, framework changes, runtime upgrades, or tooling changes |
| 2 | rapid-research-features | Feature decomposition, implementation strategies | Goals include new features, capability additions, or significant behavior changes |
| 3 | rapid-research-architecture | Architectural patterns, module organization | Goals involve structural changes, new modules, data flow redesign, or cross-cutting refactors |
| 4 | rapid-research-pitfalls | Failure modes, anti-patterns, security/perf traps | Goals touch areas with known risk (security, performance, concurrency, migrations) |
| 5 | rapid-research-oversights | Edge cases, cross-cutting concerns, blind spots | Goals span multiple subsystems or introduce new integration surfaces |
| 6 | rapid-research-ux | Domain conventions, UX/DX patterns | Goals include user-facing changes, CLI/UI modifications, or workflow changes |

**Selection process:**

1. Read each goal category (features, bugFixes, techDebt, uxImprovements, deferredDecisions, additionalGoals).
2. For each of the 6 agents, reason about whether the milestone goals overlap with that agent's domain.
3. When uncertain whether an agent is relevant, err on the side of spawning it (preserve depth over efficiency).
4. Produce a selection list with brief justification for each included and excluded agent.

**Display the selection to the user:**

```
## Research Agent Selection

Based on milestone goals, spawning {N}/6 research agents:

{For each SELECTED agent:}
- [SELECTED] {agent name}: {one-line justification}

{For each EXCLUDED agent:}
- [SKIPPED] {agent name}: {one-line justification for exclusion}
```

**Minimum agents:** At least 1 agent must be selected. If analysis suggests 0 agents are needed, select all 6 as a fallback (the milestone goals may be too abstract to filter).

**All 6 selected is valid.** If all goals are broad or the milestone is large, selecting all 6 is the correct outcome. Do not artificially reduce count.

Store the selected agent list as `selectedAgents` (an array of agent identifiers: "stack", "features", "architecture", "pitfalls", "oversights", "ux") and the corresponding output file paths as `selectedResearchFiles`.

### Step 5B: Spawn Selected Agents

For each agent in `selectedAgents`, spawn that agent using the corresponding prompt below. Skip agents not in `selectedAgents`.

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

## Deferred Context
{If any DEFERRED.md items were discovered in Step 2C-v (from either active sets or archive), list them here as a bullet list with source attribution: "- {Decision/Idea} (from: {source set ID}, suggested target: {Suggested Target})". If no deferred items exist, state "No deferred items from previous work."}

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

## Deferred Context
{If any DEFERRED.md items were discovered in Step 2C-v (from either active sets or archive), list them here as a bullet list with source attribution: "- {Decision/Idea} (from: {source set ID}, suggested target: {Suggested Target})". If no deferred items exist, state "No deferred items from previous work."}

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

## Deferred Context
{If any DEFERRED.md items were discovered in Step 2C-v (from either active sets or archive), list them here as a bullet list with source attribution: "- {Decision/Idea} (from: {source set ID}, suggested target: {Suggested Target})". If no deferred items exist, state "No deferred items from previous work."}

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

## Deferred Context
{If any DEFERRED.md items were discovered in Step 2C-v (from either active sets or archive), list them here as a bullet list with source attribution: "- {Decision/Idea} (from: {source set ID}, suggested target: {Suggested Target})". If no deferred items exist, state "No deferred items from previous work."}

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

## Deferred Context
{If any DEFERRED.md items were discovered in Step 2C-v (from either active sets or archive), list them here as a bullet list with source attribution: "- {Decision/Idea} (from: {source set ID}, suggested target: {Suggested Target})". If no deferred items exist, state "No deferred items from previous work."}

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

## Deferred Context
{If any DEFERRED.md items were discovered in Step 2C-v (from either active sets or archive), list them here as a bullet list with source attribution: "- {Decision/Idea} (from: {source set ID}, suggested target: {Suggested Target})". If no deferred items exist, state "No deferred items from previous work."}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/{milestoneId}-research-ux.md
```

**Parallel spawning:** Spawn all selected agents in a single response using one Agent tool call per selected agent.

**Sequential fallback:** If parallel spawning fails (Claude Code limitation), fall back to sequential execution. Inform the user: "Running research agents sequentially (parallel spawning unavailable)."

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
Wait for all selected agents to complete. If any agent fails, use AskUserQuestion :
- question: "{agent name} research agent encountered an error: {error details}"
- Options:
  - "Retry" -- "Re-run this research agent"
  - "Skip" -- "Continue without this research output. Synthesis will have less context."
  - "Cancel" -- "Exit the milestone creation flow"
fi
```

**On error:** Show progress breadcrumb: `new-version [research failed ({agent name})] > start-set > discuss-set > plan-set > execute-set > review > merge`

## Step 6: Research Synthesis

Spawn the **rapid-research-synthesizer** agent with this task:

```
Synthesize all research outputs into a unified research summary for milestone '{milestoneId}'.

## Research Files to Read
{List each file path from `selectedResearchFiles` as a bullet point. Only include files that were actually generated by the selected agents in Step 5B.}

**Note:** This milestone used {N} of 6 available research agents. Synthesize from the files listed above. If fewer than 6 files are present, that is expected -- do not treat missing domains as errors. Focus synthesis on the research that was conducted.

## Working Directory
{projectRoot}

## Output
Write synthesized summary to .planning/research/{milestoneId}-synthesis.md
```

Wait for completion. If it fails, offer Retry/Skip/Cancel recovery (same pattern as Step 5):

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: call mcp__rapid__webui_ask_user with Retry/Skip/Cancel options.
else
  # CLI mode:
  # Use AskUserQuestion with Retry/Skip/Cancel options.
fi
```

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

## Target Set Count
{targetSetCount from Step 2D}

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

Wait for the agent to complete. If it fails, offer Retry/Skip/Cancel recovery (same pattern as Step 5):

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: call mcp__rapid__webui_ask_user with Retry/Skip/Cancel options.
else
  # CLI mode:
  # Use AskUserQuestion with Retry/Skip/Cancel options.
fi
```

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

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
Use AskUserQuestion with:
- question: "Accept this roadmap?"
- Options:
  - "Accept" -- "Approve the roadmap and write it to project state. Sets will be created in STATE.json."
  - "Revise" -- "Provide feedback for the roadmapper to adjust the plan"
  - "Cancel" -- "Discard the proposed roadmap. The milestone exists but has no planned work."
fi
```

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

4. Generate DAG.json from the new set definitions:
   ```bash
   node "${RAPID_TOOLS}" dag generate
   ```
   Verify DAG.json was created:
   ```bash
   test -f .planning/sets/DAG.json && echo "DAG.json exists" || echo "WARNING: DAG.json not created"
   ```
   If DAG.json was not created, warn the user: "DAG.json generation failed. You can generate it manually with `dag generate` or during `/rapid:plan-set`."

Confirm: "Roadmap written, DAG generated, and state updated."

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
```

If no sets were planned (roadmap cancelled), display:

```
New Milestone Created.

Milestone: {milestoneId} -- {milestoneName}
Sets planned: 0
Carried forward: {count} from {previousMilestone}
```

Display the completion footer:

**When sets were planned:**

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display footer "/rapid:start-set 1" --breadcrumb "new-version [done] > start-set > discuss-set > plan-set > execute-set > review > merge"
```

**When no sets were planned:**

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display footer "/rapid:status" --breadcrumb "new-version [done] > start-set > discuss-set > plan-set > execute-set > review > merge"
```

---

## Important Constraints

- **Agents must NOT write STATE.json directly.** The SKILL.md orchestrator writes STATE.json using the Write tool with validated roadmapper output.
- **All research agents are independent.** Selected agents do not read each other's output. They share only the milestone brief and brownfield analysis as inputs. The number of agents spawned varies per milestone based on goal analysis.
- **Contracts are generated by the roadmapper in a unified pass.** Individual sets do not generate their own contracts -- the roadmapper produces all contracts together to ensure cross-set consistency.
- **Roadmapper uses propose-then-approve.** The roadmapper returns a proposal; the user must explicitly accept before any files are written.
- **Sets only in state.** STATE.json contains project > milestone > sets hierarchy. Do NOT include waves or jobs in STATE.json -- wave decomposition happens later during /plan-set.
- **Archive is optional.** The user chooses whether to archive. Do NOT force archiving.
- **Goal-gathering is sequential by category.** Each of the 5 categories (features, bugs, tech debt, UX, deferred) is presented as a separate prompt.

  ```
  if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
    # SDK mode: separate mcp__rapid__webui_ask_user call per category.
  else
    # CLI mode:
    # Separate AskUserQuestion per category.
  fi
  ```

  Users can skip any category.
- **Completeness gate is mandatory.** Users must explicitly confirm "Yes, proceed" before the research pipeline starts. The confirmation loop continues until the user approves.
- **Deferred import is graceful.** If no DEFERRED.md files exist, the deferred category is silently skipped with a brief message. Graceful skip is the expected default.
- **Spec file is optional.** The `--spec` argument is never required. Omitting it produces identical behavior to the pre-spec implementation.

## Anti-Patterns -- Do NOT Do These

- Do NOT reference `state transition wave` or `state transition job` -- these state commands do not exist in v3. Only set-level state transitions exist (via `state transition set`).
- Do NOT ask the roadmapper to produce waves or jobs -- v3 defers wave decomposition to /plan-set. The roadmapper outputs sets only.
- Do NOT reference WAVE-CONTEXT.md or wave directories -- v3 uses set-level CONTEXT.md only.
- Do NOT reference `/rapid:set-init` -- the v3 command is `/rapid:start-set`.
- Do NOT include "waves" or "total jobs" counts in the completion summary or roadmap presentation -- only show "N sets planned".
- Do NOT write waves or jobs arrays into STATE.json -- each set has only `{ id, name, status: "pending", branch }`.
- Do NOT skip agents without explicit reasoning -- every excluded agent must have a logged justification in Step 5A.
- Do NOT use keyword matching or category-to-agent mapping for agent selection -- use semantic analysis of goal content.
- Do NOT artificially reduce agent count -- when uncertain, err on the side of spawning the agent to preserve research depth.
- Do NOT force archiving -- user explicitly chooses via the prompt.

  ```
  if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
    # SDK mode: mcp__rapid__webui_ask_user presents the archive choice.
  else
    # CLI mode:
    # AskUserQuestion presents the archive choice.
  fi
  ```
- Do NOT ask a single freeform question for all goals -- use the structured 5-category prompt sequence.
- Do NOT skip the completeness confirmation -- it is the final gate before research begins.
- Do NOT fail when DEFERRED.md files are missing -- graceful skip is the expected default.
- Do NOT allow category re-entry from the completeness gate -- "Add more" is freeform only.
