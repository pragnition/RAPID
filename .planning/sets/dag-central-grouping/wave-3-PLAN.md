# PLAN: dag-central-grouping -- Wave 3

## Objective

Wire the DAGv3 group system into the CLI and roadmapper module. Add `dag groups` and `dag regroup` subcommands, extend `dag show` with group badges and cross-group edge markers, and update the roadmapper role module to incorporate team-size-driven group assignment guidance. Solo developer behavior (team-size = 1) hides all group features entirely.

## Prerequisites

- Wave 1 complete: DAGv3 schema, migration, tryLoadDAG with migrated flag, getExecutionOrder compat.
- Wave 2 complete: partitionIntoGroups, annotateDAGWithGroups, generateGroupReport, syncDAGStatus.

## Files Modified

| File | Action |
|------|--------|
| `src/commands/dag.cjs` | Extend with `groups`, `regroup` subcommands; enhance `show` with group badges |
| `src/modules/roles/role-roadmapper.md` | Add group assignment guidance for team-size > 1 |

## Tasks

### Task 1: Add `dag groups` subcommand to commands/dag.cjs

**What:** Add a `groups` case to the switch statement in `handleDag()`.

**Behavior:**
- Load DAG using `tryLoadDAG(cwd)`.
- If no DAG, throw `CliError('No DAG.json found. Run `dag generate` first.')`.
- If `dag.groups` is empty or undefined: output `"No groups assigned. Run \`dag regroup --team-size N\` to assign groups."` to stdout and return.
- If `--json` flag is in args: output `JSON.stringify(dag.groups, null, 2)` to stdout.
- Otherwise: use `generateGroupReport()` from `group.cjs` to produce markdown output. Since this is terminal output, render the markdown in a simplified form:
  - Print the group report markdown to stdout (it is human-readable enough as-is).
  - Alternatively, parse the groups directly and print a colored terminal summary:
    ```
    Developer Groups:
    
      G1: set-alpha, set-beta
      G2: set-gamma, set-delta
    
    Cross-Group Dependencies: 2
      set-alpha -> set-gamma (G1 -> G2)
    ```

**Import:** `const { generateGroupReport } = require('../lib/group.cjs');` (lazy, inside the case block).

**Verification:**
```bash
node --test src/commands/dag.test.cjs 2>&1 | grep -E '(pass|fail|groups)' || echo "No command tests yet -- manual verify"
```

### Task 2: Add `dag regroup` subcommand to commands/dag.cjs

**What:** Add a `regroup` case to the switch statement in `handleDag()`.

**Behavior:**
1. Parse `--team-size N` from args. If missing or not a positive integer, throw `CliError('Usage: dag regroup --team-size N (where N >= 1)')`.
2. If `teamSize === 1`: output `"Team size is 1 -- group features are hidden for solo developers."` and return.
3. Load DAG using `tryLoadDAG(cwd)`. If no DAG, throw CliError.
4. If `migrated` is true, persist the migrated DAG first (write to disk).
5. Load contracts for all sets in the DAG:
   - For each node in `dag.nodes`, try to read `.planning/sets/{node.id}/CONTRACT.json`.
   - Build `contracts` object: `{ [setId]: contractJson }`.
   - If a contract file is missing or malformed, skip it (no file ownership = no conflict constraints).
6. Call `partitionIntoGroups(dag, contracts, teamSize)`.
7. Call `annotateDAGWithGroups(dag, groupResult)` to get the annotated DAG.
8. Write the annotated DAG to disk: `fs.writeFileSync(dagPath, JSON.stringify(annotatedDag, null, 2))`.
9. Output the group report to stdout using `generateGroupReport(groupResult)`.
10. Output a success message: `"DAG.json updated with N group assignments."`.

**Imports (lazy, inside case block):**
```js
const { tryLoadDAG } = require('../lib/dag.cjs');
const { partitionIntoGroups, annotateDAGWithGroups, generateGroupReport } = require('../lib/group.cjs');
```

**Verification:**
```bash
# Manual: create a test DAG and run regroup
node src/bin/rapid-tools.cjs dag regroup --team-size 2 2>&1 || echo "Expected: regroup output"
```

### Task 3: Enhance `dag show` with group badges and cross-group markers

**What:** Modify the existing `show` case in `handleDag()` to display group information.

**Behavior changes:**

1. **Call syncDAGStatus before display:** At the top of the `show` handler, call `await syncDAGStatus(cwd)` then re-load the DAG. This replaces the manual statusMap building from STATE.json. The code currently does:
   ```js
   const { dag } = tryLoadDAG(cwd);
   // ... manually builds statusMap from readState ...
   ```
   Replace with:
   ```js
   const { syncDAGStatus, tryLoadDAG, getExecutionOrder } = require('../lib/dag.cjs');
   await syncDAGStatus(cwd);
   const { dag } = tryLoadDAG(cwd);
   ```
   This means the status is now read directly from `dag.nodes[i].status` instead of the statusMap.

