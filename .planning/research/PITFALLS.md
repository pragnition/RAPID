# Domain Pitfalls

**Domain:** Restructuring monolithic merge orchestrator into delegated subagents + comprehensive documentation rewrite for RAPID v2.2
**Researched:** 2026-03-10
**Confidence:** HIGH (based on direct codebase analysis of merge.cjs 1200+ LOC, merge SKILL.md 527 lines, dag.cjs 467 lines, orchestrator/merger agent definitions, review SKILL.md 934 lines as precedent, plus Claude Code subagent constraint verification via official docs)

Note: This supersedes the 2026-03-09 v2.1 pitfalls. Previous pitfalls about GSD decontamination, state machine gaps, numeric IDs, and batched questioning were addressed in v2.1 implementation. This document focuses specifically on pitfalls when ADDING v2.2 features (subagent merge delegation, DAG-ordered parallel merging, adaptive nesting for complex resolutions, and documentation rewrite) to the existing v2.0/v2.1 system.

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or broken merge state.

### Pitfall 1: Orchestrator Context Overflow Despite Delegation -- The "Summary Accumulation" Trap

**What goes wrong:**
The entire point of v2.2 is to prevent the merge orchestrator from overflowing its context by delegating per-set merge work to subagents. But the orchestrator must still COLLECT results from each merge subagent to: (a) track which sets merged successfully, (b) pass "already merged set contexts" to later merge agents, (c) build the final merge summary, and (d) decide whether to trigger bisection. If the orchestrator naively accumulates full RAPID:RETURN payloads from each merge subagent, it replaces one context problem (doing all merge work) with another (holding all merge results).

The current merge SKILL.md Step 4d already processes merger agent RAPID:RETURN results inline. When this pattern is extended to per-set merge subagents (instead of a single merger agent per set), the orchestrator receives:
- Per-set detection reports (L1-L4 conflict counts + details)
- Per-set resolution summaries (T1-T4 counts + file-level details)
- Per-set merger agent semantic conflict findings (L5)
- Per-set merge commit hashes
- Per-set escalation details with proposed resolutions

For a project with 8 sets across 3 waves, this is 8 full result payloads accumulating in the orchestrator context. Each payload is 2K-5K tokens (detection report + resolution details + escalations). That is 16K-40K tokens of accumulated results PLUS the 20K overhead of the skill prompt itself PLUS state tracking. The orchestrator hits 80K+ tokens before even reaching the integration gate.

**Why it happens:**
The Anthropic multi-agent research system identified this exact pattern: "token usage by itself explains 80% of the variance in quality." Delegating work to subagents only solves context overflow if the orchestrator ALSO practices result compression. Developers implement the delegation (spawn subagents) but forget to implement the compression (extract only actionable summary from returns).

**Consequences:**
- Orchestrator context degrades in later waves, producing shallow analysis of integration gate failures
- Bisection recovery logic (Step 7) receives confused context about which sets merged in which order
- The orchestrator may lose track of merge state mid-pipeline, leading to double-merge attempts or skipped sets

**Prevention:**
1. **Compressed result protocol:** Define a "merge summary" schema that is strictly smaller than the full RAPID:RETURN. Each merge subagent returns full details, but the orchestrator extracts and stores only: `{ setId, status, mergeCommit, conflictCount, escalationCount, allResolved }` (~100 tokens per set vs ~3K tokens). Full details are written to MERGE-STATE.json (on disk, not in context).
2. **Disk-based state, not context-based state:** The orchestrator should read MERGE-STATE.json from disk when it needs details about a previously-merged set, rather than holding all results in conversational context. This is exactly how the review scoper pattern works -- subagents write to disk, orchestrator reads summaries.
3. **Progressive context shedding:** After each wave completes its integration gate, the orchestrator should NOT carry forward the per-set details from that wave. Only the wave-level summary (N sets merged, M escalations, integration tests pass/fail) needs to persist.
4. **Budget test:** Before implementing, estimate: `(skill prompt tokens) + (per-set summary * max sets) + (state tracking overhead) < 50K tokens`. If not, the summary schema is too verbose.

**Detection:**
- Orchestrator producing increasingly vague merge summaries in later waves
- Orchestrator "forgetting" that a set was already merged and attempting re-merge
- Step 8 (Pipeline Complete) final summary missing data from early waves

**Phase to address:**
First phase of merge restructuring. Design the compressed result protocol BEFORE building the subagent spawn logic.

---

### Pitfall 2: Result Loss From Subagent RAPID:RETURN Parsing Failures

**What goes wrong:**
The RAPID structured return protocol uses an HTML comment marker `<!-- RAPID:RETURN {...} -->` embedded in the subagent's natural language output. The orchestrator must parse this JSON from the subagent's free-form text response. Three failure modes:

1. **Malformed JSON:** The merge subagent generates a RAPID:RETURN with a JSON syntax error (unclosed brace, unescaped quote in a conflict description, trailing comma). The orchestrator fails to parse, treats the subagent as having returned no results, and proceeds as if the merge had zero conflicts. The set merges into main without resolution -- SILENTLY.

