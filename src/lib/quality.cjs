'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUALITY_FILE = 'QUALITY.md';
const PATTERNS_FILE = 'PATTERNS.md';
const DEFAULT_TOKEN_BUDGET = 10000;
const CONTEXT_DIR = path.join('.planning', 'context');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Return the absolute path to .planning/context/ within the given project root.
 * @param {string} cwd - Project root directory
 * @returns {string}
 */
function _getContextDir(cwd) {
  return path.join(cwd, CONTEXT_DIR);
}

/**
 * Ensure the .planning/context/ directory exists (lazy init).
 * @param {string} cwd - Project root directory
 */
function _ensureContextDir(cwd) {
  fs.mkdirSync(_getContextDir(cwd), { recursive: true });
}

/**
 * Detect project tech stack by calling detectCodebase from context.cjs.
 * Returns a fallback object if context.cjs is unavailable or throws.
 * @param {string} cwd - Project root directory
 * @returns {{ hasSourceCode: boolean, languages: string[], frameworks: string[], configFiles: string[], sourceStats: object }}
 */
function _detectStack(cwd) {
  try {
    const { detectCodebase } = require('./context.cjs');
    return detectCodebase(cwd);
  } catch (_e) {
    return { hasSourceCode: false, languages: [], frameworks: [], configFiles: [], sourceStats: {} };
  }
}

/**
 * Generate default QUALITY.md content based on detected stack info.
 * @param {{ languages: string[], frameworks: string[] }} stackInfo
 * @returns {string}
 */
