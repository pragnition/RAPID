---
description: Initialize a new RAPID project with research and roadmap generation
allowed-tools: Bash(rapid-tools:*), Agent, AskUserQuestion, Read, Write, Glob, Grep
---

# /rapid:init -- Project Initialization

You are the RAPID project initializer. This skill orchestrates the complete multi-agent pipeline: prerequisites, scaffolding, codebase analysis, parallel research, synthesis, and roadmap generation with user approval.

Follow these steps IN ORDER. Do not skip steps.

## Environment Setup

Load environment variables before any CLI calls:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill. Every `node "${RAPID_TOOLS}"` call must be preceded by the env loading block above in the same Bash invocation.

## Display Stage Banner

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display banner init
```

---

## Step 0.5: Parse Optional Arguments

If the user invoked `/rapid:init` with arguments, parse them here. The supported argument is `--spec <path>` which provides a pre-written spec file to seed research agents with prior findings.

**Argument parsing instructions:**

1. Check if the skill was invoked with arguments (the user's input after `/rapid:init`).
2. If the input contains a file path argument (with or without the `--spec` prefix), treat it as a spec file path.
   - With prefix: `/rapid:init --spec path/to/spec.md`
   - Without prefix: `/rapid:init path/to/spec.md`
3. Read the spec file using the Read tool.
   - If the file does not exist or cannot be read, display a warning: **"Spec file not found at {path}. Falling back to fully interactive discovery."** and set `specContent = null`.
   - If the file is read successfully, store its full content as `specContent` for use in Steps 4B and 7.
4. If no arguments were provided, set `specContent = null`. This is the backward-compatible default.

When `specContent` is null, all subsequent steps behave identically to the original flow.

### Spec Section Extraction

When `specContent` is not null, extract recognizable sections from the spec file using markdown header matching. Map extracted sections to discovery areas and research agent domains:

| Spec Header Pattern | Discovery Area | Research Agent |
|---|---|---|
| `# Vision`, `# Overview`, `# Introduction` | Vision/problem statement | all |
| `# Features`, `# Requirements`, `# User Stories` | Must-have features | features |
| `# Architecture`, `# Design`, `# System Design` | Technical approach | architecture |
| `# Stack`, `# Technology`, `# Tech Stack` | Tech stack preferences | stack |
| `# Security`, `# Compliance`, `# Privacy` | Compliance requirements | pitfalls, oversights |
| `# UX`, `# Design`, `# User Experience` | UX considerations | ux |
| `# Constraints`, `# Limitations`, `# Non-functional` | Technical constraints | pitfalls, oversights |
| `# Scale`, `# Performance`, `# Load` | Scale expectations | stack, architecture |

Use case-insensitive matching. If a header does not match any pattern, include its content in a general "Additional Spec Context" bucket passed to all agents.

Tag each extracted section with `[FROM SPEC]` prefix when passing to downstream consumers.

---

## Step 1: Prerequisites

Run the prerequisite checker to verify the development environment:

```bash
node "${RAPID_TOOLS}" prereqs
```

Parse the JSON output. The response includes `results` (array of tool checks) and `summary` (with `table`, `hasBlockers`, `hasWarnings`).

Display the results as a formatted markdown table:

| Status | Tool | Version | Required | Reason |
|--------|------|---------|----------|--------|
| (from results) | ... | ... | ... | ... |

**Decision logic:**

- If `summary.hasBlockers` is true: Display the blocker table, then use AskUserQuestion with:
  - question: "Prerequisites missing. Critical tools are not installed."
  - Options:
    - "Retry check" -- "Re-run prerequisite validation after installing missing tools"
    - "View install guide" -- "Show install commands for each missing tool"
    - "Cancel init" -- "Exit initialization. No changes made."
  - If "Retry check": Loop back to the top of Step 1 and re-run.
  - If "View install guide": Display install commands for each blocker (e.g., `apt install git`, `brew install git`), then re-prompt with the same AskUserQuestion.
  - If "Cancel init": Print "Cancelled. No changes made." and end the skill.

- If `summary.hasWarnings` is true: Display warnings but continue. Tell the user which optional tools are missing and why they are helpful.

- If all pass: Briefly confirm all prerequisites are met and continue to Step 2.

**On error:** Show progress breadcrumb: `init [prereqs failed] > start-set > discuss-set > plan-set > execute-set > review > merge`

---

## Step 2: Git Repository Check

Run the git repository check:

```bash
node "${RAPID_TOOLS}" prereqs --git-check
```

Parse the JSON output containing `isRepo` (boolean) and `toplevel` (string or null).

**Decision logic:**

- If `isRepo` is false: Use AskUserQuestion with:
  - question: "This directory is not a git repository. RAPID requires git for worktree-based parallel development."
  - Options:
    - "Run git init" -- "Initialize a git repository in the current directory"
    - "Cancel" -- "Exit initialization. Run git init manually, then /rapid:init again."
  - If "Run git init": Execute `git init` and confirm. Continue to Step 3.
  - If "Cancel": Print "Cancelled. No changes made." and end the skill.

- If `isRepo` is true: Continue silently to Step 3.

**On error:** Show progress breadcrumb: `init [git check failed] > start-set > discuss-set > plan-set > execute-set > review > merge`

---

## Step 3: Existing Project Detection

Run the existing project detector:

```bash
node "${RAPID_TOOLS}" init detect
```

Parse the JSON output containing `exists` (boolean) and `files` (string array of existing planning files).

**Decision logic:**

- If `exists` is true: Show the user the list of existing files, then use AskUserQuestion with:
  - question: "Existing RAPID project detected with the following files: {files list}"
  - Options:
    - "Reinitialize" -- "Back up .planning/ to .planning.backup.{timestamp}/ and create fresh. All previous planning data is preserved in the backup."
    - "Upgrade" -- "Add any missing files to existing .planning/ without overwriting existing content."
    - "Cancel" -- "Exit initialization. No changes will be made."
  - Store the selection. Map to `--mode` argument: Reinitialize -> `reinitialize`, Upgrade -> `upgrade`, Cancel -> end the skill with "Cancelled. No changes made."

- If `exists` is false: Set mode to `fresh`. Continue to Step 4.

---

## Step 4: Project Discovery and Setup

This step has two sub-phases: (A) quick logistics, then (B) a deep adaptive discovery conversation. The discovery conversation is the MOST IMPORTANT part of initialization -- it directly determines the quality of research and roadmapping downstream.

### 4A: Logistics Questions

These are quick, objective questions. Ask ONE at a time.

**Project Name:**

Detect the current directory name:

```bash
basename "$(pwd)"
```

Use AskUserQuestion with:
- question: "Project name"
- Options:
  - "{detected directory name}" -- "Use the current directory name"
  - "Other" -- "Enter a custom project name"

If the user selects "Other", ask freeform: "What would you like to name the project?" and accept their input.

**Team Size:**

Use AskUserQuestion with:
- question: "Team size"
- Options:
  - "Solo (1 developer)" -- "Single developer workflow. Simpler worktree management."
  - "Small team (2-3 developers)" -- "Recommended for most projects. Balanced parallelism."
  - "Medium team (4-5 developers)" -- "Higher parallelism. More worktrees and sets."
  - "Large team (6+ developers)" -- "Maximum parallelism. Complex merge coordination."

Map selection to integer for `--team-size`:
- "Solo (1 developer)" -> 1
- "Small team (2-3 developers)" -> 3
- "Medium team (4-5 developers)" -> 5
- "Large team (6+ developers)" -> 6

**Model Selection:**

Use AskUserQuestion with:
- question: "Model selection for AI agents"
- Options:
  - "Opus" -- "Higher quality, slower, more expensive. Best for complex projects."
  - "Sonnet" -- "Good balance of quality and speed. Recommended for most projects."

