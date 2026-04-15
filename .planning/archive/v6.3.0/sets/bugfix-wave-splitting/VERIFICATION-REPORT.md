# VERIFICATION-REPORT: bugfix-wave-splitting

**Set:** bugfix-wave-splitting
**Wave:** wave-1 (single-wave set)
**Verified:** 2026-04-09
**Verdict:** PASS_WITH_GAPS

## Coverage

| Requirement | Covered By | Status | Notes |
|-------------|------------|--------|-------|
| CONTEXT: Auto-trigger when bug count > default wave size | Task C (floor check) + Task D (decomposition) | PASS | Floor is phrased as `BUG_COUNT >= 2 * WAVE_SIZE`, i.e. ≥ 6 for default, which matches the "floor activates only when bug count ≥ 2× effective wave size" decision. Note: technically "auto-trigger when bug count > default wave size" and "splitting activates only when bug count ≥ 2× effective wave size" are two layered conditions in CONTEXT.md; the plan collapses them into one (the floor), which is the stricter of the two. This is the correct interpretation — below the floor, the legacy path runs. |
| CONTEXT: Floor splitting activates at 2× wave size | Task C worked examples (5/3, 6/3, 10/3) | PASS | Codified verbatim with strict `<` boundary so 6/3 triggers and 5/3 falls through. |
| CONTEXT: UAT mode UNCHANGED | Task A (no UAT branch in Step 0c), Task F check #2, Scope "NOT-TO-DO" section | PASS | Task F greps `Step UAT-d` and `continue to the next failure.*do NOT stop` to confirm UAT-d behavior is byte-identical. Scope explicitly calls out byte-identical preservation of Step UAT through Step UAT-Results. |
| CONTEXT: Cross-wave handoff SKIPPED | Task D prompt template ("MUST contain only the current wave's bugs", "Do NOT include a Prior Wave Context section"), Task D verification grep `-c "Prior Wave Context"` expecting `0` | PASS | Absence of "Prior Wave Context" is load-bearing and explicitly greppable. |
| CONTEXT: BLOCKED policy — stop on blocked | Task D sub-item 4 "BLOCKED → … STOP the entire run", Task F check #7 | PASS | Prose uses literal "STOP" and "STOPPING run" so the grep catches it. Differentiated from UAT-d behavior with an explicit "NOTE: This differs from Step UAT-d" callout. |
| CONTEXT: CHECKPOINT continues, BLOCKED halts | Task D sub-item 4 switch | PASS | COMPLETE → continue; CHECKPOINT → continue (partial progress counts); BLOCKED → STOP. Matches CONTEXT.md verbatim. |
| CONTRACT task 1: Wave decomposition splitting bugs into groups of `--wave-size` | Task D Step 4a | PASS | Acceptance example "10 bugs with `--wave-size 3` produces 4 waves of sizes 3, 3, 3, 1" codified verbatim. |
| CONTRACT task 2: Sequential wave dispatch, one executor per wave | Task D Step 4b | PASS | Sequential-only callout mirrors `skills/merge/SKILL.md` Step 3 phrasing. Prompt template explicitly restricts each dispatch to the current wave's bugs. |
| CONTRACT task 3: Cross-wave context handoff | — | INTENTIONALLY OMITTED | Plan documents this as vestigial in the Contract Divergence section and in Task E Notes bullet per `code-graph-backend` precedent. Advisory only, per task prompt instructions. |
| CONTRACT task 4: `--wave-size` flag with defaults | Task A | PASS | Positive-integer validation, default 3, usage error on bad input. UAT default is intentionally not implemented (vestigial, see divergence). |
| CONTRACT task 5: Display per-wave results and aggregate summary | Task D Step 4b per-wave result block + Step 4c aggregate | PASS | Per-wave banner and result block rendered on every dispatch regardless of status; aggregate renders even on halted runs. |
| CONTRACT acceptance 1: Wave splitting produces correct groupings | Task D Step 4a + Task F check #5 | PASS | Codified 10/3 example plus 6/3 and 7/3 supplementary examples. |
| CONTRACT acceptance 2: Context handoff prevents regressions | — | INTENTIONALLY OMITTED | Out of scope per CONTEXT.md handoff-skipped decision. Advisory only, per task prompt instructions. |
| CONTRACT acceptance 3: Backward compatible when wave splitting not triggered | Task C strict `<` floor + legacy block preserved byte-identical; Task F check #3 | PASS | Task F grep verifies `Spawn the **rapid-executor** agent with this task` and `If COMPLETE/BLOCKED/CHECKPOINT` switch remain intact in the legacy block. |
| CONTRACT acceptance 4: Per-wave progress displayed | Task D per-wave banner + per-wave result block | PASS | Per-wave banner uses `node "${RAPID_TOOLS}" display banner bug-fix "Wave {N} of {WAVE_COUNT}"`, consistent with project CLI convention. |
| CONTRACT behavioral `sequential-execution` | Task D Step 4b sequential-only callout | PASS | Uses words "CRITICAL", "strictly SEQUENTIALLY", and "never use parallel" for greppable enforcement. |
| CONTRACT behavioral `wave-results-display` | Task D per-wave result block + Step 4c aggregate | PASS | Explicitly required to render before proceeding to next wave. |
| CONTRACT behavioral `backward-compatible` | Task C fall-through + Task F check #3 | PASS | Legacy single-executor block preserved byte-identical. `BUG_COUNT == 1` produces identical behavior to current skill. |
| CONTRACT `definition.ownedFiles` = `["skills/bug-fix/SKILL.md"]` | All tasks list only this file | PASS | Scope summary explicitly states "This plan touches exactly one file." Task F verification command `git diff --name-only` checks no other files are modified. |

