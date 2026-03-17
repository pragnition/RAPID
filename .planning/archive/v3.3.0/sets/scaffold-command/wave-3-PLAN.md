# Wave 3 Plan: Roadmapper Integration and Behavioral Tests

## Objective

Update the roadmapper role module to incorporate scaffold awareness (gated behind `scaffold-report.json` existence) and add integration/behavioral tests that verify the scaffold-to-roadmapper pipeline, re-runnability guarantees, and end-to-end detect-then-scaffold flow.

## Prerequisites

Waves 1 and 2 must be complete. The scaffold engine, CLI handler, and skill are all functional.

---

## Task 1: Roadmapper Scaffold Awareness

**File:** `src/modules/roles/role-roadmapper.md`

### Implementation

1. Add a new section after the "## Input" section (around line 13) titled "## Scaffold Awareness":

   ```markdown
   ## Scaffold Awareness

   Before generating the roadmap, check if a scaffold report exists at `.planning/scaffold-report.json`.

   **If scaffold-report.json exists:**
   - Read the report to understand which foundation files have been generated.
   - Treat scaffolded files as shared baseline -- they are NOT owned by any individual set.
   - When defining set file ownership boundaries, exclude files listed in `filesCreated` from the scaffold report.
   - Sets may import from or build upon scaffolded files, but no set should claim exclusive ownership of a scaffolded file.
   - Reference scaffolded files in contracts as "provided by scaffold" when a set imports from them.
   - Include a note in the roadmap output indicating that scaffold-generated files form the shared baseline.

   **If scaffold-report.json does not exist:**
   - Proceed normally. Do not reference scaffold in the roadmap.
   - Scaffold is fully optional -- its absence does not affect roadmap generation.
   ```

2. Add a bullet to the "## Input" section (around line 8) after the existing input items:
   ```markdown
   5. **Scaffold report** (optional) -- `.planning/scaffold-report.json` if scaffold has been run. Contains project type, language, and lists of generated files.
   ```

3. Add a bullet to the "### What This Agent Does" section (around line 170):
   ```markdown
   - Checks for scaffold report to establish baseline file awareness
   ```

### What NOT to do
- Do NOT make scaffold awareness mandatory -- it must be gated behind file existence.
- Do NOT modify the roadmapper's output format -- only change what information it considers as input.
- Do NOT add scaffold-specific contract types -- use the existing contract format.

### Verification
```bash
grep -c "scaffold-report.json" src/modules/roles/role-roadmapper.md
```
Expected: At least 2 matches (one in the awareness section, one in the input section).

---

## Task 2: Command Handler Unit Tests

**File:** `src/commands/scaffold.test.cjs`

### Implementation

Create unit tests for the command handler using `node:test` and `node:assert/strict`. These tests verify the handler's argument parsing and routing without testing the underlying scaffold logic (which is covered by Wave 1 tests).

1. **Test setup:** The handler calls into `../lib/scaffold.cjs` functions. For testing, create a temp directory with a `.planning/` subdirectory to simulate a project root.

2. **Tests to write:**

   **Argument parsing (3 tests):**
   - `handleScaffold(cwd, undefined, [])` throws `CliError` with usage message (no subcommand)
   - `handleScaffold(cwd, 'unknown', [])` throws `CliError` with usage message (invalid subcommand)
   - `handleScaffold(cwd, 'run', ['--type', 'webapp'])` does not throw (valid invocation -- may produce output or needsUserInput depending on project state)

   **Status subcommand (2 tests):**
   - `handleScaffold(cwd, 'status', [])` outputs `{"scaffolded":false}` when no report exists (capture stdout)
   - `handleScaffold(cwd, 'status', [])` outputs a report JSON when `.planning/scaffold-report.json` exists (create the file first)

   **Run subcommand (2 tests):**
   - `handleScaffold(cwd, 'run', [])` on an empty project outputs a report with `projectType: 'unknown'` (or similar handling for no source code)
   - `handleScaffold(cwd, 'run', ['--type', 'webapp'])` on a project with `package.json` outputs a ScaffoldReport

   Note: These tests need to capture stdout. Use the pattern of temporarily replacing `process.stdout.write` to capture output, or create a minimal project in tmpDir and run the CLI via `child_process.execSync`.

