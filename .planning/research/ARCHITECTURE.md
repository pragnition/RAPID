# Architecture Patterns

**Domain:** Claude Code plugin for team-based parallel development orchestration
**Researched:** 2026-03-03

## Recommended Architecture

RAPID is a Claude Code plugin that orchestrates parallel development across git worktrees. The architecture has seven distinct layers, each with clear boundaries and communication patterns. The system follows a "planning gate, independent execution, coordinated merge" lifecycle.

```
                        USER
                         |
                    [Slash Commands]
                         |
                  +------v-------+
                  |  ORCHESTRATOR |  (skills/agents that coordinate)
                  |    LAYER      |
                  +------+-------+
                         |
            +------------+------------+
            |            |            |
     +------v--+   +-----v---+  +----v------+
     | PLANNING |   | WORKTREE|  |   MERGE   |
     |  ENGINE  |   | MANAGER |  |  PIPELINE |
     +------+---+   +----+----+  +-----+-----+
            |             |            |
     +------v-------------v------------v------+
     |           STATE MANAGEMENT LAYER        |
     |   (.planning/ directory, git-native)    |
     +------+-------------+------------+------+
            |             |            |
     +------v--+   +------v---+  +----v------+
     | CONTRACT|   | CONTEXT  |  |   HOOK    |
     | SYSTEM  |   | GENERATOR|  |  ENGINE   |
     +----+----+   +----+-----+  +-----+-----+
          |              |              |
     +----v--------------v--------------v-----+
     |          GIT / FILESYSTEM LAYER         |
     |    (worktrees, branches, lock files)    |
     +----------------------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | Build Phase |
|-----------|---------------|-------------------|-------------|
| **Orchestrator Layer** | Entry point for all RAPID commands; dispatches to subsystems; manages overall workflow lifecycle | Planning Engine, Worktree Manager, Merge Pipeline, State Management | Phase 1 |
| **Planning Engine** | Decomposes work into parallelizable sets; defines boundaries; runs discuss/plan phases | State Management, Contract System, Context Generator | Phase 2 |
| **Contract System** | Defines, validates, and enforces interface contracts between sets | State Management, Planning Engine, Merge Pipeline | Phase 2 |
| **State Management Layer** | Reads/writes all shared state in `.planning/`; manages lock files for concurrent access | All components (central data bus) | Phase 1 |
| **Worktree Manager** | Creates, tracks, and cleans up git worktrees for each set | State Management, Context Generator, Hook Engine | Phase 3 |
| **Context Generator** | Generates per-worktree CLAUDE.md files with full project context, style guides, contracts | State Management, Contract System, Worktree Manager | Phase 3 |
| **Merge Pipeline** | Orchestrates merge review: validates contracts, runs tests, performs code review, manages PRs | State Management, Contract System, Worktree Manager | Phase 4 |
| **Hook Engine** | Provides lifecycle hooks for worktree creation/removal, tool validation, and quality gates | All components via Claude Code hook system | Phase 3-4 |

### Data Flow

**Initialization Flow (one-time per project):**
```
User runs /rapid:init
  -> Orchestrator creates .planning/ directory structure
  -> State Management initializes config.json, STATE.md
  -> Context Generator creates initial style guide from codebase analysis
```

**Planning Flow (once before execution begins):**
```
User runs /rapid:plan
  -> Planning Engine analyzes codebase + requirements
  -> Planning Engine decomposes into sets with boundaries
  -> Contract System generates interface contracts per set
  -> State Management writes set definitions + contracts to .planning/sets/
  -> State Management writes STATE.md (planning-complete)
```

**Execution Flow (per set, in parallel):**
```
User runs /rapid:execute [set-name]  (or /rapid:execute-all)
  -> Orchestrator validates planning is complete (STATE.md check)
  -> Worktree Manager creates git worktree for the set
  -> Context Generator writes CLAUDE.md into worktree (contracts, style, patterns)
  -> Hook Engine fires WorktreeCreate hook
  -> Developer/agent works in isolated worktree
  -> Hook Engine enforces contract boundaries via PreToolUse hooks
