# Wave 2: Extraction -- Move All Handlers into `src/commands/` and Reduce Router

## Objective

Extract all 18 handler functions from `src/bin/rapid-tools.cjs` into their respective `src/commands/{command}.cjs` files VERBATIM (preserving all `process.exit(1)` calls, `args.indexOf()` patterns, and output formatting). Then rewrite `rapid-tools.cjs` as a thin router that imports and dispatches to the command modules. After this wave, `rapid-tools.cjs` must be under 300 lines.

## Why

This is the structural change that enables parallel development. Once handlers live in separate files, other sets (structural-cleanup, bug-fixes, solo-mode) can modify individual command files without touching the monolith. Extracting verbatim avoids combining structural and behavioral changes.

## Ordering

Extract handlers one-at-a-time in ascending size order (smallest first). After each extraction, verify the contract tests still pass. This catches import/require issues immediately rather than at the end.

---

## Task 1: Extract `handleDisplay` into `src/commands/display.cjs`

**Files:** `src/commands/display.cjs` (Create), `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

1. Create `src/commands/display.cjs`:
   ```
   'use strict';
   const { error } = require('../lib/core.cjs');

   function handleDisplay(subcommand, args) {
     // ... exact copy of handleDisplay from rapid-tools.cjs (lines 2551-2571)
   }

   module.exports = { handleDisplay };
   ```

2. In `rapid-tools.cjs`:
   - Add `const { handleDisplay } = require('../commands/display.cjs');` at the top (after existing requires)
   - Remove the `handleDisplay` function definition (lines 2551-2571)
   - The `case 'display':` in `main()` already calls `handleDisplay(args[1], args.slice(2))` -- no change needed there

**CRITICAL:** `handleDisplay` is a pre-root command (dispatched BEFORE `findProjectRoot()`). It receives `(subcommand, args)` NOT `(cwd, subcommand, args)`. Preserve this signature exactly.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 2: Extract `handlePrereqs` into `src/commands/prereqs.cjs`

**Files:** `src/commands/prereqs.cjs` (Create), `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

1. Create `src/commands/prereqs.cjs`:
   ```
   'use strict';
   const { validatePrereqs, checkGitRepo, formatPrereqSummary } = require('../lib/prereqs.cjs');

   async function handlePrereqs(args) {
     // ... exact copy of handlePrereqs from rapid-tools.cjs (lines 973-996)
   }

   module.exports = { handlePrereqs };
   ```

2. In `rapid-tools.cjs`:
   - Add require for the new module
   - Remove the function definition
   - Keep the dispatch call unchanged

**CRITICAL:** `handlePrereqs` is a pre-root command. It receives only `(args)` -- no `cwd` parameter. Preserve this.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 3: Extract `handleAssumptions` into `src/commands/misc.cjs`

**Files:** `src/commands/misc.cjs` (Create), `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

1. Create `src/commands/misc.cjs` -- this will be the catch-all for small handlers:
   ```
   'use strict';
   const { error } = require('../lib/core.cjs');

   function handleAssumptions(cwd, args) {
     // ... exact copy (lines 1057-1079)
   }

   module.exports = { handleAssumptions };
   ```

2. In `rapid-tools.cjs`: add require, remove function definition.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 4: Extract `handleParseReturn` into `src/commands/misc.cjs`

**Files:** `src/commands/misc.cjs` (Modify), `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

1. Add `handleParseReturn` to `src/commands/misc.cjs`:
   ```
   function handleParseReturn(args) {
     // ... exact copy (lines 735-762)
   }
   ```
   Update `module.exports` to include `handleParseReturn`.

2. In `rapid-tools.cjs`: add to the require destructure, remove function definition.

**Note:** `handleParseReturn` requires `fs` and `../lib/returns.cjs` inline. Move these requires into the function body (they are already inline in the original).

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 5: Extract `handleResume` into `src/commands/misc.cjs`

**Files:** `src/commands/misc.cjs` (Modify), `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

Add `handleResume` to misc.cjs (lines 1613-1631). This handler is async. Update exports.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 6: Extract `handleVerifyArtifacts` into `src/commands/misc.cjs`

**Files:** `src/commands/misc.cjs` (Modify), `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

Add `handleVerifyArtifacts` to misc.cjs (lines 765-813). Update exports.

**Note:** This handler contains one of the 10 `args.indexOf('--test')` sites. Extract it VERBATIM -- do not replace with `parseArgs()` yet (that is Wave 3).

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 7: Extract `handleLock` into `src/commands/lock.cjs`

**Files:** `src/commands/lock.cjs` (Create), `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

1. Create `src/commands/lock.cjs`:
   ```
   'use strict';
   const { error } = require('../lib/core.cjs');
   const { acquireLock, isLocked } = require('../lib/lock.cjs');

   async function handleLock(cwd, subcommand, args) {
     // ... exact copy (lines 217-255)
   }

   module.exports = { handleLock };
   ```

2. In `rapid-tools.cjs`: The top-level `require('../lib/lock.cjs')` can be removed since it was only used by `handleLock`. Add `const { handleLock } = require('../commands/lock.cjs');` instead.

**IMPORTANT:** After removing the lock.cjs top-level require from rapid-tools.cjs, verify that `acquireLock` and `isLocked` are NOT used anywhere else in the file. They are not -- they are only in `handleLock`.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 8: Extract `handleContext` into `src/commands/misc.cjs`

**Files:** `src/commands/misc.cjs` (Modify), `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

