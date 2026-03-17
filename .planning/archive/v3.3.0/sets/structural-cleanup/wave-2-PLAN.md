# Wave 2: Path Migration, Comment-Marker Cleanup, and Deprecated Skill Removal

## Objective

Three independent cleanup tasks that improve path correctness, remove dead detection logic, and delete deprecated skill directories:

1. **Wave-to-set path migration**: Update all `.planning/waves/{setId}/` references in source code and tests to `.planning/sets/{setId}/`. The `.planning/waves/` directory does not physically exist on disk -- these are stale v2 path references that were never updated during the v2->v3 migration. No file migration utility is needed; this is a string replacement in source code.

2. **Comment-marker cleanup in build-agents**: Remove the `startsWith('<!-- CORE: Hand-written agent')` check in `handleBuildAgents()` (lines 282-295 of `src/commands/build-agents.cjs`). Replace with unconditional skip for SKIP_GENERATION roles -- if the file exists AND the role is in SKIP_GENERATION, never overwrite it regardless of content.

3. **Deprecated skill removal**: Delete 6 redirect-only skill directories and update the help skill's command list to remove the "Deprecated Commands" section.

## Tasks

### Task 1: Update `.planning/waves/` to `.planning/sets/` in `src/lib/review.cjs`

**Files:** `src/lib/review.cjs`

**Actions:**
1. Line 374: Change `path.join(cwd, '.planning', 'waves', setId)` to `path.join(cwd, '.planning', 'sets', setId)`.
2. Line 433: Change `path.join(cwd, '.planning', 'waves', setId)` to `path.join(cwd, '.planning', 'sets', setId)`.
3. Line 466: Change `path.join(cwd, '.planning', 'waves', setId)` to `path.join(cwd, '.planning', 'sets', setId)`.
4. Line 528: Change `path.join(cwd, '.planning', 'waves', setId, 'REVIEW-ISSUES.json')` to `path.join(cwd, '.planning', 'sets', setId, 'REVIEW-ISSUES.json')`.
5. Line 648 (JSDoc comment): Change `.planning/waves/{setId}/` to `.planning/sets/{setId}/`.

Total: 5 occurrences in review.cjs.

**What NOT to do:**
- Do NOT change the `.planning/post-merge/{setId}/` paths at lines 655, 686, 706. Those are correct and separate from this migration.
- Do NOT rename variable names like `wavesDir` or `waveEntries` -- these refer to wave-level subdirectories within the set, which is still a valid concept. Only change the path string from `'waves'` to `'sets'`.

**Verification:**
```bash
grep -n "planning.*waves" src/lib/review.cjs
# Expected: zero matches
```

### Task 2: Update `.planning/waves/` to `.planning/sets/` in `src/lib/execute.cjs`

**Files:** `src/lib/execute.cjs`

**Actions:**
1. Line 664 (JSDoc comment): Change `.planning/waves/WAVE-{N}-SUMMARY.md` to `.planning/sets/WAVE-{N}-SUMMARY.md`.
2. Line 792 (JSDoc comment): Change `.planning/waves/{setId}/{waveId}/{jobId}-PLAN.md` to `.planning/sets/{setId}/{waveId}/{jobId}-PLAN.md`.
3. Line 805: Change `path.join(cwd, '.planning', 'waves', setId, waveId)` to `path.join(cwd, '.planning', 'sets', setId, waveId)`.
4. Line 841 (JSDoc comment): Change `.planning/waves/{setId}/{waveId}/` to `.planning/sets/{setId}/{waveId}/`.
5. Line 853: Change `path.join(cwd, '.planning', 'waves', setId, waveId)` to `path.join(cwd, '.planning', 'sets', setId, waveId)`.
6. Line 932 (JSDoc comment): Change `.planning/waves/{setId}/{waveId}/{jobId}-HANDOFF.md` to `.planning/sets/{setId}/{waveId}/{jobId}-HANDOFF.md`.

Total: 6 occurrences in execute.cjs.

**Verification:**
```bash
grep -n "planning.*waves" src/lib/execute.cjs
# Expected: zero matches
```

### Task 3: Update `.planning/waves/` to `.planning/sets/` in command handlers

**Files:** `src/commands/execute.cjs`, `src/commands/review.cjs`

**Actions:**
1. In `src/commands/execute.cjs`:
   - Line 273: Change `path.join(cwd, '.planning', 'waves')` to `path.join(cwd, '.planning', 'sets')`.
   - Line 325: Change `path.join(cwd, '.planning', 'waves', setId, waveId)` to `path.join(cwd, '.planning', 'sets', setId, waveId)`.