2. **Missing RAPID:RETURN:** The merge subagent runs out of context or hits its `maxTurns` limit before emitting the RAPID:RETURN. The orchestrator receives the subagent's partial output (which may include partial conflict analysis) but no structured return. Current merge SKILL.md Step 4d has no fallback for missing returns.

3. **Truncated return:** The subagent's context compacts mid-response, truncating the RAPID:RETURN JSON. The orchestrator receives `<!-- RAPID:RETURN {"status":"COMPLETE","data":{"semantic_co` -- a valid start that fails JSON parse. If the orchestrator retries parsing with progressively looser strategies, it may extract partial data and proceed with incomplete conflict information.

**Why it happens:**
The review SKILL.md already handles multi-subagent returns (bug-hunter, advocate, judge) and has encountered this pattern. The current handling is implicit -- the skill instructions say "Parse the RAPID:RETURN from the agent" without specifying fallback behavior. For review, a missed finding is unfortunate but survivable. For merge, a missed conflict means corrupted main branch.

Claude Code subagents each start with ~20K tokens of overhead. A merge subagent for a set with many conflicts could consume most of its context on conflict analysis, leaving insufficient room for the structured return.

**Consequences:**
- Main branch receives unresolved conflicts (merge markers in code)
- MERGE-STATE.json shows "complete" for a set that was not actually cleanly merged
- Integration tests fail in Step 7, triggering bisection, but bisection cannot isolate the issue because the "breaking set" appears to have merged cleanly
- Worst case: merge proceeds to next wave on a corrupted base, causing cascading failures

**Prevention:**
1. **Validate RAPID:RETURN parse with fallback:** After parsing the subagent return, the orchestrator must check: (a) JSON parsed successfully, (b) `status` field exists, (c) `data` field exists with expected schema. If any check fails, treat the merge as BLOCKED, not as successful.
2. **Default-unsafe, not default-safe:** If the RAPID:RETURN is missing or malformed, the orchestrator must NOT proceed with the merge. The default assumption is "something went wrong" not "everything is fine."
3. **Git state verification:** After the merge subagent returns, the orchestrator independently verifies the git state: `git diff --check` for conflict markers, `git status` for uncommitted changes. This is a safety net independent of the RAPID:RETURN.
4. **Retry once on parse failure:** If the RAPID:RETURN fails to parse, re-spawn the merge subagent with a smaller scope (e.g., only the unresolved conflicts from L1-L4 detection, skip L5 semantic). If the retry also fails, BLOCK with a clear error.
5. **Write-before-return pattern for subagents:** Instruct merge subagents to write their results to MERGE-STATE.json on disk BEFORE emitting the RAPID:RETURN. If the return is lost, the orchestrator can recover from disk.

**Detection:**
- MERGE-STATE.json showing status "complete" but `detection.semantic.ran: false`
- Git log showing merge commits with conflict markers present in committed files
- Integration test failures in Step 7 that bisection attributes to a set with zero detected conflicts

**Phase to address:**
Core merge subagent phase. The write-before-return pattern and parse validation must be in the subagent role definition and the skill instructions simultaneously.

---

### Pitfall 3: DAG Ordering Bugs When Parallelizing Independent Sets

**What goes wrong:**
The current merge SKILL.md Step 2 states: "Sets within a wave merge SEQUENTIALLY -- each merge sees the result of the previous one." v2.2 changes this: independent sets (same wave, no cross-dependencies) should merge in PARALLEL, while dependent sets (later waves) wait.

The DAG module (`dag.cjs`) correctly computes wave assignment via `assignWaves()` and execution order via `getExecutionOrder()`. The bug surface is NOT in the DAG computation -- it is in the merge orchestrator's application of DAG results to git operations:

1. **Base branch mutation during parallel merge:** Two independent sets (A and B, both in wave 1) merge into main simultaneously. Set A's merge commit changes main. Set B was computed against the OLD main (before A merged). If B's branch has changes to a file that A also changed, the parallel merge produces a textual conflict that would not exist in sequential mode. The L1 detection (Step 3b) ran BEFORE A merged, so it reported no conflicts for B. Now the actual `git merge` in Step 6 hits unexpected conflicts.

2. **Pre-wave commit inconsistency:** Step 2 records `PRE_WAVE_COMMIT=$(git rev-parse HEAD)` for bisection. If two sets merge in parallel, the PRE_WAVE_COMMIT is the same for both, but after A merges, HEAD advances. The bisection logic in Step 7 uses PRE_WAVE_COMMIT to determine the rollback point. If both A and B merged, rolling back to PRE_WAVE_COMMIT reverts BOTH -- but bisection identified only B as the problem.

3. **"Already merged in this wave" context for merger agents:** The current merger agent role module (role-merger.md lines 4-5) receives "Other Set Contexts (already merged in this wave)" for semantic conflict detection. In parallel mode, A and B merge simultaneously -- neither knows about the other's merge. Both merger agents receive empty "already merged" context. Semantic conflicts between A and B are invisible.

