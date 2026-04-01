<!-- gap-closure: true -->
# Wave 4 Plan: scaffold-overhaul -- Documentation Alignment (Gap Closure)

## Objective

Close Gap 1 (shared stub branch management) by aligning all planning artifacts and documentation with the actual per-worktree `.rapid-stubs/` implementation. The implementation already uses per-worktree stub directories -- this is architecturally correct and consistent with RAPID's worktree isolation model. No code changes are needed. This wave updates references that still mention a `rapid/stubs` shared git branch to accurately describe the `.rapid-stubs/` directory approach.

## Background

The v6.0.0 research phase initially proposed a shared `rapid/stubs` git branch for centralized stub management. During implementation (waves 1-3), the team chose a per-worktree `.rapid-stubs/` directory model instead. All source code, tests, SKILL.md, and role modules already reference `.rapid-stubs/` correctly. However, several planning artifacts still reference the abandoned shared branch concept. This wave corrects those references.

## Tasks

### Task 1: Update CONTEXT.md stub storage references

**File:** `.planning/sets/scaffold-overhaul/CONTEXT.md`

**Action:** Two edits in this file:

1. **Line 9 (domain section):** Replace `shared \`rapid/stubs\` branch management` with `per-worktree \`.rapid-stubs/\` directory management`. The full sentence currently reads:
   > ...high-fidelity stub generation with `.rapid-stub` sidecar markers, shared `rapid/stubs` branch management, optional foundational set #0...
   Change to:
   > ...high-fidelity stub generation with `.rapid-stub` sidecar markers, per-worktree `.rapid-stubs/` directory management, optional foundational set #0...

2. **Lines 24-27 (Stub Storage & Branch Model decision):** The decision block currently says stubs live on a shared branch. Replace it to describe the per-worktree model:
   - Change the heading from `### Stub Storage & Branch Model` to `### Stub Storage Model`
   - Change line 25 from `Stubs live on a shared \`rapid/stubs\` git branch for centralized consistency.` to `Stubs live in a per-worktree \`.rapid-stubs/\` directory as ephemeral build artifacts.`
   - Change line 26 from `At \`start-set\` time, stubs are **copied** into the worktree as ephemeral artifacts (not branched from, not symlinked).` to `At \`start-set\` time, stubs are **generated** directly in the worktree's \`.rapid-stubs/\` directory from CONTRACT.json imports.`
   - Change line 27 from `**Rationale:** Shared branch ensures all developers see identical stubs. Copying keeps worktree branches clean -- stubs don't appear in branch diffs or history.` to `**Rationale:** Per-worktree generation is consistent with RAPID's worktree isolation model. Each worktree generates its own stubs from contracts, avoiding shared-branch race conditions and git complexity. Stubs don't appear in branch diffs or history because \`.rapid-stubs/\` is gitignored.`

**Verification:**
```bash
grep -n 'rapid/stubs' .planning/sets/scaffold-overhaul/CONTEXT.md
# Expected: no output (all references replaced)
grep -c '.rapid-stubs/' .planning/sets/scaffold-overhaul/CONTEXT.md
# Expected: count >= 3
```

### Task 2: Update CONTRACT.json behavioral constraint and task description

**File:** `.planning/sets/scaffold-overhaul/CONTRACT.json`

**Action:** Two edits in this file:

1. **Line 64 (stubBranchIsolation behavioral constraint):** Change:
   ```json
   "description": "Stub files generated on the rapid/stubs branch must not include any implementation logic beyond return value scaffolding"
   ```
   To:
   ```json
   "description": "Stub files generated in the .rapid-stubs/ directory must not include any implementation logic beyond return value scaffolding"
   ```
   Also rename the key from `stubBranchIsolation` to `stubContentIsolation` since there is no branch.

2. **Line 84 (task description):** Change:
   ```json
   { "description": "Implement shared stub branch management (rapid/stubs branch creation and worktree branching)", "acceptance": "Worktrees can branch from rapid/stubs; stubs replaced by real implementations during merge" }
   ```
   To:
   ```json
   { "description": "Implement per-worktree stub directory management (.rapid-stubs/ generation and cleanup)", "acceptance": "Worktrees generate stubs in .rapid-stubs/ from CONTRACT.json; stubs replaced by real implementations during merge" }
   ```

**Verification:**
```bash
grep -n 'rapid/stubs' .planning/sets/scaffold-overhaul/CONTRACT.json
# Expected: no output (all references replaced)
node -e "const c = require('./.planning/sets/scaffold-overhaul/CONTRACT.json'); console.log(JSON.stringify(c.behavioral.stubContentIsolation, null, 2))"
# Expected: prints the updated behavioral constraint
```

### Task 3: Update ROADMAP.md set description

**File:** `.planning/ROADMAP.md`

**Action:** One edit on line 44. Change:
> shared stub branch management (rapid/stubs)

To:
> per-worktree stub directory management (.rapid-stubs/)

