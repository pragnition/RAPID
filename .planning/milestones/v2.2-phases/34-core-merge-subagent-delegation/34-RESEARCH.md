# Phase 34: Core Merge Subagent Delegation - Research

**Researched:** 2026-03-10
**Domain:** Claude Code Agent tool delegation, merge pipeline restructuring, structured return protocol
**Confidence:** HIGH

## Summary

Phase 34 restructures the existing `/rapid:merge` SKILL.md to dispatch isolated `rapid-set-merger` subagents per set instead of running detection and resolution inline in the orchestrator's context. The existing Phase 33 infrastructure (`prepareMergerContext`, `parseSetMergerReturn`, `compressResult`, `agentPhase1`) is consumed directly. The main deliverables are: (1) a new `role-set-merger.md` role module and its generated `rapid-set-merger.md` agent, (2) registration of the new agent in the build-agents pipeline (`ROLE_CORE_MAP`, `ROLE_TOOLS`, `ROLE_COLORS`, `ROLE_DESCRIPTIONS`), (3) a restructured SKILL.md that replaces Steps 3-5 with a dispatch step including a fast-path check via `git merge-tree --write-tree`, and (4) a revised Step 8 summary that uses in-memory `compressedResult` data.

The existing `rapid-merger` agent remains unchanged for potential reuse in Phase 35. The new `rapid-set-merger` is an "orchestrator-lite" that absorbs the merger's L5 semantic analysis role instructions and runs L1-L4 detection + T1-T2 resolution via CLI, then performs L5 + T3/T4 inline. It does NOT execute the actual git merge and does NOT handle user-facing escalations -- those are returned to the orchestrator in the RAPID:RETURN data.

