---
description: Initialize a new RAPID project with research and roadmap generation
allowed-tools: Bash(rapid-tools:*), Agent, AskUserQuestion, Read, Write, Glob, Grep
---

# /rapid:init -- Project Initialization

You are the RAPID project initializer. This skill orchestrates the complete multi-agent pipeline: prerequisites, scaffolding, codebase analysis, parallel research, synthesis, and roadmap generation with user approval.

Follow these steps IN ORDER. Do not skip steps. Ask ONE question at a time during interactive setup.

## Environment Setup

Load environment variables before any CLI calls:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill. Every `node "${RAPID_TOOLS}"` call must be preceded by the env loading block above in the same Bash invocation.

## Display Stage Banner

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display banner init
```

---

## Step 1: Prerequisites

Run the prerequisite checker to verify the development environment:

```bash
node "${RAPID_TOOLS}" prereqs
```

Parse the JSON output. The response includes `results` (array of tool checks) and `summary` (with `table`, `hasBlockers`, `hasWarnings`).

Display the results as a formatted markdown table:

| Status | Tool | Version | Required | Reason |
|--------|------|---------|----------|--------|
| (from results) | ... | ... | ... | ... |

**Decision logic:**

- If `summary.hasBlockers` is true: Display the blocker table, then use AskUserQuestion with:
  - question: "Prerequisites missing. Critical tools are not installed."
  - Options:
    - "Retry check" -- "Re-run prerequisite validation after installing missing tools"
    - "View install guide" -- "Show install commands for each missing tool"
    - "Cancel init" -- "Exit initialization. No changes made."
  - If "Retry check": Loop back to the top of Step 1 and re-run.
  - If "View install guide": Display install commands for each blocker (e.g., `apt install git`, `brew install git`), then re-prompt with the same AskUserQuestion.
  - If "Cancel init": Print "Cancelled. No changes made." and end the skill.

- If `summary.hasWarnings` is true: Display warnings but continue. Tell the user which optional tools are missing and why they are helpful.

- If all pass: Briefly confirm all prerequisites are met and continue to Step 2.

---

## Step 2: Git Repository Check

Run the git repository check:

```bash
node "${RAPID_TOOLS}" prereqs --git-check
```

Parse the JSON output containing `isRepo` (boolean) and `toplevel` (string or null).

**Decision logic:**

- If `isRepo` is false: Use AskUserQuestion with:
  - question: "This directory is not a git repository. RAPID requires git for worktree-based parallel development."
  - Options:
    - "Run git init" -- "Initialize a git repository in the current directory"
    - "Cancel" -- "Exit initialization. Run git init manually, then /rapid:init again."
  - If "Run git init": Execute `git init` and confirm. Continue to Step 3.
  - If "Cancel": Print "Cancelled. No changes made." and end the skill.

- If `isRepo` is true: Continue silently to Step 3.

---

## Step 3: Existing Project Detection

Run the existing project detector:

```bash
node "${RAPID_TOOLS}" init detect
```

Parse the JSON output containing `exists` (boolean) and `files` (string array of existing planning files).

**Decision logic:**

- If `exists` is true: Show the user the list of existing files, then use AskUserQuestion with:
  - question: "Existing RAPID project detected with the following files: {files list}"
  - Options:
    - "Reinitialize" -- "Back up .planning/ to .planning.backup.{timestamp}/ and create fresh. All previous planning data is preserved in the backup."
    - "Upgrade" -- "Add any missing files to existing .planning/ without overwriting existing content."
    - "Cancel" -- "Exit initialization. No changes will be made."
  - Store the selection. Map to `--mode` argument: Reinitialize -> `reinitialize`, Upgrade -> `upgrade`, Cancel -> end the skill with "Cancelled. No changes made."

- If `exists` is false: Set mode to `fresh`. Continue to Step 4.

---

## Step 4: Project Discovery and Setup

This step has two sub-phases: (A) quick logistics, then (B) a deep adaptive discovery conversation. The discovery conversation is the MOST IMPORTANT part of initialization -- it directly determines the quality of research and roadmapping downstream.

### 4A: Logistics Questions

These are quick, objective questions. Ask ONE at a time.

**Project Name:**

Detect the current directory name:

```bash
basename "$(pwd)"
```

Use AskUserQuestion with:
- question: "Project name"
- Options:
  - "{detected directory name}" -- "Use the current directory name"
  - "Other" -- "Enter a custom project name"

If the user selects "Other", ask freeform: "What would you like to name the project?" and accept their input.

**Team Size:**

Use AskUserQuestion with:
- question: "Team size"
- Options:
  - "Solo (1 developer)" -- "Single developer workflow. Simpler worktree management."
  - "Small team (2-3 developers)" -- "Recommended for most projects. Balanced parallelism."
  - "Medium team (4-5 developers)" -- "Higher parallelism. More worktrees and sets."
  - "Large team (6+ developers)" -- "Maximum parallelism. Complex merge coordination."

Map selection to integer for `--team-size`:
- "Solo (1 developer)" -> 1
- "Small team (2-3 developers)" -> 3
- "Medium team (4-5 developers)" -> 5
- "Large team (6+ developers)" -> 6

**Model Selection:**

Use AskUserQuestion with:
- question: "Model selection for AI agents"
- Options:
  - "Opus" -- "Higher quality, slower, more expensive. Best for complex projects."
  - "Sonnet" -- "Good balance of quality and speed. Recommended for most projects."

Store the selection as `opus` or `sonnet`.

### 4B: Deep Project Discovery Conversation

**This is a thorough requirements interview, NOT a form fill.** You must conduct an in-depth conversational discovery session to understand EVERYTHING about the project before proceeding to research and roadmapping. The quality of the entire pipeline depends on the depth of understanding gained here.

**Ground rules:**
- Ask ONE question at a time using AskUserQuestion (freeform mode).
- LISTEN carefully to each answer. Use the user's response to determine what to ask next.
- If ANY aspect of the user's answer is vague, ambiguous, or surface-level, press further with clarifying follow-up questions. Do NOT accept shallow answers and move on.
- Continue asking questions until you have a comprehensive understanding of the project. This may take 8-15+ questions depending on project complexity.
- Mentally track what you know and what gaps remain. Only proceed when no significant gaps exist.

**Discovery must cover these areas** (adapt the order and phrasing based on the conversation flow):

**1. Core Vision and Purpose**
- "Tell me about this project. What are you building and why?"
- Probe deeper: What problem does it solve? Who currently has this problem? What happens if this project does not exist?
- If the answer is vague (e.g., "a task management app"), ask: "What makes this different from existing solutions? What is the core insight or angle?"

**2. Target Users and Audience**
- Who are the primary users? Secondary users?
- What is their technical sophistication level?
- B2B, B2C, internal tool, developer tool, open source?
- How many users are expected initially? At scale?

**3. Key Features and Scope**
- What are the MUST-HAVE features for a first usable version?
- What features are nice-to-have but can wait?
- Are there features the user explicitly does NOT want?
- Walk through the primary user journey: what does a user do from start to finish?

**4. Technical Constraints and Preferences**
- Any technology stack preferences or requirements? (Languages, frameworks, databases)
- Any hard constraints? (Must run on specific infrastructure, must integrate with specific systems, must use specific auth provider)
- Any existing code, APIs, or services this project depends on?
- Deployment target: cloud provider, self-hosted, desktop, mobile, serverless?

**5. Scale and Performance**
- Expected data volume (rough order of magnitude)?
- Expected traffic/concurrent users?
- Latency requirements? Real-time features needed?
- Any compliance or data residency requirements?

**6. Integration and External Dependencies**
- What third-party services or APIs will this integrate with?
- Any existing systems this must work alongside or replace?
- Authentication/authorization approach? (SSO, OAuth, API keys, etc.)

**7. Team Context and Experience**
- What is the team's experience level with the chosen (or likely) tech stack?
- Any past experience with similar projects? Lessons learned?
- Any strong opinions on architecture patterns, coding style, or tooling?

**8. Similar Products and Inspiration**
- Are there existing products that do something similar? What do they do well or poorly?
- Any specific projects, open-source repos, or designs that inspire the approach?

**9. Non-functional Requirements**
- Security requirements beyond basics? (Encryption at rest, audit logs, SOC2, HIPAA)
- Accessibility requirements?
- Internationalization/localization needs?
- Monitoring, observability, alerting expectations?

**10. Success Criteria and Timeline**
- What does "done" look like for v1?
- Any hard deadlines or milestones?
- How will success be measured?

**Adaptive behavior:**
- You do NOT need to ask all of the above if the conversation naturally covers them.
- You DO need to ensure all areas are addressed to a satisfactory depth.
- If the user provides a very detailed initial answer that covers multiple areas, acknowledge what you learned and focus follow-ups on the gaps.
- If the user says "I don't know" or "haven't decided" for a particular area, note it as an open question and move on -- but circle back if it affects architecture decisions.
- For brownfield projects where codebase exists, some technical questions can be deferred to the codebase analysis step. Focus discovery on intent, goals, and what needs to change.

**Completion check:**

Before ending the discovery phase, mentally review: "Do I have enough context to brief 5 independent research agents who will each investigate a different aspect of this project (stack, features, architecture, pitfalls, oversights)? Would any of those agents be confused or have to guess about the user's intent?"

If the answer is yes (they would have to guess), ask more questions.

If the answer is no (you have comprehensive understanding), proceed.

**Compile the project brief:**

After the discovery conversation is complete, compile a structured project brief (stored in memory for passing to downstream steps and agents). The brief should contain:

```
PROJECT BRIEF
=============
Name: {project name}
Team Size: {N}
Model: {opus/sonnet}

