# Phase 24: Documentation - Research

**Researched:** 2026-03-08
**Domain:** Technical documentation for a Claude Code plugin (RAPID v2.0 Mark II)
**Confidence:** HIGH

## Summary

Phase 24 is a documentation-only phase that rewrites two files: DOCS.md and README.md. Both files currently reflect v1.0 architecture and are significantly out of date. The existing DOCS.md (387 lines) documents 11 commands, 6 agents, and 17 libraries -- all v1.0 numbers. Mark II has 17 commands, 26+ agent roles, 22 runtime libraries, and an entirely different workflow hierarchy (Sets/Waves/Jobs with state machine, review pipeline, and 5-level merge system). The existing README.md (57 lines) is a minimal landing page with no Mark II content.

No external libraries or tools are needed -- this is purely about writing accurate documentation by reading the codebase. The primary risk is incomplete coverage or stale descriptions. The research below catalogs every component that must be documented so the planner can create comprehensive tasks.

**Primary recommendation:** Structure the work as two plans: (1) DOCS.md full rewrite covering all 17 commands, 26 agent roles, 22 libraries, state machine architecture, CLI reference, and workflow lifecycle; (2) README.md update with Mark II hierarchy, getting started guide, and architecture overview.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOCS-01 | DOCS.md comprehensively documents all commands, agents, architecture, and Mark II workflow | Full inventory below: 17 skills, 26 agent roles, 22 libraries, 5 core modules, state machine, CLI commands, workflow lifecycle |
| DOCS-02 | README.md updated with Mark II hierarchy, workflow, and getting started guide | Mark II hierarchy documented (Project > Milestone > Set > Wave > Job), workflow stages identified from help SKILL.md, install paths verified |
</phase_requirements>

## Inventory: What Must Be Documented

### Commands/Skills (17 total -- v1.0 DOCS.md only has 11)

| # | Skill | Status in Current DOCS.md | Notes |
|---|-------|---------------------------|-------|
| 1 | `/rapid:init` | Present but outdated | Missing: greenfield/brownfield detection, parallel research agents, roadmapper, model selection, team size |
| 2 | `/rapid:install` | Present, mostly accurate | Minor updates needed |
| 3 | `/rapid:help` | Present but outdated | Now shows Mark II workflow with 15 commands |
| 4 | `/rapid:context` | Present, mostly accurate | Minor updates for Mark II context |
| 5 | `/rapid:plan` | Present but outdated | Now creates sets/waves/jobs structure, not just sets |
| 6 | `/rapid:assumptions` | Present, mostly accurate | Minor updates |
| 7 | `/rapid:execute` | Present but outdated | Now executes jobs within waves (not sets directly), subagents per job, reconcile-jobs, --fix-issues mode |
| 8 | `/rapid:status` | Present but outdated | Now shows set > wave > job hierarchy from STATE.json |
| 9 | `/rapid:pause` | Present, mostly accurate | Minor updates |
| 10 | `/rapid:merge` | Present but outdated | Now has 5-level conflict detection, 4-tier resolution, bisection, rollback |
| 11 | `/rapid:cleanup` | Present, mostly accurate | Minor updates |
| 12 | `/rapid:discuss` | **MISSING** | Wave discussion -- captures implementation vision before planning |
| 13 | `/rapid:wave-plan` | **MISSING** | Wave planning pipeline -- research, wave plan, job plans, contract validation |
| 14 | `/rapid:set-init` | **MISSING** | Set initialization -- worktree, scoped CLAUDE.md, set planner |
| 15 | `/rapid:review` | **MISSING** | Review pipeline -- unit test, bug hunt (hunter/advocate/judge), UAT |
| 16 | `/rapid:new-milestone` | **MISSING** | New milestone lifecycle -- archive, bump version, re-plan |
| 17 | `/rapid:resume` | **MISSING** | Resume paused set from checkpoint |

### Agent Roles (26 total -- v1.0 DOCS.md only has 6)

