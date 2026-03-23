# SET-OVERVIEW: branding-refocus

## Approach

The current branding skill (`skills/branding/SKILL.md`) conducts a documentation-tone interview -- capturing voice, terminology, and output style preferences. It generates a text-focused BRANDING.md and a static HTML preview page. The problem is that it never asks about visual or UI/UX brand identity (color palettes, typography, spacing, component styles) and treats every project identically regardless of whether it is a webapp, CLI tool, or library.

This set refocuses the skill in two dimensions. First, it adds codebase detection logic so the skill can identify the project type (webapp, CLI, library, etc.) by inspecting indicators such as `package.json` dependencies, framework config files, the presence of `frontend/` or `src/components/` directories, and build tool configuration. Second, it restructures the interview questions and the BRANDING.md output template so that webapp projects receive visual brand guidelines (color palette, typography scale, spacing system, component style, interaction patterns) while CLI/library projects receive appropriate alternatives (output formatting, error style, progress indicators). The existing tone/voice/terminology sections are preserved but deprioritized in favor of the new visual identity sections.

The implementation is contained entirely within a single file (`skills/branding/SKILL.md`) since the skill is prompt-driven -- all logic lives in the skill's Markdown instructions. No runtime code changes are needed outside this file.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| skills/branding/SKILL.md | Complete skill definition (interview flow, output template, detection logic) | Existing -- major rewrite |

## Integration Points

- **Exports:**
  - `codebase-aware-branding`: BRANDING.md adapts its content based on detected project type
  - `visual-brand-guidelines`: BRANDING.md includes color palette, typography, spacing, component style (webapp) or output formatting, error style (CLI/library)
- **Imports:** None -- this set has no dependencies on other sets
- **Side Effects:** The generated `.planning/branding/BRANDING.md` artifact changes shape significantly; any downstream consumers expecting the old format (tone-only sections) will see new visual identity sections instead

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Codebase detection misidentifies project type | Medium | Use multiple signals (package.json, directory structure, config files) with a confidence heuristic; fall back to asking the user when ambiguous |
| Interview becomes too long with added visual questions | Medium | Keep total AskUserQuestion calls at 5 or fewer by combining related questions; skip irrelevant questions based on detected project type |
| Existing BRANDING.md re-run flow breaks with new sections | Low | Update the "Update specific sections" flow in Step 2 to include new visual identity sections alongside the original four |
| BRANDING.md exceeds 150-line budget with visual content | Low | Use compact formatting for color/typography tables; keep prose minimal per existing constraints |

## Wave Breakdown (Preliminary)

- **Wave 1:** Add codebase detection step -- insert a new step (between current Steps 1 and 2) that analyzes the project to determine its type and stores the result for use in subsequent steps
- **Wave 2:** Restructure interview questions -- adapt Rounds 1-4 so that webapp projects get visual brand questions (color palette, typography, component style) while CLI/library projects get formatting-appropriate questions; maintain the 5-question cap
- **Wave 3:** Update BRANDING.md output template and HTML page -- add project-type-conditional sections for visual identity, update the re-run/update flow to handle new sections, and adjust the HTML preview to render visual elements (color swatches, font samples)

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
