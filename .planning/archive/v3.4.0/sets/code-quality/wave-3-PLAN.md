# Wave 3 PLAN: Integration -- Wire Quality Context into Execute Pipeline

## Objective

Integrate the quality module into the execution pipeline by wiring `buildQualityContext()` into `assembleExecutorPrompt()` in `execute.cjs` alongside the existing memory context injection. Create the `enrichedPrepareSetContext` wrapper function. Add integration tests that verify quality context appears in assembled prompts and that all existing execute tests continue to pass (regression safety).

## File Ownership

| File | Action |
|------|--------|
| `src/lib/execute.cjs` | **Modify** (add quality context injection) |
| `src/lib/execute.test.cjs` | **Modify** (add quality integration tests) |
| `src/commands/execute.cjs` | **Modify** (minor -- no functional changes needed unless CLI options added) |

---

## Task 1: Wire quality context injection into `assembleExecutorPrompt()` in `execute.cjs`

### What to implement

Modify `src/lib/execute.cjs` to inject quality context alongside memory context during the plan and execute phases.

**Step 1: Add quality context loading block**

After the existing memory context block (lines 138-147), add an identical pattern for quality context:

```javascript
// Load quality context for plan and execute phases
let qualityContext = '';
if (phase === 'plan' || phase === 'execute') {
  try {
    const quality = require('./quality.cjs');
    qualityContext = quality.buildQualityContext(cwd, setName);
  } catch {
    // Graceful -- skip quality if module not available or errors
  }
}
```

Key requirements:
- Use `require('./quality.cjs')` inside the if block (lazy require, same pattern as memory)
- Wrap in try/catch for graceful degradation
- Only load for `'plan'` and `'execute'` phases (NOT discuss)

**Step 2: Inject quality context in plan phase**

In the `case 'plan':` block, after the memory context injection at line 195:
```javascript
...(memoryContext ? ['', memoryContext] : []),
```

Add quality context injection immediately after:
```javascript
...(qualityContext ? ['', qualityContext] : []),
```

This places quality context after memory context, before the `## Instructions` section.

**Step 3: Inject quality context in execute phase**

In the `case 'execute':` block, after the memory context injection (lines 228-231):
```javascript
if (memoryContext) {
  parts.push('');
  parts.push(memoryContext);
}
```

Add quality context injection immediately after:
```javascript
if (qualityContext) {
  parts.push('');
  parts.push(qualityContext);
}
```

This places quality context after memory context, before the `## Implementation Plan` section.

### What NOT to do
- Do NOT modify `prepareSetContext()` -- quality context flows through `assembleExecutorPrompt()` only
- Do NOT modify the discuss phase -- quality context is only for plan and execute
- Do NOT add quality context to module-level requires -- use lazy require inside the if block
- Do NOT change any function signatures
- Do NOT modify any other behavior in `assembleExecutorPrompt()` (bleed check, compaction, etc.)

### Files to modify
- `src/lib/execute.cjs`

### Verification
```bash
node --test src/lib/execute.test.cjs
# All existing tests must still pass (regression check)
```

---

## Task 2: Create `enrichedPrepareSetContext` wrapper in `execute.cjs`

### What to implement

Add a new exported function `enrichedPrepareSetContext` to `src/lib/execute.cjs`. This is a wrapper around the existing `prepareSetContext` that appends quality + patterns sections to the context output. Per the research findings, this is a separate function (not a modification to `prepareSetContext`) to avoid breaking 4 existing tests.

**Implementation:**

```javascript
/**
 * Enhanced prepareSetContext that includes quality guidelines and pattern references.
 * Extends the existing prepareSetContext output with quality context sections.
 * This is a separate function to avoid breaking existing prepareSetContext callers.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Name of the set
 * @returns {{ scopedMd: string, definition: string, contractStr: string, setName: string, qualityContext: string }}
 */
function enrichedPrepareSetContext(cwd, setName) {
  const ctx = prepareSetContext(cwd, setName);

  let qualityContext = '';
  try {
    const quality = require('./quality.cjs');
    qualityContext = quality.buildQualityContext(cwd, setName);
  } catch {
    // Graceful -- quality context is optional
  }

  return {
    ...ctx,
    qualityContext,
  };
}
```

**Add to `module.exports`:** `enrichedPrepareSetContext`

Key requirements:
- Returns the same shape as `prepareSetContext` plus a `qualityContext` field
- Uses try/catch for graceful degradation
- Does NOT modify the original `prepareSetContext` function or its return value
- Lazy requires `quality.cjs` inside the try block

### Files to modify
- `src/lib/execute.cjs`

### Verification
```bash
node -e "const e = require('./src/lib/execute.cjs'); console.log(typeof e.enrichedPrepareSetContext);"
# Should output: function
```

---

## Task 3: Add integration tests for quality context injection

### What to implement

