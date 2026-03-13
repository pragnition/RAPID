# Phase 23: Merge Pipeline - Research

**Researched:** 2026-03-08
**Domain:** Git merge orchestration, multi-level conflict detection, resolution cascade, bisection recovery
**Confidence:** HIGH

## Summary

Phase 23 rewrites the existing v1.0 merge pipeline (merge.cjs + skills/merge/SKILL.md) from scratch to deliver the Mark II merge system. The v1.0 pipeline already provides DAG-ordered merging, programmatic validation gates, reviewer subagent orchestration, and integration testing -- these patterns are well-tested and should be preserved conceptually while being rebuilt with v2.0 capabilities. The new pipeline adds 5-level conflict detection (textual, structural, dependency, API, semantic), a 4-tier resolution cascade, per-set MERGE-STATE.json tracking, bisection recovery, and single-set rollback. A new `role-merger.md` agent role handles conflict detection and resolution, separate from the existing `role-reviewer.md` which stays for code quality review.

The technical challenge is primarily in the detection levels 2-4 (structural, dependency, API) which need code-based analysis. The project has an established pattern of using string-matching over AST parsing (Phase 22 decision for findDependents), and this approach should be extended for consistency and to avoid new dependencies. Level 5 (semantic) is handled by the merger agent reading CONTEXT.md files and plans. The resolution cascade is mostly a decision-tree problem: deterministic fixes are git-resolvable, heuristics use OWNERSHIP.json and DAG order, AI-assisted resolution is a merger agent call, and human escalation uses the established AskUserQuestion pattern with confidence thresholds.

**Primary recommendation:** Rewrite merge.cjs with all v2.0 functions organized by concern (detection, resolution, bisection, rollback, state), rewrite SKILL.md as the merger pipeline orchestrator, create role-merger.md for conflict analysis, and add new CLI subcommands. Preserve v1.0 patterns (getMergeOrder, mergeSet, runIntegrationTests) while expanding capabilities. Use string-matching and regex for structural/dependency/API detection -- no new AST dependencies.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Multi-pass pipeline: git handles textual (level 1), code-based Node.js functions handle structural/dependency/API (levels 2-4), spawned merger agent handles semantic (level 5)
- Hybrid approach: code-based analysis for deterministic pattern-matching levels, agent-based for intent/behavioral analysis
- All 5 levels run on every merge -- no gated escalation, always get the complete picture
- Semantic conflict = both intent divergence (two sets modify related functionality in incompatible ways) AND contract behavioral mismatch (merged code violates interface contracts)
- Semantic agent reads both sets' CONTEXT.md/plans to understand intent, then evaluates merged code against contracts
- Tier 1 (deterministic): Auto-resolve all textual non-overlap -- whitespace, formatting, non-overlapping additions
- Tier 2 (heuristic): Uses file ownership (OWNERSHIP.json), DAG dependency order, and common conflict patterns
- Tier 3 (AI-assisted): Merger agent writes resolved code directly and applies it. User sees resolution in merge report but doesn't approve each one individually
- Tier 4 (human escalation): Triggered by confidence threshold -- tier 3 AI resolution includes a confidence score, below threshold escalates to human
- Bisection recovery: Triggers automatically on post-wave integration gate failure. Uses git-based binary search
- Rollback scope: Single set revert -- revert just the problematic set's merge commit. Dependent sets that merged after stay
- Rollback confirmation: Auto-revert for single set (no confirmation needed). If dependent sets would be affected by cascade, ask user first via AskUserQuestion
- Rewrite merge.cjs from scratch with all v2.0 capabilities
- Rewrite SKILL.md from scratch
- New role-merger.md agent role for conflict detection + resolution
- Separate MERGE-STATE.json per set for detailed merge progress tracking

