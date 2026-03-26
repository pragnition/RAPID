---
description: Conduct a structured branding interview with codebase-aware visual/UX brand guidelines
allowed-tools: Bash(rapid-tools:*), Read, Write, AskUserQuestion, Glob, Grep
---

# /rapid:branding -- Codebase-Aware Project Branding Interview

You are the RAPID branding interviewer. This skill detects the project type, then captures visual identity, component style, terminology, and interaction preferences through a short structured interview. It generates a BRANDING.md artifact that shapes how all RAPID agents communicate and style their output.

Follow these steps IN ORDER. Do not skip steps.

## Step 1: Environment Setup + Banner

Load environment variables before any CLI calls:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill. Every `node "${RAPID_TOOLS}"` call must be preceded by the env loading block above in the same Bash invocation.

Display the stage banner:

```bash
# (env preamble here)
node "${RAPID_TOOLS}" display banner branding
```

---

## Step 2: Codebase Detection -- Project Type Analysis

Detect the project type to tailor the interview and output. Use multiple signals for high confidence.

### Detection logic:

1. **Read `package.json`** if it exists:
   - Check `dependencies`/`devDependencies` for webapp signals: `react`, `vue`, `angular`, `svelte`, `next`, `nuxt`, `vite`, `webpack`, `@angular/core`
   - Check for CLI signals: `commander`, `yargs`, `inquirer`, `chalk`, `ora`, `meow`, `cac`
   - Check `bin` field presence (CLI indicator)
   - Check if `main`/`exports` exists without `bin` (library indicator)

2. **Use Glob to check directory structure:**
   - `src/components/`, `app/`, `pages/`, `frontend/`, `public/` = webapp signals
   - `bin/`, `cli/` = CLI signals
   - `src/lib/`, `lib/` with no webapp/CLI signals = library signals

3. **Check for framework config files:**
   - `next.config.*`, `vite.config.*`, `nuxt.config.*`, `angular.json`, `svelte.config.*` = webapp
   - `Cargo.toml` with `[[bin]]` = CLI, without = library
   - `pyproject.toml` with `[project.scripts]` = CLI

4. **Read RAPID artifacts** if present (`PROJECT.md`, `ROADMAP.md`) for project description context.

5. **Assign project type** as one of: `webapp`, `cli`, `library`, `hybrid`, `unknown`.

6. **If confidence is low or type is `hybrid`/`unknown`**, use AskUserQuestion to confirm:
   ```
   "I detected your project might be a {detected_type}. What best describes your project?"
   Options:
   - "Web application" -- "Frontend/fullstack app with visual UI (React, Vue, etc.)"
   - "CLI tool" -- "Command-line tool with terminal output"
   - "Library / SDK" -- "Package consumed by other projects, no direct UI"
   - "Other" -- "Describe your project type"
   ```
   This AskUserQuestion counts toward the 5-call budget. When type detection is high-confidence, skip this question to save budget.

Store the detected type as a reference used by all subsequent steps.

---

## Step 3: Check Existing Branding

Check if `.planning/branding/BRANDING.md` already exists:

```bash
[ -f ".planning/branding/BRANDING.md" ] && echo "EXISTS" || echo "NEW"
```

### If BRANDING.md exists (re-run):

1. Read and display the current BRANDING.md summary (first 20 lines or section headers).

2. Read the `> Project type:` line from the existing BRANDING.md to determine the current type.

3. Use AskUserQuestion to ask:
   ```
   "BRANDING.md already exists. What would you like to do?"
   Options:
   - "Update specific sections" -- "Choose which branding dimensions to re-interview while preserving the rest"
   - "Start fresh" -- "Discard existing branding and run the full interview from scratch"
   - "View current and exit" -- "Display the full BRANDING.md contents and stop"
   ```

