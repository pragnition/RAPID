# PLAN: solo-mode / Wave 2 -- Skill Updates and Review Command Solo-Aware Path

## Objective

Wire the three library functions from Wave 1 into the RAPID pipeline:
1. Add solo auto-merge logic to execute-set SKILL.md Step 6
2. Formalize the merge skill's solo skip path with the informational message UX
3. Update the review skill to auto-detect solo+merged sets and route to post-merge mode
4. Add a solo-aware scoping path in `src/commands/review.cjs` so that `--post-merge` on a solo set uses `scopeSetForReview` with `startCommit` instead of `scopeSetPostMerge` (which expects a merge commit with 2 parents)

## Owned Files

| File | Action |
|------|--------|
| `skills/execute-set/SKILL.md` | Modify -- add solo auto-merge after complete transition |
| `skills/merge/SKILL.md` | Modify -- formalize solo skip with informational message |
| `skills/review/SKILL.md` | Modify -- auto-detect solo+merged, route to post-merge |
| `src/commands/review.cjs` | Modify -- solo-aware post-merge scoping path |

---

## Task 1: Add solo auto-merge to execute-set SKILL.md Step 6

**What:** After the `complete` state transition in Step 6, add a solo check that auto-transitions to `merged` if the set is solo. This closes the lifecycle gap where solo sets get stuck at `complete`.

**Where:** `skills/execute-set/SKILL.md`, in Step 6 (line ~410), insert a new section between the state transition retry block and the "Commit marker files" block.

**Insert after the retry block** (after line 409, after `done`) **and before the "Commit marker files" block** (before line 412 "Commit marker files and GAPS.md"):

Add the following content:

```markdown
### Solo Auto-Merge

If this is a solo set, auto-transition from `complete` to `merged`. Solo sets have no branch to merge, so the merge step is skipped entirely:

\```bash
# Check if this is a solo set
REGISTRY=$(cat .planning/worktrees/REGISTRY.json 2>/dev/null || echo '{}')
IS_SOLO=$(echo "$REGISTRY" | node -e "
  const d = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
  const e = d.worktrees && d.worktrees['${SET_ID}'];
  console.log(e && e.solo === true ? 'true' : 'false');
")

if [ "$IS_SOLO" = "true" ]; then
  echo "Solo set detected -- auto-transitioning to merged status."
  for attempt in 1 2 3; do
    if node "${RAPID_TOOLS}" state transition set "${MILESTONE}" "${SET_ID}" merged 2>/dev/null; then
      echo "Set '${SET_ID}' auto-merged (solo mode)."
      break
    fi
    if [ "$attempt" -lt 3 ]; then
      sleep 2
    else
      echo "WARNING: Solo auto-merge transition failed after 3 attempts. Set is complete but not merged. Run: node \"\${RAPID_TOOLS}\" state transition set \"\${MILESTONE}\" \"\${SET_ID}\" merged"
    fi
  done
fi
\```

If auto-merge succeeded, update the final summary and next step display:
- Change "execution complete" to "execution complete (auto-merged)"
- Change next step from `/rapid:review {SET_INDEX}` to `/rapid:review {SET_INDEX}` (same -- review is the next step regardless)
- Update the progress breadcrumb to show merge as done:

\```
init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set [done] > review > merge [auto]
\```
```

**Key details:**
- Uses inline shell logic (not a function call) per the CONTEXT.md decision: "autoMergeSolo() logic lives inline in execute-set Step 6"
- Reuses the same 3-attempt retry pattern from the `complete` transition directly above
- Uses `REGISTRY.json` directly (same as merge skill Step 1d) rather than calling a library function from the skill
- The library function `autoMergeSolo()` exists as a programmatic interface; the skill uses inline shell for consistency with the existing Step 6 pattern
- Failure mode: warn but do not fail. The set is still `complete` and the user can manually transition

**What NOT to do:**
- Do NOT move the solo check before the `complete` transition -- the set must reach `complete` first
- Do NOT add the solo check to any step other than Step 6
- Do NOT import or require worktree.cjs in the SKILL.md -- skills use CLI commands and shell, not Node.js require()

**Verification:** Read the updated SKILL.md and confirm the solo auto-merge section appears between the retry block and the marker commit block in Step 6.

---

## Task 2: Formalize merge skill solo skip path

