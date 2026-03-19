# Wave 2 PLAN: Context Building & Quality Gates

## Objective

Implement the two remaining public functions in `quality.cjs`: `buildQualityContext()` for token-budgeted prompt injection and `checkQualityGates()` for advisory-only pattern violation detection. These functions depend on the `loadQualityProfile()` and parsing infrastructure from wave 1. Add comprehensive unit tests for both functions, including token budget enforcement, graceful degradation when memory-system is unavailable, and the non-destructive behavioral invariant for quality gates.

## File Ownership

| File | Action |
|------|--------|
| `src/lib/quality.cjs` | **Modify** (add buildQualityContext, checkQualityGates) |
| `src/lib/quality.test.cjs` | **Modify** (add test groups for wave 2 functions) |

---

## Task 1: Implement `buildQualityContext()` in `quality.cjs`

### What to implement

Add the `buildQualityContext` function and its helpers to `src/lib/quality.cjs`. This function builds a token-budgeted markdown string containing quality guidelines and approved patterns for injection into agent prompts.

**New require (add to top of file):**

```javascript
const { estimateTokens } = require('./tool-docs.cjs');
```

**Internal helpers to add:**

1. `_loadPatternsMd(cwd)` -- Read `.planning/context/PATTERNS.md` if it exists and return its content as a string. If the file does not exist, return empty string. Do NOT call `loadQualityProfile` here (that would trigger generation) -- just read the file directly.

2. `_tryQueryDecisions(cwd)` -- Attempt to load `memory.cjs` and call `queryDecisions(cwd, { category: 'convention', limit: 20 })`. Wrap in try/catch. If memory module is unavailable or throws, return empty array `[]`. This implements the soft dependency on memory-system.

3. `_formatDecisionsSection(decisions)` -- Format an array of decision entries into a markdown section string. Each decision becomes a bullet point: `- [category/topic] decision (rationale)`. If the array is empty, return empty string (not a section header with no content).

4. `_truncateToTokenBudget(text, budget)` -- If `estimateTokens(text)` exceeds `budget`, truncate the text. Strategy: split by `\n`, accumulate lines until adding the next line would exceed the budget, then append `\n\n[...truncated to fit token budget]` and return. If the text is within budget, return it unchanged.

**Public API to add:**

`buildQualityContext(cwd, setName, tokenBudget)` -- Build token-budgeted quality context string for agent prompt injection.

Logic:
1. Default `tokenBudget` to `DEFAULT_TOKEN_BUDGET` (10000) if not provided
2. Call `loadQualityProfile(cwd)` to get the parsed profile
3. Call `_loadPatternsMd(cwd)` to get the patterns content
4. Call `_tryQueryDecisions(cwd)` to get convention decisions
5. Build the context markdown string with this structure:

```markdown
## Quality Context

### Quality Guidelines
[Content from profile.raw -- the full QUALITY.md content]

### Pattern Library
[Content from PATTERNS.md]

### Convention Decisions
[Formatted decisions from memory-system, or omitted if empty]
```

6. Call `_truncateToTokenBudget(assembled, tokenBudget)` on the final string
7. If the profile has no content and no patterns and no decisions, return empty string (not a section with empty subsections)
8. Return the token-budgeted string

**Add to `module.exports`:** `buildQualityContext`

### What NOT to do
- Do NOT modify `loadQualityProfile` behavior from wave 1
- Do NOT import memory.cjs at module top level -- import inside `_tryQueryDecisions` only (lazy require pattern)
- Do NOT exceed the token budget -- always truncate before returning
- Do NOT implement `checkQualityGates` in this task -- that is task 2

### Files to modify
- `src/lib/quality.cjs`

### Verification
```bash
node -e "const q = require('./src/lib/quality.cjs'); console.log(typeof q.buildQualityContext);"
# Should output: function
```

---

## Task 2: Implement `checkQualityGates()` in `quality.cjs`

### What to implement

