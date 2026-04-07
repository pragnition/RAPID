# Wave 1 Plan: Library Primitives + Tests

**Set:** update-reminder
**Wave:** 1 of 3
**Owner:** rapid-executor
**Estimated tasks:** 4

## Objective

Implement the staleness-detection primitives in pure-library form (no I/O wiring, no CLI surface yet) so that downstream waves can simply call into them. This wave produces:

1. Three new exports in `src/lib/version.cjs` -- `writeInstallTimestamp`, `readInstallTimestamp`, `isUpdateStale` -- backed by a `.rapid-install-meta.json` file at the plugin root.
2. A new `renderUpdateReminder` helper in `src/lib/display.cjs` that formats the deferred banner with TTY/`NO_UPDATE_NOTIFIER`/`NO_COLOR` gating.
3. Test coverage for both, extending the existing `version.test.cjs` and `display.test.cjs` files.

The wave is "library only" -- nothing in this wave is invoked yet by setup.sh, the CLI, or any skill. That comes in waves 2 and 3.

## Notes for the Executor

- **CONTRACT.json path divergence (acknowledge, don't fight it).** `CONTRACT.json` `definition.ownedFiles` lists the test file as `tests/version.test.cjs`. That path is **wrong** for this codebase: `package.json` `test` script uses `node --test 'src/**/*.test.cjs'`, which only collects tests under `src/**`. A test file at `tests/version.test.cjs` would never run. The dominant convention here is tests next to source (`src/lib/version.test.cjs` already exists with 101 lines). **Extend `src/lib/version.test.cjs` -- do NOT create a new file at `tests/version.test.cjs`.** This deviation is deliberate and pre-approved by the planner.
- **Why `renderUpdateReminder` lives in `src/lib/display.cjs`, not `version.cjs`:** keeping all ANSI formatting in one file prevents `version.cjs` from pulling in display dependencies. `version.cjs` stays a thin data layer; `display.cjs` owns all terminal rendering.
- **Files NOT in CONTRACT.json `ownedFiles` that this wave still owns:** `src/lib/display.cjs`, `src/lib/display.test.cjs`. The contract's `ownedFiles` list is incomplete; the planner has authorized this expansion based on the technical decomposition.
- **No mocking libraries are used in this codebase.** Tests use Node built-ins (`node:test`, `node:assert/strict`) and real filesystem isolation via `fs.mkdtempSync`. Do not introduce sinon/jest/etc.
- **Do not mock time.** To test staleness, craft a meta file by hand with `installedAt: new Date(Date.now() - 8 * 86400000).toISOString()`.

## File Ownership

This wave creates or modifies exactly these files. No other files may be touched in wave 1.

| File | Action |
|------|--------|
| `src/lib/version.cjs` | Modify -- add `fs` import, constants, three new functions, update `module.exports` |
| `src/lib/version.test.cjs` | Modify -- append a new `describe` block with 10 test cases |
| `src/lib/display.cjs` | Modify -- add `dim` to `ANSI`, add `renderUpdateReminder`, update `module.exports` |
| `src/lib/display.test.cjs` | Modify -- append a new `describe` block with 6 test cases |

## Tasks

### Task 1: Extend `src/lib/version.cjs` with staleness primitives

**File:** `src/lib/version.cjs` (currently 35 lines)

**Step 1.1 -- Add `fs` to imports.**

After line 3 (`const path = require('path');`), insert:

```js
const fs = require('fs');
```

**Step 1.2 -- Add module-level constants.**

Immediately after the `compareVersions` import (current line 4), add:

```js
const META_FILENAME = '.rapid-install-meta.json';
const DEFAULT_THRESHOLD_DAYS = 7;
```

**Step 1.3 -- Add three new functions between `versionCheck` and `module.exports`.**

Insert these three functions immediately after the closing `}` of `versionCheck` (currently line 29) and before `module.exports` (currently line 31):

```js
/**
 * Write the current ISO 8601 install timestamp to .rapid-install-meta.json
 * at the given plugin root. Overwrites any existing file. Throws on I/O failure
 * -- callers (e.g. setup.sh) are responsible for guarding.
 *
 * @param {string} pluginRoot - Absolute path to plugin root (parent of src/)
 * @returns {void}
 */
function writeInstallTimestamp(pluginRoot) {
  const metaPath = path.join(pluginRoot, META_FILENAME);
  const payload = JSON.stringify({ installedAt: new Date().toISOString() });
  fs.writeFileSync(metaPath, payload);
}

/**
 * Read the install timestamp from .rapid-install-meta.json at the given plugin
 * root. Returns null on missing file, parse error, or missing field. Never
 * throws -- this is a fail-safe read.
 *
 * @param {string} pluginRoot - Absolute path to plugin root
 * @returns {string | null} ISO 8601 timestamp or null
 */
function readInstallTimestamp(pluginRoot) {
  try {
    const metaPath = path.join(pluginRoot, META_FILENAME);
    const raw = fs.readFileSync(metaPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.installedAt === 'string' ? parsed.installedAt : null;
  } catch (_err) {
    return null;
  }
}

/**
 * Determine whether the recorded install is older than the staleness threshold.
 * Resolution order for the threshold:
 *   1. Explicit `thresholdDays` argument (if defined)
 *   2. RAPID_UPDATE_THRESHOLD_DAYS env var (if parseable as positive integer)
 *   3. DEFAULT_THRESHOLD_DAYS (7)
 *
 * Returns false when no timestamp is recorded (fail-safe -- a missing meta
 * file should never produce a staleness banner).
 *
 * @param {string} pluginRoot - Absolute path to plugin root
 * @param {number} [thresholdDays] - Optional explicit threshold in days
 * @returns {boolean} true if install is older than threshold
 */
function isUpdateStale(pluginRoot, thresholdDays) {
  const timestamp = readInstallTimestamp(pluginRoot);
  if (timestamp === null) return false;

  let threshold;
  if (thresholdDays !== undefined) {
    threshold = thresholdDays;
  } else {
    const envValue = parseInt(process.env.RAPID_UPDATE_THRESHOLD_DAYS, 10);
    threshold = Number.isFinite(envValue) && envValue > 0 ? envValue : DEFAULT_THRESHOLD_DAYS;
  }

  const installedAt = new Date(timestamp).getTime();
  if (Number.isNaN(installedAt)) return false;
  const ageDays = (Date.now() - installedAt) / 86400000;
  return ageDays > threshold;
}
```

**Step 1.4 -- Update `module.exports`.**

Replace the existing exports block:

```js
module.exports = {
  getVersion,
  versionCheck,
};
```

with:

```js
module.exports = {
  getVersion,
  versionCheck,
  writeInstallTimestamp,
  readInstallTimestamp,
  isUpdateStale,
};
```

### Task 2: Extend `src/lib/version.test.cjs` with 10 new test cases

**File:** `src/lib/version.test.cjs` (currently 101 lines)

**Step 2.1 -- Add `beforeEach`, `afterEach`, and `os` to the imports.**

Replace line 3:

```js
const { describe, it } = require('node:test');
```

with:

```js
const { describe, it, beforeEach, afterEach } = require('node:test');
```

After the existing `const fs = require('fs');` line (line 6), add:

```js
const os = require('os');
```

**Step 2.2 -- Update the destructuring import on line 8** from:

```js
const { getVersion, versionCheck } = require('./version.cjs');
```

to:

```js
const {
  getVersion,
  versionCheck,
  writeInstallTimestamp,
  readInstallTimestamp,
  isUpdateStale,
} = require('./version.cjs');
```

**Step 2.3 -- Append a new `describe` block at the end of the file.**

After line 101 (end of `version sync` describe block), append:

```js
// --- staleness primitives ---

describe('install timestamp primitives', () => {
  let tmpRoot;
  let originalEnv;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-version-test-'));
    originalEnv = process.env.RAPID_UPDATE_THRESHOLD_DAYS;
    delete process.env.RAPID_UPDATE_THRESHOLD_DAYS;
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    if (originalEnv === undefined) {
      delete process.env.RAPID_UPDATE_THRESHOLD_DAYS;
    } else {
      process.env.RAPID_UPDATE_THRESHOLD_DAYS = originalEnv;
    }
  });

  it('writeInstallTimestamp writes ISO 8601 string to .rapid-install-meta.json', () => {
    writeInstallTimestamp(tmpRoot);
    const metaPath = path.join(tmpRoot, '.rapid-install-meta.json');
    assert.ok(fs.existsSync(metaPath), '.rapid-install-meta.json should exist');
    const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    assert.match(parsed.installedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('readInstallTimestamp round-trips a freshly written timestamp', () => {
    writeInstallTimestamp(tmpRoot);
    const timestamp = readInstallTimestamp(tmpRoot);
    assert.ok(timestamp);
    assert.ok(!Number.isNaN(new Date(timestamp).getTime()));
  });

  it('readInstallTimestamp returns null for missing file (no throw)', () => {
    const result = readInstallTimestamp(tmpRoot);
    assert.equal(result, null);
  });

  it('readInstallTimestamp returns null for malformed JSON (no throw)', () => {
    fs.writeFileSync(path.join(tmpRoot, '.rapid-install-meta.json'), '{not valid json');
    const result = readInstallTimestamp(tmpRoot);
    assert.equal(result, null);
  });

  it('isUpdateStale returns false when no timestamp recorded', () => {
    assert.equal(isUpdateStale(tmpRoot), false);
  });

  it('isUpdateStale returns true for timestamp older than 7 days (default)', () => {
    const oldTimestamp = new Date(Date.now() - 8 * 86400000).toISOString();
    fs.writeFileSync(
      path.join(tmpRoot, '.rapid-install-meta.json'),
      JSON.stringify({ installedAt: oldTimestamp })
    );
    assert.equal(isUpdateStale(tmpRoot), true);
  });

  it('isUpdateStale returns false for timestamp younger than 7 days', () => {
    const recentTimestamp = new Date(Date.now() - 3 * 86400000).toISOString();
    fs.writeFileSync(
      path.join(tmpRoot, '.rapid-install-meta.json'),
      JSON.stringify({ installedAt: recentTimestamp })
    );
    assert.equal(isUpdateStale(tmpRoot), false);
  });

  it('isUpdateStale honors explicit thresholdDays argument', () => {
    const fiveDaysOld = new Date(Date.now() - 5 * 86400000).toISOString();
    fs.writeFileSync(
      path.join(tmpRoot, '.rapid-install-meta.json'),
      JSON.stringify({ installedAt: fiveDaysOld })
    );
    assert.equal(isUpdateStale(tmpRoot, 3), true, '5 days old > 3 day threshold');
    assert.equal(isUpdateStale(tmpRoot, 10), false, '5 days old < 10 day threshold');
  });

  it('isUpdateStale honors RAPID_UPDATE_THRESHOLD_DAYS env var when arg omitted', () => {
    const fiveDaysOld = new Date(Date.now() - 5 * 86400000).toISOString();
    fs.writeFileSync(
      path.join(tmpRoot, '.rapid-install-meta.json'),
      JSON.stringify({ installedAt: fiveDaysOld })
    );
    process.env.RAPID_UPDATE_THRESHOLD_DAYS = '3';
    assert.equal(isUpdateStale(tmpRoot), true);
    process.env.RAPID_UPDATE_THRESHOLD_DAYS = '10';
    assert.equal(isUpdateStale(tmpRoot), false);
  });

  it('isUpdateStale -- explicit arg wins over env var', () => {
    const fiveDaysOld = new Date(Date.now() - 5 * 86400000).toISOString();
    fs.writeFileSync(
      path.join(tmpRoot, '.rapid-install-meta.json'),
      JSON.stringify({ installedAt: fiveDaysOld })
    );
    process.env.RAPID_UPDATE_THRESHOLD_DAYS = '10';
    // Explicit arg of 3 should beat env var of 10
    assert.equal(isUpdateStale(tmpRoot, 3), true);
  });
});
```

### Task 3: Extend `src/lib/display.cjs` with `renderUpdateReminder`

**File:** `src/lib/display.cjs` (currently 197 lines)

**Step 3.1 -- Add `dim` to the `ANSI` constants object.**

Replace the existing block (lines 11-15):

```js
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  brightWhite: '\x1b[97m',
};
```

with:

```js
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  brightWhite: '\x1b[97m',
  dim: '\x1b[2m',
};
```

**Step 3.2 -- Add the `renderUpdateReminder` function** immediately before the `module.exports` line (currently line 196):

```js
/**
 * Render a deferred update-reminder banner. Designed to be called AFTER a
 * command's primary output, so the user sees the reminder without it
 * disrupting parsing/automation.
 *
 * Returns an empty string (caller should emit nothing) when:
 *   - the install is not stale,
 *   - stdout is not a TTY (piped/scripted contexts),
 *   - NO_UPDATE_NOTIFIER is set to any non-empty value, or
 *   - the timestamp can't be read.
 *
 * Respects NO_COLOR (https://no-color.org): when set to a non-empty value,
 * the banner is plain text. Otherwise it is wrapped in ANSI dim.
 *
 * @param {string} pluginRoot - Absolute path to plugin root
 * @returns {string} Banner string (with optional trailing reset) or empty string
 */
function renderUpdateReminder(pluginRoot) {
  // Suppression checks first -- cheapest, no I/O
  if (!process.stdout.isTTY) return '';
  if (process.env.NO_UPDATE_NOTIFIER !== undefined && process.env.NO_UPDATE_NOTIFIER !== '') {
    return '';
  }

  // Lazy-require version primitives to avoid pulling fs into display.cjs's
  // require graph at module load time.
  const { readInstallTimestamp, isUpdateStale } = require('./version.cjs');

  const timestamp = readInstallTimestamp(pluginRoot);
  if (timestamp === null) return '';
  if (!isUpdateStale(pluginRoot)) return '';

  const ageMs = Date.now() - new Date(timestamp).getTime();
  const ageDays = Math.floor(ageMs / 86400000);
  const text = `[RAPID] Your install is ${ageDays} days old. Run /rapid:install to refresh.`;

  const noColor = process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '';
  if (noColor) return text;
  return `${ANSI.dim}${text}${ANSI.reset}`;
}
```

**Step 3.3 -- Update `module.exports`** (currently line 196).

Replace:

```js
module.exports = { renderBanner, renderFooter, STAGE_VERBS, STAGE_BG };
```

with:

```js
module.exports = { renderBanner, renderFooter, renderUpdateReminder, STAGE_VERBS, STAGE_BG };
```

### Task 4: Extend `src/lib/display.test.cjs` with 6 test cases for `renderUpdateReminder`

**File:** `src/lib/display.test.cjs` (currently 20365 bytes -- already exists)

**Step 4.1 -- Ensure the file imports** `beforeEach`, `afterEach`, `path`, `fs`, `os`. If any are missing, add them at the top of the file.

**Step 4.2 -- Pull `renderUpdateReminder` into the destructure** from `./display.cjs`. Locate the existing `require('./display.cjs')` line and add `renderUpdateReminder` to the destructured names.

**Step 4.3 -- Append a new `describe` block at the very end of the file**:

```js
// --- renderUpdateReminder ---

describe('renderUpdateReminder', () => {
  let tmpRoot;
  let originalIsTTY;
  let originalNoUpdate;
  let originalNoColor;
  let originalThreshold;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-display-test-'));
    // Save and force TTY=true so default test mode does not short-circuit
    originalIsTTY = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    originalNoUpdate = process.env.NO_UPDATE_NOTIFIER;
    delete process.env.NO_UPDATE_NOTIFIER;
    originalNoColor = process.env.NO_COLOR;
    delete process.env.NO_COLOR;
    originalThreshold = process.env.RAPID_UPDATE_THRESHOLD_DAYS;
    delete process.env.RAPID_UPDATE_THRESHOLD_DAYS;
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
    if (originalNoUpdate === undefined) delete process.env.NO_UPDATE_NOTIFIER;
    else process.env.NO_UPDATE_NOTIFIER = originalNoUpdate;
    if (originalNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = originalNoColor;
    if (originalThreshold === undefined) delete process.env.RAPID_UPDATE_THRESHOLD_DAYS;
    else process.env.RAPID_UPDATE_THRESHOLD_DAYS = originalThreshold;
  });

  function writeStaleMeta(daysOld) {
    const ts = new Date(Date.now() - daysOld * 86400000).toISOString();
    fs.writeFileSync(
      path.join(tmpRoot, '.rapid-install-meta.json'),
      JSON.stringify({ installedAt: ts })
    );
  }

  it('returns empty string when no timestamp file exists', () => {
    const result = renderUpdateReminder(tmpRoot);
    assert.equal(result, '');
  });

  it('returns empty string when stdout is not a TTY', () => {
    writeStaleMeta(8);
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
    const result = renderUpdateReminder(tmpRoot);
    assert.equal(result, '');
  });

  it('returns empty string when NO_UPDATE_NOTIFIER is set', () => {
    writeStaleMeta(8);
    process.env.NO_UPDATE_NOTIFIER = '1';
    const result = renderUpdateReminder(tmpRoot);
    assert.equal(result, '');
  });

  it('returns ANSI-dimmed banner when stale + TTY + no suppression', () => {
    writeStaleMeta(8);
    const result = renderUpdateReminder(tmpRoot);
    assert.ok(result.length > 0);
    assert.ok(result.includes('\x1b[2m'), 'should include dim ANSI code');
    assert.ok(result.includes('\x1b[0m'), 'should include reset ANSI code');
    assert.ok(result.includes('[RAPID] Your install is'));
    assert.ok(result.includes('Run /rapid:install to refresh.'));
  });

  it('returns plain banner when NO_COLOR is set', () => {
    writeStaleMeta(8);
    process.env.NO_COLOR = '1';
    const result = renderUpdateReminder(tmpRoot);
    assert.ok(result.length > 0);
    assert.ok(!result.includes('\x1b['), 'should NOT include ANSI escapes');
    assert.ok(result.includes('[RAPID] Your install is'));
  });

  it('returns empty string when install is fresh (not stale)', () => {
    writeStaleMeta(2); // 2 days old, default threshold is 7
    const result = renderUpdateReminder(tmpRoot);
    assert.equal(result, '');
  });
});
```

## Verification

Run from the project root:

```bash
cd /home/kek/Projects/RAPID
npm test
```

All existing tests must continue to pass, and the 16 new tests (10 in `version.test.cjs`, 6 in `display.test.cjs`) must all pass.

To eyeball the new functions in isolation (no commit to filesystem):

```bash
node -e "
const v = require('./src/lib/version.cjs');
const tmp = require('fs').mkdtempSync(require('os').tmpdir() + '/probe-');
v.writeInstallTimestamp(tmp);
console.log('written:', v.readInstallTimestamp(tmp));
console.log('stale (default):', v.isUpdateStale(tmp));
console.log('stale (threshold=0):', v.isUpdateStale(tmp, 0));
require('fs').rmSync(tmp, { recursive: true, force: true });
"
```

Expected output: a recent ISO timestamp, `stale (default): false`, `stale (threshold=0): true`.

## Success Criteria

- `src/lib/version.cjs` exports `writeInstallTimestamp`, `readInstallTimestamp`, `isUpdateStale` in addition to existing exports.
- `src/lib/display.cjs` exports `renderUpdateReminder` in addition to existing exports, and the `ANSI` table contains a `dim` entry.
- `src/lib/version.test.cjs` contains a new `describe('install timestamp primitives', ...)` block with all 10 cases passing.
- `src/lib/display.test.cjs` contains a new `describe('renderUpdateReminder', ...)` block with all 6 cases passing.
- `npm test` exits with code 0.
- No new files created (no `tests/version.test.cjs`, no other new files).
- `git diff --stat` shows exactly four files changed: `src/lib/version.cjs`, `src/lib/version.test.cjs`, `src/lib/display.cjs`, `src/lib/display.test.cjs`.
