# SET-OVERVIEW: clear-guidance-and-display

## Approach

This set adds a consistent `/clear` guidance footer to all lifecycle skills. Users currently have no systematic reminder about when to run `/clear` between skill invocations, which leads to context window bloat and degraded agent performance. The solution is a `renderFooter()` utility in the existing `display.cjs` module that produces a standardized footer with a `/clear` reminder and the suggested next command.

The implementation follows three layers: (1) build the `renderFooter()` function inside `display.cjs` alongside the existing `renderBanner()`, wire it as a `display footer` CLI subcommand in the existing `handleDisplay` command handler; (2) define a clear policy document that categorizes which skills get footers (lifecycle boundaries) and which do not (help, status, sub-steps); (3) apply the footer call to all lifecycle SKILL.md files (~10-12 skills) and add a structural test that prevents regression.

The set has zero imports from other sets, making it fully self-contained. The exported `renderFooter()` function and `CLEAR-POLICY.md` document become available for other sets to consume if needed.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| src/lib/display.cjs | Add `renderFooter()` alongside existing `renderBanner()` | Existing -- modify |
| src/commands/display.cjs | Add `footer` subcommand to `handleDisplay` switch | Existing -- modify |
| tests/display.test.cjs | Unit tests for `renderFooter()` + structural test for skill coverage | New |
| .planning/CLEAR-POLICY.md | Policy document defining footer inclusion rules | New |
| skills/init/SKILL.md | Apply footer at completion | Existing -- modify |
| skills/start-set/SKILL.md | Apply footer at completion | Existing -- modify |
| skills/discuss-set/SKILL.md | Apply footer at completion | Existing -- modify |
| skills/plan-set/SKILL.md | Apply footer at completion | Existing -- modify |
| skills/execute-set/SKILL.md | Apply footer at completion | Existing -- modify |
| skills/review/SKILL.md | Apply footer at completion | Existing -- modify |
| skills/merge/SKILL.md | Apply footer at completion | Existing -- modify |
| skills/new-version/SKILL.md | Apply footer at completion | Existing -- modify |
| skills/add-set/SKILL.md | Apply footer at completion | Existing -- modify |
| skills/scaffold/SKILL.md | Apply footer at completion | Existing -- modify |
| skills/audit-version/SKILL.md | Apply footer at completion | Existing -- modify |
| skills/quick/SKILL.md | Apply footer at completion | Existing -- modify |

## Integration Points

- **Exports:**
  - `renderFooter(nextCommand, options?)` -- function in `display.cjs` that renders a formatted footer string with `/clear` reminder and suggested next command. Respects `NO_COLOR`.
  - `.planning/CLEAR-POLICY.md` -- reference document defining which skill transitions warrant `/clear` reminders (lifecycle boundaries: yes; review sub-steps, help, status: no).
- **Imports:** None. This set is fully self-contained.
- **Side Effects:** All lifecycle skills will produce an additional footer block at completion. This is purely additive output -- no behavioral changes to skill logic.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Touching ~12 SKILL.md files creates a wide merge surface | Medium | All changes are additive (append footer block); no existing lines removed or modified. Merge conflicts would be trivial append-vs-append. |
| Lifecycle skill list may drift over time | Low | Structural test scans `skills/` directory against a canonical list, catching new skills that lack footer calls. |
| NO_COLOR handling inconsistency with renderBanner | Low | Reuse exact same `NO_COLOR` detection pattern already in display.cjs `renderBanner()`. |
| Footer wording becomes stale if skill names change | Low | Footer takes `nextCommand` as a parameter -- each skill controls its own suggestion text. |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- implement `renderFooter()` in `display.cjs`, add `footer` subcommand to `handleDisplay` in `src/commands/display.cjs`, write `CLEAR-POLICY.md`, create unit tests for the new function.
- **Wave 2:** Application -- wire footer calls into all lifecycle SKILL.md files (~10-12 files), add structural regression test that verifies all lifecycle skills include the footer invocation.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