**Primary recommendation:** Create the `role-set-merger.md` module by combining the existing `role-merger.md` semantic analysis instructions with explicit CLI dispatch steps for L1-L4 detection and T1-T2 resolution. Register it in `rapid-tools.cjs` build-agents pipeline, then restructure `SKILL.md` to dispatch-and-collect with `git merge-tree` fast path.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Create a NEW `rapid-set-merger` agent (separate from existing `rapid-merger`)
- rapid-set-merger = orchestrator-lite per set: runs L1-L4 detection via CLI, T1-T2 resolution via CLI, L5 semantic detection + T3/T4 resolution INLINE (absorbs rapid-merger's role instructions for semantic analysis)
- Subagent does NOT execute the actual git merge -- orchestrator keeps git merge execution (Step 6)
- Subagent does NOT handle user-facing escalations -- T4 escalations returned to orchestrator in RAPID:RETURN data for user interaction (subagents have no AskUserQuestion capability)
- Subagent runs programmatic gate via CLI before returning results
- Existing rapid-merger agent remains unchanged (potential reuse in Phase 35)
- When a set's subagent returns BLOCKED (or default-to-BLOCKED from malformed output), independent sets in the wave CONTINUE merging unblocked
- Blocked sets surface to user after the wave with recovery options: Retry / Skip / Abort (no "Resolve manually" option)
- CHECKPOINT returns get auto-retried ONCE with checkpoint data -- if second attempt also checkpoints, surface to user
- Max 2 retries per set (BLOCKED or CHECKPOINT) -- after 2 failed attempts, auto-escalate to user with skip/abort options
- Retry counter tracked in orchestrator memory (or MERGE-STATE agentPhase1 transitions)
- Launch briefing via prepareMergerContext (~1000 tokens) is sufficient -- subagent reads full file details from worktree via CLI calls
- After collecting return, orchestrator retains only compressResult (~100 tokens per set) -- full detection/resolution details stay in MERGE-STATE.json
- Full RAPID:RETURN data stored in MERGE-STATE.json only (no separate log file) -- MERGE-STATE is the debugging artifact
- Trust subagent's MERGE-STATE writes -- no cross-verification between RAPID:RETURN and MERGE-STATE. If MERGE-STATE is inconsistent, treat as malformed (BLOCKED via parseSetMergerReturn)
- Replace Steps 3-5 (detect, resolve, programmatic gate) with a single dispatch step per set
- Fast path for zero-conflict sets: run `git merge-tree --write-tree` before dispatching subagent. If merge-tree shows no conflicts, skip subagent entirely and go straight to git merge
- Step 6 (git merge execute) stays in orchestrator
- Step 8 summary uses in-memory compressedResult data instead of re-reading MERGE-STATE per set -- faster and keeps orchestrator lean
- agentPhase1 transitions: idle -> spawned (before dispatch) -> done/failed (after return)

### Claude's Discretion
- rapid-set-merger agent prompt structure and role module design
- How L5 semantic analysis instructions are incorporated into the rapid-set-merger role (inline vs reference)
- Exact SKILL.md step numbering and flow after restructuring
- How checkpoint data is passed on auto-retry (inline vs file reference)
- Whether `git merge-tree` check is a CLI tool command or inline in SKILL.md
- agentPhase1 transition mechanics (CLI call vs direct MERGE-STATE update)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MERGE-01 | Orchestrator delegates per-set merge work to a rapid-set-merger subagent instead of processing inline | New role-set-merger.md role module + agent registration in build-agents pipeline; SKILL.md restructured to use Agent tool dispatch with prepareMergerContext launch briefing |
| MERGE-02 | Orchestrator collects structured RAPID:RETURN results from merge subagents with default-unsafe parsing (missing return = BLOCKED) | parseSetMergerReturn (Phase 33) already implements default-to-BLOCKED; SKILL.md dispatch step parses return and routes to done/failed agentPhase1 transitions |
| MERGE-03 | Subagent failures (BLOCKED, malformed, context-exhausted) surface to user with recovery options without blocking independent sets | Orchestrator loop processes sets sequentially within wave, tracks per-set retry counter, collects blocked sets, presents recovery AskUserQuestion after wave completes for blocked sets only |
</phase_requirements>

## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Claude Code Agent tool | built-in | Spawns subagent instances | The only mechanism for agent delegation in Claude Code; already used by execute, review, plan skills |
| `git merge-tree --write-tree` | Git 2.53+ | Fast-path conflict check without touching worktree/index | Built-in git plumbing; exit code 0 = clean merge, exit code 1 = conflicts; avoids spawning subagent for zero-conflict sets |
| `parseSetMergerReturn()` | merge.cjs (Phase 33) | Default-to-BLOCKED return parsing | Already implemented and tested; wraps returns.cjs parseReturn with merge-specific loose checks |
| `prepareMergerContext()` | merge.cjs (Phase 33) | ~1000-token launch briefing assembly | Already implemented and tested; takes structured data, returns assembled string |
| `compressResult()` | merge.cjs (Phase 33) | ~100-token per-set status compression | Already implemented and tested; extracts L1-L5 conflict counts + T1-T3 resolution counts |
| `AgentPhaseEnum` | merge.cjs (Phase 33) | Zod enum: idle/spawned/done/failed | Already in MergeStateSchema; tracks subagent lifecycle |
| build-agents pipeline | rapid-tools.cjs | Generates agent .md files from role modules + core modules | Established pattern for all 29 existing agents |

### Supporting
| Library/Tool | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `updateMergeState()` | merge.cjs | Partial MERGE-STATE updates | agentPhase1 transitions before/after subagent dispatch |
| `readMergeState()` | merge.cjs | Read current merge state | Idempotent re-entry checks |
| `writeMergeState()` | merge.cjs | Create initial merge state | First-time state creation |
| `mergeSet()` | merge.cjs | Execute actual git merge | Step 6 after subagent returns COMPLETE |
| `runProgrammaticGate()` | merge.cjs | Ownership + contract validation | Called by subagent via CLI, not by orchestrator |
| Zod | package.json | Schema validation | MergeStateSchema already uses Zod |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `git merge-tree --write-tree` | Skip fast path, always spawn subagent | Fast path avoids subagent overhead for the common case (clean merges); merge-tree is safe (no index/worktree changes) |
| New role-set-merger.md | Modify existing role-merger.md | User locked: keep rapid-merger unchanged for Phase 35 reuse |
| In-memory retry counter | MERGE-STATE field | In-memory is simpler; retry counter is ephemeral per pipeline run, not needed for idempotent re-entry |

## Architecture Patterns

### Recommended Project Structure
```
src/
  modules/
    roles/
      role-set-merger.md      # NEW: rapid-set-merger role module
  lib/
    merge.cjs                 # CONSUMED: Phase 33 infrastructure (no changes needed)
  bin/
    rapid-tools.cjs           # MODIFIED: add set-merger to build-agents maps
agents/
  rapid-set-merger.md         # GENERATED: by build-agents from role module
skills/
  merge/
    SKILL.md                  # MODIFIED: replace Steps 3-5 with dispatch + fast path
```

### Pattern 1: Agent Dispatch with Structured Return Collection

**What:** Orchestrator spawns subagent via Agent tool, passes launch briefing, collects RAPID:RETURN, routes based on status.

**When to use:** Every set that has conflicts (non-zero `git merge-tree` exit code).

**Example (from execute skill, adapted for merge):**
```
# In SKILL.md, the dispatch step looks like:

Spawn the **rapid-set-merger** agent with this task:

```
Merge set '{setName}' branch 'rapid/{setName}' into '{baseBranch}'.

## Launch Briefing
{output of prepareMergerContext()}

## Instructions
1. Run L1-L4 detection: `node "${RAPID_TOOLS}" merge detect {setName}`
2. If conflicts found, run T1-T2 resolution: `node "${RAPID_TOOLS}" merge resolve {setName}`
3. If unresolved conflicts remain, perform L5 semantic analysis and T3/T4 resolution inline
4. Run programmatic gate: `node "${RAPID_TOOLS}" merge review {setName}`
5. Return structured RAPID:RETURN with results

## Working Directory
{worktreePath}

## Return Format
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"semantic_conflicts":[...],"resolutions":[...],"escalations":[...],"gate_passed":<boolean>,"all_resolved":<boolean>}} -->
```
```

