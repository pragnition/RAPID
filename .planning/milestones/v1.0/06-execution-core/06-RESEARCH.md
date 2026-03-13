# Phase 6: Execution Core - Research

**Researched:** 2026-03-04
**Domain:** Subagent orchestration, parallel execution, git worktree isolation, structured return parsing
**Confidence:** HIGH

## Summary

Phase 6 builds the execution engine that spawns one Claude Code subagent per set, drives each through a discuss/plan/execute lifecycle, and verifies results via structured returns and git history analysis. The core mechanism is Claude Code's Agent tool (formerly Task tool, renamed in v2.1.63), which spawns subagents in their own context windows with custom system prompts and tool restrictions. Subagents cannot spawn other subagents -- only the orchestrator (main thread) can spawn agents, which means the orchestrator must drive the 3-phase lifecycle (discuss, plan, execute) as 3 sequential subagent invocations per set.

The project already has substantial infrastructure: `assembler.cjs` for prompt assembly, `worktree.cjs` for git worktree lifecycle (create/registry/scoped CLAUDE.md), `dag.cjs` for wave-ordered execution groups, `plan.cjs` for gate checking, `returns.cjs` for structured return parsing, and `verify.cjs` for artifact verification. The execution engine is primarily an orchestration layer that wires these together: read DAG for wave order, check gates, spawn subagents per set with assembled prompts, parse returns, verify commits, and update registry state.

**Primary recommendation:** Build `execute.cjs` as a new library module with `executeWave()` and `executeSet()` as the core functions, plus a `/rapid:execute` skill that orchestrates the wave-by-wave flow with developer interaction between waves. Use Claude Code's native Agent tool for subagent spawning -- do NOT attempt to shell out to `claude` CLI or use agent teams (experimental). Pre-create worktrees and generate scoped CLAUDE.md before spawning subagents.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use Claude Code's Task tool (now Agent tool) to spawn one subagent per set
- All sets within a wave launch simultaneously as concurrent Task subagents (parallel execution)
- Each subagent receives minimal context: scoped CLAUDE.md + CONTRACT.json + DEFINITION.md (lean context budget)
- Orchestrator collects results by parsing structured returns (RAPID:RETURN JSON) from subagent output using existing returns.cjs
- Full GSD-style lifecycle: discuss -> plan -> execute per set
- Orchestrator drives the lifecycle by spawning 3 sequential subagents per set per phase (discuss, plan, execute)
- The "discuss" phase prompts the user for implementation questions about each set individually
- User is prompted per-wave batch: before a wave starts, orchestrator runs discuss for all sets in that wave, then plan, then execute
- Agent instruction mandates one commit per task (already in rapid-executor.md agent template)
- Commit message format: `type(set-name): description`
- Post-execution verification: check commit count matches task count using git log
- On commit count mismatch: flag the discrepancy and ask the user to decide
- Post-execution ownership check: diff the set's branch vs base and verify all changed files are in the set's ownership list
- Physical isolation via git worktrees (worktree.cjs already built)
- Lock contention handled by existing lock.cjs
- Cross-set bleed prevention: verify at assembly time that subagent prompt contains ONLY the set's contracts/definition/scoped CLAUDE.md
- Import dependencies resolved via contract stubs: before a dependent set executes, generate stubs from imported set's CONTRACT.json

