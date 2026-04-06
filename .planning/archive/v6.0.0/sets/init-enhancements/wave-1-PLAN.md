# PLAN: init-enhancements / Wave 1 -- Principles Module Foundation

## Objective

Create the `src/lib/principles.cjs` module with three exported functions (`generatePrinciplesMd`, `generateClaudeMdSection`, `loadPrinciples`) and full unit test coverage in `src/lib/principles.test.cjs`. This module is the foundation for all principles-related features in Wave 2.

## Context

- The module follows the graceful-null pattern established by `tryLoadDAG()` in `src/lib/dag.cjs:288` -- `loadPrinciples()` returns `null` on ENOENT, re-throws other errors.
- PRINCIPLES.md uses category headers with bullet lists: `## Category` headers with `- **Statement** -- Rationale` items.
- The CLAUDE.md summary budget is **45 lines** (per CONTEXT.md override of the 15-line CONTRACT default). The summary always ends with a pointer to the full PRINCIPLES.md.
- 8 predefined categories: architecture, code style, testing, security, UX, performance, data handling, documentation.
- Principles data model: `Array<{category: string, statement: string, rationale: string}>`.

---

## Task 1: Create `src/lib/principles.cjs` with three exported functions

**Files:** `src/lib/principles.cjs` (new)

### 1A: Module structure and imports

Create `src/lib/principles.cjs` with the following structure:

```
'use strict';

const fs = require('fs');
const path = require('path');

// Constants
const PRINCIPLES_SUBPATH = '.planning/PRINCIPLES.md';
const PREDEFINED_CATEGORIES = [
  'architecture', 'code style', 'testing', 'security',
  'UX', 'performance', 'data handling', 'documentation'
];

module.exports = {
  generatePrinciplesMd,
  generateClaudeMdSection,
  loadPrinciples,
  PREDEFINED_CATEGORIES,
};
```

### 1B: `generatePrinciplesMd(principlesData)`

**Signature:** `generatePrinciplesMd(principlesData: Array<{category, statement, rationale}>): string`

**Behavior:**
- Takes an array of principle objects, each with `{category, statement, rationale}`.
- Returns a complete Markdown string for `.planning/PRINCIPLES.md`.
- Groups principles by category. Categories appear in a stable order: predefined categories first (in PREDEFINED_CATEGORIES order), then any custom categories alphabetically.
- Output format:

```markdown
# Project Principles

> Generated: {ISO date}
> Categories: {comma-separated list of categories present}
>
> These principles guide development decisions. Edit freely -- this file is the source of truth.
> Run `/rapid:init` to regenerate from scratch, or edit manually.

## Architecture

- **Prefer composition over inheritance** -- Composition provides flexibility and avoids deep class hierarchies that are hard to refactor.

## Code Style

- **Use strict mode everywhere** -- Prevents silent errors and makes debugging easier.
```

- Each principle renders as: `- **{statement}** -- {rationale}`
- Empty input array returns a valid document with the header and a note: "No principles captured yet."
- Validate input: if `principlesData` is not an array, throw a `TypeError` with message "principlesData must be an array".

### 1C: `generateClaudeMdSection(principlesData)`

**Signature:** `generateClaudeMdSection(principlesData: Array<{category, statement}>): string`

**Behavior:**
- Takes an array of principle objects (rationale is optional/ignored for the summary).
- Returns a compact Markdown string suitable for injection into worktree-scoped CLAUDE.md files.
- Budget: **max 45 lines** total (including the header and pointer).
- Format:

```markdown
## Project Principles

Key principles guiding this project (see `.planning/PRINCIPLES.md` for full details):

**Architecture:** Prefer composition over inheritance; Use dependency injection for testability
**Code Style:** Use strict mode everywhere
**Testing:** Test behavior not implementation
...

> Full principles with rationale: `.planning/PRINCIPLES.md`
```

- Each category gets one line: `**{Category}:** {statement1}; {statement2}; ...`
- If all principles fit within budget, include all. If they exceed 45 lines, truncate with `... and {N} more principles across {M} categories` before the pointer line.
- Empty input returns an empty string (no section generated).
- Categories appear in the same stable order as `generatePrinciplesMd`.

### 1D: `loadPrinciples(cwd)`

