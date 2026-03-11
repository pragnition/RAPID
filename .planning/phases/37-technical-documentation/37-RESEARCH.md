# Phase 37: Technical Documentation - Research

**Researched:** 2026-03-11
**Domain:** Technical documentation authoring for a Claude Code plugin (Markdown, multi-file reference docs)
**Confidence:** HIGH

## Summary

Phase 37 creates `technical_documentation.md` as an index file linking to sub-documents covering all 18 skills, 31 agents, configuration options, state machine transitions, and troubleshooting. The README (Phase 36) already links to `technical_documentation.md` at the repo root -- this link must resolve. The CONTEXT.md locks a multi-file structure with lifecycle-ordered sections, agent cards with type badges, synopsis+link skill documentation, and symptom/cause/fix troubleshooting cards.

The implementation is purely a documentation-writing task -- no code changes, no library installs, no tests. The primary challenge is accuracy: cataloging all 31 agents with correct spawn relationships, documenting all 18 skills with full argument syntax, and rendering all three state machines (set, wave, job) as ASCII diagrams. The secondary challenge is referencing SKILL.md files as authoritative rather than duplicating content (success criterion 4).

**Primary recommendation:** Treat this as a structured content extraction and assembly task. All source material exists in the codebase -- agent YAML frontmatter, SKILL.md files, state-transitions.cjs, state-schemas.cjs, and error handling patterns in src/lib/. Extract, organize by lifecycle stage, and write.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Document structure:**
- Multi-file: technical_documentation.md as index with summaries, linking to separate docs per section
- Workflow-ordered: sections follow the RAPID lifecycle stages
- 5 lifecycle stages: Setup (install, init, context) -> Planning (plan, set-init, discuss, wave-plan) -> Execution (execute) -> Review (review) -> Merge & Cleanup (merge, cleanup, new-milestone)
- Index file includes TOC with 1-2 sentence summaries per linked section

**Agent catalog:**
- Structured cards per agent: purpose (1 sentence), spawned by, inputs, outputs, when it runs (~5-8 lines each)
- Type tag/badge system: Orchestrator, Leaf, Pipeline, or Research -- visually distinguishes agent roles
- No tool/capability lists per agent -- keep cards lean
- Includes ASCII dispatch tree showing full spawn hierarchy (which agents spawn which)
- Agents grouped by lifecycle stage (matching the 5-stage structure)

**Skill documentation:**
- Synopsis + link pattern: brief synopsis with full argument syntax, then "See skills/<name>/SKILL.md for full details"
- Full argument syntax in synopsis: `/rapid:set-init <set-id> [--skip-plan]` style
- SKILL.md files are the authoritative source -- technical docs reference, not duplicate
- Dedicated configuration section covering .env variables, RAPID_TOOLS, STATE.json schema, user-configurable settings
- Configuration also mentioned inline within relevant skills
- State machine section uses ASCII state diagrams for set/wave/job transitions

**Troubleshooting:**
- Symptom/cause/fix card format per issue
- Core failures only (~5-6 most common): subagent timeout, merge conflicts, state corruption, worktree cleanup, stale lock files
- Cross-references to state machine docs for state-related issues (not self-contained)
- No "before you report a bug" checklist

### Claude's Discretion

- Exact file naming for sub-documents (e.g., docs/agents.md vs docs/agent-reference.md)
- Which 5-6 specific failure modes to include based on codebase error handling patterns
- Ordering of agents within each lifecycle stage group
- How to render type tags in Markdown (bold prefix, emoji, etc.)

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOC-03 | technical_documentation.md created as power user reference with all skills, configuration, and state machine documentation | All 18 skills cataloged with argument syntax; state machine transitions extracted from state-transitions.cjs; configuration options from config.json and .env |
| DOC-04 | technical_documentation.md includes agent role reference (all 30+ agents: purpose, spawned by, inputs, outputs) | All 31 agent files inventoried with YAML frontmatter; spawn hierarchy mapped from skill files and agent role modules |
| DOC-05 | technical_documentation.md includes troubleshooting guide for common failure modes | 6 failure modes identified from error handling patterns in src/lib/ and skill files |