### Pattern 2: Fast Path via git merge-tree

**What:** Before spawning a subagent, check if the set branch has any conflicts with the current HEAD using `git merge-tree --write-tree`. If exit code is 0, skip subagent entirely.

**When to use:** Every set, before dispatch. This is the common case for well-isolated sets.

**Example:**
```bash
# In the orchestrator SKILL.md:
git merge-tree --write-tree HEAD rapid/{setName}
# Exit code 0 = no conflicts, skip subagent
# Exit code 1 = conflicts exist, dispatch subagent
# Exit code >1 = error, treat as needing subagent
```

**Key detail:** `git merge-tree --write-tree` performs a virtual merge without touching the index or working tree. It's safe to run multiple times. The output (tree OID) is not used -- only the exit code matters for the fast-path decision.

### Pattern 3: agentPhase1 State Machine

**What:** Track subagent lifecycle in MERGE-STATE.json's agentPhase1 field.

**When to use:** Before and after every subagent dispatch.

**State transitions:**
```
idle -> spawned    (before Agent tool call)
spawned -> done    (after COMPLETE return parsed successfully)
spawned -> failed  (after BLOCKED, malformed, or max retries exceeded)
```

**Implementation via CLI:**
```bash
# Before dispatch:
node "${RAPID_TOOLS}" merge update-status {setName} resolving
# This also sets agentPhase1 = 'spawned' (requires adding agentPhase1 update to CLI)
```

**Recommendation:** Use `merge update-status` CLI to handle the agentPhase1 transition alongside status updates. This keeps the SKILL.md instructions simple. Add an optional `--agent-phase` flag to the `update-status` subcommand, OR create a dedicated `merge agent-phase` subcommand.

### Pattern 4: Retry with Checkpoint Data

**What:** When subagent returns CHECKPOINT, auto-retry once with checkpoint data included in the re-dispatch prompt.

**When to use:** CHECKPOINT returns only. Max 1 auto-retry for CHECKPOINT, then surface to user.

**Example:**
```
# Re-dispatch prompt includes checkpoint data:
Merge set '{setName}' branch 'rapid/{setName}' into '{baseBranch}'.

## Checkpoint (continuing from previous attempt)
- Done: {handoff_done}
- Remaining: {handoff_remaining}
- Resume from: {handoff_resume}

## Launch Briefing
{prepareMergerContext output}

## Instructions
...
```

**Recommendation:** Pass checkpoint data inline in the re-dispatch prompt rather than via file reference. The checkpoint data is small (3 string fields: done, remaining, resume) and the subagent context is fresh on retry.

