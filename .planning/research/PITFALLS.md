# Pitfalls Research

**Domain:** Adding workflow simplification, parallel planning, plan verification, and context optimization to an existing Claude Code plugin system (RAPID v2.1)
**Researched:** 2026-03-09
**Confidence:** HIGH (based on direct codebase analysis of 17 skills, 21 libraries, 14 agent role modules, plus operational user feedback in todo.md)

Note: This supersedes the 2026-03-06 v2.0 research. Previous pitfalls about state machine design, merge adaptation, and Playwright UAT were addressed in v2.0 implementation. This document focuses specifically on pitfalls when ADDING v2.1 features (workflow streamlining, GSD decontamination, parallel wave planning, plan verifier, numeric ID shorthand, batched questioning, context-efficient review) to the existing v2.0 system.

---

## Critical Pitfalls

### Pitfall 1: Incomplete GSD Decontamination Causing Runtime Agent Identity Confusion

**What goes wrong:**
GSD references exist at three distinct layers and missing any one layer causes agents to spawn with wrong identity prefixes. The user's todo.md documents this exact failure: agents spawning as `gsd-phase-researcher`, `gsd-wave planner`, and `gsd-review` at runtime. The codebase currently has:
1. **Source code:** `gsd_state_version: 1.0` in `src/lib/init.cjs:53` and its test assertion in `init.test.cjs:90-92`
2. **Planning artifacts:** 60+ GSD references across `.planning/research/` files, `.planning/phases/` context and research documents -- these get loaded into agent context during research synthesis and wave planning, leaking the GSD identity into agent prompts
3. **Runtime environment:** The user's Claude Code installation at `~/.claude/` has the GSD framework installed (get-shit-done plugin) which defines agent types like `gsd-phase-researcher`. When RAPID skills spawn agents using the Agent tool, Claude Code may resolve agent type names from the GSD registry if RAPID's own naming is ambiguous or if the prompt lacks strong identity anchoring

The `assembler.cjs` generates frontmatter with `name: rapid-{role}` (line 65), but this only applies to agents assembled through the formal assembler pipeline. The wave-plan, discuss, review, execute, and init skills all construct agent prompts INLINE within their SKILL.md files -- they read role modules from `src/modules/roles/` and paste them into Agent tool calls. These inline prompts do not go through the assembler and therefore miss the `name: rapid-{role}` frontmatter entirely. Claude Code then falls back to its own agent type resolution, which may match GSD agent types from the user's installed plugins.

**Why it happens:**
The decontamination is treated as a simple find-and-replace when it is actually a three-layer problem (source, planning artifacts, runtime environment). Developers fix the obvious layer (source code) and miss the less obvious layers (archived planning documents that get loaded as agent context, and the runtime agent name resolution in Claude Code).

**How to avoid:**
1. **Source code sweep:** grep the entire `src/` tree for `gsd`, `GSD`, `get-shit-done`, `get.shit.done` (case-insensitive). Fix `init.cjs:53` (rename `gsd_state_version` to `rapid_state_version`) and update `init.test.cjs:90-92` to match. Run all tests afterward.
2. **Planning artifact sweep:** Search `.planning/` for GSD references. For historical/research files in `.planning/phases/` and `.planning/research/`, these can stay as-is since they document v2.0 development history. But ensure no active SKILL.md or role module loads these files as context for new agents.
3. **Agent identity anchoring in skills:** Ensure every Agent tool invocation in every SKILL.md includes explicit identity: "You are a RAPID agent named rapid-{role}." The role modules already say "RAPID agent" but the skill-level prompt construction should reinforce this with a consistent preamble.
4. **Integration test:** After decontamination, run a smoke test of each skill that spawns agents (init, wave-plan, execute, review) and verify the agent type names displayed in the Claude Code UI start with "rapid-" not "gsd-".

**Warning signs:**
- Agent spawn messages in Claude Code UI showing "gsd-" prefixed names
- Agents referring to "GSD workflow" or "phases" instead of "sets/waves/jobs"
- Subagents attempting to use `gsd-tools.cjs` instead of `rapid-tools.cjs` via RAPID_TOOLS
- Test assertions still referencing `gsd_state_version`

**Phase to address:**
First phase -- GSD decontamination must happen before any other workflow changes, because agents with confused identity will mis-execute all subsequent features.

---

### Pitfall 2: State Transition Table Gaps When Adding Plan Verification Stage

**What goes wrong:**
The current wave state machine in `state-transitions.cjs` defines a linear progression: `pending -> discussing -> planning -> executing -> reconciling -> complete`. Adding a plan verification stage as a new state (e.g., `verified` or `validated`) between `planning` and `executing` requires coordinated updates across four tightly coupled files:

