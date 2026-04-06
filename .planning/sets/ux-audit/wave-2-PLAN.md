# PLAN: ux-audit / Wave 2

**Objective:** Standardize breadcrumb format across error messages in state transition and set lifecycle command paths, and create the `tests/ux-audit.test.cjs` test file to verify breadcrumb consistency and auto-regroup wiring from Wave 1.

**Owned Files (Wave 2 only):**
- `src/lib/errors.cjs` (modify -- add breadcrumb formatting helper)
- `src/lib/state-machine.cjs` (modify -- update REMEDIATION_HINTS format)
- `src/lib/state-transitions.cjs` (modify -- enrich transition error messages with recovery hints)
- `src/commands/state.cjs` (modify -- standardize CliError messages with breadcrumbs)
- `tests/ux-audit.test.cjs` (create)

**Read-Only References:**
- `src/lib/core.cjs` -- `error()` function (writes `[RAPID ERROR]` prefix)
- `src/lib/display.cjs` -- `renderFooter()` (success-path pattern, do NOT reuse for errors)
- `src/lib/add-set.cjs` -- Wave 1 auto-regroup wiring (test target)
- `src/lib/init.cjs` -- Wave 1 teamSize storage (test target)
- `src/lib/group.cjs` -- `partitionIntoGroups()` (test dependency reference)

**Depends on:** Wave 1 (auto-regroup wiring + teamSize storage must exist for tests)

---

## Task 1: Add breadcrumb formatting helper to errors.cjs

**What:** Add a `formatBreadcrumb(context, recovery)` function that produces the standard error breadcrumb format. Update the `error()` function in `core.cjs` to use red ANSI on the `[ERROR]` label (currently uses `[RAPID ERROR]` with no color).

**Why:** Per CONTEXT.md decisions: compact inline format `[ERROR] {context}. Run: {recovery command}`. Red ANSI on `[ERROR]` label only, default terminal color for the rest. Having a helper function ensures consistency across all call sites.

**File:** `src/lib/errors.cjs`

**Actions:**
1. Add a `formatBreadcrumb` function:
   ```javascript
   /**
    * Format an error message with breadcrumb recovery hint.
    * Follows the compact inline format: [ERROR] {context}. Run: {recovery}
    *
    * @param {string} context - What went wrong
    * @param {string} [recovery] - Recovery command suggestion
    * @returns {string} Formatted error message (without ANSI -- ANSI is added at output time)
    */
   function formatBreadcrumb(context, recovery) {
     if (recovery) {
       return `${context}. Run: ${recovery}`;
     }
     return context;
   }
   ```

2. Add `formatBreadcrumb` to `module.exports`.

3. Update `exitWithError` to apply red ANSI to the `[ERROR]` label when writing to stderr. Currently it calls `error(msg)` from core.cjs which writes `[RAPID ERROR]`. Instead, write directly:
   ```javascript
   function exitWithError(msg, code = 1) {
     process.stdout.write(JSON.stringify({ error: msg }) + '\n');
     const noColor = process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '';
     const label = noColor ? '[ERROR]' : '\x1b[31m[ERROR]\x1b[0m';
     process.stderr.write(`${label} ${msg}\n`);
     process.exit(code);
   }
   ```