```

**Merge Flow (per set, sequential or ordered):**
```
User runs /rapid:merge [set-name]
  -> Merge Pipeline validates all contracts satisfied
  -> Merge Pipeline runs test suite in worktree
  -> Merge Pipeline spawns review agent for deep code review
  -> If issues found: spawns cleanup agent or reports to user
  -> If clean: merges branch into main, cleans up worktree
  -> State Management updates set status
```

**State Synchronization (during execution):**
```
Any agent reads/writes .planning/ files
  -> State Management acquires file lock (lockfile in .planning/.locks/)
  -> Reads/modifies state file
  -> Releases lock
  -> Other agents see updated state on next read
```

## Component Deep Dives

### 1. Orchestrator Layer

**What:** The user-facing entry point. A collection of slash commands that dispatch to the appropriate subsystem. This is the "thin controller" pattern -- commands validate preconditions and delegate immediately.

**Plugin Structure:**
```
rapid/
  .claude-plugin/
    plugin.json              # Plugin manifest
  commands/
    init.md                  # /rapid:init
    plan.md                  # /rapid:plan
    execute.md               # /rapid:execute [set]
    execute-all.md           # /rapid:execute-all
    merge.md                 # /rapid:merge [set]
    status.md                # /rapid:status
    cleanup.md               # /rapid:cleanup
  agents/
    rapid-planner.md         # Planning decomposition agent
    rapid-executor.md        # Per-set execution agent
    rapid-reviewer.md        # Merge review agent
    rapid-cleanup.md         # Post-review fix-up agent
    rapid-orchestrator.md    # Top-level orchestration agent
  skills/
    contract-validator/
      SKILL.md               # Auto-invoked contract validation
    style-guide/
      SKILL.md               # Auto-invoked style enforcement
    set-context/
      SKILL.md               # Loads set-specific context
  hooks/
    hooks.json               # Lifecycle hooks
  settings.json              # Plugin settings (agent teams env var)
```

**Why this structure:** Claude Code's plugin system distinguishes between commands (user-invoked), agents (delegated to by Claude), and skills (auto-invoked by Claude based on context). RAPID needs all three:
- **Commands** for explicit user actions (init, plan, execute, merge)
- **Agents** for complex multi-step workflows that run in their own context
- **Skills** for things Claude should automatically know/enforce (contracts, style)

**Confidence:** HIGH -- directly from official Claude Code plugin documentation.

### 2. State Management Layer

**What:** All shared mutable state lives in `.planning/` at the project root. This directory is committed to git so all developers and agents share the same view. Lock files prevent concurrent modification.

**Directory Structure:**
```
.planning/
  config.json              # Project configuration
  STATE.md                 # Current project lifecycle state
  style-guide.md           # Auto-generated coding conventions
  .locks/                  # Lock files for concurrent access (gitignored)
    state.lock
    sets.lock
  sets/
    set-a/
      DEFINITION.md        # Set scope, boundaries, assigned files
      CONTRACT.md          # Interface contracts this set must honor
      STATUS.md            # Current status (planned/in-progress/review/merged)
      WORKTREE.md          # Worktree path, branch name, metadata
    set-b/
      DEFINITION.md
      CONTRACT.md
      STATUS.md
      WORKTREE.md
  contracts/
    MASTER.md              # All contracts in one file (generated from set contracts)
    interfaces/
      api-endpoints.md     # Shared API endpoint contracts
      data-models.md       # Shared data model schemas
      events.md            # Event/message contracts
  reviews/
    set-a-review.md        # Merge review results
    set-b-review.md
```

**Lock File Strategy:**

Use filesystem-level lock files in `.planning/.locks/` (gitignored). Each lock file corresponds to a state file or directory. A simple approach:

```bash
# Acquire lock
exec 200>.planning/.locks/state.lock
flock -n 200 || { echo "State locked by another process"; exit 1; }

# Do work...

