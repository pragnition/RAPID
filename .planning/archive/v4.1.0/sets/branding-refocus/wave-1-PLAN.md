# Wave 1 PLAN: Branding Refocus -- Codebase-Aware Visual Brand Guidelines

## Objective

Rewrite `skills/branding/SKILL.md` to transform the branding skill from a documentation-tone interview into a codebase-aware visual/UX brand guidelines tool. The skill must detect project type (webapp, CLI, library) and adapt its interview questions, BRANDING.md output, and HTML preview accordingly. Update the test file to match the new structure.

## Owned Files

| File | Action |
|------|--------|
| `skills/branding/SKILL.md` | Major rewrite |
| `skills/branding/SKILL.test.cjs` | Update to match new structure |

---

## Task 1: Add Codebase Detection Step (Step 2 in new SKILL.md)

**File:** `skills/branding/SKILL.md`

**Action:** Insert a new Step 2 (between current Step 1 and Step 2, renumbering all subsequent steps to Step 3-8) that performs project type detection.

**Detection logic to include in the step instructions:**

1. Read `package.json` if it exists:
   - Check `dependencies`/`devDependencies` for webapp signals: `react`, `vue`, `angular`, `svelte`, `next`, `nuxt`, `vite`, `webpack`, `@angular/core`
   - Check for CLI signals: `commander`, `yargs`, `inquirer`, `chalk`, `ora`, `meow`, `cac`
   - Check `bin` field presence (CLI indicator)
   - Check if `main`/`exports` exists without `bin` (library indicator)
2. Use Glob to check directory structure:
   - `src/components/`, `app/`, `pages/`, `frontend/`, `public/` = webapp signals
   - `bin/`, `cli/` = CLI signals
   - `src/lib/`, `lib/` with no webapp/CLI signals = library signals
3. Check for framework config files:
   - `next.config.*`, `vite.config.*`, `nuxt.config.*`, `angular.json`, `svelte.config.*` = webapp
   - `Cargo.toml` with `[[bin]]` = CLI, without = library
   - `pyproject.toml` with `[project.scripts]` = CLI
4. Read RAPID artifacts if present (`PROJECT.md`, `ROADMAP.md`) for project description context
5. Assign project type as one of: `webapp`, `cli`, `library`, `hybrid`, `unknown`
6. If confidence is low or type is `hybrid`/`unknown`, use AskUserQuestion to confirm:
   ```
   "I detected your project might be a {detected_type}. What best describes your project?"
   Options:
   - "Web application" -- "Frontend/fullstack app with visual UI (React, Vue, etc.)"
   - "CLI tool" -- "Command-line tool with terminal output"
   - "Library / SDK" -- "Package consumed by other projects, no direct UI"
   - "Other" -- "Describe your project type"
   ```
   This AskUserQuestion counts toward the 5-call budget. When type detection is high-confidence, skip this question to save budget.

**Store the detected type** as a variable/reference used by all subsequent steps.

**Important structural constraints:**
- This becomes Step 2 in the new file. All subsequent steps shift by +1 (old Step 2 becomes Step 3, etc.)
- The new file will have Steps 1-8 (8 total steps). Test 15 checks for `>= 7` steps in sequential order, so 8 is fine.

---

## Task 2: Restructure Interview Rounds by Project Type (Step 4 in new SKILL.md)

**File:** `skills/branding/SKILL.md`

**Action:** Rewrite the interview step (now Step 4, was Step 3) to have **project-type-conditional rounds**. The step must still have exactly 4 `### Round N` headings (test 6 checks for exactly 4). Each round contains conditional content based on detected project type.

### Round structure:

**Round 1 -- Visual Identity (webapp) / Output Identity (CLI/library)**

For **webapp** projects, use AskUserQuestion:
```
"What visual identity direction fits your project?"
Options:
- "Modern & minimal" -- "Clean lines, generous whitespace, monochrome with one accent color"
- "Bold & colorful" -- "Vibrant palette, strong contrast, energetic feel"
- "Corporate & polished" -- "Refined, professional palette, subtle gradients, enterprise-grade"
- "Other" -- "Describe your visual direction"
```

