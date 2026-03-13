# Phase 18: Init and Project Setup - Research

**Researched:** 2026-03-06
**Domain:** Multi-agent orchestration, CLI pipeline design, subagent spawning patterns
**Confidence:** HIGH

## Summary

Phase 18 overhauls the `/rapid:init` command from a simple scaffold flow into a multi-agent pipeline: greenfield/brownfield detection, model selection, 5 parallel research agents, a synthesizer agent, and a roadmapper agent that produces the sets/waves/jobs hierarchy with contracts. It also introduces `/rapid:new-milestone` as a new skill and rewrites `/rapid:help` for Mark II.

The codebase already has all foundational building blocks: `init.cjs` for scaffolding, `context.cjs` for brownfield detection, `assembler.cjs` for agent prompt assembly, `state-machine.cjs` for STATE.json management, `contract.cjs` for CONTRACT.json validation, and the Agent tool pattern established in `skills/context/SKILL.md`. The work is primarily: (1) extending the init SKILL.md with new agent-spawning steps, (2) creating 8 new agent role modules, (3) adding CLI subcommands for research/roadmap orchestration, (4) adding model selection to config.json, and (5) creating the new-milestone skill.

**Primary recommendation:** Build the pipeline incrementally -- scaffold/detection first (reuse existing), then research agents, then synthesizer, then roadmapper -- each layer testable independently. Agent roles are prompt-only (markdown files), so the heavy lifting is in SKILL.md orchestration and CLI extensions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single /init command with branching for greenfield vs brownfield (same flow, not distinct paths)
- Full extended flow: Prereqs > git check > existing detection > setup questions (name, desc, team size, model) > scaffold > brownfield detection > [brownfield: synthesizer agent] > 5 parallel research agents > synthesizer agent > roadmapper agent > user approves roadmap > done
- Greenfield skips the codebase synthesizer, runs research with less context
- Brownfield triggers dedicated codebase synthesizer agent before research
- Opus/Sonnet binary choice during init via AskUserQuestion, stored in config.json
- 5 parallel research agents: Stack, Features, Architecture, Pitfalls, Oversights
- Oversights agent captures cross-cutting concerns and important notes
- All agents use Context7 MCP for documentation lookups when available
- Research outputs live in .planning/research/ (STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, OVERSIGHTS.md)
- Separate synthesizer agent reads all 5 outputs and produces unified SUMMARY.md
- Dedicated new codebase synthesizer agent (role-codebase-synthesizer.md), not reuse of existing context subagent
- Roadmapper uses propose-then-approve interaction
- Roadmapper outputs both ROADMAP.md (human-readable) and populates STATE.json (machine-readable)
- Roadmapper writes full interface contracts (CONTRACT.json) per set during roadmap creation
- Roadmapper depth: sets with full contracts + wave stubs (ordering and job titles per wave)
- /new-milestone is a separate skill (skills/new-milestone/SKILL.md)
- /new-milestone archives current milestone, bumps version, runs research > roadmapper pipeline
- /help rewrite with commands grouped by lifecycle stage

