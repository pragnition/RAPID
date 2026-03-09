# Unit Test Plan

## Summary
- Total test targets: 11
- Critical priority: 3 | High: 5 | Medium: 3
- Estimated total test count: 42
- Layers covered: [Input (CLI argument parsing), Business Logic (worktree operations, formatting, state derivation)]

## Test Framework
- Detected: node:test (Node.js built-in test runner)
- Config: No config file needed -- uses `node --test` CLI
- Auto-installed: no

## Existing Test Conventions
- Test files: `*.test.cjs` co-located in same directory as source
- Pattern: `describe`/`it` blocks with `assert` module from `node:assert/strict`
- Helpers: `createTempRepo()` and `cleanupRepo()` for git-based tests
- CLI tests: `execSync('node <cli-path> ...')` with `cwd` set to temp dir

## Analysis of Existing Coverage

The existing `worktree.test.cjs` (1248 lines) already covers most Phase 19 library functions well. The following functions have GOOD existing coverage and do NOT need additional tests:
- `deleteBranch` -- 6 tests (merged, unmerged, force, invalid names, not-found)
- `setInit` -- 6 tests (happy path, CLAUDE.md generation, registry, STATE.json untouched, structured result, duplicate error)
- `generateScopedClaudeMd` -- 8 tests (header, scope, contract, ownership, deny list, missing files, style guide)
- `formatMarkIIStatus` -- 7 tests (columns, wave progress, no waves, statuses, worktree path, empty sets, sort order)
- `deriveNextActions` -- 6 tests (pending without/with worktree, executing, complete, reviewing, merging, max 5)
- `renderProgressBar` -- 5 tests (partial, zero, full, zero-total, custom width)
- `formatStatusTable` (enhanced) -- 10 tests
- `formatWaveSummary` (enhanced) -- 7 tests
- `formatStatusOutput` -- 4 tests

The following are NEW Phase 19 code paths that have ZERO test coverage -- these are the primary targets.

---

## Test Targets

### 1. handleSetInit CLI -- "set-init create" command
- **File**: `src/bin/rapid-tools.cjs` (lines 1062-1082)
- **Priority**: Critical
- **What We're Testing**: The CLI entry point for `set-init create <set-name>` -- argument validation, delegating to `worktree.setInit()`, and JSON output formatting
- **Test Strategy**: Integration test via `execSync('node rapid-tools.cjs set-init create <name>', { cwd: tmpDir })`. Requires a temp git repo with `.planning/sets/<set>/DEFINITION.md` and `CONTRACT.json` scaffolded. Assert stdout is valid JSON with `created: true`, correct branch name, and that the worktree directory actually exists on disk.
- **Layer**: Input (CLI argument validation) + Business Logic (delegation)
- **Edge Cases**:
  - Missing set-name argument: should print usage to stderr and exit 1
  - Non-existent set definition (no DEFINITION.md / CONTRACT.json): should output `{ created: false, error: ... }` and exit 1
  - Duplicate set-init (already initialized): should output error JSON and exit 1
- **Estimated Tests**: 4
- **Why This Matters**: This is the primary entry point users invoke to initialize sets. If it silently succeeds with malformed output, the orchestrator SKILL.md will misparse the result and the set will be in an inconsistent state.

### 2. handleSetInit CLI -- "set-init list-available" command
- **File**: `src/bin/rapid-tools.cjs` (lines 1084-1116)
- **Priority**: High
- **What We're Testing**: The CLI subcommand that reads STATE.json, finds pending sets without worktrees, and outputs them as JSON
- **Test Strategy**: Integration test via `execSync`. Create temp dir with `.planning/STATE.json` containing multiple sets (some pending, some executing, some with worktrees). Assert stdout JSON has correct `available` array.
- **Layer**: Input (CLI) + Business Logic (filtering logic)
- **Edge Cases**:
  - No STATE.json exists: should return `{ available: [], error: ... }` (not crash)
  - All sets already have worktrees (none available): should return `{ available: [] }`
  - Mix of pending and non-pending sets across multiple milestones: should only return pending without worktrees
- **Estimated Tests**: 4
- **Why This Matters**: The orchestrator uses this to decide which sets to offer the user for initialization. If filtering is wrong, users will be offered sets that are already initialized or in progress.

### 3. handleResume CLI command
- **File**: `src/bin/rapid-tools.cjs` (lines 1125-1210)
- **Priority**: Critical
- **What We're Testing**: The `resume <set-name>` command that validates registry state, parses HANDOFF.md, reads STATE.json context, updates registry phase to Executing, and returns structured JSON
- **Test Strategy**: Integration test via `execSync`. Requires temp git repo with registry entry in Paused state, a HANDOFF.md file, and optionally a STATE.json. Parse stdout and verify the structured JSON output.
- **Layer**: Input (CLI argument validation) + Business Logic (state validation, handoff parsing, registry update)
- **Edge Cases**:
  - Missing set-name argument: should print usage and exit 1
  - Set not in registry: should error "No worktree registered" and exit 1
  - Set in registry but NOT in Paused phase (e.g., Executing): should error about wrong phase and exit 1
  - No HANDOFF.md file: should error about missing handoff and exit 1
  - Happy path with STATE.json present: should include stateContext in output
  - Happy path without STATE.json: should set stateContext to null (graceful)
  - After resume: registry phase should be updated to "Executing"
