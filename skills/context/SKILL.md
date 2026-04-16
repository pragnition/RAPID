---
description: Analyze codebase and generate project context files (CLAUDE.md, style guide, conventions)
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Glob, Grep, Agent, AskUserQuestion
args: []
categories: [autonomous]
---

# /rapid:context -- Codebase Analysis and Context Generation

You are the RAPID context generator. This skill analyzes an existing codebase and generates context files that agents use to understand project conventions, architecture, and style. Follow these steps IN ORDER. Do not skip steps.

## Step 1: Brownfield Detection

Run the brownfield detector to check if source code exists:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" context detect
```

Parse the JSON output. The response contains `hasSourceCode` (boolean) and either a `message` (when false) or `manifest` (when true).

Decision logic:
- If `hasSourceCode` is false: Use AskUserQuestion with:
  - question: "No source code detected"
  - Options:
    - "Continue anyway" -- "Proceed with context generation using whatever files exist. Results may be minimal."
    - "Cancel" -- "Exit context generation. Run /rapid:context again after adding source code."
  - If the user picks "Continue anyway": proceed to Step 2 as normal (the manifest will be limited but generation continues).
  - If the user picks "Cancel": Print "Cancelled. No changes made." and end the skill.
- If `hasSourceCode` is true: Store the `manifest` data for use in Step 3. Continue to Step 2.

The manifest contains:
- `codebase`: Detected languages, frameworks, config files, and source file stats
- `configFiles`: Array of config files with their categories and parsed contents
- `structure`: Directory tree of the project
- `sampleFiles`: Prioritized list of source files for deep analysis (entry points first, then tests, then source)

## Step 2: Prepare Context Directory

Run the context directory setup:

```bash
node "${RAPID_TOOLS}" context generate
```

Parse the JSON output. The response contains `contextDir` (path to `.planning/context/`) and `ready` (boolean).

If the command fails (e.g., no `.planning/` exists), tell the user: "No RAPID project found. Run `/rapid:init` first to initialize the project, then run `/rapid:context` to generate context files." End the skill.

Store the `contextDir` path for use in Step 5.

## Step 3: Analysis via Subagent (Analysis-Only Pass)

Spawn the context-generator subagent using the Agent tool to perform deep codebase analysis. The subagent analyzes source code patterns without writing any files.

Print progress banner before spawning the analysis subagent:
> Scanning project...

Use the Agent tool with these instructions:

Spawn the **rapid-context-generator** agent with this task:

```
Run in analysis-only mode. Read the sample files listed in the manifest. Analyze the codebase for architecture patterns, code conventions, naming patterns, error handling, test infrastructure, and style rules. Return your analysis as structured text. Do NOT write any files.

## Scan Manifest
{scan manifest JSON from Step 1}

## Working Directory
{project root path from Step 2}
```

The agent should:
- Read each sample source file from the manifest's `sampleFiles` array
- Analyze config files listed in the manifest's `configFiles` array (read any with `parsed: null` that seem important -- linting configs, formatting configs, TypeScript configs)
- Identify architecture patterns, naming conventions, error handling approaches
- Determine which context files to generate (the standard 5 plus any additional files warranted by the analysis)
- Return structured findings following the analysis output format in the role module

**Wait for the subagent to complete and capture its response.**

Print progress banner after analysis returns:
> Analyzing patterns...

## Step 4: User Review and Confirmation

**Auto-trigger note:** If this context generation was auto-triggered from `/rapid:init` brownfield flow, skip the confirmation prompt below and proceed directly to Step 5. The user already consented to codebase analysis when they chose Brownfield during init.

Present the subagent's analysis summary to the user in a clear, organized format:

```markdown
## Codebase Analysis Results

**Detected Stack:**
- Languages: {from analysis}
- Frameworks: {from analysis}
- Key Dependencies: {from analysis}

**Context Files to Generate:**

