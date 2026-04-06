# Quick Plan: Init Not Generating Foundation Set (Set 0)

## Problem

The `/rapid:init` command should generate a foundation set (set 0) containing shared interfaces and stubs, but this is not happening. The infrastructure exists (`createFoundationSet()` in `src/lib/scaffold.cjs`, scaffold-report v2 with `foundationSet` field, v6.md requirement at line 9) but the wiring is missing at two levels:

1. **No CLI subcommand** exposes `createFoundationSet()` -- `src/commands/scaffold.cjs` has `run`, `status`, and `verify-stubs` but no `create-foundation-set` subcommand. The function exists in the lib layer but is unreachable from agent code via the CLI.

2. **The init SKILL.md has no step for foundation set creation.** After the roadmapper returns its proposal and the user accepts (Step 9), the init skill writes ROADMAP.md, CONTRACT.json per set, DEFINITION.md per set, merges STATE.json, and generates DAG.json -- but never calls `createFoundationSet()`. The roadmapper role module (`role-roadmapper.md` and `agents/rapid-roadmapper.md`) also has no instruction to include a foundation set in its proposal.

3. **The roadmapper role does not instruct the agent to propose a foundation set.** The roadmapper output format (`state.milestones[].sets[]`) includes regular sets only. There is no guidance telling the roadmapper to include a set with `foundation: true` when team-size > 1 and scaffold has generated stubs.

## Root Cause

The `createFoundationSet()` function was implemented in the `scaffold-overhaul` set (v6.0.0), but the integration into the init pipeline was never completed. The lib function and tests exist, the scaffold-report v2 references it, but the two connection points (CLI command + init SKILL.md orchestration) are missing.

## Scope

This plan addresses multi-developer projects (team-size > 1) where a scaffold has been run and stubs exist. For solo projects (team-size = 1), foundation set generation is not applicable per the existing design (see `role-roadmapper.md` lines 298-302).

---

## Task 1: Add `scaffold create-foundation-set` CLI subcommand

**Files to modify:**
- `src/commands/scaffold.cjs`

**Action:**

Add a new `create-foundation-set` subcommand to `handleScaffold()` that:

1. Accepts `--name <name>` (optional, defaults to `"foundation"`) and `--contracts <json>` (required, JSON string of `Record<setId, contractObject>`) arguments.
2. Calls `createFoundationSet(cwd, { name, sets: Object.keys(contracts), contracts })` from `src/lib/scaffold.cjs`.
3. Outputs JSON result: `{ created: true, name, setDir }`.

The contracts argument is a JSON object mapping set IDs to their CONTRACT.json content. This is already available in the init flow from the roadmapper's output.

Also add `--sets <json>` as an alias for the sets array extracted from contracts keys, since `createFoundationSet` needs it.

**What NOT to do:**
- Do not change `createFoundationSet()` itself -- it works correctly per existing tests.
- Do not add this to the `scaffold run` flow -- it is a separate subcommand called explicitly by the init orchestrator.

**Verification:**

```bash
cd /home/kek/Projects/RAPID && node -e "
const { handleScaffold } = require('./src/commands/scaffold.cjs');
// Verify the function signature accepts the new subcommand name
const source = require('fs').readFileSync('./src/commands/scaffold.cjs', 'utf-8');
console.log(source.includes('create-foundation-set') ? 'PASS: subcommand exists' : 'FAIL: subcommand missing');
"
```

And run existing tests to confirm no regressions:

```bash
cd /home/kek/Projects/RAPID && npx jest src/lib/scaffold.test.cjs --no-coverage 2>&1 | tail -5
```

**Done when:** `node src/bin/rapid-tools.cjs scaffold create-foundation-set --name foundation --contracts '{}'` runs without error (empty contracts = no-op creates set dir with empty exports).

---

## Task 2: Add foundation set creation step to init SKILL.md

**Files to modify:**
- `skills/init/SKILL.md`

**Action:**

