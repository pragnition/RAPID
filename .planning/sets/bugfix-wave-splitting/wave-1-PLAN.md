# Wave 1 Plan — bugfix-wave-splitting

**Set:** bugfix-wave-splitting
**Wave:** 1 (single-wave set)
**Owned files:** `skills/bug-fix/SKILL.md` (exclusive)
**Generated:** 2026-04-09

## Objective

Extend `/rapid:bug-fix` with a multi-agent wave-splitting capability that slices large bug lists into sequential waves to contain context rot, while preserving exact backward compatibility for the single-bug path and leaving the `--uat` flow entirely untouched.

All changes are prose edits to a single file: `skills/bug-fix/SKILL.md`. No new modules. No touched code elsewhere in the repo.

## Scope Summary

**In scope**
- New Step 0c flag parser for `--wave-size <n>` with integer validation and default value 3.
- Extension of Step 1 to accept multi-bug bullet-list input so the wave-splitting code path is reachable in the non-UAT flow.
- Wave-splitting conditional at the top of Step 4 with a floor check (bug count ≥ 2 × WAVE_SIZE). Below the floor, execution falls through unchanged to the legacy single-executor dispatch.
- New sub-steps Step 4a (Wave Decomposition), Step 4b (Sequential Dispatch Loop), Step 4c (Aggregate Results).
- Notes section update recording vestigial contract items (`cross-wave-handoff` export, "5 UAT" default) as post-merge cleanup.

**Out of scope / explicit NOT-TO-DO**
- Do NOT modify Step UAT, Step UAT-a, Step UAT-b, Step UAT-c, Step UAT-d, Step UAT-e, or Step UAT-Results. The UAT path must remain byte-identical.
- Do NOT add a `## Prior Wave Context` section to the per-wave executor prompt. Cross-wave handoff is explicitly skipped per CONTEXT.md.
- Do NOT edit `skills/bug-fix/SKILL.md` frontmatter, Step 0, Step 0b, Step 2, Step 3, or Step 5 except where an explicit task below names them.
- Do NOT edit `.planning/sets/bugfix-wave-splitting/CONTRACT.json`. Contract divergence is documented in plan prose per the `code-graph-backend` precedent.
- Do NOT create any new files. This plan touches exactly one file.

## Contract Divergence (Advisory — no file edits)

The following items in `CONTRACT.json` diverge from the agreed implementation per CONTEXT.md. They are documented here and in the SKILL.md Notes section for post-merge cleanup, following the `.planning/sets/code-graph-backend/VERIFICATION-REPORT.md` precedent (advisory note without CONTRACT.json modification):

1. **`exports.cross-wave-handoff`** — Vestigial. The discussion decision was to skip cross-wave handoff entirely; each wave receives only its assigned bug list with no modified-files list, no commit log, and no prior-wave summary. The export should be removed from the contract after merge.
2. **`exports.wave-splitting.description` — "5 UAT"** — Vestigial. The discussion decision was to leave `--uat` mode unchanged; wave-splitting applies only to the normal `/rapid:bug-fix` path. The "5 UAT" default is not implemented and should be struck from the contract description after merge.
3. **`definition.tasks[2]` — "Implement cross-wave context handoff"** — Not implemented per (1) above.

Plan proceeds with PASS_WITH_GAPS verdict expected; `skills/plan-set/SKILL.md` explicitly defers contract validation to execution/merge time.

## Global Risks (mitigated in task prose)

| # | Risk | Mitigation location |
|---|------|---------------------|
| 1 | Model dispatches waves in parallel by mistake | Task D sequential-only callout, mirroring `skills/merge/SKILL.md` Step 3 wording |
| 2 | Off-by-one in wave grouping | Task D codified 10/3 → [3,3,3,1] example plus 6/3 and 7/3 examples |
| 3 | Backward-compat regression on small bug lists | Task C explicit floor (`< 2 × WAVE_SIZE`) with fall-through to legacy block |
| 4 | UAT path accidentally touched | Task F grep-based verification of Step UAT-d presence |
| 5 | CHECKPOINT vs BLOCKED semantic drift | Task D switch: COMPLETE → continue, CHECKPOINT → continue, BLOCKED → STOP |
| 6 | Multi-bug intake gap making wave path unreachable | Task B extends Step 1 with bullet-list parsing |
| 7 | Aggregate summary data loss on halted runs | Task D Step 4c renders aggregate even when STOPPED at wave N |
| 8 | `--wave-size 0` or negative | Task A validation rejects with usage error |
| 9 | Bug count exactly at floor | Task D worked example: 6/3 → triggers; 5/3 → falls through |
| 10 | Contract divergence not documented | Task E Notes update + this plan's Contract Divergence section |

