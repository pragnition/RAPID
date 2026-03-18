# Wave 1 PLAN: Core Schema, Validation, Consistency, and Context Builder

## Objective

Build the complete `ui-contract.cjs` library module and its JSON Schema definition file. This wave delivers all exported functions: `validateUiContract`, `checkUiConsistency`, and `buildUiContext`. It also creates the `src/schemas/` directory and comprehensive unit tests. After this wave, the entire public API surface exists and is tested -- Wave 2 only wires CLI and integration.

## File Ownership

| File | Action |
|------|--------|
| `src/schemas/ui-contract-schema.json` | Create |
| `src/lib/ui-contract.cjs` | Create |
| `src/lib/ui-contract.test.cjs` | Create |

## Task 1: Create the JSON Schema definition file

**File:** `src/schemas/ui-contract-schema.json`
**Action:** Create new file

Create the directory `src/schemas/` and write the JSON Schema (draft-07) that defines the structure of `UI-CONTRACT.json` files.

**Schema requirements:**
- `$schema`: `"http://json-schema.org/draft-07/schema#"`
- `type`: `"object"`
- `additionalProperties`: `false`
- `minProperties`: 1 (at least one section must be present)
- All 5 sections are optional top-level keys (no nesting categories):

### `guidelines` section
- `type`: `"object"` with properties:
  - `fontFamilies` (array of strings) -- font family names
  - `tone` (string) -- voice/tone description
  - `visualIdentity` (array of strings) -- branding rules, visual identity statements
- `additionalProperties`: `false`

### `components` section
- `type`: `"array"` of component objects
- Each component object has:
  - `name` (string, required)
  - `role` (string, enum: `["page", "layout", "widget"]`, required)
  - `children` (array, recursive reference to component object, optional)
- Use `$defs` (or `definitions`) with `$ref` for the recursive component schema

### `tokens` section
- `type`: `"object"` with `additionalProperties: { type: "string" }`
- This creates a flat key-value map where all values are strings (e.g., `{ "primary": "#3B82F6", "spacing-md": "16px" }`)

### `layout` section
- `type`: `"object"` with properties:
  - `grid` (object: `{ columns: number, gutter: string }`)
  - `breakpoints` (object with `additionalProperties: { type: "string" }` -- named breakpoint values e.g., `{ "sm": "640px", "md": "768px" }`)
  - `containerWidths` (object with `additionalProperties: { type: "string" }` -- e.g., `{ "sm": "100%", "lg": "1200px" }`)
  - `responsive` (array of strings -- responsive behavior rules)
- `additionalProperties`: `false`

### `interactions` section
- `type`: `"object"` with properties:
  - `stateTransitions` (array of strings)
  - `animations` (array of strings)
  - `loadingPatterns` (array of strings)
  - `errorStates` (array of strings)
  - `accessibility` (array of strings)
- `additionalProperties`: `false`

**Verification:** `node -e "const s = require('./src/schemas/ui-contract-schema.json'); const Ajv = require('ajv').default; const ajv = new Ajv(); ajv.compile(s); console.log('Schema compiles')"`

## Task 2: Create the core ui-contract.cjs module

**File:** `src/lib/ui-contract.cjs`
**Action:** Create new file

Create the core module following the `contract.cjs` and `quality.cjs` patterns. The module provides all 3 exported functions plus the inline schema reference.

### Structure:

```
'use strict';

const Ajv = require('ajv').default;
const fs = require('fs');
const path = require('path');
const { estimateTokens } = require('./tool-docs.cjs');
```

### `validateUiContract(contract)`
- Load the schema from `../schemas/ui-contract-schema.json` using `require()`
- Compile it with a dedicated Ajv instance (like `contract.cjs` does with `metaAjv`)
- Validate the passed `contract` object
- Return `{ valid: true }` on success
- Return `{ valid: false, errors: [...] }` on failure, where errors are formatted strings from Ajv errors (path + message pattern from `contract.cjs:125-128`)
- Cache the compiled validator in a module-level variable (compile once, validate many times)

### `checkUiConsistency(cwd, milestoneId)`
- `milestoneId` parameter is accepted but unused in current implementation (reserved for future milestone scoping) -- document this
- Use `resolveProjectRoot` from `./plan.cjs` to get the true project root
- Use `listSets` from `./plan.cjs` to enumerate all sets
- For each set, check if `.planning/sets/<setName>/UI-CONTRACT.json` exists; if so, read and validate it
- Skip sets with no UI-CONTRACT.json (they simply have no UI)
- Skip sets whose UI-CONTRACT.json fails schema validation (report as a separate error, not a conflict)
- Check 4 conflict types across all valid UI contracts:

  1. **Duplicate component names with different roles**: Collect all component names (recursively including children) across all sets. If the same name appears in two different sets with different `role` values, that is a conflict.
  2. **Token contradictions**: If two sets define the same token key with different values, that is a conflict.
  3. **Layout incompatibility**: If two sets define `breakpoints` and the same breakpoint name maps to different values, that is a conflict. Same for `grid.columns` or `grid.gutter` disagreement.
  4. **Guideline drift**: If two sets both define `guidelines.tone` with different values (case-insensitive comparison), that is a conflict.

