# Stack Research: v2.2 Subagent Merger & Documentation

**Domain:** Claude Code plugin -- merge pipeline restructuring with subagent delegation, documentation rewrite
**Researched:** 2026-03-10
**Confidence:** HIGH (no new npm dependencies; architectural changes only)

## Executive Summary

v2.2 requires NO new npm dependencies. The subagent merge delegation and documentation rewrite are achievable entirely with the existing stack (Node.js >=18, Zod 3.25.76, CommonJS, git) plus prompt engineering changes to the merge skill and new agent role definitions. The critical constraint shaping the entire design is that **Claude Code subagents cannot spawn other subagents** -- this is a hard platform limitation confirmed in official documentation as of March 2026.

This means the v2.2 "adaptive nesting" goal (merge agents spawning per-conflict sub-agents) is **not achievable via nested Agent tool calls**. The architecture must instead use the proven pattern from the review pipeline: the skill SKILL.md acts as the sole orchestrator, dispatching all subagents directly. "Adaptive nesting" is achieved by the skill dispatching additional per-conflict agents when the merger agent's return indicates unresolved complex conflicts -- not by merger agents spawning their own children.

For documentation, no tooling is needed. README.md and technical_documentation.md are plain Markdown files written manually (or by agent) with no build step, no static site generator, and no separate documentation framework. This matches the existing codebase convention (DOCS.md, README.md are hand-maintained Markdown).

---

## Critical Constraint: No Nested Subagent Spawning

**Confidence:** HIGH (verified via official docs + GitHub issue tracker)