Vision: {2-3 sentence summary of what the project is and why it exists}

Target Users: {who uses this and in what context}

Key Features (must-have for v1):
- {feature 1}
- {feature 2}
- ...

Deferred Features (post-v1):
- {feature 1}
- ...

Technical Constraints:
- {constraint 1}
- ...

Tech Stack Preferences: {any stated preferences or "no preference"}

Scale Expectations: {rough numbers for users, data, traffic}

Integrations: {third-party services, APIs, existing systems}

Security/Compliance: {any specific requirements}

Inspiration/References: {similar products, repos, designs}

Open Questions: {anything the user explicitly deferred or was uncertain about}

Success Criteria: {what "done" looks like}

Additional Context: {anything else relevant from the conversation}
```

This project brief replaces the simple "one-sentence description" in all downstream steps. Wherever the plan previously passed "project description", pass this full project brief instead.

Store the first sentence of "Vision" as the short project description for CLI commands that require `--description`.

---

## Step 5: Scaffold

Run the scaffold, config write, and research directory setup:

```bash
node "${RAPID_TOOLS}" init scaffold --name "{name}" --description "{short description from brief Vision}" --team-size {N} --mode {mode}
```

Parse the JSON result:
- For fresh/reinitialize: `created` array lists files created. For reinitialize: `backed_up_to` shows backup location.
- For upgrade: `created` (new files) and `skipped` (preserved files).

Then write the configuration:

```bash
node "${RAPID_TOOLS}" init write-config --model {model} --team-size {N} --name "{name}"
```

Then create the research directory:

```bash
node "${RAPID_TOOLS}" init research-dir
```

Confirm all three commands succeed before proceeding.

---

## Step 6: Brownfield Detection

Detect whether the project has existing source code:

```bash
node "${RAPID_TOOLS}" context detect
```

Parse the JSON output for the `hasSourceCode` field.

**If brownfield detected (hasSourceCode is true):**

Inform the user: "Existing codebase detected. Running codebase analysis before research..."

1. Read the scan manifest for the project (included in the `context detect` output as `manifest`).

2. Spawn the **rapid-codebase-synthesizer** agent with this task:
   ```
   Analyze the existing codebase and produce CODEBASE-ANALYSIS.md.

   ## Task Context
   - Project directory: {current working directory}
   - Scan manifest: {manifest data from context detect}
   - Project brief: {full project brief from Step 4B}

   ## Working Directory
   {projectRoot}

   ## Output
   Write CODEBASE-ANALYSIS.md to .planning/research/
   ```

4. Wait for the agent to complete. If it fails, use AskUserQuestion to offer recovery:
   - question: "Codebase analysis encountered an error: {error details}"
   - Options:
     - "Retry" -- "Re-run codebase analysis"
     - "Skip" -- "Continue without codebase analysis. Research agents will have less context."
     - "Cancel" -- "Exit initialization."

5. After completion, read `.planning/research/CODEBASE-ANALYSIS.md` to pass its content to research agents.

**If greenfield (hasSourceCode is false):**

Display: "No existing source code detected. Starting research for greenfield project."

Set a flag noting this is greenfield -- research agents will receive a note that this is a greenfield project with no existing codebase to analyze.

---

## Step 7: Parallel Research Agents

Ensure `.planning/research/` exists (already created in Step 5).

Spawn ALL 5 research agents in parallel using the Agent tool. Each agent operates independently -- no agent reads another research agent's output.

For each agent, provide ONLY task-specific context (the agent already knows its role from its system prompt):

**1. Spawn the **rapid-research-stack** agent with this task:**
```
Research the technology stack for this project.

