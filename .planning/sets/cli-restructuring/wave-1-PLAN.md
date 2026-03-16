# Wave 1: Foundation -- Shared Utilities, Router Skeleton, Contract Test Harness

## Objective

Create the foundational infrastructure for the CLI restructuring: three shared utility modules (`args.cjs`, `errors.cjs`, `stdin.cjs`), the `src/commands/` directory, a contract test file that captures the exact JSON output shapes of every command group before any extraction begins, and the router skeleton inside `rapid-tools.cjs` that will later replace the monolith's `main()`. The router skeleton is NOT wired in yet -- it is written as an alternate export for testing, while the existing `main()` continues to run production traffic.

## Why

Extracting handlers without a pre-existing contract test safety net risks silently changing JSON output shapes that 24 skills and 26 agents depend on. Building the utilities first means Wave 2 extractions can immediately use them, avoiding a second pass.

---

## Task 1: Create `src/lib/args.cjs` -- lightweight argument parser

**Files:** `src/lib/args.cjs` (Create)

**Implementation:**

Create a CommonJS module exporting `parseArgs(args, schema)` where:
- `args` is `string[]` (e.g., `['--branch', 'main', '--force', '--mode', 'solo']`)
- `schema` is an object mapping flag names to their expected types: `{ branch: 'string', force: 'boolean', mode: 'string', 'agent-phase2': 'multi:2' }`.
  - `'string'` -- consumes the next token as the value
  - `'boolean'` -- presence means `true`, absence means `false` (no value consumed)
  - `'multi:N'` -- consumes the next N tokens as an array (needed for `--agent-phase2 <conflictId> <phase>`)
- Returns `{ flags: { branch: 'main', force: true, mode: 'solo' }, positional: [...remaining args] }`.
- Supports both `--flag value` and `--flag=value` syntax.
- Unknown flags (not in schema) are treated as positional args (preserving current behavior where `args.indexOf()` simply returns -1 for unknown flags).
- If a `'string'` flag is present but has no next token, its value is `undefined` (matching current `args[idx+1]` behavior when idx is the last element).

**Edge cases to preserve** (from the 10 `args.indexOf()` sites):
- `--test` in verify-artifacts expects one value, missing value returns `undefined`
- `--branch` defaults are handled by callers, not by parseArgs
- `--mode` in execute.reconcile uses `>= 0` check (boolean-like), but in reconcile-jobs uses value -- callers decide

**What NOT to do:**
- Do NOT add default values in parseArgs -- callers set their own defaults (this matches current behavior)
- Do NOT throw on missing values -- return `undefined` to match `args[idx+1]` when idx is last
- Do NOT use any npm packages -- this is a pure utility

**Verification:**
```bash
node --test src/lib/args.test.cjs
```

---

## Task 2: Create `src/lib/args.test.cjs` -- tests for parseArgs

**Files:** `src/lib/args.test.cjs` (Create)

**Implementation:**

Write tests using `node:test` and `node:assert/strict` covering:
1. Basic string flag: `parseArgs(['--branch', 'main'], { branch: 'string' })` returns `{ flags: { branch: 'main' }, positional: [] }`
2. Boolean flag: `parseArgs(['--force'], { force: 'boolean' })` returns `{ flags: { force: true }, positional: [] }`
3. Missing boolean flag returns `false`: `parseArgs([], { force: 'boolean' })` returns `{ flags: { force: false }, positional: [] }`
4. `--flag=value` syntax: `parseArgs(['--branch=develop'], { branch: 'string' })` returns `{ flags: { branch: 'develop' }, positional: [] }`
5. Multi-value flag: `parseArgs(['--agent-phase2', 'conflict-1', 'done'], { 'agent-phase2': 'multi:2' })` returns `{ flags: { 'agent-phase2': ['conflict-1', 'done'] }, positional: [] }`
6. Missing string value: `parseArgs(['--branch'], { branch: 'string' })` returns `{ flags: { branch: undefined }, positional: [] }`
7. Mixed positional and flags: `parseArgs(['setName', '--branch', 'main', 'extra'], { branch: 'string' })` returns `{ flags: { branch: 'main' }, positional: ['setName', 'extra'] }`
8. Unknown flags treated as positional: `parseArgs(['--unknown', 'val'], { branch: 'string' })` returns `{ flags: { branch: undefined }, positional: ['--unknown', 'val'] }` -- wait, this would break things. Actually unknown flags should just be ignored in the flags output but remain in positional. Correction: unknown `--flag` tokens should be pushed to positional as-is (token + its "value" both go to positional).
9. Empty args: `parseArgs([], { branch: 'string' })` returns `{ flags: { branch: undefined }, positional: [] }`
10. The 10 exact arg patterns from the monolith catalog (one test per site showing before/after equivalence)

