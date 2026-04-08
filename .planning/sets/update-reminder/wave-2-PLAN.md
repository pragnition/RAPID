# Wave 2 Plan: CLI Surface + Setup Hook

**Set:** update-reminder
**Wave:** 2 of 3
**Owner:** rapid-executor
**Estimated tasks:** 4
**Depends on:** Wave 1 (must be merged into the set branch first)

## Objective

Wire the wave-1 library primitives into the CLI and the install path:

1. Add a new `state install-meta` subcommand that returns JSON with the timestamp, staleness, and effective threshold.
2. Add a new `display update-reminder` subcommand that emits the deferred banner (or nothing) to stdout.
3. Register both new subcommands in the top-of-file `USAGE` text in `src/bin/rapid-tools.cjs`.
4. Add a `writeInstallTimestamp` hook to `setup.sh` so a fresh install records its install moment.

After this wave, the CLI is fully functional but no skill yet calls it -- that comes in wave 3.

## Notes for the Executor

- **The `display update-reminder` handler must NEVER throw out of `handleDisplay`.** Wrap the full body in `try { ... } catch (_err) { /* swallow */ }`. A staleness banner failure must never break a parent command's exit code.
- **`state install-meta` must NEVER throw on a missing meta file.** When `readInstallTimestamp` returns `null`, output `{"timestamp": null, "isStale": false, "thresholdDays": 7}` and exit 0.
- **`setup.sh` runs under `set -euo pipefail`** (line 4). The `node -e` install hook MUST use `|| echo "..."` to swallow errors -- otherwise a write failure aborts the entire install path. This is mandatory.
- **Plugin-root resolution differs by file location**:
  - `src/commands/state.cjs` -- `path.resolve(__dirname, '../..')` (commands/ is one level deeper than lib/, so two `..` reach plugin root).
  - `src/commands/display.cjs` -- same: `path.resolve(__dirname, '../..')`.
  - Both are in `src/commands/`, so both use `'../..'`. Verify with `__dirname` math: `<root>/src/commands/` + `'../..'` = `<root>/`. Correct.
- **Files NOT in CONTRACT.json `ownedFiles` that this wave still owns:** `src/commands/state.cjs`, `src/commands/display.cjs`, `src/bin/rapid-tools.cjs`. The contract is incomplete; the planner has authorized these edits as part of the technical decomposition.

## File Ownership

This wave creates or modifies exactly these files. No other files may be touched in wave 2.

| File | Action |
|------|--------|
| `src/commands/state.cjs` | Modify -- add `install-meta` case to the switch statement |
| `src/commands/display.cjs` | Modify -- add `update-reminder` case to the switch statement |
| `src/bin/rapid-tools.cjs` | Modify -- add two lines to `USAGE` help text |
| `setup.sh` | Modify -- insert `writeInstallTimestamp` hook before "Bootstrap Complete" |

## Tasks

### Task 1: Add `state install-meta` subcommand

**File:** `src/commands/state.cjs` (currently 203 lines)

**Step 1.1 -- Insert a new case in the `switch (subcommand)` statement.** The switch starts at line 10. There are existing cases: `get`, `transition`, `add-milestone`, `add-set`, `detect-corruption`, `recover`, then a `default` at line 193. Insert a new `install-meta` case immediately BEFORE the `default` (i.e., after the `recover` case which closes around line 191):

```js
case 'install-meta': {
  const path = require('path');
  const { readInstallTimestamp, isUpdateStale } = require('../lib/version.cjs');
  const pluginRoot = path.resolve(__dirname, '../..');
  const timestamp = readInstallTimestamp(pluginRoot);
  const isStale = isUpdateStale(pluginRoot);
  const envOverride = parseInt(process.env.RAPID_UPDATE_THRESHOLD_DAYS, 10);
  const thresholdDays = Number.isFinite(envOverride) && envOverride > 0 ? envOverride : 7;
  process.stdout.write(JSON.stringify({ timestamp, isStale, thresholdDays }, null, 2) + '\n');
  break;
}
```

