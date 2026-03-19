# Wave 1 PLAN: Quick Task Logging Foundation

**Set:** quick-and-addset
**Wave:** 1 of 3
**Objective:** Create the quick task JSONL log library (`quick-log.cjs`) with append/query functions, write comprehensive unit tests, and wire the `quick` command into the CLI router (`rapid-tools.cjs`) via a new command handler (`src/commands/quick.cjs`).

## File Ownership

| File | Action |
|------|--------|
| `src/lib/quick-log.cjs` | **Create** |
| `src/lib/quick-log.test.cjs` | **Create** |
| `src/commands/quick.cjs` | **Create** |
| `src/bin/rapid-tools.cjs` | **Modify** (add import + case) |

---

## Task 1: Create `src/lib/quick-log.cjs` -- Quick Task JSONL Library

### Action

Create a new module at `src/lib/quick-log.cjs` that provides three functions:

1. **`appendQuickTask(cwd, entry)`** -- Append a quick task record to `.planning/memory/quick-tasks.jsonl`
   - Input `entry` must be an object with required fields: `description` (string), `outcome` (string: "COMPLETE"|"CHECKPOINT"|"BLOCKED"), `slug` (string), `branch` (string)
   - Generate `id` as a monotonic integer: read all existing entries from the JSONL file, find the max `id` field, use `max + 1`. If file is empty or missing, start at 1.
   - Generate `timestamp` as `new Date().toISOString()`
   - Ensure `.planning/memory/` directory exists via `fs.mkdirSync(path, { recursive: true })`
   - Write via `fs.appendFileSync(filePath, JSON.stringify(record) + '\n')`
   - Return the created record (with generated `id` and `timestamp`)
   - Validate required fields: throw `Error` with descriptive message if `description`, `outcome`, `slug`, or `branch` is missing or not a string

2. **`listQuickTasks(cwd, limit)`** -- Query quick task entries
   - Read and parse the JSONL file (split on newline, filter blanks, JSON.parse each line, skip malformed lines silently)
   - Sort by `id` descending (most recent first)
   - If `limit` is a positive integer, return only the first `limit` entries
   - If file does not exist, return `[]`

3. **`showQuickTask(cwd, id)`** -- Find a single task by numeric ID
   - Read and parse the JSONL file (same pattern as list)
   - Find the entry where `entry.id === id` (compare as numbers)
   - Return the entry object, or `null` if not found

**Internal helper:** Create a private `readQuickTasksFile(cwd)` function that reads `.planning/memory/quick-tasks.jsonl`, parses all lines, and returns an array of objects. Reuse this in all three public functions.

**JSONL file path:** `path.join(cwd, '.planning', 'memory', 'quick-tasks.jsonl')`

**Pattern reference:** Follow the same structure as `src/lib/memory.cjs` -- the `appendDecision`, `readJsonlFile`, and `queryDecisions` functions demonstrate the exact JSONL append/read/query pattern used in this project.

### What NOT to Do
- Do NOT use UUIDs for IDs -- use monotonic integers (human-friendly: 1, 2, 3)
- Do NOT use `crypto.randomUUID()` like memory.cjs does -- the CONTEXT.md explicitly specifies monotonic counter IDs
- Do NOT import from `memory.cjs` -- keep quick-log as a self-contained module (the `readJsonlFile` helper in memory.cjs is not exported)
- Do NOT add filtering by date/keyword (deferred per CONTEXT.md)

### Verification

```bash
node -e "const q = require('./src/lib/quick-log.cjs'); console.log(Object.keys(q));"
# Expected output includes: appendQuickTask, listQuickTasks, showQuickTask
```

### Done Criteria
- Module exports `appendQuickTask`, `listQuickTasks`, `showQuickTask`
- All three functions handle the empty-file case (returns `[]` or starts at ID 1)
- `appendQuickTask` validates required fields and throws on missing ones

---

## Task 2: Create `src/lib/quick-log.test.cjs` -- Unit Tests

### Action

Create comprehensive unit tests at `src/lib/quick-log.test.cjs` using the project's test framework (`node:test` with `node:assert/strict`).

**Test setup pattern** (match `memory.test.cjs`):
```javascript
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
```

Create a `makeTmpDir()` helper that:
- Creates a temp dir via `fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-quick-log-test-'))`
- Creates `.planning/` subdirectory inside it
- Returns the temp dir path

Use `beforeEach` to create and `afterEach` to clean up (`fs.rmSync(tmpDir, { recursive: true, force: true })`).

**Test cases for `appendQuickTask`:**

1. "creates .planning/memory/ directory on first write" -- verify directory creation
2. "writes valid JSONL line with all required fields" -- append one entry, read file, parse JSON, verify all fields present
3. "assigns monotonic integer ID starting at 1 for empty file" -- first entry gets id=1
4. "increments ID based on max existing ID" -- append 3 entries, verify IDs are 1, 2, 3
5. "handles non-sequential IDs (finds max)" -- manually write a JSONL file with id=5, then append, verify new entry gets id=6
6. "throws on missing description" -- assert.throws with message containing 'description'
7. "throws on missing outcome" -- assert.throws with message containing 'outcome'
8. "throws on missing slug" -- assert.throws with message containing 'slug'
9. "throws on missing branch" -- assert.throws with message containing 'branch'
10. "generates ISO timestamp" -- verify timestamp matches ISO 8601 pattern

**Test cases for `listQuickTasks`:**

11. "returns empty array when file does not exist"
12. "returns entries sorted by id descending" -- append 3 entries, verify order is 3, 2, 1
13. "respects limit parameter" -- append 5 entries, list with limit=2, verify length is 2
14. "skips malformed JSONL lines" -- manually write a file with one good line and one bad line, verify only good line returned