**Verification:**
```bash
node --test src/lib/args.test.cjs
```

---

## Task 3: Create `src/lib/errors.cjs` -- standardized error output

**Files:** `src/lib/errors.cjs` (Create)

**Implementation:**

Create a CommonJS module exporting:

1. `exitWithError(msg, code = 1)`:
   - Writes `JSON.stringify({ error: msg })` + `'\n'` to `process.stdout` (for machine consumption)
   - Calls `error(msg)` from `core.cjs` (writes to stderr for human consumption)
   - Calls `process.exit(code)`
   - Return type annotation: `@returns {never}`

2. `CliError` class extending `Error`:
   - Constructor: `(message, { code = 1, data = {} } = {})`
   - Properties: `code` (exit code), `data` (arbitrary context object)
   - This is what handlers will throw in Wave 3; the router catches `CliError` and calls `exitWithError()`

**Why two mechanisms:**
- The current monolith has two error patterns: `error(msg) + process.exit(1)` and `JSON.stringify({ error }) + process.exit(1)`. `exitWithError` unifies both.
- `CliError` is the throw-based mechanism for Wave 3 migration. Defining it now means Wave 2 extractors can already import it even if they don't use it yet.

**What NOT to do:**
- Do NOT import `exitWithError` in command files yet -- Wave 2 extracts verbatim, Wave 3 migrates
- Do NOT add logging/telemetry -- keep it minimal

**Verification:**
```bash
node --test src/lib/errors.test.cjs
```

---

## Task 4: Create `src/lib/errors.test.cjs` -- tests for error utilities

**Files:** `src/lib/errors.test.cjs` (Create)

**Implementation:**

Write tests using `node:test` and `node:assert/strict`:
1. `CliError` is an instance of `Error`
2. `CliError` preserves message, code, and data properties
3. `CliError` defaults: code=1, data={}
4. `exitWithError` writes JSON to stdout, error to stderr, and calls `process.exit` -- test by mocking `process.stdout.write`, `process.stderr.write`, and `process.exit` within a test context (use `{ mock }` from `node:test`)

**Verification:**
```bash
node --test src/lib/errors.test.cjs
```

---

## Task 5: Create `src/lib/stdin.cjs` -- stdin reading with Zod validation

**Files:** `src/lib/stdin.cjs` (Create)

**Implementation:**

Create a CommonJS module exporting:

1. `readStdinSync()`:
   - Uses `fs.readFileSync(0, 'utf-8')` to read stdin synchronously
   - Returns the trimmed string, or throws `CliError('No data on stdin')` if empty
   - This covers the 6 sync stdin sites in the monolith

2. `readStdinAsync()`:
   - Uses the async stream pattern: `const chunks = []; for await (const chunk of process.stdin) { chunks.push(chunk); }`
   - Returns the trimmed string, or throws `CliError('No data on stdin')` if empty
   - This covers the 1 async stdin site (add-milestone with TTY guard)

3. `readAndValidateStdin(zodSchema, { async = false } = {})`:
   - Calls `readStdinSync()` or `readStdinAsync()` based on `async` flag
   - Parses the string as JSON (throws `CliError('Invalid JSON on stdin: ...')` on parse failure)
   - Validates against `zodSchema` using `.safeParse()` (throws `CliError('Stdin validation failed: ...')` with Zod error details)
   - Returns the parsed+validated object
   - Note: zodSchema should use `.passthrough()` to allow extra fields (contract from foundation-hardening)

**Requires:** `CliError` from `./errors.cjs`, `fs` from node stdlib. Does NOT require zod directly -- zodSchema is passed in by callers.

**What NOT to do:**
- Do NOT require `zod` -- the schema is passed in by callers who already have it
- Do NOT add TTY guards in these utilities -- the caller (add-milestone handler) checks `process.stdin.isTTY` before deciding which method to call

**Verification:**
```bash
node --test src/lib/stdin.test.cjs
```

---

## Task 6: Create `src/lib/stdin.test.cjs` -- tests for stdin utilities

**Files:** `src/lib/stdin.test.cjs` (Create)

**Implementation:**