1. `state-transitions.cjs` -- the `WAVE_TRANSITIONS` map (lines 12-20) must include the new state and its allowed transitions
2. `state-schemas.cjs` -- the `WaveStatus` Zod enum must include the new status string, or writes will fail Zod validation
3. `state-machine.cjs` -- the `WAVE_STATUS_ORDER` ordinal map (lines 141-144) must assign the correct ordinal, and `deriveWaveStatus()` (lines 182-197) must handle the new status in its derivation logic
4. `rapid-tools.cjs` -- CLI commands that check wave status must recognize the new state

If any of these four files is missed, the system enters an inconsistent state. A wave stuck in `validated` with no valid transition out will block the entire set's execution. Zod will reject STATE.json writes containing the unrecognized status. The ordinal map will return `undefined` for the new status, causing `isDerivedStatusValid()` (lines 161-168) to return `false` and silently skip set status updates.

**Why it happens:**
The state machine is distributed across four files for separation of concerns (schemas, transitions, derivation, CLI). This is good design for maintenance but dangerous for additive changes -- adding a state is a cross-cutting concern that must touch all four files atomically.

**How to avoid:**
1. **Strong recommendation: Do NOT add a new state.** Implement the plan verifier as a sub-step within the `planning` state. The wave stays in `planning` until verification passes, then transitions to `executing`. The verification result is an artifact (VERIFICATION-REPORT.md), not a state. This approach requires zero changes to the state machine.
2. **If a new state IS required:** Create a checklist that must be followed:
   - Add to `WAVE_TRANSITIONS` in `state-transitions.cjs`
   - Add to `WaveStatus` Zod enum in `state-schemas.cjs`
   - Add ordinal to `WAVE_STATUS_ORDER` in `state-machine.cjs`
   - Update `deriveWaveStatus()` if the new status should be derivable from child statuses
   - Update any status-checking logic in `rapid-tools.cjs` CLI
   - Update SKILL.md files that hardcode status checks (wave-plan Step 2, discuss Step 2, execute Step 0c, review Step 0c all check wave/set status)
   - Write transition tests FIRST, run them, watch them fail, then add the state
3. **Run the full state machine test suite:** `node --test src/lib/state-machine.test.cjs && node --test src/lib/state-transitions.test.cjs && node --test src/lib/state-schemas.test.cjs` after any state change.

**Warning signs:**
- Zod validation errors when writing STATE.json with a new status
- `isDerivedStatusValid()` returning false for what should be valid progressions
- Skills checking for the old status list and missing the new one (e.g., execute skill rejects a wave in `validated` because it only accepts `planning`)
- Tests in `state-machine.test.cjs` or `state-transitions.test.cjs` failing after changes

**Phase to address:**
Plan verification phase -- but strongly recommend the sub-step approach (no new state) as the lower-risk path.

---

### Pitfall 3: Parallel Wave Planning Creating Race Conditions on Shared Artifacts

**What goes wrong:**
The v2.1 goal of parallel wave planning means multiple wave-plan invocations running simultaneously for different waves within the same set. The state machine itself is lock-protected (via proper-lockfile in `transitionWave()`, state-machine.cjs line 275), so STATUS transitions are race-safe. However, the planning ARTIFACTS that wave-plan produces have a collision risk:

1. **VALIDATION-REPORT.md** -- Currently written to `.planning/sets/{setId}/VALIDATION-REPORT.md` (wave-plan SKILL.md Step 6, line 255). Two parallel wave-plan runs for different waves both write to this same path, causing last-write-wins data loss.
2. **Git commits** -- Wave-plan SKILL.md Step 7 runs `git add ".planning/waves/${SET_ID}/${WAVE_ID}/"` then `git commit`. Two concurrent git commits can fail with `error: cannot lock ref 'HEAD'` race. Git serializes commits via the HEAD lockfile, but the second commit may fail rather than retry.
3. **OWNERSHIP.json** -- If wave planning produces ownership updates (from contract validation), concurrent writes to `.planning/sets/OWNERSHIP.json` could corrupt the file.

**Why it happens:**
The state machine was designed with concurrency protection (locks, atomic writes). But the SKILL.md-level orchestration was designed for sequential execution -- it writes artifacts to fixed paths without considering concurrent invocations. The artifact paths are hardcoded in the natural language instructions of SKILL.md, not in the CLI tool where locking could be added.