**Test cases for `showQuickTask`:**

15. "returns null when file does not exist"
16. "returns null for non-existent ID"
17. "finds entry by numeric ID" -- append 3 entries, show id=2, verify correct entry returned
18. "handles string ID input by converting to number" -- pass id as string "2", verify it still finds the entry

### Verification

```bash
node --test src/lib/quick-log.test.cjs
# Expected: all tests pass
```

### Done Criteria
- All 18 test cases pass
- Tests are isolated (each uses a fresh temp directory)
- Tests clean up after themselves

---

## Task 3: Create `src/commands/quick.cjs` -- CLI Command Handler

### Action

Create a new command handler at `src/commands/quick.cjs` that dispatches `quick` subcommands.

**Pattern reference:** Follow the exact structure of `src/commands/memory.cjs` -- it demonstrates the handler signature, subcommand dispatch, flag parsing, and error handling pattern.

**Handler signature:**
```javascript
async function handleQuick(cwd, subcommand, args)
```

**Subcommand dispatch (switch on `subcommand`):**

1. **`log`** -- Append a quick task entry
   - Parse flags using `parseArgs(args, { id: 'string', description: 'string', outcome: 'string', slug: 'string', branch: 'string' })`
   - Validate all flags are present; throw `CliError` with usage message if missing
   - Note: the `id` flag is NOT used for appending (ID is auto-generated). It is reserved for future use. Only `description`, `outcome`, `slug`, `branch` are passed to `appendQuickTask`.
   - Actually: remove `id` from the flag schema. The `log` subcommand only needs `description`, `outcome`, `slug`, `branch`.
   - Call `require('../lib/quick-log.cjs').appendQuickTask(cwd, { description, outcome, slug, branch })`
   - Output the returned record as JSON to stdout: `process.stdout.write(JSON.stringify(record) + '\n')`

2. **`list`** -- List quick tasks
   - Parse flags using `parseArgs(args, { limit: 'string' })`
   - Convert `limit` to integer if present: `const limit = flags.limit ? parseInt(flags.limit, 10) : undefined`
   - Call `require('../lib/quick-log.cjs').listQuickTasks(cwd, limit)`
   - Output the returned array as JSON to stdout

3. **`show`** -- Show a single quick task
   - The ID is the first positional argument: `const { positional } = parseArgs(args, {})`
   - If no positional arg, throw `CliError('Usage: quick show <id>')`
   - Parse ID as integer: `const id = parseInt(positional[0], 10)`
   - If `isNaN(id)`, throw `CliError('ID must be a number')`
   - Call `require('../lib/quick-log.cjs').showQuickTask(cwd, id)`
   - If result is null, throw `CliError('Quick task not found: ' + id)`
   - Output the returned object as JSON to stdout

4. **default** -- Unknown subcommand
   - Throw `CliError` with usage string listing all subcommands

**Imports needed:**
```javascript
const { CliError } = require('../lib/errors.cjs');
const { parseArgs } = require('../lib/args.cjs');
```

**Export:** `module.exports = { handleQuick };`

### What NOT to Do
- Do NOT import quick-log at the top level -- use lazy `require()` inside each case (matches the pattern in memory.cjs)
- Do NOT add a `delete` or `search` subcommand (deferred)

### Verification

```bash
node -e "const { handleQuick } = require('./src/commands/quick.cjs'); console.log(typeof handleQuick);"
# Expected: function
```

### Done Criteria
- Module exports `handleQuick`
- All three subcommands (`log`, `list`, `show`) dispatch correctly
- Flag parsing uses `parseArgs` from `args.cjs`
- Error handling uses `CliError` from `errors.cjs`

---

## Task 4: Wire `quick` Command into CLI Router

### Action

Modify `src/bin/rapid-tools.cjs` to register the `quick` command.

**Step 1: Add import** (at the top of the file, after the existing imports around line 23):
```javascript
const { handleQuick } = require('../commands/quick.cjs');
```

**Step 2: Add case** (inside the `switch(command)` block in `main()`, after the `memory` case around line 221):
```javascript
case 'quick':
  await handleQuick(cwd, subcommand, args.slice(2));
  break;
```

**Step 3: Update USAGE string** (add these lines in the Commands section, after the `memory` commands around line 102):
```
  quick log --description <d> --outcome <o> --slug <s> --branch <b>  Append quick task to log
  quick list [--limit <n>]                                           List quick task history
  quick show <id>                                                    Show a quick task by ID
```

### What NOT to Do
- Do NOT modify any other command handlers
- Do NOT add the `quick` command to the "Commands that don't need project root" section -- it needs `cwd`

### Verification

```bash
node src/bin/rapid-tools.cjs --help 2>&1 | grep -c "quick"
# Expected: 3 (three quick subcommand lines in help output)
```

```bash
node src/bin/rapid-tools.cjs quick list 2>/dev/null
# Expected: JSON output (empty array [] if no quick tasks exist yet)
```

### Done Criteria
- `rapid-tools quick list` returns `[]` (empty array JSON) without errors
- `rapid-tools --help` includes all three quick subcommands
- Import is at the top of the file with other command imports
- Case is inside the switch block with other command cases

---

## Success Criteria (Wave 1 Complete)

1. `src/lib/quick-log.cjs` exports `appendQuickTask`, `listQuickTasks`, `showQuickTask`
2. All 18 unit tests in `src/lib/quick-log.test.cjs` pass
3. `rapid-tools quick log --description "test" --outcome "COMPLETE" --slug "test-task" --branch "main"` appends a JSONL entry and outputs the record
4. `rapid-tools quick list` returns JSON array of entries
5. `rapid-tools quick show 1` returns JSON object for the entry
6. USAGE help includes all quick subcommands