Write tests using `node:test` and `node:assert/strict`:
1. `readStdinSync` returns trimmed content (mock `fs.readFileSync` for fd 0)
2. `readStdinSync` throws `CliError` on empty stdin
3. `readAndValidateStdin` parses valid JSON and returns object (use a mock zod schema with `.safeParse` returning `{ success: true, data: ... }`)
4. `readAndValidateStdin` throws on invalid JSON
5. `readAndValidateStdin` throws on Zod validation failure (mock `.safeParse` returning `{ success: false, error: ... }`)
6. `readAndValidateStdin` with `async: true` uses stream-based reading

Since mocking `fs.readFileSync(0)` is tricky in `node:test`, consider testing through a helper that accepts the raw string and validates, then testing the read+validate integration with actual piped input via `execSync`.

**Verification:**
```bash
node --test src/lib/stdin.test.cjs
```

---

## Task 7: Create `src/commands/` directory and contract test harness

**Files:** `src/commands/.gitkeep` (Create), `src/bin/contract.test.cjs` (Create)

**Implementation:**

1. Create `src/commands/` directory with a `.gitkeep` file.

2. Create `src/bin/contract.test.cjs` -- a comprehensive contract test file that captures the exact JSON output shapes of each command group. These tests invoke the CLI binary (same pattern as `rapid-tools.test.cjs`) and assert structural properties of the output.

The contract tests must cover these output shapes (grouped by command):

**State commands:**
- `state get --all` -- returns object with `milestones` array, `currentMilestone` string, `version` string
- `state get milestone <id>` -- returns object with `id`, `name`, `status`, `sets` array
- `state transition set` -- returns `{ transitioned: true, entity: 'set', id, status }`
- `state detect-corruption` -- returns object with corruption check fields
- `state recover` -- returns `{ recovered: true }`

**Plan commands:**
- `plan list-sets` -- returns `{ sets: [...] }`
- `plan create-set` -- returns object with created set info
- `plan load-set` -- returns object with set definition + contract

**Lock commands:**
- `lock acquire` -- returns `{ acquired: true, lock: <name> }`
- `lock status` -- returns `{ locked: <bool>, lock: <name> }`

**Worktree commands:**
- `worktree list` -- returns `{ worktrees: [...] }`
- `worktree reconcile` -- returns `{ reconciled: true, orphaned: <n>, discovered: <n> }`

**Execute commands:**
- `execute wave-status` -- returns `{ waves: [...] }`
- `execute update-phase` -- returns `{ updated: true, setName, phase }`

**Merge commands:**
- `merge status` -- returns object keyed by set name with `phase`, `mergeStatus`, etc.
- `merge order` -- returns array of arrays (wave-grouped)
- `merge integration-test` -- returns object with test results

**Resolve commands:**
- `resolve set` -- returns object with resolved set data or `{ error: ... }`
- `resolve wave` -- returns object with resolved wave data or `{ error: ... }`

**Misc commands:**
- `prereqs` -- returns object with `results` array, `summary` object
- `prereqs --json` -- returns JSON array
- `prereqs --git-check` -- returns `{ isGitRepo: <bool>, ... }`
- `display banner` -- returns raw text (NOT JSON)
- `verify-artifacts` -- returns array or report string

For each, assert:
- The output is valid JSON (except `display banner`)
- Required top-level keys exist
- Key types match expectations (array is array, string is string, etc.)
- Use structural assertions that tolerate additive changes: check `key in result` rather than `deepStrictEqual`

The test file should set up a temp directory with `.planning/` and minimal STATE.json for commands that need them.

**What NOT to do:**
- Do NOT assert exact field values (fragile) -- assert shapes only
- Do NOT test every subcommand variant -- one representative per output shape
- Do NOT duplicate tests already in `rapid-tools.test.cjs` -- only add shape assertions

**Verification:**
```bash
node --test src/bin/contract.test.cjs
```

---

## Success Criteria

1. All three utility modules (`args.cjs`, `errors.cjs`, `stdin.cjs`) exist in `src/lib/` with passing unit tests
2. `src/commands/` directory exists
3. Contract test file passes, capturing JSON output shapes for all 13+ command groups
4. Existing `rapid-tools.test.cjs` still passes (87/87 tests)
5. No changes to `rapid-tools.cjs` in this wave -- it remains the production monolith

## File Ownership

| File | Action |
|------|--------|
| `src/lib/args.cjs` | Create |
| `src/lib/args.test.cjs` | Create |
| `src/lib/errors.cjs` | Create |
| `src/lib/errors.test.cjs` | Create |
| `src/lib/stdin.cjs` | Create |
| `src/lib/stdin.test.cjs` | Create |
| `src/commands/.gitkeep` | Create |
| `src/bin/contract.test.cjs` | Create |
