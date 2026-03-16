# Wave 1: Scoping Foundation -- Rewrite /review and Produce REVIEW-SCOPE.md

## Objective

Transform the existing monolithic `/rapid:review` skill (1035 lines) into a lightweight scoping-only command that produces REVIEW-SCOPE.md as its sole output. This wave also fixes the broken `buildWaveAttribution` function and adds a `serializeReviewScope` helper to `src/lib/review.cjs` for generating the structured REVIEW-SCOPE.md artifact. The three downstream skills (`/unit-test`, `/bug-hunt`, `/uat`) depend on this wave's output -- they consume REVIEW-SCOPE.md as their input.

## Tasks

### Task 1: Fix `buildWaveAttribution` in `src/lib/review.cjs`

**Files:** `src/lib/review.cjs`

**Actions:**
1. The current `buildWaveAttribution` function (lines 372-417) searches for subdirectories inside `.planning/sets/{setId}/` then looks for `*-PLAN.md` files inside those subdirectories. This is wrong -- plan files use flat naming (`wave-1-PLAN.md`, `wave-2-PLAN.md`) directly inside `.planning/sets/{setId}/` with no subdirectories.

2. Replace the current implementation with a corrected version that:
   - Reads the set directory directly (`.planning/sets/{setId}/`)
   - Filters for files matching the glob pattern `wave-*-PLAN.md`
   - Extracts the wave identifier from the filename (e.g., `wave-1-PLAN.md` -> `wave-1`)
   - Reads each plan file and uses the existing regex (`/\|\s*`?([^`|]+?)`?\s*\|\s*(Create|Modify)\s*\|/gi`) to extract file paths
   - Maps each file path to its wave identifier (last wave wins)

3. The corrected function should:
   - `const setDir = path.join(cwd, '.planning', 'sets', setId);`
   - Read files in `setDir` directly (not subdirectories)
   - Filter for entries matching `/^wave-.*-PLAN\.md$/`
   - Parse wave id from filename: `entry.replace(/-PLAN\.md$/, '')` gives e.g., `wave-1`
   - For each matching file, read and apply the existing table regex to extract attributed files
   - Return the attribution map as before

**What NOT to do:**
- Do NOT change the JSDoc signature or return type -- still returns `Object<string, string>` mapping filePath to waveId.
- Do NOT change the regex pattern for parsing the "Files to Create/Modify" table.
- Do NOT change how `last wave wins` works -- sequential override is correct.

**Verification:**
```bash
node -e "
const review = require('./src/lib/review.cjs');
// Test against a set that has wave-*-PLAN.md files (structural-cleanup has them)
const attr = review.buildWaveAttribution('.', 'structural-cleanup');
console.log('Attribution keys:', Object.keys(attr).length);
console.log('Sample:', JSON.stringify(attr).slice(0, 200));
"
# Expected: Attribution keys > 0 (was returning 0 before the fix)
```

### Task 2: Add `serializeReviewScope` function to `src/lib/review.cjs`

**Files:** `src/lib/review.cjs`

**Actions:**
1. Add a new exported function `serializeReviewScope(scopeData)` that produces a structured markdown string for REVIEW-SCOPE.md. The function takes a single object with the following shape:

```javascript
/**
 * Serialize review scope data into REVIEW-SCOPE.md format.
 *
 * @param {Object} scopeData
 * @param {string} scopeData.setId - Set identifier
 * @param {string} scopeData.date - ISO timestamp
 * @param {boolean} scopeData.postMerge - Whether this is post-merge mode
 * @param {string} scopeData.worktreePath - Absolute path to worktree (or cwd for post-merge)
 * @param {string[]} scopeData.changedFiles - Files changed in the set
 * @param {string[]} scopeData.dependentFiles - One-hop dependent files
 * @param {number} scopeData.totalFiles - Total file count
 * @param {Array<{dir: string, files: string[]}>} scopeData.chunks - Directory chunks
 * @param {Object<string, string>} scopeData.waveAttribution - File-to-wave map
 * @param {Object|null} scopeData.concernScoping - Scoper agent output or null
 * @param {boolean} scopeData.useConcernScoping - Whether concern scoping is active
 * @param {string|null} scopeData.fallbackWarning - Warning if concern scoping fell back
 * @param {string[]} scopeData.acceptanceCriteria - Aggregated acceptance criteria
 * @returns {string} Markdown content for REVIEW-SCOPE.md
 */
```

2. The output markdown format must be:

```markdown
# REVIEW-SCOPE: {setId}

<!-- SCOPE-META
{JSON block with machine-readable fields: setId, date, postMerge, worktreePath, totalFiles, useConcernScoping}
-->

## Set Metadata

| Field | Value |
|-------|-------|
| Set | {setId} |
| Date | {date} |
| Post-Merge | {true/false} |
| Working Directory | {worktreePath} |
| Total Files | {totalFiles} |
| Changed Files | {changedFiles.length} |
| Dependent Files | {dependentFiles.length} |
| Concern Scoping | {active/fallback/unavailable} |

## Changed Files

{table with columns: File, Wave Attribution}
{each changedFile with its wave from waveAttribution, or "unattributed"}

## Dependent Files

{table with columns: File}
{each dependentFile}

## Directory Chunks

{for each chunk:}
### {chunk.dir} ({chunk.files.length} files)
{list of files in chunk}

## Wave Attribution

{table with columns: File, Wave}
{all files with their wave attribution}

## Concern Scoping

{if concernScoping is not null:}
{for each concern: heading, file list with rationales}
{cross-cutting files section}
{if fallbackWarning: display the warning}
{if null: "Concern scoping was not performed."}

## Acceptance Criteria

{numbered list of acceptance criteria}
{if empty: "No acceptance criteria found."}
```

3. The `SCOPE-META` JSON block at the top is a machine-readable extraction point. Downstream skills can parse it by searching for the `<!-- SCOPE-META` marker and extracting the JSON between it and `-->`. This is more robust than parsing markdown tables.

4. Add `serializeReviewScope` to `module.exports`.

**What NOT to do:**
- Do NOT write the file to disk in this function -- it only returns the markdown string. The SKILL.md handles file writing.
- Do NOT include full file contents in REVIEW-SCOPE.md -- only file paths with metadata. Downstream skills read files themselves.

**Verification:**
```bash
node -e "
const review = require('./src/lib/review.cjs');
const md = review.serializeReviewScope({
  setId: 'test-set',
  date: '2026-03-16T00:00:00Z',
  postMerge: false,
  worktreePath: '/tmp/test',
  changedFiles: ['src/a.cjs', 'src/b.cjs'],
  dependentFiles: ['src/c.cjs'],
  totalFiles: 3,
  chunks: [{ dir: 'src', files: ['src/a.cjs', 'src/b.cjs', 'src/c.cjs'] }],
  waveAttribution: { 'src/a.cjs': 'wave-1', 'src/b.cjs': 'wave-1' },
  concernScoping: null,
  useConcernScoping: false,
  fallbackWarning: null,
  acceptanceCriteria: ['Feature X works', 'Feature Y is accessible']
});
console.log(md.includes('REVIEW-SCOPE: test-set'));
console.log(md.includes('SCOPE-META'));
console.log(md.includes('src/a.cjs'));
"
# Expected: true true true
```

### Task 3: Add `parseReviewScope` function to `src/lib/review.cjs`

**Files:** `src/lib/review.cjs`

**Actions:**
1. Add a new exported function `parseReviewScope(markdown)` that parses a REVIEW-SCOPE.md string and extracts the machine-readable SCOPE-META JSON block. This is the inverse of `serializeReviewScope` for the metadata.

```javascript
/**
 * Parse the SCOPE-META JSON block from a REVIEW-SCOPE.md string.
 *
 * @param {string} markdown - Content of REVIEW-SCOPE.md
 * @returns {Object} Parsed scope metadata (setId, date, postMerge, worktreePath, totalFiles, useConcernScoping)
 * @throws {Error} If SCOPE-META block is not found or JSON is malformed
 */
```

2. Implementation: search for `<!-- SCOPE-META` marker, extract text until `-->`, parse as JSON. Throw clear error if marker is missing ("REVIEW-SCOPE.md is missing SCOPE-META block. Run /rapid:review to regenerate.").

3. Add `parseReviewScope` to `module.exports`.

**What NOT to do:**
- Do NOT parse the full markdown. Only extract the JSON from the SCOPE-META comment block. Downstream skills use this for quick metadata access and read the markdown sections themselves as needed.

**Verification:**
```bash
node -e "
const review = require('./src/lib/review.cjs');
const md = review.serializeReviewScope({
  setId: 'test-set', date: '2026-03-16T00:00:00Z', postMerge: false,
  worktreePath: '/tmp/test', changedFiles: ['a.cjs'], dependentFiles: [],
  totalFiles: 1, chunks: [{ dir: '.', files: ['a.cjs'] }],
  waveAttribution: {}, concernScoping: null, useConcernScoping: false,
  fallbackWarning: null, acceptanceCriteria: []
});
const meta = review.parseReviewScope(md);
console.log(meta.setId === 'test-set');
console.log(meta.postMerge === false);
"
# Expected: true true
```

### Task 4: Add `extractAcceptanceCriteria` function to `src/lib/review.cjs`

**Files:** `src/lib/review.cjs`

**Actions:**
1. Add a new exported function `extractAcceptanceCriteria(cwd, setId)` that reads all `wave-*-PLAN.md` files from `.planning/sets/{setId}/` and extracts acceptance criteria sections.

```javascript
/**
 * Extract acceptance criteria from all wave plan files in a set.
 * Searches for "## Success Criteria" or "## Acceptance Criteria" sections
 * in each wave-*-PLAN.md file.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @returns {string[]} Array of acceptance criteria strings, tagged with wave origin
 */
```

2. Implementation:
   - Read `.planning/sets/{setId}/` directory
   - Filter for `wave-*-PLAN.md` files
   - For each file, extract the content under `## Success Criteria` or `## Acceptance Criteria` heading (whichever is present) until the next `## ` heading or EOF
   - Parse bullet points (lines starting with `- `) from the extracted section
   - Prefix each criterion with `[{waveId}]` for traceability (e.g., `[wave-1] Zero occurrences of loadRegistry in src/`)
   - Return flat array of all criteria

3. Add `extractAcceptanceCriteria` to `module.exports`.

**What NOT to do:**
- Do NOT look for JOB-PLAN.md files in subdirectories -- research finding #5 confirmed the actual naming is `wave-*-PLAN.md` flat in the set directory.
- Do NOT fail silently if no criteria are found -- return an empty array with no error.

**Verification:**
```bash
node -e "
const review = require('./src/lib/review.cjs');
const criteria = review.extractAcceptanceCriteria('.', 'structural-cleanup');
console.log('Criteria count:', criteria.length);
if (criteria.length > 0) console.log('First:', criteria[0]);
"
# Expected: Criteria count > 0 (structural-cleanup has Success Criteria in its plans)
```

### Task 5: Rewrite `skills/review/SKILL.md` as scoping-only

**Files:** `skills/review/SKILL.md`

**Actions:**
1. Replace the entire 1035-line monolithic skill with a focused scoping-only skill (~200-250 lines). The new skill:
   - Keeps Step 0 (environment, set resolution, argument parsing, status validation) largely intact
   - Replaces Step 1 (stage selection menu) with removal -- no stage selection, scoping only
   - Keeps Step 2 (scope set files) intact
   - Keeps Step 2.5 (concern-based scoping via scoper agent) intact
   - Keeps Step 3 (load acceptance criteria) but uses the new `extractAcceptanceCriteria` CLI/function
   - Replaces Steps 4-6 (unit test, bug hunt, UAT, summary) with REVIEW-SCOPE.md generation
   - Adds a completion banner pointing users to `/rapid:unit-test`, `/rapid:bug-hunt`, `/rapid:uat`

2. The new skill structure:

```
---
description: Scope a completed set for review -- produces REVIEW-SCOPE.md
allowed-tools: Read, Write, Bash, Agent, AskUserQuestion
---

# /rapid:review -- Review Scoping

## Step 0: Environment + Set Resolution
{same as current: env loading, banner, arg parsing, resolve set, detect --post-merge, validate status}

## Step 1: Scope Set Files
{same as current Step 2: run `review scope` CLI, get changedFiles, dependentFiles, chunks, waveAttribution}

## Step 2: Concern-Based Scoping
{same as current Step 2.5: spawn rapid-scoper agent, cross-cutting fallback check}

## Step 3: Load Acceptance Criteria
{use extractAcceptanceCriteria function via CLI or direct file reading}

## Step 4: Generate REVIEW-SCOPE.md
{build scopeData object from Steps 1-3, call serializeReviewScope, write to .planning/sets/{setId}/REVIEW-SCOPE.md or .planning/post-merge/{setId}/REVIEW-SCOPE.md}

## Step 5: Completion Banner + Next Steps
{print what was generated, point to /rapid:unit-test, /rapid:bug-hunt, /rapid:uat}
```

3. The REVIEW-SCOPE.md write location:
   - Standard mode: `.planning/sets/{setId}/REVIEW-SCOPE.md`
   - Post-merge mode: `.planning/post-merge/{setId}/REVIEW-SCOPE.md`

4. The skill MUST include the full REVIEW-SCOPE.md schema definition so that downstream skills have a reference. Include the schema in a "REVIEW-SCOPE.md Format" section within the skill.

5. Key behavioral requirements:
   - **No stage selection prompt.** The skill scopes and writes REVIEW-SCOPE.md, then stops.
   - **No chaining.** Does not invoke unit-test, bug-hunt, or UAT.
   - **Idempotent overwrite.** Re-running `/review` overwrites the previous REVIEW-SCOPE.md.
   - **Post-merge flag propagation.** The `postMerge` field in REVIEW-SCOPE.md tells downstream skills which artifact directory to use.

6. The completion banner format:
```
--- RAPID Review Scope Complete ---
Set: {setId}
Scope: {totalFiles} files ({changedFiles.length} changed + {dependentFiles.length} dependents)
Chunks: {chunks.length} directory group(s)
Concern Scoping: {active with N concerns / fallback / not performed}
Acceptance Criteria: {N criteria from M waves}

REVIEW-SCOPE.md written to:
  {artifact path}

Next steps:
  /rapid:unit-test {setIndex} -- Run unit test pipeline
  /rapid:bug-hunt {setIndex} -- Run adversarial bug hunt
  /rapid:uat {setIndex} -- Run acceptance testing
-----------------------------------
```

**What NOT to do:**
- Do NOT preserve any of Steps 4a, 4b, 4c (unit test, bug hunt, UAT) from the old skill. Those move to Wave 2's new skills.
- Do NOT preserve the stage selection menu (old Step 1).
- Do NOT preserve the summary generation step (old Step 5). Each downstream skill handles its own summary.
- Do NOT change the skill directory or filename -- it remains `skills/review/SKILL.md`.
- Do NOT remove the `allowed-tools` header entry for `Agent` -- the scoper agent is still spawned from this skill.

**Verification:**
```bash
# Verify the new skill is significantly shorter
wc -l skills/review/SKILL.md
# Expected: ~200-300 lines (down from 1035)

# Verify no stage selection references remain
grep -i "stage selection\|which review stages\|Unit test only\|Bug hunt only\|UAT only" skills/review/SKILL.md
# Expected: zero matches

# Verify REVIEW-SCOPE.md is referenced
grep "REVIEW-SCOPE.md" skills/review/SKILL.md
# Expected: multiple matches
```

### Task 6: Add unit tests for new review.cjs functions

**Files:** `src/lib/review.test.cjs`

**Actions:**
1. Add a test suite for `buildWaveAttribution` (fixed version) that:
   - Creates a temp directory with `.planning/sets/test-set/` containing `wave-1-PLAN.md` and `wave-2-PLAN.md` with "Files to Create/Modify" tables
   - Verifies the function returns a non-empty attribution map
   - Verifies file paths map to correct wave identifiers (e.g., `src/a.cjs` -> `wave-1`)
   - Verifies last-wave-wins behavior (a file in both wave-1 and wave-2 maps to `wave-2`)
   - Verifies empty result when no plan files exist

2. Add a test suite for `serializeReviewScope` that:
   - Calls with a complete scopeData object and verifies the output:
     - Contains `# REVIEW-SCOPE:` heading
     - Contains `<!-- SCOPE-META` block with valid JSON
     - Contains all changed files in a table
     - Contains directory chunks section
     - Contains acceptance criteria section
   - Calls with `concernScoping: null` and verifies "Concern scoping was not performed."
   - Calls with `postMerge: true` and verifies the metadata reflects it

3. Add a test suite for `parseReviewScope` that:
   - Round-trips through `serializeReviewScope` then `parseReviewScope` and verifies metadata
   - Tests error when SCOPE-META block is missing
   - Tests error when JSON is malformed

4. Add a test suite for `extractAcceptanceCriteria` that:
   - Creates a temp directory with plan files containing `## Success Criteria` sections
   - Verifies criteria are extracted with wave tags
   - Verifies empty array when no criteria sections exist

**What NOT to do:**
- Do NOT modify existing tests -- only add new describe blocks.
- Do NOT import any new test frameworks. Use `node:test` and `node:assert/strict` as per project convention.

**Verification:**
```bash
node --test src/lib/review.test.cjs
# Expected: all tests pass including new suites
```

## Success Criteria

- `buildWaveAttribution` returns non-empty attribution maps for sets with flat `wave-*-PLAN.md` files
- `serializeReviewScope` produces valid REVIEW-SCOPE.md with machine-readable SCOPE-META JSON block
- `parseReviewScope` round-trips correctly with `serializeReviewScope`
- `extractAcceptanceCriteria` extracts criteria from `## Success Criteria` sections in plan files
- `skills/review/SKILL.md` is ~200-300 lines, scoping-only, writes REVIEW-SCOPE.md, no stage selection
- All new and existing tests in `src/lib/review.test.cjs` pass
- The old monolithic stages (unit test, bug hunt, UAT, summary) are fully removed from the review skill
