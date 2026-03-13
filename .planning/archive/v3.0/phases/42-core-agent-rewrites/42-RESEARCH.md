# Phase 42: Core Agent Rewrites - Research

**Researched:** 2026-03-12
**Domain:** Agent prompt authoring, XML-structured Markdown, merge pipeline coupling
**Confidence:** HIGH

## Summary

Phase 42 replaces the TODO placeholder `<role>` sections in 4 core agent stubs (planner, executor, merger, reviewer) with hand-written role instructions, removes the orchestrator agent entirely from all registries and files, and updates `core-identity.md` for the v3 workflow. The stubs already contain identity, conventions, tools, and returns sections -- only the `<role>` section is empty. The orchestrator agent (`agents/rapid-orchestrator.md` and `src/modules/roles/role-orchestrator.md`) must be deleted and scrubbed from 6 registry maps and the SKIP_GENERATION array.

The most critical coupling point is between the merger agent's `<role>` section and the merge pipeline in `src/lib/merge.cjs`. The pipeline calls `parseSetMergerReturn()` which validates the RAPID:RETURN data structure (requiring `semantic_conflicts`, `resolutions`, `escalations` arrays and `all_resolved` boolean). The merger role must produce output in this exact schema. The merger agent (`rapid-merger.md`) is a leaf agent spawned by the merge skill via the `set-merger` agent -- the `rapid-merger` is actually the core version of this concept, and its role content must match the data contract that `merge.cjs` functions `integrateSemanticResults()` and `applyAgentResolutions()` consume.

**Primary recommendation:** Write role sections from the v2 role modules as source material, adapting for v3 (PLAN.md-based flow, no wave/job state, independent sets). For the merger, preserve the exact RAPID:RETURN data schema (`semantic_conflicts`, `resolutions`, `escalations`, `all_resolved`) that `merge.cjs` parses.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Remove orchestrator entirely -- each skill (SKILL.md) is its own orchestrator
- Drop from SKIP_GENERATION (4 core agents, not 5)
- Delete agents/rapid-orchestrator.md and src/modules/roles/role-orchestrator.md
- Remove from all registry maps (ROLE_CORE_MAP, ROLE_TOOLS, ROLE_COLORS, ROLE_DESCRIPTIONS, ROLE_TOOL_MAP)
- Update ROADMAP.md success criteria: "4 hand-written core agents" instead of 5
- Skills remain the sole dispatchers of subagents -- all core agents are leaf agents
- RAPID:RETURN protocol stays -- agents still emit structured returns, skills parse them
- All 4 core agents are GUIDED -- framework + flexibility, no strict scripting
- Planner: guided decomposition framework, adapts approach to project structure
- Executor: guided implementation flow, adapts when plan needs adjustment
- Merger: guided conflict detection/resolution protocol, flexibility in resolution approach
- Reviewer: guided code review with prioritization guidance, decides severity
- No SCRIPTED or AUTONOMOUS agents -- GUIDED is the right balance for all 4
- Raise file size cap from 8KB to 12KB -- stubs already consume 7.5-8.7KB without role content
- Merger/planner: comprehensive roles (complex protocols, ~2-4KB)
- Executor/reviewer: compact roles (simpler tasks, ~1-2KB)
- Behavior description only -- no inline worked examples in role sections
- Update core-identity.md workflow description for v3 in this phase (not deferred)
- v3 workflow: init > start-set > discuss > plan-set > execute-set > review > merge
- Remove wave/job references from identity
- Remove orchestrator references -- skills dispatch directly
- Reflect independent sets (no sync gates)
- Full rewrite for v3 pipeline -- not adapted from v2's 264-line JSON decomposition role
- v3 planner produces PLAN.md per wave (not JSON set proposal)
- Adapt executor for PLAN.md-based execution flow
- Preserve and adapt the proven v2 semantic conflict detection protocol for merger
- Expand reviewer from minimal 27-line checklist to guided review with prioritization