### What NOT to do
- Do NOT test the scaffold engine logic here -- that is covered by `scaffold.test.cjs`.
- Do NOT make these tests depend on git operations.

### Verification
```bash
node --test src/commands/scaffold.test.cjs
```
Expected: All tests pass.

---

## Task 3: Integration / Behavioral Tests

**File:** `src/lib/scaffold.integration.test.cjs`

### Implementation

Create integration tests that verify the end-to-end behavioral contracts specified in `CONTRACT.json`. Use `node:test` and `node:assert/strict`.

1. **Re-runnability test:**
   - Create a temp directory with a `package.json` (JavaScript project)
   - Run `scaffold(cwd, { projectType: 'api' })` -- verify files created
   - Modify one of the created files to have custom content
   - Run `scaffold(cwd, { projectType: 'api' })` again
   - Verify: the modified file still has the custom content (not overwritten)
   - Verify: `report.reRun` is `true`
   - Verify: `report.filesSkipped` includes the modified file

2. **Detect-then-scaffold pipeline test:**
   - Create a temp directory with `package.json` containing express dependency
   - Call `detectCodebase(cwd)` to get codebaseInfo
   - Call `classifyProjectType(codebaseInfo, cwd)` -- verify type is `'api'`
   - Call `scaffold(cwd)` (no options, auto-detection)
   - Verify: report has `projectType: 'api'` and `language: 'javascript'`
   - Verify: API-specific files were created (e.g., `src/routes/index.js`)

3. **ScaffoldReport persistence test:**
   - Run scaffold on a temp directory
   - Verify `.planning/scaffold-report.json` exists
   - Read it back via `readScaffoldReport(cwd)`
   - Verify all fields match the returned report

4. **Empty project test:**
   - Create an empty temp directory
   - Run `scaffold(cwd)` with no options
   - Verify: report has `projectType: 'unknown'`
   - Verify: no files were created (empty `filesCreated`)

5. **Multiple languages test:**
   - Create a temp directory with both `package.json` and `requirements.txt`
   - Run `scaffold(cwd, { projectType: 'api' })`
   - Verify: dominant language (first in `languages[]`) was used for templates

### What NOT to do
- Do NOT test git commit behavior in integration tests -- that is a skill-level concern.
- Do NOT mock file system operations -- these tests exercise real file creation.

### Verification
```bash
node --test src/lib/scaffold.integration.test.cjs
```
Expected: All tests pass.

---

## Task 4: Rebuild Agent Definitions

**File:** No new files -- run the build-agents command

### Implementation

After modifying `src/modules/roles/role-roadmapper.md`, rebuild the agent markdown files to incorporate the changes:

```bash
node src/bin/rapid-tools.cjs build-agents
```

Verify the built roadmapper agent file includes the scaffold awareness section.

### What NOT to do
- Do NOT manually edit files in the built agents output directory.

### Verification
```bash
node src/bin/rapid-tools.cjs build-agents 2>&1
```
Expected: Command completes without error. The roadmapper agent definition includes scaffold-report.json references.

---

## Success Criteria

1. `src/modules/roles/role-roadmapper.md` includes scaffold awareness section gated behind `scaffold-report.json` existence
2. `src/commands/scaffold.test.cjs` has 7+ tests, all passing
3. `src/lib/scaffold.integration.test.cjs` has 5+ tests, all passing
4. `build-agents` completes successfully after role-roadmapper.md changes
5. Full test suite passes:
   ```bash
   node --test src/lib/scaffold.test.cjs && \
   node --test src/commands/scaffold.test.cjs && \
   node --test src/lib/scaffold.integration.test.cjs
   ```
6. The roadmapper's scaffold awareness is purely additive -- roadmapper behavior is unchanged when no scaffold-report.json exists
