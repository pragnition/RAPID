# PLAN: bug-fixes-foundation -- Wave 1

## Objective

Deliver the three lowest-risk, most isolated fixes: the `--description` CLI alias, the Node.js minimum version bump, and the `fileOwnership` schema extension. These are single-line to few-line changes with no cross-file dependencies or shared state, making them ideal for the first wave to build confidence and establish the regression-test pattern.

## Tasks

### Task 1: Add `--description` alias in CLI parser

**File:** `src/commands/init.cjs`

**Action:** In the `for` loop switch statement (around line 28-41), add `case '--description':` as a fallthrough immediately before `case '--desc':`.

**Before (lines 28-34):**
```js
    for (let i = 1; i < args.length; i++) {
      switch (args[i]) {
        case '--name':
          name = args[++i];
          break;
        case '--desc':
          desc = args[++i];
```

**After:**
```js
    for (let i = 1; i < args.length; i++) {
      switch (args[i]) {
        case '--name':
          name = args[++i];
          break;
        case '--description':
        case '--desc':
          desc = args[++i];
```

**What NOT to do:** Do not add a separate case body for `--description` -- it must fall through to the `--desc` handler, not duplicate it.

**Test file:** `src/commands/init.cjs` has no dedicated test file. The CLI parser is tested indirectly. Create a minimal unit test for this in `src/lib/init.test.cjs` by importing `handleInit` and mocking `process.cwd()` -- OR simply verify the alias works by inspecting the source. Given the test infra constraint, add a test in `src/lib/init.test.cjs` that calls `scaffoldProject()` with both flag names to verify end-to-end behavior is identical. Since `scaffoldProject()` receives `description` as a property (not a flag), the real test is that the CLI parser correctly maps both flags to the same variable. Add a describe block:

```
describe('--description alias', () => {
  it('--description and --desc both produce the same scaffoldProject opts', () => {
    // The CLI parser in init.cjs maps both --desc and --description to the `desc` variable
    // which is passed as opts.description to scaffoldProject.
    // Verify by calling scaffoldProject with the description field and checking PROJECT.md content.
    const result1 = scaffoldProject(tmpDir, { name: 'P', description: 'Test via desc', teamSize: 1 }, 'fresh');
    const projectMd = fs.readFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), 'utf-8');
    assert.ok(projectMd.includes('Test via desc'));
  });
});
```

The real verification is a source-level assertion that both cases exist. The executor should add a test that reads `src/commands/init.cjs` and asserts both `'--description'` and `'--desc'` appear in the switch.

**Verification:**
```bash
node -e "const src = require('fs').readFileSync('src/commands/init.cjs','utf-8'); const hasDesc = src.includes(\"case '--desc':\"); const hasDescription = src.includes(\"case '--description':\"); console.log({hasDesc, hasDescription}); if(!hasDesc||!hasDescription) process.exit(1);"
```

---

### Task 2: Bump Node.js minimum version to 20+

**File:** `src/lib/prereqs.cjs` (line 115)

**Action:** Change `minVersion: '18'` to `minVersion: '20'` in the Node.js checkTool call within `validatePrereqs()`.

**Before (line 115):**
```js
      minVersion: '18',
```

**After:**
```js
      minVersion: '20',
```

**File:** `package.json`

**Action:** Add an `engines` field to the top-level package.json object. Insert after the `"private": true` line:

```json
  "engines": {
    "node": ">=20"
  },
```

**Test file:** `src/lib/prereqs.test.cjs`

**Action:** Update any test that references `minVersion: '18'` for Node.js to use `'20'` instead. The formatPrereqSummary tests at line 204 use `minVersion: '18'` in mock data -- update those to `'20'`. Search for all occurrences of `'18'` in the test file and update them to `'20'` where they refer to the Node.js minimum version.

**Verification:**
```bash
node -e "const {validatePrereqs} = require('./src/lib/prereqs.cjs'); validatePrereqs().then(r => { const node = r.find(x => x.name === 'Node.js'); console.log(node); if(node.minVersion !== '20') process.exit(1); console.log('PASS: minVersion is 20'); });"
```
```bash
node -e "const pkg = require('./package.json'); if(!pkg.engines || pkg.engines.node !== '>=20') { console.log('FAIL'); process.exit(1); } console.log('PASS: engines.node is >=20');"
```

---

### Task 3: Add `fileOwnership` to CONTRACT_META_SCHEMA

**File:** `src/lib/contract.cjs` (lines 27-107)

**Action:** Add `fileOwnership` as an optional property to the `CONTRACT_META_SCHEMA` object. Insert it before the closing of the `properties` object (before line 104). The type should be an array of strings, matching how `add-set.cjs` line 139 consumes it: `Array.isArray(contractJson.fileOwnership)`.

**Insert inside `properties: {` (after `behavioral` and before the closing `}`of properties):**
```js
    fileOwnership: {
      type: 'array',
      items: { type: 'string' },
    },
```

**What NOT to do:** Do not add `fileOwnership` to the `required` array -- it is optional. Do not change `additionalProperties: false` -- the new property is now within `properties` so it passes validation.

**Test file:** `src/lib/contract.test.cjs`

**Action:** Add a test that validates a CONTRACT.json containing a `fileOwnership` field passes `compileContract()`:

```js
describe('fileOwnership in CONTRACT_META_SCHEMA', () => {
  it('accepts contract with fileOwnership array', () => {
    const contract = {
      exports: { functions: [], types: [] },
      fileOwnership: ['src/lib/foo.cjs', 'src/lib/bar.cjs'],
    };
    const result = compileContract(contract);
    assert.equal(result.valid, true);
  });

  it('rejects contract with non-array fileOwnership', () => {
    const contract = {
      exports: { functions: [], types: [] },
      fileOwnership: 'src/lib/foo.cjs',
    };
    const result = compileContract(contract);
    assert.equal(result.valid, false);
  });
});
```

**Verification:**
```bash
node --test src/lib/contract.test.cjs
```

---

## File Ownership (Wave 1)

| File | Action |
|------|--------|
| `src/commands/init.cjs` | Add `--description` case fallthrough |
| `src/lib/prereqs.cjs` | Change minVersion `'18'` to `'20'` |
| `src/lib/prereqs.test.cjs` | Update mock data from `'18'` to `'20'` |
| `src/lib/contract.cjs` | Add `fileOwnership` to schema properties |
| `src/lib/contract.test.cjs` | Add fileOwnership validation tests |
| `package.json` | Add `engines: { node: ">=20" }` |

## Success Criteria

1. `case '--description':` appears in the switch statement in `src/commands/init.cjs` and falls through to `case '--desc':`
2. `validatePrereqs()` returns `minVersion: '20'` for the Node.js check
3. `package.json` contains `"engines": { "node": ">=20" }`
4. A CONTRACT.json with `fileOwnership: ["a.cjs"]` passes `compileContract()` validation
5. A CONTRACT.json with `fileOwnership: "not-array"` fails `compileContract()` validation
6. `node --test src/lib/prereqs.test.cjs` passes
7. `node --test src/lib/contract.test.cjs` passes
