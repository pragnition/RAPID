# Wave 3: Migration -- Replace Legacy Patterns with Shared Utilities

## Objective

Replace all 10 `args.indexOf()` patterns with `parseArgs()`, replace `error() + process.exit(1)` patterns in extracted handlers with `throw new CliError()` (caught by the router), and wire `readAndValidateStdin()` into handlers that read JSON from stdin. After this wave, handlers are fully unit-testable without mocking `process.exit`.

## Why

Wave 2 extracted handlers verbatim to isolate structural changes. Now that extraction is complete and tests pass, we can safely migrate behavioral patterns. This makes handlers testable as pure functions (throw errors instead of exiting) and reduces duplicated argument-parsing boilerplate.

---

## Task 1: Add router-level CliError catch in `rapid-tools.cjs`

**Files:** `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

Wrap the `switch` statement body and the pre-root dispatch in `main()` with a try/catch that handles `CliError`:

```javascript
const { CliError } = require('../lib/errors.cjs');
const { exitWithError } = require('../lib/errors.cjs');

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    process.stdout.write(USAGE);
    if (args.length === 0) process.exit(1);
    return;
  }

  try {
    // ... existing pre-root and switch dispatch ...
  } catch (err) {
    if (err instanceof CliError) {
      exitWithError(err.message, err.code);
    }
    throw err; // re-throw unexpected errors for the outer .catch()
  }
}
```

This means any handler that throws `CliError` will be caught here and produce the standardized error output. Handlers that still use `process.exit(1)` directly are unaffected -- they exit before the catch runs.

**What NOT to do:**
- Do NOT catch generic `Error` in this handler -- only `CliError`. The outer `main().catch()` already handles unexpected errors.
- Do NOT remove the outer `.catch()` on the `main()` call.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 2: Migrate `args.indexOf()` in `src/commands/review.cjs`

**Files:** `src/commands/review.cjs` (Modify)

**Implementation:**

Replace 2 `args.indexOf()` sites with `parseArgs()`:

1. **`scope` subcommand -- `--branch` flag** (was line 1397):
   ```javascript
   const { parseArgs } = require('../lib/args.cjs');
   // Before: const branchIdx = args.indexOf('--branch'); if (branchIdx !== -1 && ...) baseBranch = args[branchIdx + 1];
   // After:
   const { flags } = parseArgs(args.slice(1), { branch: 'string', 'post-merge': 'boolean' });
   let baseBranch = flags.branch || 'main';
   ```
   Note: the `args` parameter to `handleReview` already has `args.slice(2)` from the router, and `args[0]` is `setId`, so parse from `args.slice(1)` or handle positional carefully. Verify the positional args still work: `args[0]` is setId, `args[1]` might be waveId or a flag.

   Actually, the better approach is to keep positional arg handling as-is and only replace the `indexOf` pattern for flags:
   ```javascript
   const { flags: scopeFlags } = parseArgs(args, { branch: 'string', 'post-merge': 'boolean' });
   const postMerge = scopeFlags['post-merge'];
   let baseBranch = scopeFlags.branch || 'main';
   ```
   But then `args[0]` (setId) and `args[1]` (waveId) are now in `positional`. Use `positional[0]` and `positional[1]` instead.

2. **`list-issues` subcommand -- `--status` flag** (was line 1463):
   ```javascript
   const { flags: listFlags, positional: listPos } = parseArgs(args, { status: 'string' });
   const setId = listPos[0];
   let statusFilter = listFlags.status || null;
   ```

For each migration:
- Verify the default values match the original behavior
- Verify the `undefined` case (flag present but no value) matches original

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 3: Migrate `args.indexOf()` in `src/commands/execute.cjs`

**Files:** `src/commands/execute.cjs` (Modify)

**Implementation:**

Replace 4 `args.indexOf()` sites:

1. **`verify` subcommand -- `--branch` flag** (was line 1666):
   ```javascript
   const { flags: verifyFlags, positional: verifyPos } = parseArgs(args, { branch: 'string' });
   const setName = verifyPos[0];
   let branch = verifyFlags.branch || 'main';
   ```

2. **`reconcile` subcommand -- `--mode` flag** (was line 1901):
   The original uses `args.indexOf('--mode') >= 0` as a presence check AND `args[modeIdx + 1]` for the value. Replace with:
   ```javascript
   const { flags: reconcileFlags, positional: reconcilePos } = parseArgs(args, { mode: 'string' });
   const waveNum = parseInt(reconcilePos[0], 10);
   const executionMode = reconcileFlags.mode; // undefined if not provided
   ```

3. **`reconcile-jobs` subcommand -- `--branch` and `--mode` flags** (was lines 1959, 1963):
   ```javascript
   const { flags: rjFlags, positional: rjPos } = parseArgs(args, { branch: 'string', mode: 'string' });
   const setId = rjPos[0];
   const waveId = rjPos[1];
   let branch = rjFlags.branch || 'main';
   let mode = rjFlags.mode || 'Subagents';
   ```

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 4: Migrate `args.indexOf()` in `src/commands/merge.cjs`

**Files:** `src/commands/merge.cjs` (Modify)

**Implementation:**

Replace 2 `args.indexOf()` sites:

1. **`update-status` subcommand -- `--agent-phase` and `--agent-phase2` flags** (was lines 2131, 2143):

   This is the most complex migration because `--agent-phase2` consumes TWO values. Use the `'multi:2'` type:
   ```javascript
   const { flags: usFlags, positional: usPos } = parseArgs(args, {
     'agent-phase': 'string',
     'agent-phase2': 'multi:2',
   });
   const setName = usPos[0];
   const status = usPos[1];
   const agentPhase1 = usFlags['agent-phase'];
   const agentPhase2Raw = usFlags['agent-phase2']; // [conflictId, phase] or undefined
   ```

   Then reconstruct the `agentPhase2Update` object:
   ```javascript
   let agentPhase2Update = undefined;
   if (agentPhase2Raw && agentPhase2Raw.length === 2) {
     const [conflictId, phase2Value] = agentPhase2Raw;
     const validPhases2 = ['idle', 'spawned', 'done', 'failed'];
     if (!validPhases2.includes(phase2Value)) {
       error(`Invalid --agent-phase2 phase: "${phase2Value}". Must be one of: ${validPhases2.join(', ')}`);
       process.exit(1);
     }
     agentPhase2Update = { conflictId, phase: phase2Value };
   }
   ```

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 5: Migrate `args.indexOf()` in `src/commands/misc.cjs` and `src/commands/resolve.cjs`

**Files:** `src/commands/misc.cjs` (Modify), `src/commands/resolve.cjs` (Modify)

**Implementation:**

1. **`handleVerifyArtifacts` -- `--test` flag** (was line 779 in misc.cjs):
   ```javascript
   const { flags: vaFlags, positional: vaPos } = parseArgs(args, {
     test: 'string',
     heavy: 'boolean',
     report: 'boolean',
   });
   const isHeavy = vaFlags.heavy;
   const isReport = vaFlags.report;
   const testCommand = vaFlags.test || null;
   const files = vaPos; // all positional args are file paths
   ```
   This simplifies the manual loop that skips flags and collects files.

2. **`handleResolve` wave subcommand -- `--set` flag** (was line 2534 in resolve.cjs):
   ```javascript
   const { flags: waveFlags, positional: wavePos } = parseArgs(args, { set: 'string' });
   const input = wavePos[0];
   const setInput = waveFlags.set; // undefined if not provided (optional)
   ```

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 6: Migrate `process.exit(1)` patterns in small handlers to `throw CliError`

**Files:** `src/commands/misc.cjs` (Modify), `src/commands/display.cjs` (Modify), `src/commands/prereqs.cjs` (Modify), `src/commands/lock.cjs` (Modify), `src/commands/resolve.cjs` (Modify), `src/commands/plan.cjs` (Modify), `src/commands/set-init.cjs` (Modify), `src/commands/init.cjs` (Modify)

**Implementation:**

For each handler in these 8 files, replace the pattern:
```javascript
error('Some error message');
process.exit(1);
```
with:
```javascript
throw new CliError('Some error message');
```

And replace:
```javascript
process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
process.exit(1);
```
with:
```javascript
throw new CliError(err.message);
```

Each file needs `const { CliError } = require('../lib/errors.cjs');` at the top.

**CRITICAL exceptions -- do NOT migrate these patterns:**
- `handleLock` acquire case: the `process.stdout.write(result + '\n')` followed by holding the lock until process exits -- this is normal flow, not an error
- `handleResolve` catch blocks that write `{ error: err.message }` to stdout -- these are the expected error OUTPUT format, not internal errors. The `process.exit(1)` after them should become `throw new CliError(err.message)` but the stdout JSON error output needs to remain. Actually, since the router's CliError catch already writes `{ error }` JSON to stdout, just throw CliError and the router handles it.
- Any `process.exit(0)` or successful `return` -- do not touch these

**Counting the exits to migrate:**
- `misc.cjs`: handleAssumptions (2), handleParseReturn (2), handleVerifyArtifacts (1), handleResume (2), handleContext (3)
- `display.cjs`: handleDisplay (2)
- `prereqs.cjs`: handlePrereqs (0 -- no error exits)
- `lock.cjs`: handleLock (3)
- `resolve.cjs`: handleResolve (4)
- `plan.cjs`: handlePlan (2)
- `set-init.cjs`: handleSetInit (3)
- `init.cjs`: handleInit (2)

Total: ~24 `process.exit(1)` calls migrated in this task.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 7: Migrate `process.exit(1)` patterns in large handlers to `throw CliError`

**Files:** `src/commands/state.cjs` (Modify), `src/commands/worktree.cjs` (Modify), `src/commands/review.cjs` (Modify), `src/commands/build-agents.cjs` (Modify), `src/commands/execute.cjs` (Modify), `src/commands/merge.cjs` (Modify)

**Implementation:**

Same pattern as Task 6 but for the 6 large handlers. These contain the bulk of the 122 `process.exit(1)` calls.

**Special cases:**
- `state.cjs` has a try/catch that writes `{ error: err.message }` to stdout. Replace with `throw new CliError(err.message)` -- the router's catch handles the JSON output.
- `review.cjs` and `execute.cjs` use `output(JSON.stringify({ error: ... }))` (with `[RAPID]` prefix) in some error paths. These are trickier because the current error format includes the `[RAPID]` prefix. To preserve compatibility, keep these as `output(JSON.stringify({ error: ... })); throw new CliError(err.message);` -- but actually this would double-output. Better: change them to throw `CliError` and ensure the router's catch also calls `output()` for commands that used the `[RAPID]` prefix. OR: simpler -- just use `throw new CliError(err.message)` and accept that the error format changes from `[RAPID] {"error":"..."}` to `{"error":"..."}` on stdout. The skills use `parseCliJson()` which strips the `[RAPID]` prefix, so both formats work.
- `build-agents.cjs` has one `process.exit(1)` for unknown role in SKIP_GENERATION -- migrate to throw.
- `merge.cjs` has `process.exit(1)` in many subcommands including after `output(JSON.stringify(...))`. Migrate the error paths to throw.

**Counting:**
- `state.cjs`: ~14 exits
- `worktree.cjs`: ~12 exits
- `review.cjs`: ~10 exits
- `build-agents.cjs`: ~1 exit
- `execute.cjs`: ~18 exits
- `merge.cjs`: ~12 exits

Total: ~67 exits migrated.

**After this task + Task 6, verify that ZERO `process.exit(1)` calls remain in `src/commands/` files:**
```bash
grep -r 'process.exit' src/commands/ | grep -v test | wc -l  # Should be 0
```

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
grep -c 'process.exit' src/commands/*.cjs  # Each file should show 0
```

