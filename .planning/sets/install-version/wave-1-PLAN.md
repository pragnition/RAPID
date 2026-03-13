# Wave 1 PLAN: Version Module Foundation

**Set:** install-version
**Wave:** 1 of 2
**Objective:** Create `src/lib/version.cjs` with `getVersion()` and `versionCheck()` utilities, plus comprehensive unit tests.

## Tasks

### Task 1: Create `src/lib/version.cjs`

**File:** `src/lib/version.cjs` (NEW)

**Actions:**
1. Create the module with two exported functions: `getVersion()` and `versionCheck(installed, current)`.
2. `getVersion()` reads `version` from `package.json` resolved via `path.resolve(__dirname, '../../package.json')`. Returns the version string. Must never hardcode a version value.
3. `versionCheck(installed, current)` imports `compareVersions` from `./prereqs.cjs`. Returns `{ needsUpdate: boolean, installed: string, current: string }` where `needsUpdate` is `true` when `compareVersions(installed, current) < 0` (i.e., installed is older than current).
4. Export both functions via `module.exports`.

**Implementation details:**
- Use `require()` to load `package.json` (JSON files are natively supported by `require()`).
- Import `compareVersions` at the top of the file from `./prereqs.cjs`.
- The module should be minimal -- roughly 30-40 lines including JSDoc comments.
- Follow the same `'use strict';` convention as other modules in `src/lib/`.

**What NOT to do:**
- Do not hardcode any version string -- always read from `package.json`.
- Do not re-implement version comparison -- reuse `compareVersions` from `prereqs.cjs`.
- Do not export `compareVersions` from this module -- consumers should import it from `prereqs.cjs` if needed.

**Verification:**
```bash
node -e "const v = require('./src/lib/version.cjs'); console.log(v.getVersion()); console.log(v.versionCheck('2.0.0', '3.0.0'));"
```
Expected: prints `3.0.0` then `{ needsUpdate: true, installed: '2.0.0', current: '3.0.0' }`.

---

### Task 2: Create `src/lib/version.test.cjs`

**File:** `src/lib/version.test.cjs` (NEW)

**Actions:**
1. Create unit tests using `node:test` and `node:assert/strict` (project convention).
2. Test `getVersion()`:
   - Returns a string matching semver pattern (`/^\d+\.\d+\.\d+$/`).
   - Returns the same value as independently reading `package.json` (behavioral contract: version comes from package.json, not hardcoded). Read `package.json` independently in the test via `JSON.parse(fs.readFileSync(...))` to compare.
3. Test `versionCheck()`:
   - `versionCheck('2.0.0', '3.0.0')` returns `{ needsUpdate: true, installed: '2.0.0', current: '3.0.0' }`.
   - `versionCheck('3.0.0', '3.0.0')` returns `{ needsUpdate: false, installed: '3.0.0', current: '3.0.0' }`.
   - `versionCheck('4.0.0', '3.0.0')` returns `{ needsUpdate: false, installed: '4.0.0', current: '3.0.0' }`.
   - Minor/patch version differences: `versionCheck('3.0.0', '3.1.0')` returns `{ needsUpdate: true, ... }`.

**Implementation details:**
- Use `describe`/`it` blocks from `node:test`.
- For the "version matches package.json" test, resolve `package.json` via `path.resolve(__dirname, '../../package.json')` and read it with `fs.readFileSync` + `JSON.parse`.
- Do NOT use `require()` for `package.json` in the test since it would be cached; use `fs.readFileSync` to ensure an independent read.

**What NOT to do:**
- Do not use Jest, Mocha, or any external test framework -- use `node:test` only.
- Do not skip the "matches package.json" test -- it enforces the behavioral contract.

**Verification:**
```bash
node --test src/lib/version.test.cjs
```
Expected: all tests pass.

---

## Success Criteria
- `src/lib/version.cjs` exports `getVersion()` and `versionCheck()`.
- `getVersion()` returns the version string from `package.json` (currently `3.0.0`).
- `versionCheck()` correctly compares versions using `compareVersions` from `prereqs.cjs`.
- All tests in `src/lib/version.test.cjs` pass.
- No modifications to existing files in this wave.

## Files Owned by This Wave
| File | Action |
|------|--------|
| `src/lib/version.cjs` | CREATE |
| `src/lib/version.test.cjs` | CREATE |
