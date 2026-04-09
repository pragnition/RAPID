# CONTEXT: docs-and-housekeeping

**Set:** docs-and-housekeeping
**Generated:** 2026-04-08
**Mode:** interactive

<domain>
## Set Boundary

Terminal set in the v6.2.0 DAG. Closes the milestone with documentation refresh, version-string sweep, and dependency pinning. Hard-depends on the post-merge state of `branding-overhaul`, `init-branding-integration`, and `update-reminder` already being on main.

In scope:
- Regenerate `.planning/context/{CODEBASE,ARCHITECTURE,CONVENTIONS,STYLE_GUIDE}.md` against the post-merge v6.2.0 codebase.
- Sweep `v6.1.0` → `v6.2.0` across all active files (per user directive: all non-archive, with one explicit exclusion below).
- Pin Zod to exact `3.25.76` AND extend exact-pin policy to all other runtime dependencies (`ajv`, `ajv-formats`, `proper-lockfile`).
- Document `NO_UPDATE_NOTIFIER` in `.env.example`.

Out of scope (explicit user directive):
- **ROADMAP.md must NOT be edited in this set.** The original CONTRACT.json task to finalize the v6.2.0 entry in ROADMAP.md is dropped. The user will handle ROADMAP updates outside this set.
</domain>

<decisions>
## Implementation Decisions

### Context File Regeneration Approach
- **Decision:** Surgical patches — read each existing `.planning/context/` file, identify stale sections, patch only what changed.
- **Rationale:** Lower risk of regression. The current files have hand-tuned structure and phrasing; a from-scratch rewrite would lose nuance and produce churn beyond what's needed. v6.2.0 changes are additive (new modules, new flow steps), which patch well.

### Context File Regeneration Depth
- **Decision:** Match the current detail level. Add new v6.2.0 modules into existing sections without expanding scope.
- **Rationale:** Existing depth is calibrated for agent-prompt context loading. Expanding bloats every agent invocation; trimming risks losing load-bearing facts. Keep the depth, change only the content.

### Version Sweep Scope
- **Decision:** Sweep all non-archive files. The sweep covers everything except `.planning/archive/` and `node_modules/`, with **one explicit exclusion: `ROADMAP.md`**.
- **Rationale:** User explicitly chose the broad sweep, accepting that historical `.planning/sets/*/CONTEXT.md` references to `v6.1.0` will be touched. ROADMAP.md is excluded because the user separately directed that it must not be edited in this set.
- **Implementation note for planner:** When sweeping `.planning/sets/*/` historical artifacts, prefer string substitution that preserves surrounding meaning (e.g., a CONTEXT.md saying "running on v6.1.0" becomes "running on v6.2.0" — accept this as the chosen tradeoff). Do not invent new prose; only substitute.

### Stale-Version Test Gate
- **Decision:** Test enforces zero `v6.1.0` references in the same scope as the sweep — i.e., all non-archive files **except `ROADMAP.md`**.
- **Rationale:** Test scope must match sweep scope or it would fail on files we deliberately didn't touch. ROADMAP.md is excluded from both because it contains legitimate historical milestone markers (e.g., `v6.1.0 UX & Onboarding (7 sets) — shipped 2026-04-07`) and the user has reserved ROADMAP edits for themselves.
- **Implementation note for planner:** The behavioral test should grep `v6\.1\.0` across the repo, exclude `.planning/archive/`, `node_modules/`, and `ROADMAP.md`, and assert zero matches. The exclusion list lives in the test, not in `.gitignore`.

### Zod Pin Enforcement
- **Decision:** Behavioral test only. Add a unit/contract test that asserts `package.json` `dependencies.zod === "3.25.76"` (no `^` or `~` prefix).
- **Rationale:** Simple, lives alongside other contract tests, doesn't require new tooling or sidecar files. Sufficient deterrent against accidental regression via `npm install`.

### Dependency Pin Policy Scope
- **Decision:** Pin **all runtime dependencies** to exact versions, not just Zod.
- **Rationale:** Pinning Zod alone is asymmetric — `ajv`, `ajv-formats`, and `proper-lockfile` would still drift via caret. Consistent policy across the runtime surface eliminates the asymmetry. The user explicitly chose this expanded scope.
- **Implementation note for planner:** Resolve each currently-installed version from `package-lock.json` and pin to that exact value. Do NOT bump versions. Behavioral test should assert ALL runtime deps in `dependencies` are exact-pinned (no `^` or `~` prefix). DevDependencies are NOT in scope for pinning.