The `path` require is local (intentional -- mirrors the local-require pattern in other cases). Do NOT hoist it to the top of the file.

**Step 1.2 -- Verify the structural placement.** The new case must sit inside the `try { switch (subcommand) { ... } } catch (err) { ... }` block at the top of `handleState`. The `try`/`catch` already coerces non-CliError exceptions to `CliError`, so on a `readInstallTimestamp` returning `null` the case still produces valid JSON output -- no exception path is needed.

### Task 2: Add `display update-reminder` subcommand

**File:** `src/commands/display.cjs` (currently 42 lines)

**Step 2.1 -- Update the destructured require on line 6** from:

```js
const { renderBanner, renderFooter } = require('../lib/display.cjs');
```

to:

```js
const { renderBanner, renderFooter, renderUpdateReminder } = require('../lib/display.cjs');
```

**Step 2.2 -- Insert a new case** in the `switch (subcommand)` block, between the existing `footer` case (closes around line 35) and the `default` case (line 36):

```js
case 'update-reminder': {
  // Deferred update reminder banner. Must NEVER throw -- a banner failure
  // must not break the exit code of the parent command. Swallow all errors.
  try {
    const path = require('path');
    const pluginRoot = path.resolve(__dirname, '../..');
    const output = renderUpdateReminder(pluginRoot);
    if (output) {
      process.stdout.write(output + '\n');
    }
    // If output is empty (fresh install, non-TTY, suppressed) write nothing,
    // not even a bare newline. Caller skills depend on this.
  } catch (_err) {
    // Swallow -- never throw out of update-reminder
  }
  break;
}
```

### Task 3: Register the new subcommands in `USAGE`

**File:** `src/bin/rapid-tools.cjs` (currently 401 lines)

**Step 3.1 -- Add `state install-meta` to the Planning section** of the `USAGE` template literal (which spans lines 30-154).

Find the line:

```
  state recover                                       Recover STATE.json from git
```

(currently line 59). Insert immediately after it:

```
  state install-meta                                  Show install timestamp and staleness as JSON
```

**Step 3.2 -- Add `display update-reminder` to the Utilities section.**

Find the line:

```
  display footer <next-cmd> [--breadcrumb "<text>"] [--no-clear]  Display next-step footer box
```

(currently line 123). Insert immediately after it:

```
  display update-reminder           Display deferred update reminder banner (TTY-only, suppressible via NO_UPDATE_NOTIFIER)
```

These two additions are documentation only; no dispatch code in `rapid-tools.cjs` itself needs to change because `state` and `display` already route through `handleState` and `handleDisplay` -- the new subcommands are picked up automatically by the existing dispatch.

### Task 4: Add the `writeInstallTimestamp` hook to `setup.sh`

**File:** `setup.sh` (currently 178 lines)

**Step 4.1 -- Insert the install hook after Step 8 closes and before "=== Bootstrap Complete ===".**

Locate this region (currently lines 169-174):

```bash
else
    echo "  [skip] Service template not found"
fi

echo ""
echo "=== Bootstrap Complete ==="
```

Replace it with:

```bash
else
    echo "  [skip] Service template not found"
fi

# Record install timestamp for update reminder (non-fatal -- guarded with || echo
# because set -euo pipefail is active and would otherwise abort the script).
node -e "require('$SCRIPT_DIR/src/lib/version.cjs').writeInstallTimestamp('$SCRIPT_DIR')" 2>/dev/null \
  || echo "  WARNING: Could not record install timestamp (non-fatal)"

echo ""
echo "=== Bootstrap Complete ==="
```

The `|| echo` is REQUIRED. Do not remove it. Without it, a write failure on the meta file would propagate via `set -e` and abort the install -- the exact opposite of "non-fatal".

The 2>/dev/null suppresses node's stderr in the success path; the `|| echo` provides a clean human-readable warning on failure.

