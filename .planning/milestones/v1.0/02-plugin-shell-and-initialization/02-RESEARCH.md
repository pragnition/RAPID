# Phase 2: Plugin Shell and Initialization - Research

**Researched:** 2026-03-03
**Domain:** Claude Code plugin architecture, project scaffolding, prerequisite validation
**Confidence:** HIGH

## Summary

Phase 2 restructures the existing `rapid/` directory into the standard Claude Code plugin layout (`.claude-plugin/plugin.json` + `commands/` + `skills/`), implements `/rapid:init` for conversational project scaffolding with prerequisite validation, and delivers `/rapid:help` as a static command reference with ASCII workflow diagram.

The Claude Code plugin system is well-documented and stable. The plugin.json manifest is straightforward (name is the only required field), commands are `.md` files with YAML frontmatter, and skills use a `SKILL.md` directory pattern. The pragnition/claude-research plugin provides a proven reference implementation that uses both `commands/` (legacy) and `skills/` (modern) directories. RAPID should follow the same dual-registration pattern for maximum compatibility.

The init command's technical core is: (1) a standalone `validatePrereqs()` function using `child_process.execSync` for version extraction with semver comparison, (2) conversational scaffolding that creates `.planning/` files from user answers, and (3) an existing-project detection flow that offers reinitialize/upgrade/cancel options. The help command is entirely static content rendered from a `.md` skill file.