**How to avoid:**
1. **Move VALIDATION-REPORT.md to wave directory:** Change the path from `.planning/sets/{setId}/VALIDATION-REPORT.md` to `.planning/waves/{setId}/{waveId}/VALIDATION-REPORT.md`. Since each wave writes to its own subdirectory, this eliminates the collision. Update both the SKILL.md and the CLI `validate-contracts` subcommand.
2. **Serialize git commits with retry:** Add a retry loop around the git commit in wave-plan Step 7: try `git commit`, if it fails with a lock error, wait 1-2 seconds and retry up to 3 times. Alternatively, each wave-plan run stages and commits its own wave directory independently.
3. **Lock shared artifact writes:** If any artifact must remain at the set level, use the existing `acquireLock()` from `lock.cjs` before writing.
4. **Test parallel scenarios:** Write an integration test that spawns two wave-plan operations on different waves in the same set and verifies both produce correct artifacts without corruption.

**Warning signs:**
- VALIDATION-REPORT.md containing results for the wrong wave
- Git commit failures with `cannot lock ref 'HEAD'` during parallel wave planning
- OWNERSHIP.json containing partial or corrupted data
- One wave's planning artifacts overwriting another's

**Phase to address:**
Parallel wave planning phase. The VALIDATION-REPORT.md path fix should be the first change when enabling parallel planning.

---

### Pitfall 4: Context Window Exhaustion in Review Pipeline From Centralized File Loading

**What goes wrong:**
The review SKILL.md is 790 lines. The orchestrating skill spawns up to 7 subagent types (unit-tester, bug-hunter, devils-advocate, judge, bugfix, UAT, plus potentially a scoper). For each subagent, the orchestrator currently:
- Reads the role module via `cat src/modules/roles/role-*.md` (50-150 lines each)
- Reads context files: WAVE-CONTEXT.md, CONTRACT.json, SET-OVERVIEW.md
- Reads JOB-PLAN.md files (one per job, 50-100 lines each)
- For the bug hunt pipeline: passes source file contents inline and previous stage results

For a wave with 5 jobs touching 5 files each, the orchestrator's context consumption grows to 50K+ tokens before the adversarial pipeline even starts. The 3-cycle bug hunt (hunter + advocate + judge + bugfix per cycle) multiplies this by 4 agents x 3 cycles = 12 additional agent spawns, each receiving accumulated context from previous stages.

The user's todo.md explicitly flags this: "currently the agents eat quite a lot of context, we need to find a way to make use of more subagents/agent teams" and "for the review, perhaps the review agent should spawn a scoper as well so the context length doesn't get eaten up."

**Why it happens:**
The current review skill loads all source file CONTENTS into the orchestrator's context to pass inline to subagents. This was a reasonable approach at small scale but becomes the primary bottleneck at larger scale. The orchestrator becomes a context-window chokepoint because it must hold enough information to construct intelligent prompts for each subagent.

**How to avoid:**
1. **Scoper-first pattern:** Spawn a scoper subagent BEFORE the review pipeline. The scoper reads all source files, computes the review scope (changed files + one-hop dependents), and returns a structured summary: file paths, key function signatures, dependency map, and a brief per-file summary (3-5 lines per file). The orchestrator receives only this summary (~2K tokens for 20 files), not the full source (~30K tokens).
2. **Subagents load their own files:** Instead of passing source file contents inline in the Agent prompt, pass FILE PATHS and let subagents use the Read tool to load them from disk. Each subagent has its own fresh 200K context window. This shifts the context cost from the orchestrator (shared, accumulating) to each subagent (fresh, independent).
3. **Stage results compression:** After each pipeline stage, extract only the actionable structured data (findings array, test results array) and discard verbose output (full test runner logs, raw agent reasoning). Pass the compressed structured data to the next stage.
4. **Lean default, full opt-in:** Change the review default from "All stages" to "Unit test + lean review" for wave-level review. Full adversarial bug hunt becomes opt-in for set-level or pre-merge review.

**Warning signs:**
- Orchestrator running into context window limits during review
- Review subagents returning CHECKPOINT because they ran out of context mid-analysis
- Subagent outputs becoming increasingly shallow in later pipeline stages
- Total review cost exceeding $30 for a single wave

**Phase to address:**
Context-efficient review phase. The scoper pattern and file-path delegation should be designed as a unit, not as independent changes.

---

### Pitfall 5: Numeric ID Shorthand Creating Inconsistent UX Across Skills

**What goes wrong:**
The v2.1 feature of numeric ID shorthand (e.g., `/set-init 1` instead of `/set-init set-01-foundation`) must work consistently across 7+ skills that accept entity IDs: set-init, discuss, wave-plan, execute, review, merge, and status. If numeric resolution is implemented per-skill in the SKILL.md natural language instructions:
- Each skill independently interprets "1" -- some as 0-indexed, some as 1-indexed, some as prefix match
- When a new skill is added, the developer must remember to copy the resolution logic
- Edge cases diverge: skill A handles "1" when set names start with numbers, skill B does not
- Claude's interpretation of natural language resolution instructions is non-deterministic -- the same instruction may produce different behaviors across invocations