- **Estimated Tests**: 7
- **Why This Matters**: Resume is the complement to pause. If the phase guard is wrong, a set could be "resumed" when it was never paused, causing the orchestrator to re-execute already-completed work. If HANDOFF.md parsing fails silently, the agent loses all context from the previous session.

### 4. worktree status-v2 CLI subcommand
- **File**: `src/bin/rapid-tools.cjs` (lines 980-1013)
- **Priority**: High
- **What We're Testing**: The `worktree status-v2` command that reads STATE.json, loads registry, calls `formatMarkIIStatus` and `deriveNextActions`, then outputs JSON to stdout and ASCII table to stderr
- **Test Strategy**: Integration test via `execSync`. Create temp dir with `.planning/STATE.json` and `.planning/worktrees/REGISTRY.json`. Capture stdout (JSON) and verify it has `table`, `actions`, and `milestone` fields.
- **Layer**: Input (CLI) + Business Logic (state reading, formatting)
- **Edge Cases**:
  - No STATE.json: should error about invalid state and exit 1
  - Valid STATE.json with sets: should output JSON with table string and actions array
- **Estimated Tests**: 3
- **Why This Matters**: This is the primary dashboard command for Mark II. If the JSON output structure is wrong, the status skill cannot render the dashboard to the user.

### 5. worktree delete-branch CLI subcommand
- **File**: `src/bin/rapid-tools.cjs` (lines 1035-1053)
- **Priority**: High
- **What We're Testing**: The `worktree delete-branch <branch> [--force]` CLI command that delegates to `worktree.deleteBranch()` and formats JSON output
- **Test Strategy**: Integration test via `execSync` in a temp git repo. Create a branch, then invoke delete-branch to remove it. Parse stdout JSON.
- **Layer**: Input (CLI argument parsing, --force flag) + Business Logic (delegation)
- **Edge Cases**:
  - Missing branch-name: should print usage to stderr and exit 1
  - Valid branch deletion: should output `{ deleted: true, branch: ... }` and exit 0
  - Non-existent branch: should output `{ deleted: false, ... }` and exit 1
  - Invalid branch name (spaces): should output `{ deleted: false, error: ... }` and exit 1
  - Force flag: should pass force=true to deleteBranch
- **Estimated Tests**: 5
- **Why This Matters**: Cleanup skill calls this to remove branches after worktree removal. If the --force flag is not parsed correctly, unmerged branches cannot be cleaned up, leaving stale branches that confuse future set-init.

### 6. formatWaveProgress (internal, tested via formatMarkIIStatus)
- **File**: `src/lib/worktree.cjs` (lines 689-709)
- **Priority**: Medium
- **What We're Testing**: The internal wave progress formatter that creates compact "W1: 3/5 done, W2: 0/3 pending" strings. Although not exported, it has distinct logic branches that need coverage through `formatMarkIIStatus`.
- **Test Strategy**: Unit tests through `formatMarkIIStatus` with crafted wave/job data. Focus on the edge cases of the progress string generation.
- **Layer**: Business Logic
- **Edge Cases**:
  - Wave with all jobs complete: should say "done" not "pending"
  - Wave with zero jobs (empty jobs array): should show "W1: 0/0 pending"
  - Wave with null/missing jobs property: should handle gracefully (0/0)
  - Multiple waves with mixed completion states
- **Estimated Tests**: 3
- **Why This Matters**: The wave progress string is displayed in the status dashboard. Wrong counts confuse users about actual progress and could lead to premature cleanup or missed incomplete work.

### 7. relativeTime edge cases (internal, tested via formatStatusTable)
- **File**: `src/lib/worktree.cjs` (lines 397-408)
- **Priority**: Medium
- **What We're Testing**: The relative time calculation for "just now", "X min ago", "X hr ago", "X days ago" through `formatStatusTable`
- **Test Strategy**: Unit tests through `formatStatusTable` with crafted `updatedAt` timestamps at specific boundaries (59 seconds, 60 seconds, 59 minutes, 60 minutes, 23 hours, 24 hours)
- **Layer**: Business Logic
- **Edge Cases**:
  - Timestamp from 30 seconds ago: should show "just now"
  - Timestamp from exactly 60 seconds ago: should show "1 min ago" (boundary)
  - Timestamp from exactly 60 minutes ago: should show "1 hr ago" (boundary)
  - Timestamp from exactly 24 hours ago: should show "1 days ago" (boundary)
  - Null/undefined timestamp: should show "-"
  - Future timestamp (Date.now - negative diff): should show "just now" (negative seconds floor to 0)
