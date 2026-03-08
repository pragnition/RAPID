# Stack Research: v2.1 Improvements & Fixes

**Domain:** Claude Code plugin -- workflow streamlining, subagent delegation, plan verification
**Researched:** 2026-03-09
**Confidence:** HIGH (all features use existing stack; no new dependencies needed)

## Executive Summary

v2.1 requires NO new npm dependencies. Every feature can be built with the existing stack (Node.js + Zod 3.25.76 + CommonJS + git) plus better use of Claude Code's built-in capabilities (subagent system, AskUserQuestion multiSelect, Agent tool parallel spawning). The stack changes are architectural, not technological: new library modules, new agent definitions, and skill rewrites.

The key insight is that RAPID's token cost and workflow friction problems are **prompt engineering and orchestration problems**, not library problems. Adding dependencies would add complexity without solving the actual issues.

---

## Existing Stack (Retained As-Is)

These are the validated technologies from v2.0. Do NOT change or upgrade them.

| Technology | Version | Purpose | Why Retained |
|------------|---------|---------|--------------|
| Node.js | >=18 | Runtime | CommonJS require() used everywhere; stable |
| Zod | 3.25.76 | Schema validation | Works with CommonJS require(); powers state machine, returns, review schemas |
| proper-lockfile | 4.1.2 | File locking | Atomic state writes; proven in v2.0 |
| ajv + ajv-formats | 8.17.1 / 3.0.1 | JSON Schema validation | Used for CONTRACT.json validation |
| git worktrees | (system) | Set isolation | Core architectural decision; unchanged |

**Important:** package.json lists `"zod": "^3.25.76"`. Despite PROJECT.md mentioning 3.24.4, the installed version is 3.25.76 and works correctly with CommonJS `require('zod')`. Do not downgrade.

---

## What's Needed Per Feature

### 1. Workflow Streamlining (Auto-Plan After Init)

**Stack additions:** None.

**What changes:**
- `skills/init/SKILL.md` -- Add a step after roadmap acceptance (after current Step 9) that automatically transitions into planning. Instead of telling the user "Run `/rapid:plan`", the init skill should directly invoke the planning logic.
- The plan command (`commands/plan.md`) already exists. The init skill's allowed-tools include `Agent`, so it can spawn a planning subagent inline after roadmap files are written.

**Integration approach:** After the user accepts the roadmap and STATE.json/ROADMAP.md/CONTRACT.json files are written, the skill should:
1. Display "Auto-running planning phase..."
2. For each set in the roadmap, register it in STATE.json (already done in Step 9)
3. Transition directly to the "Next Steps" display with `/rapid:set-init` as the recommended action

The current flow (init -> tell user to run plan -> user runs plan -> plan creates sets) has a redundant step. The roadmapper already produces the full set/wave/job structure. STATE.json already gets populated in Step 9. There is nothing the separate `/rapid:plan` command does that init does not already do. The streamlined flow simply removes the "go run plan" redirect.

**Why no new library:** This is a prompt-level change to one skill file. The existing roadmapper agent already produces all the data that plan would generate.

### 2. Parallel Wave Planning

**Stack additions:** None.

**What changes:**
- `skills/wave-plan/SKILL.md` -- Rewrite to accept set ID as primary argument (instead of wave ID), plan ALL waves within the set
- `src/lib/wave-planning.cjs` -- Add `listWavesForSet(state, milestoneId, setId)` helper to extract ordered wave list
- `src/lib/dag.cjs` -- Already has `assignWaves()` and `toposort()` for dependency ordering; reuse these

**Integration approach:** Instead of planning one wave at a time, `/rapid:wave-plan <set-id>` plans all waves in the set:
1. Read all waves from STATE.json for the given set
2. Group waves by dependency (waves with no inter-wave deps can run in parallel)
3. For independent waves: spawn wave research + wave planner agents in parallel (multiple Agent tool calls in one response)
4. For dependent waves: plan sequentially after prerequisites complete
5. After all wave plans exist, spawn all job planners in parallel across all waves
6. Run plan verifier as final gate

This mirrors the existing parallel job planner pattern already in wave-plan Step 5 but lifts it to the wave level.

**Why no new library:** DAG traversal (`dag.cjs`) and parallel Agent spawning are already built and proven.