### Claude's Discretion
- Tier 2 heuristic specifics -- what patterns to recognize, how to weight ownership vs dependency order
- Confidence threshold value for tier 3 to tier 4 escalation
- MERGE-STATE.json schema and fields
- Bisection binary search implementation details (grouping strategy, test timeout)
- How to detect structural/dependency/API conflicts programmatically (AST vs grep vs hybrid)
- CLI subcommand design for new merge operations
- Merger agent prompt design

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MERG-01 | /merge merges completed sets back to main with 5-level conflict detection (textual, structural, dependency, API, semantic) | Detection architecture: git diff for L1, string-matching/regex functions for L2-L4, merger agent for L5. All in rewritten merge.cjs |
| MERG-02 | 4-tier resolution cascade (deterministic > heuristic > AI-assisted > human escalation) | Resolution functions in merge.cjs, merger agent for tier 3, AskUserQuestion for tier 4. Confidence threshold at 0.7 |
| MERG-03 | Per-set merge state tracking integrated with hierarchical state machine | MERGE-STATE.json per set in .planning/sets/{setName}/ with detection/resolution/bisection progress. Set status stays simple ('merging') in STATE.json |
| MERG-04 | Sets merge in dependency-graph order via DAG | Preserved from v1.0 getMergeOrder pattern using dag.getExecutionOrder(). Already works |
| MERG-05 | Bisection recovery isolates breaking set interaction via binary search | New bisectWave() function: revert to pre-wave state, re-merge in binary groups, run tests. Uses git revert -m 1 and git merge --no-ff |
| MERG-06 | Rollback with cascade revert undoes problematic merges and re-merges remaining sets | revertSetMerge() using git revert -m 1 on merge commit hash stored in MERGE-STATE.json. Cascade detection checks dependent sets via DAG |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (fs, path, child_process) | Node 18+ | File I/O, git command execution | Zero dependencies, project convention |
| zod | ^3.25.76 | Schema validation for MERGE-STATE.json | Already in project, used everywhere |
| proper-lockfile | ^4.1.2 | Lock-protected atomic writes | Already in project via lock.cjs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ajv | ^8.17.1 | Contract validation in detection pipeline | Already in project, reuse from contract.cjs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| String-matching for L2-L4 detection | acorn AST parsing | AST gives better accuracy but adds dependency, more complexity, slower. Project convention is string-matching (Phase 22 decision). Use string-matching |
| Custom bisection | git bisect run | git bisect operates on single branch commits, not cross-set merges. Custom binary search is needed for set-level bisection |
| simple-git npm package | raw child_process/execFileSync | Project uses worktree.gitExec() everywhere. Keep consistent -- no new git abstraction |

**Installation:**
```bash
# No new dependencies needed -- all requirements met by existing packages
```

## Architecture Patterns

### Recommended Project Structure
```
src/lib/
  merge.cjs           # REWRITE: All v2.0 merge functions (detection, resolution, bisection, rollback, state)
  merge.test.cjs      # REWRITE: Comprehensive tests for all new functions
src/modules/roles/
  role-merger.md       # NEW: Merger agent for L5 semantic detection + tier 3 AI resolution
src/bin/
  rapid-tools.cjs      # MODIFY: New/updated merge subcommands
skills/merge/
  SKILL.md             # REWRITE: v2.0 merge pipeline orchestrator
.planning/sets/{setName}/
  MERGE-STATE.json     # NEW: Per-set merge progress tracking
```

### Pattern 1: Detection Pipeline (Funnel Architecture)
**What:** All 5 detection levels run sequentially, each producing a structured conflict report. Fast levels first, expensive last.
**When to use:** Every merge attempt
**Example:**
```javascript
// Source: RAPID project conventions
function detectConflicts(cwd, setName, baseBranch) {
  const results = {
    textual: detectTextualConflicts(cwd, setName, baseBranch),     // L1: git merge --no-commit + diff
    structural: detectStructuralConflicts(cwd, setName, baseBranch), // L2: function/class overlap
    dependency: detectDependencyConflicts(cwd, setName, baseBranch), // L3: import/require changes
    api: detectAPIConflicts(cwd, setName, baseBranch),              // L4: export signature changes
    semantic: null, // L5: populated by merger agent
  };
  return results;
}
```

