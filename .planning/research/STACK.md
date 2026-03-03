# Stack Research

**Domain:** Claude Code plugin / metaprompting framework for team-based parallel development
**Researched:** 2026-03-03
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Claude Code Plugin System | v2.1.62+ | Plugin architecture (commands, agents, skills, hooks) | RAPID is a Claude Code plugin by design. The plugin system provides auto-discovered components (.claude-plugin/plugin.json, commands/, agents/, skills/, hooks/), portable paths via ${CLAUDE_PLUGIN_ROOT}, hook events for lifecycle control, and MCP server integration. This is not a choice -- it is the platform. **Confidence: HIGH** (verified via official docs at code.claude.com/docs/en/plugins-reference) |
| Bash scripts | N/A (system) | Hook scripts, git worktree management, file locking, state management | Claude Code hooks execute shell commands. All state management, git operations, and locking should be bash scripts with optional Node.js for complex JSON processing. GSD (the reference plugin) uses this exact pattern: bash/Node.js scripts invoked by hooks and commands. No npm dependencies needed for core logic. **Confidence: HIGH** (verified via GSD source code and Claude Code hooks documentation) |
| Node.js | v18+ (system) | Complex hook scripts, JSON processing, cross-platform utilities | Already available in Claude Code's runtime. Used for hooks that need JSON parsing (stdin/stdout protocol), file watching, and complex logic. GSD uses Node.js for its context monitor and update checker hooks. Keep usage minimal -- prefer bash where possible. **Confidence: HIGH** (verified via GSD hooks source code) |
| Git (with worktree support) | v2.30+ | Branch isolation, worktree creation/cleanup, merge operations | Git worktrees are the core isolation mechanism. Each "set" gets its own worktree with a dedicated branch. Claude Code v2.1.49+ has native --worktree support, and subagents support `isolation: worktree` in frontmatter. Git is already required by RAPID's design constraints. **Confidence: HIGH** (verified via official Claude Code docs and git-scm.com) |
| Markdown with YAML Frontmatter | N/A | Command definitions, agent definitions, skill definitions, interface contracts | This is the standard format for all Claude Code plugin components. Commands, agents, and skills are .md files with YAML frontmatter. RAPID's interface contracts and set definitions should also use this format for consistency with the ecosystem. **Confidence: HIGH** (verified via plugin-dev documentation) |
| EXPERIMENTAL_AGENT_TEAMS | Experimental | Multi-agent coordination with shared task lists and direct messaging | Agent teams let multiple Claude Code instances coordinate via shared task lists, direct messaging, and centralized management. Enable via settings.json env var. RAPID should detect availability and use when present, falling back to subagent-based coordination. **Confidence: MEDIUM** (feature is experimental, API may change) |

### State Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| JSON files | N/A | Structured state (set definitions, lock records, execution status) | Git-native, human-readable, parseable by both bash (jq) and Node.js. GSD uses .planning/config.json and STATE.md for this exact purpose. RAPID should use .rapid/ directory with JSON for machine-readable state and Markdown for human-readable state. **Confidence: HIGH** |
| Lock files (mkdir strategy) | N/A | Preventing concurrent modification of shared state | The mkdir-based atomic lock is the most reliable cross-platform approach. Create a directory (atomic on all filesystems including NFS) as the lock indicator. This is the same strategy used by proper-lockfile and npm's own lockfile handling. Agent teams already use file locking for task claiming. Implement directly in bash -- no npm dependency needed. **Confidence: HIGH** (verified via proper-lockfile docs and agent teams docs) |
| jq | v1.6+ | JSON processing in bash scripts | Standard tool for parsing and manipulating JSON from bash. Already available on most systems. Required for processing hook stdin/stdout JSON protocol and managing state files. **Confidence: HIGH** |

### Plugin Components

| Component | Format | Purpose | When to Use |
|-----------|--------|---------|-------------|
| Commands (commands/*.md) | Markdown + YAML frontmatter | User-facing slash commands (/rapid:init, /rapid:plan, /rapid:execute, /rapid:merge) | Entry points for user interaction. Each major workflow phase gets a command. |
| Agents (agents/*.md) | Markdown + YAML frontmatter | Specialized subagents (planner, executor, merger, reviewer) | Delegated work that needs its own context window or isolation. Use `isolation: worktree` for agents that modify code. |
| Skills (skills/*/SKILL.md) | Markdown + YAML frontmatter | Domain knowledge (contract authoring, set design, merge conflict resolution) | Auto-activated contextual guidance. Use for reusable knowledge that applies across commands. |
| Hooks (hooks/hooks.json) | JSON config + bash/Node.js scripts | Lifecycle automation (pre-merge validation, contract checking, state sync) | Automated enforcement. PreToolUse for validation, PostToolUse for state updates, TeammateIdle/TaskCompleted for agent team quality gates. |
| Settings (settings.json) | JSON | Default plugin settings, EXPERIMENTAL_AGENT_TEAMS env var | Applied when plugin is enabled. Only agent settings currently supported. |