The agent assembly system now uses 5 core modules and 26 role-specific modules. The 5 named agents in config.json (rapid-planner, rapid-executor, rapid-reviewer, rapid-verifier, rapid-orchestrator) are assembled from these, but skills also spawn agents with inline role module content.

| # | Role Module | Purpose | Spawned By |
|---|-------------|---------|------------|
| 1 | role-planner.md | Set decomposition into parallelizable sets | `/rapid:plan` |
| 2 | role-executor.md | Set-level execution in isolated worktree | `/rapid:execute` (v1 compat) |
| 3 | role-job-executor.md | Job-level execution with atomic commits | `/rapid:execute` |
| 4 | role-reviewer.md | Deep code review for merge readiness | `/rapid:merge` (v1 compat) |
| 5 | role-verifier.md | Filesystem artifact verification | `/rapid:execute` |
| 6 | role-orchestrator.md | Top-level workflow coordination | `/rapid:execute` |
| 7 | role-codebase-synthesizer.md | Brownfield codebase analysis | `/rapid:init` |
| 8 | role-context-generator.md | Context file generation (CLAUDE.md, style guide) | `/rapid:context` |
| 9 | role-research-stack.md | Stack/technology research | `/rapid:init` |
| 10 | role-research-features.md | Feature research | `/rapid:init` |
| 11 | role-research-architecture.md | Architecture pattern research | `/rapid:init` |
| 12 | role-research-pitfalls.md | Common pitfalls research | `/rapid:init` |
| 13 | role-research-oversights.md | Oversight/gap research | `/rapid:init` |
| 14 | role-research-synthesizer.md | Combines parallel research outputs into SUMMARY.md | `/rapid:init` |
| 15 | role-roadmapper.md | Creates roadmap with sets/waves/jobs structure | `/rapid:init` |
| 16 | role-set-planner.md | High-level set overview during set-init | `/rapid:set-init` |
| 17 | role-wave-researcher.md | Investigates how to implement wave jobs | `/rapid:wave-plan` |
| 18 | role-wave-planner.md | Produces high-level per-job plans and file ownership | `/rapid:wave-plan` |
| 19 | role-job-planner.md | Creates detailed per-job implementation plans | `/rapid:wave-plan` |
| 20 | role-unit-tester.md | Generates test plan, writes/runs tests | `/rapid:review` |
| 21 | role-bug-hunter.md | Broad static analysis with risk/confidence scoring | `/rapid:review` |
| 22 | role-devils-advocate.md | Disproves hunter findings with code evidence | `/rapid:review` |
| 23 | role-judge.md | Final ACCEPTED/DISMISSED/DEFERRED rulings | `/rapid:review` |
| 24 | role-bugfix.md | Fixes accepted bugs | `/rapid:execute --fix-issues` |
| 25 | role-uat.md | UAT with automated/human step tagging, Playwright | `/rapid:review` |
| 26 | role-merger.md | 5-level conflict analysis, semantic merge resolution | `/rapid:merge` |

### Core Agent Modules (5 total -- unchanged from v1.0)

| Module | Purpose |
|--------|---------|
| core-identity.md | RAPID identity and behavioral guidelines |
| core-returns.md | Structured return protocol (COMPLETE/CHECKPOINT/BLOCKED) |
| core-state-access.md | STATE.json reading and update patterns |
| core-git.md | Git conventions and commit formatting |
| core-context-loading.md | Project context file loading |

### Runtime Libraries (22 total -- v1.0 DOCS.md has 17)

