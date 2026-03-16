# Wave 1: Compaction Engine and Hook Registry

## Objective

Build the core `src/lib/compaction.cjs` module that provides `compactContext()` and `registerCompactionTrigger()`. This module is the heart of context optimization -- it reads pre-written `-DIGEST.md` sibling files for completed wave artifacts and assembles a budget-aware context object. The hook registry provides a global singleton for lifecycle event triggers (wave-complete, pause, review-stage-complete). Comprehensive unit tests verify budget enforcement, digest fallback, and disk recoverability.

## Tasks

### Task 1: Create `src/lib/compaction.cjs` with `compactContext()`

**Files:** `src/lib/compaction.cjs`

**Actions:**
1. Create a new module at `src/lib/compaction.cjs` with `'use strict';` header.

2. Import dependencies: `fs`, `path`, and `estimateTokens` from `./tool-docs.cjs`.

3. Define constants:
   - `DEFAULT_BUDGET_TOKENS = 120000` -- hardcoded budget target (~120k tokens)
   - `DIGEST_SUFFIX = '-DIGEST.md'` -- naming convention for digest siblings
   - `VERBATIM_PATTERNS = ['CONTRACT.json']` -- small artifacts that always stay verbatim
   - `ACTIVE_WAVE_EXEMPT = true` -- active wave content is never compacted

4. Implement `resolveDigestPath(artifactPath)`:
   ```javascript
   /**
    * Given an artifact file path, compute the sibling digest path.
    * Example: 'wave-1-PLAN.md' -> 'wave-1-PLAN-DIGEST.md'
    *          'HANDOFF.md' -> 'HANDOFF-DIGEST.md'
    *          'REVIEW-SCOPE.md' -> 'REVIEW-SCOPE-DIGEST.md'
    *
    * @param {string} artifactPath - Absolute path to the artifact
    * @returns {string} Absolute path to the digest sibling
    */
   ```
   Implementation: strip `.md` extension, append `-DIGEST.md`. For non-`.md` files (like `.json`), return `artifactPath + '-DIGEST.md'` (though these are expected to stay verbatim).

5. Implement `readDigestOrFull(artifactPath)`:
   ```javascript
   /**
    * Read a digest file if it exists, otherwise read the full artifact.
    * Returns { content, isDigest, path, tokens }.
    *
    * @param {string} artifactPath - Absolute path to the artifact file
    * @returns {{ content: string, isDigest: boolean, path: string, tokens: number }}
    */
   ```
   Implementation:
   - Compute digest path via `resolveDigestPath()`
   - If digest exists (`fs.existsSync`), read digest, set `isDigest: true`
   - Otherwise read full artifact, set `isDigest: false`
   - Estimate tokens using `estimateTokens(content)`
   - Return structured object

6. Implement `isVerbatimArtifact(filename)`:
   ```javascript
   /**
    * Check if an artifact should always be included verbatim (never compacted).
    * Small config files like CONTRACT.json stay verbatim.
    *
    * @param {string} filename - Base filename (not full path)
    * @returns {boolean}
    */
   ```
   Implementation: check if `filename` matches any entry in `VERBATIM_PATTERNS` or if file size (estimated tokens) is under 500 tokens.

7. Implement `compactContext(context, options)`:
   ```javascript
   /**
    * Context-aware compaction that preserves active state while summarizing
    * completed work. Reads pre-written digests for completed wave artifacts.
    *
    * @param {Object} context - Context object with artifacts grouped by wave
    * @param {string} context.setId - Set identifier
    * @param {string} context.setDir - Absolute path to .planning/sets/{setId}/
    * @param {number} context.activeWave - Current wave number (1-based), or 0 if no active wave
    * @param {Array<{wave: number, artifacts: Array<{name: string, path: string}>}>} context.waves - Wave artifacts
    * @param {Object} [options] - Options
    * @param {number} [options.budget] - Token budget (default: 120000)
    * @returns {{ compacted: Array<{wave: number, artifacts: Array<{name: string, content: string, isDigest: boolean, tokens: number}>}>, totalTokens: number, digestsUsed: number, fullsUsed: number, budgetExceeded: boolean }}
    */
   ```
   Implementation:
   - Default `budget` to `DEFAULT_BUDGET_TOKENS`
   - Initialize `totalTokens = 0`, `digestsUsed = 0`, `fullsUsed = 0`
   - For each wave in `context.waves`:
     - If `wave.wave === context.activeWave`: read ALL artifacts verbatim (never compact active wave)
     - If `wave.wave < context.activeWave` (completed wave): use `readDigestOrFull()` for each artifact
     - If artifact is in `VERBATIM_PATTERNS`: read verbatim regardless
   - Track token counts per artifact
   - Set `budgetExceeded = totalTokens > budget`
   - Return the compacted structure with metadata

**What NOT to do:**
- Do NOT implement AI-powered summarization. The module reads pre-written digests only.
- Do NOT interact with Claude Code's internal context management. This works upstream.
- Do NOT modify any existing files in this task.
- Do NOT make the budget configurable via env var or STATE.json -- hardcode 120000.

