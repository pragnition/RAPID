# Phase 8: Merge Pipeline - Research

**Researched:** 2026-03-04
**Domain:** Git merge orchestration, automated code review, cleanup agent spawning, dependency-ordered merging
**Confidence:** HIGH

## Summary

Phase 8 builds the merge pipeline that takes completed set worktrees through automated review, optional cleanup, and dependency-ordered merge into main. The domain is well-understood: it extends established patterns from the execution engine (Phase 6-7) with a review-first merge workflow. All core building blocks already exist in the codebase -- `contract.cjs` provides programmatic validation, `dag.cjs` provides merge ordering, `worktree.cjs` provides git operations, and the `rapid-reviewer.md` agent definition provides the review checklist.

The implementation requires three new components: (1) a `merge.cjs` library module with review orchestration, cleanup loop management, and merge execution functions; (2) a `rapid-cleanup.md` agent definition for constrained auto-fix work; and (3) a `/rapid:merge` skill that orchestrates the full pipeline. The merge pipeline follows the same patterns as the execute pipeline -- skill as orchestrator, library for logic, agents for autonomous work, CLI for state access.

**Primary recommendation:** Build merge.cjs as a single library module following execute.cjs patterns, with pure functions for review assembly, merge execution, and post-merge verification. The skill orchestrates the review-cleanup-merge loop per set, spawning reviewer and cleanup subagents via the Agent tool. Use `git merge --no-ff` for merge commits (preserves branch history per user decision).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Layered contract validation: programmatic first (compileContract + generateContractTest from contract.cjs as hard gate), then agent reviews for semantic compliance (behavioral invariants, intent matching)
- Tests must pass (run `node --test` in worktree) AND reviewer agent checks for untested critical paths (exported functions without tests, error paths without assertions). Missing coverage = request changes, not block
- Ownership violations block merge UNLESS the set declared a CONTRIBUTIONS.json entry for that file. Undeclared cross-set modifications are hard blocks
- Review output written to `.planning/sets/{name}/REVIEW.md` with sections: verdict (approve/changes/block), contract results, ownership check, test results, findings list. Machine-parseable verdict line
- New `rapid-cleanup` agent type (separate from rapid-executor) with constrained scope: only style fixes and test generation. Has Read, Edit, Write, Bash, Grep, Glob tools
- Auto-fix and re-review: cleanup agent spawns in the set's worktree, fixes issues, commits, then reviewer re-reviews automatically. No human intervention unless it fails twice
- Fixable issues: style violations (naming, formatting), missing test coverage for untested exports
- Blocking issues (require human): contract violations, logic errors, architectural issues, ownership violations
- Max 2 cleanup rounds. If issues remain after 2 rounds, escalate to human with a summary of what couldn't be fixed
- Merge commit per set (preserves branch history, no squash)
- Sets merge in dependency-graph order using DAG (dag.cjs toposort/wave assignment)
- Independent sets within the same wave merge sequentially (not in parallel) -- each merge sees the result of the previous
- If any set fails to merge, halt the entire sequence. Already-merged sets stay merged. Developer resolves conflict manually, then resumes
- Post-wave integration gate: after each wave's sets merge, run full test suite on main. If tests fail, halt before next wave
- Both auto-trigger and manual: /rapid:merge for explicit trigger, auto-starts after all sets complete execution successfully
- /rapid:merge merges all completed sets by default, /rapid:merge {set-name} merges a specific set (with its dependencies)
- Live wave-by-wave progress display in terminal: which set is being reviewed, cleanup status, merge result. Updates as each step completes
- Merged worktrees kept until developer runs /rapid:cleanup (not auto-removed after merge)