### Pattern 2: Resolution Cascade
**What:** Tiered resolution from cheapest to most expensive, with confidence scoring
**When to use:** After detection identifies conflicts
**Example:**
```javascript
// Source: RAPID project conventions
function resolveConflicts(detectionResults, options) {
  const resolutions = [];

  for (const conflict of detectionResults.allConflicts) {
    // Tier 1: deterministic (non-overlapping, whitespace, formatting)
    const t1 = tryDeterministicResolve(conflict);
    if (t1.resolved) { resolutions.push({ ...t1, tier: 1 }); continue; }

    // Tier 2: heuristic (ownership, DAG order, common patterns)
    const t2 = tryHeuristicResolve(conflict, options.ownership, options.dagOrder);
    if (t2.resolved) { resolutions.push({ ...t2, tier: 2 }); continue; }

    // Tier 3: AI-assisted (merger agent writes resolution)
    // Tier 4: human escalation (if tier 3 confidence < threshold)
    resolutions.push({ conflict, tier: 3, needsAgent: true });
  }

  return resolutions;
}
```

### Pattern 3: MERGE-STATE.json Per-Set Tracking
**What:** Detailed merge progress stored per-set, separate from STATE.json
**When to use:** Throughout the merge pipeline for each set being merged
**Example:**
```javascript
// Source: RAPID project conventions (extending review pattern of per-wave tracking)
const MergeState = z.object({
  setId: z.string(),
  status: z.enum(['pending', 'detecting', 'resolving', 'merging', 'testing', 'complete', 'failed', 'reverted']),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  detection: z.object({
    textual: z.object({ conflicts: z.number(), resolved: z.number() }).optional(),
    structural: z.object({ conflicts: z.number(), resolved: z.number() }).optional(),
    dependency: z.object({ conflicts: z.number(), resolved: z.number() }).optional(),
    api: z.object({ conflicts: z.number(), resolved: z.number() }).optional(),
    semantic: z.object({ conflicts: z.number(), resolved: z.number() }).optional(),
  }).optional(),
  resolution: z.object({
    tier1: z.number().default(0),
    tier2: z.number().default(0),
    tier3: z.number().default(0),
    tier4: z.number().default(0),
    escalated: z.array(z.string()).default([]),
  }).optional(),
  mergeCommit: z.string().optional(),
  bisection: z.object({
    triggered: z.boolean().default(false),
    breakingSet: z.string().optional(),
    iterations: z.number().default(0),
  }).optional(),
  lastUpdatedAt: z.string(),
});
```

### Pattern 4: Bisection Recovery
**What:** Binary search over merged sets when post-wave integration tests fail
**When to use:** Automatically on integration gate failure
**Example:**
```javascript
// Source: Git bisect concepts applied to set-level merging
async function bisectWave(cwd, baseBranch, mergedSets, preWaveCommit) {
  // 1. Revert all wave merges to pre-wave state
  gitExec(['reset', '--hard', preWaveCommit], cwd);

  // 2. Binary search: split sets, re-merge halves, test
  let lo = 0, hi = mergedSets.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const subset = mergedSets.slice(lo, mid + 1);

    // Re-merge this subset
    for (const set of subset) mergeSet(cwd, set, baseBranch);

    // Run tests
    const testResult = runIntegrationTests(cwd);

    // Reset for next iteration
    gitExec(['reset', '--hard', preWaveCommit], cwd);

    if (!testResult.passed) {
      hi = mid; // Bug is in first half
    } else {
      lo = mid + 1; // Bug is in second half (or interaction)
    }
  }

  return { breakingSet: mergedSets[lo] };
}
```

### Anti-Patterns to Avoid
- **Adding AST dependencies:** Project convention is string-matching for code analysis. Do not add acorn, babel, or typescript as dependencies.
- **Modifying STATE.json with merge detail:** Keep STATE.json set status simple ('merging'). Use separate MERGE-STATE.json for detection/resolution/bisection progress.
- **Blocking on individual AI resolutions:** Tier 3 AI resolutions are applied directly without per-resolution user approval. Only escalate when confidence is below threshold.
- **Mutating the state machine transitions:** The SET_TRANSITIONS already have reviewing -> merging -> complete. Do not add new states to state-transitions.cjs.
- **Using `git add -A` or `git add .`:** Project convention prohibits this in all merge/commit operations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DAG-ordered merging | Custom topological sort | dag.getExecutionOrder() via getMergeOrder() | Already works, well-tested |
| Lock-protected writes | Custom file locking | acquireLock() from lock.cjs | Already handles stale locks, retries |
| Zod schema validation | Manual field checks | Zod schemas (MergeState, ConflictReport) | Project convention, type-safe |
| Git command execution | Raw child_process | worktree.gitExec() | Structured results, consistent error handling |
| Agent prompt assembly | String concatenation | assembler.assembleAgent() pattern | Frontmatter, modules, context injection |
| Structured returns | Ad-hoc JSON | returns.generateReturn() / RAPID:RETURN protocol | Machine-parseable, validated by Zod |
| User decision gates | console.log + readline | AskUserQuestion with options | Project convention, 13+ gates in review module |

