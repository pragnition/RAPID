---
description: Conduct a structured branding interview with codebase-aware visual/UX brand guidelines, artifact gallery, and live-reloading webserver
allowed-tools: Bash(rapid-tools:*), Read, Write, Glob, Grep
args: []
categories: [interactive]
---


## Dual-Mode Operation Reference

This skill supports both Claude Code CLI mode and the SDK web bridge. Every interactive prompt
follows the dual-mode pattern shown below; each call site wraps its own `if/else/fi` block.

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode: use the built-in tool exactly as before.
  # Use AskUserQuestion with the question/options below.
fi
```


# /rapid:branding -- Codebase-Aware Project Branding Interview

You are the RAPID branding interviewer. This skill detects the project type, then captures visual identity, component style, terminology, and interaction preferences through a structured interview. It generates a BRANDING.md artifact that shapes how all RAPID agents communicate and style their output, along with optional expanded assets (guidelines, README template, component library) all browseable from a hub gallery.

**Dual-mode operation:** Every interactive prompt below checks `$RAPID_RUN_MODE`. When `RAPID_RUN_MODE=sdk`, the prompt is routed through the web bridge; otherwise the built-in tool is used. The if/else branches at each call site (and inline annotations on narrative mentions) make both modes explicit.

Follow these steps IN ORDER. Do not skip steps.

## Operating Modes

This skill supports two operating modes:

**Standalone mode** (default): The full branding experience. Runs banner, interview, artifact generation, server startup, commit, and footer. This is what happens when a user runs `/rapid:branding` directly.

**Delegated mode**: When invoked from `/rapid:init`. In delegated mode, the skill MUST skip: banner display (Step 1), git commit (Step 10), and footer display (Step 10). Everything else runs normally, including the server. The calling code (init) passes `mode=delegated` context.

---

## Step 1: Environment Setup + Banner

Load environment variables before any CLI calls:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill. Every `node "${RAPID_TOOLS}"` call must be preceded by the env loading block above in the same Bash invocation.

Display the stage banner (**skip in delegated mode**):

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

6. **If confidence is low or type is `hybrid`/`unknown`**, confirm the type:
   ```
   if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
     # SDK mode: route through the web bridge.
     # Call mcp__rapid__webui_ask_user with:
     #   question: "I detected your project might be a {detected_type}. What best describes your project?"
     #   options: ["Web application", "CLI tool", "Library / SDK", ...]
     #   allow_free_text: false
     # Wait for the answer.
   else
     # CLI mode: use the built-in tool exactly as before. Use AskUserQuestion to confirm with the prose below.
   fi
   ```
   ```
   "I detected your project might be a {detected_type}. What best describes your project?"
   Options:
   - "Web application" -- "Frontend/fullstack app with visual UI (React, Vue, etc.)"
   - "CLI tool" -- "Command-line tool with terminal output"
   - "Library / SDK" -- "Package consumed by other projects, no direct UI"
   - "Other" -- "Describe your project type"
   ```
   When type detection is high-confidence, skip this question.

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

3. Ask the user:
   ```
   if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
     # SDK mode: route through the web bridge.
     # Call mcp__rapid__webui_ask_user with:
     #   question: "BRANDING.md already exists. What would you like to do?"
     #   options: ["Update specific sections", "Start fresh", "View current and exit"]
     #   allow_free_text: false
   else
     # CLI mode: Use AskUserQuestion with the prose below.
   fi
   ```
   ```
   "BRANDING.md already exists. What would you like to do?"
   Options:
   - "Update specific sections" -- "Choose which branding dimensions to re-interview while preserving the rest"
   - "Start fresh" -- "Discard existing branding and run the full interview from scratch"
   - "View current and exit" -- "Display the full BRANDING.md contents and stop"
   ```

4. Handle each response:
   - **"Update specific sections":** Ask which sections to update. The section list is project-type-aware:

     ```
     if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
       # SDK mode: route through the web bridge.
       # Call mcp__rapid__webui_ask_user with the project-type-aware section options below.
     else
       # CLI mode:
       # Use AskUserQuestion with the project-type-aware section options below.
     fi
     ```


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

Conduct the interview in 4 rounds, one per dimension. Each round is adapted to the detected project type. For each round issue ONE call with 3-4 prefilled options plus "Other" for custom input:

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: ONE mcp__rapid__webui_ask_user call per round.
else
  # CLI mode:
  # ONE AskUserQuestion call per round.
fi
```