If numeric resolution is implemented in the CLI (`rapid-tools.cjs`) but not all skills are updated to use it, some skills accept numeric IDs and others reject them with "not found" errors.

**Why it happens:**
The path of least resistance is to add numeric resolution to the first skill that needs it (set-init, per the todo.md) and plan to "roll it out" to other skills later. But "later" becomes "never" because each skill works individually, and the inconsistency is only noticed when users try different commands.

**How to avoid:**
1. **Implement in rapid-tools.cjs as a library function:** Add `resolveEntityId(state, entityType, input)` to `state-machine.cjs` that handles: exact string match (highest priority), numeric 1-based index into the ordered entity list, prefix match (e.g., "auth" matches "auth-system"). Return the resolved ID or throw with a disambiguation message.
2. **Add a CLI subcommand:** `node "${RAPID_TOOLS}" resolve-id set "1"` that returns the resolved set ID as JSON. All skills call this before processing.
3. **Update all skills simultaneously:** When adding numeric ID support, update every SKILL.md that accepts entity IDs in the same changeset. Use a consistent pattern: "If the user provided an ID, resolve it via `node "${RAPID_TOOLS}" resolve-id {entityType} {userInput}` before proceeding."
4. **Test edge cases explicitly:**
   - Set named "1-auth" with numeric input "1" -- should this match by prefix or by index?
   - 10 sets where input "1" could mean index 1 or set "10-api" by prefix
   - Wave ID "wave-1" with just "1" as input
   - Resolution should follow: exact match > numeric index (1-based) > prefix match

**Warning signs:**
- User says "1" and gets a different entity in different commands
- Some commands accept "1" and others give "not found" errors
- Off-by-one errors (user says "1", gets the second entity)
- Ambiguous match errors that only occur in specific commands

**Phase to address:**
Numeric ID shorthand phase. Must be implemented as a library function first, then rolled out to all skills in one pass. Do NOT ship partial support.

---

### Pitfall 6: Batched Questioning Breaking the AskUserQuestion Structured Options Pattern

**What goes wrong:**
The current discuss skill asks one question at a time using AskUserQuestion with structured options (SKILL.md lines 117-207). The v2.1 goal of batched questioning aims to reduce the latency of answer -> wait 30-60s -> answer -> wait cycle. But AskUserQuestion is designed for single questions with structured options. There is no native "batch question" API -- you cannot send 3 questions in one AskUserQuestion call.

Two broken implementations emerge:
1. **Concatenated freeform:** Multiple questions crammed into a single freeform AskUserQuestion. The user's response is a blob of text that the agent must parse. If the user answers only 2 of 3 questions, the agent cannot detect which was skipped. If the user's answer is ambiguous about which question it addresses, decisions are assigned incorrectly. The WAVE-CONTEXT.md then contains wrong decisions that propagate through the entire planning and execution pipeline.
2. **Rapid-fire sequential:** Questions asked sequentially but without waiting for agent processing between them. This does not actually solve the problem because the latency is in the agent's processing, not the user's typing.

**Why it happens:**
The desire to reduce latency conflicts with the tool's single-question design. The "batching" that users actually want is not multiple simultaneous questions -- it is fewer, more substantive questions that cover more ground per interaction.

**How to avoid:**
1. **Group by topic, not by count:** Instead of asking 8 questions one at a time, group related gray areas into 2-3 thematic clusters. Ask one AskUserQuestion per cluster with options that bundle related decisions. Example: "For the data layer approach: A) PostgreSQL with Prisma ORM and migration tooling, B) SQLite with raw queries for simplicity, C) Let Claude decide based on project scale." This bundles 3 decisions (database, ORM, migration) into one structured question.
2. **Use multiSelect for independent choices:** AskUserQuestion already supports `multiSelect: true` (used in discuss SKILL.md line 117 for gray area selection). Extend this pattern: present all gray areas upfront, let the user select which to discuss, then only deep-dive selected ones.
3. **"Let Claude decide all" fast path:** If the user selects zero gray areas (SKILL.md line 127: "select none to let me decide all"), the discuss skill should still produce valid WAVE-CONTEXT.md with documented autonomous decisions. This is the ultimate "batch" -- zero questions.
4. **Never batch decisions that depend on each other:** If the answer to question 1 changes what question 2 should be, they cannot be batched. Only batch truly independent decisions.
5. **Structured options always:** Never use freeform responses for batched questions. Structured options ensure unambiguous parsing.