---

## Task 8: Wire `readAndValidateStdin()` into stdin-consuming handlers

**Files:** `src/commands/state.cjs` (Modify), `src/commands/plan.cjs` (Modify), `src/commands/review.cjs` (Modify), `src/commands/execute.cjs` (Modify)

**Implementation:**

Replace raw `fs.readFileSync(0, 'utf-8')` and async stdin patterns with `readAndValidateStdin()` or `readStdinSync()`:

1. **`state.cjs` -- `add-milestone` subcommand**: Uses async stdin with TTY guard. Replace:
   ```javascript
   const { readStdinAsync } = require('../lib/stdin.cjs');
   // Only read stdin if not a TTY
   let carryForwardSets = [];
   if (!process.stdin.isTTY) {
     const raw = await readStdinAsync();
     if (raw) {
       carryForwardSets = JSON.parse(raw);
       if (!Array.isArray(carryForwardSets)) {
         throw new CliError('stdin must be a JSON array of sets');
       }
     }
   }
   ```
   Note: keep the TTY guard because this subcommand makes stdin optional.

2. **`plan.cjs` -- `create-set`, `decompose`, `write-dag` subcommands**: All use `fs.readFileSync(0, 'utf-8')`. Replace with:
   ```javascript
   const { readStdinSync } = require('../lib/stdin.cjs');
   const input = readStdinSync(); // throws CliError if empty
   const setDef = JSON.parse(input);
   ```

