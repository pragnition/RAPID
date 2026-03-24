# CONTEXT: path-and-dag

**Set:** path-and-dag
**Generated:** 2026-03-24
**Mode:** interactive

<domain>
## Set Boundary
Consolidate project root resolution to a single worktree-aware function in core.cjs, fix hardcoded DAG.json path in merge.cjs, add DAG generation to /new-version skill, and add DAG existence validation before merge operations. Scope covers src/lib/core.cjs, plan.cjs, ui-contract.cjs, merge.cjs, dag.cjs, execute.cjs, worktree.cjs, rapid-tools.cjs, misc.cjs, and the /new-version SKILL.md.
</domain>

<decisions>
## Implementation Decisions

### Migration Strategy for findProjectRoot
- **Deprecation wrapper:** findProjectRoot() becomes a thin wrapper in core.cjs that emits a console.warn and delegates to resolveProjectRoot(). This preserves backward compatibility while guiding consumers to migrate.
- **Rationale:** Hard removal risks breaking any external code referencing findProjectRoot. A deprecation wrapper provides a smooth migration path with clear signals, and can be removed in a future version.

### Parameter Signature
- **Keep optional cwd param:** resolveProjectRoot(cwd?) defaults to process.cwd() but accepts an explicit start directory. This is compatible with the existing findProjectRoot(startDir) signature.
- **Rationale:** Production call sites use both patterns — some pass explicit cwd (ui-contract.cjs), others rely on process.cwd() (rapid-tools.cjs). The optional param serves both without forcing callers to change.

### Canonical DAG.json Location
- **`.planning/sets/DAG.json`** is the single source of truth. The merge.cjs:274 reference to `.planning/DAG.json` is the outlier bug to fix.
- **Rationale:** This is where `dag generate` already writes. 4 out of 5 existing references use this path. Changing one bug site is lower risk than moving the file and updating 4 correct sites.

### DAG Path Constant
- **Export `DAG_SUBPATH` from core.cjs.** All modules import this constant instead of hardcoding the path string. The existing `DAG_CANONICAL_SUBPATH` in dag.cjs should be replaced by the core.cjs export.
- **Rationale:** A single constant prevents the exact class of path-drift bugs this set is fixing. core.cjs is the natural home since it's becoming the canonical path resolver module.

### Resolver Reconciliation (plan.cjs vs ui-contract.cjs)
- **Port plan.cjs version with diff check.** Diff plan.cjs:39 against ui-contract.cjs:38 to catch any divergence. Port the plan.cjs version as the canonical implementation in core.cjs. Merge any improvements from ui-contract.cjs if the diff reveals them.
- **Rationale:** plan.cjs is the original implementation. ui-contract.cjs explicitly comments that it's a copy. Diffing before replacing ensures no subtle behavioral differences are lost.

### Resolver Edge Case Scope
- **Keep current scope:** Handle git repo, worktree, and no-git fallback. No additional edge cases (bare repos, detached HEAD, etc.).
- **Rationale:** RAPID only operates inside initialized projects with .planning/. The 3 current cases cover all real usage scenarios. Adding edge cases for impossible scenarios increases complexity without value.

### Error Handling — ensureDagExists Behavior
- **Throw with remediation steps.** The error message should include the exact command to run (`dag generate` or `/rapid:plan-set`) to create the missing DAG.json.
- **Rationale:** Fail-fast prevents silent merge ordering bugs. Auto-generation would mask the upstream issue (why was DAG missing?). Clear remediation steps mean the user knows exactly how to fix it.

### Error Handling — Check Locations
- **Each entry point explicitly.** Add ensureDagExists() calls at merge, execute, and worktree entry points — not hidden in shared middleware.
- **Rationale:** Explicit checks are easier to audit and don't risk redundant calls in nested flows. Each command owns its prerequisites.

### ui-contract.cjs Deduplication
- **Diff then replace.** Compare the local resolveProjectRoot in ui-contract.cjs against plan.cjs, merge any improvements into core.cjs, then replace the local copy with `const { resolveProjectRoot } = require('./core.cjs')`.
- **Rationale:** The comment says "local copy" which implies it may have drifted. Diffing first catches any subtle improvements worth preserving.

