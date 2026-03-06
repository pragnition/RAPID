# Pitfalls Research

**Domain:** Metaprompting framework overhaul -- adding Sets/Waves/Jobs hierarchy, review module, and adapted merger to existing RAPID plugin
**Researched:** 2026-03-06
**Confidence:** HIGH (based on existing codebase analysis, gsd_merge_agent specs, review module specs, and multi-agent systems research)

Note: This supersedes the 2026-03-03 research. Previous pitfalls about general RAPID architecture (worktree branch exclusivity, lock files, context overflow, etc.) remain valid but are not repeated here. This document focuses specifically on pitfalls when ADDING the v2.0 Mark II features to the existing system.

---

## Critical Pitfalls

### Pitfall 1: State Schema Bifurcation During Hierarchy Migration

**What goes wrong:**
The current state management uses a flat markdown-based STATE.md with regex parsing (`**Field:** value` pattern via `state.cjs`). Migrating from "phases" to Sets > Waves > Jobs requires hierarchical state -- a Job has a status, its parent Wave has a status derived from its Jobs, its parent Set has a status derived from its Waves. The flat STATE.md format cannot represent this nesting. Developers attempt to "extend" the existing format, creating a hybrid where some state is flat markdown and some is nested JSON, leading to parsing failures and data loss on context resets.

**Why it happens:**
The existing `stateGet`/`stateUpdate` functions in `state.cjs` use line-by-line regex matching. This works for flat key-value pairs but cannot represent tree-structured state. The temptation is to keep the existing format "working" while layering new state on top, rather than making a clean break to a structured format.

**How to avoid:**
Replace STATE.md with a JSON-based state file (STATE.json) from the start. The gsd_merge_agent already uses this pattern (`state.json` with schema validation on every read/write). Define the full state schema upfront:
```json
{
  "project": { "milestone": "v2.0", "status": "active" },
  "sets": {
    "auth": {
      "status": "executing",
      "branch": "set/auth",
      "worktree": "/path/to/worktree",
      "waves": {
        "w1": {
          "status": "complete",
          "jobs": {
            "j1": { "status": "complete", "commits": ["abc123"] },
            "j2": { "status": "executing" }
          }
        }
      }
    }
  }
}
```
Keep the `stateGet`/`stateUpdate` API surface but reimplement against JSON. Add a migration function that converts existing STATE.md to STATE.json for brownfield RAPID projects.

**Warning signs:**
- Writing regex patterns with more than 2 levels of nesting
- Adding "section" parsing to state.cjs (e.g., "parse the Jobs section under Wave 2 under Set auth")
- State reads returning `null` for fields that definitely exist
- Two state files existing side by side (STATE.md and STATE.json)

**Phase to address:**
Phase 1 (State Machine) -- must be the first thing built. Everything downstream depends on hierarchical state.

---

### Pitfall 2: Merge Agent Namespace and Path Collisions

**What goes wrong:**
The gsd_merge_agent uses `.gsd-merge/` for state, `gsd-merge/integrate-*` for branches, and `phase/NN-*` for branch naming. RAPID uses `.planning/` for state, `.rapid-worktrees/` for worktrees, and `set/name` for branches. Naively porting the merge agent creates two parallel state systems that don't know about each other. Worse, the merge agent's branch naming (`phase/NN-*`) conflicts with RAPID's set-based branching, and the merge agent's `state.json` (in `.gsd-merge/`) conflicts conceptually with RAPID's own state machine.

**Why it happens:**
The gsd_merge_agent was built as a standalone plugin for GSD, not as a module within RAPID. Its scripts (26 TypeScript files in `scripts/`), schemas, and state management are self-contained -- it has its own `state.ts`, `config.ts`, `plan.ts` which shadow RAPID's existing `state.cjs`, `core.cjs`, `plan.cjs`. The TypeScript/CJS mismatch (gsd uses `.ts`, RAPID uses `.cjs`) adds friction. The gsd_merge_agent has its own hooks directory, its own skill definitions (4 skills: merge, merge-abort, merge-report, merge-status), and its own npm dependencies.