| # | Library | Purpose | New in v2.0? |
|---|---------|---------|-------------|
| 1 | core.cjs | Output formatting, project root detection, config loading | No |
| 2 | lock.cjs | Cross-process atomic locking (mkdir strategy) | No |
| 3 | prereqs.cjs | Prerequisite validation (git, Node.js, jq) | No |
| 4 | init.cjs | Project scaffolding and existing project detection | No |
| 5 | assembler.cjs | Agent assembly from modular components | Updated |
| 6 | returns.cjs | Structured return protocol parsing | No |
| 7 | verify.cjs | Artifact verification (lightweight and heavyweight) | No |
| 8 | context.cjs | Brownfield codebase detection and context generation | No |
| 9 | dag.cjs | Dependency graph (DAG) with topological sort | Updated |
| 10 | contract.cjs | Interface contract validation (Ajv JSON Schema) | No |
| 11 | stub.cjs | Cross-set stub file generation | No |
| 12 | plan.cjs | Set decomposition, planning gates | No |
| 13 | worktree.cjs | Git worktree lifecycle, registry, status | No |
| 14 | execute.cjs | Execution context, verification, wave reconciliation | Updated |
| 15 | merge.cjs | 5-level conflict detection, 4-tier resolution, DAG merge | Major rewrite |
| 16 | teams.cjs | Agent teams detection, teammate config | No |
| 17 | state-machine.cjs | Hierarchical JSON state, validated transitions, crash recovery | **NEW** |
| 18 | state-schemas.cjs | Zod schemas for Project/Milestone/Set/Wave/Job state | **NEW** |
| 19 | state-transitions.cjs | Valid state transition maps for set/wave/job entities | **NEW** |
| 20 | wave-planning.cjs | Wave resolution, wave directory management, contract validation | **NEW** |
| 21 | review.cjs | Review scoping, issue logging, lean review, summary generation | **NEW** |
| 22 | (assembler updated) | Now registers 26 role modules (vs 6 original agents) | Updated |

### CLI Commands (rapid-tools.cjs -- 50+ subcommands)

The CLI is organized into command groups:

| Group | Subcommands | Purpose |
|-------|-------------|---------|
| `lock` | acquire, status, release | Cross-process atomic locking |
| `state` | get, transition, add-milestone, detect-corruption, recover | Hierarchical state management |
| `assemble-agent` | (role), --list, --validate | Agent prompt assembly |
| `parse-return` | (file), --validate | Structured return parsing |
| `verify-artifacts` | (files), --heavy, --report | Artifact existence/test verification |
| `prereqs` | (default), --git-check, --json | Prerequisite checks |
| `init` | detect, scaffold | Project initialization |
| `context` | detect, generate | Codebase analysis |
| `plan` | create-set, decompose, write-dag, check-gate, update-gate, list-sets, load-set | Planning engine |
| `assumptions` | (set-name) | Set assumption surfacing |
| `worktree` | create, list, cleanup, reconcile, status, generate-claude-md, delete-branch | Worktree lifecycle |
| `resume` | (set-name) | Set resumption |
| `execute` | prepare-context, verify, generate-stubs, cleanup-stubs, wave-status, update-phase, pause, resume, reconcile, detect-mode, reconcile-jobs, job-status, commit-state | Execution management |
| `merge` | review, execute, status, integration-test, order, update-status, detect, resolve, bisect, rollback, merge-state | Merge pipeline |
| `set-init` | create, list-available | Set initialization |
| `wave-plan` | resolve-wave, create-wave-dir, validate-contracts, list-jobs | Wave planning |
| `review` | scope, log-issue, list-issues, update-issue, lean, summary | Review management |

### State Machine Architecture

The Mark II state machine is the foundational change from v1.0. It must be prominently documented:

**Hierarchy:** Project > Milestone > Set > Wave > Job

**State transitions (validated, cannot skip):**

```
Set:  pending -> planning -> executing -> reviewing -> merging -> complete
Wave: pending -> discussing -> planning -> executing -> reconciling -> complete
                                                                    failed -> executing (retry)
Job:  pending -> executing -> complete
                              failed -> executing (retry)
```

**Schema (Zod validated):**
- `ProjectState`: version, projectName, currentMilestone, milestones[], timestamps
- `MilestoneState`: id, name, sets[]
- `SetState`: id, status, waves[]
- `WaveState`: id, status, jobs[]
- `JobState`: id, status, timestamps, commitSha, artifacts[]

**Lock-protected writes** with atomic rename via `state-machine.cjs`.

### Mark II Workflow Lifecycle