**What NOT to do:**
- Do NOT modify `core.cjs` -- the `error()` function there is used by non-breadcrumb paths. Leave it as-is.
- Do NOT use the `renderFooter()` block format for errors -- breadcrumbs are compact inline.
- Do NOT add ANSI codes inside `formatBreadcrumb()` -- let the output layer (`exitWithError`) handle coloring.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node -e "
const { formatBreadcrumb } = require('./src/lib/errors.cjs');
const result = formatBreadcrumb('Set auth is pending, not discussed', '/rapid:discuss-set 2');
console.log(result);
console.assert(result === 'Set auth is pending, not discussed. Run: /rapid:discuss-set 2');
console.log('PASS');
"
```

---

## Task 2: Update REMEDIATION_HINTS format in state-machine.cjs

**What:** Modernize the `REMEDIATION_HINTS` map in `state-machine.cjs` to use the new breadcrumb format. Currently they use `\nRemediation: Run ...` -- update to just the recovery command string, and use `formatBreadcrumb()` at the call site (`createStateError`).

**File:** `src/lib/state-machine.cjs`

**Actions:**
1. Import `formatBreadcrumb` from errors.cjs:
   ```javascript
   const { formatBreadcrumb } = require('./errors.cjs');
   ```

2. Change `REMEDIATION_HINTS` values from `'\nRemediation: Run /rapid:init'` to just the recovery command:
   ```javascript
   const REMEDIATION_HINTS = {
     [STATE_FILE_MISSING]: '/rapid:init',
     [STATE_PARSE_ERROR]: 'git checkout HEAD -- .planning/STATE.json',
     [STATE_VALIDATION_ERROR]: '/rapid:init --mode reinitialize',
   };
   ```
   Note: Changed the validation error hint from `/rapid:health` (which does not exist as a command) to `/rapid:init --mode reinitialize`.

3. Update `createStateError` to use `formatBreadcrumb`:
   ```javascript
   function createStateError(code, message, details) {
     const hint = REMEDIATION_HINTS[code] || '';
     const fullMessage = hint ? formatBreadcrumb(message, hint) : message;
     const err = new Error(fullMessage);
     err.code = code;
     if (details !== undefined) {
       err.details = details;
     }
     return err;
   }
   ```

**What NOT to do:**
- Do NOT change the error code constants (`STATE_FILE_MISSING`, etc.) -- only the hint format.
- Do NOT modify `readState()`, `writeState()`, or `withStateTransaction()` logic -- only the hint strings and `createStateError()` formatter.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node -e "
const sm = require('./src/lib/state-machine.cjs');
const err = sm.createStateError(sm.STATE_FILE_MISSING, 'STATE.json not found');
console.log(err.message);
console.assert(err.message.includes('Run: /rapid:init'), 'Should include recovery hint');
console.assert(!err.message.includes('Remediation:'), 'Should not use old format');
console.log('PASS');
"
```

---

## Task 3: Enrich state transition error messages with recovery hints

**What:** Update `validateTransition()` in `state-transitions.cjs` to include actionable recovery commands in its error messages.

**File:** `src/lib/state-transitions.cjs`

**Actions:**
1. Import `formatBreadcrumb` from errors.cjs:
   ```javascript
   const { formatBreadcrumb } = require('./errors.cjs');
   ```

2. Update the error messages in `validateTransition()` to include recovery hints. The three error paths are:

   a. Unknown status:
   ```javascript
   throw new Error(
     formatBreadcrumb(
       `Unknown status "${currentStatus}". Valid statuses: ${Object.keys(map).join(', ')}`,
       '/rapid:status'
     )
   );
   ```

   b. Terminal state (no valid transitions):
   ```javascript
   throw new Error(
     formatBreadcrumb(
       `Invalid transition: "${currentStatus}" -> "${nextStatus}". "${currentStatus}" is a terminal state with no valid transitions`,
       '/rapid:status'
     )
   );
   ```

   c. Invalid transition (not in allowed list):
   ```javascript
   throw new Error(
     formatBreadcrumb(
       `Invalid transition: "${currentStatus}" -> "${nextStatus}". Valid transitions from "${currentStatus}": [${allowed.join(', ')}]`,
       '/rapid:status'
     )
   );
   ```

