# CONTEXT: init-branding-integration

**Set:** init-branding-integration
**Generated:** 2026-04-07
**Mode:** interactive

<domain>
## Set Boundary
Insert an optional branding step into the `/rapid:init` flow at Step 4B.5 -- between project discovery (Step 4B) and granularity preference (Step 4C). When opted in, runs the full branding interview (all 4 rounds + anti-patterns) adapted to the detected project type. Generates BRANDING.md and index.html artifacts. Skip is the default. No branding server is started during init. Branding status is surfaced in the 4D summary and injected into the UX research agent.
</domain>

<decisions>
## Implementation Decisions

### Branding Step Flow Integration
- Use a **clear section break** presentation: explicit optional sidebar with framing that makes the skippable nature obvious. Not a seamless continuation (feels committed) or contextual pitch (feels like upselling).
- **Rationale:** Users should clearly understand this is an optional detour, not a required part of the init flow. Clear section breaks set expectations and respect the user's time.

### Mid-Interview Bail-Out
- **Discard and continue**: if a user opts in but wants to bail mid-interview, drop all partial answers and continue init as if branding was skipped. No partial BRANDING.md is written.
- **Rationale:** Incomplete branding artifacts are worse than no branding -- they could confuse downstream agents expecting complete sections. Users can always run `/rapid:branding` later for a full experience.

### Pre-Scaffolding Directory Strategy
- **Eager `mkdir -p`**: create `.planning/branding/` immediately during Step 4B.5 before writing artifacts. Do not buffer branding data.
- **Rationale:** Simple and self-contained. No state threading across steps. The directory existing before scaffolding is harmless -- Step 5 scaffold uses `mkdir -p` too and will not conflict.

### Re-Init Handling
- **Offer overwrite choice**: when `.planning/branding/BRANDING.md` already exists, present an AskUserQuestion asking whether to keep existing branding or replace it. This costs 1 extra question from the budget.
- **Rationale:** User explicitly preferred giving the choice over silently skipping. Users who re-init may want fresh branding, especially if the project scope changed.

### Interview Scope (Budget Relaxation)
- **Full interview**: include all 4 branding rounds (Visual Identity, Component Style, Terminology, Interaction Patterns) plus the anti-patterns question. Update CONTRACT `question-budget` from max 4 to max 7 calls (1 opt-in + 1 possible re-init check + 5 interview).
- **Rationale:** User explicitly wanted to include all dimensions rather than condensing. The skip-is-default contract means only opted-in users experience the extra questions, so non-branding users are unaffected.

### Project-Type Adaptation
- **Project-type-adaptive questions**: reuse the same webapp/CLI/library question variants from the full `/rapid:branding` skill. Since the project type is already known from Step 4B discovery, there is no extra detection cost.
- **Rationale:** Adapted questions yield higher-quality branding output for the specific project type. The type is free information from discovery.

### 4D Summary Branding Status
- **Include a branding status line** in the Step 4D summary confirmation: "Branding: configured" or "Branding: skipped".
- **Rationale:** The 4D summary is the last review before scaffolding. One line of overhead is minimal and gives the user a complete picture.

### Research Agent Branding Injection
- **Inject branding context into the UX researcher only** (Step 7 research agents). The other 5 researchers (architecture, features, oversights, pitfalls, stack) do not receive branding context.
- **Rationale:** UX research directly benefits from knowing branding direction to avoid suggesting patterns that conflict. Other researchers focus on technical/architectural concerns where branding is noise.

### Claude's Discretion
- No areas were left to Claude's discretion -- user provided input on all gray areas.
</decisions>

<specifics>
## Specific Ideas
- The opt-in question should use a "clear section break" style -- e.g., a visual separator or header like "Optional: Project Branding" before the opt-in AskUserQuestion
- The re-init overwrite choice should be concise: "Keep existing branding" vs "Set up new branding" to minimize friction
- When injecting branding into the UX researcher, include the full BRANDING.md content (not a summary) since it's already designed to be within the 50-150 line prompt budget
- The anti-patterns question from branding should be included as the final question in the interview portion, matching the full branding skill's ordering
</specifics>

<code_context>
## Existing Code Insights
- `skills/init/SKILL.md` is the sole owned file -- all changes go here. Step 4B.5 inserts between the end of discovery (around line 430) and Step 4C granularity (line 442)
- `skills/branding/SKILL.md` contains the full interview question text for all 4 rounds + anti-patterns (Step 4, lines 139-241). The project-type-adaptive questions can be adapted directly from these
- The branding skill's Step 5 generates BRANDING.md with project-type-conditional formats (webapp vs CLI/library). The init branding step should use the same format
- The branding skill's Step 5b (logo.svg) and Step 5c (wireframe.html) should NOT be generated during init -- only BRANDING.md and index.html
- The branding skill starts the branding server in Step 6 -- init must NOT do this (CONTRACT behavioral invariant `no-server-during-init`)
- Step 4D summary is compiled around line 468 -- the branding status line should be added to the brief display
- Step 7 research agents are spawned around line 747+ -- the UX researcher prompt needs a conditional branding context injection
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
