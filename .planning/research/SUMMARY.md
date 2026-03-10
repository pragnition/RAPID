# Project Research Summary

**Project:** RAPID v2.2 — Subagent Merger & Documentation
**Domain:** Claude Code plugin — agentic merge pipeline restructuring + documentation rewrite
**Researched:** 2026-03-10
**Confidence:** HIGH

## Executive Summary

RAPID v2.2 restructures the monolithic merge orchestrator into a delegated subagent pipeline, following the proven dispatch-collect-decide pattern already shipping in the review pipeline. The core architectural problem is clear: the current merge SKILL.md accumulates detection reports, resolution results, and agent context for every set in a single context window, overflowing on large codebases (8+ sets). The solution is per-set merge subagent delegation where the orchestrator stays lean — it runs light CLI detection/resolution commands, dispatches an isolated rapid-set-merger agent per set, and discards all per-set context after collecting a compressed RAPID:RETURN summary (~100 tokens per set vs ~3K tokens). No new npm dependencies are required; this is entirely a prompt engineering and orchestration restructuring on top of the existing Node.js/Zod/CommonJS stack.

The single most important constraint shaping the entire v2.2 design is that Claude Code subagents cannot spawn sub-subagents. This is a hard platform constraint confirmed in official documentation (verified 2026-03-10, GitHub issue #4182). PROJECT.md's "adaptive nesting" goal — where merge agents spawn per-conflict sub-agents — must be reframed: the SKILL orchestrator acts as the sole dispatcher, spawning dedicated rapid-conflict-resolver agents when a merger returns escalations with mid-confidence scores (0.4–0.7). This achieves the same depth-of-analysis goal without violating the platform constraint. Attempting nested spawning causes either silent tool errors or RAM-exhausting infinite loops (GitHub issue #4850).

The documentation rewrite (README.md + technical_documentation.md) must come AFTER the merge pipeline work is stable. Writing docs against a moving target wastes effort and the current DOCS.md is already one full version behind (v2.0 content, missing all v2.1 and v2.2 features). Both documentation deliverables must maintain strict audience separation: README.md for human developers, CLAUDE.md for spawned agents, technical_documentation.md for power users. All implementation details should reference SKILL.md files as the authoritative source rather than duplicating content that becomes stale across version iterations.

## Key Findings

### Recommended Stack

No new npm dependencies are needed for v2.2. The existing stack — Node.js >=18, Zod 3.25.76 (CommonJS, do NOT upgrade to Zod 4.x which breaks CommonJS require()), proper-lockfile 4.1.2, ajv 8.17.1, git worktrees, and node:test — covers everything. All v2.2 changes are architectural: rewritten SKILL.md, new and modified agent role modules, 2–3 new helper functions in merge.cjs, and plain Markdown documentation files. The build-agents pipeline auto-generates `agents/rapid-set-merger.md` and `agents/rapid-conflict-resolver.md` from their role modules with no changes to the build pipeline itself.

**Core technologies:**
- Node.js >=18: runtime — unchanged; all subagent CLI invocations use existing rapid-tools.cjs
- Zod 3.25.76: schema validation — minor extension to MergeStateSchema for delegation tracking fields; all new fields optional with defaults for backward compatibility
- git (>=2.30): VCS and worktrees — no change; all git operations stay in orchestrator or CLI layer
- CommonJS: module format — no change; do not migrate to ESM
- node:test (built-in): testing — extend merge.test.cjs with tests for new helper functions

### Expected Features

**Must have (table stakes):**
- Per-set merge subagent spawning — orchestrator dispatches rapid-set-merger per set; core v2.2 requirement
- Structured result collection from merge subagents — parse RAPID:RETURN with default-unsafe fallback (missing return = BLOCKED, not success)
- Error propagation — BLOCKED / malformed / context-exhausted subagent returns surface to user with recovery options; distinguish subagent-level failures from merge-level conflicts
- Partial failure handling — one set's subagent failure must not block independent sets
- Idempotent re-entry — MERGE-STATE updated to 'resolving' BEFORE spawning, advanced AFTER return; restart skips completed sets
- Context assembly for subagents — minimal prompt (set name, unresolved conflict JSON, file paths); subagent reads CONTEXT.md and CONTRACT.json from disk
- Sequential-within-wave ordering preserved — subagent delegation changes WHO does work, not WHEN; wave ordering stays in orchestrator
- Accurate README.md reflecting v2.1 and v2.2 capabilities
- Working installation instructions and verified command reference table
- Quick start covering the full lifecycle (init -> plan -> set-init -> discuss -> wave-plan -> execute -> review -> merge -> cleanup)
- technical_documentation.md replacing DOCS.md (currently outdated at v2.0)

**Should have (competitive differentiators):**
- Adaptive nesting via orchestrator-mediated nesting — merger returns CHECKPOINT with escalation list; SKILL spawns rapid-conflict-resolver agents per conflict at confidence 0.4–0.7; direct human gate below 0.4
- Write-before-return pattern in merge subagents (write to MERGE-STATE.json on disk before emitting RAPID:RETURN as safety net for parse failures)
- Architecture diagram in README (ASCII art for terminal compatibility)
- Agent role reference in technical docs (all 29+ agents: purpose, spawned by, inputs, outputs)
- Troubleshooting guide for common failure modes
- Version changelog extracted from PROJECT.md into user-facing format

**Defer (post-v2.2):**
- Parallel independent set merging within a wave — high risk, requires temp branch strategy, DAG file-overlap analysis, and serialized git merge execution; marginal benefit since most waves have 2–3 sets
- Merge dry-run mode — stops pipeline after detection+resolution; implementable incrementally after core delegation is stable
- Conflict heat map display — pure display feature, zero risk, but defer until core delegation is working
- Interactive walkthrough / annotated session transcript — high value for onboarding, time-intensive to produce

### Architecture Approach

The merge pipeline restructures around the dispatch-collect-decide pattern: the SKILL orchestrator owns DAG ordering, wave sequencing, human decision gates, and MERGE-STATE updates. Everything computationally expensive (L5 semantic detection, T3 AI resolution, per-conflict deep analysis) is delegated to isolated subagent context windows. The key innovation is explicit context discard after each set completes within the wave loop — the orchestrator retains only a compressed one-line status entry per set (~100 tokens), not the full detection report and resolution details. Full details persist to MERGE-STATE.json on disk for recovery without consuming orchestrator context.

**Major components:**
1. merge SKILL.md (orchestrator) — DAG ordering, CLI-based L1-L4 detection and T1-T2 resolution, subagent dispatch, compressed result collection, human escalation gates, programmatic gate, merge execution, integration tests, bisection
2. rapid-set-merger agent (new) — per-set isolated worker; reads own CONTEXT.md and CONTRACT.json from disk; runs L5 semantic analysis and T3 resolution; returns structured RAPID:RETURN with escalations array; one instance per set, each in its own context window
3. rapid-conflict-resolver agent (new) — per-conflict focused resolver spawned by SKILL for mid-confidence escalations (0.4–0.7); receives single conflict context; returns resolution + confidence; Phase 2 only, optional — if no escalations, never triggered
4. merge.cjs library (extended) — add `prepareMergerContext()` (assembles minimal agent payload), `parseSetMergerReturn()` (Zod validates RAPID:RETURN schema), both tested in merge.test.cjs
5. MERGE-STATE.json schema (extended) — add agentPhase1/agentPhase2 tracking fields, detectionBase commit hash, detectionInvalidated flag; all fields optional with defaults for v2.1 backward compatibility

### Critical Pitfalls

1. **Orchestrator context overflow despite delegation ("summary accumulation trap")** — Delegating work to subagents only solves context overflow if the orchestrator also practices result compression. Full RAPID:RETURN payloads (~3K tokens each) accumulated across 8 sets hit 24K+ tokens before adding skill prompt overhead. Prevention: define a compressed result schema (~100 tokens/set); write full details to disk via MERGE-STATE.json; orchestrator reads disk when it needs history. Budget test before implementing.

2. **RAPID:RETURN parse failures causing silent bad merges** — Missing or malformed structured returns must default to BLOCKED, not success. Three failure modes: malformed JSON, missing return (context exhausted before emission), truncated return. Prevention: validate JSON parse + schema fields; independently verify git state after merge (`git diff --check` for conflict markers); retry once with reduced scope; write-before-return pattern in subagent role.

3. **"Adaptive nesting" violating Claude Code's subagent depth constraint** — Subagents cannot use the Agent tool. Attempting to give merger agents the ability to spawn sub-agents produces either silent tool errors or RAM-exhausting infinite loops (GitHub issue #4850). Prevention: merge subagents remain leaf agents; merger returns CHECKPOINT with conflict list; SKILL spawns rapid-conflict-resolver agents directly as Phase 2.

4. **DAG ordering bugs in parallel merge execution** — Parallel merge attempts on a single branch cause unexpected conflicts because each merge changes HEAD, and set B's detection may have run against a stale HEAD before set A merged. Prevention: parallel detection (read-only, safe) but sequential merge execution; replace `git merge --no-commit` dry run with `git merge-tree` plumbing command for safe parallel L1 detection.

5. **Stale detection on resumed merges** — When a set is skipped mid-wave and other sets continue merging, the skipped set's detection results are invalidated by subsequent merges. Prevention: mark `detectionInvalidated: true` in MERGE-STATE.json when sets merge after a paused set; enforce re-detection on resume; use `detectionBase` fence commit field.

6. **Documentation coupling to implementation details** — Architecture descriptions embedded in README become stale within weeks at RAPID's release cadence. Prevention: README describes WHAT (capabilities, concepts, workflow); SKILL.md files own HOW; technical_documentation.md references SKILL.md rather than duplicating it; version-tag all architecture descriptions ("As of v2.2...").

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: MERGE-STATE Schema and Infrastructure
**Rationale:** Schema changes must happen before any subagent delegation code. MergeStateSchema extensions with backward-compatible optional fields are a prerequisite for everything else, and the compressed result protocol must be designed here before the spawn logic is written. Doing this first also guarantees safe re-entry from day one.
**Delivers:** Extended MergeStateSchema (agentPhase1/agentPhase2 tracking, detectionBase, detectionInvalidated, schemaVersion); `prepareMergerContext()` and `parseSetMergerReturn()` helpers in merge.cjs; tests for both; backward compatibility verified against a v2.1-era MERGE-STATE.json; compressed result protocol token budget validated
**Addresses:** Idempotent re-entry (table stakes), schema infrastructure for all subsequent phases
**Avoids:** Schema drift breaking read/write pipeline (Pitfall 9); context accumulation trap (compressed protocol designed before spawn logic, not retrofitted)

### Phase 2: Core Merge Subagent Delegation
**Rationale:** This is the centerpiece of v2.2. Once infrastructure is in place, the SKILL.md rewrite and new rapid-set-merger role deliver the primary context-window savings. Error handling and partial failure support must ship with this phase, not as a follow-on — silent bad merges (Pitfall 2) are catastrophic on main branch.
**Delivers:** rapid-set-merger agent role (role-set-merger.md + generated agents/rapid-set-merger.md); merge SKILL.md rewritten with dispatch-collect-decide pattern; compressed result collection with default-unsafe RAPID:RETURN parsing; git state verification after each merge (`git diff --check`); partial failure handling; context discard after each set in wave loop; write-before-return pattern in agent role
**Addresses:** Per-set subagent spawning (P1 table stakes), structured result collection (P1), error propagation (P1), partial failure + idempotent re-entry (P1), context assembly (P1), sequential ordering preserved (P1)
**Avoids:** RAPID:RETURN parse failure silent bad merge (Pitfall 2), orchestrator context overflow (Pitfall 1), subagent depth violation — merger is leaf agent with no Agent tool (Pitfall 5)

### Phase 3: Adaptive Nesting (Orchestrator-Mediated Conflict Resolution)
**Rationale:** Depends on Phase 2 merge subagent pattern working end-to-end. Adds Phase 2 dispatch logic where the SKILL spawns rapid-conflict-resolver agents for mid-confidence escalations (0.4–0.7). The pipeline is correct without this phase — escalations go to human — making this a safe enhancement layer.
**Delivers:** rapid-conflict-resolver agent role (role-conflict-resolver.md + generated agents/rapid-conflict-resolver.md); Phase 2 dispatch logic in merge SKILL.md (spawn per-conflict agents for confidence 0.4–0.7, direct human gate for confidence <0.4 or API signature changes); MERGE-STATE agentPhase2 tracking populated
**Addresses:** Adaptive nesting differentiator (should-have)
**Avoids:** Subagent depth constraint violation — orchestrator dispatches conflict-resolvers, merger never does (Pitfall 5); Phase 2 for low-confidence conflicts that need human judgment (anti-pattern avoided by 0.4 threshold)

### Phase 4: Detection Invalidation and Resume Safety
**Rationale:** The error propagation gap (Pitfall 4) is moderate severity and must be addressed before the documentation phase — documenting a resume behavior that corrupts main branch would be worse than leaving it undocumented. Bisection fix also needs to land here so the documented recovery behavior is accurate.
**Delivers:** `detectionInvalidated` flag set when sets merge after a paused set; resume-aware re-detection when `detectionBase` differs from current main HEAD; fence commit tracking per set; commit-based bisection using `git revert` on individual merge commits instead of re-merge (prevents non-deterministic results from re-spawning AI agents)
**Addresses:** Partial failure handling (table stakes completion), error propagation gap, bisection reliability
**Avoids:** Stale detection on resumed merges (Pitfall 4), bisection producing different code than original merge (Pitfall 7)

### Phase 5: Documentation Rewrite
**Rationale:** Must come last, after all merge pipeline behavior is stable and verified. Documentation is lower-risk and can be written confidently once features are locked. Writing docs before implementation finalized creates immediate staleness and wasted effort.
**Delivers:** README.md full rewrite (150–250 lines; ASCII art architecture diagram; full lifecycle quick start; verified command reference table through v2.2); technical_documentation.md (800–1200 lines; all 29+ agents cataloged; troubleshooting section; version changelog; references SKILL.md for implementation details rather than duplicating them); DOCS.md deprecation notice
**Addresses:** README accuracy (table stakes), working installation instructions (table stakes), command reference (table stakes), technical documentation for power users (table stakes), agent role reference (should-have), troubleshooting guide (should-have)
**Avoids:** Documentation coupling to implementation details (Pitfall 6), wrong audience level mixing — README=humans, CLAUDE.md=agents, technical_docs=power users (Pitfall 13)

### Phase Ordering Rationale

- Schema and infrastructure first because all subagent delegation code depends on MERGE-STATE schema fields; retrofitting schema after delegation code is written risks production state file incompatibility
- Core delegation second because it is the highest-risk, highest-complexity work; validate it early while there is room to iterate without documentation debt
- Adaptive nesting third because it requires the core delegation pattern to be proven stable; it is an enhancement not a correctness requirement and can ship independently
- Resume safety and bisection fourth because these complete the error recovery surface; the pipeline should not be documented until its recovery behavior is correct and tested
- Documentation last because it must describe finalized behavior; this also gives time to discover edge cases in the merge pipeline through real usage before committing them to documentation

The FEATURES.md dependency graph confirms this ordering:
```
Per-set subagent spawning
  -> Schema infrastructure (Phase 1)
  -> Core delegation + error handling (Phase 2)
  -> Adaptive nesting (Phase 3, after Phase 2 proven)
  -> Resume safety (Phase 4, after Phase 2 proven)

Documentation (Phase 5)
  -> Requires all pipeline behavior to be final
```

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Core Delegation):** The compressed result protocol token budget should be validated empirically — estimate `(skill prompt tokens) + (100 tokens * N sets) + state tracking overhead < 50K` before committing to the schema design. Target an 8-set project as the stress test case.
- **Phase 4 (Detection Invalidation):** The `git merge-tree` plumbing command as a replacement for `git merge --no-commit` dry run in L1 detection needs investigation — verify it produces equivalent conflict detection output in CommonJS with `execFileSync` before committing to the implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Schema):** Zod schema extension with optional fields and backward compatibility is a well-understood pattern used throughout merge.cjs; no research needed
- **Phase 3 (Conflict Resolver):** New agent role follows identical pattern to existing leaf agents (current rapid-merger, rapid-scoper); role module template is established
- **Phase 5 (Documentation):** Plain Markdown documentation; no build tooling; established convention in the repo; review pipeline proved the agent catalog approach works for reference docs

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified via package.json; no new deps needed; Zod 4.x incompatibility confirmed; Claude Code subagent constraint confirmed via official docs and two GitHub issues |
| Features | HIGH | Based on direct codebase analysis of existing pipeline (merge SKILL.md 527 lines, review SKILL.md 934 lines); review pipeline proves the delegation pattern already works in RAPID |
| Architecture | HIGH | Dispatch-collect-decide pattern derived from existing review pipeline precedent; hard platform constraint (no nested subagents) verified in official docs; all architectural decisions grounded in existing RAPID codebase patterns |
| Pitfalls | HIGH | Based on direct codebase analysis (merge.cjs ~1200 LOC, dag.cjs 467 lines) plus official Claude Code docs; pitfalls are specific to RAPID's actual code paths, not generic |

