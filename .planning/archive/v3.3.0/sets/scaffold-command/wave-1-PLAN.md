# Wave 1 Plan: Core Scaffold Engine

## Objective

Build the core scaffold library module (`src/lib/scaffold.cjs`) that classifies project types from `detectCodebase()` output, defines per-archetype per-language templates, generates files additively (skip-if-exists), and returns a `ScaffoldReport`. This wave also produces comprehensive unit tests (`src/lib/scaffold.test.cjs`) proving all core behaviors.

## Task 1: Project Type Classifier

**File:** `src/lib/scaffold.cjs`

Create the new module with the project type classification function.

### Implementation

1. Define the four project archetypes as a constant:
   ```
   const PROJECT_TYPES = ['webapp', 'api', 'library', 'cli'];
   ```

2. Implement `classifyProjectType(codebaseInfo)` that takes the output of `detectCodebase()` (shape: `{ hasSourceCode, languages[], frameworks[], configFiles[], sourceStats }`) and returns `{ type: string|null, confidence: 'high'|'medium'|'low', ambiguous: boolean, candidates: string[] }`.

3. Classification rules (apply in order, first match wins for high confidence):
   - **webapp**: frameworks includes `react`, `vue`, `angular`, `next` (next is webapp despite API routes)
   - **api**: frameworks includes `express`, `fastify`, `koa`, `nest`, `django`, `flask`, `fastapi`
   - **cli**: Parse `package.json` at `cwd` if it exists -- check for `bin` field presence. For Python, check for `console_scripts` in `pyproject.toml` (string search for `[project.scripts]` or `console_scripts`). For Go/Rust, check for `main.go` or `src/main.rs` in the file system.
   - **library**: Has source code but none of the above signals. Default fallback when `hasSourceCode` is true.
   - **null**: `hasSourceCode` is false (nothing to scaffold).

4. Ambiguity detection: If multiple types match (e.g., Next.js triggers both webapp and api), set `ambiguous: true` and populate `candidates` with all matching types. The first match by rule order becomes `type`.

5. The `classifyProjectType` function takes a second argument `cwd` (string) for file system lookups (package.json bin field, main.go existence). Signature: `classifyProjectType(codebaseInfo, cwd)`.

6. Export `classifyProjectType` from the module.

### What NOT to do
- Do NOT import or call `detectCodebase` inside this function -- it receives the result as a parameter.
- Do NOT make the function async -- all checks use `fs.existsSync` and `fs.readFileSync`.

### Verification
```bash
node -e "const { classifyProjectType } = require('./src/lib/scaffold.cjs'); console.log(typeof classifyProjectType)"
```
Expected: `function`

---

## Task 2: Template Definitions

**File:** `src/lib/scaffold.cjs` (append to same file)

### Implementation

1. Define a `TEMPLATES` object keyed by `[projectType][language]`, where each entry is an array of file descriptors:
   ```
   { path: 'relative/path/to/file', content: 'file content string' }
   ```

2. Implement templates for the following combinations (primary focus on JavaScript, secondary on Python):

   **JavaScript webapp:**
   - `src/index.js` -- minimal entry point with `console.log('App started')`
   - `src/App.js` -- placeholder component/page
   - `public/index.html` -- basic HTML shell
   - `.gitignore` -- node_modules, dist, coverage, .env
   - `jest.config.js` -- basic test config (`testMatch: ['**/*.test.js']`)

   **JavaScript api:**
   - `src/index.js` -- minimal express/http server setup
   - `src/routes/index.js` -- placeholder route file
   - `src/middleware/index.js` -- placeholder middleware
   - `.gitignore` -- node_modules, dist, coverage, .env
   - `jest.config.js` -- basic test config

   **JavaScript library:**
   - `src/index.js` -- module entry with placeholder export
   - `src/lib/index.js` -- placeholder lib barrel
   - `.gitignore` -- node_modules, dist, coverage
   - `jest.config.js` -- basic test config

   **JavaScript cli:**
   - `src/bin/cli.js` -- minimal CLI entry with `#!/usr/bin/env node` shebang
   - `src/commands/index.js` -- placeholder command registry
   - `src/lib/index.js` -- placeholder lib module
   - `.gitignore` -- node_modules, dist, coverage

   **Python webapp:**
   - `app/__init__.py` -- empty init
   - `app/main.py` -- minimal WSGI/ASGI placeholder
   - `app/templates/base.html` -- basic HTML template
   - `.gitignore` -- __pycache__, .venv, *.pyc, dist, .env
   - `pytest.ini` -- basic pytest config

   **Python api:**
   - `app/__init__.py` -- empty init
   - `app/main.py` -- minimal API placeholder
   - `app/routes/__init__.py` -- empty init for routes
   - `.gitignore` -- __pycache__, .venv, *.pyc, dist, .env
   - `pytest.ini` -- basic pytest config

   **Python library:**
   - `src/__init__.py` -- empty init
   - `src/core.py` -- placeholder module
   - `tests/__init__.py` -- empty init
   - `.gitignore` -- __pycache__, .venv, *.pyc, dist
   - `pytest.ini` -- basic pytest config

   **Python cli:**
   - `src/__init__.py` -- empty init
   - `src/cli.py` -- minimal CLI entry with argparse
   - `src/commands/__init__.py` -- empty init
   - `.gitignore` -- __pycache__, .venv, *.pyc, dist

