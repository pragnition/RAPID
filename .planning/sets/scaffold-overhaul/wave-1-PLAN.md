# PLAN: scaffold-overhaul / Wave 1

## Objective

Rewrite the stub generation core in `src/lib/stub.cjs` to produce high-fidelity stubs with `// RAPID-STUB` markers, `.rapid-stub` sidecar files, and realistic return values. Add `isRapidStub()` detection. Rewrite `src/lib/stub.test.cjs` to cover all new behavior including marker invariants, sidecar file lifecycle, and return-value fidelity.

This wave produces the primitives that Wave 2 (group orchestration) and Wave 3 (merge integration, CLI) depend on.

## Files Modified

| File | Action |
|------|--------|
| `src/lib/stub.cjs` | Major rewrite |
| `src/lib/stub.test.cjs` | Major rewrite |

---

## Task 1: Rewrite `generateStub()` for high-fidelity stubs with RAPID-STUB marker

**File:** `src/lib/stub.cjs`

**Current state:** `generateStub(contractJson, setName)` produces throw-on-call stubs with the header `// AUTO-GENERATED stub for set: ${setName}`. It reads `contractJson.exports.functions[]` and `contractJson.exports.types[]`.

**Required changes:**

1. **First line must be exactly `// RAPID-STUB`** -- no metadata, no set name, no timestamp. This is the marker that merge T0 auto-resolution uses.

2. **Second line:** `// Generated from CONTRACT.json for set: ${setName} -- DO NOT EDIT`

3. **Third line:** `'use strict';`

4. **Function stubs must return realistic values** based on the `returns` type annotation instead of throwing. Use this type-to-return mapping:
   - `string` -> `return '';`
   - `number` -> `return 0;`
   - `boolean` -> `return false;`
   - `object` -> `return {};`
   - `array` or `Array` or anything starting with `Array<` -> `return [];`
   - `void` or `undefined` -> `return;`
   - `Promise<X>` -> `return Promise.resolve(<resolved value of X>);` (recursively apply the mapping to X)
   - `null` -> `return null;`
   - Any unrecognized type -> `return null;` (safe fallback per CONTEXT.md decision)

5. **Extract the type-to-return mapping into a helper function** `getDefaultReturnValue(typeStr)` that is NOT exported but unit-testable via the generated stub output. This function should:
   - Trim whitespace from typeStr
   - Handle `Promise<X>` by recursively resolving X (strip `Promise<` prefix and `>` suffix)
   - Match common primitives case-insensitively
   - Fall back to `null` for unrecognized types

6. **Handle both contract formats:**
   - Legacy format: `contractJson.exports.functions[]` with `{name, file, params, returns}` and `contractJson.exports.types[]`
   - New format: `contractJson.exports` as a flat object where each key is an export name and value has `{type, signature, description}`. For the new format, parse the function signature string to extract parameter names and return type.

7. **Preserve JSDoc `@param` and `@returns` annotations** as they are today, but adapted for both contract formats.

8. **Keep `module.exports = { ... }` at the end** listing all function names.

**What NOT to do:**
- Do NOT make `getDefaultReturnValue` exported. It is an internal helper.
- Do NOT remove the `'use strict'` directive.
- Do NOT generate stubs that throw -- they must return realistic values.
- Do NOT add any timestamp or set-name metadata to the first line. The first line is exactly `// RAPID-STUB` and nothing else.

**Verification:**
```bash
node -e "
const s = require('./src/lib/stub.cjs');
const contract = {exports: {functions: [{name: 'foo', params: [{name: 'x', type: 'string'}], returns: 'boolean'}], types: []}};
const result = s.generateStub(contract, 'test-set');
const lines = result.split('\\n');
console.assert(lines[0] === '// RAPID-STUB', 'First line must be // RAPID-STUB');
console.assert(result.includes('return false'), 'boolean return should be false, not throw');
console.assert(!result.includes('throw'), 'Should not contain throw');
console.log('PASS: generateStub produces RAPID-STUB marker and realistic returns');
"
```

---

## Task 2: Implement `isRapidStub()` detection function