Store the selection as `opus` or `sonnet`.

### 4B: Deep Project Discovery Conversation

**This is a thorough requirements interview, NOT a form fill.** You must conduct an in-depth conversational discovery session to understand EVERYTHING about the project before proceeding to research and roadmapping. The quality of the entire pipeline depends on the depth of understanding gained here.

**Ground rules:**
- Ask questions in TOPIC BATCHES using AskUserQuestion. Each batch uses a hybrid approach: freeform AskUserQuestion for open-ended areas (vision, features, experience) and structured AskUserQuestion with pre-filled options for areas with well-defined option spaces (target users, scale, tech stack, compliance, etc.).
- LISTEN carefully to each batch response. After each batch, analyze the response for follow-up needs. Only ask follow-up questions for genuinely ambiguous or vague responses. Do NOT re-ask areas already covered.
- Continue asking until you have a comprehensive understanding. This should take 3-4 batch questions plus 0-2 targeted follow-ups depending on project complexity.
- Mentally track what you know and what gaps remain. Only proceed when no significant gaps exist.

### Spec-Aware Discovery Mode

If `specContent` is not null, enter spec-aware discovery mode:

1. **Per-area coverage detection:** For each of the 13 discovery areas (vision, target users, scale, features, tech stack, starting point, performance, compliance, integrations, auth, experience, non-functional, success criteria), classify coverage from the spec as:
   - `covered` -- The spec provides clear, specific information for this area.
   - `partial` -- The spec mentions this area but lacks detail or specificity.
   - `uncovered` -- The spec does not address this area at all.

2. **Adaptive questioning depth:**
   - For `covered` areas: Lead with context extracted from the spec. Display: "From your spec, I see: {extracted summary}". Then ask a brief confirmation: "Is this still accurate? Anything to add or change?" If confirmed, move on. If the user wants changes, collect the updated information.
   - For `partial` areas: Lead with context: "Your spec mentions {topic} but I need more detail on: {specific gaps}". Then ask the targeted follow-up question from the original batch.
   - For `uncovered` areas: Ask the full original question from the batch, noting it was not covered in the spec.

3. **Batch compression:** Covered areas within a batch can be presented as a single confirmation prompt instead of individual questions. For example, if Batch 1's vision and target users are both covered, present them together: "From your spec: Vision is {X}, targeting {Y} users at {Z} scale. Confirm or adjust?"

4. **Spec content supplements, never replaces.** Even when the spec fully covers an area, the user always has the opportunity to override or augment. Never skip an area entirely without at least offering the user a chance to confirm or modify.

After spec-aware discovery completes, compile the project brief identically to the non-spec flow. Include a `Spec File: {path}` line in the brief metadata.

**Discovery must cover these areas, grouped into 4 topic batches:**

**Batch 1: Vision and Users**

This batch uses a hybrid approach: one freeform question for the open-ended vision, then two structured questions for target users and scale.

**Area 1 (Vision/problem statement) -- freeform:**

Use AskUserQuestion (freeform) with:

> "What are you building and why? What problem does it solve? What makes this different from existing solutions? Feel free to be as detailed as you like -- the more context here, the better the research and planning downstream."

**Area 2 (Target users) -- structured:**

Use AskUserQuestion with:
- question: "Who are the primary target users?"
- Options:
  - "B2C consumers" -- "End users interacting through web or mobile apps"
  - "B2B enterprise" -- "Business customers with team/org structures"
  - "Internal team tools" -- "Internal company tools for employees"
  - "Developer/open-source" -- "Developers, CLI users, or open-source community"

**Area 3 (Scale targets) -- structured:**

Use AskUserQuestion with:
- question: "What scale are you targeting initially?"
- Options:
  - "Prototype (<100 users)" -- "Proof of concept or personal project"
  - "Startup (100-10K users)" -- "Early product with growing user base"
  - "Growth (10K-100K users)" -- "Scaling product with significant traffic"
  - "Scale (100K+ users)" -- "High-scale production system"

After receiving the responses, analyze them. If the user's vision or target audience is vague (e.g., "a task management app" with no differentiation), ask ONE targeted follow-up before proceeding to the next batch. Otherwise, continue.

**Batch 2: Features and Technical**

This batch uses a hybrid approach: one freeform question for features (inherently open-ended), then two structured questions for tech stack and starting point.

**Area 4 (Must-have features) -- freeform:**

Use AskUserQuestion (freeform) with:

> "What are the must-have features for v1? Walk me through the primary user journey from start to finish. Also mention any nice-to-have features that can wait, and anything you explicitly do NOT want."

**Area 5 (Tech stack) -- structured:**

Use AskUserQuestion with:
- question: "What is your primary tech stack preference?"
- Options:
  - "React/Next.js + Node" -- "JavaScript/TypeScript full stack with React frontend"
  - "Python + FastAPI/Django" -- "Python backend with your choice of framework"
  - "Go/Rust backend" -- "Systems-oriented backend language"
  - "No preference" -- "Let research determine the best stack for this project"

**Area 6 (Existing dependencies) -- structured:**

Use AskUserQuestion with:
- question: "What is the starting point for this project?"
- Options:
  - "Greenfield" -- "Starting from scratch, no existing code"
  - "Brownfield" -- "Building on or modifying an existing codebase"
  - "Integration" -- "New code that integrates with existing external APIs/services"
  - "Migration" -- "Porting or rewriting an existing system"

After receiving the responses, analyze for gaps. If any must-have feature is unclear or the tech approach is contradictory, ask ONE targeted follow-up.

**Batch 3: Scale and Integrations**

This batch uses all structured questions since each area has a well-defined option space.

**Area 7 (Performance requirements) -- structured:**

Use AskUserQuestion with:
- question: "What are your real-time and performance requirements?"
- Options:
  - "Standard web app" -- "Page loads, form submissions, typical CRUD operations"
  - "Real-time features needed" -- "WebSockets, live updates, collaborative editing"
  - "High throughput" -- "Batch processing, data pipelines, high API call volume"
  - "Low latency critical" -- "Sub-100ms response times, gaming, trading"

**Area 8 (Compliance) -- structured:**

Use AskUserQuestion with:
- question: "Any compliance or regulatory requirements?"
- Options:
  - "None required" -- "No specific regulatory requirements"
  - "GDPR" -- "EU data protection regulation"
  - "HIPAA" -- "Healthcare data protection (US)"
  - "SOC2" -- "Security and availability auditing"

**Area 9 (Third-party integrations) -- structured:**

Use AskUserQuestion with:
- question: "What types of third-party integrations are needed?"
- Options:
  - "Payment processing" -- "Stripe, PayPal, or similar payment APIs"
  - "Auth providers" -- "OAuth, SSO/SAML, or identity providers"
  - "Cloud services" -- "AWS, GCP, Azure services, storage, CDN"
  - "None / minimal" -- "Mostly self-contained, few external dependencies"

**Area 10 (Auth approach) -- structured:**

Use AskUserQuestion with:
- question: "What authentication approach do you prefer?"
- Options:
  - "OAuth / social login" -- "Google, GitHub, social sign-in"
  - "Email / password" -- "Traditional email and password with sessions"
  - "SSO / SAML" -- "Enterprise single sign-on"
  - "API keys" -- "Token-based authentication for API/developer use"

If the user has already addressed some of these areas in previous batches, note that and skip the already-covered items. Do NOT re-ask what's already been answered.

**Batch 4: Context and Success**

This batch uses a hybrid approach: one freeform question for experience and inspiration (contextual narratives), then two structured questions for non-functional requirements and success criteria.

**Area 11 (Team experience and inspiration) -- freeform:**

Use AskUserQuestion (freeform) with:

