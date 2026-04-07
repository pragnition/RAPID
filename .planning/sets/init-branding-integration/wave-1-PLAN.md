# Wave 1 PLAN: init-branding-integration

## Objective

Insert the complete Step 4B.5 branding opt-in gate and inline branding interview into `skills/init/SKILL.md`. This wave covers:
- Updating CONTRACT.json question-budget to match CONTEXT.md decision (max 7)
- The opt-in question with clear section break presentation
- The skip path (zero side effects, immediate exit)
- Re-init detection (existing BRANDING.md) with overwrite choice
- Full 5-question branding interview (4 rounds + anti-patterns) adapted to project type
- Mid-interview bail-out logic (discard partial, continue as skipped)
- Pre-scaffolding `mkdir -p .planning/branding/` before writing
- BRANDING.md generation using the same webapp/CLI templates from `skills/branding/SKILL.md`
- index.html generation (self-contained, project-type-conditional)
- Branding artifact registration (with graceful failure)

This is the bulk of the implementation -- the new `### 4B.5` section that inserts between the end of the project brief compilation (line 440 of init SKILL.md) and `### 4C: Granularity Preference` (line 442).

## Owned Files

| File | Action |
|------|--------|
| `skills/init/SKILL.md` | Modify -- insert new `### 4B.5` section between lines 440 and 442 |
| `.planning/sets/init-branding-integration/CONTRACT.json` | Modify -- update question-budget description |

## Task 1: Update CONTRACT.json question-budget

**File:** `.planning/sets/init-branding-integration/CONTRACT.json`

**Action:** Change the `question-budget` behavioral invariant description from:
```
"Branding during init uses at most 1 opt-in + 2-3 interview questions (max 4 total AskUserQuestion calls)"
```
to:
```
"Branding during init uses at most 1 opt-in + 1 possible re-init check + 5 interview questions (max 7 total AskUserQuestion calls)"
```

This aligns CONTRACT.json with the user's final decision in CONTEXT.md, which explicitly said "Update CONTRACT question-budget from max 4 to max 7 calls."

**Verification:**
```bash
grep -o "max 7" .planning/sets/init-branding-integration/CONTRACT.json && echo "PASS" || echo "FAIL"
```

## Task 2: Insert Step 4B.5 section in init SKILL.md

**File:** `skills/init/SKILL.md`

**Insertion point:** Between the line `Store the first sentence of "Vision" as the short project description for CLI commands that require '--description'.` (line 440) and `### 4C: Granularity Preference` (line 442).

**Action:** Insert a new markdown section `### 4B.5: Optional Branding Step (Skip by Default)` containing the complete branding integration flow. The section must follow the structure below. All content below is the specification for what to write -- the executor should render it as proper markdown skill instructions matching the voice and formatting conventions of the surrounding init SKILL.md content.

### Section Structure

The inserted section has these subsections, in order:

#### 1. Section header and clear section break

Begin with a visual separator and framing that makes the optional nature obvious:

```markdown
### 4B.5: Optional Branding Step (Skip by Default)

---

**[OPTIONAL STEP]** -- This step is entirely optional and skippable. It does not affect the init flow. Users who skip will get the same project output. Branding can always be configured later via `/rapid:branding`.

---
```

#### 2. Re-init detection

Before asking the opt-in question, check whether `.planning/branding/BRANDING.md` already exists:

```bash
[ -f ".planning/branding/BRANDING.md" ] && echo "EXISTS" || echo "NEW"
```

If `EXISTS`, use AskUserQuestion with:
- question: "Existing project branding found. Would you like to keep it or set up new branding?"
- Options:
  - "Keep existing branding" -- "Preserve current BRANDING.md and continue to granularity preferences"
  - "Set up new branding" -- "Replace existing branding with a fresh interview"

If "Keep existing branding": skip this entire step (go to Step 4C). Set `brandingStatus = "configured (preserved)"`.
If "Set up new branding": continue to the opt-in question below (which the user will presumably accept).
If `NEW`: continue to the opt-in question below.

This AskUserQuestion counts toward the 7-call budget (1 of max 7).

#### 3. Opt-in question

Use AskUserQuestion with:
- question: "Would you like to set up project branding guidelines now? This configures visual identity, terminology, and interaction patterns that agents will follow throughout development."
- Options:
  - "Skip branding" -- "Continue without branding. You can always run /rapid:branding later."
  - "Set up branding" -- "Answer 5 quick questions to configure branding guidelines (~2 minutes)."

