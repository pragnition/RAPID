# Wave 1 PLAN: Foundation -- Core Library Module

## Objective

Create `src/lib/docs.cjs` with the two foundational functions (`scaffoldDocTemplates` and `updateDocSection`) and their unit tests. These two functions have no dependencies on each other and form the building blocks for the full documentation pipeline. Wave 1 establishes the diff-aware markdown section replacement engine and the idempotent template scaffolder -- both are heavily tested to enforce behavioral invariants from CONTRACT.json.

## File Ownership

| File | Action |
|------|--------|
| `src/lib/docs.cjs` | Create (partial -- scaffoldDocTemplates + updateDocSection only) |
| `src/lib/docs.test.cjs` | Create (tests for wave 1 functions only) |

---

## Task 1: Create `src/lib/docs.cjs` with `scaffoldDocTemplates`

**File:** `src/lib/docs.cjs`

**Action:** Create the module file following the `quality.cjs` pattern: `'use strict'`, CJS `module.exports` at bottom, private helpers prefixed with `_`, JSDoc on public functions.

Implement `scaffoldDocTemplates(cwd, scope)`:

1. **Parameters:**
   - `cwd` (string) -- project root directory
   - `scope` (string) -- one of `'full'`, `'changelog'`, `'api'`, `'architecture'`. Defaults to `'full'` if falsy.

2. **Template definitions:** Define a constant `DOC_TEMPLATES` object mapping scope to arrays of `{ filename, title, sections }` objects. The 9 existing doc files are: `setup.md`, `planning.md`, `execution.md`, `agents.md`, `configuration.md`, `merge-and-cleanup.md`, `review.md`, `state-machines.md`, `troubleshooting.md`. Each template entry specifies:
   - `filename` -- e.g., `'setup.md'`
   - `title` -- e.g., `'Setup'`
   - `sections` -- array of `{ heading, placeholder }` objects. Headings are `##` level. Placeholder is a one-sentence description of what goes in the section.

3. **Scope filtering:**
   - `'full'` -- all 9 templates
   - `'changelog'` -- only `CHANGELOG.md`
   - `'api'` -- subset: `agents.md`, `configuration.md`, `state-machines.md`
   - `'architecture'` -- subset: `setup.md`, `planning.md`, `execution.md`, `merge-and-cleanup.md`, `review.md`, `troubleshooting.md`

4. **Idempotency guard:** For each template, check `fs.existsSync(path.join(cwd, 'docs', filename))`. If the file already exists, skip it. Never overwrite.

5. **Directory creation:** Ensure `docs/` directory exists with `fs.mkdirSync(path.join(cwd, 'docs'), { recursive: true })`.

6. **Template content generation:** Use a private helper `_renderTemplate(title, sections)` that produces:
   ```
   # {title}

   ## {section1.heading}

   {section1.placeholder}

   ## {section2.heading}

   ...
   ```

7. **Return value:** Array of absolute paths of files that were actually created (not skipped).

**What NOT to do:**
- Do NOT read existing files to merge content -- only check existence
- Do NOT use any external markdown parser -- string concatenation only
- Do NOT include CHANGELOG.md in the 'full' scope templates array -- it is only in 'changelog' scope

**Verification:**
```bash
node -e "const d = require('./src/lib/docs.cjs'); console.log(typeof d.scaffoldDocTemplates)"
```
Expected: `function`

---

## Task 2: Implement `updateDocSection` in `src/lib/docs.cjs`

**File:** `src/lib/docs.cjs` (append to existing content from Task 1)

**Action:** Add `updateDocSection(docPath, sectionId, newContent)` to the module.

1. **Parameters:**
   - `docPath` (string) -- absolute path to the markdown file
   - `sectionId` (string) -- heading text to match (e.g., `'Setup'`, `'Commands'`). Matched case-insensitively against heading text.
   - `newContent` (string) -- new content for the section (everything between the matched heading and the next heading of same or higher level)

2. **Algorithm** (implement as private helper `_splitBySections(content)`):
   - Read the file as UTF-8 string
   - Split into sections using the regex `/^(#{1,6})\s+(.+)$/m` to find heading boundaries
   - Each section is `{ level, title, content, startIndex, endIndex }`
   - Preserve any content before the first heading as a "preamble" section (for frontmatter or intro text)

3. **Section matching:**
   - Find the first section whose title matches `sectionId` case-insensitively (trim both before comparing)
   - The section's content extends from the end of the heading line to the start of the next heading of the same or higher (lower number) level, or end of file

4. **Replacement:**
   - Replace only the matched section's content (not its heading) with `newContent`
   - Ensure a single newline after the heading and before the new content
   - Ensure a single newline after the new content before the next heading
   - Preserve the original heading line exactly (including its `#` level and text)

5. **Section not found:**
   - Append the new section at the end of the document: `\n\n## {sectionId}\n\n{newContent}\n`
   - Use `##` level for appended sections

