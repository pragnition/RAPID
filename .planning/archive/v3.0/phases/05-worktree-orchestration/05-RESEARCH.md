# Phase 5: Worktree Orchestration - Research

**Researched:** 2026-03-04
**Domain:** Git worktree lifecycle management via Node.js CLI
**Confidence:** HIGH

## Summary

Phase 5 implements the physical isolation layer for RAPID's parallel execution model. Each set gets its own git worktree -- a full working copy of the repository on its own branch -- with a scoped CLAUDE.md that limits the agent's view to only the set's files, contracts, and style guide. The worktree lifecycle (create, status, cleanup) is managed through a new `worktree.cjs` library module and corresponding `worktree` subcommands on `rapid-tools.cjs`.

The technical domain is straightforward: git worktrees are a mature feature (available since git 2.5, project requires 2.30+), the git CLI provides all necessary operations (`worktree add`, `list --porcelain`, `remove`, `prune`), and Node.js `child_process.execSync` (already used extensively in the codebase) is the right tool for invoking them. No external libraries are needed beyond what's already installed. The primary complexity lies in state tracking (mapping sets to worktrees/branches), error handling for edge cases (branch conflicts, dirty worktrees, stale state), and generating correctly-scoped CLAUDE.md files from existing assembler and contract infrastructure.

**Primary recommendation:** Build a `worktree.cjs` library module (following `lock.cjs`/`plan.cjs` patterns) with pure functions wrapping git commands, a JSON registry at `.planning/worktrees/REGISTRY.json` for state tracking, and extend `rapid-tools.cjs` with `worktree create|status|cleanup|list` subcommands.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Branch naming convention: `rapid/<set-name>` (e.g., `rapid/auth-core`, `rapid/ui-shell`)
- Worktree location: git default worktree management (`.git/worktrees/` metadata, checkout directory specified by RAPID)
- Base branch: always current HEAD of main/master -- all worktrees start from the same baseline
- Creation timing: lazy -- worktree created on demand when a specific set starts executing, not all at once
- Status format: ASCII table with columns: Set | Branch | Phase | Status | Path (similar to `docker ps` or `kubectl get pods`)
- Lifecycle phases: simple 4-state model -- Created / Executing / Done / Error
- Scope: active worktrees only (no history of completed/cleaned worktrees)
- Wave summary: yes -- wave-level progress summary line above the worktree table (e.g., "Wave 1: 2/3 sets executing")
- Cleanup trigger: prompt user for confirmation immediately after successful merge
- Branch retention: keep branches by default -- a separate `/rapid:cleanup` command (with an agent) handles branch deletion when developer is ready
- Safety checks: block cleanup if worktree has uncommitted changes
- Error worktrees: same flow as successful ones -- prompt and clean on user confirmation
- Scoped CLAUDE.md contents: set's CONTRACT.json + project style guide + owned file list
- Scoped CLAUDE.md replaces project CLAUDE.md entirely -- self-contained with only set-specific content
- Boundary enforcement: includes explicit "DO NOT TOUCH" deny list for files owned by other sets
- Generation timing: just before execution starts (not at worktree creation) -- ensures latest contracts and style guide are used