> "What is your team's experience with the likely tech stack? Any lessons learned from similar projects? Are there existing products that do something similar -- what do they do well or poorly?"

**Area 12 (Non-functional requirements) -- structured:**

Use AskUserQuestion with:
- question: "What non-functional requirements are important?"
- Options:
  - "Security beyond basics" -- "Encryption at rest, audit logging, penetration testing"
  - "Accessibility (a11y)" -- "WCAG compliance, screen reader support"
  - "Internationalization (i18n)" -- "Multi-language, multi-locale support"
  - "Monitoring/observability" -- "APM, distributed tracing, alerting"

**Area 13 (Success criteria) -- structured:**

Use AskUserQuestion with:
- question: "What does 'done' look like for v1?"
- Options:
  - "Working MVP" -- "Core features functional, rough edges acceptable"
  - "Production-ready with tests" -- "Fully tested, deployment pipeline, monitoring"
  - "Specific deadline target" -- "Must ship by a particular date"
  - "Feature-complete per spec" -- "All specified features implemented and polished"

**Adaptive behavior:**
- If a batch response thoroughly covers areas from upcoming batches, acknowledge what you learned and SKIP those items in the next batch.
- If the user says "I don't know" or "haven't decided" for a particular area, note it as an open question and move on -- but circle back if it affects architecture decisions.
- For brownfield projects where codebase exists, some technical questions can be deferred to the codebase analysis step. Focus discovery on intent, goals, and what needs to change.
- You do NOT need to ask all 4 batches if earlier responses comprehensively cover everything. Proceed when no significant gaps exist.

**Completion check:**

Before ending the discovery phase, mentally review: "Do I have enough context to brief 5 independent research agents who will each investigate a different aspect of this project (stack, features, architecture, pitfalls, oversights)? Would any of those agents be confused or have to guess about the user's intent?"

If the answer is yes (they would have to guess), ask more questions.

If the answer is no (you have comprehensive understanding), proceed.

**Compile the project brief:**

After the discovery conversation is complete, compile a structured project brief (stored in memory for passing to downstream steps and agents). The brief should contain:

```
PROJECT BRIEF
=============
Name: {project name}
Team Size: {N}
Model: {opus/sonnet}

Vision: {2-3 sentence summary of what the project is and why it exists}

Target Users: {who uses this and in what context}

Key Features (must-have for v1):
- {feature 1}
- {feature 2}
- ...

Deferred Features (post-v1):
- {feature 1}
- ...

Technical Constraints:
- {constraint 1}
- ...

Tech Stack Preferences: {any stated preferences or "no preference"}

Scale Expectations: {rough numbers for users, data, traffic}

Integrations: {third-party services, APIs, existing systems}

Security/Compliance: {any specific requirements}

Inspiration/References: {similar products, repos, designs}

Open Questions: {anything the user explicitly deferred or was uncertain about}

Success Criteria: {what "done" looks like}

Additional Context: {anything else relevant from the conversation}
```

This project brief replaces the simple "one-sentence description" in all downstream steps. Wherever the plan previously passed "project description", pass this full project brief instead.

Store the first sentence of "Vision" as the short project description for CLI commands that require `--description`.

### 4B.5: Optional Branding Step (Skip by Default)

---

**[OPTIONAL STEP]** -- This step is entirely optional and skippable. It does not affect the init flow. Users who skip will get the same project output. Branding can always be configured later via `/rapid:branding`.

---

#### Re-init Detection

Before asking the opt-in question, check whether branding has already been configured:

```bash
[ -f ".planning/branding/BRANDING.md" ] && echo "EXISTS" || echo "NEW"
```

If `EXISTS`, use AskUserQuestion with:
- question: "Existing project branding found. Would you like to keep it or set up new branding?"
- Options:
  - "Keep existing branding" -- "Preserve current BRANDING.md and continue to granularity preferences"
  - "Set up new branding" -- "Replace existing branding with a fresh interview"

If the user selects "Keep existing branding": skip this entire step (proceed to Step 4C). Set `brandingStatus = "configured (preserved)"`.
If the user selects "Set up new branding": continue to the opt-in question below.
If `NEW`: continue to the opt-in question below.

This AskUserQuestion counts toward the 7-call budget (1 of max 7).

#### Opt-in Question

Use AskUserQuestion with:
- question: "Would you like to set up project branding guidelines now? This configures visual identity, terminology, and interaction patterns that agents will follow throughout development."
- Options:
  - "Skip branding" -- "Continue without branding. You can always run /rapid:branding later."
  - "Set up branding" -- "Answer 5 quick questions to configure branding guidelines (~2 minutes)."

If "Skip branding": skip the rest of this step entirely. Set `brandingStatus = "skipped"`. Proceed to Step 4C. Zero files created, zero directories created, zero state changes.

If "Set up branding": continue to the branding interview below.

This AskUserQuestion counts toward the 7-call budget (1 of max 7; or 2 if re-init check was also asked).

#### Project Type Inference

Infer the project type from the discovery answers already collected in Step 4B. Do NOT use a separate AskUserQuestion -- this is zero-cost inference from existing data.

Rules:
- If the Tech Stack Preferences or Key Features mention React, Next.js, Vue, Angular, Svelte, frontend, web app, dashboard, SPA, or similar web frameworks: `projectType = "webapp"`
- If the Tech Stack Preferences or Key Features mention CLI, command-line, terminal, Go, Rust (with binary output), shell tool, or similar: `projectType = "cli"`
- If the Tech Stack Preferences or Key Features mention library, SDK, package, npm module, pip package, or similar: `projectType = "library"`
- If ambiguous or hybrid: default to `projectType = "webapp"`

Store `projectType` for use in the interview questions and artifact generation below.

#### Branding Interview (5 Rounds)

Conduct a full branding interview with 5 AskUserQuestion rounds. Each round is project-type-adaptive.

**Mid-interview bail-out:** Every AskUserQuestion in this interview MUST include an additional option:
- "Skip remaining" -- "Stop branding setup and continue init without branding guidelines"

If the user selects "Skip remaining" at any point: discard ALL partial interview answers collected so far. Do NOT write any branding files. Do NOT create any directories. Set `brandingStatus = "skipped"`. Proceed to Step 4C.

**Round 1 -- Visual Identity / Output Identity:**

For `webapp` projects, use AskUserQuestion:
- question: "What visual identity direction fits your project?"
- Options:
  - "Modern & minimal" -- "Clean lines, generous whitespace, monochrome with one accent color"
  - "Bold & colorful" -- "Vibrant palette, strong contrast, energetic feel"
  - "Corporate & polished" -- "Refined, professional palette, subtle gradients, enterprise-grade"
  - "Other" -- "Describe your visual direction"
  - "Skip remaining" -- "Stop branding setup and continue init without branding guidelines"

For `cli` or `library` projects, use AskUserQuestion:
- question: "How should your tool's terminal output look and feel?"
- Options:
  - "Minimal & clean" -- "Plain text, sparse color, no decorations. Think Go CLI tools."
  - "Rich & informative" -- "Colors, icons/symbols, progress bars. Think npm/yarn output."
  - "Structured & parseable" -- "Machine-friendly output, JSON mode, minimal decoration"
  - "Other" -- "Describe your output style preferences"
  - "Skip remaining" -- "Stop branding setup and continue init without branding guidelines"

**Round 2 -- Component Style / Error & Status Style:**

For `webapp` projects, use AskUserQuestion:
- question: "What component and layout style do you prefer?"
- Options:
  - "Rounded & soft" -- "Rounded corners, soft shadows, gentle transitions"
  - "Sharp & structured" -- "Square corners, defined borders, grid-aligned layouts"
  - "Fluid & organic" -- "Flowing shapes, gradients, smooth animations"
  - "Other" -- "Describe your UI component style"
  - "Skip remaining" -- "Stop branding setup and continue init without branding guidelines"

