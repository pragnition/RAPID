# Wave 1 PLAN: Foundation -- Quality Profile Loader & Template Generation

## Objective

Create the core quality module (`src/lib/quality.cjs`) with the foundational capability: loading a project quality profile from `.planning/context/QUALITY.md` or generating a stack-aware default. Also create the curated PATTERNS.md template. This wave establishes the data model and file I/O that waves 2 and 3 build upon.

## File Ownership

| File | Action |
|------|--------|
| `src/lib/quality.cjs` | **Create** |
| `src/lib/quality.test.cjs` | **Create** |

---

## Task 1: Create `src/lib/quality.cjs` with `loadQualityProfile()` and template generators

### What to implement

Create `src/lib/quality.cjs` following the exact module structure convention from CONVENTIONS.md:

```
'use strict' -> requires -> constants -> public API -> internal helpers -> module.exports
```

**Constants:**

- `QUALITY_FILE = 'QUALITY.md'` -- filename within `.planning/context/`
- `PATTERNS_FILE = 'PATTERNS.md'` -- filename within `.planning/context/`
- `DEFAULT_TOKEN_BUDGET = 10000` -- default token budget for quality context
- `CONTEXT_DIR = path.join('.planning', 'context')` -- relative path to context directory

**Internal helpers to implement:**

1. `_getContextDir(cwd)` -- Returns absolute path to `.planning/context/` for the given project root.

2. `_ensureContextDir(cwd)` -- Creates `.planning/context/` directory if it does not exist (use `fs.mkdirSync` with `{ recursive: true }`). Same pattern as `ensureMemoryDir()` in `memory.cjs`.

3. `_detectStack(cwd)` -- Detect project tech stack by importing `detectCodebase` from `./context.cjs`. Call `detectCodebase(cwd)` and return its result. This is a thin wrapper that isolates the dependency for testability. If `context.cjs` is not available or throws, return a fallback object: `{ hasSourceCode: false, languages: [], frameworks: [], configFiles: [], sourceStats: {} }`.

4. `_generateDefaultQualityMd(stackInfo)` -- Generate default QUALITY.md content as a string based on detected stack. The generated markdown must have this exact structure:

   ```markdown
   # Quality Profile

   ## Approved Patterns

   ### General
   - [list of general approved patterns based on detected languages]

   ### [Language-specific section, e.g., "JavaScript" or "Python"]
   - [language-specific approved patterns]

   ### [Framework-specific section if frameworks detected]
   - [framework-specific approved patterns]

   ## Anti-Patterns

   ### General
   - [general anti-patterns to avoid]

   ### [Language-specific anti-patterns]
   - [language-specific anti-patterns to avoid]
   ```

   Rules for default generation:
   - If `stackInfo.languages` includes `'javascript'` or `'typescript'`, include JS/TS patterns (prefer const, use strict mode, handle promise rejections, avoid any type in TS)
   - If `stackInfo.languages` includes `'python'`, include Python patterns (type hints, context managers, avoid bare except)
   - If `stackInfo.languages` includes `'go'`, include Go patterns (error wrapping, context propagation)
   - If `stackInfo.languages` includes `'rust'`, include Rust patterns (Result over panic, derive traits)
   - If `stackInfo.frameworks` includes framework names, add framework-specific sections
   - If no languages detected (`stackInfo.languages` is empty), generate a minimal "General" section only
   - Always include a "General" subsection under both Approved Patterns and Anti-Patterns

5. `_generateDefaultPatternsMd(stackInfo)` -- Generate default PATTERNS.md content as a string. Structure:

   ```markdown
   # Pattern Library

   ## Error Handling
   ### Approved
   - [pattern with brief code example]
   ### Anti-Patterns
   - [anti-pattern with explanation]

   ## State Management
   ### Approved
   - [patterns]
   ### Anti-Patterns
   - [anti-patterns]

   ## Testing
   ### Approved
   - [patterns]
   ### Anti-Patterns
   - [anti-patterns]

   ## API Design
   ### Approved
   - [patterns]
   ### Anti-Patterns
   - [anti-patterns]
   ```

   Include domain-specific patterns tailored to the detected stack. If no stack detected, include only general patterns applicable to any language.

6. `_parseQualityMd(content)` -- Parse QUALITY.md markdown content into a structured `QualityProfile` object. Use heading-based section splitting (split on `## ` for top-level sections, `### ` for subsections). Return:

   ```javascript
   {
     approvedPatterns: {
       general: ['pattern1', 'pattern2'],
       // language-specific keys like 'javascript', 'python', etc.
     },
     antiPatterns: {
       general: ['anti-pattern1', 'anti-pattern2'],
       // language-specific keys
     },
     raw: content, // original markdown string for token budgeting
   }
   ```

   Parsing rules:
   - Lines under `## Approved Patterns` -> `approvedPatterns`
   - Lines under `## Anti-Patterns` -> `antiPatterns`
   - `### General` subsection -> `general` key
   - `### [Name]` subsections -> lowercase name as key (e.g., `### JavaScript` -> `javascript`)
   - Each bullet point (`- `) is one pattern entry (strip the `- ` prefix)
   - Skip empty lines and non-bullet lines within sections
   - If sections are missing or malformed, return empty arrays for the missing parts (graceful degradation)