### Claude's Discretion
- Internal agent prompt design for research agents, synthesizer, and roadmapper
- How brownfield synthesizer output is structured and passed to research agents
- Exact ROADMAP.md template format for sets/waves/jobs hierarchy
- Error handling and recovery flows during the multi-agent pipeline
- How research agents divide responsibility for Oversights vs Pitfalls

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INIT-01 | /init detects greenfield vs brownfield projects | Existing `detectCodebase()` in context.cjs already returns `hasSourceCode` boolean; extend with deeper heuristics |
| INIT-02 | /init asks user for model selection (opus/sonnet) and team size for set scaling | AskUserQuestion pattern already established; add `model` field to config.json schema |
| INIT-03 | Codebase synthesizer agent analyzes brownfield codebases | New agent role module `role-codebase-synthesizer.md`; builds on existing `buildScanManifest()` output from context.cjs |
| INIT-04 | Parallel research agents investigate stack, features, architecture, pitfalls | 5 parallel Agent tool spawns from SKILL.md; new role modules for each; outputs to .planning/research/ |
| INIT-05 | Research synthesizer combines parallel research outputs into SUMMARY.md | New `role-research-synthesizer.md`; reads 5 research files, deduplicates, cross-references, produces SUMMARY.md |
| INIT-06 | Roadmapper agent creates roadmap with sets/waves/jobs structure | New `role-roadmapper.md`; reads SUMMARY.md + user description; writes ROADMAP.md + STATE.json + CONTRACT.json per set |
| INIT-07 | /install preserves current env var methodology with shell detection | No changes needed -- existing install skill already works correctly |
| INIT-08 | /new-milestone command starts new milestone/version cycle | New skill `skills/new-milestone/SKILL.md`; uses state-machine.cjs milestone management |
| UX-04 | /help shows all Mark II commands with workflow guidance | Complete rewrite of `skills/help/SKILL.md` with new command table |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `node:test` | v25.8.0 | Unit testing | Already used across all 30+ test files in project |
| Zod | 3.25.76 | STATE.json schema validation | Already locked in state-schemas.cjs, used for all state validation |
| Ajv | 8.x | CONTRACT.json validation | Already used in contract.cjs for meta-schema validation |
| proper-lockfile | 4.1.2 | Atomic state writes | Already used in lock.cjs for STATE.json concurrency protection |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Agent tool (Claude Code built-in) | N/A | Subagent spawning | For all 7+ agent invocations during init pipeline |
| AskUserQuestion (Claude Code built-in) | N/A | Structured user prompts | Model selection, roadmap approval, milestone choices |
| Context7 MCP | N/A | Documentation lookups | Research agents use for stack/framework investigation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Agent tool for parallelism | Sequential agent calls | Agent tool already supports parallel spawning; sequential would be much slower for 5 research agents |
| Markdown role files | JSON config for agents | Markdown is the established pattern in src/modules/roles/; changing would break assembler.cjs |

**Installation:**
No new packages needed. All dependencies already installed.

## Architecture Patterns

### New File Structure
```
src/
  modules/
    roles/
      role-codebase-synthesizer.md    # NEW: brownfield deep analysis
      role-research-stack.md          # NEW: stack research agent
      role-research-features.md       # NEW: features research agent
      role-research-architecture.md   # NEW: architecture research agent
      role-research-pitfalls.md       # NEW: pitfalls research agent
      role-research-oversights.md     # NEW: oversights research agent
      role-research-synthesizer.md    # NEW: combines 5 research outputs
      role-roadmapper.md             # NEW: creates roadmap + contracts
skills/
  init/
    SKILL.md                         # REWRITE: extended multi-agent flow
  help/
    SKILL.md                         # REWRITE: Mark II command table
  new-milestone/
    SKILL.md                         # NEW: milestone lifecycle
.planning/
  research/                          # NEW: research agent output directory
    STACK.md
    FEATURES.md
    ARCHITECTURE.md
    PITFALLS.md
    OVERSIGHTS.md
    SUMMARY.md
  config.json                        # EXTEND: add model field
```

### Pattern 1: Agent Spawning from SKILL.md
**What:** Skills use the Agent tool to spawn subagents with role-specific instructions
**When to use:** Any time the skill needs deep analysis or generation that benefits from a dedicated context window
**Example (from existing context skill):**
```
Use the Agent tool with these instructions:
1. The role instructions from `role-context-generator.md`
2. The scan manifest JSON from Step 1
3. Explicit mode instruction
```
This pattern is used verbatim in `skills/context/SKILL.md` Steps 3 and 5.

### Pattern 2: Parallel Agent Spawning
**What:** Multiple Agent tool calls issued simultaneously for independent work
**When to use:** When agents don't depend on each other's output (e.g., 5 research agents)
**Key detail:** Claude Code's Agent tool supports parallel invocation. The SKILL.md instructs the orchestrating model to spawn all 5 research agents in parallel. Each writes its own output file independently.

### Pattern 3: Propose-Then-Approve Interaction
**What:** Agent generates a proposal, presents to user for review, user can accept or request changes
**When to use:** Roadmapper agent output (ROADMAP.md + STATE.json + CONTRACTs)
**Flow:**
1. Roadmapper agent generates full roadmap
2. SKILL.md presents summary to user
3. AskUserQuestion: Accept / Request changes / Cancel
4. If changes requested: re-invoke roadmapper with feedback

### Pattern 4: CLI Subcommand for New Operations
**What:** Extend rapid-tools.cjs with new subcommands for research/roadmap operations
**When to use:** Operations that need filesystem access from SKILL.md
**Existing pattern:** `init detect`, `init scaffold`, `context detect`, `context generate`
**New subcommands needed:**
- `init research-dir` -- ensure .planning/research/ exists, return path
- `init write-roadmap` -- write ROADMAP.md from stdin JSON
- `init write-contracts` -- write CONTRACT.json files per set from stdin JSON
- `init update-state` -- populate STATE.json with sets/waves/jobs from roadmapper output

