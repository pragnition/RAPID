# CONTEXT: bug-fixes-foundation

**Set:** bug-fixes-foundation
**Generated:** 2026-03-31
**Mode:** interactive

<domain>
## Set Boundary
Fix three known bugs (REQUIREMENTS.md overwrite by scaffold, --desc/--description flag mismatch, roadmapper STATE.json overwrite) and resolve four foundational infrastructure issues: bump Node.js minimum to 20+, fix shell injection via execSync in worktree.cjs, add fileOwnership to CONTRACT_META_SCHEMA, and fix recalculateDAG() annotation stripping. All seven tasks are independent at the code level — they touch distinct functions in distinct files.
</domain>

<decisions>
## Implementation Decisions

### State Merge Strategy
- **Wholesale replacement** for milestones array — when partial includes `milestones`, it replaces the entire array in STATE.json. The roadmapper already produces the complete milestones array so no delta merging is needed.
- **Rationale:** Simplicity and predictability. The roadmapper is the only consumer and always produces a full array. ID-based merge adds complexity without clear benefit.

- **Always auto-update `lastUpdatedAt`** — mergeStatePartial sets lastUpdatedAt to now() on every call regardless of partial contents.
- **Rationale:** Prevents stale timestamps from callers forgetting to include it. The function is modifying state, so the timestamp should always reflect that.

### REQUIREMENTS.md Detection Heuristic
- **Non-empty content check** — protect any existing non-empty REQUIREMENTS.md. If the file exists and has content, do not overwrite it.
- **Rationale:** Most conservative and simplest approach. No marker or frontmatter detection needed — if the user has put anything in the file, it should be preserved.

- **Protect on I/O error + log warning** — if the file exists but is unreadable, do not overwrite it. Log a warning so the user is aware.
- **Rationale:** Don't destroy what you can't verify. Failing silently risks losing content; throwing halts scaffold unnecessarily.

### execSync Migration Scope
- **worktree.cjs only** — focus the execSync → execFileSync migration on worktree.cjs where set/branch names are interpolated into shell commands (the security-critical path).
- **Rationale:** prereqs.cjs uses hardcoded commands with no user input, so injection risk is negligible. Scope containment keeps the change focused and testable.

- **Strip quotes, pass raw paths** — remove shell quoting from gitExec callers (createWorktree, removeWorktree pass `'"${path}"'`). execFileSync handles spaces in arguments natively.
- **Rationale:** Shell quoting is only needed because execSync spawns a shell. execFileSync does not, so quotes become literal characters that break paths.

### DAG Annotation Preservation
- **Object spread** — use `{ ...existingNode, id: s.id }` to carry forward all properties, including unknown future ones.
- **Rationale:** Forward-compatible. New DAG properties added in future sets (e.g., dag-central-grouping) are automatically preserved without updating recalculateDAG.

- **Read existing DAG.json** as the source of annotations — load current DAG.json from disk, match nodes by ID, spread existing properties onto rebuilt nodes.
- **Rationale:** Annotations only live in DAG.json, not in STATE.json. Reading the existing file is the natural and only available source.

### mergeStatePartial API Design
- **Use withStateTransaction** — mergeStatePartial wraps its logic inside withStateTransaction for lock protection and automatic Zod validation.
- **Rationale:** Consistent with all other state mutation patterns in state-machine.cjs. Gets file locking and Zod validation for free.

- **Validate merged result only** — partials are inherently incomplete. Only the final merged state needs to pass Zod ProjectState validation.
- **Rationale:** A partial with just `{ currentMilestone: "v2.0" }` is valid input but would fail standalone Zod validation. Validation belongs on the output.

### gitExec Interface Evolution
- **Modify in-place** — change gitExec internals from `execSync('git ${args.join(' ')}')` to `execFileSync('git', args)`. No new function, no deprecation.
- **Rationale:** Clean, no API duplication. Callers already pass string arrays, so the interface doesn't change — only the internal implementation does.

- **Fix known issues + audit all callers** — fix createWorktree/removeWorktree quoting, and verify every other gitExec caller (deleteBranch, listWorktrees, detectMainBranch) is compatible with execFileSync.
- **Rationale:** Comprehensive audit prevents subtle breakage. The migration changes shell semantics, so every call site must be verified.

### Node.js Enforcement
- **prereqs.cjs + package.json engines** — bump the runtime check in prereqs.cjs from 18 to 20, and add/update the `engines` field in package.json.
- **Rationale:** Two-layer enforcement: runtime check for hard failure, engines field for npm install-time warning. Catches issues at two different stages.

- **Major version only ("20")** — any Node.js 20.x and above satisfies the check.
- **Rationale:** No need to pin to a specific LTS patch. Simpler to maintain, and any 20.x release is sufficient for the features RAPID uses.

### Error Semantics
- **mergeStatePartial throws on invalid merged state** — if the merged result fails Zod validation, throw an error. Invalid state is never written to disk.
- **Rationale:** Consistent with withStateTransaction behavior. Callers must provide valid partials. Silent failure risks corrupted state files.

### Claude's Discretion
- `--description` alias implementation in init.cjs CLI parser (straightforward fallthrough case)
- `fileOwnership` schema extension in CONTRACT_META_SCHEMA (clear from CONTRACT.json specification)
</decisions>

<specifics>
## Specific Ideas
- For REQUIREMENTS.md guard: check `file.trim().length > 0` rather than just existence — empty files are safe to overwrite
- For gitExec migration: the `execFileSync` import already exists in state-machine.cjs but needs to be added to worktree.cjs (currently only imports `execSync`)
- For DAG annotation loading: handle the case where DAG.json doesn't exist yet (first recalculation) — no annotations to preserve, build fresh nodes
</specifics>

<code_context>
## Existing Code Insights
- `withStateTransaction(cwd, mutator)` in state-machine.cjs handles locking, reading, Zod validation, and atomic writes — mergeStatePartial should use the same pattern
- `gitExec(args, cwd)` is the central git command wrapper in worktree.cjs — all git operations flow through it. Currently uses `execSync('git ${args.join(' ')}')` which is the injection vector
- `createWorktree` passes `'"${worktreePath}"'` with embedded shell quotes that must be stripped when switching to execFileSync
- `removeWorktree` similarly passes `'"${worktreePath}"'` — same fix needed
- `CONTRACT_META_SCHEMA` in contract.cjs uses Ajv for validation — adding `fileOwnership` is a schema extension, not a new validator
- `scaffoldProject()` in init.cjs has a `fileGenerators` pattern — REQUIREMENTS.md guard should be added as a pre-check before the generator runs
- `recalculateDAG()` in add-set.cjs reads STATE.json for set IDs but builds bare `{ id: s.id }` nodes — needs to also load existing DAG.json for annotation preservation
- `validatePrereqs()` in prereqs.cjs uses `checkTool()` with `minVersion: '18'` for Node.js — simple string change to '20'
</code_context>

<deferred>
## Deferred Ideas
- Migrate execSync to execFileSync in prereqs.cjs for consistency (future hygiene set)
- Comprehensive execSync audit across entire codebase beyond worktree.cjs
- Store DAG annotations in STATE.json sets schema for single source of truth (potential for dag-central-grouping)
</deferred>