Add the `checkQualityGates` function to `src/lib/quality.cjs`. This function checks agent output artifacts against the quality profile and reports violations. It is advisory-only -- it never blocks execution or modifies output.

**Internal helpers to add:**

1. `_checkFileAgainstPatterns(filePath, content, antiPatterns)` -- Check a single file's content against anti-pattern rules. For each anti-pattern string in the `antiPatterns` object (all categories), do a case-insensitive search in the file content. If found, create a violation entry. Return an array of violation objects.

   Violation object shape:
   ```javascript
   {
     rule: 'anti-pattern description string',
     file: filePath,
     line: lineNumber || null,  // line number where pattern was found, or null
     severity: 'warning',       // always 'warning' for v1
     message: 'Found anti-pattern: <pattern> in <file>',
     confidence: 'low',         // 'low' | 'medium' | 'high' -- use 'low' for simple string matching
   }
   ```

   Line detection: split content by `\n`, iterate lines, check each line against each anti-pattern. Record the 1-based line number of the first match. If the anti-pattern is a multi-word phrase, check if the line includes the phrase (case-insensitive).

2. `_logViolationsToStderr(violations)` -- Write human-readable violation warnings to stderr using `process.stderr.write()`. Format each violation as:
   ```
   [RAPID QUALITY] warning: <message> (<file>:<line>)
   ```
   If `line` is null, omit the `:<line>` suffix.

**Public API to add:**

`checkQualityGates(cwd, setName, artifacts)` -- Verify agent output against quality profile.

Parameters:
- `cwd` (string) -- Project root directory
- `setName` (string) -- Current set name (for context, used in logging)
- `artifacts` (string[]) -- Array of absolute file paths to check

Logic:
1. Call `loadQualityProfile(cwd)` to get the profile
2. If profile has no anti-patterns (all arrays empty), return `{ passed: true, violations: [] }`
3. For each artifact path in `artifacts`:
   - Check if the file exists; skip if not (do not throw)
   - Read the file content
   - Call `_checkFileAgainstPatterns(artifactPath, content, profile.antiPatterns)`
   - Collect all violations
4. Call `_logViolationsToStderr(allViolations)` if there are any violations
5. Return `{ passed: allViolations.length === 0, violations: allViolations }`

**Add to `module.exports`:** `checkQualityGates`

**Behavioral invariants (enforced by tests in task 3):**
- NEVER throw an error -- wrap entire function body in try/catch, return `{ passed: true, violations: [] }` on error
- NEVER modify any files
- NEVER block execution -- return synchronously
- Log violations to stderr only (not stdout)

### What NOT to do
- Do NOT use regex for anti-pattern matching in v1 -- use simple string `includes()` (case-insensitive via `.toLowerCase()`)
- Do NOT attempt to parse ASTs or understand code structure -- this is text-level matching only
- Do NOT block on violations -- this is advisory only
- Do NOT write to stdout -- violations go to stderr only

### Files to modify
- `src/lib/quality.cjs`

### Verification
```bash
node -e "const q = require('./src/lib/quality.cjs'); console.log(typeof q.checkQualityGates);"
# Should output: function
```

---

## Task 3: Add comprehensive unit tests for `buildQualityContext` and `checkQualityGates`

### What to implement

Extend `src/lib/quality.test.cjs` with new test groups for the wave 2 functions. Add to the existing file -- do not overwrite wave 1 tests.

**Test groups to add:**

### `describe('buildQualityContext')`

1. `it('should return a string containing Quality Context header')` -- Call `buildQualityContext` on a tmpdir, verify the result includes `## Quality Context`.

2. `it('should include quality guidelines from QUALITY.md')` -- Write a custom QUALITY.md with a known pattern like "Always use error boundaries", call buildQualityContext, verify the output contains that pattern.

3. `it('should include pattern library from PATTERNS.md')` -- Write a custom PATTERNS.md with known content, call buildQualityContext, verify the output contains it.