### Claude's Discretion
- Exact content structure within each `<role>` section
- How to compress identity section while keeping essential v3 workflow info
- Edge-case escape hatch design for GUIDED classification
- How to phrase executor's artifact-based completion detection

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AGENT-04 | 4 core agents (planner, executor, merger, reviewer) hand-written and never overwritten by build; orchestrator removed (skills are own orchestrators) | Full coupling analysis of all 6 registry maps, SKIP_GENERATION array, and file dependencies completed. Merger RAPID:RETURN data contract documented. |
</phase_requirements>

## Standard Stack

This phase is pure prompt authoring (Markdown files) and registry editing (JavaScript maps). No new libraries are needed.

### Core
| File | Current Size | Purpose | Role Budget |
|------|-------------|---------|-------------|
| `agents/rapid-planner.md` | 8.7KB stub | Planner agent with TODO role | ~3.3KB for role (12KB cap) |
| `agents/rapid-executor.md` | 8.4KB stub | Executor agent with TODO role | ~3.6KB for role (12KB cap) |
| `agents/rapid-merger.md` | 8.4KB stub | Merger agent with TODO role | ~3.6KB for role (12KB cap) |
| `agents/rapid-reviewer.md` | 7.6KB stub | Reviewer agent with TODO role | ~4.4KB for role (12KB cap) |
| `src/modules/core/core-identity.md` | 3.4KB | Shared identity section | Needs v3 workflow rewrite |
| `src/bin/rapid-tools.cjs` | Large | Registry maps + SKIP_GENERATION | Orchestrator removal |
| `src/lib/tool-docs.cjs` | Medium | ROLE_TOOL_MAP | Orchestrator removal |

### Source Material (v2 Roles to Draw From)
| File | Size | Use |
|------|------|-----|
| `src/modules/roles/role-planner.md` | 11KB (264 lines) | Concepts only -- full rewrite for v3 PLAN.md output |
| `src/modules/roles/role-executor.md` | 2.9KB (69 lines) | Adapt for PLAN.md-based execution |
| `src/modules/roles/role-merger.md` | 7.5KB (127 lines) | Preserve conflict protocol, adapt state refs |
| `src/modules/roles/role-reviewer.md` | 1.8KB (27 lines) | Expand with prioritization guidance |
| `src/modules/roles/role-set-merger.md` | ~7KB (171 lines) | Reference for merger pipeline integration |

## Architecture Patterns

### File Structure (No Changes to Layout)
```
agents/
  rapid-planner.md      # Hand-written (was stub)
  rapid-executor.md     # Hand-written (was stub)
  rapid-merger.md       # Hand-written (was stub)
  rapid-reviewer.md     # Hand-written (was stub)
  rapid-orchestrator.md # DELETED
src/modules/
  core/
    core-identity.md    # UPDATED for v3 workflow
  roles/
    role-orchestrator.md  # DELETED
    role-planner.md       # UNCHANGED (v2 reference only)
    role-executor.md      # UNCHANGED (v2 reference only)
    role-merger.md        # UNCHANGED (v2 reference only)
    role-reviewer.md      # UNCHANGED (v2 reference only)
```

### Pattern: GUIDED Agent with Escape Hatches
**What:** Each agent gets clear behavioral framework with explicit "when to deviate" instructions
**When to use:** All 4 core agents use this pattern

Structure within each `<role>` section:
```markdown
<role>
# Role: [Name]

[1-2 sentence identity/purpose]

## Responsibilities
[Bullet list of what this agent does]

## [Core Process/Protocol]
[Step-by-step framework -- the GUIDED part]

## [Agent-specific sections]
[Domain details]

## Escape Hatches
[When to deviate from the framework -- the flexibility part]

## Constraints
[Hard rules that cannot be broken]
</role>
```

