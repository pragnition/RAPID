# Wave 2 PLAN: branding-system -- Integration & Testing

**Objective:** Wire branding context injection into the execution engine (`execute.cjs`), add the branding display stage to `display.cjs`, and update both test files to cover the new functionality. This wave modifies existing files only.

**Owned files this wave:**
- `src/lib/execute.cjs` (modify)
- `src/lib/execute.test.cjs` (modify)
- `src/lib/display.cjs` (modify)
- `src/lib/display.test.cjs` (modify)

---

## Task 1: Add branding stage entries to `display.cjs`

**Action:** Add `'branding'` entries to both `STAGE_VERBS` and `STAGE_BG` maps in `src/lib/display.cjs`.

**File:** `src/lib/display.cjs`

**Exact changes:**

1. Add to `STAGE_VERBS` object (after the `'scaffold'` entry at line 39):
```javascript
  'branding': 'BRANDING',
```

2. Add to `STAGE_BG` object (after the `'scaffold'` entry at line 66):
```javascript
  'branding': '\x1b[104m',  // bright blue (planning stage)
```

3. Update the JSDoc comment block above `STAGE_VERBS` (lines 22-23) to mention branding in the stage list. Update the count comment from the current list.

**What NOT to do:**
- Do NOT change any existing stage entries
- Do NOT modify `renderBanner()` function logic -- it already handles any key in STAGE_VERBS/STAGE_BG
- Do NOT change the ANSI code format

**Verification:**
```bash
cd /home/kek/Projects/RAPID
node -e "const d = require('./src/lib/display.cjs'); console.log('VERB:', d.STAGE_VERBS['branding']); console.log('BG:', d.STAGE_BG['branding'] ? 'present' : 'MISSING')"
node -e "const d = require('./src/lib/display.cjs'); const b = d.renderBanner('branding', 'my-project'); console.log(b); console.log(b.includes('BRANDING') ? 'PASS' : 'FAIL')"
```

**Commit:** `feat(branding-system): add branding stage to display.cjs stage maps`

---

## Task 2: Update `display.test.cjs` for branding stage

**Action:** Update all `expectedStages` arrays in `src/lib/display.test.cjs` to include both `'scaffold'` and `'branding'`. Currently the tests check 14 stages but the code has 15 (scaffold was added but not reflected in tests). After adding branding, the code will have 16 stages. Update tests to check all 16.

**File:** `src/lib/display.test.cjs`

**Exact changes:**

There are 5 places where `expectedStages` arrays are defined (or equivalent stage lists used). Each must be updated:

1. **Line 19 (STAGE_VERBS test, "maps all 14 stages"):** Change the test description from `'maps all 14 stages to uppercase verb strings'` to `'maps all 16 stages to uppercase verb strings'`. Add `'scaffold'` and `'branding'` to the `expectedStages` array.

2. **Line 32 (STAGE_VERBS "has expected verb mappings"):** Add two new assertions:
```javascript
assert.equal(display.STAGE_VERBS['scaffold'], 'SCAFFOLDING');
assert.equal(display.STAGE_VERBS['branding'], 'BRANDING');
```

3. **Line 52 (STAGE_BG test, "maps all 14 stages"):** Change description to `'maps all 16 stages to ANSI background escape codes'`. Add `'scaffold'` and `'branding'` to the `expectedStages` array.

4. **Line 67 (STAGE_BG "planning stages use blue background"):** Add `'scaffold'` and `'branding'` to the `planningStages` array (both are planning-stage blue).

5. **Line 219 (renderBanner "all 14 stages produce valid banner strings"):** Change description to `'all 16 stages produce valid banner strings'`. Add `'scaffold'` and `'branding'` to the `stages` array.

6. **Line 241 (renderBanner "output ends with ANSI reset code"):** Add `'scaffold'` and `'branding'` to the `stages` array.

7. **Line 255 (renderBanner "banner output has consistent padded width"):** Add `'scaffold'` and `'branding'` to the `stages` array.

