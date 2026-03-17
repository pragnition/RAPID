# Wave 2: Solo Mode Command Handlers, Skills, and Status Display

## Objective

Wire solo mode into all command handlers, skill files, and status display functions. Wave 1 provided the library-layer functions (`isSoloMode`, `getSetDiffBase`, `setInitSolo`, solo guards in `mergeSet` and `reconcileRegistry`). This wave modifies command handlers to route through the solo path, updates skill Markdown to accept the `--solo` flag and display solo-specific UX, and updates status formatters to show `'(solo)'` indicators.

## Task 1: Add `--solo` flag to `set-init` command handler

**Files:** `src/commands/set-init.cjs`

**Actions:**

1. In the `'create'` case of `handleSetInit()`, parse a `--solo` flag from `args`:
   ```javascript
   case 'create': {
     const setName = args[0];
     const isSolo = args.includes('--solo');
     if (!setName) {
       throw new CliError('Usage: rapid-tools set-init create <set-name> [--solo]');
     }
     ```

2. If `isSolo` is true, call `wt.setInitSolo(cwd, setName)` instead of `wt.setInit(cwd, setName)`:
   ```javascript
   try {
     const result = isSolo
       ? await wt.setInitSolo(cwd, setName)
       : await wt.setInit(cwd, setName);
     process.stdout.write(JSON.stringify(result) + '\n');
   } catch (err) { ... }
   ```

**What NOT to do:**
- Do not modify the `list-available` case
- Do not change the error handling structure

**Verification:**
```bash
node -e "
const src = require('fs').readFileSync('src/commands/set-init.cjs', 'utf-8');
console.log(src.includes('--solo') ? 'PASS: --solo flag parsed' : 'FAIL');
console.log(src.includes('setInitSolo') ? 'PASS: solo path called' : 'FAIL');
"
```

---

## Task 2: Solo-aware `cleanup` in `src/commands/worktree.cjs`

**Files:** `src/commands/worktree.cjs`

**Actions:**

1. In the `'cleanup'` case, after loading the registry entry, check if it is a solo entry. If so, skip `removeWorktree()` and go straight to deregistration:

   ```javascript
   case 'cleanup': {
     const setName = args[0];
     if (!setName) {
       throw new CliError('Usage: rapid-tools worktree cleanup <set-name>');
     }
     const registry = wt.loadRegistry(cwd);
     const entry = registry.worktrees[setName];
     if (!entry) {
       throw new CliError(`No worktree registered for set "${setName}"`);
     }

     // Solo sets: just deregister (no worktree to remove)
     if (entry.solo === true) {
       await wt.registryUpdate(cwd, (reg) => {
         delete reg.worktrees[setName];
         return reg;
       });
       process.stdout.write(JSON.stringify({ removed: true, setName, solo: true }) + '\n');
       break;
     }

     // Non-solo: existing worktree removal logic (unchanged)
     const absolutePath = path.resolve(cwd, entry.path);
     const result = wt.removeWorktree(cwd, absolutePath);
     // ... rest of existing code ...
   }
   ```

**What NOT to do:**
- Do not modify the non-solo cleanup path
- Do not change the `status`, `status-v2`, `reconcile`, or other cases

**Verification:**
```bash
node -e "
const src = require('fs').readFileSync('src/commands/worktree.cjs', 'utf-8');
console.log(src.includes('entry.solo') ? 'PASS: solo cleanup guard' : 'FAIL');
"
```

---

## Task 3: Solo-aware `merge execute` in `src/commands/merge.cjs`

**Files:** `src/commands/merge.cjs`

**Actions:**

1. The `mergeSet()` library function (modified in Wave 1) already returns `{ merged: true, solo: true }` for solo sets. No changes needed in the `'execute'` case -- the existing code already handles `merged: true` correctly, updating the registry and MERGE-STATE.

2. In the `'detect'` case, add a solo guard at the top before running detection:
   ```javascript
   case 'detect': {
     const setName = args[0];
     if (!setName) {
       throw new CliError('Usage: rapid-tools merge detect <set-name>');
     }
     // Solo sets: no branch to diff against
     const reg = wt.loadRegistry(cwd);
     const regEntry = reg.worktrees[setName];
     if (regEntry && regEntry.solo === true) {
       output(JSON.stringify({ solo: true, textual: { conflicts: [] }, structural: { conflicts: [] }, dependency: { conflicts: [] }, api: { conflicts: [] } }));
       break;
     }
     // ... existing detection code ...
   }
   ```