function _generateDefaultQualityMd(stackInfo) {
  const languages = stackInfo.languages || [];
  const frameworks = stackInfo.frameworks || [];

  const hasJS = languages.includes('javascript') || languages.includes('typescript');
  const hasTS = languages.includes('typescript');
  const hasPython = languages.includes('python');
  const hasGo = languages.includes('go');
  const hasRust = languages.includes('rust');

  const approvedSections = [];
  const antiPatternSections = [];

  // General section -- always present
  approvedSections.push(
    '### General\n' +
    '- Write self-documenting code with clear variable and function names\n' +
    '- Keep functions small and focused on a single responsibility\n' +
    '- Handle errors explicitly rather than silently ignoring them\n' +
    '- Write tests for all public API surface',
  );

  antiPatternSections.push(
    '### General\n' +
    '- Avoid deeply nested conditionals (prefer early returns)\n' +
    '- Avoid magic numbers and strings without named constants\n' +
    '- Do not suppress errors without logging or re-throwing\n' +
    '- Avoid global mutable state',
  );

  // JavaScript / TypeScript
  if (hasJS) {
    const langName = hasTS ? 'TypeScript' : 'JavaScript';
    const jsApproved = [
      `### ${langName}`,
      "- Use `'use strict'` in CommonJS modules",
      '- Prefer `const` over `let`; avoid `var`',
      '- Handle Promise rejections with `.catch()` or `try/catch` in async functions',
      '- Use destructuring for clarity when accessing multiple object properties',
    ];
    if (hasTS) {
      jsApproved.push('- Use explicit type annotations on public function signatures');
      jsApproved.push('- Avoid `any` type; prefer `unknown` with type guards');
    }
    approvedSections.push(jsApproved.join('\n'));

    const jsAnti = [
      `### ${langName}`,
      '- Avoid `==` loose equality; use `===` strict equality',
      '- Do not use `var` for variable declarations',
      '- Avoid unhandled Promise rejections',
      '- Do not use `arguments` object; prefer rest parameters',
    ];
    if (hasTS) {
      jsAnti.push('- Avoid `any` type casts; they defeat type safety');
      jsAnti.push('- Do not use non-null assertion `!` without a comment explaining why it is safe');
    }
    antiPatternSections.push(jsAnti.join('\n'));
  }

  // Python
  if (hasPython) {
    approvedSections.push(
      '### Python\n' +
      '- Use type hints on function signatures\n' +
      '- Use context managers (`with` statements) for resource management\n' +
      '- Prefer f-strings for string formatting\n' +
      '- Follow PEP 8 style guidelines',
    );

    antiPatternSections.push(
      '### Python\n' +
      '- Avoid bare `except:` clauses; catch specific exceptions\n' +
      '- Do not use mutable default arguments in function signatures\n' +
      '- Avoid `import *`; use explicit imports\n' +
      '- Do not shadow built-in names (e.g., `list`, `dict`, `type`)',
    );
  }

  // Go
  if (hasGo) {
    approvedSections.push(
      '### Go\n' +
      '- Wrap errors with context using `fmt.Errorf("context: %w", err)`\n' +
      '- Propagate `context.Context` as the first parameter in functions\n' +
      '- Use table-driven tests for comprehensive coverage\n' +
      '- Follow Go naming conventions (short variable names in tight scopes)',
    );

    antiPatternSections.push(
      '### Go\n' +
      '- Do not ignore returned errors\n' +
      '- Avoid global variables; use dependency injection\n' +
      '- Do not use `panic` for recoverable errors\n' +
      '- Avoid overly deep package nesting',
    );
  }

  // Rust
  if (hasRust) {
    approvedSections.push(
      '### Rust\n' +
      '- Use `Result<T, E>` for fallible operations instead of `panic!`\n' +
      '- Derive standard traits (`Debug`, `Clone`, `PartialEq`) when appropriate\n' +
      '- Use the `?` operator for error propagation\n' +
      '- Prefer owned types in public APIs for simplicity',
    );

    antiPatternSections.push(
      '### Rust\n' +
      '- Avoid `unwrap()` in production code; handle `None`/`Err` explicitly\n' +
      '- Do not use `unsafe` without extensive justification and comments\n' +
      '- Avoid unnecessary `clone()` calls in hot paths\n' +
      '- Do not use `std::mem::forget` without careful lifetime reasoning',
    );
  }

  // Framework-specific sections
  for (const fw of frameworks) {
    const fwName = fw.charAt(0).toUpperCase() + fw.slice(1);
    if (fw === 'react') {
      approvedSections.push(
        `### ${fwName}\n` +
        '- Use functional components with hooks\n' +
        '- Keep component state minimal and co-located\n' +
        '- Use `key` props correctly in lists\n' +
        '- Memoize expensive calculations with `useMemo`',
      );
      antiPatternSections.push(
        `### ${fwName}\n` +
        '- Avoid direct DOM manipulation outside of refs\n' +
        '- Do not mutate state directly; always use setter functions\n' +
        '- Avoid large monolithic components; split by responsibility\n' +
        '- Do not perform side effects outside of `useEffect`',
      );
    } else if (fw === 'express' || fw === 'fastify' || fw === 'koa') {
      approvedSections.push(
        `### ${fwName}\n` +
        '- Validate all incoming request data before processing\n' +
        '- Use middleware for cross-cutting concerns (auth, logging, error handling)\n' +
        '- Return appropriate HTTP status codes\n' +
        '- Handle async route errors explicitly',
      );
      antiPatternSections.push(
        `### ${fwName}\n` +
        '- Do not expose stack traces or internal error details to clients\n' +
        '- Avoid synchronous blocking operations in request handlers\n' +
        '- Do not trust user input without validation/sanitization',
      );
    } else if (fw === 'django' || fw === 'flask' || fw === 'fastapi') {
      approvedSections.push(
        `### ${fwName}\n` +
        '- Use the framework ORM/validation tools rather than raw SQL/manual checks\n' +
        '- Keep views/endpoints thin; move business logic to service layer\n' +
        '- Use environment variables for all configuration secrets',
      );
      antiPatternSections.push(
        `### ${fwName}\n` +
        '- Do not put business logic directly in views/endpoints\n' +
        '- Avoid hard-coded credentials or secrets in source code\n' +
        '- Do not bypass framework security mechanisms',
      );
    }
  }

  const approvedBlock = approvedSections.join('\n\n');
  const antiBlock = antiPatternSections.join('\n\n');

  return `# Quality Profile

## Approved Patterns

${approvedBlock}

## Anti-Patterns

${antiBlock}
`;
}

/**
 * Generate default PATTERNS.md content with domain-categorized patterns.
 * @param {{ languages: string[], frameworks: string[] }} stackInfo
 * @returns {string}
 */