</phase_requirements>

## Inventory: Source Material

This section catalogs all source material the planner needs to reference when creating tasks. This is the "raw data" that gets assembled into documentation.

### All 18 Skills (by Lifecycle Stage)

**Setup (3 skills):**
| Skill | Command | Arguments | Source |
|-------|---------|-----------|--------|
| install | `/rapid:install` | _(none)_ | `skills/install/SKILL.md` |
| init | `/rapid:init` | _(none)_ | `skills/init/SKILL.md` |
| context | `/rapid:context` | _(none)_ | `skills/context/SKILL.md` |

**Planning (6 skills):**
| Skill | Command | Arguments | Source |
|-------|---------|-----------|--------|
| plan | `/rapid:plan` | _(none)_ | `skills/plan/SKILL.md` |
| set-init | `/rapid:set-init` | `<set-id>` | `skills/set-init/SKILL.md` |
| discuss | `/rapid:discuss` | `<wave-id>` or `<set-id> <wave-id>` | `skills/discuss/SKILL.md` |
| wave-plan | `/rapid:wave-plan` | `<wave-id>` or `<set-id> <wave-id>` | `skills/wave-plan/SKILL.md` |
| plan-set | `/rapid:plan-set` | `<set-id>` | `skills/plan-set/SKILL.md` |
| assumptions | `/rapid:assumptions` | `<set-id>` | `skills/assumptions/SKILL.md` |

**Execution (1 skill):**
| Skill | Command | Arguments | Source |
|-------|---------|-----------|--------|
| execute | `/rapid:execute` | `<set-id>` `[--fix-issues]` `[--retry-wave <wave-id>]` | `skills/execute/SKILL.md` |

**Review (1 skill):**
| Skill | Command | Arguments | Source |
|-------|---------|-----------|--------|
| review | `/rapid:review` | `<set-id>` | `skills/review/SKILL.md` |

**Merge & Cleanup (3 skills):**
| Skill | Command | Arguments | Source |
|-------|---------|-----------|--------|
| merge | `/rapid:merge` | _(none)_ or `<set-id>` | `skills/merge/SKILL.md` |
| cleanup | `/rapid:cleanup` | `<set-id>` | `skills/cleanup/SKILL.md` |
| new-milestone | `/rapid:new-milestone` | _(none)_ | `skills/new-milestone/SKILL.md` |

**Utility (4 skills):**
| Skill | Command | Arguments | Source |
|-------|---------|-----------|--------|
| status | `/rapid:status` | _(none)_ | `skills/status/SKILL.md` |
| pause | `/rapid:pause` | `<set-id>` | `skills/pause/SKILL.md` |
| resume | `/rapid:resume` | `<set-id>` | `skills/resume/SKILL.md` |
| help | `/rapid:help` | _(none)_ | `skills/help/SKILL.md` |

**Note on argument patterns:**
- Commands accepting `<set-id>` support both string IDs (e.g., `auth-system`) and numeric indices (e.g., `1`)
- Commands accepting `<wave-id>` support dot notation (e.g., `1.1` for set 1, wave 1), string IDs, or the two-argument `<set-id> <wave-id>` form

### All 31 Agents (with YAML Frontmatter)