# Release lock (automatic on fd close)
exec 200>&-
```

**Why git-native state:** Zero infrastructure requirement. Works offline. Auditable via git history. Every developer clones the repo and has the full state. Lock files handle the concurrent access case during execution. The `.locks/` directory is gitignored because locks are ephemeral local state.

**Confidence:** HIGH -- git-native state is a well-established pattern (Terraform uses similar approaches). File locking with `flock` is POSIX-standard.

### 3. Planning Engine

**What:** A specialized agent (`rapid-planner`) that analyzes requirements and codebase to decompose work into parallelizable sets. Each set gets clear boundaries: which files/modules it owns, what interfaces it must honor, and what contracts it must fulfill.

**Decomposition Criteria:**
- **File ownership:** Each file belongs to at most one set. No two sets modify the same file.
- **Interface boundaries:** Where sets must interact, contracts are defined upfront.
- **Dependency ordering:** Sets are independent during execution but may have a merge order.
- **Complexity balance:** Sets should be roughly equal in scope.

**Output:** For each set, the planner writes:
- `DEFINITION.md` -- scope, files owned, description of the work
- `CONTRACT.md` -- interfaces this set exposes and consumes
- `STATUS.md` -- initialized to "planned"

**Planning Phase Flow:**
```
1. User provides requirements (or points to existing specs)
2. Planner agent reads codebase structure
3. Planner identifies natural boundaries (modules, packages, layers)
4. Planner proposes set decomposition
5. User reviews and approves (or adjusts)
6. Planner generates contracts between sets
7. User reviews contracts
8. STATE.md updated to "planning-complete"
```

**Why planning gate:** Sets are defined at planning time only (per PROJECT.md constraint). This ensures isolation guarantees are tight. Once planning is complete, sets cannot be added or merged. This avoids the "scope creep during execution" pitfall that breaks parallel development.

**Confidence:** MEDIUM -- decomposition logic is the novel part. Contract-driven development patterns are well-established, but automated decomposition by an LLM agent is less proven. Will need iterative refinement.

### 4. Contract System

**What:** Interface contracts define the boundaries between sets. A contract specifies function signatures, data types, API endpoints, event schemas, or any other interface that one set exposes and another consumes.

**Contract Format:**
```markdown
# Contract: UserService API

## Provider: set-backend
## Consumer: set-frontend

### Endpoints

#### POST /api/users
- Request: { name: string, email: string }
- Response: { id: string, name: string, email: string, created_at: string }
- Status codes: 201 (created), 400 (validation error), 409 (duplicate)

#### GET /api/users/:id
- Response: { id: string, name: string, email: string, created_at: string }
- Status codes: 200 (ok), 404 (not found)

### Types (shared)
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}
```
```

**Enforcement Mechanisms:**
1. **CLAUDE.md injection:** Contracts are included in each worktree's CLAUDE.md so the agent always knows its boundaries.
2. **Skill-based validation:** A `contract-validator` skill that Claude auto-invokes when writing code that touches contract boundaries.
3. **Merge-time validation:** The merge pipeline validates that contracts are satisfied before allowing merge.
4. **Optional: PreToolUse hook** that checks if a file being written belongs to the current set's ownership boundary.

**Why contracts over shared code:** In traditional development, you might use shared packages or types. But in parallel worktree development, each worktree is a snapshot in time. Contracts are documentation-based specifications that can be read and followed without compiling against shared code. They survive across worktrees because they live in `.planning/` which is committed to git before execution begins.

**Confidence:** MEDIUM -- the concept is proven (contract-driven development is well-documented). The specific format and enforcement mechanisms for LLM agents working in worktrees is novel and will need validation.

### 5. Worktree Manager

**What:** Manages the lifecycle of git worktrees: creation, tracking, and cleanup. Each set gets its own worktree with its own branch.

**Worktree Naming Convention:**
```
../worktrees/<repo-name>-rapid-<set-name>
```

**Branch Naming Convention:**
```
rapid/<set-name>
```

**Lifecycle:**
```
Create:
  git worktree add ../worktrees/myproject-rapid-set-a -b rapid/set-a

Track:
  Write worktree path + branch to .planning/sets/set-a/WORKTREE.md

Cleanup (after successful merge):
  git worktree remove ../worktrees/myproject-rapid-set-a
  git branch -d rapid/set-a
  Update .planning/sets/set-a/STATUS.md to "merged"
```

**Integration with Claude Code native worktrees:**