### Pattern: v3 Workflow in Identity
**What:** core-identity.md workflow section updated from v2 7-step to v3 7-step
**Current (v2):**
```
1. init -- Research and generate project roadmap
2. set-init -- Claim a set, create isolated worktree
3. discuss -- Capture developer implementation vision per wave
4. wave-plan -- Research specifics and plan jobs for a wave
5. execute -- Dispatch parallel agents per job
6. review -- Unit test, adversarial bug hunt, UAT
7. merge -- Merge set branch into main with conflict resolution
```
**Target (v3):**
```
1. init -- Research codebase and generate project roadmap
2. start-set -- Create isolated worktree for a set
3. discuss-set -- Capture implementation vision into CONTEXT.md
4. plan-set -- Research and produce PLAN.md per wave
5. execute-set -- Implement tasks from PLAN.md files
6. review -- Code review before merge
7. merge -- Merge set branch into main with conflict resolution
```

### Pattern: Independent Sets Model
**What:** All agents must treat each set as fully independent
**Key changes in identity:**
- Remove "Steps 3-6 repeat for each wave within a set" language
- Remove any ordering/gating language between sets
- Add explicit statement: sets can be started, planned, executed, reviewed, and merged in any order

### Anti-Patterns to Avoid
- **Embedding worked examples in role sections:** Decision says behavior-only, no inline examples (the `<returns>` section already has examples)
- **Referencing wave/job state:** v3 has no wave or job state tracking; use set-level state only
- **Referencing orchestrator:** Skills are dispatchers, not a central orchestrator agent
- **Over-specifying output format in planner role:** v3 planner produces PLAN.md (Markdown), not JSON -- the format is defined by the skill, not the agent
- **Making reviewer spawn subagents:** Reviewer is a leaf agent; the review skill handles subagent dispatch (unit-tester, bug-hunter, etc.)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RAPID:RETURN format | Custom return format per agent | Existing `core-returns.md` template | Already standardized across all 27 agents |
| Tool docs | Manual CLI reference in role | Existing `<tools>` section (already in stubs) | Tool docs are already injected by the build pipeline |
| Conflict detection protocol | New protocol from scratch | v2 merger protocol (role-merger.md + role-set-merger.md) | Battle-tested, and merge.cjs parsing depends on exact schema |

## Common Pitfalls

### Pitfall 1: Breaking the Merger RAPID:RETURN Data Contract
**What goes wrong:** merge.cjs `parseSetMergerReturn()` expects specific fields in the `data` object. If the merger role instructs the agent to produce different fields, the merge pipeline breaks silently.
**Why it happens:** The merger role says "output X" but merge.cjs expects "field Y" -- mismatch between role instructions and parsing code.
**How to avoid:** The merger `<role>` MUST instruct the agent to produce RAPID:RETURN with `data` containing:
  - `semantic_conflicts`: Array of `{description, sets, confidence, file}`
  - `resolutions`: Array of `{file, original_conflict, resolution_summary, confidence, applied}`
  - `escalations`: Array of `{file, conflict_description, reason, confidence, proposed_resolution}`
  - `all_resolved`: Boolean
  - `gate_passed`: Boolean (from set-merger pipeline)
**Warning signs:** `merge.test.cjs` tests for `parseSetMergerReturn` fail; `integrateSemanticResults` or `applyAgentResolutions` receive unexpected data shapes.

### Pitfall 2: Exceeding 12KB File Size Limit
**What goes wrong:** Stubs are already 7.6-8.7KB. Adding a verbose role section pushes past 12KB.
**Why it happens:** v2 role-planner.md alone is 11KB -- directly porting it would exceed the limit.
**How to avoid:** Budget per agent:
  - Planner: ~3.3KB for role (stub is 8.7KB, cap is 12KB)
  - Executor: ~3.6KB for role (stub is 8.4KB)
  - Merger: ~3.6KB for role (stub is 8.4KB)
  - Reviewer: ~4.4KB for role (stub is 7.6KB)
**Warning signs:** `wc -c` on the final file exceeds 12,288 bytes.

### Pitfall 3: Stale v2 References in core-identity.md
**What goes wrong:** core-identity.md is embedded in ALL 27 agents (via build pipeline). Leaving v2 references (wave-plan, set-init, orchestrator) creates confusion in every generated agent too.
**Why it happens:** core-identity.md changes propagate via `build-agents` to all 22 generated agents + the 4 core agents.
**How to avoid:** After editing core-identity.md, run `node ~/Projects/RAPID/src/bin/rapid-tools.cjs build-agents` and verify all 26 agents (was 27, now 26 after orchestrator removal) have the updated workflow text.
**Warning signs:** Generated agents like `rapid-bugfix.md` still reference "set-init" or "wave-plan" or "orchestrator".