Add a new **Step 9a: Foundation Set (Multi-Developer Only)** between the existing Step 9 (Roadmap Generation, after "Accept roadmap" writes all files) and Step 9.5 (Write PRINCIPLES.md).

The new step should:

1. **Gate on team-size > 1.** If team-size is 1 (solo), skip this step entirely with a comment: "Foundation set skipped (solo developer mode)."

2. **Check for scaffold report.** Read `.planning/scaffold-report.json`. If no scaffold has been run (file does not exist), skip with: "Foundation set skipped (no scaffold report found). Run /rapid:scaffold first if you want stub-based cross-group testing."

3. **Collect contracts.** Build a JSON object of all contracts from the roadmapper's output: `{ "set-id-1": {contract1}, "set-id-2": {contract2}, ... }`.

4. **Call the CLI:**
   ```bash
   node "${RAPID_TOOLS}" scaffold create-foundation-set --name foundation --contracts '<CONTRACTS_JSON>'
   ```

5. **Register foundation set in STATE.json.** Add the foundation set to the milestone's sets array at index 0 (before all other sets) with status "pending" and branch "set/foundation":
   ```bash
   node -e "
     const { mergeStatePartial } = require('$(dirname \"${RAPID_TOOLS}\")/lib/state-machine.cjs');
     const fs = require('fs');
     const state = JSON.parse(fs.readFileSync('.planning/STATE.json', 'utf-8'));
     const milestone = state.milestones.find(m => m.id === state.currentMilestone);
     milestone.sets.unshift({ id: 'foundation', name: 'Foundation', status: 'pending', branch: 'set/foundation' });
     fs.writeFileSync('.planning/STATE.json', JSON.stringify(state, null, 2));
   "
   ```

6. **Regenerate DAG.json** to include the foundation node:
   ```bash
   node "${RAPID_TOOLS}" dag generate
   ```

7. **Display:** "Foundation set created with shared interfaces from {N} sets."

**What NOT to do:**
- Do not make foundation set creation mandatory for solo projects.
- Do not modify the roadmapper's output format -- the foundation set is created by the init orchestrator, not proposed by the roadmapper.
- Do not add the foundation set to the roadmapper prompt -- it would complicate the roadmapper's already complex contract unification logic.

**Verification:**

```bash
# Verify the step exists in SKILL.md
grep -c "Step 9a" /home/kek/Projects/RAPID/skills/init/SKILL.md
# Should output: 1 or more
grep -c "create-foundation-set" /home/kek/Projects/RAPID/skills/init/SKILL.md
# Should output: 1 or more
grep -c "Foundation Set" /home/kek/Projects/RAPID/skills/init/SKILL.md
# Should output: 1 or more
```

**Done when:** The SKILL.md contains the complete Step 9a with the gating logic, CLI call, state registration, DAG regeneration, and display message. The step is positioned between existing Step 9 (roadmap acceptance) and Step 9.5 (principles).

---

## Task 3: Add `create-foundation-set` to CLI tool docs and help text

**Files to modify:**
- `src/lib/tool-docs.cjs` (if it contains scaffold subcommand documentation)
- `src/commands/scaffold.cjs` (update the usage error message to include the new subcommand)

**Action:**

1. Update the usage/help string in `handleScaffold()` to include `create-foundation-set`:
   ```
   Usage: rapid-tools scaffold <run|status|verify-stubs|create-foundation-set> [options]
   ```

2. Update the subcommand validation check to accept `create-foundation-set`.

3. If `src/lib/tool-docs.cjs` has a scaffold section, add the new subcommand:
   ```
   scaffold create-foundation-set --name <n> --contracts <json> -- Create foundation set #0 with merged contracts
   ```

**Verification:**

```bash
cd /home/kek/Projects/RAPID && node src/bin/rapid-tools.cjs scaffold 2>&1 | head -3
# Should show usage text including create-foundation-set
```

**Done when:** Running `scaffold` with no subcommand or an invalid one shows the updated usage string including `create-foundation-set`.