If "Skip branding": skip the rest of this step entirely. Set `brandingStatus = "skipped"`. Go to Step 4C. Zero files created, zero directories created, zero state changes.

If "Set up branding": continue to the branding interview below.

This AskUserQuestion counts toward the 7-call budget (1 of max 7; or 2 if re-init check was also asked).

#### 4. Project type inference

Infer the project type from the discovery answers already collected in Step 4B. Do NOT use a separate AskUserQuestion -- this is zero-cost inference.

Rules:
- If the Tech Stack Preferences or Key Features mention React, Next.js, Vue, Angular, Svelte, frontend, web app, dashboard, SPA, or similar web frameworks: `projectType = "webapp"`
- If the Tech Stack Preferences or Key Features mention CLI, command-line, terminal, Go, Rust (with binary output), shell tool, or similar: `projectType = "cli"`
- If the Tech Stack Preferences or Key Features mention library, SDK, package, npm module, pip package, or similar: `projectType = "library"`
- If ambiguous or hybrid: default to `projectType = "webapp"`

Store `projectType` for use in the interview questions and artifact generation below.

#### 5. Branding interview (5 questions)

Conduct the full 4-round branding interview plus the anti-patterns question. Each round uses ONE AskUserQuestion call with project-type-adaptive options.

**Important: Mid-interview bail-out.** Every AskUserQuestion in this interview MUST include an additional option:
- "Skip remaining" -- "Stop branding setup and continue init without branding guidelines"

If the user selects "Skip remaining" at any point: discard ALL partial interview answers collected so far. Do NOT write any branding files. Set `brandingStatus = "skipped"`. Go to Step 4C.

**Round 1 -- Visual Identity / Output Identity:**

For `webapp` projects, use AskUserQuestion:
```
"What visual identity direction fits your project?"
Options:
- "Modern & minimal" -- "Clean lines, generous whitespace, monochrome with one accent color"
- "Bold & colorful" -- "Vibrant palette, strong contrast, energetic feel"
- "Corporate & polished" -- "Refined, professional palette, subtle gradients, enterprise-grade"
- "Other" -- "Describe your visual direction"
- "Skip remaining" -- "Stop branding setup and continue init without branding guidelines"
```

For `cli` or `library` projects, use AskUserQuestion:
```
"How should your tool's terminal output look and feel?"
Options:
- "Minimal & clean" -- "Plain text, sparse color, no decorations. Think Go CLI tools."
- "Rich & informative" -- "Colors, icons/symbols, progress bars. Think npm/yarn output."
- "Structured & parseable" -- "Machine-friendly output, JSON mode, minimal decoration"
- "Other" -- "Describe your output style preferences"
- "Skip remaining" -- "Stop branding setup and continue init without branding guidelines"
```

**Round 2 -- Component Style / Error & Status Style:**

For `webapp` projects, use AskUserQuestion:
```
"What component and layout style do you prefer?"
Options:
- "Rounded & soft" -- "Rounded corners, soft shadows, gentle transitions"
- "Sharp & structured" -- "Square corners, defined borders, grid-aligned layouts"
- "Fluid & organic" -- "Flowing shapes, gradients, smooth animations"
- "Other" -- "Describe your UI component style"
- "Skip remaining" -- "Stop branding setup and continue init without branding guidelines"
```

For `cli` or `library` projects, use AskUserQuestion:
```
"How should errors and status messages be formatted?"
Options:
- "Contextual with fix suggestions" -- "Show the error, point to the line, suggest a fix. Think Rust compiler."
- "Concise one-liners" -- "Short error messages, error codes for lookup. Think Unix tradition."
- "Verbose with stack traces" -- "Full context, debug info, trace output for diagnosing issues"
- "Other" -- "Describe your error formatting preferences"
- "Skip remaining" -- "Stop branding setup and continue init without branding guidelines"
```

**Round 3 -- Terminology & Naming:**

Same for all project types. Use AskUserQuestion:
```
"Do you have specific naming conventions or domain terminology agents should follow?"
Options:
- "Use existing codebase conventions" -- "Scan the codebase and match whatever naming patterns already exist"
- "I have a terminology list" -- "I will provide specific terms to use and terms to avoid"
- "Standard technical English" -- "No special terminology requirements, just clear technical writing"
- "Other" -- "Describe your terminology preferences"
- "Skip remaining" -- "Stop branding setup and continue init without branding guidelines"
```

