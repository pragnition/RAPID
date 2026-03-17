# Wave 2: Integration with Execute Pipeline and Digest Production Reminders

## Objective

Integrate the compaction engine from Wave 1 into the RAPID execution pipeline. Modify `assembleExecutorPrompt()` in `execute.cjs` to use `compactContext()` for completed wave artifacts when building multi-wave prompts. Modify `skills/execute-set/SKILL.md` to inject digest production reminders into executor agent prompts and to write digest files after wave completion. Add integration tests verifying the end-to-end compaction lifecycle.

## Tasks

### Task 1: Modify `assembleExecutorPrompt()` in `execute.cjs` to support compacted context

**Files:** `src/lib/execute.cjs`

**Actions:**
1. Add a require for the compaction module at the top of execute.cjs:
   ```javascript
   const compaction = require('./compaction.cjs');
   ```

2. Add a new function `assembleCompactedWaveContext(cwd, setName, activeWave)`:
   ```javascript
   /**
    * Build a compacted context string for multi-wave execution.
    * For completed waves, uses digest siblings if available.
    * For the active wave, includes full content.
    *
    * @param {string} cwd - Project root directory
    * @param {string} setName - Name of the set
    * @param {number} activeWave - Current wave number being executed (1-based)
    * @returns {{ contextString: string, stats: { totalTokens: number, digestsUsed: number, fullsUsed: number, budgetExceeded: boolean } }}
    */
   ```
   Implementation:
   - Compute `setDir = path.join(cwd, '.planning', 'sets', setName)`
   - Call `compaction.collectWaveArtifacts(setDir)` to discover artifacts
   - Call `compaction.compactContext({ setId: setName, setDir, activeWave, waves: artifacts })`
   - Build a formatted Markdown string from the compacted result:
     - For each wave group, add a `### Wave N (completed - digest)` or `### Wave N (active)` header
     - Under each header, include the artifact content (digest or full)
     - Include a footer noting how many digests were used vs full reads
   - Return the formatted string and stats

3. Modify `assembleExecutorPrompt()` (the `execute` case, around line 132-149):
   - Add an optional 5th parameter `activeWave` (number, default 0):
     ```javascript
     function assembleExecutorPrompt(cwd, setName, phase, priorContext, activeWave = 0)
     ```
   - In the `case 'execute':` block, if `activeWave > 1` (meaning this is wave 2+ in a multi-wave run):
     - Call `assembleCompactedWaveContext(cwd, setName, activeWave)`
     - Insert the compacted context as a "## Prior Wave Context" section between the scoped CLAUDE.md and the Implementation Plan section
   - If `activeWave <= 1` or `activeWave === 0`: behave exactly as before (no compaction for single-wave or first-wave execution)

4. Export `assembleCompactedWaveContext` for testing.

**What NOT to do:**
- Do NOT modify the `discuss` or `plan` phase assembly -- compaction only applies to `execute`.
- Do NOT remove the existing `priorContext` parameter or change its behavior -- the compacted wave context is additive.
- Do NOT modify `prepareSetContext()` -- it stays unchanged.
- Do NOT modify `generateScopedClaudeMd()` in worktree.cjs.
- Do NOT break the existing function signature for callers that do not pass `activeWave`.

**Verification:**
```bash
node -e "
const execute = require('./src/lib/execute.cjs');
console.log(typeof execute.assembleCompactedWaveContext === 'function');
// Verify assembleExecutorPrompt still works without activeWave (backward compat)
// This will fail if set doesn't exist, but the function signature should accept 4 args
console.log(execute.assembleExecutorPrompt.length >= 4);
"
# Expected: true true
```

### Task 2: Modify `skills/execute-set/SKILL.md` to inject digest production reminders

**Files:** `skills/execute-set/SKILL.md`

**Actions:**
1. In Step 4b ("Execute Wave Batches"), modify the executor task prompt template to include a digest production reminder. After the existing "## Commit Convention" section, add a new section:

   For **single-wave batches:**
   ```
   ## Digest Production
   After completing all tasks in this wave, produce digest files for large artifacts:
   - If you wrote or modified a wave-{N}-PLAN.md (you did not -- it was your input), skip.
   - For any WAVE-{N}-HANDOFF.md you produce: also write a WAVE-{N}-HANDOFF-DIGEST.md sibling
     containing a 5-10 line summary with: key decisions made, files modified, tasks completed/remaining.
   - Digest files go in the same directory as the original artifact.
   - Do NOT produce digests for small files under 500 tokens (~2000 chars).
   ```

   For **multi-wave batches (parallel):** Add the same digest production section.