8. **Add a NEW test** for branding banner rendering:
```javascript
it('renderBanner("branding") returns string containing "RAPID", "BRANDING", and ANSI codes', () => {
  const display = require(displayPath);
  const result = display.renderBanner('branding');
  assert.ok(result.includes('RAPID'), 'Banner should contain "RAPID"');
  assert.ok(result.includes('BRANDING'), 'Banner should contain "BRANDING"');
  assert.ok(result.includes('\x1b['), 'Banner should contain ANSI escape codes');
});

it('renderBanner("branding", "my-project") contains "my-project"', () => {
  const display = require(displayPath);
  const result = display.renderBanner('branding', 'my-project');
  assert.ok(result.includes('BRANDING'), 'Banner should contain "BRANDING"');
  assert.ok(result.includes('my-project'), 'Banner should contain "my-project"');
});
```

**What NOT to do:**
- Do NOT remove or modify any existing test assertions
- Do NOT change the test structure (describe/it blocks)
- Only ADD `'scaffold'` and `'branding'` to existing arrays and add new branding-specific tests

**Verification:**
```bash
cd /home/kek/Projects/RAPID
node --test src/lib/display.test.cjs
```
All tests must pass, including the new branding-specific tests.

**Commit:** `test(branding-system): update display tests for branding and scaffold stages`

---

## Task 3: Add `buildBrandingContext()` to `execute.cjs` and inject into both functions

**Action:** Add a `buildBrandingContext(cwd)` function and inject branding context into both `enrichedPrepareSetContext()` and `assembleExecutorPrompt()`.

**File:** `src/lib/execute.cjs`

### Part A: Add `buildBrandingContext()` function

Add this function BEFORE the `prepareSetContext` function (around line 27, after the `require` statements and `VALID_PHASES` constant):

```javascript
/**
 * Read .planning/branding/BRANDING.md and return formatted branding context string.
 * Returns empty string when BRANDING.md does not exist (branding is fully optional).
 *
 * @param {string} cwd - Project root directory
 * @returns {string} Formatted branding context string, or empty string if absent
 */
function buildBrandingContext(cwd) {
  const brandingPath = path.join(cwd, '.planning', 'branding', 'BRANDING.md');
  try {
    const content = fs.readFileSync(brandingPath, 'utf-8').trim();
    if (!content) return '';
    return '## Branding Context\n\n' +
      'The following project branding guidelines should influence documentation, ' +
      'READMEs, and code comments/naming. Do NOT apply branding to commit messages, ' +
      'CLI output, or RAPID internal output.\n\n' +
      content;
  } catch {
    return '';
  }
}
```

