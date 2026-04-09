# VERIFICATION-REPORT: update-reminder

**Set:** update-reminder
**Waves verified:** wave-1, wave-2, wave-3
**Verified:** 2026-04-07
**Verdict:** PASS_WITH_GAPS

## Summary

All three wave plans are structurally sound, coverage is complete, file ownership is disjoint, and the CONTRACT.json exports are fully implemented with matching signatures. The wave dependency chain (1 -> 2 -> 3) is explicit. Verification commands are syntactically runnable.

Three gaps were identified, none of which block execution:

1. **Wave 1 Task 4 Step 4.2 is based on a factually wrong assumption about `src/lib/display.test.cjs`** -- the existing file has no destructured `require('./display.cjs')` line to extend; it uses an indirect `const displayPath = require('path').join(...)` + `require(displayPath)` pattern. The plan's Step 4.3 test body calls `renderUpdateReminder(tmpRoot)` as a bare symbol, so the executor must still add an import. This is an instruction ambiguity, not a structural defect.
2. **Minor line-number drift** between several plan citations and the actual files (off by 1 in `version.test.cjs` 101 vs actual 102, `display.cjs` 197 vs actual 196 for the exports line, `skills/install/SKILL.md` "ends at line 331" not 332, `setup.sh` 169-174 range is shifted by 1). No plan instruction is *wrong* -- the anchors (e.g. "immediately after `versionCheck`", "before `module.exports`", "after `recover` case", "after Step 8") are all correct -- but the line numbers are stale. An anchor-based executor will not be misled.
3. **CONTRACT.json `ownedFiles` list is incomplete.** All three waves touch files not in the contract (`src/lib/display.cjs`, `src/lib/display.test.cjs`, `src/commands/state.cjs`, `src/commands/display.cjs`, `src/bin/rapid-tools.cjs`, `.gitignore`). Each wave's "Notes for the Executor" explicitly documents the expansion and cites planner authorization, so this is a transparent, deliberate divergence -- acceptable, but recorded here for the merge reviewer.

**Verdict rationale:** PASS_WITH_GAPS because the plan is executable as-is and all three gaps are either self-documenting (divergences) or corrected by a competent executor reading the anchors (line drift, import wiring). A FAIL would require a structural flaw that blocks execution; none exists. A full PASS would require Gap #1 to be resolved in the plan text.

## Wave 1 Findings -- Library Primitives + Tests

### Strengths
- Function signatures in the plan (`writeInstallTimestamp(pluginRoot)`, `readInstallTimestamp(pluginRoot)`, `isUpdateStale(pluginRoot, thresholdDays)`) **exactly match** CONTRACT.json.
- `isUpdateStale` correctly handles all three branches:
  - `null` timestamp returns `false` (fail-safe).
  - Explicit `thresholdDays` beats env var (plan lines 116-122, test case line 292-301 covers this explicitly).
  - Env var `RAPID_UPDATE_THRESHOLD_DAYS` beats default when arg is undefined.
  - Includes a defensive `Number.isNaN` guard on the parsed date.
- `readInstallTimestamp` wraps in try/catch and returns null on missing file, parse error, OR missing field (`parsed.installedAt` type check).
- `renderUpdateReminder` enforces the documented gating order: TTY first, then `NO_UPDATE_NOTIFIER`, then timestamp read, then staleness check, then `NO_COLOR` formatting branch.
- Lazy-require of `version.cjs` inside `renderUpdateReminder` is correctly justified (prevents display.cjs from pulling fs into its require graph on module load).
- 16 test cases are all specified (10 in `version.test.cjs` + 6 in `display.test.cjs`).
- Explicit-arg-vs-env-var precedence is covered in the test plan (`it('isUpdateStale -- explicit arg wins over env var', ...)`).
- Malformed JSON case is covered (`it('readInstallTimestamp returns null for malformed JSON (no throw)', ...)`).
- No time-mocking: staleness is induced by writing a real timestamp 8 days in the past. Not flaky because the threshold (7 days) and the offset (8 days) have a 1-day margin -- a test run cannot cross the boundary.

### Gaps / Drift
- **[GAP-1] Task 4 Step 4.2 instruction mismatch with actual file.** The plan says: "Pull `renderUpdateReminder` into the destructure from `./display.cjs`. Locate the existing `require('./display.cjs')` line and add `renderUpdateReminder` to the destructured names." The actual `src/lib/display.test.cjs` uses:
  ```js
  const displayPath = require('path').join(__dirname, 'display.cjs');
  // ... inside tests: display = require(displayPath); display.renderBanner(...)
  ```
  There is no destructured require to extend. The Step 4.3 test body calls `renderUpdateReminder(tmpRoot)` as a bare symbol (implying an import). The executor must add a new line such as:
  ```js
  const { renderUpdateReminder } = require('./display.cjs');
  ```
  near the top of the file. The plan does not say this explicitly. **Recommended plan edit:** replace Step 4.2 with "Add a new top-level destructured require: `const { renderUpdateReminder } = require('./display.cjs');`. Do not modify the existing `displayPath` pattern used by other tests."