3. In the `'resolve'` case, add a solo guard:
   ```javascript
   case 'resolve': {
     const setName = args[0];
     if (!setName) {
       throw new CliError('Usage: rapid-tools merge resolve <set-name>');
     }
     const reg = wt.loadRegistry(cwd);
     const regEntry = reg.worktrees[setName];
     if (regEntry && regEntry.solo === true) {
       output(JSON.stringify({ results: [], summary: { tier1Resolved: 0, tier2Resolved: 0, unresolvedForAgent: 0, total: 0 } }));
       break;
     }
     // ... existing resolution code ...
   }
   ```

**What NOT to do:**
- Do not modify `'review'`, `'status'`, `'integration-test'`, `'order'`, `'bisect'`, `'rollback'`, or `'prepare-context'` cases -- they either work already or are not relevant to solo

**Verification:**
```bash
node -e "
const src = require('fs').readFileSync('src/commands/merge.cjs', 'utf-8');
const count = (src.match(/entry\.solo|regEntry\.solo/g) || []).length;
console.log(count >= 2 ? 'PASS: solo guards in detect and resolve' : 'FAIL: found ' + count);
"
```

---

## Task 4: Solo-aware `update-phase` in `src/commands/execute.cjs`

**Files:** `src/commands/execute.cjs`

**Actions:**

1. In the `'update-phase'` case, when creating a new entry for a set that does not exist in the registry (the `else` branch around line 142), check if the set is a solo set by looking it up in STATE.json or by accepting a `--solo` flag:

   Since we cannot reliably determine solo status without the registry entry, and the existing code creates a default entry with `branch: rapid/${setName}` and `path: .rapid-worktrees/${setName}`, the safest approach is: **check if an existing entry has `solo: true` before overwriting**.

   Modify the registry update to preserve `solo`, `startCommit`, `path`, and `branch` from existing entries:
   ```javascript
   await wt.registryUpdate(cwd, (reg) => {
     if (reg.worktrees[setName]) {
       reg.worktrees[setName].phase = phase;
       reg.worktrees[setName].updatedAt = new Date().toISOString();
     } else {
       // Create entry if not present -- use defaults for non-solo sets
       reg.worktrees[setName] = {
         setName,
         branch: `rapid/${setName}`,
         path: `.rapid-worktrees/${setName}`,
         phase,
         status: 'active',
         createdAt: new Date().toISOString(),
         updatedAt: new Date().toISOString(),
       };
     }
     return reg;
   });
   ```

   This already correctly preserves existing entries (including solo flags). The key insight: the existing `if (reg.worktrees[setName])` branch already preserves all fields. The `else` branch only fires when no entry exists, which should not happen for solo sets (they were registered by `setInitSolo`).

   **Actually, the existing code is already correct for solo mode.** When an entry exists, it only overwrites `phase` and `updatedAt`. When creating a new entry, it uses worktree defaults, which is correct since no solo set would reach this path without a registry entry.

   However, add a safety check: if a solo entry exists, do not overwrite its `branch` or `path`:
   - The existing `if` branch already does this correctly (only sets `phase` and `updatedAt`)
   - No change needed

   **Verdict:** No code change required in `update-phase`. Document this in a code comment instead:

   Add a comment in the `update-phase` case:
   ```javascript
   // Note: Solo entries are preserved -- the 'if' branch only updates phase/updatedAt,
   // keeping solo, startCommit, path, and branch intact.
   ```

**What NOT to do:**
- Do not break the existing entry creation path for non-solo sets

**Verification:**
```bash
node -e "
const src = require('fs').readFileSync('src/commands/execute.cjs', 'utf-8');
console.log(src.includes('Solo') || src.includes('solo') ? 'PASS: solo documented' : 'INFO: no solo reference yet');
"
```

---

## Task 5: Solo indicators in status display functions

**Files:** `src/lib/worktree.cjs`

**Actions:**

1. In `formatMarkIIStatus()` (line 726), modify the WORKTREE column to show `'(solo)'` for solo entries:
   ```javascript
   // Worktree path from registry
   const regEntry = registryData.worktrees[set.id];
   let worktreePath;
   if (regEntry && regEntry.solo === true) {
     worktreePath = '(solo)';
   } else {
     worktreePath = regEntry ? regEntry.path : 'not created';
   }
   ```

2. In `formatStatusTable()` (line 442), the SET column can be enhanced. In the row building section, modify the set name display for solo entries. Since `formatStatusTable` receives an array of worktree entries (not registry lookups), the solo flag is already on the entry:
   ```javascript
   const rows = worktrees.map(entry => {
     const phase = entry.phase || 'Pending';
     const displayPhase = PHASE_DISPLAY[phase] || phase;
     const wave = lookupWave(entry.setName, dagJson);
     // ... progress and lastActivity ...
     const setDisplay = entry.solo ? `${entry.setName} (solo)` : entry.setName;
     return [setDisplay, wave, displayPhase, progress, lastActivity];
   });
   ```

