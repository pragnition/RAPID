# Phase 1: Agent Framework and State Management - Research

**Researched:** 2026-03-03
**Domain:** Composable agent prompt architecture, structured return protocols, filesystem-based verification, concurrent-safe state management
**Confidence:** HIGH

## Summary

Phase 1 establishes the two foundational pillars of RAPID: (1) a composable agent architecture where prompts are assembled from reusable modules at build time, and (2) a concurrent-safe state management layer in `.planning/` that all future components depend on. The agent framework uses a three-layer module system (core + role + context) that generates self-contained `.md` agent files -- no runtime indirection. Agents communicate results through a hybrid structured return protocol (Markdown table for humans, HTML-comment JSON for machines) with COMPLETE/CHECKPOINT/BLOCKED statuses. Agent completion is verified by a separate `rapid-verifier` agent that checks filesystem artifacts rather than trusting self-reports.

State management uses Markdown as the primary source of truth (human-readable, git-diffable) with JSON only for machine-only data (`config.json`, lock files). Concurrent access is prevented via `mkdir`-based atomic locks in `.planning/.locks/` (gitignored), with stale lock detection using PID + timestamp. The state utilities are implemented as a Node.js CLI tool (following GSD's `gsd-tools.cjs` pattern) that agents call via Bash.

**Primary recommendation:** Build the Node.js CLI tool (`rapid-tools.cjs`) first as the state management foundation, then build the module assembler as a subcommand of the same tool. The CLI becomes the single interface both agents and commands use to read/write state and assemble prompts.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Build-time generation: modules are source files, a build step assembles them into complete agent `.md` files
- No runtime indirection -- agents are always self-contained after generation
- Regenerated automatically on every `/rapid:` command invocation (always fresh)
- Configurable per-project via `config.json` (projects can override which modules each agent includes)
- Three-layer module granularity: Core (shared behavior all agents receive), Role (agent-type-specific: planner, executor, reviewer, verifier), Context (project state, contracts, style guide -- injected at build time)
- Hybrid return format: Markdown table for human display + hidden JSON in HTML comment for machine parsing
- Comment marker: `<!-- RAPID:RETURN { ... } -->`
- Standard fields on every return: Status, artifacts created/modified, commits, tasks completed (X/Y), duration, next recommended action, warnings/notes
- CHECKPOINT includes full handoff: what was done, what remains, decisions made, blockers encountered, explicit resume instructions
- BLOCKED uses structured blocker categories: DEPENDENCY, PERMISSION, CLARIFICATION, ERROR -- with specific resolution instructions per category
- Tiered verification: lighter checks during execution (file existence + git commit), heavier checks at merge time (tests + contract validation + review)
- Separate `rapid-verifier` agent performs verification -- no self-grading
- On verification failure: auto-retry once, then report BLOCKED
- Verification results persisted as VERIFICATION.md artifacts
- Markdown primary source of truth for most state (STATUS.md, DEFINITION.md, CONTRACT.md, etc.)
- JSON only for machine-only data: `config.json`, lock files
- Every state change committed to git individually (full audit trail, easy bisect)
- Lock system: `mkdir`-based atomic locks in `.planning/.locks/` (gitignored)
- Stale lock detection: lock files contain PID + timestamp; stale if PID is dead OR lock exceeds timeout threshold
- Implementation language: Node.js/TypeScript for state management utilities

### Claude's Discretion
- Exact module file naming conventions and directory structure
- Lock timeout threshold value
- Specific Markdown parsing approach for state files
- VERIFICATION.md format and level of detail
- Build script implementation (how module assembly works internally)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AGNT-01 | Agents are built from composable prompt modules (core behavior + role-specific + context modules) rather than monolithic prompts | Module assembler architecture, three-layer system, build-time concatenation pattern, naming conventions, directory structure |
| AGNT-02 | All agents use structured return protocol (COMPLETE/CHECKPOINT/BLOCKED tables) for machine-parseable results | Hybrid Markdown+JSON return format, HTML comment marker pattern, field specifications, parsing utilities |
| AGNT-03 | Agent completion is verified by checking filesystem artifacts (files exist, tests pass, commits land) -- never trust agent self-reports alone | Verifier agent pattern (from GSD), tiered verification approach, VERIFICATION.md format, filesystem checks |
| STAT-01 | All project state lives in `.planning/` directory, committed to git (JSON for machine state, Markdown for human-readable) | State file specifications, directory structure, Markdown parsing approach, git commit patterns |
| STAT-02 | Concurrent state access is prevented via mkdir-based atomic lock files with PID + timestamp | `proper-lockfile` library (mkdir strategy), lock file format, retry configuration, stale detection |
| STAT-03 | Stale locks are detected and recovered automatically (crashed process left a lock behind) | PID-based liveness check, timeout threshold, `proper-lockfile` stale/update/onCompromised options |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 18+ LTS | Runtime for all state management utilities and build scripts | Already a prerequisite per INIT-05; Claude Code runs on Node.js |
| proper-lockfile | 4.1.2 | Atomic mkdir-based file locking with stale detection | HIGH confidence -- battle-tested (91.4 benchmark score), atomic mkdir strategy works on all filesystems including network, built-in stale detection and retry with exponential backoff |
| fs (built-in) | Node.js built-in | File I/O for state reads/writes and module assembly | Zero dependencies, POSIX-compatible |
| path (built-in) | Node.js built-in | Cross-platform path resolution | Zero dependencies |
| child_process (built-in) | Node.js built-in | Git operations, PID liveness checks | Zero dependencies |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| retry | 0.13.x | Retry logic for lock acquisition (peer dep of proper-lockfile) | Automatically used by proper-lockfile when retries configured |
| graceful-fs | 4.2.x | Drop-in fs replacement that queues on EMFILE (peer dep of proper-lockfile) | Automatically used by proper-lockfile for filesystem operations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| proper-lockfile | Raw `fs.mkdirSync` with manual stale detection | proper-lockfile handles edge cases (stale detection, mtime updates, compromise detection, retry backoff) that would take 200+ lines to hand-roll correctly |
| proper-lockfile | `flock` (POSIX) via shell | flock is process-scoped and does not work across separate Claude Code sessions/subagents; also not portable to all platforms |
| Node.js CLI | Shell scripts (bash) | Node.js provides better JSON handling, cross-platform compatibility, and the same language for both lock management and state parsing |

**Installation:**
```bash
npm install proper-lockfile
```

## Architecture Patterns

### Recommended Project Structure
```
rapid/
  .claude-plugin/
    plugin.json                    # Plugin manifest
  src/
    modules/                       # Agent prompt modules (source)
      core/                        # Shared behavior all agents receive
        core-identity.md           # "You are a RAPID agent" base identity
        core-returns.md            # Structured return protocol specification
        core-state-access.md       # How to read/write .planning/ state
        core-git.md                # Atomic commit conventions
        core-context-loading.md    # Progressive context loading strategy
      roles/                       # Agent-type-specific modules
        role-planner.md            # Planning-specific behavior
        role-executor.md           # Execution-specific behavior
        role-reviewer.md           # Review-specific behavior
        role-verifier.md           # Verification-specific behavior
        role-orchestrator.md       # Orchestration-specific behavior
      context/                     # Injected at build time (project-specific)
        context-project.md         # Project state snapshot
        context-contracts.md       # Active interface contracts
        context-style.md           # Style guide and conventions
    lib/                           # Node.js utilities
      state.cjs                    # State read/write operations
      lock.cjs                     # Lock manager (wraps proper-lockfile)
      assembler.cjs                # Module assembly engine
      returns.cjs                  # Return protocol parser
      verify.cjs                   # Filesystem verification utilities
      core.cjs                     # Shared helpers (config, output, error)
    bin/
      rapid-tools.cjs              # CLI entry point (like gsd-tools.cjs)
  agents/                          # Generated agent files (output of build)
    rapid-planner.md               # Assembled: core/* + role-planner + context/*
    rapid-executor.md              # Assembled: core/* + role-executor + context/*
    rapid-reviewer.md              # Assembled: core/* + role-reviewer + context/*
    rapid-verifier.md              # Assembled: core/* + role-verifier + context/*
    rapid-orchestrator.md          # Assembled: core/* + role-orchestrator + context/*
  commands/                        # Slash commands (thin dispatchers)
  skills/                          # Auto-invoked knowledge
  hooks/                           # Lifecycle hooks
```

### Pattern 1: Build-Time Module Assembly
**What:** Agent prompts are assembled from composable modules at build time, producing self-contained `.md` files. Each module is a standalone Markdown file with a specific concern. The assembler concatenates them in order, wrapping each in XML tags for clear section boundaries.
**When to use:** Every time a `/rapid:` command is invoked (always fresh assembly).
**Example:**
```javascript
// Source: Architecture decision from CONTEXT.md
// src/lib/assembler.cjs

const fs = require('fs');
const path = require('path');

/**
 * Assemble agent prompt from modules.
 * @param {Object} config - Assembly configuration
 * @param {string} config.role - Agent role (planner|executor|reviewer|verifier|orchestrator)
 * @param {string[]} config.coreModules - Core module filenames to include
 * @param {Object} config.context - Context data to inject
 * @param {string} config.outputPath - Where to write assembled agent
 */
function assembleAgent({ role, coreModules, context, outputPath }) {
  const modulesDir = path.join(__dirname, '..', 'modules');
  const sections = [];

  // 1. YAML frontmatter for Claude Code
  sections.push(generateFrontmatter(role));

  // 2. Core modules (shared by all agents)
  for (const mod of coreModules) {
    const content = fs.readFileSync(path.join(modulesDir, 'core', mod), 'utf-8');
    const tag = mod.replace('.md', '').replace('core-', '');
    sections.push(`<${tag}>\n${content}\n</${tag}>`);
  }

  // 3. Role-specific module
  const roleContent = fs.readFileSync(
    path.join(modulesDir, 'roles', `role-${role}.md`), 'utf-8'
  );
  sections.push(`<role>\n${roleContent}\n</role>`);

  // 4. Context modules (project-specific, injected at build time)
  if (context.project) {
    sections.push(`<project_context>\n${context.project}\n</project_context>`);
  }
  if (context.contracts) {
    sections.push(`<contracts>\n${context.contracts}\n</contracts>`);
  }
  if (context.style) {
    sections.push(`<style_guide>\n${context.style}\n</style_guide>`);
  }

  fs.writeFileSync(outputPath, sections.join('\n\n'), 'utf-8');
}

function generateFrontmatter(role) {
  const config = {
    planner: { model: 'inherit', tools: 'Read, Write, Edit, Bash, Grep, Glob' },
    executor: { model: 'inherit', tools: 'Read, Write, Edit, Bash, Grep, Glob' },
    reviewer: { model: 'inherit', tools: 'Read, Grep, Glob, Bash' },
    verifier: { model: 'inherit', tools: 'Read, Bash, Grep, Glob' },
    orchestrator: { model: 'inherit', tools: 'Read, Write, Bash, Grep, Glob, Agent' },
  };
  const c = config[role];
  return `---
name: rapid-${role}
description: RAPID ${role} agent
tools: ${c.tools}
model: ${c.model}
---`;
}

module.exports = { assembleAgent };
```

### Pattern 2: Hybrid Structured Return Protocol
**What:** Every agent return includes both a human-readable Markdown table AND a machine-parseable JSON payload in an HTML comment. The JSON is the source of truth for programmatic consumers; the table is for developers reading output.
**When to use:** Every agent return (COMPLETE, CHECKPOINT, BLOCKED).
**Example:**
```markdown
<!-- Source: User decision from CONTEXT.md -->

## COMPLETE

| Field | Value |
|-------|-------|
| Status | COMPLETE |
| Artifacts | `src/lib/state.cjs`, `src/lib/lock.cjs` |
| Commits | `abc1234`, `def5678` |
| Tasks | 4/4 |
| Duration | 12m |
| Next | Execute Plan 01-02 |
| Notes | Lock timeout set to 5 minutes |

<!-- RAPID:RETURN {"status":"COMPLETE","artifacts":["src/lib/state.cjs","src/lib/lock.cjs"],"commits":["abc1234","def5678"],"tasks_completed":4,"tasks_total":4,"duration_minutes":12,"next_action":"Execute Plan 01-02","warnings":[],"notes":["Lock timeout set to 5 minutes"]} -->
```

```markdown
## BLOCKED

| Field | Value |
|-------|-------|
| Status | BLOCKED |
| Category | DEPENDENCY |
| Blocker | Plugin manifest (plugin.json) not yet created |
| Resolution | Complete Phase 2 (Plugin Shell) first |
| Artifacts | `src/lib/state.cjs` (partial) |
| Tasks | 2/4 |
| Duration | 8m |

<!-- RAPID:RETURN {"status":"BLOCKED","blocker_category":"DEPENDENCY","blocker":"Plugin manifest (plugin.json) not yet created","resolution":"Complete Phase 2 (Plugin Shell) first","artifacts":["src/lib/state.cjs"],"tasks_completed":2,"tasks_total":4,"duration_minutes":8} -->
```

### Pattern 3: Tiered Filesystem Verification
**What:** Verification happens at two levels -- lightweight checks during execution (file existence + git commit hash) and heavyweight checks at merge time (tests pass + contract compliance + code review). A separate `rapid-verifier` agent performs verification; agents never self-grade.
**When to use:** After every agent task (lightweight) and at phase/merge boundaries (heavyweight).
**Example:**
```javascript
// Source: Architecture decision from CONTEXT.md
// src/lib/verify.cjs

const fs = require('fs');
const { execSync } = require('child_process');

/**
 * Lightweight verification: file existence + git commit
 * Used during execution after each task.
 */
function verifyLight(artifacts, commits) {
  const results = { passed: [], failed: [] };

  // Check artifacts exist
  for (const artifact of artifacts) {
    if (fs.existsSync(artifact)) {
      results.passed.push({ type: 'file_exists', target: artifact });
    } else {
      results.failed.push({ type: 'file_missing', target: artifact });
    }
  }

  // Check commits landed
  for (const hash of commits) {
    try {
      execSync(`git cat-file -t ${hash}`, { stdio: 'pipe' });
      results.passed.push({ type: 'commit_exists', target: hash });
    } catch {
      results.failed.push({ type: 'commit_missing', target: hash });
    }
  }

  return results;
}

/**
 * Heavyweight verification: tests + substantive content checks
 * Used at merge time by rapid-verifier agent.
 */
function verifyHeavy(artifacts, testCommand) {
  const results = verifyLight(artifacts, []);

  // Run tests
  if (testCommand) {
    try {
      execSync(testCommand, { stdio: 'pipe', timeout: 60000 });
      results.passed.push({ type: 'tests_pass', target: testCommand });
    } catch (e) {
      results.failed.push({ type: 'tests_fail', target: testCommand, error: e.stderr?.toString() });
    }
  }

  // Check files are substantive (not stubs/placeholders)
  for (const artifact of artifacts) {
    if (fs.existsSync(artifact)) {
      const content = fs.readFileSync(artifact, 'utf-8');
      if (content.length < 50 || content.includes('TODO') || content.includes('placeholder')) {
        results.failed.push({ type: 'stub_content', target: artifact });
      }
    }
  }

  return results;
}

module.exports = { verifyLight, verifyHeavy };
```

### Pattern 4: mkdir-Based Atomic Locking with Stale Recovery
**What:** Use `proper-lockfile` (mkdir strategy) for atomic lock acquisition in `.planning/.locks/`. Each lock file gets periodic mtime updates for stale detection. Stale locks (PID dead or timeout exceeded) are automatically recovered.
**When to use:** Every state write operation.
**Example:**
```javascript
// Source: proper-lockfile docs (Context7) + user decision from CONTEXT.md
// src/lib/lock.cjs

const lockfile = require('proper-lockfile');
const fs = require('fs');
const path = require('path');

const LOCKS_DIR = '.planning/.locks';
const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes (Claude's discretion)
const RETRY_CONFIG = {
  retries: 10,
  factor: 2,
  minTimeout: 100,
  maxTimeout: 2000,
  randomize: true,
};

/**
 * Ensure .planning/.locks/ directory exists (gitignored).
 */
function ensureLocksDir(cwd) {
  const locksPath = path.join(cwd, LOCKS_DIR);
  fs.mkdirSync(locksPath, { recursive: true });

  // Ensure gitignored
  const gitignorePath = path.join(cwd, LOCKS_DIR, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, '*\n!.gitignore\n', 'utf-8');
  }
}

/**
 * Acquire a lock on a state file.
 * @param {string} cwd - Project root
 * @param {string} lockName - Lock identifier (e.g., 'state', 'config', 'sets')
 * @returns {Function} Release function
 */
async function acquireLock(cwd, lockName) {
  ensureLocksDir(cwd);
  const lockTarget = path.join(cwd, LOCKS_DIR, `${lockName}.target`);

  // Create lock target file if it does not exist
  if (!fs.existsSync(lockTarget)) {
    fs.writeFileSync(lockTarget, JSON.stringify({
      pid: process.pid,
      timestamp: Date.now(),
    }), 'utf-8');
  }

  const release = await lockfile.lock(lockTarget, {
    stale: STALE_THRESHOLD,
    update: Math.floor(STALE_THRESHOLD / 2),
    retries: RETRY_CONFIG,
    realpath: false,
    onCompromised: (err) => {
      console.error(`RAPID: Lock "${lockName}" compromised:`, err.message);
      // Log but don't crash -- let the operation complete
    },
  });

  return release;
}

/**
 * Synchronous lock check (non-blocking).
 */
function isLocked(cwd, lockName) {
  const lockTarget = path.join(cwd, LOCKS_DIR, `${lockName}.target`);
  if (!fs.existsSync(lockTarget)) return false;
  try {
    return lockfile.checkSync(lockTarget, {
      stale: STALE_THRESHOLD,
      realpath: false,
    });
  } catch {
    return false;
  }
}

module.exports = { acquireLock, isLocked, ensureLocksDir };
```

### Pattern 5: CLI Tool as Agent Interface
**What:** A single Node.js CLI tool (`rapid-tools.cjs`) provides atomic commands that agents call via Bash. This follows the proven pattern from GSD (`gsd-tools.cjs`), which has 60+ atomic subcommands agents use reliably. The CLI handles state reads/writes, locking, module assembly, return parsing, and git operations.
**When to use:** Every agent interaction with state or build system.
**Example:**
```bash
# Agents call the CLI tool via Bash for all state operations
node rapid/src/bin/rapid-tools.cjs state load
node rapid/src/bin/rapid-tools.cjs state get "Current Phase"
node rapid/src/bin/rapid-tools.cjs state update "Status" "Executing"
node rapid/src/bin/rapid-tools.cjs lock acquire "state"
node rapid/src/bin/rapid-tools.cjs lock release "state"
node rapid/src/bin/rapid-tools.cjs assemble-agent planner
node rapid/src/bin/rapid-tools.cjs parse-return /path/to/agent-output.md
node rapid/src/bin/rapid-tools.cjs verify-artifacts file1.ts file2.ts
node rapid/src/bin/rapid-tools.cjs commit "feat(agents): add planner module" --files agents/rapid-planner.md
```

### Anti-Patterns to Avoid
- **Monolithic agent prompts:** GSD's planner is 50KB. RAPID's module system prevents this by composing agents from focused modules, each handling one concern. If an agent exceeds ~15KB assembled, the modules should be split further.
- **Runtime prompt discovery:** Agents should never read their own module files at runtime. Build-time assembly produces complete, self-contained agents. Runtime indirection wastes context tokens on "figuring out what I am."
- **Trusting agent self-reports:** GSD discovered this the hard way (the `classifyHandoffIfNeeded` workaround). Always verify artifacts on the filesystem. The verifier agent is a separate entity that cannot be influenced by the executor's claims.
- **JSON-primary state:** JSON is harder to diff in git, harder to read in PRs, and harder to debug. Markdown is the source of truth. JSON is only for data that humans never need to read (lock metadata, assembly config).
- **Regex-based Markdown parsing:** GSD's state module uses fragile regex patterns to parse STATE.md fields. Instead, use a structured field format (`**Field:** value`) with a simple, well-tested parser that handles edge cases. Consider extracting YAML frontmatter for machine-critical fields (as GSD later added with `syncStateFrontmatter`).
- **Silent error swallowing:** GSD has `try { } catch (e) {}` everywhere. Every lock acquisition failure, state write failure, and assembly error must be surfaced with actionable context. Use the BLOCKED return protocol with specific error categories.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file locking | Custom mkdir + PID tracking | `proper-lockfile` | Handles mtime-based stale detection, exponential backoff retry, compromise detection, graceful exit cleanup -- 200+ lines of edge cases |
| Lock retry with backoff | Custom retry loop | `proper-lockfile` retries option (uses `retry` package) | Exponential backoff with jitter prevents thundering herd; timing bugs in hand-rolled retries are common |
| YAML frontmatter parsing | Custom regex | Existing frontmatter extraction from GSD's `frontmatter.cjs` | Already handles edge cases (multiline values, nested objects, special characters) |
| Git operations | Raw `execSync('git ...')` everywhere | Wrapper functions in CLI tool | Consistent error handling, timeouts, and logging across all git operations |

**Key insight:** The locking and state management domain has many subtle edge cases (stale detection timing, process crash recovery, filesystem atomicity guarantees). `proper-lockfile` has 91.4 benchmark score on Context7 with HIGH source reputation because it handles all of these correctly. Hand-rolling even a "simple" mkdir lock would miss cases like mtime update failures, lock compromise during long operations, and cross-platform path resolution.

## Common Pitfalls

### Pitfall 1: Lock Contention from Frequent State Updates
**What goes wrong:** If every minor state change acquires a lock, writes, commits to git, and releases, agents spend more time waiting for locks than doing work.
**Why it happens:** The decision to "commit every state change individually" is correct for audit trails but naive implementation creates contention.
**How to avoid:** Batch related state changes into single locked write operations. Use read-without-lock for non-critical reads (state files are append-only in practice). Only acquire locks for writes.
**Warning signs:** Agents reporting BLOCKED with category ERROR and message containing "lock" or "timeout."

### Pitfall 2: Module Assembly Producing Oversized Agents
**What goes wrong:** Context modules (project state, contracts, style guide) grow as the project evolves. Assembled agents exceed context window limits.
**Why it happens:** Build-time injection of ALL project context into every agent.
**How to avoid:** Context modules should be concise digests, not full state dumps. Include references to files (paths) rather than file contents. Use progressive context loading -- agents read additional files as needed during execution.
**Warning signs:** Assembled agent files exceeding 15KB. Agents failing to complete tasks due to context limits.

### Pitfall 3: Return Protocol Desync (Table vs JSON Mismatch)
**What goes wrong:** The human-readable Markdown table says COMPLETE but the JSON payload says CHECKPOINT, or artifacts lists don't match.
**Why it happens:** Agents generate both formats independently. Under context pressure, they may produce inconsistent outputs.
**How to avoid:** The return protocol module should include a clear instruction: "Generate the JSON first, then render the table from the JSON." Provide a utility function in the CLI tool that generates both from a single data input. The parser should validate consistency and warn on mismatches.
**Warning signs:** Orchestrator reading JSON shows different status than what developer sees in the table.

### Pitfall 4: Stale Lock Not Detected Due to Clock Skew
**What goes wrong:** On some systems (WSL, VMs, containers), system clock may drift or have low mtime resolution. Stale detection based on timestamps fails.
**Why it happens:** `proper-lockfile` uses mtime for stale detection. If the clock is wrong, stale thresholds don't work.
**How to avoid:** Use PID-based liveness checks as the PRIMARY stale detection method (check if the PID that acquired the lock is still running). Use timestamp as a SECONDARY fallback. The `proper-lockfile` library handles this with periodic mtime updates, but add a PID check wrapper.
**Warning signs:** Locks persisting after processes clearly exited. `isLocked()` returning true for locks held by dead processes.

### Pitfall 5: Git Commit Storm from State Changes
**What goes wrong:** Every state update creates a git commit. A single agent run might produce 20+ state commits interleaved with actual code commits, making git history noisy and bisect difficult.
**Why it happens:** Decision to "commit every state change individually" applied too literally.
**How to avoid:** Distinguish between state-tracking commits (progress updates, lock acquisitions) and meaningful state transitions (phase advancement, plan completion). Only commit meaningful transitions. Use a buffer/batch pattern for state-tracking changes within a single agent operation.
**Warning signs:** `git log` showing more `.planning/` commits than code commits. Bisect hitting state commits instead of code changes.

### Pitfall 6: Module Assembly Order Sensitivity
**What goes wrong:** Two modules define conflicting instructions (e.g., core-returns says "always return JSON" but role-executor says "return plain text for simple tasks"). The later module overrides the earlier one due to positional bias in LLM attention.
**Why it happens:** Composable modules can have implicit conflicts that aren't obvious until assembled.
**How to avoid:** Establish clear module authority hierarchy: core modules set baseline behavior, role modules extend (never contradict) core, context modules provide data (never behavioral instructions). Include a "conflicts" test that checks assembled agents for contradictory instructions.
**Warning signs:** Agents inconsistently following return protocol. Different roles producing different return formats despite shared core module.

## Code Examples

### State Read/Write with Locking
```javascript
// Source: Pattern from GSD's state.cjs + proper-lockfile docs
// src/lib/state.cjs

const fs = require('fs');
const path = require('path');
const { acquireLock } = require('./lock.cjs');
const { output, error } = require('./core.cjs');

const PLANNING_DIR = '.planning';

/**
 * Read a field from STATE.md (no lock needed for reads).
 */
function stateGet(cwd, field) {
  const statePath = path.join(cwd, PLANNING_DIR, 'STATE.md');
  const content = fs.readFileSync(statePath, 'utf-8');

  if (!field) return content;

  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\*\\*${escaped}:\\*\\*\\s*(.*)`, 'i');
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

