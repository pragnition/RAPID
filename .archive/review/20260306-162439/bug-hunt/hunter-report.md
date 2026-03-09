# Bug Hunt Report

## Summary
- Total findings: 18
- Critical: 2 | High: 5 | Medium: 7 | Low: 4
- High confidence: 9 | Medium confidence: 6 | Low confidence: 3

## Findings

### BUG-001: Command Injection via Unsanitized setName in gitExec
- **File**: `/home/kek/Projects/RAPID/src/lib/worktree.cjs:21,73,79`
- **Category**: Security vulnerability (command injection)
- **Risk**: Critical
- **Confidence**: High
- **Description**: The `gitExec` function constructs a shell command by joining args with spaces and passing to `execSync` as a template literal (line 21: `` execSync(`git ${args.join(' ')}`, ...) ``). The `createWorktree` function at line 73 passes `setName` directly into this shell command via the branch name `rapid/${setName}`. There is NO validation or sanitization of `setName` in `createWorktree` or `setInit`. A malicious `setName` containing shell metacharacters (e.g., `; rm -rf /` or `$(malicious_command)`) could execute arbitrary commands. While `deleteBranch` validates its input (line 125), `createWorktree` does not.
- **Reproduction Path**: Call `setInit(cwd, '$(whoami)')` or `createWorktree(cwd, '; echo pwned')`. The interpolated string `git worktree add -b rapid/$(whoami) ...` would execute the subshell command.
- **Code Snippet**:
  ```javascript
  // worktree.cjs:19-21
  function gitExec(args, cwd) {
    try {
      const result = execSync(`git ${args.join(' ')}`, { ... });
  
  // worktree.cjs:72-79
  function createWorktree(projectRoot, setName) {
    const branch = `rapid/${setName}`;  // No validation!
    const worktreePath = path.resolve(projectRoot, WORKTREE_DIR, setName);
    // ...
    const result = gitExec(
      ['worktree', 'add', '-b', branch, `"${worktreePath}"`, 'HEAD'],
      projectRoot
    );
  ```
- **Suggested Fix**: Add input validation to `createWorktree` (and `setInit`) to reject setNames containing shell metacharacters, spaces, or path separators. Use `execFileSync` instead of `execSync` to avoid shell interpretation entirely, or validate setName against a strict pattern like `/^[a-zA-Z0-9._-]+$/`.

---

### BUG-002: Path Traversal via Unsanitized setName in createWorktree
- **File**: `/home/kek/Projects/RAPID/src/lib/worktree.cjs:74`
- **Category**: Security vulnerability (path traversal)
- **Risk**: Critical
- **Confidence**: High
- **Description**: The `createWorktree` function builds the worktree path using `path.resolve(projectRoot, WORKTREE_DIR, setName)` (line 74). Since `setName` is not validated, a value like `../../etc` would resolve to a path outside the project directory. Similarly in `setInit`, the generated `CLAUDE.md` would be written to an arbitrary location. This allows writing files and creating git worktrees outside the intended `.rapid-worktrees/` directory.
- **Reproduction Path**: Call `createWorktree('/tmp/repo', '../../../tmp/evil')` -- this would resolve to `/tmp/evil` and create a git worktree there.
- **Code Snippet**:
  ```javascript
  // worktree.cjs:74
  const worktreePath = path.resolve(projectRoot, WORKTREE_DIR, setName);
  // With setName = "../../etc", this resolves to /tmp/repo/../../etc = /etc
  ```