**Signature:** `loadPrinciples(cwd: string): Array<{category, statement, rationale}> | null`

**Behavior:**
- Reads `.planning/PRINCIPLES.md` from the given `cwd`.
- If the file does not exist (ENOENT), returns `null`. Does NOT log a warning -- callers handle the null case.
- If the file exists but cannot be read for other reasons, re-throws the error (same pattern as `tryLoadDAG`).
- Parses the Markdown format produced by `generatePrinciplesMd`:
  - `## Category` headers set the current category.
  - `- **Statement** -- Rationale` bullets within a category are parsed into `{category, statement, rationale}`.
  - Lines that don't match the bullet pattern are skipped (comments, blank lines, metadata header).
  - If rationale is missing (just `- **Statement**`), set rationale to empty string.
- Returns the parsed array. If the file exists but has no parseable principles, returns an empty array (not null).

**What NOT to do:**
- Do NOT use `JSON.parse` -- the file is Markdown, not JSON.
- Do NOT attempt to parse the metadata header block (the `>` blockquote lines).
- Do NOT return null for an existing but empty file -- null means "file does not exist".

---

## Task 2: Create `src/lib/principles.test.cjs` with full unit test coverage

**Files:** `src/lib/principles.test.cjs` (new)

Use the project's test conventions: Node.js built-in `assert` and `describe`/`it` from `node:test`. Follow the pattern in `src/lib/worktree.test.cjs` for temp directory setup.

### 2A: `generatePrinciplesMd` tests

Write tests covering:

1. **Basic generation** -- Single category, single principle. Verify output contains `# Project Principles`, `## Architecture`, and the bullet item.
2. **Multiple categories** -- Principles across 3+ categories. Verify categories appear in predefined order.
3. **Custom categories** -- A principle with category "compliance" (not predefined). Verify it appears after all predefined categories.
4. **Empty array** -- Returns valid document with "No principles captured yet."
5. **Invalid input** -- Non-array input throws `TypeError`.
6. **Metadata header** -- Output contains `Generated:` date and `Categories:` summary.
7. **Roundtrip** -- Generate Markdown, parse with `loadPrinciples`, verify data matches.

### 2B: `generateClaudeMdSection` tests

Write tests covering:

1. **Basic summary** -- Single category, single principle. Verify contains `## Project Principles` and the category-statement line.
2. **Multiple categories** -- Verify semicolon-separated statements per category.
3. **Empty array** -- Returns empty string.
4. **Line budget** -- Create 60+ principles across 20 categories. Verify output does not exceed 45 lines. Verify truncation message appears.
5. **Pointer line** -- Output always ends with pointer to `.planning/PRINCIPLES.md` (when non-empty).

### 2C: `loadPrinciples` tests

Write tests covering:

1. **File exists with principles** -- Write a PRINCIPLES.md via `generatePrinciplesMd`, then load. Verify parsed array matches original input.
2. **File does not exist** -- Returns `null`.
3. **File exists but empty/no principles** -- Write a minimal file with only the header. Returns empty array (not null).
4. **Parsing robustness** -- File with extra blank lines, comments, or non-standard formatting. Verify graceful handling (skip unparseable lines).
5. **Missing rationale** -- Principle bullet without `--` separator. Parsed with empty rationale string.
6. **ENOENT vs other errors** -- Mock a permission error. Verify it re-throws (not returns null). Use a path to a directory (reading a directory throws EISDIR, not ENOENT).

---

## Verification

```bash
cd /home/kek/Projects/RAPID && node --test src/lib/principles.test.cjs
```

All tests must pass. Zero failures, zero skipped.

## Success Criteria

- `src/lib/principles.cjs` exports `generatePrinciplesMd`, `generateClaudeMdSection`, `loadPrinciples`, `PREDEFINED_CATEGORIES`
- `generatePrinciplesMd` produces valid Markdown with category grouping and stable category ordering
- `generateClaudeMdSection` produces compact summary within 45-line budget
- `loadPrinciples` returns null for missing file, parsed array for existing file, re-throws non-ENOENT errors
- Roundtrip test passes (generate -> parse -> verify equality)
- All unit tests pass with `node --test src/lib/principles.test.cjs`

## Commit

```
feat(init-enhancements): add principles.cjs module with generation, summary, and parsing
```