**Warning signs:**
- Users reporting the agent misunderstood their response
- WAVE-CONTEXT.md containing decisions the user did not make
- Discuss sessions taking MORE time due to misinterpretation and re-asking
- Agent asking "which question were you answering?"

**Phase to address:**
Discuss skill rework phase. Design the batching strategy DURING the discuss rework, not as a separate bolt-on.

---

### Pitfall 7: Plan Verifier Becoming a Rubber Stamp or an Over-Blocker

**What goes wrong:**
The plan verifier is a new agent that checks coverage and implementability. Two failure modes:

**Rubber stamp (too permissive):** The verifier duplicates checks already performed by `validateJobPlans()` in `wave-planning.cjs` (lines 160-223). That function already checks export coverage (are all contract export files covered by job plans?) and cross-set import validation (do imported functions exist in source set contracts?). The verifier that runs the same checks wastes an agent spawn ($2-5 per invocation) without adding value.

**Over-blocker (too strict):** The verifier flags implementability concerns that are actually fine -- e.g., "this job modifies 8 files which is complex" or "implementation step 3 lacks detail about error handling." Developers are forced through unnecessary re-planning cycles, increasing friction rather than reducing it. The user's todo.md already notes "there is some form of over planning/granularity" -- adding a strict verifier amplifies this problem.

**Why it happens:**
The verifier's purpose is underspecified. "Coverage + implementability checks" is vague enough that the implementing developer will either duplicate existing checks (path of least resistance) or build an ambitiously thorough agent that second-guesses every plan detail (overengineering).

**How to avoid:**
1. **Define the verifier's UNIQUE value -- what it checks that `validateJobPlans()` does NOT:**
   - File conflict detection: do two jobs in the same wave plan to modify the same file? (This is not currently checked)
   - Step ordering validation: does job A depend on job B's output but both execute in parallel? (This is not currently checked)
   - Missing test coverage: do acceptance criteria in JOB-PLAN.md have corresponding test steps? (Not checked)
   - Contract completeness: do new files created by jobs get exported in the contract if other sets need them? (Not checked)
2. **Make it advisory, not blocking:** The verifier produces VERIFICATION-REPORT.md with findings. The user decides whether to re-plan. It does NOT automatically reject plans or require re-planning.
3. **Set a cost budget:** The verifier should be a single agent invocation, not a multi-agent pipeline. Target: one agent, one pass, under $3.
4. **Implement the deterministic checks in code, not in the agent:** File conflict detection and step ordering can be checked programmatically in `wave-planning.cjs` (no LLM needed). The agent adds natural-language assessment of implementability on top of the programmatic checks. This keeps the deterministic checks fast, reliable, and free.

**Warning signs:**
- Verifier consistently returning "PASS" with no actionable findings (rubber stamp)
- Verifier blocking every plan with vague implementability warnings (over-blocker)
- Users routinely skipping the verifier because it never adds value
- Verifier costing more than the wave-plan pipeline itself

**Phase to address:**
Plan verification phase. Define the exact check list in phase research BEFORE implementing the agent.

---

### Pitfall 8: Workflow Streamlining Breaking Re-entry and Idempotency

**What goes wrong:**
The current workflow has explicit user-triggered transitions: `/init` -> `/set-init` -> `/discuss` -> `/wave-plan` -> `/execute` -> `/review` -> `/merge`. Each skill is designed for idempotent re-entry:
- `/execute` skips completed jobs on re-invocation (execute SKILL.md Step 2, smart re-entry)
- `/review` picks up where it left off if the set is already in `reviewing` state (review SKILL.md Step 0d)
- `/discuss` offers to re-discuss or view existing context (discuss SKILL.md Step 2)
- `/wave-plan` offers to re-plan or view existing plans (wave-plan SKILL.md Step 2)

The v2.1 goal of auto-running plan after init creates a chain: init completes -> auto-triggers plan. But if the user interrupts during auto-plan (ctrl+c) and then runs `/init` again:
- Init Step 3 detects existing `.planning/` files and offers Reinitialize/Upgrade/Cancel
- If user selects "Upgrade," the partial planning state from the interrupted auto-plan is preserved but may be inconsistent
- The auto-plan resumes (or re-runs) but encounters partially-written ROADMAP.md, incomplete STATE.json structures, or orphaned research artifacts from the interrupted init

Similarly, if wave-plan is auto-triggered after discuss, and the user interrupts during wave-plan, running `/discuss` again will re-discuss (overwriting WAVE-CONTEXT.md) but the partially-completed wave-plan artifacts (partial WAVE-PLAN.md, some JOB-PLAN.md files) remain orphaned.

