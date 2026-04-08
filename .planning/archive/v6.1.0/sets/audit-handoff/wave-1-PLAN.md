# PLAN: audit-handoff -- Wave 1 (Foundation)

## Objective

Create the `src/lib/remediation.cjs` module with CRUD operations for `.planning/pending-sets/` artifacts, and its companion test file `src/lib/remediation.test.cjs`. This wave establishes the core library that Waves 2 and 3 depend on.

## Owned Files

| File | Action |
|------|--------|
| `src/lib/remediation.cjs` | **Create** |
| `src/lib/remediation.test.cjs` | **Create** |

---

## Task 1: Create `src/lib/remediation.cjs`

### What to Build

A CommonJS module providing four exported functions for managing remediation artifacts in `.planning/pending-sets/`. The module follows existing lib conventions: `'use strict'` header, JSDoc on all exports, `cwd` as first parameter.

### Implementation Details

**Constants:**

```
const PENDING_DIR = path.join('.planning', 'pending-sets');
```

All functions resolve paths relative to `cwd` + `PENDING_DIR`.

**Function 1: `writeRemediationArtifact(cwd, setName, remediation)`**

- Parameters:
  - `cwd` (string) -- project root directory
  - `setName` (string) -- kebab-case set name, used as filename stem
  - `remediation` (object) -- `{ scope, files, deps, severity, source }` where all fields are strings except `files` and `deps` which are string arrays
- Behavior:
  - Resolve `dir = path.join(cwd, PENDING_DIR)`
  - Create directory lazily: `fs.mkdirSync(dir, { recursive: true })`
  - Build artifact object: `{ setName, scope, files, deps, severity, source, createdAt: new Date().toISOString() }`
  - Write to `path.join(dir, setName + '.json')` with `JSON.stringify(artifact, null, 2)`
- Returns: `void`
- Throws: Let fs errors propagate naturally (invalid path, permission denied)

**Function 2: `readRemediationArtifact(cwd, setName)`**

- Parameters: `cwd` (string), `setName` (string)
- Behavior:
  - Resolve `filePath = path.join(cwd, PENDING_DIR, setName + '.json')`
  - If file does not exist (`!fs.existsSync(filePath)`): return `null`
  - Read and `JSON.parse` the file
  - Validate: check that parsed object has `setName`, `scope`, and `source` fields (all must be non-null/non-undefined). If validation fails: `console.warn('[RAPID WARN] Malformed remediation artifact: ' + filePath)` and return `null`
  - Return the parsed object
- Returns: `object | null`
- Error handling: Wrap parse in try/catch. On `SyntaxError` (malformed JSON), warn and return `null`

**Function 3: `listPendingRemediations(cwd)`**

- Parameters: `cwd` (string)
- Behavior:
  - Resolve `dir = path.join(cwd, PENDING_DIR)`
  - If directory does not exist (`!fs.existsSync(dir)`): return `[]`
  - Read directory: `fs.readdirSync(dir)`
  - Filter to `.json` files only
  - Map each filename to set name by stripping `.json` extension
  - Return sorted array of set names
- Returns: `string[]`

**Function 4: `deleteRemediationArtifact(cwd, setName)`**

- Parameters: `cwd` (string), `setName` (string)
- Behavior:
  - Resolve `filePath = path.join(cwd, PENDING_DIR, setName + '.json')`
  - If file does not exist: return `false`
  - `fs.unlinkSync(filePath)`
  - Return `true`
- Returns: `boolean`

**Module exports:**

```js
module.exports = {
  writeRemediationArtifact,
  readRemediationArtifact,
  listPendingRemediations,
  deleteRemediationArtifact,
};
```

### What NOT to Do

- Do NOT add Zod or Ajv validation. Use manual field-existence checks only.
- Do NOT import or mutate STATE.json. This module operates entirely on flat JSON files.
- Do NOT add a CLI handler in `rapid-tools.cjs`. This is library-only.
- Do NOT use `path.resolve` with absolute paths -- always join relative to `cwd`.

### Verification

```bash
node -e "const m = require('./src/lib/remediation.cjs'); console.log(Object.keys(m));"
# Expected output: [ 'writeRemediationArtifact', 'readRemediationArtifact', 'listPendingRemediations', 'deleteRemediationArtifact' ]
```

---

## Task 2: Create `src/lib/remediation.test.cjs`

### What to Build

Unit tests using `node:test` and `node:assert/strict`. Follow the pattern from `src/lib/add-set.test.cjs`: create temp directories in `beforeEach`, clean up in `afterEach`.

### Test Structure

Use `describe('remediation')` as the top-level block.

**Setup/teardown pattern:**

```js
let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-remediation-'));
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
```

**Test cases to implement:**

1. **`describe('writeRemediationArtifact')`**
   - `it('creates pending-sets directory and writes artifact')` -- call write, verify file exists, parse and check all fields including `createdAt`
   - `it('overwrites existing artifact with same name')` -- write twice with same name but different scope, verify second write wins
   - `it('preserves existing artifacts when writing a new one')` -- write two different set names, verify both exist

2. **`describe('readRemediationArtifact')`**
   - `it('returns parsed artifact when file exists')` -- write then read, verify fields match
   - `it('returns null when file does not exist')` -- read without writing, assert `=== null`
   - `it('returns null when pending-sets directory does not exist')` -- use bare tmpDir (no directory created), assert `=== null`
   - `it('returns null and warns on malformed JSON')` -- write a file with invalid JSON content directly via `fs.writeFileSync`, assert returns `null`. Optionally capture console.warn.
   - `it('returns null when artifact is missing required fields')` -- write a JSON file with `{ "foo": "bar" }` (no `setName`, `scope`, `source`), assert returns `null`

3. **`describe('listPendingRemediations')`**
   - `it('returns empty array when directory does not exist')` -- assert `deepStrictEqual(result, [])`
   - `it('returns empty array when directory is empty')` -- create the directory but no files
   - `it('returns sorted set names from JSON files')` -- write 3 artifacts (b, a, c), assert list returns `['a', 'b', 'c']`
   - `it('ignores non-JSON files')` -- write a `.txt` file alongside a `.json` file, verify only JSON name returned

4. **`describe('deleteRemediationArtifact')`**
   - `it('deletes existing artifact and returns true')` -- write then delete, verify file gone
   - `it('returns false when artifact does not exist')` -- delete without writing
   - `it('returns false when directory does not exist')` -- delete on bare tmpDir

5. **`describe('behavioral contracts')`**
   - `it('survives /clear (artifacts are on-disk files)')` -- write an artifact, create a new module reference (re-require), read the artifact, verify it still exists. This validates the `survivesClear` behavioral contract.
   - `it('graceful fallback when no artifacts exist')` -- verify `listPendingRemediations` returns `[]` and `readRemediationArtifact` returns `null` on a clean directory. This validates the `gracefulFallback` behavioral contract.

### Verification

```bash
node --test src/lib/remediation.test.cjs
# Expected: All tests pass (0 failures)
```

---

## Success Criteria

1. `node -e "require('./src/lib/remediation.cjs')"` loads without error
2. `node --test src/lib/remediation.test.cjs` passes all tests with 0 failures
3. Module exports exactly 4 functions: `writeRemediationArtifact`, `readRemediationArtifact`, `listPendingRemediations`, `deleteRemediationArtifact`
4. No imports from `state-machine.cjs`, `state-schemas.cjs`, or any Zod-related module
5. All functions accept `cwd` as first parameter (consistent with existing lib modules)