**Verification:**
```bash
node -e "
const c = require('./src/lib/compaction.cjs');
console.log(typeof c.compactContext === 'function');
console.log(typeof c.resolveDigestPath === 'function');
console.log(typeof c.readDigestOrFull === 'function');
"
# Expected: true true true
```

### Task 2: Add hook registry (`registerCompactionTrigger`) to `src/lib/compaction.cjs`

**Files:** `src/lib/compaction.cjs`

**Actions:**
1. Add a module-level global registry object:
   ```javascript
   /** @type {Object<string, Array<function>>} */
   const _hookRegistry = {};
   const VALID_EVENTS = ['wave-complete', 'pause', 'review-stage-complete'];
   ```

2. Implement `registerCompactionTrigger(event, handler)`:
   ```javascript
   /**
    * Register a callback for a lifecycle event that should trigger
    * compaction-related actions (e.g., digest validation, context refresh).
    *
    * @param {string} event - Lifecycle event name. Must be one of: 'wave-complete', 'pause', 'review-stage-complete'
    * @param {function(): Promise<void>} handler - Async handler to invoke when event fires
    * @throws {Error} If event name is not in VALID_EVENTS
    */
   ```
   Implementation:
   - Validate `event` is in `VALID_EVENTS`, throw if not
   - Initialize `_hookRegistry[event]` as empty array if not present
   - Push `handler` onto the array

3. Implement `fireCompactionTrigger(event, context)`:
   ```javascript
   /**
    * Fire all registered handlers for a lifecycle event.
    * Handlers are called sequentially. Errors are caught and logged but do not
    * prevent subsequent handlers from running.
    *
    * @param {string} event - Lifecycle event name
    * @param {Object} [context] - Optional context passed to handlers
    * @returns {Promise<{fired: number, errors: string[]}>}
    */
   ```
   Implementation:
   - Look up handlers in `_hookRegistry[event]`
   - Call each handler with `context` argument, catching errors
   - Return count of handlers fired and any error messages

4. Implement `clearHooks()`:
   ```javascript
   /**
    * Clear all registered hooks. Primarily for testing.
    */
   ```
   Implementation: reset `_hookRegistry` to empty object.

5. Implement `getRegisteredHooks()`:
   ```javascript
   /**
    * Get a snapshot of registered hooks for inspection.
    * @returns {Object<string, number>} Map of event name to handler count
    */
   ```

6. Export all functions: `compactContext`, `registerCompactionTrigger`, `fireCompactionTrigger`, `clearHooks`, `getRegisteredHooks`, `resolveDigestPath`, `readDigestOrFull`, `isVerbatimArtifact`, `DEFAULT_BUDGET_TOKENS`.

**What NOT to do:**
- Do NOT allow custom event names beyond the three hardcoded ones.
- Do NOT make the registry per-set or per-instance -- it is a global singleton.
- Do NOT implement actual compaction logic inside hooks -- hooks are notification points, not compaction drivers.

**Verification:**
```bash
node -e "
const c = require('./src/lib/compaction.cjs');
c.clearHooks();
c.registerCompactionTrigger('wave-complete', async () => { console.log('hook fired'); });
console.log(JSON.stringify(c.getRegisteredHooks()));
c.fireCompactionTrigger('wave-complete').then(r => console.log('fired:', r.fired));
"
# Expected: {"wave-complete":1}
# Expected: hook fired
# Expected: fired: 1
```

### Task 3: Implement `collectWaveArtifacts` helper

**Files:** `src/lib/compaction.cjs`

**Actions:**
1. Add a helper function that scans a set directory and builds the `context.waves` structure expected by `compactContext()`:

   ```javascript
   /**
    * Scan a set's planning directory and collect wave artifacts grouped by wave number.
    * Looks for wave-N-PLAN.md, WAVE-N-COMPLETE.md, WAVE-N-HANDOFF.md, and
    * review artifacts (REVIEW-SCOPE.md, REVIEW-UNIT.md, REVIEW-BUGS.md, REVIEW-UAT.md).
    *
    * @param {string} setDir - Absolute path to .planning/sets/{setId}/
    * @returns {Array<{wave: number, artifacts: Array<{name: string, path: string}>}>}
    */
   function collectWaveArtifacts(setDir) { ... }
   ```

2. Implementation:
   - Read directory entries from `setDir`
   - Match files against patterns:
     - `wave-(\d+)-PLAN.md` -> wave N, name = 'PLAN'
     - `WAVE-(\d+)-COMPLETE.md` -> wave N, name = 'COMPLETE'
     - `WAVE-(\d+)-HANDOFF.md` -> wave N, name = 'HANDOFF'
   - Also collect set-level artifacts (wave 0 or "set-level"):
     - `CONTRACT.json`, `CONTEXT.md`, `SET-OVERVIEW.md`, `DEFINITION.md`
   - Collect review artifacts as a special group (wave 999 or "review"):
     - `REVIEW-SCOPE.md`, `REVIEW-UNIT.md`, `REVIEW-BUGS.md`, `REVIEW-UAT.md`
   - Sort wave groups by wave number ascending
   - Return the structured array

