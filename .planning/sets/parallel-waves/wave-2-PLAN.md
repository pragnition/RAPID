# Wave 2 PLAN: Execute-Set Skill Rewrite for Parallel Wave Dispatch

## Objective

Rewrite the execute-set skill prompt (`skills/execute-set/SKILL.md`) to support parallel wave dispatch. The current implementation executes waves strictly sequentially. This wave modifies Step 4 to analyze wave dependencies using a DAG, group independent waves into parallel batches, and dispatch all waves within a batch concurrently using Claude Code's native parallel tool calls. Dependent waves still execute sequentially (the degenerate case for linear DAGs). Git operations are serialized by having the orchestrator (not the executors) perform all commits.

**Depends on:** Wave 1 (schemas, transitions, and state-machine exports must be in place for transitionWave/transitionJob references).

## Files Modified

| File | Action |
|------|--------|
| `skills/execute-set/SKILL.md` | Rewrite Step 4, update Key Principles, update Anti-Patterns |

## Tasks

### Task 1: Rewrite Step 4 for Parallel Wave Dispatch

**File:** `skills/execute-set/SKILL.md`

Replace the current Step 4 ("Execute Waves Sequentially") with a parallel-aware execution strategy. The new Step 4 has three sub-phases:

**Step 4 header change:** Rename from "Execute Waves Sequentially" to "Execute Waves"

**4a: Analyze Wave Dependencies (NEW)**

Add a new sub-step before wave dispatch. The orchestrator must determine which waves can run in parallel:

```markdown
### 4a: Analyze Wave Dependencies

Build a wave dependency graph from the plan files. For each wave-N-PLAN.md, check if it declares dependencies on other waves (e.g., "Depends on: Wave 1" or wave dependency edges in a DAG file).

**Default behavior:** If no explicit inter-wave dependencies are declared, treat all waves as independent (single parallel batch containing all waves). This is safe because wave plans produced by the planner already encode dependency through file ownership -- Wave 2 builds on Wave 1's outputs.

**If dependencies exist:** Group waves into parallel batches using BFS level assignment:
- Batch 1: Waves with no dependencies (level 0)
- Batch 2: Waves depending only on Batch 1 waves (level 1)
- etc.

Display the execution plan:
```
Wave execution plan:
  Batch 1 (parallel): Wave 1, Wave 3
  Batch 2 (parallel): Wave 2, Wave 4
  Batch 3 (sequential): Wave 5
```

For most sets, waves have linear dependencies (Wave 2 depends on Wave 1, etc.), which produces one wave per batch -- effectively sequential execution. This is the expected degenerate case.
```

**4b: Execute Batches (REWRITTEN)**

Replace the current sequential loop with batch-based execution:

```markdown
### 4b: Execute Wave Batches

For each batch in order:

**If batch contains a single wave:** Execute it exactly as the current Step 4b (spawn one rapid-executor agent).

**If batch contains multiple waves:** Spawn all rapid-executor agents in the batch simultaneously using parallel tool calls. Each agent receives its own wave's PLAN.md content.

CRITICAL: Executors in parallel batches must NOT commit to git. Instead, they make file changes and report what they changed in their RAPID:RETURN. The orchestrator commits sequentially after all executors in a batch complete.

For each parallel executor, use this task prompt:

```
Implement wave {N} for set '{SET_ID}'.

## Your PLAN
{Full content of wave-{N}-PLAN.md}

## Commit Convention
DO NOT run git commit. Make your file changes only.
The orchestrator will commit your changes after verification.
Report all modified files in your RAPID:RETURN artifacts list.

## Working Directory
{worktreePath}
```
```

**4c: Process Batch Results and Commit (REWRITTEN)**

After all executors in a batch complete:

```markdown
### 4c: Process Batch Results

After all executors in a batch return:

1. **Collect results:** Parse RAPID:RETURN from each executor.

2. **Handle failures:** If ANY executor in the batch returned BLOCKED or had errors:
   - Completed waves in the batch are still committed (their work is not lost)
   - Failed waves are reported with their blocker
   - Execution stops after committing successful waves

3. **Sequential commit:** For each COMPLETE executor in the batch, IN ORDER:
   a. Stage the executor's modified files: `git -C {worktreePath} add {file1} {file2} ...`
   b. Commit: `git -C {worktreePath} commit -m "feat({SET_ID}): implement wave {N}"`
   c. Write WAVE-{N}-COMPLETE.md marker (same format as current)
   d. Optionally transition wave state: call `node "${RAPID_TOOLS}" state transition wave "${MILESTONE}" "${SET_ID}" "wave-{N}" executing` then `complete`

4. **Continue:** Move to the next batch.

This sequential commit approach prevents git index corruption. Even though waves executed in parallel, their commits are serialized through the orchestrator.
```

