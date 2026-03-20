---
description: Initialize a new RAPID project with research and roadmap generation
allowed-tools: Bash(rapid-tools:*), Agent, AskUserQuestion, Read, Write, Glob, Grep
---

# /rapid:init -- Project Initialization

You are the RAPID project initializer. This skill orchestrates the complete multi-agent pipeline: prerequisites, scaffolding, codebase analysis, parallel research, synthesis, and roadmap generation with user approval.

Follow these steps IN ORDER. Do not skip steps.

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

**On error:** Show progress breadcrumb: `init [prereqs failed] > start-set > discuss-set > plan-set > execute-set > review > merge`

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

**On error:** Show progress breadcrumb: `init [git check failed] > start-set > discuss-set > plan-set > execute-set > review > merge`

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
- Ask questions in TOPIC BATCHES using AskUserQuestion (freeform mode). Each batch covers 2-3 related discovery areas in a SINGLE prompt.
- LISTEN carefully to each batch response. After each batch, analyze the response for follow-up needs. Only ask follow-up questions for genuinely ambiguous or vague responses. Do NOT re-ask areas already covered.
- Continue asking until you have a comprehensive understanding. This should take 3-4 batch questions plus 0-2 targeted follow-ups depending on project complexity.
- Mentally track what you know and what gaps remain. Only proceed when no significant gaps exist.

**Discovery must cover these 10 areas, grouped into 4 topic batches:**

**Batch 1: Vision and Users**

This batch uses a hybrid approach: one freeform question for the open-ended vision, then two structured questions for target users and scale.

**Area 1 (Vision/problem statement) -- freeform:**

Use AskUserQuestion (freeform) with:

> "What are you building and why? What problem does it solve? What makes this different from existing solutions? Feel free to be as detailed as you like -- the more context here, the better the research and planning downstream."

**Area 2 (Target users) -- structured:**

Use AskUserQuestion with:
- question: "Who are the primary target users?"
- Options:
  - "B2C consumers" -- "End users interacting through web or mobile apps"
  - "B2B enterprise" -- "Business customers with team/org structures"
  - "Internal team tools" -- "Internal company tools for employees"
  - "Developer/open-source" -- "Developers, CLI users, or open-source community"

**Area 3 (Scale targets) -- structured:**

Use AskUserQuestion with:
- question: "What scale are you targeting initially?"
- Options:
  - "Prototype (<100 users)" -- "Proof of concept or personal project"
  - "Startup (100-10K users)" -- "Early product with growing user base"
  - "Growth (10K-100K users)" -- "Scaling product with significant traffic"
  - "Scale (100K+ users)" -- "High-scale production system"

After receiving the responses, analyze them. If the user's vision or target audience is vague (e.g., "a task management app" with no differentiation), ask ONE targeted follow-up before proceeding to the next batch. Otherwise, continue.

**Batch 2: Features and Technical**

This batch uses a hybrid approach: one freeform question for features (inherently open-ended), then two structured questions for tech stack and starting point.

**Area 4 (Must-have features) -- freeform:**

Use AskUserQuestion (freeform) with:

> "What are the must-have features for v1? Walk me through the primary user journey from start to finish. Also mention any nice-to-have features that can wait, and anything you explicitly do NOT want."

**Area 5 (Tech stack) -- structured:**

Use AskUserQuestion with:
- question: "What is your primary tech stack preference?"
- Options:
  - "React/Next.js + Node" -- "JavaScript/TypeScript full stack with React frontend"
  - "Python + FastAPI/Django" -- "Python backend with your choice of framework"
  - "Go/Rust backend" -- "Systems-oriented backend language"
  - "No preference" -- "Let research determine the best stack for this project"

**Area 6 (Existing dependencies) -- structured:**

Use AskUserQuestion with:
- question: "What is the starting point for this project?"
- Options:
  - "Greenfield" -- "Starting from scratch, no existing code"
  - "Brownfield" -- "Building on or modifying an existing codebase"
  - "Integration" -- "New code that integrates with existing external APIs/services"
  - "Migration" -- "Porting or rewriting an existing system"

