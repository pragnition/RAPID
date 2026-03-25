# SET-OVERVIEW: colouring

## Approach

This set improves terminal readability by switching all ANSI background colour codes in `display.cjs` from the bright 10Xm range (e.g. `\x1b[104m`) to the dark 4Xm range (e.g. `\x1b[44m`). Bright backgrounds paired with white text wash out on many terminals; dark backgrounds provide consistent contrast across light and dark terminal themes.

Alongside the colour swap, the set adds two missing capabilities: (1) banner registrations for the four review-related stages (`unit-test`, `bug-hunt`, `uat`, `bug-fix`) that currently have no entries in STAGE_VERBS/STAGE_BG, and (2) NO_COLOR environment variable support per the de facto standard (https://no-color.org/), so that all ANSI escape sequences are suppressed when `NO_COLOR` is set to any non-empty value.

The work is self-contained within two files and has no imports from other sets, making it safe to execute independently.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| src/lib/display.cjs | Banner rendering with ANSI colour codes | Existing -- modify |
| src/lib/display.test.cjs | Test assertions for display module | Existing -- modify |

## Integration Points

- **Exports:**
  - `src/lib/display.cjs` -- Updated display module consumed by all skill entry points that render banners. The public API (`renderBanner`, `STAGE_VERBS`, `STAGE_BG`) stays the same; only colour values and NO_COLOR behavior change.
  - `registerBanner()` equivalent -- four new stage entries (`unit-test`, `bug-hunt`, `uat`, `bug-fix`) added to `STAGE_VERBS` and `STAGE_BG`.
- **Imports:** None. This set is fully independent.
- **Side Effects:** When `process.env.NO_COLOR` is set (any non-empty value), `renderBanner()` will return plain text without ANSI escape sequences. All callers get this behavior automatically.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Callers parsing ANSI codes by exact value | Medium | Search codebase for hard-coded `10Xm` references outside display.cjs before changing |
| NO_COLOR check placement (module-load vs call-time) | Low | Check `process.env.NO_COLOR` inside `renderBanner()` at call-time so it can be toggled dynamically in tests |
| Missing stage names for new banners | Low | Confirm the exact stage strings (`unit-test`, `bug-hunt`, `uat`, `bug-fix`) match what callers pass to `renderBanner()` |

## Wave Breakdown (Preliminary)

- **Wave 1:** Core colour and feature changes
  - Replace all `10Xm` background codes with `4Xm` equivalents in `STAGE_BG`
  - Add `unit-test`, `bug-hunt`, `uat`, `bug-fix` entries to `STAGE_VERBS` and `STAGE_BG`
  - Implement NO_COLOR support in `renderBanner()` (check `process.env.NO_COLOR` at call-time)
  - Update `display.test.cjs` assertions: new colour codes, new stages, NO_COLOR behavior

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan. Given the small scope (2 files, 4 tasks), a single wave is likely sufficient.