function _generateDefaultPatternsMd(stackInfo) {
  const languages = stackInfo.languages || [];

  const hasJS = languages.includes('javascript') || languages.includes('typescript');
  const hasPython = languages.includes('python');
  const hasGo = languages.includes('go');

  // Error Handling section
  let errorHandlingApproved;
  let errorHandlingAnti;

  if (hasJS) {
    errorHandlingApproved =
      '- Wrap async operations in try/catch with specific error handling:\n' +
      '  ```js\n' +
      '  try {\n' +
      '    const result = await fetchData();\n' +
      '  } catch (err) {\n' +
      '    if (err instanceof NetworkError) handleNetworkError(err);\n' +
      '    else throw err;\n' +
      '  }\n' +
      '  ```\n' +
      '- Create domain-specific error classes extending `Error`\n' +
      '- Always include contextual information in error messages';
    errorHandlingAnti =
      '- Silent catch blocks that swallow errors: `catch (e) {}`\n' +
      '- Using `.then().catch()` inconsistently with async/await style\n' +
      '- Throwing non-Error objects (e.g., strings or plain objects)';
  } else if (hasPython) {
    errorHandlingApproved =
      '- Catch specific exception types, not bare `except`:\n' +
      '  ```python\n' +
      '  try:\n' +
      '      result = fetch_data()\n' +
      '  except NetworkError as e:\n' +
      '      handle_network_error(e)\n' +
      '  ```\n' +
      '- Use custom exception classes for domain errors\n' +
      '- Log exceptions with full tracebacks at appropriate levels';
    errorHandlingAnti =
      '- Bare `except:` clauses that catch all exceptions including `SystemExit`\n' +
      '- Suppressing exceptions with `pass` without logging\n' +
      '- Re-raising exceptions without preserving context (`raise from`)';
  } else if (hasGo) {
    errorHandlingApproved =
      '- Wrap errors with context for traceability:\n' +
      '  ```go\n' +
      '  if err != nil {\n' +
      '      return fmt.Errorf("fetchData: %w", err)\n' +
      '  }\n' +
      '  ```\n' +
      '- Use sentinel errors for expected error cases\n' +
      '- Always check returned error values';
    errorHandlingAnti =
      '- Ignoring error return values with `_`\n' +
      '- Using `panic` for recoverable errors\n' +
      '- Returning bare errors without context';
  } else {
    errorHandlingApproved =
      '- Always handle errors explicitly at the call site\n' +
      '- Provide context in error messages (what operation failed, why)\n' +
      '- Use domain-specific error types to distinguish error categories';
    errorHandlingAnti =
      '- Silently ignoring errors\n' +
      '- Catching all errors without differentiation\n' +
      '- Swallowing exceptions in catch blocks without logging';
  }

  // State Management section
  let stateApproved;
  let stateAnti;

  if (hasJS) {
    stateApproved =
      '- Prefer immutable state updates (return new objects/arrays rather than mutating)\n' +
      '- Co-locate state with the code that owns it\n' +
      '- Use factory functions to encapsulate state initialization';
    stateAnti =
      '- Mutating shared state across module boundaries\n' +
      '- Using global variables for application state\n' +
      '- Mixing synchronous and asynchronous state updates without coordination';
  } else {
    stateApproved =
      '- Keep state minimal and co-located with the logic that uses it\n' +
      '- Use immutable data structures where possible\n' +
      '- Document state invariants and ownership explicitly';
    stateAnti =
      '- Global mutable state accessible from anywhere\n' +
      '- Unclear ownership of shared state\n' +
      '- State mutation without clear transaction boundaries';
  }

  // Testing section
  let testingApproved;
  let testingAnti;

  if (hasJS) {
    testingApproved =
      '- Use `node:test` with `describe`/`it`/`beforeEach`/`afterEach` for structure\n' +
      '- Write unit tests for all exported functions\n' +
      '- Use `assert/strict` for assertions\n' +
      '- Use temporary directories with cleanup (`mkdtempSync`) for file system tests';
    testingAnti =
      '- Writing tests that depend on execution order\n' +
      '- Leaving test side-effects in the file system or global state\n' +
      '- Testing implementation details rather than public behavior\n' +
      '- Writing tests without cleanup in `afterEach`';
  } else if (hasPython) {
    testingApproved =
      '- Use `pytest` with fixtures for setup and teardown\n' +
      '- Write parameterized tests for edge cases\n' +
      '- Use `tmp_path` fixture for file system tests\n' +
      '- Name test functions descriptively: `test_<function>_<scenario>`';
    testingAnti =
      '- Tests that depend on network access without mocking\n' +
      '- Hardcoded absolute paths in tests\n' +
      '- Testing private/internal functions directly';
  } else if (hasGo) {
    testingApproved =
      '- Use table-driven tests with `t.Run` for parameterized cases\n' +
      '- Use `t.TempDir()` for file system tests\n' +
      '- Use `t.Helper()` in helper functions for better error reporting';
    testingAnti =
      '- Tests that mutate package-level variables\n' +
      '- Skipping error assertions in tests\n' +
      '- Non-deterministic test behavior (time-dependent, random)';
  } else {
    testingApproved =
      '- Write tests for all public API functions\n' +
      '- Each test should be independent and idempotent\n' +
      '- Use descriptive test names that document expected behavior';
    testingAnti =
      '- Tests that depend on execution order or shared state\n' +
      '- Tests without cleanup that leave side effects\n' +
      '- Testing multiple unrelated behaviors in a single test case';
  }

  // API Design section
  const apiApproved =
    '- Design APIs around use cases, not internal data structures\n' +
    '- Use consistent naming conventions across the entire API surface\n' +
    '- Document all public function parameters and return types\n' +
    '- Return meaningful error messages with enough context to debug';
  const apiAnti =
    '- Exposing implementation details in public interfaces\n' +
    '- Inconsistent parameter ordering across related functions\n' +
    '- Returning raw internal errors to callers without wrapping\n' +
    '- Breaking changes without deprecation warnings';

  return `# Pattern Library

## Error Handling
### Approved
${errorHandlingApproved}
### Anti-Patterns
${errorHandlingAnti}

## State Management
### Approved
${stateApproved}
### Anti-Patterns
${stateAnti}

## Testing
### Approved
${testingApproved}
### Anti-Patterns
${testingAnti}

## API Design
### Approved
${apiApproved}
### Anti-Patterns
${apiAnti}
`;
}