The full line currently reads:
> Group-aware set splitting using DAG group annotations and file ownership data, high-fidelity stub generation with RAPID-STUB markers, shared stub branch management (rapid/stubs), optional foundational set #0 with foundation:true DAG flag, stub lifecycle hooks, scaffold verify-stubs command, and scaffold-report v2.

After the edit it should read:
> Group-aware set splitting using DAG group annotations and file ownership data, high-fidelity stub generation with RAPID-STUB markers, per-worktree stub directory management (.rapid-stubs/), optional foundational set #0 with foundation:true DAG flag, stub lifecycle hooks, scaffold verify-stubs command, and scaffold-report v2.

**Verification:**
```bash
grep -n 'rapid/stubs' .planning/ROADMAP.md
# Expected: no output
grep 'per-worktree stub directory management' .planning/ROADMAP.md
# Expected: one match on the scaffold-overhaul line
```

### Task 4: Update SET-OVERVIEW.md references

**File:** `.planning/sets/scaffold-overhaul/SET-OVERVIEW.md`

**Action:** Four edits in this file:

1. **Line 7 (core strategy paragraph):** Change `manage a shared \`rapid/stubs\` branch` to `manage per-worktree \`.rapid-stubs/\` directories`.

2. **Line 40 (side effects):** Change:
   > Creates/manages `rapid/stubs` git branch with generated stub files
   To:
   > Generates/manages per-worktree `.rapid-stubs/` directories with stub files

3. **Line 52 (risks table row):** Replace the entire row:
   > | Shared `rapid/stubs` branch management introduces git complexity (branch creation, worktree branching from stubs) | Medium | Keep branch operations minimal: create-if-not-exists, write stubs, commit; worktrees branch from stubs branch via standard git checkout |
   With:
   > | Per-worktree `.rapid-stubs/` directory management requires consistent generation across worktrees | Low | Stubs are generated deterministically from CONTRACT.json; each worktree produces identical stubs from the same contracts |

4. **Line 57 (Wave 2 description):** Change `shared \`rapid/stubs\` branch management` to `per-worktree \`.rapid-stubs/\` directory management`.

**Verification:**
```bash
grep -n 'rapid/stubs' .planning/sets/scaffold-overhaul/SET-OVERVIEW.md
# Expected: no output
grep -c '.rapid-stubs/' .planning/sets/scaffold-overhaul/SET-OVERVIEW.md
# Expected: count >= 4
```

### Task 5: Add .rapid-stubs/ to .gitignore

**File:** `.gitignore`

**Action:** Add `.rapid-stubs/` to the gitignore file. Place it immediately after the `.rapid-worktrees/` entry since both are ephemeral per-worktree artifacts. Add a comment for clarity.

The current `.gitignore` starts with:
```
# RAPID worktree working directories
.rapid-worktrees/
```

Add after the `.rapid-worktrees/` line:
```
# RAPID per-worktree stub directories (ephemeral, generated from contracts)
.rapid-stubs/
```

**Verification:**
```bash
grep '.rapid-stubs' .gitignore
# Expected: .rapid-stubs/
```

### Task 6: Update VERIFICATION-REPORT.md gap references

**File:** `.planning/sets/scaffold-overhaul/VERIFICATION-REPORT.md`

**Action:** This file contains gap annotations that reference the `rapid/stubs` branch. These are historical audit records. Do NOT change the verdict or status columns -- only annotate the Detail text to note that the gap has been closed by documentation alignment.

1. **Line 14 (Stub Storage & Branch Model row):** Append to the Detail text: ` [CLOSED wave-4: documentation aligned to per-worktree .rapid-stubs/ model]`

2. **Line 33 (BEHAVIORAL: stubBranchIsolation row):** Append to the Detail text: ` [CLOSED wave-4: renamed to stubContentIsolation, references updated to .rapid-stubs/ directory]`

**Verification:**
```bash
grep -c 'CLOSED wave-4' .planning/sets/scaffold-overhaul/VERIFICATION-REPORT.md
# Expected: 2
```

## What NOT To Do

- Do NOT modify any source code files (stub.cjs, scaffold.cjs, merge.cjs, etc.) -- they already correctly use `.rapid-stubs/`
- Do NOT modify SKILL.md -- it already correctly describes the per-worktree model
- Do NOT modify test files -- they already correctly reference `.rapid-stubs/`
- Do NOT modify role-executor.md -- it already correctly references `.rapid-stubs/`
- Do NOT modify research files or archive files -- those are historical records of the design process
- Do NOT modify GAPS.md -- it is an audit artifact that should remain as-is to show what the gap was
- Do NOT create or delete any git branches -- this is documentation-only work

## Success Criteria

1. `grep -rn 'rapid/stubs' .planning/ROADMAP.md .planning/sets/scaffold-overhaul/CONTEXT.md .planning/sets/scaffold-overhaul/CONTRACT.json .planning/sets/scaffold-overhaul/SET-OVERVIEW.md` returns no output
2. `.gitignore` contains `.rapid-stubs/` entry
3. `VERIFICATION-REPORT.md` contains two `[CLOSED wave-4]` annotations
4. All updated files are valid (JSON files parse without error, Markdown renders correctly)
5. No source code files were modified
