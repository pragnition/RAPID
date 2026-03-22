# Wave 1 PLAN: Core CLI Flag Implementation + Tests

## Objective

Add CLI flag support to `review log-issue` as an alternative to stdin JSON. When no stdin data is available, the handler falls back to parsing `--type`, `--severity`, `--file`, `--description`, `--source` flags (all required), plus optional `--line` and `--wave`. Auto-generates `id` (UUID) and `createdAt` (ISO timestamp). Add a command-level test file exercising both input paths and backward compatibility.

## Owned Files

| File | Action |
|------|--------|
| `src/commands/review.cjs` | Modify |
| `src/commands/review.test.cjs` | Create |

## Task 1: Modify `log-issue` handler to support CLI flags

**File:** `src/commands/review.cjs` (lines 66-92)

**Implementation:**

Replace the current `log-issue` case block with a version that:

1. Extracts `setId` from `args[0]` (unchanged).
2. Uses `parseArgs` on `args.slice(1)` with this schema:
   ```
   { type: 'string', severity: 'string', file: 'string', description: 'string', source: 'string', line: 'string', wave: 'string', 'post-merge': 'boolean' }
   ```
3. Wraps `readStdinSync()` in a try/catch. If the error is a `CliError` with message containing `'No data on stdin'`, falls back to CLI flag parsing. Any other error is rethrown.
4. **Stdin path (existing):** Parse JSON from stdin, apply `waveId` from positional args if present (backward compat -- use `positional[0]` from parseArgs result as the optional positional wave-id, only if it does not start with `--`).
5. **Flag path (new):** Validate that all 5 required flags (`type`, `severity`, `file`, `description`, `source`) are present. If any are missing, throw `CliError` with a usage hint:
   ```
   Usage: rapid-tools review log-issue <set-id> --type <type> --severity <severity> --file <file> --description <desc> --source <source> [--line <line>] [--wave <wave>] [--post-merge]
   ```
6. Build the issue object from flags:
   - `id`: `crypto.randomUUID()`
   - `type`, `severity`, `file`, `description`, `source`: from flags directly
   - `line`: if `flags.line` is defined, `parseInt(flags.line, 10)` -- only include if it parses to a valid number
   - `originatingWave`: `flags.wave` if defined
   - `createdAt`: `new Date().toISOString()`
   - `status`: `'open'`
   - `autoFixAttempted`: `false`
   - `autoFixSucceeded`: `false`
7. Both paths converge: call `review.logIssue()` or `review.logIssuePostMerge()` based on `flags['post-merge']` (from parseArgs, not raw `args.includes`).
8. Output `{ logged: true, issueId: issue.id, postMerge: flags['post-merge'] }`.

**Important details:**
- Add `const crypto = require('crypto');` at the top of the function or at module level (prefer inside the case block to minimize scope).
- The `CliError` class is already imported. Check error identity with `instanceof CliError` and message content with `.message.includes('No data on stdin')`.
- `parseArgs` is already imported at the top of the file.
- Do NOT change the positional wave-id backward compatibility for stdin mode. In stdin mode, `positional[0]` from parseArgs may contain the wave-id if it was passed as `args[1]` and does not start with `--`.

**What NOT to do:**
- Do not remove or change existing imports.
- Do not modify any other case blocks (scope, list-issues, update-issue, lean, summary).
- Do not add a `--title` flag -- the Zod schema has no `title` field. The CONTEXT.md was incorrect; the SET-OVERVIEW research corrected this.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node -e "require('./src/commands/review.cjs')" && echo "Module loads OK"
```

## Task 2: Create command-level tests for log-issue

**File:** `src/commands/review.test.cjs` (create new)

**Implementation:**

Follow the test conventions from `src/commands/state.test.cjs`:
- Use `node:test` (`describe`, `it`, `before`, `after`, `beforeEach`, `afterEach`)
- Use `node:assert/strict`
- Create temp directories with git init for `findProjectRoot()` compatibility
- Use `execSync` to invoke the CLI

**Test setup helper:**
```js
function setupTestProject(setId) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-review-test-'));
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  execSync('git commit --allow-empty -m "init"', { cwd: dir, stdio: 'pipe' });
  // Create .planning/sets/<setId>/ directory
  fs.mkdirSync(path.join(dir, '.planning', 'sets', setId), { recursive: true });
  // Write minimal STATE.json
  const state = { version: 1, projectName: 'test', currentMilestone: 'ms-1', milestones: [{ id: 'ms-1', name: 'ms-1', sets: [{ id: setId, status: 'executing', waves: [] }] }], lastUpdatedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
  fs.writeFileSync(path.join(dir, '.planning', 'STATE.json'), JSON.stringify(state));
  return dir;
}
```

**Test cases (all within a `describe('review log-issue')`):**

1. **"logs issue via stdin JSON (backward compat)"** -- Pipe a valid JSON issue object via stdin to `review log-issue test-set`. Assert exit code 0 and output contains `"logged":true`. Verify REVIEW-ISSUES.json was created in `.planning/sets/test-set/`.

2. **"logs issue via CLI flags"** -- Run `review log-issue test-set --type bug --severity high --file src/foo.cjs --description "broken" --source bug-hunt` with no stdin. Assert exit code 0, output contains `"logged":true`. Read REVIEW-ISSUES.json and verify the issue has auto-generated `id` (UUID format) and `createdAt` (ISO timestamp), correct `type`, `severity`, `file`, `description`, `source`.

3. **"CLI flags with optional --line and --wave"** -- Run with `--line 42 --wave wave-1`. Verify logged issue has `line: 42` and `originatingWave: 'wave-1'`.

4. **"errors on missing required CLI flags"** -- Run with only `--type bug` (missing severity, file, description, source). Assert exit code 1 and stderr contains usage hint.

5. **"errors on missing set-id"** -- Run `review log-issue` with no args. Assert exit code 1 and stderr contains 'Usage'.

6. **"stdin JSON with wave-id positional (backward compat)"** -- Pipe JSON and pass wave-id as positional: `review log-issue test-set wave-1`. Verify issue has `originatingWave: 'wave-1'`.

7. **"--post-merge flag works with CLI flags"** -- Run with CLI flags plus `--post-merge`. Verify issue is written to `.planning/post-merge/test-set/REVIEW-ISSUES.json` instead of `.planning/sets/test-set/REVIEW-ISSUES.json`.

For stdin tests, use: `execSync('echo \'{"id":"t1","type":"bug","severity":"high","file":"x.cjs","description":"d","source":"bug-hunt","createdAt":"2025-01-01T00:00:00.000Z"}' | node "${CLI_PATH}" review log-issue test-set`, { cwd: dir })`.

For no-stdin tests (CLI flags), just run `execSync('node "${CLI_PATH}" review log-issue test-set --type bug ...', { cwd: dir })` -- since there is no pipe, stdin fd 0 will be empty/TTY, triggering the fallback.

**Cleanup:** Use `afterEach` to `rm -rf` the temp directory.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/commands/review.test.cjs
```

## Success Criteria

- [ ] `review log-issue` accepts both stdin JSON and CLI flags
- [ ] Missing required CLI flags produce a clear error with usage hint
- [ ] Auto-generated `id` is UUID v4 format, `createdAt` is ISO timestamp
- [ ] Stdin JSON backward compatibility is preserved (including positional wave-id)
- [ ] `--post-merge` works with both stdin and CLI flag modes
- [ ] All 7 test cases pass
- [ ] No other review subcommands are affected