After receiving the responses, analyze for gaps. If any must-have feature is unclear or the tech approach is contradictory, ask ONE targeted follow-up.

**Batch 3: Scale and Integrations**

This batch uses all structured questions since each area has a well-defined option space.

**Area 7 (Performance requirements) -- structured:**

Use AskUserQuestion with:
- question: "What are your real-time and performance requirements?"
- Options:
  - "Standard web app" -- "Page loads, form submissions, typical CRUD operations"
  - "Real-time features needed" -- "WebSockets, live updates, collaborative editing"
  - "High throughput" -- "Batch processing, data pipelines, high API call volume"
  - "Low latency critical" -- "Sub-100ms response times, gaming, trading"

**Area 8 (Compliance) -- structured:**

Use AskUserQuestion with:
- question: "Any compliance or regulatory requirements?"
- Options:
  - "None required" -- "No specific regulatory requirements"
  - "GDPR" -- "EU data protection regulation"
  - "HIPAA" -- "Healthcare data protection (US)"
  - "SOC2" -- "Security and availability auditing"

**Area 9 (Third-party integrations) -- structured:**

Use AskUserQuestion with:
- question: "What types of third-party integrations are needed?"
- Options:
  - "Payment processing" -- "Stripe, PayPal, or similar payment APIs"
  - "Auth providers" -- "OAuth, SSO/SAML, or identity providers"
  - "Cloud services" -- "AWS, GCP, Azure services, storage, CDN"
  - "None / minimal" -- "Mostly self-contained, few external dependencies"

**Area 10 (Auth approach) -- structured:**

Use AskUserQuestion with:
- question: "What authentication approach do you prefer?"
- Options:
  - "OAuth / social login" -- "Google, GitHub, social sign-in"
  - "Email / password" -- "Traditional email and password with sessions"
  - "SSO / SAML" -- "Enterprise single sign-on"
  - "API keys" -- "Token-based authentication for API/developer use"

If the user has already addressed some of these areas in previous batches, note that and skip the already-covered items. Do NOT re-ask what's already been answered.

**Batch 4: Context and Success**

This batch uses a hybrid approach: one freeform question for experience and inspiration (contextual narratives), then two structured questions for non-functional requirements and success criteria.

**Area 11 (Team experience and inspiration) -- freeform:**

Use AskUserQuestion (freeform) with:

> "What is your team's experience with the likely tech stack? Any lessons learned from similar projects? Are there existing products that do something similar -- what do they do well or poorly?"

**Area 12 (Non-functional requirements) -- structured:**

Use AskUserQuestion with:
- question: "What non-functional requirements are important?"
- Options:
  - "Security beyond basics" -- "Encryption at rest, audit logging, penetration testing"
  - "Accessibility (a11y)" -- "WCAG compliance, screen reader support"
  - "Internationalization (i18n)" -- "Multi-language, multi-locale support"
  - "Monitoring/observability" -- "APM, distributed tracing, alerting"

**Area 13 (Success criteria) -- structured:**

Use AskUserQuestion with:
- question: "What does 'done' look like for v1?"
- Options:
  - "Working MVP" -- "Core features functional, rough edges acceptable"
  - "Production-ready with tests" -- "Fully tested, deployment pipeline, monitoring"
  - "Specific deadline target" -- "Must ship by a particular date"
  - "Feature-complete per spec" -- "All specified features implemented and polished"

**Adaptive behavior:**
- If a batch response thoroughly covers areas from upcoming batches, acknowledge what you learned and SKIP those items in the next batch.
- If the user says "I don't know" or "haven't decided" for a particular area, note it as an open question and move on -- but circle back if it affects architecture decisions.
- For brownfield projects where codebase exists, some technical questions can be deferred to the codebase analysis step. Focus discovery on intent, goals, and what needs to change.
- You do NOT need to ask all 4 batches if earlier responses comprehensively cover everything. Proceed when no significant gaps exist.

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

