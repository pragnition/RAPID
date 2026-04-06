# Stack Research: ux-audit

## Core Stack Assessment

### Runtime Environment
- **Node.js:** >=22 (enforced in package.json `engines` and prereqs.cjs)
- **Latest stable:** Node.js 24.x (as of April 2026)
- **Relevant features:** `node:test` built-in test runner (used throughout), `require('node:assert/strict')` strict assertions
- **No breaking changes impact:** The codebase uses CommonJS exclusively (`.cjs` extensions), which remains fully supported in Node 22+

### Package Manager
- **npm** (no lockfile indicates basic npm usage; no yarn.lock or pnpm-lock.yaml detected)

### Testing Framework
- **Built-in `node:test`** -- used in all 60+ test files
- **Test runner invocation:** `node --test 'src/**/*.test.cjs'`
- **No external test runner dependency** -- this simplifies the test setup for `tests/ux-audit.test.cjs`

### Module System
- **CommonJS throughout** -- all files use `.cjs` extension with `'use strict'` preamble
- **No ESM migration needed** for this set

## Dependency Health

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| zod | ^3.25.76 | 3.25.x | Active | Used for STATE.json schema validation (ProjectState) |
| proper-lockfile | ^4.1.2 | 4.1.2 | Maintenance | Lock acquisition for state transactions; stable, no updates needed |
| ajv | ^8.17.1 | 8.17.x | Active | JSON Schema validation for UI contracts; not used by UX audit |
| ajv-formats | ^3.0.1 | 3.0.x | Active | Format extensions for ajv; not used by UX audit |

All dependencies are healthy and up-to-date. None are relevant to the UX audit work itself -- the audit primarily touches CLI output, error messages, and function wiring using only Node.js built-ins.

## Compatibility Matrix

No compatibility issues affect this set. Key constraints:

- **Zod `.passthrough()`** on `ProjectState` schema (state-schemas.cjs:41) -- this is critical because it allows the CONTEXT.md decision to add a `teamSize` field to STATE.json without schema changes. The `.passthrough()` modifier permits arbitrary additional fields.
- **`node:test` built-in** requires Node.js 18+ (satisfied by the >=22 requirement)
- **ANSI escape codes** used in `display.cjs` -- basic 16-color palette (`\x1b[...m`), compatible with all modern terminals. NO_COLOR env var support already implemented.

## Key Implementation Details for UX Audit

### Auto-Regroup Wiring

**Current state of `addSetToMilestone()` (add-set.cjs:33-74):**
- Line 71: calls `await recalculateDAG(cwd, milestoneId)` after the state transaction
- Line 73: returns `{ setId, milestoneId, depsValidated: depList }`
- The auto-regroup call should go between lines 71 and 73

**`partitionIntoGroups()` signature (group.cjs:29):**
```javascript
partitionIntoGroups(dag, contracts, numDevelopers)
// Returns: { groups, crossGroupEdges, assignments }
```

**`annotateDAGWithGroups()` signature (group.cjs:176):**
```javascript
annotateDAGWithGroups(dag, groupResult)
// Returns: new DAG with group fields populated on nodes
```

**Team-size resolution chain:**
1. `teamSize` is passed to `init scaffold --team-size N` and stored in `config.json` as `planning.max_parallel_sets` (computed as `floor(teamSize * 1.5)`)
2. The actual `teamSize` value is NOT stored in STATE.json or config.json -- only the derived `max_parallel_sets` is stored
3. `config.json` has a `solo` boolean (true when teamSize=1)
4. The CONTEXT.md decision says: "Store `teamSize` in STATE.json during init, read it at add-set time"
5. **Current STATE.json schema uses `.passthrough()`** so adding a `teamSize` field will pass Zod validation without schema changes
6. **However:** The `dag regroup` command (dag.cjs:135-204) currently requires `--team-size N` as an explicit argument -- it does NOT read from state or config
7. **Back-derivation option:** `teamSize` can be inferred from `config.json` `solo` field (true = 1) or `planning.max_parallel_sets` (reverse: `ceil(max_parallel_sets / 1.5)`)

**Wiring decision:** The CONTEXT.md says to call `partitionIntoGroups()` explicitly after `recalculateDAG()` in `addSetToMilestone()`. This requires:
1. Loading the freshly-written DAG.json (via `tryLoadDAG`)
2. Loading contracts for all sets in the DAG
3. Determining `numDevelopers` (from STATE.json `teamSize` or config.json derivation)
4. Calling `partitionIntoGroups(dag, contracts, numDevelopers)`
5. Calling `annotateDAGWithGroups(dag, groupResult)`
6. Writing the annotated DAG back to disk

