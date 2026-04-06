# PLAN: scaffold-overhaul / Wave 3

## Objective

Wire the `scaffold verify-stubs` CLI subcommand, update the scaffold SKILL.md with new workflows, and write integration tests that exercise the full stub lifecycle end-to-end (generation, sidecar management, verification, merge-time cleanup).

## Files Modified

| File | Action |
|------|--------|
| `src/commands/scaffold.cjs` | Extend with verify-stubs subcommand |
| `src/commands/scaffold.test.cjs` | Extend with verify-stubs tests |
| `skills/scaffold/SKILL.md` | Extend with new subcommands and flows |
| `src/lib/scaffold.integration.test.cjs` | Extend with stub lifecycle integration tests |

---

## Task 1: Add `verify-stubs` subcommand to CLI handler

**File:** `src/commands/scaffold.cjs`

**Current state:** `handleScaffold(cwd, subcommand, args)` validates subcommand as `'run'` or `'status'` and throws `CliError` for anything else. The usage message is `'Usage: rapid-tools scaffold <run|status> [--type <type>]'`.

**Required changes:**

1. **Update the validation** to accept `'verify-stubs'` as a valid subcommand. Change the usage message to:
   ```
   Usage: rapid-tools scaffold <run|status|verify-stubs> [--type <type>]
   ```

2. **Add the `verify-stubs` handler block** after the `status` block:

   ```javascript
   if (subcommand === 'verify-stubs') {
     const stub = require('../lib/stub.cjs');
     const scaffold = require('../lib/scaffold.cjs');

     // Read the scaffold report to find stub file locations
     const report = scaffold.readScaffoldReport(cwd);

     // Determine stubs directory -- check .rapid-stubs/ in project root
     // and also check report.stubs if available (v2 report)
     const stubPaths = [];
     const rapidStubsDir = path.join(cwd, '.rapid-stubs');

     if (fs.existsSync(rapidStubsDir)) {
       // Walk .rapid-stubs/ for all .cjs files
       const entries = fs.readdirSync(rapidStubsDir);
       for (const entry of entries) {
         if (entry.endsWith('.cjs')) {
           stubPaths.push(path.join(rapidStubsDir, entry));
         }
       }
     }

     // Also check v2 report stubs paths if present
     if (report && Array.isArray(report.stubs)) {
       for (const sp of report.stubs) {
         const abs = path.resolve(cwd, sp);
         if (!stubPaths.includes(abs) && fs.existsSync(abs)) {
           stubPaths.push(abs);
         }
       }
     }

     // Check each stub: is it still a stub or has it been replaced?
     const results = {
       total: stubPaths.length,
       replaced: [],
       remaining: [],
     };

     for (const stubPath of stubPaths) {
       const content = fs.readFileSync(stubPath, 'utf-8');
       const relPath = path.relative(cwd, stubPath);
       if (stub.isRapidStub(content)) {
         results.remaining.push(relPath);
       } else {
         results.replaced.push(relPath);
       }
     }

     process.stdout.write(JSON.stringify(results) + '\n');
     return;
   }
   ```

3. **Add `require` statements** for `fs` and `path` at the top of the file (they are not currently imported since the handler delegates to lib functions).

**What NOT to do:**
- Do NOT recursively walk the entire project tree for stubs -- only check `.rapid-stubs/` and paths from the v2 report.
- Do NOT modify existing `run` or `status` subcommand behavior.
- Do NOT add async handling -- keep the handler synchronous like the existing subcommands.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node -e "
const { handleScaffold } = require('./src/commands/scaffold.cjs');
// Should not throw for verify-stubs subcommand
try {
  // This will output empty results since no stubs exist in cwd
  handleScaffold('.', 'verify-stubs', []);
  console.log('PASS: verify-stubs subcommand accepted');
} catch(e) {
  if (e.message.includes('Usage')) {
    console.log('FAIL: verify-stubs not recognized');
  } else {
    console.log('PASS: verify-stubs recognized (other error is expected in test env)');
  }
}
"
```

---

## Task 2: Write CLI tests for `verify-stubs`

**File:** `src/commands/scaffold.test.cjs`

**Add new `describe` block** after existing tests. Keep all existing tests intact.

### `describe('handleScaffold verify-stubs subcommand')`

1. **`it('outputs JSON with total:0 when no stubs exist')`** -- call `handleScaffold(tmpDir, 'verify-stubs', [])`, capture stdout, parse JSON, assert `{total: 0, replaced: [], remaining: []}`.

2. **`it('reports remaining stubs that still have RAPID-STUB marker')`** -- create `.rapid-stubs/` dir with a stub file starting with `// RAPID-STUB\n...`, call verify-stubs, assert it appears in `remaining`.

3. **`it('reports replaced stubs that no longer have RAPID-STUB marker')`** -- create `.rapid-stubs/` dir with a file starting with `'use strict';\n// real code`, call verify-stubs, assert it appears in `replaced`.

4. **`it('checks v2 report stubs paths when available')`** -- write a scaffold-report.json with `stubs: ['src/lib/foo.cjs']`, create that file with RAPID-STUB content, call verify-stubs, assert it appears in `remaining`.

5. **`it('updates usage message to include verify-stubs')`** -- call with invalid subcommand, assert error message includes `verify-stubs`.