### Claude's Discretion
- Exact checkout directory path structure for worktrees
- Internal state tracking format (JSON in .planning/ for worktree registry)
- Error messages and edge case handling (e.g., branch already exists, worktree already exists)
- How the wave summary line formats progress counts

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WORK-01 | Each set gets its own git worktree and dedicated branch created automatically | `git worktree add -b rapid/<set-name> <path> HEAD` creates both worktree and branch in one atomic operation. Verified on git 2.43.0. Library function `createWorktree()` wraps this with error handling for branch conflicts and path existence. |
| WORK-02 | Developer can run `/rapid:status` to see all active worktrees, their set assignments, and lifecycle phase | `git worktree list --porcelain` provides machine-parseable output. Combined with REGISTRY.json (set-to-worktree mapping), a status table can be rendered with columns: Set, Branch, Phase, Status, Path. Wave summary derived from DAG.json. |
| WORK-03 | Completed worktrees are cleaned up automatically (worktree removed, branch optionally deleted after merge) | `git worktree remove <path>` handles clean worktrees. Git blocks removal of dirty worktrees (exit 128), which maps directly to the safety check requirement. Branch deletion via `git branch -d` is deferred to `/rapid:cleanup` command per user decision. |
| WORK-04 | Each worktree gets a scoped CLAUDE.md containing only its set's contracts, relevant context, and style guide | Existing `assembler.cjs` has context injection slots (project, contracts, style, contextFiles). `contract.cjs` has `createOwnershipMap()` for deny lists. Scoped CLAUDE.md generation is a template function reading CONTRACT.json + OWNERSHIP.json + style guide, written to worktree root at generation time. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `child_process` | built-in (Node 18+) | Execute git commands synchronously | Already used in prereqs.cjs, verify.cjs -- zero new dependencies |
| Node.js `fs` | built-in | File I/O for registry, CLAUDE.md generation | Already used in every module |
| Node.js `path` | built-in | Path resolution for worktree paths | Already used in every module |
| `proper-lockfile` | ^4.1.2 | Concurrent access to REGISTRY.json | Already installed, used in lock.cjs for state protection |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `node:test` | built-in | Unit testing | All new modules get colocated .test.cjs files |
| Node.js `node:assert/strict` | built-in | Test assertions | Used in all existing tests |
| Node.js `os` | built-in | Temp directories for test isolation | Test setup uses `fs.mkdtempSync(os.tmpdir())` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `child_process.execSync` | `simple-git` npm package | Adds dependency; execSync is already the project pattern and sufficient for the ~5 git commands needed |
| JSON registry file | SQLite / LevelDB | Massive overkill; JSON with proper-lockfile matches existing state patterns (GATES.json, DAG.json, OWNERSHIP.json) |
| Custom ASCII table | `cli-table3` npm package | Adds dependency; a simple string-padded table (like docker ps output) is 20 lines of code |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
rapid/src/lib/
├── worktree.cjs        # Core worktree operations (create, remove, list, status, generateScopedClaudeMd)
├── worktree.test.cjs   # Colocated unit tests
├── core.cjs            # (existing) findProjectRoot, output, error
├── lock.cjs            # (existing) acquireLock, isLocked
├── plan.cjs            # (existing) loadSet, listSets
├── contract.cjs        # (existing) createOwnershipMap
├── assembler.cjs       # (existing) loadContextFiles
└── state.cjs           # (existing) stateGet, stateUpdate

rapid/src/bin/
└── rapid-tools.cjs     # (extend) add 'worktree' command with subcommands

rapid/skills/
├── status/
│   └── SKILL.md        # /rapid:status skill
└── cleanup/
    └── SKILL.md        # /rapid:cleanup skill (agent-backed per user spec)

.planning/worktrees/
├── REGISTRY.json       # Worktree-to-set mapping and lifecycle state
└── .gitignore          # Exclude lock files if needed

.rapid-worktrees/       # Checkout directory for all RAPID worktrees
├── auth-core/          # Worktree for auth-core set
├── ui-shell/           # Worktree for ui-shell set
└── .gitignore          # Must be in root .gitignore
```

### Pattern 1: Git Command Wrapper with Error Normalization
**What:** Each git operation is wrapped in a function that executes via `execSync`, catches errors, and returns normalized results.
**When to use:** Every git worktree operation (create, remove, list, status check).
**Example:**
```javascript
// Pattern from existing prereqs.cjs and verify.cjs
const { execSync } = require('child_process');

