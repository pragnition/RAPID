# Wave 1 PLAN: Test Framework Detection & Config Schema

**Set:** unit-test-improvements
**Wave:** 1 of 2
**Objective:** Add test framework auto-detection to `src/lib/context.cjs`, extend `generateConfigJson` in `src/lib/init.cjs` to support the `testFrameworks` field, and wire the `write-config` CLI to accept `--test-frameworks` input.

## Owned Files

| File | Action |
|------|--------|
| `src/lib/context.cjs` | Modify -- add test framework detection |
| `src/lib/init.cjs` | Modify -- extend config schema for testFrameworks |
| `src/commands/init.cjs` | Modify -- add --test-frameworks flag to write-config |
| `.planning/config.json` | No direct edit -- updated via write-config at runtime |

## Task 1: Add test framework detection constants to context.cjs

**File:** `src/lib/context.cjs`

**Action:** Add two new constant arrays after `PY_FRAMEWORKS` (line 72):

1. `JS_TEST_FRAMEWORKS` -- array of objects mapping package.json devDependency names to test framework identifiers:
   ```
   [
     { dep: 'jest', framework: 'jest', runner: 'npx jest' },
     { dep: 'vitest', framework: 'vitest', runner: 'npx vitest run' },
     { dep: 'mocha', framework: 'mocha', runner: 'npx mocha' },
   ]
   ```
   Note: If none of these are found, the default for JS/TS is `{ framework: 'node:test', runner: 'node --test' }`.

2. `PY_TEST_FRAMEWORKS` -- array of objects mapping Python dependency indicators:
   ```
   [
     { dep: 'pytest', framework: 'pytest', runner: 'pytest' },
   ]
   ```
   Default for Python if none found: `{ framework: 'unittest', runner: 'python -m unittest discover' }`.

3. `TEST_FRAMEWORK_CONFIGS` -- array mapping config file patterns (from existing `CONFIG_PATTERNS` testing category) to frameworks:
   ```
   [
     { prefix: 'jest.config', framework: 'jest', lang: 'javascript', runner: 'npx jest' },
     { prefix: 'vitest.config', framework: 'vitest', lang: 'javascript', runner: 'npx vitest run' },
     { prefix: '.mocharc', framework: 'mocha', lang: 'javascript', runner: 'npx mocha' },
     { exact: 'pytest.ini', framework: 'pytest', lang: 'python', runner: 'pytest' },
     { exact: 'setup.cfg', framework: 'pytest', lang: 'python', runner: 'pytest' },
     { exact: 'tox.ini', framework: 'pytest', lang: 'python', runner: 'pytest' },
   ]
   ```

4. `LANG_DEFAULT_TEST_FRAMEWORKS` -- fallback map for languages with intrinsic test runners:
   ```
   {
     go: { framework: 'go-test', runner: 'go test ./...' },
     rust: { framework: 'cargo-test', runner: 'cargo test' },
     javascript: { framework: 'node:test', runner: 'node --test' },
     typescript: { framework: 'node:test', runner: 'node --test' },
     python: { framework: 'unittest', runner: 'python -m unittest discover' },
   }
   ```

**What NOT to do:** Do not modify the existing `CONFIG_PATTERNS` array. The new constants are standalone and consumed by the new detection function.

**Verification:**
```bash
node -e "const c = require('./src/lib/context.cjs'); console.log('exports:', Object.keys(c))"
```
Should still export the existing 4 functions (no breakage).

## Task 2: Add detectTestFrameworks() function to context.cjs

**File:** `src/lib/context.cjs`

**Action:** Add a new exported function `detectTestFrameworks(cwd)` after `detectCodebase()` (after line 206). This function returns an array of `{ lang, framework, runner }` objects.

**Detection algorithm (in priority order):**

1. **Config file scan:** Walk root directory entries (depth 1). For each file, check against `TEST_FRAMEWORK_CONFIGS`. If matched, add `{ lang, framework, runner }` to results. This is the highest signal.

2. **Dependency scan (JS):** If `package.json` exists, parse it, merge `dependencies` + `devDependencies`. Check against `JS_TEST_FRAMEWORKS`. If matched, add `{ lang: 'javascript', framework, runner }`.

3. **Dependency scan (Python):** If `requirements.txt` or `pyproject.toml` exists, read content as string. Check for each `PY_TEST_FRAMEWORKS` entry's `dep` string. If found, add `{ lang: 'python', framework, runner }`.

4. **Language defaults:** Call `detectCodebase(cwd)` to get `languages[]`. For each detected language not already covered by steps 1-3, look up `LANG_DEFAULT_TEST_FRAMEWORKS` and add the entry if it exists.

**Deduplication:** Use a `Map` keyed by `lang` -- first detection wins (config file > deps > defaults). This ensures the highest-priority signal is preserved.

**Return value:** Array of `{ lang: string, framework: string, runner: string }` objects.

**Export:** Add `detectTestFrameworks` to `module.exports` alongside existing exports.