```
INIT -> CONTEXT -> PLAN -> [ per set: SET-INIT -> DISCUSS -> WAVE-PLAN -> EXECUTE -> REVIEW ] -> MERGE -> CLEANUP
```

1. `/rapid:install` -- One-time setup
2. `/rapid:init` -- Research, roadmap, model/team selection, scaffold
3. `/rapid:context` -- Codebase analysis for brownfield projects
4. `/rapid:plan` -- Decompose into sets/waves/jobs with contracts
5. Per set (parallel across developers):
   a. `/rapid:set-init` -- Create worktree, scoped CLAUDE.md, set overview
   b. `/rapid:discuss` -- Capture wave implementation vision
   c. `/rapid:wave-plan` -- Research, wave plan, job plans, contract validation
   d. `/rapid:execute` -- Parallel job execution with atomic commits
   e. `/rapid:review` -- Unit test + bug hunt + UAT pipeline
6. `/rapid:merge` -- DAG-ordered merge with conflict detection/resolution
7. `/rapid:cleanup` -- Remove worktrees
8. `/rapid:new-milestone` -- Archive and begin next cycle

### Key Concepts (expanded from v1.0)

v1.0 DOCS.md covers: Sets, Interface Contracts, Waves, Planning Gates, Wave Reconciliation, Ownership.

v2.0 adds these concepts:
- **Jobs** -- Granular work units within waves (equivalent to v1.0 "plans")
- **State Machine** -- Hierarchical JSON state with validated transitions
- **Milestones** -- Version cycles with archive/re-plan lifecycle
- **Set Initialization** -- Worktree+branch+scoped CLAUDE.md per set
- **Wave Discussion** -- Structured capture of implementation vision before planning
- **Wave Planning Pipeline** -- Research -> wave plan -> job plans -> contract validation
- **Review Pipeline** -- Unit test + adversarial bug hunt (hunter/advocate/judge) + UAT
- **5-Level Conflict Detection** -- Textual, structural, dependency, API, semantic
- **4-Tier Resolution Cascade** -- Deterministic, heuristic, AI-assisted, human escalation
- **Bisection Recovery** -- Binary search to isolate breaking set interactions
- **Rollback** -- Cascade revert for problematic merges

### .planning/ Directory Structure (expanded)

v1.0 had: PROJECT.md, STATE.md, ROADMAP.md, REQUIREMENTS.md, config.json, sets/, contracts/, context/, waves/

