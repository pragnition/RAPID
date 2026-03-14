# PLAN: review-after-merge / Wave 1

**Objective:** Add `scopeSetPostMerge()` to the review library, wire the `--post-merge` flag into the `review scope` CLI command, add `logIssuePostMerge()` helper for post-merge artifact directory, and cover both with unit tests. This wave builds the entire programmatic foundation that Wave 2 (skill markdown) will reference.

---

## Task 1: Add `scopeSetPostMerge()` to review.cjs

**File:** `src/lib/review.cjs` (Modify)

**What to implement:**

Add a new exported function `scopeSetPostMerge(cwd, setId)` that scopes changed files from a set's merge commit rather than a worktree branch diff. The function follows this algorithm:

1. **Read MERGE-STATE.json** for the set's `mergeCommit` hash. Import `readMergeState` from `merge.cjs` at the top of the file (new dependency). Check `const mergeState = merge.readMergeState(cwd, setId)`. If `mergeState` is not null and `mergeState.mergeCommit` is truthy, use that hash.

2. **Fallback to git log grep** if MERGE-STATE has no `mergeCommit`. Run:
   ```
   git log --oneline --grep="merge(setId)" --format="%H" -1
   ```
   Use `execSync` from `child_process` (already available via execute.cjs pattern, but import directly: `const { execSync } = require('child_process')`). If no result, throw an error: `No merge commit found for set '${setId}'. Verify the set has been merged.`

3. **Validate merge commit** has 2 parents:
   ```
   git cat-file -p <commitHash>
   ```
   Parse output for lines starting with `parent `. If fewer than 2 parent lines, throw: `Commit ${commitHash} is not a merge commit (expected 2 parents).`

4. **Get changed files** via:
   ```
   git diff --name-only <commitHash>^1..<commitHash>
   ```
   Split output by newline, filter empty strings, and filter out files starting with `.planning/`.

5. **Find dependents** by calling the existing `findDependents(cwd, changedFiles)`.

6. **Return** the same shape as `scopeSetForReview`: `{ changedFiles, dependentFiles, totalFiles }` where `totalFiles = changedFiles.length + dependentFiles.length`.

**Add the `require` for merge.cjs** near the top of review.cjs, after the existing `execute` require:
```js
const merge = require('./merge.cjs');
const { execSync } = require('child_process');
```

**Add the function** after the existing `scopeSetForReview` function (before `findDependents`), approximately after line 99.

**Add to module.exports:** Add `scopeSetPostMerge` to the exports object, in the "Scoping" section alongside `scopeSetForReview` and `findDependents`.

**What NOT to do:**
- Do NOT modify `scopeSetForReview` -- it stays as-is for standard review.
- Do NOT call `state transition` anywhere -- post-merge review must never mutate set status (CONTRACT.json behavioral rule).
- Do NOT include `.planning/` files in the returned changedFiles.

**Verification:**
```bash
node --test src/lib/review.test.cjs 2>&1 | tail -20
```

---

## Task 2: Add `logIssuePostMerge()` helper to review.cjs

**File:** `src/lib/review.cjs` (Modify)

**What to implement:**

Add a new exported function `logIssuePostMerge(cwd, setId, issue)` that writes review issues to the post-merge artifact directory (`.planning/post-merge/{setId}/`) instead of the standard `.planning/waves/{setId}/` directory.

The implementation is nearly identical to `logIssue()` but with a different base directory:

```js
function logIssuePostMerge(cwd, setId, issue) {
  const setDir = path.join(cwd, '.planning', 'post-merge', setId);
  const issuesPath = path.join(setDir, 'REVIEW-ISSUES.json');

  // Validate issue with Zod
  const validatedIssue = ReviewIssue.parse(issue);

  // Create directory if needed
  fs.mkdirSync(setDir, { recursive: true });

  // Read existing or create new container
  let existing = { setId, issues: [], lastUpdatedAt: '' };
  if (fs.existsSync(issuesPath)) {
    existing = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
  }

  // Append issue and update timestamp
  existing.issues.push(validatedIssue);
  existing.lastUpdatedAt = new Date().toISOString();

  // Write atomically
  fs.writeFileSync(issuesPath, JSON.stringify(existing, null, 2), 'utf-8');
}
```

Also add a companion `loadPostMergeIssues(cwd, setId)` function that reads issues from the post-merge directory:

```js
function loadPostMergeIssues(cwd, setId) {
  const issuesPath = path.join(cwd, '.planning', 'post-merge', setId, 'REVIEW-ISSUES.json');
  if (!fs.existsSync(issuesPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
    return data.issues || [];
  } catch {
    return [];
  }
}
```

And `generatePostMergeReviewSummary(cwd, setId, issues)` that writes `REVIEW-SUMMARY.md` to the post-merge directory:

```js
function generatePostMergeReviewSummary(cwd, setId, issues) {
  const summaryContent = generateReviewSummary(setId, issues);
  const summaryDir = path.join(cwd, '.planning', 'post-merge', setId);
  fs.mkdirSync(summaryDir, { recursive: true });
  const summaryPath = path.join(summaryDir, 'REVIEW-SUMMARY.md');
  fs.writeFileSync(summaryPath, summaryContent, 'utf-8');
  return summaryPath;
}
```