**Why it happens:**
The DAG correctly identifies which sets CAN run in parallel (they share no declared dependencies). But the merge operation itself creates implicit dependencies: merging changes the target branch (main). Every git merge into main creates a happens-before relationship with subsequent merges, even if the sets are DAG-independent. This is the fundamental tension between logical independence (DAG) and operational sequencing (git).

**Consequences:**
- Unexpected merge conflicts during `git merge --no-ff` in Step 6 that were not caught by detection
- Bisection rolling back innocent sets because pre-wave commit doesn't account for partial wave progress
- Semantic conflicts between wave-mates missed because merger agents lack cross-set context

**Prevention:**
1. **Parallel detection, sequential merge execution:** Run L1-L4 detection for all wave sets in parallel (detection is read-only and safe to parallelize). Run L5 semantic detection in parallel (each merger agent analyzes against already-merged context). But execute the actual `git merge --no-ff` SEQUENTIALLY within a wave, even for independent sets. This preserves the correctness guarantee while still gaining parallelism in the expensive detection/resolution phase.
2. **Rebase detection before merge:** If true parallel merge execution is desired, each set must rebase its detection against the CURRENT HEAD (not the pre-wave HEAD) immediately before the `git merge` call. This means: run detection early (parallel), then at merge time, verify that the detection results are still valid against current HEAD. If HEAD changed since detection, re-run L1 detection only (fast textual check).
3. **Per-merge commit tracking for bisection:** Instead of a single PRE_WAVE_COMMIT, track `{ preCommit, postCommit, setId }` for each merge in the wave. Bisection then has the granularity to revert individual set merges within a wave.
4. **Lock main during merge execution:** Use a mutex (the existing `lock.cjs` acquireLock/releaseLock) around the `git merge --no-ff` + `git commit` sequence. This serializes the critical section while allowing detection/resolution to run in parallel.

**Detection:**
- Merge conflicts appearing in Step 6 for sets that had zero L1 conflicts in Step 3
- Bisection reverting more sets than identified as breaking
- Merger agents reporting zero semantic conflicts for sets that actually have cross-set interactions

**Phase to address:**
DAG merge parallelization phase. The "parallel detection, sequential execution" pattern should be the default. True parallel execution is an optimization that requires the rebase-detection and per-merge tracking -- plan it for later if at all.

---

### Pitfall 4: Error Propagation Gap -- Merge Agent Failure Mid-DAG Leaves Pipeline in Inconsistent State

**What goes wrong:**
Consider 3 sets: A (wave 1), B (wave 2, depends on A), C (wave 2, depends on A). A merges successfully. B's merge subagent is spawned. B's subagent encounters a complex conflict, attempts Tier 3 resolution, and returns BLOCKED (low confidence escalation). The orchestrator prompts the user. Meanwhile, C's merge subagent was spawned in parallel with B (both are wave 2). C's subagent proceeds and merges successfully into main.

Now the pipeline state is:
- A: merged (wave 1)
- B: BLOCKED, needs human resolution (wave 2)
- C: merged (wave 2, but depends on A, which is fine)

The user resolves B's conflict and wants to resume. But C already merged into main AFTER A -- and B's merge will now be against a main that includes both A and C. B's original detection ran against main+A only. B's conflict resolution was computed against main+A only. The resolution may be WRONG for main+A+C.

**Why it happens:**
The current merge SKILL.md handles blocked merges within a wave by letting the user choose "Skip set, continue pipeline" (Step 5 option) or "Resolve manually" (Step 4e option with "pause pipeline" exit). But there is no mechanism to mark that a skipped/paused set's detection results are INVALIDATED by subsequent merges. The review SKILL.md has this same gap but it is less severe -- a stale bug finding is annoying, a stale merge resolution corrupts main.

**Consequences:**
- Resumed merge applies a stale resolution that was valid for main+A but not for main+A+C
- main branch receives incorrectly merged code from B that conflicts with C's already-merged changes
- MERGE-STATE.json for B shows conflicts detected against old base, misleading the user

**Prevention:**
1. **Invalidation on skip/pause:** When a set is skipped or paused within a wave, and other sets in that wave continue to merge, mark the skipped set's MERGE-STATE.json with `detectionInvalidated: true` and `invalidatedBy: [list of sets that merged after detection]`. When the set resumes, the orchestrator MUST re-run detection (at minimum L1 textual) before proceeding to resolution.
2. **Wave-level atomicity option:** Offer a "strict mode" where if any set in a wave blocks, ALL remaining sets in that wave pause. This preserves the invariant that detection results are valid for the entire wave. The user trades parallelism for safety.
3. **Resume-aware re-detection:** When `/rapid:merge` is re-invoked for a previously-paused set, check if main has advanced since detection ran. If `git rev-parse main` differs from the merge-base used in detection, re-run detection before resolution.
4. **Fence commits:** Before merging each set, record the current HEAD in MERGE-STATE.json as `detectionBase`. On resume, compare `detectionBase` against current HEAD. If different, stale detection is flagged.