3. For languages other than JavaScript and Python, provide a minimal fallback template per project type containing only a `.gitignore` and a `README.md` placeholder.

4. Define a `getTemplates(projectType, language)` function that returns the template array. Falls back to the generic template if no specific language match exists.

5. Export `getTemplates` and `TEMPLATES`.

### What NOT to do
- Do NOT use external template files -- embed all content as string literals in the module.
- Do NOT include `package.json` or `pyproject.toml` generation in templates -- these are existing manifests the user already has.
- Keep template contents minimal (5-15 lines per file). These are starters, not full implementations.

### Verification
```bash
node -e "const { getTemplates } = require('./src/lib/scaffold.cjs'); const t = getTemplates('webapp', 'javascript'); console.log(t.length > 0 ? 'OK: ' + t.length + ' templates' : 'FAIL')"
```
Expected: `OK: 5 templates` (or similar count)

---

## Task 3: Scaffold Engine (additive file generation)

**File:** `src/lib/scaffold.cjs` (append to same file)

### Implementation

1. Implement `generateScaffold(cwd, projectType, language)` that:
   - Calls `getTemplates(projectType, language)` to get the file list
   - For each template file:
     - Compute the absolute path: `path.join(cwd, template.path)`
     - Check if the file already exists with `fs.existsSync(absPath)`
     - If exists: add to `filesSkipped[]` with `{ path: template.path, reason: 'already exists' }`
     - If not exists: create parent directories with `fs.mkdirSync(dir, { recursive: true })`, write the file with `fs.writeFileSync(absPath, template.content)`, add to `filesCreated[]`
   - Return a `ScaffoldReport` object

2. Define the `ScaffoldReport` shape:
   ```
   {
     projectType: string,       // e.g., 'webapp'
     language: string,          // e.g., 'javascript'
     filesCreated: string[],    // relative paths of files created
     filesSkipped: Array<{ path: string, reason: string }>,  // files that were skipped
     timestamp: string,         // ISO 8601 timestamp
     detectedFrameworks: string[],  // from codebaseInfo.frameworks
     reRun: boolean             // true if any files were skipped (indicates re-run)
   }
   ```

3. The function does NOT commit to git. It only generates files and returns the report. The skill/command layer handles git operations.

4. Export `generateScaffold`.

### What NOT to do
- Do NOT use `fs.writeFileSync` with any flags that would overwrite existing files. The existence check must happen before the write.
- Do NOT call git commands from this function.
- Do NOT throw on individual file failures -- catch per-file errors, log them in `filesSkipped` with reason `'write error: <message>'`, and continue.

### Verification
```bash
node -e "const { generateScaffold } = require('./src/lib/scaffold.cjs'); console.log(typeof generateScaffold)"
```
Expected: `function`

---

## Task 4: ScaffoldReport Persistence

**File:** `src/lib/scaffold.cjs` (append to same file)

### Implementation

1. Implement `writeScaffoldReport(cwd, report)` that:
   - Writes the `ScaffoldReport` object as JSON to `.planning/scaffold-report.json` relative to `cwd`
   - Creates `.planning/` directory if it does not exist (using `fs.mkdirSync` with `recursive: true`)
   - Returns the absolute path of the written report file

2. Implement `readScaffoldReport(cwd)` that:
   - Reads `.planning/scaffold-report.json` relative to `cwd`
   - Returns the parsed JSON object, or `null` if the file does not exist
   - Returns `null` (not throw) on parse errors

3. Export both functions.

### Verification
```bash
node -e "const { writeScaffoldReport, readScaffoldReport } = require('./src/lib/scaffold.cjs'); console.log(typeof writeScaffoldReport, typeof readScaffoldReport)"
```
Expected: `function function`

---

## Task 5: Top-Level Orchestrator Function

