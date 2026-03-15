# SET-OVERVIEW: ux-improvements

## Approach

This set addresses three user-experience gaps in the RAPID skill layer: question UX in discuss-set, missing pre-filled options across all AskUserQuestion calls, and banner color readability. All three changes are surface-level -- they modify SKILL.md files and one display utility (`src/lib/display.cjs`) without touching the state machine, CLI commands, or agent framework.

The work divides naturally into two phases. First, the banner color change and the options audit can be done independently since they touch non-overlapping code (display.cjs vs. SKILL.md question blocks). Second, the discuss-set batched-questions rewrite depends on understanding the current question flow in `skills/discuss-set/SKILL.md` Steps 5-6, which already describes batching -- the task is to ensure the implementation matches the specification and that every AskUserQuestion call includes pre-filled option arrays.

The behavioral contracts ("no-optionless-questions" and "banner-readability") are enforced by tests. A test must verify that every AskUserQuestion reference in every SKILL.md includes at least one option, and that STAGE_BG values use dark purple (`\x1b[45m`) for planning stages with adequate contrast against bright white text.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/display.cjs` | STAGE_BG color map for banner backgrounds | Existing -- change 9 planning-stage entries from `\x1b[104m` (bright blue) to `\x1b[45m` (dark purple) |
| `skills/discuss-set/SKILL.md` | Set discussion skill -- Steps 5-6 gray area questions | Existing -- rewrite to enforce multi-header batching with pre-filled option arrays |
| `skills/quick/SKILL.md` | Quick task skill -- freeform AskUserQuestion at line 35 | Existing -- add pre-filled options or "I'll answer in my own words" escape hatch |
| `skills/add-set/SKILL.md` | Add-set skill -- 4 freeform AskUserQuestion calls (lines 66, 72, 97, 111) | Existing -- add pre-filled options to each |
| `skills/init/SKILL.md` | Init skill -- freeform batch questions (lines 185, 199, 212, 225) | Existing -- ensure pre-filled options present |
| `skills/pause/SKILL.md` | Pause skill -- freeform pause notes question (line 64) | Existing -- add pre-filled options |
| `skills/new-version/SKILL.md` | New version skill -- freeform milestone details (line 60) | Existing -- add pre-filled options |
| `skills/review/SKILL.md` | Review skill -- freeform modification/failure collection (lines 335, 835, 872) | Existing -- add pre-filled options |
| `skills/execute-set/SKILL.md` | Execute-set skill -- set selection question (line 58) | Existing -- verify options present |
| All other `skills/*/SKILL.md` | Remaining skills with AskUserQuestion calls | Existing -- audit and add options where missing |

## Integration Points

- **Exports:**
  - `batched-questions`: Rewritten discuss-set Steps 5-6 with multi-header batching and pre-filled option arrays per gray area
  - `dark-purple-banners`: Updated STAGE_BG in `src/lib/display.cjs` -- all planning-stage backgrounds changed to dark purple
  - `options-always-present`: All AskUserQuestion calls across all 24 skills guaranteed to include at least 2 pre-filled options
- **Imports:** None -- this set is fully independent with no cross-set dependencies
- **Side Effects:** Visual change to all RAPID banner output in terminals; users will see dark purple instead of bright blue for planning stages. All interactive prompts will now present selectable options rather than bare freeform text inputs.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Freeform questions (init batches, add-set descriptions) are inherently open-ended -- pre-filled options may feel forced | Medium | Include an "I'll answer in my own words" escape hatch option on every freeform question so users are never constrained |
| Dark purple (`\x1b[45m`) may render differently across terminal emulators | Low | Test against the 16-color ANSI palette that display.cjs already targets; `\x1b[45m` is standard magenta background, widely supported |
| Audit scope is large -- 24 SKILL.md files with ~100+ AskUserQuestion references | Medium | Systematic grep-based audit with a checklist; behavioral test catches any missed instances |
| Discuss-set rewrite could break the existing question flow for re-discuss scenarios | Medium | Preserve the existing Step 5-6 structure; changes are additive (adding option arrays to existing AskUserQuestion patterns, not restructuring the flow) |

## Wave Breakdown (Preliminary)

- **Wave 1:** Banner color change (`src/lib/display.cjs` STAGE_BG update) and behavioral test scaffolding (banner-readability test, no-optionless-questions test)
- **Wave 2:** Full AskUserQuestion audit across all 24 skills -- add pre-filled options to every call that lacks them, add "I'll answer in my own words" to freeform questions
- **Wave 3:** Discuss-set Steps 5-6 rewrite for batched questions with option arrays; final test pass confirming both behavioral contracts

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
