# CONTEXT: context-optimization

**Set:** context-optimization
**Generated:** 2026-03-16
**Mode:** interactive

<domain>
## Set Boundary
Introduces a context optimization system that reduces prompt injection size during multi-wave execution. When RAPID executes multiple waves, accumulated artifacts (plans, contracts, handoffs, review outputs) grow unboundedly in the assembled prompt. This set implements a "digest-first" strategy: producing agents write compact summaries alongside full artifacts, and the prompt assembler reads digests instead of full content for completed waves. Does NOT fight Claude Code's built-in adaptive compaction -- works upstream to reduce what gets injected in the first place.
</domain>

<decisions>
## Implementation Decisions

### Compaction Granularity
- Type-aware compaction with moderate fidelity
- Completed wave artifacts get 5-10 line digests (including implementation approach, not just file paths)
- Active wave content is fully exempt from compaction -- always injected verbatim
- Small artifacts (CONTRACT.json, small configs) stay verbatim, no digest needed
- Plans get heavy summarization; contracts stay verbatim; handoffs keep key decisions + file paths

### Budget Triggers & Thresholds
- Digest-based approach: agents that produce large artifacts (plans, wave summaries, handoffs) also produce a sibling `-DIGEST.md` file
- `compactContext()` reads pre-written digests rather than computing summaries from full artifacts
- Missing digest fallback: include full content (no algorithmic extraction needed)
- A hook system reminds agents to produce digests for large files
- Budget target: ~120k tokens (hardcoded, using existing 4-chars-per-token heuristic)
- Compaction is effectively "always on" for completed waves -- prompt assembler checks for digests and uses them when available

### Integration Surface
- Modify `assembleExecutorPrompt()` in execute.cjs directly to check for `-DIGEST.md` siblings for completed wave artifacts
- Leave `generateScopedClaudeMd()` in worktree.cjs untouched (written once at worktree creation, not a hot path)
- Bake digest production instructions into agent role modules (executor, planner) rather than injecting via skill prompt suffixes
- New `src/lib/compaction.cjs` module provides `compactContext()` utility called by assembleExecutorPrompt()

### Hook Registry Design
- Global singleton registry (one for the whole process, not per-set)
- Both verification hooks (validate digests exist post-execution) and prompt hooks (inject "produce a digest" reminders into agent prompts)
- Hardcoded lifecycle events only: wave-complete, pause, review-stage-complete
- No custom/extensible events -- keep it simple
</decisions>

<specifics>
## Specific Ideas
- Each agent responsible for large files should be reminded via hook to produce a `-DIGEST.md` sibling
- Digest naming convention: `PLAN-DIGEST.md`, `WAVE-SUMMARY-DIGEST.md`, `HANDOFF-DIGEST.md` (sibling files alongside originals)
- The compaction.cjs module is primarily a digest reader + prompt assembler helper, not a summarization engine
</specifics>

<code_context>
## Existing Code Insights
- `assembleExecutorPrompt()` in execute.cjs (line 68) is the main integration point -- calls `prepareSetContext()` which gathers full artifacts
- `generateScopedClaudeMd()` in worktree.cjs (line 661) builds scoped CLAUDE.md -- leave untouched
- Token estimation: 4-chars-per-token heuristic already used in merge.cjs and build-agents.cjs
- `generateHandoff()` in execute.cjs (line 327) already produces structured YAML+Markdown -- good candidate for digest production
- `parseHandoff()` in execute.cjs (line 371) shows pattern for structured Markdown parsing
- HANDOFF.md already has compact frontmatter with task counts, decisions -- partial digest exists
- Review pipeline produces split artifacts (REVIEW-SCOPE.md, REVIEW-UNIT.md, etc.) enabling per-stage compaction
</code_context>

<deferred>
## Deferred Ideas
- AI-powered summarization as an optional enhancement over agent-produced digests (future version)
- Configurable budget target via env var or STATE.json (hardcoded for now)
- Per-set hook configuration (global singleton sufficient for current needs)
- Compaction metrics/reporting (how much context was saved per assembly)
</deferred>