**Key insight:** The v1.0 merge pipeline already solves DAG ordering, git merge execution, integration testing, and worktree registry updates. The rewrite adds detection, resolution, bisection, and rollback on top of these proven patterns.

## Common Pitfalls

### Pitfall 1: Git merge state pollution
**What goes wrong:** A failed `git merge --no-commit` for detection leaves the working tree in a dirty state, blocking subsequent operations.
**Why it happens:** Detection needs to attempt a merge to find textual conflicts, but if not cleaned up, the partial merge state persists.
**How to avoid:** Always run `git merge --abort` after `git merge --no-commit` for detection purposes. Use a try/finally pattern to guarantee cleanup.
**Warning signs:** `git status` shows "You have unmerged paths" after detection.

### Pitfall 2: Merge commit parent confusion in revert
**What goes wrong:** `git revert <commit>` on a merge commit fails without `-m 1` flag.
**Why it happens:** Merge commits have two parents; git needs to know which parent to revert to.
**How to avoid:** Always use `git revert -m 1 <merge-commit-hash>` where parent 1 is the base branch (main).
**Warning signs:** git error "commit is a merge but no -m option was given".

### Pitfall 3: Bisection resets destroying state
**What goes wrong:** `git reset --hard` during bisection destroys MERGE-STATE.json and other .planning/ files.
**Why it happens:** The .planning/ directory is tracked in git, so reset affects it too.
**How to avoid:** Before bisection, save MERGE-STATE.json to a temp location outside the git tree. Restore after bisection completes. Or use `git stash` for .planning/ files before reset.
**Warning signs:** MERGE-STATE.json is missing or reverted after bisection.

### Pitfall 4: Circular cascade in rollback
**What goes wrong:** Rolling back set A triggers re-merge of dependent sets B and C, which may conflict with each other without A.
**Why it happens:** Rollback naively re-merges remaining sets without checking if they were only compatible because of A.
**How to avoid:** After single-set rollback, run integration tests immediately. If they fail, inform user rather than trying automated re-merge of dependents.
**Warning signs:** Cascading test failures after rollback.

### Pitfall 5: Registry/STATE.json desync
**What goes wrong:** REGISTRY.json merge status and STATE.json set status get out of sync.
**Why it happens:** v1.0 tracks merge status in REGISTRY.json (mergeStatus field) while v2.0 uses STATE.json (set status = 'merging'). Both need updating.
**How to avoid:** Update both atomically in each merge operation. Use the CLI state transition command for STATE.json and registryUpdate for REGISTRY.json.
**Warning signs:** /rapid:status shows different merge state than /rapid:merge status.

### Pitfall 6: NODE_TEST_CONTEXT inheritance
**What goes wrong:** Integration tests run inside the merge pipeline inherit the parent process's NODE_TEST_CONTEXT, causing nested test runners to silently swallow failures.
**Why it happens:** Node.js test runner sets NODE_TEST_CONTEXT env var; child processes inherit it.
**How to avoid:** The existing runIntegrationTests already deletes NODE_TEST_CONTEXT before spawning. Preserve this pattern in the rewrite.
**Warning signs:** Integration tests report "pass" when they should fail.

## Code Examples

Verified patterns from the existing codebase:

### Textual Conflict Detection (Level 1)
```javascript
// Source: Existing mergeSet pattern in src/lib/merge.cjs
function detectTextualConflicts(cwd, setName, baseBranch) {
  const branch = `rapid/${setName}`;

  // Attempt dry-run merge
  try {
    execFileSync('git', ['merge', '--no-commit', '--no-ff', branch], {
      cwd, encoding: 'utf-8', stdio: 'pipe', timeout: 30000,
    });
    // No textual conflicts
    execFileSync('git', ['merge', '--abort'], { cwd, stdio: 'pipe' });
    return { hasConflicts: false, conflicts: [] };
  } catch (err) {
    const output = (err.stdout || '') + (err.stderr || '');
    if (output.includes('CONFLICT')) {
      // Parse conflicting files from output
      const conflicts = parseConflictFiles(output);
      execFileSync('git', ['merge', '--abort'], { cwd, stdio: 'pipe' });
      return { hasConflicts: true, conflicts };
    }
    // Non-conflict error
    try { execFileSync('git', ['merge', '--abort'], { cwd, stdio: 'pipe' }); } catch { /* ok */ }
    return { hasConflicts: false, error: output };
  }
}
```

### Structural Conflict Detection (Level 2) -- String-Matching Approach
```javascript
// Source: RAPID convention from Phase 22 findDependents pattern
function detectStructuralConflicts(cwd, setName, baseBranch) {
  const branch = `rapid/${setName}`;
  const conflicts = [];

  // Get files changed by this set
  const setChangedFiles = getChangedFiles(cwd, branch, baseBranch);

  // Get files changed on main since branch point
  const mainChangedFiles = getChangedFilesSinceBranchPoint(cwd, branch, baseBranch);

  // Find overlapping files
  const overlapping = setChangedFiles.filter(f => mainChangedFiles.includes(f));

  for (const file of overlapping) {
    // Check if same functions/classes are modified
    const setDiff = getDiffHunks(cwd, branch, baseBranch, file);
    const mainDiff = getDiffHunks(cwd, baseBranch, getBranchPoint(cwd, branch, baseBranch), file);

    // Look for overlapping function definitions using regex
    const setFunctions = extractFunctionNames(setDiff);
    const mainFunctions = extractFunctionNames(mainDiff);
    const overlap = setFunctions.filter(f => mainFunctions.includes(f));

    if (overlap.length > 0) {
      conflicts.push({ file, type: 'structural', functions: overlap });
    }
  }

  return { conflicts };
}

function extractFunctionNames(diffContent) {
  const functionPattern = /^[+-]\s*(?:async\s+)?function\s+(\w+)|^[+-]\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\(|=>)/gm;
  const names = [];
  let match;
  while ((match = functionPattern.exec(diffContent)) !== null) {
    names.push(match[1] || match[2]);
  }
  return [...new Set(names)];
}
```

### Dependency Conflict Detection (Level 3)
```javascript
// Source: RAPID convention from review.cjs findDependents
function detectDependencyConflicts(cwd, setName, baseBranch) {
  const branch = `rapid/${setName}`;
  const conflicts = [];

  // Get changed files from set
  const changedFiles = getChangedFiles(cwd, branch, baseBranch);

  for (const file of changedFiles) {
    // Read file content from both branch and base
    const branchContent = getFileContent(cwd, branch, file);
    const baseContent = getFileContent(cwd, baseBranch, file);

    if (!branchContent || !baseContent) continue;

    // Extract require/import statements using regex (project convention)
    const branchDeps = extractDependencies(branchContent);
    const baseDeps = extractDependencies(baseContent);

    // Find added/removed/changed dependencies
    const added = branchDeps.filter(d => !baseDeps.includes(d));
    const removed = baseDeps.filter(d => !branchDeps.includes(d));

    if (added.length > 0 || removed.length > 0) {
      conflicts.push({ file, type: 'dependency', added, removed });
    }
  }

  return { conflicts };
}

function extractDependencies(content) {
  const deps = [];
  // CommonJS
  const requirePattern = /require\(['"]([^'"]+)['"]\)/g;
  let m;
  while ((m = requirePattern.exec(content)) !== null) deps.push(m[1]);
  // ESM
  const importPattern = /from\s+['"]([^'"]+)['"]/g;
  while ((m = importPattern.exec(content)) !== null) deps.push(m[1]);
  return deps;
}
```

### Merger Agent Registration
```javascript
// Source: src/lib/assembler.cjs pattern
// In ROLE_TOOLS:
'merger': 'Read, Write, Bash, Grep, Glob',

// In ROLE_DESCRIPTIONS:
'merger': 'RAPID merger agent -- performs semantic conflict detection and AI-assisted resolution',
```

