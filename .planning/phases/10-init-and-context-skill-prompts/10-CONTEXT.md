# Phase 10: Init and Context Skill Prompts - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace freeform text prompts in init and context skills with structured AskUserQuestion prompts for all decision gates. Covers PROMPT-01 (reinit gate), PROMPT-02 (team size), PROMPT-03 (fresh/brownfield), and PROMPT-13 (context greenfield confirmation). Changes are SKILL.md prose edits plus adding AskUserQuestion to allowed-tools.

</domain>

<decisions>
## Implementation Decisions

### Fresh vs brownfield routing
- New Step 3.5 in init flow: after existing project check, before conversational setup
- Auto-detect source code using `node "${RAPID_TOOLS}" context detect` during init
- If source code found: show structured AskUserQuestion with brownfield/greenfield options
- If brownfield selected: auto-run `/rapid:context` after init scaffolding completes (no separate user action needed)
- If no source code detected (greenfield): show brief text note "No source code detected. Run /rapid:context after adding code." — no prompt needed
- Flow order stays the same: Prereqs -> Git check -> Existing project -> Name/Desc/Team -> Brownfield detect -> Scaffold

### Option description depth
- All prompts use consequence-focused descriptions explaining what HAPPENS if you pick each option
- Descriptions include next-step info (what comes after the selection)
- Headers use context-based naming: "Existing project", "Team", "Codebase", "Context files" — not action-based
- Error/blocker states get structured AskUserQuestion where natural actionable options exist (e.g., "Install git" / "Cancel"), otherwise stay as text — full error recovery is Phase 15

### Init question consolidation
- Project name: structured AskUserQuestion with detected directory name as default option + "Custom name" (Other) option
- Project description: stays freeform (creative input, not a choice)
- Team size: structured AskUserQuestion with Solo (1) / Small team (2-3) / Medium team (4-5) / Large team (6+) — descriptive labels with numbers in description
- AskUserQuestion added to `allowed-tools` in both init and context SKILL.md frontmatter

### Context confirmation scope
- Generation confirmation: simple Generate / Cancel only (two options)
- When auto-triggered from init brownfield flow: skip confirmation prompt entirely — user already chose brownfield, that's implicit consent
- Greenfield detection (PROMPT-13): structured AskUserQuestion prompt when context skill detects no source code ("No source code found. Continue anyway / Cancel")
- Analysis results presentation: keep current markdown table + bullet points format unchanged

### Claude's Discretion
- Exact wording of option labels and descriptions (within consequence-focused style)
- Whether to use preview fields on AskUserQuestion for any prompts
- How to wire the init -> context auto-trigger (Skill tool invocation vs inline)
- Error prompt options for specific blocker scenarios

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/init.cjs`: Init scaffolding library with detect/scaffold subcommands — already supports --mode reinitialize/upgrade/cancel
- `src/lib/context.cjs`: Context detection library with `context detect` subcommand — returns hasSourceCode + manifest JSON
- `src/bin/rapid-tools.cjs`: CLI entry point routing all subcommands

### Established Patterns
- SKILL.md files use `allowed-tools` frontmatter to restrict tool access — AskUserQuestion must be added here
- Skills use `disable-model-invocation: true` — they're instruction templates, not executable code
- All skills load .env fallback for RAPID_TOOLS at the top of their bash blocks
- Decision logic in skills follows if/then text patterns — will be replaced with AskUserQuestion calls

### Integration Points
- Init SKILL.md Step 3: existing project detection — currently freeform, becomes AskUserQuestion (PROMPT-01)
- Init SKILL.md Step 4 Question C: team size — currently freeform number, becomes AskUserQuestion (PROMPT-02)
- Init SKILL.md new Step 3.5: brownfield detection — new AskUserQuestion insertion point (PROMPT-03)
- Context SKILL.md Step 4: generation confirmation — currently yes/no text, becomes AskUserQuestion
- Context SKILL.md Step 1: greenfield detection — currently text STOP, becomes AskUserQuestion (PROMPT-13)

</code_context>

<specifics>
## Specific Ideas

- Team size labels should feel human: "Solo", "Small team", "Medium team", "Large team" — not just numbers
- Brownfield auto-trigger should feel seamless: init completes, then context generation starts without user needing to know it's a separate skill
- The project name prompt should show the detected directory name as the first/recommended option

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-init-and-context-skill-prompts*
*Context gathered: 2026-03-06*
