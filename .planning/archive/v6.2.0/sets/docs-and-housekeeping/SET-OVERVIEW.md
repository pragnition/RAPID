# SET-OVERVIEW: docs-and-housekeeping

## Approach

This set closes out the v6.2.0 milestone with the documentation and housekeeping work that can only be done after the three feature sets (`branding-overhaul`, `init-branding-integration`, `update-reminder`) are merged to main. It is deliberately the terminal set in the DAG -- its inputs are the stabilized post-merge state of the other three sets, and its outputs are the files that describe and version that state.

The implementation strategy is mechanical rather than design-heavy: regenerate the four `.planning/context/` files against the freshly-merged codebase, perform a global `v6.1.0` -> `v6.2.0` sweep across all active (non-archive) files, tighten the Zod dependency from a caret range to an exact pin (`3.25.76`), document the `NO_UPDATE_NOTIFIER` env var introduced by the update-reminder set, and finalize the `v6.2.0 — DX Refinements` entry in `ROADMAP.md` (marking it shipped and collapsing it into a `<details>` block alongside the other historical milestones).

Sequencing is linear and low-risk. The version bump and Zod pin are small, targeted edits driven by test assertions. The context file regeneration is the heaviest task and should run last, because it needs to reflect not just the merged feature code but also the updated version strings and pinned dependency. ROADMAP finalization is the final cosmetic touch before the milestone ships.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `.planning/context/CODEBASE.md` | File layout, tech stack, dependencies, entry points | Existing (regenerate) |
| `.planning/context/ARCHITECTURE.md` | System layers, state hierarchy, agent pipeline, merge/review flows | Existing (regenerate) |
| `.planning/context/CONVENTIONS.md` | Naming, module structure, commit format, testing patterns | Existing (regenerate) |
| `.planning/context/STYLE_GUIDE.md` | Code style, formatting, output conventions, git rules | Existing (regenerate) |
| `.env.example` | Example env config incl. `NO_UPDATE_NOTIFIER` documentation | Existing (update) |
| `package.json` | Version bump + Zod exact pin (`3.25.76`) | Existing (edit) |
| `plugin.json` | Plugin manifest version bump | Existing (edit) |
| `README.md` | User-facing version references | Existing (edit) |
| `.planning/ROADMAP.md` | Finalize v6.2.0 milestone entry, mark as shipped | Existing (edit) |
| `skills/**/SKILL.md` | Any embedded version strings in skill frontmatter/bodies | Existing (sweep) |

## Integration Points

- **Exports:**
  - `updated-context-files` -- regenerated `.planning/context/{CODEBASE,ARCHITECTURE,CONVENTIONS,STYLE_GUIDE}.md` reflecting v6.2.0 state including branding server architecture, init branding step, and update-reminder infrastructure.
  - `version-strings` -- all `v6.1.0` references in active files updated to `v6.2.0`.
  - `pinned-zod` -- `package.json` Zod dependency is exact `3.25.76` (no `^` or `~` prefix).
- **Imports (all hard dependencies on merged state):**
  - From `branding-overhaul`: final branding server architecture (SSE auto-reload, artifact registry, CRUD API, extended branding skill) must be on main before context regeneration.
  - From `init-branding-integration`: final `skills/init/SKILL.md` with branding step 4B.5 must be on main so context files describe the correct init flow.
  - From `update-reminder`: final update-reminder infrastructure (`.rapid-install-meta.json`, `version.cjs` staleness check, CLI subcommand, status/install banners, `NO_UPDATE_NOTIFIER` env var) must be on main -- drives both `.env.example` documentation and context file accuracy.
- **Side Effects:** None at runtime. This set produces documentation and metadata changes only. Downstream consumers are future RAPID contributors reading context files and `package.json`/`plugin.json` consumers (package managers, install scripts, version displays).

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Stale `v6.1.0` strings slip through the sweep (e.g., embedded in code comments, skill bodies, or ROADMAP prose) | Medium -- fails `no-stale-versions` behavioral test and leaves user-visible version drift | Use Grep across the entire repo excluding `.planning/archive/` and `node_modules/`; verify with a final `grep -r "v6\.1\.0"` gate before commit |
| Context file regeneration misses new modules from the three feature sets (e.g., branding artifact registry, update-reminder version.cjs additions) | Medium -- fails `context-accuracy` behavioral test and leaves docs misaligned with reality | Regenerate context files AFTER the version sweep and AFTER verifying all three dependency sets are fully merged; cross-reference each feature set's CONTRACT.json exports against context file content |
| Zod exact-pin breaks if downstream code relied on a newer patch via the caret range | Low -- pin is to the currently-resolved version, so behavior is identical | Run full unit test suite after the pin change; verify `package-lock.json` resolves to `3.25.76` with no surprises |
| `.env.example` drift from actual `NO_UPDATE_NOTIFIER` semantics introduced by `update-reminder` | Low -- misleading docs but no runtime impact | Read the update-reminder set's final implementation of the env var before documenting; match exact variable name and truthy-value semantics |
| ROADMAP.md finalization collides with the prior `v6.1.0` entry formatting | Low -- cosmetic only | Follow the exact `<details>` pattern used by every prior shipped milestone in ROADMAP.md |

## Wave Breakdown (Preliminary)

- **Wave 1: Version & Dependency Sweep**
  - Bump `v6.1.0` -> `v6.2.0` across `package.json`, `plugin.json`, `README.md`, skill files, and any other active references.
  - Pin Zod to exact `3.25.76` in `package.json`.
  - Update `.env.example` with `NO_UPDATE_NOTIFIER` documentation.
  - Gate: `grep -r "v6\.1\.0"` across active files returns zero results.

- **Wave 2: Context File Regeneration**
  - Regenerate `CODEBASE.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `STYLE_GUIDE.md` from the post-merge codebase.
  - Ensure branding server, init branding step, and update-reminder infrastructure are accurately described.
  - Gate: Context files reference v6.2.0 modules and flows; `context-accuracy` behavioral test passes.

- **Wave 3: Roadmap Finalization**
  - Mark `v6.2.0 — DX Refinements` as shipped in `ROADMAP.md`.
  - Collapse the active milestone section into a `<details>` block matching the prior shipped-milestone format.
  - Gate: `ROADMAP.md` structure matches historical pattern; no "in progress" marker remains for v6.2.0.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during `/rapid:discuss-set` and `/rapid:plan-set`. Given the mechanical nature of this work, a single wave with three sequential jobs may also be appropriate -- the planner should decide based on file-ownership overlap and commit granularity.