### Pattern 5: Post-Wave Blocked Set Recovery

**What:** After all sets in a wave are processed (dispatched + collected), present blocked sets to user with recovery options.

**When to use:** When any set in the wave ended in `failed` agentPhase1 status.

**Recovery options:** Retry / Skip / Abort (locked decision: no "Resolve manually" option).

### Anti-Patterns to Avoid

- **Never dispatch subagent for zero-conflict sets:** The fast path via `git merge-tree` is critical for performance. Most sets in a well-designed project will be clean merges.

- **Never pass full MERGE-STATE data to orchestrator after collection:** Only retain `compressResult()` output (~100 tokens). The full data lives in MERGE-STATE.json on disk.

- **Never let subagent execute `git merge`:** The subagent does detection, resolution, and gate -- the actual merge is orchestrator-only (Step 6).

- **Never give subagent AskUserQuestion capability:** Subagents cannot interact with the user. All escalations come back in RAPID:RETURN data and the orchestrator presents them.

- **Never cross-verify MERGE-STATE against RAPID:RETURN:** Trust subagent's writes. If inconsistent, parseSetMergerReturn will catch malformed output and default to BLOCKED.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Return parsing | Custom JSON parser for agent output | `parseSetMergerReturn()` from merge.cjs | Handles all edge cases: missing marker, malformed JSON, missing status, invalid field types; defaults to BLOCKED on any failure |
| Launch briefing | Inline string construction in SKILL.md | `prepareMergerContext()` from merge.cjs | Token-budgeted (~1000 tokens), handles file truncation, tested |
| Result compression | Manual extraction of counts | `compressResult()` from merge.cjs | Consistent schema, ~43 tokens per set, tested for 8-set aggregation |
| Agent file generation | Manual creation of rapid-set-merger.md | build-agents pipeline in rapid-tools.cjs | Combines YAML frontmatter + core modules + role module; ensures consistency with all other agents |
| Conflict detection | Re-implementing detection in subagent | CLI calls to `node "${RAPID_TOOLS}" merge detect` | L1-L4 detection already tested and working |
| Resolution cascade | Re-implementing resolution in subagent | CLI calls to `node "${RAPID_TOOLS}" merge resolve` | T1-T2 resolution already tested and working |
| Programmatic gate | Re-implementing gate in subagent | CLI call to `node "${RAPID_TOOLS}" merge review` | Contract + ownership validation already tested |

**Key insight:** Phase 33 already built the exact helper functions needed for delegation. Phase 34 is primarily SKILL.md restructuring + agent registration + role module creation. The library code should need zero or minimal changes.

## Common Pitfalls

### Pitfall 1: Subagent Tries to Execute Git Merge
**What goes wrong:** If the role instructions aren't explicit, the subagent may attempt `git merge` after resolving conflicts.
**Why it happens:** The merger role traditionally includes merge execution in its mental model.
**How to avoid:** The role-set-merger.md MUST have an explicit rule: "Do NOT execute git merge. Do NOT run `node "${RAPID_TOOLS}" merge execute`. Your scope ends at resolution and programmatic gate."
**Warning signs:** Subagent output mentions merge commits or branch switches.

### Pitfall 2: Agent Tool Doesn't Support AskUserQuestion
**What goes wrong:** Subagent needs human input for T4 escalations but cannot ask the user.
**Why it happens:** Claude Code Agent tool creates isolated subagents without AskUserQuestion capability.
**How to avoid:** Subagent returns escalations in RAPID:RETURN data. Orchestrator handles all user-facing interaction.
**Warning signs:** Subagent prompt includes references to "ask the user" or decision gates.

### Pitfall 3: git merge-tree Uses Wrong Refs
**What goes wrong:** Fast-path check gives false positive (clean) when conflicts actually exist.
**Why it happens:** `git merge-tree --write-tree HEAD rapid/{setName}` checks against current HEAD, but HEAD may have changed after previous sets merged in the wave.
**How to avoid:** This is actually CORRECT behavior -- HEAD is updated after each set merges, so merge-tree naturally accounts for sequential wave merging. Just ensure HEAD is the right ref (should be current after Step 6).
**Warning signs:** Sets pass fast-path but fail at actual `git merge` in Step 6.