For `cli` or `library` projects, use AskUserQuestion:
- question: "How should errors and status messages be formatted?"
- Options:
  - "Contextual with fix suggestions" -- "Show the error, point to the line, suggest a fix. Think Rust compiler."
  - "Concise one-liners" -- "Short error messages, error codes for lookup. Think Unix tradition."
  - "Verbose with stack traces" -- "Full context, debug info, trace output for diagnosing issues"
  - "Other" -- "Describe your error formatting preferences"
  - "Skip remaining" -- "Stop branding setup and continue init without branding guidelines"

**Round 3 -- Terminology & Naming:**

Same for all project types. Use AskUserQuestion:
- question: "Do you have specific naming conventions or domain terminology agents should follow?"
- Options:
  - "Use existing codebase conventions" -- "Scan the codebase and match whatever naming patterns already exist"
  - "I have a terminology list" -- "I will provide specific terms to use and terms to avoid"
  - "Standard technical English" -- "No special terminology requirements, just clear technical writing"
  - "Other" -- "Describe your terminology preferences"
  - "Skip remaining" -- "Stop branding setup and continue init without branding guidelines"

If the user selects "I have a terminology list" or "Other", use a follow-up AskUserQuestion:
- question: "Please provide your terminology preferences. List terms to use, terms to avoid, or naming patterns."
- Options:
  - "I will type them out" -- "Free-form input for terminology table entries"

This follow-up is part of Round 3 (not a separate round). Record whatever the user provides for the terminology table. This follow-up does NOT include a "Skip remaining" option since the user has already committed to providing terminology.

**Round 4 -- Interaction Patterns / Log & Progress Style:**

For `webapp` projects, use AskUserQuestion:
- question: "What interaction and feedback patterns should your UI follow?"
- Options:
  - "Instant & reactive" -- "Immediate feedback, optimistic updates, micro-animations"
  - "Deliberate & confirmed" -- "Explicit confirmations, loading states, step-by-step flows"
  - "Ambient & passive" -- "Subtle notifications, non-blocking updates, quiet success"
  - "Other" -- "Describe your interaction patterns"
  - "Skip remaining" -- "Stop branding setup and continue init without branding guidelines"

For `cli` or `library` projects, use AskUserQuestion:
- question: "How should progress and logging be displayed?"
- Options:
  - "Progress bars & spinners" -- "Visual progress indicators for long operations"
  - "Streaming log lines" -- "Real-time log output with timestamps and levels"
  - "Silent unless error" -- "No output on success, only report failures"
  - "Other" -- "Describe your progress/logging preferences"
  - "Skip remaining" -- "Stop branding setup and continue init without branding guidelines"

**Round 5 -- Anti-Patterns (final question):**

Same for all project types. Use AskUserQuestion:
- question: "What should agents explicitly AVOID in their output?"
- Options:
  - "No emojis" -- "Never use emojis in documentation, comments, or output"
  - "No marketing language" -- "Avoid superlatives, hype words, promotional tone"
  - "No filler words" -- "Cut 'basically', 'simply', 'just', 'very', 'really'"
  - "Other" -- "Describe specific anti-patterns to avoid"
  - "Skip remaining" -- "Stop branding setup and continue init without branding guidelines"

#### Pre-scaffolding Directory Creation

After the interview completes successfully (all 5 rounds answered, no bail-out), create the branding directory:

```bash
mkdir -p .planning/branding
```

This runs BEFORE writing any files. The `.planning/` directory and `.planning/branding/` subdirectory are created eagerly. This is safe even if Step 5 scaffold runs later -- `mkdir -p` is idempotent. Do NOT create this directory if the user skipped or bailed out.

#### Generate BRANDING.md

Write `.planning/branding/BRANDING.md` using the Write tool. Use the interview responses to fill each section. The format depends on the detected `projectType`.

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

Fill in the `{...}` placeholders by synthesizing the user's interview responses into concrete, actionable guidance. For color hex values, generate a coherent palette that matches the user's stated visual direction. Target 50-150 lines total for BRANDING.md.

After writing, verify the line count:
```bash
wc -l .planning/branding/BRANDING.md
```
If over 150 lines, trim verbose descriptions. If under 50 lines, add more specific guidance.

Register the artifact:
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
If registration fails, display `"[WARN] Could not register BRANDING.md artifact. Continuing."` and proceed. Do NOT halt the init flow.

#### Generate index.html

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

Register the artifact:
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
If registration fails, display `"[WARN] Could not register index.html artifact. Continuing."` and proceed. Do NOT halt the init flow.

**CRITICAL:** Do NOT reference `branding-server.cjs` or `server.start()` anywhere in this step. Do NOT start the branding server. The `no-server-during-init` contract invariant is absolute.

#### Set Branding Status

After successful artifact generation, set `brandingStatus = "configured"`.

Display a brief confirmation:
```
Branding configured. Files written to .planning/branding/
  - BRANDING.md (style guidelines)
  - index.html (visual reference)
```

Then proceed to Step 4C.

### 4C: Granularity Preference

After the project brief is compiled, ask the user about their preferred level of decomposition granularity.

Use AskUserQuestion with:
- question: "How granular should the project be decomposed into parallel sets?"
- Options:
  - "Compact (3-5 sets)" -- "Fewer, larger sets. Less coordination overhead, but less parallelism."
  - "Standard (6-10 sets)" -- "Balanced decomposition. Recommended for most projects."
  - "Granular (11-15 sets)" -- "Many smaller sets. Maximum parallelism, but more merge coordination."
  - "Let Claude decide" -- "The roadmapper will determine the optimal set count based on project complexity and team size."

Map the selection to a `targetSetCount` value:
- "Compact (3-5 sets)" -> targetSetCount = "3-5"
- "Standard (6-10 sets)" -> targetSetCount = "6-10"
- "Granular (11-15 sets)" -> targetSetCount = "11-15"
- "Let Claude decide" -> targetSetCount = "auto"

Store `targetSetCount` in memory for passing to the roadmapper in Step 9. Do NOT persist this value in config.json -- it is a runtime parameter only.

### 4D: Summary Confirmation and Acceptance Criteria

Before proceeding to scaffold and research, present the complete discovery summary for user review.

**Display the summary:**

Present the compiled PROJECT BRIEF from Step 4B in full, followed by the granularity preference from Step 4C:

```
PROJECT BRIEF
=============
{full compiled project brief}

Granularity Preference: {targetSetCount value and label}
```

**Generate formal acceptance criteria:**

Based on the discovery answers, generate formal acceptance criteria using encoded category prefixes. Each criterion MUST follow the format `CATEGORY-NNN: description` where:

- **CATEGORY** is one of: FUNC, UIUX, PERF, SEC, DATA, INTEG, COMPAT, A11Y, MAINT
- **NNN** is a zero-padded three-digit number, sequential per category (001, 002, ...)
- Only use categories relevant to the project -- not every category needs criteria

The criteria regex pattern is: `/^[A-Z]+-\d{3}:/`

Format them as:

```markdown
# Acceptance Criteria

- [ ] FUNC-001: User can create an account with email and password
- [ ] FUNC-002: User can log in and receive a session token
- [ ] FUNC-003: User can reset their password via email link
- [ ] UIUX-001: All pages render correctly on mobile viewports (320px-768px)
- [ ] PERF-001: API responses complete within 200ms at p95 under expected load
- [ ] SEC-001: All user passwords are hashed with bcrypt before storage
```

**Post-generation validation:** Before writing REQUIREMENTS.md, verify that EVERY generated criterion line matches the regex `/^- \[ \] [A-Z]+-\d{3}: .+/`. If any line does not match, fix it before writing. This is a hard requirement -- do not skip validation.