### ui-contract.cjs Call Sites
- **Keep explicit cwd pass-through.** The existing `resolveProjectRoot(cwd)` calls at lines 132 and 337 are correct and compatible with the new core.cjs signature.
- **Rationale:** These functions receive cwd from their callers. Changing to no-arg would break the explicit cwd threading pattern that library functions should use.

### DAG Generation Trigger in /new-version
- **After contract generation + validation.** Add DAG generation after step 5 (contract generation), then verify DAG.json exists as a final validation check.
- **Rationale:** DAG generation needs set contracts to determine dependency edges. Placing it last ensures all inputs are available. The validation step catches generation failures before the skill completes.

### DAG Generation Idempotency
- **Idempotent generate, strict validate.** `dag generate` always safely overwrites existing DAG.json. `ensureDagExists()` always throws if the file is missing — no auto-generation at validation time.
- **Rationale:** Generation and validation are separate concerns. Idempotent generation makes /new-version re-runs safe. Strict validation at merge time catches upstream workflow gaps.

### Call Site Migration Approach
- **Single-pass sweep.** Update all findProjectRoot call sites and plan.cjs/ui-contract.cjs imports in one wave. The function signature is compatible, making changes mechanical.
- **Rationale:** The change is a mechanical find-and-replace. Running tests once at the end is sufficient since the function contract is identical.

### DAG Path Constant Propagation
- **Same wave as resolver migration, separate commits.** Both changes touch the same files (merge.cjs, execute.cjs, worktree.cjs) but are distinct concerns. Same wave avoids an extra wave; separate commits keep git history clean.
- **Rationale:** Combining into one wave reduces overhead while separate commits maintain reviewability and revertability.

### Test Strategy — Worktree Tests
- **Real git worktrees.** Create actual git worktrees in temp directories using `git worktree add`. No mocking of git commands.
- **Rationale:** Mocking execSync is exactly the kind of gap this set is fixing — testing mocks instead of real behavior. The ~200ms overhead per test is acceptable for correctness.

### Test Coverage Target
- **5 test cases minimum:** (1) normal git repo, (2) worktree, (3) no-git fallback, (4) nested subdirectory within worktree (regression), (5) deprecation wrapper fires console.warn.
- **Rationale:** 3 core scenarios from the behavioral contract, plus the nested-subdir regression test for the original bug, plus the deprecation wrapper validation.

### Claude's Discretion
- No areas were left to Claude's discretion — all 8 gray areas were discussed interactively.
</decisions>

<specifics>
## Specific Ideas
- The deprecation wrapper should use `console.warn('[RAPID DEPRECATION] findProjectRoot() is deprecated, use resolveProjectRoot() from core.cjs')` or similar
- DAG_SUBPATH constant value: `'.planning/sets/DAG.json'` (relative to project root)
- ensureDagExists error message should mention both `dag generate` CLI command and `/rapid:plan-set` skill as remediation paths
- The /new-version SKILL.md DAG step should be numbered explicitly and include a verification check
</specifics>

<code_context>
## Existing Code Insights
- `findProjectRoot()` in core.cjs:30 walks up directories looking for `.planning/` — simple but not worktree-aware
- `resolveProjectRoot()` in plan.cjs:39 uses `git rev-parse --show-toplevel` with cwd fallback — this is the implementation to port
- `resolveProjectRoot()` in ui-contract.cjs:38 is explicitly commented as a copy of plan.cjs's version — needs diff before replacement
- merge.cjs:274 has the DAG path bug: `path.join(cwd, '.planning', 'DAG.json')` — missing `sets` segment
- dag.cjs already has `DAG_CANONICAL_SUBPATH` as a local constant — can be replaced by the core.cjs export
- execute.cjs has its own DAG existence check at line 93 that can be replaced by the shared ensureDagExists()
- worktree.cjs:124 and :138 both construct DAG paths inline — candidates for the constant
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