function gitExec(args, cwd) {
  try {
    return {
      ok: true,
      stdout: execSync(`git ${args}`, {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000,
      }).trim(),
    };
  } catch (err) {
    return {
      ok: false,
      exitCode: err.status,
      stderr: (err.stderr || '').toString().trim(),
    };
  }
}
```

### Pattern 2: Registry with Lock-Protected Updates
**What:** REGISTRY.json tracks worktree state, using proper-lockfile for concurrent access (same pattern as state.cjs).
**When to use:** Any worktree state mutation (create, update lifecycle phase, remove).
**Example:**
```javascript
// Follows state.cjs pattern for lock-protected writes
const { acquireLock } = require('./lock.cjs');

async function registryUpdate(cwd, updateFn) {
  const release = await acquireLock(cwd, 'worktree-registry');
  try {
    const registry = loadRegistry(cwd);
    const updated = updateFn(registry);
    writeRegistry(cwd, updated);
    return updated;
  } finally {
    await release();
  }
}
```

### Pattern 3: Scoped CLAUDE.md Template Generation
**What:** Generate a self-contained CLAUDE.md for a worktree from set contracts, ownership data, and style guide.
**When to use:** Just before execution starts in a worktree (per user decision).
**Example:**
```javascript
// Extends assembler.cjs loadContextFiles pattern
function generateScopedClaudeMd(cwd, setName) {
  const set = loadSet(cwd, setName);
  const ownership = loadOwnership(cwd);

  // Build deny list: files owned by OTHER sets
  const denyList = Object.entries(ownership.ownership)
    .filter(([_, owner]) => owner !== setName)
    .map(([filePath]) => filePath);

  const sections = [
    `# Set: ${setName} -- Scoped Agent Context`,
    '',
    '## Your Scope',
    `You are working on the "${setName}" set.`,
    '',
    '## Interface Contract',
    '```json',
    JSON.stringify(set.contract, null, 2),
    '```',
    '',
    '## File Ownership',
    'You may ONLY modify these files:',
    ...set.contract.exports.functions.map(f => `- ${f.file}`),
    '',
    '## DO NOT TOUCH',
    'These files are owned by other sets. Do NOT modify them:',
    ...denyList.map(f => `- ${f}`),
    '',
    // Style guide injected here
  ];

  return sections.join('\n');
}
```

### Pattern 4: ASCII Table Formatter
**What:** Renders status data as a fixed-width ASCII table matching docker/kubectl conventions.
**When to use:** `/rapid:status` output rendering.
**Example:**
```javascript
function formatStatusTable(worktrees) {
  const headers = ['SET', 'BRANCH', 'PHASE', 'STATUS', 'PATH'];
  const rows = worktrees.map(wt => [
    wt.setName, wt.branch, wt.phase, wt.status, wt.path,
  ]);

  // Calculate column widths
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => r[i].length))
  );

  // Format header
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('  ');
  const separator = widths.map(w => '-'.repeat(w)).join('  ');

  // Format rows
  const rowLines = rows.map(r =>
    r.map((cell, i) => cell.padEnd(widths[i])).join('  ')
  );

  return [headerLine, separator, ...rowLines].join('\n');
}
```

### Anti-Patterns to Avoid
- **Storing worktree paths as absolute paths in REGISTRY.json:** Use relative paths from project root so the registry is portable across machines. Resolve to absolute at runtime.
- **Creating all worktrees at once at plan time:** User decision is lazy creation -- worktrees are created on-demand when execution begins for a specific set. Do not pre-create.
- **Using `git worktree add` without the `-b` flag:** Always use `-b rapid/<set-name>` to create a named branch. Without it, git uses the directory name as the branch, which doesn't follow the `rapid/` convention.
- **Using `git worktree remove --force` for cleanup:** The `--force` flag skips dirty checks. Always try without `--force` first, and only use it if the user explicitly confirms (per the safety check requirement).
- **Generating CLAUDE.md at worktree creation time:** Per user decision, generation happens "just before execution starts" to ensure latest contracts and style guide are used. Worktree creation and CLAUDE.md generation are separate operations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent registry access | Custom file locking | `lock.cjs` with `proper-lockfile` | Already built and tested; handles stale lock recovery |
| Worktree path discovery | Custom `.git` file parsing | `git worktree list --porcelain` | Git tracks its own worktrees perfectly; parsing the porcelain format is trivial |
| Branch existence checking | `git branch --list` + custom parsing | Let `git worktree add -b` fail and handle the error | Git's own error is clearer and more reliable than pre-checking |
| Dirty worktree detection | Custom `git status --porcelain` parsing | Let `git worktree remove` fail (exit 128) | Git already blocks removal of dirty worktrees -- use its built-in safety |
| Set-to-wave mapping | Custom DAG traversal | Read `DAG.json` directly (already has waves object) | DAG.json's `waves` property already groups sets by wave number |
| File ownership deny lists | Scan filesystem for other sets | Read `OWNERSHIP.json` from `contract.createOwnershipMap()` | Already built in Phase 4; provides complete file-to-set mapping |
| Main/master branch detection | Hardcode "main" | `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null` or `git branch --show-current` | Handles both "main" and "master" naming conventions |

**Key insight:** This phase is almost entirely a composition layer. The hard parts (contracts, ownership, DAG, locking, assembler context injection) were all solved in Phases 1-4. Phase 5 wires them together with a thin git worktree CLI wrapper.

## Common Pitfalls

### Pitfall 1: Branch Already Exists
**What goes wrong:** `git worktree add -b rapid/<set-name>` fails with "fatal: a branch named 'rapid/...' already exists" if a previous run created the branch but cleanup was incomplete.
**Why it happens:** Crashed process, manual interruption, or stale state in REGISTRY.json.
**How to avoid:** Before creating, check if branch exists (`git rev-parse --verify rapid/<set-name>`). If it does, check if a worktree already uses it (`git worktree list --porcelain`). Offer recovery options: reuse existing, delete and recreate, or abort.
**Warning signs:** `exitCode: 255` from `git worktree add`.

### Pitfall 2: Worktree Already Exists at Path
**What goes wrong:** `git worktree add` fails because the target directory already exists (maybe from a failed cleanup).
**Why it happens:** Previous worktree was not cleanly removed, or the path was manually created.
**How to avoid:** Check if directory exists before creating. If it does and is a valid worktree, offer to reuse it. If it's a stale directory, run `git worktree prune` then retry.
**Warning signs:** "fatal: '<path>' already exists" from git.

### Pitfall 3: Relative Path Confusion
**What goes wrong:** `git worktree add` with a relative path creates the worktree relative to the current working directory, not the project root.
**Why it happens:** Node.js `execSync` inherits `process.cwd()`, which may differ from the project root.
**How to avoid:** Always resolve worktree paths to absolute paths using `path.resolve(projectRoot, '.rapid-worktrees', setName)` and pass the `cwd` option to `execSync` as the project root.
**Warning signs:** Worktrees appearing in unexpected locations.

### Pitfall 4: Registry Desync from Git State
**What goes wrong:** REGISTRY.json says a worktree exists but `git worktree list` doesn't show it (or vice versa).
**Why it happens:** Manual git operations outside RAPID, crashed processes, or concurrent modification.
**How to avoid:** Always treat `git worktree list --porcelain` as the source of truth. On every status query, reconcile REGISTRY.json with actual git state. Add a `reconcile()` function that syncs registry to reality.
**Warning signs:** Status table shows worktrees that `git worktree list` doesn't, or missing worktrees that git knows about.

### Pitfall 5: Worktree .planning/ Directory Confusion
**What goes wrong:** The worktree checkout includes the `.planning/` directory from the main branch, which could confuse `findProjectRoot()` when running RAPID commands inside a worktree.
**Why it happens:** Worktrees check out the full repo contents, including `.planning/`.
**How to avoid:** The worktree's `.planning/` is part of its branch state. This is actually desirable -- agents running in worktrees can read their own `.planning/` state. The scoped CLAUDE.md replaces the root CLAUDE.md, providing proper isolation. `findProjectRoot()` will find the worktree root (which has `.planning/`), which is correct behavior.
**Warning signs:** Agents in worktrees accidentally modifying main branch's `.planning/` state (they can't -- it's a separate checkout).

### Pitfall 6: Forgetting to .gitignore the Worktree Directory
**What goes wrong:** The `.rapid-worktrees/` directory gets tracked by git in the main worktree, causing massive noise in `git status`.
**Why it happens:** No `.gitignore` entry for the worktree checkout directory.
**How to avoid:** Add `.rapid-worktrees/` to the project's `.gitignore` during worktree initialization (or as part of `worktree create` if not already present). Verified: the project currently has no `.gitignore` at root level.
**Warning signs:** `git status` in main worktree shows thousands of untracked files.

## Code Examples

Verified patterns from testing on git 2.43.0 and existing codebase:

### Creating a Worktree
```javascript
// Verified: git worktree add -b rapid/test-wt .rapid-worktrees/test-wt HEAD
// Creates branch AND worktree in one atomic operation
const { execSync } = require('child_process');