---

## Tasks

Execute tasks in order A → B → C → D → E → F. Tasks A–E modify the same file (`skills/bug-fix/SKILL.md`) and must be committed separately as atomic prose edits. Task F is a read-only verification step with no commit.

---

### Task A — Add Step 0c: Parse `--wave-size` Flag

**Files:**
- `skills/bug-fix/SKILL.md`

**Insertion point:** Immediately AFTER the existing Step 0b block (which ends at line 49, `If --uat is NOT present: continue to Step 1 as normal (no behavior change).`) and BEFORE the existing Step UAT header at line 51.

**Action:** Insert a new `## Step 0c: Parse --wave-size Flag` section. The prose must:

1. Instruct the model to check whether the user's invocation includes `--wave-size <n>` and record the argument immediately after as an integer.
2. Validate that the argument is a positive integer (≥ 1). If `--wave-size` is present but followed by a non-integer, zero, or negative value, display a usage error and exit:
   ```
   Usage: /rapid:bug-fix [--wave-size <n>] [bug description]
   ```
3. Record the parsed value as `WAVE_SIZE`. If `--wave-size` is absent, set `WAVE_SIZE = 3` (default).
4. End with the instruction: "Continue to Step 1 (or Step UAT if `--uat` was detected in Step 0b)."

**Important prose requirements:**
- The section must sit between Step 0b and Step UAT so both the UAT path and the normal path pass through it. The UAT path ignores `WAVE_SIZE` — do not add any UAT branch to Step 0c.
- Match the existing flag-parsing idiom from Step 0b: natural-language check, usage error on bad input, prose conditional for the value.
- Do not introduce code fences with executable logic. The parser is prose instructions, not a shell script.

**Verification:**
```bash
grep -n "Step 0c" skills/bug-fix/SKILL.md
grep -n "wave-size" skills/bug-fix/SKILL.md
grep -n "WAVE_SIZE = 3" skills/bug-fix/SKILL.md
```
All three must return at least one match. The first must show Step 0c positioned after Step 0b and before Step UAT (line number between the existing 49 and 51 anchors, accounting for insertion shift).

**Done when:** The file contains a `## Step 0c: Parse --wave-size Flag` section between Step 0b and Step UAT, with positive-integer validation, a usage error message matching the format above, a default value of 3, and no touching of the Step 0b or Step UAT headers.

**Commit:** `feat(bugfix-wave-splitting): add Step 0c --wave-size flag parser`

---

### Task B — Extend Step 1 to Accept Multi-Bug Bullet-List Input

**Files:**
- `skills/bug-fix/SKILL.md`

**Target:** The existing `## Step 1: Gather Bug Description` section (currently lines 166-174 pre-Task-A; line numbers will shift after Task A inserts Step 0c).

**Action:** Replace the current Step 1 body with prose that accepts either a single-bug or multi-bug input. Preserve the existing single-bug behavior byte-for-byte as the default branch. Add a new branch for multi-bug input.

The updated Step 1 must:

1. **Inline invocation path:** If the user provided a bug description inline with the command, inspect it for multi-bug structure:
   - **Multi-bug trigger:** The inline description contains a bullet list (lines beginning with `-`, `*`, or a numbered pattern like `1.`, `2.`) OR explicit enumeration (the user writes "bugs:" or "issues:" followed by multiple items).
   - **Single-bug path (default):** If no multi-bug structure is detected, treat the entire description as one bug exactly as today. No behavior change from the current Step 1.
   - **Multi-bug path:** If multi-bug structure is detected, parse each bullet / numbered item into a separate bug. Record the result as an array `BUGS` with entries `{ id: <1-indexed>, description: <verbatim text of that item> }`.
2. **Freeform invocation path:** If the user did NOT provide an inline description, use `AskUserQuestion` with the freeform prompt exactly as today:
   > "Describe the bug you are experiencing. Include any error messages, reproduction steps, or symptoms."
   After receiving the response, run the same multi-bug detection on the response. Default is single-bug (one entry in `BUGS`).
3. Record `BUG_COUNT = BUGS.length`. When `BUG_COUNT == 1`, subsequent steps MUST behave exactly as today (back-compat requirement).