### Pattern 5: Config.json Model Field
**What:** Store model selection in .planning/config.json
**When to use:** All downstream agents read config.json to determine model to use
**Schema extension:**
```json
{
  "model": "opus",
  "model_profile": "quality",
  ...
}
```
The existing `generateConfigJson()` in init.cjs needs a `model` parameter.

### Anti-Patterns to Avoid
- **Monolithic SKILL.md:** The init SKILL.md will be long (~300+ lines) due to the pipeline. Use clear step numbering and section headers. Do NOT try to split it into multiple skills -- the user invokes `/rapid:init` and expects a single flow.
- **Agents writing STATE.json directly:** Agents should return structured data; the SKILL.md should call CLI commands to write STATE.json atomically. Never have a subagent call `writeState()` directly.
- **Hardcoding model in agent prompts:** Model selection is stored in config.json and should be read by the SKILL.md, not embedded in role files.
- **Research agents depending on each other:** All 5 research agents must be fully independent. Cross-cutting concerns go in Oversights, not distributed across agents.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State validation | Custom JSON validator | Zod schemas in state-schemas.cjs | Already handles all edge cases, type coercion, defaults |
| Contract validation | Custom contract checker | Ajv + CONTRACT_META_SCHEMA in contract.cjs | Already validates full contract structure |
| Lock management | fs.writeFile with flags | proper-lockfile via lock.cjs | Handles stale locks, retry, cleanup |
| Agent prompt assembly | String concatenation | assembler.cjs assembleAgent() | Handles frontmatter, modules, context injection, size warnings |
| Brownfield detection | New file scanning | detectCodebase() + buildScanManifest() from context.cjs | Already handles languages, frameworks, config files, sample file selection |
| Directory scaffolding | Manual fs.mkdir calls | scaffoldProject() from init.cjs | Already handles fresh/reinitialize/upgrade/cancel modes |

**Key insight:** Every infrastructure piece needed for Phase 18 already exists. The work is orchestration (SKILL.md flow) and content (agent role prompts), not infrastructure.

## Common Pitfalls

### Pitfall 1: Agent Context Window Overflow
**What goes wrong:** Subagents receive too much context (entire codebase scan + all research outputs) and hit token limits or produce degraded output.
**Why it happens:** Temptation to pass everything to every agent "just in case."
**How to avoid:** Each agent receives only what it needs. Research agents get project description + brownfield summary (if available). Synthesizer gets only the 5 research output files. Roadmapper gets SUMMARY.md + user description.
**Warning signs:** Agent outputs become generic, repetitive, or miss key details.

### Pitfall 2: Race Conditions in Parallel Research
**What goes wrong:** 5 parallel agents all try to create .planning/research/ directory simultaneously.
**Why it happens:** Directory creation is not atomic.
**How to avoid:** Create .planning/research/ directory BEFORE spawning research agents (in the SKILL.md orchestration step, via CLI subcommand). Agents only write their individual files.

### Pitfall 3: Roadmapper STATE.json Corruption
**What goes wrong:** Roadmapper writes STATE.json without validation, creating invalid state.
**Why it happens:** Bypassing writeState() or constructing state manually without Zod validation.
**How to avoid:** Roadmapper agent returns structured JSON data. SKILL.md passes it to a CLI subcommand that uses writeState() for atomic validated writes.

### Pitfall 4: CONTRACT.json Inconsistency Across Sets
**What goes wrong:** Contracts reference exports/imports that don't match between sets, making parallelization impossible.
**Why it happens:** Each set's contract is generated independently without cross-referencing.
**How to avoid:** The roadmapper must generate ALL contracts together as a unified set, not one-at-a-time. The decision document explicitly states "contracts should be unified between sets."

### Pitfall 5: Model Selection Not Propagated
**What goes wrong:** Model selection (opus/sonnet) is stored in config.json but downstream skills ignore it.
**Why it happens:** No established pattern for reading model from config in SKILL.md files.
**How to avoid:** Add a standard config.json reading step to SKILL.md files. Use the existing `loadConfig()` from core.cjs.