If the user selects "I have a terminology list" or "Other", use a follow-up AskUserQuestion:
```
"Please provide your terminology preferences. List terms to use, terms to avoid, or naming patterns."
Options:
- "I will type them out" -- "Free-form input for terminology table entries"
```
This follow-up does NOT count as a separate round -- it is part of Round 3. Record whatever the user provides for the terminology table. (Note: this follow-up does NOT include a "Skip remaining" option since the user has already committed to providing terminology.)

**Round 4 -- Interaction Patterns / Log & Progress Style:**

For `webapp` projects, use AskUserQuestion:
```
"What interaction and feedback patterns should your UI follow?"
Options:
- "Instant & reactive" -- "Immediate feedback, optimistic updates, micro-animations"
- "Deliberate & confirmed" -- "Explicit confirmations, loading states, step-by-step flows"
- "Ambient & passive" -- "Subtle notifications, non-blocking updates, quiet success"
- "Other" -- "Describe your interaction patterns"
- "Skip remaining" -- "Stop branding setup and continue init without branding guidelines"
```

For `cli` or `library` projects, use AskUserQuestion:
```
"How should progress and logging be displayed?"
Options:
- "Progress bars & spinners" -- "Visual progress indicators for long operations"
- "Streaming log lines" -- "Real-time log output with timestamps and levels"
- "Silent unless error" -- "No output on success, only report failures"
- "Other" -- "Describe your progress/logging preferences"
- "Skip remaining" -- "Stop branding setup and continue init without branding guidelines"
```

**Round 5 -- Anti-Patterns (final question):**

Same for all project types. Use AskUserQuestion:
```
"What should agents explicitly AVOID in their output?"
Options:
- "No emojis" -- "Never use emojis in documentation, comments, or output"
- "No marketing language" -- "Avoid superlatives, hype words, promotional tone"
- "No filler words" -- "Cut 'basically', 'simply', 'just', 'very', 'really'"
- "Other" -- "Describe specific anti-patterns to avoid"
- "Skip remaining" -- "Stop branding setup and continue init without branding guidelines"
```

(Note: The anti-patterns question does not need "Skip remaining" since it is the final question, but include it for consistency -- if selected here, it means the user wants to discard everything including the 4 rounds already answered.)

#### 6. Pre-scaffolding directory creation

After the interview completes successfully (all 5 rounds answered, no bail-out), create the branding directory:

```bash
mkdir -p .planning/branding
```

This runs BEFORE writing any files. The `.planning/` directory and `.planning/branding/` subdirectory are created eagerly. This is safe even if Step 5 scaffold runs later -- `mkdir -p` is idempotent.

#### 7. Generate BRANDING.md

Write `.planning/branding/BRANDING.md` using the Write tool. Use the interview responses to fill each section. The format depends on the detected project type.

**For webapp projects, use this format:**

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
{Populated from Round 3}
</terminology>

<interaction-patterns>
## Interaction Patterns
{Synthesize Round 4 response: feedback timing, animation approach, notification style, loading state design}
</interaction-patterns>

<anti-patterns>
## Anti-Patterns (Do NOT)
- {From Round 5}
</anti-patterns>
```

**For cli or library projects, use this format:**

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
{Populated from Round 3}
</terminology>

<log-style>
## Log & Progress Style
{Synthesize Round 4 response: progress indicator type, log format, verbosity levels, silent mode}
</log-style>

<anti-patterns>
## Anti-Patterns (Do NOT)
- {From Round 5}
</anti-patterns>
```

**Validation:** After writing, count the lines:
```bash
wc -l .planning/branding/BRANDING.md
```
- If over 150 lines: trim verbose descriptions. Target: 50-150 lines.
- If under 50 lines: add more specific guidance.

**Register the artifact:**
```bash
node -e "
const artifacts = require('./src/lib/branding-artifacts.cjs');
const result = artifacts.createArtifact(process.cwd(), {
  type: 'theme',
  filename: 'BRANDING.md',
  description: 'Project branding guidelines and style tokens'
});
console.log('Registered artifact:', result.id);
"
```
If registration fails, display: `"[WARN] Could not register BRANDING.md artifact. Continuing."` and proceed.