Display the acceptance criteria to the user alongside the project brief.

**Confirmation prompt:**

Use AskUserQuestion with:
- question: "Please review the project brief and acceptance criteria above. Is everything accurate?"
- Options:
  - "Looks good, proceed" -- "Continue to scaffold, research, and roadmap generation"
  - "Need to change something" -- "Specify which section needs changes"
  - "Start over" -- "Restart the discovery conversation from the beginning"

**If "Looks good, proceed":**

Before writing, check if `.planning/REQUIREMENTS.md` already exists using the Read tool:
- **If the file exists and contains non-trivial content** (more than empty headers or whitespace): Use the Edit tool to APPEND the new criteria below the existing content, separated by a `## Updated Criteria ({current ISO date})` header. This preserves user-written criteria from previous runs.
- **If the file does not exist or is empty/trivial**: Write the full criteria to `.planning/REQUIREMENTS.md` using the Write tool.

Then continue to Step 5.

**If "Need to change something":**
Ask freeform: "Which section needs changes? (e.g., Vision, Target Users, Features, Tech Stack, Scale, Compliance, Integrations, Auth, Non-functional, Success Criteria, Granularity)"

Based on the user's response, re-ask ONLY the questions for that specific section (using the same structured or freeform format as in the original batch). After receiving the updated answer, recompile the project brief and re-display the summary. Loop back to the confirmation prompt.

Limit re-ask cycles to 3 iterations. If the user requests changes a 4th time, suggest: "Consider running /rapid:init again to start fresh if the project scope has changed significantly."

**If "Start over":**
Loop back to Step 4B and restart the discovery conversation. Clear all previously collected answers.

---

## Step 4E: Principles Capture

Capture meta-principles that guide development decisions across the project. These are stored in `.planning/PRINCIPLES.md` and summarized in worktree-scoped CLAUDE.md files.

### Principles Interview

Present the 8 predefined categories one at a time. For each category, offer 2-3 recommended principles as multiSelect options, plus the ability to add custom principles.

**Escape hatch:**

Before starting the category walkthrough, offer an escape hatch:

Use AskUserQuestion with:
- question: "Would you like to define project principles now?"
- Options:
  - "Yes, walk me through categories" -- "Define principles category by category (recommended)"
  - "Use sensible defaults" -- "Infer principles from existing code patterns (brownfield) or use generic best practices (greenfield)"
  - "Skip principles" -- "Do not generate PRINCIPLES.md. You can add it later."

**If "Yes, walk me through categories":** Proceed with the category walkthrough below.

**If "Use sensible defaults":**
- For brownfield projects: Analyze existing code patterns detected in Step 6 (CODEBASE-ANALYSIS.md) to infer principles. Look for patterns like: test framework usage (testing principles), module structure (architecture principles), linting config (code style principles), existing security middleware (security principles).
- For greenfield projects: Use the first recommended principle from each of the 8 predefined categories as defaults.
- Present the inferred/default principles for confirmation before writing.

**If "Skip principles":** Set `principlesData = null` and skip Step 9.5. No PRINCIPLES.md will be generated.

**Category walkthrough:**

For each category in order (architecture, code style, testing, security, UX, performance, data handling, documentation):

Use AskUserQuestion with:
- question: "Principles for **{Category}** -- Select any that apply, or add your own:"
- Options (vary per category -- see recommended principles below):
  - {Recommended principle 1} -- "{brief rationale}"
  - {Recommended principle 2} -- "{brief rationale}"
  - {Recommended principle 3} -- "{brief rationale}"
  - "Add custom" -- "Write your own principle for this category"
  - "Skip this category" -- "No principles needed for {category}"

If the user selects "Add custom", ask freeform: "Enter your principle statement for {Category}:" and then "Brief rationale (why this matters):" -- collect both and add to the principles list.

Users can select multiple recommended principles AND add custom ones in the same category.

**Recommended principles per category:**

1. **Architecture:**
   - "Prefer composition over inheritance" -- "Flexibility and easier refactoring"
   - "Use dependency injection for testability" -- "Enables unit testing with mocks"
   - "Keep modules loosely coupled" -- "Independent deployment and development"

2. **Code Style:**
   - "Use strict mode everywhere" -- "Prevents silent errors"
   - "Prefer named exports over default exports" -- "Better IDE support and refactoring"
   - "Keep functions under 30 lines" -- "Readability and single responsibility"

3. **Testing:**
   - "Test behavior, not implementation" -- "Tests survive refactoring"
   - "Require tests for all bug fixes" -- "Prevent regressions"
   - "Use integration tests for critical paths" -- "Catch issues unit tests miss"

4. **Security:**
   - "Never store secrets in code" -- "Use environment variables or secret managers"
   - "Validate all external input" -- "Prevent injection attacks"
   - "Use parameterized queries" -- "Prevent SQL injection"

5. **UX:**
   - "Show loading states for async operations" -- "Users need feedback"
   - "Provide meaningful error messages" -- "Help users recover from errors"
   - "Support keyboard navigation" -- "Accessibility and power users"

6. **Performance:**
   - "Lazy load non-critical resources" -- "Faster initial page loads"
   - "Use pagination for large datasets" -- "Prevent memory issues"
   - "Cache expensive computations" -- "Reduce redundant work"

7. **Data Handling:**
   - "Validate at boundaries" -- "Trust nothing from external sources"
   - "Use transactions for multi-step writes" -- "Maintain data consistency"
   - "Log all data mutations" -- "Auditability and debugging"

8. **Documentation:**
   - "Document why, not what" -- "Code shows what; comments explain why"
   - "Keep README up to date" -- "First impression for new contributors"
   - "Document breaking changes in changelogs" -- "Users need migration guidance"

After the interview (or defaults), compile `principlesData` as an array of `{category, statement, rationale}` objects.

---

## Step 5: Scaffold

Run the scaffold, config write, and research directory setup:

```bash
node "${RAPID_TOOLS}" init scaffold --name "{name}" --description "{short description from brief Vision}" --team-size {N} --mode {mode}
```

Parse the JSON result:
- For fresh/reinitialize: `created` array lists files created. For reinitialize: `backed_up_to` shows backup location.
- For upgrade: `created` (new files) and `skipped` (preserved files).

Then write the configuration:

```bash
node "${RAPID_TOOLS}" init write-config --model {model} --team-size {N} --name "{name}"
```

Then create the research directory:

```bash
node "${RAPID_TOOLS}" init research-dir
```

Confirm all three commands succeed before proceeding.

**On error:** Show progress breadcrumb: `init [scaffold done, config failed] > start-set > discuss-set > plan-set > execute-set > review > merge` (adjust based on which step failed).

---

## Step 6: Brownfield Detection

Detect whether the project has existing source code:

```bash
node "${RAPID_TOOLS}" context detect
```

Parse the JSON output for the `hasSourceCode` field.

**If brownfield detected (hasSourceCode is true):**

Inform the user: "Existing codebase detected. Running codebase analysis before research..."

1. Read the scan manifest for the project (included in the `context detect` output as `manifest`).

2. Spawn the **rapid-codebase-synthesizer** agent with this task:
   ```
   Analyze the existing codebase and produce CODEBASE-ANALYSIS.md.

   ## Task Context
   - Project directory: {current working directory}
   - Scan manifest: {manifest data from context detect}
   - Project brief: {full project brief from Step 4B}

   ## Working Directory
   {projectRoot}

   ## Output
   Write CODEBASE-ANALYSIS.md to .planning/research/
   ```

