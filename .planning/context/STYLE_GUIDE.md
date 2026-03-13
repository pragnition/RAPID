# RAPID Style Guide

## Language & Runtime

- **JavaScript (CommonJS)** — all source files use `.cjs` extension
- **Node.js 18+** — leverages built-in `node:test`, `node:assert`, `node:fs`, `node:path`
- No TypeScript, no transpilation, no bundler
- No ES module syntax (`import`/`export`) — strictly `require()`/`module.exports`

## Code Style

### Formatting
- 2-space indentation
- Single quotes for strings
- Semicolons required
- Trailing commas in multi-line objects/arrays
- Max line length: ~120 characters (soft limit)

### Functions
- Named function declarations preferred over arrow functions for top-level
- Arrow functions acceptable for callbacks and inline handlers
- Destructure parameters when > 2 properties

```javascript
// Good
function createWorktree(projectRoot, setName, options = {}) { ... }

// Good for callbacks
const sets = milestones.flatMap(m => m.sets);

// Destructure when many params
function mergeSetBranch(cwd, setId, { noFF = true, orderByDAG = true } = {}) { ... }
```

### Error Handling
- Guard clauses at function entry (fail fast)
- Template literals for error messages with context
- `process.stderr.write()` for user-facing errors (not console.error)

```javascript
function loadSet(cwd, setName) {
  if (!setName) throw new Error('setName is required');
  const defPath = path.join(cwd, '.planning', 'sets', setName, 'DEFINITION.md');
  if (!fs.existsSync(defPath)) {
    throw new Error(`Set definition not found: ${defPath}`);
  }
  // ...
}
```

### Output
- Structured JSON to stdout for machine consumption
- Human-readable text to stderr for status/progress
- Never mix JSON and text on stdout

```javascript
// Machine output
process.stdout.write(JSON.stringify({ status: 'ok', data: result }) + '\n');

// Human status
process.stderr.write(`[RAPID] Processing set "${setName}"...\n`);
```

## File Organization

### Source Layout
```
src/lib/{module}.cjs         — library module (public API)
src/lib/{module}.test.cjs    — co-located tests
src/bin/rapid-tools.cjs      — CLI entry point
src/modules/core/*.md        — shared agent prompt modules
src/modules/roles/*.md       — role-specific agent prompts
```

### Module Template
```javascript
'use strict';

// Standard library imports first
const fs = require('fs');
const path = require('path');

// Local imports second
const { findProjectRoot } = require('./core.cjs');
const { acquireLock } = require('./lock.cjs');

// --- Constants ---
const DEFAULT_TIMEOUT = 300000;

// --- Public API ---

function publicFunction(cwd, args) {
  // ...
}

function anotherPublic(cwd, args) {
  // ...
}

// --- Internal ---

function _validateInput(args) {
  // underscore prefix = not exported
}

// --- Exports ---
module.exports = {
  publicFunction,
  anotherPublic,
};
```

## Agent Prompt Style

### Markdown Structure
- YAML frontmatter for metadata (name, description, model, tools, color)
- XML tags for prompt sections (`<identity>`, `<role>`, `<returns>`, `<tools>`)
- Imperative voice for instructions
- Numbered steps for sequential procedures
- Tables for reference data

### Return Protocol
```markdown
<!-- RAPID:RETURN {
  "status": "COMPLETE",
  "artifacts": ["src/auth.js"],
  "commits": ["abc123d"],
  "tasks_completed": 5,
  "tasks_total": 5
} -->
```

## Git Conventions

- Branch naming: `rapid/{set-name}`
- Commit format: `type(scope): description`
- Merge strategy: `--no-ff` (always create merge commit)
- Worktree location: `.rapid-worktrees/{set-name}/`
- Never force push; never skip hooks

## Testing Style

- Node.js built-in `node:test` — no external test runners
- `assert/strict` — always strict assertions
- Descriptive names: `it('should throw when setName is empty', ...)`
- Test edge cases explicitly (dedicated `.edge-cases.test.cjs` files when needed)
- Clean up filesystem artifacts in `afterEach`
- Mock only external boundaries (git commands, file system in some cases)
