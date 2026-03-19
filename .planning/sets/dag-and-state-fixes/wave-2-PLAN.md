# PLAN: dag-and-state-fixes / Wave 2

## Objective

Migrate all DAG.json consumers to use `tryLoadDAG()`, fix the wrong DAG path in merge.cjs, restructure execute-set SKILL.md Step 6 for reliability, and add DAG creation to init SKILL.md. This wave builds on the `tryLoadDAG` function and `DAG_CANONICAL_SUBPATH` constant created in Wave 1.

## Prerequisites

Wave 1 must be complete:
- `tryLoadDAG(cwd)` exists in `src/lib/dag.cjs` and is exported
- `DAG_CANONICAL_SUBPATH` constant is exported from `src/lib/dag.cjs`

## Tasks

### Task 1: Fix merge.cjs `detectCascadeImpact` wrong path and migrate to tryLoadDAG

**File:** `/home/kek/Projects/RAPID/src/lib/merge.cjs`

**Actions:**
1. The `dag` module is already imported at line 29: `const dag = require('./dag.cjs');`. This gives access to `dag.tryLoadDAG`.

2. In `getMergeOrder` (line 1579-1583), replace the inline path construction and `fs.readFileSync` with `tryLoadDAG`:

   **Current code (lines 1579-1583):**
   ```js
   function getMergeOrder(cwd) {
     const dagPath = path.join(cwd, '.planning', 'sets', 'DAG.json');
     const dagJson = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
     return dag.getExecutionOrder(dagJson);
   }
   ```

   **Replace with:**
   ```js
   function getMergeOrder(cwd) {
     const { dag: dagJson, path: dagPath } = dag.tryLoadDAG(cwd);
     if (!dagJson) {
       throw new Error(`DAG.json not found at ${dagPath}. Run /rapid:plan first to create sets and DAG.`);
     }
     return dag.getExecutionOrder(dagJson);
   }
   ```

3. In `detectCascadeImpact` (line 2005-2049), fix the **wrong path** and migrate to tryLoadDAG:

   **Current code (lines 2006-2013):**
   ```js
     // Read DAG.json
     const dagPath = path.join(cwd, '.planning', 'DAG.json');  // BUG: wrong path
     let dagData;
     try {
       dagData = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
     } catch {
       return { hasCascade: false, affectedSets: [], recommendation: 'No DAG.json found -- cannot assess cascade impact' };
     }
   ```

   **Replace with:**
   ```js
     // Read DAG.json
     const { dag: dagData } = dag.tryLoadDAG(cwd);
     if (!dagData) {
       return { hasCascade: false, affectedSets: [], recommendation: 'No DAG.json found -- cannot assess cascade impact' };
     }
   ```

   This fixes the path bug (`.planning/DAG.json` -> canonical `.planning/sets/DAG.json` via tryLoadDAG) and still handles missing DAG gracefully.

**What NOT to do:**
- Do NOT change any other function in merge.cjs. Only `getMergeOrder` and `detectCascadeImpact` have DAG reads.
- Do NOT remove the existing `dag` require -- it is already there and provides `tryLoadDAG`.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && grep -n 'planning.*DAG' src/lib/merge.cjs
```
Expected: No occurrences of `.planning/DAG.json` (wrong path). The only path references should come through `tryLoadDAG`.

---

### Task 2: Add merge.test.cjs tests for getMergeOrder and detectCascadeImpact DAG loading

**File:** `/home/kek/Projects/RAPID/src/lib/merge.test.cjs`

**Actions:**
1. Add the following imports at the top of the file (alongside existing imports):
   - `const fs = require('fs');`
   - `const path = require('path');`
   - `const os = require('os');`
   - Add `getMergeOrder`, `detectCascadeImpact` to the destructured imports from `./merge.cjs`

2. Add a new `describe('getMergeOrder', ...)` block with `beforeEach`/`afterEach` for tmpdir management.

3. Write these test cases:

**Test 2a: getMergeOrder returns wave-grouped arrays from valid DAG**
- Create tmpdir with `.planning/sets/DAG.json` containing a valid DAG object (create manually with `nodes`, `edges`, `waves`, `metadata` structure matching what `createDAG` produces -- include `waves: { "1": { sets: ["auth", "data"] }, "2": { sets: ["api"] } }`)
- Call `getMergeOrder(tmpDir)`
- Assert result is `[["auth", "data"], ["api"]]`

**Test 2b: getMergeOrder throws when DAG.json is missing**
- Create tmpdir with `.planning/sets/` directory but no DAG.json
- Call `getMergeOrder(tmpDir)` and expect it to throw with message containing "DAG.json not found"

**Test 2c: detectCascadeImpact returns hasCascade:false when no DAG exists**
- Create tmpdir with `.planning/sets/` directory but no DAG.json
- Call `detectCascadeImpact(tmpDir, 'some-set')`
- Assert result is `{ hasCascade: false, affectedSets: [], recommendation: expect string containing 'No DAG.json found' }`

**Test 2d: detectCascadeImpact uses canonical path (regression test for .planning/DAG.json bug)**
- Create tmpdir with `.planning/DAG.json` (wrong path) containing valid DAG with edges
- Create tmpdir with `.planning/sets/` directory but NO DAG.json at the correct path
- Call `detectCascadeImpact(tmpDir, 'some-set')`
- Assert result has `hasCascade: false` and recommendation mentions "No DAG.json found" -- proves it reads from canonical path, not old wrong path

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/merge.test.cjs 2>&1 | tail -10
```
All tests should pass.

