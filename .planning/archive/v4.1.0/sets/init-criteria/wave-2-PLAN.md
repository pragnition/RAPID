# Wave 2 PLAN: Verifier Criteria Coverage Report and Tests

## Objective

Extend `verify.cjs` with functions to parse encoded criteria from REQUIREMENTS.md and generate a criteria coverage report section in verification reports. Add comprehensive tests in `verify.test.cjs`.

## Owned Files

| File | Action |
|------|--------|
| `src/lib/verify.cjs` | Modify (add two new functions, update report generator) |
| `src/lib/verify.test.cjs` | Modify (add test suites for new functions) |

## Task 1: Add `parseCriteriaFromRequirements()` to verify.cjs

**File:** `src/lib/verify.cjs`

**Add a new function** after the `verifyHeavy` function (after line 98) and before `generateVerificationReport`:

```
parseCriteriaFromRequirements(requirementsPath)
```

**Behavior:**
1. Accept a file path to REQUIREMENTS.md.
2. If the file does not exist, return `{ criteria: [], warning: 'REQUIREMENTS.md not found' }`.
3. Read the file content. Parse each line looking for the pattern `/^- \[[ x]\] ([A-Z]+-\d{3}): (.+)$/` (supports both checked and unchecked checkboxes).
4. For each match, extract: `{ id: 'FUNC-001', description: 'User can log in', checked: true/false }`.
5. If zero criteria match but the file has content (> 50 chars), return `{ criteria: [], warning: 'No encoded criteria found. Consider re-running /rapid:init to generate encoded criteria with CATEGORY-NNN format.' }`.
6. If zero criteria and file is empty/short, return `{ criteria: [], warning: null }`.
7. Return `{ criteria: [...], warning: null }` on success.

**Do NOT:**
- Throw errors on malformed files -- always return a result object.
- Modify any existing functions.

**Verification:**
```bash
node -e "const v = require('./src/lib/verify.cjs'); console.log(typeof v.parseCriteriaFromRequirements)"
# Should print: function
```

## Task 2: Add `generateCriteriaCoverageReport()` to verify.cjs

**File:** `src/lib/verify.cjs`

**Add a new function** after `parseCriteriaFromRequirements`:

```
generateCriteriaCoverageReport(requirementsPath, planPaths)
```

**Behavior:**
1. Call `parseCriteriaFromRequirements(requirementsPath)` to get the criteria list.
2. If there is a warning (no criteria found), return a Markdown section with the warning message.
3. For each plan file path in `planPaths`, read the file content and search for occurrences of each criterion ID (e.g., `FUNC-001`). A criterion is "covered" if its ID appears in at least one plan file.
4. Build a Markdown section:

```markdown
## Criteria Coverage

| ID | Description | Covered | Plan(s) |
|----|-------------|---------|---------|
| FUNC-001 | User can log in | Yes | wave-1-PLAN.md |
| FUNC-002 | Password reset | No | - |

**Coverage:** 1/2 (50%)

### Uncovered Criteria
- FUNC-002: Password reset
```

5. If all criteria are covered, omit the "Uncovered Criteria" subsection.
6. If `planPaths` is empty or undefined, mark all criteria as uncovered with plan column showing "-".

**Parameters:**
- `requirementsPath` (string): Absolute path to REQUIREMENTS.md
- `planPaths` (string[], optional): Array of absolute paths to PLAN.md files to scan for criterion ID references

**Returns:** A string containing the Markdown section (starting with `## Criteria Coverage`).

**Do NOT:**
- Throw errors if plan files don't exist -- skip missing files silently.
- Modify any existing functions.

**Verification:**
```bash
node -e "const v = require('./src/lib/verify.cjs'); console.log(typeof v.generateCriteriaCoverageReport)"
# Should print: function
```

## Task 3: Integrate criteria coverage into `generateVerificationReport()`

**File:** `src/lib/verify.cjs`

**Current signature (line 107):**
```javascript
function generateVerificationReport(results, tier)
```

**Required change:**
Add an optional third parameter `options`:
```javascript
function generateVerificationReport(results, tier, options = {})
```

Where `options` may contain:
- `requirementsPath` (string, optional): Path to REQUIREMENTS.md
- `planPaths` (string[], optional): Paths to plan files

**Behavior change:**
After the existing `**Result:** PASS/FAIL` line (line 155) and before the final `return`, if `options.requirementsPath` is provided:
1. Call `generateCriteriaCoverageReport(options.requirementsPath, options.planPaths || [])`.
2. Append the returned Markdown section to the report lines.