3. In `deriveNextActions()`, update the solo set start-set suggestion to include `--solo`:
   - No change needed: `deriveNextActions` works at the set level and does not know about solo vs non-solo. The suggestion text is generic. Solo sets that are already started will have worktree entries and flow through normal action derivation.

**What NOT to do:**
- Do not add a separate SOLO column -- use inline indicators
- Do not change column widths or add new columns to the table

**Verification:**
```bash
node -e "
const wt = require('./src/lib/worktree.cjs');
// Test formatStatusTable with a solo entry
const rows = [
  { setName: 'test-solo', phase: 'Executing', solo: true },
  { setName: 'test-normal', phase: 'Planning' },
];
const table = wt.formatStatusTable(rows);
console.log(table.includes('(solo)') ? 'PASS: solo indicator shown' : 'FAIL');
"
```

---

## Task 6: Update `start-set` skill to support `--solo` flag

**Files:** `skills/start-set/SKILL.md`

**Actions:**

1. In the skill description (line 2), update to mention solo mode:
   ```
   description: Initialize a set for development -- creates isolated worktree (or solo mode without worktree) and generates scoped CLAUDE.md
   ```

2. In **Step 1** (Determine Set to Initialize), after resolving the set name, add `--solo` flag detection:
   ```
   ### Check for --solo Flag

   Parse the user's invocation for a `--solo` flag (e.g., `/rapid:start-set 6 --solo`).

   If `--solo` is present, set `SOLO_MODE=true`. Solo mode skips worktree creation, branch creation, and scoped CLAUDE.md generation. Work happens directly on the current branch.
   ```

3. In **Step 2** (Validate Set Eligibility), add a note that solo mode skips the branch existence check:
   ```
   **If SOLO_MODE is true:** Skip the branch existence check entirely (solo mode does not create a branch).
   ```

4. In **Step 3** (Create Worktree and Scoped CLAUDE.md), add the solo path:
   ```
   **If SOLO_MODE is true:**

   Display progress: "Initializing set in solo mode: {set-name}..."

   Run the solo set-init command:

   ```bash
   # (env preamble here)
   node "${RAPID_TOOLS}" set-init create {set-name} --solo
   ```

   Parse the JSON output:
   - On success (`created: true`, `solo: true`): Display:
     - "Solo set initialized on branch {branch} at commit {startCommit}"
     - "No worktree or branch created -- working directly on {branch}"
   - On error: Display error and suggest fixes. Then STOP.

   Skip to Step 4.

   **If SOLO_MODE is false:** (existing worktree creation code unchanged)
   ```

5. In **Step 5** (Next Step), no changes needed -- the next step is always discuss-set regardless of solo mode.

**What NOT to do:**
- Do not change the allowed-tools list
- Do not add a separate skill for solo mode
- Do not modify Steps 4, 5, or 6

**Verification:** Read the file and confirm `--solo` appears in the skill text.

---

## Task 7: Update `merge` skill to detect and fast-path solo sets

**Files:** `skills/merge/SKILL.md`

**Actions:**

1. In **Step 1** (Load Merge Plan), after checking merge status (Step 1c), add a solo detection step:

   After the merge status check and before showing the merge plan, add:

   ```
   ### 1d: Detect solo sets

   For each set in the merge plan, check the registry for solo entries:

   ```bash
   # For each set in the merge order, check if solo
   node "${RAPID_TOOLS}" worktree status --json
   ```

   Parse the JSON output. For each worktree entry with `solo: true`, mark that set as a solo set. Solo sets will be fast-pathed in Step 3 (no subagent dispatch, no conflict detection).

   In the merge plan display, annotate solo sets:
   > - Wave 1: {set-name} **(solo -- auto-merge)**
   ```

2. In **Step 3** (Dispatch Per-Set Merge), add a solo fast-path before the fast-path check (Step 3b):

   ```
   ### 3a-solo: Solo set fast path

   Before running merge-tree or dispatching a subagent, check if the set is a solo set via the registry:

   If the set has `solo: true` in the registry:
   > [{waveNum}/{totalWaves}] {setName}: solo set (no merge needed)

   Skip directly to Step 6 (merge execute). The `merge execute` CLI command (via `mergeSet()`) already handles solo sets by returning `{ merged: true, solo: true }` immediately.
   ```

3. In the **Important Notes** section at the bottom, add:
   ```
   - **Solo sets skip the entire merge pipeline.** Solo sets have `solo: true` in the registry. The merge execute command returns immediate success without git operations. No subagent is dispatched, no conflict detection runs, no integration tests are needed for solo-only waves.
   ```

