# PLAN: ux-audit / Wave 1

**Objective:** Wire auto-regroup into the add-set flow, persist teamSize in STATE.json, and establish the UX audit checklist scaffold. This wave lays the functional foundation (auto-regroup) and the audit framework (checklist) that Wave 2 and Wave 3 build upon.

**Owned Files (Wave 1 only):**
- `src/lib/add-set.cjs` (modify)
- `src/lib/init.cjs` (modify)
- `src/commands/init.cjs` (modify -- passthrough teamSize to STATE.json)
- `.planning/v6.1.0-UX-AUDIT.md` (create -- checklist scaffold)

**Read-Only References:**
- `src/lib/group.cjs` -- `partitionIntoGroups()`, `annotateDAGWithGroups()`
- `src/lib/dag.cjs` -- `tryLoadDAG()`
- `src/lib/state-machine.cjs` -- `readState()`, `withStateTransaction()`
- `src/lib/state-schemas.cjs` -- `ProjectState` (uses `.passthrough()`, no schema changes needed)
- `src/commands/dag.cjs` -- reference for how `dag regroup` already calls `partitionIntoGroups()`
- `.planning/config.json` -- `solo: true` check

---

## Task 1: Persist teamSize in STATE.json during init

**What:** When `scaffoldProject()` creates STATE.json, include `teamSize` as a top-level field. This is the single source of truth that `addSetToMilestone()` will read at add-set time.

**Why:** Currently teamSize is passed to init but only the derived `max_parallel_sets` is stored in config.json. The auto-regroup wiring in Task 2 needs teamSize at add-set time. Per CONTEXT.md decision: store at top-level in STATE.json (alongside `currentMilestone`), not nested per milestone.

**File:** `src/lib/init.cjs`

**Actions:**
1. In `scaffoldProject()` (line ~242), where STATE.json is generated via `createInitialState()`, modify the generated state object to include `teamSize` before writing. The `ProjectState` schema uses `.passthrough()` at the top level, so adding `teamSize` requires NO schema changes.
2. Specifically: after `createInitialState(opts.name, 'v1.0', getVersion())` returns, set `state.teamSize = opts.teamSize || 1` on the returned object before passing to `JSON.stringify`.
3. The `fileGenerators['STATE.json']` lambda (around line 242) should be:
   ```
   'STATE.json': () => {
     const state = createInitialState(opts.name, 'v1.0', getVersion());
     state.teamSize = opts.teamSize || 1;
     return JSON.stringify(state, null, 2);
   }
   ```

**What NOT to do:**
- Do NOT modify the Zod schema in `state-schemas.cjs` -- `.passthrough()` already allows extra fields.
- Do NOT store teamSize in config.json (it already has the derived `max_parallel_sets`; teamSize goes in STATE.json).
- Do NOT change the `createInitialState()` function signature -- add teamSize after the call.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node -e "
const { scaffoldProject } = require('./src/lib/init.cjs');
const fs = require('fs');
const path = require('path');
const tmp = fs.mkdtempSync('/tmp/rapid-test-');
const result = scaffoldProject(tmp, { name: 'test', description: 'test', teamSize: 3 }, 'fresh');
const state = JSON.parse(fs.readFileSync(path.join(tmp, '.planning', 'STATE.json'), 'utf-8'));
console.log('teamSize in STATE.json:', state.teamSize);
console.assert(state.teamSize === 3, 'teamSize should be 3');
fs.rmSync(tmp, { recursive: true });
console.log('PASS');
"
```

---

## Task 2: Wire partitionIntoGroups() into addSetToMilestone()

**What:** After `recalculateDAG()` completes in `addSetToMilestone()` (line 71 of `src/lib/add-set.cjs`), call `partitionIntoGroups()` and `annotateDAGWithGroups()` to auto-regroup the DAG. Skip regrouping for solo mode (teamSize === 1).

**Why:** This was deferred from v6.0.0. Currently, adding a set via `state add-set` recalculates the DAG but does not regroup. Users must manually run `dag regroup` afterward. Per CONTEXT.md: the call goes explicitly after `recalculateDAG()`, not inside it.

**File:** `src/lib/add-set.cjs`

**Actions:**
1. Add imports at the top:
   ```javascript
   const { partitionIntoGroups, annotateDAGWithGroups } = require('./group.cjs');
   const { tryLoadDAG } = require('./dag.cjs');
   const { writeDAG } = require('./plan.cjs');  // already imported
   ```
   Note: `writeDAG` is already imported on line 19. Only add the `group.cjs` and `tryLoadDAG` imports.

2. After `await recalculateDAG(cwd, milestoneId);` on line 71, add auto-regroup logic:
   ```javascript
   // Auto-regroup if team size > 1
   await autoRegroup(cwd);
   ```

3. Add a new function `autoRegroup(cwd)` in the same file:
   ```javascript
   async function autoRegroup(cwd) {
     // Read teamSize from STATE.json (top-level field, added during init)
     const readResult = await readState(cwd);
     if (!readResult || !readResult.valid) return; // graceful skip
     
     const teamSize = readResult.state.teamSize;
     if (!teamSize || teamSize <= 1) return; // solo mode -- skip regrouping
     
     const { dag, path: dagPath } = tryLoadDAG(cwd);
     if (!dag) return; // no DAG -- skip gracefully
     
     // Load contracts for all sets in the DAG
     const contracts = {};
     for (const node of dag.nodes) {
       const contractPath = path.join(cwd, '.planning', 'sets', node.id, 'CONTRACT.json');
       try {
         const raw = fs.readFileSync(contractPath, 'utf-8');
         contracts[node.id] = JSON.parse(raw);
       } catch {
         // Missing or malformed contract -- skip
       }
     }
     
     const groupResult = partitionIntoGroups(dag, contracts, teamSize);
     const annotatedDag = annotateDAGWithGroups(dag, groupResult);
     writeDAG(cwd, annotatedDag);
   }
   ```

4. Export `autoRegroup` from the module (add to `module.exports`).

**What NOT to do:**
- Do NOT put auto-regroup logic inside `recalculateDAG()` -- keep it separate per CONTEXT.md decision.
- Do NOT require `--team-size` as a CLI argument -- read from STATE.json.
- Do NOT error when teamSize is missing from STATE.json (older projects) -- gracefully skip.
- Do NOT duplicate the contract-loading logic in a helper function -- keep it inline in `autoRegroup` (it mirrors the pattern in `dag.cjs:regroup` but is intentionally local).

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node -e "
const { autoRegroup } = require('./src/lib/add-set.cjs');
console.log('autoRegroup is exported:', typeof autoRegroup === 'function');
console.log('PASS');
"
```