### Pitfall 4: Test Assertions Hardcoded to 27 Roles / 5 Core Agents
**What goes wrong:** `build-agents.test.cjs` has `ALL_27_ROLES` array including 'orchestrator' and `CORE_AGENTS` array with 5 entries. Removing orchestrator without updating these breaks tests.
**Why it happens:** Tests enumerate expected agents explicitly.
**How to avoid:** Update:
  - `ALL_27_ROLES`: Remove 'orchestrator', becomes 26 roles
  - `CORE_AGENTS`: Remove 'orchestrator', becomes `['planner', 'executor', 'merger', 'reviewer']`
  - Assertion "generates exactly 27 .md files" -> 26
  - Assertion "Built 22 agents (5 core skipped)" -> "Built 22 agents (4 core skipped)"
  - `EXPECTED_ROLE_CORE_MAP`: Remove 'orchestrator' entry
  - The orchestrator stub test checking for "Phase 42 TODO" must be removed
**Warning signs:** `node --test src/lib/build-agents.test.cjs` fails immediately.

### Pitfall 5: STUB Comment Left in Hand-Written Files
**What goes wrong:** The files currently start with `<!-- STUB: Core agent -- role section is hand-written in Phase 42 -->`. After hand-writing the role, this comment is misleading.
**Why it happens:** Forgetting to update the file header after writing the role content.
**How to avoid:** Replace the STUB comment with a CORE comment, e.g., `<!-- CORE: Hand-written agent -- do not overwrite with build-agents -->`. The test in `build-agents.test.cjs` line 98 checks for `<!-- STUB: Core agent` so this must be updated.
**Warning signs:** Confusing developer experience; test assertions about STUB comment.

### Pitfall 6: Merger vs Set-Merger Role Confusion
**What goes wrong:** There are TWO merger-related agents: `rapid-merger.md` (core, SKIP_GENERATION) and `rapid-set-merger.md` (generated). Their roles are different.
**Why it happens:** The `rapid-merger` is the "core" merger concept for v3 direct skill dispatch. The `rapid-set-merger` is the v2 orchestrator-delegated merger that runs the full detect/resolve/gate pipeline. In v3, the skill dispatches whichever agent is appropriate.
**How to avoid:** The rapid-merger role should contain the semantic conflict detection and resolution protocol (L5/T3 focus). The set-merger role is a generated agent with its own role in `role-set-merger.md` (not touched in this phase). The key difference: rapid-merger is spawned for conflict detection/resolution only, while set-merger runs the full pipeline (detect, resolve, gate). Both produce the same RAPID:RETURN data schema.
**Warning signs:** Duplicating the set-merger's full pipeline instructions into rapid-merger.

## Code Examples

### Current Stub Structure (what exists)
```markdown
<!-- STUB: Core agent -- role section is hand-written in Phase 42 -->
---
name: rapid-merger
description: RAPID merger agent -- ...
tools: Read, Write, Bash, Grep, Glob
model: inherit
color: green
---

<identity>
[core-identity.md content]
</identity>

<conventions>
[core-conventions.md content]
</conventions>

<tools>
[tool-docs for merger role]
</tools>

<role>
<!-- TODO: Phase 42 -- hand-write merger role instructions -->
</role>

<returns>
[core-returns.md content]
</returns>
```