| Agent | Color | Tools | Spawned By | Type |
|-------|-------|-------|------------|------|
| rapid-orchestrator | blue | Read, Write, Bash, Grep, Glob, Agent | User (top-level) | Orchestrator |
| rapid-codebase-synthesizer | blue | Read, Grep, Glob, Bash | /rapid:init | Research |
| rapid-research-stack | blue | Read, Grep, Glob, WebFetch, WebSearch | /rapid:init | Research |
| rapid-research-features | blue | Read, Grep, Glob, WebFetch, WebSearch | /rapid:init | Research |
| rapid-research-architecture | blue | Read, Grep, Glob, WebFetch, WebSearch | /rapid:init | Research |
| rapid-research-pitfalls | blue | Read, Grep, Glob, WebFetch, WebSearch | /rapid:init | Research |
| rapid-research-oversights | blue | Read, Grep, Glob, WebFetch, WebSearch | /rapid:init | Research |
| rapid-research-synthesizer | blue | Read, Write, Grep, Glob | /rapid:init | Pipeline |
| rapid-roadmapper | blue | Read, Write, Grep, Glob | /rapid:init | Leaf |
| rapid-context-generator | blue | Read, Write, Grep, Glob, Bash | /rapid:context | Leaf |
| rapid-planner | blue | Read, Write, Edit, Bash, Grep, Glob | /rapid:plan | Leaf |
| rapid-set-planner | blue | Read, Write, Grep, Glob | /rapid:set-init | Leaf |
| rapid-wave-analyzer | blue | Read, Grep, Glob | /rapid:plan-set | Leaf |
| rapid-wave-researcher | blue | Read, Grep, Glob, Bash, WebFetch | /rapid:wave-plan | Research |
| rapid-wave-planner | blue | Read, Write, Grep, Glob | /rapid:wave-plan | Leaf |
| rapid-job-planner | blue | Read, Write, Grep, Glob | /rapid:wave-plan | Leaf |
| rapid-plan-verifier | blue | Read, Write, Grep, Glob | /rapid:wave-plan, /rapid:plan-set | Leaf |
| rapid-executor | green | Read, Write, Edit, Bash, Grep, Glob | /rapid:execute (legacy) | Leaf |
| rapid-job-executor | green | Read, Write, Edit, Bash, Grep, Glob | /rapid:execute | Leaf |
| rapid-scoper | blue | Read, Grep, Glob | /rapid:review | Leaf |
| rapid-unit-tester | cyan | Read, Write, Bash, Grep, Glob | /rapid:review | Leaf |
| rapid-bug-hunter | yellow | Read, Grep, Glob, Bash | /rapid:review | Leaf |
| rapid-devils-advocate | purple | Read, Grep, Glob | /rapid:review | Leaf |
| rapid-judge | red | Read, Write, Grep, Glob | /rapid:review | Leaf |
| rapid-uat | cyan | Read, Write, Bash, Grep, Glob | /rapid:review | Leaf |
| rapid-reviewer | red | Read, Grep, Glob, Bash | /rapid:review | Leaf |
| rapid-bugfix | green | Read, Write, Edit, Bash, Grep, Glob | /rapid:execute --fix-issues | Leaf |
| rapid-merger | green | Read, Write, Bash, Grep, Glob | /rapid:merge (legacy) | Leaf |
| rapid-set-merger | green | Read, Write, Edit, Bash, Grep, Glob | /rapid:merge | Pipeline |
| rapid-conflict-resolver | yellow | Read, Write, Edit, Bash, Grep, Glob | /rapid:merge (via set-merger escalation) | Leaf |
| rapid-verifier | blue | Read, Bash, Grep, Glob | Internal verification | Leaf |

**Type classification rationale:**
- **Orchestrator**: Has `Agent` tool, spawns other agents (only `rapid-orchestrator`)
- **Pipeline**: Runs multi-step pipelines and may trigger further agent dispatch (e.g., `rapid-set-merger` triggers `rapid-conflict-resolver` via orchestrator, `rapid-research-synthesizer` runs after research agents)
- **Research**: Uses `WebSearch`/`WebFetch` for external knowledge gathering
- **Leaf**: Terminal agent that does focused work and returns results

### State Machine Transitions (from state-transitions.cjs)

**Set transitions:**
```
pending -> planning -> executing -> reviewing -> merging -> complete
```

**Wave transitions:**
```
pending -> discussing -> planning -> executing -> reconciling -> complete
                                                                 ^
failed ───────────────────────────────────────────> executing ────┘
```

**Job transitions:**
```
pending -> executing -> complete
                    \-> failed -> executing (retry)
```

**State schemas (from state-schemas.cjs):**
- `ProjectState`: version, projectName, currentMilestone, milestones[], lastUpdatedAt, createdAt
- `MilestoneState`: id, name, sets[]
- `SetState`: id, status (SetStatus enum), waves[]
- `WaveState`: id, status (WaveStatus enum), jobs[]
- `JobState`: id, status (JobStatus enum), startedAt?, completedAt?, commitSha?, artifacts[]