### Claude's Discretion
- Internal execution engine architecture (library structure, function signatures)
- Error handling and retry logic for subagent failures
- Contract stub generation format and mechanism
- Assembly-time cross-set bleed detection implementation

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXEC-01 | Each set executes in a fresh context window (subagent per set) with only relevant contracts and context loaded | Claude Code Agent tool spawns subagents in isolated context windows; `assembler.cjs` + `generateScopedClaudeMd()` builds lean prompts; cross-set bleed check validates prompt content at assembly time |
| EXEC-02 | Each set goes through its own discuss -> plan -> execute phase lifecycle independently | Orchestrator drives 3 sequential subagent invocations per set (discuss, plan, execute); subagents cannot self-delegate so orchestrator must drive; per-wave batch prompting aligns all sets in a wave |
| EXEC-03 | Changes within sets are committed atomically per task (bisectable, blame-friendly history) | `role-executor.md` already mandates one commit per task with `git add <specific files>`; post-execution verification via `git log` commit count check; ownership check via diff analysis against OWNERSHIP.json |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `child_process` | 18+ | Git operations via `gitExec()` pattern | Already established in worktree.cjs; zero dependency |
| Node.js built-in `node:test` | 18+ | Unit test framework | Project-wide standard (01-01 decision) |
| Node.js built-in `fs` / `path` | 18+ | File I/O for state, stubs, registry | Already established across all modules |
| `ajv` | 8.x | Contract schema validation for stub generation | Already installed, used in contract.cjs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lock.cjs` (internal) | n/a | Cross-process atomic locking | Registry updates during parallel execution |
| `assembler.cjs` (internal) | n/a | Agent prompt assembly | Building subagent prompts from modules + context |
| `returns.cjs` (internal) | n/a | Structured return parsing | Extracting RAPID:RETURN JSON from subagent output |
| `verify.cjs` (internal) | n/a | Artifact verification | Post-execution file and commit checks |
| `worktree.cjs` (internal) | n/a | Git worktree lifecycle | Creating/managing per-set worktrees |
| `plan.cjs` (internal) | n/a | Set loading, gate checking | Loading set definitions and verifying planning gates |
| `dag.cjs` (internal) | n/a | Execution order | Getting wave-ordered parallel groups |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Agent tool (subagents) | Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`) | Agent Teams are experimental, disabled by default, have known limitations (no session resumption, task status lag, slow shutdown). Subagents are stable and sufficient for RAPID's sequential-within-set model. EXEC-06 (Phase 9) will add agent teams as an opt-in mode. |
| Agent tool (subagents) | `isolation: worktree` frontmatter on subagent files | Claude Code v2.1.49+ supports `isolation: worktree` in agent frontmatter for automatic worktree creation. However, RAPID already manages worktrees via `worktree.cjs` with registry tracking, scoped CLAUDE.md generation, and reconciliation. Using RAPID's worktrees gives us registry state, ownership enforcement, and wave-level tracking that `isolation: worktree` does not provide. |
| Custom stub generator | TypeScript `declare` files | TS declarations would only work for TS projects; RAPID is JS-first. Simple JSON-based stubs from CONTRACT.json are language-agnostic. |

**Installation:**
```bash
# No new dependencies needed. All core functionality uses existing modules.
# ajv is already installed for contract.cjs
```

## Architecture Patterns

### Recommended Project Structure
```
rapid/src/lib/
  execute.cjs          # Core execution engine (executeWave, executeSet, verifySet)
  execute.test.cjs     # Unit tests for execution engine
  stub.cjs             # Contract stub generator
  stub.test.cjs        # Unit tests for stub generation

rapid/src/bin/
  rapid-tools.cjs      # Extended with 'execute' subcommands

rapid/skills/execute/
  SKILL.md             # /rapid:execute skill definition
```

### Pattern 1: Wave-Sequential, Set-Parallel Execution
**What:** The orchestrator processes waves sequentially. Within each wave, all sets launch as concurrent subagents. The orchestrator waits for all sets in a wave to complete before moving to the next wave.
**When to use:** Always -- this is the core execution model.
**Example:**
```javascript
// Source: Derived from dag.cjs getExecutionOrder() + worktree.cjs patterns
const dag = require('./dag.cjs');
const dagJson = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
const waves = dag.getExecutionOrder(dagJson);

for (const wave of waves) {
  // wave is string[] of set names that can run in parallel
  const gate = plan.checkPlanningGate(cwd, waveNumber);
  if (!gate.open) {
    throw new Error(`Planning gate not open for wave ${waveNumber}`);
  }

  // Launch all sets in wave concurrently via Agent tool
  // Orchestrator skill uses Agent tool -- library prepares context
  const contexts = wave.map(setName => prepareSetContext(cwd, setName));
  // ... skill spawns subagents and collects returns
}
```