**The existing `dag regroup` command (dag.cjs:135-204) already implements steps 1-6 fully.** The wiring in `addSetToMilestone()` can reuse the same logic, but needs the `numDevelopers` parameter resolved automatically.

### Error Message Patterns

**Current error architecture:**
1. **`CliError` class** (errors.cjs:26-39): `new CliError(message, { code, data })` -- thrown by command handlers
2. **`exitWithError(msg, code)`** (errors.cjs:48-52): writes JSON to stdout + human-readable to stderr + `process.exit(1)`
3. **Router catch** (rapid-tools.cjs:305-310): catches `CliError`, calls `exitWithError(err.message, err.code)`
4. **`error(msg)`** (core.cjs:21-23): writes `[RAPID ERROR] ${msg}\n` to stderr

**Current error message patterns across the codebase (sampled from ~80+ throw sites):**

| Pattern | Example | Count (approx) |
|---------|---------|----------------|
| Usage hint | `'Usage: state get milestone <id>'` | ~25 |
| State-not-found | `'STATE.json not found. Run init to create project state.'` | ~5 |
| Entity-not-found | `'Set "auth" not found in milestone "v1"'` | ~8 |
| Invalid transition | `'Invalid transition: "pending" -> "executed". Valid: [discussed, planned]'` | via validateTransition |
| Unknown subcommand | `'Unknown state subcommand: foo'` | ~10 |
| Generic message | `err.message` passthrough | ~15 |

**Breadcrumb consistency findings:**

The CONTEXT.md specifies: `[ERROR] {context}. Run: {recovery command}`

Current state:
- **State machine errors** (state-machine.cjs:19-23): Already have `REMEDIATION_HINTS` with recovery commands -- partial breadcrumb pattern exists
- **State command errors** (state.cjs): Mix of `CliError('Usage: ...')` and `CliError('STATE.json not found. Run init...')` -- inconsistent format
- **Transition errors** (state-transitions.cjs:36-51): Show valid transitions but no recovery command
- **add-set errors** (add-set.cjs:49-58): Show what failed and available options but no recovery command
- **dag errors** (dag.cjs): Some have recovery hints (`'Run init first'`, `'Run dag generate first'`), others do not
- **resolve errors** (resolve.cjs): Include actionable hint (`'Use /rapid:status to see available sets'`)

**Key observation:** The `REMEDIATION_HINTS` object in `state-machine.cjs:19-23` already has recovery commands for state errors, but they use a `\nRemediation: Run ...` format appended to the error message. This is different from the CONTEXT.md target format `[ERROR] {context}. Run: {recovery command}`.

**Error output coloring:** The `error()` function in `core.cjs` prefixes with `[RAPID ERROR]` but uses no ANSI color. The CONTEXT.md says: "Minimal color: red ANSI for the `[ERROR]` label, default terminal color for the rest."

### USAGE String Structure

**Current USAGE string** (rapid-tools.cjs:30-145):
- 116 lines, flat listing of all CLI subcommands
- No section headers or grouping
- Commands listed in the order they were added historically
- Mix of indentation styles (some with extra spaces for alignment)

**CONTEXT.md decision:** Add workflow-based section headers: Setup, Planning, Execution, Review & Merge, Utilities

**Proposed reorganization mapping:**
- **Setup:** prereqs, init, context, scaffold, migrate
- **Planning:** state, plan, assumptions, dag, set-init
- **Execution:** worktree, execute, resume, quick
- **Review & Merge:** review, merge, display, build-agents
- **Utilities:** lock, parse-return, verify-artifacts, memory, hooks, ui-contract, docs, compact, resolve

### Status Command (Skill-Based)

The `/rapid:status` skill (skills/status/SKILL.md) is a read-only skill defined entirely in its SKILL.md. It:
1. Loads STATE.json via CLI
2. Loads DAG.json for wave ordering
3. Gets git activity per branch
4. Displays a table with status/activity/branch per set
5. Shows next action suggestions based on status
6. Uses AskUserQuestion for action routing

**CONTEXT.md decision:** Enhance `/rapid:status` to include contextual next-step suggestions based on current project state (state-aware hints).

**Current next-action mapping** (status skill lines 161-173):
- pending -> `/rapid:start-set {N}`
- discussed -> `/rapid:discuss-set {N}`
- planned -> `/rapid:plan-set {N}`
- executed -> `/rapid:execute-set {N}`
- complete -> `/rapid:review {N}`
- merged -> (done)

**Current edge cases** (status skill lines 156-159):
- No sets: "No sets found. Run `/rapid:init` to get started."
- All merged: "All sets merged! Run `/rapid:new-version`"
- Missing state: Shows init suggestion

