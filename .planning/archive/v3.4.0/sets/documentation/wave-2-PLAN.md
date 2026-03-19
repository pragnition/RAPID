# Wave 2 PLAN: Changelog Extraction and CLI Integration

## Objective

Complete the core library by adding `extractChangelog` to `src/lib/docs.cjs`, then wire all three library functions into the CLI via `src/commands/docs.cjs` and register the `docs` command in `src/bin/rapid-tools.cjs`. This wave bridges the library module (wave 1) to the user-facing CLI surface. By the end, users can run `rapid-tools docs generate`, `docs list`, and `docs diff <milestone>`.

## File Ownership

| File | Action |
|------|--------|
| `src/lib/docs.cjs` | Modify (add extractChangelog) |
| `src/lib/docs.test.cjs` | Modify (add extractChangelog tests + CLI handler tests) |
| `src/commands/docs.cjs` | Create |
| `src/bin/rapid-tools.cjs` | Modify (add import + case) |

---

## Task 1: Implement `extractChangelog` in `src/lib/docs.cjs`

**File:** `src/lib/docs.cjs`

**Action:** Add `extractChangelog(cwd, milestoneId)` and export it alongside the two wave-1 functions.

1. **Parameters:**
   - `cwd` (string) -- project root directory
   - `milestoneId` (string) -- milestone identifier (e.g., `'v3.4.0'`). Used to find the matching milestone section in ROADMAP.md.

2. **Return type:** `ChangelogEntry[]` where each entry is:
   ```js
   {
     category: 'Added' | 'Changed' | 'Fixed' | 'Breaking',
     description: string,  // set description from ROADMAP.md
     setName: string       // set name (e.g., 'memory-system')
   }
   ```

3. **Algorithm:**
   - Read `.planning/ROADMAP.md` from `cwd`. If the file does not exist, return empty array.
   - Parse the ROADMAP.md content to find the milestone section matching `milestoneId`. The milestone is identified by a line containing the milestoneId string (e.g., `## Current Milestone: v3.4.0` or within a `<summary>` tag like `<summary>v3.4.0 ...`).
   - Within that milestone section, extract set entries. Set entries match the pattern: `- [x] set-name -- description` or `- [ ] set-name -- description` (both checked and unchecked). The em-dash (`--`) separates set name from description. Also handle the Unicode em-dash `\u2014`.
   - For each set entry, categorize using keyword detection on the description:
     - **Added**: description starts with or contains keywords: `Add`, `Create`, `Build`, `Implement`, `New`, `Introduce`
     - **Fixed**: contains `Fix`, `Repair`, `Resolve`, `Patch`, `Correct`
     - **Breaking**: contains `Break`, `Remove`, `Delete`, `Drop`
     - **Changed**: everything else (default category)
   - Keyword matching is case-insensitive and matches word boundaries (e.g., `Add` matches `Add` but also `Additive`).

4. **Private helpers:**
   - `_parseMilestoneSection(content, milestoneId)` -- returns the text block for the matching milestone
   - `_parseSetEntries(sectionText)` -- returns array of `{ setName, description }` from the `- [x]` lines
   - `_categorizeEntry(description)` -- returns the category string

5. **Edge cases:**
   - If milestoneId is not found in ROADMAP.md, return empty array (do not throw)
   - If ROADMAP.md has no set entries in the milestone, return empty array
   - Handle both `<details><summary>` wrapped milestones and heading-based milestones (`## Current Milestone:`)

6. **Export:** Add `extractChangelog` to the `module.exports` object.

**What NOT to do:**
- Do NOT use `child_process.execSync` for git log in this function -- changelog is derived from ROADMAP.md set descriptions only
- Do NOT fabricate entries -- every returned entry must correspond to a line in ROADMAP.md
- Do NOT include commit hashes, dates, or author info in entries

**Verification:**
```bash
node -e "const d = require('./src/lib/docs.cjs'); console.log(typeof d.extractChangelog)"
```
Expected: `function`

---

## Task 2: Create `src/commands/docs.cjs` command handler

**File:** `src/commands/docs.cjs`