#### 8. Generate index.html

Write `.planning/branding/index.html` using the Write tool. Create a single self-contained HTML file with inline CSS and JS. No external dependencies (no CDN links, no external CSS/JS, no images from URLs). No build step required.

**For webapp projects:**
- Color palette rendered as swatches (colored divs with hex labels)
- Typography scale rendered with actual font size demonstrations
- Spacing tokens visualized as bars/blocks at each size
- Component style rendered as sample card/button mockups using the defined tokens
- Interaction pattern notes in a sidebar or footer section
- Clean, readable design matching the project's configured palette

**For cli/library projects:**
- Terminal mockup: a dark-background div styled as a terminal window
- Show sample CLI output demonstrating the project's error message formatting (with configured colors), success/info message formatting, progress indicator style (if configured), help text formatting
- Use CSS classes to apply the configured terminal colors
- Include a legend mapping ANSI color names to their usage

**Register the artifact:**
```bash
node -e "
const artifacts = require('./src/lib/branding-artifacts.cjs');
const result = artifacts.createArtifact(process.cwd(), {
  type: 'preview',
  filename: 'index.html',
  description: 'Visual branding reference page'
});
console.log('Registered artifact:', result.id);
"
```
If registration fails, display: `"[WARN] Could not register index.html artifact. Continuing."` and proceed.

**CRITICAL: Do NOT start the branding server.** The `no-server-during-init` contract invariant means there must be zero references to `branding-server.cjs` or `server.start()` anywhere in this step. The index.html is generated as a static file only.

#### 9. Set branding status

After successful artifact generation, set `brandingStatus = "configured"`.

Display a brief confirmation:
```
Branding configured. Files written to .planning/branding/
  - BRANDING.md (style guidelines)
  - index.html (visual reference)
```

Then continue to Step 4C.

### End of section specification

The entire section (from the `### 4B.5` header through the confirmation display) should be approximately 135-165 lines of markdown when rendered in the SKILL.md file.

## What NOT To Do

- Do NOT reference `branding-server.cjs` or `server.start()` anywhere in the inserted section. The `no-server-during-init` contract invariant is critical.
- Do NOT generate `logo.svg` or `wireframe.html` -- only BRANDING.md and index.html are produced during init.
- Do NOT add a separate project-type detection AskUserQuestion -- the type is inferred from Step 4B discovery answers at zero cost.
- Do NOT write partial BRANDING.md on mid-interview bail-out. If the user bails, ALL partial data is discarded.
- Do NOT create `.planning/branding/` directory if the user skips branding. The skip path must have zero side effects.
- Do NOT modify any lines before the insertion point or after `### 4C`. The surrounding code must remain untouched.

## Success Criteria

1. CONTRACT.json `question-budget` updated to reference "max 7"
2. `skills/init/SKILL.md` contains a new `### 4B.5: Optional Branding Step` section between the project brief compilation and `### 4C: Granularity Preference`
3. The section includes: re-init detection, opt-in gate, project-type inference, 5 interview rounds, bail-out logic, directory creation, BRANDING.md generation, index.html generation, artifact registration
4. The skip path has zero side effects (no directory creation, no file writes, no state changes)
5. No references to branding server anywhere in the new section
6. The `brandingStatus` variable is set to one of: `"configured"`, `"configured (preserved)"`, `"skipped"`

## Verification

```bash
# Check CONTRACT.json updated
grep "max 7" .planning/sets/init-branding-integration/CONTRACT.json

# Check section exists
grep "### 4B.5" skills/init/SKILL.md

# Check no server references in the new section
grep -c "branding-server\|server\.start" skills/init/SKILL.md
# Expected: 0 (or same count as before -- the new section adds zero server references)

# Check skip path language
grep "Skip branding" skills/init/SKILL.md

# Check bail-out option
grep "Skip remaining" skills/init/SKILL.md

# Check artifact generation (BRANDING.md and index.html only)
grep "BRANDING.md" skills/init/SKILL.md | grep -v "logo\|wireframe"
grep "index.html" skills/init/SKILL.md

# Check no logo/wireframe generation
grep -c "logo.svg\|wireframe.html" skills/init/SKILL.md
# Expected: 0 new occurrences in the 4B.5 section

# Check brandingStatus variable
grep "brandingStatus" skills/init/SKILL.md
```