function createWorktree(projectRoot, setName) {
  const branch = `rapid/${setName}`;
  const worktreePath = path.resolve(projectRoot, '.rapid-worktrees', setName);

  const result = gitExec(
    `worktree add -b ${branch} "${worktreePath}" HEAD`,
    projectRoot
  );

  if (!result.ok) {
    if (result.stderr.includes('already exists')) {
      throw new Error(`Branch "${branch}" already exists. Run cleanup or provide --force.`);
    }
    throw new Error(`Failed to create worktree: ${result.stderr}`);
  }

  return { branch, path: worktreePath };
}
```

### Parsing Porcelain Worktree List
```javascript
// Verified: git worktree list --porcelain produces:
//   worktree /path/to/worktree
//   HEAD <sha>
//   branch refs/heads/<name>
//   <blank line>
function parseWorktreeList(projectRoot) {
  const result = gitExec('worktree list --porcelain', projectRoot);
  if (!result.ok) return [];

  const entries = [];
  const blocks = result.stdout.split('\n\n').filter(Boolean);

  for (const block of blocks) {
    const lines = block.split('\n');
    const entry = {};
    for (const line of lines) {
      if (line.startsWith('worktree ')) entry.path = line.slice(9);
      if (line.startsWith('HEAD ')) entry.head = line.slice(5);
      if (line.startsWith('branch ')) entry.branch = line.slice(7).replace('refs/heads/', '');
      if (line === 'detached') entry.detached = true;
      if (line.startsWith('locked')) entry.locked = true;
    }
    entries.push(entry);
  }

  return entries;
}
```

### Safe Worktree Removal with Dirty Check
```javascript
// Verified: git worktree remove fails with exit 128 for dirty worktrees
function removeWorktree(projectRoot, worktreePath) {
  const relPath = path.relative(projectRoot, worktreePath);
  const result = gitExec(`worktree remove "${relPath}"`, projectRoot);

  if (!result.ok) {
    if (result.stderr.includes('modified or untracked')) {
      return { removed: false, reason: 'dirty', message: 'Worktree has uncommitted changes' };
    }
    return { removed: false, reason: 'error', message: result.stderr };
  }

  return { removed: true };
}
```

### REGISTRY.json Structure
```json
{
  "version": 1,
  "worktrees": {
    "auth-core": {
      "setName": "auth-core",
      "branch": "rapid/auth-core",
      "path": ".rapid-worktrees/auth-core",
      "phase": "Created",
      "status": "active",
      "wave": 1,
      "createdAt": "2026-03-04T10:00:00.000Z"
    }
  }
}
```

### Wave Summary Formatting
```javascript
// "Wave 1: 2/3 sets executing"
function formatWaveSummary(registry, dagJson) {
  const waves = dagJson.waves;
  const lines = [];

  for (const [waveNum, waveData] of Object.entries(waves)) {
    const total = waveData.sets.length;
    const active = waveData.sets.filter(s =>
      registry.worktrees[s] && registry.worktrees[s].phase === 'Executing'
    ).length;
    const done = waveData.sets.filter(s =>
      registry.worktrees[s] && registry.worktrees[s].phase === 'Done'
    ).length;

    if (active > 0 || done > 0) {
      lines.push(`Wave ${waveNum}: ${done}/${total} done, ${active} executing`);
    } else {
      lines.push(`Wave ${waveNum}: ${total} sets pending`);
    }
  }

  return lines.join('\n');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `git worktree add` without `--orphan` | `--orphan` flag available (git 2.36+) | git 2.36 (2022) | Could create worktrees with no parent commit; not needed here since we always branch from HEAD |
| No `git worktree repair` | `git worktree repair` available (git 2.30+) | git 2.30 (2021) | Can fix broken worktree links after moving directories; useful for recovery |
| Manual worktree pruning | `git worktree prune` cleans stale administrative files | git 2.5+ | Run after manual directory removal to keep git metadata clean |
| No porcelain format | `--porcelain` flag for machine-readable output | git 2.15+ (2017) | Stable format for parsing; won't change between git versions |

**Deprecated/outdated:**
- None relevant. Git worktree API is stable and hasn't deprecated any features used by this phase.

## Open Questions

1. **Worktree Checkout Directory Naming**
   - What we know: User decided on lazy creation with `rapid/<set-name>` branch naming. Checkout directory is at Claude's discretion.
   - What's unclear: Should the checkout directory be `.rapid-worktrees/<set-name>` (inside project root) or `../<project-name>-worktrees/<set-name>` (sibling directory)?
   - Recommendation: Use `.rapid-worktrees/<set-name>` inside the project root. Simpler path resolution, easier to `.gitignore`, and the dot-prefix hides it from normal directory listings. Add `.rapid-worktrees/` to `.gitignore` on first worktree creation.

2. **Main Branch Name Detection**
   - What we know: User decision says "current HEAD of main/master."
   - What's unclear: How to detect whether the main branch is "main" or "master."
   - Recommendation: Use `git rev-parse --abbrev-ref HEAD` when creating worktrees. The user decision says "always current HEAD" which means we branch from whatever HEAD is, regardless of branch name. If HEAD is detached, error with a clear message.

3. **Registry Recovery**
   - What we know: REGISTRY.json can desync from git state (crashed processes, manual git operations).
   - What's unclear: Should recovery be automatic (reconcile on every read) or explicit (a `worktree repair` subcommand)?
   - Recommendation: Light automatic reconciliation on every `status` read (compare registry against `git worktree list --porcelain`). Mark orphaned entries, add discovered worktrees. Full repair as explicit subcommand.

## Sources

### Primary (HIGH confidence)
- `git worktree --help` (git 2.43.0) -- full command reference, tested on project's installed git version
- Direct testing on project repository: `git worktree add`, `list --porcelain`, `remove`, branch conflict errors, dirty worktree errors
- Existing codebase analysis: `lock.cjs`, `plan.cjs`, `contract.cjs`, `assembler.cjs`, `core.cjs`, `state.cjs`, `rapid-tools.cjs`

### Secondary (MEDIUM confidence)
- None needed -- all findings verified through direct testing

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all built-in Node.js + existing project libraries
- Architecture: HIGH -- follows established project patterns exactly (CJS modules, colocated tests, JSON state files, CLI subcommands)
- Pitfalls: HIGH -- all error scenarios verified through direct `git worktree` testing on the project's git installation
- Scoped CLAUDE.md: HIGH -- builds on existing `assembler.cjs` context injection + `contract.cjs` ownership maps

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable domain -- git worktree API is mature)