### MERGE-STATE.json Write Pattern
```javascript
// Source: RAPID convention from review.cjs logIssue pattern (non-locked writes)
function writeMergeState(cwd, setId, mergeState) {
  const validated = MergeState.parse(mergeState);
  validated.lastUpdatedAt = new Date().toISOString();

  const setDir = path.join(cwd, '.planning', 'sets', setId);
  fs.mkdirSync(setDir, { recursive: true });

  const statePath = path.join(setDir, 'MERGE-STATE.json');
  fs.writeFileSync(statePath, JSON.stringify(validated, null, 2), 'utf-8');
}
```

### Git Revert for Rollback
```javascript
// Source: Git documentation for merge commit revert
function revertSetMerge(cwd, setId, mergeCommitHash) {
  // -m 1 specifies parent 1 (the base branch before merge)
  const result = gitExec(['revert', '-m', '1', '--no-edit', mergeCommitHash], cwd);

  if (!result.ok) {
    if (result.stderr.includes('CONFLICT')) {
      return { reverted: false, reason: 'conflict', detail: result.stderr };
    }
    return { reverted: false, reason: 'error', detail: result.stderr };
  }

  return { reverted: true, revertCommit: getHead(cwd) };
}
```

## State of the Art

| Old Approach (v1.0) | Current Approach (v2.0) | Impact |
|--------------|------------------|--------|
| Simple git merge --no-ff | 5-level conflict detection before merge | Catches structural/dependency/API/semantic conflicts that git misses |
| Reviewer agent for code quality | Separate merger agent for conflicts + reviewer for quality | Clear separation of concerns |
| Manual conflict resolution | 4-tier resolution cascade | Most conflicts resolved automatically |
| No recovery mechanism | Bisection recovery + single-set rollback | Automated failure isolation |
| mergeStatus in REGISTRY.json | MERGE-STATE.json per set + STATE.json transitions | Detailed progress tracking |
| Catch-all error handling | Structured recovery with AskUserQuestion | User always has options |

**Preserved from v1.0:**
- DAG-ordered merging via getMergeOrder()
- `git merge --no-ff` for merge commits
- Post-wave integration gate pattern
- REGISTRY.json merge status updates
- AskUserQuestion for decision gates

## Open Questions

1. **Bisection with .planning/ state files**
   - What we know: `git reset --hard` during bisection would destroy .planning/ state files
   - What's unclear: Best strategy for preserving state during binary search
   - Recommendation: Save MERGE-STATE.json to /tmp before bisection, restore after. Or use `git stash push .planning/` before reset, `git stash pop` after

2. **Confidence threshold calibration**
   - What we know: Tier 3 AI resolutions need a confidence score for escalation to tier 4
   - What's unclear: What value works well in practice (0.5? 0.7? 0.8?)
   - Recommendation: Start with 0.7 (resolves ~70% of cases, escalates clear ambiguity). Make configurable in config.json as `merge.confidenceThreshold`