v2.0 adds:
- **STATE.json** -- Machine-readable hierarchical state (source of truth)
- **research/** -- Parallel research agent outputs
- **waves/{setId}/{waveId}/** -- Wave/job plan artifacts (WAVE-CONTEXT.md, WAVE-RESEARCH.md, WAVE-PLAN.md, {jobId}-JOB-PLAN.md)
- **worktrees/** -- Worktree registry
- **.locks/** -- Lock state directory
- **MERGE-STATE.json** -- Per-set merge tracking

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `RAPID_TOOLS` | Path to rapid-tools.cjs CLI | Must be set via /install or setup.sh |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Enable agent teams execution mode | `0` (disabled) |

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| zod | ^3.25.76 | Schema validation for STATE.json |
| ajv | ^8.17.1 | JSON Schema validation for interface contracts |
| ajv-formats | ^3.0.1 | Format validation extensions for Ajv |
| proper-lockfile | ^4.1.2 | File-level locking |

## Architecture Patterns

### Documentation Structure Pattern

DOCS.md should follow a progressive disclosure pattern:
1. **What + Install** (user's first 30 seconds)
2. **Quick Start** (user's first 5 minutes)
3. **Command Reference** (ongoing reference)
4. **Architecture** (for developers extending RAPID)
5. **CLI Reference** (for SKILL.md authors and advanced users)
6. **Configuration** (setup and customization)

README.md should follow the GitHub landing page pattern:
1. **One-liner description + badges**
2. **What It Does** (3-4 bullet points)
3. **Quick Start** (install + first workflow)
4. **Hierarchy diagram** (Sets/Waves/Jobs visual)
5. **Link to DOCS.md** for details
6. **License**

### Pattern: Command Documentation Block

Each command should follow a consistent template:

```markdown
### /rapid:{name}

**{one-line description}**

What it does:
- {action 1}
- {action 2}
- {action 3}

Usage:
\`\`\`
/rapid:{name} [args]
\`\`\`

{additional details: modes, flags, subagents spawned, state transitions}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accurate command list | Manual enumeration | Read all `skills/*/SKILL.md` frontmatter | 17 skills with descriptions already in YAML frontmatter |
| Library descriptions | Write from memory | Read each `*.cjs` JSDoc headers | Source code has accurate function-level docs |
| State transition diagrams | Draw manually | Read `state-transitions.cjs` directly | Transition maps are the single source of truth |
| CLI reference | Write from memory | Read `rapid-tools.cjs` USAGE constant | USAGE string already lists every subcommand with descriptions |

## Common Pitfalls

### Pitfall 1: Documenting v1.0 Concepts as v2.0

**What goes wrong:** Copying v1.0 DOCS.md descriptions and lightly editing them leads to inaccurate descriptions. The workflow has fundamentally changed.
**Why it happens:** DOCS.md has good structure and it is tempting to keep most of it.
**How to avoid:** Treat the existing DOCS.md as a structural template only. Every description must be verified against the actual SKILL.md file for that command.
**Warning signs:** If a description mentions "sets execute in wave order" without mentioning jobs, it is stale.

### Pitfall 2: Missing New Commands

**What goes wrong:** Forgetting to document the 6 new commands (discuss, wave-plan, set-init, review, new-milestone, resume).
**Why it happens:** They did not exist in v1.0 and are easy to overlook when updating.
**How to avoid:** Use the inventory table above (17 skills total) as a checklist.

### Pitfall 3: Outdated Agent Count

**What goes wrong:** Documenting "6 agents" when there are now 26 role modules and 5 named agents.
**Why it happens:** v1.0 had a 1:1 mapping between agents/ directory and agent roles. v2.0 decouples roles from assembled agents.
**How to avoid:** Document role modules (26) separately from assembled agents (5 in config.json), and explain that skills also spawn agents with inline role content.

### Pitfall 4: Incomplete Directory Structure

**What goes wrong:** The .planning/ directory structure diagram misses STATE.json, research/, waves/{setId}/, .locks/, worktrees/, MERGE-STATE.json.
**How to avoid:** Use the expanded directory listing from this research.

### Pitfall 5: Wrong Version Number

**What goes wrong:** plugin.json says version 1.0.0. DOCS.md footer says "RAPID v1.0.0". These may need updating to 2.0.0.
**How to avoid:** Check if version bump is in scope or deferred. Current plugin.json still says 1.0.0. Document the actual version or note that version bump is separate from documentation.

### Pitfall 6: README Getting Too Long

**What goes wrong:** README becomes a copy of DOCS.md instead of a concise landing page.
**How to avoid:** README should be under 150 lines. It links to DOCS.md for details. Focus on: what, install, quick start, hierarchy visual, link to docs.

## Code Examples

### Reading SKILL.md frontmatter for descriptions

```bash
# Extract skill descriptions from YAML frontmatter
for dir in skills/*/; do
  skill=$(basename "$dir")
  desc=$(head -5 "$dir/SKILL.md" | grep "^description:" | sed 's/description: //')
  echo "$skill: $desc"
done
```

### State hierarchy visualization

```
ProjectState
  +-- milestones[]
      +-- MilestoneState
          +-- sets[]
              +-- SetState (pending -> planning -> executing -> reviewing -> merging -> complete)
                  +-- waves[]
                      +-- WaveState (pending -> discussing -> planning -> executing -> reconciling -> complete)
                          +-- jobs[]
                              +-- JobState (pending -> executing -> complete/failed)
```

### Mark II workflow diagram (from help SKILL.md)

```
INIT --> CONTEXT --> PLAN --> [ per set: DISCUSS --> PLAN --> EXECUTE --> REVIEW ] --> MERGE --> CLEANUP
```

## State of the Art

| Old Approach (v1.0) | Current Approach (v2.0 Mark II) | Impact on Docs |
|---------------------|--------------------------------|----------------|
| STATE.md (markdown) | STATE.json (Zod-validated JSON) | Must document JSON schema and state machine |
| 6 agents in agents/ dir | 26 role modules + 5 assembled agents | Agent section needs complete rewrite |
| Sets execute directly | Jobs execute within waves within sets | Hierarchy explanation needed |
| Simple merge with review | 5-level detection + 4-tier resolution | Merge section needs major expansion |
| No review pipeline | Unit test + hunter/advocate/judge + UAT | Entirely new section |
| No per-wave planning | discuss -> research -> wave-plan -> job-plan | New commands and workflow |
| 11 commands | 17 commands | 6 new command sections needed |
| state.cjs (deleted) | state-machine.cjs + state-schemas.cjs + state-transitions.cjs | Architecture section rewrite |

## Open Questions

1. **Version number**: Should DOCS.md and README.md reference v2.0.0 or keep v1.0.0? The plugin.json still says 1.0.0. The planner should instruct documentation to use whichever version is currently in plugin.json (do not change plugin.json -- that is a packaging concern, not a docs concern).

2. **Commands still referencing "Phase N"**: The help SKILL.md has a note about Phase N commands. The documentation should reflect the current state (all commands implemented) without phase references.

3. **Legacy commands/ directory**: 6 legacy .md files exist in commands/ alongside the 17 skills/. DOCS.md currently mentions them. The docs should document skills as the primary mechanism and note that legacy commands exist for backward compatibility.

## Validation Architecture

> nyquist_validation is not explicitly set to false in config.json. Including validation section.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node --test) |
| Config file | package.json (no dedicated test config) |
| Quick run command | `node --test src/lib/*.test.cjs` |
| Full suite command | `node --test src/lib/*.test.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOCS-01 | DOCS.md comprehensively documents all commands, agents, architecture | manual-only | N/A -- documentation accuracy requires human review | N/A |
| DOCS-02 | README.md updated with Mark II hierarchy, workflow, getting started | manual-only | N/A -- documentation accuracy requires human review | N/A |

**Justification for manual-only:** Documentation phases produce markdown files. Correctness is verified by reading them against the codebase, not by automated tests. A checklist-based verification is more appropriate than test automation.

### Sampling Rate
- **Per task commit:** Visual review of rendered markdown
- **Per wave merge:** Cross-reference against SKILL.md frontmatter descriptions and CLI USAGE string
- **Phase gate:** DOCS.md covers all 17 commands, 26 roles, 22 libraries, state machine, CLI reference. README.md under 150 lines with hierarchy, getting started, install.

### Wave 0 Gaps
None -- no test infrastructure needed for documentation-only phase.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: all skills/, src/lib/, src/modules/, src/bin/, config.json, .claude-plugin/plugin.json
- SKILL.md files (17 total, 4787 lines combined) -- authoritative source for command behavior
- rapid-tools.cjs USAGE constant -- authoritative source for CLI reference
- state-schemas.cjs, state-transitions.cjs -- authoritative source for state machine
- src/modules/roles/ (26 role modules, 2800 lines) -- authoritative source for agent roles
- .planning/REQUIREMENTS.md -- DOCS-01, DOCS-02 requirement definitions
- .planning/STATE.md -- project decisions and history
- help/SKILL.md -- Mark II workflow diagram and command listing

### Secondary (MEDIUM confidence)
- .planning/ROADMAP.md -- phase descriptions provide overview context for each subsystem

### Tertiary (LOW confidence)
- None -- all findings are from direct codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no external tools needed, purely documentation
- Architecture: HIGH -- all components directly inspected in codebase
- Pitfalls: HIGH -- based on direct comparison of v1.0 DOCS.md vs v2.0 codebase

**Research date:** 2026-03-08
**Valid until:** No expiry -- this is a snapshot of the codebase at phase completion
