# SET-OVERVIEW: init-branding-integration

## Approach

This set inserts an optional branding step into the `/rapid:init` flow at position 4B.5 -- between the discovery conversation (Step 4B) and the granularity preference question (Step 4C). The goal is to let users opt into branding during project initialization without disrupting the existing flow or adding friction for users who want to skip it.

The implementation modifies `skills/init/SKILL.md` to add a single opt-in gate question after discovery completes: "Would you like to set up project branding now?" Skip must be the default/prominent option. If the user opts in, a condensed inline branding interview runs -- 2-3 questions distilled from the full `/rapid:branding` interview (which normally runs 4 rounds plus an anti-patterns question). The condensed version generates the same `BRANDING.md` and `index.html` artifacts but skips project-type detection (the init flow already knows the project type from Step 4B discovery) and uses fewer, more targeted questions. Critically, the branding server must NOT be started during init -- only the static files are generated.

A key challenge is handling pre-scaffolding state: Step 4B.5 runs before Step 5 (Scaffold), so `.planning/` and `.planning/branding/` may not yet exist. The branding step must create these directories on demand or defer file writes until after scaffolding. The AskUserQuestion budget constraint (max 4 total calls for the branding portion: 1 opt-in + 2-3 interview) requires careful question design to capture enough branding signal in minimal interactions.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| skills/init/SKILL.md | Main init skill flow -- insert Step 4B.5 branding gate | Existing -- modification |
| skills/branding/SKILL.md | Reference for interview question design (soft dependency for inline mode) | Existing -- read-only reference |

## Integration Points

- **Exports:**
  - Step 4B.5 in `skills/init/SKILL.md` -- An optional branding opt-in step that other future init extensions can reference for ordering context

- **Imports:**
  - `branding-inline-mode` from `branding-overhaul` set -- The branding SKILL.md's support for a condensed inline interview mode. This is a soft dependency: the init branding step works without it (using hardcoded condensed questions) but provides a richer experience if the branding skill exposes a formal inline mode section

- **Side Effects:**
  - When the user opts in, `BRANDING.md` and `index.html` are written to `.planning/branding/` (directories created if needed)
  - When the user skips (default), zero files are created and zero state changes occur
  - No branding server is started at any point during the init flow

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `.planning/` directory does not exist at Step 4B.5 (scaffolding is Step 5) | High | Create `.planning/branding/` on demand with `mkdir -p` before writing artifacts, or buffer branding data and write after Step 5 completes |
| AskUserQuestion budget overflow -- init already uses many AskUserQuestion calls | Medium | Enforce hard cap of 4 calls (1 opt-in + max 3 interview); combine questions where possible; document budget in the SKILL.md step |
| Branding server accidentally started during init | High | Contract behavioral invariant `no-server-during-init` enforced by test; never reference server start functions in the init branding step |
| Skip path has unintended side effects (directory creation, partial state) | Medium | Contract behavioral invariant `skip-is-default` enforced by test; skip path exits the branding step immediately with no I/O |
| Merge conflict with branding-overhaul set (both in wave 1, both touch branding artifacts) | Medium | This set only touches `skills/init/SKILL.md` (owned file); branding-overhaul owns `skills/branding/SKILL.md` and server code; no file overlap |
| Condensed interview produces low-quality branding output compared to full interview | Low | Design questions to cover the two highest-signal dimensions (visual identity + terminology); accept that users can always run full `/rapid:branding` later |

## Wave Breakdown (Preliminary)

- **Wave 1:** Add the Step 4B.5 opt-in gate to `skills/init/SKILL.md`. Implement the skip path (default, zero side effects). Write contract tests for `skip-is-default` and `no-server-during-init` behavioral invariants.
- **Wave 2:** Implement the condensed inline branding interview (2-3 questions adapted from the branding SKILL.md interview rounds). Handle pre-scaffolding directory creation. Generate `BRANDING.md` and `index.html` from interview responses. Write tests for `question-budget` invariant.
- **Wave 3:** Integration polish -- verify the branding step flows naturally between discovery and granularity, test edge cases (user cancels mid-interview, `.planning/` already exists from a previous run, branding artifacts already exist), ensure the compiled project brief in Step 4D includes branding status.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
