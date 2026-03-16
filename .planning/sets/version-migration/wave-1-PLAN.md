# PLAN: version-migration Wave 1 -- Migration Infrastructure

## Objective

Build the deterministic migration infrastructure library (`src/lib/migrate.cjs`) with comprehensive unit tests. This wave covers version detection heuristics, backup/restore/cleanup operations, and the migration report data structure. The agent-driven migration logic (which analyzes and transforms `.planning/` state) is NOT part of this library -- this wave provides only the deterministic scaffolding that the skill layer will orchestrate.

## File Ownership

| File | Action |
|------|--------|
| `src/lib/migrate.cjs` | Create |
| `src/lib/migrate.test.cjs` | Create |

## Task 1: Create `src/lib/migrate.cjs` -- Version Detection

### What to Build

Create `src/lib/migrate.cjs` with the version detection function. This function examines a `.planning/` directory and infers which RAPID version created it.

### Implementation Details

**File header:**
```
'use strict';
const fs = require('fs');
const path = require('path');
const { getVersion } = require('./version.cjs');
const { compareVersions } = require('./prereqs.cjs');
```

**Function: `detectVersion(cwd)`**
- Input: project root directory path
- Output: `{ detected: string|null, confidence: 'high'|'medium'|'low', signals: string[] }`
- Logic (check in order, accumulate signals):
  1. Read `.planning/STATE.json` if it exists. If it has a `rapidVersion` field, return `{ detected: rapidVersion, confidence: 'high', signals: ['rapidVersion field present'] }` immediately.
  2. If `STATE.json` exists but has no `rapidVersion`:
     - Check if milestones use numeric-prefix IDs like `"01-plugin-infrastructure"` -- signals v1.x/v2.x era
     - Check if milestones use string IDs like `"status-rename"` -- signals v3.1.0+
     - Check for `currentMilestone` field format: version-prefixed IDs like `"v3.3.0"` signal v3.2.0+
     - Check schema version field (always 1 currently, but future-proofed)
     - Check set status values: if any set uses `"discussing"`, `"planning"`, `"executing"` (present-tense) -> pre-v3.1.0; if they use `"discussed"`, `"planned"`, `"executed"` (past-tense) -> v3.1.0+
     - Check if `.planning/sets/` directories exist with `CONTRACT.json` files -> v2.0+
     - Assemble detected version from signals:
       - Has STATE.json + no rapidVersion + past-tense statuses + version-prefixed milestone -> `"3.2.0"` (medium confidence)
       - Has STATE.json + no rapidVersion + past-tense statuses -> `"3.1.0"` (medium confidence)
       - Has STATE.json + no rapidVersion + present-tense statuses -> `"3.0.0"` (medium confidence)
       - Has STATE.json + numeric-prefix milestone IDs -> `"2.0.0"` (low confidence)
  3. If no `STATE.json` but `.planning/STATE.md` exists -> `"1.0.0"` (medium confidence, pre-JSON era)
  4. If no state files at all -> `{ detected: null, confidence: 'low', signals: ['No state files found'] }`

**Function: `isLatestVersion(detectedVersion)`**
- Input: detected version string
- Output: `boolean`
- Uses `compareVersions(detectedVersion, getVersion())` to check if `detectedVersion >= currentVersion`
- Returns `true` if already at or beyond the current RAPID version

### What NOT to Do
- Do not write any migration transformation logic -- that is the agent's job
- Do not parse STATE.md contents beyond checking for its existence
- Do not throw on missing `.planning/` directory -- return `detected: null`

### Verification
```bash
node -e "const m = require('./src/lib/migrate.cjs'); console.log(typeof m.detectVersion, typeof m.isLatestVersion);"
```
Expected: `function function`

---

## Task 2: Create `src/lib/migrate.cjs` -- Backup, Restore, Cleanup

### What to Build

Add backup, restore, and cleanup functions to `src/lib/migrate.cjs`.

### Implementation Details

**Function: `createBackup(cwd)`**
- Input: project root directory path
- Output: `{ backupPath: string, fileCount: number }`
- Behavior:
  - Target path: `path.join(cwd, '.planning', '.pre-migrate-backup')`
  - If backup directory already exists, throw an error: `'Pre-migration backup already exists at ${backupPath}. Remove it manually or run cleanup first.'`
  - Use `fs.cpSync(planningDir, backupPath, { recursive: true, filter: (src) => !src.includes('.locks') })` to copy everything except `.locks/` directory
  - Count files recursively in the backup directory (use a simple recursive counter helper)
  - Return the backup path and file count

**Function: `restoreBackup(cwd)`**
- Input: project root directory path
- Output: `{ restored: boolean, fileCount: number }`
- Behavior:
  - Check if backup exists at `.planning/.pre-migrate-backup/`
  - If not, return `{ restored: false, fileCount: 0 }`
  - Remove all contents of `.planning/` EXCEPT `.pre-migrate-backup/` itself
  - Copy backup contents back into `.planning/`
  - Remove the backup directory
  - Return `{ restored: true, fileCount }` with file count