**Derived status rules:**
- Wave status derived from jobs: all pending = pending, all complete = complete, any failed + none executing = failed, otherwise = executing
- Set status derived from waves: all pending = pending, all complete = complete, otherwise = executing

### Configuration Options

**`.env` file (required):**
| Variable | Purpose | Default |
|----------|---------|---------|
| `RAPID_TOOLS` | Absolute path to `src/bin/rapid-tools.cjs` | Set by `/rapid:install` |

**`.planning/config.json` (project-level):**
| Key | Type | Values | Purpose |
|-----|------|--------|---------|
| `mode` | string | `"yolo"`, etc. | Execution mode |
| `parallelization` | boolean | `true`/`false` | Enable parallel job dispatch |
| `commit_docs` | boolean | `true`/`false` | Auto-commit documentation files |
| `model_profile` | string | `"quality"`, `"speed"` | Model selection profile |
| `workflow.research` | boolean | `true`/`false` | Enable research phase |
| `workflow.plan_check` | boolean | `true`/`false` | Enable plan verification |
| `workflow.verifier` | boolean | `true`/`false` | Enable post-execution verification |
| `granularity` | string | `"fine"`, `"coarse"` | Job sizing granularity |

**Key directories and files:**
| Path | Purpose |
|------|---------|
| `.planning/` | All project state and planning artifacts |
| `.planning/STATE.json` | Machine-readable project state (Zod-validated) |
| `.planning/config.json` | Project configuration |
| `.planning/.locks/` | Lock files (gitignored) |
| `.planning/worktrees/REGISTRY.json` | Worktree registry |
| `.planning/sets/{set-name}/` | Per-set planning artifacts |
| `.planning/waves/{set-name}/{wave-id}/` | Per-wave job plans |
| `.rapid-worktrees/` | Git worktree checkout directories |

### Troubleshooting: Common Failure Modes (6 identified)

Based on error handling patterns across `src/lib/` and skill files:

**1. RAPID_TOOLS not set**
- **Symptom:** `[RAPID ERROR] RAPID_TOOLS is not set` on any command
- **Cause:** Shell config not sourced after install, or .env file missing/corrupted
- **Fix:** Run `/rapid:install` or manually set `RAPID_TOOLS=/path/to/src/bin/rapid-tools.cjs` in shell config and `.env`
- **Source:** Every SKILL.md has this check as the first operation

**2. Stale lock files**
- **Symptom:** Commands hang or fail with lock contention errors; `[RAPID] Lock "state-machine" compromised` warning
- **Cause:** Agent crashed mid-operation, leaving a lock file in `.planning/.locks/`
- **Fix:** Lock files auto-expire after 5 minutes (300,000ms stale threshold in `src/lib/lock.cjs`). If still stuck, manually delete `.planning/.locks/*.target.lock`
- **Source:** `src/lib/lock.cjs` -- `STALE_THRESHOLD = 300000`, `onCompromised` handler

**3. STATE.json corruption**
- **Symptom:** `Cannot transition: STATE.json is missing or invalid` error; state validation failures
- **Cause:** Concurrent writes without lock (should not happen with CLI), manual edits, or crash during write
- **Fix:** `node "${RAPID_TOOLS}" state detect-corruption` to diagnose, then `node "${RAPID_TOOLS}" state recover` to restore from git. Recovery runs `git checkout HEAD -- .planning/STATE.json`
- **Source:** `src/lib/state-machine.cjs` -- `detectCorruption()`, `recoverFromGit()`

**4. Worktree cleanup blocked**
- **Symptom:** `/rapid:cleanup` refuses to remove a worktree, showing `removed: false, reason: "dirty"`
- **Cause:** Uncommitted changes exist in the worktree
- **Fix:** cd into the worktree, commit or stash changes, then retry cleanup. Or `git worktree remove --force <path>` (destructive -- loses uncommitted work)
- **Source:** `skills/cleanup/SKILL.md` -- blocks removal if dirty