4. `it('should respect token budget and truncate when exceeded')` -- Write a very large QUALITY.md (repeat content to exceed 10000 tokens worth of text, i.e., more than 40000 characters). Call `buildQualityContext(cwd, 'test-set', 1000)` with a small budget of 1000 tokens. Verify:
   - The result contains the truncation marker `[...truncated to fit token budget]`
   - `estimateTokens(result) <= 1000` (or very close -- within ~50 tokens due to truncation marker)

5. `it('should use default token budget of 10000 when not specified')` -- Call `buildQualityContext(cwd, 'test-set')` without the third argument. Write content that is within 10000 tokens. Verify no truncation marker appears.

6. `it('should return empty string when no quality content exists')` -- Call on a tmpdir with no QUALITY.md and no PATTERNS.md. Since loadQualityProfile generates defaults, this test should verify that the default content IS included. Alternatively, test with an empty QUALITY.md that produces empty arrays.

7. `it('should gracefully handle missing memory-system (queryDecisions)')` -- Call buildQualityContext on a tmpdir where memory.cjs queryDecisions would return empty (no .planning/memory/ directory). Verify no errors thrown and result does not include a Convention Decisions section (or includes it as empty).

8. `it('should include convention decisions when available')` -- Create `.planning/memory/DECISIONS.jsonl` in tmpdir with a convention-category decision. Call buildQualityContext, verify the decision text appears in the output.

### `describe('checkQualityGates')`

9. `it('should return passed: true when no anti-patterns defined')` -- Write a QUALITY.md with approved patterns only (no ## Anti-Patterns section). Create a test file. Call checkQualityGates. Verify `result.passed === true` and `result.violations.length === 0`.

10. `it('should detect anti-pattern violation in artifact file')` -- Write a QUALITY.md with anti-pattern "eval()" and create a test file containing `eval('code')`. Call checkQualityGates. Verify `result.passed === false` and `result.violations.length >= 1`. Verify the violation has `rule`, `file`, `severity`, `message`, and `confidence` fields.

11. `it('should return passed: true when artifacts do not contain anti-patterns')` -- Write a QUALITY.md with anti-pattern "eval()" and create a test file that does NOT contain eval. Verify `result.passed === true`.

12. `it('should skip non-existent artifact files without error')` -- Call checkQualityGates with an artifact path that does not exist. Verify no error thrown and `result.passed === true`.

13. `it('should include line number in violation when detectable')` -- Create a multi-line file where the anti-pattern appears on a specific line. Verify the violation's `line` field matches the expected line number (1-based).

14. `it('should handle multiple anti-patterns across multiple files')` -- Create two test files and two anti-patterns. Verify all violations are collected.

15. `it('should never throw even on read errors')` -- Pass an artifact path to a directory (not a file) or a binary file. Verify the function returns `{ passed: true, violations: [] }` without throwing.

16. `it('should set severity to warning for all violations')` -- Verify every violation in the result has `severity === 'warning'`.

17. `it('violations are advisory only -- function does not modify files')` -- Create a test file, record its content and mtime before calling checkQualityGates, then verify content and mtime are unchanged after the call (nonDestructive behavioral invariant).

### Files to modify
- `src/lib/quality.test.cjs`

### Verification
```bash
node --test src/lib/quality.test.cjs
# All tests (wave 1 + wave 2) should pass
```

---

## Success Criteria

1. `node --test src/lib/quality.test.cjs` passes all tests (wave 1 and wave 2, 0 failures)
2. `buildQualityContext()` produces token-budgeted output that never exceeds the specified budget
3. `buildQualityContext()` gracefully degrades when memory-system `queryDecisions` is unavailable
4. `checkQualityGates()` detects anti-pattern violations and reports them with structured violation objects
5. `checkQualityGates()` logs violations to stderr, never to stdout
6. `checkQualityGates()` never throws, never modifies files, never blocks execution (all three behavioral invariants)
7. No files outside of `src/lib/quality.cjs` and `src/lib/quality.test.cjs` are modified
