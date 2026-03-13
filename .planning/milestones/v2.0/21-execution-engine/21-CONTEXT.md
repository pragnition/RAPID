# Phase 21: Execution Engine - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Parallel job execution within waves with atomic commits, per-job progress tracking that survives context resets, and orchestrated command dispatch. This phase delivers the /rapid:execute skill (rewritten for Mark II), job executor agent role, execution library extensions, and adapted reconciliation. Discussion and planning already happened in Phase 20 via /rapid:discuss and /rapid:wave-plan — this phase focuses solely on executing planned jobs.

</domain>

<decisions>
## Implementation Decisions

### Execute skill restructuring
- /rapid:execute is execute-only — it takes JOB-PLAN.md files as input and runs execution. It assumes discuss+plan already happened in Phase 20
- If discuss/plan haven't happened, /execute prompts the user to run /rapid:discuss and /rapid:wave-plan first (does not auto-trigger them)
- Input is set-scoped: `/rapid:execute <set-id>` — executes all waves in a set sequentially
- All waves process sequentially within one invocation: Wave 1 execute → reconcile → Wave 2 execute → reconcile → etc. User can pause between waves
- New `role-job-executor.md` agent role module for job-level execution. Existing `role-executor.md` stays as-is for backward compatibility
- The v1.0 execute SKILL.md gets a major rewrite — the discuss+plan steps are removed, replaced by job dispatch logic

### Job parallelism model
- Parallel subagents: one subagent spawned per job, all jobs in a wave spawned in parallel
- If rate limits hit, reduce to sequential execution within the wave and inform the user
- File contention handled via file ownership enforcement: WAVE-PLAN.md's file ownership table (from Phase 20) assigns files to specific jobs. Each job only modifies its owned files. Contention = violation, not a race
- Agent teams mode supported: adapt teams.cjs for job-level (one team per wave, one teammate per job). Same fallback-to-subagents pattern as v1.0
- Git commits: each job agent commits atomically per task. Git handles concurrent commits on the same branch naturally. Commit format: `type(set-name): description`

### Progress tracking & display
- Job-level granularity: show each job's status within the current wave (job name, status, task count)
- Visual format: banner blocks like GSD auto-advance banners. Wave header + indented job status lines + timestamp. Updated at key transitions (job start, job complete, job fail)
- STATE.json updated at transition boundaries only (job pending→executing, executing→complete/failed, wave transitions). Consistent with Phase 16 decisions
- STATE.json committed at workflow boundaries (job complete/fail, wave transitions) — not on intermediate updates
- /rapid:status reads STATE.json statically — no real-time polling needed. Since transitions write immediately, it's accurate enough

### Orchestrator re-entry & failure handling
- Smart re-entry: on invocation, read STATE.json to find job statuses. Skip 'complete' jobs, re-execute 'failed' jobs, execute 'pending' jobs. Show summary of what was skipped
- Job-level pause: each job can pause independently via CHECKPOINT return. STATE.json records per-job progress. On resume, only paused jobs re-spawn. Other jobs' results preserved
- Failed jobs: mark 'failed' in STATE.json, other jobs in the wave continue executing. After wave completes, user decides: retry failed jobs, skip them, or cancel
- Job-level reconciliation: after all jobs in a wave complete, verify each job's deliverables against its JOB-PLAN.md. Check file existence, commit format, file ownership. Aggregate into wave-level pass/fail

### Claude's Discretion
- Internal prompt design for role-job-executor.md
- Exact banner block formatting and update frequency
- How to handle git commit conflicts when parallel jobs commit simultaneously
- Rate limit detection and sequential fallback threshold
- HANDOFF.md format adaptations for job-level (vs v1.0 set-level)
- Execute library function signatures and internal helpers
- Error message wording for pre-condition checks (missing plans, wrong state)

</decisions>

<specifics>
## Specific Ideas

- The v1.0 execute SKILL.md is a comprehensive reference for the workflow pattern — rewrite it, don't start from scratch
- JOB-PLAN.md is the primary input artifact, produced by Phase 20's job planner
- Wave artifacts live in `.planning/waves/{setId}/{waveId}/` — execution reads JOB-PLANs from there
- teams.cjs already has waveTeamMeta() and buildTeammateConfig() — extend these for job-level, don't replace
- execute.cjs has reconcileWave() and verifySetExecution() — adapt for job-level reconciliation
- The execute skill should feel like a "press go and watch it work" experience — minimal prompts during execution, just progress banners

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `execute.cjs`: reconcileWave(), verifySetExecution(), generateHandoff(), parseHandoff() — all need job-level adaptation
- `teams.cjs`: detectAgentTeams(), waveTeamMeta(), buildTeammateConfig() — extend for job-level teammates
- `wave-planning.cjs`: resolveWave(), validateJobPlans() — used to locate wave data and validate plans pre-execution
- `state-machine.cjs`: transitionJob(), transitionWave(), readState(), writeState() — core state management
- `state-transitions.cjs`: JOB_TRANSITIONS (pending→executing→complete|failed), WAVE_TRANSITIONS
- `role-executor.md`: v1.0 executor role — reference for commit conventions and structured returns
- `role-orchestrator.md`: Orchestrator role — defines spawn/coordinate pattern
- `assembler.cjs`: assembleAgent() — register new job-executor role for subagent prompt assembly

### Established Patterns
- AskUserQuestion at every decision gate (v1.1 pattern)
- .env fallback loading in all skills
- Banner-style progress output (established in v1.0 execute skill)
- RAPID:RETURN structured output protocol for COMPLETE/CHECKPOINT/BLOCKED
- Lock-protected atomic writes for STATE.json
- Structured JSON CLI output parsed by skills

### Integration Points
- Rewrite: `skills/execute/SKILL.md` — major rewrite from set-level to wave/job-level
- New: `src/modules/roles/role-job-executor.md` — job-level executor role
- Modified: `src/lib/execute.cjs` — extend with job-level reconciliation and verification
- Modified: `src/lib/teams.cjs` — extend for job-level teammate config
- Modified: `src/bin/rapid-tools.cjs` — new CLI subcommands for job execution management
- Read: `.planning/waves/{setId}/{waveId}/*-JOB-PLAN.md` — input artifacts from Phase 20

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-execution-engine*
*Context gathered: 2026-03-07*
