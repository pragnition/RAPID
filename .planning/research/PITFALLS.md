# Pitfalls Research

**Domain:** Multi-agent development coordination framework (Claude Code plugin)
**Researched:** 2026-03-03
**Confidence:** HIGH (official docs verified), MEDIUM (multi-source corroboration), LOW (flagged)

---

## Critical Pitfalls

### Pitfall 1: Custom Agents Cannot Spawn Subagents or Teams

**What goes wrong:**
When RAPID runs as a Claude Code plugin with a custom agent (via `claude --agent rapid`), the Task tool (subagent spawner) is not available in the session. The Teammate tool exists and `spawnTeam` succeeds, but no subagents can actually be populated into teams. This is a confirmed bug (GitHub issue #23506, duplicate of #13533) that makes agent teams non-functional from custom agent sessions.

**Why it happens:**
Claude Code's initialization pathway for custom agents does not inject the Task tool into the available tool set. The Teammate tool and TaskCreate/TaskList/TaskUpdate/TaskGet tools load, but the core Task tool needed to spawn subagents is missing. This appears to be an architectural limitation in how custom agent sessions are bootstrapped.

**How to avoid:**
- Design RAPID to work primarily through skills invoked from a plain `claude` session, not through `--agent` mode
- Use the `settings.json` `agent` key in the plugin to activate a default agent, but test extensively whether this path also hits the same limitation
- Implement a fallback path that uses subagents (via the Task tool in a non-agent session) when EXPERIMENTAL_AGENT_TEAMS is unavailable
- Keep the orchestrator as a skill (e.g., `/rapid:plan`, `/rapid:execute`) rather than a standalone agent entry point

**Warning signs:**
- `Error: getTeammateModeFromSnapshot called before capture` in logs
- Teams are created but have no members
- Subagent-dependent operations silently fail or produce empty results

**Phase to address:**
Phase 1 (Core Infrastructure) -- this is foundational. If the plugin's entry point is wrong, everything built on top breaks. Validate the spawning pathway before building any orchestration logic.

**Confidence:** HIGH -- verified via official Claude Code docs and confirmed GitHub issue

---

### Pitfall 2: Git Worktree Branch Exclusivity Causes Deadlocks

**What goes wrong:**
A branch can only be checked out in one worktree at a time. If RAPID's orchestration creates a worktree for set A on branch `feature/set-a`, and then a merge review process or cleanup agent needs to check out that same branch in another worktree, git refuses. This leads to deadlocks where the merge reviewer cannot examine code it needs to review, or cleanup agents cannot access the branch they need to fix.

**Why it happens:**
Git enforces a hard constraint: each branch can exist in exactly one worktree simultaneously. This is not configurable. Developers accustomed to `git checkout` patterns don't realize that worktrees impose this mutual exclusion.

**How to avoid:**
- Never design workflows that require checking out the same branch in multiple worktrees simultaneously
- The merge reviewer should work on the main/integration branch and use `git diff` or `git merge --no-commit` to examine incoming changes without needing the source branch's worktree
- If cleanup is needed on a set's branch, route it to the agent already operating in that worktree, rather than spawning a new agent in a new worktree targeting the same branch
- Document this constraint prominently in RAPID's planning phase output so users understand why "just checkout that branch in another worktree" is impossible

**Warning signs:**
- `fatal: 'feature/set-a' is already checked out at '/path/to/worktree'`
- Merge review processes that hang waiting for branch access
- Cleanup agents failing to start

**Phase to address:**
Phase 2 (Git Worktree Management) -- must be baked into the worktree lifecycle design from the start. Retrofitting is expensive because it affects every workflow that touches branches across worktrees.

**Confidence:** HIGH -- verified via official git-worktree documentation

---

### Pitfall 3: File-Based Lock Race Conditions Under Concurrent Agent Access

**What goes wrong:**
RAPID's design calls for "git-native shared state with lock files to prevent concurrent modification." File-based locking is notoriously fragile. Two agents running in parallel can both read a lock file as "unlocked," both attempt to acquire it, and both succeed because the check-and-set is not atomic. On NFS or network filesystems (common in team environments), even O_EXCL is unreliable. Stale locks from crashed agents cause permanent deadlocks with no automatic recovery.

**Why it happens:**
File-based locking requires atomic check-and-set operations. Simple patterns like "check if file exists, then create it" have a TOCTOU (time-of-check-to-time-of-use) race window. Claude Code agents are separate OS processes, so OS-level file locking (flock) would work, but only on local filesystems. Agents that crash or are killed mid-operation leave lock files behind with no cleanup.

**How to avoid:**
- Use `mkdir` for lock acquisition -- `mkdir` is atomic on POSIX systems and fails if the directory already exists, eliminating the TOCTOU race
- Alternatively, use git's own index.lock pattern: create a lockfile with O_EXCL (exclusive create), which is atomic on local filesystems
- Implement mandatory stale lock detection: store PID + timestamp in the lock file, and check whether the PID is still alive before honoring the lock
- Set a maximum lock age (e.g., 5 minutes) after which locks are forcibly broken with a warning
- Design lock granularity carefully: lock the specific state file being modified, not a global lock that serializes all operations
- Use git's built-in `git lock-ref` or leverage git commit as an atomic state transition (committing IS an atomic file update)

**Warning signs:**
- Two agents report success modifying the same state file simultaneously
- State files contain interleaved/corrupted content from concurrent writes
- Agents hang indefinitely waiting for a lock that will never be released
- Lock files persist after all agents have exited

**Phase to address:**
Phase 1 (Core Infrastructure) -- locking is the foundation of shared state. If it is unreliable, every higher-level feature built on top (task claiming, state transitions, contract registration) is unreliable.

**Confidence:** HIGH -- well-established computer science; verified via multiple sources on file-based locking vulnerabilities

---

### Pitfall 4: Inter-Agent Specification Misalignment (The #1 Multi-Agent Failure Mode)

**What goes wrong:**
Research from UC Berkeley/ICLR 2025 analyzing 150+ multi-agent system failures found that inter-agent misalignment is the single most common failure mode. Agents talk past each other, duplicate effort, forget their responsibilities, or work against shared goals. In RAPID's context: Set A's agent produces code that technically satisfies its interface contract but interprets the contract differently than Set B's agent. At merge time, the code is syntactically compatible but semantically wrong.

**Why it happens:**
Each agent operates in its own context window with its own interpretation of instructions. Claude Code agents do not share conversation history. When the planning phase produces interface contracts, each agent reads those contracts independently and can develop divergent interpretations over the course of a long coding session, especially after context compaction.

**How to avoid:**
- Make interface contracts machine-verifiable, not just human-readable. Include TypeScript type definitions, JSON schemas, or test fixtures that can be automatically validated
- Generate contract test stubs during planning that both sides must pass -- if Set A's tests pass and Set B's tests pass, the integration will work
- Include concrete examples in every contract: "When Set A calls `getUser(id)`, it expects `{id: string, name: string, email: string}`" rather than "Set A exposes a user endpoint"
- Keep contracts in a shared location (the main branch's `.rapid/contracts/` directory) that all worktrees can read but only the planning phase can write
- The merge reviewer must validate contract compliance, not just code quality

**Warning signs:**
- Agents asking clarification questions about contracts that should be unambiguous
- Contracts that describe behavior in prose without concrete types or examples
- Integration tests failing at merge time despite individual set tests passing
- Semantic mismatches (correct types, wrong values/behavior)

**Phase to address:**
Phase 3 (Interface Contract System) -- but the contract format must be designed in Phase 1 so the planning phase knows what to produce. This is a cross-cutting concern.

**Confidence:** HIGH -- ICLR 2025 peer-reviewed research paper with quantitative analysis of 150+ failure cases

---

### Pitfall 5: Context Window Overflow Degrades Agent Quality Silently

**What goes wrong:**
RAPID's generated CLAUDE.md files will contain code style guides, architecture patterns, API conventions, project knowledge, interface contracts, and set-specific instructions. Combined with the plugin's skill prompts, hook configurations, and MCP server tool schemas, the total context load can silently push agents toward or past context limits. When this happens, agents don't fail -- they degrade. They forget earlier instructions, drop contract requirements, produce lower-quality code, and miss edge cases. The degradation is invisible until merge review catches it (or doesn't).

**Why it happens:**
System prompts, CLAUDE.md content, skill definitions, tool schemas from MCP servers, and conversation history all compete for space in the context window. Each MCP server's tools load their schemas into context. With 10+ MCP servers and 80+ tools, context can shrink from 200K tokens to 70K usable tokens. Long coding sessions accumulate tool call results that further compress available space.

**How to avoid:**
- Measure the baseline token cost of RAPID's context injection (CLAUDE.md + skills + hooks + contracts) and keep it under 15K tokens
- Use progressive disclosure in skill files: short instructions for common cases, longer details loaded only when needed
- Generate per-set CLAUDE.md files that include only the contracts and context relevant to that set, not the entire project's contracts
- Limit MCP servers per worktree session to only what that set needs
- Implement a PreCompact hook that preserves critical contract information when context compaction occurs
- Test with realistic project sizes: a project with 5 sets and 20 contracts will produce much more context than a 2-set demo

**Warning signs:**
- Agent output quality degrades over long sessions
- Agents "forget" contract requirements they followed earlier in the session
- Context compaction happens frequently (check via hooks)
- Agents produce code that contradicts CLAUDE.md guidelines

**Phase to address:**
Phase 4 (CLAUDE.md Generation) -- but must be considered during Phase 1 design. Token budgets should be allocated early.

**Confidence:** MEDIUM -- based on official Claude Code docs about context limits and general LLM context window research; exact token costs are project-specific

---

### Pitfall 6: Merge Conflicts from Shared Files Not Covered by Interface Contracts

**What goes wrong:**
Interface contracts define boundaries between sets, but real codebases have shared files that multiple sets must modify: package.json, configuration files, route registrations, database migration indexes, shared type definition files, CSS/style tokens, and environment variable definitions. Even with perfect contract compliance, merging these shared files produces git conflicts that the merge reviewer must resolve. If RAPID doesn't account for this, every merge fails.

**Why it happens:**
Contract-based parallel development assumes clean separation. In practice, adding a new feature always touches some shared infrastructure: adding a route to the router, registering a new module, adding a dependency, extending shared types. These "incidental touches" to shared files are invisible during planning because they emerge during implementation.

**How to avoid:**
- During planning, explicitly identify "shared files" that multiple sets will touch and designate one set as the owner of each shared file
- For files that genuinely need concurrent modification (like package.json), use a convention-based approach: each set adds its dependencies to a set-specific manifest (e.g., `.rapid/sets/set-a/dependencies.json`) and a merge-time hook consolidates them
- For route registrations and module loading, use a file-per-set pattern (e.g., `routes/set-a.ts`) that a loader scans dynamically, rather than a single file all sets modify
- Make the merge reviewer's first pass a dry merge (`git merge --no-commit`) to identify conflicts before attempting resolution

**Warning signs:**
- Multiple sets planning to modify the same files
- Planning phase producing contracts but no shared-file ownership plan
- Merge reviewer encountering unexpected conflicts on files not mentioned in contracts
- Sets independently adding the same dependency at different versions

**Phase to address:**
Phase 3 (Interface Contracts) and Phase 5 (Merge Review) -- the planning phase must identify shared files, and the merge phase must handle conflicts gracefully.

**Confidence:** HIGH -- this is a well-known problem in parallel development workflows; verified across multiple sources on contract-driven development

---

## Moderate Pitfalls

### Pitfall 7: Worktree Directory Pollution and Cleanup Failures

**What goes wrong:**
Each git worktree creates a real directory on disk. Each directory needs its own `node_modules/`, build artifacts, and framework caches. With 5 parallel sets, that is 5x the disk usage for dependencies alone. When RAPID's lifecycle ends (or crashes), stale worktree directories and their associated `node_modules/` persist. Over time, disk space balloons. Manually deleting worktree directories (instead of using `git worktree remove`) leaves stale references in `.git/worktrees/` that cause confusing errors.

**How to avoid:**
- Implement the `WorktreeRemove` hook to guarantee cleanup: remove `node_modules/`, build artifacts, and then call `git worktree remove` (never `rm -rf`)
- After `git worktree remove`, run `git worktree prune` to clean up stale references
- Before creating worktrees, run `git worktree prune` to clear any stale references from previous runs
- Implement a `rapid:cleanup` skill that audits all worktrees and removes orphans
- Use `WorktreeCreate` hook to automate `npm install` in new worktrees so agents don't waste time figuring this out
- Consider symlinking or copying `node_modules/` from the main worktree to save time (but be aware of version divergence risks)

**Warning signs:**
- `git worktree list` shows worktrees that no longer exist on disk
- Disk usage growing significantly after each RAPID run
- `git worktree add` failing with "already exists" errors for directories that were manually deleted

**Phase to address:**
Phase 2 (Git Worktree Management) -- cleanup must be part of the worktree lifecycle, not an afterthought.

**Confidence:** HIGH -- verified via official git-worktree docs and multiple community reports

---

### Pitfall 8: No Nested Teams / One Team Per Session

**What goes wrong:**
Claude Code's agent teams have hard architectural constraints: teammates cannot spawn their own teams, and a lead can only manage one team at a time. RAPID's design envisions a complex orchestration: a planning agent coordinates set definition, then each set might need its own sub-coordination. This hierarchical orchestration is not possible with agent teams. Additionally, `/resume` and `/rewind` do not restore in-process teammates -- if a session disconnects mid-execution, all teammate state is lost.

**How to avoid:**
- Design RAPID's orchestration as flat, not hierarchical: one orchestrator manages all sets directly, with no sub-orchestrators
- Use subagents (not teams) for operations that don't need inter-agent communication, like individual set execution
- For operations that need coordination (like merge review with feedback), use a single team with explicit task dependencies rather than nested teams
- Implement checkpoint/resume at the RAPID level using git-native state files, rather than relying on Claude Code's session resume. If a session crashes, RAPID should be able to detect in-progress state and resume from the last checkpoint
- Limit team size to 3-5 teammates (official recommendation); for projects with more sets, batch execution in waves

**Warning signs:**
- Attempting to spawn teams from within teammate sessions
- Session resume attempts that fail to reconnect with existing teammates
- Orchestration designs that assume hierarchy deeper than one level

**Phase to address:**
Phase 1 (Core Infrastructure) -- the orchestration model must respect these constraints from the start.

**Confidence:** HIGH -- verified via official Claude Code agent teams documentation

---

### Pitfall 9: Premature Termination and Missing Verification

**What goes wrong:**
Multi-agent LLM systems frequently suffer from premature termination: agents declare "done" before objectives are met. In RAPID's context, a set agent might mark its work as complete without running tests, without verifying contract compliance, or without checking that all planned features are implemented. The merge reviewer then inherits incomplete work and either passes it (compounding the problem) or rejects it (wasting all the execution time).

**Why it happens:**
LLMs tend to be optimistic about completion. After generating a significant amount of code, the model's tendency is to wrap up. Without explicit verification gates, agents follow this tendency. The TaskCompleted event in Claude Code agent teams can help, but only if quality gates are enforced through hooks.

**How to avoid:**
- Use `TaskCompleted` hooks to run automated verification before allowing task completion: lint, typecheck, test, contract compliance check
- Exit code 2 from a `TaskCompleted` hook prevents completion and sends feedback to the teammate, forcing continued work
- Define explicit "Definition of Done" criteria in each set's CLAUDE.md: "A set is complete when: (1) all planned features are implemented, (2) all tests pass, (3) contract test stubs pass, (4) no TypeScript errors"
- The merge reviewer agent must independently run all verification, never trusting the set agent's self-assessment
- Use `TeammateIdle` hooks to detect when agents go idle before their tasks are complete

**Warning signs:**
- Tasks marked complete with failing tests
- Merge reviewer finding basic issues (type errors, missing functions) that should have been caught earlier
- Agents going idle while tasks remain in their assignment

**Phase to address:**
Phase 5 (Merge Review) -- but verification hooks should be designed in Phase 1 and implemented incrementally.

**Confidence:** HIGH -- verified via ICLR 2025 research and official Claude Code hooks documentation

---

### Pitfall 10: Hook Execution Environment Assumptions

**What goes wrong:**
Claude Code hooks run as shell commands, HTTP endpoints, or LLM prompts. Shell command hooks run in the Claude Code process's working directory, but hook scripts may assume a different working directory, different environment variables, or the presence of tools that aren't installed. When hooks fail, Claude Code may silently continue (for non-blocking hooks) or block all progress (for blocking hooks). Plugin hooks in `hooks/hooks.json` are relative to the plugin directory, not the project directory, which causes path resolution failures.

**How to avoid:**
- Always use absolute paths in hook commands, or paths relative to known environment variables
- Test hooks in isolation before integrating them into the plugin
- For blocking hooks (PreToolUse), always include a timeout and a fallback -- a hanging hook blocks the entire agent
- For command hooks, always set `set -e` and handle errors explicitly
- Use the `jq` dependency carefully -- it must be available in the user's environment. Consider bundling a Node.js script instead of a bash + jq hook for portability
- Document all external tool dependencies in the plugin's README

**Warning signs:**
- Hooks producing no output (indicating they failed to start)
- Hooks timing out and blocking agent progress
- Different behavior across team members' machines
- Path-related errors in hook execution

**Phase to address:**
Phase 1 (Core Infrastructure) -- hook reliability is foundational. Build a test harness for hooks early.

**Confidence:** HIGH -- verified via official Claude Code hooks documentation

---

### Pitfall 11: CLAUDE.md Inconsistency Across Worktrees

**What goes wrong:**
RAPID generates CLAUDE.md with full project context. But each worktree is a separate directory with its own CLAUDE.md file. If the CLAUDE.md is generated once during planning and copied to each worktree, changes to coding conventions or architecture decisions made during one set's execution don't propagate to other sets. Conversely, if CLAUDE.md is shared (symlinked to main), one set's agent modifying CLAUDE.md affects all other running agents' behavior unpredictably.

**How to avoid:**
- Generate CLAUDE.md during the planning phase and treat it as immutable during execution. No set agent should modify it
- Use a layered approach: a shared base CLAUDE.md (read-only, in the main worktree or a shared directory) plus per-set CLAUDE.md overlays in each worktree
- Claude Code reads CLAUDE.md from the working directory AND parent directories. Leverage this hierarchy: put shared context in the parent, set-specific context in the worktree's root
- If mid-execution updates are genuinely needed, route them through the orchestrator as a sync point

**Warning signs:**
- Different worktrees producing inconsistent code styles
- Agents in one worktree confused by CLAUDE.md content that references another set's work
- CLAUDE.md files diverging across worktrees over time

**Phase to address:**
Phase 4 (CLAUDE.md Generation) -- the generation strategy must account for the multi-worktree reality.

**Confidence:** MEDIUM -- based on official Claude Code docs about CLAUDE.md resolution and general configuration management principles

---

## Minor Pitfalls

### Pitfall 12: Plugin Namespace Collision in Multi-Plugin Environments

**What goes wrong:**
RAPID's skills are namespaced as `/rapid:plan`, `/rapid:execute`, etc. But users may have other plugins installed that also define planning or execution skills. While Claude Code's namespacing prevents direct name collisions, model-invoked skills (Agent Skills) can create ambiguity: if two plugins both have a skill described as "plan a project," Claude may invoke the wrong one.

**How to avoid:**
- Use highly specific skill descriptions that reference RAPID by name: "Plan parallel development sets using RAPID framework" not "Plan a project"
- For user-invoked skills (slash commands), namespacing handles this automatically
- Test the plugin in environments with common plugins (like plugin-dev, code-review plugins) installed to verify no ambiguity

**Phase to address:**
Phase 1 (Plugin Structure) -- skill naming and descriptions should be deliberate from the start.

**Confidence:** MEDIUM -- based on official plugin docs; model-invoked ambiguity is theoretical but plausible

---

### Pitfall 13: Submodule Incompatibility with Worktrees

**What goes wrong:**
If a user's project uses git submodules, worktrees have known issues: submodules must be initialized separately per worktree, `git worktree move` fails for worktrees containing submodules, and worktree removal requires `--force` when submodules are present. RAPID's automated worktree management will break for projects using submodules unless specifically handled.

**How to avoid:**
- Detect submodule usage during RAPID initialization (`git submodule status`)
- If submodules are detected, add a `WorktreeCreate` hook that runs `git submodule update --init --recursive` in each new worktree
- Add a `WorktreeRemove` hook that uses `--force` for worktrees with submodules
- Document this limitation clearly: "Projects with submodules require additional setup time per worktree"
- Consider warning users about disk space implications (submodules are not shared between worktrees)

**Phase to address:**
Phase 2 (Git Worktree Management) -- as part of worktree lifecycle hooks.

**Confidence:** HIGH -- verified via official git-worktree docs and multiple community reports

---

### Pitfall 14: Agents Editing the Wrong Worktree

**What goes wrong:**
Multiple worktrees exist simultaneously on the filesystem, often with similar directory structures. An agent with filesystem access (Bash tool, Write tool) could accidentally modify files in a different worktree's directory, especially if the working directory is not properly scoped. This is particularly dangerous because it corrupts another set's isolated work without any git-level protection.

**How to avoid:**
- Set each agent's working directory explicitly to its assigned worktree
- Use PreToolUse hooks on Write, Edit, and Bash to verify that file operations target only the correct worktree directory
- Include the worktree path in the agent's system prompt / CLAUDE.md: "You are working in /path/to/worktree/set-a. NEVER modify files outside this directory"
- Consider using filesystem sandboxing if available

**Warning signs:**
- File modifications appearing in the wrong worktree's `git status`
- Unexplained changes in a set's worktree that don't match the set's planned work
- Agents referencing file paths from other worktrees in their output

**Phase to address:**
Phase 2 (Git Worktree Management) -- path scoping must be enforced at the worktree level.

**Confidence:** MEDIUM -- based on common reports of worktree directory confusion and Claude Code's tool access model

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip lock file implementation, rely on git commit atomicity | Faster v1 development | Race conditions when multiple agents modify planning state concurrently | Never -- even v1 needs basic locking for correctness |
| Use prose-only interface contracts (no type definitions) | Simpler planning phase | Merge failures due to semantic mismatches; no automated contract verification | Early prototyping only; must add typed contracts before team use |
| Single global CLAUDE.md for all worktrees | Simpler generation logic | Context bloat; irrelevant information for each set; token waste | Acceptable for projects with 2 sets; breaks at 4+ |
| Hardcode git commands instead of abstracting worktree operations | Faster implementation | Fragile when git CLI changes or when users have non-standard git configurations | MVP only; abstract by v0.2 |
| Skip WorktreeCreate/WorktreeRemove hooks, use manual setup | Less infrastructure code | Users must manually install deps per worktree; cleanup failures; disk bloat | Never -- automation is a core value prop |
| Use polling instead of hooks for state changes | Simpler to implement | Token waste from repeated reads; delayed reactions; harder to debug | Never -- Claude Code hooks exist for this purpose |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude Code Agent Teams | Assuming custom agents can spawn teams | Use skills from plain sessions; test the `settings.json` `agent` key path separately |
| Git Worktrees | Deleting worktree directories with `rm -rf` instead of `git worktree remove` | Always use `git worktree remove`; add `WorktreeRemove` hooks for cleanup |
| Claude Code Hooks | Putting hooks inside `.claude-plugin/` directory | Put `hooks/hooks.json` at the plugin root, NOT inside `.claude-plugin/` |
| CLAUDE.md | Placing all project context in a single CLAUDE.md | Layer base context + per-set overrides; Claude Code reads CLAUDE.md from cwd AND parents |
| Claude Code Subagents | Including Task in a subagent's allowedTools | Subagents cannot spawn subagents; including Task causes silent failure |
| npm/node_modules | Expecting `node_modules` to be shared across worktrees | Each worktree needs its own `npm install`; automate via `WorktreeCreate` hook |
| Git Hooks (pre-commit, etc.) | Expecting per-worktree hook behavior | Git hooks are global across all worktrees by default; use worktree-aware hook scripts |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `npm install` per worktree | Worktree creation takes 30-120 seconds per set | Cache `node_modules/` or use `WorktreeCreate` hook with `npm ci` | Breaks user patience at 3+ sets; disk space at 5+ sets |
| Full project context in every agent's CLAUDE.md | Context compaction occurs frequently; agent quality degrades mid-session | Per-set context with only relevant contracts and guidelines | Projects with 5+ contracts or 20+ CLAUDE.md pages of context |
| Polling for state changes instead of hooks | Token burn with no productive work; slow reaction times | Use `TaskCompleted`, `TeammateIdle`, and `PostToolUse` hooks | Any project; immediately wasteful |
| Global lock for all state modifications | All agents serialize on one lock; parallelism eliminated | Fine-grained locks per state file or per set | Projects with 3+ concurrent sets |
| Synchronous merge review of all sets | Entire team waits for sequential review of each set | Review sets in parallel where possible; only serialize when reviewing interdependent sets | Projects with 4+ sets |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Lock files containing executable code that gets evaluated | Code injection via crafted lock file content | Lock files contain only metadata (PID, timestamp, set name); never `eval` lock content |
| CLAUDE.md injection via malicious contract definitions | Prompt injection through interface contracts modifying agent behavior | Contracts are validated at planning time; contract content is structured data, not freeform prompts |
| Plugin hooks running with `--dangerously-skip-permissions` | All agents bypass permission checks; destructive operations unchecked | Never use `--dangerously-skip-permissions` in production; configure fine-grained permissions instead |
| Worktree agents with full filesystem access | Agent modifies files outside its worktree, affecting other sets or the host system | Scope agent permissions; use PreToolUse hooks to restrict file paths to the assigned worktree |
| Secrets in git-native state files | API keys, tokens committed to shared planning state | Never store secrets in `.rapid/` state files; use environment variables; add `.rapid/` patterns to `.gitignore` where appropriate |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress visibility during parallel execution | User has no idea what 5 agents are doing; anxiety leads to interruption | Implement a status dashboard skill (`/rapid:status`) that reads git-native state files and summarizes progress |
| Cryptic error messages when worktree operations fail | User sees raw git errors with no context about which set or what to do | Wrap all git operations; translate errors into actionable messages: "Set A's worktree creation failed because branch 'feature/set-a' already exists. Run `/rapid:cleanup` to resolve." |
| Silent failures during merge review | Merge review passes but integration is broken | Always show merge review results prominently; require explicit user confirmation before committing merge |
| Planning phase producing too many sets | User overwhelmed; execution takes too long; coordination overhead exceeds parallelism benefit | Default to 2-4 sets maximum; warn users when planning produces more; explain tradeoffs |
| No way to abort/resume mid-execution | Session crash or user Ctrl+C loses all progress | Git-native checkpoints; each set's progress is committed to its branch; restart detects existing worktrees and resumes |

## "Looks Done But Isn't" Checklist

- [ ] **Interface contracts:** Often missing concrete examples and test fixtures -- verify each contract has at least one typed example of expected input/output
- [ ] **Worktree cleanup:** Often missing pruning of stale git worktree references -- verify `git worktree list` shows no stale entries
- [ ] **Lock file cleanup:** Often missing stale lock detection -- verify no lock files older than 5 minutes exist after all agents exit
- [ ] **CLAUDE.md generation:** Often missing per-set scoping -- verify each worktree's CLAUDE.md contains only relevant contracts
- [ ] **Merge review:** Often missing contract compliance check -- verify the reviewer validates types and test fixtures, not just code quality
- [ ] **npm install automation:** Often missing in `WorktreeCreate` hook -- verify agents can immediately run code after worktree creation
- [ ] **Error recovery:** Often missing resume-after-crash logic -- verify RAPID can detect and recover from interrupted execution
- [ ] **Git branch cleanup:** Often missing post-merge branch deletion -- verify completed set branches are cleaned up

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stale worktrees from crash | LOW | Run `git worktree list`, then `git worktree remove` for each stale entry, then `git worktree prune` |
| Stale lock files | LOW | Check PID in lock file; if process dead, delete lock file manually; run `/rapid:cleanup` |
| Context window overflow mid-session | MEDIUM | Reduce CLAUDE.md size; restart the affected set's agent session with slimmer context; work is preserved in git |
| Merge conflicts in shared files | MEDIUM | Manually resolve conflicts using the merge reviewer's dry-merge output; add shared file to ownership plan for future runs |
| Contract semantic mismatch at merge | HIGH | Identify which set misinterpreted the contract; revert that set's branch; update the contract with concrete examples; re-execute the set |
| Agent edited wrong worktree | HIGH | Use `git diff` in each worktree to identify cross-contamination; `git checkout -- .` in the contaminated worktree to restore; re-execute the contaminated set |
| Custom agent can't spawn teams (bug #23506) | LOW | Switch to skill-based invocation from a plain `claude` session; redesign entry point if needed |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Custom agents can't spawn teams (#1) | Phase 1: Core Infrastructure | Test subagent spawning from plugin's entry point before building orchestration |
| Branch exclusivity deadlocks (#2) | Phase 2: Worktree Management | Integration test: create 3 worktrees, verify no workflow requires same branch in 2 worktrees |
| File lock race conditions (#3) | Phase 1: Core Infrastructure | Concurrent stress test: 5 processes attempting simultaneous lock acquisition |
| Inter-agent misalignment (#4) | Phase 3: Interface Contracts | Generate contracts for sample project; have 2 agents implement independently; verify merge succeeds |
| Context window overflow (#5) | Phase 4: CLAUDE.md Generation | Measure total token count of generated context for a project with 5 sets and 20 contracts |
| Shared file merge conflicts (#6) | Phase 3: Interface Contracts | Plan a sample project; identify all shared files; verify ownership plan covers them |
| Worktree cleanup failures (#7) | Phase 2: Worktree Management | Create and destroy 10 worktrees; verify `git worktree list` is clean and disk usage returns to baseline |
| No nested teams (#8) | Phase 1: Core Infrastructure | Attempt to spawn a team from a teammate; verify graceful error handling |
| Premature termination (#9) | Phase 5: Merge Review | Set agents mark tasks complete; verify `TaskCompleted` hook runs tests and blocks on failure |
| Hook environment assumptions (#10) | Phase 1: Core Infrastructure | Run hook test harness on Linux, macOS, and WSL; verify all hooks pass |
| CLAUDE.md inconsistency (#11) | Phase 4: CLAUDE.md Generation | After planning, diff CLAUDE.md across 3 worktrees; verify shared content is identical and per-set content differs |
| Plugin namespace collision (#12) | Phase 1: Plugin Structure | Install RAPID alongside 2 other plugins; invoke each skill; verify correct routing |
| Submodule incompatibility (#13) | Phase 2: Worktree Management | Test on a project with submodules; verify worktree creation initializes submodules |
| Wrong worktree edits (#14) | Phase 2: Worktree Management | Run agent in worktree A; verify no file changes appear in worktree B via `git status` |

## Sources

- [Git Worktree Official Documentation](https://git-scm.com/docs/git-worktree) -- branch exclusivity, shared .git, worktree lifecycle
- [Git Worktree: Pros, Cons, and the Gotchas Worth Knowing](https://joshtune.com/posts/git-worktree-pros-cons/) -- directory confusion, disk space, tool incompatibility
- [Claude Code Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams) -- no nested teams, one team per session, no session resume, task claiming
- [Claude Code Plugin Documentation](https://code.claude.com/docs/en/plugins) -- plugin structure, skill namespacing, hooks location
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- all hook events, WorktreeCreate/WorktreeRemove, exit codes, hook locations
- [Claude Code Subagent Documentation](https://code.claude.com/docs/en/sub-agents) -- context windows, tool restrictions, no nesting
- [GitHub Issue #23506: Custom agents cannot spawn subagents into teams](https://github.com/anthropics/claude-code/issues/23506) -- confirmed bug, Task tool missing in custom agent sessions
- [Why Do Multi-Agent LLM Systems Fail? (UC Berkeley, ICLR 2025)](https://arxiv.org/html/2503.13657v1) -- 14 failure modes, inter-agent misalignment as #1 cause, verification failures
- [Why Your Multi-Agent System is Failing (Towards Data Science)](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/) -- coordination overhead, role confusion
- [File Locking Race Conditions (InformIT)](https://www.informit.com/articles/article.aspx?p=23947&seqNum=6) -- TOCTOU races, NFS issues, stale locks
- [Git Concurrency in GitHub Desktop (GitHub Blog)](https://github.blog/2015-10-20-git-concurrency-in-github-desktop/) -- concurrent git operations, lock files
- [Context Window Overflow (AWS Security Blog)](https://aws.amazon.com/blogs/security/context-window-overflow-breaking-the-barrier/) -- CWO in agents, degradation patterns
- [Pact's Dependency Drag (Specmatic)](https://specmatic.io/updates/pacts-dependency-drag-why-consumer-driven-contracts-dont-support-parallel-development/) -- contract testing limitations for parallel development

---
*Pitfalls research for: RAPID -- Rapid Agentic Parallelizable and Isolatable Development*
*Researched: 2026-03-03*
