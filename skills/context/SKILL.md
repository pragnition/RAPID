---
description: Analyze codebase and generate project context files (CLAUDE.md, style guide, conventions)
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Glob, Grep, Agent
---

# /rapid:context -- Codebase Analysis and Context Generation

You are the RAPID context generator. This skill analyzes an existing codebase and generates context files that agents use to understand project conventions, architecture, and style. Follow these steps IN ORDER. Do not skip steps.

## Step 1: Brownfield Detection

Run the brownfield detector to check if source code exists:

```bash
node "${RAPID_TOOLS:-$HOME/RAPID/src/bin/rapid-tools.cjs}" context detect
```

Parse the JSON output. The response contains `hasSourceCode` (boolean) and either a `message` (when false) or `manifest` (when true).

Decision logic:
- If `hasSourceCode` is false: Display this message to the user: "No source code detected in this directory. Context generation requires an existing codebase to analyze. Run `/rapid:context` again after adding source code." Then **STOP** -- do not continue to further steps.
- If `hasSourceCode` is true: Store the `manifest` data for use in Step 3. Continue to Step 2.

The manifest contains:
- `codebase`: Detected languages, frameworks, config files, and source file stats
- `configFiles`: Array of config files with their categories and parsed contents
- `structure`: Directory tree of the project
- `sampleFiles`: Prioritized list of source files for deep analysis (entry points first, then tests, then source)

## Step 2: Prepare Context Directory

Run the context directory setup:

```bash
node "${RAPID_TOOLS:-$HOME/RAPID/src/bin/rapid-tools.cjs}" context generate
```

Parse the JSON output. The response contains `contextDir` (path to `.planning/context/`) and `ready` (boolean).

If the command fails (e.g., no `.planning/` exists), tell the user: "No RAPID project found. Run `/rapid:init` first to initialize the project, then run `/rapid:context` to generate context files." Then **STOP**.

Store the `contextDir` path for use in Step 5.

## Step 3: Analysis via Subagent (Analysis-Only Pass)

Spawn the context-generator subagent using the Agent tool to perform deep codebase analysis. The subagent analyzes source code patterns without writing any files.

Use the Agent tool with these instructions:

**Subagent prompt must include:**

1. The role instructions from `role-context-generator.md` (the subagent should be instructed to follow the Context Generator role)
2. The scan manifest JSON from Step 1 (passed as context so the subagent knows what to analyze)
3. The project root path from Step 2
4. Explicit mode instruction: **"Run in analysis-only mode. Read the sample files listed in the manifest. Analyze the codebase for architecture patterns, code conventions, naming patterns, error handling, test infrastructure, and style rules. Return your analysis as structured text. Do NOT write any files."**

The subagent should:
- Read each sample source file from the manifest's `sampleFiles` array
- Analyze config files listed in the manifest's `configFiles` array (read any with `parsed: null` that seem important -- linting configs, formatting configs, TypeScript configs)
- Identify architecture patterns, naming conventions, error handling approaches
- Determine which context files to generate (the standard 5 plus any additional files warranted by the analysis)
- Return structured findings following the analysis output format in the role module

**Wait for the subagent to complete and capture its response.**

## Step 4: User Review and Confirmation

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

Then ask the user:

> Ready to generate these context files? (yes/no)

Decision logic:
- If the user confirms (yes, y, sure, go ahead, etc.): Proceed to Step 5.
- If the user declines or requests changes: Discuss what they want different. If they want to adjust which files are generated or what content to focus on, note the adjustments and ask for confirmation again. If they want to cancel entirely, **STOP**.
- If the user asks to skip certain files: Note which files to skip and proceed to Step 5 with the reduced set.

## Step 5: Write Context Files via Subagent

Spawn the context-generator subagent again using the Agent tool, this time in **write mode**.

**Subagent prompt must include:**

1. The role instructions from `role-context-generator.md`
2. The full analysis findings from Step 3 (pass the subagent's analysis response as context)
3. The project root path and context directory path
4. Any user modifications from Step 4 (files to skip, content adjustments)
5. Explicit mode instruction: **"Run in write mode. Using the analysis findings provided, write all context files. Write CLAUDE.md to the project root. Write all other context files to .planning/context/. Follow the file specifications in your role instructions. Ensure CLAUDE.md is under 80 lines. Use descriptive tone in STYLE_GUIDE.md."**

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
