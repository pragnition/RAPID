# SET-OVERVIEW: version-migration

## Approach

This set introduces a `/migrate` command that enables users to upgrade their `.planning/` state from older RAPID versions to the current version. The core challenge is designing a migration framework that executes versioned migration steps sequentially (e.g., v2.0 -> v3.0 -> v3.1 -> v3.2 -> v3.3) without skipping intermediate steps, since each migration may depend on transformations made by prior ones.

The implementation follows a registry pattern: individual migration step functions are registered with `(fromVersion, toVersion)` pairs, and the migrate command detects the current version from `STATE.json.rapidVersion` (provided by the `foundation-hardening` set), determines which steps are needed, and executes them in order. A pre-migration backup is created at `.planning/.pre-migrate-backup/` before any writes, and a `--dry-run` flag shows planned changes without executing them.

The command will be exposed as a new RAPID skill (`/rapid:migrate`) backed by a new CLI command and a migration framework module. The framework is designed for extensibility -- future versions simply register new migration steps without modifying the runner.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `skills/migrate/SKILL.md` | Skill definition for `/rapid:migrate` command | New |
| `src/commands/migrate.cjs` | CLI handler for `rapid-tools migrate` subcommands | New |
| `src/lib/migrate.cjs` | Migration framework: step registry, runner, backup, report | New |
| `src/lib/migrate.test.cjs` | Unit tests for migration framework | New |
| `src/lib/migrations/` | Directory containing individual versioned migration step files | New |
| `src/bin/rapid-tools.cjs` | Wire `handleMigrate` into the CLI router | Existing |

## Integration Points

- **Exports:**
  - `handleMigrate(cwd, options)` -- the `/migrate` command that detects version, runs migrations, and produces a report
  - `registerMigration(fromVersion, toVersion, migrateFn)` -- framework for registering versioned migration steps
- **Imports:**
  - `STATE.json.rapidVersion` (from `foundation-hardening`) -- used to detect the current project version and stamp the new version after migration completes
- **Side Effects:**
  - Creates `.planning/.pre-migrate-backup/` directory with a snapshot of `.planning/` before any migration writes
  - Mutates `STATE.json` (including the `rapidVersion` field) and potentially other `.planning/` files during migration
  - Produces a `MigrationReport` summarizing steps taken, files changed, and any warnings

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `rapidVersion` field not yet populated in existing projects | High | Migration must handle missing/undefined `rapidVersion` gracefully by inferring version from other signals (e.g., state schema shape, milestone IDs) |
| Migration step corrupts `.planning/` state | High | Pre-migration backup is mandatory; dry-run mode enables preview; each step is tested independently |
| Out-of-order or duplicate migration execution | Medium | Runner enforces strict sequential ordering via semver comparison; stamps `rapidVersion` after each step to prevent re-runs |
| Foundation-hardening set not yet merged when this set starts | Medium | This set depends on Set 1; ensure worktree branches from a commit that includes `rapidVersion` in the schema |

## Wave Breakdown (Preliminary)

- **Wave 1:** Migration framework core -- step registry, sequential runner, version detection, backup/restore, dry-run support, and unit tests
- **Wave 2:** CLI and skill wiring -- `src/commands/migrate.cjs` handler, `skills/migrate/SKILL.md`, router integration in `rapid-tools.cjs`, initial migration steps for known version transitions
- **Wave 3:** End-to-end polish -- migration report formatting, edge cases (no-op on latest, missing rapidVersion inference), integration-level tests

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