### Supporting Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| git worktree add/remove/list | Create and manage isolated working directories | When initializing sets and cleaning up after merge |
| git merge / git merge-base | Merge set branches back together, find common ancestors | During merge/review phase |
| git diff | Detect changes, validate contract compliance | During review and merge review |
| git stash | Temporarily save work during context switches | Edge case handling in worktree management |
| flock (Linux) / lockf (macOS) | Advisory file locking for concurrent script access | Optional backup to mkdir-based locking on single-machine setups |

## Architecture Patterns

### Pattern: Bash-First, Node-When-Needed

RAPID should follow GSD's proven pattern:

```
commands/*.md          -- Markdown commands invoke bash/Node scripts
hooks/scripts/*.sh     -- Bash scripts for git operations, locking, validation
hooks/scripts/*.js     -- Node.js for complex JSON processing, cross-platform edge cases
lib/                   -- Shared bash functions (lock.sh, git-worktree.sh, state.sh)
```

**Why:** Claude Code's hook protocol passes JSON via stdin and expects JSON on stdout. Node.js handles this natively. But git operations, file locking, and state file manipulation are simpler and more reliable in bash. GSD uses exactly this split.

### Pattern: mkdir-Based Atomic Locking

```bash
#!/bin/bash
# Lock acquisition
LOCK_DIR=".rapid/locks/${SET_NAME}"
if mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "$$" > "$LOCK_DIR/pid"
    echo "$(date +%s)" > "$LOCK_DIR/timestamp"
    # ... do work ...
    rm -rf "$LOCK_DIR"
else
    echo "Lock held by PID $(cat $LOCK_DIR/pid)" >&2
    exit 1
fi
```

**Why:** mkdir is atomic on all filesystems. No npm dependencies. Git-trackable lock state. Stale lock detection via PID + timestamp.

### Pattern: Worktree-Per-Set Isolation

```bash
# Create worktree for a set
git worktree add ".rapid/worktrees/${SET_NAME}" -b "rapid/${SET_NAME}" HEAD

# Agent works in isolated worktree
# ...

# Clean up after merge
git worktree remove ".rapid/worktrees/${SET_NAME}"
git branch -d "rapid/${SET_NAME}"
```

**Why:** Native git, zero external dependencies. Each set has full repo context but isolated working directory. Claude Code's `isolation: worktree` uses the same mechanism.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Bash scripts for locking | proper-lockfile npm package | If you need NFS-safe locking across network filesystems (unlikely for local dev) |
| Direct git CLI calls | simple-git npm library | If you need programmatic git access from a Node.js application; unnecessary here since hooks call git directly |
| Direct git CLI calls | git-worktree npm package | Only 0.0.5, very low adoption, minimal API. Not worth the dependency |
| YAML frontmatter in .md files | JSON/YAML config files for contracts | Never -- YAML frontmatter is the Claude Code ecosystem standard. Using anything else creates friction |
| mkdir-based locking | flock/lockf system calls | Only if you need blocking (wait-for-lock) behavior; mkdir with retry loop is simpler |
| Built-in agent teams hooks | Custom process management | Never for team coordination -- agent teams handle this; custom process management only as fallback when agent teams unavailable |
| Subagent fallback pattern | Agent teams only | Never go teams-only -- agent teams are experimental. Always implement subagent fallback |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| npm dependencies for core logic | Adds installation complexity, version drift, supply chain risk. A Claude Code plugin should be self-contained files (md + sh + js) with no npm install step | Bash scripts + built-in Node.js APIs |
| TypeScript compilation | Adds build step that Claude Code plugin system doesn't support natively. Hooks must be directly executable | Plain JavaScript (Node.js) for complex scripts, bash for everything else |
| External databases (SQLite, etc.) | Violates "git-native" constraint. Adds dependencies. Not portable across worktrees | JSON files in .rapid/ directory, committed to git |
| Custom process management for agents | Claude Code already handles agent spawning, context windows, permissions. Reimplementing is fragile | Subagents with `isolation: worktree` and/or EXPERIMENTAL_AGENT_TEAMS |
| WebSocket/HTTP servers for coordination | Violates "no external services" constraint. Adds complexity. Not needed when agents can read shared files | File-based state with lock files, or agent teams messaging |
| simple-git / nodegit / isomorphic-git | Unnecessary abstraction. Git CLI is directly available. These add 10-50MB of dependencies | Direct `git` CLI calls from bash scripts |
| Complex state machines | Over-engineering for a file-based system. State should be transparent and debuggable | Simple JSON state files with explicit status fields (pending/in-progress/complete) |