3. **`review.cjs` -- `log-issue` subcommand**: Uses `fs.readFileSync(0, 'utf-8')`. Replace:
   ```javascript
   const { readStdinSync } = require('../lib/stdin.cjs');
   const stdinData = readStdinSync();
   const issue = JSON.parse(stdinData);
   ```

4. **`execute.cjs` -- `pause` subcommand**: Uses `fs.readFileSync(0, 'utf-8')`. Replace:
   ```javascript
   const { readStdinSync } = require('../lib/stdin.cjs');
   const input = readStdinSync();
   const checkpointData = JSON.parse(input);
   ```

**What NOT to do:**
- Do NOT use `readAndValidateStdin(zodSchema)` yet for most of these -- the Zod schemas from foundation-hardening may not be available yet. Use `readStdinSync()` for the raw read and `JSON.parse()` for parsing. Zod validation can be added later when foundation-hardening schemas are integrated.
- Do NOT remove the TTY guard from add-milestone -- stdin is optional there.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 9: Add handler unit tests for CliError throw behavior

**Files:** `src/commands/commands.test.cjs` (Create)

**Implementation:**

Create a test file that verifies handlers throw `CliError` instead of calling `process.exit()`:

1. Import handlers directly from command modules
2. Call them with invalid args (e.g., missing required params)
3. Assert they throw `CliError` with expected message

