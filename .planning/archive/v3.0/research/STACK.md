# Stack Research: v3.0 Refresh

**Domain:** Claude Code plugin -- orchestration layer rewrite with inline tool docs, XML prompt templates, hybrid agent build
**Researched:** 2026-03-12
**Confidence:** HIGH (no new npm dependencies; architectural + build pipeline changes only)

## Executive Summary

v3.0 requires ZERO new npm dependencies. The three headline features -- inline YAML tool documentation, XML-formatted prompt templates, and a hybrid agent build pipeline -- are all achievable with the existing stack (Node.js >=18, Zod 3.25.76, CommonJS, git) plus changes to the build-agents pipeline in rapid-tools.cjs and new source modules.

The critical insight: "inline YAML tool docs" means embedding YAML-formatted text describing rapid-tools.cjs CLI commands **inside agent prompts as content Claude reads**, not YAML that needs machine parsing. The build pipeline generates this text at build time using string interpolation from structured JavaScript objects or YAML source files. Similarly, "XML-formatted prompts" means the prompt assembly system already uses XML tags (`<role>`, `<identity>`, `<returns>`, etc.) -- v3.0 formalizes this into a consistent template structure. Both are build-time string operations requiring no parser libraries.

The simplified orchestration (collapsing wave-plan/job-plan into plan-set) removes code rather than adding it. The 5th researcher (Domain/UX) is a new role module added to the existing build pipeline. Interface contracts without gating means removing lock acquisition logic, not adding new libraries.

---

## Existing Stack (Retained As-Is)

| Technology | Version | Purpose | v3.0 Impact |
|------------|---------|---------|-------------|
| Node.js | >=18 | Runtime | No change |
| Zod | 3.25.76 | Schema validation | Minor: simplify state schemas (remove wave-plan/job-plan states) |
| proper-lockfile | 4.1.2 | File locking | REDUCED usage: remove set gating locks, keep state mutation locks only |
| ajv + ajv-formats | 8.17.1 / 3.0.1 | JSON Schema for contracts | No change (contracts remain) |
| CommonJS | (format) | Module system | No change |
| git worktrees | (system) | Set isolation | No change |
| node:test | (built-in) | Test framework | New tests for refactored build pipeline |

**Zod version note:** package.json specifies `"zod": "^3.25.76"`. The installed version is 3.25.76 and works correctly with CommonJS `const { z } = require('zod')`. Do NOT upgrade to Zod 4.x (breaks CommonJS require). Do NOT downgrade.

---

## What's Needed Per Feature

### 1. Inline YAML Tool Documentation Per Agent

**Stack additions:** None. Build pipeline enhancement only.

**What "inline YAML tool docs" means:** Instead of shared core modules like `core-state-access.md` and `core-context-loading.md` that list all CLI commands regardless of which agent needs them, each agent's prompt will contain only the rapid-tools.cjs commands relevant to that specific role, formatted as YAML for readability.

**Current state:** The `core-state-access.md` module lists ALL state/lock commands. It gets included in every agent that has `core-state-access.md` in its ROLE_CORE_MAP entry. Agents that only read state still see write commands. Agents that never touch locks see lock commands.

**v3.0 approach:** Define per-role tool manifests as structured data (JavaScript objects in the build pipeline), then render them as YAML-formatted text blocks within each agent's prompt at build time.

**Example of what gets embedded in an agent prompt:**

```yaml
<tools>
# rapid-tools.cjs commands available to this agent

state-read:
  - command: state get --all
    purpose: Read full STATE.json
  - command: state get set <milestoneId> <setId>
    purpose: Read a specific set's state

worktree:
  - command: worktree status --json
    purpose: Check worktree status for a set
</tools>
```

This YAML text is read by Claude as documentation -- it does not need machine parsing. The build pipeline generates it from a per-role tool manifest defined in JavaScript:

```javascript
const ROLE_TOOL_DOCS = {
  'executor': {
    'state-read': [
      { command: 'state get set <milestoneId> <setId>', purpose: 'Read set state' },
    ],
    'git': [
      { command: 'execute commit-state [message]', purpose: 'Commit STATE.json changes' },
    ],
  },
  // ...
};
```