**Verification:**
```bash
node -e "const { detectTestFrameworks } = require('./src/lib/context.cjs'); console.log(JSON.stringify(detectTestFrameworks('.'), null, 2))"
```
For the RAPID project itself (which uses node:test), should output:
```json
[{ "lang": "javascript", "framework": "node:test", "runner": "node --test" }]
```

## Task 3: Extend generateConfigJson to support testFrameworks

**File:** `src/lib/init.cjs`

**Action:** Modify `generateConfigJson()` (line 177) to accept an optional `opts.testFrameworks` array. If provided, include it in the generated config object.

Current config shape:
```js
{ project: { name, version }, model, planning: { max_parallel_sets }, solo }
```

New shape when testFrameworks is provided:
```js
{ project: { name, version }, model, planning: { max_parallel_sets }, solo, testFrameworks: [...] }
```

If `opts.testFrameworks` is undefined or empty, omit the field entirely (backward compatible).

**Verification:**
```bash
node -e "const { generateConfigJson } = require('./src/lib/init.cjs'); console.log(generateConfigJson({ name: 'test', testFrameworks: [{ lang: 'javascript', framework: 'node:test', runner: 'node --test' }] }))"
```
Should output JSON with `testFrameworks` field included.

## Task 4: Add --test-frameworks flag to write-config CLI

**File:** `src/commands/init.cjs`

**Action:** In the `write-config` subcommand handler (line 71-115), add support for a `--test-frameworks` flag that accepts a JSON string.

Add to the switch block (after the `--solo` case):
```js
case '--test-frameworks':
  testFrameworks = JSON.parse(args[++i]);
  break;
```

Declare `let testFrameworks = undefined;` alongside the other variables.

Pass `testFrameworks` into opts: `if (testFrameworks) opts.testFrameworks = testFrameworks;`

**Merge behavior for manual overrides:** Before writing, if config.json already exists, read it and check for existing `testFrameworks` entries. For each entry in the existing config that differs from what detection produced (keyed by `lang`), preserve the existing entry. Only add new lang entries from detection. This preserves user manual overrides.

Implementation:
- After generating `configContent` from `generateConfigJson(opts)` but before `fs.writeFileSync`, parse the generated content back to JSON.
- If `configPath` already exists, read and parse the existing config.
- If existing config has `testFrameworks`, iterate by `lang`: keep existing entries where `lang` matches, append new entries where `lang` is absent.
- Re-stringify and write.

**Verification:**
```bash
node ~/Projects/RAPID/src/bin/rapid-tools.cjs init write-config --name "test" --model "opus" --test-frameworks '[{"lang":"javascript","framework":"jest","runner":"npx jest"}]' 2>&1 || true
```
(Will fail if not in a .planning dir, but verifies parsing does not crash.)

## Task 5: Unit tests for detectTestFrameworks

**File:** `src/lib/context.test.cjs`

**Action:** Add a new `describe('detectTestFrameworks')` block at the end of the file. Tests to include:

1. **Empty directory returns empty array** -- tmpDir with no files, result should be `[]`.

2. **JS project with jest devDep detects jest** -- Create `package.json` with `devDependencies: { jest: "^29.0.0" }`. Result should contain `{ lang: 'javascript', framework: 'jest', runner: 'npx jest' }`.

3. **JS project with no test deps defaults to node:test** -- Create `package.json` with `dependencies: { express: "^4.0.0" }` (no test deps). Create a `.js` source file. Result should contain `{ lang: 'javascript', framework: 'node:test', runner: 'node --test' }`.

4. **Python project with pytest.ini detects pytest** -- Create `pyproject.toml` and `pytest.ini`. Result should contain `{ lang: 'python', framework: 'pytest', runner: 'pytest' }`.

5. **Config file takes priority over deps** -- Create `package.json` with `devDependencies: { jest: "^29" }` AND `vitest.config.js`. Result for javascript should be vitest (config wins).

6. **Go project defaults to go test** -- Create `go.mod`. Result should contain `{ lang: 'go', framework: 'go-test', runner: 'go test ./...' }`.

7. **Multi-language project returns multiple entries** -- Create `package.json` + `go.mod`. Result should contain entries for both javascript and go.

**Verification:**
```bash
node --test src/lib/context.test.cjs
```
All tests should pass, including existing tests (no regression).

## Success Criteria

- [ ] `detectTestFrameworks(cwd)` exported from context.cjs and returns correct framework array for JS, Python, Go, Rust projects
- [ ] `generateConfigJson()` includes `testFrameworks` when provided
- [ ] `write-config` CLI accepts `--test-frameworks` JSON flag with merge-based override preservation
- [ ] All 7+ new unit tests pass
- [ ] All existing context.test.cjs tests continue to pass (no regression)
- [ ] RAPID project self-test: `detectTestFrameworks('.')` returns `[{ lang: 'javascript', framework: 'node:test', runner: 'node --test' }]`