/**
 * Update a field in STATE.md (lock required for writes).
 */
async function stateUpdate(cwd, field, value) {
  const release = await acquireLock(cwd, 'state');
  try {
    const statePath = path.join(cwd, PLANNING_DIR, 'STATE.md');
    let content = fs.readFileSync(statePath, 'utf-8');

    const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, 'i');

    if (pattern.test(content)) {
      content = content.replace(pattern, (_, prefix) => `${prefix}${value}`);
      fs.writeFileSync(statePath, content, 'utf-8');
      return { updated: true, field, value };
    }
    return { updated: false, reason: `Field "${field}" not found` };
  } finally {
    await release();
  }
}

module.exports = { stateGet, stateUpdate };
```

### Return Protocol Parser
```javascript
// Source: User decision from CONTEXT.md (hybrid format)
// src/lib/returns.cjs

const RETURN_MARKER = '<!-- RAPID:RETURN';
const RETURN_END = '-->';

/**
 * Parse a structured return from agent output.
 * Extracts JSON from HTML comment marker.
 */
function parseReturn(agentOutput) {
  const markerIndex = agentOutput.indexOf(RETURN_MARKER);
  if (markerIndex === -1) {
    return { parsed: false, error: 'No RAPID:RETURN marker found' };
  }

  const jsonStart = markerIndex + RETURN_MARKER.length;
  const jsonEnd = agentOutput.indexOf(RETURN_END, jsonStart);
  if (jsonEnd === -1) {
    return { parsed: false, error: 'Unclosed RAPID:RETURN marker' };
  }

  const jsonStr = agentOutput.substring(jsonStart, jsonEnd).trim();
  try {
    const data = JSON.parse(jsonStr);
    return { parsed: true, data };
  } catch (e) {
    return { parsed: false, error: `Invalid JSON: ${e.message}` };
  }
}

