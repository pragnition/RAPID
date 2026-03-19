# Wave 1: Core Memory Module

## Objective

Build the foundational `src/lib/memory.cjs` library that owns all reads and writes to `.planning/memory/`. This wave delivers the JSONL entry schemas, append functions, query functions, `buildMemoryContext()` with token budgeting, and comprehensive unit tests. No CLI wiring or integration with other modules -- pure library code.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/memory.cjs` | Create | Core memory module: append, query, buildMemoryContext |
| `src/lib/memory.test.cjs` | Create | Comprehensive unit tests for memory module |

## Task 1: Create `src/lib/memory.cjs` with entry schemas and append functions

**File:** `src/lib/memory.cjs`

**Implementation:**

1. Add `'use strict'` header and require `fs`, `path`, `crypto` from Node builtins. Import `estimateTokens` from `./tool-docs.cjs`.

2. Define module-level constants:
   - `MEMORY_DIR = 'memory'` (subdirectory name within `.planning/`)
   - `DECISIONS_FILE = 'DECISIONS.jsonl'`
   - `CORRECTIONS_FILE = 'CORRECTIONS.jsonl'`
   - `DEFAULT_TOKEN_BUDGET = 8000`
   - `DECISION_BUDGET_RATIO = 0.7` (70% for decisions)
   - `VALID_CATEGORIES` array: `['architecture', 'integration', 'ux', 'performance', 'convention', 'tooling', 'testing', 'deployment']`
   - `VALID_SOURCES` array: `['user', 'agent']`

3. Implement `getMemoryDir(cwd)`:
   - Returns `path.join(cwd, '.planning', MEMORY_DIR)`
   - Pure path computation, no side effects

4. Implement `ensureMemoryDir(cwd)`:
   - Calls `fs.mkdirSync(getMemoryDir(cwd), { recursive: true })`
   - Called only by append functions (lazy init)

5. Implement `appendDecision(cwd, entry)`:
   - Validate `entry` has required fields: `category` (must be in VALID_CATEGORIES), `decision` (non-empty string), `rationale` (non-empty string), `source` (must be in VALID_SOURCES)
   - Throw `Error` with descriptive message if validation fails
   - Build record object: `{ id: crypto.randomUUID(), timestamp: new Date().toISOString(), category: entry.category, decision: entry.decision, rationale: entry.rationale, source: entry.source, milestone: entry.milestone || null, setId: entry.setId || null, topic: entry.topic || null }`
   - Call `ensureMemoryDir(cwd)`
   - `fs.appendFileSync(path.join(getMemoryDir(cwd), DECISIONS_FILE), JSON.stringify(record) + '\n')`
   - Return the record (caller may need the generated id)

6. Implement `appendCorrection(cwd, entry)`:
   - Validate `entry` has required fields: `original` (non-empty string), `correction` (non-empty string), `reason` (non-empty string)
   - Build record: `{ id: crypto.randomUUID(), timestamp: new Date().toISOString(), original: entry.original, correction: entry.correction, reason: entry.reason, affectedSets: entry.affectedSets || [], setId: entry.setId || null, milestone: entry.milestone || null }`
   - Call `ensureMemoryDir(cwd)` then `fs.appendFileSync`
   - Return the record

**Verification:**
```bash
node -e "const m = require('./src/lib/memory.cjs'); console.log(typeof m.appendDecision, typeof m.appendCorrection)"
```
Expected: `function function`

**Commit:** `feat(memory-system): add JSONL entry schemas and append functions`

---

## Task 2: Add query functions to `src/lib/memory.cjs`

**File:** `src/lib/memory.cjs`

**Implementation:**

1. Implement `readJsonlFile(filePath)`:
   - Internal helper (not exported)
   - If file does not exist (`!fs.existsSync`), return `[]`
   - Read file with `fs.readFileSync(filePath, 'utf-8')`
   - Split by `'\n'`, filter empty lines
   - For each line, wrap `JSON.parse` in try/catch -- skip malformed lines (log nothing, just skip silently)
   - Return array of parsed objects

2. Implement `queryDecisions(cwd, filters)`:
   - `filters` is optional object with: `{ category?: string, milestone?: string, setId?: string, limit?: number }`
   - Call `readJsonlFile` for DECISIONS_FILE
   - Apply filters sequentially: if `filters.category`, keep only entries where `entry.category === filters.category`; if `filters.milestone`, keep only matching milestone; if `filters.setId`, keep only matching setId
   - Sort by timestamp descending (most recent first): `entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp))`
   - If `filters.limit`, slice to that limit
   - Return filtered array

3. Implement `queryCorrections(cwd, filters)`:
   - `filters` is optional object with: `{ affectedSet?: string, setId?: string, limit?: number }`
   - Call `readJsonlFile` for CORRECTIONS_FILE
   - If `filters.affectedSet`, keep only entries where `entry.affectedSets` includes `filters.affectedSet`
   - If `filters.setId`, keep only matching setId
   - Sort by timestamp descending
   - If `filters.limit`, slice to that limit
   - Return filtered array

**Verification:**
```bash
node -e "const m = require('./src/lib/memory.cjs'); console.log(typeof m.queryDecisions, typeof m.queryCorrections)"
```
Expected: `function function`

**Commit:** `feat(memory-system): add query functions with filtering and recency sort`

---

## Task 3: Add `buildMemoryContext()` to `src/lib/memory.cjs`

**File:** `src/lib/memory.cjs`

**Implementation:**

1. Implement `deduplicateDecisions(decisions)`:
   - Internal helper (not exported)
   - Purpose: latest-wins per category+topic key
   - Build a `Map` keyed by `${entry.category}::${entry.topic || ''}`
   - Iterate decisions (already sorted recency-first from queryDecisions), for each key keep only the first (most recent) entry
   - For superseded entries (not the latest per key), add a `superseded: true` property
   - Return array with latest entries first, superseded entries at the end

2. Implement `formatDecisionEntry(entry)`:
   - Internal helper
   - Returns string: `- [${entry.category}] ${entry.decision} (${entry.rationale})${entry.superseded ? ' [superseded]' : ''}`
   - If entry has `topic`: `- [${entry.category}/${entry.topic}] ${entry.decision} ...`

3. Implement `formatCorrectionEntry(entry)`:
   - Internal helper
   - Returns string: `- Original: ${entry.original} -> Correction: ${entry.correction} (${entry.reason})`

4. Implement `buildMemoryContext(cwd, setName, tokenBudget)`:
   - Default `tokenBudget` to `DEFAULT_TOKEN_BUDGET` (8000)
   - Calculate `decisionBudget = Math.floor(tokenBudget * DECISION_BUDGET_RATIO)` (5600)
   - Calculate `correctionBudget = tokenBudget - decisionBudget` (2400)
   - Query all decisions: `queryDecisions(cwd)` (no filters, gets all, recency-first)
   - Query corrections relevant to this set: `queryCorrections(cwd, { affectedSet: setName })`, then also query `queryCorrections(cwd)` for global corrections
   - Merge correction lists: set-specific first, then global (deduplicate by id)
   - Deduplicate decisions with `deduplicateDecisions()`
   - Build decisions section: format each decision entry, accumulate text, stop when `estimateTokens(accumulated)` exceeds `decisionBudget`
   - Build corrections section: format each correction entry, accumulate text, stop when `estimateTokens(accumulated)` exceeds `correctionBudget`
   - Assemble final output:
     ```
     ## Memory Context

     ### Decisions
     {formatted decisions or "(no decisions recorded)"}

     ### Corrections
     {formatted corrections or "(no corrections recorded)"}
     ```
   - If both sections are empty (no decisions and no corrections files exist), return empty string `''`
   - Return the assembled string

5. Export all public functions at the bottom:
   ```js
   module.exports = {
     appendDecision,
     appendCorrection,
     queryDecisions,
     queryCorrections,
     buildMemoryContext,
     VALID_CATEGORIES,
     VALID_SOURCES,
     DEFAULT_TOKEN_BUDGET,
   };
   ```

**Verification:**
```bash
node -e "const m = require('./src/lib/memory.cjs'); console.log(typeof m.buildMemoryContext)"
```
Expected: `function`

**Commit:** `feat(memory-system): add buildMemoryContext with token budgeting and dedup`

---

## Task 4: Create comprehensive unit tests `src/lib/memory.test.cjs`

**File:** `src/lib/memory.test.cjs`

**Implementation:**

Use `node:test` (`describe`, `it`, `beforeEach`, `afterEach`) and `node:assert/strict`. Use `fs.mkdtempSync` for temporary directories. Clean up with `fs.rmSync(tmpDir, { recursive: true, force: true })` in `afterEach`.

**Test groups:**

1. **`describe('appendDecision')`**:
   - `it('creates .planning/memory/ directory on first write')` -- verify dir did not exist before, exists after
   - `it('writes valid JSONL line with all required fields')` -- append one entry, read file, parse JSON, assert all fields present including auto-generated `id` and `timestamp`
   - `it('appends multiple entries as separate lines')` -- append 3 entries, verify file has 3 lines, each valid JSON
   - `it('throws on missing required field: category')` -- assert.throws with descriptive message
   - `it('throws on invalid category')` -- use a category not in VALID_CATEGORIES
   - `it('throws on missing required field: decision')` -- empty string
   - `it('throws on invalid source')` -- source not in VALID_SOURCES
   - `it('includes optional fields when provided')` -- milestone, setId, topic
   - `it('returns the created record with generated id')` -- verify return value has id, timestamp

2. **`describe('appendCorrection')`**:
   - `it('creates directory on first write')`
   - `it('writes valid JSONL line')` -- verify fields
   - `it('throws on missing required field: original')`
   - `it('includes affectedSets array when provided')`
   - `it('defaults affectedSets to empty array')`

3. **`describe('queryDecisions')`**:
   - `it('returns empty array when file does not exist')`
   - `it('returns all entries sorted by timestamp descending')`
   - `it('filters by category')`
   - `it('filters by milestone')`
   - `it('filters by setId')`
   - `it('respects limit parameter')`
   - `it('skips malformed JSONL lines gracefully')` -- write a file with a bad line mixed in, verify it is skipped and valid entries are returned

4. **`describe('queryCorrections')`**:
   - `it('returns empty array when file does not exist')`
   - `it('filters by affectedSet')`
   - `it('respects limit parameter')`

5. **`describe('buildMemoryContext')`**:
   - `it('returns empty string when no memory files exist')`
   - `it('includes decisions section with formatted entries')`
   - `it('includes corrections section with formatted entries')`
   - `it('respects token budget -- output does not exceed budget')` -- append many entries (50+), call with tokenBudget=500, verify `estimateTokens(result) <= 500` (allow a small margin for section headers)
   - `it('deduplicates decisions by category+topic, keeping latest')` -- append two decisions with same category+topic but different timestamps, verify only latest appears in non-superseded form
   - `it('marks superseded decisions with [superseded] tag')` -- verify the older decision appears with [superseded]
   - `it('prioritizes set-specific corrections over global corrections')`

6. **`describe('append-only invariant')`**:
   - `it('appendDecision never modifies existing lines')` -- append 2 entries, read content after first append, read after second, verify first content is a prefix of second content
   - `it('file content only grows, never shrinks')` -- track file size after each append, verify monotonically increasing

7. **`describe('lazy init invariant')`**:
   - `it('query functions do not create the memory directory')` -- call queryDecisions and queryCorrections on a cwd with no .planning/memory/, verify directory was NOT created
   - `it('buildMemoryContext does not create the memory directory')` -- same check

**Verification:**
```bash
node --test src/lib/memory.test.cjs
```
Expected: all tests pass

**Commit:** `test(memory-system): add comprehensive unit tests for memory module`

---

## Success Criteria

1. `node -e "require('./src/lib/memory.cjs')"` loads without error
2. `node --test src/lib/memory.test.cjs` -- all tests pass
3. Append-only invariant verified by tests
4. Lazy init invariant verified by tests (no directory created on reads)
5. Token budget enforcement verified by tests
6. Malformed JSONL resilience verified by tests
7. No new npm dependencies added
