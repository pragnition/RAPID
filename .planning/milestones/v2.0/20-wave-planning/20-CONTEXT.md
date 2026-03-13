# Phase 20: Wave Planning - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Each wave gets a detailed implementation plan derived from user discussion, with per-job plans validated against interface contracts. This phase delivers /rapid:discuss (wave-level vision capture), wave research agent, Wave Planner (high-level per-job plans), Job Planner (detailed per-job implementation plans), and contract validation gate. Execution of jobs is Phase 21. Review is Phase 22.

</domain>

<decisions>
## Implementation Decisions

### Discuss interaction model
- /discuss is a standalone skill (`skills/discuss/SKILL.md`) -- developer runs `/rapid:discuss <wave>` manually
- /execute does NOT orchestrate discussion -- it checks if discussion happened and prompts if missing
- Discussion scope is per-wave holistic: identify gray areas across all jobs in the wave, then deep-dive selected areas. Jobs are context but not individually discussed
- Every AskUserQuestion includes a "Claude decides" option so the developer can opt out per-question
- /discuss transitions wave to 'discussing' AND set from 'pending' to 'planning' (first discussion triggers set transition)
- Discussion style is similar to GSD's discuss-phase: gray area identification, multi-select which to discuss, deep-dive each area with 4-question loops

### Planning pipeline depth
- Two-stage planning: Wave Planner produces high-level per-job plans, then Job Planner expands each into detailed implementation plans
- User discussion happens ONLY at wave level in /discuss -- both Wave Planner and Job Planner work autonomously from CONTEXT.md without additional user discussion per job
- Output: JOB-PLAN.md per job with approach, files to create/modify, implementation steps, acceptance criteria
- JOB-PLAN.md files live in the set's worktree: `.planning/waves/{wave-id}/{job-id}-PLAN.md`
- Wave Planner produces an intermediate WAVE-PLAN.md with high-level job approach summaries that Job Planner consumes

### Research scope per wave
- Single focused research agent per wave (not 5 parallel agents like init)
- Research agent reads CONTEXT.md + CONTRACT.json + targeted codebase files related to the wave's jobs
- Research agent uses Context7 MCP for documentation lookups on libraries/frameworks in scope
- Output: WAVE-RESEARCH.md stored in set's `.planning/waves/{wave-id}/WAVE-RESEARCH.md`
- Research is more focused than init research since specific jobs and their file targets are already known

### Contract validation flow
- Post-planning gate: after all job plans are produced, contract validation runs before transitioning wave to 'executing'
- Simple violations (missing exports, type mismatches) are auto-fixed in the plan
- Complex violations (structural conflicts, cross-set incompatibilities) escalate to user with specific choices: fix plan, update contract, or override
- Cross-set import validation: checks that referenced imports match what other sets' contracts promise to export, but ignores minor differences
- Produces VALIDATION-REPORT.md in the set's `.planning/` directory with violations found, auto-fixes applied, and cross-set dependency check results

### Claude's Discretion
- Internal agent prompt design for wave research agent, Wave Planner, and Job Planner role modules
- WAVE-PLAN.md template structure and level of detail
- How "minor differences" are distinguished from "contract violations" in cross-set validation
- Error handling and recovery during the multi-stage planning pipeline
- How the discuss skill identifies gray areas for a given wave (analysis heuristics)
- Exact AskUserQuestion wording and option design within /discuss

</decisions>

<specifics>
## Specific Ideas

- Discussion model follows GSD discuss-phase pattern: gray areas identified by analyzing the wave goal, user selects which to discuss, 4-question loops per area
- "Claude decides" option on every question -- the developer can delegate any individual decision
- User does not need to care about how each job is implemented -- vision is captured at wave level, planners handle details
- JOB-PLAN.md is the primary artifact consumed by the executor agent in Phase 21

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `state-machine.cjs`: readState, writeState, findWave, findJob, transitionWave, transitionSet -- full state management for wave lifecycle
- `state-transitions.cjs`: Wave transitions (pending > discussing > planning > executing > reconciling > complete), Job transitions (pending > executing > complete/failed)
- `state-schemas.cjs`: WaveState and JobState Zod schemas for validation
- `contract.cjs`: CONTRACT_META_SCHEMA validation, createOwnershipMap() for file ownership, Ajv-based schema validation
- `assembler.cjs`: assembleAgent() with context injection slots -- extend for new wave-related agent roles
- `dag.cjs`: DAG computation for dependency ordering -- reuse for wave/job ordering
- `rapid-tools.cjs`: CLI with `state transition wave/job` commands already implemented

### Established Patterns
- AskUserQuestion at every decision gate (v1.1 pattern)
- .env fallback loading in all skills
- Agent tool for subagent spawning with role instructions
- Lock-protected atomic writes for STATE.json
- Structured JSON CLI output parsed by skills
- Agent role modules in `src/modules/roles/` (15 existing roles)

### Integration Points
- New: `skills/discuss/SKILL.md` -- wave discussion skill
- Modified: `skills/plan/SKILL.md` or new wave-plan skill -- triggers research + wave planner + job planner pipeline
- New agent roles: `role-wave-researcher.md`, `role-wave-planner.md`, `role-job-planner.md`
- `rapid-tools.cjs`: May need new subcommands for discuss/wave-plan/validate-contracts
- Existing `skills/execute/SKILL.md`: Needs update to check for discuss/plan completion before executing

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 20-wave-planning*
*Context gathered: 2026-03-07*