6. **Return value:** `{ updated: boolean, diff: string }`
   - `updated` -- `true` if the file was modified, `false` if newContent was identical to existing content
   - `diff` -- human-readable string showing old vs new section content. Format: `"--- old\n+++ new\n{oldContent}\n---\n{newContent}"`. Empty string if not updated.

7. **File write:** Write the reassembled content back using `fs.writeFileSync(docPath, result, 'utf-8')`.

**What NOT to do:**
- Do NOT use any npm markdown parser -- implement heading-based splitting with regex
- Do NOT modify line endings (preserve `\n` vs `\r\n` if present in source, though prefer `\n`)
- Do NOT read the file more than once per call
- Do NOT modify any section other than the matched one

**Verification:**
```bash
node -e "const d = require('./src/lib/docs.cjs'); console.log(typeof d.updateDocSection)"
```
Expected: `function`

---

## Task 3: Write unit tests for `scaffoldDocTemplates`

**File:** `src/lib/docs.test.cjs`

**Action:** Create the test file following the `quality.test.cjs` pattern: `node:test` `describe`/`it`, `node:assert/strict`, temp directories with `fs.mkdtempSync`, cleanup in `afterEach`.

Test cases for `scaffoldDocTemplates`:

1. **Creates all 9 template files for 'full' scope** -- call with `scope='full'`, verify all 9 files exist in `docs/` subdirectory. Verify each file starts with `# {Title}` heading.

2. **Returns array of created file paths** -- verify the return value is an array of 9 absolute paths, each pointing to an existing file.

3. **Never overwrites existing files (idempotency)** -- create a `docs/setup.md` with custom content, call `scaffoldDocTemplates`, verify `setup.md` content is unchanged and it is not in the returned array.

4. **Idempotent on second call** -- call twice, second call should return empty array (all files already exist).

5. **Creates docs/ directory if missing** -- pass a tmpDir with no `docs/` subdirectory, verify it is created.

6. **'changelog' scope creates only CHANGELOG.md** -- verify only `CHANGELOG.md` is created, not the 9 guide files.

7. **'api' scope creates correct subset** -- verify `agents.md`, `configuration.md`, `state-machines.md` are created and nothing else.

8. **'architecture' scope creates correct subset** -- verify the architecture files are created and nothing else.

9. **Default scope is 'full' when null/undefined** -- call with `scope=null`, verify all 9 files created.

10. **Template content has proper heading structure** -- read a created file, verify it contains `#` title heading and `##` section headings with placeholder text.

**Verification:**
```bash
node --test src/lib/docs.test.cjs 2>&1 | tail -5
```
Expected: All tests pass.

---

## Task 4: Write unit tests for `updateDocSection`

**File:** `src/lib/docs.test.cjs` (append to file from Task 3)

Test cases for `updateDocSection`:

1. **Replaces a matching section by heading** -- create a file with `## Foo\nold content\n## Bar\nbar content`, call `updateDocSection(path, 'Foo', 'new content')`, verify `## Foo` section has new content and `## Bar` is unchanged.

2. **Preserves all non-targeted sections byte-for-byte** -- create a file with 4 sections, update one, read back the file, verify the other 3 sections are identical character-for-character.

3. **Case-insensitive heading match** -- create with `## SETUP`, call with `sectionId='setup'`, verify it matches and updates.

4. **Appends section when heading not found** -- create a file with no `## NewSection`, call `updateDocSection(path, 'NewSection', 'content')`, verify `## NewSection` is appended at end of file.

5. **Returns updated:false when content is identical** -- call with the same content that already exists, verify `{ updated: false, diff: '' }`.

6. **Returns updated:true with diff when content changes** -- verify `diff` string contains old and new content.

7. **Handles nested headings correctly** -- create file with `## Parent\nparent text\n### Child\nchild text\n## Sibling\nsibling text`, update `Parent`, verify `### Child` is replaced (it is within Parent's scope) but `## Sibling` is preserved.

8. **Preserves preamble/frontmatter** -- create file starting with text before any heading, update a later section, verify preamble is unchanged.

9. **Handles file with single section** -- file with only one heading and content, update it, verify correctness.

10. **Handles empty new content** -- pass empty string as newContent, verify section content is replaced with empty (heading preserved).

**Verification:**
```bash
node --test src/lib/docs.test.cjs 2>&1 | tail -5
```
Expected: All tests pass.

---

## Success Criteria

1. `src/lib/docs.cjs` exports `scaffoldDocTemplates` and `updateDocSection` (and will export `extractChangelog` in wave 2)
2. `src/lib/docs.test.cjs` contains all 20 test cases above and all pass
3. `node -e "const d = require('./src/lib/docs.cjs'); console.log(Object.keys(d))"` outputs the two function names
4. Behavioral invariants from CONTRACT.json are enforced:
   - `templateIdempotent`: running `scaffoldDocTemplates` multiple times never overwrites existing templates (tests 3, 4)
   - `diffAware`: `updateDocSection` modifies only the changed section; unchanged sections are preserved exactly as-is (tests 1, 2, 7, 8)