**Why it happens:**
Each skill checks its own preconditions (entity state, artifact existence) but does NOT check for artifacts from DOWNSTREAM interrupted operations. Init checks for existing `.planning/` but not for partial ROADMAP.md. Discuss checks wave state but not for orphaned JOB-PLAN.md files from an interrupted wave-plan.

**How to avoid:**
1. **Auto-chain via user suggestion, not auto-execution:** Instead of automatically running the next step, display "Recommended next step: `/rapid:wave-plan {waveId}`" and let the user trigger it. This preserves clean re-entry boundaries. This is the safer approach.
2. **If auto-chaining IS implemented:** Limit to ONE chain link only (init -> plan is acceptable; init -> plan -> set-init -> discuss is not). Each skill must check for artifacts from downstream interrupted operations at the start. Add artifact staleness detection: if WAVE-PLAN.md exists but is older than WAVE-CONTEXT.md, the plan is stale and should be regenerated.
3. **State machine as authoritative source:** The STATE.json wave/job status should be the ONLY determinant of next steps. Skills should not infer workflow state from artifact existence. If wave status is `discussing`, wave-plan should work regardless of what artifacts exist.
4. **Clean up on re-entry:** When a skill detects it is re-running after an interruption (same state as last run, stale artifacts present), offer to clean up orphaned artifacts before proceeding.

**Warning signs:**
- Users running `/init` repeatedly and getting different behaviors each time
- Orphaned planning artifacts from interrupted auto-chain runs
- Skills failing with "unexpected state" errors after interruption
- STATE.json showing a state that does not match the artifacts on disk (e.g., wave is `planning` but no WAVE-PLAN.md exists)

**Phase to address:**
Workflow streamlining phase. Auto-chaining should be the LAST feature in workflow simplification, after all individual skill re-entry paths are verified.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Implementing numeric ID resolution in each SKILL.md separately | Quick to add per-skill | 7+ copies of resolution logic diverge over time; bugs fixed in one skill but not others | Never -- implement once in `state-machine.cjs` or `rapid-tools.cjs` |
| Adding plan verifier as a full separate state in the wave state machine | Clean state modeling | 4-file coordinated update required; all skill status checks need updating; full test suite expansion | Never for v2.1 -- use sub-step within `planning` state |
| Passing full source file contents in Agent prompts instead of file paths | Subagent has immediate access without additional tool calls | Orchestrator context exhaustion at scale; 5-job wave with 5 files each = 25 file contents loaded into orchestrator | Only for files under 50 lines; all others should be loaded by the subagent via Read tool |
| Fixing GSD references one file at a time as encountered | Each fix is small and safe | Missed references cause runtime identity confusion; creates an ongoing multi-week cleanup instead of a one-time sweep | Never -- grep exhaustively, fix all at once |
| Batching questions with freeform text instead of structured options | Fewer AskUserQuestion calls | Fragile parsing, misattributed decisions, re-asking loops that waste more time than they save | Never -- use structured options or multiSelect |
| Auto-chaining more than one step (init -> plan -> set-init) | Smoother first-time experience | Re-entry after interruption becomes combinatorially complex; each chain link needs its own recovery path | Only for init -> plan (one link); never for deeper chains |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Plan verifier -> state machine | Adding a new wave state `verified` | Keep wave in `planning` state; verifier produces VERIFICATION-REPORT.md artifact; transition to `executing` only after verification passes (handled by wave-plan or execute skill) |
| Numeric ID resolution -> existing CLI | Implementing resolution in SKILL.md natural language instructions | Add `resolveEntityId()` to `state-machine.cjs`; add `resolve-id` CLI subcommand; all SKILL.md files call the CLI before processing |
| Scoper subagent -> review pipeline | Scoper returns full file contents to orchestrator | Scoper returns file paths + brief per-file summary (function signatures, key types); review subagents use Read tool to load files from paths |
| Batched questions -> discuss skill | Concatenating multiple questions into one freeform AskUserQuestion | Group related decisions into single AskUserQuestion with structured options; use multiSelect for independent choices |
| Auto-plan after init -> roadmap generation | Spawning a separate plan agent after init | Init already runs the roadmapper (init SKILL.md Step 9). Auto-plan means: init writes STATE.json and ROADMAP.md, then displays "next step: /set-init" without a separate invocation |
| Parallel wave planning -> git commits | Two wave-plan runs both `git add .planning/` then `git commit` | Each wave-plan commits only its own wave directory: `git add .planning/waves/{setId}/{waveId}/`; separate commits prevent conflicts |
| GSD decontamination -> test suite | Renaming `gsd_state_version` in init.cjs but forgetting tests | Must also update `init.test.cjs:90-92` assertion; run `node --test src/lib/init.test.cjs` to verify |
| VALIDATION-REPORT.md -> parallel planning | Writing set-level report from concurrent wave-plan runs | Move VALIDATION-REPORT.md to `.planning/waves/{setId}/{waveId}/VALIDATION-REPORT.md` so each wave gets its own report |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Review orchestrator loading all source files into its context | Slow review start, context window warnings, shallow subagent analysis | Scoper subagent pattern -- orchestrator receives summary only; subagents load files via Read | Waves with >10 changed files (~30K tokens of source code in orchestrator context) |
| Sequential question-answer in discuss phase | User waits 30-60s between each of 8+ questions | Batch related decisions into structured multi-option questions; provide "Let Claude decide all" fast path | Sets with >5 gray areas (~8 minutes of waiting) |
| Wave-plan spawning all agents sequentially | 5+ agent spawns = 5+ minutes for a 3-job wave | Parallel job planner spawning (already in wave-plan SKILL.md Step 5); verify parallel dispatching actually occurs by issuing all Agent tool calls in one response | Waves with >3 jobs |
| Bug hunt 3-cycle iteration loading full scope each time | Each cycle re-reads all source files; 12 agent spawns for 3 full cycles | Narrow scope on cycles 2+ to only files modified by bugfix agent (already specified in review SKILL.md Step 3b.1); verify scope actually narrows | Review scope >15 files with >5 accepted bugs |
| Plan verifier running as a multi-agent pipeline | $10+ per verification, taking longer than the planning itself | Single agent, single pass, under $3; deterministic checks in code, LLM for judgment only | Any project -- this is a design trap, not a scale issue |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Inconsistent numeric ID support across commands | User learns `/set-init 1` works, tries `/discuss 1`, gets "not found" | Implement in rapid-tools.cjs; roll out to ALL skills simultaneously; never ship partial support |
| Auto-planning without user confirmation | User wanted to customize the plan but it already auto-ran | Display "Plan generated" and offer "Accept / Modify / Regenerate" (already in init SKILL.md Step 9); do not bypass this gate |
| Verifier blocking plans with vague warnings | User forced to re-plan for non-issues; loses trust in the tool | Verifier is advisory only; findings require explicit user "Block this plan" action; default is to proceed |
| Discuss phase asking 8+ individual questions with 30s+ waits | User fatigue and disengagement | Group into 2-3 thematic clusters; provide "Let Claude decide all" to skip entire discussion |
| Review pipeline defaulting to "All stages" | First review costs $30-45 (hunter+advocate+judge x3 + unit test + UAT) | Default to "Unit test only" or "Unit test + lean review" for first pass; full bug hunt is opt-in |
| Wave-plan requiring exact wave ID when set has only one wave | User must type "wave-1" when the choice is obvious | Auto-select the only available wave/set; only prompt for disambiguation when multiple options exist |
| Workflow confusion about which command comes next | User runs wrong command, gets unhelpful error | Every skill's exit message should include the recommended next command with exact invocation syntax (most skills already do this; verify all do) |

