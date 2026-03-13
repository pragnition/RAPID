# Phase 28: Workflow Clarity - Research

**Researched:** 2026-03-09
**Domain:** RAPID plugin workflow UX -- skill chaining, numeric resolution, agent prompts, job granularity
**Confidence:** HIGH

## Summary

Phase 28 is a purely internal modification phase targeting the RAPID plugin's own skill files, role modules, core identity module, and resolve CLI. No external libraries, APIs, or frameworks are involved -- all changes are to RAPID's own Markdown instruction files and one JavaScript module (resolve.cjs + its CLI handler). The phase has four requirements: (1) extend set+wave resolution across all wave-aware skills via a `--set` flag on `resolve wave`, (2) inject canonical workflow order into core-identity.md so all 26 agents inherit it, (3) update job granularity guidance in two role modules, and (4) replace all end-of-skill AskUserQuestion blocks with print-only next-step suggestions.

The codebase is well-understood from direct inspection. All 7 stage skills (init, set-init, discuss, wave-plan, execute, review, merge) currently end with AskUserQuestion blocks that will be replaced with passive next-step output. The resolve.cjs module already has the resolveWave function accepting `(input, state, cwd)` and needs a `--set` flag added to the CLI handler. The core-identity.md module is 24 lines and propagates to all 26 agents via `build-agents`. Two role modules need granularity updates: role-roadmapper.md (lines 154-158) and role-wave-planner.md (new section).

**Primary recommendation:** Execute as four independent work streams (one per requirement) that can be planned in 2-3 plans. The resolve.cjs change (FLOW-01) is the only code change with unit tests; the rest are Markdown-only edits.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Next-step UX (UX-04):** Print-only output at the end of each skill -- no AskUserQuestion. Remove ALL existing end-of-skill AskUserQuestion blocks across all stage skills. Format as labeled block: `Next step: /rapid:wave-plan 1.1\n(Plan wave 1)`. Numeric args only in the command -- no human-readable set/wave names alongside. Alternatives shown only at genuine branching points (e.g., after review: merge vs fix issues). At linear steps (init -> set-init -> discuss -> wave-plan -> execute), show only the canonical next step. Skills resolve numeric indices using the same `plan list-sets` alphabetical index + wave index logic already in the `status` skill.
- **Job granularity (FLOW-03):** Default target: 2-4 jobs per wave. Motivation: context fragmentation -- a single agent working on a larger chunk makes better decisions. Instruction lives in BOTH `role-roadmapper.md` AND `role-wave-planner.md`. Escape hatch: >4 jobs allowed if wave planner explicitly justifies why in the plan. Replaces current "1-3 files modified" guidance in role-roadmapper.md.
- **Set+wave resolution across skills (FLOW-01):** Add `--set` flag to `resolve wave` CLI command in resolve.cjs for single-call two-arg resolution. Extend set+wave resolution pattern to ALL wave-aware skills (not just wave-plan). Claude determines the full list of wave-aware skills during implementation. Existing dot notation (`1.1`) and string wave ID resolution remain unchanged. Two-arg form (`/rapid:wave-plan auth wave-1`) becomes a single `resolve wave wave-1 --set auth` CLI call.
- **Canonical workflow order in agents (FLOW-02):** Add workflow order to `src/modules/core/core-identity.md` so it propagates to all 26 agents via `build-agents`. Canonical sequence: init -> set-init -> discuss -> wave-plan -> execute -> review -> merge. No changes to individual role modules -- workflow order is universal context, belongs in core identity.