**How to avoid:**
Do NOT port the gsd_merge_agent as a standalone subsystem. Extract the algorithmic components and integrate them into RAPID's existing module structure:
- Conflict detection logic (from `conflict-classify.ts`, `detect-api.ts`, `detect-deps.ts`, `detect-structural.ts`) becomes functions in a new `src/lib/merge/` directory using RAPID's CJS format
- Resolution cascade logic (from `resolve-deterministic.ts`, `resolve-heuristic.ts`, `resolve-ai.ts`) becomes modules under the same directory
- State for merge sessions lives as a nested object inside RAPID's main STATE.json (under a `merge` key per set), not a separate `.gsd-merge/state.json`
- Branch naming uses RAPID's existing `set/name` convention, not `phase/NN-*`
- The bisection and rollback algorithms (from `bisect.ts`, `rollback.ts`) are ported as utility functions, not as standalone workflows
- Merge skills become RAPID skills (`/rapid:merge`, `/rapid:merge-status`) not separate `/merge` commands

Maintain a clear mapping document: "gsd_merge_agent component X -> RAPID module Y".

**Warning signs:**
- Two `state.json` files in different directories
- Branch naming patterns that don't match the rest of RAPID
- Import paths crossing between gsd_merge_agent scripts and RAPID lib
- Having to "sync" state between two different state stores
- `.gsd-merge/` directory appearing in RAPID projects

**Phase to address:**
Phase 3 (Merger Adaptation) -- but the state integration decision must be locked in Phase 1 (State Machine) since the merge state schema needs to be part of the unified state design.

---

### Pitfall 3: Bug Hunting Pipeline Token Explosion

**What goes wrong:**
The hunter/devils-advocate/judge pipeline requires 3 serial agent invocations per review cycle, with each agent needing full codebase context. For a non-trivial codebase, the hunter alone consumes 50-100K tokens reading files + 10-30K generating findings. The devils-advocate then needs those findings PLUS re-reads the codebase (another 50-100K). The judge needs both reports PLUS codebase access. A single review cycle can cost $15-45 on Opus, and the spec says "iterate from the top till the judge judges there are no bugs" -- creating an unbounded loop. Three iterations costs $45-135 per review. Research confirms agent teams use approximately 7x more tokens than standard sessions.

**Why it happens:**
The adversarial pattern is designed for thoroughness, not efficiency. Each agent is a separate subagent with its own 200K context window, so codebase context cannot be shared -- it must be re-read by each agent independently. The scoring system in the draft prompts ("maximize your score", "+3 points for each true positive found") incentivizes agents to be exhaustive rather than focused, generating more findings and more analysis. The draft prompts in `hunter.md` say "Cast a WIDE net" and "it is better to flag a false positive than to miss a real bug" -- this is the correct bias for the hunter but creates volume that cascades through the pipeline.

**How to avoid:**
1. **Scope bug hunting to the diff, not the full codebase.** Each review should only analyze files changed in the current wave/job, not the entire project. The existing `execute.cjs` already has a `getChangedFiles` function that can provide this scoping.
2. **Set a hard iteration cap (max 2 cycles).** After 2 rounds, any remaining DEFERRED items become tickets, not re-hunt targets. Make this configurable but default to 2.
3. **Use Sonnet for the hunter and devils-advocate.** Only the judge needs Opus-level reasoning. Sonnet is 5x cheaper per token. The hunter's job is pattern recognition (Sonnet excels); the DA's job is verification (also pattern-based). Only the judge requires nuanced judgment.
4. **Pre-filter with static analysis.** Run linter, type-checker, and any project-specific lint rules before spawning agents. Remove findings that tools can catch mechanically. No need to spend tokens on "missing type annotation" when `tsc --noEmit` catches it.
5. **Pass structured JSON between agents, not markdown reports.** The hunter's output to the DA should be a JSON array of `{ id, file, line, category, risk, confidence, description, reproduction }` objects validated against a schema. This eliminates parsing ambiguity (see Pitfall 7).
6. **Remove the gamified scoring from prompts.** The "+3 for true positive, -2 for missed" language causes agents to over-report to pad scores. Replace with clear criteria: "Report only findings where you can identify a concrete code path to failure."

**Warning signs:**
- Single review cycle exceeding $20
- Hunter generating more than 20 findings per wave review (indicates over-reporting)
- More than 2 review iterations before convergence
- Devils-advocate CONFIRMING more than 50% of findings (indicates hunter is too conservative, or DA is rubber-stamping)
- Total review cost exceeding execution cost for the same wave

**Phase to address:**
Phase 4 (Review Module) -- token budgets and scoping rules must be part of the initial design, not retrofitted.

---

### Pitfall 4: Playwright UAT Flakiness in Claude Code Plugin Context

