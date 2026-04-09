# SET-OVERVIEW: bugfix-wave-splitting

## Approach

This set extends `/rapid:bug-fix` with a multi-agent wave-splitting capability so that large bug lists can be tackled without context rot from overloading a single executor. The core insight is that bug-fix runs currently dispatch one executor for the entire bug list; as the list grows, the executor's context balloons with unrelated file reads, diffs, and search results, degrading fix quality. The remedy is to slice the bug list into fixed-size waves (default 3 for normal runs, 5 for UAT-sourced runs) and dispatch one fresh executor per wave, chained sequentially on the same branch.

The implementation is entirely contained in `skills/bug-fix/SKILL.md`, which is the procedural specification the orchestrating model follows. The changes are therefore prose/protocol edits rather than new code modules: we add decomposition logic (group bugs into wave-sized chunks), a sequential dispatch loop (one executor per wave, strictly serial -- never parallel, since all waves mutate the same working tree), a cross-wave handoff payload (modified-files list + commit log from wave N feeds wave N+1 so later waves avoid regressions on earlier fixes), and a `--wave-size <n>` flag with sensible defaults. Presentation is layered on top: per-wave progress is surfaced as each wave completes, and an aggregate summary is shown at the end.

Backward compatibility is a first-class requirement. When `--wave-size` is absent and the bug list is small enough that splitting is not triggered, `/rapid:bug-fix` must behave exactly as it does today -- single executor, no wave framing, no handoff overhead. This constraint shapes the branching in the skill: wave-splitting is a conditional path, not a replacement for the existing flow.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| skills/bug-fix/SKILL.md | Bug-fix skill procedural spec -- add wave decomposition, sequential dispatch, handoff protocol, and `--wave-size` flag | Existing |

## Integration Points

- **Exports:**
  - `wave-splitting` -- `/rapid:bug-fix` gains wave decomposition and a `--wave-size <n>` flag; large bug lists are split into sequential waves with one executor per wave. Default wave size is 3 for normal runs, 5 for UAT-sourced runs.
  - `cross-wave-handoff` -- Modified-files list and commit log from wave N are passed into wave N+1's executor prompt so later waves have the context needed to avoid regressing earlier fixes.
- **Imports:** None. This set has no upstream contract dependencies; it modifies an existing skill file in isolation.
- **Side Effects:**
  - Waves execute strictly sequentially on the same branch -- callers should expect linear wall-clock time scaling with the number of waves.
  - Each wave produces its own commits; the commit log grows proportionally to wave count.
  - Per-wave results are displayed as each wave finishes, followed by a final aggregate summary -- the output is more verbose than the single-executor flow.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Regression across waves -- wave N+1 undoes or re-breaks a fix from wave N because it lacks context about the earlier change | High | Cross-wave handoff payload (modified-files + commit log) is mandatory input to every non-first wave; acceptance criterion explicitly tests this |
| Breaking the existing `/rapid:bug-fix` flow for small bug lists or users not passing `--wave-size` | High | `backward-compatible` behavioral invariant enforced by test; wave-splitting path must be conditional, not replace the default flow |
| Incorrect wave grouping (off-by-one, uneven splits, dropped bugs) | Medium | Explicit acceptance example in tasks: 10 bugs with `--wave-size 3` must produce exactly 4 waves of sizes (3, 3, 3, 1); count invariant (sum of wave sizes equals input bug count) |
| Parallel wave dispatch introduced by mistake, causing branch corruption and merge conflicts within a single bug-fix run | High | `sequential-execution` behavioral invariant enforced at runtime; skill prose must explicitly forbid parallel dispatch and mandate wave-N completion before wave-N+1 spawn |
| Context handoff payload itself becoming large enough to cause context rot in later waves (defeating the purpose) | Medium | Handoff limited to modified-files list and commit log summaries -- not full diffs; monitor payload size during planning |
| Default wave sizes (3 normal, 5 UAT) poorly tuned for real-world bug lists | Low | Defaults are overridable via `--wave-size`; can be retuned after real usage without breaking the contract |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- add wave decomposition logic and `--wave-size` flag parsing to `skills/bug-fix/SKILL.md`. Define the grouping algorithm, defaults (3 normal, 5 UAT), and the conditional entry point that preserves backward compatibility when splitting is not triggered.
- **Wave 2:** Sequential dispatch and cross-wave handoff -- wire the wave loop so one fresh executor is spawned per wave, define the handoff payload schema (modified-files list + commit log), and specify how wave N+1's executor prompt incorporates prior-wave context.
- **Wave 3:** Presentation and acceptance -- add per-wave progress display, final aggregate summary, and codify acceptance examples (10 bugs / `--wave-size 3` -> 4 waves of 3+3+3+1) directly in the skill prose so the behavior is self-documenting.

Note: Because this set touches exactly one file (`skills/bug-fix/SKILL.md`), the "waves" above may collapse into a single planning wave with multiple jobs. Detailed wave/job planning happens during `/rapid:discuss-set` and `/rapid:plan-set`.
