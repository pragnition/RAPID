# PLAN: review-state / wave-1

## Objective

Define the ReviewState Zod schema, implement read/write/markStageComplete functions with atomic writes, add prerequisite enforcement logic, and write comprehensive unit tests. This wave builds the complete library layer so wave-2 can wire it into the CLI and skills without any library changes.

## Owned Files

| File | Action |
|------|--------|
| `src/lib/review.cjs` | Extend |
| `src/lib/review.test.cjs` | Extend |

## Task 1: Define ReviewState Zod Schema

**File:** `src/lib/review.cjs`

Insert the following schemas after the `ReviewIssues` schema (after line 79), before the `// Scoping Functions` section comment:

### 1a: ReviewStageSchema

Define a Zod schema `ReviewStageSchema` with:
- `completed`: `z.boolean()`
- `verdict`: `z.enum(['pass', 'fail', 'partial'])`

### 1b: ReviewStateSchema

Define a Zod schema `ReviewStateSchema` with:
- `setId`: `z.string()`
- `stages`: `z.object()` with four optional stage fields:
  - `scope`: `ReviewStageSchema.optional()`
  - `'unit-test'`: `ReviewStageSchema.optional()` (use z.object().optional() for hyphenated key -- quote the key in the z.object definition)
  - `'bug-hunt'`: `ReviewStageSchema.optional()`
  - `uat`: `ReviewStageSchema.optional()`
- `lastUpdatedAt`: `z.string()`

### 1c: REVIEW_STAGES constant

Define a constant array `REVIEW_STAGES = ['scope', 'unit-test', 'bug-hunt', 'uat']` for iteration and validation.

**Verification:**
```bash
node -e "const r = require('./src/lib/review.cjs'); console.log(typeof r.ReviewStateSchema, typeof r.ReviewStageSchema, r.REVIEW_STAGES)"
```

## Task 2: Implement readReviewState and writeReviewState

**File:** `src/lib/review.cjs`

Insert these functions before the `module.exports` block (before line 1064). Follow the `readMergeState`/`writeMergeState` pattern from `src/lib/merge.cjs`.

### 2a: readReviewState(cwd, setId)

- Construct path: `path.join(cwd, '.planning', 'sets', setId, 'REVIEW-STATE.json')`
- Try to read and parse with `ReviewStateSchema.parse(JSON.parse(raw))`
- On any error (file missing, invalid JSON, schema validation failure): return `null`
- Do NOT throw

### 2b: writeReviewState(cwd, setId, state)

- Validate with `ReviewStateSchema.parse(state)` (throws on invalid)
- Write atomically: write to `statePath + '.tmp'`, then `fs.renameSync(tmpPath, statePath)`
- Ensure parent directory exists with `fs.mkdirSync(dirname, { recursive: true })`

**Verification:**
```bash
node -e "const r = require('./src/lib/review.cjs'); console.log(typeof r.readReviewState, typeof r.writeReviewState)"
```

## Task 3: Implement markStageComplete

**File:** `src/lib/review.cjs`

### 3a: markStageComplete(cwd, setId, stage, verdict)

- Validate `stage` is in `REVIEW_STAGES`, throw if not
- Validate `verdict` is one of `'pass' | 'fail' | 'partial'`, throw if not
- Call `readReviewState(cwd, setId)` to get current state
- If null (no state file exists), create a fresh state object: `{ setId, stages: {}, lastUpdatedAt: new Date().toISOString() }`
- **Prerequisite enforcement** (call `checkStagePrerequisites` from Task 4 -- if it throws, propagate the error)
- Set `state.stages[stage] = { completed: true, verdict }`
- Update `state.lastUpdatedAt = new Date().toISOString()`
- Call `writeReviewState(cwd, setId, state)`
- Return the updated state

**What NOT to do:**
- Do not add locking -- review is single-writer per set
- Do not add re-entry logic here -- that belongs in the skill layer (wave 2)

## Task 4: Implement checkStagePrerequisites

**File:** `src/lib/review.cjs`

### 4a: checkStagePrerequisites(state, stage)