Key behavior:
- Reads from `.planning/branding/BRANDING.md` (the path from CONTEXT.md decisions, NOT CONTRACT.json's `.planning/BRANDING.md`)
- Returns empty string on any error (file not found, read error, empty file)
- Prefixes with `## Branding Context` heading and scope instructions (what to apply it to, what NOT to apply it to)
- No token budgeting needed (BRANDING.md is already capped at 50-150 lines by the skill)

### Part B: Inject into `enrichedPrepareSetContext()`

In the `enrichedPrepareSetContext()` function (lines 61-85), add a branding context block following the exact same pattern as quality and UI context. Add AFTER the `uiContext` block (after line 78):

```javascript
  let brandingContext = '';
  try {
    brandingContext = buildBrandingContext(cwd);
  } catch {
    // Graceful -- branding context is optional
  }
```

Update the return statement (line 80-84) to include `brandingContext`:

```javascript
  return {
    ...ctx,
    qualityContext,
    uiContext,
    brandingContext,
  };
```

### Part C: Inject into `assembleExecutorPrompt()`

In `assembleExecutorPrompt()` (lines 166-319), branding context must be injected into ALL THREE phases (discuss, plan, execute). This is different from quality/memory which only inject in plan+execute.

1. **Load branding context** at the top of `assembleExecutorPrompt()`, right after `const ctx = prepareSetContext(cwd, setName);` (line 171). Add before the memory context loading:

```javascript
  // Load branding context for all phases (branding applies to discuss, plan, and execute)
  let brandingContext = '';
  try {
    brandingContext = buildBrandingContext(cwd);
  } catch {
    // Graceful -- skip branding if module not available or errors
  }
```

2. **Inject in discuss phase** (inside the `case 'discuss':` block). Add the branding context at the end of the prompt array, before the closing `].join('\n');`. Insert between the last instruction line and the `.join()`:

After the line `'If everything is clear, state that you have no questions and summarize the implementation approach you would take.',`:
```javascript
        ...(brandingContext ? ['', brandingContext] : []),
```

3. **Inject in plan phase** (inside the `case 'plan':` block). Add after the existing quality context spread and before the Instructions section. After the line `...(qualityContext ? ['', qualityContext] : []),`:
```javascript
        ...(brandingContext ? ['', brandingContext] : []),
```

4. **Inject in execute phase** (inside the `case 'execute':` block). Add after the quality context injection (after the `if (qualityContext)` block, around line 283) and before the Implementation Plan section:
```javascript
      if (brandingContext) {
        parts.push('');
        parts.push(brandingContext);
      }
```

### Part D: Export `buildBrandingContext`

Add `buildBrandingContext` to the `module.exports` object at the bottom of the file.

**What NOT to do:**
- Do NOT change the BRANDING.md read path to `.planning/BRANDING.md` -- use `.planning/branding/BRANDING.md` per CONTEXT.md decisions
- Do NOT add branding to `require()` -- it is a local function, not a separate module
- Do NOT add token budgeting -- the 50-150 line cap is enforced by the skill at generation time
- Do NOT change the existing quality/memory/UI context injection logic
- Do NOT add any runtime validation of BRANDING.md content structure

**Verification:**
```bash
cd /home/kek/Projects/RAPID
# Verify function exists and is exported
node -e "const e = require('./src/lib/execute.cjs'); console.log(typeof e.buildBrandingContext === 'function' ? 'PASS: exported' : 'FAIL')"

# Verify it returns empty string when no BRANDING.md exists
node -e "const e = require('./src/lib/execute.cjs'); const result = e.buildBrandingContext('/tmp/nonexistent'); console.log(result === '' ? 'PASS: empty on missing' : 'FAIL')"

# Verify enrichedPrepareSetContext has brandingContext field (will be empty string in test env)
# (This test depends on having a mock project -- the execute.test.cjs tests cover this properly)
```

**Commit:** `feat(branding-system): add buildBrandingContext and inject into execution engine`

---

## Task 4: Add execute.test.cjs tests for branding context

**Action:** Add comprehensive tests for branding context injection to `src/lib/execute.test.cjs`, covering both `buildBrandingContext`, `enrichedPrepareSetContext`, and `assembleExecutorPrompt` branding behavior.

**File:** `src/lib/execute.test.cjs`

### New helper function

Add a helper function near the existing `addQualityContext` helper (around line 1294):

```javascript
/**
 * Helper: add branding context files to a mock project tmpDir
 */
function addBrandingContext(tmpDir) {
  const brandingDir = path.join(tmpDir, '.planning', 'branding');
  fs.mkdirSync(brandingDir, { recursive: true });

  fs.writeFileSync(path.join(brandingDir, 'BRANDING.md'), [
    '# Project Branding Guidelines',
    '',
    '<identity>',
    '## Project Identity',
    'A developer-focused CLI tool with a professional, precise tone.',
    '</identity>',
    '',
    '<tone>',
    '## Tone & Voice',
    'Use direct, technical language. Avoid marketing speak.',
    '</tone>',
    '',
    '<terminology>',
    '## Terminology & Naming',
    '',
    '| Preferred Term | Instead Of | Context |',
    '|---------------|-----------|---------|',
    '| set | module | RAPID work unit |',
    '| wave | phase | Parallel execution group |',
    '</terminology>',
    '',
    '<output>',
    '## Output Style',
    'Concise bullet points. Code examples over prose.',
    '</output>',
    '',
    '<anti-patterns>',
    '## Anti-Patterns (Do NOT)',
    '- Never use emojis in documentation',
    '- Avoid filler words like "simply", "just", "easily"',
    '</anti-patterns>',
  ].join('\n'), 'utf-8');
}
```

### New test describe blocks

Add the following test blocks at the end of the file (before the closing of the module, after the existing `enrichedPrepareSetContext` describe block):

**1. buildBrandingContext tests:**

```javascript
describe('buildBrandingContext', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-branding-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty string when .planning/branding/BRANDING.md does not exist', () => {
    const result = executeModule.buildBrandingContext(tmpDir);
    assert.equal(result, '', 'should return empty string when no BRANDING.md');
  });

  it('returns formatted branding context when BRANDING.md exists', () => {
    addBrandingContext(tmpDir);
    const result = executeModule.buildBrandingContext(tmpDir);
    assert.ok(result.includes('## Branding Context'), 'should have Branding Context heading');
    assert.ok(result.includes('Project Identity'), 'should contain identity section');
    assert.ok(result.includes('Tone & Voice'), 'should contain tone section');
    assert.ok(result.includes('Do NOT apply branding to commit messages'), 'should include scope instructions');
  });

  it('returns empty string for empty BRANDING.md file', () => {
    const brandingDir = path.join(tmpDir, '.planning', 'branding');
    fs.mkdirSync(brandingDir, { recursive: true });
    fs.writeFileSync(path.join(brandingDir, 'BRANDING.md'), '', 'utf-8');
    const result = executeModule.buildBrandingContext(tmpDir);
    assert.equal(result, '', 'should return empty string for empty BRANDING.md');
  });

  it('reads from .planning/branding/BRANDING.md path (not .planning/BRANDING.md)', () => {
    // Put BRANDING.md at wrong path -- should NOT be found
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'BRANDING.md'), '# Wrong path', 'utf-8');
    const result = executeModule.buildBrandingContext(tmpDir);
    assert.equal(result, '', 'should not read from .planning/BRANDING.md');
  });
});
```

**2. enrichedPrepareSetContext branding tests:**

```javascript
describe('enrichedPrepareSetContext with branding', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createMockProject();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return brandingContext field', () => {
    const result = executeModule.enrichedPrepareSetContext(tmpDir, 'auth-core');
    assert.ok('brandingContext' in result, 'should have brandingContext field');
    assert.ok(typeof result.brandingContext === 'string', 'brandingContext should be a string');
  });

  it('should include branding context when BRANDING.md exists', () => {
    addBrandingContext(tmpDir);
    const result = executeModule.enrichedPrepareSetContext(tmpDir, 'auth-core');
    assert.ok(result.brandingContext.length > 0, 'brandingContext should be non-empty');
    assert.ok(result.brandingContext.includes('Branding Context'), 'should include section header');
  });

  it('should return empty brandingContext when no branding files exist', () => {
    const result = executeModule.enrichedPrepareSetContext(tmpDir, 'auth-core');
    assert.equal(result.brandingContext, '', 'brandingContext should be empty string');
  });

  it('should not modify existing prepareSetContext fields when branding is added', () => {
    addBrandingContext(tmpDir);
    const baseResult = executeModule.prepareSetContext(tmpDir, 'auth-core');
    const enrichedResult = executeModule.enrichedPrepareSetContext(tmpDir, 'auth-core');
    assert.equal(enrichedResult.setName, baseResult.setName, 'setName should match');
    assert.equal(enrichedResult.definition, baseResult.definition, 'definition should match');
    assert.equal(enrichedResult.contractStr, baseResult.contractStr, 'contractStr should match');
  });
});
```

**3. assembleExecutorPrompt branding injection tests:**

```javascript
describe('assembleExecutorPrompt with branding context', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createMockProject();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should inject branding context in discuss phase prompt', () => {
    addBrandingContext(tmpDir);
    const prompt = executeModule.assembleExecutorPrompt(tmpDir, 'auth-core', 'discuss');
    assert.ok(prompt.includes('## Branding Context'), 'discuss phase should contain Branding Context');
    assert.ok(prompt.includes('Project Identity'), 'discuss phase should include branding content');
  });

  it('should inject branding context in plan phase prompt', () => {
    addBrandingContext(tmpDir);
    const prompt = executeModule.assembleExecutorPrompt(tmpDir, 'auth-core', 'plan');
    assert.ok(prompt.includes('## Branding Context'), 'plan phase should contain Branding Context');
  });

  it('should inject branding context in execute phase prompt', () => {
    addBrandingContext(tmpDir);
    const prompt = executeModule.assembleExecutorPrompt(tmpDir, 'auth-core', 'execute');
    assert.ok(prompt.includes('## Branding Context'), 'execute phase should contain Branding Context');
  });

  it('should gracefully skip branding context when BRANDING.md does not exist', () => {
    // No addBrandingContext call
    let prompt;
    assert.doesNotThrow(() => {
      prompt = executeModule.assembleExecutorPrompt(tmpDir, 'auth-core', 'execute');
    }, 'should not throw when BRANDING.md is absent');
    assert.ok(typeof prompt === 'string', 'should still return a valid prompt string');
    assert.ok(!prompt.includes('## Branding Context'), 'should NOT include Branding Context when absent');
  });

  it('should place branding context after quality context in execute phase', () => {
    addBrandingContext(tmpDir);
    addQualityContext(tmpDir);
    const prompt = executeModule.assembleExecutorPrompt(tmpDir, 'auth-core', 'execute');

    const qualIdx = prompt.indexOf('## Quality Context');
    const brandIdx = prompt.indexOf('## Branding Context');
    const implIdx = prompt.indexOf('## Implementation Plan');

    assert.ok(qualIdx !== -1, 'should have Quality Context');
    assert.ok(brandIdx !== -1, 'should have Branding Context');
    assert.ok(implIdx !== -1, 'should have Implementation Plan');
    assert.ok(brandIdx > qualIdx, 'Branding Context should appear after Quality Context');
    assert.ok(brandIdx < implIdx, 'Branding Context should appear before Implementation Plan');
  });

  it('should place branding context after quality context in plan phase', () => {
    addBrandingContext(tmpDir);
    addQualityContext(tmpDir);
    const prompt = executeModule.assembleExecutorPrompt(tmpDir, 'auth-core', 'plan');

    const qualIdx = prompt.indexOf('## Quality Context');
    const brandIdx = prompt.indexOf('## Branding Context');

    if (qualIdx !== -1) {
      assert.ok(brandIdx > qualIdx, 'Branding Context should appear after Quality Context in plan phase');
    }
  });

  it('should include scope instructions in branding context', () => {
    addBrandingContext(tmpDir);
    const prompt = executeModule.assembleExecutorPrompt(tmpDir, 'auth-core', 'execute');
    assert.ok(
      prompt.includes('Do NOT apply branding to commit messages'),
      'should include anti-application guidance in branding context'
    );
  });
});
```

**What NOT to do:**
- Do NOT modify any existing tests
- Do NOT remove the existing `addQualityContext` helper
- Do NOT add tests that require a real git repo for branding (branding tests only need the mock project filesystem)

**Verification:**
```bash
cd /home/kek/Projects/RAPID
node --test src/lib/execute.test.cjs
```
All tests must pass, including all new branding tests and all pre-existing tests.

**Commit:** `test(branding-system): add comprehensive branding context injection tests`

---

## Success Criteria

1. `display.cjs` has `'branding'` entries in both `STAGE_VERBS` and `STAGE_BG`
2. `display.test.cjs` tests pass with all 16 stages (including scaffold and branding)
3. `execute.cjs` exports `buildBrandingContext(cwd)` function
4. `buildBrandingContext()` reads from `.planning/branding/BRANDING.md` and returns empty string when absent
5. `enrichedPrepareSetContext()` returns `brandingContext` field
6. `assembleExecutorPrompt()` injects branding in ALL 3 phases (discuss, plan, execute)
7. All existing tests continue to pass (no regressions)
8. New branding tests cover: present/absent BRANDING.md, correct path, ordering relative to quality context, scope instructions
9. `node --test src/lib/display.test.cjs` passes
10. `node --test src/lib/execute.test.cjs` passes