**On error:** Show progress breadcrumb: `init [scaffold done, config failed] > start-set > discuss-set > plan-set > execute-set > review > merge` (adjust based on which step failed).

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

**On error:** Show progress breadcrumb: `init [scaffold done, brownfield detection failed] > start-set > discuss-set > plan-set > execute-set > review > merge`

---

## Step 7: Parallel Research Agents

Ensure `.planning/research/` exists (already created in Step 5).

Spawn ALL 6 research agents in parallel using the Agent tool. Each agent operates independently -- no agent reads another research agent's output.

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

**6. Spawn the **rapid-research-ux** agent with this task:**
```
Research domain conventions and UX patterns for this project.

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
Write output to .planning/research/UX.md
```

**Parallel spawning:** Spawn all 6 agents in a single response using 6 Agent tool calls.

**Sequential fallback:** If parallel spawning fails (Claude Code limitation), fall back to sequential execution. Inform the user: "Running research agents sequentially (parallel spawning unavailable)."

Wait for ALL 6 agents to complete. If any agent fails, use AskUserQuestion:
- question: "{agent name} research agent encountered an error: {error details}"
- Options:
  - "Retry" -- "Re-run this research agent"
  - "Skip" -- "Continue without this research output. Synthesis will have less context."
  - "Cancel" -- "Exit initialization."

**On error:** Show progress breadcrumb: `init [scaffold done, research failed ({agent name})] > start-set > discuss-set > plan-set > execute-set > review > merge`

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
- .planning/research/UX.md
{if brownfield: "- .planning/research/CODEBASE-ANALYSIS.md"}

## Working Directory
{projectRoot}

## Output
Write synthesized summary to .planning/research/SUMMARY.md
```

3. Wait for completion. If it fails, use AskUserQuestion with Retry/Skip/Cancel options (same pattern as Step 6).

4. After completion, read `.planning/research/SUMMARY.md` to confirm it was written and to pass its content to the roadmapper.

**On error:** Show progress breadcrumb: `init [scaffold done, research done, synthesis failed] > start-set > discuss-set > plan-set > execute-set > review > merge`

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

## CRITICAL: Sets-Only Output
Output sets ONLY -- do NOT include wave or job structure. Waves are determined later during /plan-set. The return JSON structure should be: { roadmap, state, contracts } where state contains project > milestone > sets (no waves key, no jobs key).

Each set should define:
- Set name and scope
- Set dependencies (which other sets it depends on)
- Set branch name

Do NOT decompose sets into waves or jobs. That decomposition happens later when the user runs /plan-set for each set.

## Return Format
Return a structured JSON response with three keys:
- roadmap -- markdown string for ROADMAP.md (set names, scopes, dependencies -- NO wave/job tables)
- state -- JSON structure: { milestones: [{ id, name, status: "active", sets: [{ id, name, status: "pending", branch }] }], currentMilestone }
- contracts -- array of { setId, contract } objects for CONTRACT.json files
```

4. Wait for the agent to complete. If it fails, use AskUserQuestion with Retry/Skip/Cancel options.

5. Parse the agent's JSON response.

**Present the roadmap to the user:**

Display a summary of the proposed roadmap:
- Number of sets planned
- Set names and their high-level descriptions
- Key contracts and dependencies between sets

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