### 3. Plan Verifier Agent

**Stack additions:** None. New module file + Zod schema only.

**What changes:**
- `src/modules/roles/role-plan-verifier.md` -- New agent role definition
- `src/lib/verify.cjs` -- Add plan verification schemas and helper functions
- `skills/wave-plan/SKILL.md` -- Add verification step after job plans are generated

**Plan verifier responsibilities:**
1. **Coverage check:** Every file in CONTRACT.json exports is covered by at least one job plan's file list
2. **Implementability check:** Each job plan's steps are concrete (no vague "implement the feature" steps)
3. **Overlap detection:** No two job plans in the same wave claim the same file
4. **Dependency coherence:** If job-B depends on job-A's output, job-A is in an earlier or same wave

**Integration approach:** The verifier runs as a read-only subagent after all job plans are generated. It reads all JOB-PLAN.md files and CONTRACT.json, then returns a structured JSON verdict via RAPID:RETURN. The wave-plan orchestrator decides whether to proceed or re-plan.

The existing `validateJobPlans()` in wave-planning.cjs already does coverage + cross-set import validation. The plan verifier extends this with implementability and overlap checks.

**Zod schema (added to verify.cjs):**

```javascript
const PlanVerification = z.object({
  coverageGaps: z.array(z.object({
    file: z.string(),
    exportName: z.string(),
    severity: z.enum(['critical', 'warning']),
  })),
  implementabilityIssues: z.array(z.object({
    jobId: z.string(),
    stepIndex: z.number(),
    issue: z.string(),
    severity: z.enum(['critical', 'warning']),
  })),
  fileConflicts: z.array(z.object({
    file: z.string(),
    claimingJobs: z.array(z.string()),
  })),
  dependencyIssues: z.array(z.object({
    jobId: z.string(),
    dependsOn: z.string(),
    issue: z.string(),
  })),
  verdict: z.enum(['PASS', 'WARN', 'FAIL']),
});
```

**Why no new library:** Zod (already in use) handles the schema. The verification logic is file reading + string analysis -- pure Node.js.

### 4. Numeric ID Resolution

**Stack additions:** None. New utility module only.

**What changes:**
- `src/lib/resolve.cjs` -- New module with `resolveSetId()` and `resolveWaveId()` functions
- `src/bin/rapid-tools.cjs` -- Update `set-init`, `wave-plan`, `discuss`, and `execute` subcommands to pass inputs through resolution first
- All skills that accept set/wave/job IDs -- Update argument parsing to use resolution

**Implementation approach:**

```javascript
/**
 * Resolve user input to a set ID. Supports:
 * - Full ID: "set-01-foundation" -> "set-01-foundation"
 * - Numeric shorthand: "1" -> first set in milestone
 * - Substring match: "foundation" -> "set-01-foundation" (if unique)
 *
 * @param {object} state - Parsed STATE.json
 * @param {string} milestoneId - Current milestone ID
 * @param {string} input - User input
 * @returns {string} Resolved set ID
 * @throws {Error} If not found or ambiguous
 */
function resolveSetId(state, milestoneId, input) {
  const milestone = findMilestone(state, milestoneId);

  // Direct match
  const direct = milestone.sets.find(s => s.id === input);
  if (direct) return input;

  // Numeric shorthand (1-indexed)
  const num = parseInt(input, 10);
  if (!isNaN(num) && num >= 1 && num <= milestone.sets.length) {
    return milestone.sets[num - 1].id;
  }

  // Substring/prefix match
  const matches = milestone.sets.filter(s =>
    s.id.toLowerCase().includes(input.toLowerCase())
  );
  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous: "${input}" matches ${matches.map(s => s.id).join(', ')}`
    );
  }

  throw new Error(
    `Not found: "${input}". Available: ${milestone.sets.map((s, i) => `${i + 1}=${s.id}`).join(', ')}`
  );
}
```

The same pattern applies to wave resolution within a set: `/discuss 1 2` means set 1, wave 2.

**Why no new library:** This is 30 lines of parseInt + string matching + array indexing. The state machine already has all the data structures.

### 5. Batched AskUserQuestion

**Stack additions:** None. Prompt engineering change only.

**What changes:**
- `skills/discuss/SKILL.md` -- Restructure gray area deep-dive to batch related questions

**Current problem:** The discuss phase asks 4 sequential questions per gray area (Q1: approach, Q2: edge cases, Q3: specifics, Q4: confirmation). With 5 gray areas selected, that's up to 20 individual AskUserQuestion calls, each requiring agent processing time between.

**Solution approaches (in preference order):**

**Approach A: Consolidated prompt with numbered options (recommended).**
Present all selected gray areas with proposed defaults in a single freeform AskUserQuestion. The user types which items to override:

```
Gray areas identified. Here are my proposed approaches:

1. Error handling strategy -> Return typed errors with error codes
2. Cache invalidation -> TTL-based with 5min default
3. Auth token storage -> httpOnly cookies
4. API versioning -> URL path prefix (/v1/)
5. Rate limiting -> Token bucket per user

Type the numbers you want to discuss (e.g., "1,3,5"), or "ok" to accept all defaults.
```

This reduces 20 questions to 2-3: one to present defaults, one for the user's overrides, and optionally one confirmation.

**Approach B: multiSelect with grouped options.**
Use AskUserQuestion with `multiSelect: true` to batch approach decisions:

```
Select approaches for each gray area (multiple selection):
- "Error handling: typed errors" -- "Return objects with error code, message, context"
- "Error handling: throw exceptions" -- "Standard throw with Error subclasses"
- "Cache: TTL-based" -- "5-minute TTL with manual invalidation"
- "Cache: event-driven" -- "Invalidate on mutation events"
...
```

This is more structured but may hit AskUserQuestion's practical option limit.

**AskUserQuestion constraints (from research):**
- ~60 second timeout per invocation
- `multiSelect: true` is supported and already used in discuss Step 4
- Freeform text input is supported when no options are provided

**Why no new library:** AskUserQuestion is a built-in Claude Code tool. The change is how the discuss skill structures its prompts.

### 6. Context-Efficient Review with Scoper Delegation

**Stack additions:** New Claude Code subagent definition only.

**What changes:**
- `agents/rapid-scoper.md` -- New subagent definition (Claude Code agent file format)
- `skills/review/SKILL.md` -- Restructure to use scoper before spawning review agents
- `src/lib/review.cjs` -- Add `buildScopedContext()` helper

**The context problem:** The review skill spawns bug-hunter, devils-advocate, and judge agents, each receiving full file contents in their prompt. For large sets, this eats the parent's context window. The 3-agent adversarial pipeline costs $15-45 per cycle (documented in review skill).

**Solution: Scoper subagent.**

```yaml
# agents/rapid-scoper.md
---
name: rapid-scoper
description: Scope and summarize code for review agents. Use before spawning review subagents to compress context.
tools: Read, Grep, Glob
model: haiku
permissionMode: dontAsk
---

You are a code scoping agent. Given a list of changed files and their
dependents, produce a compact JSON summary:

For each file:
1. Purpose (1 sentence)
2. What changed (diff summary, NOT full diff)
3. Key exports/imports
4. Potential risk areas