**Action:** Create the command handler following the `compact.cjs` / `scaffold.cjs` pattern: `'use strict'`, import `CliError` from `errors.cjs` and `parseArgs` from `args.cjs`, export a single `handleDocs` function.

1. **Function signature:** `function handleDocs(cwd, subcommand, args)`

2. **Subcommands:**

   **`generate`** -- Generate or refresh documentation
   - Parse args with schema: `{ scope: 'string' }`
   - Valid scope values: `'full'`, `'changelog'`, `'api'`, `'architecture'`. Default to `'full'` if not provided.
   - Validate scope -- throw `CliError` for invalid values.
   - Call `scaffoldDocTemplates(cwd, scope)` from `../lib/docs.cjs` (lazy require).
   - Output JSON: `{ created: string[], scope: string }`
   - Write to stdout with `process.stdout.write(JSON.stringify(result) + '\n')`.

   **`list`** -- List existing documentation files
   - Read the `docs/` directory within `cwd` using `fs.readdirSync`.
   - If directory does not exist, output `{ files: [], count: 0 }`.
   - Filter for `.md` files only.
   - For each file, extract the `# Title` from the first line (or use filename if no title heading).
   - Output JSON: `{ files: [{ name, title, path }], count: number }`

   **`diff`** -- Show changelog diff for a milestone
   - Parse args: first positional argument is `milestoneId`. If missing, throw `CliError` with usage.
   - Call `extractChangelog(cwd, milestoneId)` from `../lib/docs.cjs` (lazy require).
   - Group entries by category (Added, Changed, Fixed, Breaking).
   - Output JSON: `{ milestone: string, entries: ChangelogEntry[], grouped: { Added: [], Changed: [], Fixed: [], Breaking: [] } }`

3. **Invalid subcommand:** Throw `CliError('Usage: rapid-tools docs <generate|list|diff> [options]')`.

4. **Lazy require:** Require `../lib/docs.cjs` inside each subcommand handler (not at top of file), following the `scaffold.cjs` pattern.

**What NOT to do:**
- Do NOT call `updateDocSection` from any CLI subcommand -- that function is used by the skill agent, not the CLI
- Do NOT perform git operations in this handler
- Do NOT call `process.exit()` -- let the router handle exits via CliError

**Verification:**
```bash
node -e "const { handleDocs } = require('./src/commands/docs.cjs'); console.log(typeof handleDocs)"
```
Expected: `function`

---

## Task 3: Register `docs` command in `src/bin/rapid-tools.cjs`

**File:** `src/bin/rapid-tools.cjs`

**Action:** Two modifications to wire the docs command into the CLI router.

1. **Add import** (after the `handleUiContract` import, line 26):
   ```js
   const { handleDocs } = require('../commands/docs.cjs');
   ```

2. **Add case** in the switch statement (before the `default:` case, after the `ui-contract` case around line 282):
   ```js
   case 'docs':
     handleDocs(cwd, subcommand, args.slice(2));
     break;
   ```
   Note: `handleDocs` is synchronous (no `await` needed) since it only does filesystem operations.

3. **Add usage entries** to the USAGE string (after the `ui-contract` entries, before the `migrate` entries):
   ```
     docs generate [--scope <s>]      Generate documentation templates (scope: full|changelog|api|architecture)
     docs list                         List existing documentation files
     docs diff <milestone>             Show changelog entries for a milestone
   ```

**What NOT to do:**
- Do NOT modify any existing case in the switch
- Do NOT change the handleDocs import location -- keep it alphabetically consistent with other imports
- Do NOT add `await` to the handleDocs call unless the handler is async (it is not)

**Verification:**
```bash
node src/bin/rapid-tools.cjs docs list 2>&1
```
Expected: JSON output with `files` array (may be empty if no docs/ in project root, but should not error).

---

## Task 4: Write unit tests for `extractChangelog`

**File:** `src/lib/docs.test.cjs` (append to existing wave 1 tests)

Add a new `describe('extractChangelog', ...)` block with these test cases:

1. **Extracts entries from a milestone section** -- create a tmpDir with a `.planning/ROADMAP.md` containing a sample milestone with 3 sets, call `extractChangelog`, verify 3 entries returned with correct setName and description.