2. In `src/commands/review.cjs`:
   - Line 145: Change `path.join(cwd, '.planning', 'waves', setId, waveId)` to `path.join(cwd, '.planning', 'sets', setId, waveId)`.
   - Line 216: Change `path.join(cwd, '.planning', 'waves', setId, 'REVIEW-SUMMARY.md')` to `path.join(cwd, '.planning', 'sets', setId, 'REVIEW-SUMMARY.md')`.

Total: 4 occurrences across 2 files.

**Verification:**
```bash
grep -n "planning.*waves" src/commands/execute.cjs src/commands/review.cjs
# Expected: zero matches
```

### Task 4: Update `.planning/waves/` to `.planning/sets/` in `src/lib/state-machine.cjs`

**Files:** `src/lib/state-machine.cjs`

**Actions:**
1. Line 353: Change `path.join(cwd, '.planning', 'waves', setId)` to `path.join(cwd, '.planning', 'sets', setId)`.

Total: 1 occurrence.

**Verification:**
```bash
grep -n "planning.*waves" src/lib/state-machine.cjs
# Expected: zero matches
```

### Task 5: Update `.planning/waves/` to `.planning/sets/` in `src/modules/roles/role-plan-verifier.md`

**Files:** `src/modules/roles/role-plan-verifier.md`

**Actions:**
1. Line 108: Change `.planning/waves/{setId}/{waveId}/VERIFICATION-REPORT.md` to `.planning/sets/{setId}/{waveId}/VERIFICATION-REPORT.md`.

Total: 1 occurrence.

**Verification:**
```bash
grep -n "planning.*waves" src/modules/roles/role-plan-verifier.md
# Expected: zero matches
```

### Task 6: Update `.planning/waves/` to `.planning/sets/` in test files

**Files:** `src/lib/review.test.cjs`, `src/lib/execute.test.cjs`, `src/lib/state-machine.test.cjs`, `src/bin/rapid-tools.test.cjs`

**Actions:**
1. In `src/lib/review.test.cjs` (17 occurrences): Replace all `'.planning', 'waves'` path segments with `'.planning', 'sets'`. These appear in `path.join(tmpDir, '.planning', 'waves', ...)` calls creating test fixture directories. The affected lines are: 326, 339, 358, 366, 384, 397, 446, 491, 521, 541, 560, 571, 593, 604, 638, 658, 677.

2. In `src/lib/execute.test.cjs` (2 occurrences): Replace `'.planning', 'waves'` with `'.planning', 'sets'` at lines 824 and 925.

3. In `src/lib/state-machine.test.cjs` (1 occurrence): Replace `'.planning', 'waves'` with `'.planning', 'sets'` at line 491.

4. In `src/bin/rapid-tools.test.cjs` (6 occurrences): Replace all `'.planning', 'waves'` with `'.planning', 'sets'`. Also update the comment at line 1536 from `.planning/waves/auth-core` to `.planning/sets/auth-core`. Affected lines: 1536, 1537, 1575, 1604, 1613, 1642.

**What NOT to do:**
- Do NOT change variable names like `waveDir`, `wave1Dir`, `wave2Dir` -- these refer to wave-numbered subdirectories and are still correct naming.
- Do NOT change test descriptions or assertion messages beyond what is needed for path correctness.

**Verification:**
```bash
grep -rn "planning.*waves" src/lib/review.test.cjs src/lib/execute.test.cjs src/lib/state-machine.test.cjs src/bin/rapid-tools.test.cjs
# Expected: zero matches for path references (variable names like waveDir are fine)
```

### Task 7: Remove comment-marker detection in `src/commands/build-agents.cjs`

**Files:** `src/commands/build-agents.cjs`

**Actions:**
1. Replace lines 282-295 (the SKIP_GENERATION stub-generation loop) with a simpler version that unconditionally skips if the file exists:

   Current code (lines 282-295):
   ```javascript
   // Generate stubs for core agents (skip if already hand-written with CORE prefix)
   for (const role of SKIP_GENERATION) {
     const filePath = path.join(agentsDir, `rapid-${role}.md`);
     if (fs.existsSync(filePath)) {
       const existing = fs.readFileSync(filePath, 'utf-8');
       if (existing.startsWith('<!-- CORE: Hand-written agent')) {
         continue; // Preserve hand-written core agent
       }
     }
     const coreModules = ROLE_CORE_MAP[role];
     const assembled = assembleStubPrompt(role, coreModules);
     const content = STUB_COMMENT + assembled;
     fs.writeFileSync(filePath, content, 'utf-8');
   }
   ```

   Replace with:
   ```javascript
   // SKIP_GENERATION roles: never overwrite existing files, only create if missing
   for (const role of SKIP_GENERATION) {
     const filePath = path.join(agentsDir, `rapid-${role}.md`);
     if (fs.existsSync(filePath)) {
       continue; // Preserve existing core agent file unconditionally
     }
     const coreModules = ROLE_CORE_MAP[role];
     const assembled = assembleStubPrompt(role, coreModules);
     const content = STUB_COMMENT + assembled;
     fs.writeFileSync(filePath, content, 'utf-8');
   }
   ```

   The key change: instead of reading the file and checking for a magic comment, simply skip if the file exists. SKIP_GENERATION is the single source of truth for which roles are protected.

