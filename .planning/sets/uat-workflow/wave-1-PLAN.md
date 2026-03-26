# PLAN: uat-workflow / Wave 1

## Objective

Define the UAT-FAILURES.md format contract and lock it with unit tests. This wave produces no user-facing behavior changes -- it establishes the data format that the `bugfix-uat` set depends on, and validates round-trip parsing via automated tests.

## Owned Files

| File | Action |
|------|--------|
| skills/uat/uat-failures.test.cjs | Create |

## Tasks

### Task 1: Create UAT-FAILURES.md format parser tests

**File:** `skills/uat/uat-failures.test.cjs`
**Action:** Create new test file following the `node:test` + `node:assert/strict` pattern used by `skills/branding/SKILL.test.cjs`.

The test file validates the UAT-FAILURES.md embedded JSON format contract. It does NOT read from disk -- it tests the format specification by constructing sample content strings and parsing them.

**Test cases to implement (using `describe`/`it` from `node:test`):**

1. **`round-trip: minimal failure entry`** -- Construct a UAT-FAILURES.md string containing a `<!-- UAT-FAILURES-META {...} -->` HTML comment with a JSON object whose `failures` array has one entry with all CONTRACT.json minimum fields (`id`, `criterion`, `step`, `description`, `severity`, `relevantFiles`). Extract the JSON block using regex `<!-- UAT-FAILURES-META ([\s\S]*?) -->`, parse with `JSON.parse()`, and assert all fields are present and correctly typed.

2. **`round-trip: rich failure entry with extended fields`** -- Same as above but include the extended fields from CONTEXT.md decisions: `userNotes`, `expectedBehavior`, `actualBehavior`. Assert these fields survive round-trip.

3. **`round-trip: multiple failures`** -- Construct content with 3 failure entries in the `failures` array. Parse and assert `failures.length === 3`. Assert each entry has a unique `id`.

4. **`format: version marker present`** -- Assert the constructed content includes `<!-- UAT-FORMAT:v2 -->` version marker string.

5. **`format: markdown body mirrors JSON failures`** -- For each failure in the JSON block, assert the markdown body contains the failure's `id` and `description` as human-readable text (i.e., the note appears both in JSON and in markdown prose per CONTEXT.md decision "Both JSON metadata and markdown body").

6. **`parse: malformed JSON throws`** -- Construct content with invalid JSON inside the `<!-- UAT-FAILURES-META ... -->` block. Assert that `JSON.parse()` throws (i.e., the contract requires valid JSON).

7. **`parse: missing required field detected`** -- Construct content where one failure entry is missing the `severity` field. After parsing, assert that `entry.severity === undefined` (demonstrating downstream consumers can detect missing fields).

8. **`format: empty failures array`** -- Construct content with `{"failures":[]}`. Parse and assert `failures.length === 0`. This represents a UAT run with no failures.

**Helper function** (defined at top of file, not exported):

```javascript
function buildUatFailuresMd(failures) {
  const meta = JSON.stringify({ failures }, null, 2);
  const failuresSections = failures.map(f =>
    `### ${f.id}: ${f.criterion}\n- **Step:** ${f.step}\n- **Severity:** ${f.severity || 'unknown'}\n- **Description:** ${f.description}\n${f.userNotes ? `- **User Notes:** ${f.userNotes}\n` : ''}`
  ).join('\n');
  return [
    '# UAT-FAILURES',
    '',
    '<!-- UAT-FORMAT:v2 -->',
    '',
    `<!-- UAT-FAILURES-META ${meta} -->`,
    '',
    '## Failures',
    '',
    failuresSections || '_No failures recorded._',
    ''
  ].join('\n');
}
```

This helper encodes the exact format specification. Downstream consumers (bugfix-uat) will use the same regex extraction pattern.

**Verification:**

```bash
node --test skills/uat/uat-failures.test.cjs
```

All 8 tests must pass.

## Success Criteria

- [ ] `skills/uat/uat-failures.test.cjs` exists and passes all 8 test cases via `node --test`
- [ ] Tests validate the `<!-- UAT-FAILURES-META {...} -->` extraction regex and `JSON.parse()` round-trip
- [ ] Tests validate the `<!-- UAT-FORMAT:v2 -->` version marker
- [ ] Tests validate both minimal (CONTRACT.json fields) and rich (extended fields) failure entries
- [ ] Tests validate the dual-storage decision (JSON block + markdown prose)

## What NOT To Do

- Do NOT modify `skills/uat/SKILL.md` in this wave -- that is Wave 2 work.
- Do NOT modify `src/modules/roles/role-uat.md` -- that is Wave 2 work.
- Do NOT create the actual UAT-FAILURES.md file -- it is produced at runtime by the skill. This wave only tests the format.
- Do NOT create a separate parser module -- the extraction logic is a regex one-liner that consumers inline. Keep it in the test helper only.
