# CONTEXT: update-reminder

**Set:** update-reminder
**Generated:** 2026-04-07
**Mode:** interactive

<domain>
## Set Boundary

Implement update staleness detection for RAPID, modeled after the Node.js `update-notifier` convention. The set covers four cohesive layers:

1. **Library primitives** in `src/lib/version.cjs`: `writeInstallTimestamp()`, `readInstallTimestamp()`, `isUpdateStale()` backed by `.rapid-install-meta.json` at plugin root.
2. **Install hook** in `setup.sh`: invoke `writeInstallTimestamp` on the success path so timestamps are recorded during install/reinstall.
3. **CLI surface** in `src/bin/rapid-tools.cjs`: a `state install-meta` subcommand returning JSON, plus a `display update-reminder` command that emits the formatted banner (or nothing) to stdout.
4. **Skill integration**: inject a deferred banner emission as the final step of `skills/install/SKILL.md` and `skills/status/SKILL.md`.

Behavioral invariants from CONTRACT.json: deferred-display (banner appears AFTER skill output), tty-only (only emit when `process.stdout.isTTY`), suppressible (`NO_UPDATE_NOTIFIER` env var), and NO_COLOR-respecting.

Out of scope: remote version checks, snooze/dismiss state, CLI flag overrides, user-level config directories, surfacing the reminder in skills other than status/install.
</domain>

<decisions>
## Implementation Decisions

### Skill <-> CLI Contract: Banner Formatting Owner
- **Decision:** CLI emits the formatted banner via a single `display update-reminder` command. Skills call it with no arguments and parse no output -- the command prints the banner when stale (and TTY/NO_UPDATE_NOTIFIER conditions allow), and prints nothing when fresh.
- **Rationale:** Centralizes TTY/NO_COLOR/format logic in one Node.js location, matches the existing `display banner` pattern, and keeps skills as thin orchestrators. Pure-data skills are harder to test for banner formatting concerns; a single Node command is unit-testable end-to-end.

### Skill <-> CLI Contract: Check Invocation Point
- **Decision:** Explicit deferred call. Each skill (`status`, `install`) ends its execution with one `node "${RAPID_TOOLS}" display update-reminder` invocation as the final bash block, after all normal output.
- **Rationale:** Predictable, isolated, and easy to enforce the deferred-display invariant in tests. Auto-embedding into `state get --all` would pollute existing CLI output and risks double-emission across skills that already call `state get` multiple times.

### Banner Format & Tone: Visual Style
- **Decision:** Minimal one-liner. Format: `[RAPID] Your install is N days old. Run /rapid:install to refresh.` Single dim line, no borders, no banner block.
- **Rationale:** The check is purely time-based (no remote version lookup), so the tone should be a gentle nudge -- not a workflow-stage announcement. A bordered or branded banner would feel disproportionate to the information and visually compete with RAPID's actual stage banners.

### Banner Format & Tone: Call to Action
- **Decision:** Single canonical action -- `/rapid:install`. The banner does not detect install method or include suppression hints inline.
- **Rationale:** `/rapid:install` already handles re-bootstrap for both marketplace and clone installs, so a single command is sufficient. Method-aware text would require duplicating setup.sh's detection logic in the banner emitter for marginal gain. Suppression hints are documented (CONTRACT behavioral invariant) but excluded from the banner to keep it short.

### Threshold & Suppression: Threshold Configuration
- **Decision:** Default threshold of 7 days, overridable via `RAPID_UPDATE_THRESHOLD_DAYS` env var. No CLI flag.
- **Rationale:** Env var matches the `NO_UPDATE_NOTIFIER` suppression convention -- one consistent configuration mechanism for the whole feature. CLI flag is YAGNI: programmatic users can already set the env var inline.

### Threshold & Suppression: Snooze Mechanism
- **Decision:** No snooze. The only suppression mechanism is `NO_UPDATE_NOTIFIER` (all-or-nothing).
- **Rationale:** Matches the canonical update-notifier convention. Snooze would require a `snoozedUntil` field, a CLI snooze command, and additional tests -- too much surface area for v6.2.0.

### Meta File Location & Lifecycle: Storage Location
- **Decision:** Store `.rapid-install-meta.json` at plugin root, next to `package.json`. Resolve plugin root via the existing `version.cjs` convention; never write inside `.rapid-worktrees/`.
- **Rationale:** Matches SET-OVERVIEW guidance. In marketplace installs, the plugin lives in `~/.claude/plugins/cache` and may be replaced on upgrade -- but a fresh install legitimately deserves a fresh timestamp, so the wipe-on-upgrade behavior is correct, not a bug.