### Claude's Discretion
- Exact wording of the workflow order section in core-identity.md
- Which skills qualify as "wave-aware" for FLOW-01 extension
- Whether to add a helper function for next-step formatting or inline it per skill
- How to handle edge cases in next-step suggestions (e.g., last wave in a set, all sets complete)
- Exact phrasing of job granularity guidance in role modules
- Whether `build-agents` needs to be re-run after core-identity.md changes (likely yes)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FLOW-01 | Wave-plan accepts set+wave context (not just wave ID in isolation) | resolve.cjs `--set` flag addition, CLI handler update, wave-aware skill identification |
| FLOW-02 | Agents have clear internal knowledge of the correct workflow order | core-identity.md edit, build-agents rebuild, agent file verification |
| FLOW-03 | Job granularity defaults to coarser sizing (fewer, larger jobs per wave) | role-roadmapper.md lines 154-158 replacement, role-wave-planner.md new section |
| UX-04 | Each skill auto-suggests the next command with pre-filled numeric args on completion | 7 stage skill SKILL.md edits, AskUserQuestion removal, next-step format implementation |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js (node:test) | 18+ | Unit tests for resolve.cjs changes | Already used across all *.test.cjs files |
| resolve.cjs | Internal | Set/wave numeric resolution | Existing module, needs `--set` flag extension |
| rapid-tools.cjs | Internal | CLI entry point for resolve commands | Existing CLI, needs handler update |
| core-identity.md | Internal | Agent identity injected into all 26 agents | Existing module, needs workflow section |
| build-agents (in rapid-tools.cjs) | Internal | Generates 26 agent .md files from modules | Must re-run after core-identity.md changes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| assert (node:assert/strict) | Built-in | Test assertions for resolve.cjs | Unit tests only |
| fs, path, os | Built-in | File system ops in test helpers | Test setup/teardown |

### Alternatives Considered
None -- this phase modifies existing internal modules. No external dependencies needed.

**Installation:**
No new packages required.

## Architecture Patterns

### Recommended Project Structure
No new files created. Changes are to existing files:
```
src/
  lib/
    resolve.cjs              # Add --set flag support to resolveWave
    resolve.test.cjs          # Add tests for --set flag
  bin/
    rapid-tools.cjs           # Update handleResolve for --set flag
  modules/
    core/
      core-identity.md        # Add workflow order section
    roles/
      role-roadmapper.md      # Update job granularity (lines 154-158)
      role-wave-planner.md    # Add job count guidance section
skills/
  init/SKILL.md              # Replace end-of-skill AskUserQuestion with next-step
  set-init/SKILL.md          # Replace end-of-skill AskUserQuestion with next-step
  discuss/SKILL.md           # Replace end-of-skill AskUserQuestion with next-step
  wave-plan/SKILL.md         # Replace end-of-skill AskUserQuestion with next-step
  execute/SKILL.md           # Replace end-of-skill AskUserQuestion with next-step
  review/SKILL.md            # Replace end-of-skill AskUserQuestion with next-step (branching)
  merge/SKILL.md             # Replace end-of-skill AskUserQuestion with next-step
agents/                       # Rebuild all 26 after core-identity.md change
```

### Pattern 1: Next-Step Print Block (UX-04)
**What:** Replace AskUserQuestion at skill end with a deterministic print block
**When to use:** Every stage skill's final step

Current pattern (to be removed):
```markdown
## Step N: Present Next Steps

Use AskUserQuestion:
"What would you like to do next?"
Options:
- "Run /rapid:wave-plan" -- "Start planning"
- "View status" -- "See project state"
```

New pattern:
```markdown
## Step N: Next Step

Display the next command the user should run:

> **Next step:** `/rapid:wave-plan 1.1`
> *(Plan wave 1 of set 1)*
```

**Key implementation details:**
- Compute numeric indices by calling `node "${RAPID_TOOLS}" plan list-sets` and `node "${RAPID_TOOLS}" state get --all` to find the current set index and wave index
- At branching points (review -> merge vs fix), show 2-3 alternatives, each with the full command and description
- At linear steps, show exactly one next step
- The `status` skill (SKILL.md lines 99-109) already has the index conversion logic -- reuse that pattern

### Pattern 2: `--set` Flag Resolution (FLOW-01)
**What:** Allow `resolve wave <waveId> --set <setInput>` to resolve both set and wave in one CLI call
**When to use:** Skills with two-argument invocation (`/rapid:discuss auth wave-1`)

Current pattern in skills (discuss, wave-plan):
```bash
# First resolve the set
RESOLVE_RESULT=$(node "${RAPID_TOOLS}" resolve set "<set-input>" 2>&1)
SET_NAME=$(echo "$RESOLVE_RESULT" | node -e "...")
# Then resolve the wave (somehow using SET_NAME)
```

New pattern:
```bash
# Single call resolves both
RESOLVE_RESULT=$(node "${RAPID_TOOLS}" resolve wave "<wave-input>" --set "<set-input>" 2>&1)
# Returns { setId, waveId, setIndex, waveIndex, wasNumeric }
```