**What NOT to do:**
- Do NOT remove the SKIP_GENERATION list or change its contents.
- Do NOT change the stub generation logic for when the file does NOT exist -- stubs are still created for missing core agent files.
- Do NOT modify the non-SKIP_GENERATION loop (lines 270-279).

**Verification:**
```bash
grep -n "startsWith\|CORE: Hand-written" src/commands/build-agents.cjs
# Expected: zero matches
```

### Task 8: Delete deprecated skill directories

**Files (DELETE):** `skills/new-milestone/`, `skills/plan/`, `skills/wave-plan/`, `skills/discuss/`, `skills/set-init/`, `skills/execute/`

**Actions:**
1. Delete the following 6 directories and all their contents:
   ```bash
   rm -rf skills/new-milestone skills/plan skills/wave-plan skills/discuss skills/set-init skills/execute
   ```

2. Verify deletion:
   ```bash
   ls skills/new-milestone skills/plan skills/wave-plan skills/discuss skills/set-init skills/execute 2>&1
   # Expected: all "No such file or directory"
   ```

**What NOT to do:**
- Do NOT delete any active skill directories. The complete list of directories to keep: `add-set`, `assumptions`, `cleanup`, `context`, `discuss-set`, `execute-set`, `help`, `init`, `install`, `merge`, `migrate`, `new-version`, `pause`, `plan-set`, `quick`, `resume`, `review`, `scaffold`, `set-init` (wait -- `set-init` IS in the delete list), `start-set`, `status`, `wave-plan` (also in delete list).
- Specifically, these 6 and ONLY these 6 are deprecated: `new-milestone`, `plan`, `wave-plan`, `discuss`, `set-init`, `execute`.

### Task 9: Update help skill to remove deprecated commands section

**Files:** `skills/help/SKILL.md`

**Actions:**
1. Remove the "Deprecated Commands" section (lines 95-106), which contains:
   ```markdown
   ## Deprecated Commands

   These v2 commands have been replaced. Running them will show migration guidance:

   | Old Command | Replacement |
   |-------------|-------------|
   | `/rapid:set-init` | `/rapid:start-set` |
   | `/rapid:discuss` | `/rapid:discuss-set` |
   | `/rapid:execute` | `/rapid:execute-set` |
   | `/rapid:plan` | `/rapid:plan-set` (set planning) or `/rapid:init` (project planning) |
   | `/rapid:wave-plan` | `/rapid:plan-set` |
   | `/rapid:new-milestone` | `/rapid:new-version` |
   ```

2. Update the footer line (line 110) to reflect the correct command count. After removing 6 deprecated skills, verify the actual count by running `ls -d skills/*/` and counting active directories.

**Verification:**
```bash
grep -n "Deprecated" skills/help/SKILL.md
# Expected: zero matches
```

### Task 10: Final exhaustive verification

**Files:** None modified (verification only)

**Actions:**
1. Run exhaustive grep for any remaining `.planning/waves/` references:
   ```bash
   grep -rn "planning.*waves" src/ --include="*.cjs" --include="*.md"
   ```
   Expected: zero matches in `.cjs` files. Zero matches in `.md` role files.

2. Verify no comment-marker detection remains:
   ```bash
   grep -n "startsWith\|Hand-written" src/commands/build-agents.cjs
   ```
   Expected: zero matches.

3. Verify deprecated skills are gone:
   ```bash
   for d in new-milestone plan wave-plan discuss set-init execute; do test -d "skills/$d" && echo "FAIL: skills/$d still exists"; done
   ```
   Expected: no output.

4. Run the test suite for all affected files:
   ```bash
   node --test src/lib/review.test.cjs
   node --test src/lib/execute.test.cjs
   node --test src/lib/state-machine.test.cjs
   node --test src/bin/rapid-tools.test.cjs
   ```
   All must pass with zero failures.

5. Run the full test suite to catch any remaining issues:
   ```bash
   node --test src/lib/worktree.test.cjs
   ```
   Must still pass (confirming wave 1 renames are stable).

## Success Criteria

- Zero `.planning/waves/` path references in any `.cjs` source file or `.md` role module under `src/`
- All path references now use `.planning/sets/{setId}/` consistently
- `handleBuildAgents()` uses SKIP_GENERATION list as sole mechanism for protecting core agent files -- no comment-marker string detection
- All 6 deprecated skill directories are deleted: `new-milestone`, `plan`, `wave-plan`, `discuss`, `set-init`, `execute`
- Help skill no longer lists deprecated commands
- Full test suite passes with zero failures