3. **Concurrent set merges within same wave**
   - What we know: v1.0 SKILL.md merges sets within a wave SEQUENTIALLY
   - What's unclear: Should detection run in parallel even if actual merges are sequential?
   - Recommendation: Keep sequential merging (each merge sees results of previous). Run detection for next set while current is resolving/merging if possible, but this is optimization, not requirement

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node.js 18+) |
| Config file | none -- tests run directly with `node --test` |
| Quick run command | `node --test src/lib/merge.test.cjs` |
| Full suite command | `node --test src/lib/*.test.cjs` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MERG-01 | 5-level conflict detection pipeline | unit | `node --test src/lib/merge.test.cjs` | Will be rewritten in Wave 0 |
| MERG-02 | 4-tier resolution cascade | unit | `node --test src/lib/merge.test.cjs` | Will be rewritten in Wave 0 |
| MERG-03 | MERGE-STATE.json read/write/validate | unit | `node --test src/lib/merge.test.cjs` | Will be rewritten in Wave 0 |
| MERG-04 | DAG-ordered merging | unit | `node --test src/lib/merge.test.cjs` | Existing tests for getMergeOrder (rewrite preserves) |
| MERG-05 | Bisection recovery binary search | unit | `node --test src/lib/merge.test.cjs` | Will be rewritten in Wave 0 |
| MERG-06 | Rollback via git revert -m 1 | unit | `node --test src/lib/merge.test.cjs` | Will be rewritten in Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test src/lib/merge.test.cjs`
- **Per wave merge:** `node --test src/lib/*.test.cjs`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps
- [x] `src/lib/merge.test.cjs` -- exists but will be completely rewritten alongside merge.cjs
- No new framework install needed -- node:test already used project-wide
- No new test infrastructure needed -- existing patterns (createMockProject, createGitProject) serve as templates

## CLI Subcommand Design (Claude's Discretion)

### Recommended New/Updated Subcommands
```
merge detect <set>              Run 5-level conflict detection (returns structured JSON)
merge resolve <set>             Run resolution cascade on detected conflicts
merge bisect <wave>             Run bisection recovery for a failed wave
merge rollback <set>            Revert a merged set's merge commit
merge state <set>               Show MERGE-STATE.json for a set
merge update-state <set> <status>  Update MERGE-STATE.json status

# Preserved from v1.0:
merge execute <set>             Merge set branch into main (--no-ff)
merge order                     Show merge order from DAG (wave-grouped)
merge status                    Show merge pipeline status
merge integration-test          Run post-wave integration test suite
```

### CLI Output Convention
All subcommands output JSON to stdout (via `output()` function), matching existing project pattern. Errors go to stderr via `error()`.

## MERGE-STATE.json Schema Design (Claude's Discretion)

```javascript
const MergeState = z.object({
  setId: z.string(),
  status: z.enum([
    'pending',       // Not yet started
    'detecting',     // Running 5-level detection
    'resolving',     // Running resolution cascade
    'merging',       // Executing git merge
    'testing',       // Running post-merge tests
    'complete',      // Successfully merged
    'failed',        // Merge or tests failed
    'reverted',      // Merge was rolled back
  ]),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),

  // Detection results per level
  detection: z.object({
    textual: z.object({
      ran: z.boolean().default(false),
      conflicts: z.array(z.object({
        file: z.string(),
        type: z.string(),
        detail: z.string().optional(),
      })).default([]),
    }).optional(),
    structural: z.object({
      ran: z.boolean().default(false),
      conflicts: z.array(z.object({
        file: z.string(),
        functions: z.array(z.string()).default([]),
        detail: z.string().optional(),
      })).default([]),
    }).optional(),
    dependency: z.object({
      ran: z.boolean().default(false),
      conflicts: z.array(z.object({
        file: z.string(),
        added: z.array(z.string()).default([]),
        removed: z.array(z.string()).default([]),
      })).default([]),
    }).optional(),
    api: z.object({
      ran: z.boolean().default(false),
      conflicts: z.array(z.object({
        file: z.string(),
        exports: z.array(z.string()).default([]),
        detail: z.string().optional(),
      })).default([]),
    }).optional(),
    semantic: z.object({
      ran: z.boolean().default(false),
      conflicts: z.array(z.object({
        description: z.string(),
        sets: z.array(z.string()).default([]),
        confidence: z.number().optional(),
      })).default([]),
    }).optional(),
  }).optional(),

  // Resolution tracking
  resolution: z.object({
    tier1Count: z.number().default(0),
    tier2Count: z.number().default(0),
    tier3Count: z.number().default(0),
    tier4Count: z.number().default(0),
    escalatedConflicts: z.array(z.string()).default([]),
    allResolved: z.boolean().default(false),
  }).optional(),

  // Merge result
  mergeCommit: z.string().optional(),
  mergeBranch: z.string().optional(),

  // Bisection (if triggered)
  bisection: z.object({
    triggered: z.boolean().default(false),
    breakingSet: z.string().optional(),
    iterations: z.number().default(0),
    completedAt: z.string().optional(),
  }).optional(),

  lastUpdatedAt: z.string(),
});
```

## Tier 2 Heuristic Design (Claude's Discretion)

### Recommended Heuristic Signals (weighted)
1. **File ownership (weight: 0.4):** If OWNERSHIP.json assigns the file to the merging set, prefer that set's version
2. **DAG dependency order (weight: 0.3):** Earlier wave sets' changes are "base truth" -- later sets should adapt to them
3. **Common conflict patterns (weight: 0.3):**
   - Both added to same array (e.g., route registration): merge both entries
   - Both modified same config key: prefer the set with the key in its contract
   - Both added imports: merge all imports (dedup)
   - Both modified module.exports: merge export objects

### Resolution Confidence Scoring
- Tier 1 (deterministic): confidence = 1.0 (always)
- Tier 2 (heuristic): confidence = 0.7-0.9 based on signal strength
- Tier 3 (AI-assisted): confidence from merger agent response (0.0-1.0)
- Threshold for tier 4 escalation: **0.7** (configurable)

## Merger Agent Role Design (Claude's Discretion)

### role-merger.md Responsibilities
1. Read both sets' CONTEXT.md and plans to understand intent
2. Analyze merged code against interface contracts
3. Detect semantic conflicts (intent divergence, behavioral mismatch)
4. Write resolved code for tier 3 conflicts with confidence scores
5. Produce structured RAPID:RETURN with conflict report

### Merger Agent Tools
`Read, Write, Bash, Grep, Glob` -- same as bugfix agent. Needs Write for applying resolutions, Bash for running validation commands.

### Prompt Structure
```
You are the RAPID merger agent for set '{setName}'.

## Context
{Set A CONTEXT.md + plans}
{Set B CONTEXT.md + plans (the set being merged into main)}

## Detected Conflicts (Levels 1-4)
{Structured conflict report from code-based detection}

## Interface Contracts
{Both sets' CONTRACT.json}

## Your Tasks
1. SEMANTIC DETECTION: Identify intent divergence or behavioral mismatch
2. RESOLUTION: For each unresolved conflict, write resolved code
3. CONFIDENCE: Score each resolution 0.0-1.0
4. Report conflicts that need human escalation (confidence < 0.7)

## Output
Emit RAPID:RETURN with:
- semantic_conflicts: [{description, sets, confidence}]
- resolutions: [{file, content, confidence, explanation}]
- escalations: [{conflict, reason}]
```

## Sources

### Primary (HIGH confidence)
- Existing codebase: src/lib/merge.cjs, src/lib/dag.cjs, src/lib/state-machine.cjs, src/lib/state-transitions.cjs, src/lib/review.cjs, src/lib/assembler.cjs, src/lib/worktree.cjs, src/lib/contract.cjs, src/lib/returns.cjs -- all read directly
- Existing tests: src/lib/merge.test.cjs -- all patterns verified
- Existing SKILL.md: skills/merge/SKILL.md -- v1.0 pipeline fully understood
- Existing CLI: src/bin/rapid-tools.cjs handleMerge function -- all subcommands documented
- STATE.md and REQUIREMENTS.md -- all phase decisions and requirements verified

### Secondary (MEDIUM confidence)
- [Git documentation for git-revert](https://git-scm.com/docs/git-revert) -- -m 1 flag for merge commit revert
- [Git documentation for git-bisect](https://git-scm.com/docs/git-bisect) -- binary search concepts applied to set-level merging
- [Node.js CJS modules documentation](https://nodejs.org/api/modules.html) -- require/import pattern matching
- [Gun.io git bisect debugging guide](https://gun.io/news/2025/05/git-bisect-debugging-guide/) -- programmatic automation patterns
- [Graphite guide on reverting merges](https://graphite.com/guides/how-to-revert-a-merge-in-git) -- merge parent selection

### Tertiary (LOW confidence)
- Confidence threshold value of 0.7 -- reasonable starting point but needs calibration in practice
- Bisection iteration count and timeout values -- educated guess, may need adjustment

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing libs verified
- Architecture: HIGH -- all patterns derived from existing codebase conventions, user decisions are clear
- Detection approach: MEDIUM -- string-matching for L2-L4 is established pattern but accuracy vs AST is a tradeoff (user chose this approach implicitly via Phase 22 convention)
- Bisection: MEDIUM -- concept is sound but .planning/ state preservation during git reset needs careful implementation
- Pitfalls: HIGH -- all derived from codebase analysis and git documentation

**Research date:** 2026-03-08
**Valid until:** 2026-04-07 (stable domain -- git semantics don't change, project conventions established)
