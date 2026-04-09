# SET-OVERVIEW: update-reminder

## Approach

This set adds an unobtrusive update staleness detection system to RAPID, modeled after the widely-used `update-notifier` convention from the Node.js ecosystem. The core idea is simple: record an ISO 8601 timestamp at install/setup time, then surface a non-blocking reminder banner in user-facing skills (status, install) when the install is older than a configurable threshold (default 7 days).

The implementation centers on `src/lib/version.cjs`, which gains three pure functions (`writeInstallTimestamp`, `readInstallTimestamp`, `isUpdateStale`) backed by a `.rapid-install-meta.json` sidecar file at the plugin root. The setup script (`setup.sh`) is updated to call the timestamp writer during install. A new `state install-meta` CLI subcommand exposes the timestamp + staleness status as JSON for skills to consume. Finally, the status and install SKILL.md files are updated to query this CLI and conditionally print a deferred banner after their normal output.

Sequencing is bottom-up: build the lib primitives and tests first, then wire setup.sh, then expose the CLI subcommand, then inject banners into the two skills last so the full pipeline can be exercised end-to-end.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| src/lib/version.cjs | Timestamp read/write + staleness check functions | Existing (extend) |
| tests/version.test.cjs | Unit tests for all three primitives + edge cases | New |
| setup.sh | Call writeInstallTimestamp on successful install | Existing (extend) |
| skills/install/SKILL.md | Emit deferred reminder banner when stale | Existing (extend) |
| skills/status/SKILL.md | Emit deferred reminder banner when stale | Existing (extend) |
| src/bin/rapid-tools.cjs | Add `state install-meta` subcommand | Existing (extend) |
| .rapid-install-meta.json | Persisted install timestamp sidecar | New (runtime artifact) |

## Integration Points

- **Exports:**
  - `writeInstallTimestamp(pluginRoot)` -- called by setup.sh during install
  - `readInstallTimestamp(pluginRoot)` -- returns ISO 8601 string or null
  - `isUpdateStale(pluginRoot, thresholdDays = 7)` -- boolean staleness check
  - CLI: `node rapid-tools.cjs state install-meta` -- returns `{ timestamp, isStale, thresholdDays }` JSON
- **Imports:** None -- this set has no upstream dependencies on other sets
- **Side Effects:**
  - Writes `.rapid-install-meta.json` at plugin root during install (one file, ~80 bytes)
  - Reminder banner emitted to stdout AFTER skill output completes (deferred-display invariant)
  - Banner suppressed when `NO_UPDATE_NOTIFIER` env var is set or stdout is not a TTY
  - All terminal coloring respects `NO_COLOR` convention

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Banner appears in piped/scripted output and breaks parsers | High | Strict TTY check (`process.stdout.isTTY`) before any banner emission; covered by tty-only test |
| Timestamp file missing on existing installs (pre-feature users) | Medium | `readInstallTimestamp` returns `null`, `isUpdateStale` returns `false` -- fail-safe default is "not stale" |
| Banner emitted before output disrupts skill UX | Medium | Deferred-display behavioral invariant enforced by test; banner emission lives in a single helper called at end of skill execution |
| Plugin root path differs across solo vs worktree contexts | Medium | Always resolve plugin root via existing version.cjs convention; never write meta file inside `.rapid-worktrees/` |
| User has `NO_COLOR=1` but banner uses ANSI | Low | Respect `NO_COLOR` env var in banner formatter; covered by no-color-respect test |
| Setup.sh fails partway and timestamp written but install incomplete | Low | Write timestamp only on the success path of setup.sh, after all other steps complete |

## Wave Breakdown (Preliminary)

- **Wave 1:** Library primitives -- extend `src/lib/version.cjs` with `writeInstallTimestamp`, `readInstallTimestamp`, `isUpdateStale`. Write `tests/version.test.cjs` covering happy path, missing file, expired threshold, custom threshold, malformed JSON.
- **Wave 2:** CLI surface and install hook -- add `state install-meta` subcommand to `rapid-tools.cjs`, update `setup.sh` to invoke `writeInstallTimestamp` on successful install.
- **Wave 3:** Skill integration -- inject deferred reminder banner logic into `skills/install/SKILL.md` and `skills/status/SKILL.md`, ensuring TTY check, NO_COLOR respect, and `NO_UPDATE_NOTIFIER` suppression.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