### Meta File Location & Lifecycle: Gitignore Handling
- **Decision:** Add `.rapid-install-meta.json` to `.gitignore` as part of this set's work.
- **Rationale:** The file is per-user (each developer has a different install timestamp). Without gitignoring, the first commit risks accidentally capturing a local timestamp and creating ongoing churn. One-line addition with no downside.
</decisions>

<specifics>
## Specific Ideas

- The `display update-reminder` command should print absolutely nothing (not even a newline) when the install is fresh, when stdout is not a TTY, or when `NO_UPDATE_NOTIFIER` is set -- so calling it as the last line of a skill never disrupts the previous output.
- Banner literal format: `[RAPID] Your install is N days old. Run /rapid:install to refresh.` -- where N is the integer day count. The banner respects `NO_COLOR`: dim styling only when colors are allowed.
- `writeInstallTimestamp` should be called on the success path of setup.sh only, after all 8 steps complete (after the systemd service file generation), so a partial install does not record a timestamp.
- `readInstallTimestamp` returns `null` for missing or malformed files. `isUpdateStale` returns `false` when the timestamp is `null` (fail-safe default: pre-feature installs are not considered stale).
- `isUpdateStale(pluginRoot, thresholdDays)` reads `RAPID_UPDATE_THRESHOLD_DAYS` env var when the `thresholdDays` argument is omitted; explicit argument always wins over env var. Default fallback is 7.
- Tests in `tests/version.test.cjs` should cover: happy path write+read roundtrip, missing file (returns null), expired threshold (stale=true), under threshold (stale=false), custom threshold via argument, custom threshold via env var, malformed JSON (returns null, no throw), NO_UPDATE_NOTIFIER suppression, non-TTY suppression, NO_COLOR styling.
</specifics>

<code_context>
## Existing Code Insights

- `src/lib/version.cjs` currently exports `getVersion()` and `versionCheck()`. It already imports `compareVersions` from `prereqs.cjs`. Adding three more pure functions fits the module's existing shape.
- The plugin-root resolution pattern in `version.cjs` is `path.resolve(__dirname, '../../package.json')` (i.e., `src/lib/` is two levels deep from plugin root). New functions should follow the same convention.
- `setup.sh` is structured as 8 numbered steps with a clean success path at the bottom (`echo "=== Bootstrap Complete ==="`). The `writeInstallTimestamp` call should be inserted just before the Bootstrap Complete echo, after Step 8 (systemd service generation).
- `skills/status/SKILL.md` and `skills/install/SKILL.md` both already use the standard env-loading preamble pattern (`if [ -z "${RAPID_TOOLS:-}" ] && ...`). The new `display update-reminder` call should reuse this preamble at the end of each skill.
- RAPID has an existing `display banner` CLI pattern (`node "${RAPID_TOOLS}" display banner discuss-set`). The new `display update-reminder` command should live under the same `display` namespace in `rapid-tools.cjs` for consistency.
- The status skill's Step 4 ends with a "Run: `{action}`" guidance line. The reminder banner should be emitted AFTER any AskUserQuestion responses are collected -- as the very last line printed before the skill exits.
- The install skill's Step 5 ends with various exit messages like "RAPID v6.1.0 is ready. Happy building!" -- the reminder banner should be emitted after that final message.
- `.gitignore` will need a one-line addition. The file already exists at the repo root.
</code_context>

<deferred>
## Deferred Ideas

- **Method-aware CTA:** Detect marketplace vs clone install and tailor the suggested command (e.g., `git pull && /rapid:install` for clone users) -- deferred as future enhancement, single canonical action is sufficient for v6.2.0.
- **CLI threshold flag:** Add `--threshold-days` flag to `state install-meta` for one-off programmatic overrides -- deferred; env var covers the use case.
- **User-level meta file location:** Store `.rapid-install-meta.json` in `~/.config/rapid/` to survive plugin upgrades -- deferred; plugin root location is sufficient and a fresh install deserves a fresh timestamp.
- **Snooze / dismiss command:** Add `state install-meta --snooze 7d` and `snoozedUntil` field -- deferred; matches update-notifier convention to use only NO_UPDATE_NOTIFIER for suppression.
- **Reminder banner in additional skills:** Surface the reminder beyond status/install (e.g., in /rapid:help or /rapid:init) -- out of CONTRACT.json scope for this set.
</deferred>