This is backward-compatible -- existing callers that pass only two arguments get the same report as before.

**Verification:**
```bash
# Existing tests should still pass (no breaking change)
node --test src/lib/verify.test.cjs
```

## Task 4: Update module.exports

**File:** `src/lib/verify.cjs`

Add `parseCriteriaFromRequirements` and `generateCriteriaCoverageReport` to the `module.exports` object on line 161.

**Current:**
```javascript
module.exports = { verifyLight, verifyHeavy, generateVerificationReport };
```

**New:**
```javascript
module.exports = { verifyLight, verifyHeavy, generateVerificationReport, parseCriteriaFromRequirements, generateCriteriaCoverageReport };
```

## Task 5: Add tests for `parseCriteriaFromRequirements`

**File:** `src/lib/verify.test.cjs`

Add a new `describe('parseCriteriaFromRequirements', ...)` block after the existing test suites. Import the new function at line 8.

**Test cases:**

1. **Valid encoded criteria** -- File with 3 encoded criteria (FUNC-001, FUNC-002, UIUX-001). Verify all three are parsed with correct id, description, and checked status.

2. **Mixed checked and unchecked** -- File with `- [x] FUNC-001: done thing` and `- [ ] FUNC-002: pending thing`. Verify checked values are correct (true/false).

3. **Old-format freeform file (no encoded IDs)** -- File with > 50 chars of prose criteria but no CATEGORY-NNN pattern. Verify `criteria` is empty and `warning` contains the suggestion to re-run init.

4. **Empty/missing file** -- Non-existent path. Verify `criteria` is empty and `warning` says "REQUIREMENTS.md not found".

5. **File with mixed encoded and freeform lines** -- Some lines match the pattern, some don't. Verify only matching lines are returned as criteria; non-matching lines are silently ignored.

**Setup:** Use the existing `createTempFile` helper. Write test REQUIREMENTS.md content to temp files.

## Task 6: Add tests for `generateCriteriaCoverageReport`

**File:** `src/lib/verify.test.cjs`

Add a new `describe('generateCriteriaCoverageReport', ...)` block.

**Test cases:**

1. **Full coverage** -- REQUIREMENTS.md has FUNC-001 and FUNC-002. Plan file mentions both IDs. Verify report shows 2/2 (100%) and no "Uncovered Criteria" section.

2. **Partial coverage** -- REQUIREMENTS.md has FUNC-001 and FUNC-002. Plan file only mentions FUNC-001. Verify report shows 1/2 (50%) and lists FUNC-002 under "Uncovered Criteria".

3. **No plan files** -- REQUIREMENTS.md has criteria but planPaths is empty. Verify all criteria are marked uncovered.

4. **No encoded criteria (warning path)** -- REQUIREMENTS.md has freeform content. Verify the returned section contains the warning message about re-running init.

5. **Missing REQUIREMENTS.md** -- Non-existent path. Verify the returned section contains the "not found" warning.

**Setup:** Use temp files for both REQUIREMENTS.md and plan files. Plan files can be simple text files containing criterion IDs.

## Task 7: Verify backward compatibility

**Verification commands (run in sequence):**

```bash
# All existing tests pass
node --test src/lib/verify.test.cjs

# New functions are exported
node -e "const v = require('./src/lib/verify.cjs'); console.log(Object.keys(v).sort().join(', '))"
# Expected: generateCriteriaCoverageReport, generateVerificationReport, parseCriteriaFromRequirements, verifyHeavy, verifyLight

# Existing report generation still works without options
node -e "
const v = require('./src/lib/verify.cjs');
const r = v.generateVerificationReport({ passed: [{type:'x',target:'y'}], failed: [] }, 'light');
console.log(r.includes('**Result:** PASS') ? 'PASS' : 'FAIL');
"
# Expected: PASS
```

## Success Criteria

1. `parseCriteriaFromRequirements()` correctly parses encoded criteria and returns warnings for old-format or missing files.
2. `generateCriteriaCoverageReport()` produces a Markdown table mapping criteria to plans and reports coverage percentage.
3. `generateVerificationReport()` accepts optional `options` parameter and appends criteria coverage when `requirementsPath` is provided.
4. All existing verify.test.cjs tests still pass (backward compatibility).
5. All new test cases pass: `node --test src/lib/verify.test.cjs` exits 0.
6. New functions are exported from the module.