**Detection:**
- User resumes a paused merge and sees different/new conflicts not in the original detection report
- Integration test failures after a resumed merge that was "clean" per its MERGE-STATE
- MERGE-STATE.json `detectionBase` commit hash does not match current main HEAD at merge time

**Phase to address:**
Core merge subagent phase. The detection invalidation logic must be designed alongside the subagent spawn logic, not retrofitted.

---

### Pitfall 5: "Adaptive Nesting" Violating Claude Code's Subagent Depth Constraint

**What goes wrong:**
The v2.2 target includes "Adaptive nesting: merge agents can spawn per-conflict sub-agents for complex resolutions." Claude Code's official documentation states unambiguously: "Subagents cannot spawn other subagents."

The merge SKILL.md (orchestrator) spawns merge subagents via the Agent tool. Those merge subagents are leaf agents -- they cannot use the Agent tool themselves. The current merger role module (role-merger.md line 127) explicitly states: "Never spawn sub-agents. You are a leaf agent in the merge pipeline."

Attempting to give merge subagents the ability to spawn per-conflict resolution agents will either:
1. **Silently fail:** The Agent tool is not available to subagents. The merge subagent's attempt to spawn a sub-subagent produces a tool error. If the subagent handles this gracefully, it falls back to resolving the conflict itself (wasting tokens on the failed spawn attempt). If it does not handle gracefully, it returns BLOCKED.
2. **Cause infinite loops:** If a workaround (like using the `--agent` flag with Task tool) is attempted, Claude Code issue #4850 documents that "Agents spawning sub-agents causes endless loop scenario and RAM OOM errors."

**Why it happens:**
The architecture document for v2.2 describes "adaptive nesting" as a goal without accounting for Claude Code's hard constraint on subagent depth. This is the single most likely v2.2 design error because the constraint is non-obvious -- the Agent tool exists in the tool list, and the orchestrator CAN spawn subagents, so it seems natural that subagents should also be able to spawn.

**Consequences:**
- Wasted implementation time building a feature that Claude Code prevents at runtime
- If workarounds are attempted, RAM exhaustion and infinite loops per issue #4850
- Merge subagents designed with delegation in mind but forced to do all work themselves, producing suboptimal resolution quality

**Prevention:**
1. **Accept the constraint: merge subagents are leaf agents.** The "adaptive nesting" must be re-architected. The orchestrator is the ONLY entity that can spawn agents.
2. **Orchestrator-mediated nesting:** Instead of the merge subagent spawning per-conflict agents, the merge subagent returns a CHECKPOINT with "these N conflicts need dedicated resolution" and a list of conflict descriptors. The ORCHESTRATOR then spawns N per-conflict resolution agents, collects their results, and passes them back to the merge subagent (or a new merge subagent instance that resumes with the resolution results). This preserves the flat agent hierarchy.
3. **Conflict triage in the merge subagent:** The merge subagent analyzes all conflicts and classifies them as: SELF_RESOLVABLE (confidence >= 0.7, will resolve inline) or NEEDS_DEDICATED (confidence < 0.7, complex multi-file interaction). The subagent resolves SELF_RESOLVABLE conflicts directly and returns the NEEDS_DEDICATED list to the orchestrator.
4. **Orchestrator-spawned resolution agents:** For NEEDS_DEDICATED conflicts, the orchestrator spawns a `rapid-conflict-resolver` agent per conflict (or per conflict cluster). This agent receives only the specific conflict context, the relevant files, and the interface contracts. It returns a resolution with confidence. The orchestrator collects these and either applies them or escalates to the user.

**Detection:**
- Agent tool errors in merge subagent logs ("Task tool not available")
- Merge subagents returning BLOCKED with "cannot spawn sub-agent" errors
- RAM consumption spikes during merge pipeline execution

**Phase to address:**
Architecture design phase -- must be settled BEFORE implementation begins. The orchestrator-mediated nesting pattern should be the canonical approach documented in the architecture.

---

### Pitfall 6: Documentation Coupling to Implementation Details That Change Across Versions

**What goes wrong:**
RAPID v2.2 includes "Fresh README.md reflecting current RAPID capabilities" and "New technical_documentation.md for power users." The documentation must describe the merge pipeline, agent hierarchy, DAG ordering, conflict detection levels, resolution tiers, and the new subagent delegation architecture.

The trap: documentation that references specific implementation details becomes stale immediately. Three failure patterns observed across v1.0->v2.0->v2.1:

1. **Version-locked architecture diagrams:** The existing DOCS.md (from v2.0) describes the merge pipeline as "orchestrator spawns single merger agent." v2.2 changes this to "orchestrator spawns per-set merge subagents with orchestrator-mediated conflict resolution." If the README embeds the v2.2 architecture as fact, v2.3 changes will make it wrong. RAPID has shipped 4 versions (v1.0, v1.1, v2.0, v2.1) in rapid succession -- the documentation lifecycle is measured in weeks, not months.

2. **CLI command examples with exact output:** The merge pipeline uses `rapid-tools.cjs` CLI commands (`merge order`, `merge detect`, `merge resolve`, `merge execute`). Documentation that shows exact CLI output format breaks when output format changes. The existing SKILL.md files already have this problem -- review SKILL.md references `review scope`, `review log-issue`, `review summary` CLI commands with specific JSON output schemas.

