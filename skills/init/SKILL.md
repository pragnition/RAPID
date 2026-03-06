---
name: init
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

## Step 4: Setup Questions

Gather project information by asking ONE question at a time. Wait for the user's answer before asking the next question.

**Question A: Project Name**

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

**Question B: Project Description**

Ask freeform: "Give a one-sentence description of the project. This will be used throughout planning to describe the project's core purpose."

Store the user's response as the project description.

**Question C: Team Size**

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

**Question D: Model Selection**

Use AskUserQuestion with:
- question: "Model selection for AI agents"
- Options:
  - "Opus" -- "Higher quality, slower, more expensive. Best for complex projects."
  - "Sonnet" -- "Good balance of quality and speed. Recommended for most projects."

Store the selection as `opus` or `sonnet`.

---

## Step 5: Scaffold

Run the scaffold, config write, and research directory setup:

```bash
node "${RAPID_TOOLS}" init scaffold --name "{name}" --description "{desc}" --team-size {N} --mode {mode}
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

1. Read the codebase synthesizer role instructions:
   ```bash
   cat src/modules/roles/role-codebase-synthesizer.md
   ```

2. Read the scan manifest for the project (included in the `context detect` output as `manifest`).

3. Use the Agent tool to spawn the codebase synthesizer subagent:
   - Pass the role instructions from `role-codebase-synthesizer.md` as the agent's primary instructions
   - Pass the project directory path (current working directory)
   - Pass the scan manifest data from `context detect`
   - Pass the project description from Step 4
   - The agent writes `CODEBASE-ANALYSIS.md` to `.planning/research/`

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

Read ALL 5 research agent role files before spawning:

```
src/modules/roles/role-research-stack.md
src/modules/roles/role-research-features.md
src/modules/roles/role-research-architecture.md
src/modules/roles/role-research-pitfalls.md
src/modules/roles/role-research-oversights.md
```

Spawn ALL 5 research agents in parallel using the Agent tool. Each agent receives:

1. **Role instructions** -- the contents of its respective role file
2. **Project name** -- from Step 4
3. **Project description** -- from Step 4
4. **Model selection** -- opus or sonnet from Step 4
5. **Brownfield context** -- if brownfield, include the full contents of `.planning/research/CODEBASE-ANALYSIS.md`. If greenfield, include a note: "This is a greenfield project with no existing codebase."
6. **Context7 instruction** -- "Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback."

Each agent writes its output to `.planning/research/`:
- Stack agent -> `STACK.md`
- Features agent -> `FEATURES.md`
- Architecture agent -> `ARCHITECTURE.md`
- Pitfalls agent -> `PITFALLS.md`
- Oversights agent -> `OVERSIGHTS.md`

**Parallel spawning:** Spawn all 5 agents in a single response using 5 Agent tool calls. Each agent operates independently -- no agent reads another research agent's output.

**Sequential fallback:** If parallel spawning fails (Claude Code limitation), fall back to sequential execution. Inform the user: "Running research agents sequentially (parallel spawning unavailable)."

Wait for ALL 5 agents to complete. If any agent fails, use AskUserQuestion:
- question: "{agent name} research agent encountered an error: {error details}"
- Options:
  - "Retry" -- "Re-run this research agent"
  - "Skip" -- "Continue without this research output. Synthesis will have less context."
  - "Cancel" -- "Exit initialization."

---

## Step 8: Research Synthesis

Spawn the research synthesizer agent:

1. Read the synthesizer role instructions:
   ```
   src/modules/roles/role-research-synthesizer.md
   ```

2. Use the Agent tool to spawn the synthesizer subagent:
   - Pass the role instructions from `role-research-synthesizer.md`
   - The agent reads all 5 research output files from `.planning/research/` (STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, OVERSIGHTS.md)
   - If brownfield, the agent also has access to CODEBASE-ANALYSIS.md for context
   - The agent writes `.planning/research/SUMMARY.md`

3. Wait for completion. If it fails, use AskUserQuestion with Retry/Skip/Cancel options (same pattern as Step 6).

4. After completion, read `.planning/research/SUMMARY.md` to confirm it was written and to pass its content to the roadmapper.

---

## Step 9: Roadmap Generation

Spawn the roadmapper agent:

1. Read the roadmapper role instructions:
   ```
   src/modules/roles/role-roadmapper.md
   ```

2. Read `.planning/research/SUMMARY.md` (the synthesized research output).

3. Use the Agent tool to spawn the roadmapper subagent:
   - Pass the role instructions from `role-roadmapper.md`
   - Pass the SUMMARY.md content
   - Pass the project description from Step 4
   - Pass the team size from Step 4
   - Pass the model selection from Step 4
   - The agent returns a structured JSON response with three keys:
     - `roadmap` -- markdown string for ROADMAP.md
     - `state` -- STATE.json milestone/set/wave/job structure
     - `contracts` -- array of { setId, contract } objects for CONTRACT.json files

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
- All original context (SUMMARY.md, description, team size, model)
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

**Next Steps:**
Run `/rapid:context` to generate project context files (CLAUDE.md, style guide, conventions).
Then run `/rapid:help` to see all available commands and the RAPID workflow.
```

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