Extend `src/lib/execute.test.cjs` with new test groups that verify quality context is correctly injected into assembled prompts and that `enrichedPrepareSetContext` works correctly.

**Test setup requirement:** The existing `createMockProject()` helper creates a tmpdir with mock sets. For quality context tests, you need to additionally write a `.planning/context/QUALITY.md` file in the tmpdir with known content so the quality module has something to inject. Add a helper or extend `createMockProject()` output.

Helper to add (do not modify createMockProject itself -- call it then add files):

```javascript
function addQualityContext(tmpDir) {
  const contextDir = path.join(tmpDir, '.planning', 'context');
  fs.mkdirSync(contextDir, { recursive: true });

  fs.writeFileSync(path.join(contextDir, 'QUALITY.md'), [
    '# Quality Profile',
    '',
    '## Approved Patterns',
    '',
    '### General',
    '- Use descriptive variable names',
    '- Handle all error cases explicitly',
    '',
    '## Anti-Patterns',
    '',
    '### General',
    '- Avoid eval() in production code',
    '- Do not swallow errors silently',
  ].join('\n'), 'utf-8');

  fs.writeFileSync(path.join(contextDir, 'PATTERNS.md'), [
    '# Pattern Library',
    '',
    '## Error Handling',
    '',
    '### Approved',
    '- Wrap async operations in try/catch',
    '',
    '### Anti-Patterns',
    '- Never ignore promise rejections',
  ].join('\n'), 'utf-8');
}
```

**Test groups to add:**

### `describe('assembleExecutorPrompt with quality context')`

1. `it('should inject quality context in plan phase prompt')` -- Create mock project, add quality context, call `assembleExecutorPrompt(tmpDir, 'auth-core', 'plan')`. Verify the prompt contains `## Quality Context` and `Use descriptive variable names` (from QUALITY.md).

2. `it('should inject quality context in execute phase prompt')` -- Same setup, call with `'execute'` phase. Verify the prompt contains quality context content.

3. `it('should NOT inject quality context in discuss phase prompt')` -- Same setup, call with `'discuss'` phase. Verify the prompt does NOT contain `## Quality Context`.

4. `it('should place quality context after memory context in plan phase')` -- Call with `'plan'` phase. If both memory and quality context are present, verify quality context appears after memory context in the prompt string (use `indexOf` comparison).

5. `it('should place quality context after memory context in execute phase')` -- Same test for execute phase.

6. `it('should gracefully skip quality context when quality module errors')` -- This is implicitly tested by the existing tests (they run without quality.cjs failures). Verify all existing execute tests still pass (regression).

7. `it('should include quality context before Implementation Plan section in execute phase')` -- Call with execute phase, verify `## Quality Context` appears before `## Implementation Plan` in the output string.

### `describe('enrichedPrepareSetContext')`

8. `it('should return all fields from prepareSetContext plus qualityContext')` -- Call enrichedPrepareSetContext, verify result has `scopedMd`, `definition`, `contractStr`, `setName`, and `qualityContext` fields.

9. `it('should include quality context string when QUALITY.md exists')` -- Add quality context files, call enrichedPrepareSetContext, verify `qualityContext` is a non-empty string containing quality content.

10. `it('should return empty qualityContext when no quality files exist')` -- Call enrichedPrepareSetContext without adding quality files. Since loadQualityProfile generates defaults, verify qualityContext is either empty or contains default content.

11. `it('should not break when quality module is unavailable')` -- This is a graceful degradation test. Verify enrichedPrepareSetContext returns a valid result even if the quality module had an issue (covered by the try/catch).

### Files to modify
- `src/lib/execute.test.cjs`

### Verification
```bash
node --test src/lib/execute.test.cjs
# All tests (existing + new) should pass
```

---

## Task 4: Verify full regression -- all existing tests pass

### What to implement

This is a verification-only task. Run the full test suite to confirm nothing is broken.

### Verification
```bash
# Run quality module tests
node --test src/lib/quality.test.cjs

# Run execute module tests (existing + new)
node --test src/lib/execute.test.cjs

# Run memory module tests (should be unaffected)
node --test src/lib/memory.test.cjs

# Run all lib tests to verify no regressions
node --test src/lib/*.test.cjs
```

All test files must pass with 0 failures. If any existing tests fail, investigate and fix the root cause (the most likely issue would be the quality module lazy require path if it throws instead of being caught by try/catch).

---

## Success Criteria

1. `assembleExecutorPrompt()` injects quality context in plan and execute phases (not discuss)
2. Quality context appears after memory context and before Instructions/Implementation Plan sections
3. `enrichedPrepareSetContext()` returns all original fields plus `qualityContext`
4. All existing `execute.test.cjs` tests pass without modification (regression safety)
5. All new integration tests pass
6. `node --test src/lib/*.test.cjs` passes with 0 failures across all modules
7. Quality context injection uses the same graceful try/catch pattern as memory injection
8. No function signatures changed on existing functions