This is a pure function (no I/O). It receives the current ReviewState object (never null -- caller creates a fresh one if needed) and the stage about to be marked complete. It throws with a descriptive error if prerequisites are not met.

**Rules:**
- `scope`: No prerequisites (always allowed)
- `unit-test`: Requires `scope` stage to be completed. Error: `"Cannot run unit-test: scope stage has not been completed. Run /rapid:review <set-id> first."`
- `bug-hunt`: Requires `scope` stage to be completed. Error: `"Cannot run bug-hunt: scope stage has not been completed. Run /rapid:review <set-id> first."`
- `uat`: Requires BOTH `scope` AND `unit-test` stages to be completed. Error for missing scope: `"Cannot run uat: scope stage has not been completed. Run /rapid:review <set-id> first."` Error for missing unit-test: `"Cannot run uat: unit-test stage has not been completed. Run /rapid:unit-test <set-id> first."`

**What NOT to do:**
- Do not require bug-hunt before uat -- bug-hunt and unit-test are independent after scope
- Do not check verdict values -- a completed stage satisfies prerequisites regardless of pass/fail/partial

## Task 5: Update module.exports

**File:** `src/lib/review.cjs`

Add the following to the `module.exports` block, in a new section after `// Constants`:

```javascript
  // Review state
  ReviewStageSchema,
  ReviewStateSchema,
  REVIEW_STAGES,
  readReviewState,
  writeReviewState,
  markStageComplete,
  checkStagePrerequisites,
```

## Task 6: Write Unit Tests

**File:** `src/lib/review.test.cjs`

Add the following test groups at the end of the file, importing the new exports. Use the same `makeTmpDir`/`rmDir` helpers already in the file.

### 6a: ReviewStateSchema validation tests

```
describe('ReviewStateSchema', () => {
  it('validates a complete review state');        // all 4 stages present
  it('validates a partial review state');          // only scope completed
  it('rejects invalid verdict');                   // verdict: 'unknown' should fail
  it('rejects missing setId');                     // setId omitted should fail
});
```

### 6b: readReviewState / writeReviewState roundtrip tests

```
describe('readReviewState', () => {
  it('returns null when no REVIEW-STATE.json exists');
  it('returns null for invalid JSON');
  it('roundtrips valid state through write then read');
});
```

For the roundtrip test:
- Create a tmpDir with `.planning/sets/test-set/` directory
- Write a valid state with `writeReviewState`
- Read it back with `readReviewState`
- Assert deep equality on all fields

### 6c: writeReviewState atomic write test

```
describe('writeReviewState atomic write', () => {
  it('does not leave .tmp file after successful write');
  it('creates parent directories if missing');
});
```

### 6d: markStageComplete tests

```
describe('markStageComplete', () => {
  it('creates state from scratch when marking scope');
  it('marks unit-test after scope is complete');
  it('marks bug-hunt after scope without requiring unit-test');
  it('marks uat after scope and unit-test are complete');
});
```

### 6e: checkStagePrerequisites tests

```
describe('checkStagePrerequisites', () => {
  it('allows scope with empty state');
  it('blocks unit-test without scope');
  it('blocks bug-hunt without scope');
  it('blocks uat without scope');
  it('blocks uat without unit-test even if scope complete');
  it('allows uat when scope and unit-test complete');
  it('allows bug-hunt without unit-test when scope complete');
});
```

**Verification:**
```bash
node --test src/lib/review.test.cjs
```

All tests must pass.

## Success Criteria

1. `ReviewStageSchema` and `ReviewStateSchema` validate correctly with roundtrip tests
2. `readReviewState` returns `null` for missing/invalid files, parsed state for valid files
3. `writeReviewState` uses temp-file-then-rename atomic pattern, no `.tmp` residue
4. `markStageComplete` creates state from scratch on first call (scope), updates existing state on subsequent calls
5. `checkStagePrerequisites` enforces: scope before all; unit-test before uat; bug-hunt independent of unit-test
6. All new and existing tests pass: `node --test src/lib/review.test.cjs`
