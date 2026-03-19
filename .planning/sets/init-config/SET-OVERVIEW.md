# SET-OVERVIEW: init-config

## Approach

This set addresses four related gaps in RAPID's initialization and configuration layer. The core problem is that the init skill generates CONTRACT.json for each set but never creates DEFINITION.md, causing `loadSet()` in `src/lib/plan.cjs` to crash with ENOENT whenever downstream skills (start-set, discuss-set, plan-set) try to read set data. The fix requires both generating DEFINITION.md during init and making `loadSet()` gracefully degrade when the file is absent.

Beyond the DEFINITION.md fix, this set adds three configuration and environment improvements: (1) a project-wide `solo` field in `.planning/config.json` so single-developer projects default to solo mode without requiring `--solo` on every `/rapid:start-set` invocation, (2) ecosystem-aware dependency installation in `createWorktree()` so that tests and imports work immediately in new worktrees, and (3) auto-committing all generated planning artifacts after init completes so the user does not need a manual commit step.

The implementation strategy is defensive middleware -- each fix adds a guard or fallback at the boundary where the failure occurs, without restructuring the existing 5-layer architecture (Skill -> Agent -> CLI -> Library -> Storage). All changes are additive and backward-compatible.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/plan.cjs` | `loadSet()` function -- needs graceful DEFINITION.md fallback | Existing (modify) |
| `src/lib/plan.test.cjs` | Tests for `loadSet()` graceful degradation | Existing (modify) |
| `skills/init/SKILL.md` | Init skill -- add DEFINITION.md generation step and auto-commit step | Existing (modify) |
| `src/lib/worktree.cjs` | `createWorktree()` -- add package manager detection and install | Existing (modify) |
| `src/lib/worktree.test.cjs` | Tests for worktree package installation | Existing (modify) |
| `src/commands/init.cjs` | Init CLI -- may need `write-config` to support `solo` field | Existing (modify) |
| `src/commands/set-init.cjs` | Set init CLI -- read `config.json` solo field when `--solo` not passed | Existing (modify) |
| `skills/start-set/SKILL.md` | Start-set skill -- check config.json for solo mode default | Existing (modify) |

## Integration Points

- **Exports:**
  - `loadSet()` returns `{ definition: SetDefinition | null, contract }` -- null definition with warning instead of ENOENT crash
  - `.planning/config.json` gains a `solo: boolean` field read by start-set and set-init
  - `createWorktree()` detects package manager (npm/yarn/pnpm) and runs install after worktree creation
  - Init skill generates DEFINITION.md alongside CONTRACT.json for every set
  - Init skill auto-commits all planning artifacts after completion

- **Imports:** None -- this set has no dependencies on other v3.5.0 sets

- **Side Effects:**
  - After init, every `.planning/sets/{setId}/` directory contains both CONTRACT.json and DEFINITION.md
  - New worktrees have `node_modules` available immediately after creation
  - Init completion results in a git commit of all generated artifacts

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `loadSet()` callers assume `definition` is always a string -- null return may crash downstream | High | Audit all 6 callsites (`worktree.cjs`, `plan.cjs`, `review.cjs`, `execute.cjs`, `merge.cjs`, `stub.cjs`); ensure null-safe access |
| Package install in `createWorktree()` adds latency to set initialization | Medium | Use `npm install --prefer-offline` or symlink `node_modules` as primary strategy with full install as fallback |
| Auto-commit after init may conflict with user's uncommitted changes | Medium | Only commit files under `.planning/`; use `git add .planning/` not `git add .` |
| Solo config in `config.json` may not be read by all skills that check `--solo` | Medium | Grep for all `--solo` and `SOLO_MODE` references; ensure config check is added at each site |

## Wave Breakdown (Preliminary)

- **Wave 1:** Graceful `loadSet()` fallback (modify `plan.cjs` to return null definition with warning; add tests for ENOENT and missing-definition cases)
- **Wave 2:** DEFINITION.md generation in init (update `skills/init/SKILL.md` to generate DEFINITION.md per set; solo mode config in `config.json`; auto-commit after init)
- **Wave 3:** Worktree package management (detect package manager in `createWorktree()`, run install, add tests; wire solo config into `start-set` and `set-init`)

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