Claude Code v2.1.49+ has native worktree support via `--worktree` flag and `isolation: worktree` in subagent frontmatter. RAPID should leverage this when possible:

- When EXPERIMENTAL_AGENT_TEAMS is available: use agent teams with worktree isolation for execution
- When using subagents: set `isolation: worktree` in the executor agent definition
- Fallback: manual `git worktree` commands via Bash tool

The `WorktreeCreate` and `WorktreeRemove` hooks let RAPID intercept worktree lifecycle events to inject CLAUDE.md files and perform cleanup.

**Confidence:** HIGH -- git worktrees are well-understood. Claude Code's native worktree support is documented in official docs. The `worktree-workflow` and `parallel-worktrees` projects validate this pattern.

### 6. Context Generator

**What:** Generates per-worktree CLAUDE.md files that give each Claude instance full project context. This is critical -- without proper context, agents in worktrees will produce inconsistent code.

**Generated CLAUDE.md Contents:**
```markdown
# Project: [name]

## You Are Working On
Set: [set-name]
Description: [set description]
Files You Own: [list of files/directories]

## Interface Contracts
[Full contract text for all contracts this set is involved in]

## Style Guide
[Auto-generated coding conventions from codebase analysis]

## Architecture Context
[High-level architecture description]
[How your set fits into the overall system]

## Boundaries
- DO NOT modify files outside your set's ownership
- DO NOT change interface contracts
- DO implement all contracts marked as "provider" for your set
- DO write tests for your contract implementations
```

**Style Guide Generation:**

During `/rapid:init`, the Context Generator analyzes the existing codebase to extract:
- Naming conventions (camelCase vs snake_case, file naming patterns)
- Import patterns (absolute vs relative, barrel files)
- Code organization (where tests live, directory structure conventions)
- Formatting (indent style, line length, quote style)
- Framework-specific patterns (React component structure, API handler patterns)

This is written to `.planning/style-guide.md` and included in every worktree's CLAUDE.md.

**Confidence:** HIGH -- CLAUDE.md injection is the standard mechanism for giving Claude context. GSD already demonstrates this pattern with its full-context approach.

### 7. Merge Pipeline

**What:** Orchestrates the process of merging a completed set back into the main branch. This is more than `git merge` -- it includes validation, testing, code review, and optional cleanup.

**Pipeline Stages:**
```
1. Pre-merge validation
   - All contracts satisfied?
   - All owned files have tests?
   - Set status is "in-progress" or "review-ready"?

2. Test execution
   - Run test suite in worktree
   - Run contract-specific tests
   - Report results

3. Code review (merge reviewer agent)
   - Deep review against contracts
   - Style guide compliance
   - Cross-set consistency check
   - Security and quality review

4. Decision gate
   - If clean: proceed to merge
   - If issues found: spawn cleanup agent or report to user

5. Merge execution
   - git merge or rebase (configurable)
   - Resolve any conflicts (or flag for human)
   - Update STATE.md

6. Post-merge
   - Clean up worktree
   - Update set status to "merged"
   - Notify user
```

**Merge Order:**

Sets may have a preferred merge order based on dependency relationships. For example, if Set B depends on interfaces provided by Set A, merge A first. The Planning Engine captures this in `.planning/config.json`:

```json
{
  "merge_order": ["set-a", "set-b", "set-c"],
  "merge_strategy": "rebase"
}
```

**Confidence:** MEDIUM -- the pipeline pattern is straightforward. The novel challenge is the merge reviewer agent reliably catching contract violations. This will need iterative refinement.

### 8. EXPERIMENTAL_AGENT_TEAMS Integration

**What:** When `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is enabled, RAPID can leverage agent teams for coordinated parallel execution. When disabled, RAPID falls back to subagent-based execution.

**Detection:**
```bash
# In hooks or scripts
if [ "$CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS" = "1" ]; then
  # Use agent teams
else
  # Use subagent fallback