**Important prose requirements:**
- The multi-bug detection must be described as natural-language pattern matching, not regex. Example prose: "If the description contains multiple items on separate lines each beginning with `-`, `*`, or a number followed by a period, treat each as a separate bug."
- Single-bug behavior must be explicitly called out as unchanged so readers understand nothing breaks for the common case.
- Do NOT add a new `AskUserQuestion` for the multi-bug / single-bug choice. Detection is structural, not interactive.

**Verification:**
```bash
grep -n "Step 1: Gather Bug Description" skills/bug-fix/SKILL.md
grep -n "BUG_COUNT" skills/bug-fix/SKILL.md
grep -n "bullet list\|numbered\|multi-bug\|multiple items" skills/bug-fix/SKILL.md
```
First two must return exactly one match each. The third must return at least one match confirming the multi-bug detection prose is present.

**Done when:** Step 1 parses inline or freeform input into a `BUGS` array plus `BUG_COUNT`, single-bug inputs produce `BUG_COUNT = 1` with behavior indistinguishable from today, and the existing `AskUserQuestion` freeform prompt is preserved verbatim.

**Commit:** `feat(bugfix-wave-splitting): extend Step 1 with multi-bug bullet-list intake`

---

### Task C — Add Wave-Splitting Conditional at Top of Step 4

**Files:**
- `skills/bug-fix/SKILL.md`

**Target:** The existing `## Step 4: Dispatch Executor Agent` header and the paragraph immediately after it (currently lines 218-220 pre-Task-A; shifted after Tasks A and B).

**Anchor:** The sentence "Build a plan for the fix. The plan should be a concise description of exactly what needs to change, in which files, and how to verify the fix." marks the end of Step 4's opening paragraph. The conditional is inserted AFTER this paragraph and BEFORE the existing line "Spawn the **rapid-executor** agent with this task:".

**Action:** Insert a new sub-section header `### Step 4 Branching: Single Executor vs Wave Splitting` (or an equivalent prose marker) with the following logic:

1. **Floor precondition (exact wording):**
   > "If `BUG_COUNT < 2 × WAVE_SIZE`, skip wave logic and fall through to the legacy single-executor dispatch unchanged. This preserves exact backward compatibility for small bug lists."

2. **Trigger precondition:**
   > "If `BUG_COUNT >= 2 × WAVE_SIZE`, proceed to Step 4a (Wave Decomposition). Do NOT execute the single-executor block below — the wave loop replaces it for this invocation."

3. **Worked examples (codified verbatim):**
   - `BUG_COUNT = 5`, `WAVE_SIZE = 3` → `5 < 6`, floor NOT met, single-executor path (legacy, unchanged).
   - `BUG_COUNT = 6`, `WAVE_SIZE = 3` → `6 >= 6`, floor met, wave splitting triggers with 2 waves of 3.
   - `BUG_COUNT = 10`, `WAVE_SIZE = 3` → `10 >= 6`, floor met, wave splitting triggers with 4 waves of sizes 3, 3, 3, 1.

4. The existing single-executor block (current lines 222-269: the `Spawn the rapid-executor agent...` task template through the RAPID:RETURN switch) must remain byte-identical below the new conditional. Do NOT edit, reorder, or re-flow any of those lines. The conditional is an ADD, not a REPLACE.

**Important prose requirements:**
- Phrase the floor as `<` (strictly less than) so the equality case `BUG_COUNT == 2 × WAVE_SIZE` triggers splitting. This matches the worked examples in (3).
- The conditional prose must explicitly say "skip the single-executor block below" when splitting triggers, so readers understand waves REPLACE (not augment) the legacy path.
- The legacy block below the conditional must be preserved exactly. After this task, `git diff` should show only insertions in the Step 4 header region and zero modified lines in the existing single-executor task template.

**Verification:**
```bash
grep -n "Step 4" skills/bug-fix/SKILL.md
grep -n "BUG_COUNT < 2 \* WAVE_SIZE\|BUG_COUNT >= 2 \* WAVE_SIZE" skills/bug-fix/SKILL.md
grep -n "10 bugs\|5 < 6\|6 >= 6" skills/bug-fix/SKILL.md
git diff skills/bug-fix/SKILL.md | grep "^-" | grep -v "^---"
```
The first must show the new branching header. The second must confirm both floor and trigger prose are present. The third must confirm at least one of the worked examples is present. The fourth (git diff deletions) must show ZERO modified lines inside the existing single-executor task template and return switch — insertions only.