2. **Group badges:** After the set name in each wave listing, add an inline group badge if the node has a group:
   ```
     set-alpha [G1]  (planned)
     set-beta [G2]  (executing)
     set-gamma  (pending)        // no group assigned
   ```
   Use a dim/cyan color for the badge: `'\x1b[36m'` for the badge text.

3. **Cross-group edge markers:** After the wave listing, if `dag.groups` is non-empty and `dag.edges` has cross-group edges, add a section:
   ```
   Cross-group edges:
     set-alpha -> set-gamma  [G1 -> G2]  ⚡
   ```
   Use `\u26A1` (lightning bolt) as the marker character. Only show this section if there are actual cross-group edges.

4. **Solo suppression:** If `dag.groups` is empty or `Object.keys(dag.groups).length === 0`, do NOT show group badges or cross-group edges section. Behave exactly as before.

**What NOT to do:**
- Do NOT remove the existing status coloring logic -- keep it, just read status from node instead of statusMap.
- Do NOT break the existing output format for DAGs with no groups.

**Verification:**
```bash
node src/bin/rapid-tools.cjs dag show 2>&1 | head -20
```

### Task 4: Update switch statement default error and usage message

**What:** Update the error messages in the `undefined` case and `default` case to include the new subcommands.

**Changes:**
- `case undefined`: Change to `throw new CliError('Usage: dag <generate|show|groups|regroup>')`.
- `default`: Change valid subcommands list to `"generate, show, groups, regroup"`.

**Verification:**
```bash
node src/bin/rapid-tools.cjs dag 2>&1 | grep -E 'groups|regroup'
```

### Task 5: Update role-roadmapper.md with group assignment guidance

**What:** Extend the roadmapper role module to incorporate team-size-driven group awareness.

**Changes to add (insert after the "## Design Principles" section, before "## Scope and Constraints"):**

Add a new section:

```markdown
## Group Assignment Guidance

When `team-size > 1`, the roadmapper should design set boundaries that naturally partition into developer groups with minimal file ownership conflicts.

### Principles
- **File ownership isolation**: Each set should own a distinct set of files. When two sets must touch the same file, prefer to assign them to the same developer group.
- **Active constraint**: Use team-size to actively influence set boundary design. If team-size is 2, aim for sets that cleanly split into 2 groups. If team-size is 3, aim for 3 groups.
- **Dependency awareness**: Sets with direct dependencies (edges in the DAG) benefit from being in the same group, since the developer has full context.
- **Balance**: Aim for roughly equal numbers of sets per developer, but prioritize conflict minimization over strict balance.

### Solo Developer (team-size = 1)
When team-size is 1, group-related features are completely suppressed:
- Do NOT mention groups in the roadmap output.
- Do NOT add group annotations to the DAG.
- The roadmapper output remains unchanged from pre-group behavior.

### Multi-Developer (team-size > 1)
When team-size > 1, include in the roadmap output:
- A "Developer Groups" section suggesting how sets should be assigned to developers.
- Note which sets share file ownership and should ideally be assigned to the same developer.
- Flag any sets with high cross-group dependency risk.
```

**What NOT to do:**
- Do NOT modify the output format sections (JSON structure, ROADMAP.md format, etc.) -- group assignment is guidance, not a structural change to the roadmap format.
- Do NOT add group fields to the STATE.json or CONTRACT.json output format definitions.
- Do NOT modify the "What This Agent Does" or "What This Agent Does NOT Do" lists -- group guidance is part of "designs set boundaries."

**Verification:**
```bash
grep -c "Group Assignment" src/modules/roles/role-roadmapper.md
```

## Success Criteria

1. `dag groups` displays group assignments or a helpful message when no groups exist.
2. `dag groups --json` outputs JSON format.
3. `dag regroup --team-size N` partitions sets and persists to DAG.json.
4. `dag regroup --team-size 1` outputs solo developer message and returns.
5. `dag show` displays group badges when groups are assigned.
6. `dag show` displays cross-group edge markers when cross-group edges exist.
7. `dag show` behaves identically to before when no groups are assigned.
8. Usage error messages include the new subcommands.
9. role-roadmapper.md includes group assignment guidance.
10. All Wave 1 and Wave 2 tests continue to pass.
11. Full test suite: `node --test src/lib/dag.test.cjs && node --test src/lib/group.test.cjs` exits 0.
