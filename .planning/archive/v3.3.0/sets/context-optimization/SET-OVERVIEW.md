# SET-OVERVIEW: context-optimization

## Approach

The context-optimization set addresses a fundamental operational constraint: during multi-wave set execution, the working context window grows unboundedly as agents accumulate plan content, prior wave outputs, contracts, definitions, and review artifacts. This set introduces a compaction engine that can summarize completed work while preserving active state, plus a hook system that triggers compaction at key lifecycle transitions.

The research consensus (PITFALLS, ARCHITECTURE, UX -- 3 of 4 sources) is clear: building active custom compaction that fights Claude Code's built-in adaptive compaction is high-risk and should be avoided. Instead, this set focuses on a "lean generation + disk-first artifacts" strategy. The `compactContext()` function operates on structured context objects (plans, contracts, prior wave summaries) and produces shortened representations that preserve essential information. It does NOT interact with Claude Code's internal context management -- it works upstream, reducing what gets injected into prompts in the first place. The `registerCompactionTrigger()` hook system allows lifecycle events (wave completion, pause/resume, review stage transitions) to trigger compaction of no-longer-active artifacts.

The key architectural insight is that RAPID already writes most artifacts to disk (WAVE-COMPLETE.md, HANDOFF.md, REVIEW-*.md). Compaction means replacing full artifact content in the working prompt with a compact summary plus a disk reference, so agents can re-read the full content when needed. This is "write to disk, read from disk" -- not custom token management.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| src/lib/compaction.cjs | Core compaction engine -- `compactContext()` and `registerCompactionTrigger()` | New |
| src/lib/compaction.test.cjs | Unit tests for compaction logic, budget enforcement, recoverability | New |
| src/lib/execute.cjs | Integration point -- `assembleExecutorPrompt()` uses compacted context for resumed/multi-wave runs | Existing (modify) |
| src/lib/worktree.cjs | Integration point -- `generateScopedClaudeMd()` can emit leaner context when budget is constrained | Existing (modify) |

## Integration Points

- **Exports:**
  - `compactContext(context, options?)` -- Takes a structured context object (containing plan content, contract JSON, prior wave summaries, review artifacts) and returns a compacted version that stays within an optional token budget (~120k default). Completed waves are summarized to 2-3 lines; active wave content is preserved in full.
  - `registerCompactionTrigger(event, handler)` -- Registers a callback for lifecycle events (`wave-complete`, `pause`, `resume`, `review-stage-complete`) that triggers compaction of stale context segments.

- **Imports:**
  - From `review-pipeline`: Split review artifacts (REVIEW-SCOPE.md, REVIEW-UNIT.md, REVIEW-BUGS.md, REVIEW-UAT.md). Compaction can individually summarize each completed review stage rather than treating the review output as a monolithic blob. This granularity is only possible because the review pipeline decomposes its output into separate files.

- **Side Effects:** Compacted context retains disk references (file paths) to full artifacts. Agents operating on compacted context may issue additional file reads to recover detail. This is by design -- it trades a small read cost for significant context budget savings.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Custom compaction conflicts with Claude Code's built-in adaptive compaction, causing double-summarization | High | Do NOT implement active token management. Work upstream: reduce prompt injection size, not post-injection context. Compaction operates on RAPID's own structured artifacts before they enter the prompt. |
| Agent output quality degrades after compaction removes detail from prior wave context | High | Behavioral contract test: run executor with compacted vs full context on reference tasks; verify output equivalence. Always preserve active wave content uncompacted. |
| Token estimation is inaccurate, causing budget overruns or over-aggressive compaction | Medium | Use conservative 4-chars-per-token heuristic (already used in `merge.cjs` line 263 and `build-agents.cjs` line 181). Include 20% headroom in budget calculations. |
| Compacted summaries lose critical implementation decisions from prior waves | Medium | Compaction preserves: (1) file paths modified, (2) key decisions from HANDOFF.md, (3) contract compliance status. Full content always recoverable from disk. Enforce via `diskRecovery` behavioral contract test. |
| Review artifacts from review-pipeline may not exist yet if review-pipeline set is incomplete | Low | Graceful degradation: if REVIEW-*.md files are absent, compaction skips review artifact summarization. No hard dependency on review-pipeline completion. |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- `compaction.cjs` module with `compactContext()` core logic, token estimation utility, section-level summarization for plans/contracts/wave outputs. Unit tests for budget enforcement and disk recoverability.
- **Wave 2:** Trigger system -- `registerCompactionTrigger()` hook registry, integration with `execute.cjs` for multi-wave context assembly, integration with `worktree.cjs` for leaner scoped CLAUDE.md generation under budget pressure.
- **Wave 3:** Review artifact integration -- Granular compaction of individual REVIEW-*.md files from the review pipeline. End-to-end test verifying the full compaction lifecycle: multi-wave execution with progressive compaction.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
