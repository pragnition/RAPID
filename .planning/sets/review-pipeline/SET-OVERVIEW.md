# SET-OVERVIEW: review-pipeline

## Approach

The current review system is a single monolithic `/rapid:review` skill (`skills/review/SKILL.md`, ~1035 lines) that orchestrates all review stages -- scoping, unit testing, bug hunting, and UAT -- within one skill invocation. The user selects which stages to run via an interactive menu, then the skill spawns subagents sequentially. This set decomposes the monolith into four independent, individually invocable skills (`/review`, `/unit-test`, `/bug-hunt`, `/uat`) that share a common scoping artifact (REVIEW-SCOPE.md).

The core architectural change is introducing REVIEW-SCOPE.md as the handoff artifact between the scoping phase and the three review stages. The `/review` skill becomes a lightweight scoping-only command that produces REVIEW-SCOPE.md (categorized concerns, file chunks, cross-cutting analysis). The three new skills (`/unit-test`, `/bug-hunt`, `/uat`) each read REVIEW-SCOPE.md as their input rather than receiving scope data in-memory from an orchestrator. This enables independent invocation -- the user runs whichever stage they want, whenever they want, without going through a stage-selection menu.

The sequencing is: first, refactor the scoping logic into its own output artifact; second, extract each review stage into a standalone skill with scope-detection guards; third, ensure idempotent reruns by having each skill overwrite (not append to) its output artifact. The existing `src/lib/review.cjs` library and agent roles (`role-scoper.md`, `role-unit-tester.md`, `role-bug-hunter.md`, `role-uat.md`) remain largely intact -- the work is primarily at the skill orchestration layer.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `skills/review/SKILL.md` | Scoping-only `/review` skill (replaces monolithic orchestrator) | Existing (rewrite) |
| `skills/unit-test/SKILL.md` | Independent `/unit-test` skill | New |
| `skills/bug-hunt/SKILL.md` | Independent `/bug-hunt` skill with hunter+advocate+judge pipeline | New |
| `skills/uat/SKILL.md` | Independent `/uat` skill for acceptance testing | New |
| `src/lib/review.cjs` | Review library (scoping, chunking, concern grouping, issue management) | Existing (minor updates) |
| `src/modules/roles/role-scoper.md` | Scoper agent role definition | Existing (minor updates) |
| `src/modules/roles/role-unit-tester.md` | Unit tester agent role | Existing (unchanged) |
| `src/modules/roles/role-bug-hunter.md` | Bug hunter agent role | Existing (unchanged) |
| `src/modules/roles/role-devils-advocate.md` | Devils advocate agent role | Existing (unchanged) |
| `src/modules/roles/role-judge.md` | Judge agent role | Existing (unchanged) |
| `src/modules/roles/role-uat.md` | UAT agent role | Existing (unchanged) |
| `agents/rapid-scoper.md` | Generated scoper agent | Existing (rebuild) |

## Integration Points

- **Exports:**
  - `reviewScope` -- `/review` writes `.planning/sets/{setId}/REVIEW-SCOPE.md` containing categorized concerns, file chunks, and cross-cutting analysis. This is the handoff artifact consumed by all three downstream skills.
  - `unitTestSkill` -- `skills/unit-test/SKILL.md` reads REVIEW-SCOPE.md, spawns unit-tester agents, writes REVIEW-UNIT.md.
  - `bugHuntSkill` -- `skills/bug-hunt/SKILL.md` reads REVIEW-SCOPE.md, runs hunter+advocate+judge pipeline, writes REVIEW-BUGS.md with judge leaning indicators.
  - `uatSkill` -- `skills/uat/SKILL.md` reads REVIEW-SCOPE.md, runs acceptance testing against CONTRACT.json criteria, writes REVIEW-UAT.md.

- **Imports:**
  - `reviewArtifactPaths` (from `structural-cleanup`) -- Corrected paths for `.planning/sets/{setId}/REVIEW-*.md` artifacts. The structural-cleanup set (already merged) established the convention that review artifacts live at the set level, not the wave level.

- **Side Effects:**
  - REVIEW-SCOPE.md, REVIEW-UNIT.md, REVIEW-BUGS.md, REVIEW-UAT.md are written to `.planning/sets/{setId}/` (or `.planning/post-merge/{setId}/` for post-merge reviews).
  - REVIEW-ISSUES.json is updated with logged issues from each stage.
  - Bugfix commits are made to the worktree branch (or main for post-merge).

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| REVIEW-SCOPE.md format drift -- downstream skills expect a specific structure that the scoper may not produce consistently | High | Define a strict schema for REVIEW-SCOPE.md in the scoper role; validate on read in each downstream skill |
| Missing scope detection -- skills must reliably detect absent REVIEW-SCOPE.md and guide user | Medium | Each skill checks for REVIEW-SCOPE.md existence before any agent spawning; clear error message with `/review` suggestion |
| Idempotent overwrite -- re-running a skill must not accumulate stale data in REVIEW-ISSUES.json | Medium | Each skill clears its source-specific issues (by `source` field) before logging new ones; REVIEW-*.md files are fully overwritten |
| Behavioral contract enforcement (`noStagePrompting`) -- skills must not prompt user for stage selection | Low | Each skill is a single-purpose command; no stage menu exists in any of the three new skills |
| Judge leaning visibility in REVIEW-BUGS.md output format | Low | Template the REVIEW-BUGS.md format with explicit leaning/confidence columns in the findings table |
| Post-merge mode compatibility -- each new skill must independently support `--post-merge` flag | Medium | Inherit existing post-merge path logic from the monolithic skill; test both modes per skill |

## Wave Breakdown (Preliminary)

- **Wave 1:** Scoping artifact -- rewrite `/review` (SKILL.md) to produce REVIEW-SCOPE.md only, define the REVIEW-SCOPE.md schema/format, update `src/lib/review.cjs` if needed for scope serialization.
- **Wave 2:** Independent skills -- create `/unit-test`, `/bug-hunt`, and `/uat` skill files, each reading REVIEW-SCOPE.md as input, implementing scope-detection guards, idempotent overwrite, and `--post-merge` support.
- **Wave 3:** Behavioral contracts and polish -- ensure `judgeLeaningVisible` format in bug-hunt output, verify `noStagePrompting` across all skills, add tests for `scopeRequired` and `idempotentRerun` invariants, rebuild agents.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