3. **Agent role descriptions in docs vs agent definitions:** If the README describes the merger agent's responsibilities, and role-merger.md is later updated (e.g., adding new detection capability), the README becomes stale. There are now two sources of truth for "what does the merger agent do."

**Why it happens:**
Research on documentation maintenance (2025-2026) identifies this as the #1 cause of documentation staleness: "Treating your documentation as a static asset is a common pitfall." Living documentation approaches exist but require infrastructure (docs-as-tests, automated staleness detection). RAPID has no such infrastructure.

The problem is amplified by RAPID's recursive nature: RAPID is a plugin for Claude Code agents, and its documentation is consumed by Claude Code agents. Stale docs do not just confuse human users -- they cause agents spawned by RAPID to operate with wrong information.

**Consequences:**
- Users (human or agent) follow outdated instructions that fail at runtime
- Agents spawned with stale documentation attempt operations that no longer exist
- Maintenance burden increases as documentation diverges from implementation over successive versions

**Prevention:**
1. **Separate "what" docs from "how" docs:** The README should describe WHAT RAPID does (capabilities, concepts, workflow stages) without embedding HOW it does it (CLI output formats, internal agent names, specific file paths). The "how" belongs in SKILL.md files and role modules which are maintained alongside implementation.
2. **Reference, don't duplicate:** The technical_documentation.md should REFERENCE the authoritative source for implementation details rather than duplicating it. Example: "For merge pipeline details, see `skills/merge/SKILL.md`." This creates one source of truth per concept.
3. **Version-tagged architecture overview:** Include the version number in architecture descriptions: "As of v2.2, the merge pipeline uses per-set subagent delegation." This makes staleness VISIBLE rather than silently misleading.
4. **CLAUDE.md as the living doc:** RAPID already generates a CLAUDE.md for each project. This is the document that agents actually load. Focus accuracy efforts on CLAUDE.md content (which is regenerated per-init) rather than on static README.md.
5. **Docs-as-code review:** Include documentation files in the review pipeline scope. When merge SKILL.md changes, `review scope` should flag README.md sections that reference merge behavior as needing review.

**Detection:**
- Users opening issues about documentation instructions that fail
- Agent spawns failing because they follow documented CLI commands that have changed
- README.md `Last updated` timestamp more than one version behind current version
- Search for version-specific references ("v2.2") that should be updated to current version

**Phase to address:**
Documentation phase. Design the doc structure (what vs how, reference vs duplicate) BEFORE writing content. The structure decision determines how much maintenance debt each documentation page creates.

---

## Moderate Pitfalls

### Pitfall 7: Bisection Recovery Breaking Under Per-Set Subagent Merge Architecture

**What goes wrong:**
The current bisection logic (`merge bisect {waveNum}`, merge.cjs lines 888-970) assumes sequential merge ordering within a wave. It performs binary search over the wave's merged sets by reverting to PRE_WAVE_COMMIT and re-merging subsets to find the breaking set. Under the new per-set subagent architecture:

1. The subagent-mediated merge may produce different merge commits than the original (non-deterministic AI resolution). Re-merging during bisection produces DIFFERENT code than the original merge, making the bisection unreliable.
2. If parallel detection was used, the detection results cached in MERGE-STATE.json were computed against a different base than what bisection re-creates. Bisection re-merges set 1 then set 2 -- but set 2's detection was originally against main (without set 1), and now it is against main+set1.
3. The orchestrator-mediated nesting (Pitfall 5's solution) means conflict resolutions came from dedicated resolution agents. During bisection re-merge, those agents are not available -- the bisection logic would need to re-spawn them.

**Prevention:**
1. **Commit-based bisection, not re-merge bisection:** Instead of re-merging sets during bisection, use `git revert` on individual merge commits and run tests after each revert. This tests the ACTUAL merged code, not a re-merge that may differ.
2. **Record merge commit per set:** MERGE-STATE.json already has `mergeCommit` field. Ensure this is populated for every set. Bisection then reverts individual commits: `git revert --no-commit {mergeCommit}`, test, `git revert HEAD` if not the culprit.
3. **Preserve resolution artifacts:** Write the actual resolution code (not just the RAPID:RETURN) to `.planning/sets/{setId}/RESOLUTIONS/` so bisection can re-apply resolutions without re-spawning agents.

**Detection:**
- Bisection identifying a set as "breaking" that was not actually the cause
- Bisection producing different merge results than the original pipeline
- Bisection hanging because it tries to spawn merge agents during the binary search

**Phase to address:**
Bisection refactoring sub-phase within the merge restructuring.

---

### Pitfall 8: Merge Subagent Receiving Excessive Context (The "Kitchen Sink Prompt" Anti-Pattern)

**What goes wrong:**
The current merge SKILL.md Step 4c constructs the merger agent prompt with: set context, other set contexts, detection report, contracts, unresolved conflicts, and working directory. For the new per-set merge subagent pattern, the temptation is to include EVERYTHING the subagent might need: full CONTEXT.md for the merging set, full CONTEXT.md for every already-merged set, complete detection report with all L1-L4 details, all CONTRACT.json files, all unresolved conflict details with file diffs, and the full worktree path with instructions.

For a set with 10 changed files and 4 already-merged sets, this prompt reaches 15K-25K tokens. Combined with the 20K overhead per subagent, the merge subagent starts with 35K-45K tokens consumed -- leaving only 150K-165K for actual conflict analysis and resolution in a 200K context window.

The v2.1 review pipeline already solved this problem with the scoper pattern (Step 2.5). The merge pipeline should follow the same approach.

**Prevention:**
1. **Minimal prompt, disk-based context:** The merge subagent prompt should contain: set name, base branch, list of changed files, summary of detected conflicts (counts and affected files, not full details), and a pointer to MERGE-STATE.json for full details. The subagent reads MERGE-STATE.json, CONTEXT.md, and CONTRACT.json from disk using the Read tool.
2. **Conflict-scoped file loading:** The subagent reads only files that have detected conflicts, not all changed files. If L1 detected conflicts in 3 of 10 changed files, the subagent reads those 3 files plus their contracts.
3. **Incremental context for later-wave sets:** For sets in wave 2+, the "already merged context" should be a 1-2 line summary per set (name, what it changed, key contract points), not the full CONTEXT.md of each already-merged set.

**Detection:**
- Merge subagents running out of context during resolution (truncated RAPID:RETURN -- see Pitfall 2)
- Merge subagents producing shallow analysis ("conflict exists in file X" without root cause or resolution)
- Subagent token usage consistently >80% before beginning resolution work

**Phase to address:**
Merge subagent role definition phase. The role-merger.md prompt must enforce "read from disk, not from prompt."

---

### Pitfall 9: MERGE-STATE.json Schema Drift When Adding Subagent-Specific Fields

**What goes wrong:**
The current `MergeStateSchema` in merge.cjs (lines 38-111) defines the Zod schema for per-set merge state. v2.2 needs to add new fields for subagent tracking: `delegatedTo` (agent ID), `detectionBase` (commit hash when detection ran), `detectionInvalidated` (boolean), `subagentRetries` (count), `resolutionArtifacts` (paths to resolution files).

If these fields are added without updating: (a) the Zod schema, (b) the `writeMergeState()` function, (c) the `readMergeState()` function, and (d) the CLI `merge merge-state` command, then:
- Writes with new fields fail Zod validation (Zod rejects unknown fields by default with `.strict()`, though the current schema does not use `.strict()` so extra fields would be silently stripped)
- Reads return data missing the new fields (existing `readMergeState()` returns only Zod-validated data)
- CLI displays incomplete state information

**Prevention:**
1. **Add fields to the schema FIRST, with sensible defaults:** All new fields should be `.optional()` with `.default()` values so existing MERGE-STATE.json files remain valid after schema update.
2. **Backward compatibility test:** Write a test that loads a v2.1-era MERGE-STATE.json through the new schema and verifies it parses without error.
3. **Schema version field:** Add `schemaVersion: z.number().default(1)` to the schema. New fields go into `schemaVersion: 2`. This makes migrations explicit.
4. **Update read/write/CLI atomically:** All four touchpoints (schema, read function, write function, CLI command) must be updated in the same commit.

**Detection:**
- MERGE-STATE.json files missing expected fields after pipeline runs
- Zod validation errors when writing merge state with new data
- CLI `merge merge-state` output showing stale or incomplete information

**Phase to address:**
First implementation phase. Schema changes must happen before any subagent delegation code.

---

### Pitfall 10: Sequential-to-Parallel Merge Transition Breaking Integration Test Isolation

**What goes wrong:**
The current integration test runner (`merge integration-test`, merge.cjs `runIntegrationTests()` lines 791-870) runs tests on the CURRENT state of main after merges. In sequential mode, each set merges, then the integration gate runs once per wave. In parallel detection mode, multiple merge subagents may be analyzing and modifying the worktree simultaneously.

The L1 textual conflict detection (`detectTextualConflicts()`, lines 362-383) performs an actual `git merge --no-commit --no-ff` then `git merge --abort`. If two detection operations run in parallel on the same repository, they both attempt `git merge` on main -- the second will fail because a merge is already in progress.

**Prevention:**
1. **Detection runs in worktree, not main:** L1-L4 detection should run in the SET's worktree (where the set branch lives), not in the main repo. Detection compares the set branch against main using `git merge-base` and `git diff`, which are read-only and safe to parallelize.
2. **The actual `git merge --no-commit` dry run must be serialized:** If L1 detection requires a merge dry run (which it currently does), use the lock from `lock.cjs` to serialize L1 detection calls. Or, replace the merge dry run with `git merge-tree` (plumbing command) which does the three-way merge computation without touching the working tree.
3. **Integration tests must run AFTER all merges in the wave complete:** Never run integration tests while merges are still in progress. This was already the case in sequential mode but must be explicitly enforced in parallel mode.

**Detection:**
- `git merge --abort` errors during parallel detection runs
- "fatal: You have not concluded your merge" errors in detection output
- Intermittent L1 detection failures that succeed on retry

**Phase to address:**
Parallel merge detection phase. The `git merge-tree` replacement for L1 detection should be investigated as the first change.

---

## Minor Pitfalls

### Pitfall 11: Documentation Table of Contents Getting Out of Sync

**What goes wrong:** The technical_documentation.md will have a table of contents or cross-references between sections. As sections are added, removed, or renamed during the documentation rewrite, the TOC and internal links break. Markdown has no built-in link validation.

**Prevention:** Use section headers as the single source of truth. Do not manually maintain a TOC -- generate it with a script or omit it in favor of a flat structure. If internal links are needed, use relative markdown links (`[section](#section-name)`) and add a CI check or pre-commit hook that validates them.

### Pitfall 12: Merge Subagent Working Directory Confusion

**What goes wrong:** The merger agent role module (role-merger.md) operates on the set's worktree. The new merge subagent must receive the correct worktree path AND the main repo path (for detection against main). If the subagent receives only the worktree path, it cannot run L1-L4 detection against main. If it receives only the main path, it cannot read the set's branch-specific code.

**Prevention:** Pass BOTH paths explicitly in the subagent prompt: `mainRepoPath` for detection operations and `worktreePath` for resolution operations. The subagent's instructions must specify which path to use for which operation.

### Pitfall 13: README.md Targeting Wrong Audience Level

**What goes wrong:** RAPID has two audiences: (1) human developers who install and configure the plugin, and (2) Claude Code agents that read CLAUDE.md and skill files. Documentation that mixes these audiences confuses both. Developers want quick start and configuration; agents want exact command syntax and structured protocols.

**Prevention:** README.md targets humans only (installation, configuration, workflow overview). CLAUDE.md targets agents (loaded per-init, contains exact conventions). technical_documentation.md targets power users (architecture, extension points, debugging). Never mix audiences in a single document.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Merge subagent spawn architecture | Adaptive nesting violates Claude Code depth constraint (Pitfall 5) | Orchestrator-mediated nesting: merge subagents return CHECKPOINT with conflict list, orchestrator spawns per-conflict resolution agents |
| DAG parallel detection | L1 detection uses `git merge --no-commit` which cannot parallelize (Pitfall 10) | Replace with `git merge-tree` plumbing command or serialize L1 with lock |
| DAG parallel merge execution | Independent sets mutate main simultaneously (Pitfall 3) | Parallel detection + sequential execution; OR lock main during `git merge --no-ff` |
| Result collection from subagents | RAPID:RETURN parse failures go undetected (Pitfall 2) | Default-unsafe parsing + git state verification + write-before-return |
| Orchestrator context management | Accumulated results overflow context (Pitfall 1) | Compressed result protocol (~100 tokens/set) + disk-based state + progressive shedding |
| Error propagation in DAG | Skipped set resumes with stale detection (Pitfall 4) | Detection invalidation tracking + resume-aware re-detection |
| Bisection under new architecture | Re-merge during bisection produces different code (Pitfall 7) | Commit-based bisection using `git revert`, not re-merge |
| MERGE-STATE.json schema | New fields break read/write pipeline (Pitfall 9) | Schema version field + backward compatibility test + atomic update |
| README.md rewrite | Implementation details embedded in docs go stale (Pitfall 6) | Separate what/how; reference SKILL.md for implementation; version-tag architecture |
| technical_documentation.md | Wrong audience level mixing (Pitfall 13) | Strict audience separation: README=humans, CLAUDE.md=agents, technical_docs=power users |

## "Looks Done But Isn't" Checklist

- [ ] **Compressed result protocol:** Verify orchestrator context usage stays under 50K tokens for an 8-set project by calculating `(skill prompt) + (100 tokens * N sets) + (overhead)`
- [ ] **RAPID:RETURN parse validation:** Verify orchestrator treats missing/malformed returns as BLOCKED, not as success; test with a subagent that returns no RAPID:RETURN
- [ ] **DAG parallel detection + sequential execution:** Verify two independent sets' detections run in parallel but their `git merge --no-ff` calls are serialized
- [ ] **Detection invalidation on skip:** Verify that skipping a set within a wave marks its MERGE-STATE with `detectionInvalidated: true` and that resume re-runs detection
- [ ] **Subagent depth constraint:** Verify merge subagents do NOT have Agent tool in their tool list; verify orchestrator-mediated nesting works end-to-end
- [ ] **Bisection uses git revert, not re-merge:** Verify bisection operates on committed merge history, not by re-running the merge pipeline
- [ ] **MERGE-STATE.json backward compatibility:** Verify a v2.1-era MERGE-STATE.json parses through the v2.2 schema without errors
- [ ] **Documentation audience separation:** Verify README.md contains zero CLI exact-output examples and zero agent role descriptions (those belong in SKILL.md and role modules)
- [ ] **Write-before-return in merge subagents:** Verify merge subagents write results to MERGE-STATE.json on disk before emitting RAPID:RETURN
- [ ] **Merge subagent prompt size:** Verify per-set merge subagent prompts stay under 5K tokens (excluding the role module overhead), with disk-based context loading for details

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Orchestrator context overflow (Pitfall 1) | LOW | Implement compressed result protocol; no code regression, just prompt/protocol change |
| RAPID:RETURN parse failure causing silent bad merge (Pitfall 2) | HIGH | Identify the bad merge via `git log --merges`; `git revert` the bad merge commit; re-run merge pipeline for the affected set; add parse validation to prevent recurrence |
| DAG parallel merge causing unexpected conflicts (Pitfall 3) | MEDIUM | Abort the conflicting merge (`git merge --abort`); switch to sequential merge within the wave; re-run detection for the affected set against current HEAD |
| Stale detection on resumed merge (Pitfall 4) | MEDIUM | Re-run `merge detect` for the resumed set; compare detection results with the stale MERGE-STATE; if new conflicts appeared, re-run resolution before proceeding |
| Subagent depth violation attempt (Pitfall 5) | LOW | Remove Agent tool from merge subagent tools list; implement orchestrator-mediated nesting; no merge state corruption since the feature never worked |
| Stale documentation (Pitfall 6) | LOW | Update README sections; add version tag to corrected sections; no runtime impact since docs are not executable |
| Bisection producing wrong results (Pitfall 7) | HIGH | Manually identify the breaking set using `git log --merges` and selective `git revert`; fix bisection implementation to use commit-based approach |
| Merge subagent context overflow (Pitfall 8) | MEDIUM | Reduce prompt size by moving context to disk; re-spawn the merge subagent with the lean prompt; no merge state corruption |
| MERGE-STATE.json schema drift (Pitfall 9) | LOW | Add missing fields to schema with defaults; re-run `readMergeState()` to backfill; no data loss since Zod strips unknown fields rather than rejecting |
| Parallel detection git merge race (Pitfall 10) | LOW | Serialize L1 detection with lock; or replace `git merge --no-commit` dry run with `git merge-tree`; no state corruption since detection is read-only |

## Sources

- **Direct codebase analysis:** `src/lib/merge.cjs` (~1200 lines -- 5-level detection, 4-tier resolution, MERGE-STATE CRUD, bisection, rollback, programmatic gate), `src/lib/dag.cjs` (467 lines -- toposort, wave assignment, DAG creation/validation, execution order), `src/lib/merge.test.cjs`
- **Skill analysis:** `skills/merge/SKILL.md` (527 lines -- full merge pipeline orchestration), `skills/review/SKILL.md` (934 lines -- precedent for multi-subagent delegation with concern scoping)
- **Agent definitions:** `agents/rapid-merger.md` (282 lines -- current merger leaf agent), `agents/rapid-orchestrator.md` (260 lines -- orchestrator with Agent tool), `src/modules/roles/role-merger.md` (128 lines), `src/modules/roles/role-orchestrator.md` (27 lines)
- **Claude Code official docs:** [Create custom subagents](https://code.claude.com/docs/en/sub-agents) -- confirmed "Subagents cannot spawn other subagents" constraint, 20K token overhead per subagent, auto-compaction at 95% capacity
- **Claude Code GitHub issues:** [#4182](https://github.com/anthropics/claude-code/issues/4182) (Sub-Agent Task Tool Not Exposed When Launching Nested Agents), [#4850](https://github.com/anthropics/claude-code/issues/4850) (Agents spawning sub-agents causes endless loop and RAM OOM)
- **Anthropic engineering:** [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) -- result collection patterns, context overflow strategies, filesystem-based artifact passing, "token usage explains 80% of variance"
- **Azure Architecture Center:** [AI Agent Orchestration Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) -- supervisor pattern token cost analysis
- **AWS Prescriptive Guidance:** [Saga orchestration patterns](https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-patterns/saga-orchestration-patterns.html) -- error recovery in multi-agent workflows
- **Documentation maintenance research:** [Technical Writing Trends 2026](https://document360.com/blog/technical-writing-trends/) -- living documentation patterns; [DeepDocs Best Practices](https://deepdocs.dev/technical-documentation-best-practices/) -- docs-as-tests; [Fluidtopics 2026 Trends](https://www.fluidtopics.com/blog/industry-insights/technical-documentation-trends-2026/) -- staleness detection
- **DAG failure handling:** [Partial Success in DAG Systems](https://medium.com/@kriyanshii/understanding-partial-success-in-dag-systems-building-resilient-workflows-977de786100f) -- partial failure recovery patterns; [Airflow Failure Handling](https://medium.com/@kopalgarg/failure-handling-in-apache-airflow-dags-6e20945859cd) -- error propagation in DAG execution
- **Project context:** `.planning/PROJECT.md` (v2.2 milestone definition with 5 target features)

---
*Pitfalls research for: RAPID v2.2 -- subagent merge delegation, DAG-ordered merging, adaptive nesting, documentation rewrite*
*Researched: 2026-03-10*