**What goes wrong:**
Playwright UAT tests in a Claude Code plugin context face unique challenges: (a) the plugin runs inside Claude Code's sandbox, which may restrict browser process spawning, (b) the dev server must be running before tests execute but the plugin cannot assume it is, (c) test timeouts interact badly with Claude Code's own response timeouts (Bash tool default 120s), and (d) browser lifecycle (launch/close) failures leave zombie Chromium processes that consume memory and block future test runs. The spec calls for "automated" vs "human" UAT steps, but the boundary between these is fluid -- a test that works locally may fail in a worktree with different port assignments.

**Why it happens:**
Playwright assumes it controls the full execution environment -- it launches browsers, manages processes, handles signals. Claude Code plugins run inside a constrained agent environment where shell commands have timeouts (120s default, 600s max), processes can be killed mid-execution, and the working directory might be a worktree (not the main repo). The existing `playwright-cli` skill in `.claude/skills/` exists but its integration with review workflows and multi-worktree environments is untested territory.

**How to avoid:**
1. Always use `npx playwright test` with `--reporter=json` for machine-parseable results. Never parse human-readable Playwright output.
2. Add explicit server health checks before running tests: hit the server URL with a retry loop (3 attempts, 2s apart) before launching the test suite. If the server isn't running, start it in the background and wait for health check to pass.
3. Set Playwright's own timeout (30s default) LOWER than Claude Code's Bash tool timeout to ensure Playwright reports failures before Claude Code kills the process. Use `timeout: 30000` in Playwright config, and `timeout: 120000` in the Bash tool call.
4. Use `browser.close()` in a `finally` block and add a cleanup step that kills orphan Chromium processes: `pkill -f chromium || true` after every test run.
5. Pin tests to a single browser (Chromium). Multi-browser testing adds flakiness without proportional value in this context.
6. For "automated" vs "human" UAT classification: default to "human" for anything involving visual regression, animations, complex drag-and-drop, or interactions that require judgment. Only tag as "automated" when the assertion is purely data-driven (text content, HTTP status, element presence, form submission).
7. Isolate Playwright config per worktree -- each worktree gets its own `playwright.config.ts` with unique base URLs derived from the set's port allocation.
8. Use Playwright's `webServer` config option to auto-start the dev server rather than managing it manually.

**Warning signs:**
- Tests passing locally but failing in worktrees
- "Browser closed unexpectedly" or "Target page, context or browser has been closed" errors
- Zombie Chromium processes accumulating (check with `ps aux | grep chromium`)
- Timeouts that don't produce actionable error messages (killed by Bash tool, not by Playwright)
- Port collision errors between worktrees running UAT simultaneously

**Phase to address:**
Phase 4 (Review Module) -- but Playwright infrastructure decisions (port allocation, config template) should be settled in the set-init phase since UAT depends on deterministic server configuration.

---

### Pitfall 5: State Loss and Inconsistency Across Context Resets

**What goes wrong:**
Claude Code sessions are ephemeral -- when context resets (compaction, new conversation, or crash), all in-memory state is lost. The v2.0 workflow has multi-step operations (discuss > plan > execute > review per wave, iterating across waves, with bug hunt iterations inside review) that span multiple context resets. If state is partially written when a reset occurs, the next session finds an inconsistent state: a Wave marked "executing" with only 2 of 5 Jobs completed, or a review cycle mid-iteration with the hunter's report written but the DA not yet spawned. The new session cannot determine whether to resume, restart, or abort.

**Why it happens:**
The current `stateUpdate` function is atomic for single fields but there is no transaction concept. A wave execution involves updating multiple related fields: wave status, individual job statuses, commit references, and potentially merge state. These updates happen at different points during execution via separate `stateUpdate` calls. If a context reset occurs between updating the wave status to "executing" and updating individual job statuses, the state is internally inconsistent. The gsd_merge_agent handles this with a `mode` field (active/paused/conflicted/completed/aborted) but RAPID's current state model has no equivalent.

**How to avoid:**
1. **Atomic state transitions.** A `transitionWaveStatus(setId, waveId, fromStatus, toStatus, jobUpdates)` function that writes ALL related state changes in a single JSON file write, guarded by the existing lock mechanism. Never update wave status and job statuses in separate writes.
2. **Last-operation breadcrumb.** Every state write includes a `lastOperation` field:
   ```json
   {
     "operation": "execute-jobs",
     "setId": "auth",
     "waveId": "w1",
     "completedJobs": ["j1", "j2"],
     "pendingJobs": ["j3", "j4", "j5"],
     "timestamp": "2026-03-06T10:30:00Z"
   }
   ```
   This gives the next session enough context to determine what happened and how to resume.
