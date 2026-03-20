# Wave 1 Plan: Rewrite Step 4B Discovery + Granularity + Summary Confirmation

## Objective

Rewrite the init SKILL.md Step 4B to replace freeform prose-based AskUserQuestion calls with structured AskUserQuestion calls using pre-filled options. Add a granularity preference question after discovery. Add a summary-and-confirmation step before roadmap generation. Update Step 9 roadmapper invocation to pass targetSetCount and REQUIREMENTS.md criteria.

All changes are to `skills/init/SKILL.md` only.

## Owned Files

- `skills/init/SKILL.md`

## Tasks

### Task 1: Rewrite Step 4B Batch 1 (Vision and Users)

**File:** `skills/init/SKILL.md` (lines 183-195)

**Action:** Replace the current Batch 1 freeform AskUserQuestion with a hybrid approach:

- **Area 1 (Vision/problem statement)** stays freeform. Reword the prompt slightly to be clearer and more structured in what it asks, but keep it as a single freeform AskUserQuestion call. The question should ask: "What are you building and why? What problem does it solve? What makes this different from existing solutions?" -- essentially the same content, as a standalone freeform call.

- **Area 2 (Target users)** becomes a structured AskUserQuestion call with pre-filled options:
  - question: "Who are the primary target users?"
  - Options:
    - "B2C consumers" -- "End users interacting through web or mobile apps"
    - "B2B enterprise" -- "Business customers with team/org structures"
    - "Internal team tools" -- "Internal company tools for employees"
    - "Developer/open-source" -- "Developers, CLI users, or open-source community"

- **Area 3 (Scale targets)** becomes a structured AskUserQuestion call with pre-filled options:
  - question: "What scale are you targeting initially?"
  - Options:
    - "Prototype (<100 users)" -- "Proof of concept or personal project"
    - "Startup (100-10K users)" -- "Early product with growing user base"
    - "Growth (10K-100K users)" -- "Scaling product with significant traffic"
    - "Scale (100K+ users)" -- "High-scale production system"

Keep the existing follow-up logic: "After receiving the response, analyze it. If the user's vision or target audience is vague, ask ONE targeted follow-up before proceeding."

**What NOT to do:**
- Do NOT remove the follow-up logic after the batch.
- Do NOT change the batch header ("Batch 1: Vision and Users") -- keep it recognizable.
- Do NOT add more than 4 options per structured question.

**Verification:** Read the modified lines and confirm: Area 1 uses freeform AskUserQuestion, Areas 2 and 3 use structured AskUserQuestion with pre-filled options, follow-up logic is preserved.

---

### Task 2: Rewrite Step 4B Batch 2 (Features and Technical)

**File:** `skills/init/SKILL.md` (lines 197-208)

**Action:** Replace the current Batch 2 freeform AskUserQuestion with a hybrid approach:

- **Area 3 (Must-have features)** stays freeform. Single freeform AskUserQuestion call asking: "What are the must-have features for v1? Walk me through the primary user journey from start to finish. Also mention any nice-to-have features that can wait, and anything you explicitly do NOT want."

  This combines Areas 3 and 4 into one freeform call since both are open-ended feature discussions.

- **Area 5 (Tech stack)** becomes a structured AskUserQuestion call with pre-filled options:
  - question: "What is your primary tech stack preference?"
  - Options:
    - "React/Next.js + Node" -- "JavaScript/TypeScript full stack with React frontend"
    - "Python + FastAPI/Django" -- "Python backend with your choice of framework"
    - "Go/Rust backend" -- "Systems-oriented backend language"
    - "No preference" -- "Let research determine the best stack for this project"

- **Area 6 (Existing dependencies)** becomes a structured AskUserQuestion call with pre-filled options:
  - question: "What is the starting point for this project?"
  - Options:
    - "Greenfield" -- "Starting from scratch, no existing code"
    - "Brownfield" -- "Building on or modifying an existing codebase"
    - "Integration" -- "New code that integrates with existing external APIs/services"
    - "Migration" -- "Porting or rewriting an existing system"

Keep the existing follow-up logic after the batch.

**What NOT to do:**
- Do NOT split must-have and nice-to-have features into separate structured questions -- they are inherently open-ended.
- Do NOT list specific technologies as options (e.g., "PostgreSQL" vs "MongoDB") -- use categories.

**Verification:** Read modified lines and confirm: Features question is freeform, tech stack and dependencies use structured options.

---

### Task 3: Rewrite Step 4B Batch 3 (Scale and Integrations)

**File:** `skills/init/SKILL.md` (lines 210-221)

**Action:** Replace the current Batch 3 freeform AskUserQuestion with structured calls:

- **Area 7 (Data/traffic expectations)** -- this was already covered by the scale question in Batch 1 (Area 3). Replace with a more specific structured question:
  - question: "What are your real-time and performance requirements?"
  - Options:
    - "Standard web app" -- "Page loads, form submissions, typical CRUD operations"
    - "Real-time features needed" -- "WebSockets, live updates, collaborative editing"
    - "High throughput" -- "Batch processing, data pipelines, high API call volume"
    - "Low latency critical" -- "Sub-100ms response times, gaming, trading"