**File:** `src/lib/stub.cjs`

**New function to add:**

```
isRapidStub(fileContent: string): boolean
```

- Returns `true` if the file content's first line is exactly `// RAPID-STUB`.
- Uses first-line marker check only (per CONTEXT.md decision -- no metadata parsing, no sidecar check).
- Trim trailing `\r` from the first line to handle Windows line endings.
- Return `false` for empty strings, null, or undefined input (defensive).

**Export:** Add `isRapidStub` to `module.exports`.

**Verification:**
```bash
node -e "
const s = require('./src/lib/stub.cjs');
console.assert(s.isRapidStub('// RAPID-STUB\nrest of file') === true, 'Should detect marker');
console.assert(s.isRapidStub('// some other comment\ncode') === false, 'Should reject non-stubs');
console.assert(s.isRapidStub('') === false, 'Empty string should be false');
console.assert(s.isRapidStub(null) === false, 'Null should be false');
console.log('PASS: isRapidStub detection works');
"
```

---

## Task 3: Rewrite `generateStubFiles()` with `.rapid-stub` sidecar files

**File:** `src/lib/stub.cjs`

**Current state:** `generateStubFiles(cwd, setName)` writes stubs to `.rapid-stubs/{importedSetName}-stub.cjs` inside the worktree. It reads imports from `contractJson.imports.fromSets`.

**Required changes:**

1. **For each stub file written**, also write a `.rapid-stub` sidecar file alongside it. The sidecar file is zero-byte (empty content). The sidecar file path is: `{stubFilePath}.rapid-stub`. For example, if the stub is at `.rapid-stubs/auth-core-stub.cjs`, the sidecar is at `.rapid-stubs/auth-core-stub.cjs.rapid-stub`.

2. **Return value** changes from `string[]` to `Array<{stub: string, sidecar: string}>` -- each entry contains the absolute path of the stub file and its sidecar. This is richer than a flat array and enables callers to clean up both files.

3. **Handle the new contract format** for imports. The new CONTRACT.json format uses `contractJson.imports` as a flat object where each key is an import name and value has `{fromSet, type, signature, description}`. The legacy format uses `contractJson.imports.fromSets[]`. Support both:
   - Legacy: `imports.fromSets` is an array of `{set, functions}`
   - New: `imports` is an object where values have `fromSet` property. Group by unique `fromSet` values to determine which sets to generate stubs for.

4. **Use the rewritten `generateStub()`** to produce stub content with `// RAPID-STUB` markers.

**What NOT to do:**
- Do NOT change the stub directory location (`.rapid-stubs/` inside worktree).
- Do NOT put any content in the sidecar file -- it must be zero-byte.

**Verification:**
```bash
node -e "
const fs = require('fs');
const path = require('path');
// Verify sidecar creation logic exists in the module
const src = fs.readFileSync('./src/lib/stub.cjs', 'utf-8');
console.assert(src.includes('.rapid-stub'), 'Should reference .rapid-stub sidecar');
console.assert(src.includes('isRapidStub'), 'Should export isRapidStub');
console.log('PASS: stub.cjs source contains sidecar and detection references');
"
```

---

## Task 4: Update `cleanupStubFiles()` for sidecar removal

**File:** `src/lib/stub.cjs`

**Current state:** `cleanupStubFiles(worktreePath)` removes the entire `.rapid-stubs/` directory. This still works but the count should now include sidecar files.

**Required changes:**

1. **Count only `.cjs` stub files** (not `.rapid-stub` sidecars) in the returned `count`, so the count reflects the number of logical stubs removed, not the total file count.

2. **Add a new function `cleanupStubSidecars(targetDir)`** that specifically finds and removes `.rapid-stub` sidecar files from an arbitrary directory tree (not just `.rapid-stubs/`). This is needed for merge-time cleanup where stubs may have been copied into the worktree source tree.
   - Walk the directory recursively
   - For each `.rapid-stub` file found, remove both the sidecar AND the corresponding source file (the sidecar path minus the `.rapid-stub` suffix)
   - Return `{cleaned: number, files: string[]}` where `files` lists the source files removed (not the sidecars)
   - If the directory does not exist, return `{cleaned: 0, files: []}`