4. Wait for the agent to complete. If it fails, use AskUserQuestion to offer recovery:
   - question: "Codebase analysis encountered an error: {error details}"
   - Options:
     - "Retry" -- "Re-run codebase analysis"
     - "Skip" -- "Continue without codebase analysis. Research agents will have less context."
     - "Cancel" -- "Exit initialization."

5. After completion, read `.planning/research/CODEBASE-ANALYSIS.md` to pass its content to research agents.

**If greenfield (hasSourceCode is false):**

Display: "No existing source code detected. Starting research for greenfield project."

Set a flag noting this is greenfield -- research agents will receive a note that this is a greenfield project with no existing codebase to analyze.

**On error:** Show progress breadcrumb: `init [scaffold done, brownfield detection failed] > start-set > discuss-set > plan-set > execute-set > review > merge`

---

## Step 6a: Test Framework Detection

Detect the project's test framework(s) and store them in config.json. This enables framework-agnostic test execution in `/rapid:unit-test`.

```bash
# Run test framework detection
node -e "
  const path=require('path'); const { detectTestFrameworks } = require(path.join(path.dirname('${RAPID_TOOLS}'), '..', 'lib', 'context.cjs'));
  const result = detectTestFrameworks(process.cwd());
  console.log(JSON.stringify(result));
" > /tmp/rapid-test-frameworks.json
```

Read the detection result. If the array is non-empty, write it to config:

```bash
FRAMEWORKS=$(cat /tmp/rapid-test-frameworks.json)
node "${RAPID_TOOLS}" init write-config --name "{name}" --model {model} --team-size {N} --test-frameworks "${FRAMEWORKS}"
```

**Important:** The `write-config` command preserves manual overrides. If the user has already edited `testFrameworks` entries in config.json, those entries are kept and detection only fills in missing language entries.

Display the detected frameworks:

```
Test frameworks detected:
  - {lang}: {framework} ({runner})
```

If no frameworks were detected, display:

```
No test frameworks detected. Test runner will be selected autonomously per language during unit testing.
```

**On error:** Non-fatal. If detection fails, log a warning and continue. Unit-test skill falls back to autonomous framework selection per language.

---

## Step 7: Parallel Research Agents

Ensure `.planning/research/` exists (already created in Step 5).

Spawn ALL 6 research agents in parallel using the Agent tool. Each agent operates independently -- no agent reads another research agent's output.

For each agent, provide ONLY task-specific context (the agent already knows its role from its system prompt):

**1. Spawn the **rapid-research-stack** agent with this task:**
```
Research the technology stack for this project.

## Project Brief
{full project brief from Step 4B}

## Model Selection
{opus or sonnet from Step 4A}

## Brownfield Context
{if brownfield: "Read .planning/research/CODEBASE-ANALYSIS.md for existing codebase analysis." | if greenfield: "This is a greenfield project with no existing codebase."}

{if specContent is not null:}
## Spec Content
The following content was extracted from a user-provided spec file. Assertions are tagged with [FROM SPEC].
Evaluate critically: verify technical claims where possible, accept domain/business assertions at face value unless contradicted by evidence.

{extracted spec sections relevant to the stack research domain, each prefixed with [FROM SPEC]}
{end if}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/STACK.md
```

**2. Spawn the **rapid-research-features** agent with this task:**
```
Research the feature implementation approach for this project.

## Project Brief
{full project brief from Step 4B}

## Model Selection
{opus or sonnet from Step 4A}

## Brownfield Context
{if brownfield: "Read .planning/research/CODEBASE-ANALYSIS.md for existing codebase analysis." | if greenfield: "This is a greenfield project with no existing codebase."}

{if specContent is not null:}
## Spec Content
The following content was extracted from a user-provided spec file. Assertions are tagged with [FROM SPEC].
Evaluate critically: verify technical claims where possible, accept domain/business assertions at face value unless contradicted by evidence.

{extracted spec sections relevant to the features research domain, each prefixed with [FROM SPEC]}
{end if}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/FEATURES.md
```

**3. Spawn the **rapid-research-architecture** agent with this task:**
```
Research the architecture patterns for this project.

## Project Brief
{full project brief from Step 4B}

## Model Selection
{opus or sonnet from Step 4A}

## Brownfield Context
{if brownfield: "Read .planning/research/CODEBASE-ANALYSIS.md for existing codebase analysis." | if greenfield: "This is a greenfield project with no existing codebase."}

{if specContent is not null:}
## Spec Content
The following content was extracted from a user-provided spec file. Assertions are tagged with [FROM SPEC].
Evaluate critically: verify technical claims where possible, accept domain/business assertions at face value unless contradicted by evidence.

{extracted spec sections relevant to the architecture research domain, each prefixed with [FROM SPEC]}
{end if}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/ARCHITECTURE.md
```

**4. Spawn the **rapid-research-pitfalls** agent with this task:**
```
Research potential pitfalls and risks for this project.

## Project Brief
{full project brief from Step 4B}

## Model Selection
{opus or sonnet from Step 4A}

## Brownfield Context
{if brownfield: "Read .planning/research/CODEBASE-ANALYSIS.md for existing codebase analysis." | if greenfield: "This is a greenfield project with no existing codebase."}

{if specContent is not null:}
## Spec Content
The following content was extracted from a user-provided spec file. Assertions are tagged with [FROM SPEC].
Evaluate critically: verify technical claims where possible, accept domain/business assertions at face value unless contradicted by evidence.

{extracted spec sections relevant to the pitfalls research domain, each prefixed with [FROM SPEC]}
{end if}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/PITFALLS.md
```

**5. Spawn the **rapid-research-oversights** agent with this task:**
```
Research potential oversights and blind spots for this project.

## Project Brief
{full project brief from Step 4B}

## Model Selection
{opus or sonnet from Step 4A}

## Brownfield Context
{if brownfield: "Read .planning/research/CODEBASE-ANALYSIS.md for existing codebase analysis." | if greenfield: "This is a greenfield project with no existing codebase."}

{if specContent is not null:}
## Spec Content
The following content was extracted from a user-provided spec file. Assertions are tagged with [FROM SPEC].
Evaluate critically: verify technical claims where possible, accept domain/business assertions at face value unless contradicted by evidence.

{extracted spec sections relevant to the oversights research domain, each prefixed with [FROM SPEC]}
{end if}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/OVERSIGHTS.md
```

**6. Spawn the **rapid-research-ux** agent with this task:**
```
Research domain conventions and UX patterns for this project.

## Project Brief
{full project brief from Step 4B}

## Model Selection
{opus or sonnet from Step 4A}

## Brownfield Context
{if brownfield: "Read .planning/research/CODEBASE-ANALYSIS.md for existing codebase analysis." | if greenfield: "This is a greenfield project with no existing codebase."}

{if specContent is not null:}
## Spec Content
The following content was extracted from a user-provided spec file. Assertions are tagged with [FROM SPEC].
Evaluate critically: verify technical claims where possible, accept domain/business assertions at face value unless contradicted by evidence.

{extracted spec sections relevant to the UX research domain, each prefixed with [FROM SPEC]}
{end if}

## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/UX.md
```

**Parallel spawning:** Spawn all 6 agents in a single response using 6 Agent tool calls.

**Sequential fallback:** If parallel spawning fails (Claude Code limitation), fall back to sequential execution. Inform the user: "Running research agents sequentially (parallel spawning unavailable)."

Wait for ALL 6 agents to complete. If any agent fails, use AskUserQuestion:
- question: "{agent name} research agent encountered an error: {error details}"
- Options:
  - "Retry" -- "Re-run this research agent"
  - "Skip" -- "Continue without this research output. Synthesis will have less context."
  - "Cancel" -- "Exit initialization."

**On error:** Show progress breadcrumb: `init [scaffold done, research failed ({agent name})] > start-set > discuss-set > plan-set > execute-set > review > merge`