**Overall confidence:** HIGH

### Gaps to Address

- **Compressed result protocol exact schema:** The research identifies the need for ~100-token per-set summaries but does not define the exact field names. Finalize the compressed schema during Phase 1 by budgeting orchestrator context for an 8-set project before writing any delegation code.
- **rapid-set-merger vs rapid-merger naming:** ARCHITECTURE.md suggests creating rapid-set-merger as a new agent and deprecating rapid-merger. STACK.md suggests rewriting role-merger.md in place. Resolve naming convention before Phase 2 to avoid confusion in the agent catalog and documentation.
- **`git merge-tree` output format compatibility:** If L1 parallel detection uses `git merge-tree` instead of `git merge --no-commit`, verify the output format matches what `detectTextualConflicts()` in merge.cjs expects. Address during Phase 4 planning.
- **Conflict-resolver confidence threshold calibration:** The 0.4–0.7 "ambiguous middle" range for Phase 2 dispatch is a design choice, not an empirically validated threshold. Monitor in production and adjust if the range results in too many or too few Phase 2 spawns.

## Sources

### Primary (HIGH confidence)
- [Claude Code Sub-Agents Official Documentation](https://code.claude.com/docs/en/sub-agents) — confirmed subagent depth constraint ("Subagents cannot spawn other subagents"), 20K token overhead per subagent, supported frontmatter fields; verified 2026-03-10
- [GitHub Issue #4182](https://github.com/anthropics/claude-code/issues/4182) — Sub-Agent Task Tool Not Exposed; confirms Agent tool excluded from subagent tool lists; closed as duplicate confirming this is by design
- [GitHub Issue #4850](https://github.com/anthropics/claude-code/issues/4850) — Agents spawning sub-agents causes endless loop and RAM OOM; documents the failure mode of attempting nested spawning
- Direct codebase analysis: `skills/merge/SKILL.md` (527 lines), `skills/review/SKILL.md` (934 lines), `src/lib/merge.cjs` (~1200 lines), `src/lib/dag.cjs` (467 lines), `agents/rapid-merger.md` (282 lines), `src/modules/roles/role-merger.md` (128 lines), `package.json`

### Secondary (MEDIUM confidence)
- [Anthropic Engineering: Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system) — orchestrator-worker pattern, result compression, "token usage explains 80% of variance in quality"
- [Microsoft: Orchestrator and Subagent Patterns](https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/architecture/multi-agent-orchestrator-sub-agent) — when to use orchestrator-subagent, anti-patterns, hierarchical dependency handling
- [Towards Data Science: 17x Error Trap in Multi-Agent Systems](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/) — error amplification, centralized coordination benefits
- [Claude Code Sub-Agent Best Practices](https://claudefa.st/blog/guide/agents/sub-agent-best-practices) — parallel vs sequential dispatch, invocation quality, error handling
- [Draft.dev: Documentation Best Practices for Developer Tools](https://draft.dev/learn/documentation-best-practices-for-developer-tools) — essential sections, README vs technical docs, accuracy, anti-patterns
- [Google ADK Multi-Agent Patterns](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/) — SequentialAgent, shared state management
- [OpenAI Agents SDK: Agent Orchestration](https://openai.github.io/openai-agents-python/multi_agent/) — agents-as-tools vs handoff patterns
- [Azure Architecture Center: AI Agent Orchestration Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) — supervisor pattern token cost analysis

### Tertiary (LOW confidence)
- [Claude Code Worktree Subagent Isolation](https://www.threads.com/@boris_cherny/post/DVAAnexgRUj) — confirms `isolation: worktree` frontmatter; Anthropic staff post but not official documentation
- [Claude Code Agent Teams Guide](https://claudefa.st/blog/guide/agents/agent-teams) — confirms Agent Teams not suitable for sequential merge pipeline; community resource

---
*Research completed: 2026-03-10*
*Ready for roadmap: yes*