For **CLI/library** projects, use AskUserQuestion:
```
"How should your tool's terminal output look and feel?"
Options:
- "Minimal & clean" -- "Plain text, sparse color, no decorations. Think Go CLI tools."
- "Rich & informative" -- "Colors, icons/symbols, progress bars. Think npm/yarn output."
- "Structured & parseable" -- "Machine-friendly output, JSON mode, minimal decoration"
- "Other" -- "Describe your output style preferences"
```

**Round 2 -- Component Style (webapp) / Error & Status Style (CLI/library)**

For **webapp** projects, use AskUserQuestion:
```
"What component and layout style do you prefer?"
Options:
- "Rounded & soft" -- "Rounded corners, soft shadows, gentle transitions"
- "Sharp & structured" -- "Square corners, defined borders, grid-aligned layouts"
- "Fluid & organic" -- "Flowing shapes, gradients, smooth animations"
- "Other" -- "Describe your UI component style"
```

For **CLI/library** projects, use AskUserQuestion:
```
"How should errors and status messages be formatted?"
Options:
- "Contextual with fix suggestions" -- "Show the error, point to the line, suggest a fix. Think Rust compiler."
- "Concise one-liners" -- "Short error messages, error codes for lookup. Think Unix tradition."
- "Verbose with stack traces" -- "Full context, debug info, trace output for diagnosing issues"
- "Other" -- "Describe your error formatting preferences"
```

**Round 3 -- Terminology & Naming** (same for all project types -- keep existing)

**Round 4 -- Interaction Patterns (webapp) / Log & Progress Style (CLI/library)**

For **webapp** projects, use AskUserQuestion:
```
"What interaction and feedback patterns should your UI follow?"
Options:
- "Instant & reactive" -- "Immediate feedback, optimistic updates, micro-animations"
- "Deliberate & confirmed" -- "Explicit confirmations, loading states, step-by-step flows"
- "Ambient & passive" -- "Subtle notifications, non-blocking updates, quiet success"
- "Other" -- "Describe your interaction patterns"
```

For **CLI/library** projects, use AskUserQuestion:
```
"How should progress and logging be displayed?"
Options:
- "Progress bars & spinners" -- "Visual progress indicators for long operations"
- "Streaming log lines" -- "Real-time log output with timestamps and levels"
- "Silent unless error" -- "No output on success, only report failures"
- "Other" -- "Describe your progress/logging preferences"
```