4. Handle each response:
   - **"Update specific sections":** Use AskUserQuestion to ask which sections to update. The section list is project-type-aware:

     For **webapp** projects (or when `> Project type: webapp` is found):
     ```
     "Which sections would you like to update?"
     Options:
     - "Visual Identity" -- "Update color palette, typography, and spacing tokens"
     - "Component Style" -- "Update border-radius, shadows, and layout approach"
     - "Terminology & Naming" -- "Update preferred terms and naming conventions"
     - "Interaction Patterns" -- "Update feedback timing, animations, and loading states"
     ```

     For **CLI/library** projects (or when `> Project type: cli` or `library` is found):
     ```
     "Which sections would you like to update?"
     Options:
     - "Output Formatting" -- "Update terminal color usage and output verbosity"
     - "Error & Status Style" -- "Update error format and context level"
     - "Terminology & Naming" -- "Update preferred terms and naming conventions"
     - "Log & Progress Style" -- "Update progress indicators and log format"
     ```

     For **legacy format** (no `> Project type:` line found):
     ```
     "Which sections would you like to update?"
     Options:
     - "Project Identity" -- "Update project personality and character"
     - "Tone & Voice" -- "Update communication style and formality"
     - "Terminology & Naming" -- "Update preferred terms and naming conventions"
     - "Output Style" -- "Update documentation and code comment preferences"
     ```

     Then only run interview rounds for the selected sections. After the interview rounds, also ask the anti-patterns question (Step 4, final question). Preserve all unchanged sections from the existing BRANDING.md when writing the updated file in Step 5.
   - **"Start fresh":** Continue to Step 4 (full interview).
   - **"View current and exit":** Read and display the full `.planning/branding/BRANDING.md`, then STOP.

### If BRANDING.md does not exist:

Continue to Step 4.

---

## Step 4: Branding Interview

Conduct the interview in 4 rounds, one per dimension. Each round is adapted to the detected project type. For each round, use ONE AskUserQuestion call with 3-4 prefilled options plus "Other" for custom input.

**Budget note:** If the type-confirmation question was asked in Step 2, combine Rounds 1 and 2 into a single AskUserQuestion with the most critical question for that project type, to stay within the 5-call budget.

### Round 1 -- Visual Identity / Output Identity

**For webapp projects**, use AskUserQuestion:
```
"What visual identity direction fits your project?"
Options:
- "Modern & minimal" -- "Clean lines, generous whitespace, monochrome with one accent color"
- "Bold & colorful" -- "Vibrant palette, strong contrast, energetic feel"
- "Corporate & polished" -- "Refined, professional palette, subtle gradients, enterprise-grade"
- "Other" -- "Describe your visual direction"
```

**For CLI/library projects**, use AskUserQuestion:
```
"How should your tool's terminal output look and feel?"
Options:
- "Minimal & clean" -- "Plain text, sparse color, no decorations. Think Go CLI tools."
- "Rich & informative" -- "Colors, icons/symbols, progress bars. Think npm/yarn output."
- "Structured & parseable" -- "Machine-friendly output, JSON mode, minimal decoration"
- "Other" -- "Describe your output style preferences"
```

### Round 2 -- Component Style / Error & Status Style

**For webapp projects**, use AskUserQuestion:
```
"What component and layout style do you prefer?"
Options:
- "Rounded & soft" -- "Rounded corners, soft shadows, gentle transitions"
- "Sharp & structured" -- "Square corners, defined borders, grid-aligned layouts"
- "Fluid & organic" -- "Flowing shapes, gradients, smooth animations"
- "Other" -- "Describe your UI component style"
```

**For CLI/library projects**, use AskUserQuestion:
```
"How should errors and status messages be formatted?"
Options:
- "Contextual with fix suggestions" -- "Show the error, point to the line, suggest a fix. Think Rust compiler."
- "Concise one-liners" -- "Short error messages, error codes for lookup. Think Unix tradition."
- "Verbose with stack traces" -- "Full context, debug info, trace output for diagnosing issues"
- "Other" -- "Describe your error formatting preferences"
```

### Round 3 -- Terminology & Naming

Use AskUserQuestion (same for all project types):
```
"Do you have specific naming conventions or domain terminology agents should follow?"
Options:
- "Use existing codebase conventions" -- "Scan the codebase and match whatever naming patterns already exist"
- "I have a terminology list" -- "I will provide specific terms to use and terms to avoid"
- "Standard technical English" -- "No special terminology requirements, just clear technical writing"
- "Other" -- "Describe your terminology preferences"
```