**Why no YAML parser library:**
- The YAML text is generated at build time using string templates, not parsed
- The existing regex-based frontmatter parser (see `parseHandoff()` in execute.cjs, lines 366-378) handles all YAML parsing RAPID ever does
- Claude reads the YAML as documentation; no machine needs to parse it
- Adding js-yaml (21KB) for string formatting that `JSON.stringify` + string templates handle is unnecessary overhead
- The RAPID project constraint is zero-infrastructure; every npm dependency is a maintenance burden

**When a YAML parser WOULD be needed (and why it's not):**
- If tool manifests were defined in `.yml` source files instead of JavaScript objects -- but JS objects are more natural in a CommonJS codebase and don't require a build step to validate
- If agents needed to parse YAML at runtime -- but agents read documentation, they don't parse structured data from it

### 2. XML-Formatted Prompt Templates

**Stack additions:** None. Build pipeline formalization only.

**Current state:** The build pipeline already uses XML tags. `assembleAgentPrompt()` wraps core modules in `<identity>`, `<returns>`, `<state-access>`, `<git>`, `<context-loading>` tags and wraps role modules in `<role>` tags. This has been working since v2.1 (build-agents.test.cjs validates XML tag presence).

**v3.0 approach:** Formalize and extend the XML tag structure with consistent semantics:

```xml
<!-- Current v2.x structure -->
<identity>...</identity>
<returns>...</returns>
<state-access>...</state-access>
<git>...</git>
<context-loading>...</context-loading>
<role>...</role>

<!-- v3.0 extended structure -->
<identity>...</identity>
<returns>...</returns>
<tools>...</tools>          <!-- replaces state-access + context-loading -->
<git>...</git>
<role>...</role>
<workflow>...</workflow>     <!-- new: agent's position in simplified flow -->
```

**Why no XML parser library:**
- XML tags are generated by string concatenation: `` `<${tag}>\n${content}\n</${tag}>` `` (rapid-tools.cjs line 630)
- They are never parsed at runtime -- they're structural markers in agent prompts that help Claude understand section boundaries
- The build-agents tests validate tag presence with `content.includes('<tag>')` -- no DOM parsing needed
- An XML library (fast-xml-parser, xmldom) would add complexity for string concatenation that template literals already handle

**What changes in the build pipeline:**
- `assembleAgentPrompt()` adds a `<tools>` section generated from ROLE_TOOL_DOCS
- `assembleAgentPrompt()` adds a `<workflow>` section with the agent's position in the simplified flow
- Core modules are reorganized: `core-state-access.md` and `core-context-loading.md` are retired, replaced by per-role `<tools>` sections
- The ROLE_CORE_MAP entries shrink because tool docs are now generated from ROLE_TOOL_DOCS, not loaded from shared files

### 3. Hybrid Agent Build Pipeline (Core Hand-Written, Repetitive Generated)

**Stack additions:** None. Build pipeline restructuring only.

**Current state:** ALL 29+ agents are generated by `build-agents` from `src/modules/` (core modules + role modules). Every agent goes through `assembleAgentPrompt()` which concatenates frontmatter + core modules + role module.

**v3.0 approach:** Split agents into two categories:

| Category | Source | Build Process | Examples |
|----------|--------|---------------|----------|
| **Core (hand-written)** | `agents/` directory, `.md` files maintained by hand | Copied as-is by build pipeline, or skipped entirely (already in place) | orchestrator, planner, executor, merger |
| **Repetitive (generated)** | `src/modules/roles/` + ROLE_TOOL_DOCS + core modules | Assembled by `assembleAgentPrompt()` as today | researchers (5x), bug-hunter, devils-advocate, judge, scoper, etc. |

**Why this split:**
- Core agents (orchestrator, planner, executor, merger) have complex, nuanced prompts that benefit from direct human editing
- Repetitive agents (researchers, review pipeline agents) follow a consistent pattern where generation from modules is more maintainable
- The current all-generated approach means changing an orchestrator's behavior requires editing a role module, rebuilding, and verifying -- when direct editing of the agent file would be faster and more precise

**What changes in the build pipeline:**
- `handleBuildAgents()` gains a `CORE_AGENTS` list of roles that are hand-written
- For core agents: build pipeline validates frontmatter and size limits but does NOT overwrite the file
- For generated agents: build pipeline works as today (assemble from modules, write to agents/)
- build-agents test updated: core agent files are validated for structure but not regenerated

**Implementation detail:** The simplest approach is a `SKIP_GENERATION` set in the build pipeline:

```javascript
const SKIP_GENERATION = new Set([
  'orchestrator', 'planner', 'executor', 'set-planner', 'merger', 'set-merger'
]);

for (const [role, coreModules] of Object.entries(ROLE_CORE_MAP)) {
  if (SKIP_GENERATION.has(role)) {
    // Validate but don't overwrite
    validateAgentFile(role);
    continue;
  }
  // Generate as before
  const assembled = assembleAgentPrompt(role, coreModules);
  // ...
}
```

### 4. Simplified Orchestration (Collapse Wave-Plan/Job-Plan into Plan-Set)

**Stack additions:** None. Code removal + simplification.

**Current state:** The planning pipeline has multiple layers:
1. `/plan-set` or `/discuss-set` --> wave-planner agent per wave
2. Wave planner produces per-job plans
3. Job planner agent produces detailed JOB-PLAN.md per job
4. Then execution proceeds

**v3.0 approach:** Collapse into a single `plan-set` flow:
1. `/plan-set` --> produces one PLAN.md per wave with all jobs specified
2. Execution proceeds directly from PLAN.md

**What changes in the stack:**
- State schemas: Remove wave-level planning states (WaveStatus may drop `discussing`, `planning` states)
- State transitions: Simplify valid transition map
- ROLE_CORE_MAP: Remove or repurpose wave-planner, job-planner, wave-researcher roles
- wave-planning.cjs: Simplify or remove wave-plan-specific helpers
- rapid-tools.cjs: Remove `wave-plan` command group (resolve-wave, create-wave-dir, validate-contracts, list-jobs may be consolidated)

**No new libraries needed.** This is a subtraction, not an addition.

### 5. 5th Researcher (Domain/UX) Integration

**Stack additions:** None. New role module only.

**What's needed:**
- New file: `src/modules/roles/role-research-domain.md` -- Domain/UX researcher role
- ROLE_CORE_MAP entry: `'research-domain': ['core-identity.md', 'core-returns.md']`
- ROLE_TOOLS entry: `'research-domain': 'Read, Grep, Glob, WebFetch, WebSearch'`
- ROLE_DESCRIPTIONS entry
- ROLE_COLORS entry

This follows the exact pattern of the existing 5 researchers. The build pipeline handles it automatically once the role module exists and the maps are updated.

### 6. Interface Contracts Without Gating

**Stack additions:** None. Behavior change only.

**Current state:** Contracts are enforced as gates -- wave planning validates job plans against CONTRACT.json, and planning cannot proceed if contracts are violated.

**v3.0 approach:** Contracts remain as documentation and dependency declarations, but they don't block workflow progression. Sets declare what they depend on via contracts; other sets can see these declarations. But execution isn't gated on contract validation.

**What changes:**
- Remove gating logic from `wave-plan validate-contracts`
- Keep CONTRACT.json generation and reading
- Contracts become advisory (logged warnings, not blocking errors)
- `plan.cjs`: Remove or soften `check-gate` enforcement

**No new libraries needed.** This removes validation enforcement, keeping the same contract schema.

---

## Recommended Stack (Complete v3.0 Picture)

### Core Technologies (No Changes)

| Technology | Version | Purpose | v3.0 Impact |
|------------|---------|---------|-------------|
| Node.js | >=18 | Runtime | No change |
| Zod | 3.25.76 | Schema validation | Simplify schemas (fewer states), keep existing validation |
| proper-lockfile | 4.1.2 | File locking | Reduced: remove set gating locks |
| ajv + ajv-formats | 8.17.1 / 3.0.1 | JSON Schema for contracts | No change |
| CommonJS | (format) | Module system | No change |
| git | >=2.30 | VCS + worktrees | No change |
| node:test | (built-in) | Tests | New/updated tests for build pipeline |

### New/Modified Modules

| Module | Type | Purpose | Depends On |
|--------|------|---------|------------|
| `src/modules/roles/role-research-domain.md` | Agent role (new) | Domain/UX researcher for init pipeline | core-identity.md, core-returns.md |
| `src/modules/core/core-state-access.md` | Core module (retire) | Replaced by per-role `<tools>` sections | N/A |
| `src/modules/core/core-context-loading.md` | Core module (retire) | Replaced by per-role `<tools>` sections | N/A |
| `agents/rapid-orchestrator.md` | Subagent (hand-written) | Core agent maintained directly | N/A |
| `agents/rapid-planner.md` | Subagent (hand-written) | Core agent maintained directly | N/A |
| `agents/rapid-executor.md` | Subagent (hand-written) | Core agent maintained directly | N/A |
| `agents/rapid-research-domain.md` | Subagent (generated) | Built from role-research-domain.md | build-agents pipeline |

### Build Pipeline Changes

| Component | Change | Description |
|-----------|--------|-------------|
| `handleBuildAgents()` | Major refactor | Add SKIP_GENERATION set, ROLE_TOOL_DOCS map, `<tools>` section generation, `<workflow>` section generation |
| `assembleAgentPrompt()` | Extend | Accept ROLE_TOOL_DOCS for per-role tool rendering; add workflow section |
| `generateFrontmatter()` | No change | Already correct for all agent types |
| `ROLE_CORE_MAP` | Simplify | Remove core-state-access.md and core-context-loading.md entries (replaced by `<tools>`) |
| `ROLE_TOOL_DOCS` | New | Per-role structured object mapping agent -> CLI commands |

### State Schema Changes

| Schema | Change | Description |
|--------|--------|-------------|
| `WaveStatus` | Simplify | Remove `discussing`, `planning` if those states are collapsed |
| `SetStatus` | Possibly simplify | Review whether `planning` encompasses old wave-plan/job-plan |
| `state-transitions.cjs` | Simplify | Fewer valid transitions |

---

## Alternatives Considered

| Recommendation | Alternative | Why Not |
|----------------|-------------|---------|
| JS objects for tool manifests (ROLE_TOOL_DOCS) | YAML source files + js-yaml parser | Adding a dependency (js-yaml@4.1.1) for data that naturally lives as JS objects in a CommonJS codebase adds build complexity and an npm dependency for no gain. JS objects are type-checkable, require no parsing step, and are directly consumable by the build pipeline. |
| String template XML generation | fast-xml-parser or xmldom library | XML tags in agent prompts are structural markers, not a DOM. String concatenation (`` `<tag>\n${content}\n</tag>` ``) is the correct abstraction. An XML library adds complexity for a problem that doesn't exist. |
| Inline YAML as documentation text | Structured JSON tool reference | YAML is more readable for AI agents than JSON. Agents consume this as natural language documentation, and YAML's indentation-based format reads more naturally than JSON's braces/brackets. This is a prompt engineering choice, not a data format choice. |
| SKIP_GENERATION set for hybrid build | Separate build pipelines for core vs generated | One pipeline with a skip list is simpler than two pipelines. The validation logic (frontmatter check, size check) is shared. Two pipelines means duplicated validation code. |
| Remove core-state-access.md + core-context-loading.md | Keep shared modules alongside per-role tool docs | Shared modules create prompt bloat -- agents receive commands they don't use. Per-role tool docs are surgically scoped. The shared module pattern was right for v2.0 when the agent count was small and tool docs were being iterated. Now that tool docs are stable, per-role scoping is the right optimization. |
| Simplify state schemas by removing states | Keep all states for backward compatibility | v3.0 is a breaking change milestone. The old wave-plan/job-plan states serve the old orchestration pattern. Keeping them creates dead code paths and confuses agents reading state. Clean removal is correct. |
| Keep proper-lockfile for all locking | Remove proper-lockfile entirely | Set-gating locks are removed, but STATE.json mutation locks are still needed when multiple agents may update state concurrently. Reducing lock scope is correct; eliminating locking entirely would introduce race conditions. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| js-yaml / yaml npm package | Tool manifests are JS objects rendered as text. No YAML parsing needed at build or runtime. Adding a dependency for string formatting is unnecessary. | JavaScript objects in ROLE_TOOL_DOCS + template literal rendering |
| fast-xml-parser / xmldom / cheerio | XML tags in prompts are string concatenation, not DOM manipulation. No parsing or traversal needed. | Template literal string concatenation: `` `<${tag}>\n${content}\n</${tag}>` `` |
| Handlebars / EJS / Mustache | Template engines add complexity for a build pipeline that concatenates 3-5 sections. The current approach (array of sections joined by newlines) is simpler and more debuggable. | String concatenation with `sections.push()` + `sections.join('\n\n')` |
| Zod 4.x | Breaks CommonJS `require()`. The installed Zod 3.25.76 works correctly. | Stay on Zod 3.25.76 (`^3.25.76` in package.json) |
| TypeScript for build pipeline | RAPID is 100% CommonJS JavaScript. Introducing TypeScript for the build pipeline only creates a split codebase with different tooling requirements. | Continue with CommonJS `.cjs` files |
| XState or robot for state machine | The hand-rolled state machine (~50 lines in state-machine.cjs) is simpler and sufficient. v3.0 simplifies the state machine further by removing states, making XState even less justified. | Continue with hand-rolled state machine |
| Markdown template libraries (marked, remark) | Agent prompts are Markdown but never need parsing. They are generated text consumed by Claude. | String concatenation |

---

## Integration Points

### How ROLE_TOOL_DOCS Feeds Into Agent Prompts

The build pipeline renders tool docs as YAML-formatted text within `<tools>` XML tags:

```javascript
// In handleBuildAgents() -- rapid-tools.cjs

const ROLE_TOOL_DOCS = {
  'executor': {
    'state': [
      { cmd: 'state get set <mId> <sId>', desc: 'Read set state' },
      { cmd: 'state transition job <mId> <sId> <wId> <jId> <status>', desc: 'Update job status' },
    ],
    'execute': [
      { cmd: 'execute commit-state [message]', desc: 'Commit STATE.json' },
    ],
  },
  'merger': {
    'merge': [
      { cmd: 'merge detect <set>', desc: 'Run 5-level conflict detection' },
      { cmd: 'merge resolve <set>', desc: 'Run resolution cascade' },
      { cmd: 'merge execute <set>', desc: 'Merge set branch into main' },
      { cmd: 'merge update-status <set> <status>', desc: 'Update merge status' },
    ],
  },
  // ... per role
};

function renderToolDocs(role) {
  const docs = ROLE_TOOL_DOCS[role];
  if (!docs) return '';

  const lines = ['# rapid-tools.cjs commands for this agent', ''];
  for (const [category, commands] of Object.entries(docs)) {
    lines.push(`${category}:`);
    for (const { cmd, desc } of commands) {
      lines.push(`  - command: "${cmd}"`);
      lines.push(`    purpose: ${desc}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
```

### How the Hybrid Build Pipeline Works

```
src/modules/core/        --> shared XML sections (identity, returns, git)
src/modules/roles/        --> role-specific content
ROLE_TOOL_DOCS (JS map)   --> per-role <tools> section
SKIP_GENERATION (JS set)  --> which roles are hand-written

build-agents:
  for each role in ROLE_CORE_MAP:
    if SKIP_GENERATION.has(role):
      validate agents/rapid-{role}.md exists and has valid frontmatter
      validate size limits
      skip generation
    else:
      assemble from modules + tool docs + workflow
      write to agents/rapid-{role}.md
```

### How Simplified Orchestration Reduces State Complexity

```
v2.x state flow:
  Set: pending -> planning -> executing -> reviewing -> merging -> complete
  Wave: pending -> discussing -> planning -> executing -> reconciling -> complete
  Job: pending -> executing -> complete

v3.0 state flow:
  Set: pending -> planning -> executing -> reviewing -> merging -> complete
  Wave: pending -> executing -> complete  (no discussing/planning/reconciling)
  Job: pending -> executing -> complete   (unchanged)
```

The `discussing` and `planning` wave states are removed because the plan-set flow handles all planning at the set level, producing per-wave PLAN.md files directly. Waves go straight from `pending` to `executing` after planning is done at the set level.

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| zod@3.25.76 | Current | Node.js >=18, CommonJS require() | Do not upgrade to Zod 4.x |
| proper-lockfile@4.1.2 | Current | Node.js >=18 | Reduced usage in v3.0 but still needed |
| ajv@8.17.1 | Current | ajv-formats@3.0.1 | Used for CONTRACT.json validation |
| Claude Code subagent API | Current (2026-03) | agents/ dir with YAML frontmatter | Supports: model, permissionMode, tools, hooks, background, isolation, memory, maxTurns, skills |
| Claude Code skills API | Current (2026-03) | skills/ dir with SKILL.md | Supports: Agent tool dispatching, AskUserQuestion, all tool permissions |

---

## Installation

No new packages to install. v3.0 is entirely:
- Refactored build-agents pipeline (ROLE_TOOL_DOCS, SKIP_GENERATION, `<tools>` rendering)
- Simplified state schemas and transitions
- New role module (role-research-domain.md)
- Retired core modules (core-state-access.md, core-context-loading.md replaced by per-role tool docs)
- Hand-written core agent files (orchestrator, planner, executor, merger)
- Removed code (wave-planner, job-planner roles simplified; gate enforcement softened)

```bash
# Verify existing stack is intact
cd ~/Projects/RAPID
node -e "const {z} = require('zod'); require('proper-lockfile'); console.log('Stack OK')"

# No npm install needed for v3.0

# After implementation, regenerate agents (generated ones only)
node ~/Projects/RAPID/src/bin/rapid-tools.cjs build-agents

# Run tests to verify
node --test ~/Projects/RAPID/src/lib/build-agents.test.cjs
```

---

## Stack Patterns by Variant

**If the tool manifest format needs to change later:**
- ROLE_TOOL_DOCS is a plain JS object -- refactoring the shape is a code change, not a data migration
- If YAML source files become desirable later (e.g., non-developers editing tool docs), add js-yaml@4.1.1 at that point
- The rendered output format (YAML text in prompts) is independent of the source format

**If core agent prompts grow beyond 25KB:**
- The current 15KB warning threshold applies to generated agents
- Hand-written core agents have a 25KB generous limit (already in build-agents.test.cjs for planner and plan-verifier)
- If a core agent exceeds 25KB, factor out reusable sections into core modules while keeping the role-specific content hand-written

**If v3.0 needs to coexist with v2.x state files:**
- Add a state migration function in state-machine.cjs (pattern already exists: `migrateStateVersion()`)
- Migrate old wave states (`discussing`, `planning`, `reconciling`) to their simplified equivalents

---

## Sources

### PRIMARY (HIGH confidence)
- **Existing codebase analysis:** `src/bin/rapid-tools.cjs` (build-agents pipeline, assembleAgentPrompt, ROLE_CORE_MAP, ROLE_TOOL_DOCS concept), `src/modules/core/*.md` (current core modules), `src/modules/roles/*.md` (current role modules), `src/lib/state-schemas.cjs` (current state enums), `src/lib/execute.cjs` (regex-based YAML parsing at line 366-378), `src/lib/build-agents.test.cjs` (agent validation tests). All read directly. (HIGH confidence)
- **package.json:** Verified current dependencies: zod@^3.25.76, proper-lockfile@^4.1.2, ajv@^8.17.1, ajv-formats@^3.0.1. No new dependencies needed. (HIGH confidence)
- **Zod 3.25.76 CommonJS compatibility:** Verified via `node -e "const {z} = require('zod')"` -- works correctly. Package exports `require: './index.js'`. (HIGH confidence)
- **STATE.md v3.0 decisions:** Inline YAML tool docs per agent (not shared reference file), hybrid agent build (core hand-written, repetitive generated), simplified orchestration. (HIGH confidence, internal)

### SECONDARY (MEDIUM confidence)
- [js-yaml npm package](https://www.npmjs.com/package/js-yaml) -- js-yaml@4.1.1 supports CommonJS via `require('./index.js')` export. Confirmed dual CJS/ESM support. NOT recommended for v3.0 but viable if tool manifests move to YAML source files later. (MEDIUM confidence)
- [yaml npm package](https://www.npmjs.com/package/yaml) -- yaml@2.8.2 is an alternative YAML parser. NOT recommended. (MEDIUM confidence)

---
*Stack research for: RAPID v3.0 Refresh -- orchestration simplification, inline tool docs, XML prompt templates*
*Researched: 2026-03-12*