**Add to module.exports:** Add `logIssuePostMerge`, `loadPostMergeIssues`, and `generatePostMergeReviewSummary` in the exports object, grouped together under a new comment `// Post-merge review`.

**What NOT to do:**
- Do NOT modify the existing `logIssue`, `loadSetIssues`, or `updateIssueStatus` functions.
- These new functions are additive only.

**Verification:**
```bash
node --test src/lib/review.test.cjs 2>&1 | tail -20
```

---

## Task 3: Wire `--post-merge` flag into `review scope` CLI command

**File:** `src/bin/rapid-tools.cjs` (Modify)

**What to implement:**

Modify the `case 'scope'` handler inside `handleReview()` (around line 1373) to detect and handle the `--post-merge` flag. The updated handler should:

1. **Detect `--post-merge` flag** in args (same pattern as `--branch`):
   ```js
   const postMerge = args.includes('--post-merge');
   ```

2. **If `--post-merge` is set**, skip worktree path resolution and call the new scoping function:
   ```js
   if (postMerge) {
     try {
       const result = review.scopeSetPostMerge(cwd, setId);
       const allFiles = [...result.changedFiles, ...result.dependentFiles];
       const chunks = review.chunkByDirectory(allFiles);
       output(JSON.stringify({ ...result, chunks, postMerge: true }));
     } catch (err) {
       output(JSON.stringify({ error: err.message }));
       process.exit(1);
     }
     break;
   }
   ```
   Note: No `waveAttribution` for post-merge (job plans no longer relevant after merge). Include a `postMerge: true` flag in the output so callers can confirm the mode.

3. **If `--post-merge` is NOT set**, existing behavior is unchanged.

4. **Update the USAGE string** at the top of the file. Change the `review scope` line from:
   ```
   review scope <set-id> <wave-id> [--branch <b>]     Scope wave files for review
   ```
   to:
   ```
   review scope <set-id> [<wave-id>] [--branch <b>] [--post-merge]  Scope files for review
   ```

5. **Also update the error message** in the scope handler (line 1376) to include `--post-merge`:
   ```
   'Usage: rapid-tools review scope <set-id> [<wave-id>] [--branch <branch>] [--post-merge]'
   ```

Also add a new `review log-issue-post-merge` subcommand (or handle via `--post-merge` flag on existing `log-issue`). The simplest approach: add `--post-merge` flag detection to the existing `log-issue` handler. When present, call `review.logIssuePostMerge(cwd, setId, issue)` instead of `review.logIssue(cwd, setId, issue)`.

Similarly, add `--post-merge` flag to `summary` subcommand. When present, call `review.generatePostMergeReviewSummary(cwd, setId, issues)` where issues come from `review.loadPostMergeIssues(cwd, setId)`.

**What NOT to do:**
- Do NOT change behavior when `--post-merge` is absent -- all existing paths remain identical.
- Do NOT add any `state transition` calls in the post-merge path.

**Verification:**
```bash
node --test src/bin/rapid-tools.test.cjs 2>&1 | tail -20
```

---

## Task 4: Write unit tests for `scopeSetPostMerge()`

**File:** `src/lib/review.test.cjs` (Modify)

**What to implement:**

Add a new `describe('scopeSetPostMerge', ...)` block at the end of the test file (before the module closes). The tests require a git repository with a merge commit, so use the following setup pattern:

**Test setup helper** (add at the top of the new describe block):

```js
function createGitRepoWithMerge(tmpDir, setId) {
  const { execSync } = require('child_process');
  const opts = { cwd: tmpDir, stdio: 'pipe' };

  // Init repo
  execSync('git init', opts);
  execSync('git config user.email "test@test.com"', opts);
  execSync('git config user.name "Test"', opts);

  // Create initial file and commit on main
  fs.writeFileSync(path.join(tmpDir, 'base.cjs'), 'module.exports = {};');
  execSync('git add base.cjs', opts);
  execSync('git commit -m "initial commit"', opts);

  // Create feature branch
  execSync(`git checkout -b rapid/${setId}`, opts);

  // Add files on feature branch
  fs.writeFileSync(path.join(tmpDir, 'feature.cjs'), 'module.exports = { feature: true };');
  fs.writeFileSync(path.join(tmpDir, 'helper.cjs'), 'module.exports = { help: true };');
  execSync('git add feature.cjs helper.cjs', opts);
  execSync(`git commit -m "feat(${setId}): add feature files"`, opts);

  // Switch back to main and merge
  execSync('git checkout main', opts);
  // Use merge commit message format matching RAPID convention
  execSync(`git merge rapid/${setId} --no-ff -m "merge(${setId}): merge set into main"`, opts);

  // Get the merge commit hash
  const mergeCommit = execSync('git rev-parse HEAD', opts).toString().trim();
  return mergeCommit;
}
```

**Test cases:**

1. **"returns changed files from merge commit diff"** -- Create a repo with merge, call `scopeSetPostMerge(tmpDir, setId)`, verify `changedFiles` contains `feature.cjs` and `helper.cjs` and `totalFiles >= 2`.