### Target: Role Section for Merger (conceptual structure)
```markdown
<role>
# Role: Merger

[1 sentence purpose: semantic conflict detection + resolution for merge pipeline]

## Responsibilities
- Detect Level 5 semantic conflicts (intent divergence, behavioral mismatches)
- Resolve conflicts with confidence scoring
- Escalate low-confidence resolutions for human review

## Semantic Conflict Detection Protocol
[Intent divergence detection guidance]
[Contract behavioral mismatch detection guidance]

## Confidence Scoring
[0.5-1.0 bands with criteria]

## Resolution Process
[How to resolve, when to apply vs escalate]

## Escalation Rules
[Below 0.7 threshold, API changes always escalate]

## Escape Hatches
[When to deviate: novel conflict patterns, ambiguous contracts]

## Constraints
[No git merge, no commit, no subagents, specific file scope]
</role>
```

### Merger RAPID:RETURN Data Schema (MUST match merge.cjs expectations)
```json
{
  "status": "COMPLETE",
  "data": {
    "semantic_conflicts": [
      {
        "description": "string",
        "sets": ["setA", "setB"],
        "confidence": 0.85,
        "file": "path/to/file"
      }
    ],
    "resolutions": [
      {
        "file": "path/to/file",
        "original_conflict": "string",
        "resolution_summary": "string",
        "confidence": 0.9,
        "applied": true
      }
    ],
    "escalations": [
      {
        "file": "path/to/file",
        "conflict_description": "string",
        "reason": "string",
        "confidence": 0.4,
        "proposed_resolution": "string"
      }
    ],
    "all_resolved": true
  }
}
```

### Registry Entries to Remove (orchestrator)
```javascript
// In rapid-tools.cjs -- remove orchestrator from ALL of these:
ROLE_TOOLS.orchestrator        // line ~466
ROLE_COLORS.orchestrator       // line ~496
ROLE_DESCRIPTIONS.orchestrator // line ~532
ROLE_CORE_MAP.orchestrator     // line ~567
SKIP_GENERATION                // line ~707: remove 'orchestrator' from array

// In tool-docs.cjs -- remove orchestrator from:
ROLE_TOOL_MAP.orchestrator     // line ~113
```

### core-identity.md v3 Workflow Update
```markdown
## RAPID Workflow

The canonical RAPID workflow sequence is:

1. **init** -- Research codebase and generate project roadmap
2. **start-set** -- Create isolated worktree for a set
3. **discuss-set** -- Capture implementation vision into CONTEXT.md
4. **plan-set** -- Research and produce PLAN.md per wave
5. **execute-set** -- Implement tasks from PLAN.md files
6. **review** -- Code review before merge
7. **merge** -- Merge set branch into main with conflict resolution

Steps 2-7 repeat for each set in the milestone. Sets are independent -- they can be started, planned, executed, and merged in any order.
```

## Coupling Points Analysis

### Merger Agent <-> merge.cjs Coupling

This is the most critical coupling in Phase 42. The merge pipeline (`src/lib/merge.cjs`) depends on the merger agent's output format:

| Function | What It Parses | Required Fields | Source Line |
|----------|---------------|-----------------|-------------|
| `parseSetMergerReturn()` | Full RAPID:RETURN | `status`, `data.semantic_conflicts` (array), `data.resolutions` (array), `data.escalations` (array) | merge.cjs:239-267 |
| `integrateSemanticResults()` | `data.semantic_conflicts` | `description`, `sets`, `confidence` per entry | merge.cjs:1844-1862 |
| `applyAgentResolutions()` | `data.resolutions` | `conflict`, `confidence` per entry | merge.cjs:1873-1910 |
| `compressResult()` | merge state (downstream) | `detection.semantic.conflicts.length` | merge.cjs:205-227 |

**Contract:** The merger's RAPID:RETURN `data` object MUST contain `semantic_conflicts`, `resolutions`, and `escalations` as arrays (or omit them -- undefined is OK, non-array is not). The `all_resolved` boolean is informational.

### Reviewer Agent <-> merge.cjs Coupling

The merge pipeline's `assembleReviewerPrompt()` function (merge.cjs:1307-1359) builds context for the reviewer agent. The reviewer's output is expected to contain:
- `<!-- VERDICT:{verdict} -->` marker in REVIEW.md
- Findings categorized as Blocking, Fixable, or Suggestions