## Implementability

| File | Task | Action | Status | Notes |
|------|------|--------|--------|-------|
| `skills/bug-fix/SKILL.md` | A | Modify (insert Step 0c after line 49) | PASS | Confirmed on disk. Anchor at line 49 (`If --uat is NOT present: continue to Step 1 as normal (no behavior change).`) matches plan. Insertion point before Step UAT header at line 51 is valid. |
| `skills/bug-fix/SKILL.md` | B | Modify (replace Step 1 body at lines 166-174) | PASS | Confirmed on disk. Step 1 header at line 166; body through line 174. Plan correctly notes line numbers will shift after Task A. |
| `skills/bug-fix/SKILL.md` | C | Modify (insert branching header after line 220, before existing `Spawn the rapid-executor` at line 222) | PASS | Confirmed on disk. Line 220 is the end of Step 4's opening paragraph; line 222 starts the existing executor dispatch template. Anchor sentence "Build a plan for the fix. The plan should be a concise description…" is exact at line 220. |
| `skills/bug-fix/SKILL.md` | D | Modify (insert Step 4a/4b/4c before `## Step 5: Display Results` at line 271) | PASS | Confirmed on disk. Step 5 header at line 271. Plan's insertion point is valid. |
| `skills/bug-fix/SKILL.md` | E | Modify (append 2 bullets to `## Important Notes` at lines 293-300) | PASS | Confirmed on disk. Notes section header at line 293, last bullet (UAT mode note) at line 300. Plan's "lines 293-301" is off by one (file is 300 lines total) but structurally correct — an append at end-of-file is unambiguous. Trivial advisory gap. |
| `skills/bug-fix/SKILL.md` | F | Read-only verification | PASS | All 11 grep/git commands in Task F reference valid paths and targets. |

## Consistency

| File | Claimed By | Status | Resolution |
|------|------------|--------|------------|
| `skills/bug-fix/SKILL.md` | A, B, C, D, E (all as Modify, different sections) | PASS | Single-job plan — all tasks execute sequentially A→B→C→D→E within a single executor agent, not in parallel. No cross-job file ownership conflict. Task D explicitly warns that its edits follow Tasks A-C, acknowledging line-number shift. Commits are atomic per task (5 separate commits across 5 tasks, plus Task F as verification-only with no commit). No overlap: Task A touches Step 0b/0c boundary; Task B touches Step 1 body; Task C touches Step 4 header; Task D touches Step 4a/4b/4c insertion before Step 5; Task E appends to Notes at EOF. |