**Public API to implement:**

1. `loadQualityProfile(cwd)` -- Main entry point. Logic:
   - Call `_ensureContextDir(cwd)`
   - Check if `QUALITY.md` exists at `path.join(_getContextDir(cwd), QUALITY_FILE)`
   - If exists: read it and call `_parseQualityMd(content)` to return the parsed profile
   - If does not exist: call `_detectStack(cwd)`, then `_generateDefaultQualityMd(stackInfo)`, write the generated content to the QUALITY.md path, then parse and return it
   - Also check PATTERNS.md: if it does not exist, call `_generateDefaultPatternsMd(stackInfo)` and write it. (stackInfo should be detected once and reused)
   - Return the parsed QualityProfile object

**What NOT to do:**
- Do NOT export internal helpers (prefix them with `_`)
- Do NOT import `estimateTokens` yet -- that is used in wave 2
- Do NOT implement `buildQualityContext` or `checkQualityGates` yet -- those are wave 2
- Do NOT modify any existing files -- this task only creates new files

### Files to create/modify
- **Create:** `src/lib/quality.cjs`

### Verification
```bash
node -e "const q = require('./src/lib/quality.cjs'); console.log(Object.keys(q));"
# Should output array containing at least: loadQualityProfile
```

---

## Task 2: Create comprehensive unit tests for `quality.cjs` wave 1 functions

### What to implement

Create `src/lib/quality.test.cjs` using the project's testing conventions:
- `node:test` with `describe/it/beforeEach/afterEach`
- `assert/strict` for assertions
- tmpdir setup/teardown pattern from `memory.test.cjs`

**Test helper:**

```javascript
function makeTmpDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-quality-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'context'), { recursive: true });
  return tmpDir;
}
```

**Test groups to implement:**

### `describe('loadQualityProfile')`

1. `it('should create .planning/context/ directory if it does not exist')` -- Remove the context dir after makeTmpDir, call loadQualityProfile, verify directory was created.

2. `it('should generate default QUALITY.md when file does not exist')` -- Call loadQualityProfile on a tmpdir with no QUALITY.md. Verify the file was created and contains `# Quality Profile`, `## Approved Patterns`, and `## Anti-Patterns`.

3. `it('should generate default PATTERNS.md when file does not exist')` -- Same as above but verify PATTERNS.md was created with `# Pattern Library` heading.

4. `it('should parse existing QUALITY.md instead of generating default')` -- Write a custom QUALITY.md to the tmpdir with known content, call loadQualityProfile, verify the returned profile contains the custom patterns (not default ones).

5. `it('should return approvedPatterns and antiPatterns in parsed profile')` -- Write a QUALITY.md with known patterns, call loadQualityProfile, verify the returned object has `approvedPatterns.general` and `antiPatterns.general` as arrays with the expected entries.

6. `it('should preserve raw markdown in profile.raw')` -- Verify the `raw` field contains the full original markdown content.

7. `it('should detect javascript stack and include JS patterns in default')` -- Create a `package.json` in tmpdir, call loadQualityProfile, verify the generated QUALITY.md contains JavaScript-specific patterns.

8. `it('should generate minimal profile when no stack detected')` -- Call loadQualityProfile on empty tmpdir (no manifest files). Verify profile has at least a `general` key with patterns.

9. `it('should not overwrite existing QUALITY.md on second call')` -- Write custom QUALITY.md, call loadQualityProfile twice, verify the file content did not change after the second call.

### `describe('_parseQualityMd (via loadQualityProfile)')`

Test parsing indirectly through loadQualityProfile by providing various QUALITY.md inputs:

10. `it('should handle QUALITY.md with only general sections')` -- Write QUALITY.md with only `### General` subsections, verify parsing works.

11. `it('should handle QUALITY.md with multiple language sections')` -- Write QUALITY.md with `### JavaScript` and `### Python` subsections, verify both are parsed into correct keys.

12. `it('should handle malformed QUALITY.md gracefully')` -- Write QUALITY.md with missing sections or incorrect heading levels, verify no errors thrown and empty arrays returned for missing parts.

13. `it('should handle empty QUALITY.md')` -- Write an empty file, verify loadQualityProfile returns a profile with empty pattern arrays and empty raw string.

**What NOT to do:**
- Do NOT test `buildQualityContext` or `checkQualityGates` -- those are wave 2
- Do NOT mock `context.cjs` internals -- test with real file system state (presence/absence of manifest files)
- Do NOT import internal helpers directly -- test through the public API

### Files to create/modify
- **Create:** `src/lib/quality.test.cjs`

### Verification
```bash
node --test src/lib/quality.test.cjs
# All tests should pass
```

---

## Success Criteria

1. `node --test src/lib/quality.test.cjs` passes all tests (0 failures)
2. `loadQualityProfile()` generates default QUALITY.md with stack-aware patterns when the file does not exist
3. `loadQualityProfile()` parses existing QUALITY.md into a structured `QualityProfile` object
4. PATTERNS.md is generated with domain-categorized patterns on first load
5. Module follows CONVENTIONS.md structure exactly (`'use strict'`, CommonJS, `_`-prefixed internals, exports at bottom)
6. No existing files are modified in this wave