Return ONLY the JSON summary. Do not include full file contents.
```

**Why a native subagent (agents/ dir) instead of inline Agent tool:**
- The `model: haiku` field runs the scoper on the cheapest/fastest model
- `permissionMode: dontAsk` avoids prompting the user for read permissions
- The scoper is reusable across review invocations without re-specifying its config
- Claude Code's subagent system handles context isolation automatically

**How it integrates with the review pipeline:**
1. Review skill spawns scoper (haiku, fast, cheap) with the changed file list
2. Scoper reads all files, returns a compressed JSON summary
3. Review skill passes the summary (not raw files) to hunter/advocate/judge agents
4. Each review agent operates on the summary, reducing context consumption by ~60-80%

**Cost impact estimate:**
- Current: ~$15-45 per bug hunt cycle (3 agents, each reading full files in parent context)
- With scoper: ~$5-15 per cycle (scoper on Haiku ~$0.50, then 3 agents with summaries)

**Why no new library:** This uses Claude Code's built-in subagent system (agents/ directory with YAML frontmatter). The scoper is a prompt + tool restriction, not code.

### 7. Leaner Review Stage

**Stack additions:** None.

**What changes:**
- `skills/review/SKILL.md` -- Add "lean review" as default for low-complexity waves
- `src/lib/review.cjs` -- Already has `lean-review` as a valid source in ReviewIssue schema
- `src/bin/rapid-tools.cjs` -- Already has `review lean <set-id> <wave-id>` command

**Lean review pattern:**
- Single-pass code review (no hunter/advocate/judge pipeline)
- Scoper produces summary, single reviewer agent checks it
- Default for waves with <5 changed files or jobs marked as "simple" complexity
- Full adversarial pipeline reserved for waves marked as "complex" or "high-risk"

The `review lean` command and schema support already exist. The skill just needs to:
1. Auto-select lean review when wave complexity is low
2. Offer lean vs full as an AskUserQuestion option (add to Step 1 stage selection)

### 8. GSD Decontamination

**Stack additions:** None.

**What changes:** Find and replace all `gsd` references in role modules and skill files with `rapid` equivalents. Per todo.md, agents are spawning as `gsd-phase-researcher`, `gsd-wave planner`, `gsd-review` -- these are string references in markdown files.

This is a mechanical find-and-replace operation across `src/modules/roles/*.md` and `skills/*/SKILL.md`.

---

## Recommended Stack (Complete Picture)

### Core Technologies (No Changes)

| Technology | Version | Purpose | Why No Change Needed |
|------------|---------|---------|---------------------|
| Node.js | >=18 | Runtime | All features are prompt/orchestration changes |
| Zod | 3.25.76 | Schema validation | Add schemas to existing files (verify.cjs) |
| proper-lockfile | 4.1.2 | File locking | State machine unchanged |
| CommonJS | (format) | Module system | All existing code is .cjs; no ESM migration |
| git | (system) | VCS + worktrees | Core isolation mechanism unchanged |
| node:test | (built-in) | Test framework | All new .test.cjs files use this |

### New Modules (No New Dependencies)

| Module | Type | Purpose | Depends On |
|--------|------|---------|------------|
| `src/lib/resolve.cjs` | Library | Numeric ID + substring resolution | state-machine.cjs (findMilestone) |
| `src/lib/resolve.test.cjs` | Test | Tests for numeric ID resolution | node:test |
| `src/lib/verify.cjs` (extend) | Library | PlanVerification schema + helpers | zod, wave-planning.cjs |
| `src/modules/roles/role-plan-verifier.md` | Agent role | Plan coverage + implementability | (reads JOB-PLAN.md files) |
| `agents/rapid-scoper.md` | Subagent | Context compression for review | (Claude Code agent format) |

### Skill Modifications

| Skill | Change Type | Key Change |
|-------|-------------|------------|
| `skills/init/SKILL.md` | Minor extend | Remove "run /rapid:plan" redirect; auto-continue to set-init guidance |
| `skills/discuss/SKILL.md` | Rewrite | Batched questioning via consolidated prompts; accept numeric IDs |
| `skills/wave-plan/SKILL.md` | Rewrite | Accept set ID, plan all waves, add plan verifier step |
| `skills/review/SKILL.md` | Restructure | Add scoper delegation, lean review default, reduce context bloat |
| `skills/set-init/SKILL.md` | Minor update | Accept numeric IDs via resolve.cjs |
| `skills/execute/SKILL.md` | Minor update | Accept numeric IDs; remove unnecessary user confirmation before execute |
| `skills/status/SKILL.md` | Minor update | Show numeric IDs alongside full IDs |

---

## Claude Code Platform Features to Leverage

These are built-in capabilities that v2.1 should exploit. They require NO code -- only skill/agent definition changes.

| Feature | Current v2.0 Usage | v2.1 Usage |
|---------|-------------------|------------|
| Subagent `model` field | Not used (all inherit) | Scoper on `haiku` for cheap/fast context compression |
| Subagent `permissionMode` | Not used | `dontAsk` for read-only agents (scoper, verifier) |
| Subagent `background: true` | Not used | Parallel wave planning agents |
| AskUserQuestion `multiSelect` | Used in discuss Step 4 | Extended to batch approach decisions |
| Agent parallel spawning | Used in wave-plan Step 5 (job planners) | Extended to wave-level parallel planning |
| Subagent `tools` allowlist | Not used | Verifier: Read+Grep+Glob only; Scoper: Read+Grep+Glob only |
| `CLAUDE_CODE_SUBAGENT_MODEL` env var | Not exposed to users | Document for cost optimization (Opus main + Sonnet subagents) |

---

## Alternatives Considered

| Recommendation | Alternative | Why Not |
|----------------|-------------|---------|
| Hand-rolled resolve.cjs (~30 lines) | minimist/yargs CLI arg parsing library | Overkill; need parseInt + string matching, not a CLI framework |
| Zod schemas in verify.cjs | JSON Schema via ajv for plan verification | Zod is the codebase standard; mixing schema systems creates confusion |
| Claude Code native subagent (agents/ dir) | Inline Agent tool spawning for scoper | Native def enables model=haiku and permissionMode=dontAsk declaratively |
| Consolidated freeform prompt for batched Qs | Custom MCP server for batched user input | Massive overengineering; freeform + multiSelect handle this |
| Remove /rapid:plan as separate command | Keep plan as separate user step | Plan is redundant -- init already produces the full roadmap + state |
| Auto-lean-review for simple waves | Always full adversarial pipeline | Adversarial pipeline at $15-45/cycle is wasteful for 3-file changes |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| New npm dependencies | Every feature is achievable with existing stack | Lean on prompt engineering and orchestration |
| XState / Robot / any FSM lib | State machine is 50 lines, proven, and sufficient | Existing state-machine.cjs + state-transitions.cjs |
| External task queue (Bull, BullMQ) | Violates zero-infrastructure constraint | Agent tool parallel spawning |
| TypeScript migration | 26,800+ LOC CommonJS; migration is a separate milestone | .cjs + Zod for runtime validation |
| LangChain / LangGraph | RAPID agents are Claude Code subagents, not LLM-chain agents | Existing subagent framework |
| Any database | Violates git-native constraint | JSON + Markdown in .planning/ |
| Custom MCP server for batching | Overengineering for a prompt restructuring problem | AskUserQuestion freeform + multiSelect |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| zod@3.25.76 | Current | Node.js >=18, CommonJS require() | Provides CJS shim despite being ESM-native |
| proper-lockfile@4.1.2 | Current | Node.js >=18 | Stable, no known issues |
| ajv@8.17.1 | Current | ajv-formats@3.0.1 | Used for CONTRACT.json; don't upgrade independently |
| Claude Code subagent API | Current (2026-03) | agents/ dir with YAML frontmatter | Supports model, permissionMode, tools, hooks, background, isolation |

---

## Installation

No new packages to install. v2.1 is entirely:
- New .cjs library files (resolve.cjs + extend verify.cjs)
- New/modified .md skill and agent role files
- One new agents/ subagent definition (rapid-scoper.md)

```bash
# Verify existing stack is intact
cd ~/Projects/RAPID
node -e "require('zod'); require('proper-lockfile'); console.log('Stack OK')"