**Done when:** A new branching prose block sits between Step 4's opening paragraph and the legacy single-executor block, the floor condition is phrased as strict `<`, the three worked examples are codified, and no existing single-executor lines have been modified or deleted.

**Commit:** `feat(bugfix-wave-splitting): add Step 4 wave-splitting conditional with floor check`

---

### Task D — Add Step 4a (Wave Decomposition), Step 4b (Sequential Dispatch Loop), Step 4c (Aggregate Results)

**Files:**
- `skills/bug-fix/SKILL.md`

**Insertion point:** Immediately BEFORE the existing `## Step 5: Display Results` header. The new sub-steps extend Step 4's wave-splitting branch with the decomposition, dispatch loop, and aggregation logic. They must come before Step 5 so the aggregate cleanly feeds into the existing results display.

**Action:** Insert three new sub-step sections as described below. Each sub-step must be a top-level `### Step 4X:` subheader within the existing Step 4 top-level header, so the document hierarchy stays consistent.

#### Step 4a: Wave Decomposition

Prose must specify:

1. Compute `WAVE_COUNT = ceil(BUG_COUNT / WAVE_SIZE)`.
2. Partition `BUGS` into `WAVES[1..WAVE_COUNT]` where each wave (except possibly the last) contains exactly `WAVE_SIZE` bugs, and the final wave contains the remainder.
3. Codify the acceptance example verbatim:
   > "10 bugs with `--wave-size 3` produces 4 waves of sizes 3, 3, 3, 1 (the final wave holds the remainder)."
   Also include `6/3 → [3, 3]` and `7/3 → [3, 3, 1]` as supplementary examples.
4. Display a decomposition summary banner before entering the dispatch loop:
   ```
   --- Wave Decomposition ---
   Total bugs: {BUG_COUNT}
   Wave size: {WAVE_SIZE}
   Waves: {WAVE_COUNT}
   Distribution: {comma-separated list of wave sizes, e.g. "3, 3, 3, 1"}
   --------------------------
   ```

#### Step 4b: Sequential Dispatch Loop

Prose must specify:

1. **Sequential-only callout (CRITICAL, mirror merge's phrasing):**
   > "Waves execute strictly SEQUENTIALLY on the same branch; no parallel wave execution. CRITICAL: each wave dispatch MUST be in its own assistant response. Never use parallel Agent tool calls in this loop. This mirrors `skills/merge/SKILL.md` Step 3: sets within a wave merge sequentially (not in parallel) — each dispatch sees the result of the previous one."
2. **Per-wave banner** (emitted before each dispatch):
   ```bash
   node "${RAPID_TOOLS}" display banner bug-fix "Wave {N} of {WAVE_COUNT}"
   ```
3. **Per-wave executor prompt template** (the model renders this with the wave's bug list):
   ```
   Fix a batch of bugs in the codebase.

   ## Your PLAN
   ### Task 1: {BUGS[0].description — brief}
   **Files:** {to be determined by executor via investigation}
   **Action:** {root cause + fix description — executor investigates}
   **Verification:** {command or criterion}
   **Done when:** {success criterion}

   ### Task 2: {BUGS[1].description — brief}
   ...

   (repeat for each bug in this wave only)

   ## Commit Convention
   After each fix, commit with: fix(bug-fix): {brief description}

   ## Working Directory
   {current working directory}
   ```
   Prose must explicitly state: "The prompt MUST contain only the current wave's bugs. Do NOT include bugs from prior or subsequent waves. Do NOT include a `## Prior Wave Context` section — cross-wave handoff is intentionally skipped for this skill."

4. **RAPID:RETURN switch (differs from Step UAT-d):**
   After each wave's executor returns, parse the `<!-- RAPID:RETURN { ... } -->` HTML comment and switch on `status`:
   - **COMPLETE** → Record the wave's commits and artifacts in `WAVE_RESULTS[N]`. Display the per-wave result block (see below) and continue to wave N+1.
   - **CHECKPOINT** → Record the wave's partial progress in `WAVE_RESULTS[N]` with status `CHECKPOINT`. Display the per-wave result block and continue to wave N+1. Partial progress counts as progress, not failure.
   - **BLOCKED** → Record the blocker in `WAVE_RESULTS[N]` with status `BLOCKED`. Display the per-wave result block AND the blocker details. **STOP the entire run.** Do NOT dispatch waves N+1..WAVE_COUNT. Proceed directly to Step 4c (Aggregate Results) and render the aggregate with the waves completed so far.

   Prose must explicitly call out the divergence from Step UAT-d:
   > "NOTE: This differs from Step UAT-d, which continues on BLOCKED. In wave splitting, BLOCKED STOPS the run to prevent compounding failures across waves."

5. **Per-wave result block** (displayed after each dispatch, regardless of status):
   ```
   --- Wave {N} Result ---
   Status: {COMPLETE|CHECKPOINT|BLOCKED}
   Bugs in wave: {count}
   Commits: {comma-separated hashes or "(none)"}
   Files modified: {count}
   {If CHECKPOINT: "Note: partial progress — continuing to next wave."}
   {If BLOCKED: "Blocker: {details}. STOPPING run."}
   -----------------------
   ```

#### Step 4c: Aggregate Results

Prose must specify:

1. After the loop terminates (either naturally via completion of `WAVE_COUNT` waves, or prematurely via BLOCKED in a wave), render an aggregate summary. The aggregate MUST render even on a halted run.
2. Aggregate table format:
   ```
   --- RAPID Bug Fix (Wave Splitting) Complete ---
   Total bugs: {BUG_COUNT}
   Wave size: {WAVE_SIZE}
   Waves dispatched: {number of waves actually dispatched, may be < WAVE_COUNT on BLOCKED}
   Waves completed: {count of COMPLETE}
   Waves checkpointed: {count of CHECKPOINT}
   Waves blocked: {count of BLOCKED}
   Total commits: {sum of commits across all waves}
   Total files modified: {sum of distinct files across all waves}

   Per-Wave Summary:
   | Wave | Bugs | Status     | Commits              | Files |
   |------|------|------------|----------------------|-------|
   | 1    | 3    | COMPLETE   | abc1234, def5678, .. | 4     |
   | 2    | 3    | CHECKPOINT | 9a0bcde              | 2     |
   | 3    | 3    | BLOCKED    | (none)               | 0     |
   ...
   ------------------------------------------------
   ```
3. After rendering the aggregate, proceed to Step 5 for the final completion footer. If the run was halted by BLOCKED, Step 5 still displays the footer — there is no separate error exit.

**Important prose requirements:**
- The sequential-only callout MUST use the word "CRITICAL" and the phrase "never use parallel" (or "never in parallel") so it is greppable in verification.
- The 10/3 example MUST use the literal string "10 bugs" so verification grep catches it.
- The BLOCKED stop-on-halt prose MUST use the literal word "STOP" in an unambiguous position (e.g., "STOPPING run" or "STOP the entire run") so verification grep catches it.
- The prompt template MUST NOT contain the phrase "Prior Wave Context" — absence is load-bearing per CONTEXT.md.

**Verification:**
```bash
grep -n "Step 4a\|Step 4b\|Step 4c" skills/bug-fix/SKILL.md
grep -n "10 bugs" skills/bug-fix/SKILL.md
grep -ni "CRITICAL.*parallel\|never.*parallel\|strictly SEQUENTIALLY" skills/bug-fix/SKILL.md
grep -n "STOP" skills/bug-fix/SKILL.md
grep -c "Prior Wave Context" skills/bug-fix/SKILL.md
grep -n "display banner bug-fix" skills/bug-fix/SKILL.md
grep -n "WAVE_COUNT\|WAVE_RESULTS" skills/bug-fix/SKILL.md
```
- First must show all three sub-step headers.
- Second must find the codified acceptance example.
- Third must find the sequential-only callout.
- Fourth must find the stop-on-BLOCKED prose.
- Fifth (count) must return `0` — absence of "Prior Wave Context" is load-bearing.
- Sixth must find the per-wave banner command.
- Seventh must find both loop state variables.

**Done when:** All three sub-steps exist between Step 4's branching conditional and Step 5, the 10/3 example is codified, the sequential-only callout is present with the word CRITICAL, the stop-on-BLOCKED prose uses the literal word STOP, the prompt template does not contain "Prior Wave Context", and the aggregate renders even on halted runs.

**Commit:** `feat(bugfix-wave-splitting): add Step 4a/4b/4c decomposition, dispatch loop, and aggregate`

---

### Task E — Update Notes Section with Contract Divergence

**Files:**
- `skills/bug-fix/SKILL.md`

**Target:** The existing `## Important Notes` section (currently lines 293-301 pre-edits; shifted after Tasks A–D).

**Action:** Append two new bullet entries to the end of the Notes list, preserving all existing bullets verbatim. The new entries:

1. **Wave splitting bullet:**
   > "**Wave splitting (`--wave-size <n>`).** When the non-UAT path receives a multi-bug bullet list AND the bug count reaches the floor (2 × `WAVE_SIZE`, default 6), the skill dispatches one rapid-executor per wave strictly sequentially. CHECKPOINT in any wave continues to the next wave; BLOCKED halts the run and renders the aggregate with partial progress. Single-bug invocations and bug lists below the floor use the legacy single-executor path with exact backward compatibility."

2. **Contract divergence bullet:**
   > "**Contract divergence (post-merge cleanup).** `.planning/sets/bugfix-wave-splitting/CONTRACT.json` contains two vestigial items not implemented per the discussion decisions: (1) `exports.cross-wave-handoff` — cross-wave handoff was explicitly skipped, each wave receives only its assigned bugs with no prior-wave context; (2) the `"5 UAT"` default mentioned in `exports.wave-splitting.description` — UAT mode is left unchanged, wave splitting applies only to the normal path. Both items are flagged for post-merge cleanup (strike from contract, no code changes required). Precedent: `.planning/sets/code-graph-backend/VERIFICATION-REPORT.md` recorded a similar divergence as an Advisory Note without modifying `CONTRACT.json`."

**Important prose requirements:**
- Do NOT modify any existing bullet in the Notes section. Only append.
- Do NOT modify `CONTRACT.json`. The divergence is prose-documented in the Notes section only.
- Do NOT introduce a new heading. These are bullets under the existing `## Important Notes` header.

**Verification:**
```bash
grep -n "Important Notes" skills/bug-fix/SKILL.md
grep -n "Wave splitting" skills/bug-fix/SKILL.md
grep -n "Contract divergence\|cross-wave-handoff\|vestigial" skills/bug-fix/SKILL.md
grep -n "post-merge cleanup" skills/bug-fix/SKILL.md
git diff skills/bug-fix/SKILL.md .planning/sets/bugfix-wave-splitting/CONTRACT.json | grep "CONTRACT.json"
```
- First four must return matches for the new bullets.
- Fifth must return empty — `CONTRACT.json` must be untouched.

**Done when:** Two new bullets appear at the end of `## Important Notes`, all existing bullets are preserved verbatim, and `CONTRACT.json` is untouched.

**Commit:** `docs(bugfix-wave-splitting): document wave splitting and contract divergence in Notes`

---

### Task F — Verify Backward Compatibility and UAT Path Untouched

**Files:** (read-only, no edits)
- `skills/bug-fix/SKILL.md`

**Action:** Run the following verification commands and confirm each result matches the expected behavior. This task produces NO commit — it is a final review gate before the wave is marked complete.

1. **Confirm Step 0c exists and is positioned correctly:**
   ```bash
   grep -n "Step 0b\|Step 0c\|Step UAT" skills/bug-fix/SKILL.md | head -20
   ```
   Expected: Step 0b line number < Step 0c line number < first Step UAT line number.

2. **Confirm Step UAT-d is present, un-renamed, and still continues on BLOCKED:**
   ```bash
   grep -c "Step UAT-d" skills/bug-fix/SKILL.md
   grep -n "continue to the next failure.*do NOT stop" skills/bug-fix/SKILL.md
   ```
   Expected: first command returns ≥ 1 (header + any references preserved). Second command returns at least one match — the original UAT-d behavior is unchanged.

3. **Confirm the single-executor block in Step 4 is byte-identical to the pre-edit version:**
   ```bash
   grep -n "Spawn the \*\*rapid-executor\*\* agent with this task" skills/bug-fix/SKILL.md
   grep -n "If COMPLETE:\|If BLOCKED:\|If CHECKPOINT:" skills/bug-fix/SKILL.md
   ```
   Expected: the first must return at least one match (ideally two — one in Step 4 legacy block, one in Step 4b wave loop template if the wave loop reuses the same wording, though the wave loop uses "For each wave, spawn..." so this may return only one — either is acceptable as long as the legacy block is intact). The second must return matches for the legacy switch.

4. **Confirm wave-splitting state variables are present:**
   ```bash
   grep -n "WAVE_SIZE\|WAVE_COUNT\|WAVE_RESULTS\|BUG_COUNT" skills/bug-fix/SKILL.md
   ```
   Expected: all four variables referenced.

5. **Confirm acceptance example is codified:**
   ```bash
   grep -n "10 bugs" skills/bug-fix/SKILL.md
   ```
   Expected: at least one match.

6. **Confirm sequential-only callout is present:**
   ```bash
   grep -ni "CRITICAL.*parallel\|never.*parallel\|strictly SEQUENTIALLY" skills/bug-fix/SKILL.md
   ```
   Expected: at least one match.

7. **Confirm stop-on-BLOCKED prose is present:**
   ```bash
   grep -n "STOP" skills/bug-fix/SKILL.md
   ```
   Expected: at least one match in the Step 4b prose region.

8. **Confirm "Prior Wave Context" is absent:**
   ```bash
   grep -c "Prior Wave Context" skills/bug-fix/SKILL.md
   ```
   Expected: exactly `0`.

9. **Confirm CONTRACT.json untouched:**
   ```bash
   git status --short .planning/sets/bugfix-wave-splitting/CONTRACT.json
   ```
   Expected: empty output (no staged or unstaged changes).

10. **Line-count sanity check:**
    ```bash
    wc -l skills/bug-fix/SKILL.md
    ```
    Expected: roughly 400–500 lines (was 301 before edits; the additions total approximately 150–200 lines of prose across Tasks A, B, C, D, E).

11. **Diff sanity check — only the one file touched in this set:**
    ```bash
    git diff --name-only
    git status --short
    ```
    Expected: the only file listed as modified in this set's scope is `skills/bug-fix/SKILL.md`. No other files under the set's owned-file scope should appear.

**Done when:** All 11 checks pass exactly as described. If any check fails, return to the relevant earlier task to correct the prose, then re-run the full verification before proceeding to wave completion.

**Commit:** (none — verification only)

---

## Success Criteria (Wave-Level)

The wave is complete when all of the following hold:

1. `skills/bug-fix/SKILL.md` contains a new Step 0c section that parses `--wave-size <n>` with validation and default 3.
2. Step 1 accepts multi-bug bullet-list input and populates `BUGS` + `BUG_COUNT`; single-bug invocations produce `BUG_COUNT = 1` with no behavior change.
3. Step 4 contains a wave-splitting conditional at its top with a strict `<` floor check (`BUG_COUNT < 2 × WAVE_SIZE`), worked examples for 5/3, 6/3, and 10/3, and the legacy single-executor block below preserved byte-identical.
4. Step 4a, Step 4b, and Step 4c exist as sub-sections with decomposition, sequential dispatch loop, and aggregate results logic.
5. The sequential-only callout is present with the word CRITICAL.
6. The 10/3 acceptance example is codified verbatim.
7. The stop-on-BLOCKED prose uses the literal word STOP.
8. The per-wave executor prompt template does NOT contain "Prior Wave Context".
9. Step UAT through Step UAT-Results are byte-identical to their pre-edit state (verified by grep).
10. The `## Important Notes` section contains new bullets documenting wave splitting and the contract divergence, without modifying existing bullets.
11. `.planning/sets/bugfix-wave-splitting/CONTRACT.json` is untouched.
12. `wc -l skills/bug-fix/SKILL.md` returns a line count in the 400–500 range.
13. All commits for this wave follow the `fix(bugfix-wave-splitting): ...` / `feat(bugfix-wave-splitting): ...` / `docs(bugfix-wave-splitting): ...` convention.

## Commit Plan (Atomic, One Per Task)

| # | Task | Commit Message |
|---|------|----------------|
| 1 | A | `feat(bugfix-wave-splitting): add Step 0c --wave-size flag parser` |
| 2 | B | `feat(bugfix-wave-splitting): extend Step 1 with multi-bug bullet-list intake` |
| 3 | C | `feat(bugfix-wave-splitting): add Step 4 wave-splitting conditional with floor check` |
| 4 | D | `feat(bugfix-wave-splitting): add Step 4a/4b/4c decomposition, dispatch loop, and aggregate` |
| 5 | E | `docs(bugfix-wave-splitting): document wave splitting and contract divergence in Notes` |
| 6 | F | (no commit — verification gate) |

Do NOT batch tasks into a single commit. Each task's edit must land as its own commit for bisectability.
