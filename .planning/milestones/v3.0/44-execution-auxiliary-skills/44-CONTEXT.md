# Phase 44: Execution & Auxiliary Skills - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewrite /execute-set for v3 (PLAN.md-per-wave, no wave/job state, artifact-based re-entry). Implement three auxiliary commands: /quick (ad-hoc changes without set structure), /add-set (add sets mid-milestone), and /new-version (complete milestone, start new version). All commands operate with set-level state only.

</domain>

<decisions>
## Implementation Decisions

### Execute-set dispatch model
- One rapid-executor spawned per wave, waves executed sequentially
- No parallel per-job execution within waves (v2's JOB-PLAN.md model removed)
- Subagents only -- no Agent Teams mode detection or prompt (sequential waves don't benefit from it)
- RAPID:RETURN protocol remains for structured executor returns

### Execute-set re-entry detection
- Dual mechanism: git commit inspection + marker files (WAVE-COMPLETE.md)
- After each wave completes, write a marker file AND verify corresponding commits exist in worktree branch
- On re-entry, check marker files first (fast), then verify against commits (defense-in-depth)
- Re-execute waves that have no marker or whose commits don't match

### Execute-set verification
- Lean verifier agent runs after all waves complete
- Verifier reads success criteria from ROADMAP.md set description and checks they're met
- If gaps found: verifier produces GAPS.md listing unmet criteria
- Gap resolution loop: user runs `/plan-set <set> --gaps` then `/execute-set <set> --gaps` to close gaps
- Verification is non-blocking -- produces GAPS.md report, user decides next action

### Execute-set reconciliation
- Simplified from v2: basic checks only (did executor commit? are there uncommitted changes?)
- Remove job-level file ownership reconciliation (no jobs in v3)
- Remove commit format validation, lean review step, and per-wave reconciliation reports

### /quick design
- In-place execution on current branch (no worktree created)
- Light state entry in STATE.json for history/auditability (not full set lifecycle)
- Pipeline: planner agent → plan-verifier agent → executor agent (mini lifecycle, fully autonomous)
- Lean verifier runs after execution (same GAPS.md pattern as execute-set)
- User provides task via interactive prompt (not inline argument)
- No discuss phase -- user's task description IS the context

### /add-set workflow
- Interactive discovery: ask user what the set should accomplish (mini discuss-set with a few questions)
- Produces set description for ROADMAP.md and adds to STATE.json as pending set
- Generates CONTRACT.json for the new set (boundary clarity with existing sets)
- Does NOT auto-start -- user runs /start-set separately after add-set
- Suggests /start-set as next action

### /new-version changes
- Keep full 5-researcher pipeline + synthesizer + roadmapper (same depth as /init)
- Roadmapper outputs sets only (no waves) -- consistent with v3 /init flow
- Wave decomposition happens later in /plan-set
- User gets the option to archive old milestone's planning artifacts (not forced)
- Archive destination: .planning/archive/{milestone}/ if user chooses to archive
- STATE.json updated: new milestone entry, carry-forward sets if selected

### Claude's Discretion
- Exact marker file format and content for WAVE-COMPLETE.md
- How /quick structures the planner prompt (task description → plan format)
- /add-set question depth (how many discovery questions before creating set)
- How the gap resolution loop interacts with plan-set internals (--gaps flag behavior)
- Error handling and recovery for each command
- Progress breadcrumb format for execute-set (continuing Phase 43's UX-01 pattern)

</decisions>

<specifics>
## Specific Ideas

- Execute-set is radically simpler than v2: one executor per wave, sequential waves, no agent teams, no job-level state
- Gap resolution creates a natural re-entry loop: execute → verify → find gaps → plan gaps → execute gaps → verify again
- /quick is the fire-and-forget command -- user describes what they want, three agents handle the rest
- "Agents shouldn't prompt the user for every little detail" applies to /quick especially -- fully autonomous after task description

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/execute-set/SKILL.md` (516 lines): v2 execution skill -- needs full rewrite (references JOB-PLAN.md, wave/job state, agent teams, reconciliation)
- `skills/new-version/SKILL.md` (236 lines): v2 new-version -- mostly reusable, needs roadmapper output simplification and archive option
- `agents/rapid-executor.md`: v3 hand-written executor agent (Phase 42) -- reads PLAN.md, artifact-based completion
- `agents/rapid-verifier.md`: Generated verifier agent -- can be used for lean post-execution verification
- `agents/rapid-planner.md`: v3 hand-written planner agent (Phase 42) -- reusable for /quick's planning step
- `agents/rapid-plan-verifier.md`: Existing plan verifier -- reusable for /quick's verification step

### Established Patterns
- Environment preamble: RAPID_ROOT + .env loading + RAPID_TOOLS check in every skill
- AskUserQuestion for all user interactions
- `rapid-tools.cjs` CLI for all state mutations
- RAPID:RETURN protocol for agent structured output
- Progress breadcrumbs at completion and on errors (Phase 43 UX-01)
- Stage banners per command via `rapid-tools.cjs display banner`

### Integration Points
- `rapid-tools.cjs state transition set`: Set state transitions (pending → discussing → planning → executing → complete → merged)
- `rapid-tools.cjs resolve set`: Numeric ID resolution
- `rapid-tools.cjs state get --all`: Full state for re-entry detection
- `rapid-tools.cjs state add-milestone`: Used by /new-version
- `.planning/waves/{setId}/`: Where PLAN.md files live (created by plan-set)
- `.planning/sets/{setId}/`: Where CONTRACT.json and SET-OVERVIEW.md live

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 44-execution-auxiliary-skills*
*Context gathered: 2026-03-13*