## "Looks Done But Isn't" Checklist

- [ ] **GSD decontamination:** Often missing runtime agent name verification -- verify by actually running each skill that spawns agents and checking the displayed agent names in Claude Code UI, not just grepping source code
- [ ] **GSD decontamination:** Often missing test assertion updates -- verify `init.test.cjs:90-92` passes after renaming `gsd_state_version`
- [ ] **Numeric ID shorthand:** Often missing edge case for sets whose names start with numbers -- verify resolution logic with set named "1-auth" and numeric input "1"
- [ ] **Numeric ID shorthand:** Often missing rollout to all skills -- verify numeric IDs work in set-init, discuss, wave-plan, execute, review, merge, and status
- [ ] **Parallel wave planning:** Often missing VALIDATION-REPORT.md write path fix -- verify that two parallel wave-plan runs for different waves produce separate reports in their respective wave directories
- [ ] **Parallel wave planning:** Often missing git commit serialization -- verify two concurrent `git commit` calls do not produce errors
- [ ] **Batched questioning:** Often missing the "Let Claude decide all" fast path -- verify that selecting zero gray areas produces valid WAVE-CONTEXT.md with documented autonomous decisions
- [ ] **Plan verifier:** Often missing uniqueness check -- verify the verifier adds checks BEYOND what `validateJobPlans()` already does (file conflicts, step ordering, test coverage)
- [ ] **Context-efficient review:** Often missing subagent file loading delegation -- verify review subagents actually use Read tool to load files from paths, not receive file contents inline in their prompt
- [ ] **Workflow streamlining:** Often missing re-entry after interruption testing -- verify by running `/init`, interrupting at Step 7 (research agents), then running `/init` again; verify clean recovery
- [ ] **Leaner review stage:** Often missing cost measurement -- track agent spawn count and token usage before and after changes to verify measurable improvement

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| GSD agent names at runtime | LOW | Update the inline prompt in the offending SKILL.md to include explicit "You are rapid-{role}" identity; no state or artifact corruption; re-test the skill |
| State machine gap from new verification state | MEDIUM | Revert `state-transitions.cjs`; manually fix any waves stuck in the invalid state by editing STATE.json (set their status to `planning`); validate with `node "${RAPID_TOOLS}" state detect-corruption` |
| Race condition on VALIDATION-REPORT.md | LOW | Delete the corrupted report; re-run wave-plan for the affected wave; no state machine impact since artifacts are not state |
| Context exhaustion in review | LOW | Split review into per-wave runs with smaller scope; for the exhausted run, check which stages completed (REVIEW-UNIT.md, REVIEW-BUGS.md exist?) and re-run only incomplete stages |
| Wrong entity selected by numeric ID | LOW | No state change if caught before execution proceeds; if set-init ran on the wrong set, `git worktree remove` the wrong worktree and re-run on the correct set |
| Misinterpreted batched question | MEDIUM | Re-run `/rapid:discuss` with "Re-discuss" to overwrite WAVE-CONTEXT.md; if wave-plan already ran, also re-run wave-plan (plans depend on context decisions) |
| Plan verifier over-blocking | LOW | User can override or skip the verifier; no state impact since verifier is advisory only |
| Auto-chain interruption leaving orphaned artifacts | MEDIUM | Check STATE.json for current entity statuses; delete orphaned planning artifacts (partial WAVE-PLAN.md, incomplete JOB-PLAN.md); re-run the interrupted step from its clean entry point |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Incomplete GSD decontamination | Phase 1: GSD Decontamination | Run each skill that spawns agents; verify "rapid-" prefix in UI; grep for zero "gsd" matches in `src/` active code (excluding tests that test legacy migration) |
| State transition table gaps | Phase: Plan Verification | Verify wave transitions `planning -> executing` still works; run full state machine test suite; verify no Zod validation errors (recommend sub-step approach that requires zero state changes) |
| Parallel wave planning races | Phase: Parallel Wave Planning | Run two wave-plan processes on different waves in same set; verify both produce correct artifacts; verify VALIDATION-REPORT.md writes to wave-level directories |
| Context window exhaustion in review | Phase: Context-Efficient Review | Measure orchestrator context usage before and after scoper pattern; verify review completes for a 5-job wave without context warnings |
| Numeric ID resolution inconsistency | Phase: Numeric ID Shorthand | Try numeric IDs in every skill accepting entity IDs (7+ skills); verify consistent behavior; test edge cases |
| Batched questioning misinterpretation | Phase: Discuss Skill Rework | Run discuss with batched questions; verify WAVE-CONTEXT.md decisions match user responses; test "Let Claude decide all" path |
| Plan verifier rubber stamp / over-block | Phase: Plan Verification | Verify verifier catches at least one issue in a test plan with known problems (file conflict, missing test coverage); verify verifier does NOT block a valid plan |
| Workflow auto-chain breaking re-entry | Phase: Workflow Streamlining | Interrupt at each auto-chain point; verify re-running the triggering command recovers cleanly; verify no orphaned artifacts |