### Pattern 2: Three-Phase Lifecycle Per Set (Discuss -> Plan -> Execute)
**What:** Each set goes through 3 sequential subagent invocations driven by the orchestrator. The orchestrator spawns a "discuss" subagent first (which surfaces questions for the user), then a "plan" subagent (which creates an implementation plan), then an "execute" subagent (which implements the plan).
**When to use:** For every set, as mandated by EXEC-02.
**Critical constraint:** Subagents cannot spawn other subagents. The orchestrator MUST drive each phase as a separate Agent invocation.
**Example:**
```javascript
// Lifecycle is driven by the skill, not the library.
// The library provides: context preparation, return parsing, verification.
// The skill uses Agent tool to spawn subagents sequentially.

// Phase 1: Discuss -- surfaces implementation questions
// Subagent prompt: "You are reviewing set {name}. Here is the DEFINITION.md and CONTRACT.json.
//   Ask the developer any clarifying questions about implementation approach."
// Returns: list of decisions/answers from user

// Phase 2: Plan -- creates implementation plan
// Subagent prompt: "You are planning set {name}. Here is the DEFINITION.md, CONTRACT.json,
//   and the discuss decisions. Create a step-by-step implementation plan."
// Returns: plan document

// Phase 3: Execute -- implements the plan
// Subagent prompt: assembled executor agent with scoped CLAUDE.md, plan, contracts
// Returns: RAPID:RETURN with artifacts, commits, task counts
```