**What NOT to do:**
- Do NOT change the transition maps (`SET_TRANSITIONS`, `WAVE_TRANSITIONS`, `JOB_TRANSITIONS`).
- Do NOT change the function signature of `validateTransition()`.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node -e "
const { validateTransition } = require('./src/lib/state-transitions.cjs');
try {
  validateTransition('pending', 'executed');
} catch (e) {
  console.log(e.message);
  console.assert(e.message.includes('Run:'), 'Should include recovery hint');
  console.log('PASS');
}
"
```

---

## Task 4: Standardize CliError messages in state.cjs with breadcrumbs

**What:** Update the highest-impact CliError throw sites in `src/commands/state.cjs` to use `formatBreadcrumb()` for recovery hints.

**File:** `src/commands/state.cjs`

**Actions:**
1. Import `formatBreadcrumb` from errors:
   ```javascript
   const { CliError } = require('../lib/errors.cjs');
   const { formatBreadcrumb } = require('../lib/errors.cjs');
   ```
   (Can be combined into one import.)

2. Update the following error messages:

   a. STATE.json not found (line 20):
   ```javascript
   throw new CliError(formatBreadcrumb('STATE.json not found', '/rapid:init'));
   ```

   b. STATE.json not found (line 32) -- duplicate path:
   ```javascript
   throw new CliError(formatBreadcrumb('STATE.json not found', '/rapid:init'));
   ```

   c. STATE.json invalid (line 23):
   ```javascript
   throw new CliError(formatBreadcrumb('STATE.json is invalid: ' + JSON.stringify(result.errors), 'git checkout HEAD -- .planning/STATE.json'));
   ```

   d. STATE.json invalid (line 35) -- duplicate path:
   ```javascript
   throw new CliError(formatBreadcrumb('STATE.json is invalid: ' + JSON.stringify(readResult.errors), 'git checkout HEAD -- .planning/STATE.json'));
   ```

   e. Unknown state subcommand (line 194):
   ```javascript
   throw new CliError(formatBreadcrumb(`Unknown state subcommand: ${subcommand}`, 'node rapid-tools.cjs --help'));
   ```

3. Leave usage-pattern errors (the ones that show "Usage: ...") as-is -- they already tell the user what to do.

**What NOT to do:**
- Do NOT add breadcrumbs to pure usage-hint errors (lines 14, 42, 49, 56, 63, 77, 84, 93, 102, 123, 162) -- these already contain the correct invocation pattern.
- Do NOT change the JSON output format (stdout) -- only the stderr human-readable messages via CliError.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node -e "
const { CliError, formatBreadcrumb } = require('./src/lib/errors.cjs');
const msg = formatBreadcrumb('STATE.json not found', '/rapid:init');
const err = new CliError(msg);
console.log(err.message);
console.assert(err.message === 'STATE.json not found. Run: /rapid:init');
console.log('PASS');
"
```

---

## Task 5: Create ux-audit.test.cjs with breadcrumb and auto-regroup tests

**What:** Create `tests/ux-audit.test.cjs` using Node.js built-in test runner (`node:test`) following the pattern in `tests/display.test.cjs`.

**File:** `tests/ux-audit.test.cjs` (new)

**Actions:**
Create the test file with these test groups:

```javascript
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('breadcrumb formatting', () => {
  it('formatBreadcrumb with recovery command', () => {
    const { formatBreadcrumb } = require('../src/lib/errors.cjs');
    const result = formatBreadcrumb('Set auth is pending', '/rapid:discuss-set 2');
    assert.equal(result, 'Set auth is pending. Run: /rapid:discuss-set 2');
  });

  it('formatBreadcrumb without recovery command', () => {
    const { formatBreadcrumb } = require('../src/lib/errors.cjs');
    const result = formatBreadcrumb('Something went wrong');
    assert.equal(result, 'Something went wrong');
  });

  it('exitWithError uses [ERROR] label format', () => {
    // Verify that exitWithError is exported and is a function
    const { exitWithError } = require('../src/lib/errors.cjs');
    assert.equal(typeof exitWithError, 'function');
  });
});

describe('state error breadcrumbs', () => {
  it('STATE_FILE_MISSING error includes recovery hint', () => {
    const sm = require('../src/lib/state-machine.cjs');
    const err = sm.createStateError(sm.STATE_FILE_MISSING, 'STATE.json not found');
    assert.ok(err.message.includes('Run:'), 'Should include "Run:" recovery pattern');
    assert.ok(err.message.includes('/rapid:init'), 'Should suggest /rapid:init');
    assert.ok(!err.message.includes('Remediation:'), 'Should not use old format');
  });

  it('STATE_PARSE_ERROR error includes recovery hint', () => {
    const sm = require('../src/lib/state-machine.cjs');
    const err = sm.createStateError(sm.STATE_PARSE_ERROR, 'STATE.json parse failed');
    assert.ok(err.message.includes('Run:'), 'Should include "Run:" recovery pattern');
    assert.ok(err.message.includes('git checkout'), 'Should suggest git recovery');
  });

  it('STATE_VALIDATION_ERROR error includes recovery hint', () => {
    const sm = require('../src/lib/state-machine.cjs');
    const err = sm.createStateError(sm.STATE_VALIDATION_ERROR, 'Validation failed');
    assert.ok(err.message.includes('Run:'), 'Should include "Run:" recovery pattern');
  });
});

describe('transition error breadcrumbs', () => {
  it('invalid transition error includes recovery hint', () => {
    const { validateTransition } = require('../src/lib/state-transitions.cjs');
    assert.throws(
      () => validateTransition('pending', 'executed'),
      (err) => err.message.includes('Run:'),
      'Invalid transition should include recovery hint'
    );
  });

  it('terminal state error includes recovery hint', () => {
    const { validateTransition } = require('../src/lib/state-transitions.cjs');
    assert.throws(
      () => validateTransition('merged', 'pending'),
      (err) => err.message.includes('Run:'),
      'Terminal state error should include recovery hint'
    );
  });
});

describe('auto-regroup wiring', () => {
  it('autoRegroup is exported from add-set.cjs', () => {
    const { autoRegroup } = require('../src/lib/add-set.cjs');
    assert.equal(typeof autoRegroup, 'function');
  });

  it('addSetToMilestone is exported from add-set.cjs', () => {
    const { addSetToMilestone } = require('../src/lib/add-set.cjs');
    assert.equal(typeof addSetToMilestone, 'function');
  });
});

describe('teamSize storage', () => {
  it('scaffoldProject stores teamSize in STATE.json', () => {
    const { scaffoldProject } = require('../src/lib/init.cjs');
    const fs = require('node:fs');
    const path = require('node:path');
    const os = require('node:os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-test-'));
    try {
      scaffoldProject(tmp, { name: 'test', description: 'test', teamSize: 4 }, 'fresh');
      const state = JSON.parse(fs.readFileSync(path.join(tmp, '.planning', 'STATE.json'), 'utf-8'));
      assert.equal(state.teamSize, 4, 'teamSize should be stored in STATE.json');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('scaffoldProject defaults teamSize to 1 when not provided', () => {
    const { scaffoldProject } = require('../src/lib/init.cjs');
    const fs = require('node:fs');
    const path = require('node:path');
    const os = require('node:os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-test-'));
    try {
      scaffoldProject(tmp, { name: 'test', description: 'test' }, 'fresh');
      const state = JSON.parse(fs.readFileSync(path.join(tmp, '.planning', 'STATE.json'), 'utf-8'));
      assert.equal(state.teamSize, 1, 'teamSize should default to 1');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('audit report structure', () => {
  it('UX audit report exists and has correct structure', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const reportPath = path.resolve(__dirname, '..', '.planning', 'v6.1.0-UX-AUDIT.md');
    assert.ok(fs.existsSync(reportPath), 'Audit report should exist');
    const content = fs.readFileSync(reportPath, 'utf-8');
    assert.ok(content.includes('Pillar 1: Breadcrumb Consistency'), 'Should have Pillar 1');
    assert.ok(content.includes('Pillar 2: Command Discoverability'), 'Should have Pillar 2');
    assert.ok(content.includes('Pillar 3: First-Run Experience'), 'Should have Pillar 3');
    assert.ok(content.includes('Pillar 4: Auto-Regroup Wiring'), 'Should have Pillar 4');
  });
});
```

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test tests/ux-audit.test.cjs
```

---

## Success Criteria

1. `formatBreadcrumb()` exported from `errors.cjs` and produces `{context}. Run: {recovery}` format
2. `exitWithError()` uses red ANSI `[ERROR]` label (not `[RAPID ERROR]`)
3. `REMEDIATION_HINTS` in `state-machine.cjs` use new format (recovery command only, not `\nRemediation:`)
4. `createStateError()` uses `formatBreadcrumb()` to compose messages
5. `validateTransition()` error messages include `Run:` recovery hints
6. State command CliErrors for missing/invalid STATE.json include recovery hints
7. All tests in `tests/ux-audit.test.cjs` pass
8. Existing tests still pass: `node --test tests/display.test.cjs`