---

## Task 3: Create UX audit checklist scaffold

**What:** Create the structured UX audit report at `.planning/v6.1.0-UX-AUDIT.md` with a predefined checklist organized by four pillars. Each item has a pass/fail/deferred grade column and a notes column for findings.

**Why:** The audit is bounded by this checklist (not open-ended). Wave 2 and Wave 3 will fill in the grades as they address each item. The checklist must exist first so subsequent waves can reference it.

**File:** `.planning/v6.1.0-UX-AUDIT.md` (new)

**Actions:**
Create the file with this content structure:

```markdown
# v6.1.0 UX Audit Report

**Milestone:** v6.1.0 -- UX & Onboarding
**Auditor:** ux-audit set
**Date:** {current date}
**Status:** In Progress

## Pillar 1: Breadcrumb Consistency

Error messages should follow the pattern: `[ERROR] {context}. Run: {recovery command}`
Red ANSI on `[ERROR]` label only, default terminal color for the rest.

| # | Item | Grade | Notes |
|---|------|-------|-------|
| 1.1 | State transition errors include recovery command | -- | |
| 1.2 | Set lifecycle errors (init, plan, execute, merge) include recovery command | -- | |
| 1.3 | `[ERROR]` label uses red ANSI, rest uses default color | -- | |
| 1.4 | Error format is compact inline (`[ERROR] {context}. Run: {cmd}`) | -- | |
| 1.5 | REMEDIATION_HINTS in state-machine.cjs follow new format | -- | |

## Pillar 2: Command Discoverability

| # | Item | Grade | Notes |
|---|------|-------|-------|
| 2.1 | USAGE string has workflow-based section headers | -- | |
| 2.2 | Unknown command error suggests closest valid command | -- | |
| 2.3 | `/rapid:status` shows contextual next-step suggestions | -- | |
| 2.4 | Commands grouped: Setup, Planning, Execution, Review & Merge, Utilities | -- | |

## Pillar 3: First-Run Experience

| # | Item | Grade | Notes |
|---|------|-------|-------|
| 3.1 | Post-init output includes workflow guide | -- | |
| 3.2 | `/rapid:status` shows workflow guide when no sets started | -- | |
| 3.3 | Gap between "project initialized" and "first set" is bridged | -- | |

## Pillar 4: Auto-Regroup Wiring

| # | Item | Grade | Notes |
|---|------|-------|-------|
| 4.1 | `partitionIntoGroups()` called after `recalculateDAG()` in add-set | -- | |
| 4.2 | `teamSize` stored in STATE.json during init | -- | |
| 4.3 | Solo mode (teamSize=1) skips regrouping | -- | |
| 4.4 | Missing teamSize in STATE.json (older projects) gracefully skips | -- | |

## Summary

- **Total items:** 16
- **Pass:** 0
- **Fail:** 0
- **Deferred:** 0
- **Pending:** 16

## Remediation Log

| Item | Action Taken | Commit |
|------|-------------|--------|
| | | |
```

Replace `{current date}` with the actual date at execution time.

**Verification:**
```bash
test -f /home/kek/Projects/RAPID/.planning/v6.1.0-UX-AUDIT.md && echo "PASS: Audit report exists" || echo "FAIL"
grep -c "^| [0-9]" /home/kek/Projects/RAPID/.planning/v6.1.0-UX-AUDIT.md | xargs -I{} echo "Checklist items: {}"
```

---

## Success Criteria

1. `scaffoldProject()` with `teamSize: 3` produces STATE.json containing `"teamSize": 3`
2. `autoRegroup()` is exported from `add-set.cjs` and callable
3. `autoRegroup()` is called after `recalculateDAG()` in `addSetToMilestone()`
4. Solo mode (teamSize <= 1 or missing) gracefully skips regrouping
5. `.planning/v6.1.0-UX-AUDIT.md` exists with 16 checklist items across 4 pillars
6. Existing tests still pass: `node --test tests/display.test.cjs`