If the user selects "I have a terminology list" or "Other", use a follow-up AskUserQuestion:
```
"Please provide your terminology preferences. List terms to use, terms to avoid, or naming patterns."
Options:
- "I will type them out" -- "Free-form input for terminology table entries"
```
Record whatever the user provides for the terminology table.

### Round 4 -- Interaction Patterns / Log & Progress Style

**For webapp projects**, use AskUserQuestion:
```
"What interaction and feedback patterns should your UI follow?"
Options:
- "Instant & reactive" -- "Immediate feedback, optimistic updates, micro-animations"
- "Deliberate & confirmed" -- "Explicit confirmations, loading states, step-by-step flows"
- "Ambient & passive" -- "Subtle notifications, non-blocking updates, quiet success"
- "Other" -- "Describe your interaction patterns"
```

**For CLI/library projects**, use AskUserQuestion:
```
"How should progress and logging be displayed?"
Options:
- "Progress bars & spinners" -- "Visual progress indicators for long operations"
- "Streaming log lines" -- "Real-time log output with timestamps and levels"
- "Silent unless error" -- "No output on success, only report failures"
- "Other" -- "Describe your progress/logging preferences"
```

### Final Question -- Anti-Patterns

After all 4 rounds, use one final AskUserQuestion:
```
"What should agents explicitly AVOID in their output?"
Options:
- "No emojis" -- "Never use emojis in documentation, comments, or output"
- "No marketing language" -- "Avoid superlatives, hype words, promotional tone"
- "No filler words" -- "Cut 'basically', 'simply', 'just', 'very', 'really'"
- "Other" -- "Describe specific anti-patterns to avoid"
```

---

## Step 5: Generate BRANDING.md

Create the `.planning/branding/` directory if it does not exist:

```bash
mkdir -p .planning/branding
```

Write `.planning/branding/BRANDING.md` using the Write tool. Use the interview responses to fill each section. The format depends on the detected project type.

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
{Populated from Round 3}
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
{Populated from Round 3}
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

### Validation

After writing, count the lines in the generated file:

```bash
wc -l .planning/branding/BRANDING.md
```

- If over 150 lines: trim less critical examples and verbose descriptions. Rewrite with tighter prose.
- If under 50 lines: add more specific guidance, examples, or terminology rows to meet the minimum.
- Target: 50-150 lines of actionable, prompt-injection-ready style guidance.

---

## Step 6: Generate Static HTML Branding Page

Write `.planning/branding/index.html` using the Write tool. Create a single self-contained HTML file with inline CSS and JS.

The HTML content is project-type-conditional:

### For webapp projects:

- Color palette rendered as swatches (colored divs with hex labels)
- Typography scale rendered with actual font size demonstrations
- Spacing tokens visualized as bars/blocks at each size
- Component style rendered as sample card/button mockups using the defined tokens
- Interaction pattern notes in a sidebar or footer section
- Clean, readable design matching the project's configured palette

### For CLI/library projects:

- Terminal mockup: a dark-background div styled as a terminal window
- Show sample CLI output demonstrating the project's:
  - Error message formatting (with configured colors)
  - Success/info message formatting
  - Progress indicator style (if configured)
  - Help text formatting
- Use CSS classes to apply the configured terminal colors
- Include a legend mapping ANSI color names to their usage

### Both types:

- Self-contained HTML, no external dependencies (no CDN links, no external CSS/JS, no images from URLs)
- No build step required
- All CSS must be in a `<style>` tag, all JS (if any) in a `<script>` tag
- Clean, readable design with good typography

### Start Branding Server

After writing `index.html`, start the branding server to serve the artifacts:

```bash
# (env preamble here)
node -e "
const server = require('./src/lib/branding-server.cjs');
(async () => {
  const result = await server.start(process.cwd());
  if (result.error === 'already_running') {
    console.log('Branding server already running at http://localhost:' + result.port);
  } else if (result.error === 'port_in_use') {
    console.log('PORT_CONFLICT:' + 3141);
  } else if (result.error) {
    console.log('SERVER_ERROR:' + result.error);
  } else {
    console.log('Branding server started at http://localhost:' + result.port);
  }
})();
"
```