**Gap:** There is no specific guidance for the "sets exist but none started" state (post-init, pre-start-set). The CONTEXT.md says to show a workflow guide at the end of `/rapid:init` AND include it in `/rapid:status` when no sets have been started yet.

### Init Flow Output

The init skill (`skills/init/SKILL.md`) is a multi-step pipeline. The final output after init completes would need a workflow guide section. The CONTEXT.md says to show it at the end of `/rapid:init` output.

**Current init output flow:** After roadmap generation and set decomposition, the init skill shows:
- A summary of sets created
- A next-step message (team-size conditional from quick task 9)

**Gap for first-run guidance:** No structured workflow guide exists. The CONTEXT.md wants a guide covering the gap between "project initialized" and "user confidently running their first set through the lifecycle."

## Tooling Assessment

### Build Tools
- **No build step** -- all `.cjs` files run directly via Node.js
- **Agent builder:** `build-agents` command generates `.md` files from `src/modules/` -- not relevant to UX audit

### Test Framework
- **`node:test`** built-in -- sufficient for unit tests
- **Test file naming:** `*.test.cjs` in source directories (collocated) and `tests/` directory
- **The owned test file** `tests/ux-audit.test.cjs` should follow existing patterns: `require('node:test')`, `require('node:assert/strict')`, describe/it blocks

### Linting/Formatting
- **No linter configured** (no .eslintrc, .prettierrc, biome.json)
- **`'use strict'`** convention enforced by pattern, not tooling
- **Consistent style:** 2-space indentation, single quotes, CommonJS

### CI/CD
- **No CI pipeline detected** in the repository root (no `.github/workflows/`, `.gitlab-ci.yml`, etc.)
- **Test invocation:** Manual via `npm test` or `node --test`

## Stack Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | `teamSize` not stored in STATE.json or config.json directly | Medium -- auto-regroup wiring needs it at add-set time | Store `teamSize` top-level in STATE.json per CONTEXT.md decision; existing `.passthrough()` on schema permits this |
| 2 | Config.json only stores derived `max_parallel_sets`, not original `teamSize` | Low -- back-derivation is lossy (`ceil(max_parallel_sets / 1.5)`) | Add `teamSize` to STATE.json during init scaffold and read from there |
| 3 | 80+ throw sites across 20+ files -- breadcrumb standardization scope risk | High -- touching all of them would be a massive change | CONTEXT.md bounds scope to "state transition errors and set lifecycle command errors" -- estimate ~20-30 sites |
| 4 | Error format change could break tests that assert on error messages | Medium -- test files use `.match()` patterns | Run full test suite after each batch of error changes; use flexible regex patterns in new tests |
| 5 | Status skill is markdown-based (SKILL.md), not code -- changes are text edits not code changes | Low -- but means changes cannot be unit tested | Manual verification; audit checklist grading handles this |
| 6 | `solo: true` in config.json means `teamSize=1` -- auto-regroup should be skipped for solo developers | Medium -- calling `partitionIntoGroups` with `numDevelopers=1` is a no-op (all sets in G1) but adds overhead | Check `teamSize <= 1` or `solo === true` and skip regrouping |

## Recommendations

| # | Action | Rationale | Priority |
|---|--------|-----------|----------|
| 1 | Add `teamSize` field to STATE.json in `createInitialState()` | Required for auto-regroup wiring; CONTEXT.md decision says "top-level in STATE.json" | **critical** |
| 2 | Wire `partitionIntoGroups()` + `annotateDAGWithGroups()` after `recalculateDAG()` in `addSetToMilestone()` | Deferred from v6.0.0; the function and tests exist, just needs wiring | **critical** |
| 3 | Skip auto-regroup when `teamSize <= 1` (solo mode) | Unnecessary overhead for solo developers; `dag regroup` already has this check (dag.cjs:156-160) | **high** |
| 4 | Standardize error breadcrumbs on state transition errors first | Highest user impact; `validateTransition()` errors are the most common user-facing errors | **high** |
| 5 | Add red ANSI to `[ERROR]` label in `error()` function (core.cjs:21) | CONTEXT.md decision on error styling; minimal color change | **medium** |
| 6 | Restructure USAGE string with workflow section headers | CONTEXT.md decision; low risk, improves discoverability | **medium** |
| 7 | Add first-run workflow guide to init output and status skill empty-state | CONTEXT.md decision on first-run experience | **medium** |
| 8 | Reuse `dag regroup` logic in the `addSetToMilestone()` wiring to avoid code duplication | The regroup command already handles contract loading, group partitioning, DAG annotation, and persistence | **medium** |