| File | Location | Description |
|------|----------|-------------|
| CLAUDE.md | project root | Lean project context (under 80 lines) |
| CODEBASE.md | .planning/context/ | Brownfield analysis report |
| ARCHITECTURE.md | .planning/context/ | Architecture patterns and structure |
| CONVENTIONS.md | .planning/context/ | Code conventions |
| STYLE_GUIDE.md | .planning/context/ | Style rules (descriptive tone) |
| {additional} | .planning/context/ | {if recommended by analysis} |

**Key Findings Preview:**
{Show 2-3 bullet points per planned file from the analysis}
```

Then use AskUserQuestion with:
- question: "Context files ready to generate"
- Options:
  - "Generate" -- "Write all context files listed above to .planning/context/ and CLAUDE.md to project root."
  - "Cancel" -- "Exit without generating files. No changes will be made."
- If the user picks "Generate": proceed to Step 5.
- If the user picks "Cancel": Print "Cancelled. No changes made." and end the skill.

## Step 5: Write Context Files via Subagent

Print progress banner before spawning the write subagent:
> Generating files...

Spawn the context-generator subagent again using the Agent tool, this time in **write mode**.

Spawn the **rapid-context-generator** agent with this task:

```
Run in write mode. Using the analysis findings provided, write all context files. Write CLAUDE.md to the project root. Write all other context files to .planning/context/. Follow the file specifications in your role instructions. Ensure CLAUDE.md is under 80 lines. Use descriptive tone in STYLE_GUIDE.md.

## Analysis Findings
{full analysis findings from Step 3}

## User Modifications
{any user modifications from Step 4 -- files to skip, content adjustments}

## Working Directory
{project root path}

## Context Directory
{context directory path from Step 2}
```

**Wait for the subagent to complete.**

## Step 6: Confirmation and Summary

After the write-mode subagent completes, verify the files were created:

```bash
ls -la .planning/context/
```

Also check CLAUDE.md exists at the project root and count its lines:

```bash
wc -l CLAUDE.md
```

Display a completion summary to the user:

```markdown
## Context Generation Complete

**Files Generated:**
| File | Location | Lines |
|------|----------|-------|
| CLAUDE.md | ./CLAUDE.md | {N} |
| CODEBASE.md | .planning/context/CODEBASE.md | {N} |
| ARCHITECTURE.md | .planning/context/ARCHITECTURE.md | {N} |
| CONVENTIONS.md | .planning/context/CONVENTIONS.md | {N} |
| STYLE_GUIDE.md | .planning/context/STYLE_GUIDE.md | {N} |
| {additional files...} | ... | ... |

**Agent Context Injection:**
Agents will automatically receive relevant context files based on their role:
- Planners: CONVENTIONS.md, ARCHITECTURE.md
- Executors: STYLE_GUIDE.md, CONVENTIONS.md
- Reviewers: STYLE_GUIDE.md, CONVENTIONS.md, ARCHITECTURE.md
- Orchestrators: ARCHITECTURE.md
- Verifiers: (no context files -- lightweight verification only)

Re-run `/rapid:context` at any time to regenerate from the current codebase state.
```

## Important Notes

- **Re-run behavior:** Running `/rapid:context` again regenerates all context files from scratch. There is no diffing or incremental update -- the current codebase state is always the source of truth.
- **Greenfield projects:** If no source code is detected (Step 1 returns false), the skill stops with a helpful message. No error, no empty files.
- **CLAUDE.md size:** The generated CLAUDE.md must stay under 80 lines. Detailed analysis lives in `.planning/context/` files, not in CLAUDE.md.
- **Descriptive tone:** STYLE_GUIDE.md uses descriptive language ("This codebase uses...") not prescriptive ("MUST use..."). Config files are ground truth; code analysis fills gaps.
- **Agent tool usage:** This skill uses the Agent tool to spawn a subagent for deep analysis. The subagent does the heavy lifting of reading files and understanding patterns. The skill orchestrates the flow and handles user interaction.
