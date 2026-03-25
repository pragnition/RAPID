# SET-OVERVIEW: gap-closure

## Approach

The gap-closure set addresses a workflow dead-end where sets that pass verification with PASS_WITH_GAPS and proceed through merge end up in a terminal state -- attempting `/rapid:plan-set --gaps` on a merged set is rejected because `plan-set` treats any status beyond "discussed" as "planning is complete." The same problem exists in `execute-set`, which rejects "complete" or "merged" sets outright. This leaves no way to address identified gaps after merge.

The fix adds `--gaps` flag awareness to both the plan-set and execute-set SKILL.md files. When `--gaps` is present, the status validation logic is relaxed to accept merged sets, and the planning/execution pipelines scope their work to only gap-closure waves (numbered after existing waves). The behavioral invariants are strict: gap-closure never changes a set's "merged" status, waves are numbered sequentially after the last existing wave, and previously completed waves are never re-executed.

Implementation is primarily in the SKILL.md files (which drive agent behavior) with supporting changes in the CLI command handlers (`src/commands/plan.cjs`, `src/commands/execute.cjs`) if flag parsing needs to be threaded through the tooling layer. The execute-set SKILL.md already documents `--gaps` in its Step 1 comments but the actual status-gate logic does not honor it.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| skills/plan-set/SKILL.md | Plan-set skill orchestration (status validation, wave generation) | Existing -- modify |
| skills/execute-set/SKILL.md | Execute-set skill orchestration (status validation, wave dispatch) | Existing -- modify |
| src/commands/plan.cjs | CLI plan command handler | Existing -- may need minor changes |
| src/commands/execute.cjs | CLI execute command handler | Existing -- may need minor changes |

## Integration Points

- **Exports:**
  - `handlePlanSetGaps`: Gap-closure planning handler invoked when `--gaps` flag is present on plan-set. Produces gap-closure PLAN.md files for a merged set.
  - `handleExecuteSetGaps`: Gap-closure execution handler invoked when `--gaps` flag is present on execute-set. Runs only gap-closure waves.
- **Imports:** None -- this set is self-contained.
- **Side Effects:** New wave PLAN.md files and WAVE-COMPLETE.md markers are created in `.planning/sets/{setId}/` for gap-closure waves. The set's "merged" status is never changed.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Status validation changes accidentally relax gates for non-gap workflows | High | Guard all relaxation behind explicit `--gaps` flag check; add tests confirming normal flow unchanged |
| Wave numbering collision with existing waves | Medium | Read existing wave files via glob before assigning numbers; test with sets that have 1, 2, and 3+ existing waves |
| Re-execution of already-completed waves in gap mode | Medium | Filter wave list against existing WAVE-COMPLETE.md markers; behavioral invariant enforced by test |
| execute-set SKILL.md already mentions --gaps but logic is incomplete | Low | Audit existing partial implementation before adding new code to avoid duplication |

## Wave Breakdown (Preliminary)

- **Wave 1:** Flag parsing and status-gate changes -- modify plan-set SKILL.md to accept `--gaps` flag, bypass "planning is complete" rejection for merged sets when flag is present, and implement correct gap-closure wave numbering logic. Similarly modify execute-set SKILL.md status validation to allow merged sets with `--gaps`.
- **Wave 2:** End-to-end integration -- wire up the CLI layer if needed (`src/commands/plan.cjs`, `src/commands/execute.cjs`), write tests covering the three behavioral invariants (merged status preserved, wave numbering, no re-execution), and verify the full workflow: merged set with gaps -> plan --gaps -> execute --gaps -> gaps resolved.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