2. **Categorizes 'Added' by keyword** -- entry with description starting with "Add" or "Build" or "Implement" gets category `'Added'`.

3. **Categorizes 'Fixed' by keyword** -- entry with description containing "Fix" gets category `'Fixed'`.

4. **Categorizes 'Changed' as default** -- entry without any special keyword gets category `'Changed'`.

5. **Categorizes 'Breaking' by keyword** -- entry containing "Remove" gets category `'Breaking'`.

6. **Returns empty array when milestoneId not found** -- call with a non-existent milestone, verify empty array returned, no throw.

7. **Returns empty array when ROADMAP.md does not exist** -- tmpDir with no `.planning/ROADMAP.md`, verify empty array, no throw.

8. **Handles details/summary wrapped milestones** -- ROADMAP.md with `<details><summary>v1.0 MVP ...` format, verify entries are extracted correctly.

9. **Handles heading-based milestone format** -- ROADMAP.md with `## Current Milestone: v3.4.0` format, verify entries are extracted.

10. **Never fabricates entries** -- ROADMAP.md with empty milestone section (no set lines), verify empty array returned.

**Test ROADMAP.md fixture format:**
```markdown
# Roadmap

<details>
<summary>v1.0 MVP (3 sets) -- shipped</summary>

- [x] auth-system -- Add user authentication with JWT tokens
- [x] api-gateway -- Build REST API gateway
- [x] bug-patch -- Fix login redirect loop

</details>
```

**Verification:**
```bash
node --test src/lib/docs.test.cjs 2>&1 | tail -5
```
Expected: All tests pass (including wave 1 tests).

---

## Task 5: Write unit tests for `handleDocs` command handler

**File:** `src/lib/docs.test.cjs` (append)

Add a new `describe('handleDocs', ...)` block. Since handleDocs writes to stdout, capture output by temporarily replacing `process.stdout.write`.

Test helper pattern:
```js
function captureStdout(fn) {
  let captured = '';
  const original = process.stdout.write;
  process.stdout.write = (chunk) => { captured += chunk; };
  try { fn(); } finally { process.stdout.write = original; }
  return captured;
}
```

Test cases:

1. **`generate` subcommand creates templates** -- call `handleDocs(tmpDir, 'generate', [])`, parse stdout JSON, verify `created` is an array and `scope` is `'full'`.

2. **`generate --scope changelog` filters scope** -- call with `['--scope', 'changelog']`, verify only CHANGELOG.md related output.

3. **`generate` with invalid scope throws CliError** -- call with `['--scope', 'invalid']`, verify CliError is thrown.

4. **`list` subcommand returns file list** -- create some .md files in tmpDir/docs/, call `handleDocs(tmpDir, 'list', [])`, verify output contains those files.

5. **`list` with no docs/ returns empty** -- call on tmpDir with no docs/ subdirectory, verify `{ files: [], count: 0 }`.

6. **`diff` subcommand returns changelog** -- create ROADMAP.md fixture in tmpDir, call `handleDocs(tmpDir, 'diff', ['v1.0'])`, verify entries in output.

7. **`diff` without milestone throws CliError** -- call `handleDocs(tmpDir, 'diff', [])`, verify CliError is thrown.

8. **Unknown subcommand throws CliError** -- call with `handleDocs(tmpDir, 'unknown', [])`, verify CliError.

**Verification:**
```bash
node --test src/lib/docs.test.cjs 2>&1 | tail -5
```
Expected: All tests pass.

---

## Success Criteria

1. `src/lib/docs.cjs` exports all three functions: `scaffoldDocTemplates`, `updateDocSection`, `extractChangelog`
2. `src/commands/docs.cjs` exports `handleDocs` with `generate`, `list`, `diff` subcommands
3. `src/bin/rapid-tools.cjs` routes `docs` command to `handleDocs`
4. `node src/bin/rapid-tools.cjs docs list` produces valid JSON output
5. `node src/bin/rapid-tools.cjs docs generate --scope full` creates template files
6. All tests pass: `node --test src/lib/docs.test.cjs`
7. Behavioral invariant `gitHistoryBased` from CONTRACT.json is enforced: `extractChangelog` only returns entries backed by ROADMAP.md lines (tests 6, 7, 10)
