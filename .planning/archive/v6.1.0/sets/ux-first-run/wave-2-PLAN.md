# Wave 2 PLAN: Fuzzy Command Matching

**Set:** ux-first-run
**Wave:** 2
**Objective:** Implement audit item 2.2 -- suggest the closest valid command when the user enters an unknown command in the CLI, using Levenshtein edit distance with no external dependencies.

**Files modified:** `src/bin/rapid-tools.cjs`
**Files NOT modified:** `skills/init/SKILL.md`, `skills/status/SKILL.md` (Wave 1 scope)
**Test file created:** `tests/fuzzy-match.test.cjs`

---

## Task 1: Implement Levenshtein Distance and Command Suggestion Functions

**File:** `src/bin/rapid-tools.cjs`
**Action:** Add two pure functions (`levenshteinDistance` and `suggestCommands`) above the `migrateStateVersion` function (before line 155), and export them via `module.exports`.

### Function 1: `levenshteinDistance(a, b)`

Computes the raw Levenshtein edit distance between two strings. Standard dynamic programming implementation using a 2D matrix (or optimized single-row approach).

**Signature:** `function levenshteinDistance(a, b)` -- returns an integer >= 0.

**Behavior:**
- `levenshteinDistance('', '')` -> 0
- `levenshteinDistance('abc', 'abc')` -> 0
- `levenshteinDistance('abc', 'ab')` -> 1
- `levenshteinDistance('stae', 'state')` -> 1 (insertion)
- `levenshteinDistance('sttae', 'state')` -> 2 (transposition as two edits)
- `levenshteinDistance('cat', 'dog')` -> 3

### Function 2: `suggestCommands(input, commands, maxDistance, maxSuggestions)`

Finds commands within edit distance threshold and returns them sorted by distance (ascending), then alphabetically for ties.

**Signature:** `function suggestCommands(input, commands, maxDistance = 3, maxSuggestions = 3)` -- returns an array of strings (command names).

**Parameters:**
- `input` (string): The unknown command the user typed.
- `commands` (string[]): The list of all valid command names.
- `maxDistance` (number, default 3): Maximum edit distance to consider a command as a suggestion.
- `maxSuggestions` (number, default 3): Maximum number of suggestions to return.

**Behavior:**
- Returns an empty array if no commands are within `maxDistance`.
- Returns commands sorted by ascending edit distance, then alphabetically for ties.
- Returns at most `maxSuggestions` results.
- An exact match (distance 0) should still be returned (edge case for testing, though in practice exact matches are handled by the switch).

### Placement

Insert both functions ABOVE the `migrateStateVersion` function declaration (before line 155). These are module-level helper functions.

### Export

Update `module.exports` at the bottom of the file (currently line 327: `module.exports = { migrateStateVersion };`) to also export the two new functions:

```javascript
module.exports = { migrateStateVersion, levenshteinDistance, suggestCommands };
```

### What NOT to do

- Do NOT import any external modules or npm packages. The implementation must be self-contained.
- Do NOT use the existing `normalizedLevenshtein()` from `src/lib/review.cjs` -- that returns a 0-1 similarity score, not raw edit distance, and importing the review module would be a disproportionate dependency.
- Do NOT modify the `KNOWN_COMMANDS` array if you define one -- just define it as a `const` array literal listing all 27 commands.

### Verification

Run: `node -e "const { levenshteinDistance } = require('./src/bin/rapid-tools.cjs'); console.log(levenshteinDistance('stae', 'state'));"` from project root -- should print `1`.
Run: `node -e "const { suggestCommands } = require('./src/bin/rapid-tools.cjs'); console.log(suggestCommands('stae', ['state', 'lock', 'plan']));"` from project root -- should print `[ 'state' ]`.

---

## Task 2: Wire Fuzzy Matching into the Default Case

**File:** `src/bin/rapid-tools.cjs`
**Action:** Replace the current `default` case (lines 308-311) with fuzzy matching logic that suggests similar commands before printing USAGE.

### Current default case

```javascript
      default:
        error(`Unknown command: ${command}`);
        process.stdout.write(USAGE);
        process.exit(1);
```

### New default case

```javascript
      default: {
        const knownCommands = [
          'prereqs', 'init', 'context', 'display',
          'lock', 'state', 'parse-return', 'verify-artifacts',
          'plan', 'assumptions', 'worktree', 'execute',
          'memory', 'quick', 'merge', 'set-init',
          'review', 'resume', 'resolve', 'build-agents',
          'migrate', 'scaffold', 'compact', 'hooks',
          'ui-contract', 'docs', 'dag'
        ];
        const suggestions = suggestCommands(command, knownCommands);
        if (suggestions.length > 0) {
          error(`Unknown command: ${command}. Did you mean: ${suggestions.join(', ')}?`);
        } else {
          error(`Unknown command: ${command}`);
        }
        process.stdout.write(USAGE);
        process.exit(1);
      }
```

### Key details