## Cross-Job Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Task A must precede B, C, D, E | PASS | Plan explicitly states "Execute tasks in order A → B → C → D → E → F". Task B, C, D, E explicitly call out that line numbers shift after Task A's insertion. |
| Task C must precede D | PASS | Task D inserts Step 4a/4b/4c within the wave-splitting branch of Step 4, which Task C creates. |
| Task F (verification) must follow all of A–E | PASS | Task F is explicitly labelled "final review gate" with no commit. All 11 checks assume A-E are complete. |
| Task D depends on BUGS, BUG_COUNT, WAVE_SIZE from Tasks A + B | PASS | Task D's prose correctly references variables introduced in Tasks A (`WAVE_SIZE`) and B (`BUGS`, `BUG_COUNT`). |

## Edits Made

| File | Change | Reason |
|------|--------|--------|

(No auto-fixes applied. The plan is structurally sound and internally consistent; all anchor lines verified against the on-disk source file. The known contract divergences are explicitly documented in-plan per the `code-graph-backend` precedent and the task-prompt instruction to treat them as Advisory.)

## Advisory Notes (non-blocking)

1. **Contract divergence documented, not edited.** Per CONTEXT.md decisions, three contract items are vestigial:
   - `exports.cross-wave-handoff` — SKIPPED per CONTEXT.md handoff-skipped decision.
   - `exports.wave-splitting.description` "5 UAT" — UAT path unchanged per CONTEXT.md UAT-unchanged decision.
   - `definition.tasks[2]` "Implement cross-wave context handoff" — intentionally not implemented.

   The plan documents these in a dedicated "Contract Divergence (Advisory — no file edits)" section and propagates the documentation into `skills/bug-fix/SKILL.md` via Task E. Precedent: `.planning/sets/code-graph-backend/VERIFICATION-REPORT.md` recorded a similar divergence as an Advisory Note without modifying `CONTRACT.json`. PASS_WITH_GAPS (advisory only, per task prompt instructions).

2. **Line-number drift awareness.** The plan specifies pre-Task-A line numbers for anchor points (e.g., "currently lines 166-174 pre-Task-A") and explicitly notes numbers will shift after each task. This is correct practice for sequential-edit plans.

3. **Trivial line-count off-by-one in Task E.** Plan says "currently lines 293-301 pre-edits"; the source file is 300 lines (last line 300 is the UAT-mode bullet). This does not affect implementability since Task E is an append at end-of-file with an unambiguous anchor. Minor advisory gap.

4. **Task F check #3 ambiguity acknowledged.** The plan itself flags that `grep -n "Spawn the \*\*rapid-executor\*\* agent with this task"` "may return only one" match after the edits, depending on whether Task D's per-wave prompt template reuses the same exact wording. The plan resolves the ambiguity prospectively: "either is acceptable as long as the legacy block is intact." This is a well-handled edge case.

5. **Strong verification story.** Every task ships with concrete grep/git-diff commands, exact strings to find, and quantitative expectations (line counts, match counts, count=0 checks for absence). Task F provides 11 independent gates. This is substantially above the typical plan's verification rigor.

6. **Commit bisectability enforced.** Plan explicitly forbids batching: "Do NOT batch tasks into a single commit. Each task's edit must land as its own commit for bisectability." 5 feat/docs commits total, matching project convention (`feat(bugfix-wave-splitting): ...`, `docs(bugfix-wave-splitting): ...`).

7. **Risk mitigation table.** Plan's "Global Risks" table pre-emptively addresses 10 risks including parallel-dispatch drift, off-by-one boundary bugs, backward-compat regression, UAT cross-contamination, CHECKPOINT-vs-BLOCKED semantics, `--wave-size 0` validation, equality-case boundary (6/3), aggregate data loss on halted runs, and contract-divergence documentation. Each risk is linked to a mitigation location.

## Summary

The plan is structurally sound, well-anchored, and comprehensive. All six CONTEXT.md decisions are reflected correctly, and all non-vestigial contract tasks and behavioral requirements are covered. Anchor lines (49, 51, 166-174, 220, 222, 271, 293-300) match the on-disk source file exactly. The plan exhibits above-average verification rigor via Task F's 11-check gate. The only gaps are the three pre-declared contract divergences, which are intentional per CONTEXT.md and explicitly flagged as Advisory per the task-prompt instructions and the `code-graph-backend` precedent. Verdict: **PASS_WITH_GAPS** (advisory-only gaps, no blocking issues).