**Function: `cleanupBackup(cwd)`**
- Input: project root directory path
- Output: `{ cleaned: boolean }`
- Behavior:
  - Check if backup exists at `.planning/.pre-migrate-backup/`
  - If not, return `{ cleaned: false }`
  - Remove the backup directory with `fs.rmSync(backupPath, { recursive: true, force: true })`
  - Return `{ cleaned: true }`

**Internal helper: `_countFiles(dir)`**
- Recursively count files (not directories) in a directory tree
- Used by `createBackup` and `restoreBackup`

### What NOT to Do
- Do not include `.locks/` directory in backups (filter it out during copy)
- Do not silently overwrite an existing backup -- always throw if one exists
- Do not modify STATE.json during backup/restore -- just copy files

### Verification
```bash
node -e "const m = require('./src/lib/migrate.cjs'); console.log(typeof m.createBackup, typeof m.restoreBackup, typeof m.cleanupBackup);"
```
Expected: `function function function`

---

## Task 3: Create `src/lib/migrate.test.cjs` -- Version Detection Tests

### What to Build

Comprehensive unit tests for `detectVersion()` and `isLatestVersion()`.

### Implementation Details

Use `node:test` with `node:assert/strict`. Each test creates a temporary directory with a mock `.planning/` structure.

**Test cases for `detectVersion()`:**

1. `should detect version from rapidVersion field` -- Create STATE.json with `rapidVersion: "3.2.0"`, verify `detected === "3.2.0"` and `confidence === "high"`
2. `should detect v3.2.0 from version-prefixed milestone without rapidVersion` -- Create STATE.json with `currentMilestone: "v3.3.0"` and past-tense set statuses, verify `detected === "3.2.0"` and `confidence === "medium"`
3. `should detect v3.1.0 from past-tense statuses without rapidVersion` -- Create STATE.json with `currentMilestone: "some-milestone"` (not version-prefixed) and a set with status `"discussed"`, verify `detected === "3.1.0"`
4. `should detect v3.0.0 from present-tense statuses` -- Create STATE.json with a set using status `"discussing"`, verify `detected === "3.0.0"`
5. `should detect v2.0.0 from numeric-prefix milestone IDs` -- Create STATE.json with milestone ID `"01-plugin-infrastructure"`, verify `detected === "2.0.0"`
6. `should detect v1.0.0 from STATE.md presence` -- Create `.planning/STATE.md` file (no STATE.json), verify `detected === "1.0.0"`
7. `should return null when no state files exist` -- Create empty `.planning/` directory, verify `detected === null`
8. `should return null when .planning/ directory is missing` -- Pass a directory with no `.planning/`, verify `detected === null`

**Test cases for `isLatestVersion()`:**

9. `should return true when detected version matches current` -- Mock or use `getVersion()` value
10. `should return false when detected version is older` -- Use `"1.0.0"`
11. `should return true when detected version is newer` -- Use `"99.0.0"`

**Setup/teardown:** Use `beforeEach`/`afterEach` to create and clean up temp directories via `fs.mkdtempSync` and `fs.rmSync`.

### Verification
```bash
node --test src/lib/migrate.test.cjs
```
Expected: All tests pass.

---

## Task 4: Create `src/lib/migrate.test.cjs` -- Backup/Restore/Cleanup Tests

### What to Build

Add test cases for backup, restore, and cleanup functions to `src/lib/migrate.test.cjs`.

### Implementation Details

**Test cases for `createBackup()`:**

1. `should create backup of .planning/ directory` -- Create `.planning/` with STATE.json and a subdirectory, call `createBackup()`, verify `.planning/.pre-migrate-backup/` exists and contains copied files, verify returned `fileCount > 0`
2. `should exclude .locks/ from backup` -- Create `.planning/.locks/test.lock`, call `createBackup()`, verify `.pre-migrate-backup/.locks/` does NOT exist
3. `should throw if backup already exists` -- Create `.planning/.pre-migrate-backup/`, call `createBackup()`, verify it throws with message containing "already exists"
4. `should count files correctly` -- Create known file structure, verify `fileCount` matches expected count

**Test cases for `restoreBackup()`:**

5. `should restore backup and remove backup directory` -- Create backup via `createBackup()`, modify `.planning/STATE.json`, call `restoreBackup()`, verify STATE.json contains original content, verify `.pre-migrate-backup/` no longer exists
6. `should return restored:false when no backup exists` -- Call `restoreBackup()` without a backup, verify `{ restored: false, fileCount: 0 }`

**Test cases for `cleanupBackup()`:**

7. `should remove backup directory` -- Create backup via `createBackup()`, call `cleanupBackup()`, verify `.pre-migrate-backup/` is gone, verify `{ cleaned: true }`
8. `should return cleaned:false when no backup exists` -- Call `cleanupBackup()` without a backup, verify `{ cleaned: false }`

### Verification
```bash
node --test src/lib/migrate.test.cjs
```
Expected: All tests pass (including Task 3 tests).

---

## Success Criteria

1. `src/lib/migrate.cjs` exports: `detectVersion`, `isLatestVersion`, `createBackup`, `restoreBackup`, `cleanupBackup`
2. All unit tests in `src/lib/migrate.test.cjs` pass
3. `node --test src/lib/migrate.test.cjs` exits with code 0
4. No modifications to any existing files in this wave