/**
 * Generate both Markdown table and JSON comment from structured data.
 * Ensures consistency between human-readable and machine-parseable formats.
 */
function generateReturn(data) {
  const { status, artifacts, commits, tasks_completed, tasks_total,
          duration_minutes, next_action, warnings, notes,
          blocker_category, blocker, resolution,
          handoff_done, handoff_remaining, handoff_decisions,
          handoff_blockers, handoff_resume } = data;

  // Build Markdown table
  const rows = [`| Field | Value |`, `|-------|-------|`];
  rows.push(`| Status | ${status} |`);

  if (status === 'BLOCKED') {
    rows.push(`| Category | ${blocker_category} |`);
    rows.push(`| Blocker | ${blocker} |`);
    rows.push(`| Resolution | ${resolution} |`);
  }

  if (artifacts?.length) rows.push(`| Artifacts | ${artifacts.map(a => '`' + a + '`').join(', ')} |`);
  if (commits?.length) rows.push(`| Commits | ${commits.map(c => '`' + c + '`').join(', ')} |`);
  if (tasks_total) rows.push(`| Tasks | ${tasks_completed}/${tasks_total} |`);
  if (duration_minutes) rows.push(`| Duration | ${duration_minutes}m |`);
  if (next_action) rows.push(`| Next | ${next_action} |`);
  if (warnings?.length) rows.push(`| Warnings | ${warnings.join('; ')} |`);
  if (notes?.length) rows.push(`| Notes | ${notes.join('; ')} |`);

  if (status === 'CHECKPOINT') {
    if (handoff_done) rows.push(`| Done | ${handoff_done} |`);
    if (handoff_remaining) rows.push(`| Remaining | ${handoff_remaining} |`);
    if (handoff_decisions) rows.push(`| Decisions | ${handoff_decisions} |`);
    if (handoff_blockers) rows.push(`| Blockers | ${handoff_blockers} |`);
    if (handoff_resume) rows.push(`| Resume | ${handoff_resume} |`);
  }

  const table = `## ${status}\n\n${rows.join('\n')}`;
  const json = `<!-- RAPID:RETURN ${JSON.stringify(data)} -->`;

  return `${table}\n\n${json}`;
}