- The `knownCommands` array must contain all 27 commands (4 pre-switch + 23 switch cases). The array is defined inline in the default case for locality -- it does not need to be a module-level constant.
- The error message format preserves the existing `[RAPID ERROR] Unknown command: X` prefix via the `error()` function, and appends `. Did you mean: X, Y?` when suggestions exist.
- The braces around the `default` case create a block scope for the `const` declarations (required by strict mode).
- USAGE is still printed after the error -- suggestions supplement it, they do not replace it.
- Exit code remains 1.

### What NOT to do

- Do NOT remove the USAGE output -- suggestions are an addition, not a replacement.
- Do NOT change the error channel (stderr via `error()`) or exit code (1).
- Do NOT add a "Did you mean" prompt that waits for user input -- this is a one-shot error message.

### Verification

Run: `node src/bin/rapid-tools.cjs stae 2>&1 | head -1` from project root -- should contain `Did you mean: state`.
Run: `node src/bin/rapid-tools.cjs xyzzy 2>&1 | head -1` from project root -- should contain `Unknown command: xyzzy` without a "Did you mean" suggestion (distance too large).
Run: `node src/bin/rapid-tools.cjs plaan 2>&1 | head -1` from project root -- should contain `Did you mean: plan`.

---

## Task 3: Unit Tests for Fuzzy Matching

**File:** `tests/fuzzy-match.test.cjs` (NEW file)
**Action:** Create a comprehensive unit test file for `levenshteinDistance` and `suggestCommands`.

### Test structure

Use `node:test` (`describe`, `it`) and `node:assert/strict`, matching the pattern in `tests/display.test.cjs`.

### Test cases for `levenshteinDistance`

```
describe('levenshteinDistance', () => {
  // Identity
  it('returns 0 for identical strings')          // ('abc', 'abc') -> 0
  it('returns 0 for two empty strings')           // ('', '') -> 0

  // Single edits
  it('returns 1 for single insertion')            // ('stat', 'state') -> 1
  it('returns 1 for single deletion')             // ('state', 'stat') -> 1
  it('returns 1 for single substitution')         // ('state', 'stave') -> 1

  // Multiple edits
  it('returns 2 for two edits')                   // ('sttae', 'state') -> 2
  it('returns 3 for three edits')                 // ('cat', 'dog') -> 3

  // Edge cases
  it('handles one empty string')                  // ('', 'abc') -> 3
  it('handles other empty string')                // ('abc', '') -> 3
  it('is symmetric')                              // distance(a,b) === distance(b,a)
})
```

### Test cases for `suggestCommands`

```
describe('suggestCommands', () => {
  const commands = ['state', 'lock', 'plan', 'merge', 'review', 'resolve', 'resume', 'scaffold'];

  // Basic matching
  it('returns exact match at distance 0')         // ('state', commands) -> ['state']
  it('returns single typo suggestion')            // ('stae', commands) -> ['state']
  it('returns multiple suggestions sorted by distance') // ('re', commands) -> sorted by distance

  // Threshold
  it('returns empty array when no match within threshold') // ('xyzzy', commands) -> []
  it('respects custom maxDistance')                // ('stae', commands, 0) -> []
  it('respects custom maxSuggestions')             // custom limit

  // Sorting
  it('sorts tied distances alphabetically')       // e.g., two commands at same distance

  // Edge cases
  it('handles empty input')                       // ('', commands) -> [] (all distances > 3)
  it('handles empty command list')                // ('state', []) -> []
})
```

### Run command

This test file lives in `tests/`, not `src/`, so it is NOT covered by the `package.json` test script (`node --test 'src/**/*.test.cjs'`). Run it explicitly:

```bash
node --test tests/fuzzy-match.test.cjs
```

### What NOT to do

- Do NOT import anything from `src/lib/review.cjs`.
- Do NOT use `require('child_process')` to test the CLI -- test the exported functions directly via `require('../src/bin/rapid-tools.cjs')`.
- Do NOT add the test file to the `package.json` test script -- tests in `tests/` are run individually or via `node --test tests/*.test.cjs`.

### Verification

Run: `node --test tests/fuzzy-match.test.cjs` -- all tests should pass.
Run: `node --test tests/fuzzy-match.test.cjs 2>&1 | tail -3` -- should show `# pass` count matching total test count and `# fail 0`.

---

## Success Criteria

1. `src/bin/rapid-tools.cjs` exports `levenshteinDistance` and `suggestCommands` functions.
2. Unknown commands within edit distance 3 produce a "Did you mean: X?" suggestion in the error message.
3. Unknown commands beyond edit distance 3 produce the standard error message without suggestions.
4. All 27 known commands are included in the suggestion pool.
5. `tests/fuzzy-match.test.cjs` exists with tests covering identity, single edits, multiple edits, threshold behavior, sorting, and edge cases.
6. `node --test tests/fuzzy-match.test.cjs` passes with 0 failures.
7. No external dependencies added (no changes to `package.json`).