### Claude's Discretion
- Exact REVIEW.md format and verdict line syntax
- Cleanup agent prompt design and tool constraints
- Live progress display implementation details
- How auto-trigger detects "all sets complete"

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MERG-01 | Merge reviewer agent performs deep code review (style, correctness, contract compliance) before any set merges to main | Reviewer agent already defined in `rapid-reviewer.md` with review checklist. merge.cjs provides `assembleReviewerPrompt()` to feed contract data, changed files, ownership map, and test results. REVIEW.md format captures verdict with machine-parseable line. |
| MERG-02 | Merge reviewer validates all interface contracts are satisfied -- blocks merge if contracts violated or tests fail | Programmatic gate uses existing `compileContract()` + `generateContractTest()` from contract.cjs as hard block before agent review. `node --test` runs in worktree for test validation. Ownership checked via `checkOwnership()` with CONTRIBUTIONS.json exception handling. |
| MERG-03 | Cleanup agent can be spawned when merge reviewer finds fixable issues (style violations, missing tests, minor contract gaps) | New `rapid-cleanup.md` agent with constrained tool set (Read, Edit, Write, Bash, Grep, Glob). Spawned in set worktree, commits fixes, max 2 rounds with auto-re-review. |
| MERG-04 | Sets merge in dependency-graph order -- independent sets can merge in parallel, dependent sets merge sequentially | Reuses `dag.cjs` `getExecutionOrder()` for wave grouping. Within each wave, sets merge sequentially (each sees prior merge result). Post-wave integration gate runs full test suite on main. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:test | Node 18+ built-in | Test runner for contract tests and merge.test.cjs | Zero-dependency, established project pattern (all `.test.cjs` files use it) |
| node:assert/strict | Node 18+ built-in | Assertions in tests | Project convention for strict equality checks |
| node:child_process | Node 18+ built-in | Git command execution via execSync | Used by worktree.cjs gitExec pattern |
| node:fs / node:path | Node 18+ built-in | File system operations for REVIEW.md, registry | Project standard for all file operations |
| ajv | 8.x | Contract schema validation | Already installed, used by contract.cjs for compileContract() |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| contract.cjs (internal) | current | compileContract, generateContractTest, checkOwnership | Programmatic validation gate before agent review |
| dag.cjs (internal) | current | getExecutionOrder, assignWaves | Determining merge order from DAG |
| worktree.cjs (internal) | current | gitExec, loadRegistry, registryUpdate | All git operations and registry state management |
| execute.cjs (internal) | current | getChangedFiles, getCommitCount | Diffing set branches against main |
| verify.cjs (internal) | current | verifyHeavy | Post-merge integration verification |
| returns.cjs (internal) | current | parseReturn, validateReturn | Parsing reviewer agent structured returns |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sequential wave merge | Parallel merge | User explicitly chose sequential within waves so each merge sees prior result -- prevents hidden conflicts |
| Squash merge | Merge commit (--no-ff) | User decided merge commits to preserve branch history |
| Combined reviewer+cleanup | Separate agents | User decided separate rapid-cleanup with constrained scope -- cleaner separation of concerns |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
rapid/
├── agents/
│   ├── rapid-reviewer.md     # EXISTS -- update with merge-specific review protocol
│   └── rapid-cleanup.md      # NEW -- constrained cleanup agent
├── skills/
│   └── merge/
│       └── SKILL.md           # NEW -- /rapid:merge skill orchestrator
└── src/
    ├── lib/
    │   ├── merge.cjs          # NEW -- merge pipeline library
    │   └── merge.test.cjs     # NEW -- unit tests
    └── bin/
        └── rapid-tools.cjs    # UPDATE -- add merge subcommands
```

### Pattern 1: Review-Cleanup-Merge Loop
**What:** Each set goes through a sequential pipeline: programmatic validation -> agent review -> optional cleanup -> re-review -> merge
**When to use:** Every set merge, no exceptions
**Example:**
```
For each set (in DAG order):
  1. Programmatic gate (contract compile + test run + ownership check)
     - If FAIL: skip agent review, write REVIEW.md with verdict=block
  2. Agent review (spawn rapid-reviewer as subagent)
     - Reviewer reads: changed files, contract, ownership, test results
     - Reviewer writes: REVIEW.md with verdict
  3. If verdict = "changes" and fixable issues exist:
     a. Spawn rapid-cleanup in worktree (round 1)
     b. Cleanup commits fixes
     c. Re-run programmatic gate
     d. Re-spawn reviewer (round 2)
     e. If still "changes": spawn cleanup again (round 2)
     f. After round 2: escalate to human
  4. If verdict = "approve": proceed to merge
  5. If verdict = "block": halt pipeline, report to developer