3. **Export** `cleanupStubSidecars` in `module.exports`.

**Verification:**
```bash
node -e "
const s = require('./src/lib/stub.cjs');
console.assert(typeof s.cleanupStubFiles === 'function', 'cleanupStubFiles should exist');
console.assert(typeof s.cleanupStubSidecars === 'function', 'cleanupStubSidecars should exist');
console.log('PASS: both cleanup functions exported');
"
```

---

## Task 5: Rewrite `src/lib/stub.test.cjs` for all new behavior

**File:** `src/lib/stub.test.cjs`

**Full rewrite.** The existing tests cover the old throw-on-call behavior and must be replaced. Use `node:test` with `assert/strict`. Organize tests into these `describe` blocks:

### `describe('generateStub')`

1. **`it('first line is exactly // RAPID-STUB')`** -- generate a stub from a contract with 1 function, assert `lines[0] === '// RAPID-STUB'`.

2. **`it('produces realistic return values for common types')`** -- contract with functions returning string, number, boolean, object, array. Assert the generated code contains `return ''`, `return 0`, `return false`, `return {}`, `return []` respectively. Assert NO `throw` in the output.

3. **`it('returns null for unrecognized types')`** -- contract with function returning `CustomWidget`. Assert the stub contains `return null`.

4. **`it('handles Promise<T> return types')`** -- contract with function returning `Promise<string>`. Assert the stub contains `return Promise.resolve('')`.

5. **`it('handles nested Promise<Array<string>> types')`** -- Assert stub contains `return Promise.resolve([])`.

6. **`it('produces JSDoc @param and @returns annotations')`** -- same as existing test, verify JSDoc presence.

7. **`it('produces @typedef blocks from exports.types')`** -- same as existing test.

8. **`it('handles contract with no exports key gracefully')`** -- same as existing test.

9. **`it('handles new flat exports contract format')`** -- pass a contract using the new flat `exports` format (keys are export names, values have `{type, signature, description}`). Assert generated stubs parse the signature correctly to extract function name, params, and return type.

10. **`it('generated stub is require()-able and returns values instead of throwing')`** -- write stub to temp file, require() it, call the function, assert it returns the expected default value (not throws).

### `describe('isRapidStub')`

1. **`it('returns true for content starting with // RAPID-STUB')`**
2. **`it('returns false for content starting with other comments')`**
3. **`it('returns false for empty string')`**
4. **`it('returns false for null and undefined')`**
5. **`it('handles Windows line endings (\\r\\n)')`**

### `describe('generateStubFiles')`

Update existing tests to verify:
1. **Sidecar files are created alongside stub files** -- assert `.rapid-stub` files exist.
2. **Return value is array of `{stub, sidecar}` objects** instead of flat string array.
3. **Legacy import format still works.**
4. **New flat import format works** -- pass a contract with new-style imports.

### `describe('cleanupStubFiles')`

Keep existing tests but update the count assertion to count only `.cjs` files.

### `describe('cleanupStubSidecars')`

1. **`it('removes sidecar and corresponding source file')`** -- create a directory with `foo.cjs` and `foo.cjs.rapid-stub`, call `cleanupStubSidecars`, assert both are gone.
2. **`it('recursively walks subdirectories')`** -- nested dirs with sidecars.
3. **`it('returns empty result for non-existent directory')`**

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/stub.test.cjs
```

---

## Success Criteria

1. `src/lib/stub.cjs` exports: `generateStub`, `generateStubFiles`, `cleanupStubFiles`, `cleanupStubSidecars`, `isRapidStub`
2. Every generated stub's first line is exactly `// RAPID-STUB`
3. Stubs return realistic values (not throw)
4. `.rapid-stub` sidecar files are zero-byte and created for every stub
5. `isRapidStub()` correctly detects the marker in file content
6. Both legacy and new contract formats are supported
7. All tests in `stub.test.cjs` pass