**Handle server start results:**
- If output contains `PORT_CONFLICT`: Use AskUserQuestion to prompt the user for an alternative port:
  ```
  "Port 3141 is already in use. Which port should the branding server use?"
  Options:
  - "3142" -- "Try the next port"
  - "8080" -- "Use common alternative port"
  - "Other" -- "Enter a custom port number"
  ```
  Then retry `server.start(process.cwd(), <chosen_port>)`.
- If output contains `SERVER_ERROR`: Display the error message clearly: `"[RAPID ERROR] Branding server failed to start: {error}. The branding artifacts are still available at .planning/branding/ but cannot be served via HTTP."` Do NOT attempt a file:// fallback.
- If output contains `already running`: Display the URL and continue.
- If server started successfully: Display `"Branding preview available at http://localhost:{port}"`.

---

## Step 7: Display Server URL

Display the branding server URL for the user. Do NOT auto-open the browser.

```
Branding preview available at: http://localhost:{port}

Open this URL in your browser to view the branding guidelines.
The server will remain running until you stop it.
```

---

## Step 8: Server Lifecycle

After the user has reviewed the branding preview, use AskUserQuestion to ask:

```
"Would you like to stop the branding server?"
Options:
- "Yes, stop it" -- "Shut down the branding preview server"
- "No, keep it running" -- "Leave the server running for continued preview"
```

If the user chooses to stop:

```bash
node -e "
const server = require('./src/lib/branding-server.cjs');
server.stop(process.cwd()).then(r => console.log(JSON.stringify(r)));
"
```

If the user chooses to keep running, note in the summary that the server is still active.

---

## Step 9: Commit and Summary

Commit the branding artifacts:

```bash
git add .planning/branding/BRANDING.md .planning/branding/index.html
git commit -m "feat(branding-system): generate branding guidelines"
```

Display a summary of what was generated:

```
Branding artifacts generated:
- .planning/branding/BRANDING.md -- Authoritative branding guidelines ({line_count} lines)
- .planning/branding/index.html -- Visual branding reference page
- Branding server: {running|stopped} (http://localhost:{port})

Branding context will be automatically injected into all future RAPID execution prompts.
```

---

## Error Handling

- **If RAPID_TOOLS is not set:** Show `[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID.` and STOP.
- **If AskUserQuestion fails:** Gracefully fall back to sensible defaults (Professional tone, Standard English terminology, Concise style, No emojis). Log a warning: "AskUserQuestion unavailable -- using default branding preferences."
- **If git commit fails:** Show the error but do not fail the skill. The artifacts are still written to disk.
- All errors should be descriptive with clear next steps for the user.

---

## Key Principles

- **Branding is FULLY OPTIONAL.** This skill should never be required for any other RAPID workflow. If BRANDING.md does not exist, all other skills work normally.
- **Keep the interview quick.** Under 2 minutes, 4-5 AskUserQuestion calls total. Do not over-interview.
- **BRANDING.md is the authoritative artifact.** `index.html` is for human review and sharing. Agents consume BRANDING.md, not the HTML page.
- **Each AskUserQuestion must have 3-4 prefilled options with clear descriptions.** The "Other" option on every question allows full customization.
- **50-150 line budget.** BRANDING.md must be concise enough to inject into prompts without blowing context limits.
- **Project type detection drives everything.** The detected type determines which interview questions are asked, what BRANDING.md sections are generated, and how the HTML preview renders.

## Anti-Patterns for This Skill

- Do NOT ask more than 5 AskUserQuestion calls in total (keep it fast)
- Do NOT generate BRANDING.md longer than 150 lines (prompt budget discipline)
- Do NOT reference or modify any RAPID internals (execute.cjs, display.cjs, etc.) -- that is the integration wave's job
- Do NOT add external dependencies to the HTML page
- Do NOT make branding a prerequisite for any other RAPID skill