**Implementation in resolve.cjs:**
```javascript
// In resolveWave, add optional setId parameter
function resolveWave(input, state, cwd, setId) {
  // If setId provided, resolve set first, then find wave within that set
  if (setId) {
    const setResult = resolveSet(setId, cwd);
    // Find wave by ID within the resolved set
    const milestone = state.milestones.find(m => m.id === state.currentMilestone);
    const setInState = milestone.sets.find(s => s.id === setResult.resolvedId);
    const waveIdx = setInState.waves.findIndex(w => w.id === input);
    if (waveIdx === -1) {
      throw new Error(`Wave '${input}' not found in set '${setResult.resolvedId}'.`);
    }
    return {
      setId: setResult.resolvedId,
      waveId: input,
      setIndex: setResult.numericIndex,
      waveIndex: waveIdx + 1,
      wasNumeric: false,
    };
  }
  // Existing logic for dot notation and standalone wave IDs
  // ...
}
```

**CLI handler update in rapid-tools.cjs:**
```javascript
case 'wave': {
  if (!input) {
    error('Usage: rapid-tools resolve wave <input> [--set <setInput>]');
    process.exit(1);
  }
  const setIdx = args.indexOf('--set');
  const setInput = (setIdx !== -1 && args[setIdx + 1]) ? args[setIdx + 1] : undefined;
  // ...
  const result = resolveLib.resolveWave(input, stateResult.state, cwd, setInput);
  // ...
}
```

### Pattern 3: Workflow Order in Core Identity (FLOW-02)
**What:** Add a section to core-identity.md describing the canonical workflow sequence
**When to use:** Universal -- all 26 agents inherit this

Recommended addition to core-identity.md (after the "Working Directory" section):
```markdown
## RAPID Workflow

The canonical workflow sequence is:

1. `/rapid:init` -- Project initialization (research, roadmap)
2. `/rapid:set-init` -- Claim a set, create worktree
3. `/rapid:discuss` -- Capture developer vision per wave
4. `/rapid:wave-plan` -- Research + plan jobs for a wave
5. `/rapid:execute` -- Run jobs in parallel
6. `/rapid:review` -- Unit test, bug hunt, UAT
7. `/rapid:merge` -- Merge set branch into main

Steps 3-6 repeat per wave within a set. Steps 2-7 repeat per set within a milestone.
```

### Anti-Patterns to Avoid
- **AskUserQuestion at skill end for routing:** This slows down the workflow. The user reads the suggested command and pastes it when ready -- no interactive gate needed.
- **Hardcoded set/wave names in next-step suggestions:** Always use numeric indices resolved from `plan list-sets` for consistency with the UX-01/UX-02 pattern.
- **Per-role workflow knowledge:** Workflow order belongs in core-identity.md (universal), not in individual role modules (that would require maintaining it in 26 places).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Set/wave index computation for next-step | Custom index lookup | `plan list-sets` + `state get --all` | Already proven in status skill, alphabetical sort is the single source of truth |
| Wave resolution with set context | Separate resolve-set + resolve-wave calls | `resolve wave <id> --set <setId>` | Single atomic call, consistent return format |
| Agent prompt workflow knowledge | Copy-paste in each role module | core-identity.md propagation via build-agents | Single source of truth, 26 agents stay in sync |

**Key insight:** The status skill (lines 99-109) already solved the numeric index display problem. All next-step formatting should follow the same pattern of calling `plan list-sets` for the sorted set list and computing indices from there.

## Common Pitfalls

### Pitfall 1: Missing AskUserQuestion Removal
**What goes wrong:** New next-step blocks are added but old AskUserQuestion blocks at the end of skills are not removed, creating dual prompts.
**Why it happens:** The end-of-skill sections vary per skill -- some say "Present Next Steps", some say "Next Action", some have options embedded in completion messages.
**How to avoid:** For each of the 7 stage skills, search for ALL AskUserQuestion uses and classify each as "mid-flow decision" (keep) vs "end-of-skill routing" (remove). Only remove the final routing ones.
**Warning signs:** AskUserQuestion appearing in the last step of any stage skill after this phase.

