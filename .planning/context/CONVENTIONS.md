# RAPID Conventions

## File Naming

- **Source files:** `kebab-case.cjs` (CommonJS modules, always `.cjs`)
- **Test files:** `kebab-case.test.cjs` (co-located with source in same directory)
- **Edge case tests:** `kebab-case.edge-cases.test.cjs`
- **Lifecycle tests:** `kebab-case.lifecycle.test.cjs`
- **Agent definitions:** `rapid-{role-name}.md` (generated, in `agents/`)
- **Role modules:** `role-{name}.md` (source, in `src/modules/roles/`)
- **Core modules:** `core-{name}.md` (source, in `src/modules/core/`)
- **Skills:** `skills/{command-name}/SKILL.md`
- **Planning artifacts:** UPPER_CASE.md or UPPER_CASE.json

## Naming Conventions

- **Functions:** camelCase (`createWorktree`, `findProjectRoot`, `acquireLock`)
- **Variables:** camelCase (`setName`, `projectRoot`, `lockPath`)
- **Constants:** camelCase (not SCREAMING_CASE)
- **CLI commands:** kebab-case (`prepare-context`, `build-agents`, `delete-branch`)
- **Agent names:** `rapid-{role}` (`rapid-executor`, `rapid-planner`, `rapid-merger`)
- **Set statuses:** lowercase past/present (`pending`, `discussing`, `planning`, `executing`, `complete`, `merged`)
- **Branch names:** `rapid/{set-name}`
- **Worktree paths:** `.rapid-worktrees/{set-name}/`

## Module Structure

Every library module in `src/lib/` and every command handler in `src/commands/` follows this pattern:

```javascript
'use strict';

const fs = require('fs');
const path = require('path');
// ... other requires

// --- Public API ---

function publicFunction(args) {
  // implementation
}

// --- Internal helpers ---

function _helperFunction(args) {
  // implementation
}

module.exports = {
  publicFunction,
  // only export public API
};
```

Key conventions:
- `'use strict'` at top of every file
- CommonJS `require()` / `module.exports` (never ES modules)
- Internal helpers prefixed with `_` (not exported)
- Exports object at bottom of file

## Commit Messages

Follows conventional commits with scope notation:

```
type(scope): description

Types: feat, fix, docs, refactor, chore, test
Scope: set name, phase number, or component name
```

Examples:
- `feat(set-01): add worktree registry reconciliation`
- `fix(merge): handle empty conflict list in L3 detection`
- `docs: update DOCS.md for v3.0 commands`
- `test(contract): add edge case for circular imports`

## Error Handling

- Use `process.stderr.write('[RAPID ERROR] message\n')` for errors
- Use `process.stdout.write(JSON.stringify({...}) + '\n')` for structured output
- Throw descriptive errors with context: `throw new Error(\`Failed to load set "\${setName}": \${reason}\`)`
- Lock operations always include cleanup in finally blocks

## State Management Rules

- Always use `withStateTransaction()` for state mutations (combines lock + read + mutate + write)
- Never write STATE.json directly — always go through state-machine.cjs
- Validate with Zod schemas before every write
- Lock timeout: 300 seconds (configurable via config.json)
- Stale locks auto-cleaned if holding process PID is dead

## Testing Conventions

```javascript
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('ModuleName', () => {
  describe('functionName', () => {
    it('should describe expected behavior', () => {
      // Arrange
      const input = createTestInput();
      // Act
      const result = functionUnderTest(input);
      // Assert
      assert.equal(result, expected);
    });
  });
});
```

- Use Node.js built-in `node:test` module (no jest/mocha)
- Use `assert/strict` for all assertions
- Arrange/Act/Assert pattern
- Descriptive test names starting with "should"
- Clean up temp files/dirs in `afterEach`
- Tests live next to the module they cover (`src/lib/{module}.test.cjs`, `src/commands/{module}.test.cjs`)
- The `package.json` test script only runs `src/**/*.test.cjs` -- **do NOT add tests under `tests/`** for new work (the `tests/` directory contains legacy suites like `tests/ux-audit.test.cjs` but is not on the default test path)

## Shell Commands

- Always use `~` instead of `$HOME` for home directory paths (especially in Node.js contexts)
- Use `node` not `npx` for running scripts
- Quote paths with spaces

## Documentation

- Use context7 MCP when unsure about latest API documentation
- Write unit tests for fine-grained debugging (not just happy paths)
- CLAUDE.md is the authoritative source of project instructions for agents
- Generated files (agents/) are committed to the repo
