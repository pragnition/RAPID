# Pitfalls Research

**Domain:** Surgical rewrite of agent orchestration framework (RAPID v3.0 Refresh)
**Researched:** 2026-03-12
**Confidence:** HIGH (based on direct codebase analysis of 26,829 LOC across 21 runtime libraries, 31 role modules, 18 skills; industry research on multi-agent system failures; Anthropic's context engineering guidance; prior RAPID retrospective covering 4 shipped versions)

Note: This supersedes the 2026-03-10 v2.2 pitfalls. Previous pitfalls about subagent merge delegation, DAG parallel merging, and documentation coupling were addressed in v2.2 implementation. This document focuses on pitfalls specific to the v3.0 surgical rewrite: collapsing wave-plan/job-plan into plan-set, embedding tool docs in agent prompts, removing file locks and set gating, XML-formatting prompts, and simplifying state management -- all while keeping proven review and merge pipelines intact.

---

## Critical Pitfalls

Mistakes that cause rewrites, broken pipelines, or loss of working functionality.

### Pitfall 1: The Accidental Regression -- Breaking Review/Merge While Rewriting Orchestration

**What goes wrong:**
The v3.0 goal is "surgical rewrite" -- change the orchestration layer while keeping proven review and merge pipelines. In practice, the orchestration layer is deeply coupled to the subsystems it orchestrates. The current merge SKILL.md (611 lines) and review SKILL.md (934 lines) depend on specific state machine transitions, CLI command signatures, and RAPID:RETURN parsing patterns that the orchestration rewrite changes.

Three concrete coupling points that will break:

1. **State transition sequences.** The current `state-transitions.cjs` defines `SET_TRANSITIONS: pending -> planning -> executing -> reviewing -> merging -> complete`. The v3.0 simplification collapses wave-plan + job-plan into a single plan-set flow. If the set status semantics change (e.g., removing the `planning` intermediate or collapsing wave/job statuses), the review SKILL.md's precondition check (`set.status === 'reviewing'`) and the merge SKILL.md's precondition check (`set.status === 'merging'` or `phase=Done`) break. Both skills fail silently -- they just refuse to run because the status check does not match.

2. **CLI command output schemas.** The merge SKILL.md calls `node "${RAPID_TOOLS}" merge order`, `merge status`, `merge detect`, `merge resolve`, `merge execute`, `merge review`, `merge integration-test`, `merge bisect`, `merge rollback`. Each returns a specific JSON shape that the skill parses inline. If the v3.0 CLI refactoring changes any output shape (e.g., renaming a field, changing nesting), the merge skill's inline parsing silently extracts `undefined` and proceeds with corrupted data. There are no runtime type checks on CLI output in the skill prompts.

3. **RAPID:RETURN contract.** The review pipeline's hunter/advocate/judge agents and the merge pipeline's set-merger agents return structured RAPID:RETURN JSON. The orchestrator parses these returns via pattern matching (`returns.cjs parseReturn()`). If v3.0 changes the return schema (e.g., changing field names for XML consistency), existing agent role modules that emit the old schema produce returns the new orchestrator cannot parse.

**Why it happens:**
"Surgical rewrite" is a misnomer that creates false confidence. The RAPID retrospective notes: "Clean breaks beat migration paths." But v3.0 is NOT doing a clean break -- it is surgically modifying the orchestration layer while expecting downstream consumers (review, merge) to keep working. This is the hardest kind of change: partial rewrite with compatibility constraints.

Anthropic's effective agents guide warns: "Incorrect assumptions about what's under the hood are a common source of customer error." The same applies internally -- the v3.0 rewrite will make assumptions about which review/merge behaviors depend on the orchestration layer, and some assumptions will be wrong.

**How to avoid:**
1. **Map the dependency graph before cutting.** Before changing any orchestration code, enumerate every function, CLI command, state transition, and RAPID:RETURN field that the review and merge SKILLs reference. This is the "blast radius" document. Any change that touches something in the blast radius requires updating the consuming skill simultaneously.
2. **Integration test for review and merge.** Write a test that invokes the review SKILL's precondition checks and the merge SKILL's precondition checks against a mock STATE.json. Run this test after every orchestration change. If the test breaks, the rewrite touched a coupling point.
3. **Phase the rewrite to touch orchestration-only modules first.** Change plan-set, discuss-set, execute-set (orchestration flow) before touching anything that review or merge depends on. This isolates the rewrite from proven pipelines for as long as possible.
4. **Adapter layer for state transitions.** If the state machine simplification changes status names, add a mapping layer: `oldStatus(newStatus)` that translates between the old names (used by review/merge) and new names (used by orchestration). Remove the adapter only after review/merge skills are updated.

**Warning signs:**
- `/rapid:review` refusing to start with "set is not in reviewing state" when it should be ready
- `/rapid:merge` showing "no sets ready to merge" when sets have completed execution
- RAPID:RETURN parse failures producing `undefined` fields in merge pipeline tracking
- Integration tests passing individually but the full workflow (plan -> execute -> review -> merge) failing at a handoff point

**Phase to address:**
Must be the very first concern in every phase. Each phase should include a "blast radius check" that verifies review and merge pipelines still work after the phase's changes.

---

### Pitfall 2: Simplification Amnesia -- Removing "Redundant" Functionality That Wasn't Redundant

**What goes wrong:**
The v3.0 goal includes removing file locks and set gating. The temptation during simplification is to remove code that "seems unnecessary" because its purpose is not obvious from reading it in isolation. RAPID has several mechanisms that appear redundant but exist for specific edge cases discovered during v1.0-v2.1 development:

1. **File locks (`lock.cjs`).** The lock mechanism uses `proper-lockfile` with mkdir-based atomic locking, stale detection (5-minute timeout), and retry with exponential backoff. This looks like over-engineering for a single-user Claude Code plugin. But locks protect STATE.json from corruption when multiple Claude Code instances (e.g., orchestrator + subagent) write to it simultaneously. Removing locks means: if the orchestrator transitions a set to `executing` while a subagent transitions a job to `complete`, the second write overwrites the first. STATE.json becomes inconsistent. This happened in v1.0 testing before locks were added.

2. **Set gating ("all sets must finish planning before any begin execution").** The v3.0 plan removes set gating. But set gating exists to prevent a subtle failure: Set A depends on Set B's interface contract. If Set A begins execution before Set B finishes planning, Set A executes against a DRAFT contract that changes. Set A's implementation becomes inconsistent with Set B's final contract. The v3.0 replacement (interface contracts without gating) needs to ensure contract immutability BEFORE removing the gate.

3. **Wave-level discuss phase.** The v3.0 plan collapses wave-plan/job-plan into plan-set. The discuss phase at the wave level (WAVE-CONTEXT.md creation via batched questions) appears to be separate from planning but actually serves as the "requirements discovery" step that prevents gray areas from emerging during execution. Removing it without replacement means planning operates on assumptions instead of validated decisions.

4. **Derived status propagation.** The state machine's `deriveWaveStatus()` and `deriveSetStatus()` functions automatically propagate child status changes upward. This looks like unnecessary complexity, but it ensures the orchestrator can check set-level status without querying every wave and job. If the v3.0 simplification flattens the hierarchy, it must still provide a way to answer "is this set done?" without traversing the full tree.

**Why it happens:**
The Chesterton's Fence problem: before removing a fence (feature), you must understand why it was built. RAPID's retrospective documents high-level lessons but not the specific edge cases that motivated individual mechanisms. The lock mechanism has no comment explaining "this prevents STATE.json corruption during concurrent subagent writes." A developer seeing `proper-lockfile` in a single-user plugin reasonably concludes it is unnecessary.

GitHub's multi-agent failure research identifies this as a top-3 failure mode: "Removing coordination mechanisms during simplification causes subtle concurrency bugs that only manifest under specific timing conditions."

**How to avoid:**
1. **Classify before removing.** For each mechanism targeted for removal, classify it: (a) known unnecessary -- never triggers in practice, (b) redundant -- another mechanism handles the same case, (c) unknown purpose -- cannot explain why it exists. Only remove (a). For (b), verify the replacement mechanism handles all cases. For (c), keep it until the purpose is understood.
2. **Document why each mechanism exists before removing it.** Write a 1-line comment for each: "Locks: prevent STATE.json corruption during concurrent orchestrator + subagent writes." If you cannot write the comment, you do not understand the mechanism well enough to remove it.
3. **Remove in stages with testing between stages.** Do not remove locks, gating, and wave discuss in the same phase. Remove one, verify the system works, then remove the next. If something breaks, you know which removal caused it.
4. **For locks specifically:** Even if set gating is removed, keep the lock mechanism if ANY concurrent write scenario exists. Multiple subagents writing to STATE.json is a real scenario. The lock overhead is ~100 LOC and zero runtime cost when there is no contention.

**Warning signs:**
- STATE.json containing impossible state combinations (e.g., set status "complete" but wave status "executing")
- Race conditions that only appear when running with multiple subagents (not reproducible in single-agent testing)
- Planning producing plans that contradict the interface contract of a dependency set
- Sets starting execution without a discuss-phase decision log, leading to mid-execution ambiguity questions

**Phase to address:**
The "removal" phases must come AFTER the "replacement" phases. For example: build the new plan-set flow (replacement for wave-plan + job-plan) first, verify it works, THEN remove the old wave-plan/job-plan code. Never remove before the replacement is proven.

---

### Pitfall 3: Inline YAML Tool Documentation Bloating Agent Context Windows

**What goes wrong:**
The v3.0 plan includes "embedded rapid-tools.cjs documentation (inline YAML per agent)." Each agent prompt will include YAML documentation for the CLI commands that agent needs. The current `rapid-tools.cjs` exposes 60+ subcommands across categories (state, merge, execute, review, display, resolve, wave-plan, contract, verify). Each subcommand has: name, arguments (1-5), options (0-4), output schema, and usage example.

A naive YAML embedding looks like:
```yaml
commands:
  state-get:
    args: [--all | --set <id>]
    output: { projectName, currentMilestone, milestones: [...] }
    example: node "${RAPID_TOOLS}" state get --all
  state-transition:
    args: [entity, milestoneId, setId, [waveId], [jobId], newStatus]
    output: { transitioned: true, entity, from, to }
    example: node "${RAPID_TOOLS}" state transition set v3 auth-set executing
  # ... 20 more commands for this agent
```

At ~80-120 tokens per command documentation, embedding 20 commands costs 1,600-2,400 tokens PER AGENT. With 31 role modules, the total token overhead across all agents is 49,600-74,400 tokens of YAML documentation that was previously zero. For the orchestrator agent, which needs awareness of most commands, this could be 4,000-6,000 tokens of YAML alone -- before the role instructions even begin.

Anthropic's context engineering guidance states: "Budget no more than 5 to 10 percent of your total window for the system prompt." For a 200K window, that is 10K-20K tokens. The YAML documentation alone could consume 25-30% of the prompt budget for complex agents.

Furthermore, Anthropic documents that "longer prefill increases time to first token" and that models experience "context rot" -- reduced recall accuracy as context grows. Inline YAML documentation is low-signal reference material that dilutes the high-signal role instructions surrounding it.

**Why it happens:**
The motivation is valid: agents currently call CLI commands they do not fully understand, producing incorrect arguments and parsing failures. Embedding the documentation solves this. But the solution creates a new problem (context bloat) that is worse than the original problem (occasional CLI misuse).

The SKILL.md files already demonstrate this pattern. The plan-set SKILL.md is 605 lines (est. 8,000-10,000 tokens). The merge SKILL.md is 611 lines (est. 8,000-10,000 tokens). Adding YAML documentation on top of these already-large prompts pushes agents into the "instruction dilution" zone where role-specific guidance is drowned out by reference material.

**How to avoid:**
1. **Tiered documentation embedding.** Only embed documentation for commands the agent ACTUALLY CALLS, not all commands. The executor agent calls `state transition`, `execute wave-status`, and `display banner`. Embed 3 commands (~300 tokens), not 60 commands (~7,000 tokens).
2. **Ultra-compact format.** Instead of full YAML with examples, use single-line signatures:
   ```
   state transition <entity> <milestoneId> <setId> [waveId] [jobId] <newStatus> -> {transitioned, entity, from, to}
   ```
   This is ~30 tokens per command vs ~100 tokens for full YAML. For 20 commands, that is 600 tokens vs 2,000 tokens.
3. **Disk-based reference with summary.** Embed only a command INDEX in the prompt (command names + one-line purpose), and point agents to a reference file on disk (`Read .planning/CLI-REFERENCE.md`) when they need argument details. This is the same pattern as the v2.1 scoper delegation -- minimal context in prompt, full context on disk.
4. **Measure before embedding.** Before finalizing the YAML format, count tokens for each agent's YAML block. Set a budget: no agent's YAML documentation should exceed 1,000 tokens (5% of a reasonable prompt budget of 20K tokens). If a block exceeds budget, trim to essential commands.

**Warning signs:**
- Agent prompts exceeding 15,000 tokens (check with `wc -w` on the built agent file, multiply by 1.3 for token estimate)
- Agents producing shallower analysis or forgetting instructions from the top of their prompts (context rot symptom)
- Agents calling correct CLI commands but ignoring their role-specific instructions about how to interpret results
- Time-to-first-token increasing noticeably for agents with large YAML blocks

**Phase to address:**
The tool documentation embedding phase. Establish the format and per-agent token budget BEFORE generating YAML for all 31 agents. Build one agent's YAML, measure, iterate on format, then scale.

---

### Pitfall 4: XML Formatting Inconsistency Across 31+ Agent Prompts

**What goes wrong:**
The v3.0 plan specifies "XML-formatted prompts with consistent structure." RAPID currently has 31 role modules and 18 skill files, all in Markdown format. Converting to XML introduces a consistency challenge that Markdown naturally avoids.

Three specific failure modes:

1. **Tag naming inconsistency.** One agent uses `<instructions>`, another uses `<agent_instructions>`, a third uses `<role_instructions>`. One uses `<tool_docs>`, another uses `<tools>`, a third uses `<cli_reference>`. Without a strict schema, each agent prompt evolves its own XML vocabulary. Claude Code agents do not validate XML structure -- they parse prompts as text. Inconsistent tags do not cause errors; they cause subtly different agent behavior because the model interprets differently-named sections differently.

2. **Mixed formatting.** During migration, some agents get full XML conversion while others remain partially Markdown. The hybrid state is worse than either pure approach: Claude models are trained on both formats but handle them differently. A prompt that mixes `<instructions>` XML tags with `## Instructions` Markdown headers creates ambiguous section boundaries that the model resolves non-deterministically.

3. **Build pipeline fragility.** RAPID v2.1 introduced `build-agents.cjs` which generates agent files from role modules + core modules. If the build pipeline needs to inject XML wrapper tags around composed content, the build logic becomes XML-aware -- it must track open/close tags, handle nesting, and escape special characters (`<`, `>`, `&`) in content. This is significantly more complex than concatenating Markdown files.

**Why it happens:**
XML formatting in prompts is a Claude best practice (per Anthropic's official guidance: "XML tags help Claude parse complex prompts unambiguously"). But the guidance is about USING XML tags, not about CONVERTING an entire prompt ecosystem to XML. The v3.0 plan conflates "use XML tags for structure" with "rewrite all prompts in XML format."

Anthropic's own documentation notes: "The exact formatting of prompts is likely becoming less important as models become more capable." The benefit of XML tags is primarily at section boundaries (separating instructions from context from examples), not in replacing Markdown entirely.

**How to avoid:**
1. **Define an XML schema document.** Before any conversion, create `.planning/PROMPT-SCHEMA.md` that lists every allowed XML tag, its purpose, and nesting rules. All 31 agents must use this exact vocabulary. Example:
   ```
   <role> - Agent identity and responsibilities
   <instructions> - Step-by-step workflow
   <tool_reference> - CLI command documentation
   <context> - Dynamic context injected at spawn time
   <output_format> - Expected return structure
   <constraints> - Hard rules and anti-patterns
   ```
2. **XML for structure, Markdown for content.** Use XML tags as section delimiters but keep the CONTENT of each section in Markdown. This gives structural clarity without the full complexity of XML content:
   ```xml
   <role>
   # Executor
   You implement tasks within your assigned worktree.
   ## Responsibilities
   - Follow the plan precisely
   - Commit atomically per task
   </role>
   ```
3. **Migrate in batches with validation.** Do not convert all 31 agents in one pass. Convert one category (e.g., the 6 research agents), validate that they work identically to the Markdown versions, then convert the next category. The build pipeline changes should be tested with each batch.
4. **Build pipeline generates XML wrappers.** The build-agents pipeline should handle XML tag insertion, not the human author. Role modules remain in Markdown; the build pipeline wraps each module's content in the appropriate XML tags based on a manifest. This keeps authoring simple and XML consistent.

**Warning signs:**
- Agent prompts using different tag names for the same concept across different agents
- Build pipeline producing malformed XML (unclosed tags, improper nesting)
- Agent behavior changes after XML conversion that are not attributable to content changes
- Agents treating `<constraints>` content differently than `## Constraints` content (indicating format sensitivity)

**Phase to address:**
Must be addressed in the first phase that touches prompt formatting. The XML schema document is a prerequisite for all prompt conversion work.

---

### Pitfall 5: State Simplification Losing Crash Recovery and Progress Tracking

**What goes wrong:**
The v3.0 plan simplifies orchestration, which implies simplifying the state machine. The current state machine (`state-machine.cjs`, 462 lines) provides:

1. **Crash recovery via `detectCorruption()` + `recoverFromGit()`.** If STATE.json is corrupted (invalid JSON, schema violation), the system recovers by checking out the last committed version from git. This handles: Claude Code crashes mid-write, disk full during atomic rename, concurrent writes producing partial JSON.

2. **Progress tracking via hierarchical status derivation.** `deriveWaveStatus()` and `deriveSetStatus()` automatically propagate child completion upward. The orchestrator checks set-level status to decide what to do next. If 3 of 5 jobs are complete, the wave status is `executing`. If all 5 are complete, wave status becomes `complete`. This enables the `/rapid:status` command to show a one-glance progress view.

3. **Idempotent re-entry via status-based gates.** Each skill checks preconditions: "is this set in status X?" If Claude Code crashes mid-execution and the user re-runs the command, the skill skips already-completed work based on status. The plan-set SKILL.md explicitly documents "Smart re-entry: If some waves are already in `planning` or later status, skip them."

4. **Atomic writes via lock + temp file + rename.** STATE.json writes go through: validate -> acquire lock -> write temp file -> rename temp to actual -> release lock. This prevents partial writes from corrupting state.

If v3.0 simplifies the state machine by:
- Removing the hierarchical derivation (flattening waves/jobs into a simpler model)
- Removing lock protection (part of the "remove file locks" goal)
- Simplifying status values (fewer statuses = fewer gates)

Then crash recovery degrades. The system cannot resume from the exact point of failure. The user must re-run entire phases instead of skipping completed sub-work.

**Why it happens:**
State machine complexity is "invisible infrastructure" -- users only notice it when it fails. Simplification naturally targets the most complex-looking code first, and the state machine IS the most complex non-business-logic code in RAPID. But its complexity exists to handle edge cases that are rare but catastrophic when they occur.

Temporal.io's research documents: "The complete state of your Workflow (local variables, progress, etc.) must be autosaved at critical points. Without automatic checkpointing, oversimplified state machines lose progress on crashes."

**How to avoid:**
1. **Preserve the crash recovery triad even if everything else simplifies.** The three functions -- `detectCorruption()`, `recoverFromGit()`, `commitState()` -- are fewer than 50 LOC combined and provide all crash recovery. Keep them regardless of state machine simplification.
2. **Preserve atomic writes.** The lock + temp file + rename pattern is 30 LOC in `writeState()`. Even if the lock is removed, keep the temp-file-then-rename pattern -- it prevents partial writes independently of concurrent access.
3. **Re-entry semantics survive simplification if status values survive.** The key property is: "can we determine whether step X was completed by checking state?" If the simplified state model answers this question, re-entry works. If status values are reduced to just `pending`/`executing`/`complete`, re-entry for mid-step work is lost (was the plan STARTED or FINISHED?).
4. **Design the simplified state model, then check re-entry.** For each command (/plan-set, /execute-set, /review, /merge), walk through the crash-restart scenario: "The user ran this command, Claude Code crashed at step 3 of 7. The user runs the command again. What happens?" If the answer is "the command re-executes steps 1-7 from scratch," re-entry is broken. If the answer is "the command detects step 3 was partially done and resumes from step 3 (or 4)," re-entry works.
5. **Add explicit checkpoint commits.** If the state model is too simplified for fine-grained re-entry, compensate with git commits at key checkpoints. The command reads git log on re-entry to determine what was already done. This is heavier than status-based re-entry but more robust.

**Warning signs:**
- `/rapid:status` showing less granular progress than v2.x (e.g., "executing" without per-job breakdown)
- Commands re-executing already-completed work after a crash/restart
- STATE.json containing `null` or `undefined` fields after a crash (partial write corruption)
- Users losing 10+ minutes of agent work because the system cannot resume from the crash point

**Phase to address:**
The state machine simplification phase. Design the simplified state model WITH the re-entry scenarios as acceptance criteria. "The simplified state model must support re-entry for all 7 primary commands" should be a success criterion.

---

### Pitfall 6: Interface Contracts Without Gating Becoming Write-Once-Read-Never Artifacts

**What goes wrong:**
The v3.0 plan replaces set gating with interface contracts: "Interface contracts for set dependencies (no gating)." The current system enforces contracts at a gate: all sets plan their contracts, then the gate validates cross-set dependencies before execution begins. Without the gate, contracts exist but nothing forces their validation.

Three failure modes:

1. **Contract written during planning, never checked during execution.** The executor agent receives a plan and implements it. The plan references the contract. But the executor has no mechanism to CHECK the contract at execution time -- it just implements the plan's instructions. If the plan diverges from the contract (e.g., planning produces a different function signature than what the contract specifies), the divergence is undetected until merge time.

2. **Contract drift between dependent sets.** Set A writes its contract during planning. Set B writes its contract during planning, referencing Set A's exports. Set A then CHANGES its implementation during execution (legitimate bug fix or scope adjustment). Set A's contract is not updated. Set B executes against the stale contract. At merge time, Set B's code calls a function that Set A changed, producing a runtime error that the merge pipeline cannot detect (it is not a textual conflict -- the function exists but with different behavior).

3. **Contracts become aspirational, not contractual.** Without enforcement (the gate), contracts become documentation rather than binding agreements. Developers (human or agent) write contracts during planning to satisfy the process, then ignore them during execution because nothing checks compliance. The contract artifact exists but provides zero value.

**Why it happens:**
Set gating was intentionally designed to solve this problem. The PROJECT.md documents the rationale: "Interface contracts define boundaries between sets upfront" and "Loose sync model -- shared planning gate, independent execution phases." The gate IS the enforcement mechanism. Removing the gate without replacing the enforcement creates a contract system with no teeth.

The v3.0 plan says "Interface contracts for set dependencies (no gating)" but does not specify what replaces the gating enforcement. This is a feature removal disguised as simplification.

**How to avoid:**
1. **Replace gate enforcement with continuous enforcement.** Instead of a planning gate, validate contracts at THREE points: (a) after planning completes for each set, (b) after each execution commit (pre-commit check or post-commit validation), (c) before merge begins. This is MORE enforcement than the gate provided, but distributed across the lifecycle instead of concentrated at one point.
2. **Contract immutability after planning.** Once a set's contract is written during planning, it becomes immutable. If the implementation needs to deviate, the contract must be explicitly updated via a formal change request (AskUserQuestion). This prevents silent drift.
3. **Executor-side contract verification.** Add a step to the executor role: before implementing each task, read the relevant contract exports/imports and verify the plan is consistent. If inconsistent, report BLOCKED with category CLARIFICATION. This is lightweight (one file read per task) and catches drift early.
4. **Merge-time contract regression test.** The merge pipeline already runs programmatic gates. Add a gate that validates all cross-set imports resolve to actual exports in the merged code. This is the ultimate safety net -- even if planning and execution miss a contract violation, merge catches it.

**Warning signs:**
- CONTRACT.json files that have not been updated since initial planning (check git log for last modification)
- Merge pipeline finding "import not found" errors for cross-set dependencies that were defined in contracts
- Executor agents implementing functions with different signatures than what the contract specifies
- Sets merging successfully but integration tests failing due to incompatible interfaces

**Phase to address:**
The interface contract phase. Contract enforcement must be designed at the same time as contract creation. "Contracts exist" is not a feature -- "contracts are enforced" is the feature.

---

### Pitfall 7: Agent Autonomy Miscalibration -- Too Free or Too Constrained

**What goes wrong:**
The v3.0 simplification implies giving agents more autonomy (fewer gates, fewer intermediate steps) while simultaneously constraining them more (embedded tool docs, XML structure, strict return formats). This creates a contradictory signal.

The current system has explicit autonomy tiers (from the v2.0 retrospective and DEEP-ANALYSIS.md):
- **Auto-fix:** Bugs and typos that do not change behavior (full autonomy)
- **Auto-add:** Critical missing features (moderate autonomy, must document)
- **Auto-fix blocking:** Issues that block execution (constrained autonomy, must report)
- **STOP for architectural:** Changes that affect system design (no autonomy, requires human decision)

If v3.0 changes the autonomy boundaries without updating the deviation rules:

1. **Too much freedom scenario.** The plan-set simplification removes the wave analyzer, wave researcher, wave planner, job planner, and plan verifier agents as separate spawns. If the new plan-set flow gives a single planning agent all of this responsibility without the verification checks (plan verifier verdict, contract validation gate), the planning agent can produce plans that are unverifiable until execution begins. Bad plans discovered during execution cost 10x more to fix than bad plans caught during planning.

2. **Too little freedom scenario.** Embedding YAML tool docs and XML structure creates rigid prompts. If the prompt is too prescriptive ("use EXACTLY this command with EXACTLY these arguments"), agents cannot adapt when the situation does not match the prescribed pattern. For example, the merge SKILL.md has 611 lines of step-by-step instructions. If the XML version is even more rigid, agents facing edge cases (unusual conflict patterns, unexpected git states) have no room to reason about the situation -- they either follow the script (which does not cover the edge case) or report BLOCKED (frustrating for the user).

3. **Autonomy cliff.** Some agents are fully scripted (skills with step-by-step instructions) while others are fully autonomous (role modules with goals but no script). The handoff between scripted and autonomous agents creates an "autonomy cliff" -- the scripted orchestrator skill spawns an autonomous agent, and the agent's behavior is unpredictable because it has no script to follow. The v3.0 simplification may widen this cliff by making skills more prescriptive while keeping roles equally autonomous.

**Why it happens:**
Anthropic's research identifies this as a fundamental tension: "A system with high autonomy may handle complex tasks efficiently, but risks straying from its intended purpose. A highly aligned system may adhere closely to its intended purpose but may lack the flexibility to respond to novel situations."

The v3.0 plan tries to solve both problems (more autonomy via fewer gates + more alignment via embedded docs + XML structure) without recognizing they are contradictory.

**How to avoid:**
1. **Explicit autonomy levels per agent.** Document each agent's autonomy level: SCRIPTED (follows step-by-step), GUIDED (has goals + constraints but chooses approach), or AUTONOMOUS (has goals only). Each level has different prompt structures:
   - SCRIPTED: detailed XML steps with exact commands
   - GUIDED: goals + constraints + available tools, no step order prescribed
   - AUTONOMOUS: goal statement only, full tool access
2. **Preserve verification as a separate concern.** Even if planning is simplified (fewer agents), keep the plan verifier as a separate validation step. It can be integrated into the plan-set flow without being a separate agent spawn -- just run the verification checks inline after planning completes. The verification LOGIC matters more than the verification AGENT.
3. **Edge case escape hatches.** In scripted prompts, add an explicit "If the situation does not match the expected pattern" clause that grants the agent permission to reason about the situation and choose an alternative approach. This prevents the "report BLOCKED because the script does not cover this case" failure mode.
4. **Test at boundaries.** Specifically test the handoff between scripted and autonomous agents: does the autonomous agent have enough context from the scripted caller? Does the scripted caller handle the autonomous agent's variable return format?

**Warning signs:**
- Planning producing plans that are later discovered to be infeasible during execution (verification gap)
- Agents reporting BLOCKED for situations they should be able to handle (over-constraint)
- Agents making architectural decisions autonomously that should require human approval (under-constraint)
- Orchestrator skills growing longer as edge cases are added to the script (script bloat indicates the scripted model is wrong for that agent)

**Phase to address:**
Must be decided during architecture/prompt design phase, before any agent prompts are written. The autonomy level per agent is a design decision, not an implementation detail.

---

## Moderate Pitfalls

### Pitfall 8: Hybrid Agent Build Creating Inconsistent Agent Quality

**What goes wrong:**
The v3.0 plan includes "Hybrid agent build (core hand-written, repetitive generated)." The build-agents pipeline generates agent files from role modules + core modules. The hybrid approach means some agents are hand-crafted (presumably the complex ones: orchestrator, merger, reviewer) while others are generated (research agents, executor, simple single-purpose agents).

The risk: hand-written agents get iterative refinement and edge case handling. Generated agents get cookie-cutter prompts that work for the common case but fail on edge cases. Over time, hand-written agents improve while generated agents stagnate, creating a two-tier quality problem.

Specifically, if the hand-written orchestrator agent handles RAPID:RETURN parsing with sophisticated fallback logic (try JSON parse, try regex extraction, try partial parse), but the generated agents assume RAPID:RETURN is always well-formed, the orchestrator's robustness creates a false sense of system reliability -- the orchestrator handles failures gracefully, but the failures originate from generated agents that lack robustness.

**How to avoid:**
1. **Core modules carry the quality.** The shared core modules (`core-returns.md`, `core-state-access.md`, `core-identity.md`, `core-git.md`, `core-context-loading.md`) should encode all the robust patterns (RAPID:RETURN parsing, error handling, state access). Generated agents inherit quality from core modules, not from their role-specific content.
2. **Quality parity test.** After building, compare a hand-written agent and a generated agent on the same dimensions: Does it handle RAPID:RETURN parsing? Does it handle CLI failures? Does it handle unexpected state? If the generated agent lacks any capability the hand-written one has, the gap is in the core modules.
3. **Maximize core, minimize role-specific.** The split should be 70-80% core content (shared across all agents) and 20-30% role-specific content. If generated agents are mostly core content, their quality is inherently close to hand-written agents.

**Warning signs:**
- Generated agents failing on edge cases that hand-written agents handle
- Core modules growing to accommodate hand-written agent needs without being tested in generated agents
- Generated agent files that are significantly shorter than hand-written agents (indicating missing robustness patterns)

**Phase to address:**
Agent build pipeline phase. Define which patterns go in core modules vs role modules before implementing the build.

---

### Pitfall 9: Command Surface Confusion During Migration

**What goes wrong:**
The v3.0 plan specifies new commands: `/init`, `/start-set`, `/discuss-set`, `/plan-set`, `/execute-set`, `/review`, `/merge` plus auxiliary `/new-version`, `/add-set`, `/quick`, `/status`, `/install`. The current system has: `/rapid:init`, `/rapid:set-init`, `/rapid:discuss`, `/rapid:wave-plan`, `/rapid:plan-set`, `/rapid:execute`, `/rapid:review`, `/rapid:merge`, `/rapid:status`, `/rapid:cleanup`, `/rapid:new-milestone`, `/rapid:pause`, `/rapid:resume`, `/rapid:install`, `/rapid:help`, `/rapid:context`, `/rapid:assumptions`.

The transition involves renaming commands, removing commands, and adding commands simultaneously. During the transition:

1. **Documentation references old commands.** SKILL.md files reference other commands by name (e.g., plan-set SKILL.md says "Re-run: /rapid:plan-set"). If commands are renamed, these cross-references break.
2. **User muscle memory.** Users (and agents reading CLAUDE.md) will invoke old command names. If old names are not aliased or produce helpful errors, users experience "command not found" frustration.
3. **Partial migration.** If some commands are migrated to v3.0 format while others remain in v2.x format, the command namespace is inconsistent. Running `/rapid:plan-set` (v3.0) then `/rapid:wave-plan` (v2.x, still exists) produces confusing behavior.

**How to avoid:**
1. **Rename all commands in a single phase.** Do not gradually rename -- do a clean cut. All old skills get removed/archived, all new skills get created.
2. **Alias old names for one version.** Create stub skills for deprecated commands that display: "This command has been renamed to /rapid:xxx. Please use /rapid:xxx instead." This gives users a migration path.
3. **Update all cross-references in the same commit.** Use grep to find all `/rapid:` references in SKILL.md files and update them atomically.
4. **CLAUDE.md must list the current command set.** The generated CLAUDE.md for target projects must reflect the v3.0 command names, not the v2.x names.

**Warning signs:**
- Users invoking deprecated commands and getting confusing errors
- SKILL.md files suggesting "next step: /rapid:wave-plan" when that command no longer exists
- Help command listing a mix of old and new command names

**Phase to address:**
Command restructuring phase. Should be one of the last phases to minimize churn in cross-references.

---

### Pitfall 10: 5th Researcher Agent Creating Init Pipeline Bottleneck

**What goes wrong:**
The v3.0 plan adds a "5th researcher (Domain/UX) in init research pipeline." The current init spawns 4 research agents in parallel (stack, features, architecture, pitfalls) plus a synthesizer. Adding a 5th increases parallelism by 25% -- which means 25% more subagent overhead (each subagent costs ~20K tokens of overhead), 25% more results to synthesize, and a longer wait for the slowest researcher.

The synthesizer agent already receives 4 research reports and produces a unified summary. Adding a 5th report increases the synthesizer's input context. If the 4-report synthesizer is already at 80% of its context budget, the 5th report pushes it over, causing quality degradation or context compaction.

**How to avoid:**
1. **Measure synthesizer context before adding.** Calculate current synthesizer input: 4 reports * average report tokens. If the total exceeds 60% of the synthesizer's available context (200K - 20K overhead = 180K, so 108K threshold), the 5th report will cause problems.
2. **Summarize before synthesizing.** Each research agent produces a summary section at the top of its report. Pass only the summary sections to the synthesizer, not the full reports. Full reports go to disk for reference.
3. **Consider merging instead of adding.** Instead of a 5th "Domain/UX" researcher, expand the features researcher to cover UX research. This avoids the extra subagent overhead and synthesizer burden.

**Warning signs:**
- Synthesizer producing shallower summaries than v2.x (less detail per area because it is spreading attention across more inputs)
- Init taking noticeably longer due to slower subagent completion
- Synthesizer report missing insights from one of the 5 research areas (context overflow causing information loss)

**Phase to address:**
Init pipeline phase. Measure before adding.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Remove locks without replacing concurrency protection | Simpler code, fewer dependencies | STATE.json corruption when orchestrator + subagent write simultaneously | Never -- concurrent writes remain possible with subagent architecture |
| Embed full YAML tool docs in all agents | Every agent knows every command | Context bloat, instruction dilution, maintenance burden (update docs in 31 places) | Only if per-agent docs are <500 tokens |
| Skip contract validation after planning | Faster plan-to-execute transition | Infeasible plans discovered during execution, 10x more expensive to fix | Never -- validation is cheap, execution mistakes are expensive |
| Convert all prompts to XML in one pass | Consistent format immediately | No baseline comparison, bugs from format change indistinguishable from content bugs | Never -- batch conversion prevents regression detection |
| Remove wave-level discuss without replacement | Simpler flow, fewer user interactions | Gray areas surface during execution, causing BLOCKED agents and wasted context | Only if discuss questions are folded into plan-set |
| Flatten state hierarchy completely | Simpler state model | Lose re-entry, progress tracking, and derived status | Only if checkpoint commits replace status-based re-entry |

## Integration Gotchas

Common mistakes when the rewritten orchestration interfaces with existing subsystems.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Orchestration -> Review pipeline | Changing set status names without updating review SKILL.md preconditions | Map old status names to new in a compatibility layer; update review in the same phase |
| Orchestration -> Merge pipeline | Changing CLI output schemas without updating merge SKILL.md parsing | Version CLI output schemas; merge SKILL.md validates against expected schema version |
| Plan-set -> Executor | Collapsing job plans into set-level plans without preserving per-task granularity | Executor needs task-level boundaries for atomic commits; set-level plan must have clear task demarcation |
| New XML prompts -> Build pipeline | Build pipeline naively concatenates role + core modules without XML wrapper handling | Build pipeline must validate XML structure of concatenated output; test with XML parser |
| Contract system -> No gating | Contracts created but never validated before execution | Add contract validation as a step WITHIN plan-set, not as a gate BETWEEN plan-set and execute-set |
| Simplified state -> /rapid:status | Status command shows less information due to flatter state model | Derive display information from git history (commits, branches) to compensate for less state data |

## Performance Traps

Patterns that work at small scale but fail as RAPID usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| YAML docs duplicated in 31 agent files | Works fine initially | Agent maintenance requires updating YAML in every agent file; one missed update means one agent has stale docs | When CLI commands change (expected every milestone) |
| Inline BFS leveling in SKILL.md | Works for 3-5 waves | Node -e inline scripts with JSON stringification fail on large input (shell argument length limit ~128KB) | Sets with 10+ waves and complex dependency graphs |
| Context-based result accumulation | Works for 2-3 sets | Orchestrator context grows linearly with sets; quality degrades after set 5-6 | Projects with 6+ sets (the common case for team development) |
| Agent-per-concern review model | Works for small codebases | Token cost scales with codebase size * number of concerns; review cost can exceed execution cost | Codebases >50K LOC being reviewed with 5+ concern categories |

## UX Pitfalls

Common user experience mistakes during framework rewrite.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Changing command names without aliases | Users get "command not found" errors for commands they used yesterday | Stub old commands with "renamed to X" messages for one version |
| Removing progress granularity from /rapid:status | Users cannot tell if a set is 20% or 80% done -- only "executing" | Derive progress from git commit count / expected task count even if state model is simplified |
| Embedding YAML docs makes agent responses start slower | Users perceive slowdown even though total time is similar | Front-load role identity and purpose, put YAML reference at the end of the prompt |
| XML-formatted prompts change agent personality | Agents become more robotic and less adaptive (XML implies structure, model responds structurally) | Keep conversational guidance in Markdown within XML sections; use XML for structure, not for tone |
| Removing discuss phase removes user input opportunity | Users discover during execution that the plan does not match their intent | Fold discuss questions into the planning flow; planning should START with user intent validation |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **State machine simplification:** Looks done when tests pass with new schema -- verify crash recovery still works by killing a command mid-execution and re-running
- [ ] **XML prompt conversion:** Looks done when agents produce correct output -- verify agents handle edge cases (unusual git states, missing files, corrupted state) by testing with intentionally broken inputs
- [ ] **Contract system without gating:** Looks done when contracts are created during planning -- verify contracts are VALIDATED at execution start, not just created
- [ ] **YAML tool docs embedded:** Looks done when agents call correct CLI commands -- verify agent token budget: is the YAML eating >10% of the prompt? Is the agent producing shallower analysis?
- [ ] **Command surface migration:** Looks done when new commands work -- verify all SKILL.md cross-references, CLAUDE.md command lists, and help output reference new names
- [ ] **Removal of wave-plan/job-plan:** Looks done when plan-set produces a plan -- verify the plan has per-task granularity sufficient for atomic commits and re-entry
- [ ] **Removal of set gating:** Looks done when sets can execute independently -- verify that sets with cross-dependencies do not execute against draft contracts
- [ ] **Review pipeline unchanged:** Looks done because review SKILL.md was not modified -- verify review preconditions still match the new state model's status values
- [ ] **Merge pipeline unchanged:** Looks done because merge SKILL.md was not modified -- verify merge CLI command output schemas have not changed and parsing still works
- [ ] **Build pipeline handles XML:** Looks done when build produces agent files -- verify the XML structure is valid (open/close tags balanced, no unescaped special characters in content)

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Broken review/merge pipeline (Pitfall 1) | HIGH | Identify which orchestration change broke the downstream pipeline via git bisect; revert the breaking change; add an integration test before re-attempting the change |
| Removed "redundant" functionality (Pitfall 2) | MEDIUM-HIGH | Restore the removed code from git history; add a comment explaining WHY it exists; create a test that exercises the edge case the code handles |
| Context bloat from YAML docs (Pitfall 3) | LOW | Trim YAML per agent to essential commands only; switch to ultra-compact single-line format; move reference docs to disk |
| Inconsistent XML formatting (Pitfall 4) | MEDIUM | Create the XML schema document; run a consistency check across all agent files; batch-fix inconsistencies; add schema validation to build pipeline |
| Lost crash recovery (Pitfall 5) | HIGH | Re-implement detectCorruption/recoverFromGit if removed; add checkpoint commits if status-based re-entry is lost; test with kill-and-resume scenarios |
| Unenforced contracts (Pitfall 6) | HIGH | Add validation steps to plan-set and execute-set flows; retrofit contract checking; audit existing plans for contract violations that slipped through |
| Agent autonomy miscalibration (Pitfall 7) | MEDIUM | Adjust prompt constraints per agent based on observed failure patterns; add verification steps where agents are too free; add escape hatches where agents are too constrained |
| Command confusion (Pitfall 9) | LOW | Create alias stubs for old commands; update all cross-references; send migration guide to users |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Accidental regression (Pitfall 1) | Every phase -- blast radius check | Run full workflow (plan->execute->review->merge) after each phase completes |
| Simplification amnesia (Pitfall 2) | Removal phases come AFTER replacement phases | For each removed mechanism, verify its edge case is handled by the replacement |
| YAML context bloat (Pitfall 3) | Tool documentation embedding phase | Per-agent token budget check: no agent's YAML > 1,000 tokens |
| XML inconsistency (Pitfall 4) | Prompt formatting phase -- schema document first | Build pipeline validates XML structure; consistency check across all agents |
| Lost crash recovery (Pitfall 5) | State simplification phase | Kill-and-resume test for all 7 primary commands |
| Unenforced contracts (Pitfall 6) | Contract system phase | Test: does a set with a contract violation get caught before merge? |
| Agent autonomy (Pitfall 7) | Architecture/prompt design phase | Test agents with edge cases outside their scripted paths |
| Hybrid build quality (Pitfall 8) | Agent build pipeline phase | Generated agents pass the same quality tests as hand-written agents |
| Command confusion (Pitfall 9) | Command restructuring phase (late) | All cross-references updated; old commands produce helpful redirect messages |
| Init pipeline bottleneck (Pitfall 10) | Init pipeline phase | Synthesizer context usage stays under 60% with 5 reports |

## Sources

- **Direct codebase analysis:** `src/lib/state-machine.cjs` (462 lines -- crash recovery, atomic writes, hierarchical status derivation), `src/lib/state-transitions.cjs` (74 lines -- set/wave/job transitions), `src/lib/lock.cjs` (88 lines -- mutex with proper-lockfile), `src/lib/contract.cjs` (415 lines -- contract validation, manifest, ownership), `src/lib/wave-planning.cjs` (230 lines -- wave resolution, context writing, job plan validation)
- **Skill analysis:** `skills/plan-set/SKILL.md` (605 lines -- full planning pipeline with wave analyzer, researcher, planner, verifier, validator), `skills/merge/SKILL.md` (611 lines -- full merge pipeline with subagent delegation), 31 role modules in `src/modules/roles/` totaling 3,433 lines
- **RAPID retrospective:** `.planning/RETROSPECTIVE.md` -- "Clean breaks beat migration paths"; "Selective reuse accelerates major rewrites"; "Agent roles should be leaf-only"
- **RAPID deep analysis:** `.planning/research/DEEP-ANALYSIS.md` -- patterns from GSD and PAUL agent systems, anti-patterns including monolithic prompts and filesystem-as-database
- **Anthropic guidance:** [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) -- "Incorrect assumptions about what's under the hood are a common source of customer error"; simplicity principle; workflow vs agent distinction
- **Anthropic context engineering:** [Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) -- context rot, prompt budgeting (5-10% for system prompt), instruction dilution, compaction strategies
- **Anthropic prompt engineering:** [Use XML Tags to Structure Your Prompts](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/use-xml-tags) -- XML tags for section boundaries, not as complete format replacement
- **GitHub engineering:** [Multi-agent workflows often fail](https://github.blog/ai-and-ml/generative-ai/multi-agent-workflows-often-fail-heres-how-to-engineer-ones-that-dont/) -- typed schemas, action schemas, treat agents like distributed systems, design for failure first
- **Multi-agent failure research:** [Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/html/2503.13657v1) -- cascading errors, coordination overhead, simplification risks
- **Augment Code:** [Why Multi-Agent LLM Systems Fail](https://www.augmentcode.com/guides/why-multi-agent-llm-systems-fail-and-how-to-fix-them) -- error propagation, agent scaling tradeoffs
- **Agent autonomy research:** [Balancing Autonomy and Alignment](https://arxiv.org/pdf/2310.03659) -- multi-dimensional taxonomy for autonomous LLM agents
- **State machine research:** [State Machines Simplified](https://pages.temporal.io/download-state-machines-simplified.html) (Temporal) -- automatic checkpointing, crash recovery, progress persistence
- **Context bloat research:** [Why Long System Prompts Hurt Context Windows](https://medium.com/data-science-collective/why-long-system-prompts-hurt-context-windows-and-how-to-fix-it-7a3696e1cdf9) -- instruction dilution, primacy/recency effects, token cost scaling
- **Interface contract design:** [AI Interface Design: Contracts That Cut Agent Bugs](https://www.syntaxia.com/post/ai-interface-design-contracts-that-cut-agent-bugs) -- schemas, conditions, failure modes as three pillars

---
*Pitfalls research for: RAPID v3.0 Refresh -- surgical orchestration rewrite, planning simplification, XML prompts, embedded tool docs, state simplification, contract redesign*
*Researched: 2026-03-12*