### Round 1 -- Visual Identity / Output Identity

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
**For webapp projects**, use AskUserQuestion :
fi
```
```
"What visual identity direction fits your project?"
Options:
- "Modern & minimal" -- "Clean lines, generous whitespace, monochrome with one accent color"
- "Bold & colorful" -- "Vibrant palette, strong contrast, energetic feel"
- "Corporate & polished" -- "Refined, professional palette, subtle gradients, enterprise-grade"
- "Other" -- "Describe your visual direction"
```

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
**For CLI/library projects**, use AskUserQuestion :
fi
```
```
"How should your tool's terminal output look and feel?"
Options:
- "Minimal & clean" -- "Plain text, sparse color, no decorations. Think Go CLI tools."
- "Rich & informative" -- "Colors, icons/symbols, progress bars. Think npm/yarn output."
- "Structured & parseable" -- "Machine-friendly output, JSON mode, minimal decoration"
- "Other" -- "Describe your output style preferences"
```

### Round 2 -- Component Style / Error & Status Style

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
**For webapp projects**, use AskUserQuestion :
fi
```
```
"What component and layout style do you prefer?"
Options:
- "Rounded & soft" -- "Rounded corners, soft shadows, gentle transitions"
- "Sharp & structured" -- "Square corners, defined borders, grid-aligned layouts"
- "Fluid & organic" -- "Flowing shapes, gradients, smooth animations"
- "Other" -- "Describe your UI component style"
```

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
**For CLI/library projects**, use AskUserQuestion :
fi
```
```
"How should errors and status messages be formatted?"
Options:
- "Contextual with fix suggestions" -- "Show the error, point to the line, suggest a fix. Think Rust compiler."
- "Concise one-liners" -- "Short error messages, error codes for lookup. Think Unix tradition."
- "Verbose with stack traces" -- "Full context, debug info, trace output for diagnosing issues"
- "Other" -- "Describe your error formatting preferences"
```

### Round 3 -- Terminology & Naming

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below (same for all project types).
else
  # CLI mode:
  Use AskUserQuestion (same for all project types):
fi
```

```
"Do you have specific naming conventions or domain terminology agents should follow?"
Options:
- "Use existing codebase conventions" -- "Scan the codebase and match whatever naming patterns already exist"
- "I have a terminology list" -- "I will provide specific terms to use and terms to avoid"
- "Standard technical English" -- "No special terminology requirements, just clear technical writing"
- "Other" -- "Describe your terminology preferences"
```

If the user selects "I have a terminology list" or "Other", issue a follow-up prompt:

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: call mcp__rapid__webui_ask_user with the follow-up question/options below.
else
  # CLI mode:
  Use a follow-up AskUserQuestion.
fi
```

```
"Please provide your terminology preferences. List terms to use, terms to avoid, or naming patterns."
Options:
- "I will type them out" -- "Free-form input for terminology table entries"
```
Record whatever the user provides for the terminology table.