2. **"uses MERGE-STATE.json mergeCommit when available"** -- Create repo with merge, write a valid MERGE-STATE.json to `.planning/sets/{setId}/MERGE-STATE.json` containing the `mergeCommit` hash, call `scopeSetPostMerge()`, verify it returns the correct changed files.

3. **"falls back to git log grep when MERGE-STATE missing"** -- Create repo with merge, do NOT write MERGE-STATE.json, call `scopeSetPostMerge()`, verify it still finds the merge commit via git log and returns correct files.

4. **"filters out .planning/ files from results"** -- Create repo with merge, add a `.planning/test.md` file to the feature branch before merging, verify it does NOT appear in `changedFiles`.

5. **"throws when set was never merged"** -- Call `scopeSetPostMerge(tmpDir, 'nonexistent-set')` on a repo with no matching merge commit, verify it throws with message containing "No merge commit found".

6. **"does not call state transition (behavioral contract)"** -- This is a structural test: verify that `scopeSetPostMerge.toString()` does NOT contain the string `state transition` or `transition`. Also verify the function signature does not accept a `stateMachine` or `sm` parameter.

7. **"finds dependents of changed files"** -- Create a repo where an existing file (`consumer.cjs`) imports `feature.cjs`. Merge the branch. Call `scopeSetPostMerge()`. Verify `dependentFiles` contains `consumer.cjs`.

**What NOT to do:**
- Do NOT modify existing tests -- only add new ones.
- Do NOT forget to clean up tmpDir in `afterEach`.

**Verification:**
```bash
node --test src/lib/review.test.cjs --test-name-pattern "scopeSetPostMerge" 2>&1 | tail -30
```

---

## Task 5: Write unit tests for post-merge artifact functions and CLI `--post-merge` flag

**Files:** `src/lib/review.test.cjs` (Modify), `src/bin/rapid-tools.test.cjs` (Modify)

**What to implement in review.test.cjs:**

Add a `describe('logIssuePostMerge', ...)` block:

1. **"writes issue to .planning/post-merge/{setId}/ directory"** -- Create tmpDir, call `logIssuePostMerge(tmpDir, 'test-set', validIssue)`, verify the file `.planning/post-merge/test-set/REVIEW-ISSUES.json` exists and contains the issue.

2. **"creates directory if it does not exist"** -- Verify the `.planning/post-merge/` directory is created automatically.

3. **"appends to existing issues"** -- Log two issues, verify both appear in the JSON file.

Add a `describe('loadPostMergeIssues', ...)` block:

4. **"returns empty array when no post-merge issues exist"** -- Call on a tmpDir with no post-merge directory, verify `[]`.

5. **"loads issues from post-merge directory"** -- Log an issue via `logIssuePostMerge`, then load via `loadPostMergeIssues`, verify the issue is returned.

Add a `describe('generatePostMergeReviewSummary', ...)` block:

6. **"writes REVIEW-SUMMARY.md to post-merge directory"** -- Call with mock issues, verify file is written to `.planning/post-merge/{setId}/REVIEW-SUMMARY.md`.

**What to implement in rapid-tools.test.cjs:**

Add a test case (or describe block) for the `--post-merge` flag on the `review scope` command. Since the CLI tests likely test via `execSync` or `execFileSync`, the test should:

1. **"review scope --post-merge returns postMerge:true in output"** -- Requires a git repo with a merge commit. Create the same test setup as Task 4, run `node rapid-tools.cjs review scope <setId> --post-merge`, parse JSON output, verify `postMerge === true` and `changedFiles` is present.

2. **"review scope without --post-merge does not include postMerge flag"** -- Run normal scope command, verify output does NOT contain `postMerge`.

**What NOT to do:**
- Do NOT modify existing test cases.
- Keep tests independent (each has its own tmpDir).

**Verification:**
```bash
node --test src/lib/review.test.cjs --test-name-pattern "PostMerge|post-merge|logIssuePostMerge" 2>&1 | tail -30
node --test src/bin/rapid-tools.test.cjs --test-name-pattern "post-merge" 2>&1 | tail -30
```

---

## Success Criteria

1. `node --test src/lib/review.test.cjs` passes all existing AND new tests (0 failures).
2. `node --test src/bin/rapid-tools.test.cjs` passes all existing AND new tests (0 failures).
3. `scopeSetPostMerge()` correctly identifies changed files from a merge commit diff.
4. `scopeSetPostMerge()` never calls `state transition` (verified by structural test).
5. `--post-merge` flag on `review scope` CLI routes to `scopeSetPostMerge()`.
6. Post-merge artifacts write to `.planning/post-merge/{setId}/` -- NOT `.planning/waves/{setId}/`.
7. All new functions are exported from `review.cjs`.
8. All new CLI flags appear in the USAGE string.

## File Ownership

| File | Action |
|------|--------|
| `src/lib/review.cjs` | Modify |
| `src/bin/rapid-tools.cjs` | Modify |
| `src/lib/review.test.cjs` | Modify |
| `src/bin/rapid-tools.test.cjs` | Modify |
