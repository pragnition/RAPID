# CONTEXT: memory-system

**Set:** memory-system
**Generated:** 2026-03-17
**Mode:** interactive

<domain>
## Set Boundary
Persistent JSONL-based decision and correction logging for RAPID. Introduces `.planning/memory/DECISIONS.jsonl` and `.planning/memory/CORRECTIONS.jsonl` as append-only logs, a core `src/lib/memory.cjs` module with append/query/buildMemoryContext functions, CLI commands via `src/commands/memory.cjs`, and integration into `prepareSetContext()` in `execute.cjs` for agent prompt injection. Fully independent set with no imports.
</domain>

<decisions>
## Implementation Decisions

### Decision Categorization

- Use a **predefined enum** of categories (e.g., 'architecture', 'integration', 'ux', 'performance', 'convention'). This enables reliable filtering and prevents category sprawl across milestones.
- Each decision entry **auto-tags with the originating set ID** via a `setId` field. This enables set-scoped queries downstream.

### Superseded Decision Handling

- Use **latest-wins per topic**: group decisions by category + topic key, surface only the most recent entry per topic. Simple and predictable conflict resolution.
- Superseded decisions should be **annotated as `[superseded]`** in the output rather than silently dropped, so agents can see the evolution of decisions when needed.

### Token Budget Strategy

- **70/30 split** between decisions (70%) and corrections (30%). Decisions are more broadly useful; corrections are typically set-scoped and shorter-lived.
- **Recency-first truncation**: when entries exceed the allocated budget, keep most recent entries and drop oldest first. Favors current project state.
- Default budget remains 8000 tokens as specified in CONTRACT.json.

### Memory Injection Scope

- Inject memory context into **planner and executor agents only**. Reviewer, merger, and other agents stay focused on their specific tasks without historical decision noise.
- **Set-relevant filtering**: prioritize decisions from the current set and its dependencies first, then fill remaining budget with global decisions.

### Claude's Discretion

- Entry schema details (exact JSONL field names, timestamp format, ID generation)
- Topic key extraction strategy for latest-wins dedup
- CLI command argument parsing and output formatting
- Error handling for malformed JSONL entries
- Test structure and coverage specifics
</decisions>

<specifics>
## Specific Ideas
- Reuse `estimateTokens()` from `tool-docs.cjs` for consistent token estimation
- Follow existing CommonJS patterns in `src/lib/` (no new dependencies)
- Lazy init of `.planning/memory/` directory on first write, consistent with project conventions
- Single `fs.appendFileSync` per write for POSIX atomicity on lines under pipe buffer size
</specifics>

<code_context>
## Existing Code Insights

- `prepareSetContext(cwd, setName)` in `src/lib/execute.cjs` (line 40) returns `{ scopedMd, definition, contractStr, setName }` -- memory context injection extends this return value
- `estimateTokens(text)` in `src/lib/tool-docs.cjs` (line 165) provides `Math.ceil(text.length / 4)` heuristic -- reuse for budget enforcement
- CLI router in `src/bin/rapid-tools.cjs` uses a require-and-dispatch pattern (e.g., `handleState`, `handleExecute`) -- `handleMemory` follows same pattern
- Command handlers live in `src/commands/*.cjs`, lib modules in `src/lib/*.cjs`, tests colocated as `*.test.cjs`
- `assembleExecutorPrompt()` calls `prepareSetContext()` -- this is the hook point for injecting memory context into planner/executor prompts
</code_context>

<deferred>
## Deferred Ideas
- Automatic decision capture from discuss-set conversations (could be added in a future set)
- Memory search/semantic query beyond category/set filtering
- Memory export/import for cross-project decision sharing
</deferred>