### Round 4 -- Interaction Patterns / Log & Progress Style

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
**For webapp projects**, use AskUserQuestion :
fi
```
```
"What interaction and feedback patterns should your UI follow?"
Options:
- "Instant & reactive" -- "Immediate feedback, optimistic updates, micro-animations"
- "Deliberate & confirmed" -- "Explicit confirmations, loading states, step-by-step flows"
- "Ambient & passive" -- "Subtle notifications, non-blocking updates, quiet success"
- "Other" -- "Describe your interaction patterns"
```

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
**For CLI/library projects**, use AskUserQuestion :
fi
```
```
"How should progress and logging be displayed?"
Options:
- "Progress bars & spinners" -- "Visual progress indicators for long operations"
- "Streaming log lines" -- "Real-time log output with timestamps and levels"
- "Silent unless error" -- "No output on success, only report failures"
- "Other" -- "Describe your progress/logging preferences"
```

### Final Question -- Anti-Patterns

After all 4 rounds, issue one final prompt:

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: call mcp__rapid__webui_ask_user with the anti-pattern question/options below.
else
  # CLI mode:
  Use one final AskUserQuestion.
fi
```

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

### Register Theme Artifact

After validation, register the BRANDING.md file as a branding artifact. If registration fails, log a warning but continue -- the branding file is still valid.

```bash
# (env preamble here)
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

If the command fails, display: `"[WARN] Could not register BRANDING.md artifact. Continuing."` and proceed to the next step.

---

## Step 6: Generate Logo Artifact

Generate a simple SVG logo for the project based on the branding interview responses. Write it to `.planning/branding/logo.svg` using the Write tool.

The SVG should:
- Be a simple, clean vector graphic (not complex -- this is a placeholder/starting point)
- Use the primary color from the branding guidelines
- Include the project name or initials
- Be viewBox-based for scalability (e.g., `viewBox="0 0 200 200"`)
- Be self-contained (no external references)

After writing the SVG file, register the artifact:

```bash
# (env preamble here)
node -e "
const artifacts = require('./src/lib/branding-artifacts.cjs');
const result = artifacts.createArtifact(process.cwd(), {
  type: 'logo',
  filename: 'logo.svg',
  description: 'Project logo (placeholder -- customize or replace)'
});
console.log('Registered artifact:', result.id);
"
```

If the command fails, display: `"[WARN] Could not register logo.svg artifact. Continuing."` and proceed to the next step.

---

## Step 7: Generate Wireframe Artifact

Generate a simple HTML wireframe that demonstrates the branding guidelines applied to a typical page layout. Write it to `.planning/branding/wireframe.html` using the Write tool.

The wireframe should:
- Be a single self-contained HTML file with inline CSS
- Show a representative page layout for the detected project type:
  - **webapp**: header, sidebar nav, main content area, card grid, footer
  - **cli**: terminal-style output mockup showing help text and sample command output
  - **library**: API documentation layout with code samples
- Apply the color palette, typography, and spacing tokens from BRANDING.md
- Include placeholder content that demonstrates the branding in context

After writing the wireframe, register the artifact:

```bash
# (env preamble here)
node -e "
const artifacts = require('./src/lib/branding-artifacts.cjs');
const result = artifacts.createArtifact(process.cwd(), {
  type: 'wireframe',
  filename: 'wireframe.html',
  description: 'Page layout wireframe demonstrating branding guidelines'
});
console.log('Registered artifact:', result.id);
"
```

If the command fails, display: `"[WARN] Could not register wireframe.html artifact. Continuing."` and proceed to the next step.

---

## Step 8: Expanded Asset Generation

After the wireframe is generated, present a multi-select prompt:

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
  Use AskUserQuestion with the question/options below.