Use the existing `captureStdout` helper and `tmpDir` setup from the file.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/commands/scaffold.test.cjs
```

---

## Task 3: Update SKILL.md with new subcommands and stub workflow

**File:** `skills/scaffold/SKILL.md`

**Current state:** The skill describes `scaffold run` and `scaffold status` subcommands. It needs to document the new `verify-stubs` subcommand and the overall stub workflow.

**Required changes:**

1. **Update the header subcommand list** to include `verify-stubs`:
   ```
   Subcommands:
     scaffold run [--type <type>]  -- Generate project foundation files
     scaffold status               -- Show scaffold report
     scaffold verify-stubs         -- Check which stubs have been replaced by real implementations
   ```

2. **Add a new section** after the existing steps, titled `## Stub Verification`:

   ```markdown
   ## Stub Verification

   The `verify-stubs` subcommand checks all known stub files and reports which ones have been
   replaced by real implementations and which remain as stubs.

   ```bash
   # (env preamble)
   node "${RAPID_TOOLS}" scaffold verify-stubs
   ```

   Parse the JSON output:
   - `total`: Total number of stub files found
   - `replaced`: Array of relative paths to stubs that have been replaced (no longer contain RAPID-STUB marker)
   - `remaining`: Array of relative paths to stubs that still contain the RAPID-STUB marker

   **Stub Detection:** A file is considered a stub if its first line is exactly `// RAPID-STUB`.
   When a developer replaces a stub with real implementation code, the RAPID-STUB marker on
   line 1 is naturally overwritten, and `verify-stubs` will report it as replaced.

   **Sidecar Files:** Each stub has a zero-byte `.rapid-stub` sidecar file alongside it.
   These sidecars are used by the merge pipeline for language-agnostic stub detection.
   They are automatically cleaned up during merge.
   ```

3. **Add a section** titled `## Scaffold Report v2`:

   ```markdown
   ## Scaffold Report v2

   When running scaffold on a multi-developer project with group partitioning, the scaffold
   report includes additional fields:

   - `groups`: Group assignments from DAG (Record<groupId, {sets: string[]}>)
   - `stubs`: Array of stub file paths generated during scaffolding
   - `foundationSet`: Name of the foundation set (if one was created), or null

   These fields are optional and additive -- v1 report consumers will ignore them.
   ```

4. **Do NOT modify the existing Step 1 and Step 2 content** -- only add new sections.

**Verification:**
```bash
grep -c 'verify-stubs' /home/kek/Projects/RAPID/skills/scaffold/SKILL.md
# Should output at least 3 (subcommand list + section + code block)
```

---

## Task 4: Write integration tests for stub lifecycle

**File:** `src/lib/scaffold.integration.test.cjs`

**Add new `describe` blocks** after existing tests. Keep all existing tests intact.

### `describe('stub lifecycle integration')`

Set up a temporary directory with a complete project structure for each test: `.planning/`, `.rapid-stubs/`, contract files, etc.

1. **`it('full stub lifecycle: generate -> verify -> replace -> verify')`**

   Steps:
   - Create a contract with 1 exported function (returns string)
   - Call `generateStub()` to produce stub content
   - Write it to a file in `.rapid-stubs/`
   - Write a zero-byte `.rapid-stub` sidecar next to it
   - Verify with `isRapidStub()` -> should be true
   - Overwrite the file with real implementation code (first line is NOT `// RAPID-STUB`)
   - Verify with `isRapidStub()` -> should be false

2. **`it('sidecar cleanup removes both stub and sidecar files')`**

   Steps:
   - Create a `.rapid-stubs/` dir with stub file + sidecar
   - Call `cleanupStubSidecars()` on the directory
   - Assert both files are removed
   - Assert the function returns the correct count

3. **`it('scaffold report v2 extends v1 without breaking reads')`**

   Steps:
   - Write a v1 report using `writeScaffoldReport()`
   - Read it with `readScaffoldReport()` -> should work fine
   - Build a v2 report using `buildScaffoldReportV2(v1Report, {groups: {g1: {sets: ['a']}}, stubs: ['x.cjs']})`
   - Write v2 report using `writeScaffoldReport()`
   - Read it with `readScaffoldReport()` -> should include v2 fields
   - Assert v1 fields are preserved

4. **`it('T0 stub resolution integrates with resolveConflicts cascade')`**

   Steps:
   - Create a conflict object with `oursContent` being a RAPID-STUB file and `theirsContent` being real code
   - Call `resolveConflicts({allConflicts: [conflict]}, {})`
   - Assert the result has `tier: 0`, `resolved: true`, `preferSide: 'theirs'`
   - Create a second conflict where neither side is a stub
   - Call `resolveConflicts` again
   - Assert it falls through to T1/T2/T3 (not T0)

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/scaffold.integration.test.cjs
```

---

## Success Criteria

1. `scaffold verify-stubs` CLI subcommand outputs valid JSON with `total`, `replaced`, `remaining` fields
2. Usage message updated to include `verify-stubs`
3. SKILL.md documents all new subcommands and stub workflow
4. Integration tests cover the full stub lifecycle from generation through verification and cleanup
5. Integration tests verify T0 resolution integrates correctly with the existing cascade
6. All existing tests continue to pass unchanged
7. All new tests pass
