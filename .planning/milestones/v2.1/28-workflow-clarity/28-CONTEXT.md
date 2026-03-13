# Phase 28: Workflow Clarity - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Users and agents always know what step comes next, with correct context flowing between stages. Covers four requirements: wave-plan accepts set+wave context across all wave-aware skills (FLOW-01), agents have canonical workflow order in their prompts (FLOW-02), job granularity defaults to coarser sizing (FLOW-03), and each skill auto-suggests the next command with pre-filled numeric args (UX-04).

</domain>

<decisions>
## Implementation Decisions

### Next-step UX (UX-04)
- Print-only output at the end of each skill — no AskUserQuestion
- Remove ALL existing end-of-skill AskUserQuestion blocks across all stage skills
- Format as labeled block: `Next step: /rapid:wave-plan 1.1\n(Plan wave 1)`
- Numeric args only in the command — no human-readable set/wave names alongside
- Alternatives shown only at genuine branching points (e.g., after review: merge vs fix issues)
- At linear steps (init → set-init → discuss → wave-plan → execute), show only the canonical next step
- Skills resolve numeric indices using the same `plan list-sets` alphabetical index + wave index logic already in the `status` skill

### Job granularity (FLOW-03)
- Default target: 2-4 jobs per wave
- Motivation: context fragmentation — a single agent working on a larger chunk makes better decisions
- Instruction lives in BOTH `role-roadmapper.md` AND `role-wave-planner.md`
- Escape hatch: >4 jobs allowed if wave planner explicitly justifies why in the plan
- Replaces current "1-3 files modified" guidance in role-roadmapper.md

### Set+wave resolution across skills (FLOW-01)
- Add `--set` flag to `resolve wave` CLI command in resolve.cjs for single-call two-arg resolution
- Extend set+wave resolution pattern to ALL wave-aware skills (not just wave-plan)
- Claude determines the full list of wave-aware skills during implementation
- Existing dot notation (`1.1`) and string wave ID resolution remain unchanged
- Two-arg form (`/rapid:wave-plan auth wave-1`) becomes a single `resolve wave wave-1 --set auth` CLI call

### Canonical workflow order in agents (FLOW-02)
- Add workflow order to `src/modules/core/core-identity.md` so it propagates to all 26 agents via `build-agents`
- Canonical sequence: init → set-init → discuss → wave-plan → execute → review → merge
- No changes to individual role modules — workflow order is universal context, belongs in core identity

### Claude's Discretion
- Exact wording of the workflow order section in core-identity.md
- Which skills qualify as "wave-aware" for FLOW-01 extension
- Whether to add a helper function for next-step formatting or inline it per skill
- How to handle edge cases in next-step suggestions (e.g., last wave in a set, all sets complete)
- Exact phrasing of job granularity guidance in role modules
- Whether `build-agents` needs to be re-run after core-identity.md changes (likely yes)

</decisions>

<specifics>
## Specific Ideas

- The `status` skill (lines 99-109) already has numeric conversion logic for set indices — this pattern should be reused by all skills for next-step suggestions
- The labeled block format keeps output scannable without interactive prompts slowing down the workflow
- Removing AskUserQuestion from skill endings makes the workflow feel snappier — user reads the next command and pastes it when ready

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/status/SKILL.md` lines 99-109 — numeric index conversion logic for sets, reuse pattern for all skills
- `src/lib/resolve.cjs` — resolveSet and resolveWave functions, add --set flag here
- `src/modules/core/core-identity.md` — core identity module baked into all 26 agents via build-agents
- `src/modules/roles/role-roadmapper.md` lines 154-158 — current job granularity section to update
- `src/modules/roles/role-wave-planner.md` — needs new job count guidance

### Established Patterns
- Skills call `node "${RAPID_TOOLS}" resolve wave "1.1"` at CLI boundary — resolution happens once
- `resolve wave` returns JSON: `{setId, waveId, setIndex, waveIndex, wasNumeric}`
- `plan list-sets` returns alphabetically sorted set list (data source for numeric indices)
- All 26 agent files generated from core + role modules via `node rapid-tools.cjs build-agents`
- Skills reference agents by name (e.g., "Spawn rapid-wave-researcher agent")

### Integration Points
- 7 stage skills need next-step output added: init, set-init, discuss, wave-plan, execute, review, merge
- 7 stage skills need end-of-skill AskUserQuestion blocks removed
- `src/lib/resolve.cjs` — add --set flag to resolveWave and CLI handler
- `src/modules/core/core-identity.md` — add workflow order section
- `src/modules/roles/role-roadmapper.md` — update job granularity from "1-3 files" to "2-4 jobs per wave"
- `src/modules/roles/role-wave-planner.md` — add matching job count guidance
- `agents/` directory — rebuild all 26 agents after core-identity.md change

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 28-workflow-clarity*
*Context gathered: 2026-03-09*