```

### Pattern 2: Sequential Wave Merge with Integration Gate
**What:** Sets merge in dependency-graph order. Within a wave, sets merge one at a time. After all sets in a wave merge, run full test suite on main.
**When to use:** Merge execution phase
**Example:**
```
waves = getExecutionOrder(dag)  // [[set-a, set-b], [set-c]]

for wave in waves:
  for set in wave:                    // sequential within wave
    checkout main
    git merge --no-ff rapid/{set}     // merge commit
    if merge conflict: HALT

  // Post-wave integration gate
  run "node --test" on main
  if tests fail: HALT before next wave
```

### Pattern 3: REVIEW.md Machine-Parseable Format
**What:** Review results stored as Markdown with a machine-parseable verdict line
**When to use:** Every review output
**Example:**
```markdown
# Review: {set-name}

**Reviewed:** {ISO timestamp}
**Verdict:** APPROVE | CHANGES | BLOCK
<!-- VERDICT:APPROVE -->

## Contract Validation
- Schema validation: PASS
- Contract tests: PASS (N/N assertions)
- Behavioral invariants: {agent assessment}

## Ownership Check
- Files changed: {count}
- Ownership violations: {count or "none"}
- Contributions declared: {count}

## Test Results
- Test suite: PASS/FAIL
- Untested exports: {list or "none"}
- Coverage gaps: {list or "none"}

## Findings
### Blocking
- {finding with file:line reference}

### Fixable (auto-cleanup eligible)
- {finding with file:line reference}