Add `handleContext` to misc.cjs (lines 928-971). This is a pre-root command for the `detect` subcommand but calls `findProjectRoot()` for `generate`. Import `findProjectRoot` from core.cjs in misc.cjs.

**CRITICAL:** `handleContext` is dispatched BEFORE `findProjectRoot()` in the router. The `detect` subcommand uses `process.cwd()`, and `generate` calls `findProjectRoot()` internally. This means the function must import `findProjectRoot` itself.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 9: Extract `handleResolve` into `src/commands/resolve.cjs`

**Files:** `src/commands/resolve.cjs` (Create), `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

Create `src/commands/resolve.cjs` with `handleResolve` (lines 2498-2549). Requires `../lib/resolve.cjs` and `../lib/state-machine.cjs` inline. This handler is async.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 10: Extract `handlePlan` into `src/commands/plan.cjs`

**Files:** `src/commands/plan.cjs` (Create), `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

Create `src/commands/plan.cjs` with `handlePlan` (lines 998-1055). Requires `fs` and `../lib/plan.cjs`.

**Note:** `handlePlan` uses `fs.readFileSync(0, 'utf-8')` for stdin in 3 subcommands. Extract verbatim -- Wave 3 will migrate to `readAndValidateStdin()`.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 11: Extract `handleSetInit` into `src/commands/set-init.cjs`

**Files:** `src/commands/set-init.cjs` (Create), `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

Create `src/commands/set-init.cjs` with `handleSetInit` (lines 1303-1363). Requires `fs`, `path`, `../lib/worktree.cjs`, `../lib/state-machine.cjs`. This handler is async.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 12: Extract `handleInit` into `src/commands/init.cjs`

**Files:** `src/commands/init.cjs` (Create), `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

Create `src/commands/init.cjs` with `handleInit` (lines 815-926). Requires `fs`, `path`, `../lib/init.cjs`, `../lib/core.cjs`.

**CRITICAL:** `handleInit` is a pre-root command. It uses `process.cwd()` directly. Preserve this -- no `cwd` parameter.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 13: Extract `handleState` into `src/commands/state.cjs`

**Files:** `src/commands/state.cjs` (Create), `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

Create `src/commands/state.cjs` with `handleState` (lines 257-437). Requires `../lib/state-machine.cjs` and `../lib/core.cjs`. This handler is async and has a try/catch that outputs `{ error: err.message }` to stdout on failure.

**Note:** The `add-milestone` subcommand uses the async stdin pattern (TTY guard + stream). Extract verbatim.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 14: Extract `handleWorktree` into `src/commands/worktree.cjs`

**Files:** `src/commands/worktree.cjs` (Create), `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

Create `src/commands/worktree.cjs` with `handleWorktree` (lines 1081-1301). Requires `fs`, `path`, `../lib/worktree.cjs`, `../lib/state-machine.cjs`, `../lib/core.cjs`. This handler is async.

**Note:** The `status` subcommand uses a local variable named `output` (shadowing the import from core.cjs). Preserve this exact behavior -- it is a `let output = ''` string concatenation, not a call to the `output()` function.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 15: Extract `handleReview` into `src/commands/review.cjs`

**Files:** `src/commands/review.cjs` (Create), `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

Create `src/commands/review.cjs` with `handleReview` (lines 1366-1611). Requires `fs`, `path`, `../lib/review.cjs`, `../lib/worktree.cjs`, and uses `output()` from `../lib/core.cjs`.

**CRITICAL OUTPUT PATTERN:** This handler uses `output(JSON.stringify(...))` which prepends `[RAPID] `. The contract tests must continue to see this prefix. Do NOT change to `process.stdout.write()`.

**Note:** Contains `args.indexOf('--branch')` and `args.indexOf('--status')` sites. Extract verbatim.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 16: Extract `handleBuildAgents` into `src/commands/build-agents.cjs`

**Files:** `src/commands/build-agents.cjs` (Create), `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

Create `src/commands/build-agents.cjs` with `handleBuildAgents` (lines 439-733). This is the largest single handler at 296 lines. It contains nested helper functions (`generateFrontmatter`, `assembleAgentPrompt`, `assembleStubPrompt`) and data tables (`ROLE_TOOLS`, `ROLE_COLORS`, etc.). Extract everything as a unit.

Requires `fs`, `path`, `../lib/core.cjs` (for `output`, `error`, `resolveRapidDir`, `loadConfig`), `../lib/tool-docs.cjs`.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 17: Extract `handleExecute` into `src/commands/execute.cjs`