**What NOT to do:**
- Do NOT remove Steps 0-3 or Steps 5-6 -- they remain unchanged
- Do NOT change the WAVE-COMPLETE.md marker format
- Do NOT add any new CLI commands or Node.js modules
- Do NOT change the rapid-executor agent's identity -- only change what task prompt it receives
- Do NOT require DAG.json files to exist -- the default (no edges = all parallel) must work

---

### Task 2: Update Anti-Patterns Section

**File:** `skills/execute-set/SKILL.md`

In the "Anti-Patterns" section, update these items:

1. **Remove:** `Do NOT use per-wave or per-job state transitions -- v3 has set-level state only`
   (Wave/job transitions are now supported via transitionWave/transitionJob)

2. **Add:** `Do NOT let parallel executors run git commit -- only the orchestrator commits`

3. **Add:** `Do NOT dispatch dependent waves in the same parallel batch -- respect DAG ordering`

4. **Keep all other anti-patterns unchanged.**

---

### Task 3: Update Key Principles Section

**File:** `skills/execute-set/SKILL.md`

Update the Key Principles section:

1. **Change:** "One executor per wave, sequential waves." becomes:
   "One executor per wave, parallel-where-possible. Independent waves within a batch execute concurrently. Dependent waves execute in sequential batches."

2. **Change:** "Set-level state only. Two state transitions..." becomes:
   "Set and wave-level state. Set transitions: `planned -> executed` (at start) and `executed -> complete` (after all waves + verification). Wave transitions: `pending -> executing -> complete` tracked per-wave."

3. **Add new principle:** "Git serialization. Parallel executors do not commit. The orchestrator commits each wave's changes sequentially after batch completion, preventing git index corruption."

4. **Keep all other principles unchanged.**

---

### Task 4: Update Description Header

**File:** `skills/execute-set/SKILL.md`

Update the frontmatter description and opening paragraph:

1. Change description from:
   `description: Execute all waves in a set -- one executor per wave, sequential, artifact-based re-entry`
   to:
   `description: Execute all waves in a set -- parallel dispatch for independent waves, sequential commits, artifact-based re-entry`

2. Update the opening paragraph from:
   "This skill executes all waves in a set sequentially."
   to:
   "This skill executes all waves in a set, dispatching independent waves in parallel where possible. Dependent waves execute in sequential batches. Git commit operations are serialized through the orchestrator to prevent index corruption."

---

## Verification

Since this is a skill prompt file (Markdown), there are no automated tests to run. Verification is structural:

```bash
# Verify the file exists and has the expected sections
grep -c "Execute Wave Batches" skills/execute-set/SKILL.md
# Expected: 1

grep -c "Analyze Wave Dependencies" skills/execute-set/SKILL.md
# Expected: 1

grep -c "Process Batch Results" skills/execute-set/SKILL.md
# Expected: 1

# Verify anti-pattern update
grep -c "parallel executors run git commit" skills/execute-set/SKILL.md
# Expected: 1

# Verify old sequential-only language is removed
grep -c "Execute Waves Sequentially" skills/execute-set/SKILL.md
# Expected: 0

# Verify key principle update
grep -c "parallel-where-possible" skills/execute-set/SKILL.md
# Expected: 1

grep -c "Git serialization" skills/execute-set/SKILL.md
# Expected: 1
```

## Success Criteria

1. Step 4 supports parallel dispatch of independent waves within a batch
2. Step 4 falls back to sequential execution naturally when waves have linear dependencies
3. Executors in parallel batches do NOT commit -- orchestrator commits sequentially
4. Anti-patterns section updated to reflect wave-level transitions and git serialization
5. Key principles section reflects parallel dispatch, wave-level state, and git serialization
6. Steps 0-3, 5-6 remain unchanged (only Step 4, anti-patterns, key principles, and description modified)
7. No new files created -- changes are entirely within `skills/execute-set/SKILL.md`
8. Default behavior (no DAG edges) treats all waves as independent -- backward compatible