### Pitfall 2: Next-Step Context Availability
**What goes wrong:** Skills try to compute the next-step numeric index but don't have access to the resolved set/wave indices.
**Why it happens:** Some skills (like init) don't resolve a set/wave at all -- they work at the project level. The "next step" after init is `/rapid:set-init 1` (first pending set), which requires knowing the set list.
**How to avoid:** Each skill's next-step computation needs to call the appropriate CLI commands to get the data. Init needs `plan list-sets`. Set-init needs the current set index. Discuss/wave-plan need both set and wave indices (they already have these from resolution in earlier steps).
**Warning signs:** Hardcoded numbers instead of dynamically computed ones.

### Pitfall 3: Branching vs Linear Next Steps
**What goes wrong:** All skills show a single next command, but some genuinely need multiple options.
**Why it happens:** The locked decision says "alternatives shown only at genuine branching points."
**How to avoid:** Map out which skills have branching:
- **Linear (one next step):** init -> set-init -> discuss -> wave-plan -> execute
- **Branching (multiple options):** review (merge vs fix issues vs re-review), merge (cleanup vs status vs done)
- **Special cases:** status (already uses AskUserQuestion for action selection -- this is its core function, not end-of-skill routing)
**Warning signs:** Review skill showing only one next step when multiple paths exist.

### Pitfall 4: build-agents Not Re-Run After core-identity.md Change
**What goes wrong:** core-identity.md is updated but the 26 agent files in `agents/` still have the old content.
**Why it happens:** Forgetting that agent files are generated, not hand-edited.
**How to avoid:** Always run `node ~/Projects/RAPID/src/bin/rapid-tools.cjs build-agents` after modifying any module in `src/modules/`. Verify by checking a sample agent file.
**Warning signs:** `agents/rapid-*.md` files missing the workflow section.

### Pitfall 5: --set Flag Breaking Existing Behavior
**What goes wrong:** Adding the `--set` parameter to `resolveWave` breaks the function signature for existing callers.
**Why it happens:** JavaScript doesn't enforce parameter types, but the parameter must be optional with no default.
**How to avoid:** Add `setId` as the 4th parameter (after `cwd`), defaulting to `undefined`. Existing callers pass 3 args and get the same behavior. Tests must cover both with-set and without-set paths.
**Warning signs:** Existing resolve tests failing after the change.

### Pitfall 6: Identifying Wave-Aware Skills
**What goes wrong:** Missing a wave-aware skill, so it doesn't get the `--set` flag support.
**Why it happens:** "Wave-aware" isn't formally defined.
**How to avoid:** A skill is "wave-aware" if it calls `resolve wave` as part of its argument parsing. From code inspection, these are: **discuss**, **wave-plan**, **execute** (resolves set, not wave directly), **review** (resolves both set and wave). Execute resolves sets only. So wave-aware skills for `--set` flag: discuss, wave-plan, review.
**Warning signs:** Skills that accept two-argument invocation not using the new `--set` flag.

## Code Examples

### Current End-of-Skill Pattern (discuss, to be replaced)
```markdown
## Step 8: Commit and Next Steps

Present next steps using AskUserQuestion:

"Wave discussion complete! WAVE-CONTEXT.md written with {N} decisions locked.

What would you like to do next?"

Options:
- "Run /rapid:wave-plan" -- "Start research and planning for wave {waveId}"
- "Discuss another wave" -- "Run /rapid:discuss for a different wave"
- "View /rapid:status" -- "See current project state"
```
Source: `/home/kek/Projects/RAPID/skills/discuss/SKILL.md` lines 346-363

### New End-of-Skill Pattern (discuss, replacement)
```markdown
## Step 8: Commit and Next Step

Commit the WAVE-CONTEXT.md (existing commit logic unchanged).

Then display the next step:

> **Next step:** `/rapid:wave-plan {setIndex}.{waveIndex}`
> *(Plan wave {waveIndex} of {setId})*

Where `setIndex` and `waveIndex` are the numeric indices resolved in Step 2.
```

### resolve.cjs --set Flag Addition
```javascript
// resolve.cjs - resolveWave updated signature
function resolveWave(input, state, cwd, setId) {
  if (setId) {
    const setResult = resolveSet(setId, cwd);
    const sid = setResult.resolvedId;
    const milestone = state.milestones.find(m => m.id === state.currentMilestone);
    if (!milestone) throw new Error(`Current milestone '${state.currentMilestone}' not found.`);
    const setInState = milestone.sets.find(s => s.id === sid);
    if (!setInState) throw new Error(`Set '${sid}' not found in state.`);
    const waves = setInState.waves || [];
    const waveIdx = waves.findIndex(w => w.id === input);
    if (waveIdx === -1) {
      throw new Error(`Wave '${input}' not found in set '${sid}'. Available: ${waves.map(w => w.id).join(', ')}`);
    }
    return {
      setId: sid,
      waveId: input,
      setIndex: setResult.numericIndex,
      waveIndex: waveIdx + 1,
      wasNumeric: false,
    };
  }
  // ... existing logic unchanged
}
```