**Files:** `src/commands/execute.cjs` (Create), `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

Create `src/commands/execute.cjs` with `handleExecute` (lines 1633-2031). The largest handler at ~400 lines. Requires `fs`, `path`, `../lib/execute.cjs`, `../lib/stub.cjs`, `../lib/worktree.cjs`, `../lib/dag.cjs`, `../lib/state-machine.cjs`, `../lib/core.cjs`.

**Note:** Contains `args.indexOf('--branch')` and `args.indexOf('--mode')` sites. Extract verbatim.

**Note:** The `reconcile-jobs` subcommand uses `output(JSON.stringify(...))` (with `[RAPID]` prefix). Other subcommands use `process.stdout.write()`. Preserve both patterns exactly.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 18: Extract `handleMerge` into `src/commands/merge.cjs`

**Files:** `src/commands/merge.cjs` (Create), `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

Create `src/commands/merge.cjs` with `handleMerge` (lines 2033-2496). The absolute largest handler at 465 lines. Requires `path`, `fs`, `../lib/merge.cjs`, `../lib/worktree.cjs`, `../lib/core.cjs`, and `child_process` (for `bisect` subcommand).

**Note:** Contains `args.indexOf('--agent-phase')` and `args.indexOf('--agent-phase2')` sites. The `--agent-phase2` site reads TWO values. Extract verbatim.

**CRITICAL:** The `update-status` subcommand calls `merge.withMergeStateTransaction()` and `merge.ensureMergeState()`. These are from the data-integrity set. They must remain as-is.

**Verification:**
```bash
node --test src/bin/contract.test.cjs && node --test src/bin/rapid-tools.test.cjs
```

---

## Task 19: Finalize the thin router in `rapid-tools.cjs`

**Files:** `src/bin/rapid-tools.cjs` (Modify)

**Implementation:**

After all 18 handlers have been extracted, `rapid-tools.cjs` should contain ONLY:
1. The shebang line and `'use strict'`
2. Requires for `core.cjs` (for `output`, `error`, `findProjectRoot`) and all 13 command modules
3. The `USAGE` string
4. The `migrateStateVersion()` function (must stay here -- runs before dispatch)
5. The `main()` function with the pre-root dispatch section and the `switch` statement
6. The `require.main === module` guard
7. The `module.exports = { migrateStateVersion }` export

Verify the file is under 300 lines by running `wc -l src/bin/rapid-tools.cjs`.

The require section should look like:
```javascript
const { output, error, findProjectRoot } = require('../lib/core.cjs');
const { handleLock } = require('../commands/lock.cjs');
const { handleState } = require('../commands/state.cjs');
const { handlePlan } = require('../commands/plan.cjs');
const { handleWorktree } = require('../commands/worktree.cjs');
const { handleExecute } = require('../commands/execute.cjs');
const { handleMerge } = require('../commands/merge.cjs');
const { handleReview } = require('../commands/review.cjs');
const { handleResolve } = require('../commands/resolve.cjs');
const { handleInit } = require('../commands/init.cjs');
const { handleSetInit } = require('../commands/set-init.cjs');
const { handleBuildAgents } = require('../commands/build-agents.cjs');
const { handleDisplay } = require('../commands/display.cjs');
const { handlePrereqs } = require('../commands/prereqs.cjs');
const { handleParseReturn, handleVerifyArtifacts, handleAssumptions, handleContext, handleResume } = require('../commands/misc.cjs');
```

**Verification:**
```bash
wc -l src/bin/rapid-tools.cjs  # Must be < 300
node --test src/bin/contract.test.cjs
node --test src/bin/rapid-tools.test.cjs
```

---

## Success Criteria

1. All 13 command files exist in `src/commands/` with correct handler exports
2. `src/bin/rapid-tools.cjs` is under 300 lines
3. `src/bin/rapid-tools.cjs` contains ONLY: USAGE, migrateStateVersion, main (dispatch), module.exports
4. All 87 existing tests in `rapid-tools.test.cjs` pass
5. All contract tests from Wave 1 pass
6. No handler logic remains in `rapid-tools.cjs` -- only dispatch
7. `migrateStateVersion` is still exported from `rapid-tools.cjs`

## File Ownership

| File | Action |
|------|--------|
| `src/bin/rapid-tools.cjs` | Modify (reduce from 2580 to <300 lines) |
| `src/commands/display.cjs` | Create |
| `src/commands/prereqs.cjs` | Create |
| `src/commands/misc.cjs` | Create |
| `src/commands/lock.cjs` | Create |
| `src/commands/resolve.cjs` | Create |
| `src/commands/plan.cjs` | Create |
| `src/commands/set-init.cjs` | Create |
| `src/commands/init.cjs` | Create |
| `src/commands/state.cjs` | Create |
| `src/commands/worktree.cjs` | Create |
| `src/commands/review.cjs` | Create |
| `src/commands/build-agents.cjs` | Create |
| `src/commands/execute.cjs` | Create |
| `src/commands/merge.cjs` | Create |