### Pattern 3: Contract Stub Generation
**What:** Before a dependent set executes, generate stub files from imported set's CONTRACT.json so the dependent set can code against contract interfaces rather than actual implementations.
**When to use:** When a set has `imports.fromSets` in its CONTRACT.json and the imported set has not yet completed execution.
**Example:**
```javascript
// Source: Derived from contract.cjs CONTRACT_META_SCHEMA structure
function generateStub(contractJson, setName) {
  const exports = contractJson.exports || {};
  const functions = exports.functions || [];
  const types = exports.types || [];

  const lines = [];
  lines.push(`// AUTO-GENERATED stub for set: ${setName}`);
  lines.push(`// Generated from CONTRACT.json -- DO NOT EDIT`);
  lines.push(`'use strict';`);
  lines.push('');

  for (const fn of functions) {
    const params = fn.params.map(p => p.name).join(', ');
    lines.push(`/**`);
    lines.push(` * @param {${fn.params.map(p => p.type).join(', ')}} ${params}`);
    lines.push(` * @returns {${fn.returns}}`);
    lines.push(` */`);
    lines.push(`function ${fn.name}(${params}) {`);
    lines.push(`  throw new Error('Stub: ${fn.name} not yet implemented by set ${setName}');`);
    lines.push(`}`);
    lines.push('');
  }

  lines.push(`module.exports = { ${functions.map(f => f.name).join(', ')} };`);
  return lines.join('\n');
}
```

### Pattern 4: Post-Execution Verification
**What:** After a set's execute subagent returns, verify: (a) commit count matches task count, (b) all changed files are in the set's ownership list, (c) artifacts listed in the RAPID:RETURN actually exist.
**When to use:** After every set execution completes.
**Example:**
```javascript
// Source: Derived from verify.cjs + worktree.cjs patterns
function verifySetExecution(cwd, setName, returnData, worktreePath) {
  const results = { passed: [], failed: [] };

  // 1. Verify artifacts exist
  const artifactResults = verify.verifyLight(returnData.artifacts, returnData.commits || []);
  results.passed.push(...artifactResults.passed);
  results.failed.push(...artifactResults.failed);

  // 2. Verify commit count matches task count
  const expectedCommits = returnData.tasks_total;
  const actualCommits = getCommitCount(worktreePath, baseBranch);
  if (actualCommits !== expectedCommits) {
    results.failed.push({
      type: 'commit_count_mismatch',
      target: `expected ${expectedCommits}, got ${actualCommits}`,
    });
  }

  // 3. Verify file ownership -- all changed files belong to this set
  const changedFiles = getChangedFiles(worktreePath, baseBranch);
  const ownership = loadOwnership(cwd);
  for (const file of changedFiles) {
    const owner = contract.checkOwnership(ownership.ownership, file);
    if (owner !== setName) {
      results.failed.push({
        type: 'ownership_violation',
        target: `${file} owned by ${owner || 'nobody'}, modified by ${setName}`,
      });
    }
  }

  return results;
}
```

### Pattern 5: Subagent Prompt Assembly (Lean Context)
**What:** Each subagent receives only its set's artifacts -- not all sets' data. The prompt is assembled from: scoped CLAUDE.md (already has contract + ownership + style guide) + DEFINITION.md + wave-specific context.
**When to use:** Every subagent invocation.
**Example:**
```javascript
// Source: Derived from assembler.cjs + worktree.cjs generateScopedClaudeMd()
function prepareSetContext(cwd, setName) {
  const setData = plan.loadSet(cwd, setName);

  // Generate scoped CLAUDE.md (contract, ownership, deny list, style guide)
  const scopedMd = worktree.generateScopedClaudeMd(cwd, setName);

  // Load DEFINITION.md for task list
  const definition = setData.definition;

  // Load contract for discuss/plan phases
  const contractStr = JSON.stringify(setData.contract, null, 2);

  return { scopedMd, definition, contractStr, setName };
}
```

### Anti-Patterns to Avoid
- **Spawning subagents from subagents:** Claude Code explicitly prevents this. The orchestrator (main thread) must drive ALL subagent invocations. A set's "discuss" subagent cannot spawn the "plan" subagent.
- **Loading all sets' context into one subagent:** This defeats isolation (EXEC-01). Each subagent gets ONLY its own set's artifacts.
- **Trusting subagent self-reports without verification:** AGNT-03 requires filesystem verification. Always check artifacts, commits, and ownership post-execution.
- **Modifying REGISTRY.json from inside subagents:** Subagents work in worktrees. Registry lives in the main repo's `.planning/`. Only the orchestrator updates registry state.
- **Using `git add .` or `git add -A` in subagents:** The executor role template already forbids this. Specific file adds only.
- **Using Claude Code's `isolation: worktree` for RAPID sets:** RAPID manages its own worktrees with registry, scoped CLAUDE.md, and ownership enforcement. Using Claude Code's built-in worktree isolation would bypass these controls.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subagent spawning | Custom process manager / `child_process` Claude CLI calls | Claude Code Agent tool (via skill's Agent tool access) | Agent tool handles context windows, model selection, tool restrictions, and permission inheritance. Shelling out to `claude` would lose session context and permissions. |
| Structured return parsing | Custom JSON extraction from agent output | `returns.cjs parseReturn()` | Already handles marker extraction, JSON parsing, and validation. Battle-tested across 14 completed plans. |
| Git worktree management | Custom git commands in execute.cjs | `worktree.cjs createWorktree() / registryUpdate()` | Already handles creation, registry, reconciliation, lock-protected updates. |
| Planning gate checks | Direct GATES.json file reads | `plan.cjs checkPlanningGate()` | Already handles wave key lookup, status checking, missing detection. |
| Execution order | Custom DAG traversal | `dag.cjs getExecutionOrder()` | Already returns wave-ordered parallel groups from DAG.json. |
| File ownership validation | Custom file-to-set mapping | `contract.cjs checkOwnership()` | Already handles exact match and directory pattern matching. |
| Agent prompt assembly | String concatenation | `assembler.cjs assembleAgent()` | Already handles frontmatter, module ordering, context injection, size warnings. |

**Key insight:** Phase 6 is primarily an orchestration and wiring phase. Nearly all the heavy lifting (worktrees, DAG, gates, contracts, returns, verification) is already built. The new code is the execution engine that calls these existing modules in the right order, plus stub generation and the `/rapid:execute` skill.

## Common Pitfalls

### Pitfall 1: Subagent Context Window Overflow
**What goes wrong:** Subagent receives too much context (all sets' contracts, full project docs) and hits context limits or loses focus on its specific set.
**Why it happens:** Temptation to "give the agent everything it might need."
**How to avoid:** Use `generateScopedClaudeMd()` for targeted context. Only include the set's own DEFINITION.md, CONTRACT.json, and scoped CLAUDE.md. The discuss/plan phases get contract only; the execute phase gets the full scoped CLAUDE.md.
**Warning signs:** Agent size warning from assembler.cjs (>15KB threshold). Subagent asking about other sets' files.

### Pitfall 2: Race Conditions in Registry Updates
**What goes wrong:** Multiple parallel subagents finish near-simultaneously, and their registry updates conflict.
**Why it happens:** Subagents don't update the registry themselves (they work in worktrees), but the orchestrator processes multiple returns and calls `registryUpdate()` for each.
**How to avoid:** Use `registryUpdate()` with its built-in lock acquisition for every registry write. Process returns sequentially (even if subagents ran in parallel). The lock system (lock.cjs) handles contention with exponential backoff.
**Warning signs:** Registry showing stale/incorrect phase values for sets.

### Pitfall 3: Commit Verification False Positives
**What goes wrong:** Post-execution commit count check passes but the commits don't actually correspond to the plan's tasks (e.g., multiple tasks squashed into one commit, or unrelated commits counted).
**Why it happens:** Counting commits is a proxy for atomic-per-task compliance, not proof of it.
**How to avoid:** Count commits on the set's branch relative to the base branch (not total repo history). Verify commit messages match the `type(set-name): description` format. Check that the commit count is >= tasks_total (some tasks like TDD may produce 2 commits).
**Warning signs:** Commit count matches but `git log --oneline` shows messages that don't reference set tasks.

### Pitfall 4: Stub Files Left in Worktree After Execution
**What goes wrong:** Contract stub files (generated for dependency resolution) remain in the worktree and get committed, polluting the codebase.
**Why it happens:** Stubs are generated before execution but cleanup is forgotten.
**How to avoid:** Track generated stub file paths. After execution completes, delete stub files before any final verification. Alternatively, generate stubs in a temporary directory outside the worktree and symlink them, or generate them as part of the scoped CLAUDE.md instructions (tell the agent to mock imports rather than providing actual stub files).
**Warning signs:** Files named `*-stub.cjs` or `*-contract-stub.cjs` appearing in `git status`.

### Pitfall 5: Discuss Phase Prompting Overhead
**What goes wrong:** Each set's discuss phase spawns a subagent just to ask the user a few questions, burning context and tokens for minimal value.
**Why it happens:** Strict adherence to discuss -> plan -> execute without considering whether discuss is always needed.
**How to avoid:** Make discuss optional or lightweight. If the set's DEFINITION.md + CONTRACT.json are clear enough, the orchestrator can ask the user "Any questions about set X before we plan it?" directly without a subagent. Reserve full discuss subagents for complex sets with ambiguous scope.
**Warning signs:** User repeatedly says "no questions" to discuss prompts. Discuss subagents returning empty/trivial results.

### Pitfall 6: Parallel Set Execution Exceeds Rate Limits
**What goes wrong:** Launching many sets simultaneously in a wave triggers Claude API rate limits, causing subagent failures.
**Why it happens:** Each subagent is a separate API session consuming tokens.
**How to avoid:** Implement a concurrency limit (e.g., max 3-4 parallel subagents). If rate limiting occurs, detect it from the subagent error return and implement exponential backoff with retry. Log the rate limit event so the user is informed.
**Warning signs:** Subagents returning BLOCKED with ERROR category mentioning "rate limit" or "429".

## Code Examples

Verified patterns from project source:

### Loading DAG and Getting Execution Order
```javascript
// Source: dag.cjs getExecutionOrder() -- already implemented
const fs = require('fs');
const path = require('path');
const dag = require('./dag.cjs');