/**
 * Parse QUALITY.md markdown content into a structured QualityProfile object.
 * Uses heading-based section splitting.
 * @param {string} content - Raw markdown string
 * @returns {{ approvedPatterns: object, antiPatterns: object, raw: string }}
 */
function _parseQualityMd(content) {
  const profile = {
    approvedPatterns: {},
    antiPatterns: {},
    raw: content,
  };

  if (!content || content.trim() === '') {
    return profile;
  }

  const lines = content.split('\n');

  // State machine: track which top-level section and subsection we are in
  let currentTopSection = null; // 'approved' | 'anti' | null
  let currentSubSection = null; // lowercase subsection name, or null

  for (const line of lines) {
    const trimmed = line.trim();

    // Top-level section detection (## heading)
    if (trimmed.startsWith('## ')) {
      const heading = trimmed.slice(3).trim().toLowerCase();
      if (heading === 'approved patterns') {
        currentTopSection = 'approved';
        currentSubSection = null;
      } else if (heading === 'anti-patterns' || heading === 'antipatterns') {
        currentTopSection = 'anti';
        currentSubSection = null;
      } else {
        // Other top-level heading -- reset context
        currentTopSection = null;
        currentSubSection = null;
      }
      continue;
    }

    // Subsection detection (### heading) -- only within a known top section
    if (trimmed.startsWith('### ')) {
      if (currentTopSection !== null) {
        const subName = trimmed.slice(4).trim().toLowerCase();
        currentSubSection = subName;

        // Ensure the key exists
        if (currentTopSection === 'approved') {
          if (!profile.approvedPatterns[subName]) {
            profile.approvedPatterns[subName] = [];
          }
        } else {
          if (!profile.antiPatterns[subName]) {
            profile.antiPatterns[subName] = [];
          }
        }
      }
      continue;
    }

    // Bullet point collection -- only when inside a known section + subsection
    if (currentTopSection !== null && currentSubSection !== null && trimmed.startsWith('- ')) {
      const entry = trimmed.slice(2); // strip "- " prefix
      if (currentTopSection === 'approved') {
        if (!profile.approvedPatterns[currentSubSection]) {
          profile.approvedPatterns[currentSubSection] = [];
        }
        profile.approvedPatterns[currentSubSection].push(entry);
      } else {
        if (!profile.antiPatterns[currentSubSection]) {
          profile.antiPatterns[currentSubSection] = [];
        }
        profile.antiPatterns[currentSubSection].push(entry);
      }
    }
  }

  return profile;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load (or generate) the quality profile for the given project root.
 *
 * If .planning/context/QUALITY.md exists, it is read and parsed.
 * If it does not exist, a stack-aware default is generated and written.
 * PATTERNS.md is also generated if it does not exist.
 *
 * @param {string} cwd - Project root directory
 * @returns {{ approvedPatterns: object, antiPatterns: object, raw: string }}
 */
function loadQualityProfile(cwd) {
  _ensureContextDir(cwd);

  const contextDir = _getContextDir(cwd);
  const qualityPath = path.join(contextDir, QUALITY_FILE);
  const patternsPath = path.join(contextDir, PATTERNS_FILE);

  let qualityContent;
  let stackInfo = null;

  if (fs.existsSync(qualityPath)) {
    qualityContent = fs.readFileSync(qualityPath, 'utf-8');
  } else {
    // Generate stack-aware default
    stackInfo = _detectStack(cwd);
    qualityContent = _generateDefaultQualityMd(stackInfo);
    fs.writeFileSync(qualityPath, qualityContent, 'utf-8');
  }

  // Also ensure PATTERNS.md exists
  if (!fs.existsSync(patternsPath)) {
    if (stackInfo === null) {
      stackInfo = _detectStack(cwd);
    }
    const patternsContent = _generateDefaultPatternsMd(stackInfo);
    fs.writeFileSync(patternsPath, patternsContent, 'utf-8');
  }

  return _parseQualityMd(qualityContent);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  loadQualityProfile,
  DEFAULT_TOKEN_BUDGET,
};