---

### Task 3: Restructure execute-set SKILL.md Step 6 for reliability

**File:** `/home/kek/Projects/RAPID/skills/execute-set/SKILL.md`

**Context:** The research findings showed that Step 6 already has state transition BEFORE git commit (line 386 before lines 392-394). However, two improvements are needed:
- (a) The state transition command lacks explicit CWD -- it should use the worktree's project root
- (b) The git commit should have retry logic in case of transient failures
- (c) The git commit should be resilient if there are no files to commit (e.g., WAVE-COMPLETE.md already committed)

**Actions:**

Replace the Step 6 section (from `## Step 6: Complete Set` through the git commit block, ending before `Display final summary:`) with:

```markdown
## Step 6: Complete Set

Transition set to complete. Use the project root (not the worktree) for state commands:

\```bash
# (env preamble here)
# Determine project root (parent of .rapid-worktrees if in a worktree, otherwise cwd)
PROJECT_ROOT=$(cd "$(git rev-parse --show-toplevel)" && pwd)
if [ -d "$PROJECT_ROOT/../.planning" ]; then
  PROJECT_ROOT=$(cd "$PROJECT_ROOT/.." && pwd)
fi

# Transition state BEFORE git operations (prevents stuck-in-executing if commit fails)
node "${RAPID_TOOLS}" state transition set "${MILESTONE}" "${SET_ID}" complete
\```

If the state transition fails with a lock contention error, retry up to 2 more times with a 2-second pause:

\```bash
# Retry logic for state transition (lock contention)
for attempt in 1 2 3; do
  if node "${RAPID_TOOLS}" state transition set "${MILESTONE}" "${SET_ID}" complete 2>/dev/null; then
    break
  fi
  if [ "$attempt" -lt 3 ]; then
    sleep 2
  else
    echo "WARNING: State transition failed after 3 attempts. Set may still be in 'executing' state."
  fi
done
\```

Commit marker files and GAPS.md (if any). Use --allow-empty to avoid failure if files were already committed:

\```bash
git add ".planning/sets/${SET_ID}/WAVE-*-COMPLETE.md" 2>/dev/null || true
git add ".planning/sets/${SET_ID}/GAPS.md" 2>/dev/null || true
# Only commit if there are staged changes
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "execute-set(${SET_ID}): complete execution" || echo "WARNING: Git commit failed. Marker files may not be committed."
else
  echo "No marker files to commit (already committed in wave execution)."
fi
\```
```

**Important details about the replacement:**
- The state transition block should appear FIRST (it already does, but now with retry logic)
- The git commit block now checks for staged changes before committing and handles failure gracefully
- Added PROJECT_ROOT detection for worktree awareness

**What NOT to do:**
- Do NOT change the display summary or next step sections that follow Step 6
- Do NOT change any other steps in the SKILL.md
- Do NOT reorder -- state transition is already before git commit (confirmed by research)

**Verification:**
```bash
cd /home/kek/Projects/RAPID && grep -n 'state transition' skills/execute-set/SKILL.md
```
State transition should appear before any `git add` or `git commit` lines.

---

### Task 4: Add `recalculateDAG` call to init SKILL.md after roadmap acceptance

**File:** `/home/kek/Projects/RAPID/skills/init/SKILL.md`

**Context:** After roadmap acceptance (Step 9, "Accept roadmap" branch), the init flow writes ROADMAP.md, CONTRACT.json files, and STATE.json. But it never creates DAG.json, so the first `start-set` or `execute` call after init fails with "No DAG.json found."

The fix is to add an inline Node.js call to `recalculateDAG` after STATE.json is written. We use inline Node.js because `recalculateDAG` from `add-set.cjs` is not exposed as a standalone CLI subcommand, and adding CLI subcommands would touch files outside this set's ownership boundary (`src/commands/plan.cjs`, `src/bin/rapid-tools.cjs`).

**Actions:**

1. Find the section after `c) Write STATE.json` (around line 668-671) and the closing of the "Accept roadmap" branch. Insert a new sub-step `d)` between the STATE.json write and the "If Request changes" block:

   After line 671 (`Each set has only ...`), add:

   ```markdown
   d) Generate DAG.json and OWNERSHIP.json from the newly written STATE.json and CONTRACT.json files:
      ```bash
      node -e "const { recalculateDAG } = require('${RAPID_TOOLS}/../lib/add-set.cjs'); recalculateDAG(process.cwd(), '{milestoneId}').then(() => console.log('DAG.json created.')).catch(e => console.error('Warning: DAG generation failed:', e.message))"
      ```
      Where `{milestoneId}` is the milestone ID from the roadmapper's `state.currentMilestone` field.

      If this command fails (prints a warning), do NOT fail init. The DAG will be generated automatically by the first `state add-set` call or can be triggered manually later.
   ```