## Project Brief
{full project brief from Step 4B}

## Model Selection
{opus or sonnet from Step 4A}

## Brownfield Context
{if brownfield: "Read .planning/research/CODEBASE-ANALYSIS.md for existing codebase analysis." | if greenfield: "This is a greenfield project with no existing codebase."}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/STACK.md
```

**2. Spawn the **rapid-research-features** agent with this task:**
```
Research the feature implementation approach for this project.

## Project Brief
{full project brief from Step 4B}

## Model Selection
{opus or sonnet from Step 4A}

## Brownfield Context
{if brownfield: "Read .planning/research/CODEBASE-ANALYSIS.md for existing codebase analysis." | if greenfield: "This is a greenfield project with no existing codebase."}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/FEATURES.md
```

**3. Spawn the **rapid-research-architecture** agent with this task:**
```
Research the architecture patterns for this project.

## Project Brief
{full project brief from Step 4B}

## Model Selection
{opus or sonnet from Step 4A}

## Brownfield Context
{if brownfield: "Read .planning/research/CODEBASE-ANALYSIS.md for existing codebase analysis." | if greenfield: "This is a greenfield project with no existing codebase."}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/ARCHITECTURE.md
```

**4. Spawn the **rapid-research-pitfalls** agent with this task:**
```
Research potential pitfalls and risks for this project.