- **Estimated Tests**: 5
- **Why This Matters**: Time display bugs make the dashboard confusing. A boundary error at the 60-second mark could show "60 min ago" instead of "1 hr ago", making sets look stale when they are not.

### 8. deriveNextActions -- edge cases not covered
- **File**: `src/lib/worktree.cjs` (lines 774-830)
- **Priority**: High
- **What We're Testing**: Additional edge cases for deriveNextActions that existing tests do not cover
- **Test Strategy**: Unit tests with crafted stateData and registryData
- **Layer**: Business Logic
- **Edge Cases**:
  - Complete set WITHOUT worktree: should NOT suggest cleanup (no worktree to clean)
  - Unknown status (e.g., "error", "blocked"): should not crash, just skip that set
  - Empty sets array: should return empty actions array
  - Sets with undefined status field: should not crash
- **Estimated Tests**: 4
- **Why This Matters**: The next actions list guides user workflow. If a cleanup action is suggested for a set without a worktree, or if an unknown status causes a crash, the user loses trust in the dashboard.

### 9. formatMarkIIStatus -- edge cases not covered
- **File**: `src/lib/worktree.cjs` (lines 719-765)
- **Priority**: Medium
- **What We're Testing**: Edge cases in the Mark II status formatter
- **Test Strategy**: Unit tests with crafted stateData and registryData
- **Layer**: Business Logic
- **Edge Cases**:
  - Set ID longer than 20 characters: should be truncated to 20 chars
  - Set with unknown status not in STATUS_SORT_ORDER: should sort to default position (4)
  - registryData.worktrees with null updatedAt vs missing updatedAt: both should show "-"
- **Estimated Tests**: 3
- **Why This Matters**: Long set names breaking table alignment or unknown statuses causing sort errors would make the dashboard unreadable during production use with many sets.

### 10. setInit -- claudeMdGenerated=false graceful degradation
- **File**: `src/lib/worktree.cjs` (lines 314-352)
- **Priority**: High
- **What We're Testing**: When `generateScopedClaudeMd` throws (e.g., missing CONTRACT.json), `setInit` should still create the worktree and register it, but return `claudeMdGenerated: false`
- **Test Strategy**: Unit test with a temp git repo that has a `.planning/sets/<set>/DEFINITION.md` but NO `CONTRACT.json`. Call `setInit()` and verify it succeeds with `claudeMdGenerated: false` and the worktree exists.
- **Layer**: Business Logic (graceful error handling)
- **Edge Cases**:
  - Missing CONTRACT.json: worktree created, registered, but claudeMdGenerated=false
  - Missing both DEFINITION.md and CONTRACT.json: same graceful behavior
- **Estimated Tests**: 2
- **Why This Matters**: In real workflows, the user might run set-init before all planning artifacts are complete. If setInit throws instead of gracefully degrading, the worktree creation is wasted and the user has to manually clean up.

### 11. deleteBranch -- additional edge cases
- **File**: `src/lib/worktree.cjs` (lines 124-150)
- **Priority**: High
- **What We're Testing**: Additional validation edge cases for deleteBranch input
- **Test Strategy**: Unit tests calling `deleteBranch` directly with edge-case inputs
- **Layer**: Business Logic (input validation)
- **Edge Cases**:
  - `null` as branch name: should throw "Invalid branch name"
  - `undefined` as branch name: should throw "Invalid branch name"
  - Numeric value (non-string): should throw "Invalid branch name"
  - Whitespace-only string: should throw "Invalid branch name"
- **Estimated Tests**: 2
- **Why This Matters**: The cleanup skill constructs branch names from set names. If an empty or malformed set name leaks through, `deleteBranch` must reject it loudly rather than passing a garbage argument to `git branch -d`.

---

## Test Files to Create

| # | File | Targets Covered | Estimated Tests |
|---|------|----------------|-----------------|
| 1 | `src/lib/worktree.phase19.test.cjs` | Targets 6, 7, 8, 9, 10, 11 (library edge cases) | 19 |
| 2 | `src/bin/rapid-tools.phase19.test.cjs` | Targets 1, 2, 3, 4, 5 (CLI integration) | 23 |

**Rationale for file split:**
- Library tests (worktree.phase19.test.cjs) are pure unit tests with in-memory data -- fast, no git operations for most tests.
- CLI tests (rapid-tools.phase19.test.cjs) are integration tests that spawn child processes against temp git repos -- slower, require full file system scaffolding.
- Both files are separate from existing test files to avoid any conflict with the 1248-line `worktree.test.cjs` and existing `rapid-tools.test.cjs`.

## Dependency Notes
- CLI integration tests for `status-v2` and `list-available` require `state-machine.cjs` to be importable, which depends on the STATE.json schema. Tests must scaffold a valid STATE.json.
- CLI integration tests for `resume` require `execute.cjs:parseHandoff()` to work, which expects a HANDOFF.md with `---` frontmatter delimiters. Tests must scaffold a valid HANDOFF.md.
- All git-based tests use `createTempRepo()` / `cleanupRepo()` helpers matching the existing convention in `worktree.test.cjs`.
