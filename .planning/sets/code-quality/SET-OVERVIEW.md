# SET-OVERVIEW: code-quality

## Approach

The code-quality set introduces a quality profile system that gives RAPID agents awareness of project-specific coding standards, approved patterns, and anti-patterns. Today, agents execute with knowledge of the set contract and memory context but have no structured way to enforce coding conventions or detect pattern violations. This set fills that gap by adding three capabilities: a quality profile loader, a token-budgeted context builder for prompt injection, and a non-destructive quality gate checker.

The implementation follows the same integration pattern established by the memory-system set: a standalone library module (`src/lib/quality.cjs`) that reads from `.planning/context/` artifacts (QUALITY.md, PATTERNS.md), exports functions consumed by `execute.cjs` during prompt assembly, and degrades gracefully when dependencies are unavailable. The quality context is injected alongside memory context in `assembleExecutorPrompt()`, extending the existing `prepareSetContext()` flow without modifying its return signature.

The soft dependency on memory-system's `queryDecisions` allows quality context to incorporate relevant past decisions (e.g., architecture or convention decisions) into the quality section. When memory-system is unavailable, the quality module operates with an empty decision history -- no errors, just reduced context richness.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/quality.cjs` | Core module: loadQualityProfile, buildQualityContext, checkQualityGates | New |
| `src/lib/quality.test.cjs` | Unit tests for quality module | New |
| `.planning/context/QUALITY.md` | Per-project quality profile (generated default or user-authored) | New (template) |
| `.planning/context/PATTERNS.md` | Approved implementation patterns library per language/framework | New (template) |
| `src/lib/execute.cjs` | Integration point: inject quality context into assembleExecutorPrompt | Existing (modify) |
| `src/lib/execute.test.cjs` | Extended tests for quality context injection | Existing (modify) |
| `src/commands/execute.cjs` | CLI wiring for quality-related prepare-context options | Existing (minor modify) |

## Integration Points

- **Exports:**
  - `loadQualityProfile(cwd)` -- Parses `.planning/context/QUALITY.md` into a structured QualityProfile object; generates a sensible default if the file is missing
  - `buildQualityContext(cwd, setName, tokenBudget?)` -- Builds a token-budgeted markdown string containing quality guidelines, approved patterns, and anti-patterns for prompt injection (default budget: 10000 tokens)
  - `checkQualityGates(cwd, setName, artifacts)` -- Scans agent output artifacts against quality profile rules, returns pass/fail with violation details; never blocks execution
  - `.planning/context/PATTERNS.md` -- Static artifact file containing curated pattern library
  - `enrichedPrepareSetContext` -- Enhanced version of prepareSetContext that appends quality + patterns sections to context output

- **Imports:**
  - `queryDecisions` from memory-system (`src/lib/memory.cjs`) -- Used to pull relevant convention/architecture decisions into quality context; soft dependency with graceful fallback to empty array

- **Side Effects:**
  - Creates `.planning/context/QUALITY.md` and `.planning/context/PATTERNS.md` on first load if they do not exist (lazy init, same pattern as memory-system's lazy directory creation)
  - Quality gate violations are logged as warnings to stderr but never modify agent output or block execution flow

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Token budget overflow when quality + memory + wave context combined | Medium | Respect compaction.cjs DEFAULT_BUDGET_TOKENS (120k); quality budget defaults to 10k; test that combined context stays within limits |
| QUALITY.md/PATTERNS.md format drift from expected structure | Medium | Define clear markdown heading conventions; parse with fallback sections; validate structure in loadQualityProfile with graceful degradation |
| Modifying execute.cjs assembleExecutorPrompt could break existing tests | High | Integration is additive only (new section appended); quality injection wrapped in try/catch like memory injection; run existing execute.test.cjs as regression |
| Soft dependency on memory-system queryDecisions signature changes | Low | Import is already wrapped in try/catch; contract specifies exact signature; test graceful degradation path explicitly |
| Quality gates producing false positives that erode trust | Medium | Gates are advisory-only (nonDestructive behavioral invariant); start with conservative pattern matching; include confidence scores in violation reports |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- Create `src/lib/quality.cjs` with `loadQualityProfile()` and default QUALITY.md/PATTERNS.md template generation; unit tests for profile loading and default generation
- **Wave 2:** Context building -- Implement `buildQualityContext()` with token budgeting and memory-system integration; implement `checkQualityGates()` with pattern/anti-pattern matching; unit tests for token limits and graceful degradation
- **Wave 3:** Integration -- Wire quality context into `execute.cjs` `assembleExecutorPrompt()` alongside existing memory context injection; implement `enrichedPrepareSetContext`; integration tests; verify existing execute tests pass

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
