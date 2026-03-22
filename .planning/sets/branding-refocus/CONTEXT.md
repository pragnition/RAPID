# CONTEXT: branding-refocus

**Set:** branding-refocus
**Generated:** 2026-03-23
**Mode:** interactive

<domain>
## Set Boundary
Refocuses the `/rapid:branding` skill from a documentation-tone interview to a visual UI/UX brand guidelines tool with codebase awareness. The skill should detect project type (webapp, CLI, library) and adapt both its interview questions and BRANDING.md output accordingly. Webapp projects get visual identity guidelines (colors, typography, spacing, components); CLI/library projects get output formatting guidelines (error style, progress indicators, terminal colors). All changes are contained within `skills/branding/SKILL.md`.
</domain>

<decisions>
## Implementation Decisions

### Codebase Detection

- Use multi-signal heuristic: check package.json deps, framework configs, directory structure, and build tools with confidence scoring
- Also read RAPID state files (PROJECT.md, ROADMAP.md) since the skill is meant to run after `/rapid:init`
- When confidence is low or multiple types detected, ask the user to pick the primary type via AskUserQuestion

### Interview Restructuring

- For webapp projects: Replace Round 1 (Project Identity) with "Visual Identity" (color palette, typography) and Round 2 (Tone & Voice) with "Component Style" (spacing, border radius, shadows). Keep Rounds 3-4 (Terminology, Output Style) as-is
- For CLI/library projects: Replace visual rounds with output formatting focus -- error message style, progress indicators, terminal color usage, log formatting
- Maintain the 5-question cap across all project types

### BRANDING.md Format

- Use compact tables for visual identity: color palette table (name, hex, usage), typography scale table (size, weight, usage), spacing token table
- For webapp projects, replace tone/voice/documentation sections entirely -- BRANDING.md becomes purely visual/UX focused, no documentation tone content
- For CLI/library projects, structure around output formatting rather than visual design
- Stay within 150-line budget using compact table formatting

### HTML Preview Page

- Webapp projects get a live style guide: color swatches with hex codes, typography scale with rendered font samples, spacing visualizations, and sample UI component mockups (mini design system preview)
- CLI/library projects get a terminal mockup: styled terminal-like div showing sample CLI output with the project's error style, colors, and progress indicators
- Both remain self-contained HTML (no external dependencies, inline CSS/JS)
</decisions>

<specifics>
## Specific Ideas
- Read RAPID planning artifacts (PROJECT.md, ROADMAP.md) as part of detection since the skill runs post-init
- The skill is entirely prompt-driven -- all logic lives in SKILL.md, no runtime code changes needed
</specifics>

<code_context>
## Existing Code Insights
- Current skill is at `skills/branding/SKILL.md` -- a single prompt-driven file with 7 steps
- Interview currently has 4 rounds (Identity, Tone & Voice, Terminology, Output Style) + 1 anti-patterns question = 5 AskUserQuestion calls
- Output artifacts: `.planning/branding/BRANDING.md` (authoritative) and `.planning/branding/index.html` (visual preview)
- Existing BRANDING.md uses XML-tagged sections: `<identity>`, `<tone>`, `<terminology>`, `<output>`, `<anti-patterns>`
- Step 2 handles re-run flow with update/fresh/view options
- HTML page is self-contained with inline CSS/JS, opened via platform-detected browser command
- The skill is explicitly optional -- never a prerequisite for other RAPID workflows
</code_context>

<deferred>
## Deferred Ideas
- None identified during discussion
</deferred>