2. Update the "Files Created" section in Step 11 (around line 746-756) to include DAG.json and OWNERSHIP.json:
   Add `- .planning/sets/DAG.json` and `- .planning/sets/OWNERSHIP.json` to the files list.

**What NOT to do:**
- Do NOT change the roadmapper agent prompt or its output format
- Do NOT add DAG generation to the roadmapper agent itself -- recalculateDAG rebuilds from STATE.json + CONTRACT.json
- Do NOT call `recalculateDAG` before STATE.json is written (it reads STATE.json)
- Do NOT modify `src/commands/plan.cjs` or `src/bin/rapid-tools.cjs` -- those files are outside this set's ownership boundary

**Verification:**
```bash
cd /home/kek/Projects/RAPID && grep -n 'recalculateDAG\|DAG.json' skills/init/SKILL.md
```
Should show the new `recalculateDAG` call within the "Accept roadmap" flow and DAG.json in the files list.

---

### Task 5: Migrate plan.cjs writeDAG to use DAG_CANONICAL_SUBPATH (optional consistency improvement)

**File:** `/home/kek/Projects/RAPID/src/lib/plan.cjs`

**Actions:**
1. Add `const { DAG_CANONICAL_SUBPATH } = require('./dag.cjs');` at the top of plan.cjs alongside existing requires.
2. In `writeDAG` (line 257-260), replace the inline path construction:

   **Current:**
   ```js
   const dagPath = path.join(cwd, '.planning', 'sets', 'DAG.json');
   ```

   **Replace with:**
   ```js
   const dagPath = path.join(cwd, DAG_CANONICAL_SUBPATH);
   ```

   This ensures the write path is always consistent with the read path in tryLoadDAG.

**What NOT to do:**
- Do NOT change `writeDAG`'s function signature or behavior
- Do NOT add tryLoadDAG usage to plan.cjs -- plan.cjs only WRITES DAG.json, it does not read it

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/plan.test.cjs 2>&1 | tail -5
```
All existing plan.test.cjs tests should still pass (especially the writeDAG tests).

---

### Task 6: Run full test suite and verify no regressions

**Actions:**
Run all tests for modified files:

```bash
cd /home/kek/Projects/RAPID && node --test src/lib/dag.test.cjs src/lib/merge.test.cjs src/lib/plan.test.cjs src/lib/add-set.test.cjs 2>&1 | tail -20
```

All tests must pass. If any test fails, fix it before declaring the wave complete.

Also verify no remaining wrong-path references:
```bash
cd /home/kek/Projects/RAPID && grep -rn "\.planning/DAG\.json" src/lib/
```
Expected: zero results (all references in src/lib/ now use canonical path via tryLoadDAG or DAG_CANONICAL_SUBPATH).

Note: `src/commands/merge.cjs` line 274 also has the wrong path `.planning/DAG.json`, but that file is NOT in this set's owned files. Document this as a follow-up item in the commit message.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && grep -rn "\.planning/DAG\.json" src/lib/ ; echo "Exit code: $?"
```
Expected: no matches, exit code 1 (grep returns 1 when no matches found).

---

## Success Criteria

1. `merge.cjs` `detectCascadeImpact` uses correct canonical DAG path via `tryLoadDAG` (the `.planning/DAG.json` bug is fixed)
2. `merge.cjs` `getMergeOrder` uses `tryLoadDAG` instead of inline `fs.readFileSync`
3. New merge.test.cjs tests cover both functions' DAG loading behavior, including regression test for wrong path
4. Execute-set SKILL.md Step 6 has retry logic for state transition and resilient git commit
5. Init SKILL.md creates DAG.json via inline `recalculateDAG` call after STATE.json write
6. `plan.cjs` `writeDAG` uses `DAG_CANONICAL_SUBPATH` for path consistency
7. No remaining `.planning/DAG.json` (wrong path) references in `src/lib/` directory
8. All existing tests pass (no regressions)

## Files Modified

| File | Change Type |
|------|-------------|
| `src/lib/merge.cjs` | Migrate `getMergeOrder` and `detectCascadeImpact` to use `tryLoadDAG` |
| `src/lib/merge.test.cjs` | Add tests for `getMergeOrder` and `detectCascadeImpact` DAG loading |
| `skills/execute-set/SKILL.md` | Restructure Step 6 with retry logic and resilient commit |
| `skills/init/SKILL.md` | Add inline `recalculateDAG` call after STATE.json write |
| `src/lib/plan.cjs` | Use `DAG_CANONICAL_SUBPATH` in `writeDAG` |

## Known Follow-ups (Out of Scope)

- `src/commands/merge.cjs` line 274 has wrong `.planning/DAG.json` path but is NOT in this set's owned files. File a follow-up task.
- `src/commands/execute.cjs` lines 90, 263 have inline DAG path construction that could be migrated to tryLoadDAG. Not in owned files.
- `src/commands/worktree.cjs` lines 124, 138 have inline DAG path construction. Not in owned files.