**Primary recommendation:** Use the standard Claude Code plugin directory layout with `.claude-plugin/plugin.json` at plugin root, `commands/` for backward-compatible `.md` command files, and `skills/` for modern SKILL.md-based skills. Keep `src/lib/` for Node.js runtime code. Register init and help as both commands and skills (matching the pragnition pattern).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Conversational setup -- asks project name, description, and team size (how many developers will work in parallel)
- Populates PROJECT.md from conversation answers (developer doesn't edit templates directly)
- If `.planning/` already exists: detect and offer options (reinitialize, upgrade/add missing files, or cancel) -- no silent destructive behavior
- Phase directories (`.planning/phases/`) created on-demand when planning begins, not during init
- Block on hard requirements: git 2.30+ (needed for worktrees), Node.js 18+
- Warn-only for nice-to-haves: jq 1.6+
- Check all prerequisites and report all results at once (summary table of pass/fail/warn) -- don't stop at first failure
- Verify current directory is a git repository; if not, offer to run `git init`. Don't check clean/dirty state
- Standalone reusable `validatePrereqs()` function in lib/ -- other commands (like /rapid:status in Phase 7) can call it later
- Full roadmap view: show all planned commands with "available" vs "coming soon" markers
- Commands grouped by workflow stage (Setup, Planning, Execution, Review) -- not alphabetical or by phase
- Include ASCII workflow diagram showing the RAPID flow (init -> plan -> execute -> merge)
- Static reference only -- no context-aware routing (that belongs in /rapid:status, Phase 7)
- Restructure from current `rapid/` layout to standard Claude Code plugin layout
- Plugin root gets `.claude-plugin/plugin.json` manifest and `commands/` directory
- Keep `src/lib/` for runtime Node.js code (core, state, lock, assembler, returns, verify)
- Plugin name: "rapid" -- commands namespace as `/rapid:init`, `/rapid:help`, etc.
- Create DOCS.md documenting Phase 2 commands -- marketplace-ready from day one
- Must conform to pragnition/claude-plugins marketplace spec

### Claude's Discretion
- Exact directory restructuring approach (move vs copy, what goes where)
- Command .md file structure and frontmatter details
- plugin.json metadata (keywords, description wording)
- ASCII diagram design for help command
- How to phrase conversational init questions

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INIT-01 | Developer can run `/rapid:init` to scaffold `.planning/` directory with all required state files | Plugin skill/command system registers `/rapid:init`; init logic creates PROJECT.md, STATE.md, ROADMAP.md, config.json via conversational flow; existing-directory detection with reinitialize/upgrade/cancel |
| INIT-05 | Init configures git repo and validates prerequisites (git 2.30+, jq 1.6+, Node.js 18+) | `validatePrereqs()` in `src/lib/prereqs.cjs` uses `child_process.execSync` for version extraction with semver-like comparison; git repo check via `.git` directory or `git rev-parse`; offer `git init` if missing |
| STAT-04 | Developer can run `/rapid:help` to see all available commands and workflow guidance | Static `.md` skill file with `disable-model-invocation: true`; ASCII workflow diagram; commands grouped by workflow stage |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `child_process` | N/A (Node.js 18+) | Execute `git --version`, `node --version`, `jq --version` for prereq checks | Zero dependencies; `execSync` is the standard pattern for CLI version checking |
| Node.js built-in `fs` | N/A (Node.js 18+) | File creation, directory scaffolding, existing-project detection | Zero dependencies; already used throughout `src/lib/` |
| Node.js built-in `path` | N/A (Node.js 18+) | Cross-platform path resolution | Zero dependencies; already used throughout `src/lib/` |
| Node.js built-in `node:test` | N/A (Node.js 18+) | Unit testing | Already established in Phase 1 (zero-dependency test infrastructure) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `proper-lockfile` | ^4.1.2 | Already a dependency for mkdir-based atomic locking | Already installed; no new dependency needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual semver comparison | `semver` npm package | Adds a dependency for a simple 3-number comparison; not justified for checking 3 tools |
| `child_process.execSync` | `child_process.exec` (async) | Async adds complexity; prereq checks are sequential and fast (<100ms each); sync is fine |
| `commands/` directory | `skills/` only | Commands are legacy but still widely used; pragnition reference uses both for compatibility |

**Installation:**
```bash
# No new packages needed -- Phase 2 uses only Node.js built-ins and existing dependencies
```

## Architecture Patterns

### Recommended Plugin Structure (Post-Restructure)
```
rapid/                          # Plugin root
├── .claude-plugin/
│   └── plugin.json             # Plugin manifest (name, version, description, etc.)
├── commands/                   # Legacy command .md files (backward compat)
│   ├── init.md                 # /rapid:init command
│   └── help.md                 # /rapid:help command
├── skills/                     # Modern SKILL.md-based skills
│   ├── init/
│   │   └── SKILL.md            # /rapid:init skill (mirrors commands/init.md)
│   └── help/
│       └── SKILL.md            # /rapid:help skill (mirrors commands/help.md)
├── src/
│   ├── bin/
│   │   └── rapid-tools.cjs     # CLI entry point (add init/prereqs subcommands)
│   ├── lib/
│   │   ├── core.cjs            # Existing: output, error, findProjectRoot, loadConfig
│   │   ├── prereqs.cjs         # NEW: validatePrereqs(), checkGitRepo()
│   │   ├── prereqs.test.cjs    # NEW: tests for prereq validation
│   │   ├── init.cjs            # NEW: scaffoldProject(), detectExisting()
│   │   ├── init.test.cjs       # NEW: tests for init scaffolding
│   │   ├── state.cjs           # Existing
│   │   ├── lock.cjs            # Existing
│   │   ├── assembler.cjs       # Existing
│   │   ├── returns.cjs         # Existing
│   │   └── verify.cjs          # Existing
│   └── modules/                # Existing agent modules (preserved)
│       ├── core/
│       └── roles/
├── agents/                     # Existing assembled agents (gitignored)
├── config.json                 # Existing agent configuration
├── DOCS.md                     # NEW: marketplace-ready documentation
├── package.json                # Existing (no new dependencies)
├── package-lock.json
├── node_modules/
└── .gitignore                  # Update: add agents/ (already done)
```

### Pattern 1: Plugin Manifest
**What:** `.claude-plugin/plugin.json` defines plugin identity and component discovery
**When to use:** Required for marketplace distribution; recommended for all plugins

Source: [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference)
```json
{
  "name": "rapid",
  "version": "0.2.0",
  "description": "RAPID - Agentic Parallelizable and Isolatable Development for Claude Code",
  "author": {
    "name": "fishjojo1"
  },
  "homepage": "https://github.com/fishjojo1/RAPID",
  "repository": "https://github.com/fishjojo1/RAPID",
  "license": "MIT",
  "keywords": ["rapid", "parallel", "development", "worktree", "multi-agent", "orchestration"]
}
```

**Key details from official docs:**
- `name` is the ONLY required field (all others optional but recommended)
- Name must be kebab-case, no spaces, max 64 characters
- Name is used for namespacing: commands become `/rapid:init`, `/rapid:help`
- Components in default directories (`commands/`, `skills/`, `agents/`) auto-discovered -- no need to list them in plugin.json
- Custom component paths supplement defaults, don't replace them

### Pattern 2: Command/Skill .md Files
**What:** Markdown files with YAML frontmatter that register slash commands
**When to use:** Every slash command the plugin provides

Source: [Claude Code Skills Documentation](https://code.claude.com/docs/en/slash-commands)
```yaml
---
description: Initialize a new RAPID project with conversational setup
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Glob
---

# skill content here...
```

**Key frontmatter fields:**
- `description` (recommended): What the skill does; Claude uses this for auto-invocation decisions
- `disable-model-invocation: true`: Only user can invoke (prevents Claude from auto-triggering init)
- `allowed-tools`: Tools Claude can use without per-use permission when skill is active
- `argument-hint`: Shown during autocomplete (e.g., `[project-name]`)
- `$ARGUMENTS`: Placeholder for arguments passed by user
- `name`: Display name (defaults to directory name if omitted)

**Dual registration pattern (from pragnition reference):**
The pragnition/claude-research plugin registers each command in BOTH locations:
- `commands/research-new.md` (legacy commands directory)
- `skills/research-new/SKILL.md` (modern skills directory)

The skills version includes YAML frontmatter (`description`, `disable-model-invocation`), while the commands version is just the bare markdown content. Both create the same `/plugin-name:command-name` slash command. This ensures compatibility across Claude Code versions.

### Pattern 3: Conversational Init with CLI Tooling
**What:** The init command delegates heavy lifting to Node.js functions via `rapid-tools.cjs`
**When to use:** When command logic is complex enough to warrant testable Node.js code

```
User runs /rapid:init
  → SKILL.md instructions tell Claude what to ask and how to scaffold
  → Claude asks conversational questions (project name, description, team size)
  → Claude calls: node rapid/src/bin/rapid-tools.cjs prereqs
  → Claude calls: node rapid/src/bin/rapid-tools.cjs init scaffold --name "..." --desc "..." --team-size N
  → Or: Claude uses Write tool directly to create .planning/ files from templates
```

**Two approaches for file creation (Claude's discretion):**
1. **CLI-driven:** `rapid-tools.cjs init scaffold` creates files -- more testable, consistent
2. **Direct Write:** Claude uses Write tool with inline templates -- simpler, more flexible

**Recommendation:** Use CLI for prereq validation (deterministic, testable) and direct Write for file scaffolding (Claude can customize content based on conversation). The SKILL.md instructions should call `rapid-tools.cjs prereqs` for validation, then use Write tool for file creation based on templates embedded in the skill instructions.

### Pattern 4: Prerequisite Validation
**What:** Standalone `validatePrereqs()` function that checks tool versions
**When to use:** During init; reusable by other commands (e.g., /rapid:status in Phase 7)

```javascript
// Source: established Node.js pattern for version checking
'use strict';
const { execSync } = require('child_process');

function validatePrereqs() {
  const results = [];

  // Git check (hard requirement)
  results.push(checkTool({
    name: 'git',
    command: 'git --version',
    parseVersion: (output) => output.match(/git version (\d+\.\d+)/)?.[1],
    minVersion: '2.30',
    required: true,
    reason: 'needed for worktrees'
  }));

  // Node.js check (hard requirement)
  results.push(checkTool({
    name: 'Node.js',
    command: 'node --version',
    parseVersion: (output) => output.match(/v(\d+)/)?.[1],
    minVersion: '18',
    required: true,
    reason: 'runtime requirement'
  }));

  // jq check (soft requirement)
  results.push(checkTool({
    name: 'jq',
    command: 'jq --version',
    parseVersion: (output) => output.match(/jq-(\d+\.\d+)/)?.[1],
    minVersion: '1.6',
    required: false,
    reason: 'nice-to-have for JSON processing'
  }));

  return results;
}
```

### Anti-Patterns to Avoid
- **Stopping at first failure:** User decision says check ALL prereqs and show summary table. Never short-circuit.
- **Silent destructive behavior:** If `.planning/` exists, MUST offer options (reinitialize, upgrade, cancel). Never overwrite silently.
- **Creating phase directories during init:** Phase dirs are created on-demand during planning, not at init time.
- **Context-aware help:** Help is static reference only. Dynamic routing belongs in `/rapid:status` (Phase 7).
- **Putting components inside `.claude-plugin/`:** Only `plugin.json` goes in `.claude-plugin/`. Commands, skills, agents go at plugin root.
- **Checking git clean/dirty state:** User explicitly said NOT to check clean/dirty state, only whether it's a git repo.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Version comparison | Full semver parser with prerelease/build metadata | Simple major.minor numeric comparison | Only comparing 3 tools with simple version numbers; semver library is overkill |
| Plugin manifest validation | Custom JSON schema validator | Claude Code's built-in `claude plugin validate .` | Plugin system validates manifests automatically; don't duplicate |
| Command routing/registration | Custom slash command framework | Claude Code's native `commands/` and `skills/` directory auto-discovery | Plugin system handles all command registration, namespacing, and routing |
| Template engine | Handlebars/Mustache for file templates | String interpolation in Node.js | Templates are simple markdown with a few variable substitutions; no need for template engine |

**Key insight:** The Claude Code plugin system handles command registration, namespacing, tool permissions, and invocation routing. RAPID only needs to provide the `.md` files in the right directories. The heavy lifting for init is in the conversational flow (handled by Claude via SKILL.md instructions) and prereq validation (handled by a small Node.js function).

## Common Pitfalls

### Pitfall 1: Plugin Name Namespacing
**What goes wrong:** Plugin commands don't show up, or show up with wrong namespace
**Why it happens:** The `name` field in `plugin.json` determines the command namespace. If name is "rapid", commands in `commands/init.md` become `/rapid:init`. If name is "rapid-plugin", they become `/rapid-plugin:init`.
**How to avoid:** Set `name: "rapid"` in plugin.json. Test with `claude --debug` to see command registration.
**Warning signs:** Commands not appearing in `/` autocomplete; wrong prefix in command names.

### Pitfall 2: Directory Restructuring Breaks Imports
**What goes wrong:** Moving files around breaks `require()` paths in existing modules
**Why it happens:** Phase 1 code uses relative paths (`require('../lib/core.cjs')`). If directory structure changes, these break.
**How to avoid:** Keep `src/lib/` and `src/bin/` in the same relative positions. The plugin root just adds `.claude-plugin/`, `commands/`, `skills/`, and `DOCS.md` alongside existing directories. Minimal structural change.
**Warning signs:** `MODULE_NOT_FOUND` errors when running `rapid-tools.cjs`.

### Pitfall 3: Version Parsing Edge Cases
**What goes wrong:** `git --version` outputs "git version 2.43.0.windows.1" on Windows, or `node --version` outputs "v22.17.0" with a 'v' prefix
**Why it happens:** Each tool has its own version output format
**How to avoid:** Use regex-based parsing with fallbacks. Test with diverse version strings. Handle cases where command is not found (try/catch around execSync).
**Warning signs:** Tests only covering happy-path version strings.

### Pitfall 4: Existing .planning/ Detection
**What goes wrong:** Init silently overwrites user's existing state files, losing project history
**Why it happens:** Not checking for existing directory before creating files
**How to avoid:** Check for `.planning/` existence FIRST. If found, present three options: (1) reinitialize (backup then recreate), (2) upgrade (add missing files, keep existing), (3) cancel. Never proceed without user confirmation.
**Warning signs:** No branching logic for existing-project case in SKILL.md instructions.

### Pitfall 5: Git Repository Detection False Positives
**What goes wrong:** Init runs in a subdirectory of a different git repo, creating `.planning/` in the wrong project
**Why it happens:** `git rev-parse --is-inside-work-tree` returns true even in deeply nested subdirectories
**How to avoid:** Check for `.git` directory (or `git rev-parse --git-dir`) in the current directory specifically, not just "is this inside any git repo". Or use `git rev-parse --show-toplevel` and compare to cwd.
**Warning signs:** Init succeeding in unexpected directories.

## Code Examples

### Example 1: prereqs.cjs - Prerequisite Validation Module
```javascript
// Pattern for src/lib/prereqs.cjs
'use strict';

const { execSync } = require('child_process');

/**
 * Check a single tool's presence and version.
 * @param {Object} opts - Tool check options
 * @returns {Object} { name, status, version, required, reason, message }
 */
function checkTool({ name, command, parseVersion, minVersion, required, reason }) {
  try {
    const output = execSync(command, {
      stdio: 'pipe',
      timeout: 5000,
      encoding: 'utf-8'
    }).trim();

    const version = parseVersion(output);
    if (!version) {
      return {
        name, status: 'error', version: null, required, reason,
        message: `Could not parse version from: ${output}`
      };
    }

    const meetsMinimum = compareVersions(version, minVersion) >= 0;
    return {
      name,
      status: meetsMinimum ? (required ? 'pass' : 'pass') : (required ? 'fail' : 'warn'),
      version,
      minVersion,
      required,
      reason,
      message: meetsMinimum
        ? `${name} ${version} (>= ${minVersion})`
        : `${name} ${version} is below minimum ${minVersion} (${reason})`
    };
  } catch (err) {
    return {
      name,
      status: required ? 'fail' : 'warn',
      version: null,
      required,
      reason,
      message: `${name} not found${required ? ' (REQUIRED)' : ' (optional)'}: ${reason}`
    };
  }
}

/**
 * Compare two version strings (major.minor format).
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
function compareVersions(a, b) {
  const partsA = String(a).split('.').map(Number);
  const partsB = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Validate all prerequisites. Returns array of results.
 * Checks all tools regardless of failures (no short-circuit).
 */
function validatePrereqs() {
  return [
    checkTool({
      name: 'git',
      command: 'git --version',
      parseVersion: (out) => out.match(/git version (\d+\.\d+)/)?.[1],
      minVersion: '2.30',
      required: true,
      reason: 'needed for worktrees'
    }),
    checkTool({
      name: 'Node.js',
      command: 'node --version',
      parseVersion: (out) => out.match(/v?(\d+)/)?.[1],
      minVersion: '18',
      required: true,
      reason: 'runtime requirement'
    }),
    checkTool({
      name: 'jq',
      command: 'jq --version',
      parseVersion: (out) => out.match(/jq-(\d+\.\d+)/)?.[1],
      minVersion: '1.6',
      required: false,
      reason: 'nice-to-have for JSON processing'
    }),
  ];
}

/**
 * Check if current directory is a git repository.
 * @param {string} cwd - Directory to check
 * @returns {{ isRepo: boolean, toplevel: string|null }}
 */
function checkGitRepo(cwd) {
  try {
    const toplevel = execSync('git rev-parse --show-toplevel', {
      cwd,
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    return { isRepo: true, toplevel };
  } catch {
    return { isRepo: false, toplevel: null };
  }
}

/**
 * Format prerequisite results as a summary table.
 * @param {Array} results - From validatePrereqs()
 * @returns {{ table: string, hasBlockers: boolean, hasWarnings: boolean }}
 */
function formatPrereqSummary(results) {
  const lines = ['| Tool | Version | Min | Status |', '|------|---------|-----|--------|'];
  let hasBlockers = false;
  let hasWarnings = false;

  for (const r of results) {
    const icon = r.status === 'pass' ? 'PASS' : r.status === 'warn' ? 'WARN' : 'FAIL';
    if (r.status === 'fail') hasBlockers = true;
    if (r.status === 'warn') hasWarnings = true;
    lines.push(`| ${r.name} | ${r.version || 'not found'} | ${r.minVersion} | ${icon} |`);
  }

  return { table: lines.join('\n'), hasBlockers, hasWarnings };
}

module.exports = { validatePrereqs, checkGitRepo, formatPrereqSummary, checkTool, compareVersions };
```

### Example 2: Init SKILL.md Pattern
```yaml
---
description: Initialize a new RAPID project with conversational setup and prerequisite validation
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Glob
---

# RAPID: Initialize Project

## Step 1: Validate Prerequisites

Run prerequisite checks:
\`\`\`bash
node rapid/src/bin/rapid-tools.cjs prereqs
\`\`\`

Display the results table. If any FAIL results exist, inform the user which tools need
updating and stop. If only WARN results, continue with a note.

## Step 2: Check Git Repository

Check if we're in a git repository. If not, ask the user if they'd like to run `git init`.

## Step 3: Check for Existing .planning/

If `.planning/` directory already exists, present options:
1. **Reinitialize** - Backup existing files to `.planning.backup/` and create fresh
2. **Upgrade** - Keep existing files, add any missing ones
3. **Cancel** - Abort init

## Step 4: Conversational Setup

Ask the user ONE question at a time:
1. "What's the name of this project?" (suggest: infer from directory name)
2. "In one sentence, what does this project do?"
3. "How many developers will work in parallel?" (for team-size configuration)

## Step 5: Scaffold .planning/

Create the following structure:
- `.planning/PROJECT.md` - populated from conversation answers
- `.planning/STATE.md` - initialized with Phase 0 position
- `.planning/ROADMAP.md` - empty template ready for /rapid:plan
- `.planning/REQUIREMENTS.md` - empty template
- `.planning/config.json` - default configuration

Do NOT create `.planning/phases/` -- those are created on-demand during planning.

## Step 6: Confirm

Tell the user what was created and suggest next step: `/rapid:help`
```

### Example 3: Help SKILL.md Pattern
```yaml
---
description: Show all available RAPID commands and workflow guidance
disable-model-invocation: true
---

Output ONLY the reference content below. Do NOT add project-specific analysis,
git status, or any commentary.

# RAPID Command Reference

**RAPID** (Agentic Parallelizable and Isolatable Development) enables team-based
parallel development with Claude Code.

## Workflow

\`\`\`
  INIT ──> PLAN ──> EXECUTE ──> MERGE

  /rapid:init       /rapid:plan       /rapid:execute     /rapid:merge
  Set up project    Decompose work    Build in parallel  Review & integrate
  scaffolding       into sets         in worktrees       back to main
\`\`\`

## Commands

### Setup
| Command | Status | Description |
|---------|--------|-------------|
| `/rapid:init` | Available | Initialize project scaffolding and validate prerequisites |
| `/rapid:help` | Available | Show this command reference |

### Planning
| Command | Status | Description |
|---------|--------|-------------|
| `/rapid:plan` | Coming Soon | Decompose work into parallelizable sets |
| `/rapid:assumptions` | Coming Soon | Surface approach assumptions before planning |

### Execution
| Command | Status | Description |
|---------|--------|-------------|
| `/rapid:execute` | Coming Soon | Execute sets in isolated worktrees |
| `/rapid:status` | Coming Soon | View cross-set progress dashboard |
| `/rapid:pause` | Coming Soon | Pause work with state preservation |
| `/rapid:resume` | Coming Soon | Resume from handoff files |

### Review
| Command | Status | Description |
|---------|--------|-------------|
| `/rapid:merge` | Coming Soon | Deep review and dependency-ordered merging |

---
*RAPID v0.2.0 | 2 commands available, 7 coming soon*
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.claude/commands/` only | `.claude/skills/<name>/SKILL.md` (with commands/ still supported) | Claude Code 2025-2026 | Skills support subdirectories with supporting files, YAML frontmatter; commands still work for backward compat |
| Manual plugin discovery | `.claude-plugin/plugin.json` + marketplace system | Claude Code 1.0.33+ (2025) | Plugins auto-discovered from manifest; marketplace distribution with install/update/validate CLI |
| No plugin validation | `claude plugin validate .` or `/plugin validate .` | Claude Code 1.0.33+ | Built-in validation catches manifest errors before distribution |

**Deprecated/outdated:**
- `commands/` directory is "legacy" according to official docs but still fully supported. The pragnition reference implementation uses both patterns for maximum compatibility.

## Open Questions

1. **Plugin root location vs repository root**
   - What we know: RAPID's plugin files currently live in `rapid/` subdirectory, not at repo root. Claude Code expects plugin root at the directory level where `.claude-plugin/` lives.
   - What's unclear: Should the plugin root be `rapid/` (keeping current structure) or should plugin metadata (`.claude-plugin/`, `commands/`, `skills/`) live at repo root with source code in `rapid/src/`?
   - Recommendation: Keep `rapid/` as the plugin root. The marketplace entry's `source` field points to the plugin directory. Users install via marketplace, not by cloning the repo root. This avoids mixing plugin metadata with project files (`.planning/`, `CLAUDE.md`, etc.) at repo root. The plugin root is `rapid/`, and `.claude-plugin/plugin.json` goes at `rapid/.claude-plugin/plugin.json`.

2. **Skills vs Commands registration pattern**
   - What we know: pragnition uses both `commands/` and `skills/` with identical content. Official docs say skills are the modern approach but commands still work.
   - What's unclear: Whether we need both or just one. Overhead of maintaining duplicates.
   - Recommendation: Use `skills/` as primary (SKILL.md with frontmatter), and `commands/` as symlinks or copies for backward compatibility. The content is identical; only the YAML frontmatter header differs (commands don't require it but support it).

3. **How rapid-tools.cjs invocation works from SKILL.md**
   - What we know: SKILL.md gives Claude instructions. Claude can use Bash tool to run node commands. The path needs to be resolvable.
   - What's unclear: Whether `${CLAUDE_PLUGIN_ROOT}` variable works inside SKILL.md content (docs say it works in hooks and MCP configs).
   - Recommendation: In SKILL.md, instruct Claude to find the rapid directory and invoke `node rapid/src/bin/rapid-tools.cjs prereqs`. Alternatively, since the SKILL.md lives inside the plugin directory, use relative path heuristics. Test this during implementation.

## Sources

### Primary (HIGH confidence)
- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference) - Complete plugin.json schema, directory structure, component specifications
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/slash-commands) - SKILL.md format, YAML frontmatter fields, invocation control, argument handling
- [Claude Code Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) - marketplace.json spec, plugin sources, distribution
- [Claude Code Discover Plugins](https://code.claude.com/docs/en/discover-plugins) - Installation, scopes, marketplace management

### Secondary (MEDIUM confidence)
- pragnition/claude-research (locally installed plugin at `~/.claude/plugins/cache/pragnition-plugins/claude-research/1.0.0/`) - Reference implementation for dual commands/skills pattern, plugin.json structure
- RAPID Phase 1 codebase (`rapid/src/lib/*.cjs`) - Established patterns: CommonJS, co-located tests, zero-dependency philosophy
- paul-framework (`paul/src/commands/init.md`, `paul/src/commands/help.md`) - UX patterns for conversational init and help formatting

### Tertiary (LOW confidence)
- None. All findings verified against official docs or local code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Zero new dependencies; uses Node.js built-ins and existing codebase patterns
- Architecture: HIGH - Plugin system is well-documented with official reference; pragnition provides proven implementation pattern
- Pitfalls: HIGH - Common plugin mistakes well-documented in official troubleshooting; version parsing edge cases are well-known

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable domain; Claude Code plugin system is mature)