**What:** Update the merge SKILL.md to add an explicit early-exit path when a user runs `/rapid:merge` on a solo set that has already been auto-merged. Currently, Steps 1d and 3a-solo handle solo detection during bulk merge. Add handling for when a solo set is already in `merged` status.

**Where:** `skills/merge/SKILL.md`

### 2a: Update Step 1d (line ~47-58) -- Add informational message for already-merged solo sets

After the existing solo detection logic (line 55-58), add:

```markdown
If a solo set is already in `merged` status in STATE.json (auto-merged after execution):
> Set '{set-name}' is a solo set -- already merged automatically after execution. No merge needed.
> **Next step:** `/rapid:review {set-index} --post-merge`

If the user specified a single solo set to merge and it is already merged, display this message and exit gracefully. Do not treat this as an error.
```

### 2b: Update Step 3a-solo (line ~134-141) -- Add explicit guard for already-merged status

After the existing solo fast-path text (line 138-141), add:

```markdown
If the solo set is already in `merged` status in STATE.json:
> [{waveNum}/{totalWaves}] {setName}: solo set already merged (skipping)

Skip this set entirely -- do not call `merge execute`. Solo sets that were auto-merged during execute-set do not need any merge operations.
```

### 2c: Update the Important Notes section (line ~642) -- Expand the solo note

Replace the existing solo note at line 642:
```
- **Solo sets skip the entire merge pipeline.** Solo sets have `solo: true` in the registry. The merge execute command returns immediate success without git operations. No subagent is dispatched, no conflict detection runs, no integration tests are needed for solo-only waves.
```

With:
```
- **Solo sets skip the entire merge pipeline.** Solo sets have `solo: true` in the registry. Solo sets are auto-merged to `merged` status during execute-set Step 6. If a user runs `/rapid:merge` on a solo set, the pipeline detects the `merged` status and displays an informational message: "Set '{name}' is a solo set -- already merged automatically after execution. No merge needed." The merge execute command also handles solo sets gracefully by returning `{ merged: true, solo: true }` immediately without git operations. No subagent is dispatched, no conflict detection runs, no integration tests are needed for solo-only waves.
```

**What NOT to do:**
- Do NOT remove the existing solo handling in Steps 1d and 3a-solo -- augment it
- Do NOT change the `mergeSet()` function behavior in merge.cjs -- it already handles solo sets correctly
- Do NOT change the Step 6 merge execute logic -- it already works with the `{ merged: true, solo: true }` return

**Verification:** Read the updated merge SKILL.md and confirm:
- Step 1d mentions informational message for already-merged solo sets
- Step 3a-solo handles already-merged solo sets
- Important Notes section includes the expanded solo explanation

---

## Task 3: Update review skill to auto-detect solo+merged sets

**What:** Update the review SKILL.md so that Step 0c auto-detects solo+merged sets and routes them to post-merge review mode without requiring the `--post-merge` flag. Currently, Step 0c rejects `merged` status unless `POST_MERGE=true`.

**Where:** `skills/review/SKILL.md`, Step 0c (line ~112-126)

### 3a: Insert solo auto-detection before the status validation

Between line 114 ("Skip this step entirely...") and line 116 ("Read STATE.json to verify..."), insert:

```markdown
**Solo set auto-detection:** Before validating status, check if the set is a solo set with merged status:

\```bash
REGISTRY=$(cat .planning/worktrees/REGISTRY.json 2>/dev/null || echo '{}')
IS_SOLO=$(echo "$REGISTRY" | node -e "
  const d = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
  const e = d.worktrees && d.worktrees['${SET_NAME}'];
  console.log(e && e.solo === true ? 'true' : 'false');
")
\```

If `IS_SOLO` is `true`:
1. Read STATE.json to check the set's status
2. If status is `merged`: set `POST_MERGE=true` automatically and display:
   > Solo set '{set-id}' detected with merged status. Automatically switching to post-merge review mode.
3. Proceed to Step 1 (skip remaining status validation)
4. If status is `complete` or `executed`: continue with standard review path (solo sets can be reviewed pre-merge too)

This ensures solo sets that were auto-merged during execution are seamlessly reviewable without the user needing to know about `--post-merge`.
```

### 3b: Update Step 1 solo set scoping section (line ~156-166) -- Add clarity on scope path

The existing solo set scoping documentation at lines 156-166 is already correct. Add a note after line 166:

```markdown
**Important:** For solo+merged sets in auto-detected post-merge mode, the scope command uses `scopeSetForReview` with `startCommit` as the base (NOT `scopeSetPostMerge` which expects a merge commit with 2 parents). The review CLI handles this internally -- see `src/commands/review.cjs`.
```

**What NOT to do:**
- Do NOT remove the existing `--post-merge` flag handling -- it still works for normal merged sets
- Do NOT change Step 0d (review eligibility) -- it already skips when POST_MERGE=true
- Do NOT modify the REVIEW-SCOPE.md schema -- it handles post-merge mode correctly already

**Verification:** Read the updated review SKILL.md and confirm:
- Step 0c has solo auto-detection before status validation
- Solo+merged sets get routed to post-merge path automatically
- Step 1 documents the solo-specific scoping approach

---

## Task 4: Add solo-aware scoping path in review.cjs command handler

**What:** Update `src/commands/review.cjs` so that when `--post-merge` is used on a solo set, it uses `scopeSetForReview(cwd, cwd, startCommit)` instead of `scopeSetPostMerge(cwd, setId)`. The `scopeSetPostMerge` function expects a merge commit with 2 parents -- solo sets have no merge commit, so this would fail.

**Where:** `src/commands/review.cjs`, in the `case 'scope'` block (lines 15-56)

**Current code (lines 21-33):**
```javascript
const postMerge = scopeFlags['post-merge'];
// Post-merge mode: scope from merge commit, skip worktree resolution
if (postMerge) {
  try {
    const result = review.scopeSetPostMerge(cwd, setId);
    const allFiles = [...result.changedFiles, ...result.dependentFiles];
    const chunks = review.chunkByDirectory(allFiles);
    output(JSON.stringify({ ...result, chunks, postMerge: true }));
  } catch (err) {
    throw new CliError(err.message);
  }
  break;
}
```

**Replace with:**
```javascript
const postMerge = scopeFlags['post-merge'];
// Post-merge mode: scope from merge commit, skip worktree resolution
if (postMerge) {
  try {
    let result;
    // Solo sets have no merge commit -- use scopeSetForReview with startCommit
    if (wt.isSoloMode(cwd, setId)) {
      const diffBase = wt.getSetDiffBase(cwd, setId);
      result = review.scopeSetForReview(cwd, cwd, diffBase);
    } else {
      result = review.scopeSetPostMerge(cwd, setId);
    }
    const allFiles = [...result.changedFiles, ...result.dependentFiles];
    const chunks = review.chunkByDirectory(allFiles);
    output(JSON.stringify({ ...result, chunks, postMerge: true }));
  } catch (err) {
    throw new CliError(err.message);
  }
  break;
}
```

**Key details:**
- `wt.isSoloMode(cwd, setId)` is already imported (`const wt = require('../lib/worktree.cjs')` at line 12)
- `wt.getSetDiffBase(cwd, setId)` returns the `startCommit` for solo sets (the commit hash before solo set execution began)
- `review.scopeSetForReview(cwd, cwd, diffBase)` -- for solo sets, both the project root and worktree path are `cwd` (same directory), and the diff base is the startCommit
- The output shape is identical (`changedFiles`, `dependentFiles`, `totalFiles`), so downstream code (REVIEW-SCOPE.md generation) works unchanged
- The `waveId` variable is declared on line 35 (after the postMerge block), so it is not available here -- that is correct, wave attribution is not used in post-merge mode

**What NOT to do:**
- Do NOT change the non-post-merge code path (lines 34-56) -- it already handles solo sets correctly via the registry path resolution
- Do NOT modify `review.cjs` (the library) -- only the command handler needs the routing change
- Do NOT add wave attribution for solo post-merge scoping -- it is not available in this mode (the SKILL.md already documents this)

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node -e "
const r = require('./src/commands/review.cjs');
console.log('review command module loaded successfully');
"
# Expected: "review command module loaded successfully" (no syntax errors)
```

---

## Success Criteria

1. Execute-set SKILL.md Step 6 contains solo auto-merge logic after the `complete` transition
2. Merge SKILL.md handles solo sets with informational message at Steps 1d and 3a-solo
3. Review SKILL.md Step 0c auto-detects solo+merged sets and routes to post-merge mode
4. `src/commands/review.cjs` correctly routes solo post-merge scoping through `scopeSetForReview` with `startCommit`
5. No regression in normal (non-solo) set lifecycle for any of the three skills
6. Solo auto-merge progress breadcrumb shows `merge [auto]` for solo sets