- **[DRIFT-1] Line 101 citation for `version.test.cjs`** -- actual file is 102 lines (trailing blank). "Append after line 101" is understood as "append at end of file", which is correct.
- **[DRIFT-2] Line 197 citation for `display.cjs` `module.exports`** -- actual file has `module.exports = { ... }` on line 196, trailing blank at 197. Plan says 196 in one place and 197 in another. Both refer to the same anchor. Anchor resolution is unambiguous.
- **[EXPANSION-1]** `src/lib/display.cjs` and `src/lib/display.test.cjs` are not in CONTRACT.json `ownedFiles`. Wave-1 plan lines 22 and 34 explicitly document the expansion and planner authorization. Acceptable.
- **[EXPANSION-2]** Tests are written to `src/lib/version.test.cjs` instead of CONTRACT.json's `tests/version.test.cjs`. Wave-1 plan line 20 documents the rationale (package.json test glob is `src/**/*.test.cjs`). Acceptable.

### Verification Runnability
- `npm test` is valid.
- The node -e smoke probe is a self-contained one-liner that creates a tmp dir, exercises all three functions, and cleans up. Executable as-written.

## Wave 2 Findings -- CLI Surface + Setup Hook

### Strengths
- `state install-meta` handler in `src/commands/state.cjs` produces the documented JSON shape `{timestamp, isStale, thresholdDays}` and handles the null-timestamp case cleanly (JSON.stringify(null) -> "null", no special-casing needed).
- `display update-reminder` handler wraps the entire body in `try { ... } catch (_err) {}` satisfying the "must never throw" requirement.
- The handler correctly writes to stdout ONLY when `renderUpdateReminder` returns a non-empty string -- empty string path writes nothing, not even a bare newline. This is critical for fresh-install callers.
- `setup.sh` hook uses `|| echo ...` to swallow errors under `set -euo pipefail` and `2>/dev/null` to suppress node's stderr in the success path. Both guards are documented as mandatory.
- Plugin-root resolution via `path.resolve(__dirname, '../..')` is correct for both `src/commands/state.cjs` and `src/commands/display.cjs` (commands/ is at `<root>/src/commands/`, two parent dirs reach `<root>`).
- 10 smoke test steps (A-J) cover: test suite, fresh/recorded JSON, fresh banner (no output), stale banner with NO_COLOR, NO_UPDATE_NOTIFIER suppression, non-TTY (`| cat`) suppression, USAGE help grep, setup.sh grep, cleanup.
- Cross-wave consistency: Wave 2 imports `renderUpdateReminder` from `../lib/display.cjs`, and Wave 1 Task 3 Step 3.3 updates `module.exports` to include `renderUpdateReminder`. The symbol name and source file match.
- USAGE additions (2 lines) are placed under the correct sections (Planning for `state install-meta`, Utilities for `display update-reminder`). No dispatch code change needed because `state` and `display` already route through their handlers.

### Gaps / Drift
- **[DRIFT-3] `src/commands/state.cjs` line numbers** -- plan says "switch starts at line 10", "default at line 193", "recover case closes around line 191". Actual file: default at line 193, recover case ends at 191. Exact match.
- **[DRIFT-4] `src/commands/display.cjs` line numbers** -- plan says "footer case closes around line 35, default at line 36". Actual: footer case closes at 35, default at 36. Exact match.
- **[DRIFT-5] `src/bin/rapid-tools.cjs`** -- plan says "currently 401 lines" and "USAGE template literal spans lines 30-154". Actual file is 400 lines. Within noise.
- **[DRIFT-6] `setup.sh`** -- plan says "currently 178 lines", "lines 169-174" for the insertion region. Actual file is 177 lines; the region `else / echo "  [skip]..." / fi / "" / "=== Bootstrap Complete ==="` sits at lines 169-174. The anchor ("after Step 8 closes and before Bootstrap Complete") is unambiguous.
- **[EXPANSION-3]** `src/commands/state.cjs`, `src/commands/display.cjs`, and `src/bin/rapid-tools.cjs` are not in CONTRACT.json `ownedFiles`. Wave-2 plan line 29 documents the expansion and planner authorization. Acceptable.