### ROADMAP.md (Dropped)
- **Decision:** The original CONTRACT.json task `Finalize ROADMAP.md with v6.2.0 milestone entry` is **dropped from this set**.
- **Rationale:** User directive — they will handle ROADMAP updates outside this set. The task should be removed from the set's plan, ROADMAP.md should be removed from `ownedFiles`, and the related behavioral acceptance criteria should be relaxed to exclude ROADMAP.
- **Implementation note for planner:** Update CONTRACT.json during planning to remove the ROADMAP.md task and the file from `ownedFiles`. Do NOT modify ROADMAP.md in any wave.

### Claude's Discretion
- Specific file ordering within waves (which context file regenerates first, which sweep file is touched first).
- The exact wording of the behavioral test failure messages.
- Which existing test file the new pin/version assertions live in (or whether to create a new `housekeeping.test.cjs`).
- Format and phrasing of the `NO_UPDATE_NOTIFIER` documentation block in `.env.example` (match existing comment style of other env vars).
- Whether the version sweep is one wave or split into version-bump + dep-pin waves — planner's call based on commit granularity preference.
</decisions>

<specifics>
## Specific Ideas

- **Sweep mechanic:** Use Grep across the full repo for `v6\.1\.0`, then process each match. For `.planning/sets/*/` historical artifacts, do plain substitution; for `package.json`/`plugin.json`/`README.md`/skill files, also update related metadata fields (e.g., changelog dates if any).
- **Pin resolution:** Read `package-lock.json` to find the currently-installed version of each runtime dep, then write that exact version into `package.json`. This preserves current behavior — the pin is to what's already running.
- **`.env.example` block for NO_UPDATE_NOTIFIER:** Read the actual update-reminder implementation in `version.cjs` and `.rapid-install-meta.json` handling to confirm the variable name and truthy semantics before documenting.
- **Context file scan source:** When patching `.planning/context/CODEBASE.md`, the planner should explicitly read `src/lib/branding-artifacts.cjs`, `src/lib/version.cjs`, and the new init branding step in `skills/init/SKILL.md` to ensure new modules are listed.
- **Verification gate:** The set should end with a final `grep -rn "v6\.1\.0" --exclude-dir=.planning/archive --exclude-dir=node_modules --exclude=ROADMAP.md .` returning empty before the merge.
</specifics>

<code_context>
## Existing Code Insights

- `.planning/context/CODEBASE.md` currently lists 21 core library modules under `src/lib/`. The branding-overhaul set added `branding-artifacts.cjs` and the artifact registry; update-reminder added staleness logic to `version.cjs` plus the `.rapid-install-meta.json` sidecar. These need to land in CODEBASE.md.
- `package.json` currently uses caret ranges for all runtime deps (`ajv: ^8.17.1`, `zod: ^3.25.76`, `proper-lockfile: ^4.1.2`, `ajv-formats: ^3.0.1`). Version field is `6.1.0`.
- `plugin.json`, `README.md`, and `SKILL.md` files across `skills/**/` likely contain version strings — the sweep should catch them all.
- `.env.example` currently documents existing env vars; the planner should match the existing comment style when adding `NO_UPDATE_NOTIFIER`.
- The set has no merge ordering constraints beyond its three hard imports being on main first.
- Existing test pattern: behavioral tests live in `src/**/*.test.cjs` per `package.json` test script. New pin/version assertions should follow the same colocation.
</code_context>

<deferred>
## Deferred Ideas

- **ROADMAP.md v6.2.0 finalization** — explicitly dropped from this set per user directive; user will handle separately.
- **Pin policy for devDependencies** — user chose runtime-only; devDependencies remain on caret ranges. May be revisited in a future hardening pass.
- **`.npmrc save-exact=true` policy** — not added in this set; behavioral tests are the only enforcement layer. May be added later if pins regress.
- **Historical `.planning/sets/*/CONTEXT.md` semantic preservation** — broad sweep will substitute v6.1.0→v6.2.0 in historical artifacts even where the original meaning was a historical marker. Accepted tradeoff for this set; future cleanup may want a more nuanced sweep.

(See DEFERRED.md for the structured table.)
</deferred>