3. Export `collectWaveArtifacts`.

**What NOT to do:**
- Do NOT read file contents in this function -- only collect paths. Content reading happens in `compactContext()`.
- Do NOT fail if the directory does not exist -- return an empty array.

**Verification:**
```bash
node -e "
const c = require('./src/lib/compaction.cjs');
// Use a set that has wave plans
const artifacts = c.collectWaveArtifacts('./.planning/sets/review-pipeline');
console.log('Wave groups:', artifacts.length);
for (const w of artifacts) {
  console.log('Wave', w.wave, ':', w.artifacts.map(a => a.name).join(', '));
}
"
# Expected: Multiple wave groups with PLAN artifacts
```

### Task 4: Create comprehensive unit tests in `src/lib/compaction.test.cjs`

**Files:** `src/lib/compaction.test.cjs`

**Actions:**
1. Create test file using `node:test` and `node:assert/strict` (project convention).

2. Test `resolveDigestPath`:
   - `wave-1-PLAN.md` -> `wave-1-PLAN-DIGEST.md`
   - `HANDOFF.md` -> `HANDOFF-DIGEST.md`
   - `REVIEW-SCOPE.md` -> `REVIEW-SCOPE-DIGEST.md`
   - Non-`.md` files: `CONTRACT.json` -> `CONTRACT.json-DIGEST.md`

3. Test `readDigestOrFull`:
   - Create temp directory with an artifact file AND its digest sibling
   - Verify it returns digest content with `isDigest: true`
   - Remove digest, verify it returns full content with `isDigest: false`
   - Verify token count is populated

4. Test `isVerbatimArtifact`:
   - `CONTRACT.json` -> true (in VERBATIM_PATTERNS)
   - `wave-1-PLAN.md` -> false

5. Test `compactContext` -- budget enforcement:
   - Create temp directory structure with multiple wave artifacts
   - Create digest files for completed waves (smaller than originals)
   - Call `compactContext` with `activeWave: 2`
   - Verify wave 1 artifacts use digests
   - Verify wave 2 artifacts use full content
   - Verify `totalTokens` is within budget
   - Verify `digestsUsed` and `fullsUsed` counts

6. Test `compactContext` -- digest fallback:
   - Create artifacts WITHOUT digest siblings for completed waves
   - Call `compactContext`
   - Verify full content is used (graceful fallback)
   - Verify `isDigest: false` for all artifacts

7. Test `compactContext` -- verbatim patterns:
   - Include CONTRACT.json in completed wave
   - Verify it stays verbatim even when digests exist

8. Test `compactContext` -- active wave exemption:
   - Mark wave 2 as active
   - Create digests for wave 2 artifacts
   - Verify wave 2 artifacts use FULL content, not digests

9. Test `compactContext` -- budget exceeded flag:
   - Create very large artifacts that exceed 120k tokens
   - Verify `budgetExceeded: true` in result

10. Test hook registry:
    - Register a hook for 'wave-complete', fire it, verify handler called
    - Register multiple hooks for same event, verify all called
    - Fire event with no hooks registered, verify `fired: 0`
    - Register hook for invalid event, verify throws
    - `clearHooks()` removes all, `getRegisteredHooks()` returns empty
    - Error in handler does not prevent subsequent handlers

11. Test `collectWaveArtifacts`:
    - Create temp directory with wave-1-PLAN.md, wave-2-PLAN.md, WAVE-1-COMPLETE.md
    - Verify grouped by wave number
    - Verify nonexistent directory returns empty array

12. Test disk recoverability (behavioral contract):
    - Create full artifacts and digests
    - Call `compactContext` to get compacted result
    - Verify each compacted artifact has a `path` field pointing to the full artifact on disk
    - Verify the full artifact is readable at that path

**What NOT to do:**
- Do NOT use any test framework other than `node:test`.
- Do NOT create complex test fixtures -- simple string content is sufficient.
- Do NOT test integration with execute.cjs -- that is Wave 2.

**Verification:**
```bash
node --test src/lib/compaction.test.cjs
# Expected: all tests pass
```

## Success Criteria

- `src/lib/compaction.cjs` exports `compactContext`, `registerCompactionTrigger`, `fireCompactionTrigger`, `clearHooks`, `getRegisteredHooks`, `resolveDigestPath`, `readDigestOrFull`, `isVerbatimArtifact`, `collectWaveArtifacts`, `DEFAULT_BUDGET_TOKENS`
- `compactContext()` reads digest siblings for completed waves and full content for active waves
- Missing digests fall back to full content gracefully (no errors)
- `CONTRACT.json` and other small artifacts stay verbatim regardless of wave completion status
- Budget exceeded flag is set when total tokens exceed 120k
- Hook registry accepts only 'wave-complete', 'pause', 'review-stage-complete' events
- All unit tests pass in `src/lib/compaction.test.cjs`
- `estimateTokens` is reused from `tool-docs.cjs` (no reimplementation)
