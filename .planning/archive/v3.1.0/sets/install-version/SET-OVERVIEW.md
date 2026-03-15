# SET-OVERVIEW: install-version

## Approach

This set adds version awareness to RAPID. Today, `rapid-tools.cjs` has no way to report its own version, and `setup.sh` does not record which version was installed. Users upgrading from one release to another have no mechanism to detect staleness.

The implementation strategy is straightforward: read the `version` field from `package.json` at runtime (never hardcode it), expose that through three surfaces -- a `--version` CLI flag, a `RAPID_VERSION` variable persisted in `.env` during setup, and a `versionCheck()` utility that compares an installed version string against the current one. The `versionCheck` function will reuse the existing `compareVersions()` in `src/lib/prereqs.cjs`, keeping the dependency footprint minimal.

Work sequences naturally into three layers: (1) the version-reading utility and comparison function, (2) the CLI flag wiring, and (3) the `.env` / `.env.example` persistence in `setup.sh`. All three are small, testable units.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `package.json` | Source of truth for `version` field (currently `3.0.0`) | Existing -- read only |
| `src/lib/prereqs.cjs` | Contains `compareVersions()` to be reused by `versionCheck` | Existing -- may add export |
| `src/lib/version.cjs` | New module: `getVersion()`, `versionCheck()` | New |
| `src/lib/version.test.cjs` | Unit tests for version module | New |
| `src/bin/rapid-tools.cjs` | CLI entry point -- add `--version` flag handling | Existing -- modify |
| `setup.sh` | Bootstrap script -- persist `RAPID_VERSION` in `.env` | Existing -- modify |
| `.env.example` | Document `RAPID_VERSION` variable | Existing -- modify |

## Integration Points

- **Exports:**
  - `--version` CLI flag: `node rapid-tools.cjs --version` prints the semver string from `package.json` to stdout and exits
  - `RAPID_VERSION` env variable: written to `.env` by `setup.sh` alongside `RAPID_TOOLS`
  - `versionCheck(installed, current)`: returns `{ needsUpdate, installed, current }` object

- **Imports:** None. This set has zero dependencies on other sets.

- **Side Effects:**
  - `setup.sh` will write an additional line (`RAPID_VERSION=...`) to the `.env` file
  - `.env.example` gains a new documented variable
  - The `--version` flag intercepts before any other command processing (early-exit pattern matching `--help`)

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `package.json` path resolution differs between worktree and installed plugin | Medium | Use `path.resolve(__dirname, '../../package.json')` relative to `version.cjs` location, with a fallback `findProjectRoot()` approach. Unit test both paths. |
| Existing `.env` files lose `RAPID_VERSION` on re-run of older `setup.sh` | Low | The change is additive -- older scripts simply will not write the line. Document in `.env.example` so users know to expect it. |
| `compareVersions()` edge cases (pre-release tags, missing fields) | Low | `compareVersions()` already handles missing parts as zero. Pre-release tags are out of scope per behavioral contract (semver numeric only). Add targeted test cases. |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- create `src/lib/version.cjs` with `getVersion()` and `versionCheck()`, plus `src/lib/version.test.cjs` with full coverage including the behavioral invariant that version comes from `package.json` at runtime
- **Wave 2:** CLI wiring -- add `--version` flag to `src/bin/rapid-tools.cjs` (early-exit before command dispatch), update USAGE string
- **Wave 3:** Env persistence -- modify `setup.sh` to write `RAPID_VERSION` into `.env`, update `.env.example` with documentation, add test verifying `.env.example` contains `RAPID_VERSION`

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