---

## Step 8: Research Synthesis

Spawn the **rapid-research-synthesizer** agent with this task:

```
Synthesize all research outputs into a unified research summary.

## Research Files to Read
- .planning/research/STACK.md
- .planning/research/FEATURES.md
- .planning/research/ARCHITECTURE.md
- .planning/research/PITFALLS.md
- .planning/research/OVERSIGHTS.md
- .planning/research/UX.md
{if brownfield: "- .planning/research/CODEBASE-ANALYSIS.md"}

## Working Directory
{projectRoot}

## Output
Write synthesized summary to .planning/research/SUMMARY.md
```

3. Wait for completion. If it fails, use AskUserQuestion with Retry/Skip/Cancel options (same pattern as Step 6).

4. After completion, read `.planning/research/SUMMARY.md` to confirm it was written and to pass its content to the roadmapper.

**On error:** Show progress breadcrumb: `init [scaffold done, research done, synthesis failed] > start-set > discuss-set > plan-set > execute-set > review > merge`

---

## Step 9: Roadmap Generation

Read `.planning/research/SUMMARY.md` (the synthesized research output).

Spawn the **rapid-roadmapper** agent with this task:

```
Generate the project roadmap from synthesized research.

## Research Summary
{content of .planning/research/SUMMARY.md}

## Project Brief
{full project brief from Step 4B -- includes description, features, constraints, scale, and all discovery context -- compiled from structured discovery in Step 4B}

## Team Size
{team size from Step 4A}

## Model Selection
{opus or sonnet from Step 4A}

## Target Set Count
{targetSetCount from Step 4C -- e.g., "6-10" or "auto"}

Aim for roughly this number of sets. You may deviate if the project structure demands it, but note why in the roadmap output.

## Acceptance Criteria
{content of .planning/REQUIREMENTS.md written in Step 4D}

Use these formal acceptance criteria to inform set boundaries. Each criterion should be traceable to at least one set. Reference criteria by their encoded ID (e.g., FUNC-001) when mapping criteria to sets.

## Working Directory
{projectRoot}

## CRITICAL: Sets-Only Output
Output sets ONLY -- do NOT include wave or job structure. Waves are determined later during /plan-set. The return JSON structure should be: { roadmap, state, contracts } where state contains project > milestone > sets (no waves key, no jobs key).

Each set should define:
- Set name and scope
- Set dependencies (which other sets it depends on)
- Set branch name

Do NOT decompose sets into waves or jobs. That decomposition happens later when the user runs /plan-set for each set.

## Return Format
Return a structured JSON response with three keys:
- roadmap -- markdown string for ROADMAP.md (set names, scopes, dependencies -- NO wave/job tables)
- state -- JSON structure: { milestones: [{ id, name, status: "active", sets: [{ id, name, status: "pending", branch }] }], currentMilestone }
- contracts -- array of { setId, contract } objects for CONTRACT.json files
```

4. Wait for the agent to complete. If it fails, use AskUserQuestion with Retry/Skip/Cancel options.

5. Parse the agent's JSON response.

**Present the roadmap to the user:**

Display a summary of the proposed roadmap:
- Number of sets planned
- Set names and their high-level descriptions
- Key contracts and dependencies between sets

Use AskUserQuestion with:
- question: "Review the proposed roadmap above."
- Options:
  - "Accept roadmap" -- "Proceed with this roadmap. Files will be written to .planning/"
  - "Request changes" -- "Describe what to change. The roadmapper will revise the proposal."
  - "Cancel" -- "Exit without writing roadmap. Scaffold and research files are preserved."

**If "Accept roadmap":**

Write the roadmap files using CLI commands (agents do NOT write these directly):

a) Write ROADMAP.md:
   Use the Write tool to write `.planning/ROADMAP.md` with the roadmapper's `roadmap` content.

b) Write CONTRACT.json and DEFINITION.md files for each set:
   For each entry in the `contracts` array:
   ```bash
   mkdir -p .planning/sets/{setId}
   ```
   Use the Write tool to write `.planning/sets/{setId}/CONTRACT.json` with the contract content.

   Then, use the Write tool to write `.planning/sets/{setId}/DEFINITION.md` with the following content, populated from the entry's `definition` object:

   ```markdown
   # Set: {setId}

   ## Scope
   {definition.scope}

   ## File Ownership
   Files this set owns (exclusive write access):
   - {definition.ownedFiles[0]}
   - {definition.ownedFiles[1]}
   ...

   ## Tasks
   1. {definition.tasks[0].description}
      - Acceptance: {definition.tasks[0].acceptance}
   2. {definition.tasks[1].description}
      - Acceptance: {definition.tasks[1].acceptance}
   ...

   ## Interface Contract
   See: CONTRACT.json (adjacent file)

   ## Wave Assignment
   Wave: (assigned during plan-set)

   ## Acceptance Criteria
   - {definition.acceptance[0]}
   - {definition.acceptance[1]}
   ...
   ```

   If the `definition` field is missing from a contracts entry (e.g., from an older roadmapper version), skip DEFINITION.md generation for that set and log a warning: "Warning: No definition metadata for set {setId}. DEFINITION.md was not generated."

c) Merge the roadmapper's milestone/set data into STATE.json (preserving envelope fields):
   Extract `milestones` and `currentMilestone` from the roadmapper's `state` output.
   Use `mergeStatePartial()` to merge only these fields into the existing STATE.json, preserving `version`, `projectName`, `createdAt`, and `rapidVersion`:

   ```bash
   node -e "
     const path = require('path');
     const { mergeStatePartial } = require(path.join(path.dirname('${RAPID_TOOLS}'), '..', 'lib', 'state-machine.cjs'));
     const partial = JSON.parse(process.argv[1]);
     mergeStatePartial(process.cwd(), partial).then(() => console.log('STATE.json merged successfully'));
   " '{"milestones": <MILESTONES_JSON>, "currentMilestone": "<MILESTONE_ID>"}'
   ```

   Where `<MILESTONES_JSON>` is the milestones array from the roadmapper output and `<MILESTONE_ID>` is the current milestone ID.
   This preserves `version`, `projectName`, `createdAt`, `rapidVersion` in STATE.json while updating only the milestone/set structure.
   Each set has only `{ id, name, status: "pending", branch }` -- no waves or jobs arrays.

d) Generate DAG.json and OWNERSHIP.json from the newly written STATE.json and CONTRACT.json files:

   ```bash
   if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
   node "${RAPID_TOOLS}" dag generate
   ```

   Where the CLI reads STATE.json to find the current milestone and generates DAG.json and OWNERSHIP.json from the set contracts.

   Verify DAG.json was created:

   ```bash
   if [ -f .planning/sets/DAG.json ]; then
     echo "DAG.json created successfully."
   else
     echo "DAG.json NOT found after generation."
     exit 1
   fi
   ```

   If the verification fails (DAG.json does not exist), retry the generation command once:

   ```bash
   if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
   node "${RAPID_TOOLS}" dag generate
   ```

   If the second attempt also fails, use AskUserQuestion with:
   - question: "DAG.json generation failed after two attempts. The project was initialized but the dependency graph is missing."
   - Options:
     - "Retry" -- "Try generating DAG.json again"
     - "Skip" -- "Continue without DAG.json. Run /rapid:status then `dag generate` manually later."
     - "Cancel" -- "Exit initialization. Planning files are preserved on disk."
   - If "Retry": Loop back and attempt DAG generation again.
   - If "Skip": Log a warning "WARNING: DAG.json was not generated. Run `dag generate` before starting sets." and continue to Step 10.
   - If "Cancel": End the skill with "Cancelled. Planning files preserved."

**If "Request changes":**

Ask the user freeform: "What changes would you like to make to the roadmap?"