### rapid-tools.cjs CLI Handler Update
```javascript
case 'wave': {
  if (!input) {
    error('Usage: rapid-tools resolve wave <input> [--set <setInput>]');
    process.exit(1);
  }
  try {
    const sm = require('../lib/state-machine.cjs');
    const stateResult = await sm.readState(cwd);
    if (!stateResult || !stateResult.valid) {
      throw new Error('Cannot read STATE.json.');
    }
    const setIdx = args.indexOf('--set');
    const setInput = (setIdx !== -1 && args[setIdx + 1]) ? args[setIdx + 1] : undefined;
    const result = resolveLib.resolveWave(input, stateResult.state, cwd, setInput);
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (err) {
    process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
    process.exit(1);
  }
  break;
}
```

### core-identity.md Workflow Section
```markdown
## RAPID Workflow

The canonical RAPID workflow sequence is:

1. **init** -- Research and generate project roadmap
2. **set-init** -- Claim a set, create isolated worktree
3. **discuss** -- Capture developer implementation vision per wave
4. **wave-plan** -- Research specifics and plan jobs for a wave
5. **execute** -- Dispatch parallel agents per job
6. **review** -- Unit test, adversarial bug hunt, UAT
7. **merge** -- Merge set branch into main with conflict resolution

Steps 3-6 repeat for each wave within a set. Steps 2-7 repeat for each set in the milestone.
```

### Job Granularity Replacement (role-roadmapper.md)
Current (lines 154-158):
```markdown
### Job Granularity
- Each job should be completable by a single agent in one session
- A job roughly corresponds to a v1.0 "plan" in scope (1-3 files modified, clear inputs/outputs)
- Detailed job plans are NOT created here -- only titles and complexity estimates
- Detailed planning happens in Phase 20 via /discuss and /plan per wave
```