### Pitfall 6: New-Milestone Losing Completed Work
**What goes wrong:** Archiving a milestone accidentally clears STATE.json, losing completed set data.
**Why it happens:** Overwriting STATE.json instead of appending a new milestone.
**How to avoid:** /new-milestone adds a new milestone entry to the milestones array and updates currentMilestone. Never remove completed milestones.

## Code Examples

### Example 1: Extending config.json with model field
```javascript
// Source: existing init.cjs generateConfigJson() pattern
function generateConfigJson(opts = {}) {
  const config = {
    project: {
      name: opts.name || '',
      version: '0.1.0',
    },
    model: opts.model || 'sonnet', // 'opus' or 'sonnet'
    planning: {
      max_parallel_sets: Math.max(1, Math.floor((opts.teamSize || 1) * 1.5)),
    },
  };
  return JSON.stringify(config, null, 2);
}
```

### Example 2: Parallel Agent Spawning in SKILL.md
```markdown
## Step N: Parallel Research Agents

Spawn ALL 5 research agents in parallel using the Agent tool. Each agent
operates independently and writes its output to .planning/research/.

**Agent 1 - Stack Research:**
Use the Agent tool with instructions:
- Role: research-stack
- Input: project description, brownfield summary (if available)
- Output: Write findings to .planning/research/STACK.md
- Use Context7 MCP for documentation lookups

**Agent 2 - Features Research:**
[same pattern, different role and output file]

... (agents 3-5)

Wait for ALL 5 agents to complete before proceeding.
```

### Example 3: Roadmapper Propose-Then-Approve Flow
```markdown
## Step N: Roadmap Generation

Spawn the roadmapper agent:
- Input: .planning/research/SUMMARY.md + project description + team size
- The agent returns a structured roadmap proposal

Present the roadmap summary to the user:
[formatted table of sets, waves, job counts]

Use AskUserQuestion:
- question: "Roadmap proposal"
- Options:
  - "Accept roadmap" -- "Proceed with this roadmap structure"
  - "Request changes" -- "Describe what you'd like changed"
  - "Cancel" -- "Exit without creating roadmap"

If "Request changes": ask user for feedback, re-invoke roadmapper with
the feedback appended to the prompt.
```

### Example 4: New Milestone State Management
```javascript
// Pattern for adding milestone to existing STATE.json
async function addMilestone(cwd, newMilestoneId, newMilestoneName, carryForwardSets) {
  const result = await readState(cwd);
  if (!result || !result.valid) throw new Error('Invalid state');

  const state = result.state;
  const newMilestone = {
    id: newMilestoneId,
    name: newMilestoneName,
    sets: carryForwardSets || [],
  };
  state.milestones.push(newMilestone);
  state.currentMilestone = newMilestoneId;
  await writeState(cwd, state);
}
```

### Example 5: CLI Subcommand Pattern for Research Directory
```javascript
// Follows existing handleContext 'generate' pattern
if (subcommand === 'research-dir') {
  const researchDir = path.join(process.cwd(), '.planning', 'research');
  if (!fs.existsSync(researchDir)) {
    fs.mkdirSync(researchDir, { recursive: true });
  }
  process.stdout.write(JSON.stringify({ researchDir, ready: true }) + '\n');
  return;
}
```

## State of the Art

| Old Approach (v1.0) | Current Approach (v2.0/Mark II) | When Changed | Impact |
|---------------------|--------------------------------|--------------|--------|
| Simple scaffold only | Multi-agent research + roadmap pipeline | Phase 18 | Init becomes the strategic planning engine |
| No model selection | Opus/Sonnet choice stored in config | Phase 18 | All downstream agents use appropriate model |
| Manual roadmap creation | Automated roadmapper with contracts | Phase 18 | Sets/waves/jobs + contracts generated from research |
| /init does brownfield as afterthought | Dedicated codebase synthesizer before research | Phase 18 | Brownfield analysis feeds into research quality |
| Static /help | Lifecycle-grouped command table | Phase 18 | Users understand Mark II workflow stages |

**Deprecated/outdated:**
- v1.0 `STATE.md` generation still exists in `generateStateMd()` but STATE.json is the sole source of truth per Phase 17 decision
- v1.0 simple scaffold flow still works but will be superseded by the extended pipeline

## Open Questions