### Verification Runnability
- All 10 smoke test steps are executable as-written. Step G (`| cat` to force non-TTY) is the only subtle test and is correctly framed.
- Step B forcibly removes any pre-existing `.rapid-install-meta.json` before the test, which is hygienic.
- Step I cleans up the fixture so subsequent waves (and commit) see a clean tree.
- One observation: Step E tests a stale banner with `NO_COLOR=1`. There is no symmetric test for the ANSI-coded stale banner in wave 2 (it's only tested at the unit level in wave 1). This is acceptable because Wave 1 Task 4 already tests the ANSI path in `display.test.cjs`.

## Wave 3 Findings -- Skill Integration + .gitignore

### Strengths
- The bash block is inserted as the **last** instruction before "Important Notes" in the status skill, and as the **last** step entirely in the install skill. Both placements respect the "deferred banner after primary output" invariant.
- The standard RAPID env-preamble is used, supporting both harness-invoked and manual invocation paths.
- `.gitignore` entry is added in a thematically appropriate location (after the `.env` block, with a matching `# RAPID install metadata...` comment header).
- Cross-wave consistency: Wave 3 calls `node "${RAPID_TOOLS}" display update-reminder` and Wave 2 Task 2 implements that exact subcommand name. Match verified.
- The verification plan includes `git check-ignore` to confirm the gitignore entry is active, not just present textually -- good depth.
- Step H is a full end-to-end smoke that exercises Wave 1 (library), Wave 2 (CLI), and Wave 3 (gitignore) together. Strong integration test.
- Step J (`git status --short`) enforces clean-tree discipline so the fixture file cannot leak into the final commit.

### Gaps / Drift
- **[DRIFT-7] `skills/status/SKILL.md`** -- plan says "currently 252 lines, line 244 ends Step 4 fallback, line 245 starts Important Notes". Actual file is 251 lines. Line 243 ends the fallback, line 245 starts "## Important Notes". Anchor-wise the plan's instruction ("insert immediately after the fallback content and before Important Notes") is correct.
- **[DRIFT-8] `skills/install/SKILL.md`** -- plan says "currently 332 lines, Step 5 currently ends at line 331". Actual file is 331 lines total, with line 331 being the final `If "Done"` line. The plan's "append after that line" is still correct.
- **[DRIFT-9] `.gitignore`** -- plan says "currently 33 lines". Actual is 32. The insertion anchor (`.env` block) resolves correctly.
- **[EXPANSION-4]** `.gitignore` is not in CONTRACT.json `ownedFiles`. Wave-3 plan line 24 documents the expansion. Acceptable.

### Verification Runnability
- All 10 verification steps (A-J) are executable as-written.
- Step G correctly creates a fixture before testing `git check-ignore` (otherwise check-ignore might not probe a nonexistent path in all git versions).
- Step J correctly expects the diff to contain only wave-3 files. The fixture is cleaned up in Step I before this check.
- One subtle point: Step H uses absolute paths, consistent with RAPID shell conventions from CLAUDE.md. Correct.

## Structural Properties Checklist

### File Ownership Uniqueness
No file appears in two wave "File Ownership" tables.

| File | Wave |
|---|---|
| `src/lib/version.cjs` | 1 |
| `src/lib/version.test.cjs` | 1 |
| `src/lib/display.cjs` | 1 |
| `src/lib/display.test.cjs` | 1 |
| `src/commands/state.cjs` | 2 |
| `src/commands/display.cjs` | 2 |
| `src/bin/rapid-tools.cjs` | 2 |
| `setup.sh` | 2 |
| `skills/status/SKILL.md` | 3 |
| `skills/install/SKILL.md` | 3 |
| `.gitignore` | 3 |

**Status: PASS.** 11 files total, each owned by exactly one wave.

### CONTRACT.json Export Coverage

| Contract export | Implementation | Signature match | Wave |
|---|---|---|---|
| `writeInstallTimestamp(pluginRoot: string): void` | `src/lib/version.cjs` | exact | 1 |
| `readInstallTimestamp(pluginRoot: string): string \| null` | `src/lib/version.cjs` | exact | 1 |
| `isUpdateStale(pluginRoot: string, thresholdDays?: number): boolean` | `src/lib/version.cjs` | exact | 1 |
| `install-meta-subcommand` (CLI: `state install-meta`) | `src/commands/state.cjs` | exact | 2 |

**Status: PASS.** All four exports are implemented with signatures that match the CONTRACT.json text exactly.

### Behavioral Invariant Coverage

| Invariant | Code coverage | Test coverage |
|---|---|---|
| `deferred-display` | Skills insert bash block as LAST instruction (wave 3 Tasks 1-2) | Wave-3 Step D grep enforces "LAST Step heading" for install skill |
| `tty-only` | `if (!process.stdout.isTTY) return '';` first check in `renderUpdateReminder` (wave 1 Task 3) | `it('returns empty string when stdout is not a TTY', ...)` in wave 1 Task 4 + wave 2 Step G (`\| cat` pipe) |
| `suppressible` | `NO_UPDATE_NOTIFIER` env check in `renderUpdateReminder` (wave 1 Task 3) | `it('returns empty string when NO_UPDATE_NOTIFIER is set', ...)` wave 1 + wave 2 Step F |
| `no-color-respect` | `NO_COLOR` branch in `renderUpdateReminder` (wave 1 Task 3) | `it('returns plain banner when NO_COLOR is set', ...)` wave 1 + wave 2 Step E |

**Status: PASS.** Every behavioral invariant is covered in both code and tests.

### Wave Dependency Ordering
- Wave 2 declares `**Depends on:** Wave 1 (must be merged into the set branch first)` -- wave-2-PLAN.md line 7.
- Wave 3 declares `**Depends on:** Wave 2 (must be merged into the set branch first)` -- wave-3-PLAN.md line 7.
- Wave 1 has no declared dependency (correctly; it is the root).

**Status: PASS.** Dependency chain is linear 1 -> 2 -> 3, explicitly declared.

### Cross-Wave Symbol Consistency
- Wave 2 `src/commands/display.cjs` imports `renderUpdateReminder` from `../lib/display.cjs`. Wave 1 `src/lib/display.cjs` exports it. **Match.**
- Wave 3 `skills/*/SKILL.md` invokes `node "${RAPID_TOOLS}" display update-reminder`. Wave 2 `src/commands/display.cjs` registers the `update-reminder` case. **Match.**
- Wave 2 `state install-meta` returns `{timestamp, isStale, thresholdDays}`. This is a documented JSON shape that downstream callers would parse; no other wave parses it, but the shape is consistent across the plan text (both Step B and Step C expected output blocks use the same keys).

**Status: PASS.**

## Gaps (Summary)

| ID | Severity | Wave | Description | Fix |
|---|---|---|---|---|
| GAP-1 | Minor | 1 | Task 4 Step 4.2 describes a destructured require pattern that does not exist in `src/lib/display.test.cjs` | Replace with: "Add a new top-level import `const { renderUpdateReminder } = require('./display.cjs');`" |
| DRIFT-1..9 | Trivial | 1,2,3 | Line-number citations drift by 0-1 lines from current HEAD | Not blocking; anchor descriptions resolve correctly |
| EXPANSION-1..4 | Documented | 1,2,3 | Files outside CONTRACT.json `ownedFiles` are modified | Each wave explicitly documents the expansion; acceptable |

## Recommendations for the Executor

1. **Wave 1 Task 4 Step 4.2:** Do NOT look for an existing destructured `require('./display.cjs')` line -- there isn't one. Instead, add a NEW top-level line near the other requires: `const { renderUpdateReminder } = require('./display.cjs');`. Leave the existing `const displayPath = require('path').join(...)` pattern alone -- other tests depend on it.
2. **Wave 1 Task 4 Step 4.1:** Also ensure `path`, `fs`, `os`, `beforeEach`, `afterEach` are imported -- none of them are in the current top-of-file imports.
3. **Line-number drift:** Use the anchor descriptions (e.g. "after `versionCheck`", "before `module.exports`", "after `recover` case") rather than the raw line numbers when locating insertion points. The plan's anchors are all correct; the line numbers may have shifted by 1.
4. **Wave 2 Task 4:** The `|| echo ...` guard in `setup.sh` is mandatory -- do not remove it even if the command seems reliable. `set -euo pipefail` will otherwise abort the install on a non-fatal write error.
5. **Wave 3 Step G:** If you test `git check-ignore` against the fixture file, remember that `git check-ignore` exits 1 (not 0) if the file is NOT ignored. Your test expects exit 0, meaning the file IS ignored -- that's the assertion direction.
6. **Fixture cleanup:** Run `rm -f .rapid-install-meta.json` at the end of each wave's smoke tests. Step I of waves 2 and 3 enforces this. Do not commit the fixture.
7. **Plan digest:** When the plan says "currently N lines" in a file header comment, that is an as-of-planning-time snapshot. Do not treat it as a precondition -- read the file live and anchor to the stated landmarks instead.

## Failing Jobs

None of the three waves have FAIL-level issues. Gaps are plan-documentation-level (GAP-1) or drift-level (DRIFT-1..9), both of which a competent executor can resolve from the anchor descriptions.

```
failingJobs: []
```

## Verdict

**PASS_WITH_GAPS** -- The plan is executable. Gap #1 (Wave 1 Task 4 Step 4.2 assumption mismatch) should be noted to the executor but does not block execution since the anchor ("append a new describe block at the very end of the file") and the test body (which calls `renderUpdateReminder(tmpRoot)` as a bare symbol) jointly imply the correct action: add a new destructured import.