**File:** `src/lib/scaffold.cjs` (append to same file)

### Implementation

1. Implement `scaffold(cwd, options)` as the main entry point that orchestrates the full scaffold flow:
   - `options` shape: `{ projectType?: string, codebaseInfo?: object }`. Both optional.
   - If `codebaseInfo` is not provided, call `detectCodebase(cwd)` from `../lib/context.cjs` (lazy require inside the function body).
   - Call `classifyProjectType(codebaseInfo, cwd)` to determine type.
   - If `options.projectType` is provided, override the classified type (user override).
   - If the classified type is `null` and no override provided, return a report with `projectType: 'unknown'`, empty `filesCreated`, and a note in `filesSkipped`.
   - If `ambiguous` is true and no override provided, return `{ needsUserInput: true, candidates: [...], classification: {...} }` instead of a `ScaffoldReport`. The command handler will use this to prompt the user.
   - Determine the dominant language from `codebaseInfo.languages[0]` (first detected language). Map language strings to template keys: `'javascript'`/`'typescript'` -> `'javascript'`, `'python'` -> `'python'`, others -> `'generic'`.
   - Call `generateScaffold(cwd, projectType, language)`.
   - Call `writeScaffoldReport(cwd, report)`.
   - Return the `ScaffoldReport`.

2. Export `scaffold` as the primary public API.

### What NOT to do
- Do NOT make this function async -- all operations are synchronous.
- Do NOT perform git operations in this function.

### Verification
```bash
node -e "const { scaffold } = require('./src/lib/scaffold.cjs'); console.log(typeof scaffold)"
```
Expected: `function`

---

## Task 6: Unit Tests

**File:** `src/lib/scaffold.test.cjs`

### Implementation

Use `node:test` and `node:assert/strict` following the established test pattern (see `context.test.cjs` for reference). Use `fs.mkdtempSync` for temp directories, clean up in `afterEach`.

Write tests for:

**classifyProjectType tests (6+ tests):**
1. Returns `{ type: 'webapp' }` when frameworks includes `react`
2. Returns `{ type: 'webapp' }` when frameworks includes `next` (not api despite API routes)
3. Returns `{ type: 'api' }` when frameworks includes `express`
4. Returns `{ type: 'api' }` when frameworks includes `fastapi`
5. Returns `{ type: 'cli' }` when `package.json` has `bin` field (create package.json in tmpDir with `{ "bin": { "mycli": "./src/cli.js" } }`)
6. Returns `{ type: 'library' }` as fallback when hasSourceCode is true but no other signals
7. Returns `{ type: null }` when hasSourceCode is false
8. Sets `ambiguous: true` when both webapp and api frameworks are detected (e.g., `frameworks: ['react', 'express']`)

**getTemplates tests (4+ tests):**
1. Returns non-empty array for `('webapp', 'javascript')`
2. Returns non-empty array for `('api', 'python')`
3. Each template has `path` and `content` properties
4. Returns generic fallback for unknown language

**generateScaffold tests (5+ tests):**
1. Creates all template files in empty directory
2. Skips files that already exist (write a file first, then run scaffold)
3. Returns `ScaffoldReport` with correct `filesCreated` and `filesSkipped` arrays
4. Sets `reRun: true` when any files are skipped
5. Creates nested directories (e.g., `src/routes/`)
6. Does not overwrite existing file content (write custom content, scaffold, verify content unchanged)

**writeScaffoldReport / readScaffoldReport tests (3+ tests):**
1. Writes and reads back identical report
2. `readScaffoldReport` returns `null` for non-existent file
3. Creates `.planning/` directory if missing

**scaffold (orchestrator) tests (4+ tests):**
1. Full flow: creates files and returns report for a JS project with package.json
2. Returns `needsUserInput` for ambiguous projects
3. Returns report with `projectType: 'unknown'` for empty projects
4. Respects `options.projectType` override
5. Re-run produces `reRun: true` and skips existing files

### Verification
```bash
node --test src/lib/scaffold.test.cjs
```
Expected: All tests pass.

---

## Success Criteria

1. `src/lib/scaffold.cjs` exports: `classifyProjectType`, `getTemplates`, `TEMPLATES`, `generateScaffold`, `writeScaffoldReport`, `readScaffoldReport`, `scaffold`
2. `src/lib/scaffold.test.cjs` has 22+ tests, all passing
3. `node --test src/lib/scaffold.test.cjs` exits with code 0
4. The scaffold engine is purely synchronous with no side effects beyond file creation
5. No git operations in the library module -- those belong in the command/skill layer