const dagPath = path.join(cwd, '.planning', 'sets', 'DAG.json');
const dagJson = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));

// Returns array of arrays: [[wave1-sets], [wave2-sets], ...]
const executionOrder = dag.getExecutionOrder(dagJson);
// e.g., [['auth-core', 'ui-shell'], ['api-routes'], ['integration']]
```

### Checking Planning Gate Before Execution
```javascript
// Source: plan.cjs checkPlanningGate() -- already implemented
const plan = require('./plan.cjs');

const gate = plan.checkPlanningGate(cwd, waveNumber);
// gate = { open: boolean, required: string[], completed: string[], missing: string[] }

if (!gate.open) {
  console.error(`Wave ${waveNumber} planning gate not open. Missing: ${gate.missing.join(', ')}`);
}
```

### Parsing Structured Return from Subagent
```javascript
// Source: returns.cjs parseReturn() -- already implemented
const { parseReturn, validateReturn } = require('./returns.cjs');

const result = parseReturn(agentOutputText);
// result = { parsed: boolean, data?: object, error?: string }

if (result.parsed) {
  const validation = validateReturn(result.data);
  // validation = { valid: boolean, errors?: string[] }

  if (result.data.status === 'COMPLETE') {
    // result.data.artifacts, result.data.commits, result.data.tasks_completed, etc.
  } else if (result.data.status === 'BLOCKED') {
    // result.data.blocker_category, result.data.blocker, result.data.resolution
  }
}
```

### Generating Scoped CLAUDE.md for a Set
```javascript
// Source: worktree.cjs generateScopedClaudeMd() -- already implemented
const worktree = require('./worktree.cjs');

