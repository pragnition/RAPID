# Wave 2 PLAN: Regression Test for Invalid Status Literals

## Objective

Add a Node.js regression test to `src/lib/state-schemas.test.cjs` that scans all SKILL.md and agent .md files for `state transition set` calls containing invalid present-tense status literals. This test ensures the Wave 1 fixes are not regressed by future edits.

## Context

Wave 1 corrected all present-tense status literals across the skill layer. This wave adds an automated regression test that fails if any SKILL.md or agent .md file contains a `state transition set` call with an invalid status (`discussing`, `planning`, `executing`, `reviewing`). The test uses Node.js `fs` and `path` modules to recursively scan files and match against a regex pattern.

## Tasks

### Task 1: Add regression test to `src/lib/state-schemas.test.cjs`

**File:** `src/lib/state-schemas.test.cjs`

**Action:** Append a new `describe` block at the end of the file (after the `SetState backward compatibility with waves` describe block at line 307). The test should:

1. Import `fs` and `path` from Node.js (use `require('node:fs')` and `require('node:path')`)
2. Define a helper function `findMdFiles(dir)` that recursively finds all `.md` files in a given directory, returning an empty array if the directory does not exist
3. Define the list of invalid present-tense status literals: `discussing`, `planning`, `executing`, `reviewing`
4. Build a regex pattern that matches `state transition set` followed by any arguments and then one of the invalid status literals
5. Scan two directories:
   - `skills/` -- all SKILL.md files (recursive)
   - `agents/` -- all agent .md files (recursive)
6. For each `.md` file found, read its contents line by line and test each line against the regex
7. Collect all violations as `{relativePath}:{lineNumber}: {trimmedLine}`
8. Assert that the violations array is empty; if not, fail with a descriptive message listing each violation

**Pattern to match:** The regex should match lines like:
- `node "${RAPID_TOOLS}" state transition set "${MILESTONE_ID}" "${SET_ID}" discussing`
- `node "${RAPID_TOOLS}" state transition set <milestone> <set-id> reviewing`
- Any variation where `state transition set` appears followed eventually by one of the 4 invalid literals as a word boundary

**Regex:** `state transition set\b.*\b(discussing|planning|executing|reviewing)\b`

This catches both backtick-quoted code examples and actual transition commands in SKILL.md instruction text. It does NOT match `state transition wave ... executing` or `state transition job ... executing` because the word `set` must appear after `state transition`.

**Important edge cases to handle:**
- The `agents/` directory may not exist -- `findMdFiles` must return an empty array if the directory is missing (use `fs.existsSync` guard)
- The regex must NOT match wave-level transitions like `state transition wave ... executing` -- the regex already prevents this because it requires the word `set` after `state transition`
- Only `state transition set` calls should be checked

**Implementation:**

```javascript
describe('status literal consistency (regression)', () => {
  const fs = require('node:fs');
  const path = require('node:path');

  function findMdFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findMdFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  it('no SKILL.md or agent .md file contains invalid present-tense status in state transition set calls', () => {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const invalidPattern = /state transition set\b.*\b(discussing|planning|executing|reviewing)\b/;

    const dirsToScan = [
      path.join(projectRoot, 'skills'),
      path.join(projectRoot, 'agents'),
    ];

    const violations = [];
    for (const dir of dirsToScan) {
      const files = findMdFiles(dir);
      for (const filePath of files) {
        const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
        lines.forEach((line, idx) => {
          if (invalidPattern.test(line)) {
            const relPath = path.relative(projectRoot, filePath);
            violations.push(`${relPath}:${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }

    assert.equal(
      violations.length,
      0,
      `Found ${violations.length} invalid present-tense status literal(s) in state transition set calls:\n${violations.join('\n')}`
    );
  });
});
```

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/state-schemas.test.cjs
```

Expected: all existing tests pass (12 describe blocks, all assertions green), plus the new regression test passes with zero violations found (since Wave 1 already corrected all instances).

---

## Wave 2 Success Criteria

1. The regression test exists in `src/lib/state-schemas.test.cjs` as a new `describe('status literal consistency (regression)', ...)` block
2. The test scans both `skills/` and `agents/` directories recursively for `.md` files
3. The test catches `state transition set` calls containing `discussing`, `planning`, `executing`, or `reviewing`
4. The test does NOT flag wave-level or job-level transitions (only `state transition set`)
5. The `findMdFiles` helper gracefully handles missing directories (returns empty array)
6. The test passes with zero violations (all violations were fixed in Wave 1)
7. All pre-existing tests in `state-schemas.test.cjs` continue to pass
8. Running `node --test src/lib/state-schemas.test.cjs` exits with code 0

## Files Modified (exclusive ownership)

- `src/lib/state-schemas.test.cjs` (Task 1)