3. **In-progress markers.** Borrow the gsd_merge_agent's pattern: the session `mode` field distinguishes between "actively processing" (in-progress, unstable state) and "resting" (stable, resumable state). On session start, if mode is "active" but no agent is running, the state is in a crash-recovery scenario.
4. **Filesystem reconciliation.** On session start, always run a state reconciliation step: compare declared state against filesystem evidence (do the commits exist? do the output files exist? do the worktrees exist?). Trust the filesystem over the state file when they disagree. For example, if a job is marked "executing" but its branch has commits matching the expected output, mark it "complete."
5. **Subagent results to disk first.** Subagent outputs must be persisted to disk (e.g., `.planning/sets/auth/waves/w1/jobs/j1/result.json`) BEFORE the parent orchestrator records completion in STATE.json. If the parent crashes before recording, the next session should find the output file and recover.

**Warning signs:**
- State shows "executing" but no recent commits on the branch
- Jobs marked "complete" but their output files don't exist
- Multiple context resets during a single wave execution (indicates the operation is too long for a single context window)
- Users reporting "it says it's done but nothing happened"
- Wave status and job statuses disagreeing (wave is "executing" but all jobs are "complete")

**Phase to address:**
Phase 1 (State Machine) -- the transaction and recovery model must be baked into the state system from day one, not patched onto a naive read/write layer.

---

### Pitfall 6: Selective Reuse Creating Hidden Coupling

**What goes wrong:**
v2.0 keeps proven v1.0 components (agent framework, plugin shell, context generation, worktrees) while rewriting workflow/planning/review/merge. The kept components have implicit assumptions about the old workflow. Specifically:
- `worktree.cjs` calls `plan.loadSet()` which expects the v1.0 set structure (phases, not waves/jobs)
- `merge.cjs` imports from `contract.cjs`, `dag.cjs`, `worktree.cjs`, `execute.cjs`, and `plan.cjs` -- 5 dependencies that are all being rewritten
- `dag.cjs` provides `getExecutionOrder` which assumes phase-based topological ordering, not wave-based parallel groups
- `contract.cjs` validates against the v1.0 contract schema (single interface boundary, not the multi-layer hierarchy)
- `execute.cjs` has `getChangedFiles` that the review module will need, but the function assumes phase-based branching

These hidden couplings mean "keeping" a module actually requires modifying it, but the modifications aren't planned because the module was categorized as "kept."

**Why it happens:**
Selective reuse creates a false binary: modules are labeled "keep" or "rewrite." In reality, kept modules have tentacles into rewritten modules via imports, shared data structures, and assumptions about the workflow. Looking at `merge.cjs` alone: it requires `contract.cjs`, `dag.cjs`, `worktree.cjs`, `execute.cjs`, and `plan.cjs` at the top of the file. A module cannot be "kept" if all of its dependencies are being rewritten.

**How to avoid:**
1. **Dependency audit before coding.** For each "kept" module, trace every import, every function call, and every data structure assumption. Create an explicit map:
   ```
   worktree.cjs
     imports: lock.cjs (keep), plan.cjs (REWRITE)
     reads: REGISTRY.json (structure may change)
     assumes: set structure has phases, not waves
     verdict: KEPT WITH MODIFICATIONS (update plan.loadSet calls)
   ```
2. **Adapter interfaces.** Define clean interfaces between "kept" and "rewritten" modules. If `worktree.cjs` needs set data, it should accept a standardized set descriptor object (`{ name, branch, worktree, status }`), not call `plan.loadSet()` directly. This decouples the worktree module from the planning data structure.
3. **Reclassify "kept" modules honestly.** The three categories should be:
   - **Kept as-is:** No changes needed (e.g., `lock.cjs`, `returns.cjs`)
   - **Kept with modifications:** API surface stays, internals change (e.g., `worktree.cjs`, `state.cjs`)
   - **Rewrite:** New module, old one deleted (e.g., `merge.cjs`, `plan.cjs`, `dag.cjs`)
4. **Integration tests at boundaries.** Write tests between kept and rewritten modules BEFORE writing new code. These tests serve as the contract that both sides must satisfy. If the test calls `worktree.createWorktree(setDescriptor)` and expects a specific result, both the old adapter and new implementation must pass.

**Warning signs:**
- "Kept" modules failing with `TypeError: Cannot read property 'X' of undefined` (structure mismatch between old and new)
- Import cycles between old and new modules
- Having to modify a "kept" module more than 3 times during implementation
- Functions being duplicated because the old version can't handle new data structures
- Tests for kept modules breaking when new modules are introduced