const scopedMd = worktree.generateScopedClaudeMd(cwd, setName);
// Returns Markdown string with:
// - Set scope header
// - Interface Contract (CONTRACT.json)
// - File Ownership (owned files list)
// - DO NOT TOUCH (deny list by owner)
// - Style Guide (if available)
```

### Loading Set Definition and Contract
```javascript
// Source: plan.cjs loadSet() -- already implemented
const plan = require('./plan.cjs');

const setData = plan.loadSet(cwd, setName);
// setData = {
//   definition: string (DEFINITION.md content),
//   contract: object (CONTRACT.json parsed),
//   contributions?: object (CONTRIBUTIONS.json if present)
// }
```

### Updating Worktree Registry with Lock Protection
```javascript
// Source: worktree.cjs registryUpdate() -- already implemented
const worktree = require('./worktree.cjs');

await worktree.registryUpdate(cwd, (registry) => {
  registry.worktrees[setName].phase = 'Executing';
  registry.worktrees[setName].status = 'active';
  return registry;
});
```

### Getting Changed Files in a Worktree Branch
```javascript
// Source: Derived from worktree.cjs gitExec() pattern
const { gitExec } = require('./worktree.cjs');

function getChangedFiles(worktreePath, baseBranch) {
  const result = gitExec(['diff', '--name-only', `${baseBranch}...HEAD`], worktreePath);
  if (!result.ok) return [];
  return result.stdout.split('\n').filter(f => f.trim().length > 0);
}