## Sources

- **Direct codebase analysis:** `src/lib/state-machine.cjs` (463 lines), `state-transitions.cjs` (73 lines), `state-schemas.cjs`, `wave-planning.cjs` (230 lines), `review.cjs` (433 lines), `execute.cjs` (973 lines), `assembler.cjs` (243 lines), `teams.cjs` (193 lines), `init.cjs`, `verify.cjs` (161 lines)
- **Skill analysis:** All 17 SKILL.md files examined; 6 analyzed in depth: wave-plan (353 lines), discuss (335 lines), execute (472 lines), review (790 lines), init (556 lines), set-init (162 lines)
- **Agent role modules:** `src/modules/roles/` (26 role modules); key modules analyzed: wave-researcher (106 lines), orchestrator (27 lines)
- **User feedback:** `todo.md` (60 lines of operational issues including GSD naming, workflow confusion, context consumption, review bulk, numeric IDs, batched questions)
- **Project context:** `.planning/PROJECT.md` (v2.1 milestone definition with 8 target features)
- **Config analysis:** `config.json` (agent assembly configuration with 5 agent role mappings)
- **State machine tests:** `src/lib/state-machine.test.cjs`, `state-transitions.test.cjs` (existing test coverage for transition validation)

---
*Pitfalls research for: RAPID v2.1 -- workflow simplification, parallel planning, plan verification, context optimization*
*Researched: 2026-03-09*