**Key constraints:**
- Each round MUST still be headed with `### Round N -- {Title}` format
- The round titles must include BOTH variants: e.g., `### Round 1 -- Visual Identity / Output Identity`
- Each round's primary code block MUST have 3-4 option lines starting with `- "` (test 8 checks this)
- Test 6 checks for the strings "Project Identity", "Tone & Voice", "Terminology & Naming", "Output Style" -- these strings must still appear somewhere in the file (can be in comments, context text, or the re-run section's update options). **Important:** The round heading names change, so test 6 will need updating (see Task 5).
- The Final Question (Anti-Patterns) remains unchanged

**AskUserQuestion budget:** 4 rounds + 1 anti-patterns = 5. If the type-confirmation question was used in Step 2, one of the rounds must be skipped or combined to stay within budget. Handle this by noting: "If the type-confirmation question was asked in Step 2, combine Rounds 1 and 2 into a single AskUserQuestion with the most critical question for that project type."

---

## Task 3: Update BRANDING.md Output Template (Step 5 in new SKILL.md)

**File:** `skills/branding/SKILL.md`

**Action:** Rewrite the BRANDING.md generation step (now Step 5, was Step 4) with project-type-conditional output format.

### Webapp BRANDING.md format:

```markdown
# Project Branding Guidelines

> Project type: webapp

<visual-identity>
## Visual Identity

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| primary | #XXXXXX | Primary actions, key UI elements |
| secondary | #XXXXXX | Supporting elements, secondary actions |
| accent | #XXXXXX | Highlights, notifications, badges |
| background | #XXXXXX | Page/card backgrounds |
| surface | #XXXXXX | Elevated surfaces, modals, dropdowns |
| text-primary | #XXXXXX | Headings, body text |
| text-secondary | #XXXXXX | Captions, placeholder text |
| error | #XXXXXX | Error states, destructive actions |
| success | #XXXXXX | Success states, confirmations |

### Typography Scale

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| heading-1 | Xrem | bold | Page titles |
| heading-2 | Xrem | semibold | Section headers |
| body | Xrem | regular | Body text, descriptions |
| caption | Xrem | regular | Labels, helper text |
| mono | Xrem | regular | Code, technical values |

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| xs | Xpx | Inline element gaps |
| sm | Xpx | Compact component padding |
| md | Xpx | Standard component padding |
| lg | Xpx | Section gaps |
| xl | Xpx | Page-level margins |
</visual-identity>

<component-style>
## Component Style
{Synthesize Round 2 response: border-radius values, shadow style, transition preferences, layout approach}
</component-style>

<terminology>
## Terminology & Naming
| Preferred Term | Instead Of | Context |
|---------------|-----------|---------|
{Same as existing -- populated from Round 3}
</terminology>

<interaction-patterns>
## Interaction Patterns
{Synthesize Round 4 response: feedback timing, animation approach, notification style, loading state design}
</interaction-patterns>

<anti-patterns>
## Anti-Patterns (Do NOT)
- {From final question}
</anti-patterns>
```

### CLI/Library BRANDING.md format:

```markdown
# Project Branding Guidelines

> Project type: cli

<output-formatting>
## Output Formatting
{Synthesize Round 1 response: output verbosity, decoration level, color usage philosophy}

### Terminal Colors

| Purpose | Color | ANSI | Usage |
|---------|-------|------|-------|
| error | red | \033[31m | Error messages, fatal failures |
| warning | yellow | \033[33m | Warnings, deprecation notices |
| success | green | \033[32m | Success confirmations |
| info | blue | \033[34m | Informational output |
| dim | gray | \033[90m | Secondary info, timestamps |
| highlight | bold | \033[1m | Key values, emphasis |
</output-formatting>

<error-style>
## Error & Status Style
{Synthesize Round 2 response: error format, context level, fix suggestions, error codes}
</error-style>

<terminology>
## Terminology & Naming
| Preferred Term | Instead Of | Context |
|---------------|-----------|---------|
{Same as existing -- populated from Round 3}
</terminology>

<log-style>
## Log & Progress Style
{Synthesize Round 4 response: progress indicator type, log format, verbosity levels, silent mode}
</log-style>

<anti-patterns>
## Anti-Patterns (Do NOT)
- {From final question}
</anti-patterns>
```

**Constraints:**
- Keep the 50-150 line budget
- Use compact table formatting to fit within budget
- The `> Project type: {type}` line at the top is important for re-run detection
- Validation step (line count check) remains the same

---

## Task 4: Update HTML Preview and Re-Run Flow (Steps 3, 6 in new SKILL.md)

**File:** `skills/branding/SKILL.md`

**Action:** Update two areas:

### 4a: Re-run flow (Step 3, was Step 2)

Update the "Update specific sections" option list to be project-type-aware:

- When an existing BRANDING.md is found, read its `> Project type:` line to determine the current type
- For webapp re-run, offer sections: "Visual Identity", "Component Style", "Terminology & Naming", "Interaction Patterns"
- For CLI/library re-run, offer sections: "Output Formatting", "Error & Status Style", "Terminology & Naming", "Log & Progress Style"
- Keep the three top-level choices unchanged: "Update specific sections", "Start fresh", "View current and exit"
- The old section names ("Project Identity", "Tone & Voice", "Terminology & Naming", "Output Style") should appear as fallback options when the existing BRANDING.md has no project type line (legacy format)

### 4b: HTML preview (Step 6, was Step 5)

Update the HTML generation instructions to be project-type-conditional:

**For webapp projects:**
- Color palette rendered as swatches (colored divs with hex labels)
- Typography scale rendered with actual font size demonstrations
- Spacing tokens visualized as bars/blocks at each size
- Component style rendered as sample card/button mockups using the defined tokens
- Interaction pattern notes in a sidebar or footer section

**For CLI/library projects:**
- Terminal mockup: a dark-background div styled as a terminal window
- Show sample CLI output demonstrating the project's:
  - Error message formatting (with configured colors)
  - Success/info message formatting
  - Progress indicator style (if configured)
  - Help text formatting
- Use CSS classes to apply the configured terminal colors
- Include a legend mapping ANSI color names to their usage

**Both types:**
- Self-contained HTML, no external deps, inline CSS/JS
- Opens correctly via `file://` protocol
- Clean, readable design

---

## Task 5: Update Test File for New Structure

**File:** `skills/branding/SKILL.test.cjs`

**Action:** Update tests to match the new SKILL.md structure. Changes required:

### Test 6 (round names and count):
- **Old:** Checks for "Project Identity", "Tone & Voice", "Terminology & Naming", "Output Style" and exactly 4 `### Round N` headings
- **New:** Check for the new round name patterns. The round headings now contain both variants separated by `/`. Update to check for:
  - "Visual Identity" OR "Output Identity" (Round 1)
  - "Component Style" OR "Error" (Round 2)
  - "Terminology" (Round 3 -- unchanged)
  - "Interaction Patterns" OR "Log" (Round 4)
  - Still exactly 4 `### Round N` headings

### Test 8 (prefilled options):
- Should still pass since each round's primary code block still has 3-4 options
- But the round sections now contain TWO code blocks (one per project type). The test extracts the FIRST code block per round section. Verify the first code block in each round section has 3-4 options. If the webapp variant comes first, this should work. **Ensure webapp variant code block appears first in each round.**

### Test 15 (step ordering):
- **Old:** Checks for >= 7 steps, sequential ordering
- **New:** The file now has 8 steps. Test already checks `>= 7`, so it passes. No change needed.

### New test: Codebase detection step exists
- Add a test that verifies the codebase detection step exists (checks for "Codebase Detection" or "Project Type Detection" or "detect" in a step heading)
- Verify it references reading `package.json` and checking directory structure

### New test: Project-type-conditional content
- Add a test that verifies the file contains both webapp and CLI/library conditional content
- Check for presence of both "webapp" and "cli" or "CLI" strings
- Check for presence of visual identity keywords ("color", "typography" or "palette") and CLI keywords ("terminal", "error" or "output formatting")

### Test 9-10 (re-run UX):
- Re-run choices "Update specific sections", "Start fresh", "View current and exit" are unchanged. No update needed.
- But test 10 might need the section names updated if checked. Review and update if the test checks for old section names in the re-run options.

**Verification:** After updating, the existing test structure must still work. Keep the `describe` block and test numbering convention.

---

## Verification

After all tasks are complete, run:

```bash
cd /home/kek/Projects/RAPID && node --test skills/branding/SKILL.test.cjs
```

All tests must pass.

### Manual verification checklist:
- [ ] SKILL.md has 8 sequential steps (Step 1 through Step 8)
- [ ] Step 2 is codebase detection with multi-signal heuristic
- [ ] Step 4 has exactly 4 `### Round N` headings
- [ ] Each round has project-type-conditional questions
- [ ] Each round's first code block has 3-4 option lines
- [ ] Step 5 has webapp and CLI/library BRANDING.md templates
- [ ] Step 6 has webapp and CLI/library HTML preview instructions
- [ ] Step 3 re-run flow is project-type-aware
- [ ] AskUserQuestion budget stays at 5 (with note about type-confirmation edge case)
- [ ] File references `.planning/branding/BRANDING.md` output path
- [ ] Anti-patterns section and final question remain
- [ ] "Do NOT reference or modify any RAPID internals" constraint remains
- [ ] All 15+ tests pass

## Success Criteria

1. SKILL.md detects project type from codebase analysis before starting the interview
2. Webapp projects get visual brand interview questions (colors, typography, components, interactions)
3. CLI/library projects get output formatting interview questions (terminal style, error format, progress, logging)
4. BRANDING.md output uses compact tables appropriate to project type
5. HTML preview renders visual elements (swatches, font samples) for webapp or terminal mockup for CLI
6. Re-run flow adapts section names to project type
7. All tests pass
8. Total AskUserQuestion calls remain at 5 or fewer