fi
```

```
"Which additional branding assets would you like to generate?"
Options:
- "Guidelines page" -- "Comprehensive design system reference with usage rules, do/don't examples, copy-paste snippets, accessibility guidelines, and brand voice examples (guidelines.html)"
- "README template" -- "Branded README.md template applying your project's terminology and tone guidelines (readme-template.md)"
- "Component library" -- "Interactive HTML page with buttons, forms, cards using your branding tokens (components.html)"
- "All of the above" -- "Generate all three additional assets"
- "Skip" -- "Continue without additional assets"
```

For each selected asset type, generate the artifact and register it:

### Guidelines page (`guidelines.html`)

Write `.planning/branding/guidelines.html` using the Write tool.

The guidelines page should be a self-contained HTML file with inline CSS containing:
- **Design Tokens Reference**: All color, typography, and spacing tokens from BRANDING.md in a browseable format
- **Usage Rules**: Do/don't examples showing correct and incorrect usage of tokens
- **Copy-Paste Code Snippets**: CSS custom properties and utility classes ready to use
- **Accessibility Guidelines**: Contrast ratios, focus states, screen reader considerations
- **Brand Voice & Tone Examples**: Writing samples for documentation, error messages, and UI copy

Apply the project's branding tokens from BRANDING.md throughout the page.

Register after writing:

```bash
# (env preamble here)
node -e "
const artifacts = require('./src/lib/branding-artifacts.cjs');
const result = artifacts.createArtifact(process.cwd(), {
  type: 'guidelines',
  filename: 'guidelines.html',
  description: 'Comprehensive design system reference with usage rules and accessibility guidelines'
});
console.log('Registered artifact:', result.id);
"
```

### README template (`readme-template.md`)

Write `.planning/branding/readme-template.md` using the Write tool.

The README template should be a Markdown file containing:
- Placeholders for: project name, description, installation, usage, contributing, license
- Written in the project's terminology and tone from BRANDING.md
- Apply the anti-patterns list (e.g., if "no emojis" was selected, the template avoids emojis)
- Follow the detected project type conventions (webapp vs CLI vs library)

Register after writing:

```bash
# (env preamble here)
node -e "
const artifacts = require('./src/lib/branding-artifacts.cjs');
const result = artifacts.createArtifact(process.cwd(), {
  type: 'readme-template',
  filename: 'readme-template.md',
  description: 'Branded README.md template applying project terminology and tone guidelines'
});
console.log('Registered artifact:', result.id);
"
```

### Component library (`components.html`)

Write `.planning/branding/components.html` using the Write tool.

The component library should be a self-contained HTML file with inline CSS and JS containing:
- **Buttons**: primary, secondary, outline variants
- **Form inputs**: text, select, checkbox
- **Cards**: basic, with image placeholder, with action
- **Alert/notification components**: info, success, warning, error variants

All components must use the branding color palette, typography, and spacing tokens from BRANDING.md.

Register after writing:

```bash
# (env preamble here)
node -e "
const artifacts = require('./src/lib/branding-artifacts.cjs');
const result = artifacts.createArtifact(process.cwd(), {
  type: 'component-library',
  filename: 'components.html',
  description: 'Interactive component library with buttons, forms, and cards using branding tokens'
});
console.log('Registered artifact:', result.id);
"
```

If any registration fails, display: `"[WARN] Could not register {filename} artifact. Continuing."` and proceed.

---

## Step 9: Start Server + Display Hub URL

Generate the static HTML branding page at `.planning/branding/index.html` using the Write tool. Create a single self-contained HTML file with inline CSS and JS.

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

### Register Preview Artifact

```bash
# (env preamble here)
node -e "
const artifacts = require('./src/lib/branding-artifacts.cjs');
const result = artifacts.createArtifact(process.cwd(), {
  type: 'preview',
  filename: 'index.html',
  description: 'Visual branding reference page with live preview'
});
console.log('Registered artifact:', result.id);
"
```

If the command fails, display: `"[WARN] Could not register index.html artifact. Continuing."` and proceed.

### Start Branding Server

After writing `index.html` and registering all artifacts, start the branding server:

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
- If output contains `PORT_CONFLICT`: Prompt the user for an alternative port.

  ```
  if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
    # SDK mode: call mcp__rapid__webui_ask_user with the port question/options below.
  else
    # CLI mode:
    Use AskUserQuestion with the port question/options below.
  fi
  ```

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
- If server started successfully: Display the hub URL.

### Display Hub URL

Display the branding hub URL for the user. The hub page at `/` (root URL) is the primary entry point. Do NOT auto-open the browser.

```
Branding hub available at: http://localhost:{port}