Test cases:
- `handleLock(cwd, undefined, [])` throws CliError about missing lock name
- `handleState(cwd, 'get', [])` throws CliError about usage
- `handlePlan(cwd, 'load-set', [])` throws CliError about missing set name
- `handleResolve(cwd, 'set', [])` throws CliError about missing input
- `handleInit([])` throws CliError about missing subcommand
- `handleDisplay(undefined, [])` throws CliError about missing stage
- `handleExecute(cwd, 'prepare-context', [])` throws CliError about missing set name
- `handleMerge(cwd, 'review', [])` throws CliError about missing set name
- `handleReview(cwd, 'scope', [])` throws CliError about missing set-id
- `handleWorktree(cwd, 'create', [])` throws CliError about missing set name

Each test:
```javascript
await assert.rejects(
  async () => handleLock(tmpDir, undefined, []),
  (err) => err instanceof CliError && err.message.includes('Lock name required')
);
```

**Verification:**
```bash
node --test src/commands/commands.test.cjs
```

---

## Task 10: Final verification and line count audit

**Files:** None (verification only)

**Implementation:**

Run the complete verification suite:

1. Verify router line count:
   ```bash
   wc -l src/bin/rapid-tools.cjs  # Must be < 300
   ```

2. Verify zero `process.exit` in command files:
   ```bash
   grep -rc 'process\.exit' src/commands/*.cjs  # Each should show 0
   ```

3. Verify zero `args.indexOf` in command files:
   ```bash
   grep -rc 'args\.indexOf' src/commands/*.cjs  # Each should show 0
   ```

4. Verify zero raw `readFileSync(0` in command files (except for any intentionally kept):
   ```bash
   grep -rc 'readFileSync(0' src/commands/*.cjs  # Each should show 0
   ```

5. Run all test suites:
   ```bash
   node --test src/lib/args.test.cjs
   node --test src/lib/errors.test.cjs
   node --test src/lib/stdin.test.cjs
   node --test src/bin/contract.test.cjs
   node --test src/bin/rapid-tools.test.cjs
   node --test src/commands/commands.test.cjs
   ```

6. Run the full project test suite to check for regressions:
   ```bash
   node --test src/**/*.test.cjs
   ```

**Success criteria for this task:** All counts are 0, all tests pass.

---

## Success Criteria

1. Zero `args.indexOf()` calls remain in `src/commands/` -- all replaced with `parseArgs()`
2. Zero `process.exit(1)` calls remain in `src/commands/` -- all replaced with `throw CliError`
3. Zero `fs.readFileSync(0` calls remain in `src/commands/` -- all replaced with `readStdinSync()` or `readStdinAsync()`
4. Router in `rapid-tools.cjs` catches `CliError` and calls `exitWithError()`
5. All contract tests pass (JSON output shapes preserved)
6. All 87+ existing tests pass
7. New handler unit tests verify CliError throw behavior
8. `rapid-tools.cjs` is still under 300 lines

## File Ownership

| File | Action |
|------|--------|
| `src/bin/rapid-tools.cjs` | Modify (add CliError catch) |
| `src/commands/review.cjs` | Modify (parseArgs + CliError) |
| `src/commands/execute.cjs` | Modify (parseArgs + CliError + readStdinSync) |
| `src/commands/merge.cjs` | Modify (parseArgs + CliError) |
| `src/commands/misc.cjs` | Modify (parseArgs + CliError) |
| `src/commands/resolve.cjs` | Modify (parseArgs + CliError) |
| `src/commands/state.cjs` | Modify (CliError + readStdinAsync) |
| `src/commands/worktree.cjs` | Modify (CliError) |
| `src/commands/build-agents.cjs` | Modify (CliError) |
| `src/commands/display.cjs` | Modify (CliError) |
| `src/commands/prereqs.cjs` | Modify (no changes -- no error exits) |
| `src/commands/lock.cjs` | Modify (CliError) |
| `src/commands/plan.cjs` | Modify (CliError + readStdinSync) |
| `src/commands/set-init.cjs` | Modify (CliError) |
| `src/commands/init.cjs` | Modify (CliError) |
| `src/commands/commands.test.cjs` | Create |