### Suggestions (informational only)
- {finding}
```

### Pattern 4: CLI Subcommand Extension
**What:** Add `merge` subcommand group to rapid-tools.cjs following established pattern
**When to use:** All merge pipeline operations
**Example:**
```
rapid-tools merge review <set>           # Run programmatic checks + write REVIEW.md
rapid-tools merge execute <set>          # Merge set branch into main
rapid-tools merge status                 # Show merge pipeline status
rapid-tools merge integration-test       # Run post-wave test suite on main
```

### Anti-Patterns to Avoid
- **Parallel merge within waves:** User explicitly chose sequential to prevent hidden conflicts. Each merge must see the result of the previous one.
- **Auto-removing worktrees after merge:** User decision: worktrees stay until developer runs /rapid:cleanup explicitly.
- **Combining cleanup into reviewer:** These are separate agents with different scopes. Reviewer reads and evaluates; cleanup writes and fixes. Never mix their tools or responsibilities.
- **Blocking on missing test coverage:** Missing coverage = request changes (fixable), not block. Only contract violations and ownership issues block.
- **Bypassing programmatic gate:** The contract compile + test run + ownership check is always the first gate. Never skip it and go straight to agent review.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Topological sort for merge order | Custom ordering algorithm | `dag.cjs` `getExecutionOrder()` | Already handles cycles, wave grouping, dependency resolution |
| Contract validation | Manual schema checking | `contract.cjs` `compileContract()` + `generateContractTest()` | Meta-schema validation with Ajv, auto-generated test files |
| Git merge operations | Direct execSync calls | `worktree.cjs` `gitExec()` wrapper | Structured return with error handling, consistent timeout |
| Ownership checking | File path matching | `contract.cjs` `checkOwnership()` | Handles exact match and directory pattern matching |
| Agent return parsing | Custom regex parsing | `returns.cjs` `parseReturn()` | Established RAPID:RETURN protocol with validation |
| Registry state management | Direct JSON file writes | `worktree.cjs` `registryUpdate()` | Atomic updates with lock protection |

**Key insight:** Phase 8 is primarily an orchestration layer. Every individual capability (contract validation, DAG ordering, git operations, ownership checking, return parsing) already exists. The merge pipeline composes these existing primitives into a new workflow.

## Common Pitfalls

### Pitfall 1: Merge Conflicts from Stale Branches
**What goes wrong:** Set branches diverge from main over time. By the time merge runs, the branch may not merge cleanly.
**Why it happens:** Wave 1 sets merge first, changing main. Wave 2 branches were created from the original main.
**How to avoid:** Before merging each set, detect if a fast-forward is possible. If not, attempt the merge and handle conflicts explicitly. The user decided: halt on conflict, developer resolves manually.
**Warning signs:** `git merge --no-ff` returning non-zero exit code with conflict markers.

### Pitfall 2: Cleanup Agent Scope Creep
**What goes wrong:** Cleanup agent starts "fixing" things beyond style and missing tests -- refactoring logic, changing APIs, rewriting implementations.
**Why it happens:** The prompt doesn't sufficiently constrain the agent's scope, or the agent interprets "fix" broadly.
**How to avoid:** Strict prompt constraints in `rapid-cleanup.md`: ONLY style fixes (naming, formatting) and test generation. Enumerate what it CANNOT do: no logic changes, no API changes, no new features, no refactoring. Verify cleanup commits only touch allowed categories.
**Warning signs:** Cleanup agent modifying files not flagged in the review, changing function signatures, adding new exports.

### Pitfall 3: Review Loop Infinite Cycling
**What goes wrong:** Reviewer finds issues, cleanup fixes them but introduces new issues, reviewer finds those, cleanup fixes and introduces more.
**Why it happens:** No cap on cleanup rounds, or cleanup creates regression.
**How to avoid:** Hard cap at 2 cleanup rounds (user decision). After 2 rounds, escalate to human regardless. Track round count in REVIEW.md metadata.
**Warning signs:** Round counter incrementing past 1 without converging.

### Pitfall 4: Post-Wave Integration Test Flakiness
**What goes wrong:** Integration tests pass for individual sets but fail after merging multiple sets in a wave, or fail intermittently.
**Why it happens:** Cross-set interactions not covered by individual contract tests, or test timing dependencies.
**How to avoid:** Use `node --test` which runs deterministically. Ensure contract tests cover cross-set imports. If integration tests fail, the pipeline halts (user decision) -- don't retry automatically.
**Warning signs:** Tests passing in worktree but failing on main after merge.

### Pitfall 5: Ownership Check Bypassing CONTRIBUTIONS.json
**What goes wrong:** A set modifies files owned by another set without declaring a contribution, and the merge proceeds.
**Why it happens:** The ownership check doesn't load CONTRIBUTIONS.json, or it loads it incorrectly.
**How to avoid:** Merge review explicitly loads CONTRIBUTIONS.json for each set and cross-references against changed files. Undeclared cross-set modifications are hard blocks (user decision).
**Warning signs:** Ownership violations not appearing in REVIEW.md.

### Pitfall 6: Auto-Trigger Race Condition
**What goes wrong:** Multiple agents finish execution simultaneously, and auto-trigger fires the merge pipeline multiple times.
**Why it happens:** Checking "all sets complete" without locking.
**How to avoid:** Auto-trigger detection should be idempotent. Use registry lock when checking completion state. If merge is already in progress (registry flag), skip auto-trigger.
**Warning signs:** Multiple merge pipelines running simultaneously.

## Code Examples

Verified patterns from existing codebase:

### Running Contract Tests Programmatically
```javascript
// Source: execute.cjs reconcileWave pattern (lines 500-517)
const testFile = path.join(setDir, 'contract.test.cjs');
if (fs.existsSync(testFile)) {
  try {
    execSync(`node "${testFile}"`, { cwd, stdio: 'pipe', timeout: 30000 });
    // PASS
  } catch (err) {
    // FAIL -- hard block
    const detail = err.stderr?.toString() || err.message;
  }
}
```

### Checking Ownership with CONTRIBUTIONS.json Exception
```javascript
// Source: contract.cjs checkOwnership + createContribution patterns
const ownershipData = JSON.parse(fs.readFileSync(ownershipPath, 'utf-8'));
const changedFiles = execute.getChangedFiles(worktreePath, baseBranch);