## Stack Patterns by Variant

**If EXPERIMENTAL_AGENT_TEAMS is available:**
- Use agent teams for multi-set parallel execution
- Team lead orchestrates set assignment and monitors progress
- TeammateIdle hook enforces contract compliance before allowing idle
- TaskCompleted hook validates merge readiness
- Teammates communicate directly for cross-set coordination

**If EXPERIMENTAL_AGENT_TEAMS is NOT available (fallback):**
- Use subagents with `isolation: worktree` for parallel execution
- Main session acts as orchestrator, spawning subagents per set
- Subagents report back to main session (no inter-agent messaging)
- Coordination happens through shared state files in .rapid/
- Sequential merge with review between each set

**For solo developer (team of one):**
- Same architecture, single set at a time or parallel subagents
- Lock files still used (future-proofing for team use)
- Merge review still runs (quality gate consistency)

## Version Compatibility

| Component | Compatible With | Notes |
|-----------|-----------------|-------|
| Claude Code v2.1.62+ | Plugin system, hooks, agents, skills | Minimum version for full plugin support. settings.json specifies minimumVersion |
| Claude Code v2.1.49+ | --worktree CLI flag, isolation: worktree | Required for native worktree support in subagents |
| EXPERIMENTAL_AGENT_TEAMS | Current experimental | API may change. Detect via env var, always implement subagent fallback |
| Git v2.30+ | git worktree add/remove/list | Stable since 2020. Required for linked worktree features |
| Node.js v18+ | Built-in to Claude Code runtime | Used for hook JSON processing. No external Node.js install needed |
| jq v1.6+ | JSON processing from bash | Widely available, stable API. Install check needed in plugin init |

## Installation

This is a Claude Code plugin -- no npm install step. Installation is:

```bash
# Option 1: From marketplace (when published)
claude plugin install rapid@claude-code-marketplace

# Option 2: Direct from repo
claude --plugin-dir /path/to/RAPID

# Option 3: Install from GitHub
claude plugin install rapid@github/fishjojo1/RAPID
```

The plugin self-checks for dependencies at session start (via SessionStart hook):
- Git version >= 2.30
- jq available in PATH
- EXPERIMENTAL_AGENT_TEAMS detection

```bash
# No build step. No npm install. Just files:
# .claude-plugin/plugin.json  -- manifest
# commands/*.md                -- slash commands
# agents/*.md                  -- subagent definitions
# skills/*/SKILL.md            -- skills
# hooks/hooks.json             -- hook configuration
# hooks/scripts/*.sh           -- bash hook scripts
# hooks/scripts/*.js           -- Node.js hook scripts
# lib/*.sh                     -- shared bash libraries
```

## Sources

- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference) -- Official plugin system documentation, component types, manifest schema (HIGH confidence)
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams) -- EXPERIMENTAL_AGENT_TEAMS docs, TeammateIdle/TaskCompleted hooks, architecture (HIGH confidence)
- [Claude Code Subagents](https://code.claude.com/docs/en/sub-agents) -- Subagent frontmatter fields including `isolation: worktree`, tool restrictions, permission modes (HIGH confidence)
- [plugin-dev skill: plugin-structure](local: ~/.claude/plugins/cache/claude-plugins-official/plugin-dev/) -- Plugin directory layout, auto-discovery, component patterns (HIGH confidence)
- [plugin-dev skill: component-patterns](local: ~/.claude/plugins/cache/claude-plugins-official/plugin-dev/) -- Hook organization, cross-component patterns (HIGH confidence)
- [GSD Plugin Source](local: ~/.claude/get-shit-done/) -- Reference implementation of a complex Claude Code plugin with hooks, commands, agents, and bash/Node.js scripts (HIGH confidence)
- [proper-lockfile](https://github.com/moxystudio/node-proper-lockfile) -- mkdir-based locking strategy documentation (MEDIUM confidence -- used for pattern reference, not as dependency)
- [CCPM (Claude Code PM)](https://github.com/automazeio/ccpm) -- Reference project using worktrees for parallel agent execution with GitHub Issues (MEDIUM confidence)
- [Claude Code Worktree Guide](https://claudefa.st/blog/guide/development/worktree-guide) -- Community documentation on worktree patterns (MEDIUM confidence)
- [Boris Cherny on Claude Code Worktrees](https://www.threads.com/@boris_cherny/post/DVAAnexgRUj/) -- Official announcement of built-in worktree support v2.1.49 (HIGH confidence)

---
*Stack research for: Claude Code plugin / team-based parallel development framework*
*Researched: 2026-03-03*