fi
```

**Agent Teams Mode:**
- The orchestrator becomes the team lead
- Each set's executor becomes a teammate
- Teammates use worktree isolation
- Shared task list maps to set tasks
- Inter-teammate messaging for cross-set questions

**Subagent Fallback Mode:**
- The orchestrator spawns subagents for each set
- Each subagent has `isolation: worktree` set
- Subagents work independently and report back
- No inter-agent communication (contracts replace the need for this)

**Why both modes:** Agent teams provide richer coordination but are experimental and have known limitations (no session resumption, one team per session). Subagents are more stable and sufficient for most cases because contracts reduce the need for inter-agent communication.

**Plugin settings.json:**
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

**Confidence:** MEDIUM -- agent teams are experimental with documented limitations. The subagent fallback is more reliable. Both paths need to be tested.

## Patterns to Follow

### Pattern 1: Thin Command, Fat Agent
**What:** Slash commands do minimal work (validate preconditions, read state) then delegate to a specialized agent that runs in its own context.
**When:** Every RAPID command.
**Why:** Preserves the user's main context window. Complex multi-step workflows consume context rapidly. Delegating to an agent keeps the main session clean.

**Example:**
```yaml
# commands/plan.md
---
description: Decompose work into parallelizable sets
---

Read .planning/STATE.md to verify the project is initialized.
If not initialized, tell the user to run /rapid:init first.

If initialized, delegate to the rapid-planner agent:
"Analyze the codebase and requirements, then decompose into
parallelizable sets with interface contracts."
```

```yaml
# agents/rapid-planner.md
---
name: rapid-planner
description: Decomposes work into parallelizable sets with contracts
tools: Read, Grep, Glob, Write, Edit, Bash
model: inherit
isolation: worktree
skills:
  - contract-validator
---

You are the RAPID planning agent. Your job is to analyze a codebase
and decompose development work into parallelizable sets...

[Full planning instructions]
```

### Pattern 2: State as Source of Truth
**What:** All workflow state lives in `.planning/` as human-readable Markdown and JSON files. No in-memory state, no external services.
**When:** Always.
**Why:** Every Claude session starts fresh. State must survive across sessions, across worktrees, and across users. Git-committed Markdown is the most durable and debuggable format.

**Example:**
```markdown
# .planning/STATE.md

## Project Status: planning-complete

### Sets
| Set | Status | Worktree | Branch |
|-----|--------|----------|--------|
| set-api | in-progress | ../worktrees/myapp-rapid-set-api | rapid/set-api |
| set-frontend | planned | - | - |
| set-auth | in-progress | ../worktrees/myapp-rapid-set-auth | rapid/set-auth |

