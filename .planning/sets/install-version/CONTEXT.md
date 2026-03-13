# CONTEXT: install-version

**Set:** install-version
**Generated:** 2026-03-13
**Mode:** interactive

<domain>
## Set Boundary
Add version tracking to RAPID's install flow. Three deliverables: (1) a `src/lib/version.cjs` module with `getVersion()` and `versionCheck()` utilities, (2) a `--version` CLI flag on `rapid-tools.cjs`, and (3) `RAPID_VERSION` persistence in `.env` via `setup.sh`. The set has zero dependencies on other sets and reuses the existing `compareVersions()` from `prereqs.cjs`.
</domain>

<decisions>
## Implementation Decisions

### Version Module API
- **Claude's Discretion:** Use the rich return object `{ needsUpdate, installed, current }` from `versionCheck()` as specified in CONTRACT.json — provides formatted message flexibility downstream.
- **Claude's Discretion:** Resolve `package.json` relative to `__dirname` (`path.resolve(__dirname, '../../package.json')`) as the primary strategy. This is reliable since `version.cjs` lives at a known depth in `src/lib/`. Add a unit test confirming the path resolves correctly.
- **Claude's Discretion:** Import `compareVersions` internally within `version.cjs` — no re-export needed. Keeps the public API surface minimal.

### --version Flag Output
- **Claude's Discretion:** Use branded format `RAPID v3.0.0` for human readability. Handle `--version` as an early-exit check alongside `--help`, before command dispatch. Exit code 0.

### setup.sh .env Strategy
- **Claude's Discretion:** Continue the current overwrite approach for `.env` (the file only contains RAPID-managed variables). Add `RAPID_VERSION` line alongside `RAPID_TOOLS`. Keep `.env.example` documented with comments for both variables.

### Staleness Detection UX
- **User Decision:** When a version mismatch is detected, the installer should **automatically update** to the newest version rather than warning or blocking. The staleness check triggers during install-related commands, and if installed version differs from current package.json version, setup proceeds to update silently.
</decisions>

<specifics>
## Specific Ideas
- The `--version` early-exit should mirror the existing `--help` pattern in `rapid-tools.cjs`
- `versionCheck()` reuses `compareVersions()` from `prereqs.cjs` directly — no duplication
- `setup.sh` reads version from `package.json` using `node -e "console.log(require('./package.json').version)"` for reliability
</specifics>

<code_context>
## Existing Code Insights
- `prereqs.cjs` exports `compareVersions(a, b)` — splits by `.`, compares numeric parts, missing parts treated as 0. Already battle-tested.
- `rapid-tools.cjs` CLI entry point is ~800 lines. Command dispatch starts after USAGE string. No existing `--version` handling.
- `setup.sh` currently overwrites `.env` entirely with a heredoc containing only `RAPID_TOOLS=<path>`. Adding a line is trivial.
- `package.json` has `"version": "3.0.0"` — this is the source of truth.
- `.env.example` currently documents only `RAPID_TOOLS`.
- `core.cjs` exports `findProjectRoot()` but `__dirname`-relative resolution is simpler for this use case.
</code_context>

<deferred>
## Deferred Ideas
- Version check integration into `/rapid:status` dashboard (belongs to status-rename or a future set)
- Pre-release/alpha version tag support in `compareVersions()` (out of scope per behavioral contract)
</deferred>
