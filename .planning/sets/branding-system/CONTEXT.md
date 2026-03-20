# CONTEXT: branding-system

**Set:** branding-system
**Generated:** 2026-03-20
**Mode:** interactive

<domain>
## Set Boundary
Create an optional `/rapid:branding` skill that conducts a structured branding interview via AskUserQuestion, produces a concise BRANDING.md artifact, generates a static HTML branding guidelines page, and injects branding context into all lifecycle phase prompts. The system is fully optional -- absence of branding artifacts must not affect any other RAPID workflow.
</domain>

<decisions>
## Implementation Decisions

### Interview Flow Design

- Cover all 4 branding dimensions: Tone & Voice, Terminology & Naming, Output Style, Project Identity
- Ask 3-4 focused questions per session using AskUserQuestion with prefilled options (user can always select "Other" for custom input)
- Each question maps to one branding dimension; keep the interview under 2 minutes

### BRANDING.md Format

- Use XML-style tagged sections (`<identity>`, `<tone>`, `<terminology>`, `<output>`) for easy programmatic parsing and selective injection
- Include an anti-patterns / "do not" section listing explicit things agents should avoid
- Keep within the 50-150 line budget as specified in CONTRACT.json
- Store at `.planning/branding/BRANDING.md` (inside a branding folder, not at planning root)

### Branding Folder Structure

- Create `.planning/branding/` directory containing:
  - `BRANDING.md` -- concise summary artifact for prompt injection (50-150 lines)
  - `index.html` -- single self-contained HTML file with inline CSS/JS showing the full branding guidelines visually (colors, typography, tone examples, terminology table)
- The static HTML page is for user review; BRANDING.md is for agent consumption
- Auto-open the HTML file in the default browser after generation (`xdg-open` on Linux, `open` on macOS)

### Context Injection Scope

- Inject branding context into ALL lifecycle phases (discussion, planning, and execution) -- not just execution
- This means injection must happen in both `enrichedPrepareSetContext()` and `assembleExecutorPrompt()` (all phase branches)
- Branding should influence: documentation/READMEs and code comments/naming (using project terminology)
- Branding should NOT influence: commit messages, CLI/banner output, or RAPID's own internal output

### Skill Integration UX

- After `/rapid:init` completes, show a non-intrusive hint: "Optional: run /rapid:branding to set project tone and style"
- On re-run when BRANDING.md already exists: display current branding summary, then ask which sections to update (preserve unchanged sections)
- Auto-open the static HTML branding page in the browser after generation

### Claude's Discretion

- Exact wording of interview questions and prefilled option labels
- HTML page design and layout details
- `buildBrandingContext()` formatting of the injected context string
- Role module (`role-branding.md`) internal structure
</decisions>

<specifics>
## Specific Ideas
- The branding folder at `.planning/branding/` replaces the original CONTRACT plan of a single file at `.planning/BRANDING.md`
- The static HTML site should be a single self-contained file (no build step, no external dependencies)
- Anti-patterns section gives agents explicit "do not" guidance (e.g., "never use emojis", "avoid marketing language")
</specifics>

<code_context>
## Existing Code Insights

- `enrichedPrepareSetContext()` in `execute.cjs:61-85` already follows a try/catch pattern for optional context (quality, UI) -- branding injection should mirror this exact pattern
- `assembleExecutorPrompt()` in `execute.cjs:166-319` handles discuss/plan/execute phases separately -- branding context needs injection in all three branches
- `STAGE_VERBS` and `STAGE_BG` in `display.cjs:24-67` use simple key-value maps -- add `'branding'` entries following existing conventions
- Existing role modules at `src/modules/roles/role-*.md` follow a consistent structure: title, responsibilities, conventions
- Skills use `SKILL.md` format with step-by-step instructions and AskUserQuestion for user interaction (see `skills/discuss-set/SKILL.md` for precedent)
- The `buildBrandingContext()` function should follow `buildQualityContext()` and `buildUiContext()` patterns
</code_context>

<deferred>
## Deferred Ideas
- Branding presets/templates (e.g., "startup", "enterprise", "open-source") for quick setup
- Branding validation/linting to check agent output against branding guidelines
- Multi-brand support for monorepos with different sub-project brands
</deferred>