This is a lighter coupling -- the reviewer's role section just needs to produce output in REVIEW.md format with a verdict marker. The exact format is defined in the review prompt, not in the reviewer's role.

### Planner Agent <-> Future Skills Coupling

The planner's output format will be consumed by `/plan-set` skill (Phase 43). The planner produces PLAN.md files. Since Phase 43 hasn't been written yet, the planner role should be flexible about output format and focus on the decomposition thinking process rather than rigid output templates.

### Executor Agent <-> Future Skills Coupling

Similarly, the executor will be driven by `/execute-set` skill (Phase 44). The executor reads PLAN.md and implements tasks. Since Phase 44 hasn't been written yet, the executor role should focus on the execution discipline (atomic commits, boundary respect, verification) rather than specific PLAN.md parsing instructions.

### core-identity.md <-> ALL Agents

Changes to core-identity.md propagate to all 26 agents (22 generated + 4 core). The `build-agents` command must be run after editing. The core stubs inline the identity content, so they must be regenerated or manually updated.

**IMPORTANT:** The 4 core agents have identity content INLINED (not injected at build time for the hand-written sections). This means editing core-identity.md requires ALSO editing the `<identity>` section in all 4 core agent files, OR restructuring how core agents incorporate identity. Currently, `assembleStubPrompt()` reads `core-identity.md` and embeds it. After Phase 42, the core agents are hand-written and the build pipeline only touches generated agents. So the identity update in core-identity.md must be manually mirrored into the 4 core agent files.

### Build Pipeline Impact

After removing orchestrator from SKIP_GENERATION (now 4 entries) and ROLE_CORE_MAP (now 26 entries):
- `build-agents` produces 22 generated + 4 stubs = 26 total (was 27)
- The deleted `rapid-orchestrator.md` file must not exist in `agents/`
- The build output message changes from "Built 22 agents (5 core skipped)" to "Built 22 agents (4 core skipped)"

## State of the Art

| Old Approach (v2) | Current Approach (v3) | Impact |
|--------------------|-----------------------|--------|
| Orchestrator agent coordinates all workflow | Skills are their own orchestrators | Remove orchestrator agent entirely |
| Planner produces JSON set proposals | Planner produces PLAN.md per wave | Full rewrite of planner role |
| Wave/job state tracking | Set-level state only | Remove wave/job refs from all agents |
| 7-step workflow with wave-plan | 7-step workflow with plan-set | Update core-identity.md |
| Build generates stubs with TODO | Hand-written role sections | Stubs become final agents |
| 5 core agents (including orchestrator) | 4 core agents | All registry counts change |

## Open Questions

1. **Core agent identity update mechanism**
   - What we know: `assembleStubPrompt()` reads core-identity.md and embeds it in stubs. After Phase 42, these are no longer stubs but final hand-written files.
   - What's unclear: Should the build pipeline continue to regenerate core agents (updating identity but preserving hand-written role)? Or should core agents be fully manual?
   - Recommendation: Since SKIP_GENERATION currently generates stubs, and Phase 42 replaces stub content with hand-written content, the build pipeline should NOT regenerate core agents after this phase. The `STUB_COMMENT` check in tests should become `CORE_COMMENT` or similar. Core agents become fully manual files. When core-identity.md changes, all 4 core agent files must be updated manually. This is acceptable because identity changes are rare.

2. **Should v2 role modules be deleted?**
   - What we know: The v2 role modules in `src/modules/roles/` (role-planner.md, role-executor.md, role-merger.md, role-reviewer.md) are source material but no longer referenced by the build pipeline (core agents are in SKIP_GENERATION).
   - What's unclear: Whether to keep them as reference or delete them.
   - Recommendation: Keep them. They are used by generated agents (set-merger uses role-set-merger.md, not role-merger.md). The original 4 role files could be useful reference and their removal is cleanup (Phase 45 DOC-02 scope). Actually, checking the build pipeline: generated agents use `role-{name}.md` -- but the 4 core agents are skipped. So `role-planner.md`, `role-executor.md`, `role-merger.md`, `role-reviewer.md` are NOT used by any generated agent. They are dead code. However, cleanup is Phase 45 scope. Leave them.