for (const file of changedFiles) {
  const owner = contract.checkOwnership(ownershipData.ownership, file);
  if (owner !== null && owner !== setName) {
    // Check if set declared a contribution for this file
    const contribPath = path.join(setDir, 'CONTRIBUTIONS.json');
    let hasContribution = false;
    if (fs.existsSync(contribPath)) {
      const contribs = JSON.parse(fs.readFileSync(contribPath, 'utf-8'));
      hasContribution = contribs.contributesTo?.some(c => c.file === file);
    }
    if (!hasContribution) {
      // Hard block: undeclared cross-set modification
    }
  }
}
```

### Executing Git Merge with No-FF
```javascript
// Source: worktree.cjs gitExec pattern
function mergeSet(projectRoot, setName, baseBranch) {
  // Ensure we're on the base branch
  const checkoutResult = gitExec(['checkout', baseBranch], projectRoot);
  if (!checkoutResult.ok) {
    return { merged: false, reason: 'checkout_failed', detail: checkoutResult.stderr };
  }

  // Merge with --no-ff to create merge commit
  const branch = `rapid/${setName}`;
  const mergeResult = gitExec(
    ['merge', '--no-ff', branch, '-m', `merge(${setName}): merge set into ${baseBranch}`],
    projectRoot
  );

  if (!mergeResult.ok) {
    // Check for merge conflict
    if (mergeResult.stderr.includes('CONFLICT') || mergeResult.stderr.includes('Automatic merge failed')) {
      // Abort the failed merge
      gitExec(['merge', '--abort'], projectRoot);
      return { merged: false, reason: 'conflict', detail: mergeResult.stderr };
    }
    return { merged: false, reason: 'error', detail: mergeResult.stderr };
  }

  return { merged: true, branch, commitHash: getHeadHash(projectRoot) };
}
```

### Assembling Reviewer Prompt (following execute.cjs assembleExecutorPrompt pattern)
```javascript
function assembleReviewerPrompt(cwd, setName, programmaticResults) {
  const ctx = prepareReviewContext(cwd, setName);
  return [
    `# Merge Review: ${setName}`,
    '',
    '## Changed Files',
    ctx.changedFiles.map(f => `- ${f}`).join('\n'),
    '',
    '## Contract',
    '```json',
    ctx.contractStr,
    '```',
    '',
    '## Programmatic Validation Results',
    `- Contract schema: ${programmaticResults.contractValid ? 'PASS' : 'FAIL'}`,
    `- Contract tests: ${programmaticResults.testsPass ? 'PASS' : 'FAIL'}`,
    `- Ownership violations: ${programmaticResults.ownershipViolations.length || 'none'}`,
    '',
    '## Review Instructions',
    'Perform deep code review. Write your verdict as one of:',
    '- APPROVE: code is ready to merge',
    '- CHANGES: fixable issues found (style, missing tests)',
    '- BLOCK: critical issues requiring human intervention',
    '',
    'Output your review in REVIEW.md format with <!-- VERDICT:{verdict} --> marker.',
  ].join('\n');
}
```

### Wave-Ordered Sequential Merge
```javascript
// Source: dag.cjs getExecutionOrder pattern
function getMergeOrder(cwd) {
  const dagPath = path.join(cwd, '.planning', 'sets', 'DAG.json');
  const dagJson = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
  return dag.getExecutionOrder(dagJson);
  // Returns: [['set-a', 'set-b'], ['set-c']]
  // Wave 1: set-a and set-b (merge sequentially)
  // Wave 2: set-c (depends on wave 1)
}
```

### Registry Update for Merge Status
```javascript
// Source: worktree.cjs registryUpdate pattern
await worktree.registryUpdate(cwd, (reg) => {
  if (reg.worktrees[setName]) {
    reg.worktrees[setName].mergeStatus = 'merged';
    reg.worktrees[setName].mergedAt = new Date().toISOString();
    reg.worktrees[setName].mergeCommit = commitHash;
  }
  return reg;
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual code review | Agent-assisted review with programmatic gates | Current phase | Reduces human review burden while maintaining contract enforcement |
| Squash merge (lose history) | Merge commit --no-ff (preserve history) | User decision | Full branch history visible in git log |
| Manual conflict resolution | Halt-and-report with context | Current phase | Developer gets structured error context, not raw git output |

**Deprecated/outdated:**
- None specific to this phase. All git merge primitives used here are stable and well-established.

## Open Questions

1. **Auto-trigger mechanism for merge pipeline**
   - What we know: The user wants merge to auto-start after all sets complete execution. The execute skill's Step 9 already mentions "merge pipeline when ready."
   - What's unclear: How to detect "all sets complete" reliably (registry polling? post-reconcile hook? wave-status check in execute skill?)
   - Recommendation: Check registry state after each wave reconciliation in the execute skill. If all waves show Done, print a message like "All sets complete. Run /rapid:merge to start merge pipeline." For true auto-trigger, the execute skill's Step 9 could directly invoke the merge skill. This keeps it simple and avoids race conditions.

2. **REVIEW.md verdict line syntax**
   - What we know: Must be machine-parseable. User gave discretion on exact format.
   - What's unclear: Use HTML comment `<!-- VERDICT:APPROVE -->` or structured YAML frontmatter?
   - Recommendation: Use `<!-- VERDICT:APPROVE -->` HTML comment marker (matches RAPID:RETURN pattern). Parse with simple indexOf/regex. Place in the first few lines after the heading for quick extraction.

3. **Cleanup agent commit message format**
   - What we know: Executor uses `type(setName): description`. Cleanup should follow a similar pattern.
   - What's unclear: Should cleanup commits have a distinct prefix?
   - Recommendation: Use `fix({setName}): {description}` for style fixes and `test({setName}): {description}` for generated tests. This integrates cleanly with the existing commit format regex in execute.cjs.

4. **Post-wave integration test command**
   - What we know: "Run full test suite on main." The project uses `node --test` for individual test files.
   - What's unclear: What constitutes "full test suite"? All `*.test.cjs` files? A specific command?
   - Recommendation: Use `node --test rapid/src/lib/*.test.cjs` to run all library tests. This matches project convention and covers all modules. If contract tests exist, also run `node .planning/sets/*/contract.test.cjs` glob.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `rapid/src/lib/contract.cjs` - compileContract, generateContractTest, checkOwnership, createContribution functions verified
- Codebase analysis: `rapid/src/lib/dag.cjs` - toposort, assignWaves, getExecutionOrder, createDAG functions verified
- Codebase analysis: `rapid/src/lib/worktree.cjs` - gitExec, createWorktree, removeWorktree, registryUpdate, loadRegistry functions verified
- Codebase analysis: `rapid/src/lib/execute.cjs` - prepareSetContext, assembleExecutorPrompt, verifySetExecution, reconcileWave patterns verified
- Codebase analysis: `rapid/src/lib/verify.cjs` - verifyLight, verifyHeavy functions verified
- Codebase analysis: `rapid/src/lib/returns.cjs` - parseReturn, validateReturn, generateReturn functions verified
- Codebase analysis: `rapid/agents/rapid-reviewer.md` - existing agent definition with review checklist verified
- Codebase analysis: `rapid/skills/execute/SKILL.md` - orchestrator skill pattern verified
- Codebase analysis: `rapid/src/bin/rapid-tools.cjs` - CLI subcommand patterns verified
- Git 2.43.0 documentation: `git merge --no-ff` for merge commit creation

### Secondary (MEDIUM confidence)
- Project conventions extrapolated from 7 completed phases of consistent patterns (agent definitions, CLI structure, test conventions, structured returns)

### Tertiary (LOW confidence)
- None -- all findings verified against codebase artifacts

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies needed
- Architecture: HIGH - Follows exact patterns established in Phases 5-7 (execute pipeline), all building blocks verified in codebase
- Pitfalls: HIGH - Derived from understanding actual code patterns and user decisions, not theoretical concerns

**Research date:** 2026-03-04
**Valid until:** 2026-04-03 (30 days -- stable domain, internal tooling)
