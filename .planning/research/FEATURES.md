# Feature Research

**Domain:** Claude Code plugin workflow orchestration (v2.1 improvements for RAPID)
**Researched:** 2026-03-09
**Confidence:** HIGH (features analyzed against existing codebase + official Claude Code docs)

**Scope:** This research covers ONLY the v2.1 features. The v2.0 Mark II core (state machine, sets/waves/jobs, orchestrator, set-init, discuss, wave-plan, execute, review, merge) is already built and shipped.

## Feature Landscape

This research covers 7 proposed v2.1 features. Each is evaluated as table stakes (expected by users of the existing system), differentiator (sets RAPID apart), or anti-feature (sounds good but creates problems). Dependencies on the existing v2.0 codebase are noted.

### Table Stakes (Users Expect These)

Features that fix friction or gaps users already feel in the v2.0 workflow.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **GSD agent type decontamination** | v2.0 still has `gsd_state_version: 1.0` in `src/lib/init.cjs` (line 53) and potential residual GSD patterns. Users see a system referencing a framework that is not this product. Feels unpolished, erodes trust. | LOW | Grep found 1 source hit in `src/lib/init.cjs`. Skill files are already clean (grep of `skills/` returned no GSD matches). Mostly string/field replacement + schema update. |
| **Streamlined workflow (init auto-chain)** | Currently init produces a roadmap with sets/waves/jobs but then requires the user to manually run `/rapid:set-init` for each set, then `/rapid:discuss` for each wave, then `/rapid:wave-plan`. That is 3+ manual invocations per set before any execution. Users expect the tool to guide them through the natural next step automatically. | MEDIUM | The existing skills already present "Next Steps" via AskUserQuestion at completion (Step 10 of init, Step 5 of set-init, Step 8 of discuss, Step 7 of wave-plan). The change is making the first option the natural next command with numeric shorthand, not just text guidance. Note: RAPID skills cannot invoke other skills directly (skills are markdown prompts, not executables). Streamlining is about making the next step obvious and frictionless. |
| **Numeric ID shorthand for set commands** | Users currently type `/rapid:discuss auth wave-1` or `/rapid:set-init auth-system`. With multiple sets and waves, repeatedly typing full string IDs is tedious. Numeric shorthand like `/rapid:discuss 1` (meaning set #1) or `/rapid:wave-plan 1.1` (set 1, wave 1) is expected ergonomic polish. Claude Code skills support `$ARGUMENTS`, `$0`, `$1` positional access per official docs. | LOW | Implementation: add `resolve-shorthand` command to `rapid-tools.cjs` that maps numeric index to set/wave ID from STATE.json array ordering. Each SKILL.md's argument parsing step checks if argument matches `/^\d+(\.\d+)?$/` -- if numeric, resolve before passing to existing logic. Backward compatible: full string IDs still work. |

### Differentiators (Competitive Advantage)

Features that make RAPID meaningfully better than competing multi-agent orchestration approaches (manual skill chains, ad-hoc `/batch`, raw subagent spawning).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Parallel wave planning with dependency-aware sequencing** | Currently `/rapid:wave-plan` handles one wave at a time. When a set has 3+ waves, the user must manually invoke planning for each sequentially. Parallel wave planning auto-detects independent waves within a set and plans them concurrently, while sequencing dependent waves. This is a genuine orchestration advantage over manual workflows. | HIGH | Requires: (1) dependency analysis between waves (wave ordering already implicit in STATE.json array position), (2) topological sort of wave dependencies, (3) parallel Agent tool spawning for independent waves (Claude Code supports up to 5 simultaneous subagents per official docs), (4) sequential fallback for dependent chains. Realistic assessment: most sets have linearly dependent waves, so true intra-set parallelism will be rare. The bigger win is auto-chaining sequential wave planning instead of manual invocation per wave. |
| **Plan verifier agent (coverage + implementability)** | After wave planning produces JOB-PLAN.md files, there is currently no validation that plans cover all requirements from WAVE-CONTEXT.md or that planned steps are implementable (referencing files that exist, using available APIs). The existing contract validation (Step 6 of wave-plan) only checks cross-set imports. A plan verifier fills the gap between "plans exist" and "plans are good." | MEDIUM | New agent role: `role-plan-verifier.md`. Four checks: (1) coverage -- every decision in WAVE-CONTEXT.md addressed by at least one JOB-PLAN.md, (2) implementability -- referenced files exist or are marked "to be created," (3) completeness -- acceptance criteria have corresponding implementation steps, (4) consistency -- intra-wave file ownership does not overlap. Output: VERIFICATION-REPORT.md with PASS/PASS_WITH_GAPS/FAIL verdict. |
| **Context-efficient review with scoper delegation** | The current review pipeline loads ALL changed files + dependents into each subagent's context. For large waves, this burns through context windows fast -- review SKILL.md documents that the 3-agent adversarial bug hunt costs $15-45 per cycle. A scoper agent first analyzes the changeset, categorizes files by concern, then delegates focused sub-reviews with minimal context. | HIGH | Architecture: (1) new `role-review-scoper.md` agent categorizes changes (logic, API, tests, infra, docs), (2) review SKILL.md spawns scoper first, then spawns focused hunter/tester agents with only their relevant file subset, (3) cross-cutting files (scoper uncertain) included in all scopes. Token savings estimate: 20-file wave splitting into 3 concerns of ~7 files each = ~65% context reduction per agent. Key constraint: Claude Code has no scoped context passing (GitHub issue #4908) -- scoping is prompt-level advisory ("Focus ONLY on these files"), not tool-level enforcement. |
| **Batched questioning during discuss phase** | The current `/rapid:discuss` asks questions one at a time in a 4-question deep-dive loop per gray area. For a wave with 5 selected gray areas, that is 20 sequential AskUserQuestion calls. Batched questioning presents related questions together to reduce round trips while preserving structured decision capture. | MEDIUM | AskUserQuestion already supports `multiSelect: true` (used in Step 4 of discuss). Batch approach: compress 4-question loop into 2 interactions per gray area: (1) combined approach + edge case implications in rich option descriptions, (2) confirmation. Result: 5 gray areas x 2 = 10 round-trips (50% reduction). Constraint: do NOT batch across different gray areas -- keep per-area structure. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Fully automatic workflow (zero user gates)** | "Just run init and have it plan+execute+review+merge everything" | Removes the human judgment gates that catch AI mistakes early. RAPID's own design philosophy (PROJECT.md Out of Scope) explicitly rejects "fully automated review (no HITL)." Fully automated runs produce work that passes automated checks but may not match developer intent. | Keep the streamlined workflow but preserve decision gates. The improvement is fewer manual skill invocations, not fewer decisions. Offer "express mode" in future that auto-accepts defaults but still pauses at critical gates (roadmap approval, wave discussion, review results). |
| **Real-time cross-wave coordination during planning** | "Wave 2 planner should be able to ask Wave 1 planner questions" | Destroys isolation guarantees. Subagents cannot spawn sub-subagents (Claude Code hard constraint per official docs). Inter-agent communication would require a message bus that does not exist in Claude Code's plugin model. | Dependency-aware sequential planning: plan dependent waves in order, each receiving predecessor's artifacts. Independent waves plan in parallel. |
| **Per-file review granularity control** | "Let me choose exactly which files each review agent sees" | Manual file scoping is tedious, error-prone (miss a dependency), and defeats the purpose of automated scoping. Users think they want this control but actually want the AI to scope correctly. | The review scoper agent handles this automatically. If the scoper gets it wrong, the user can override by adding files to the "include-all" list. |
| **Dynamic wave/job creation during execution** | "If execution reveals we need another job, add it on the fly" | RAPID's isolation model depends on sets being defined at planning time. Dynamic job creation during execution means WAVE-PLAN.md file ownership assignments become stale, other jobs may be modifying overlapping files, and the state machine has no transition for mid-execution additions. PROJECT.md explicitly lists "Dynamic set creation during execution" as out of scope. | Log the discovered need in the job's HANDOFF.md or as a review issue. The next wave or a follow-up milestone handles it. |
| **AI-only review scoping (no safety net)** | "Trust the scoper completely, no cross-cutting files" | If the scoper misses a cross-file dependency, the bug hunter will miss the bug. Silent false negatives are worse than slightly higher token costs. | Conservative scoping: the scoper flags uncertain files as cross-cutting (included in all scopes). Start wide, narrow over time as confidence builds. |

## Feature Dependencies

```
[GSD Decontamination]
    (no dependencies -- standalone cleanup)

[Numeric ID Shorthand]
    (no dependencies -- standalone UX, adds resolve-shorthand to rapid-tools.cjs)

[Streamlined Workflow]
    +-depends-on-> [Numeric ID Shorthand] (shorthand makes auto-suggestions useful)
    +-depends-on-> [GSD Decontamination] (clean skill files before adding orchestration)

[Batched Questioning]
    (no dependencies -- modifies discuss SKILL.md only)

[Plan Verifier Agent]
    +-depends-on-> [Batched Questioning] (optional: verifier references WAVE-CONTEXT.md)
    +-enhances-> wave-plan pipeline (inserted between job planning and contract validation)

[Parallel Wave Planning]
    +-depends-on-> [Plan Verifier Agent] (each parallel-planned wave should be verified)
    +-depends-on-> [Streamlined Workflow] (parallel planning triggered by streamlined flow)
    +-requires-> STATE.json wave dependency metadata (already exists: array ordering)

[Context-Efficient Review]
    +-depends-on-> [Plan Verifier Agent] (scoper uses verified plans for intent)
    +-modifies-> review SKILL.md, role-bug-hunter.md, role-unit-tester.md
    +-requires-> new role-review-scoper.md agent
```

### Dependency Notes

- **Streamlined Workflow depends on Numeric ID Shorthand:** When the streamlined flow auto-suggests "Run `/rapid:discuss 1`" after set-init, numeric shorthand must work or the suggestion is useless. Build shorthand first.
- **Streamlined Workflow depends on GSD Decontamination:** Modifying skill files for workflow streamlining while GSD vestiges remain means touching the same files twice. Clean first, then enhance.
- **Plan Verifier enhances wave-plan pipeline:** Inserted as a new step between "Spawn Job Planner Agents" (Step 5) and "Contract Validation Gate" (Step 6). Does not replace contract validation -- complements it with coverage and implementability checks.
- **Parallel Wave Planning depends on Plan Verifier:** If you plan 3 waves in parallel, each needs independent verification. Without the verifier, plan problems are discovered only at execution time, wasting the parallelism benefit.
- **Context-Efficient Review depends on Plan Verifier:** The review scoper uses WAVE-PLAN.md and JOB-PLAN.md to understand which changes serve which purpose. Verified plans are more reliable scoping input.
- **Batched Questioning is independent:** Modifies only the discuss SKILL.md. Can be done at any time, but doing it early means all subsequent features benefit from more efficient discuss sessions.

## MVP Definition

### Phase 1: Foundation Cleanup (do first)

- [x] **GSD decontamination** -- Remove `gsd_state_version` from init.cjs, audit all files for residual GSD references. Essential: no product should ship referencing another product's internals.
- [x] **Numeric ID shorthand** -- Add `resolve-shorthand` to rapid-tools.cjs CLI, update skill SKILL.md files to detect numeric arguments and resolve before processing. Essential: every subsequent feature benefits from this UX improvement.
- [x] **Batched questioning** -- Restructure discuss SKILL.md 4-question loop into 2 interactions per gray area. Essential: reduces discuss session time by ~50%, all downstream features consume WAVE-CONTEXT.md produced here.

### Phase 2: Workflow + Verification (do second)

- [x] **Streamlined workflow** -- Add auto-chaining logic between init -> set-init -> discuss -> wave-plan. Connect the dots so users flow naturally through the pipeline without memorizing command sequences.
- [x] **Plan verifier agent** -- Create `role-plan-verifier.md`, add verification step to wave-plan SKILL.md between job planning and contract validation.

### Phase 3: Advanced Orchestration (do third)

- [x] **Parallel wave planning** -- Add multi-wave orchestration to wave-plan SKILL.md with dependency-aware sequencing. Implement topological sort of wave dependencies, parallel Agent spawning for independent waves.
- [x] **Context-efficient review with scoper delegation** -- Create `role-review-scoper.md`, refactor review SKILL.md to scope-then-delegate rather than broadcast-all.

### Future Consideration

- [ ] Express mode (auto-accept defaults at non-critical gates) -- defer until workflow streamlining proves the gate pattern works
- [ ] Cross-milestone plan comparison -- defer until multiple milestones are common in practice
- [ ] Selective wave re-planning -- defer until parallel wave planning reveals which re-plan patterns emerge
- [ ] Review scoper learning/memory -- defer until scoper proves useful, then add persistent memory per official subagent docs

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Depends On |
|---------|------------|---------------------|----------|------------|
| GSD decontamination | MEDIUM | LOW | P1 | Nothing |
| Numeric ID shorthand | HIGH | LOW | P1 | Nothing |
| Batched questioning | HIGH | MEDIUM | P1 | Nothing |
| Streamlined workflow | HIGH | MEDIUM | P2 | GSD decontam, Numeric ID |
| Plan verifier agent | HIGH | MEDIUM | P2 | (Batched questioning optional) |
| Parallel wave planning | MEDIUM | HIGH | P3 | Plan verifier, Streamlined workflow |
| Context-efficient review | HIGH | HIGH | P3 | Plan verifier |

**Priority key:**
- P1: Foundation -- must land first because other features build on it
- P2: Core value -- the workflow improvements that justify v2.1
- P3: Advanced -- highest complexity, highest long-term value, requires P1+P2 foundation

## Detailed Feature Specifications

### 1. GSD Agent Type Decontamination

**Scope:** Find and replace all references to the GSD framework carried over during RAPID's evolution.

**Known locations:**
- `src/lib/init.cjs` line 53: `gsd_state_version: 1.0` -- rename to `rapid_state_version`
- Full audit of all `src/` and `skills/` files (skills/ already clean per grep)

**Implementation:** Single grep-and-replace pass. Update any schema validators that reference old field names. Run existing tests to catch breakage.

**Risk:** LOW. String replacements with no behavioral impact beyond field naming.

### 2. Numeric ID Shorthand

**Scope:** Allow users to reference sets and waves by numeric index instead of full string ID.

**UX Design:**
- `/rapid:discuss 1` -- resolves to first set in STATE.json ordering
- `/rapid:wave-plan 1.1` -- resolves to first set, first wave
- `/rapid:execute 2` -- resolves to second set
- Full string IDs still work (backward compatible)

**Implementation:**
1. Add `resolve-shorthand` command to `rapid-tools.cjs`:
   - Input: numeric string like "1" or "1.1"
   - Output: JSON `{ setId: "auth-system", waveId: "wave-1" }` (or just setId for set-level commands)
   - Source: reads STATE.json, indexes sets by array position (1-based), waves by array position within set
2. Update each SKILL.md's argument parsing step:
   - After receiving argument, check if it matches `/^\d+(\.\d+)?$/`
   - If numeric: call `resolve-shorthand`, use resolved IDs
   - If string: use existing logic (unchanged)
3. Update `/rapid:status` to display numeric indices alongside set/wave names

**Affected skills:** discuss, wave-plan, execute, review, merge, set-init (6 skills)

### 3. Batched Questioning During Discuss

**Scope:** Reduce AskUserQuestion round-trips in the discuss phase by batching related questions.

**Current flow (per gray area):** 4 sequential questions (Q1: approach, Q2: edge cases, Q3: specifics, Q4: confirmation) = 4 round-trips. 5 gray areas = 20 round-trips.

**Proposed flow (per gray area):** 2 interactions:
1. **Batch 1 -- Combined approach + specifics:** Present gray area with approach options where each option description includes edge case implications. Example:
   ```
   "How do you want to handle error recovery?
   Options:
   - 'Retry with backoff' -- Automatic retry with exponential backoff.
     Edge cases: max retry count (default 3), idempotency required, backoff ceiling 30s.
   - 'Fail fast with manual recovery' -- Return error immediately.
     Edge cases: error messages must be actionable, recovery state preserved.
   - 'Let Claude decide' -- Choose based on codebase patterns."
   ```
2. **Batch 2 -- Confirmation:** Summary of all decisions for this gray area.

**Result:** 5 gray areas x 2 = 10 round-trips (50% reduction).

**Constraint:** Do NOT batch across different gray areas. Each gray area is a distinct concern; mixing creates cognitive overload.

### 4. Streamlined Workflow

**Scope:** After each RAPID command completes, auto-suggest the natural next command with pre-filled arguments.

**Current flow:** init -> (user reads text) -> set-init -> (user reads text) -> discuss -> (user reads text) -> wave-plan -> execute -> review -> merge

**Proposed flow:** init completes -> AskUserQuestion "Initialize first set? [Yes: `/rapid:set-init 1`/Choose set/Skip]" -> set-init completes -> "Discuss first wave? [Yes: `/rapid:discuss 1.1`/Choose wave/Skip]" -> etc.

**Implementation:** Each SKILL.md's final step already presents next steps. Changes:
1. Make the first option the natural next command (not just text guidance)
2. Use numeric shorthand in suggested commands
3. Show the exact invocation string so user can copy-paste or type it

**Important constraint:** RAPID skills cannot invoke other skills directly (skills are markdown prompts, not executables). The user still types the command, but it is short and pre-suggested. This is UX polish, not architectural change.

### 5. Plan Verifier Agent

**Scope:** New agent role that validates job plans before execution.

**Agent: `role-plan-verifier.md`**

**Checks:**
1. **Coverage:** Every decision in WAVE-CONTEXT.md has at least one corresponding implementation step in a JOB-PLAN.md. Reports uncovered decisions as gaps.
2. **Implementability:** Files referenced in JOB-PLAN.md either exist in worktree or are explicitly created in an earlier step. Nonexistent file references without creation steps are flagged.
3. **Completeness:** Every acceptance criterion in JOB-PLAN.md has at least one implementation step.
4. **Consistency:** File ownership across JOB-PLANs within the same wave does not overlap (complements contract validation's cross-set checks).

**Output:** `VERIFICATION-REPORT.md` at `.planning/waves/{setId}/{waveId}/`:
- PASS / PASS_WITH_GAPS / FAIL verdict
- Per-check results with evidence
- Suggested fixes for gaps

**Integration:** New step in wave-plan SKILL.md between Step 5 (Job Planner Agents) and Step 6 (Contract Validation Gate).

**Gate behavior:**
- PASS or PASS_WITH_GAPS: continue to contract validation
- FAIL: AskUserQuestion with "Re-plan affected jobs" / "Override and continue" / "Cancel"

### 6. Parallel Wave Planning

**Scope:** When a set has multiple waves, plan independent waves concurrently.

**Dependency analysis:** Two waves are independent if they have no file ownership overlap and do not reference each other's jobs.

**Implementation approach:**
1. Lightweight dependency scan of all waves before planning any
2. Build dependency graph (likely linear: wave-1 -> wave-2 -> wave-3)
3. Independent waves plan in parallel (up to 5 per Claude Code limit)
4. Dependent waves plan sequentially with predecessor artifacts available

**Realistic assessment:** Most sets have linearly dependent waves. True intra-set parallelism will be rare. The bigger practical win is auto-chaining sequential wave planning (plan wave-1, then auto-plan wave-2) instead of requiring manual invocation per wave. Parallel dispatch is an optimization on top.

**Recommendation:** Start with sequential multi-wave auto-chaining. Add parallel dispatch as an optimization after sequential flow works.

### 7. Context-Efficient Review with Scoper Delegation

**Scope:** Reduce review token costs by scoping what each review agent sees.

**Current cost:** Review SKILL.md documents $15-45 per bug hunt cycle. 20 changed files all sent to hunter, advocate, and judge.

**Scoper agent design:**
1. **Input:** Git diff + dependents from `scopeWaveForReview` (already in `src/lib/review.cjs`)
2. **Analysis:** Categorize files by concern (logic, API, tests, infra, docs)
3. **Output:** `{ concerns: [{ name, files, reviewFocus }], crossCutting: [files] }`
4. **Cross-cutting:** Files the scoper cannot confidently categorize go into every scope

**Modified review flow:**
1. Scoper runs first (low cost -- read-only, small model)
2. For each concern with logic/API changes: spawn focused hunter with ONLY those files
3. Advocate and judge receive only relevant files + their concern's findings
4. Cross-cutting files included in all scopes (safety net)
5. Final results merged before presentation to user

**Token savings:** ~65% context reduction per agent for typical 20-file waves.

**Key constraint:** Claude Code has no scoped context passing (confirmed: [GitHub issue #4908](https://github.com/anthropics/claude-code/issues/4908)). Scoping is prompt-level advisory ("Focus ONLY on these files: [list]"), not tool-level enforcement. Agents can still Read any file. The scoping is a strong suggestion, not a hard boundary.

**Risk:** Scoper may miss cross-file dependencies. Mitigation: conservative initial implementation with more cross-cutting, fewer isolated scopes.

## Ecosystem Context

### Claude Code Platform Capabilities (verified 2026-03-09)

| Capability | Status | Source | Confidence |
|------------|--------|--------|------------|
| Subagent spawning via Agent tool | Stable | [Official docs](https://code.claude.com/docs/en/sub-agents) | HIGH |
| Up to 5 simultaneous subagents | Confirmed | Official docs | HIGH |
| `$ARGUMENTS`, `$0`, `$1` in skills | Supported | [Skills docs](https://code.claude.com/docs/en/skills) | HIGH |
| `context: fork` for subagent skills | Supported | Skills docs | HIGH |
| `multiSelect: true` in AskUserQuestion | Supported | Already used in discuss SKILL.md | HIGH |
| Subagents cannot spawn sub-subagents | Hard constraint | Official docs | HIGH |
| Background subagents via Ctrl+B | Supported | Official docs | HIGH |
| Scoped context passing (parent -> subagent) | NOT available | [GitHub #4908](https://github.com/anthropics/claude-code/issues/4908) | HIGH |
| PreCompact hooks | Available (Jan 2026) | Changelog | HIGH |
| Subagent persistent memory | Available | Official docs (`memory` frontmatter field) | HIGH |
| `isolation: worktree` for subagents | Available | Official docs | HIGH |
| `/batch` bundled skill for parallel work | Available | Official docs | HIGH |

### Key Constraint: No Scoped Context Passing

The biggest technical constraint for context-efficient review is that Claude Code has no mechanism for passing scoped context from parent to subagent. The only channel is the prompt string (confirmed by official docs: "The only channel from parent to subagent is the Task prompt string"). This means the review scoper must encode its scoping decisions into explicit instructions in each downstream agent's prompt. Agents can still read any file via the Read tool -- scoping is advisory, not enforced.

## Sources

- [Claude Code Subagent Documentation](https://code.claude.com/docs/en/sub-agents) -- subagent architecture, context isolation, tool restrictions, parallel spawning, persistent memory, worktree isolation (HIGH confidence)
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) -- skill argument parsing, `$ARGUMENTS`, `context: fork`, frontmatter fields, string substitutions (HIGH confidence)
- [GitHub Issue #4908: Scoped Context Passing](https://github.com/anthropics/claude-code/issues/4908) -- confirms scoped context is requested but unimplemented (HIGH confidence)
- [GitHub Issue #27645: Subagent Token Waste](https://github.com/anthropics/claude-code/issues/27645) -- confirms community recognizes token waste in subagent delegation (MEDIUM confidence)
- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices) -- context window optimization (HIGH confidence)
- [Claude Code Changelog](https://code.claude.com/docs/en/changelog) -- PreCompact hooks, version history (HIGH confidence)
- [AskUserQuestion Tool Guide](https://smartscope.blog/en/generative-ai/claude/claude-code-askuserquestion-tool-guide/) -- structured question patterns (MEDIUM confidence)
- RAPID v2.0 codebase: `skills/discuss/SKILL.md`, `skills/wave-plan/SKILL.md`, `skills/review/SKILL.md`, `skills/execute/SKILL.md`, `skills/init/SKILL.md`, `skills/set-init/SKILL.md`, `src/lib/review.cjs`, `src/lib/init.cjs` (HIGH confidence -- primary source)

---
*Feature research for: RAPID v2.1 workflow improvements*
*Researched: 2026-03-09*
