# REVIEW-SCOPE: code-quality

<!-- SCOPE-META {"setId":"code-quality","date":"2026-03-18T07:15:00.000Z","postMerge":false,"worktreePath":".rapid-worktrees/code-quality","totalFiles":16,"useConcernScoping":true} -->

## Set Metadata
| Field | Value |
|-------|-------|
| Set ID | code-quality |
| Date | 2026-03-18T07:15:00.000Z |
| Post-Merge | false |
| Worktree Path | .rapid-worktrees/code-quality |
| Total Files | 16 |
| Concern Scoping | true |

## Changed Files
| File | Wave Attribution |
|------|-----------------|
| `.planning/sets/code-quality/WAVE-1-COMPLETE.md` | wave-1 |
| `.planning/sets/code-quality/WAVE-2-COMPLETE.md` | wave-2 |
| `.planning/sets/code-quality/WAVE-3-COMPLETE.md` | wave-3 |
| `.planning/sets/code-quality/wave-1-PLAN-DIGEST.md` | wave-1 |
| `.planning/sets/code-quality/wave-2-PLAN-DIGEST.md` | wave-2 |
| `.planning/sets/code-quality/wave-3-PLAN-DIGEST.md` | wave-3 |
| `src/lib/execute.cjs` | wave-3 |
| `src/lib/execute.test.cjs` | wave-3 |
| `src/lib/quality.cjs` | wave-2 |
| `src/lib/quality.test.cjs` | wave-2 |

## Dependent Files
| File |
|------|
| `src/commands/commands.test.cjs` |
| `src/commands/execute.cjs` |
| `src/commands/misc.cjs` |
| `src/lib/compaction.test.cjs` |
| `src/lib/merge.cjs` |
| `src/lib/review.cjs` |

## Directory Chunks
### Chunk 1: .planning/sets/code-quality
- `.planning/sets/code-quality/WAVE-1-COMPLETE.md`
- `.planning/sets/code-quality/WAVE-2-COMPLETE.md`
- `.planning/sets/code-quality/WAVE-3-COMPLETE.md`
- `.planning/sets/code-quality/wave-1-PLAN-DIGEST.md`
- `.planning/sets/code-quality/wave-2-PLAN-DIGEST.md`
- `.planning/sets/code-quality/wave-3-PLAN-DIGEST.md`

### Chunk 2: src/lib
- `src/lib/execute.cjs`
- `src/lib/execute.test.cjs`
- `src/lib/quality.cjs`
- `src/lib/quality.test.cjs`
- `src/lib/compaction.test.cjs`
- `src/lib/merge.cjs`
- `src/lib/review.cjs`

### Chunk 3: src/commands
- `src/commands/commands.test.cjs`
- `src/commands/execute.cjs`
- `src/commands/misc.cjs`

## Wave Attribution
| File | Wave |
|------|------|
| `.planning/sets/code-quality/WAVE-1-COMPLETE.md` | wave-1 |
| `.planning/sets/code-quality/WAVE-2-COMPLETE.md` | wave-2 |
| `.planning/sets/code-quality/WAVE-3-COMPLETE.md` | wave-3 |
| `.planning/sets/code-quality/wave-1-PLAN-DIGEST.md` | wave-1 |
| `.planning/sets/code-quality/wave-2-PLAN-DIGEST.md` | wave-2 |
| `.planning/sets/code-quality/wave-3-PLAN-DIGEST.md` | wave-3 |
| `src/lib/execute.cjs` | wave-3 |
| `src/lib/execute.test.cjs` | wave-3 |
| `src/lib/quality.cjs` | wave-2 |
| `src/lib/quality.test.cjs` | wave-2 |

## Concern Scoping

### Concern: quality-module
- `src/lib/quality.cjs`
- `src/lib/quality.test.cjs`
- `src/commands/misc.cjs` *(cross-cutting)*
- `src/commands/commands.test.cjs` *(cross-cutting)*
- `src/lib/compaction.test.cjs` *(cross-cutting)*

### Concern: execution-pipeline-integration
- `src/lib/execute.cjs`
- `src/lib/execute.test.cjs`
- `src/commands/execute.cjs`
- `src/commands/misc.cjs` *(cross-cutting)*
- `src/commands/commands.test.cjs` *(cross-cutting)*
- `src/lib/compaction.test.cjs` *(cross-cutting)*

### Concern: review-and-merge-pipeline
- `src/lib/review.cjs`
- `src/lib/merge.cjs`
- `src/commands/misc.cjs` *(cross-cutting)*
- `src/commands/commands.test.cjs` *(cross-cutting)*
- `src/lib/compaction.test.cjs` *(cross-cutting)*

### Concern: wave-planning-records
- `.planning/sets/code-quality/wave-1-PLAN-DIGEST.md`
- `.planning/sets/code-quality/wave-2-PLAN-DIGEST.md`
- `.planning/sets/code-quality/wave-3-PLAN-DIGEST.md`
- `.planning/sets/code-quality/WAVE-1-COMPLETE.md`
- `.planning/sets/code-quality/WAVE-2-COMPLETE.md`
- `.planning/sets/code-quality/WAVE-3-COMPLETE.md`

### Cross-Cutting Files
- `src/commands/misc.cjs` — Miscellaneous CLI command handlers serving multiple concerns
- `src/commands/commands.test.cjs` — Broad CliError throw-behavior tests for all command handlers
- `src/lib/compaction.test.cjs` — Tests for compaction module shared across execution and review pipelines

## Acceptance Criteria
1. [wave-1] loadQualityProfile() parses .planning/context/QUALITY.md into structured QualityProfile object
2. [wave-1] Stack-aware template generation produces sensible defaults when QUALITY.md is missing
3. [wave-2] buildQualityContext() produces token-budgeted markdown string for prompt injection (default 10k tokens)
4. [wave-2] checkQualityGates() performs advisory-only anti-pattern detection without blocking execution
5. [wave-2] Soft dependency on memory-system queryDecisions degrades gracefully when unavailable
6. [wave-3] Quality context injected into assembleExecutorPrompt() for plan+execute phases (not discuss)
7. [wave-3] enrichedPrepareSetContext wrapper created and functional
8. [wave-3] All existing execute.test.cjs tests pass as regression (135/135 total tests)