module.exports = { parseReturn, generateReturn };
```

### Module Assembly Configuration
```javascript
// Source: Project architecture decisions
// Example config.json agent assembly section

{
  "agents": {
    "rapid-planner": {
      "role": "planner",
      "core": [
        "core-identity.md",
        "core-returns.md",
        "core-state-access.md",
        "core-git.md",
        "core-context-loading.md"
      ],
      "context": ["project", "contracts", "style"]
    },
    "rapid-executor": {
      "role": "executor",
      "core": [
        "core-identity.md",
        "core-returns.md",
        "core-state-access.md",
        "core-git.md"
      ],
      "context": ["project", "style"]
    },
    "rapid-verifier": {
      "role": "verifier",
      "core": [
        "core-identity.md",
        "core-returns.md",
        "core-state-access.md"
      ],
      "context": ["project"]
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic agent prompts (GSD: 50KB planner) | Composable modules assembled at build time | RAPID Phase 1 (new) | Agents stay focused, modules are reusable, prompt maintenance is modular |
| Agent self-reports trusted (GSD: SUMMARY.md as truth) | Filesystem verification by separate verifier agent | RAPID Phase 1 (new) | Eliminates false completion claims; verification is independent |
| flock-based locking (POSIX shell) | mkdir-based atomic locking via proper-lockfile | Established pattern, proper-lockfile mature since 2019 | Works across processes, sessions, and platforms; built-in stale detection |
| JSON as primary state format | Markdown primary with JSON for machine-only data | RAPID design decision | Better git diffs, human-readable in PRs, easier debugging |
| Single-process state access (GSD: no locking) | Concurrent-safe access with lock files | RAPID Phase 1 (new) | Multiple developers/agents can safely access state simultaneously |
| Skills merged with commands (Claude Code 2026) | Skills for auto-invoked knowledge, commands merged into skills | Claude Code v2.x (2025-2026) | Custom commands now live in `.claude/skills/` with optional frontmatter |

**Deprecated/outdated:**
- `.claude/commands/` directory: Still works but skills (`.claude/skills/`) are the recommended path. Commands are merged into the skills system.
- `flock` for file locking: Process-scoped, does not work across separate Claude Code sessions. Use mkdir-based locking instead.

## Open Questions

1. **Lock timeout threshold value**
   - What we know: proper-lockfile defaults to 10,000ms stale threshold. The user decision says "e.g., 5 minutes."
   - What's unclear: Whether 5 minutes is appropriate for all operations, or if different state files need different thresholds.
   - Recommendation: Start with 5 minutes (300,000ms) as default. Expose as config option in `config.json` so projects can tune it. Monitor for contention in practice.

2. **Context module size limits**
   - What we know: Claude Code's context window is large but finite. Assembled agents should stay well under the limit.
   - What's unclear: The exact budget for context modules before they cause problems. The style guide and contracts could grow significantly.
   - Recommendation: Set a soft limit of 2KB per context module, 15KB total assembled agent. The assembler should warn when limits are approached. Context modules should be digests with references, not full dumps.

3. **VERIFICATION.md format**
   - What we know: It should capture pass/fail results for each verification check, with evidence. GSD's verifier uses a goal-backward three-level approach (exists, substantive, wired).
   - What's unclear: Exact Markdown structure for RAPID's two-tier verification (light vs heavy).
   - Recommendation: Follow GSD's three-level pattern adapted for RAPID's tiers. Include frontmatter with structured pass/fail counts for machine parsing.

4. **Module naming for per-project overrides**
   - What we know: Config.json should allow projects to override which modules each agent includes.
   - What's unclear: How overrides interact with defaults. Does a project override replace all core modules or just add/remove specific ones?
   - Recommendation: Use additive/subtractive overrides: `"add_modules": ["custom.md"]`, `"remove_modules": ["core-git.md"]`. Default module list stays in the tool code; config only specifies deltas.

5. **Subagent spawning limitation (Bug #23506)**
   - What we know: STATE.md notes "Custom agents cannot spawn subagents/teams (bug #23506)." Claude Code docs confirm: "Subagents cannot spawn other subagents."
   - What's unclear: Whether this affects RAPID's orchestrator (which needs to delegate to planner/executor/verifier).
   - Recommendation: The orchestrator must be the main thread agent (invoked via `claude --agent rapid-orchestrator`), not a subagent itself. It can then spawn subagents. Alternatively, slash commands can be the orchestrator layer (thin dispatchers that invoke agents). This is the safer path.

## Sources

### Primary (HIGH confidence)
- [proper-lockfile on Context7](/moxystudio/node-proper-lockfile) - Lock API, stale detection, retry configuration, compromise handling, multi-process coordination
- [proper-lockfile GitHub](https://github.com/moxystudio/node-proper-lockfile) - mkdir strategy, configuration options, API surface
- [Claude Code subagent docs](https://code.claude.com/docs/en/sub-agents) - Complete subagent spec: frontmatter fields, isolation options, tool access, hooks, model selection, permission modes
- [Claude Code skills docs](https://code.claude.com/docs/en/skills) - Skill system: directory structure, frontmatter, invocation control, supporting files, `context: fork`
- [Claude Code plugins README](https://github.com/anthropics/claude-code/blob/main/plugins/README.md) - Plugin structure: `.claude-plugin/plugin.json`, commands, agents, skills, hooks directories

### Secondary (MEDIUM confidence)
- [GSD framework state.cjs](/home/pog/.claude/get-shit-done/bin/lib/state.cjs) - Prior art for Markdown-based state management with field extraction/update patterns
- [GSD gsd-tools.cjs](/home/pog/.claude/get-shit-done/bin/gsd-tools.cjs) - Prior art for CLI tool pattern with 60+ atomic subcommands
- [GSD agent definitions](/home/pog/.claude/agents/gsd-*.md) - Prior art for agent prompt structure with XML section tags
- [PAUL state template](/home/pog/RAPID/paul/src/templates/STATE.md) - Prior art for human-readable state file design (<100 lines digest)
- [PAUL checkpoints reference](/home/pog/RAPID/paul/src/references/checkpoints.md) - Prior art for structured interaction protocols
- [RAPID ARCHITECTURE.md](/home/pog/RAPID/.planning/research/ARCHITECTURE.md) - System architecture with component boundaries
- [RAPID DEEP-ANALYSIS.md](/home/pog/RAPID/.planning/research/DEEP-ANALYSIS.md) - Anti-patterns from GSD and PAUL to avoid

### Tertiary (LOW confidence)
- [Prompt routers and flow engineering](https://blog.promptlayer.com/prompt-routers-and-flow-engineering-building-modular-self-correcting-agent-systems/) - Modular prompt composition patterns
- [Inclusive Prompt Engineering Model (IPEM)](https://link.springer.com/article/10.1007/s10462-025-11330-7) - Academic framework for modular LLM prompts

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - proper-lockfile verified via Context7 with code examples; Node.js built-ins are zero-risk
- Architecture: HIGH - Module assembly pattern is straightforward file concatenation; return protocol is well-specified by user decisions; all patterns have prior art in GSD/PAUL
- Pitfalls: HIGH - Informed by concrete failures documented in DEEP-ANALYSIS.md (GSD's monolithic agents, silent error swallowing, no concurrency safety, trusting self-reports)

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (30 days -- stable domain, no rapidly-evolving external dependencies)