b) Write CONTRACT.json and DEFINITION.md files for each set:
   For each entry in the `contracts` array:
   ```bash
   mkdir -p .planning/sets/{setId}
   ```
   Use the Write tool to write `.planning/sets/{setId}/CONTRACT.json` with the contract content.

   Then, use the Write tool to write `.planning/sets/{setId}/DEFINITION.md` with the following content, populated from the entry's `definition` object:

   ```markdown
   # Set: {setId}

   ## Scope
   {definition.scope}

   ## File Ownership
   Files this set owns (exclusive write access):
   - {definition.ownedFiles[0]}
   - {definition.ownedFiles[1]}
   ...

   ## Tasks
   1. {definition.tasks[0].description}
      - Acceptance: {definition.tasks[0].acceptance}
   2. {definition.tasks[1].description}
      - Acceptance: {definition.tasks[1].acceptance}
   ...

   ## Interface Contract
   See: CONTRACT.json (adjacent file)

   ## Wave Assignment
   Wave: (assigned during plan-set)

   ## Acceptance Criteria
   - {definition.acceptance[0]}
   - {definition.acceptance[1]}
   ...
   ```

   If the `definition` field is missing from a contracts entry (e.g., from an older roadmapper version), skip DEFINITION.md generation for that set and log a warning: "Warning: No definition metadata for set {setId}. DEFINITION.md was not generated."

c) Write STATE.json with the project > milestone > sets structure:
   Use the Write tool to write `.planning/STATE.json` with the roadmapper's `state` content.
   The state structure is: `{ milestones: [{ id, name, status, sets: [{ id, status: "pending" }] }], currentMilestone }`
   Each set has only `{ id, name, status: "pending", branch }` -- no waves or jobs arrays.

d) Generate DAG.json and OWNERSHIP.json from the newly written STATE.json and CONTRACT.json files:
   ```bash
   node -e "const { recalculateDAG } = require('${RAPID_TOOLS}/../lib/add-set.cjs'); recalculateDAG(process.cwd(), '{milestoneId}').then(() => console.log('DAG.json created.')).catch(e => console.error('Warning: DAG generation failed:', e.message))"
   ```
   Where `{milestoneId}` is the milestone ID from the roadmapper's `state.currentMilestone` field.

   If this command fails (prints a warning), do NOT fail init. The DAG will be generated automatically by the first `state add-set` call or can be triggered manually later.

**If "Request changes":**

Ask the user freeform: "What changes would you like to make to the roadmap?"

Re-spawn the roadmapper agent with:
- All original context (SUMMARY.md, full project brief, team size, model)
- The user's change request as additional feedback
- The previous roadmap proposal for reference
- The same CRITICAL sets-only instruction (no waves or jobs)

Present the revised roadmap and use AskUserQuestion again (same Accept/Request changes/Cancel options). This loop continues until the user accepts or cancels.

**If "Cancel":**

Print: "Roadmap generation cancelled. Your scaffold and research files are preserved in .planning/. You can re-run /rapid:init to generate a roadmap later."

End the skill.

**On error:** Show progress breadcrumb: `init [scaffold done, research done, synthesis done, roadmap failed] > start-set > discuss-set > plan-set > execute-set > review > merge`

---

## Step 10: Auto-Commit Planning Artifacts

Before displaying the completion summary, auto-commit all generated planning artifacts.

First, check if there are uncommitted changes outside `.planning/`:

```bash
OUTSIDE_CHANGES=$(git status --porcelain | grep -v '^\?\? ' | grep -v '.planning/' | head -5)
if [ -n "$OUTSIDE_CHANGES" ]; then
  echo "WARNING: Uncommitted changes exist outside .planning/. These will NOT be included in the auto-commit."
fi
```

If there are changes outside `.planning/`, warn the user but proceed with the scoped commit.

Then stage and commit only `.planning/` files:

```bash
git add .planning/
# Check if there are staged changes
if git diff --cached --quiet; then
  echo "No planning artifacts to commit."
else
  git commit -m "rapid:init({project-name}): initialize project planning artifacts"
fi
```

Replace `{project-name}` with the actual project name from Step 4A.

Display the commit result: "Committed planning artifacts: {commit hash}"

If the commit fails for any reason, warn the user but do NOT fail the entire init process. The planning files are already written to disk.

---

## Step 11: Completion

Display a final summary:

```markdown
## RAPID Project Initialized

**Project:** {project name}
**Description:** {description}
**Model:** {opus/sonnet}
**Team Size:** {team size description}

**Roadmap:**
- {N} sets planned

**Files Created:**
- .planning/PROJECT.md
- .planning/ROADMAP.md
- .planning/STATE.json
- .planning/config.json
- .planning/REQUIREMENTS.md
- .planning/research/SUMMARY.md
- .planning/research/{research files}
- .planning/sets/{set}/CONTRACT.json (for each set)
- .planning/sets/{set}/DEFINITION.md (for each set)
- .planning/sets/DAG.json
- .planning/sets/OWNERSHIP.json

```

## Step 12: Next Step

Determine the first pending set by running:

```bash
SETS_JSON=$(node "${RAPID_TOOLS}" plan list-sets 2>&1)
```

Parse the JSON output. If there are sets available, display:

> **Next step:** `/rapid:start-set 1`
> *(Start set 1 for development)*

If the project has no sets yet (e.g., roadmap deferred set creation), display:

> **Next step:** `/rapid:status`
> *(View project state)*

## Step 13: Progress Breadcrumb

Render a progress breadcrumb at the very end of the skill output to show the user where they are in the RAPID workflow:

```
init [done] > start-set > discuss-set > plan-set > execute-set > review > merge
```

This breadcrumb shows "init" as complete, and all subsequent stages as pending. The user can see at a glance what comes next and how far along the overall workflow they are.

---

## Error Handling

At every agent step (Steps 6-9), if an agent fails or returns an error:

1. Do NOT use bare STOP or halt.
2. Use AskUserQuestion with structured recovery options:
   - "Retry" -- Re-run the failed agent with the same inputs
   - "Skip" -- Continue without this agent's output (downstream agents will have less context)
   - "Cancel" -- Exit initialization cleanly

3. On ANY error in Steps 5-9, show a progress breadcrumb indicating what has been completed and what failed:
   ```
   init [scaffold done, research failed] > start-set > discuss-set > plan-set > execute-set > review > merge
   ```
   Adjust the breadcrumb content to reflect the actual state of progress. The user should always be able to see what succeeded and what needs attention.

This ensures the user always has control over error recovery and the pipeline never silently fails.

## Important Constraints

- **Agents must NOT write STATE.json directly.** The SKILL.md orchestrator writes STATE.json using the Write tool with validated roadmapper output.
- **All 6 research agents are independent.** No research agent reads another research agent's output. They only share the project description and brownfield analysis as inputs.
- **Contracts are generated by the roadmapper in a unified pass.** Individual sets do not generate their own contracts -- the roadmapper produces all contracts together to ensure cross-set consistency.
- **Roadmapper uses propose-then-approve.** The roadmapper returns a proposal; the user must explicitly accept before any files are written.
- **Sequential fallback for research.** If parallel Agent tool spawning is not available, fall back to sequential execution rather than failing.
- **Sets only in state.** STATE.json contains project > milestone > sets hierarchy. Do NOT include waves or jobs in STATE.json -- wave decomposition happens later during /plan-set.
- **CONTRACT.json at init.** CONTRACT.json files are generated at init time per set by the roadmapper to ensure cross-set interface consistency from the start.

## Anti-Patterns -- Do NOT Do These

- Do NOT reference `state transition wave` or `state transition job` -- these state commands do not exist in v3. Only set-level state transitions exist (via `state transition set`).
- Do NOT ask the roadmapper to produce waves or jobs -- v3 defers wave decomposition to /plan-set. The roadmapper outputs sets only.
- Do NOT reference WAVE-CONTEXT.md or wave directories -- v3 uses set-level CONTEXT.md only.
- Do NOT reference `/rapid:set-init` -- the v3 command is `/rapid:start-set`.
- Do NOT include "waves" or "total jobs" counts in the completion summary or roadmap presentation -- only show "N sets planned".
- Do NOT write waves or jobs arrays into STATE.json -- each set has only `{ id, name, status: "pending", branch }`.