function getCommitCount(worktreePath, baseBranch) {
  const result = gitExec(['rev-list', '--count', `${baseBranch}..HEAD`], worktreePath);
  if (!result.ok) return 0;
  return parseInt(result.stdout, 10);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Task tool name | Agent tool name | Claude Code v2.1.63 (Feb 2026) | The tool was renamed from "Task" to "Agent". Both names still work as aliases. RAPID code should use "Agent" in tool references going forward. |
| No worktree isolation option | `isolation: worktree` frontmatter | Claude Code v2.1.49 (Feb 2026) | Subagent definitions can request auto-worktree creation. RAPID uses its own worktree management so this is informational, not adoptable. |
| Agent Teams not available | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Claude Code (Feb 2026) | Experimental parallel agent teams with shared task lists and inter-agent messaging. RAPID Phase 9 (EXEC-06) will integrate this. Not for Phase 6. |
| No `maxTurns` control | `maxTurns` in subagent frontmatter | Claude Code v2.1.49+ | Can limit subagent execution time. Useful as a safety valve for runaway subagents. |
| No persistent memory | `memory` field in subagent frontmatter | Claude Code v2.1.49+ | Subagents can persist learnings across sessions. Not needed for RAPID's ephemeral per-set subagents. |

**Deprecated/outdated:**
- Task tool name: Still works as alias but "Agent" is the current canonical name
- `Agent(agent_type)` restriction syntax: Only applies to main-thread agents (agents running via `claude --agent`). Subagents cannot spawn other subagents regardless.

## Open Questions

1. **Discuss phase value vs overhead**
   - What we know: Each discuss phase spawns a subagent to ask the user about implementation approach. The user confirmed per-wave batch prompting.
   - What's unclear: Whether a full subagent is needed for discuss, or whether the orchestrator skill can handle it directly (asking the user inline without spawning).
   - Recommendation: Implement discuss as a lightweight inline prompt in the orchestrator skill. Only spawn a discuss subagent for complex sets (>5 tasks or cross-set dependencies). This is within "Claude's Discretion" per CONTEXT.md.

2. **Stub generation: file-based vs instruction-based**
   - What we know: Dependent sets need to code against imported set's contract interfaces. CONTRACT.json defines exports with function signatures and type shapes.
   - What's unclear: Whether to generate actual `.cjs` stub files in the worktree, or embed contract interface descriptions in the subagent's prompt and instruct it to mock imports.
   - Recommendation: Generate actual stub files. They are concrete, testable, and the executor can `require()` them during development. Clean them up post-execution. This approach aligns with the existing `contract.test.cjs` pattern.

3. **Concurrency limit for parallel subagents**
   - What we know: Wave sets launch simultaneously. Claude API has rate limits per account.
   - What's unclear: What the practical concurrency limit is before hitting rate limits.
   - Recommendation: Default to 4 concurrent subagents. Make it configurable via `.planning/config.json`. Detect rate limit errors and reduce concurrency dynamically.

## Sources

### Primary (HIGH confidence)
- [Claude Code Official Docs: Create custom subagents](https://code.claude.com/docs/en/sub-agents) - Subagent configuration, frontmatter fields, tool access, isolation options, spawning constraints
- [Claude Code Official Docs: Agent Teams](https://code.claude.com/docs/en/agent-teams) - Experimental teams feature, comparison with subagents, limitations
- Context7 `/anthropics/claude-code` - Agent tool configuration, prompt structure, tool restrictions
- Project source: `assembler.cjs`, `worktree.cjs`, `dag.cjs`, `plan.cjs`, `returns.cjs`, `verify.cjs`, `contract.cjs` - All existing infrastructure modules

### Secondary (MEDIUM confidence)
- [Claude Code Changelog](https://code.claude.com/docs/en/changelog) - Task->Agent rename in v2.1.63, isolation:worktree in v2.1.49
- [Claude Code Git Worktree Support announcement](https://www.threads.com/@boris_cherny/post/DVAAnexgRUj/) - Native worktree support confirmation

### Tertiary (LOW confidence)
- [Agent Teams Token Costs](https://blog.laozhang.ai/en/posts/claude-code-agent-teams) - Token scaling with team size (third-party analysis)
- [GitHub Issue #4182: Sub-Agent Task Tool Not Exposed When Launching Nested Agents](https://github.com/anthropics/claude-code/issues/4182) - Confirms subagents cannot spawn subagents

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All modules already exist and are tested; no new dependencies needed
- Architecture: HIGH - Orchestration patterns directly derive from existing module APIs; subagent spawning model confirmed via official docs
- Pitfalls: HIGH - Most pitfalls identified from project history (14 phases of experience) and Claude Code official documentation on subagent constraints

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable -- core APIs and project infrastructure are settled)
