# CONTEXT: readme-and-onboarding

**Set:** readme-and-onboarding
**Generated:** 2026-04-06
**Mode:** interactive

<domain>
## Set Boundary
Rewrite README.md for beginners: problem statement (context rot), single install path, /clear mental model, annotated quickstart with /clear interleaved, and "First Project" walkthrough. Update DOCS.md with /clear session management section. Update help skill output for consistency. No runtime code changes -- documentation only.
</domain>

<decisions>
## Implementation Decisions

### README Opening Hook
- Use **hook-then-pivot** approach: open with a relatable scenario ("You're 45 minutes into a Claude session and it starts repeating itself...") then pivot to how RAPID solves it
- Use **narrative contrast** -- weave the before/after naturally into the story flow without a literal "Without RAPID / With RAPID" comparison table
- **Rationale:** Beginners need to immediately feel the pain point before seeing features. A relatable hook captures attention; narrative contrast avoids formulaic side-by-side tables while still conveying the value shift.

### Problem Statement Depth
- Use **balanced depth**: brief relatable hook ("sessions degrade") + one technical sentence ("as context fills, the model loses earlier decisions")
- Include a **brief 3-4 line scenario** illustrating context rot in action -- short, punchy, relatable (e.g., "You ask Claude to add auth, it builds half the system, then on the 4th file it forgets the schema it chose")
- **Rationale:** Target audience ranges from first-timers to experienced Claude Code users. Balanced framing resonates with both without alienating either. A concrete scenario makes the pain visceral without adding excessive length.

### Install Section Design
- Highlight **both** the plugin install command AND `/rapid:install` as the follow-up step -- user explicitly requested that `/rapid:install` is prominently visible alongside the marketplace install command
- Single prerequisite line below install: "Requires Node.js 22+" -- git is implied for developers
- **Rationale:** Users need to know that installation is two steps: install the plugin, then run `/rapid:install` to configure the environment. A single prerequisite line avoids friction without hiding a critical requirement.

### /clear Mental Model Positioning
- Use **both** approaches: brief 2-3 sentence concept callout before the quickstart explaining what /clear does and why, then reinforce by showing /clear between every command in the quickstart
- **Moderate explanation**: 2-3 sentences connecting context rot (the problem) to /clear (the solution). Frame it as "this is how RAPID stays reliable" rather than a chore
- **Rationale:** /clear is fundamental to the RAPID workflow but completely invisible in the current README. A concept callout primes the reader; quickstart reinforcement builds the habit. Moderate depth connects the problem statement payoff without lecturing.

### First Project Walkthrough
- **Moderate detail**: each step gets 2-3 lines explaining what happens and what to expect, with /clear between each command. ~40 lines total
- **Abstract/generic project**: "your project" with no specific tech stack. Steps reference generic concepts ("your features", "your sets"). Universally applicable
- **Rationale:** The quickstart already shows the raw command sequence; the walkthrough adds the "what to expect" layer. Moderate detail is enough to follow along without hand-holding. Abstract framing avoids alienating users with different tech stacks.

### Content Migration
- **Keep SVG diagrams** (lifecycle-flow.svg, agent-dispatch.svg) in README for visual appeal and credibility. Move the detailed "How It Works" prose to DOCS.md with a link
- **Keep the full command reference table** in README -- redundancy with the quickstart is acceptable because tables are scannable and serve a different purpose (quick lookup vs. sequential learning)
- **Rationale:** Diagrams are the first thing a reader scans when evaluating a tool's sophistication. The command table serves as a scannable reference that complements the narrative quickstart.

### DOCS.md /clear Integration
- Add a dedicated **"Session Management" section** in DOCS.md (after Installation, before Core Lifecycle) explaining the /clear pattern, why it matters, and which commands show /clear footers
- **No CLEAR-POLICY.md reference in DOCS.md** -- CLEAR-POLICY.md is internal. Instead, reference it in **technical_documentation.md** where contributors would look for implementation details
- **Rationale:** A single dedicated section is discoverable and avoids repetitive per-command notes. Keeping internal planning artifacts out of user-facing docs maintains clean separation; technical_documentation.md is the right home for contributor-facing policy details.

### Help Skill Alignment
- **Keep condensed** command reference format. Add a single /clear tip line about running /clear between commands. Help serves a different purpose (mid-session reference) than README (onboarding)
- **Show /clear between steps** in the workflow diagram to reinforce the pattern at the point of reference
- **Rationale:** Users type `/rapid:help` to quickly recall commands, not to re-read onboarding material. A condensed format with /clear in the workflow diagram reinforces the pattern without bloating the output.

### Claude's Discretion
- No areas deferred to Claude's discretion -- all 8 gray areas were discussed interactively.
</decisions>

<specifics>
## Specific Ideas
- The install section should prominently feature both the marketplace install command AND `/rapid:install` as a two-step process, not just the marketplace command
- CLEAR-POLICY.md cross-reference belongs in technical_documentation.md, not DOCS.md
- The "How It Works" prose from README should be migrated to DOCS.md rather than deleted entirely
</specifics>

<code_context>
## Existing Code Insights
- `renderFooter()` in `src/lib/display.cjs` produces the /clear footer -- README should describe the user-visible behavior, not the implementation
- CLEAR-POLICY.md at `.planning/CLEAR-POLICY.md` defines which skills show footers (17 with, 10 without) -- use this as the source of truth for the DOCS.md session management section
- Current README install section shows two paths: `/plugin install rapid@pragnition/pragnition-public-plugins` and the two-step marketplace add + install -- needs consolidation to one primary path
- Help skill at `skills/help/SKILL.md` is 108 lines with `disable-model-invocation: true` -- changes must preserve the static-output constraint
- Current README has SVG diagrams at `branding/lifecycle-flow.svg` and `branding/agent-dispatch.svg` that should be preserved
- DOCS.md version badge says 6.0.0 -- needs updating to match current version
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