**Phase to address:**
Phase 0 (Architecture/Pre-work) -- the dependency audit and adapter design must happen before any implementation starts. If this is skipped, every subsequent phase will encounter unexpected breakage in "kept" modules.

---

### Pitfall 7: Agent Prompt Specification Ambiguity Causing Coordination Failures

**What goes wrong:**
Research on multi-agent LLM systems shows that specification ambiguity causes 41.77% of failures and coordination breakdowns cause another 36.94% -- together accounting for ~79% of all multi-agent system failures. RAPID v2.0 introduces at minimum 8 new agent roles (orchestrator, wave planner, job planner, executor, UAT agent, unit-test agent, hunter, devils-advocate, judge) plus the merger agent. With prose-based prompt specifications (as currently drafted in `mark2-plans/review-module/`), agents misinterpret their role boundaries, duplicate work, or produce outputs that downstream agents cannot parse.

**Why it happens:**
The current draft prompts (hunter.md, devils-advocate.md, judge.md) are human-readable prose. They describe what the agent should do but not the exact output schema, not the exact input contract, and not the boundary conditions. The hunter prompt says "produce a structured report" and gives a markdown template, but an LLM will deviate from templates -- adding extra sections, changing field names, omitting fields it deems unimportant. When the devils-advocate receives this free-form output, it must parse it, and parsing failures cascade silently (the DA just misses findings it couldn't extract).

The mark2.md spec explicitly notes "ALL Agent outputs that are meant to be parsed by other agents should be in some sort of structured format" -- but the draft prompts don't enforce this with schemas.

**How to avoid:**
1. **Define JSON schemas for every inter-agent message.** The hunter's output must validate against a `HunterReport` schema. Use the gsd_merge_agent's pattern: it has a `schemas/` directory where all data shapes are defined and validated on read/write.
   ```json
   {
     "type": "object",
     "required": ["summary", "findings"],
     "properties": {
       "summary": { "type": "object", "required": ["total", "critical", "high", "medium", "low"] },
       "findings": {
         "type": "array",
         "items": {
           "type": "object",
           "required": ["id", "file", "line", "category", "risk", "confidence", "description"]
         }
       }
     }
   }
   ```
2. **Output validation in the orchestrator.** After each agent completes, validate its output against the expected schema before passing it to the next agent. If validation fails, retry the agent once with an explicit "your output did not match the required format, here is the schema" instruction. On second failure, abort with error.
3. **Include concrete examples in prompts.** Instead of "produce a structured report," include a 5-entry example that shows exact field names, value formats, and edge cases (empty arrays, null fields).
4. **Consider collapsing the DA and judge.** The hunter > DA > judge pipeline has 2 handoffs -- each is a potential failure point. If token costs and coordination overhead are too high, the DA and judge can be collapsed into a single "verification agent" that both challenges and rules on findings. This reduces handoffs from 2 to 1 and saves one full agent invocation.

**Warning signs:**
- Downstream agents producing "I couldn't parse the previous report" or hallucinating structure
- Agent outputs that look different on every run despite identical inputs
- The orchestrator needing per-agent parsing logic with special cases
- Review cycles that never converge because agents keep reinterpreting each other's outputs
- JSON parse errors when reading inter-agent messages

**Phase to address:**
Phase 2 (Agent System) -- schema definitions must precede prompt writing. Write the schemas first, then write prompts that reference them.

---

### Pitfall 8: Worktree Port and Resource Conflicts Across Concurrent Sets

**What goes wrong:**
RAPID's core value is parallel development across git worktrees. When multiple sets run dev servers simultaneously (each in its own worktree), they compete for ports (3000, 5173, 8080), database connections, file locks, and environment variables. The review module compounds this: UAT tests in Set A's worktree launch a browser against port 3000, but Set B's dev server is also on port 3000 in a different worktree. Tests pass or fail depending on which server responds first.

**Why it happens:**
Git worktrees share the same `.git` directory but have separate working trees. Most project tooling (package.json scripts, .env files, framework configs) assumes a single working directory. When you `npm run dev` in two worktrees, both try to bind the same port unless explicitly configured otherwise. The existing `worktree.cjs` creates worktrees and manages a registry but does not allocate resources.

**How to avoid:**
1. During `/set-init`, generate a deterministic port offset per set. Set 1 gets base port 3000, Set 2 gets 3100, Set 3 gets 3200. Write these to a per-worktree `.env.local` that the project's dev server reads.
2. The review module's Playwright config must derive its `baseURL` from the worktree's port allocation, not use a hardcoded default.
3. For database resources, use separate database names per set (e.g., `myapp_set_auth`) or use SQLite with a file per worktree.
4. Add a resource manifest to STATE.json: which ports and resources each set has claimed. The orchestrator checks for conflicts before spawning.
5. Document that sets sharing external services (production APIs, shared databases) must coordinate access patterns -- this is an inherent limitation of parallel development, not something the tool can fully solve.

**Warning signs:**
- "EADDRINUSE" or "Port already in use" errors during execute or review
- Tests passing in one worktree but failing in another with identical code
- Database writes from one set appearing in another set's test data
- Dev server crashes because another worktree's server grabbed the port first

**Phase to address:**
Phase 1 (Set Init / Worktree Setup) -- port allocation must be part of worktree creation, not deferred to when servers are actually started.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep STATE.md format and add JSON sections inline | No migration needed for existing projects | Two parsing modes (regex + JSON), bugs at boundaries, impossible to validate holistically | Never -- the migration to JSON must be clean |
| Copy-paste gsd_merge_agent scripts into RAPID as-is | Fast initial port, merge works immediately | Two state systems, namespace collisions, TS/CJS split, no shared context with RAPID state | Never -- extract algorithms, don't copy infrastructure |
| Let review agents output free-form markdown instead of JSON | Faster prompt development, more natural agent responses | Parsing failures between agents, format drift across runs, downstream agent confusion | Only for human-facing outputs (progress messages, final user reports) |
| Skip iteration caps on bug hunt pipeline | Maximum thoroughness, no bugs missed | Token costs scale linearly per iteration with diminishing returns after round 2 | Never -- always cap at 2-3 iterations |
| Hardcode port numbers in Playwright configs | Works for single-worktree development | Breaks immediately when 2+ sets run concurrently | Early prototyping only, must be parameterized before review module ships |
| Use Opus for all review agents (hunter, DA, judge) | Best quality findings from every agent | 5x cost vs Sonnet per agent; hunter and DA don't need Opus-level reasoning | Only for the judge agent; hunter and DA should use Sonnet |
| Rewrite kept modules from scratch instead of adapting | Cleaner code, no legacy baggage | Lose proven patterns; introduce new bugs in areas that were stable; double the work | Only when the kept module's architecture is fundamentally incompatible with v2.0 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| gsd_merge_agent -> RAPID | Porting the plugin wholesale as a subdirectory with its own state | Extract conflict detection + resolution algorithms into `src/lib/merge/`; unify state into RAPID's STATE.json; translate all `phase/NN-*` references to `set/name` |
| Playwright -> Claude Code | Assuming browser can always launch; not handling Bash tool timeout | Add health check with retry; set Playwright timeout < Bash timeout; kill orphan Chromium in cleanup |
| Subagent results -> Parent orchestrator | Assuming subagent output is available in parent's memory after context reset | Subagents write results to disk first (`.planning/sets/.../result.json`); parent reads from disk on resume |
| Review module -> Wave lifecycle | Running review as a standalone disconnected command | Review status must be a field in STATE.json under the wave; review completion blocks wave completion |
| Bug hunt agents -> Each other | Passing unvalidated free-form text between hunter/DA/judge | Define JSON schemas for inter-agent messages; validate at every handoff; retry on validation failure |
| v1.0 modules -> v2.0 data structures | Calling `plan.loadSet()` from kept modules expecting old structure | Create adapter functions that translate v2.0 set descriptors to the interface kept modules expect |
| Lock files -> Concurrent worktrees | Using a single lock path assuming one working directory | Lock files must be scoped per resource; worktree-local locks use worktree-relative paths |
| Merge state -> RAPID state | Separate `.gsd-merge/state.json` alongside RAPID's STATE.json | Merge state is a nested object under `sets.{name}.merge` in the unified STATE.json |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full codebase scan per review agent | Review takes 5+ min, costs >$15 per cycle | Scope to changed files via diff; use `getChangedFiles` from execute.cjs | Projects with 50+ files |
| Unbounded bug hunt iterations | Review never converges, costs spiral | Hard cap at 2-3 iterations; DEFERRED findings become tickets | Any project -- structural issue, not scale |
| Serial merge of many sets | Merge phase takes O(n) time with validation per step | Identify independent set clusters that can be merged as parallel sub-trees | More than 4 sets |
| State file contention from concurrent agents | Lock timeouts, stale reads, agents blocked | Minimize lock scope; batch state updates; consider per-set state files that aggregate | More than 3 concurrent agents writing state |
| Codebase context re-read per subagent | 8+ agents each reading the same 50+ files independently | Generate a codebase digest once, pass as context document to all agents | Projects with 50+ source files |
| Running all 3 review types on every wave | Massive time/cost overhead for minor waves | Make UAT and bug-hunt optional per wave; always run unit tests; only run full review at set completion | Any project -- full review on every wave is overkill |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Bug hunting agents reading .env files | Agent reports contain credentials in code snippets | Add .env, credentials.json, and key files to agent exclusion lists in prompts |
| Playwright tests hitting production APIs | Test data written to production; rate limits triggered | Always use test/staging URLs; add pre-test URL validation against allowed domains |
| Merge agent auto-resolving security-sensitive files | AI resolution of auth/crypto code introduces vulnerabilities | Maintain a security-critical file list; always escalate auth, crypto, and secrets files to human review |
| Storing API keys in STATE.json or planning files | Keys committed to git, visible in worktrees | Never store secrets in planning files; use .env (gitignored) exclusively |
| Review reports containing sensitive data | Bug hunt reports may include snippets with secrets/tokens | Sanitize report output; redact patterns matching common secret formats |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent state transitions during multi-agent operations | User has no idea what 8 agents are doing; anxiety leads to interruption | Emit progress events at each transition: "Hunter analyzing 15/47 files...", "DA reviewing finding 3/12...", "Judge ruling on 8 contested findings..." |
| Bug hunt producing 30+ findings before user sees anything | Overwhelming wall of text; user loses context and stops reading | Stream findings incrementally; show critical/high first; use AskUserQuestion to let user stop early if they've seen enough |
| Review requiring user input at unpredictable points | User walks away, comes back to a stalled agent after 20 minutes | Batch all "human" UAT steps together; tell user upfront "I need you for 3 manual checks at steps 5, 9, and 12, then I can continue autonomously" |
| Context reset losing the user's mental model | User returns to a new session with no idea where things stand | First action on session resume: display a 5-line status summary showing current set/wave/job state, what completed, what failed, and what's next |
| Merger reporting conflicts in git jargon | User can't make merge decisions without understanding git diff3 | Translate conflicts to natural language: "Both Set A and Set B changed the login function -- Set A added rate limiting, Set B added OAuth. Which should come first?" |
| Full review running when user just wants a quick check | 20+ minutes and $30+ when user just wanted to see if tests pass | Provide `/rapid:review --quick` (unit tests only) vs `/rapid:review --full` (all three types) |

## "Looks Done But Isn't" Checklist

- [ ] **State Machine:** Often missing recovery from partial failures -- verify that every state transition has an explicit "what if context resets mid-write?" answer
- [ ] **Merge Adapter:** Often missing branch naming translation -- verify ALL gsd_merge_agent `phase/NN-*` references are replaced with RAPID's `set/name` convention
- [ ] **Merge Adapter:** Often missing state unification -- verify no `.gsd-merge/` directory is created; all merge state lives in STATE.json
- [ ] **Bug Hunt Pipeline:** Often missing iteration caps -- verify that max iterations is configurable and defaults to 2
- [ ] **Bug Hunt Pipeline:** Often missing inter-agent schema validation -- verify JSON schemas exist for hunter output, DA output, and judge output
- [ ] **Playwright UAT:** Often missing server startup/shutdown lifecycle -- verify tests don't assume a running dev server and include health checks
- [ ] **Playwright UAT:** Often missing cleanup -- verify no orphan Chromium processes remain after test completion
- [ ] **Worktree Setup:** Often missing port isolation -- verify each worktree gets unique port assignments written to local config
- [ ] **Agent Handoffs:** Often missing output schema validation -- verify every inter-agent message is validated before being passed downstream
- [ ] **Review Module:** Often missing integration with wave lifecycle -- verify review completion updates wave state and blocks wave completion on review pass
- [ ] **Selective Reuse:** Often missing adapter tests -- verify kept modules work with new data structures via integration tests
- [ ] **Selective Reuse:** Often missing dependency audit -- verify a module-by-module import map exists documenting what changes are needed in "kept" modules

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| State schema bifurcation (hybrid MD+JSON) | HIGH | Write migration script from hybrid to pure JSON; update all agent prompts to reference new format; existing projects need one-time conversion |
| Merge namespace collision (dual state files) | MEDIUM | Rename branches, move state into unified STATE.json, delete `.gsd-merge/` directory, update all merge-related imports; can be scripted but needs testing |
| Token explosion in bug hunt | LOW | Add iteration caps and diff-based scoping; no architectural change needed, just prompt and orchestrator config updates |
| Playwright flakiness | LOW | Add retry logic, health checks, cleanup scripts; mostly configuration and wrapper scripts, not architectural |
| State loss on context reset | HIGH | Redesign state writes to be transactional; add reconciliation logic; requires touching every state-writing function in the system |
| Hidden coupling in kept modules | MEDIUM | Write adapter layer, update imports, add integration tests; effort scales linearly with number of kept modules (~12 lib files, but only ~5 have cross-cutting dependencies) |
| Agent specification ambiguity | MEDIUM | Define JSON schemas, add validation layer, rewrite prompts with examples and schema references; effort proportional to agent count (~8-10 agents) |
| Resource conflicts across worktrees | LOW | Add port allocation to set-init; update configs to read from environment; mostly mechanical changes to worktree creation flow |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| State schema bifurcation | Phase 1 (State Machine) | STATE.json exists and is valid JSON representing full Set > Wave > Job hierarchy; zero regex parsing in state access code |
| Merge namespace collision | Phase 1 (State Machine) + Phase 3 (Merger) | Single state file; all branch names follow `set/name` convention; no `.gsd-merge/` directory appears during merge |
| Token explosion in review | Phase 4 (Review Module) | Full review of a 50-file wave completes under $15 on Opus; iteration count never exceeds configured cap; hunter scopes to diff |
| Playwright UAT flakiness | Phase 4 (Review Module) | Playwright tests pass 3/3 consecutive runs in a worktree; no orphan Chromium processes after completion; timeout ordering is correct |
| State loss on context reset | Phase 1 (State Machine) | Kill a session mid-wave-execution 3 times; restart each time; state is consistent and resumable every time |
| Hidden coupling in kept modules | Phase 0 (Architecture/Pre-work) | Dependency map document exists for all 12 lib modules; adapter interfaces defined; integration tests pass with mock v2.0 data structures |
| Agent specification ambiguity | Phase 2 (Agent System) | JSON schemas exist in `schemas/` for every inter-agent message type; validation runs on every handoff; retry-on-failure works |
| Resource conflicts across worktrees | Phase 1 (Set Init) | Two worktrees can run dev servers simultaneously without port conflicts; Playwright configs derive ports from worktree config |

## Sources

- RAPID codebase analysis: `src/lib/state.cjs`, `src/lib/merge.cjs`, `src/lib/worktree.cjs`, `src/lib/execute.cjs` (existing architecture and coupling)
- gsd_merge_agent specs: `mark2-plans/gsd_merge_agent/DOCS.md`, `scripts/`, `schemas/` (merge pipeline design, state machine, 26 TypeScript modules)
- Review module specs: `mark2-plans/review-module/user_plan.md`, `hunter.md`, `devils-advocate.md`, `judge.md`, `unit-test.md`
- Mark II design document: `mark2-plans/mark2.md` (workflow, hierarchy, agent roles, requirements)
- [Why Do Multi-Agent LLM Systems Fail? (UC Berkeley, 2025)](https://arxiv.org/abs/2503.13657) -- 14 failure modes; 41.77% from specification ambiguity, 36.94% from coordination failures
- [Why Multi-Agent LLM Systems Fail and How to Fix Them (Augment Code)](https://www.augmentcode.com/guides/why-multi-agent-llm-systems-fail-and-how-to-fix-them) -- JSON schema specs, structured protocols, independent judge agents, resource ownership
- [How to Detect and Avoid Playwright Flaky Tests (BrowserStack)](https://www.browserstack.com/guide/playwright-flaky-tests) -- auto-wait, isolation, determinism strategies
- [15 Best Practices for Playwright Testing (BrowserStack)](https://www.browserstack.com/guide/playwright-best-practices) -- locator strategies, CI configuration, test isolation
- [Claude Code Cost Management](https://code.claude.com/docs/en/costs) -- Opus $15/$75 per M tokens, Sonnet $3/$15, agent teams use ~7x tokens
- [Claude Code Context Window (Morph)](https://www.morphllm.com/claude-code-context-window) -- 200K limit, performance degrades at 147K, compaction behavior

---
*Pitfalls research for: RAPID v2.0 Mark II workflow overhaul*
*Researched: 2026-03-06*