### Last Updated: 2026-03-03T14:30:00Z
### Updated By: rapid-orchestrator
```

### Pattern 3: Progressive Context Loading
**What:** Load only the context needed for the current operation. Start with state files, load set definitions as needed, load contracts only when validating.
**When:** Any agent reading from `.planning/`.
**Why:** Context windows are limited. Loading everything upfront wastes tokens. Skills with `disable-model-invocation: true` prevent unnecessary context loading.

### Pattern 4: Hook-Based Enforcement
**What:** Use Claude Code hooks to enforce boundaries deterministically, not just via prompting.
**When:** File ownership boundaries, contract validation, worktree lifecycle.
**Why:** Prompts are probabilistic. A PreToolUse hook that blocks writes to files outside the current set's ownership is deterministic.

**Example:**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/rapid-boundary-check.sh"
          }
        ]
      }
    ],
    "WorktreeCreate": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/rapid-worktree-setup.sh"
          }
        ]
      }
    ]
  }
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Orchestrator
**What:** A single massive agent definition that handles planning, execution, review, and merge.
**Why bad:** Exceeds context limits. Cannot parallelize. Single point of failure. GSD's lesson: split orchestration from execution.
**Instead:** One agent per responsibility. Orchestrator dispatches to specialized agents.

### Anti-Pattern 2: In-Memory State
**What:** Storing workflow state in the orchestrator's context window or environment variables.
**Why bad:** Context windows compact. Sessions end. State is lost. Multiple agents cannot share it.
**Instead:** All state in `.planning/` directory, committed to git.

### Anti-Pattern 3: Shared Mutable Files During Execution
**What:** Multiple sets modifying the same files in parallel.
**Why bad:** Merge conflicts are inevitable. LLMs are bad at resolving merge conflicts. This defeats the purpose of parallel development.
**Instead:** Strict file ownership per set. Shared interfaces defined via contracts, not shared files.

### Anti-Pattern 4: Over-Relying on Agent Communication
**What:** Building complex inter-agent messaging protocols for coordination during execution.
**Why bad:** Agent teams are experimental with known limitations. Messages can be lost. More coordination = more failure modes.
**Instead:** Front-load coordination into planning. Contracts reduce the need for execution-time communication. Each set should be independently executable after planning completes.

### Anti-Pattern 5: Dynamic Set Creation
**What:** Allowing new sets to be created during execution.
**Why bad:** Breaks isolation guarantees. Contract validation becomes impossible if new sets appear that weren't in the original plan.
**Instead:** Sets defined during planning only. If scope changes, re-plan.

## Scalability Considerations

| Concern | 2-3 Sets (Small Project) | 5-8 Sets (Medium Project) | 10+ Sets (Large Project) |
|---------|--------------------------|---------------------------|--------------------------|
| **Planning time** | Minutes, inline in main session | 10-20 minutes, dedicated planner agent | May need hierarchical decomposition |
| **Worktree overhead** | Negligible disk use | ~500MB per worktree (full repo copy) | Consider shallow clones or sparse checkout |
| **Lock contention** | Rare, simple file locks sufficient | Occasional, per-file locks with timeout | May need lock queuing or partitioned state |
| **Merge complexity** | Simple, often conflict-free | Some ordering needed, review time grows | Need automated merge order + batched reviews |
| **Agent coordination** | Subagents sufficient | Agent teams beneficial | Agent teams with hierarchical leads |
| **Context in CLAUDE.md** | Full contracts fit easily | Contracts need summarization | Need contract abstractions per set |

## Suggested Build Order

The dependencies between components dictate a natural build order:

```
Phase 1: Foundation
  [State Management] -> [Orchestrator Shell]
  No other component works without state.

Phase 2: Planning
  [Planning Engine] -> [Contract System]
  Planning produces the artifacts all other components consume.

Phase 3: Execution
  [Worktree Manager] -> [Context Generator] -> [Hook Engine]
  Depends on state and contracts from Phase 2.

Phase 4: Integration
  [Merge Pipeline] -> [Agent Teams Integration]
  Depends on everything above being functional.
```

**Phase 1 (Foundation) must come first** because every other component reads from and writes to `.planning/`. Getting state management right -- including lock files, directory structure, and status tracking -- is the foundation everything else builds on.

**Phase 2 (Planning) must come before Phase 3** because execution requires set definitions and contracts that the planning engine produces. You cannot create worktrees for sets that have not been defined.

**Phase 3 (Execution) must come before Phase 4** because the merge pipeline operates on completed worktrees. Without worktrees and executed code, there is nothing to merge.

**Phase 4 (Integration) comes last** because agent teams integration is an optimization layer on top of a system that already works with subagents.

## Sources

- [Claude Code Plugin Documentation](https://code.claude.com/docs/en/plugins) -- HIGH confidence, official docs
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams) -- HIGH confidence, official docs
- [Claude Code Skills](https://code.claude.com/docs/en/skills) -- HIGH confidence, official docs
- [Claude Code Subagents](https://code.claude.com/docs/en/sub-agents) -- HIGH confidence, official docs
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- HIGH confidence, official docs
- [Worktree Workflow](https://github.com/forrestchang/worktree-workflow) -- MEDIUM confidence, community project
- [GSD Framework](https://github.com/gsd-build/get-shit-done) -- MEDIUM confidence, prior art reference
- [Anthropic Claude Code Issue #4963](https://github.com/anthropics/claude-code/issues/4963) -- MEDIUM confidence, shows community demand for this pattern
- [Contract Driven Development](https://dojoconsortium.org/docs/work-decomposition/contract-driven-development/) -- MEDIUM confidence, established development practice
- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree) -- HIGH confidence, official git docs
- [Claude Code Worktree Guide](https://claudefa.st/blog/guide/development/worktree-guide) -- MEDIUM confidence, third-party guide
