# SET-OVERVIEW: memory-system

## Approach

The memory system introduces persistent, append-only decision and correction logging to RAPID so that agents retain cross-session and cross-milestone awareness of user preferences, architectural decisions, and mid-execution scope changes. Today, user decisions from discuss-set are captured in CONTEXT.md but mid-execution changes are lost entirely, and no structured history survives across milestones. This set addresses that gap with a lightweight JSONL-based persistence layer.

The core deliverable is a new `src/lib/memory.cjs` module that owns all reads and writes to `.planning/memory/`. It provides append functions for two log types (DECISIONS.jsonl and CORRECTIONS.jsonl), query functions with filtering, and a `buildMemoryContext()` function that produces a token-budgeted summary string suitable for injection into agent prompts. The module follows the project's existing patterns: CommonJS, no new dependencies, lazy directory initialization, and integration through the CLI layer (`rapid-tools.cjs memory ...` commands).

The implementation sequence is: (1) establish the data model and core append/query library, (2) wire CLI commands and integrate memory context injection into the existing `prepareSetContext()` pipeline in `execute.cjs`, (3) harden with tests covering append-only invariants, token budgets, lazy init, and edge cases. The set is fully independent -- no imports from other sets -- and serves as a foundation that downstream sets (code-quality, quick-and-addset) can consume.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/memory.cjs` | Core memory module: append, query, buildMemoryContext | New |
| `src/lib/memory.test.cjs` | Unit tests for memory module | New |
| `src/commands/memory.cjs` | CLI command handler for `memory log-decision`, `memory log-correction`, `memory query` | New |
| `src/bin/rapid-tools.cjs` | Register `memory` command group in CLI router | Existing (modify) |
| `src/lib/execute.cjs` | Extend `prepareSetContext()` to include memory context | Existing (modify) |
| `.planning/memory/DECISIONS.jsonl` | Append-only decision log (created at runtime) | New (runtime) |
| `.planning/memory/CORRECTIONS.jsonl` | Append-only corrections log (created at runtime) | New (runtime) |

## Integration Points

- **Exports:**
  - `appendDecision(cwd, entry)` -- append a decision record to DECISIONS.jsonl
  - `appendCorrection(cwd, entry)` -- append a mid-execution correction to CORRECTIONS.jsonl
  - `queryDecisions(cwd, filters?)` -- query decision log with optional category/milestone/limit filters
  - `queryCorrections(cwd, filters?)` -- query correction log with optional affectedSet/limit filters
  - `buildMemoryContext(cwd, setName, tokenBudget?)` -- produce a token-budgeted memory digest string for prompt injection
  - CLI: `rapid-tools memory log-decision`, `memory log-correction`, `memory query [--category <c>] [--limit <n>]`

- **Imports:** None. This set is fully independent.

- **Side Effects:**
  - Creates `.planning/memory/` directory on first write (lazy init, never eagerly)
  - JSONL files grow monotonically (append-only, entries never modified or deleted)
  - `buildMemoryContext` output is capped at the provided token budget (default 8000 tokens) to avoid context window bloat

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Memory context bloat degrades agent performance when JSONL grows large | High | `buildMemoryContext` enforces a strict token budget (default 8000); uses recency-based truncation and category filtering to keep output lean |
| Superseded decisions confuse agents (old decision contradicts newer one) | Medium | Include timestamps in all entries; `buildMemoryContext` presents latest decision per category/topic, filtering out superseded entries |
| Concurrent appends from parallel agents corrupt JSONL | Medium | Each append is a single `fs.appendFileSync` call writing one complete line -- atomic on POSIX for lines under the pipe buffer size (4KB); no locking needed for append-only JSONL |
| Token estimation drift causes budget overruns | Low | Use the existing `estimateTokens()` from `tool-docs.cjs` for consistent estimation; add test asserting output stays within budget |
| Backward compatibility with projects lacking `.planning/memory/` | Low | Lazy init means the directory is only created on first write; all read/query functions return empty results gracefully when files do not exist |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- `memory.cjs` core module with JSONL append/query functions, entry schemas (DecisionEntry, CorrectionEntry), lazy directory initialization, and comprehensive unit tests covering append-only invariant, empty-state reads, and filtering
- **Wave 2:** Integration -- CLI command handler (`src/commands/memory.cjs`), CLI router wiring in `rapid-tools.cjs`, `buildMemoryContext()` with token budgeting, modification of `prepareSetContext()` in `execute.cjs` to inject memory context, and integration tests
- **Wave 3:** Polish -- edge case hardening (large JSONL files, malformed entries, concurrent access), superseded-decision filtering logic in `buildMemoryContext`, and end-to-end verification

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
