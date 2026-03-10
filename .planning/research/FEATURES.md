# Feature Landscape

**Domain:** Multi-agent merge pipeline delegation + developer tool documentation (Claude Code plugin)
**Researched:** 2026-03-10
**Milestone:** v2.2 -- Subagent Merger & Documentation

**Scope:** This research covers ONLY the v2.2 features. All v2.0 and v2.1 features (state machine, sets/waves/jobs, concern-based review, wave orchestration, plan verifier, batched questioning, set-based review, etc.) are already built and shipped.

## Table Stakes

Features users expect. Missing = the refactor fails its purpose or the product feels incomplete.

### A. Merge Pipeline Subagent Delegation

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Per-set merge subagent spawning | Core v2.2 requirement. The orchestrator currently runs detection+resolution inline, consuming its own context window for every set. Every production multi-agent merge system delegates per-unit work to subagents (Anthropic's multi-agent research system, Google ADK, OpenAI Agents SDK all use orchestrator-worker). The review pipeline already proves this pattern works in RAPID (scoper, hunter, advocate, judge are all delegated). | Med | Existing merge.cjs detection/resolution functions, rapid-merger agent definition, merge SKILL.md refactoring | Orchestrator assembles context (detection report, contracts, set CONTEXT.md, other-set contexts) and passes to subagent via Agent tool. The review pipeline does this exact pattern in Step 2.5 (scoper), Step 4a (unit-tester), Step 4b (bug-hunter). Follow the same template. |
| Structured result collection from merge subagents | Orchestrator must parse RAPID:RETURN JSON from each merge subagent to route next action (escalate, apply, proceed). Without structured results, the orchestrator cannot make routing decisions. | Low | Existing returns.cjs parseReturn(), RAPID:RETURN protocol | Already standardized across all 29 agents. The merger agent role already defines the exact return schema (semantic_conflicts, resolutions, escalations, all_resolved). No new protocol needed -- just consume the existing one from a subagent context instead of inline. |
| Error propagation from subagent to orchestrator | If a merge subagent crashes, hits context limits, or returns BLOCKED, the orchestrator must surface this to the user with recovery options. Unhandled subagent failure means silent data loss. Research shows uncoordinated multi-agent systems experience up to 17x error amplification. | Med | RAPID:RETURN BLOCKED/CHECKPOINT status handling | Orchestrator must handle three failure modes: (1) subagent returns BLOCKED -- surface blocker to user, (2) subagent returns malformed/unparseable JSON -- retry or skip with warning, (3) subagent hits context window mid-resolution -- treat as CHECKPOINT, collect partial results. The review pipeline already handles (1). Cases (2) and (3) need explicit fallback paths in the merge SKILL.md. |
| Partial failure handling (some sets succeed, some fail) | When merging multiple sets, some subagents may succeed while others fail. Orchestrator must continue with successful merges and present failures separately. DAG ordering means a failed dependency blocks its dependents but not independent sets. | Med | DAG ordering from dag.cjs getExecutionOrder(), existing merge pipeline wave grouping | Current pipeline already handles this via skip-set AskUserQuestion prompts. Subagent delegation adds a new failure category: subagent-level failure (agent crashed/blocked) vs merge-level failure (git conflict). Both must be distinguishable to the user so they know whether to re-run the subagent or resolve a git conflict. |
| Idempotent re-entry after subagent failure | If pipeline crashes after 2 of 5 sets are merged, restarting must skip completed sets. MERGE-STATE.json already tracks per-set status. Subagent delegation must not break this contract. | Low | MERGE-STATE.json with status tracking (pending/detecting/resolving/merging/complete/failed) | Existing pattern. The orchestrator already checks MERGE-STATE before processing each set and skips status='complete'. The key requirement: update MERGE-STATE status BEFORE spawning the subagent (to 'resolving') and AFTER the subagent returns (to the next status). This ensures a crash between spawn and return leaves the set in 'resolving', not 'pending'. |
| Context assembly for merge subagents | Each merge subagent needs: detection report (L1-L4 conflicts), unresolved conflicts from T1/T2 cascade, set CONTEXT.md, contracts, contexts of already-merged sets in this wave. Without complete context, the subagent cannot perform semantic analysis. | Med | merge.cjs readMergeState(), execute.cjs prepare-context, CONTRACT.json per set | Merge SKILL.md Step 4c already defines exactly what context to assemble. The change is moving this assembly from an inline operation to a per-set subagent dispatch with the same context shape. The prompt template is already written -- it just needs to be generated per-set instead of once. |
| Sequential-within-wave ordering preserved | Sets within a DAG wave must merge sequentially. Each merge sees the result of the previous merge. This is a correctness requirement -- parallel within-wave merging on a single branch causes git conflicts. | Low | Existing wave-sequential loop in merge SKILL.md Step 2 | Subagent delegation changes WHO does the work, not WHEN. Wave ordering stays in the orchestrator; each subagent handles one set at a time within a wave. The orchestrator loop structure stays identical. |

### B. Documentation

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Accurate README reflecting v2.2 capabilities | Current README references "Mark II" v2.0 terminology. v2.1 added 8 features (concern-based review, wave orchestration, plan verifier, batched questioning, set-based review, etc.) that are absent from README. v2.2 adds subagent merger. A README that does not match the product erodes trust and confuses new users. | Med | Full inventory of current skills (17), agents (29), all features through v2.2 | README is the entry point for every potential user. Must match current state exactly. Current README has correct structure (Install, Quick Start, Features, How It Works, Hierarchy, Prerequisites, Commands, License) -- content needs updating, not restructuring. |
| Installation instructions that work | Current install section is accurate (claude plugin add fishjojo1/RAPID + /rapid:install). Must remain accurate with correct prerequisites (Node 18+, git 2.30+). | Low | setup.sh, install SKILL.md | Existing and validated. Verify current accuracy, keep or polish. |
| Command reference table with accurate descriptions | README must list all commands with current one-line descriptions. Current table lists 17 commands. Descriptions must reflect v2.1/v2.2 behavior, not v2.0 behavior (e.g., /rapid:review now does concern-based scoping, not just chunked review). | Low | Current skill directory listing, all 17 SKILL.md files | Verify each description against its SKILL.md. Several descriptions need updating to reflect v2.1 changes. |
| Quick start that covers the full lifecycle | Users need a clear "from zero to merged code" path. Current quick start stops at step 3 (/rapid:plan) and says "RAPID orchestrates the full development lifecycle" without showing it. Must show the full workflow: init -> plan -> set-init -> discuss -> wave-plan -> execute -> review -> merge -> cleanup. | Med | Understanding of the full workflow, good example framing | Current 3-step quick start leaves users at the planning phase. The quick start should be 5-7 steps covering the core loop, with a note that steps 3-7 repeat per set. |
| Technical documentation for power users | Current DOCS.md is exhaustive for v2.0 but outdated. Version says "2.0.0". Missing: concern-based review scoping, wave orchestration, plan verifier, batched questioning, set-based review, numeric ID shorthand, agent role reference, subagent merger delegation. PROJECT.md lists "Fresh README.md" and "New technical_documentation.md" as target features. | High | Full understanding of every skill, every agent role, every library function. Must be written AFTER merge pipeline work is done. | This is the largest documentation effort. Every command section needs verification against current SKILL.md files. The existing DOCS.md structure (Installation, Quick Start, Available Commands by category) is sound -- content needs full refresh. |

## Differentiators

Features that set the product apart. Not expected by default, but create significant value.

### A. Merge Pipeline Subagent Delegation

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Adaptive nesting: merge subagents spawn per-conflict sub-subagents | For sets with many complex conflicts (10+ unresolved after T1/T2), a single merger agent may exhaust its context window analyzing all of them. Allowing the merge subagent to spawn its own sub-agents for individual conflict clusters mirrors the review pipeline's concern-based dispatch. PROJECT.md explicitly lists this as a target feature ("Adaptive nesting: merge agents can spawn per-conflict sub-agents for complex resolutions"). | High | Merger agent role must be updated to allow spawning (Agent tool), new conflict-resolver agent role needed, conflict partitioning logic | Current merger role says "Never spawn sub-agents" because v2.0 designed it as a leaf agent. v2.2 explicitly wants to change this. Requires: (1) new conflict-resolver agent role (leaf agent handling 1-3 related conflicts), (2) updated merger role (add Agent tool to allowed-tools, add delegation logic), (3) partitioning: group conflicts by file proximity or concern area before delegation. The merger becomes a mini-orchestrator. |
| Parallel independent set merging when DAG allows | If Wave 1 has sets A, B, C with no file overlap or transitive dependencies, they could merge in parallel on separate temporary branches, then fast-forward sequentially. PROJECT.md lists "Independent sets merge in parallel when DAG allows." | High | DAG analysis for true independence (no shared files, no transitive deps), temporary branch strategy, parallel git operations | Requires rethinking within-wave merge model. Current model is strictly sequential. Parallel would require: (1) fork temp branches from pre-wave HEAD, (2) merge each set independently on its temp branch, (3) sequential fast-forward of temp branches to main, (4) integration test only once after all fast-forwards. Risk: merge conflicts between "independent" sets sharing transitive dependencies. This is an optimization -- sequential merging is correct, parallel is faster. |
| Merge dry-run mode | Run the full detection + resolution pipeline without performing the actual git merge. Preview conflicts and resolution confidence before committing. Useful for teams wanting to assess merge risk before proceeding. | Low-Med | Separate detect+resolve path from git merge execution path | Detection and resolution already produce reports stored in MERGE-STATE.json. A dry-run flag stops after Step 5 (programmatic gate). Add a "Dry run" option to the Step 1 AskUserQuestion. Implementation: skip Steps 6-8 and present the full detection+resolution report as the final output. |
| Merge conflict heat map | After detection, display a summary showing which files concentrate the most conflicts across all sets. Helps users understand risk distribution before merge begins. | Low | Detection results from all sets in the current wave | Pure display feature. Parse detection reports, sort files by total conflict count across sets, print as a ranked table in the merge plan confirmation step. Zero risk, small effort, useful signal. |

### B. Documentation

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Architecture diagram in README | Visual diagram showing Sets/Waves/Jobs hierarchy, worktree isolation, data flow through the pipeline, and merge flow. Developer tools with visual architecture in README get meaningfully higher engagement. The current "How It Works" section is text-only. | Low | ASCII art (works in terminals and GitHub) or Mermaid (renders on GitHub only) | Recommend ASCII art for maximum compatibility since Claude Code users frequently view README in terminal via Read tool. Include the hierarchy (already in README as text), the pipeline flow (init->plan->...->merge), and the isolation model (main branch + worktree branches). |
| Agent role reference section in technical docs | Document all 29 agents with their purpose, inputs, outputs, and which skill spawns them. No other Claude Code plugin has this level of agent architecture -- documenting it is a genuine differentiator. | Med | All 29 agent .md files in agents/ directory | Power users want to understand the system. The agent reference also serves as onboarding material for contributors. Structure: table with agent name, spawned by (skill), purpose, input context, output format, and whether it spawns sub-agents. |
| Troubleshooting guide | Common issues with diagnosis and fix: RAPID_TOOLS not set, worktree conflicts, merge failures, subagent crashes, state machine stuck, review scoper miscategorization. | Med | User experience and known failure modes from v2.0/v2.1 | Reduces support burden. Most Claude Code plugin docs lack troubleshooting entirely. Each entry: symptom, cause, fix command. |
| Interactive walkthrough / annotated example | Step-by-step annotated example of a real RAPID session showing what the user types, what RAPID responds, and what happens under the hood. Like a session transcript. | Med | Requires running through a real workflow and capturing output | Extremely valuable for onboarding. Shows users exactly what to expect at each stage. Include in technical docs or a separate section of DOCS.md. |
| Version changelog | User-facing changelog documenting what changed in each version (v1.0, v1.1, v2.0, v2.1, v2.2). PROJECT.md already has this information in the requirements list but in internal format. | Low | PROJECT.md validated requirements by version | Extract from PROJECT.md, reformat as user-facing changelog with categories (Added, Changed, Fixed). Include at the end of technical docs or as a separate CHANGELOG.md. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Fully parallel within-wave merging (fire-and-forget) | Git merge is inherently sequential on a single branch. True parallelism requires temporary branch strategies with enormous complexity and risk (merge conflicts between "parallel" merges, octopus merge failures, non-deterministic ordering). Microsoft's orchestration guidance explicitly warns against this for cases with "well-defined steps and strong hierarchical dependencies." | Keep sequential within-wave merging as the default. Parallel is a differentiator only when DAG proves sets are truly independent. Even then, implement as opt-in with conservative independence checks. |
| Subagent-to-subagent direct communication | Merge subagents talking to each other (set A's merger telling set B's merger about a resolution) creates the "bag of agents" topology that causes 17x error amplification. All communication must flow through the orchestrator hub. | Hub-and-spoke only: orchestrator is the sole communication point. Merger agents report back to orchestrator, which passes relevant context (accumulated merged-set contexts) to the next merger. This is exactly how the review pipeline works (hunters do not talk to each other -- advocate sees all findings via the orchestrator). |
| AI-only merge resolution (removing human escalation) | PROJECT.md explicitly lists this as out of scope ("AI-only merge conflict resolution -- multi-file conflicts need human judgment"). Removing the T4 human escalation tier creates false confidence. The research is clear: confidence below 0.7 should always escalate. | Keep the 4-tier cascade. T1/T2 automated, T3 AI with confidence scoring, T4 human for low-confidence cases. The subagent delegation does not change the resolution tiers -- it changes where T3 runs (subagent context instead of orchestrator context). |
| Auto-generated documentation from code | Auto-generated docs miss the "why", produce reference-only material without narrative, and create maintenance burden when the generator outputs incorrect content. Draft.dev explicitly identifies this as a documentation anti-pattern: "autogenerated reference material indexed by search engines without review." | Write docs manually with full understanding of the product. Use code as the source of truth for accuracy, but write the narrative by hand. Verify each command description against its SKILL.md. |
| Separate documentation site | RAPID is a Claude Code plugin installed via `claude plugin add`. Users interact with it inside Claude Code, not in a browser. A separate docs site (Docusaurus, GitBook, Mintlify) adds infrastructure, deployment complexity, and a second source of truth that will inevitably diverge. | README.md for entry point + technical_documentation.md for comprehensive reference. Both in-repo, both accessible via GitHub and local filesystem. This matches how Claude Code plugin users actually consume documentation. |
| Merge subagent persistent memory | Giving merger agents persistent memory across merge runs sounds useful but creates stale state bugs. Merge context changes every run (different conflicts, different set code). A merger "remembering" a previous resolution strategy may apply it incorrectly to a new codebase state. | Fresh context per merge run. Each merger subagent gets exactly the context it needs for THIS merge. Proven pattern: the review pipeline creates fresh subagent contexts every review run. |
| Complex merge visualization UI | Building a TUI or web dashboard for merge progress visualization is scope creep. RAPID runs inside Claude Code's terminal -- the output channel is text. | Simple text-based progress banners (already implemented: "[1/3] auth-set: MERGED"). Add the conflict heat map table for richer text-based visualization. |

## Feature Dependencies

```
Per-set merge subagent spawning
  -> Structured result collection (must parse RAPID:RETURN from subagent)
  -> Error propagation (must handle BLOCKED/CHECKPOINT/malformed returns)
  -> Context assembly (must build prompt with detection report + contracts + contexts)
  -> Idempotent re-entry (MERGE-STATE updated before/after subagent spawn)
  -> Sequential-within-wave preserved (orchestrator loop unchanged)

Adaptive nesting (per-conflict sub-subagents)
  -> Per-set merge subagent spawning (parent pattern must work first)
  -> New conflict-resolver agent role (leaf agent for 1-3 conflicts)
  -> Updated merger role (add Agent tool, remove "never spawn" rule)
  -> Conflict partitioning logic (group by file proximity or concern)

Parallel independent set merging
  -> Per-set merge subagent spawning (prerequisite)
  -> DAG independence analysis (verify no shared files or transitive deps)
  -> Temporary branch strategy (fork/merge/fast-forward)

README rewrite
  -> Full feature inventory through v2.2

Technical documentation rewrite
  -> README rewrite (establishes terminology and structure)
  -> Merge pipeline delegation complete (must document new behavior)
  -> Agent role reference (documents all 29+ agents)
  -> Full command verification against current SKILL.md files
```

## MVP Recommendation

### Phase 1: Merge Pipeline Delegation (build first)

Prioritize in this order:

1. **Per-set merge subagent spawning with context assembly** -- Core v2.2 feature. Refactor merge SKILL.md Steps 3-4 to spawn rapid-merger per set instead of inline orchestration. The review pipeline's delegation pattern (Steps 2.5, 4a, 4b) is the template to follow. Key changes: (a) assemble per-set context into a prompt, (b) spawn Agent with rapid-merger, (c) parse RAPID:RETURN, (d) route based on results (apply resolutions, handle escalations, continue).
2. **Structured result collection + error propagation** -- Parse RAPID:RETURN from merger subagents. Handle all three failure modes: BLOCKED returns, malformed JSON, context window exhaustion. Surface failures via AskUserQuestion with existing recovery options (retry, skip, abort).
3. **Partial failure handling with idempotent re-entry** -- When one set's merger subagent fails, continue with remaining sets. Update MERGE-STATE.json before spawning (status -> 'resolving') and after return (status -> next). Ensure restart skips completed sets.
4. **Adaptive nesting (per-conflict sub-subagents)** -- Update merger role: add Agent tool, remove "Never spawn sub-agents" rule, add conflict partitioning logic. Create conflict-resolver agent role. This handles the context overflow case for sets with 10+ complex conflicts.

**Defer:** Parallel independent set merging -- high risk, high complexity, marginal benefit (most DAG waves have 2-3 sets). Implement later as opt-in behind a config flag if profiling shows within-wave sequential merging is a bottleneck.

**Defer:** Merge dry-run mode and conflict heat map -- nice-to-have display features that can be added incrementally after core delegation works.

### Phase 2: Documentation (build second, after merge pipeline is stable)

Prioritize in this order:

1. **README.md rewrite** -- Entry point for all users. Must reflect v2.2 capabilities including the new subagent merger. Include architecture diagram (ASCII art), updated feature descriptions, expanded quick start (full lifecycle, not just first 3 steps), verified command table.
2. **technical_documentation.md** -- Full rewrite replacing DOCS.md. Every command section verified against current SKILL.md files. Version updated. Add agent role reference (all 29 agents). Add troubleshooting section. Add version changelog.

**Defer:** Interactive walkthrough (valuable but time-intensive; produce after docs are stable). Dedicated troubleshooting guide (build incrementally from real user issues).

### Ordering Rationale

Documentation MUST come AFTER merge pipeline delegation because:
- README and docs must document the NEW merge behavior, not the old inline behavior
- Writing docs against a moving target wastes effort (docs written before merge changes will need immediate rewriting)
- Merge pipeline is higher-risk, higher-complexity work that should be validated first
- Documentation is lower-risk and can be written confidently once all features are stable

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Depends On |
|---------|------------|---------------------|----------|------------|
| Per-set merge subagent spawning | HIGH | MEDIUM | P1 | Existing merge pipeline |
| Structured result collection | HIGH | LOW | P1 | Subagent spawning |
| Error propagation | HIGH | MEDIUM | P1 | Subagent spawning |
| Partial failure + idempotent re-entry | HIGH | MEDIUM | P1 | Subagent spawning |
| Context assembly for subagents | HIGH | MEDIUM | P1 | Subagent spawning |
| Adaptive nesting (sub-subagents) | MEDIUM | HIGH | P2 | P1 complete |
| README.md rewrite | HIGH | MEDIUM | P3 | P1 + P2 complete |
| technical_documentation.md | HIGH | HIGH | P3 | README complete |
| Parallel set merging | LOW | HIGH | DEFER | P1 complete |
| Merge dry-run mode | MEDIUM | LOW | DEFER | P1 complete |
| Conflict heat map | LOW | LOW | DEFER | P1 complete |

## Sources

- [Anthropic Engineering: Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system) -- Orchestrator-worker pattern, subagent spawning, result collection, failure handling, context management
- [Microsoft: Orchestrator and Subagent Multi-Agent Patterns](https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/architecture/multi-agent-orchestrator-sub-agent) -- When to use orchestrator-subagent, anti-patterns, "Russian doll" pattern
- [Claude Code Sub-Agent Best Practices](https://claudefa.st/blog/guide/agents/sub-agent-best-practices) -- Parallel vs sequential dispatch, invocation quality, error handling, model configuration
- [Towards Data Science: 17x Error Trap in Multi-Agent Systems](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/) -- Error amplification, centralized coordination benefits, functional planes
- [Draft.dev: Documentation Best Practices for Developer Tools](https://draft.dev/learn/documentation-best-practices-for-developer-tools) -- Essential sections, README vs technical docs, accuracy, anti-patterns
- [Google ADK Multi-Agent Patterns](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/) -- SequentialAgent, shared state management
- [OpenAI Agents SDK: Agent Orchestration](https://openai.github.io/openai-agents-python/multi_agent/) -- Agents-as-tools vs handoff patterns
- RAPID codebase: `skills/review/SKILL.md` (proven subagent delegation pattern with scoper+hunter+advocate+judge), `skills/merge/SKILL.md` (current inline pattern to refactor), `agents/rapid-merger.md` (current leaf agent role to update), `src/lib/merge.cjs` (detection+resolution library), `src/lib/review.cjs` (concern scoping functions)

---
*Feature research for: RAPID v2.2 -- Subagent Merger & Documentation*
*Researched: 2026-03-10*