### Pitfall 4: Forgetting to Update agentPhase1 on Error Paths
**What goes wrong:** MERGE-STATE shows `spawned` but subagent already returned; re-entry logic treats it as in-progress.
**Why it happens:** Error paths (malformed return, exception during parse) skip the agentPhase1 transition.
**How to avoid:** Always set agentPhase1 = 'failed' in catch blocks and error paths. The dispatch step should be: set spawned -> dispatch -> parse return -> set done/failed. No path should leave it as 'spawned'.
**Warning signs:** `merge merge-state {setName}` shows agentPhase1='spawned' but no subagent is running.

### Pitfall 5: Retry Counter Not Resetting Between Pipeline Runs
**What goes wrong:** A set that was retried in a previous (aborted) pipeline run carries retry count into the next run.
**Why it happens:** If retry counter is stored in MERGE-STATE, it persists across runs.
**How to avoid:** Use in-memory retry counter (a simple Map in the orchestrator's SKILL.md flow), not a persisted field. Each `/rapid:merge` invocation starts fresh.
**Warning signs:** User runs `/rapid:merge` again but a set immediately hits max retries.

### Pitfall 6: SKILL.md Prompt Size Inflation
**What goes wrong:** The restructured SKILL.md becomes too large after adding dispatch logic, fast path, retry logic, and recovery flow.
**Why it happens:** Merge pipeline is already 526 lines. Adding dispatch + retry + recovery adds complexity.
**How to avoid:** Keep the dispatch step concise. The subagent prompt template can be a compact block. Recovery options are a simple AskUserQuestion. Retry is a conditional re-dispatch.
**Warning signs:** SKILL.md exceeds 600 lines. Consider extracting reusable patterns.

### Pitfall 7: Subagent Cannot Find RAPID_TOOLS
**What goes wrong:** Subagent spawned via Agent tool doesn't have RAPID_TOOLS environment variable set.
**Why it happens:** Agent tool inherits the skill's environment, but the subagent needs to source the .env file independently.
**How to avoid:** Include the environment preamble in the subagent's task prompt (same pattern as all other skills). The rapid-set-merger role module should instruct the subagent to load env first.
**Warning signs:** Subagent returns BLOCKED with "RAPID_TOOLS is not set".

## Code Examples

### Example 1: role-set-merger.md Structure

Based on established role module patterns (role-merger.md, role-job-executor.md):

```markdown
# Role: Set Merger

You are an orchestrator-lite for a single set in the RAPID merge pipeline.
You run the full detection-resolution-gate pipeline for your assigned set,
then return structured results to the orchestrator.

## Context

You are merging set `{SET_NAME}` (branch `rapid/{SET_NAME}`) into `{BASE_BRANCH}`.

### Launch Briefing
{LAUNCH_BRIEFING}

## Environment Setup

Before running any commands, load the environment:
\`\`\`bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then
  export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs)
fi
\`\`\`

## Pipeline

### Step 1: Detect Conflicts (L1-L4)
\`\`\`bash
node "${RAPID_TOOLS}" merge detect {SET_NAME}
\`\`\`
Parse results. If zero conflicts across all levels, skip to Step 3.

### Step 2: Resolve Conflicts
#### 2a: Run T1-T2 resolution via CLI
\`\`\`bash
node "${RAPID_TOOLS}" merge resolve {SET_NAME}
\`\`\`
If all resolved (unresolvedForAgent = 0), skip to Step 3.

#### 2b: L5 Semantic Detection + T3/T4 Resolution (inline)
[Absorb role-merger.md semantic analysis instructions here]
- Perform intent divergence detection
- Perform contract behavioral mismatch detection
- Write resolutions with confidence scoring
- Escalations (confidence < 0.7) go into RAPID:RETURN data, NOT applied

### Step 3: Programmatic Gate
\`\`\`bash
node "${RAPID_TOOLS}" merge review {SET_NAME}
\`\`\`
Record gate result in return data.

### Step 4: Return Results
\`\`\`
<!-- RAPID:RETURN {"status":"COMPLETE","data":{...}} -->
\`\`\`

## Rules
- Do NOT execute git merge
- Do NOT run `node "${RAPID_TOOLS}" merge execute`
- Do NOT use AskUserQuestion (you cannot interact with the user)
- Do NOT modify files unrelated to conflicts
- Never use `git add -A` or `git add .`
- Never spawn sub-agents
```

### Example 2: Build-Agents Registration

Add to `rapid-tools.cjs` handleBuildAgents():

```javascript
// In ROLE_TOOLS:
'set-merger': 'Read, Write, Edit, Bash, Grep, Glob',

// In ROLE_COLORS:
'set-merger': 'green',

// In ROLE_DESCRIPTIONS:
'set-merger': 'RAPID set merger agent -- runs detection, resolution, and gate for a single set merge',

// In ROLE_CORE_MAP:
'set-merger': ['core-identity.md', 'core-returns.md', 'core-git.md'],
```

**Tools rationale:** Needs Read/Write/Edit for applying T3 resolutions to files in worktree. Needs Bash for CLI commands (detect, resolve, review). Needs Grep/Glob for semantic analysis (reading code). Does NOT need Agent (cannot spawn sub-agents).

**Core modules rationale:** Needs identity (standard agent identity), returns (RAPID:RETURN protocol), git (commit conventions). Does NOT need state-access (subagent uses CLI for state) or context-loading (launch briefing is passed in prompt).

### Example 3: Restructured SKILL.md Dispatch Step

```markdown
## Step 3: Dispatch Per-Set Merge

For each set in the current wave (sequential processing):

### 3a: Check idempotent re-entry
\`\`\`bash
node "${RAPID_TOOLS}" merge merge-state {setName}
\`\`\`
If status='complete', skip. If agentPhase1='done', skip to Step 6.

### 3b: Fast-path check
\`\`\`bash
git merge-tree --write-tree HEAD rapid/{setName}
\`\`\`
- Exit code 0: No conflicts. Skip subagent, go directly to Step 6.
  > [{waveNum}/{totalWaves}] {setName}: clean merge (fast path) -- skipping to merge
- Exit code 1: Conflicts detected. Continue to 3c.
- Exit code >1: Error. Continue to 3c (let subagent diagnose).

### 3c: Update status and dispatch subagent
\`\`\`bash
node "${RAPID_TOOLS}" merge update-status {setName} resolving
\`\`\`

Set agentPhase1 to 'spawned' in MERGE-STATE.

Prepare launch briefing:
\`\`\`bash
# Gather context for prepareMergerContext
node "${RAPID_TOOLS}" merge merge-state {setName}
\`\`\`

Spawn the **rapid-set-merger** agent with this task:
\`\`\`
Merge set '{setName}' branch 'rapid/{setName}' into '{baseBranch}'.
{prepareMergerContext output}
\`\`\`

### 3d: Collect and route return

Parse the agent's output with parseSetMergerReturn() logic:

- **COMPLETE:** Set agentPhase1='done'. Extract data. Store compressedResult
  in memory. Continue to Step 3e.
- **CHECKPOINT (first attempt):** Auto-retry once with checkpoint data.
  Re-dispatch with checkpoint context.
- **CHECKPOINT (second attempt):** Set agentPhase1='failed'.
  Add to blocked-sets list.
- **BLOCKED or malformed:** Set agentPhase1='failed'.
  Add to blocked-sets list.

### 3e: Handle escalations from return data

If return data contains escalations (T4 items):
Present each to user via AskUserQuestion:
- "Accept AI resolution" / "Skip conflict"

### 3f: Proceed to Step 6 (merge execute)
```

### Example 4: git merge-tree Fast Path

```bash
# Check for conflicts without touching index or working tree
# Exit 0 = clean, Exit 1 = conflicts, Exit >1 = error
MERGE_TREE_OUTPUT=$(git merge-tree --write-tree HEAD "rapid/${SET_NAME}" 2>&1)
MERGE_TREE_EXIT=$?

if [ $MERGE_TREE_EXIT -eq 0 ]; then
  echo "Fast path: clean merge for ${SET_NAME}"
  # Skip subagent, proceed directly to git merge
elif [ $MERGE_TREE_EXIT -eq 1 ]; then
  echo "Conflicts detected for ${SET_NAME}, dispatching subagent"
  # Dispatch rapid-set-merger subagent
else
  echo "merge-tree error for ${SET_NAME}, dispatching subagent for diagnosis"
  # Dispatch rapid-set-merger subagent
fi
```

### Example 5: Post-Wave Recovery Flow

```markdown
### After wave completes:

If blocked_sets is not empty:

> **Blocked sets in Wave {waveNum}:**
> {list of blocked sets with reasons}

For each blocked set (up to max retries of 2):

Use AskUserQuestion:
- **question:** "Set '{setName}' blocked: {reason}"
- **options:**
  - "Retry" -- description: "Re-dispatch subagent for {setName} (attempt {N}/2)"
  - "Skip" -- description: "Skip {setName}, continue pipeline"
  - "Abort" -- description: "Exit merge pipeline"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline detection+resolution in SKILL.md | Subagent delegation per set | Phase 34 (now) | Orchestrator context stays lean; detection/resolution detail isolated to subagent |
| Read MERGE-STATE per set at pipeline end | In-memory compressedResult | Phase 33-34 | Faster summary generation; no re-read of per-set files |
| No fast path for clean merges | git merge-tree check before dispatch | Phase 34 (now) | Skip subagent overhead for the common case |
| merger agent for L5+T3/T4 only | set-merger agent for full L1-L5+T1-T4 | Phase 34 (now) | Single subagent handles entire detection-resolution pipeline |

**Unchanged:**
- `rapid-merger.md` agent -- preserved for Phase 35 (MERGE-06: mid-confidence conflict resolver agents)
- `mergeSet()` function -- git merge execution stays in orchestrator
- MERGE-STATE.json schema -- Phase 33 schema is sufficient
- RAPID:RETURN protocol -- parseSetMergerReturn already handles all statuses

## Open Questions

1. **agentPhase1 Update Mechanism**
   - What we know: `update-status` CLI updates the `status` field in MERGE-STATE. agentPhase1 is a separate field.
   - What's unclear: Should `update-status` gain an `--agent-phase` flag, or should a new `merge agent-phase` subcommand be added?
   - Recommendation: Add an optional `--agent-phase` flag to the existing `update-status` subcommand. Simpler than a new subcommand, and keeps the API surface small. Example: `node "${RAPID_TOOLS}" merge update-status {setName} resolving --agent-phase spawned`. The SKILL.md instructions use this combined call.

2. **Environment Variable Access in Subagent**
   - What we know: All existing agents include an env preamble in their task prompts.
   - What's unclear: Does the Agent tool pass RAPID_TOOLS env var to subagents, or must the subagent re-discover it?
   - Recommendation: Include the standard env preamble in the subagent's task prompt. This is the established pattern across all skills. The role module should also reference it.

3. **prepareMergerContext Integration**
   - What we know: `prepareMergerContext()` is a pure function that takes structured data and returns a string.
   - What's unclear: How does the SKILL.md orchestrator call it? It's a library function, not a CLI command.
   - Recommendation: The orchestrator constructs the launch briefing by reading the necessary data via CLI (`merge merge-state`, `merge detect`, file listing) and assembling the prompt inline. Alternatively, add a `merge prepare-context` CLI subcommand that wraps `prepareMergerContext()`. The CLI approach is cleaner and matches the pattern of all other merge subcommands.

4. **Subagent RAPID:RETURN Data Schema**
   - What we know: The existing merger uses `{semantic_conflicts, resolutions, escalations, all_resolved}`.
   - What's unclear: Should the set-merger return the same schema, or extend it with gate results?
   - Recommendation: Extend with `gate_passed` boolean field. The parseSetMergerReturn function does loose field checking (only validates array fields), so adding a boolean field is backward-compatible. The orchestrator can check `gate_passed` to decide whether to proceed to Step 6.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) |
| Config file | None (uses node --test directly) |
| Quick run command | `node --test src/lib/merge.test.cjs` |
| Full suite command | `node --test src/lib/*.test.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MERGE-01 | Orchestrator delegates to rapid-set-merger subagent | integration (manual) | Manual: run `/rapid:merge` and observe subagent spawn in Claude Code UI | N/A manual-only |
| MERGE-01 | role-set-merger.md exists and is well-formed | unit | `node --test src/lib/merge.test.cjs` (add test for role file existence) | Wave 0 |
| MERGE-01 | rapid-set-merger.md generated by build-agents | unit | `node --test src/lib/merge.test.cjs` (add test for agent registration) | Wave 0 |
| MERGE-01 | git merge-tree fast path skips subagent for clean merges | manual-only | Manual: observe "[fast path]" message in merge output | N/A manual-only |
| MERGE-02 | parseSetMergerReturn returns BLOCKED for missing/malformed returns | unit | `node --test src/lib/merge.test.cjs` | Exists (Phase 33) |
| MERGE-02 | COMPLETE return parsed and data extracted | unit | `node --test src/lib/merge.test.cjs` | Exists (Phase 33) |
| MERGE-02 | CHECKPOINT return triggers auto-retry | manual-only | Manual: observe retry behavior | N/A manual-only |
| MERGE-03 | Blocked set does not block independent sets | manual-only | Manual: observe wave continues with remaining sets | N/A manual-only |
| MERGE-03 | Recovery options presented after wave | manual-only | Manual: observe AskUserQuestion prompt | N/A manual-only |
| MERGE-01 | agentPhase1 transitions tracked in MERGE-STATE | unit | `node --test src/lib/merge.test.cjs` | Wave 0 |
| MERGE-01 | prepareMergerContext produces valid launch briefing | unit | `node --test src/lib/merge.test.cjs` | Exists (Phase 33) |
| MERGE-01 | compressResult produces ~100 token output | unit | `node --test src/lib/merge.test.cjs` | Exists (Phase 33) |

### Sampling Rate
- **Per task commit:** `node --test src/lib/merge.test.cjs`
- **Per wave merge:** `node --test src/lib/*.test.cjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/merge.test.cjs` -- add tests for: build-agents registration of set-merger (ROLE_CORE_MAP entry exists), agentPhase1 update via update-status CLI, `merge prepare-context` CLI subcommand (if added)
- [ ] Verify `role-set-merger.md` exists after build-agents run
- [ ] Verify `rapid-set-merger.md` generated with correct tools/color/description

## Sources

### Primary (HIGH confidence)
- `/home/kek/Projects/RAPID/src/lib/merge.cjs` -- Phase 33 infrastructure functions (prepareMergerContext, parseSetMergerReturn, compressResult, AgentPhaseEnum, MergeStateSchema)
- `/home/kek/Projects/RAPID/src/lib/merge.test.cjs` -- Existing tests for Phase 33 functions
- `/home/kek/Projects/RAPID/skills/merge/SKILL.md` -- Current merge pipeline (526 lines, Steps 1-8)
- `/home/kek/Projects/RAPID/src/modules/roles/role-merger.md` -- Existing merger role (L5+T3/T4 instructions to absorb)
- `/home/kek/Projects/RAPID/agents/rapid-merger.md` -- Generated merger agent (286 lines with core modules)
- `/home/kek/Projects/RAPID/src/bin/rapid-tools.cjs` -- Build-agents pipeline (ROLE_CORE_MAP, ROLE_TOOLS, ROLE_COLORS, ROLE_DESCRIPTIONS at lines 459-594)
- `/home/kek/Projects/RAPID/src/lib/returns.cjs` -- RAPID:RETURN protocol (parseReturn, validateReturn, validateHandoff)
- `git merge-tree --help` -- Git 2.53.0 man page; exit code 0 = clean, 1 = conflicts, >1 = error

### Secondary (MEDIUM confidence)
- `/home/kek/Projects/RAPID/skills/execute/SKILL.md` -- Agent dispatch pattern (parallel job execution via Agent tool)
- `/home/kek/Projects/RAPID/skills/review/SKILL.md` -- Agent dispatch pattern (scoper, unit-tester, bug-hunter agents via Agent tool)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All infrastructure already exists in Phase 33; build-agents pipeline is established
- Architecture: HIGH -- Dispatch pattern is well-established in execute/review skills; SKILL.md restructuring is mechanical
- Pitfalls: HIGH -- Based on direct codebase analysis of existing patterns and constraints

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable internal codebase, no external dependencies)