Claude Code subagents **cannot** use the Agent tool. The Agent tool is only available to:
1. The main conversation thread (the human's Claude Code session)
2. Skills running in the main thread (SKILL.md files with `allowed-tools: Agent`)

When a subagent (defined in `agents/` directory) is spawned, it receives a subset of tools. The Agent tool is explicitly excluded from subagent tool lists. This is confirmed in:

- [Official Claude Code subagent documentation](https://code.claude.com/docs/en/sub-agents): "Subagents cannot spawn other subagents. If your workflow requires nested delegation, use Skills or chain subagents from the main conversation."
- [GitHub issue #4182](https://github.com/anthropics/claude-code/issues/4182): Closed as duplicate. Confirms Agent tool is not exposed to subagents. The only workaround (`claude -p` via Bash) loses context, observability, and structured returns.
- The existing RAPID codebase already documents this constraint in multiple skills:
  - `skills/review/SKILL.md`: "Subagents CANNOT spawn sub-subagents -- this skill (the orchestrator) is the sole dispatcher."
  - `skills/plan-set/SKILL.md`: "Do NOT attempt sub-sub-agent spawning."
  - `skills/execute/SKILL.md`: Same constraint documented.

**Implication for v2.2 merge delegation:** The merge SKILL.md must remain the sole dispatcher. It spawns per-set merger agents in sequence (within a wave). If a merger agent returns escalations/unresolved conflicts that need further AI resolution, the SKILL.md spawns additional per-conflict agents directly -- the merger never spawns them itself.

This is the same pattern review/SKILL.md uses: skill spawns hunter -> skill spawns advocate -> skill spawns judge. Not: skill spawns orchestrator -> orchestrator spawns hunter.

---

## Existing Stack (Retained As-Is)

| Technology | Version | Purpose | Status for v2.2 |
|------------|---------|---------|-----------------|
| Node.js | >=18 | Runtime | Unchanged |
| Zod | 3.25.76 | Schema validation | Unchanged; may add fields to MergeStateSchema |
| proper-lockfile | 4.1.2 | File locking | Unchanged |
| ajv + ajv-formats | 8.17.1 / 3.0.1 | JSON Schema for contracts | Unchanged |
| git worktrees | (system) | Set isolation | Unchanged |
| CommonJS | (format) | Module system | Unchanged |
| node:test | (built-in) | Test framework | Unchanged |

**Zod version note:** package.json specifies `"zod": "^3.25.76"`. Despite PROJECT.md mentioning 3.24.4, the installed version is 3.25.76 and works correctly with CommonJS require(). Do not downgrade. Do not upgrade to Zod 4.x (breaks CommonJS require).

---

## What's Needed Per Feature

### 1. Subagent Merge Delegation (Orchestrator Stays Lean)

**Stack additions:** None. Architectural change to SKILL.md + new agent role.

**Current state:** The merge SKILL.md (`skills/merge/SKILL.md`) runs the entire pipeline inline -- it calls CLI commands for L1-L4 detection, L1-L2 resolution, then spawns exactly ONE `rapid-merger` agent for L5 semantic detection + T3 resolution. The orchestrator (SKILL.md running in the main thread) holds all merge context for all sets in its context window.

**Problem:** For large codebases with many sets, the orchestrator's context fills up because it accumulates detection reports, context files, and resolution results for every set before the pipeline completes.

**Solution architecture:**

The merge SKILL.md dispatches per-set merge work to `rapid-merger` agents, each handling one set's full pipeline (detect + resolve + semantic analysis). The SKILL.md only holds:
- The merge plan (DAG order, which sets are ready)
- Per-set summaries returned via RAPID:RETURN
- Escalation handling (when merger returns low-confidence conflicts)

This mirrors how `review/SKILL.md` works: the skill dispatches scoper, hunter, advocate, judge, and bugfix agents sequentially, collecting only their RAPID:RETURN summaries rather than holding all file contents.

**What changes:**

| File | Change Type | Description |
|------|-------------|-------------|
| `skills/merge/SKILL.md` | Major rewrite | Restructure to delegate per-set work to merger agents. Skill handles: merge plan loading, DAG ordering, per-set agent dispatch, escalation handling, integration gates, bisection recovery. No longer runs detection/resolution inline. |
| `src/modules/roles/role-merger.md` | Rewrite | Expand scope: merger agent now runs L1-L4 detection + T1-T2 resolution + L5 semantic + T3 AI resolution for its assigned set. Currently only does L5+T3. Remove "Never spawn sub-agents" rule (irrelevant -- subagents cannot spawn anyway). Add CLI command invocations for detection/resolution. |
| `agents/rapid-merger.md` | Regenerated | Auto-generated from role-merger.md by build-agents pipeline. |
| `src/lib/merge.cjs` | Minor extend | Add helper functions for pre-packaging merge context (detection report + set context + contracts) into a compact format the merger agent can receive. May add a `prepareMergerContext()` function. |
| `src/lib/merge.test.cjs` | Extend | Tests for any new helper functions. |

**Agent tool usage in SKILL.md:**

```
# Per-wave processing (sequential within wave, as before)
For each set in wave:
  1. SKILL checks MERGE-STATE.json for idempotent re-entry
  2. SKILL spawns rapid-merger agent with compact context:
     - Set name, base branch, worktree path
     - Set's CONTEXT.md content
     - Other sets' contexts (already merged in this wave)
     - CONTRACT.json content
  3. Merger agent runs internally:
     a. CLI: node "${RAPID_TOOLS}" merge detect {setName}
     b. CLI: node "${RAPID_TOOLS}" merge resolve {setName}
     c. Reads detection results, performs L5 semantic analysis
     d. Writes T3 resolutions to files
     e. Returns RAPID:RETURN with results
  4. SKILL parses RAPID:RETURN
  5. If escalations exist: SKILL handles them (AskUserQuestion)
  6. If additional per-conflict resolution needed: SKILL spawns another agent
  7. SKILL runs programmatic gate and merge execution
```

**Context efficiency gain:** Instead of the SKILL.md holding N sets' worth of detection reports, it holds only the current set's RAPID:RETURN summary (~500 tokens) plus the merge plan. Each merger agent holds one set's context in its own isolated window.

**Why no new library:** All detection and resolution logic already exists in merge.cjs and is exposed via rapid-tools.cjs CLI. The merger agent calls these same CLI commands. No new code paths are needed for the core merge logic -- only the orchestration layer changes.

### 2. Adaptive Nesting (Per-Conflict Sub-Agents)

**Stack additions:** None. New agent role definition only.

**The constraint-respecting design:** Since subagents cannot spawn subagents, "adaptive nesting" means the SKILL.md spawns additional targeted agents when the merger agent's return indicates complex unresolved conflicts.

**How it works:**

1. Merger agent returns RAPID:RETURN with `escalations` array (conflicts below 0.7 confidence)
2. For each escalation, SKILL.md decides whether to:
   a. Present to user (current behavior, always valid)
   b. Spawn a focused `rapid-conflict-resolver` agent with ONLY that conflict's context
3. The conflict-resolver agent gets: the one conflicting file's content from both branches, the diff, the two sets' intents, and the contract. It produces a focused resolution.
4. SKILL.md applies or escalates the result.

**What changes:**

| File | Change Type | Description |
|------|-------------|-------------|
| `src/modules/roles/role-conflict-resolver.md` | New | Focused single-conflict resolution agent. Receives one file, two branch versions, intent context. Returns resolution + confidence. |
| `agents/rapid-conflict-resolver.md` | New (generated) | Built by build-agents from role-conflict-resolver.md |
| `skills/merge/SKILL.md` | Extend (part of rewrite above) | Add Step 4f: for escalations where auto-resolution is feasible, spawn conflict-resolver before escalating to user |

**Why a separate agent instead of re-invoking the merger:** Context efficiency. The merger agent may have consumed significant context analyzing all conflicts for a set. A fresh conflict-resolver agent starts with minimal context (one file, one conflict) and can reason more deeply about that single resolution.

**Why no new library:** The conflict-resolver is a prompt + tool restriction, same as all other RAPID agents. It uses Read, Write, Bash, Grep, Glob -- standard agent tools.

### 3. Parallel Independent Set Merging

**Stack additions:** None. Orchestration change in SKILL.md only.

**Current state:** Sets within a wave merge SEQUENTIALLY. This is because each merge sees the result of the previous one -- if set A and set B both modify shared infrastructure, set B's merge must see set A's changes.

**Opportunity:** When the DAG shows sets in the same wave are truly independent (no shared files, no dependency edges between them), they could merge in parallel.

**Design:**

1. Before starting a wave, analyze which sets in the wave share files or have dependency edges
2. Group sets into parallelizable batches (sets that share zero files and have no edges)
3. Within each batch, spawn merger agents in parallel (multiple Agent tool calls in one response)
4. After each batch, run integration tests before proceeding to next batch

**What changes:**

| File | Change Type | Description |
|------|-------------|-------------|
| `src/lib/merge.cjs` | Extend | Add `partitionParallelMergeable(sets, detectionResults)` function. Checks file overlap + dependency edges to determine which sets can merge simultaneously. |
| `src/lib/merge.test.cjs` | Extend | Tests for partition function |
| `skills/merge/SKILL.md` | Part of rewrite | Step 2 parallelizes where safe |

**Caveat:** Parallel merging within a wave is an optimization, not a requirement. If implementation proves complex (e.g., concurrent git operations on main branch), it can be deferred without blocking the v2.2 milestone. Sequential merging is always safe.

**Why no new library:** File overlap detection is set intersection on arrays already returned by `getChangedFiles()`. DAG edge analysis uses existing `dag.cjs`.

### 4. Documentation Rewrite (README.md + technical_documentation.md)

**Stack additions:** None. Plain Markdown, no tooling.

**Current state:**
- `README.md` -- 50 lines, basic overview, references v2.0 features. Accurate but sparse.
- `DOCS.md` -- 560+ lines, detailed v2.0 documentation. Does not cover v2.1 features (concern-based review, wave orchestration, plan verifier, numeric IDs, batched questioning). Does not cover v2.2 features.

**What changes:**

| File | Change Type | Description |
|------|-------------|-------------|
| `README.md` | Full rewrite | Comprehensive project overview: what RAPID is, installation, quick start, hierarchy diagram, feature list, prerequisites, links to technical docs. Target: 150-250 lines. |
| `technical_documentation.md` | New | Deep technical reference: architecture overview, state machine, CLI reference, agent catalog, skill reference, merge pipeline details, review pipeline details, configuration options, troubleshooting. Target: 800-1200 lines. Replaces DOCS.md as the canonical reference. |
| `DOCS.md` | Deprecate or remove | After technical_documentation.md is complete, DOCS.md becomes redundant. Either remove or add a redirect note. |

**Documentation format:** Plain Markdown. No static site generator (Jekyll, Docusaurus, MkDocs). No API doc generator (JSDoc, TypeDoc). Reasons:
- RAPID is a Claude Code plugin, not a library. Users interact through slash commands, not API imports.
- Plugin docs live in the repo root as Markdown. GitHub renders them natively.
- Adding a build step for docs violates the zero-infrastructure constraint.
- The audience (Claude Code users) reads Markdown in GitHub or their editor.

**Why no documentation tooling:**

| Considered | Why Not |
|-----------|---------|
| Docusaurus / MkDocs | Build step, hosting needed, overkill for plugin docs |
| JSDoc / TypeDoc | RAPID exposes CLI commands, not a JS API. Users never `require('rapid')`. |
| GitHub Wiki | Separate from repo, harder to keep in sync, no PR review process |
| Notion / Confluence | External service, violates zero-infrastructure constraint |

**What IS recommended for documentation quality:**
- Use Markdown heading hierarchy (H1 for title, H2 for sections, H3 for subsections)
- Include a table of contents for technical_documentation.md (manual, using `[section](#anchor)` links)
- Use code blocks with language hints (```bash, ```javascript, ```yaml)
- Include Mermaid diagrams for architecture (GitHub renders Mermaid natively)
- Cross-reference between README.md and technical_documentation.md

---

## Recommended Stack (Complete v2.2 Picture)

### Core Technologies (No Changes)

| Technology | Version | Purpose | v2.2 Impact |
|------------|---------|---------|-------------|
| Node.js | >=18 | Runtime | No change |
| Zod | 3.25.76 | Schema validation | Minor: may add fields to MergeStateSchema for delegation tracking |
| proper-lockfile | 4.1.2 | File locking | No change |
| CommonJS | (format) | Module system | No change |
| git | >=2.30 | VCS + worktrees | No change |
| node:test | (built-in) | Tests | New tests for merge helpers |

### New/Modified Modules

| Module | Type | Purpose | Depends On |
|--------|------|---------|------------|
| `src/modules/roles/role-merger.md` | Agent role (rewrite) | Expanded: runs full L1-L5 detection + T1-T3 resolution per set | merge.cjs CLI commands |
| `src/modules/roles/role-conflict-resolver.md` | Agent role (new) | Single-conflict focused resolution agent | Read/Write/Bash/Grep/Glob |
| `agents/rapid-merger.md` | Subagent (regenerated) | Built from role-merger.md | build-agents pipeline |
| `agents/rapid-conflict-resolver.md` | Subagent (new) | Built from role-conflict-resolver.md | build-agents pipeline |
| `src/lib/merge.cjs` | Library (extend) | Add `prepareMergerContext()`, `partitionParallelMergeable()` | Existing merge.cjs deps |
| `src/lib/merge.test.cjs` | Tests (extend) | Tests for new helpers | node:test |

### Skill Modifications

| Skill | Change Type | Key Change |
|-------|-------------|------------|
| `skills/merge/SKILL.md` | Major rewrite | Delegate per-set work to merger agents; handle escalations + per-conflict agents; parallel batching for independent sets |

### Documentation Files

| File | Change Type | Notes |
|------|-------------|-------|
| `README.md` | Full rewrite | 150-250 lines, covers through v2.2 |
| `technical_documentation.md` | New | 800-1200 lines, comprehensive reference |
| `DOCS.md` | Deprecate | Redirect to technical_documentation.md |

---

## Claude Code Platform Features to Leverage

| Feature | Current Usage | v2.2 Usage |
|---------|--------------|------------|
| Agent tool parallel spawning | Used in review, execute, init, wave-plan | Extended: parallel merger agents for independent sets within a wave |
| Subagent `tools` field | Used across all agents | Conflict-resolver: restricted to Read, Write, Bash, Grep, Glob |
| Subagent `model` field | Scoper uses haiku | Conflict-resolver: inherit (needs full reasoning for resolution) |
| Subagent `permissionMode` | Scoper uses dontAsk | Merger: consider `acceptEdits` since it writes resolved files |
| RAPID:RETURN protocol | All agents | Merger returns structured data with escalations array; conflict-resolver returns resolution + confidence |
| Subagent context isolation | All agents | Key for v2.2: each merger agent gets its own context window, preventing orchestrator overflow |
| Subagent `isolation: worktree` | Not used | NOT applicable for merge -- merger agents must operate on main branch, not isolated worktrees. The merge target is the shared main branch. |

---

## Alternatives Considered

| Recommendation | Alternative | Why Not |
|----------------|-------------|---------|
| SKILL.md as sole dispatcher | Merger agent spawns sub-agents | **Impossible** -- Claude Code subagents cannot spawn other subagents. Hard platform constraint. |
| Separate conflict-resolver agent | Re-invoke merger for single conflicts | Fresh context is more efficient for focused single-conflict resolution |
| Sequential set merging (default) | Always parallel within wave | Parallel merging requires proven file-independence; sequential is always safe as fallback |
| Plain Markdown docs | Docusaurus/MkDocs static site | Zero-infrastructure constraint; plugin users read Markdown in repo |
| Plain Markdown docs | JSDoc/TypeDoc | RAPID exposes CLI + slash commands, not a JS API |
| Extend existing merge.cjs | New merge-delegation.cjs module | Keep merge logic consolidated; only 2-3 new helper functions needed |
| `prepareMergerContext()` in merge.cjs | Inline context preparation in SKILL.md | Reusable function is testable; inline prompts are not |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| New npm dependencies | Every feature uses existing stack | Prompt engineering + orchestration |
| `claude -p` for nested spawning | Loses context, observability, structured returns | SKILL.md dispatches all agents directly |
| Subagent `isolation: worktree` for merger | Merger must operate on main branch for git merge | Standard subagent (no isolation) operating in project root |
| EXPERIMENTAL_AGENT_TEAMS for merge | Agent teams are for independent parallel work, not sequential-within-wave merge | Sequential Agent tool calls from SKILL.md |
| Documentation generators | Adds build step, hosting need, violates zero-infrastructure | Plain Markdown with GitHub rendering |
| Mermaid-to-image build tools | GitHub renders Mermaid natively in Markdown | Inline Mermaid code blocks |

---

## Integration Points

### How the Merger Agent Calls CLI Commands

The merger agent runs as a subagent with `tools: Read, Write, Bash, Grep, Glob`. It invokes merge.cjs functions via the rapid-tools CLI, the same way SKILL.md currently does:

```bash
# Detection (merger agent runs these via Bash tool)
node "${RAPID_TOOLS}" merge detect {setName}
node "${RAPID_TOOLS}" merge resolve {setName}

# State updates
node "${RAPID_TOOLS}" merge update-status {setName} detecting
node "${RAPID_TOOLS}" merge merge-state {setName}

# Context loading
node "${RAPID_TOOLS}" execute prepare-context {setName}
```

The `RAPID_TOOLS` environment variable is available to subagents because it is set in the main shell environment (configured by `/rapid:install`). Subagents inherit the parent's environment.

### How build-agents Generates Agent Files

The existing `build-agents` pipeline assembles agent files in `agents/` from modular components in `src/modules/`. Adding `role-conflict-resolver.md` in `src/modules/roles/` automatically generates `agents/rapid-conflict-resolver.md` via the build pipeline. No changes to the build pipeline are needed.

### MERGE-STATE.json Schema Updates

The existing MergeStateSchema may need minor extensions to track delegation:

```javascript
// Potential additions (evaluate during implementation)
delegatedAt: z.string().optional(),    // When the merger agent was spawned
delegatedTo: z.string().optional(),    // Agent instance identifier
conflictResolvers: z.array(z.object({
  conflictFile: z.string(),
  confidence: z.number(),
  resolved: z.boolean(),
})).optional(),
```

These are minor Zod schema field additions to the existing file. No new modules needed.

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| zod@3.25.76 | Current | Node.js >=18, CommonJS require() | Do not upgrade to Zod 4.x |
| proper-lockfile@4.1.2 | Current | Node.js >=18 | Stable |
| ajv@8.17.1 | Current | ajv-formats@3.0.1 | Used for CONTRACT.json |
| Claude Code subagent API | Current (2026-03) | agents/ dir with YAML frontmatter | Supports: model, permissionMode, tools, hooks, background, isolation, memory, maxTurns, skills |

---

## Installation

No new packages to install. v2.2 is entirely:
- Rewritten SKILL.md for merge (prompt engineering)
- New agent role definition (role-conflict-resolver.md)
- Extended agent role definition (role-merger.md rewrite)
- Minor merge.cjs helper additions (2-3 functions)
- New documentation files (README.md rewrite + technical_documentation.md)

```bash
# Verify existing stack is intact
cd ~/Projects/RAPID
node -e "require('zod'); require('proper-lockfile'); console.log('Stack OK')"

# No npm install needed for v2.2

# After implementation, regenerate agents
node ~/Projects/RAPID/src/bin/rapid-tools.cjs build-agents
```

---

## Sources

### PRIMARY (HIGH confidence)
- [Claude Code Subagent Documentation](https://code.claude.com/docs/en/sub-agents) -- Official docs confirming: subagents cannot spawn other subagents, Agent tool only available to main thread and skills, full frontmatter field reference (name, description, tools, disallowedTools, model, permissionMode, maxTurns, skills, hooks, memory, background, isolation). Verified 2026-03-10.
- [GitHub Issue #4182: Sub-Agent Task Tool Not Exposed](https://github.com/anthropics/claude-code/issues/4182) -- Confirms Agent tool is excluded from subagent tool lists. Closed as duplicate. Workarounds (claude -p via Bash) lose context and observability. Verified 2026-03-10.
- Existing codebase analysis: `skills/merge/SKILL.md`, `skills/review/SKILL.md`, `src/lib/merge.cjs`, `agents/rapid-merger.md`, `src/modules/roles/role-merger.md` -- All read directly. Confirm current merge pipeline architecture and agent spawning patterns. (HIGH confidence)
- `package.json` -- Verified current dependencies: zod@^3.25.76, proper-lockfile@^4.1.2, ajv@^8.17.1, ajv-formats@^3.0.1. (HIGH confidence)

### SECONDARY (MEDIUM confidence)
- [Claude Code Agent Teams Guide](https://claudefa.st/blog/guide/agents/agent-teams) -- Confirms Agent Teams is for independent parallel work, not suitable for sequential merge pipeline. (MEDIUM confidence, community resource)
- [Claude Code Worktree Subagent Isolation](https://www.threads.com/@boris_cherny/post/DVAAnexgRUj) -- Confirms `isolation: worktree` frontmatter field for subagent git worktree isolation. (MEDIUM confidence, official Anthropic staff post)
- v2.1 stack research (`.planning/research/STACK.md` prior version) -- Validated that no new dependencies were needed for v2.1. Same conclusion applies to v2.2. (HIGH confidence, internal)

---
*Stack research for: RAPID v2.2 Subagent Merger & Documentation*
*Researched: 2026-03-10*