Replacement:
```markdown
### Job Granularity
- Target 2-4 jobs per wave -- fewer, larger jobs reduce context fragmentation
- Each job should be completable by a single agent in one session
- A single agent working on a larger chunk makes better decisions than many agents on tiny pieces
- More than 4 jobs per wave is allowed ONLY if the wave planner explicitly justifies why in the plan
- Detailed job plans are NOT created here -- only titles and complexity estimates
- Detailed planning happens later via /rapid:discuss and /rapid:wave-plan per wave
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AskUserQuestion at every skill end | Print-only next-step suggestion | Phase 28 | Faster workflow, no blocking prompts at linear steps |
| 1-3 files per job granularity | 2-4 jobs per wave target | Phase 28 | Coarser jobs, less context fragmentation |
| Two-call set+wave resolution | Single `resolve wave --set` call | Phase 28 | Simpler skill argument handling |
| No workflow knowledge in agents | Canonical workflow in core identity | Phase 28 | All agents understand the workflow sequence |

**Deprecated/outdated after this phase:**
- End-of-skill AskUserQuestion routing pattern -- replaced with print-only next-step blocks
- "1-3 files modified" job granularity guidance in role-roadmapper.md

## Open Questions

1. **Helper function vs inline next-step logic**
   - What we know: Each skill needs to compute the next command with numeric args. The status skill already has this pattern (lines 99-109). Seven skills need it.
   - What's unclear: Whether a shared helper in a utility module or inline computation per skill is better.
   - Recommendation: Inline per skill -- each skill already has the resolved indices from its argument parsing step. A helper function adds module coupling for a simple string format operation. The next-step format is just `Next step: /rapid:{command} {index}` -- not complex enough to warrant extraction.

2. **Status skill -- keep AskUserQuestion?**
   - What we know: The status skill uses AskUserQuestion to present actionable commands as options. This is its core UX function, not an end-of-skill routing prompt.
   - What's unclear: Whether UX-04 ("each skill auto-suggests the next command") applies to the status skill since its entire purpose is presenting next actions.
   - Recommendation: Leave the status skill's AskUserQuestion intact -- it is a dashboard/action hub, not a stage in the workflow. The locked decision says "remove ALL existing end-of-skill AskUserQuestion blocks across all **stage** skills" -- status is not a stage skill.

3. **Edge case: last wave in a set**
   - What we know: After `wave-plan` for the last wave, the next step is `execute`. After `execute` completes all waves, the next step is `review`.
   - What's unclear: How to phrase the next step when there's no more waves to plan (e.g., "all waves planned, ready to execute").
   - Recommendation: The next-step should be context-aware: if the current wave is the last planned wave, suggest `/rapid:execute {setIndex}` instead of `/rapid:wave-plan {setIndex}.{nextWaveIndex}`.

4. **Wave-aware skills identification for FLOW-01**
   - What we know: Skills that accept wave arguments and call `resolve wave`: discuss, wave-plan. Skills that accept set+wave: review.
   - What's unclear: Execute accepts a set (not wave), so `--set` on resolve wave doesn't apply. But review accepts both set and optional wave.
   - Recommendation: Wave-aware skills for `--set` flag: **discuss**, **wave-plan**, **review**. These three accept two-argument forms with both set and wave identifiers. Execute only resolves sets -- it doesn't need `--set` on `resolve wave`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node.js 18+) |
| Config file | None -- uses node --test directly |
| Quick run command | `node --test src/lib/resolve.test.cjs` |
| Full suite command | `node --test src/lib/*.test.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FLOW-01 | resolveWave with --set flag resolves both set and wave | unit | `node --test src/lib/resolve.test.cjs` | Exists, needs new tests |
| FLOW-01 | resolveWave with --set flag + numeric set input | unit | `node --test src/lib/resolve.test.cjs` | Exists, needs new tests |
| FLOW-01 | resolveWave with --set flag + nonexistent wave throws | unit | `node --test src/lib/resolve.test.cjs` | Exists, needs new tests |
| FLOW-01 | resolveWave without --set still works (backward compat) | unit | `node --test src/lib/resolve.test.cjs` | Exists (current tests cover this) |
| FLOW-02 | core-identity.md contains workflow section | manual-only | Verify file content | N/A |
| FLOW-02 | All 26 agent files contain workflow section after build | manual-only | `grep "RAPID Workflow" agents/rapid-*.md \| wc -l` (should be 26) | N/A |
| FLOW-03 | role-roadmapper.md contains "2-4 jobs per wave" | manual-only | `grep "2-4 jobs" src/modules/roles/role-roadmapper.md` | N/A |
| FLOW-03 | role-wave-planner.md contains job count guidance | manual-only | `grep "2-4 jobs" src/modules/roles/role-wave-planner.md` | N/A |
| UX-04 | Stage skills have "Next step:" block (not AskUserQuestion) at end | manual-only | `grep -L "Next step:" skills/*/SKILL.md` should return empty for stage skills | N/A |

### Sampling Rate
- **Per task commit:** `node --test src/lib/resolve.test.cjs`
- **Per wave merge:** `node --test src/lib/*.test.cjs`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] New test cases in `src/lib/resolve.test.cjs` for `--set` flag (FLOW-01)
  - resolveWave with setId parameter resolves correctly
  - resolveWave with setId + nonexistent wave throws
  - resolveWave with numeric setId resolves correctly
  - resolveWave without setId unchanged (backward compat -- already covered)

## Sources

### Primary (HIGH confidence)
- Direct code inspection of resolve.cjs, resolve.test.cjs, rapid-tools.cjs, core-identity.md
- Direct code inspection of all 7 stage skills: init, set-init, discuss, wave-plan, execute, review, merge
- Direct code inspection of role-roadmapper.md, role-wave-planner.md
- 28-CONTEXT.md user decisions

### Secondary (MEDIUM confidence)
- Pattern from status skill SKILL.md lines 99-109 for numeric index conversion (verified in code)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all internal modules, no external dependencies
- Architecture: HIGH -- patterns directly observed in existing codebase
- Pitfalls: HIGH -- derived from direct code inspection of each file to be modified
- Validation: HIGH -- existing test infrastructure, clear test targets

**Research date:** 2026-03-09
**Valid until:** Indefinite (internal codebase, no external dependency drift)