Re-spawn the roadmapper agent with:
- All original context (SUMMARY.md, full project brief, team size, model)
- The user's change request as additional feedback
- The previous roadmap proposal for reference
- The same CRITICAL sets-only instruction (no waves or jobs)

Present the revised roadmap and use AskUserQuestion again (same Accept/Request changes/Cancel options). This loop continues until the user accepts or cancels.

**If "Cancel":**

Print: "Roadmap generation cancelled. Your scaffold and research files are preserved in .planning/. You can re-run /rapid:init to generate a roadmap later."

End the skill.

**On error:** Show progress breadcrumb: `init [scaffold done, research done, synthesis done, roadmap failed] > start-set > discuss-set > plan-set > execute-set > review > merge`

---

## Step 9.5: Write PRINCIPLES.md

If `principlesData` is not null (principles were captured in Step 4E):

1. Generate the PRINCIPLES.md content:

   ```javascript
   const { generatePrinciplesMd } = require('./src/lib/principles.cjs');
   const content = generatePrinciplesMd(principlesData);
   ```

2. Write `.planning/PRINCIPLES.md` using the Write tool.

3. Display: "Wrote {N} principles across {M} categories to .planning/PRINCIPLES.md"

If `principlesData` is null (user skipped principles): Skip this step silently. Do not write an empty PRINCIPLES.md.

---

## Step 10: Auto-Commit Planning Artifacts

Before displaying the completion summary, auto-commit all generated planning artifacts.

First, check if there are uncommitted changes outside `.planning/`:

```bash
OUTSIDE_CHANGES=$(git status --porcelain | grep -v '^\?\? ' | grep -v '.planning/' | head -5)
if [ -n "$OUTSIDE_CHANGES" ]; then
  echo "WARNING: Uncommitted changes exist outside .planning/. These will NOT be included in the auto-commit."
fi
```

If there are changes outside `.planning/`, warn the user but proceed with the scoped commit.

Then stage and commit only `.planning/` files:

```bash
git add .planning/
# Check if there are staged changes
if git diff --cached --quiet; then
  echo "No planning artifacts to commit."
else
  git commit -m "rapid:init({project-name}): initialize project planning artifacts"
fi
```

Replace `{project-name}` with the actual project name from Step 4A.

Display the commit result: "Committed planning artifacts: {commit hash}"

If the commit fails for any reason, warn the user but do NOT fail the entire init process. The planning files are already written to disk.

---

## Step 10.5: Web Dashboard Registration

If `RAPID_WEB=true` is set, automatically register this project with Mission Control.

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
node -e "
const path=require('path'); const { isWebEnabled, registerProjectWithWeb } = require(path.join(path.dirname('${RAPID_TOOLS}'), '..', 'lib', 'web-client.cjs'));
if (!isWebEnabled()) {
  console.log(JSON.stringify({ skipped: true }));
  process.exit(0);
}
registerProjectWithWeb(process.cwd()).then(result => {
  console.log(JSON.stringify(result));
});
"
```

Parse the JSON result:

- If `skipped` is `true`: silently continue to Step 11. Do NOT display anything about web registration.
- If `success` is `true`: display "Registered with Mission Control."
- If `success` is `false`: display "Mission Control unavailable. Run `/rapid:register-web` later to register this project."

This step must NEVER fail the init process. Any error is informational only.

---

## Step 11: Completion

Display a final summary:

```markdown
## RAPID Project Initialized

**Project:** {project name}
**Description:** {description}
**Model:** {opus/sonnet}
**Team Size:** {team size description}
**Granularity:** {targetSetCount label, e.g., "Standard (6-10 sets)"}

**Roadmap:**
- {N} sets planned

**Files Created:**
- .planning/PROJECT.md
- .planning/ROADMAP.md
- .planning/STATE.json
- .planning/config.json
- .planning/REQUIREMENTS.md
- .planning/research/SUMMARY.md
- .planning/research/{research files}
- .planning/sets/{set}/CONTRACT.json (for each set)
- .planning/sets/{set}/DEFINITION.md (for each set)
- .planning/sets/DAG.json
- .planning/sets/OWNERSHIP.json

```

## Step 11.5: Workflow Guide

Display the RAPID lifecycle as a compact reference:

```markdown
### What's Next?

The RAPID lifecycle for each set:

1. `/rapid:status` -- see your project dashboard
2. `/rapid:start-set N` -- initialize a set for development
3. `/rapid:discuss-set N` -- capture implementation vision
4. `/rapid:plan-set N` -- research and plan waves
5. `/rapid:execute-set N` -- implement the plan
6. `/rapid:review N` -- review before merge
7. `/rapid:merge N` -- merge into main

Start with `/rapid:start-set 1` to begin your first set.
```

This is pure markdown output -- no bash commands. The agent displays this text exactly as shown.

## Step 12: Footer

Display the completion footer. The next command depends on team-size and set availability:

**When sets are available (common case):**

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display footer "/rapid:start-set 1" --breadcrumb "init [done] > start-set > discuss-set > plan-set > execute-set > review > merge"
```

**When no sets are planned:**

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display footer "/rapid:status" --breadcrumb "init [done] > start-set > discuss-set > plan-set > execute-set > review > merge"
```

---

## Error Handling

At every agent step (Steps 6-9), if an agent fails or returns an error:

1. Do NOT use bare STOP or halt.
2. Use AskUserQuestion with structured recovery options:
   - "Retry" -- Re-run the failed agent with the same inputs
   - "Skip" -- Continue without this agent's output (downstream agents will have less context)
   - "Cancel" -- Exit initialization cleanly

3. On ANY error in Steps 5-9, show a progress breadcrumb indicating what has been completed and what failed:
   ```
   init [scaffold done, research failed] > start-set > discuss-set > plan-set > execute-set > review > merge
   ```
   Adjust the breadcrumb content to reflect the actual state of progress. The user should always be able to see what succeeded and what needs attention.

This ensures the user always has control over error recovery and the pipeline never silently fails.

## Important Constraints

- **Agents must NOT write STATE.json directly.** The SKILL.md orchestrator writes STATE.json using the Write tool with validated roadmapper output.
- **All 6 research agents are independent.** No research agent reads another research agent's output. They only share the project description and brownfield analysis as inputs.
- **Contracts are generated by the roadmapper in a unified pass.** Individual sets do not generate their own contracts -- the roadmapper produces all contracts together to ensure cross-set consistency.
- **Roadmapper uses propose-then-approve.** The roadmapper returns a proposal; the user must explicitly accept before any files are written.
- **Sequential fallback for research.** If parallel Agent tool spawning is not available, fall back to sequential execution rather than failing.
- **Sets only in state.** STATE.json contains project > milestone > sets hierarchy. Do NOT include waves or jobs in STATE.json -- wave decomposition happens later during /plan-set.
- **CONTRACT.json at init.** CONTRACT.json files are generated at init time per set by the roadmapper to ensure cross-set interface consistency from the start.

## Anti-Patterns -- Do NOT Do These

- Do NOT reference `state transition wave` or `state transition job` -- these state commands do not exist in v3. Only set-level state transitions exist (via `state transition set`).
- Do NOT ask the roadmapper to produce waves or jobs -- v3 defers wave decomposition to /plan-set. The roadmapper outputs sets only.
- Do NOT reference WAVE-CONTEXT.md or wave directories -- v3 uses set-level CONTEXT.md only.
- Do NOT reference `/rapid:set-init` -- the v3 command is `/rapid:start-set`.
- Do NOT include "waves" or "total jobs" counts in the completion summary or roadmap presentation -- only show "N sets planned".
- Do NOT write waves or jobs arrays into STATE.json -- each set has only `{ id, name, status: "pending", branch }`.
