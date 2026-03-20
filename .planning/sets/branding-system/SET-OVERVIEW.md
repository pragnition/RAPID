# SET-OVERVIEW: branding-system

## Approach

The branding system introduces an entirely optional layer that lets users personalize RAPID's agent outputs with project-specific tone, terminology, and style guidelines. The core design principle is **zero-impact optionality**: when a user never runs `/rapid:branding`, every other RAPID workflow must behave identically to today. When they do run it, the resulting `BRANDING.md` artifact is injected as additional context into execution prompts so agents adopt the project's voice.

Implementation follows RAPID's existing extensibility patterns. A new `skills/branding/SKILL.md` defines the user-facing skill that conducts a structured interview via `AskUserQuestion`, producing a concise `BRANDING.md` artifact (50-150 lines) stored at `.planning/BRANDING.md`. A companion `role-branding.md` agent role drives the interview logic, following the same conventions as `role-executor.md`, `role-planner.md`, and the other role modules. On the integration side, `enrichedPrepareSetContext()` in `execute.cjs` gains a branding context block -- mirroring the existing quality and UI context injection pattern -- that reads and formats `BRANDING.md` when present and silently skips when absent. Finally, `display.cjs` gets a `'branding'` entry in both `STAGE_VERBS` and `STAGE_BG` maps so the skill renders a proper stage banner.

The work is self-contained with no imports from other sets, making it safe to develop and merge independently.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `skills/branding/SKILL.md` | Skill definition for `/rapid:branding` interview flow | New |
| `src/modules/roles/role-branding.md` | Agent role module driving the branding interview | New |
| `src/lib/execute.cjs` | `enrichedPrepareSetContext()` -- add branding context injection | Existing (modify) |
| `src/lib/execute.test.cjs` | Tests for branding context injection and graceful absence | Existing (modify) |
| `src/lib/display.cjs` | `STAGE_VERBS` / `STAGE_BG` -- add branding stage entries | Existing (modify) |
| `src/lib/display.test.cjs` | Tests for branding stage entries in display maps | Existing (modify) |
| `.planning/BRANDING.md` | Output artifact (generated at runtime, not committed) | Runtime artifact |

## Integration Points

- **Exports:**
  - `brandingSkill` -- `/rapid:branding` skill endpoint for the structured branding interview
  - `brandingRole` -- `role-branding.md` agent role module
  - `brandingContextInjection` -- `buildBrandingContext(cwd)` function returning formatted branding context string
  - `brandingDisplayStage` -- `STAGE_VERBS['branding']` and `STAGE_BG['branding']` entries
- **Imports:** None. This set is fully self-contained.
- **Side Effects:**
  - Creates `.planning/BRANDING.md` when the branding skill is invoked
  - Modifies execution prompt content when `BRANDING.md` exists (agents receive branding context)
  - Adds a new banner stage visible in CLI output during branding interviews

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Branding context bloats execution prompts beyond token budgets | Medium | CONTRACT enforces 50-150 line limit on BRANDING.md; validate at generation time |
| Modifying `enrichedPrepareSetContext()` could break existing context assembly | High | Follow exact pattern of existing quality/UI context injection (try/catch, graceful skip); add test for absent BRANDING.md |
| Display test hardcodes expected stage count (currently checks 14 stages) | Medium | Update `display.test.cjs` expected stage list to include `'branding'` and `'scaffold'` (15 stages present, test checks 14) |
| AskUserQuestion interview flow may be unfamiliar pattern for SKILL.md | Low | Study existing skills that use AskUserQuestion (e.g., discuss-set) for precedent |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- Create `role-branding.md` agent role and `skills/branding/SKILL.md` skill definition with the structured interview flow and BRANDING.md artifact format
- **Wave 2:** Integration -- Add `buildBrandingContext()` to `execute.cjs` with graceful absence handling, add `'branding'` entries to `display.cjs` stage maps
- **Wave 3:** Testing -- Update `display.test.cjs` with branding stage expectations, add `execute.test.cjs` tests for branding context injection (present and absent cases)

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