# No npm install needed for v2.1
```

---

## Sources

- [Claude Code Subagent Documentation](https://code.claude.com/docs/en/sub-agents) -- Subagent architecture, model selection, permissionMode, background tasks, tool restrictions, agents/ directory format (HIGH confidence, official docs)
- [Claude Code AskUserQuestion Guide](https://smartscope.blog/en/generative-ai/claude/claude-code-askuserquestion-tool-guide/) -- multiSelect support, question limits, timeout behavior (MEDIUM confidence, third-party analysis)
- [Claude Code Sub-Agent Best Practices](https://claudefa.st/blog/guide/agents/sub-agent-best-practices) -- Parallel vs sequential patterns, context window management (MEDIUM confidence, community resource)
- Existing codebase analysis: state-machine.cjs, state-schemas.cjs, state-transitions.cjs, wave-planning.cjs, dag.cjs, review.cjs, returns.cjs, teams.cjs, verify.cjs -- All reviewed directly (HIGH confidence)
- todo.md user feedback -- Direct requirements for numeric IDs, batched questioning, workflow simplification, GSD decontamination, review context efficiency (HIGH confidence, first-party)
- package.json + node_modules/zod/package.json -- Verified Zod 3.25.76 works with CommonJS require (HIGH confidence, tested locally)

---
*Stack research for: RAPID v2.1 Improvements & Fixes*
*Researched: 2026-03-09*