**5. Subagent timeout / missing return marker**
- **Symptom:** `Warning: Job '{jobId}' returned without a RAPID:RETURN marker. Marking as failed.`; jobs stuck in `executing` state
- **Cause:** Subagent hit context window limit, crashed, or failed to emit structured return. Stale `executing` status left behind.
- **Fix:** Smart re-entry handles this automatically -- re-run `/rapid:execute <set-id>` and stale `executing` jobs are re-dispatched. Failed jobs can be retried with the same command.
- **Source:** `skills/execute/SKILL.md` -- Step 3e (missing return marker handling), Step 2 (smart re-entry)

**6. Merge conflicts during merge pipeline**
- **Symptom:** `git merge-tree --write-tree` returns exit code 1; subagent dispatched for conflict resolution; potential escalation to human
- **Cause:** Two sets modified overlapping files or had semantic conflicts. Normal in multi-set development.
- **Fix:** Follow the merge pipeline prompts. High-confidence conflicts auto-resolve (T1-T3). Low-confidence conflicts escalate to human via AskUserQuestion. If integration tests fail post-merge, bisection recovery identifies the breaking set.
- **Source:** `skills/merge/SKILL.md` -- Step 3b (fast-path), Steps 3c-3e (subagent resolution), Step 7 (integration gate + bisection)

## Architecture Patterns

### Recommended Document Structure

Based on the locked decisions (multi-file, lifecycle-ordered, index with summaries):

```
technical_documentation.md          # Index file with TOC and summaries
docs/
  setup.md                          # Install, init, context skills + prerequisites
  planning.md                       # Plan, set-init, discuss, wave-plan, plan-set, assumptions
  execution.md                      # Execute skill details
  review.md                         # Review pipeline details
  merge-and-cleanup.md              # Merge, cleanup, new-milestone
  agents.md                         # Full agent catalog with dispatch tree
  configuration.md                  # .env, config.json, STATE.json schema, directories
  state-machines.md                 # Set/wave/job transitions with ASCII diagrams
  troubleshooting.md                # Symptom/cause/fix cards
```

**Note:** The `docs/` directory does not yet exist. It must be created. The exact file names are Claude's discretion per CONTEXT.md.

### Pattern: Synopsis + Link

Each skill entry in the lifecycle docs should follow this pattern:

```markdown
### `/rapid:execute <set-id> [--fix-issues] [--retry-wave <wave-id>]`

Dispatches parallel subagents (one per job) across all waves in a set. Waves process
sequentially; jobs within a wave run in parallel. Smart re-entry: skips completed jobs,
retries failed jobs. Supports dual-mode execution (subagents or agent teams).

See [skills/execute/SKILL.md](../skills/execute/SKILL.md) for full step-by-step details.
```

### Pattern: Agent Card

Each agent entry should follow this pattern (locked at ~5-8 lines):

```markdown
#### rapid-job-executor
**Leaf** | green

Implements a single job within a wave per JOB-PLAN.md. Commits atomically per task
within the set's worktree.

| | |
|---|---|
| Spawned by | `/rapid:execute` |
| Inputs | JOB-PLAN.md content, file ownership list, worktree path |
| Outputs | RAPID:RETURN (COMPLETE/CHECKPOINT/BLOCKED) with artifacts and commits |
```

### Pattern: Troubleshooting Card

Each troubleshooting entry uses symptom/cause/fix format:

```markdown
### Stale lock files

**Symptom:** Commands hang indefinitely or print `[RAPID] Lock "state-machine" compromised`

**Cause:** An agent crashed during a state write, leaving a lock directory
in `.planning/.locks/`.

**Fix:** Locks auto-expire after 5 minutes. If stuck longer, delete
`.planning/.locks/<name>.target.lock` manually. See [State Machines](state-machines.md)
for transition details.
```

### Pattern: ASCII State Diagram

State machine documentation should use ASCII diagrams:

```
Set Lifecycle:
  pending ──> planning ──> executing ──> reviewing ──> merging ──> complete

Wave Lifecycle:
  pending ──> discussing ──> planning ──> executing ──> reconciling ──> complete
                                              │                          ^
                                              v                          │
                                           failed ──────────────────────>┘
                                                        (retry)

Job Lifecycle:
  pending ──> executing ──> complete
                  │
                  v
               failed ──> executing (retry)
```