3. **How should the STUB comment change?**
   - What we know: Tests check for `<!-- STUB: Core agent` prefix. After hand-writing, "STUB" is misleading.
   - Recommendation: Change to `<!-- CORE: Hand-written agent -- do not overwrite with build-agents -->` and update the test assertion accordingly.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node:test`) |
| Config file | None -- tests run directly |
| Quick run command | `node --test src/lib/build-agents.test.cjs` |
| Full suite command | `node --test src/lib/build-agents.test.cjs src/lib/merge.test.cjs src/lib/tool-docs.test.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGENT-04a | 4 core agents have hand-written role sections (not TODO placeholder) | unit | `node --test src/lib/build-agents.test.cjs` | Exists (needs update) |
| AGENT-04b | Each agent under 12KB | unit | `node --test src/lib/build-agents.test.cjs` | Exists (size limit test at line 296) |
| AGENT-04c | Orchestrator removed from all registries | unit | `node --test src/lib/build-agents.test.cjs src/lib/tool-docs.test.cjs` | Exists (needs update) |
| AGENT-04d | Merger RAPID:RETURN contract preserved | unit | `node --test src/lib/merge.test.cjs` | Exists (parseSetMergerReturn tests) |
| AGENT-04e | core-identity.md has v3 workflow | unit | `node --test src/lib/build-agents.test.cjs` | Needs new test |
| AGENT-04f | Build produces 26 agents (not 27) | unit | `node --test src/lib/build-agents.test.cjs` | Exists (needs count update) |

### Sampling Rate
- **Per task commit:** `node --test src/lib/build-agents.test.cjs`
- **Per wave merge:** `node --test src/lib/build-agents.test.cjs src/lib/merge.test.cjs src/lib/tool-docs.test.cjs`
- **Phase gate:** Full test suite green before verification

### Wave 0 Gaps
- [ ] Update `build-agents.test.cjs` assertions: 27 -> 26 roles, 5 -> 4 core agents, remove orchestrator from ALL_27_ROLES and EXPECTED_ROLE_CORE_MAP
- [ ] Update `build-agents.test.cjs` STUB comment assertion to expect new CORE comment
- [ ] Update `build-agents.test.cjs` "Phase 42 TODO" assertion to verify role content exists (not TODO)
- [ ] Add assertion that core-identity.md contains v3 workflow terms (plan-set, execute-set, start-set)
- [ ] Update `tool-docs.test.cjs` expected roles to exclude orchestrator (line 62)
- [ ] Update `build-agents.test.cjs` size limit: adjust KNOWN_OVERSIZED if merger/planner exceed 15KB (they might with full role content -- current stub merger is 8.4KB + up to 3.6KB role = 12KB which is under 15KB)

## Sources

### Primary (HIGH confidence)
- Direct file reads of all 4 core agent stubs (agents/rapid-*.md)
- Direct file reads of all 4 v2 role modules (src/modules/roles/role-*.md)
- Direct file reads of merge.cjs coupling functions (parseSetMergerReturn, integrateSemanticResults, applyAgentResolutions)
- Direct file reads of build-agents.test.cjs (test assertions that must change)
- Direct file reads of rapid-tools.cjs (all 6 registry maps)
- Direct file reads of tool-docs.cjs (ROLE_TOOL_MAP)
- Direct file reads of PROMPT-SCHEMA.md (XML tag rules)
- Direct file reads of core-identity.md (current workflow text)

### Secondary (MEDIUM confidence)
- N/A -- all findings come from direct codebase inspection

### Tertiary (LOW confidence)
- N/A

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all files examined directly, no external dependencies
- Architecture: HIGH -- XML schema documented in PROMPT-SCHEMA.md, stub structure verified
- Pitfalls: HIGH -- all coupling points enumerated from code, test assertions counted
- Merger contract: HIGH -- parseSetMergerReturn source code and test cases read directly

**Research date:** 2026-03-12
**Valid until:** Indefinite (this is internal project structure, not external dependency)