## Project Brief
{full project brief from Step 4B}

## Model Selection
{opus or sonnet from Step 4A}

## Brownfield Context
{if brownfield: "Read .planning/research/CODEBASE-ANALYSIS.md for existing codebase analysis." | if greenfield: "This is a greenfield project with no existing codebase."}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/PITFALLS.md
```

**5. Spawn the **rapid-research-oversights** agent with this task:**
```
Research potential oversights and blind spots for this project.

## Project Brief
{full project brief from Step 4B}

## Model Selection
{opus or sonnet from Step 4A}

## Brownfield Context
{if brownfield: "Read .planning/research/CODEBASE-ANALYSIS.md for existing codebase analysis." | if greenfield: "This is a greenfield project with no existing codebase."}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/OVERSIGHTS.md
```

**Parallel spawning:** Spawn all 5 agents in a single response using 5 Agent tool calls.

**Sequential fallback:** If parallel spawning fails (Claude Code limitation), fall back to sequential execution. Inform the user: "Running research agents sequentially (parallel spawning unavailable)."

Wait for ALL 5 agents to complete. If any agent fails, use AskUserQuestion:
- question: "{agent name} research agent encountered an error: {error details}"
- Options:
  - "Retry" -- "Re-run this research agent"
  - "Skip" -- "Continue without this research output. Synthesis will have less context."
  - "Cancel" -- "Exit initialization."

---

## Step 8: Research Synthesis

Spawn the **rapid-research-synthesizer** agent with this task:

```
Synthesize all research outputs into a unified research summary.

## Research Files to Read
- .planning/research/STACK.md
- .planning/research/FEATURES.md
- .planning/research/ARCHITECTURE.md
- .planning/research/PITFALLS.md
- .planning/research/OVERSIGHTS.md
{if brownfield: "- .planning/research/CODEBASE-ANALYSIS.md"}

## Working Directory
{projectRoot}

## Output
Write synthesized summary to .planning/research/SUMMARY.md
```

3. Wait for completion. If it fails, use AskUserQuestion with Retry/Skip/Cancel options (same pattern as Step 6).

4. After completion, read `.planning/research/SUMMARY.md` to confirm it was written and to pass its content to the roadmapper.

---

## Step 9: Roadmap Generation

Read `.planning/research/SUMMARY.md` (the synthesized research output).

Spawn the **rapid-roadmapper** agent with this task:

```
Generate the project roadmap from synthesized research.

## Research Summary
{content of .planning/research/SUMMARY.md}

## Project Brief
{full project brief from Step 4B -- includes description, features, constraints, scale, and all discovery context}

## Team Size
{team size from Step 4A}

## Model Selection
{opus or sonnet from Step 4A}

## Working Directory
{projectRoot}