### Pattern: Agent Dispatch Tree (ASCII)

```
User
  └── rapid-orchestrator (coordinates all phases)
        ├── /rapid:init
        │     ├── rapid-codebase-synthesizer
        │     ├── rapid-research-stack ─────────┐
        │     ├── rapid-research-features ──────┤ (5 parallel)
        │     ├── rapid-research-architecture ──┤
        │     ├── rapid-research-pitfalls ──────┤
        │     ├── rapid-research-oversights ────┘
        │     ├── rapid-research-synthesizer
        │     └── rapid-roadmapper
        ├── /rapid:context
        │     └── rapid-context-generator
        ├── /rapid:plan
        │     └── rapid-planner
        ├── /rapid:set-init
        │     └── rapid-set-planner
        ├── /rapid:plan-set
        │     └── rapid-wave-analyzer
        ├── /rapid:wave-plan
        │     ├── rapid-wave-researcher
        │     ├── rapid-wave-planner
        │     ├── rapid-job-planner (per job)
        │     └── rapid-plan-verifier
        ├── /rapid:execute
        │     ├── rapid-job-executor (parallel per job)
        │     └── rapid-bugfix (--fix-issues mode)
        ├── /rapid:review
        │     ├── rapid-scoper
        │     ├── rapid-unit-tester
        │     ├── rapid-bug-hunter ──> rapid-devils-advocate ──> rapid-judge
        │     ├── rapid-uat
        │     └── rapid-reviewer
        └── /rapid:merge
              ├── rapid-set-merger (per set)
              └── rapid-conflict-resolver (per mid-confidence conflict)
```

Note: `rapid-executor`, `rapid-merger`, and `rapid-verifier` are legacy/internal agents kept for backward compatibility.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State machine data | Parse source code manually | Read `src/lib/state-transitions.cjs` and `src/lib/state-schemas.cjs` directly | These are the canonical source of truth; any manual enumeration will drift |
| Agent catalog data | Write agent info from memory | Extract from `agents/*.md` YAML frontmatter | 31 agents with accurate descriptions already exist in structured format |
| Skill argument syntax | Guess at arguments | Read each `skills/*/SKILL.md` file header and Step 0 | SKILL.md files contain the actual argument parsing logic |
| Spawn hierarchy | Guess which skill spawns which agent | Read skill files for `Spawn the **rapid-*` patterns | Spawn relationships are documented in skill step descriptions |
| Configuration options | Enumerate from memory | Read `.planning/config.json` and `src/lib/core.cjs` `loadConfig()` | Config schema may have changed; source code is authoritative |

## Common Pitfalls

### Pitfall 1: Duplicating SKILL.md content
**What goes wrong:** Technical docs become a second copy of skill documentation, leading to maintenance burden and desync.
**Why it happens:** Natural tendency to be comprehensive in reference docs.
**How to avoid:** Synopsis + link pattern (locked decision). Each skill gets a 2-3 sentence summary plus full argument syntax, then points to SKILL.md as authoritative.
**Warning signs:** Any skill section longer than ~10 lines.

### Pitfall 2: Missing agents or wrong spawn relationships
**What goes wrong:** Agent catalog shows 28 agents instead of 31, or lists wrong spawner.
**Why it happens:** Agent count has grown through multiple phases; spawn relationships are implicit in skill files.
**How to avoid:** Enumerate ALL files in `agents/` directory. Cross-reference spawn relationships against skill files by searching for `Spawn the **rapid-` patterns.
**Warning signs:** Agent count does not match `ls agents/*.md | wc -l` (currently 31).

### Pitfall 3: Outdated state machine diagrams
**What goes wrong:** ASCII diagrams show wrong transitions (e.g., missing the `failed -> executing` retry path for waves).
**Why it happens:** State machines were refined over multiple phases; old documentation may show stale transitions.
**How to avoid:** Extract transitions directly from `src/lib/state-transitions.cjs` -- the three objects `SET_TRANSITIONS`, `WAVE_TRANSITIONS`, `JOB_TRANSITIONS` are the single source of truth.
**Warning signs:** Diagram does not match the transition objects exactly.