- **Area 8 (Compliance)** becomes a structured AskUserQuestion call:
  - question: "Any compliance or regulatory requirements?"
  - Options:
    - "None required" -- "No specific regulatory requirements"
    - "GDPR" -- "EU data protection regulation"
    - "HIPAA" -- "Healthcare data protection (US)"
    - "SOC2" -- "Security and availability auditing"

- **Area 9 (Third-party integrations)** becomes a structured AskUserQuestion call:
  - question: "What types of third-party integrations are needed?"
  - Options:
    - "Payment processing" -- "Stripe, PayPal, or similar payment APIs"
    - "Auth providers" -- "OAuth, SSO/SAML, or identity providers"
    - "Cloud services" -- "AWS, GCP, Azure services, storage, CDN"
    - "None / minimal" -- "Mostly self-contained, few external dependencies"

- **Area 10 (Auth approach)** becomes a structured AskUserQuestion call:
  - question: "What authentication approach do you prefer?"
  - Options:
    - "OAuth / social login" -- "Google, GitHub, social sign-in"
    - "Email / password" -- "Traditional email and password with sessions"
    - "SSO / SAML" -- "Enterprise single sign-on"
    - "API keys" -- "Token-based authentication for API/developer use"

Keep the instruction: "If the user has already addressed some of these areas in previous batches, note that and skip the already-covered items."

**What NOT to do:**
- Do NOT bundle all 4 questions into a single freeform call -- each area gets its own structured AskUserQuestion.
- Do NOT remove the adaptive skip logic.

**Verification:** Read modified lines. All 4 areas use structured AskUserQuestion with pre-filled options. Adaptive skip logic preserved.

---

### Task 4: Rewrite Step 4B Batch 4 (Context and Success)

**File:** `skills/init/SKILL.md` (lines 223-238)

**Action:** Replace the current Batch 4 freeform AskUserQuestion. This batch has 4 discovery areas (7-10 in the original numbering, but the original numbering is ambiguous with the research mapping -- use the actual content):

- **Team experience** stays freeform: Single freeform AskUserQuestion asking "What is your team's experience with the likely tech stack? Any lessons learned from similar projects? Are there existing products that do something similar -- what do they do well or poorly?"

  This combines the experience and inspiration areas into one freeform call since both are contextual narratives.

- **Non-functional requirements** becomes a structured AskUserQuestion:
  - question: "What non-functional requirements are important?"
  - Options:
    - "Security beyond basics" -- "Encryption at rest, audit logging, penetration testing"
    - "Accessibility (a11y)" -- "WCAG compliance, screen reader support"
    - "Internationalization (i18n)" -- "Multi-language, multi-locale support"
    - "Monitoring/observability" -- "APM, distributed tracing, alerting"

- **Success criteria** becomes a structured AskUserQuestion:
  - question: "What does 'done' look like for v1?"
  - Options:
    - "Working MVP" -- "Core features functional, rough edges acceptable"
    - "Production-ready with tests" -- "Fully tested, deployment pipeline, monitoring"
    - "Specific deadline target" -- "Must ship by a particular date"
    - "Feature-complete per spec" -- "All specified features implemented and polished"

Keep the adaptive behavior section (lines 234-238) and the completion check section (lines 240-246) unchanged.

**What NOT to do:**
- Do NOT remove or modify the "Adaptive behavior" section.
- Do NOT remove or modify the "Completion check" section.
- Do NOT change the PROJECT BRIEF template (lines 249-291).

**Verification:** Read modified lines. Experience+inspiration is freeform, non-functional reqs and success criteria are structured. Adaptive behavior and completion check sections are preserved unchanged.

---

### Task 5: Add Granularity Preference Question (New Step 4C)

**File:** `skills/init/SKILL.md` -- insert after the "Compile the project brief" section (after line 295, before Step 5)

**Action:** Insert a new sub-step `### 4C: Granularity Preference` between the end of Step 4B (line 295) and the `---` separator before Step 5 (line 297).

Content to insert:

```markdown
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
```

**What NOT to do:**
- Do NOT persist targetSetCount in config.json or any on-disk config.
- Do NOT modify Step 4A or the PROJECT BRIEF template.
- Do NOT add this question before the project brief is compiled -- it comes after.

**Verification:** Read the new section. Confirm it appears between the project brief compilation and Step 5. Confirm it uses AskUserQuestion with 4 options. Confirm the mapping table is present.

---

### Task 6: Add Summary Confirmation Step (New Step 4D)

**File:** `skills/init/SKILL.md` -- insert after the new Step 4C (granularity preference), before Step 5.

**Action:** Insert a new sub-step `### 4D: Summary Confirmation and Acceptance Criteria` after 4C.

Content to insert:

```markdown
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

Based on the discovery answers, generate formal acceptance criteria. These should be specific, testable statements derived from the user's requirements. Format them as:

```markdown
# Acceptance Criteria

## Functional Requirements
- [ ] {criterion derived from must-have features}
- [ ] {criterion derived from user journey}
...

## Non-Functional Requirements
- [ ] {criterion derived from scale/performance answers}
- [ ] {criterion derived from compliance answers}
...

## Success Criteria
- [ ] {criterion derived from success criteria answer}
...
```

Display the acceptance criteria to the user alongside the project brief.

**Confirmation prompt:**

Use AskUserQuestion with:
- question: "Please review the project brief and acceptance criteria above. Is everything accurate?"
- Options:
  - "Looks good, proceed" -- "Continue to scaffold, research, and roadmap generation"
  - "Need to change something" -- "Specify which section needs changes"
  - "Start over" -- "Restart the discovery conversation from the beginning"

**If "Looks good, proceed":**
Write the acceptance criteria to `.planning/REQUIREMENTS.md` using the Write tool. Then continue to Step 5.

**If "Need to change something":**
Ask freeform: "Which section needs changes? (e.g., Vision, Target Users, Features, Tech Stack, Scale, Compliance, Integrations, Auth, Non-functional, Success Criteria, Granularity)"

Based on the user's response, re-ask ONLY the questions for that specific section (using the same structured or freeform format as in the original batch). After receiving the updated answer, recompile the project brief and re-display the summary. Loop back to the confirmation prompt.

Limit re-ask cycles to 3 iterations. If the user requests changes a 4th time, suggest: "Consider running /rapid:init again to start fresh if the project scope has changed significantly."

**If "Start over":**
Loop back to Step 4B and restart the discovery conversation. Clear all previously collected answers.
```

**What NOT to do:**
- Do NOT skip the confirmation -- it is mandatory before proceeding.
- Do NOT write REQUIREMENTS.md until the user explicitly confirms.
- Do NOT allow infinite re-ask loops -- cap at 3 iterations.

**Verification:** Read the new section. Confirm it displays the project brief and acceptance criteria. Confirm it writes REQUIREMENTS.md on confirmation. Confirm the re-ask loop is capped at 3.

---

### Task 7: Update Step 9 Roadmapper Invocation

**File:** `skills/init/SKILL.md` (lines 564-599)

**Action:** Modify the roadmapper agent spawn task in Step 9 to include two new context items:

1. Add `## Target Set Count` section to the roadmapper agent task, after the `## Model Selection` section and before `## Working Directory`:

```
## Target Set Count
{targetSetCount from Step 4C -- e.g., "6-10" or "auto"}

Aim for roughly this number of sets. You may deviate if the project structure demands it, but note why in the roadmap output.
```

2. Add `## Acceptance Criteria` section after `## Target Set Count`:

```
## Acceptance Criteria
{content of .planning/REQUIREMENTS.md written in Step 4D}

Use these formal acceptance criteria to inform set boundaries. Each criterion should be traceable to at least one set.
```

Also update the "## Project Brief" description to note: "(includes description, features, constraints, scale, and all discovery context -- compiled from structured discovery in Step 4B)"

**What NOT to do:**
- Do NOT change the `## CRITICAL: Sets-Only Output` section.
- Do NOT change the `## Return Format` section.
- Do NOT remove any existing context sections.

**Verification:** Read the modified Step 9. Confirm `## Target Set Count` and `## Acceptance Criteria` sections are present. Confirm existing sections are unchanged.

---

### Task 8: Update Step 11 Completion Summary

**File:** `skills/init/SKILL.md` (lines 738-766)

**Action:** The completion summary at Step 11 already includes `- .planning/REQUIREMENTS.md` in the files list (line 758). Verify this is present and add a line to the summary display showing the granularity preference:

After `**Model:** {opus/sonnet}` and `**Team Size:** {team size description}`, add:
```
**Granularity:** {targetSetCount label, e.g., "Standard (6-10 sets)"}
```

**Verification:** Read Step 11 and confirm REQUIREMENTS.md is in the files list and the granularity line is present.

---

## Success Criteria

1. Step 4B uses a hybrid approach: freeform AskUserQuestion for vision, features, experience/inspiration; structured AskUserQuestion with pre-filled options for target users, scale, tech stack, dependencies, performance, compliance, integrations, auth, non-functional reqs, success criteria.
2. Every structured question has exactly 2-4 pre-filled options (the "Other" escape hatch is automatic).
3. Step 4C exists with granularity preference question (4 options).
4. Step 4D exists with summary confirmation displaying the full project brief and generated acceptance criteria.
5. Step 4D writes REQUIREMENTS.md on confirmation.
6. Step 4D has a re-ask loop capped at 3 iterations.
7. Step 9 passes targetSetCount and REQUIREMENTS.md content to the roadmapper.
8. The PROJECT BRIEF template (lines 249-291) is unchanged.
9. Adaptive behavior and completion check sections are preserved.
10. Step 11 shows granularity preference.