**What NOT to do:**
- Do not add a `--solo` flag to the merge command -- solo is auto-detected from the registry
- Do not change the rollback, bisection, or integration test logic

**Verification:** Read the file and confirm "solo" appears in the context of fast-pathing.

---

## Task 8: Update `cleanup` skill for solo sets

**Files:** `skills/cleanup/SKILL.md`

**Actions:**

1. In **Step 4** (Safety Check and Cleanup), add a solo-aware note after the cleanup command:

   ```
   **If the set is a solo set** (the JSON output contains `solo: true`):
   The cleanup was instant -- no worktree to remove, just deregistered from REGISTRY.json.
   Skip to Step 6 (no branch deletion needed for solo sets).
   ```

2. In **Step 5** (Branch Deletion), add a solo guard:

   ```
   **If the set was a solo set:** Skip branch deletion entirely (solo sets do not create branches). Print: "Solo set -- no branch to delete." Continue to Step 6.
   ```

**What NOT to do:**
- Do not change the force-removal or stash logic -- solo sets never hit those paths
- Do not change Steps 1-3 or Step 6

**Verification:** Read the file and confirm solo-aware behavior in Steps 4 and 5.

---

## Task 9: Update `execute-set` and `review` skills for solo worktree path

**Files:** `skills/execute-set/SKILL.md`, `skills/review/SKILL.md`

**Actions:**

### In `skills/execute-set/SKILL.md`:

1. In **Step 1** (Determine Worktree Path section at the end), add solo-awareness:

   ```
   ### Determine Worktree Path

   Check the registry for this set's entry:

   ```bash
   # (env preamble here)
   node "${RAPID_TOOLS}" worktree status --json
   ```

   Parse the JSON output to find the entry for `SET_ID`.

   **If the entry has `solo: true`:** The worktree path is the project root (cwd). No `.rapid-worktrees/` directory involved.

   **Otherwise:** The worktree path is `.rapid-worktrees/${SET_ID}` or the path from the registry entry.
   ```

2. In **Step 4b** (Execute Wave Batches), update the commit convention note for solo sets:
   ```
   **If solo mode:** Git commits happen directly on the current branch (typically main). The commit convention is identical -- `type({SET_ID}): description`.
   ```

### In `skills/review/SKILL.md`:

1. In **Step 0c** (Validate set status), no changes needed -- review already works for any `complete` set.

2. In **Step 2** (Scope Set Files), the `review scope` command uses `baseBranch...HEAD` diff. For solo sets, this returns nothing because HEAD IS on the base branch. Add a note:

   ```
   **Solo set scoping:** For solo sets, the scope command should use the `startCommit` from the registry entry instead of the base branch. The review scope CLI handles this internally when it detects a solo entry.
   ```

   However, since the `review scope` command is in `src/commands/review.cjs` (which is not in this set's file ownership), we need to note this as a limitation or provide workaround guidance. The actual scoping fix would require modifying `src/commands/review.cjs` to check registry for solo entries and use `startCommit` as the diff base.

   **Actually, let's add a thin wrapper.** In the review scope step, add guidance for solo sets:

   ```
   **If the set is a solo set:** Use the startCommit from the registry for scoping:
   ```bash
   # Get the solo set's start commit from registry
   REGISTRY=$(cat .planning/worktrees/REGISTRY.json)
   START_COMMIT=$(echo "$REGISTRY" | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf-8')); e=d.worktrees['${SET_NAME}']; console.log(e && e.startCommit || '')")
   # Use startCommit for diff
   git diff --name-only ${START_COMMIT}...HEAD
   ```
   ```

**What NOT to do:**
- Do not modify the review pipeline's internal structure (stages, subagent dispatch, etc.)
- Do not add solo-specific stages to the review pipeline

**Verification:** Read both skill files and confirm solo-awareness is documented.

---

## Success Criteria

- `set-init create <name> --solo` creates a virtual registry entry without a worktree
- `worktree cleanup` on solo sets deregisters without attempting worktree removal
- `merge execute` on solo sets returns success immediately (via library's solo early-return)
- `merge detect` and `merge resolve` return empty results for solo sets
- Status tables show `(solo)` indicator for solo sets
- `start-set` skill supports `--solo` flag with appropriate user-facing messages
- `merge` skill auto-detects and fast-paths solo sets
- `cleanup` skill skips worktree removal and branch deletion for solo sets
- `execute-set` and `review` skills resolve worktree path to cwd for solo sets
- All existing non-solo workflows remain unchanged
