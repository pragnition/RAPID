# SET-OVERVIEW: branding-skill-overhaul

## Approach

This set overhauls the `/rapid:branding` skill to become an artifact-driven system with a live-reloading webserver, expanded creative capabilities, and cleaner architecture through init delegation. The core problem is that the current branding skill generates static files (BRANDING.md, index.html, logo.svg, wireframe.html) but the webserver hub page, SSE auto-reload, and artifact gallery are already implemented in `branding-server.cjs` and `branding-artifacts.cjs`. The overhaul focuses on making the skill itself fully leverage these backend capabilities and expanding what it produces.

The work sequences naturally: first ensure the SSE auto-reload pipeline works end-to-end without manual browser refresh (the server-side infrastructure exists but the skill's artifact registration flow may not trigger reloads correctly), then expand the branding flow to prompt users for additional assets (logos, documents, wireframes, guidelines page) after the theme is settled, then ensure the hub page renders all artifacts as a browseable gallery with type badges, and finally refactor `/rapid:init` to delegate its branding section to `/rapid:branding` instead of reimplementing the interview logic inline.

The init delegation is the most architecturally significant change. Currently `skills/init/SKILL.md` contains ~350 lines of duplicated branding interview logic (Steps 4B.5 through the BRANDING.md generation). This must be replaced with a call to the branding skill, preserving the opt-in/skip flow and re-init detection.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| skills/branding/SKILL.md | Main branding skill prompt | Existing -- major rewrite |
| src/lib/branding-server.cjs | HTTP server with SSE, hub page, artifact CRUD | Existing -- verify/fix auto-reload |
| src/lib/branding-artifacts.cjs | Artifact manifest CRUD (Zod-validated) | Existing -- may need minor updates |
| skills/init/SKILL.md | Init skill with duplicated branding logic | Existing -- refactor branding section |
| src/lib/branding-server.test.cjs | Server unit tests | Existing -- extend for auto-reload |
| src/lib/branding-artifacts.test.cjs | Artifact CRUD unit tests | Existing -- extend as needed |
| skills/branding/SKILL.test.cjs | Branding skill structural tests | Existing -- extend for new flow |

## Integration Points

- **Exports:**
  - `skills/branding/SKILL.md` -- Overhauled branding skill with artifact gallery webserver and auto-reload
  - `skills/init/SKILL.md` -- Init skill branding section delegates to branding skill
- **Imports:** None -- this set has no external dependencies
- **Side Effects:**
  - The branding server (port 3141) sends SSE events when artifacts change, triggering browser auto-reload
  - Artifact manifest (`artifacts.json`) is modified when new branding assets are registered
  - Init skill behavior changes: branding interview is no longer inline but delegated

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Init delegation breaks the opt-in/skip flow | High | Preserve the existing AskUserQuestion gates; only delegate the actual interview and file generation |
| SSE auto-reload does not trigger on artifact creation | Medium | The `notifyClients()` call in server's POST `/_artifacts` handler already exists; verify the SKILL.md artifact registration actually goes through the server API rather than direct file writes |
| Expanded flow (logos, wireframes, guidelines) inflates AskUserQuestion budget beyond 5 calls | Medium | Design the expanded flow as opt-in after theme is settled; use a single multi-option question rather than per-asset questions |
| Hub page gallery rendering breaks with new artifact types | Low | The `_generateHubPage()` function already renders cards from the manifest generically; new types get type badges automatically |

## Wave Breakdown (Preliminary)

- **Wave 1:** Auto-reload verification and fix -- ensure SSE events fire when artifacts are created/updated via the skill, add tests confirming browser reload triggers without manual refresh
- **Wave 2:** Expanded branding flow -- add post-theme prompts for logos, documents, wireframes, and guidelines page; update SKILL.md with the new interview rounds and artifact generation steps
- **Wave 3:** Init delegation -- refactor `skills/init/SKILL.md` to replace the inline branding interview with a delegation call to `/rapid:branding`, preserving opt-in/skip/re-init detection
- **Wave 4:** Hub gallery polish and integration tests -- verify all registered artifacts appear as browseable cards with type badges and links on the hub page

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