Open this URL in your browser to browse all branding artifacts.
The server auto-reloads when artifacts change.
```

The hub gallery links to `index.html` for the visual preview, but the hub is what the user sees first. Hub as primary entry point means all artifacts are discoverable from one URL.

---

## Step 10: Server Lifecycle, Commit, and Summary

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with the question/options below.
else
  # CLI mode:
After the user has reviewed the branding hub, use AskUserQuestion to ask:

fi
```
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

### Commit (**skip in delegated mode**)

Commit the branding artifacts:

```bash
git add .planning/branding/BRANDING.md .planning/branding/index.html .planning/branding/logo.svg .planning/branding/wireframe.html .planning/branding/artifacts.json .planning/branding/guidelines.html .planning/branding/readme-template.md .planning/branding/components.html 2>/dev/null
git commit -m "feat(branding-system): generate branding guidelines and artifacts"
```

The `2>/dev/null` handles cases where optional files (guidelines.html, readme-template.md, components.html) were not generated.

### Summary

Display a dynamic summary listing all generated artifacts:

```bash
# (env preamble here)
node -e "
const artifacts = require('./src/lib/branding-artifacts.cjs');
const all = artifacts.listArtifacts(process.cwd());
console.log('Branding artifacts generated:');
all.forEach(a => console.log('  - .planning/branding/' + a.filename + ' -- ' + a.description));
console.log('  - .planning/branding/artifacts.json -- Artifact manifest (' + all.length + ' entries)');
"
```

Display the summary message:
```
Branding context will be automatically injected into all future RAPID execution prompts.
```

### Footer (**skip in delegated mode**)

Display the completion footer:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display footer "/rapid:status"
```

---

## Error Handling

- **If RAPID_TOOLS is not set:** Show `[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID.` and STOP.
- **If the prompt tool fails:** Gracefully fall back to sensible defaults (Professional tone, Standard English terminology, Concise style, No emojis).

  ```
  if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
    # SDK mode: fall back if mcp__rapid__webui_ask_user raises.
  else
    # CLI mode:
    # Fall back if AskUserQuestion fails.
  fi
  ```

  Log a warning: "interactive prompt unavailable -- using default branding preferences."
- **If git commit fails:** Show the error but do not fail the skill. The artifacts are still written to disk.
- All errors should be descriptive with clear next steps for the user.

---

## Key Principles

- **Branding is FULLY OPTIONAL.** This skill should never be required for any other RAPID workflow. If BRANDING.md does not exist, all other skills work normally.
- **Hub gallery at `/` is the primary branding URL.** All artifacts are browseable from there.
- **BRANDING.md is the authoritative artifact.** `index.html` is for human review and sharing. Agents consume BRANDING.md, not the HTML page.
- **Each prompt must have 3-4 prefilled options with clear descriptions.**

  ```
  if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
    # SDK mode: supply 3-4 options to mcp__rapid__webui_ask_user (do NOT set allow_free_text).
  else
    # CLI mode:
    # Each AskUserQuestion must have 3-4 prefilled options.
  fi
  ```

  The "Other" option on every question allows full customization.
- **50-150 line budget.** BRANDING.md must be concise enough to inject into prompts without blowing context limits.
- **Project type detection drives everything.** The detected type determines which interview questions are asked, what BRANDING.md sections are generated, and how the HTML preview renders.

## Anti-Patterns for This Skill

- Do NOT generate BRANDING.md longer than 150 lines (prompt budget discipline)
- Do NOT reference or modify any RAPID internals (execute.cjs, display.cjs, etc.) -- that is the integration wave's job
- Do NOT add external dependencies to the HTML page
- Do NOT make branding a prerequisite for any other RAPID skill