## Verification

Run all of the following from `/home/kek/Projects/RAPID`. Each must exit 0 (the smoke tests must produce the documented output shape).

**Step A -- Test suite still passes.**

```bash
npm test
```

**Step B -- `state install-meta` smoke test (fresh install case).**

```bash
rm -f /home/kek/Projects/RAPID/.rapid-install-meta.json
node src/bin/rapid-tools.cjs state install-meta
```

Expected output (exact JSON shape, timestamp will be null):

```json
{
  "timestamp": null,
  "isStale": false,
  "thresholdDays": 7
}
```

Exit code 0.

**Step C -- `state install-meta` smoke test (recorded install case).**

```bash
node -e "require('./src/lib/version.cjs').writeInstallTimestamp('/home/kek/Projects/RAPID')"
node src/bin/rapid-tools.cjs state install-meta
```

Expected output -- a JSON object with a non-null `timestamp` (an ISO 8601 string), `isStale: false`, `thresholdDays: 7`. Exit code 0.

**Step D -- `display update-reminder` smoke test (fresh install -- no output).**

```bash
node src/bin/rapid-tools.cjs display update-reminder
```

Expected: empty stdout (no output, not even a newline). Exit code 0.

**Step E -- `display update-reminder` smoke test (stale install, NO_COLOR).**

```bash
node -e "
const fs = require('fs');
const ts = new Date(Date.now() - 8 * 86400000).toISOString();
fs.writeFileSync('/home/kek/Projects/RAPID/.rapid-install-meta.json', JSON.stringify({installedAt: ts}));
"
NO_COLOR=1 node src/bin/rapid-tools.cjs display update-reminder
```

Expected: a single line beginning with `[RAPID] Your install is` and ending with `Run /rapid:install to refresh.`. No ANSI codes (because `NO_COLOR=1`). Exit code 0.

**Step F -- `display update-reminder` smoke test (suppression works).**

```bash
NO_UPDATE_NOTIFIER=1 node src/bin/rapid-tools.cjs display update-reminder
```

Expected: empty stdout. Exit code 0.

**Step G -- `display update-reminder` smoke test (non-TTY suppression).**

```bash
node src/bin/rapid-tools.cjs display update-reminder | cat
```

The pipe to `cat` makes stdout non-TTY. Expected: empty output through the pipe. Exit code 0.

**Step H -- USAGE help renders both new lines.**

```bash
node src/bin/rapid-tools.cjs --help 2>&1 | grep -E "(state install-meta|display update-reminder)"
```

Expected: two lines printed -- one for each new subcommand. Exit code 0 (grep finds matches).

**Step I -- Cleanup the test fixture.**

```bash
rm -f /home/kek/Projects/RAPID/.rapid-install-meta.json
```

**Step J -- setup.sh hook structural check (do NOT actually run setup.sh).**

```bash
grep -n "writeInstallTimestamp" /home/kek/Projects/RAPID/setup.sh
```

Expected: at least one matching line, located between Step 8 and "Bootstrap Complete". Exit code 0.

## Success Criteria

- `node src/bin/rapid-tools.cjs state install-meta` returns valid JSON in both fresh and recorded cases (Steps B and C pass).
- `node src/bin/rapid-tools.cjs display update-reminder` produces no output on a fresh install (Step D), the formatted banner on a stale install (Step E), no output when suppressed (Steps F and G), and never throws.
- `npm test` exits 0 (existing tests still green; this wave does not add new test files).
- `--help` lists both new subcommands (Step H passes).
- `setup.sh` contains a guarded `writeInstallTimestamp` hook between Step 8 and "Bootstrap Complete" (Step J passes).
- `git diff --stat` shows exactly four files changed: `src/commands/state.cjs`, `src/commands/display.cjs`, `src/bin/rapid-tools.cjs`, `setup.sh`.
- The `.rapid-install-meta.json` test fixture is cleaned up (Step I).