- **Suggested Fix**: Validate that `setName` does not contain path separators (`/`, `\`, `..`). After resolving the path, verify it is still under the `WORKTREE_DIR` directory using a prefix check.

---

### BUG-003: testResults Property Name Mismatch in merge review
- **File**: `/home/kek/Projects/RAPID/src/bin/rapid-tools.cjs:1556` and `/home/kek/Projects/RAPID/src/lib/merge.cjs:326`
- **Category**: Logic error (property name mismatch)
- **Risk**: High
- **Confidence**: High
- **Description**: The `merge review` CLI handler (rapid-tools.cjs:1556) passes `testResults: { pass: result.testsPass, output: result.testOutput }` to `writeReviewMd`. However, `writeReviewMd` (merge.cjs:326) checks `reviewData.testResults.passed` (note: `.passed`, not `.pass`). Since `testResults.passed` is always `undefined` (falsy), the REVIEW.md will ALWAYS report "Test suite: FAIL" regardless of actual test results. This is a data loss bug that causes incorrect review verdicts.
- **Reproduction Path**: Run `rapid-tools merge review <set-name>` when tests pass. The generated REVIEW.md will incorrectly show "Test suite: FAIL".
- **Code Snippet**:
  ```javascript
  // rapid-tools.cjs:1556 - passes `.pass`
  testResults: { pass: result.testsPass, output: result.testOutput },
  
  // merge.cjs:326 - reads `.passed`
  if (reviewData.testResults.passed) {
    lines.push('- Test suite: PASS');
  } else {
    lines.push('- Test suite: FAIL');  // Always hits this branch
  }
  ```
- **Suggested Fix**: Change line 1556 to use `passed` instead of `pass`: `testResults: { passed: result.testsPass, output: result.testOutput }`.

---

### BUG-004: execute resume Does Not Validate Phase is Paused
- **File**: `/home/kek/Projects/RAPID/src/bin/rapid-tools.cjs:1425-1462`
- **Category**: Missing input validation (state transition safety)
- **Risk**: High
- **Confidence**: High
- **Description**: The `execute resume` subcommand (lines 1425-1462) does NOT validate that the set's phase is `Paused` before transitioning it to `Executing`. In contrast, the top-level `resume` command (lines 1137-1147) correctly validates `entry.phase !== 'Paused'`. This means calling `rapid-tools execute resume <set>` on a set in any phase (e.g., `Done`, `Error`, `Discussing`) will transition it to `Executing` without any guard, potentially corrupting the lifecycle state.
- **Reproduction Path**: Call `rapid-tools execute resume my-set` when `my-set` is in `Done` phase. The registry will incorrectly transition to `Executing`.
- **Code Snippet**:
  ```javascript
  // rapid-tools.cjs:1425-1454 - execute resume handler
  case 'resume': {
    const setName = args[0];
    // ... validates HANDOFF.md exists
    // ... parses handoff
    // NO phase validation here!
    await wt.registryUpdate(cwd, (reg) => {
      if (reg.worktrees[setName]) {
        reg.worktrees[setName].phase = 'Executing';  // Blindly transitions
  ```
- **Suggested Fix**: Add phase validation before the registry update, matching the guard in `handleResume`: check `entry.phase !== 'Paused'` and exit with an error if the phase is wrong.

---

### BUG-005: execute resume Missing pauseCycles and stateContext in Response
- **File**: `/home/kek/Projects/RAPID/src/bin/rapid-tools.cjs:1425-1462`
- **Category**: Logic error (inconsistent API response)
- **Risk**: High
- **Confidence**: High
- **Description**: The `execute resume` subcommand response (lines 1455-1461) does NOT include `pauseCycles` or `stateContext` fields, while the top-level `resume` command (lines 1201-1209) does include both. The `resume` SKILL.md expects these fields in the response (line 56: `pauseCycles: number of times this set has been paused`). Any caller using `execute resume` instead of `resume` will get an incomplete response missing critical context for the executor.
- **Reproduction Path**: Call `rapid-tools execute resume my-set` -- the JSON response will lack `pauseCycles` and `stateContext` fields.
- **Code Snippet**:
  ```javascript
  // execute resume response (incomplete):
  { resumed: true, setName, handoff, definitionPath, contractPath }
  
  // top-level resume response (complete):
  { resumed: true, setName, handoff, stateContext, definitionPath, contractPath, pauseCycles: entry.pauseCycles || 0 }
  ```
- **Suggested Fix**: Either deprecate `execute resume` in favor of the top-level `resume`, or add the missing `pauseCycles` and `stateContext` fields to the `execute resume` response.

---

### BUG-006: TOCTOU Race in execute pause Phase Validation
- **File**: `/home/kek/Projects/RAPID/src/bin/rapid-tools.cjs:1383-1420`
- **Category**: Race condition (TOCTOU)
- **Risk**: High
- **Confidence**: Medium
- **Description**: The `execute pause` handler loads the registry WITHOUT a lock (line 1383: `wt.loadRegistry(cwd)`) to validate that the phase is `Executing`. Then, after reading stdin and generating the handoff file, it calls `registryUpdate` (line 1413) which acquires a lock and re-loads the registry. Between the unlocked read and the locked update, another process could have changed the set's phase (e.g., from Executing to Done). The phase validation (line 1389) would pass on stale data, leading to incorrect state transition. The same TOCTOU pattern exists in `handleResume` (line 1138 vs 1193).
- **Reproduction Path**: Two concurrent processes: Process A reads registry (phase=Executing), Process B transitions phase to Done, Process A proceeds to write Paused phase based on stale check.
- **Code Snippet**:
  ```javascript
  // Unlocked read for validation:
  const registry = wt.loadRegistry(cwd);  // No lock
  const entry = registry.worktrees[setName];
  if (entry.phase !== 'Executing') { /* reject */ }
  
  // ... time passes (stdin read, handoff generation) ...
  
  // Locked update:
  await wt.registryUpdate(cwd, (reg) => {  // Acquires lock, re-reads
    reg.worktrees[setName].phase = 'Paused';  // Phase may have changed!
  });
  ```
- **Suggested Fix**: Move the phase validation INSIDE the `registryUpdate` callback, where the registry is read under lock. If the phase check fails inside the callback, throw an error that is caught outside.

---

### BUG-007: Orphaned registeredBranches Fallback Uses Potentially Undefined setName
- **File**: `/home/kek/Projects/RAPID/src/lib/worktree.cjs:277`
- **Category**: Logic error (undefined property access)
- **Risk**: Medium
- **Confidence**: Medium
- **Description**: In `reconcileRegistry` (line 277), `registeredBranches` is built using `e.setName` as a fallback when `e.branch` is missing. If a registry entry exists but lacks both `branch` and `setName` properties (e.g., from a corrupt or manually edited REGISTRY.json), the fallback produces `"rapid/undefined"` which is an invalid branch name. This would prevent the actual discovery of a legitimate `rapid/undefined` worktree (unlikely but possible), and more importantly it means the set of `registeredBranches` contains bogus entries that could mask real discrepancies.
- **Reproduction Path**: Manually edit REGISTRY.json to have an entry `{ "some-set": { "path": "..." } }` without `branch` or `setName`. Run `worktree reconcile`.
- **Code Snippet**:
  ```javascript
  // worktree.cjs:276-278
  const registeredBranches = new Set(
    Object.values(registry.worktrees).map(e => e.branch || `rapid/${e.setName}`)
    // If e.setName is undefined: `rapid/undefined`
  );
  ```
- **Suggested Fix**: Use the Object.entries key as the setName fallback: `Object.entries(registry.worktrees).map(([key, e]) => e.branch || \`rapid/${key}\`)`.

---

### BUG-008: Dead Variable gitPaths in reconcileRegistry
- **File**: `/home/kek/Projects/RAPID/src/lib/worktree.cjs:265`
- **Category**: Dead code
- **Risk**: Medium
- **Confidence**: High
- **Description**: The variable `gitPaths` is declared and populated at line 265 (`const gitPaths = new Set(gitWorktrees.map(w => w.path))`) but is never used anywhere in the function or module. This suggests either an incomplete implementation (the reconcile function was intended to cross-check paths but doesn't) or leftover code from a refactor. If path-based reconciliation was intended, its absence means the function only checks branch names, not actual filesystem paths.
- **Reproduction Path**: N/A (dead code, no runtime impact). However, the missing path check means a registry entry could point to a different path than the git worktree, and reconciliation would not detect this.
- **Code Snippet**:
  ```javascript
  // worktree.cjs:265
  const gitPaths = new Set(gitWorktrees.map(w => w.path));
  // Never referenced again in the function
  ```
- **Suggested Fix**: Either remove the variable if path-based reconciliation is not needed, or add a path-matching check where orphaned entries are also detected when the path doesn't match.

---

### BUG-009: relativeTime Returns Malformed String for Invalid Timestamps
- **File**: `/home/kek/Projects/RAPID/src/lib/worktree.cjs:397-408`
- **Category**: Data validation (edge case)
- **Risk**: Medium
- **Confidence**: High
- **Description**: The `relativeTime` function does not validate that `Date.parse(isoString)` returns a valid number. If the input string is not a valid ISO 8601 date (e.g., `"not-a-date"` or an empty string that passes the truthy check), `Date.parse()` returns `NaN`. Then `Date.now() - NaN` = `NaN`, and all comparisons with `NaN` return `false`, so execution falls through to return `"NaN days ago"`. Additionally, future dates (negative `diff`) would show negative values like `"-5 min ago"`.
- **Reproduction Path**: Set a registry entry's `updatedAt` to `"invalid-date"` or a future timestamp. Run `worktree status` -- the LAST ACTIVITY column will show `"NaN days ago"` or `"-3 min ago"`.
- **Code Snippet**:
  ```javascript
  function relativeTime(isoString) {
    if (!isoString) return '-';
    const diff = Date.now() - Date.parse(isoString);  // NaN if invalid
    const seconds = Math.floor(diff / 1000);           // NaN
    if (seconds < 60) return 'just now';               // false for NaN
    const minutes = Math.floor(seconds / 60);          // NaN
    if (minutes < 60) return `${minutes} min ago`;     // false for NaN
    const hours = Math.floor(minutes / 60);            // NaN
    if (hours < 24) return `${hours} hr ago`;          // false for NaN
    const days = Math.floor(hours / 24);               // NaN
    return `${days} days ago`;                         // "NaN days ago"
  }
  ```
- **Suggested Fix**: Add a `NaN` check after `Date.parse()`: `if (isNaN(diff)) return '-';`. Optionally handle negative `diff` for future dates by returning `'just now'`.

---

### BUG-010: setInit Silently Swallows CLAUDE.md Generation Errors
- **File**: `/home/kek/Projects/RAPID/src/lib/worktree.cjs:320-328`
- **Category**: Error handling (swallowed error)
- **Risk**: Medium
- **Confidence**: Medium
- **Description**: The `setInit` function catches ALL errors from `generateScopedClaudeMd` and silently ignores them (lines 324-328). While the function returns `claudeMdGenerated: false`, the original error message is lost. This makes debugging difficult -- if the CONTRACT.json has a syntax error or a dependency like `plan.cjs` throws an unexpected error, the user sees only that CLAUDE.md was not generated, not WHY. The SKILL.md at line 105 says to warn the user when `claudeMdGenerated` is false, but the CLI JSON output does not include the error message.
- **Reproduction Path**: Create a set with a malformed CONTRACT.json. Run `set-init create <set>`. The output shows `claudeMdGenerated: false` but no error details.
- **Code Snippet**:
  ```javascript
  try {
    const claudeMd = generateScopedClaudeMd(cwd, setName);
    fs.writeFileSync(path.join(worktreePath, 'CLAUDE.md'), claudeMd, 'utf-8');
    claudeMdGenerated = true;
  } catch (err) {
    // Error message is completely lost
    // No logging, no error field in the return value
  }
  ```
- **Suggested Fix**: Capture `err.message` and include it in the return value as a `claudeMdError` field: `return { created: true, ..., claudeMdGenerated, claudeMdError: claudeMdGenerated ? null : err.message };`.

---

### BUG-011: Double-Quoted Path in gitExec Shell Command
- **File**: `/home/kek/Projects/RAPID/src/lib/worktree.cjs:79,101`
- **Category**: Logic error (shell quoting)
- **Risk**: Medium
- **Confidence**: Medium
- **Description**: The `createWorktree` and `removeWorktree` functions pass worktree paths wrapped in literal double quotes to `gitExec`: `` `"${worktreePath}"` ``. Since `gitExec` uses `execSync` with a shell, these quotes are interpreted by the shell. However, if the path itself contains a `"` character (unlikely on most systems but valid), the quoting breaks and causes command failure or injection. More importantly, this pattern is fragile -- it relies on the shell interpreting the quotes correctly. Using `execFileSync` would avoid shell quoting issues entirely.
- **Reproduction Path**: Create a project in a directory path containing a literal `"` character. Run `set-init create test` -- the git command will fail or behave unexpectedly.
- **Code Snippet**:
  ```javascript
  // worktree.cjs:79 - literal quotes embedded in template string
  const result = gitExec(
    ['worktree', 'add', '-b', branch, `"${worktreePath}"`, 'HEAD'],
    projectRoot
  );
  
  // worktree.cjs:101
  const result = gitExec(['worktree', 'remove', `"${worktreePath}"`], projectRoot);
  ```
- **Suggested Fix**: Refactor `gitExec` to use `execFileSync('git', args, ...)` instead of `execSync(\`git ${args.join(' ')}\`, ...)`. This avoids shell interpretation entirely and handles paths with special characters correctly.

---

### BUG-012: reconcileRegistry Marks Main Worktree as Orphaned
- **File**: `/home/kek/Projects/RAPID/src/lib/worktree.cjs:267-273`
- **Category**: Logic error (false positive orphaning)
- **Risk**: Medium
- **Confidence**: Low
- **Description**: The orphaning loop in `reconcileRegistry` marks any registry entry as orphaned if its expected branch is not found in `gitBranches`. If a registry entry was created with `branch: "main"` (e.g., through manual editing or a bug in another part of the system), it would correctly be found. However, if the worktree was removed from git but the branch still exists (e.g., `git worktree remove` was run but the branch was kept), the entry would be marked orphaned even though the branch still exists. The function only checks git worktree branches, not all git branches. This could lead to incorrect orphan status for entries whose worktrees were cleaned up but branches retained.
- **Reproduction Path**: Create a worktree, clean it up with `git worktree remove`, keep the branch. Run `worktree reconcile` -- the entry is marked orphaned even though the branch exists.
- **Code Snippet**:
  ```javascript
  // Only checks branches associated with active worktrees, not all branches
  const gitBranches = new Set(gitWorktrees.map(w => w.branch).filter(Boolean));
  
  for (const [setName, entry] of Object.entries(registry.worktrees)) {
    const expectedBranch = entry.branch || `rapid/${setName}`;
    if (!gitBranches.has(expectedBranch)) {
      entry.status = 'orphaned';  // Branch might still exist, just no worktree
    }
  }
  ```
- **Suggested Fix**: This may be intentional (orphaned means no worktree, not no branch). If so, rename the status to `'worktree-removed'` for clarity. If not, add a git branch existence check alongside the worktree check.

---

### BUG-013: update-phase Does Not Include 'Created' or 'Pending' as Valid Phases
- **File**: `/home/kek/Projects/RAPID/src/bin/rapid-tools.cjs:1349`
- **Category**: Logic error (incomplete validation whitelist)
- **Risk**: Medium
- **Confidence**: Medium
- **Description**: The `execute update-phase` command validates phases against `['Discussing', 'Planning', 'Executing', 'Verifying', 'Done', 'Error', 'Paused']` (line 1349). The phases `'Created'` and `'Pending'` are NOT included, even though `setInit` uses `'Created'` and `PHASE_DISPLAY` maps both `'Created'` and `'Pending'`. This means `update-phase` cannot be used to reset a set back to its initial state, and any attempt to set phase to `Created` or `Pending` will be rejected. While this may be intentional (these are initial-only states), it creates an inconsistency where the system produces states that the update mechanism cannot reproduce.
- **Reproduction Path**: Run `rapid-tools execute update-phase my-set Created` -- this will be rejected with "Invalid phase".
- **Code Snippet**:
  ```javascript
  // rapid-tools.cjs:1349
  const validPhases = ['Discussing', 'Planning', 'Executing', 'Verifying', 'Done', 'Error', 'Paused'];
  // Missing: 'Created', 'Pending'
  ```
- **Suggested Fix**: Add `'Created'` and `'Pending'` to the valid phases list, or document explicitly that these phases are initial-only and cannot be set via `update-phase`.

---

### BUG-014: setInit Does Not Validate setName Before Use
- **File**: `/home/kek/Projects/RAPID/src/lib/worktree.cjs:314`
- **Category**: Missing input validation
- **Risk**: High
- **Confidence**: High
- **Description**: The `setInit` function accepts any string as `setName` without validation. Unlike `deleteBranch` (line 125) which validates the branch name for non-empty, non-whitespace, no-spaces, `setInit` and `createWorktree` perform no validation. This is the root cause enabling BUG-001 (command injection) and BUG-002 (path traversal). Even setting aside security concerns, an empty string, whitespace-only string, or string with special characters would cause cryptic git errors rather than clear validation failures.
- **Reproduction Path**: Call `set-init create ""` or `set-init create "my set"` -- these would produce confusing git errors instead of clear validation messages.
- **Code Snippet**:
  ```javascript
  // worktree.cjs:314 - no validation
  async function setInit(cwd, setName) {
    const { branch, path: worktreePath } = createWorktree(cwd, setName);
    // setName goes directly to git commands and file paths
  
  // Contrast with deleteBranch:125 which DOES validate
  function deleteBranch(cwd, branchName, force = false) {
    if (!branchName || typeof branchName !== 'string' || branchName.trim() === '' || branchName.includes(' ')) {
      throw new Error(`Invalid branch name...`);
    }
  ```
- **Suggested Fix**: Add validation at the top of `createWorktree` matching the pattern from `deleteBranch`: reject empty, whitespace, space-containing, and path-traversal setNames. Use a strict regex like `/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/`.

---

### BUG-015: Cleanup SKILL Uses Relative Paths in git -C Commands
- **File**: `/home/kek/Projects/RAPID/skills/cleanup/SKILL.md:70-77,89`
- **Category**: Logic error (relative path assumption)
- **Risk**: Low
- **Confidence**: Medium
- **Description**: The cleanup SKILL.md instructs the agent to run `git -C .rapid-worktrees/{setName}` commands (lines 70, 76, 89). These are relative paths that depend on the shell's current working directory being the project root. If the SKILL is invoked from a different directory or the agent's CWD changes, these commands will fail silently or operate on the wrong directory. The worktree path should be resolved from the registry or from the CLI output.
- **Reproduction Path**: Invoke `/rapid:cleanup` when the working directory is not the project root (e.g., from a subdirectory).
- **Code Snippet**:
  ```bash
  # cleanup/SKILL.md:70
  git -C .rapid-worktrees/{setName} add -A && git -C .rapid-worktrees/{setName} commit -m 'WIP: save before cleanup'
  
  # cleanup/SKILL.md:76
  git -C .rapid-worktrees/{setName} stash push -m 'rapid-cleanup-stash'
  
  # cleanup/SKILL.md:89
  git worktree remove --force .rapid-worktrees/{setName}
  ```
- **Suggested Fix**: Use the absolute worktree path from the registry entry or prefix commands with `cd "$RAPID_ROOT" &&`.

---

### BUG-016: Resume SKILL Transitions State Before User Confirmation
- **File**: `/home/kek/Projects/RAPID/skills/resume/SKILL.md:42-45,99`
- **Category**: Logic error (premature state transition)
- **Risk**: Low
- **Confidence**: High
- **Description**: The resume SKILL.md calls `node "${RAPID_TOOLS}" resume {setName}` in Step 3 (line 45), which immediately transitions the set from Paused to Executing in the registry (as noted in line 99: "The resume CLI (Step 3) has already transitioned the set from Paused to Executing in REGISTRY.json"). The user confirmation happens LATER in Step 5. If the user selects "Cancel" in Step 5, the set has already been transitioned to Executing and there is no rollback. The user would need to manually pause again or update the phase.
- **Reproduction Path**: Run `/rapid:resume my-set`. The CLI transitions the state immediately. When prompted in Step 5, select "Cancel". The set remains in Executing phase despite cancellation.
- **Code Snippet**:
  ```markdown
  ## Step 3: Load Resume Data (TRANSITIONS STATE)
  node "${RAPID_TOOLS}" resume {setName}
  
  ## Step 5: Confirm Resume
  "Cancel" -- "Keep set paused, exit resume flow"
  # But state was already transitioned in Step 3!
  ```
- **Suggested Fix**: Split the resume command into two steps: a read-only `resume --dry-run` or `resume --info` that loads handoff data without transitioning, and a separate `resume --confirm` that performs the actual transition. Or move the state transition to after Step 5 confirmation.

---

### BUG-017: formatWaveProgress Returns Identical Strings for Different States
- **File**: `/home/kek/Projects/RAPID/src/lib/worktree.cjs:689-709`
- **Category**: Logic error (indistinguishable output)
- **Risk**: Low
- **Confidence**: High
- **Description**: The `formatWaveProgress` function has three branches (lines 699-705) for `completed === total`, `completed > 0`, and `completed === 0`. The first two branches produce identical output: `"W1: 3/5 done"`. There is no distinction between a fully completed wave and a partially completed wave in the rendered string. While both show the ratio, the labels are identical ("done" vs "done"), making it impossible for the user to distinguish at a glance.
- **Reproduction Path**: Compare output for a wave with 5/5 jobs complete vs 3/5 jobs complete -- both show "done" suffix.
- **Code Snippet**:
  ```javascript
  if (completed === total && total > 0) {
    parts.push(`${label}: ${completed}/${total} done`);    // "W1: 5/5 done"
  } else if (completed > 0) {
    parts.push(`${label}: ${completed}/${total} done`);    // "W1: 3/5 done" (same!)
  } else {
    parts.push(`${label}: ${completed}/${total} pending`); // "W1: 0/5 pending"
  }
  ```
- **Suggested Fix**: Use a different label for full completion, e.g., `"complete"` for 5/5 and `"done"` for partial: `parts.push(\`${label}: ${completed}/${total} complete\`)` for the first branch.

---

### BUG-018: Mismatched JSDoc Comment for formatStatusOutput Function
- **File**: `/home/kek/Projects/RAPID/src/lib/worktree.cjs:656-664,832`
- **Category**: Documentation error / code smell
- **Risk**: Low
- **Confidence**: High
- **Description**: The JSDoc comment block for `formatStatusOutput` (lines 656-664) is separated from its actual function definition (line 832) by approximately 170 lines of other code (the Mark II Status Dashboard section). The JSDoc is orphaned and not attached to any function -- it sits between the end of `formatWaveSummary` and the beginning of the Mark II section. The actual `formatStatusOutput` function at line 832 has NO JSDoc comment. This makes the code confusing to read and any IDE/documentation tool would associate the JSDoc with the wrong construct.
- **Reproduction Path**: Open the file in an IDE and hover over `formatStatusOutput` at line 832 -- no JSDoc will appear. The JSDoc at line 656 is orphaned.
- **Code Snippet**:
  ```javascript
  // Line 656-664: Orphaned JSDoc
  /**
   * Format status output with optional execution mode indicator.
   * ...
   * @returns {string} Formatted output with optional mode header
   */
  // ──────────────────────────
  // Mark II Status Dashboard
  // ──────────────────────────
  
  // ... 170 lines of other code ...
  
  // Line 832: Actual function with no JSDoc
  function formatStatusOutput(worktrees, dagJson, executionMode) {
  ```
- **Suggested Fix**: Move the JSDoc comment to directly above the function definition at line 832, or move the function definition to directly below the JSDoc.