### Pitfall 4: Config.json documentation misses runtime defaults
**What goes wrong:** Documentation says a config key is "required" when it actually has a fallback default in `loadConfig()`.
**How to avoid:** Read `src/lib/core.cjs` `loadConfig()` for the defaults object. Current default: `lock_timeout_ms: 300000`. Other keys have no defaults (they are project-specific).

### Pitfall 5: Broken relative links between docs
**What goes wrong:** Links from `technical_documentation.md` to `docs/agents.md` or from `docs/troubleshooting.md` to `docs/state-machines.md` do not resolve.
**Why it happens:** The `docs/` directory does not exist yet; relative paths depend on file layout.
**How to avoid:** Create `docs/` directory first, then use consistent relative path format. Test all links by verifying file existence.

### Pitfall 6: README link to technical_documentation.md breaks
**What goes wrong:** README already has `[technical_documentation.md](technical_documentation.md)` link -- the index file MUST be at repo root with this exact name.
**Why it happens:** Might accidentally put index inside `docs/` subdirectory.
**How to avoid:** Place index file at repo root as `technical_documentation.md`. Sub-documents go in `docs/`.

## Code Examples

### Extracting agent frontmatter (for catalog generation)

The YAML frontmatter in each agent file follows this format:
```yaml
---
name: rapid-job-executor
description: RAPID job executor agent -- implements a single job within a wave per JOB-PLAN.md
tools: Read, Write, Edit, Bash, Grep, Glob
model: inherit
color: green
---
```

All 31 files follow this exact structure. The `description` field provides the one-sentence purpose for agent cards.

### State transition objects (canonical source for diagrams)

From `src/lib/state-transitions.cjs`:
```javascript
const SET_TRANSITIONS = {
  pending: ['planning'],
  planning: ['executing'],
  executing: ['reviewing'],
  reviewing: ['merging'],
  merging: ['complete'],
  complete: [],
};

const WAVE_TRANSITIONS = {
  pending: ['discussing'],
  discussing: ['planning'],
  planning: ['executing'],
  executing: ['reconciling'],
  reconciling: ['complete'],
  complete: [],
  failed: ['executing'],
};

const JOB_TRANSITIONS = {
  pending: ['executing'],
  executing: ['complete', 'failed'],
  complete: [],
  failed: ['executing'],
};
```

### Derived status logic (for state machine documentation)

From `src/lib/state-machine.cjs`:
```javascript
// Wave status derived from jobs
function deriveWaveStatus(jobs) {
  if (jobs.length === 0) return 'pending';
  const allPending = jobs.every(j => j.status === 'pending');
  if (allPending) return 'pending';
  const allComplete = jobs.every(j => j.status === 'complete');
  if (allComplete) return 'complete';
  const anyFailed = jobs.some(j => j.status === 'failed');
  const anyExecuting = jobs.some(j => j.status === 'executing');
  if (anyFailed && !anyExecuting) return 'failed';
  return 'executing';
}

// Set status derived from waves
function deriveSetStatus(waves) {
  if (waves.length === 0) return 'pending';
  const allPending = waves.every(w => w.status === 'pending');
  if (allPending) return 'pending';
  const allComplete = waves.every(w => w.status === 'complete');
  if (allComplete) return 'complete';
  return 'executing';
}
```

### Lock configuration (for troubleshooting docs)