2. In Step 4c ("Process Batch Results"), after writing the WAVE-{N}-COMPLETE.md marker, add a step to generate a digest for the plan file:

   After writing `WAVE-{N}-COMPLETE.md`:
   ```
   Also write a wave-{N}-PLAN-DIGEST.md to `.planning/sets/${SET_ID}/wave-${N}-PLAN-DIGEST.md`:

   ```markdown
   # Wave {N} Plan Digest

   **Objective:** {1-line summary from the wave plan's ## Objective}
   **Tasks:** {N} tasks completed
   **Key files:** {comma-separated list of primary files created/modified}
   **Approach:** {1-2 line summary of the implementation approach}
   **Status:** Complete
   ```

   This plan digest is generated by the orchestrator (this skill), not by the executor agent, because the orchestrator has the wave plan content and completion status.

3. In Step 2 ("Re-Entry Detection"), when a wave is detected as complete (marker exists and commits verified), add a note about using the digest:
   ```
   If wave is complete AND wave-{N}-PLAN-DIGEST.md exists: note "(digest available)"
   ```

4. In Step 4b, when building the executor agent prompt for wave N > 1, add context about prior completed waves using digests:
   ```
   ## Prior Wave Context (Compacted)
   {For each completed wave M < N: read wave-{M}-PLAN-DIGEST.md if it exists, otherwise skip.
    Format as: "Wave {M}: {digest content}"}
   ```

   This ensures executor agents for later waves have awareness of what was built in earlier waves, without consuming the full plan content.

**What NOT to do:**
- Do NOT modify Steps 0, 1, 3, 5, or 6 -- only Steps 2, 4b, and 4c.
- Do NOT add digests for WAVE-COMPLETE.md markers -- they are already compact (~10 lines).
- Do NOT require executor agents to produce plan digests -- the orchestrator does that in Step 4c.
- Do NOT add a new RAPID_TOOLS CLI command for digest generation -- it is done inline in the skill.

**Verification:**
```bash
# Verify the digest production section exists in the skill
grep -c "Digest Production" skills/execute-set/SKILL.md
# Expected: >= 1

# Verify plan-digest generation step exists
grep -c "PLAN-DIGEST.md" skills/execute-set/SKILL.md
# Expected: >= 2

# Verify prior wave context section exists
grep -c "Prior Wave Context" skills/execute-set/SKILL.md
# Expected: >= 1
```

### Task 3: Add integration tests for compaction in execute pipeline

**Files:** `src/lib/compaction.test.cjs`

**Actions:**
1. Add a new describe block "integration with execute" to `src/lib/compaction.test.cjs`:

2. Test: multi-wave context assembly:
   - Create temp directory with `.planning/sets/test-set/` containing:
     - `wave-1-PLAN.md` (large: ~4000 chars)
     - `wave-1-PLAN-DIGEST.md` (small: ~500 chars, 5-10 lines)
     - `WAVE-1-COMPLETE.md` (small marker file)
     - `wave-2-PLAN.md` (large: ~4000 chars, the active wave)
     - `CONTRACT.json` (small)
   - Call `compactContext` with `activeWave: 2`
   - Verify wave 1 PLAN artifact uses digest (smaller content)
   - Verify wave 2 PLAN artifact uses full content
   - Verify CONTRACT.json stays verbatim
   - Verify `totalTokens < budget`

3. Test: digest-first reduces token count:
   - Create same structure as above
   - Call `compactContext` twice: once with digests present, once without
   - Verify the digest version has fewer tokens

4. Test: HANDOFF digest handling:
   - Create `WAVE-1-HANDOFF.md` (medium: ~2000 chars)
   - Create `WAVE-1-HANDOFF-DIGEST.md` (small: ~400 chars)
   - Verify compaction uses the digest for completed wave

5. Test: review artifact compaction:
   - Create `REVIEW-SCOPE.md`, `REVIEW-UNIT.md` with large content
   - Create `REVIEW-SCOPE-DIGEST.md`, `REVIEW-UNIT-DIGEST.md` with summaries
   - Verify compaction uses digests for review artifacts

6. Test: `assembleCompactedWaveContext` function:
   - Create the same temp directory structure
   - Stub or use the actual function from execute.cjs
   - Verify the returned `contextString` contains "completed - digest" headers for completed waves
   - Verify the returned `contextString` contains "active" header for the active wave
   - Verify `stats.digestsUsed > 0`

**What NOT to do:**
- Do NOT test `assembleExecutorPrompt` directly in these tests -- that requires a full mock project with DEFINITION.md and CONTRACT.json. Test `assembleCompactedWaveContext` instead.
- Do NOT test the SKILL.md changes programmatically -- those are manual verification.

**Verification:**
```bash
node --test src/lib/compaction.test.cjs
# Expected: all tests pass including integration tests
```

### Task 4: Add `compactContext` CLI subcommand to `src/bin/rapid-tools.cjs`

**Files:** `src/bin/rapid-tools.cjs`

**Actions:**
1. Add a new CLI subcommand `compact context <set-id>` that:
   - Takes a set ID as argument
   - Calls `compaction.collectWaveArtifacts()` then `compaction.compactContext()`
   - Outputs JSON with stats: `{ totalTokens, digestsUsed, fullsUsed, budgetExceeded, artifacts: [{wave, name, tokens, isDigest}] }`
   - This is primarily a diagnostic tool for developers to inspect compaction behavior

2. Add the subcommand to the existing command routing in rapid-tools.cjs. Follow the existing pattern for subcommand registration (look at how `state`, `plan`, `resolve`, `display` subcommands are registered).

3. The command should accept an optional `--active-wave N` flag to specify which wave is active (defaults to 0 = no active wave, compact everything).

**What NOT to do:**
- Do NOT modify any existing subcommands.
- Do NOT add the command to the TOOL_REGISTRY in tool-docs.cjs (it is a diagnostic command, not used by agents).

**Verification:**
```bash
RAPID_TOOLS="./src/bin/rapid-tools.cjs"
node "${RAPID_TOOLS}" compact context review-pipeline 2>&1 | head -5
# Expected: JSON output with totalTokens, digestsUsed, etc. (or graceful error if set doesn't exist)
```

### Task 5: Fire compaction hooks from execute-set skill lifecycle points

**Files:** `src/lib/compaction.cjs`

**Actions:**
1. Add a convenience function `registerDefaultHooks()` that registers built-in hooks:
   ```javascript
   /**
    * Register the default compaction lifecycle hooks.
    * Called once during RAPID initialization.
    *
    * Hooks:
    * - 'wave-complete': Validates that plan digests exist for completed waves.
    *   Logs a warning if digest is missing (does not block execution).
    * - 'pause': No-op placeholder for future pause-time compaction.
    * - 'review-stage-complete': No-op placeholder for future review compaction.
    *
    * @param {string} cwd - Project root directory
    */
   function registerDefaultHooks(cwd) { ... }
   ```

2. The 'wave-complete' hook implementation:
   ```javascript
   async function onWaveComplete(context) {
     // context: { setId, waveNum, setDir }
     const planFile = path.join(context.setDir, `wave-${context.waveNum}-PLAN.md`);
     const digestFile = resolveDigestPath(planFile);
     if (fs.existsSync(planFile) && !fs.existsSync(digestFile)) {
       // Log warning -- the execute-set skill should have created this
       console.error(`[COMPACTION WARN] Missing plan digest: ${digestFile}`);
     }
   }
   ```

3. Export `registerDefaultHooks`.

4. Add test for `registerDefaultHooks`:
   - Call it with a temp cwd
   - Verify hooks are registered for all three events
   - Fire 'wave-complete' with a context that has a plan file but no digest
   - Verify the warning is logged (capture stderr or check return value)

**What NOT to do:**
- Do NOT make hooks block execution -- they are advisory only.
- Do NOT register hooks automatically on module import -- require explicit `registerDefaultHooks()` call.

**Verification:**
```bash
node -e "
const c = require('./src/lib/compaction.cjs');
c.clearHooks();
c.registerDefaultHooks('/tmp');
console.log(JSON.stringify(c.getRegisteredHooks()));
"
# Expected: {"wave-complete":1,"pause":1,"review-stage-complete":1}
```

## Success Criteria

- `assembleExecutorPrompt()` in execute.cjs accepts optional `activeWave` parameter and injects compacted prior wave context for wave 2+
- `assembleCompactedWaveContext()` is exported from execute.cjs and builds formatted context strings using digest siblings
- `skills/execute-set/SKILL.md` includes digest production reminders for executor agents
- `skills/execute-set/SKILL.md` generates `wave-N-PLAN-DIGEST.md` after each wave completes
- `skills/execute-set/SKILL.md` injects compacted prior wave context into executor prompts for wave 2+
- `compact context` CLI subcommand outputs diagnostic JSON with compaction stats
- Default hooks are registered for 'wave-complete', 'pause', 'review-stage-complete'
- All new and existing tests pass in `src/lib/compaction.test.cjs` and `src/lib/execute.test.cjs`
- Backward compatibility: existing callers of `assembleExecutorPrompt()` with 4 arguments continue to work unchanged
