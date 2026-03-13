# Phase 43: Planning & Discussion Skills - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewrite /init, /start-set, /discuss-set, and /plan-set skills for v3. Collapsed planning pipeline produces one PLAN.md per wave in 2-4 agent spawns (not 15-20). Discussion moves from wave-level to set-level. All skills operate with set-level state only (no wave/job state tracking).

</domain>

<decisions>
## Implementation Decisions

### discuss-set interaction model
- Set-level discussion (not wave-level like v2)
- Structured 4 gray area Q&A: agent identifies 4 gray areas, user selects which to discuss
- Batch all questions per area into a single AskUserQuestion call (2-3 questions per area answered at once)
- After Q&A, agent compiles follow-up questions only if genuine gaps remain — skip follow-up if the 4 areas covered everything
- Captures vision/what, not implementation/how — agent doesn't prompt for every detail

### discuss-set --skip (auto-context)
- When --skip is provided, agent auto-generates CONTEXT.md without user discussion
- Uses three sources: ROADMAP.md set description + codebase scan + spawns a quick researcher agent
- All decisions become Claude's discretion in the auto-generated context

### plan-set pipeline
- Fully autonomous — user runs /plan-set, no checkpoints or approval gates during planning
- Agent flow: researcher → planner (decomposes into waves + plans each wave, or spawns wave-planners for 3-4 waves) → verifier
- Verifier is a separate spawned agent (not internal to planner)
- If verification fails: re-plan failing waves once, re-verify. If still fails after 1 retry, surface issues to user
- Brief confirmation output at the end: set name, wave count, verification status, next command. No full plan preview.

### start-set behavior
- Does NOT auto-chain into discuss-set — just suggests it as next step
- Still spawns a lightweight set-planner agent to generate SET-OVERVIEW.md (provides context for discuss-set)
- Creates worktree + scoped CLAUDE.md + SET-OVERVIEW.md

### command chaining and UX
- Each command suggests exactly one next action (UX-02)
- Progress breadcrumb shown at end of each command: `init ✓ | start-set ✓ | discuss-set ▶ | plan-set · | execute-set ·`
- Error messages show what is done, what is missing, what to run next (UX-01)

### init flow
- Keep deep discovery conversation (8-15+ questions across 10 areas) — do not streamline
- Batch discovery questions by topic (group related questions together) instead of one-at-a-time
- Roadmapper outputs sets only, no wave structure — waves are determined during plan-set by the planner
- CONTRACT.json files generated at init time (not deferred) — sets need boundaries for independent work
- STATE.json simplified: project > milestone > sets (no waves/jobs)
- 6-researcher pipeline unchanged (5 domain + UX)

### Claude's Discretion
- Exact progress breadcrumb format and rendering
- How the researcher agent invoked by --skip differs from the full research pipeline
- Internal planner threshold for self-planning vs spawning wave-planners (the "3-4 waves" heuristic)
- Error message formatting and breadcrumb styling
- How to handle partial failures gracefully during autonomous planning

</decisions>

<specifics>
## Specific Ideas

- "Agents shouldn't prompt the user for every little detail — they are intelligent enough" (from refresh.md)
- "The project should fully capture the users _vision_ (the why) but need not capture _implementation_ (the how) unless strictly necessary" (from refresh.md)
- "The user is meant to /clear context after every command. Therefore, each command needs to constantly update the state of the project when needed" (from refresh.md)
- Plan-set should be fire-and-forget from the user's perspective — run one command, get back wave plans
- discuss-set batching: ask all questions about one area in a single go, not one question at a time

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/init/SKILL.md` (706 lines): Current init skill — deep discovery conversation to keep, needs roadmapper output simplification
- `skills/start-set/SKILL.md` (184 lines): Current start-set — worktree creation flow to keep, set-planner spawn to keep
- `skills/discuss-set/SKILL.md` (351 lines): Current discuss-set — wave-level, needs full rewrite to set-level with batched Q&A
- `skills/plan-set/SKILL.md` (605 lines): Current plan-set — heavy wave-analyzer + per-wave pipeline, needs radical simplification
- `agents/rapid-planner.md`: v3 hand-written planner agent (from Phase 42) — decomposes sets into waves, produces PLAN.md per wave
- `agents/rapid-plan-verifier.md`: Existing verifier agent — can be reused for plan-set verification step
- `agents/rapid-set-planner.md`: Existing set overview agent — used by start-set
- `agents/rapid-wave-researcher.md`, `rapid-wave-planner.md`: v2 agents being retired — plan-set replaces their function

### Established Patterns
- Environment preamble: RAPID_ROOT + .env loading + RAPID_TOOLS check in every skill
- AskUserQuestion for all user interactions
- `rapid-tools.cjs` CLI for all state mutations
- RAPID:RETURN protocol for agent structured output
- XML prompt structure: identity > conventions > tools > role > returns

### Integration Points
- `rapid-tools.cjs state transition set`: Set state transitions (pending → discussing → planning → executing → complete → merged)
- `rapid-tools.cjs resolve set/wave`: Numeric ID resolution for user input
- `rapid-tools.cjs display banner`: Stage banners per command
- `rapid-tools.cjs init *`: Scaffold, detect, write-config, research-dir commands
- `.planning/STATE.json`: Set-level state only (Phase 38 simplified schema)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 43-planning-discussion-skills*
*Context gathered: 2026-03-13*