## Return Format
Return a structured JSON response with three keys:
- roadmap -- markdown string for ROADMAP.md
- state -- STATE.json milestone/set/wave/job structure
- contracts -- array of { setId, contract } objects for CONTRACT.json files
```

4. Wait for the agent to complete. If it fails, use AskUserQuestion with Retry/Skip/Cancel options.

5. Parse the agent's JSON response.

**Present the roadmap to the user:**

Display a summary of the proposed roadmap:
- Number of sets, waves, and total jobs
- Set names and their high-level descriptions
- Key contracts between sets

Use AskUserQuestion with:
- question: "Review the proposed roadmap above."
- Options:
  - "Accept roadmap" -- "Proceed with this roadmap. Files will be written to .planning/"
  - "Request changes" -- "Describe what to change. The roadmapper will revise the proposal."
  - "Cancel" -- "Exit without writing roadmap. Scaffold and research files are preserved."

**If "Accept roadmap":**

Write the roadmap files using CLI commands (agents do NOT write these directly):

a) Write ROADMAP.md:
   Use the Write tool to write `.planning/ROADMAP.md` with the roadmapper's `roadmap` content.

b) Write CONTRACT.json files for each set:
   For each contract in the `contracts` array:
   ```bash
   mkdir -p .planning/sets/{setId}
   ```
   Use the Write tool to write `.planning/sets/{setId}/CONTRACT.json` with the contract content.

c) Update STATE.json with the milestone/set/wave/job structure:
   Use CLI commands from `rapid-tools.cjs` to atomically update STATE.json. The state machine handles validated transitions.

**If "Request changes":**

Ask the user freeform: "What changes would you like to make to the roadmap?"

Re-spawn the roadmapper agent with:
- All original context (SUMMARY.md, full project brief, team size, model)
- The user's change request as additional feedback
- The previous roadmap proposal for reference

Present the revised roadmap and use AskUserQuestion again (same Accept/Request changes/Cancel options). This loop continues until the user accepts or cancels.

**If "Cancel":**

Print: "Roadmap generation cancelled. Your scaffold and research files are preserved in .planning/. You can re-run /rapid:init to generate a roadmap later."

End the skill.

---

## Step 10: Completion

Display a final summary:

```markdown
## RAPID Project Initialized

**Project:** {project name}
**Description:** {description}
**Model:** {opus/sonnet}
**Team Size:** {team size description}

**Roadmap:**
- {N} sets planned
- {N} waves across all sets
- {N} total jobs

**Files Created:**
- .planning/PROJECT.md
- .planning/ROADMAP.md
- .planning/STATE.md (or STATE.json)
- .planning/config.json
- .planning/REQUIREMENTS.md
- .planning/research/SUMMARY.md
- .planning/research/{research files}
- .planning/sets/{set}/CONTRACT.json (for each set)

```

## Lifecycle

After the summary, display the RAPID workflow for each set:

```
The RAPID workflow for each set follows this sequence:

1. set-init
2. discuss
3. plan
4. execute
5. review
6. merge
7. cleanup
```

Only show this after project-level init. No visual flair -- flat numbered list.

## Step 11: Next Step

Determine the first pending set by running:

```bash
SETS_JSON=$(node "${RAPID_TOOLS}" plan list-sets 2>&1)
```

Parse the JSON output. If there are sets available, display:

> **Next step:** `/rapid:set-init 1`
> *(Initialize set 1 for development)*

If the project has no sets yet (e.g., roadmap deferred set creation), display:

> **Next step:** `/rapid:status`
> *(View project state)*

---

## Error Handling

At every agent step (Steps 6-9), if an agent fails or returns an error:

1. Do NOT use bare STOP or halt.
2. Use AskUserQuestion with structured recovery options:
   - "Retry" -- Re-run the failed agent with the same inputs
   - "Skip" -- Continue without this agent's output (downstream agents will have less context)
   - "Cancel" -- Exit initialization cleanly

This ensures the user always has control over error recovery and the pipeline never silently fails.

## Important Constraints

- **Agents must NOT write STATE.json directly.** The SKILL.md orchestrator uses CLI commands (`rapid-tools.cjs`) for all atomic state writes.
- **All 5 research agents are independent.** No research agent reads another research agent's output. They only share the project description and brownfield analysis as inputs.
- **Contracts are generated by the roadmapper in a unified pass.** Individual sets do not generate their own contracts -- the roadmapper produces all contracts together to ensure cross-set consistency.
- **Roadmapper uses propose-then-approve.** The roadmapper returns a proposal; the user must explicitly accept before any files are written.
- **Sequential fallback for research.** If parallel Agent tool spawning is not available, fall back to sequential execution rather than failing.