From `src/lib/lock.cjs`:
```javascript
const STALE_THRESHOLD = 300000; // 5 minutes
const RETRY_CONFIG = {
  retries: 10,
  factor: 2,
  minTimeout: 100,
  maxTimeout: 2000,
  randomize: true,
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DOCS.md (979 lines, monolithic) | technical_documentation.md index + docs/ sub-files | Phase 37 (now) | DOCS.md is v2.0 and outdated; technical_documentation.md replaces it as reference |
| `rapid-executor` (set-level) | `rapid-job-executor` (job-level) | v2.0 (Phase 18) | Old executor kept for backward compat; new docs reference job-executor as primary |
| `rapid-merger` (single agent) | `rapid-set-merger` + `rapid-conflict-resolver` (per-set subagent + per-conflict) | v2.2 (Phase 34-35) | Old merger kept for backward compat |
| GSD naming | RAPID naming | v2.1 (Phase 25) | All GSD references removed; docs must use RAPID naming exclusively |

**Deprecated items to note but not duplicate:**
- `DOCS.md` -- outdated, will be superseded by technical_documentation.md
- `rapid-executor` -- legacy set-level executor, kept for v1.0 compat
- `rapid-merger` -- legacy single-agent merger, kept for v1.0 compat

## Open Questions

1. **Should DOCS.md be deleted or kept alongside technical_documentation.md?**
   - What we know: DOCS.md is v2.0 (outdated), README already points to technical_documentation.md
   - What's unclear: Whether any external links or user workflows reference DOCS.md directly
   - Recommendation: Keep DOCS.md for now (out of scope for Phase 37); consider deletion in a future cleanup phase

2. **How deep should configuration documentation go?**
   - What we know: config.json has ~8 keys; .env has 1 key; STATE.json has a full Zod schema
   - What's unclear: Whether to document every STATE.json field or just the user-facing ones
   - Recommendation: Document config.json and .env fully. For STATE.json, document the top-level schema and entity statuses (user-facing for debugging) but not internal fields like timestamps. Reference state-schemas.cjs for full schema.

3. **Which agents to mark as "legacy"?**
   - What we know: `rapid-executor`, `rapid-merger`, and `rapid-verifier` appear to be internal/legacy
   - What's unclear: Whether `rapid-verifier` is still actively used or truly legacy
   - Recommendation: List all 31 agents. Mark `rapid-executor` and `rapid-merger` as "legacy (v1.0 backward compat)" in their cards. Include `rapid-verifier` normally unless investigation shows it is unused.

## Tone and Style

Per CONTEXT.md specifics section:
- Conversational-technical tone (Astro/Vercel reference) -- carried forward from Phase 36 README
- Describe current state only -- no version callouts or changelogs
- SKILL.md files are authoritative -- technical docs reference, not duplicate

## Sources

### Primary (HIGH confidence)
- `agents/*.md` -- all 31 agent files with YAML frontmatter (read and inventoried)
- `skills/*/SKILL.md` -- all 18 skill files (read for argument syntax and spawn patterns)
- `src/lib/state-transitions.cjs` -- canonical state machine transitions (read in full)
- `src/lib/state-schemas.cjs` -- canonical state schemas (Zod definitions, read in full)
- `src/lib/state-machine.cjs` -- state machine operations including derived status logic (read in full)
- `src/lib/lock.cjs` -- lock implementation with stale thresholds (read in full)
- `src/lib/core.cjs` -- config loading with defaults (read in full)
- `.planning/config.json` -- current project config (read)
- `.env.example` -- env var documentation (read)
- `README.md` -- current README with link to technical_documentation.md (read in full)
- `DOCS.md` -- existing documentation, outdated but useful as reference (read)

### Secondary (MEDIUM confidence)
- Spawn relationships derived from SKILL.md patterns (cross-referenced across multiple files)
- Agent type classifications (Orchestrator/Leaf/Pipeline/Research) derived from tools and behavior patterns

### Tertiary (LOW confidence)
- None -- all findings verified against source code

## Metadata

**Confidence breakdown:**
- Source material inventory: HIGH -- every agent, skill, and state machine file has been read and cataloged
- Architecture patterns: HIGH -- document structure is locked in CONTEXT.md; patterns derived from existing codebase conventions
- Troubleshooting: HIGH -- failure modes identified directly from error handling code in src/lib/ and skill files
- Spawn hierarchy: MEDIUM -- derived from searching skill files for agent spawn patterns; some agents (rapid-verifier) have less clear spawn context

**Research date:** 2026-03-11
**Valid until:** Indefinite (documentation of existing stable codebase; no external dependencies or fast-moving libraries)