- Return `{ consistent: true, conflicts: [] }` when no conflicts found
- Return `{ consistent: false, conflicts: [...] }` with conflict objects shaped as:
  ```
  { type: "component" | "token" | "layout" | "guideline", sets: [setA, setB], key: string, details: string }
  ```

### `buildUiContext(cwd, setName)`
- Use `resolveProjectRoot` from `./plan.cjs` to get the true project root
- Read `.planning/sets/<setName>/UI-CONTRACT.json`
- If the file does not exist, return `''` (empty string)
- If the file fails validation, return `''`
- Build a markdown-formatted context string with sections in truncation priority order:
  1. `## UI Contract` header
  2. `### Guidelines` -- format guidelines fields as bullet points
  3. `### Design Tokens` -- format as a key: value table
  4. `### Components` -- format component tree with indentation for children
  5. `### Layout` -- format grid, breakpoints, container widths
  6. `### Interactions` -- list interaction patterns
- Use 4000 token budget with `estimateTokens` from `tool-docs.cjs`
- Truncation strategy: Build sections in priority order. After each section, check if adding the next would exceed budget. If so, stop and append `[...truncated to fit token budget]`
- Return the assembled string

### Module exports:
```
module.exports = { validateUiContract, checkUiConsistency, buildUiContext };
```

**Do NOT:**
- Modify `contract.cjs` or any existing module
- Add any new npm dependencies
- Use `ajv-formats` -- plain Ajv is sufficient
- Import from `core.cjs` in the library module (library modules are pure; CLI handlers do output formatting)

**Verification:** `node -e "const uc = require('./src/lib/ui-contract.cjs'); console.log(Object.keys(uc));"` should print `['validateUiContract', 'checkUiConsistency', 'buildUiContext']`

## Task 3: Create comprehensive unit tests

**File:** `src/lib/ui-contract.test.cjs`
**Action:** Create new file

Follow the project test pattern: `node:test` with `describe`/`it`/`beforeEach`/`afterEach`, `node:assert/strict`, `os.tmpdir()` + `fs.mkdtempSync` for temp dirs, cleanup in `afterEach`.

### Test structure:

**describe('validateUiContract')**
- `it('accepts a valid complete UI contract')` -- all 5 sections present with valid data
- `it('accepts a minimal UI contract with only tokens')` -- single section present
- `it('accepts a contract with only guidelines')` -- single section
- `it('accepts a contract with recursive component children')` -- nested children
- `it('rejects an empty object')` -- `{}` should fail due to `minProperties: 1`
- `it('rejects unknown top-level properties')` -- `{ unknownKey: {} }` should fail
- `it('rejects invalid component role')` -- role value not in enum
- `it('rejects non-string token values')` -- token value as number
- `it('returns formatted error strings')` -- verify error array contents are strings

**describe('checkUiConsistency')**

Setup: Create a temp directory structure mimicking `.planning/sets/` with multiple sets, each having `UI-CONTRACT.json`.

- `it('returns consistent when no UI contracts exist')` -- empty sets dir
- `it('returns consistent when only one set has a UI contract')` -- no cross-set conflicts possible
- `it('detects duplicate component names with different roles')` -- set-a has component "Header" as "layout", set-b has "Header" as "widget"
- `it('detects token contradictions')` -- set-a has `{ "primary": "#3B82F6" }`, set-b has `{ "primary": "#FF0000" }`
- `it('detects layout breakpoint conflicts')` -- set-a has `{ "sm": "640px" }`, set-b has `{ "sm": "600px" }`
- `it('detects guideline tone drift')` -- set-a tone "professional", set-b tone "casual"
- `it('ignores sets without UI-CONTRACT.json')` -- mixed sets
- `it('skips sets with invalid UI-CONTRACT.json')` -- malformed JSON is skipped, not a conflict
- `it('returns multiple conflicts when several exist')` -- verify conflicts array has length > 1

**describe('buildUiContext')**

Setup: Create temp dir with `.planning/sets/<set>/UI-CONTRACT.json`.

- `it('returns empty string when UI-CONTRACT.json does not exist')`
- `it('returns empty string when UI-CONTRACT.json is invalid')`
- `it('includes guidelines section in output')`
- `it('includes tokens as key-value pairs')`
- `it('includes component hierarchy with indentation')`
- `it('respects 4000 token budget and truncates')` -- create a contract with very large content, verify output fits within budget
- `it('truncates in priority order: guidelines kept, interactions dropped')` -- verify guidelines section is present, interactions absent when budget is tight

**Important test setup notes:**
- The temp dir must have a `.planning/sets/` structure for `checkUiConsistency` and `buildUiContext` to work
- Since these functions use `resolveProjectRoot` which relies on git, and temp dirs are not git repos, the code must handle the fallback path where `resolveProjectRoot` returns `cwd`. The tests should set up temp dirs with `.planning/sets/` directly so the fallback works correctly.
- Clean up all temp dirs in `afterEach` using `fs.rmSync(tmpDir, { recursive: true, force: true })`

**Verification:** `node --test src/lib/ui-contract.test.cjs`

## Success Criteria
1. `src/schemas/ui-contract-schema.json` exists and compiles with Ajv without errors
2. `src/lib/ui-contract.cjs` exports `validateUiContract`, `checkUiConsistency`, `buildUiContext`
3. All unit tests in `src/lib/ui-contract.test.cjs` pass
4. No existing files are modified
5. No new npm dependencies added