1. **How do research agents access Context7 MCP?**
   - What we know: Context7 is an MCP server available to Claude Code. Research agents are spawned via the Agent tool.
   - What's unclear: Whether subagents spawned via Agent tool automatically inherit MCP server access from the parent context, or if MCP access needs to be explicitly configured in frontmatter.
   - Recommendation: Test with a simple subagent first. If MCP is not inherited, add a note in research agent prompts to use WebSearch/WebFetch as fallback.

2. **Parallel Agent Tool invocation limit**
   - What we know: The Agent tool can be called multiple times. The context skill uses it sequentially (analysis then write).
   - What's unclear: Whether Claude Code has a hard limit on concurrent Agent tool invocations (5 parallel research agents is ambitious).
   - Recommendation: Design for parallel but include a sequential fallback path. If parallel fails, run agents one-at-a-time with accumulated context.

3. **CONTRACT.json file placement for roadmapper output**
   - What we know: v1.0 contracts live in `.planning/sets/{set-name}/CONTRACT.json`.
   - What's unclear: Whether the roadmapper should create set directories during init, or defer to /set-init (Phase 19).
   - Recommendation: Roadmapper creates `.planning/sets/{set-name}/CONTRACT.json` during init since "contracts are foundational and must exist before any set starts executing."

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (v25.8.0) |
| Config file | None needed -- native to Node.js |
| Quick run command | `node --test src/lib/init.test.cjs` |
| Full suite command | `node --test src/lib/*.test.cjs src/bin/*.test.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INIT-01 | Greenfield/brownfield detection in init flow | unit | `node --test src/lib/init.test.cjs` | Exists but needs extension |
| INIT-02 | Model selection stored in config.json | unit | `node --test src/lib/init.test.cjs` | Needs new tests |
| INIT-03 | Codebase synthesizer output structure | unit | `node --test src/lib/context.test.cjs` | Exists but needs extension |
| INIT-04 | Research output file creation | unit | `node --test src/lib/init.test.cjs` | Needs new tests |
| INIT-05 | SUMMARY.md synthesized from 5 inputs | unit | `node --test src/lib/init.test.cjs` | Needs new tests |
| INIT-06 | Roadmap structure + STATE.json population | unit+integration | `node --test src/lib/init.test.cjs` | Needs new tests |
| INIT-07 | Install preserves env var methodology | manual-only | N/A (shell interaction) | N/A -- no changes needed |
| INIT-08 | New milestone state management | unit | `node --test src/lib/state-machine.test.cjs` | Needs new tests |
| UX-04 | Help command shows Mark II commands | manual-only | N/A (static output) | N/A |

### Sampling Rate
- **Per task commit:** `node --test src/lib/init.test.cjs`
- **Per wave merge:** `node --test src/lib/*.test.cjs`
- **Phase gate:** `node --test src/lib/*.test.cjs src/bin/*.test.cjs`

### Wave 0 Gaps
- [ ] `src/lib/init.test.cjs` -- extend with model selection, research dir creation, roadmap write tests
- [ ] `src/lib/state-machine.test.cjs` -- extend with addMilestone/archiveMilestone tests
- [ ] `src/bin/rapid-tools.test.cjs` -- extend with new init subcommand tests (research-dir, write-roadmap, etc.)

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/lib/init.cjs`, `src/lib/context.cjs`, `src/lib/assembler.cjs`, `src/lib/state-machine.cjs`, `src/lib/contract.cjs` -- read and analyzed directly
- Existing skills: `skills/init/SKILL.md`, `skills/context/SKILL.md`, `skills/help/SKILL.md`, `skills/install/SKILL.md` -- read and analyzed directly
- Existing agent roles: `src/modules/roles/role-context-generator.md`, `src/modules/roles/role-orchestrator.md` -- read and analyzed directly
- Project state: `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/config.json` -- read and analyzed directly

### Secondary (MEDIUM confidence)
- Agent tool parallel invocation behavior -- based on Claude Code documentation patterns and context skill usage

### Tertiary (LOW confidence)
- MCP server inheritance in subagent contexts -- needs empirical testing
- Parallel Agent tool invocation limits -- needs empirical testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- extends established patterns (SKILL.md + role modules + CLI subcommands)
- Pitfalls: HIGH -- derived from concrete codebase analysis of existing patterns
- Agent prompt design: MEDIUM -- new territory for 8 role modules, but follows existing role-context-generator.md pattern
- Parallel agent execution: MEDIUM -- untested at 5-agent scale in this codebase

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- all patterns are project-internal, not dependent on external API changes)
