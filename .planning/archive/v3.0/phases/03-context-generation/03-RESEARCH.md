# Phase 3: Context Generation - Research

**Researched:** 2026-03-04
**Domain:** Codebase analysis, context file generation, CLAUDE.md conventions
**Confidence:** HIGH

## Summary

Phase 3 implements automated codebase analysis and context file generation for RAPID. The system must detect an existing codebase (brownfield detection), analyze its patterns/conventions/dependencies, and produce structured context files that agents consume: a lean CLAUDE.md with pointers, plus detail files in `.planning/context/` (CODEBASE.md, ARCHITECTURE.md, CONVENTIONS.md, STYLE_GUIDE.md, and others as discovered). The approach splits work between a Node.js library (`context.cjs`) that performs deterministic detection (file presence, config parsing, directory structure mapping) and a subagent (`role-context-generator.md`) that performs deep semantic analysis (pattern recognition, convention inference, ambiguity resolution). This mirrors how Claude Code's own `/init` command works -- scanning config files and code to produce a CLAUDE.md -- but RAPID goes further by producing multiple role-injected detail files rather than a single monolithic file.

The key architectural insight is that CLAUDE.md must stay under ~60-80 lines (project summary + code style rules + tech stack identification + pointers) to avoid bloating agent context windows, while deeper context lives in separate files that the assembler injects based on agent role. The assembler already supports `context.project`, `context.contracts`, and `context.style` injection slots -- this phase extends it to load from `.planning/context/` files and map them to roles via config.

**Primary recommendation:** Build a `context.cjs` library with deterministic detection functions (brownfield check, language/framework detection, config file parsing, directory structure mapping), a new `role-context-generator.md` subagent that uses those functions plus its own code reading to produce context files, and a `/rapid:context` skill that orchestrates the flow. Extend `assembler.cjs` to load context from `.planning/context/` based on role-to-file mappings in `config.json`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Deep analysis scanning everything discoverable: code conventions, architecture, dependencies, test patterns, CI/CD config, linting rules, git hooks
- Produces a structured markdown report (CODEBASE.md) in `.planning/context/`
- Runs automatically, then shows summary for user review/confirmation before finalizing
- Greenfield projects (no source code detected): skip with a message suggesting to run later when code exists
- Lean CLAUDE.md: style rules + 2-3 line project summary and tech stack identification + pointers to detail files
- Keep it as short as possible -- avoid bloating agent context windows
- Separate detail files live in `.planning/context/` (e.g., ARCHITECTURE.md, CONVENTIONS.md, API_PATTERNS.md)
- Agents do NOT read CLAUDE.md to find detail files -- the assembler injects relevant detail files based on agent role
- Single file: `.planning/context/STYLE_GUIDE.md`
- Full enforcement scope: code style, file structure, error handling patterns, testing patterns, commit message format, PR conventions -- everything that should be consistent across worktrees
- Derived from both config files (.eslintrc, .prettierrc, tsconfig, etc.) AND actual code pattern analysis -- configs are ground truth, code analysis fills gaps
- Descriptive tone: documents observed patterns ("This codebase uses camelCase for variables") rather than prescriptive rules ("MUST use camelCase")
- Separate `/rapid:context` command -- not part of `/rapid:init`
- Uses a subagent (via the assembler) for deep codebase analysis -- keeps the skill lightweight and handles large codebases
- On re-run: regenerates from scratch (always reflects current codebase state, no diffing)
- Greenfield handling: if no source code detected, skip with message and suggest running later

### Claude's Discretion
- Exact set of detail files to generate (beyond ARCHITECTURE.md, CONVENTIONS.md, STYLE_GUIDE.md) -- based on what brownfield analysis discovers
- Internal structure/sections within each detail file
- How to handle ambiguous or conflicting patterns found during analysis
- Agent-to-detail-file mapping in the assembler (which roles get which files)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INIT-02 | Init detects existing codebase and offers brownfield mapping before planning | `context.cjs` `detectCodebase()` function performs deterministic checks (source file presence, manifest files, directory structure); subagent performs deep analysis; `/rapid:context` skill orchestrates the flow with user confirmation |
| INIT-03 | Init auto-generates CLAUDE.md with full project context | Lean CLAUDE.md generated from subagent output; kept under 80 lines with style rules + project summary + tech stack + pointers; assembler extended to inject `.planning/context/` files by role |
| INIT-04 | Init auto-generates style guide for cross-worktree consistency | Single STYLE_GUIDE.md in `.planning/context/`; derived from config files (ground truth) merged with code pattern analysis (gap fill); descriptive tone documenting observed patterns |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs` | Built-in (18+) | File system operations, `readdirSync({recursive: true})`, `readFileSync`, `existsSync` | Zero dependencies; `recursive` option available since Node 18.17; project already uses `fs` throughout |
| Node.js `path` | Built-in | Path manipulation for cross-platform file detection | Already used in all existing `.cjs` files |
| Node.js `child_process` | Built-in | `execSync` for running git log, detecting installed tools | Already used in `prereqs.cjs` for tool version detection |
| Node.js `node:test` | Built-in | Unit testing for `context.cjs` and `context.test.cjs` | Project standard (Decision [01-01]): zero-dependency test infrastructure |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `JSON.parse` | Built-in | Parse package.json, tsconfig.json, .eslintrc.json, config files | When reading JSON config files during brownfield detection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Built-in `fs.readdirSync({recursive})` | `fast-glob` or `globby` | External dependency adds complexity; built-in is sufficient for scanning project structure; project has zero-dependency philosophy (only `proper-lockfile` installed) |
| Manual config parsing | ESLint/Prettier programmatic APIs | Would add large transitive dependency trees; config files are JSON/YAML which we can parse directly; the subagent handles semantic interpretation |
| AST-based code analysis | `acorn`, `typescript`, `@babel/parser` | Heavy dependencies; the subagent (Claude) already understands code semantically via file reading -- no need for programmatic AST parsing |

**Installation:**
```bash
# No new dependencies needed -- all built-in Node.js modules
```

## Architecture Patterns

### Recommended Project Structure
```
rapid/
├── src/
│   ├── lib/
│   │   ├── context.cjs            # Brownfield detection + config parsing library
│   │   └── context.test.cjs       # Unit tests for context.cjs
│   ├── bin/
│   │   └── rapid-tools.cjs        # Extended with `context` subcommands
│   └── modules/
│       └── roles/
│           └── role-context-generator.md  # Subagent for deep codebase analysis
├── skills/
│   └── context/
│       └── SKILL.md               # /rapid:context skill definition
└── config.json                    # Extended with context injection mappings

.planning/
└── context/                       # Generated output directory
    ├── CODEBASE.md                # Brownfield detection report
    ├── ARCHITECTURE.md            # Architecture patterns and structure
    ├── CONVENTIONS.md             # Code conventions and patterns
    ├── STYLE_GUIDE.md             # Style rules for cross-worktree consistency
    └── [others as discovered]     # e.g., API_PATTERNS.md, TEST_PATTERNS.md
```

### Pattern 1: Deterministic Detection + Semantic Analysis Split
**What:** The Node.js library (`context.cjs`) handles all deterministic, fast operations: checking file existence, parsing JSON configs, listing directory structure, detecting language/framework from manifest files. The subagent handles semantic analysis: reading actual code files, inferring patterns, resolving ambiguities, and generating prose descriptions.
**When to use:** Always -- this is the core architectural pattern for this phase.
**Example:**
```javascript
// context.cjs -- deterministic detection
function detectCodebase(cwd) {
  const indicators = {
    hasSourceCode: false,
    languages: [],
    frameworks: [],
    configFiles: [],
    structure: {},
  };

  // Check for language-specific manifest files
  const manifests = [
    { file: 'package.json', language: 'javascript', parse: true },
    { file: 'tsconfig.json', language: 'typescript', parse: true },
    { file: 'go.mod', language: 'go', parse: false },
    { file: 'Cargo.toml', language: 'rust', parse: false },
    { file: 'pyproject.toml', language: 'python', parse: false },
    { file: 'requirements.txt', language: 'python', parse: false },
    { file: 'Gemfile', language: 'ruby', parse: false },
    { file: 'pom.xml', language: 'java', parse: false },
    { file: 'build.gradle', language: 'java', parse: false },
  ];

  for (const m of manifests) {
    const fp = path.join(cwd, m.file);
    if (fs.existsSync(fp)) {
      indicators.hasSourceCode = true;
      indicators.languages.push(m.language);
      indicators.configFiles.push(m.file);
    }
  }

  return indicators;
}
```

### Pattern 2: Config-as-Ground-Truth, Code-as-Gap-Fill
**What:** Style guide derivation starts from deterministic config files (.eslintrc, .prettierrc, tsconfig.json, .editorconfig) as ground truth. The subagent then reads actual code samples to fill gaps where configs are silent (e.g., naming conventions, error handling patterns, commit message format).
**When to use:** When generating STYLE_GUIDE.md -- configs define the baseline, code analysis extends it.
**Example:**
```javascript
// context.cjs -- config file detection and parsing
function detectConfigFiles(cwd) {
  const configs = [];

  const configPatterns = [
    // Linting
    { pattern: '.eslintrc*', category: 'linting' },
    { pattern: 'eslint.config.*', category: 'linting' },
    // Formatting
    { pattern: '.prettierrc*', category: 'formatting' },
    { pattern: 'prettier.config.*', category: 'formatting' },
    // TypeScript
    { pattern: 'tsconfig*.json', category: 'typescript' },
    // Editor
    { pattern: '.editorconfig', category: 'editor' },
    // Testing
    { pattern: 'jest.config.*', category: 'testing' },
    { pattern: 'vitest.config.*', category: 'testing' },
    { pattern: '.mocharc.*', category: 'testing' },
    { pattern: 'pytest.ini', category: 'testing' },
    // CI/CD
    { pattern: '.github/workflows/*.yml', category: 'ci' },
    { pattern: '.gitlab-ci.yml', category: 'ci' },
    { pattern: 'Jenkinsfile', category: 'ci' },
    // Git hooks
    { pattern: '.husky/*', category: 'git-hooks' },
    { pattern: '.pre-commit-config.yaml', category: 'git-hooks' },
  ];

  // Check each pattern and parse JSON configs where applicable
  for (const cp of configPatterns) {
    // Use fs.readdirSync or glob matching to find files
    // Parse JSON/YAML configs to extract actual rules
  }

  return configs;
}
```

### Pattern 3: Lean CLAUDE.md with @import Pointers
**What:** The generated CLAUDE.md stays under 80 lines. It contains: a 2-3 line project summary, tech stack identification, high-level code style rules (indentation, quotes, semicolons), and directives that tell agents where detail files live. However, agents do NOT parse CLAUDE.md for import paths -- the assembler injects relevant detail files based on role mappings.
**When to use:** Always -- this is a locked decision.
**Example:**
```markdown
# ProjectName

A REST API for managing inventory built with Express.js and TypeScript.

**Tech Stack:** Node.js 20, TypeScript 5.3, Express 4.18, PostgreSQL 15, Prisma ORM

## Code Style

- TypeScript strict mode enabled
- 2-space indentation, single quotes, semicolons
- ES module imports (import/export)
- camelCase variables/functions, PascalCase classes/types
- Error handling: custom AppError class with HTTP status codes

## Testing

- Vitest for unit/integration tests
- Run: `npm test` (single file: `npx vitest run path/to/test.ts`)

## Context Files

Detailed context is managed by RAPID in `.planning/context/`:
- Architecture, conventions, and style details are injected into agent prompts automatically
- Do not manually import these files -- the assembler handles injection
```

### Pattern 4: Assembler Extension for Role-Based Context Injection
**What:** Extend `assembler.cjs` to read files from `.planning/context/` and inject them based on role-to-context mappings defined in `config.json`. Each role gets the context files relevant to its job.
**When to use:** When assembling agents after context generation has run.
**Example:**
```javascript
// Extended config.json structure
{
  "agents": {
    "rapid-executor": {
      "role": "executor",
      "core": ["core-identity.md", ...],
      "context": ["project", "style"],
      "context_files": ["STYLE_GUIDE.md", "CONVENTIONS.md"]
    },
    "rapid-reviewer": {
      "role": "reviewer",
      "core": ["core-identity.md", ...],
      "context": ["project", "contracts", "style"],
      "context_files": ["STYLE_GUIDE.md", "CONVENTIONS.md", "ARCHITECTURE.md"]
    }
  }
}

// In assembler.cjs -- load context files from .planning/context/
function loadContextFiles(projectRoot, fileList) {
  const contextDir = path.join(projectRoot, '.planning', 'context');
  const contents = {};
  for (const file of fileList) {
    const fp = path.join(contextDir, file);
    if (fs.existsSync(fp)) {
      contents[file] = fs.readFileSync(fp, 'utf-8');
    }
  }
  return contents;
}
```

### Anti-Patterns to Avoid
- **Monolithic CLAUDE.md:** Do not dump all discovered patterns into a single huge CLAUDE.md. Keep it under 80 lines. Official guidance says target under 200 lines, but the user explicitly wants it "as short as possible." 60-80 lines is the practical target.
- **AST parsing in Node.js:** Do not add `acorn`, `typescript`, or `@babel/parser` as dependencies. The subagent (Claude) reads code files directly and understands patterns semantically. The Node.js library only handles file detection and JSON/YAML config parsing.
- **Prescriptive tone in style guide:** Do not write "MUST use camelCase." Write "This codebase uses camelCase for variables and functions." This is a locked decision.
- **Diffing on re-run:** Do not try to diff previous context files against new ones. On re-run, regenerate from scratch. This is a locked decision.
- **Context files in CLAUDE.md imports:** Agents do NOT read CLAUDE.md to find detail files. The assembler injects them. Do not use @import syntax to pull context files into CLAUDE.md.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Glob pattern matching | Custom recursive file finder with pattern matching | `fs.readdirSync(dir, { recursive: true })` + array filter | Built-in since Node 18.17; project requires Node 18+; no external dependency needed |
| JSON config parsing | Custom JSON parser with comments support | `JSON.parse()` for .json files; read raw for .js/.cjs configs and pass to subagent | JSON.parse handles all standard configs; edge cases (.eslintrc.js) go to the subagent |
| Language/framework detection | Heuristic scoring engine | Simple manifest-file-presence check (`package.json` = JS, `tsconfig.json` = TS, etc.) | Perfect accuracy for detection; no scoring needed -- just check which files exist |
| Code pattern analysis | Regex-based pattern scanner | Subagent (Claude) reads code samples and describes patterns in natural language | Claude understands code semantically; regex is brittle and misses context |
| Directory structure visualization | Tree-building recursive function | `fs.readdirSync(dir, { recursive: true, withFileTypes: true })` + depth filtering | Built-in handles recursion; just filter to desired depth and format as tree |

**Key insight:** The subagent (Claude) IS the analysis engine. The Node.js library's job is data collection (what files exist, what configs say), not interpretation. Interpretation belongs to the subagent that can read code and understand patterns in context.

## Common Pitfalls

### Pitfall 1: Context Window Bloat
**What goes wrong:** Generated CLAUDE.md or context files are too large, consuming tokens that should be used for actual work. The assembler warning at 15KB exists for a reason.
**Why it happens:** Temptation to be exhaustive -- documenting every file, every function, every pattern.
**How to avoid:** CLAUDE.md stays under 80 lines. Each context file should stay under 200 lines. The assembler already warns when agents exceed 15KB. Test assembled agent sizes with context files loaded.
**Warning signs:** Assembled agent size warnings in stderr; agents failing to follow context instructions (indicates overload).

### Pitfall 2: Greenfield False Positives
**What goes wrong:** A project with just a `.planning/` directory and no source code is misidentified as brownfield.
**Why it happens:** Checking for "any files" rather than "source code files."
**How to avoid:** `detectCodebase()` must check for actual source code indicators: language manifest files (package.json, go.mod, etc.), source directories (src/, lib/, app/), or source files (*.js, *.ts, *.py, *.go, etc.). The existence of `.planning/`, `.git/`, or documentation alone does not constitute a brownfield project.
**Warning signs:** Context generation runs on a project that only has planning files; generated context is empty or useless.

### Pitfall 3: Config File Parsing Failures
**What goes wrong:** Crash when parsing non-JSON config files (.eslintrc.yaml, .eslintrc.js, prettier.config.mjs).
**Why it happens:** Using `JSON.parse()` on YAML or JavaScript config files.
**How to avoid:** Only parse files with `.json` extension using `JSON.parse()`. For `.yaml`/`.yml` files, read as raw text and pass to the subagent for interpretation. For `.js`/`.cjs`/`.mjs` files, read as raw text and pass to the subagent. Never `require()` untrusted config files.
**Warning signs:** Unhandled exceptions when running context detection on projects with non-JSON configs.

### Pitfall 4: Subagent Scope Creep
**What goes wrong:** The subagent reads too many files, exhausts its context window, and produces shallow/incomplete analysis.
**Why it happens:** No guidance on how many files to sample or which directories to prioritize.
**How to avoid:** The `context.cjs` library should provide a focused "scan manifest" to the subagent: list of config files found, directory structure (2-3 levels deep), top-level source organization, and a list of representative source files to sample (5-10 per language). The subagent reads the manifest plus the sample files, not the entire codebase.
**Warning signs:** Subagent takes excessively long; analysis is generic rather than project-specific.

### Pitfall 5: Stale Context After Code Changes
**What goes wrong:** Context files describe patterns that no longer exist in the codebase.
**Why it happens:** Context files are generated once and never updated as the codebase evolves.
**How to avoid:** This is addressed by the "regenerate from scratch on re-run" decision. Document in help/guidance that `/rapid:context` should be re-run when significant codebase changes occur. No automated staleness detection is needed for v1.
**Warning signs:** Agent behavior diverges from actual codebase conventions.

### Pitfall 6: Conflicting Pattern Detection
**What goes wrong:** Codebase has mixed conventions (some files use camelCase, others snake_case; some use tabs, others spaces) and the analysis picks one arbitrarily.
**Why it happens:** Real codebases are messy, especially brownfield projects.
**How to avoid:** This is Claude's discretion per CONTEXT.md. The recommended approach: config files are ground truth (if .editorconfig says spaces, report spaces). Where configs are silent, report the dominant pattern with a note about inconsistencies. Example: "This codebase predominantly uses camelCase (observed in 85% of files). Some legacy modules use snake_case."
**Warning signs:** Style guide describes a convention that doesn't match the majority of the code.

## Code Examples

Verified patterns from the existing RAPID codebase:

### CLI Subcommand Pattern (from rapid-tools.cjs)
```javascript
// Source: /home/pog/RAPID/rapid/src/bin/rapid-tools.cjs
// Follow existing pattern: new commands bypass findProjectRoot() if they need
// to run before .planning/ exists, otherwise use it for project root detection.
function handleContext(args) {
  const subcommand = args[0];

  if (!subcommand) {
    error('Usage: rapid-tools context <detect|generate|report> [options]');
    process.exit(1);
  }

  if (subcommand === 'detect') {
    // Can run without .planning/ -- just scans for source code
    const result = detectCodebase(process.cwd());
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }

  // 'generate' and 'report' need project root
  let cwd;
  try {
    cwd = findProjectRoot();
  } catch (err) {
    error(`Cannot find project root: ${err.message}`);
    process.exit(1);
  }

  // ... handle generate/report subcommands
}
```

### Skill File Pattern (from init/SKILL.md)
```markdown
---
description: Analyze codebase and generate project context files
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Glob, Grep, Agent
---

# /rapid:context -- Context Generation

You are the RAPID context generator. Follow these steps IN ORDER.

## Step 1: Brownfield Detection
Run the codebase detector:
\`\`\`bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs context detect
\`\`\`

## Step 2: Greenfield Check
If no source code detected, inform the user and stop.

## Step 3: Deep Analysis via Subagent
Spawn the context-generator subagent...

## Step 4: User Review
Show summary and ask for confirmation...

## Step 5: Write Context Files
Write CLAUDE.md and .planning/context/ files...
```

### Module Test Pattern (from init.test.cjs)
```javascript
// Source: /home/pog/RAPID/rapid/src/lib/init.test.cjs
// Follow existing test pattern: node:test + node:assert/strict + temp directories
'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { detectCodebase, detectConfigFiles, mapDirectoryStructure } = require('./context.cjs');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-context-test-'));
});

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('detectCodebase', () => {
  it('returns hasSourceCode: false for empty directory', () => {
    const result = detectCodebase(tmpDir);
    assert.equal(result.hasSourceCode, false);
  });

  it('detects JavaScript project via package.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name": "test"}');
    const result = detectCodebase(tmpDir);
    assert.equal(result.hasSourceCode, true);
    assert.ok(result.languages.includes('javascript'));
  });
});
```

### Assembler Context Injection Pattern (from assembler.cjs)
```javascript
// Source: /home/pog/RAPID/rapid/src/lib/assembler.cjs
// Existing pattern: context is injected via named properties
// Extension: add context_files injection alongside existing context.project/contracts/style

// 4. Context sections (optional)
if (context.project) {
  sections.push(`<project_context>\n${context.project}\n</project_context>`);
}
// ... existing patterns ...

// NEW: Role-specific context files from .planning/context/
if (context.contextFiles && typeof context.contextFiles === 'object') {
  for (const [filename, content] of Object.entries(context.contextFiles)) {
    const tag = filename.replace('.md', '').toLowerCase().replace(/_/g, '-');
    sections.push(`<context_${tag}>\n${content}\n</context_${tag}>`);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic CLAUDE.md (everything in one file) | Lean CLAUDE.md + `.claude/rules/` + separate context files | Claude Code 2025 updates | CLAUDE.md under 200 lines recommended; rules for path-scoped instructions |
| `@import` in CLAUDE.md pulls all detail files | Assembler-based injection by role | RAPID design decision | Agents get only what they need; no context bloat |
| Manual codebase documentation | Automated `/init` generates CLAUDE.md | Claude Code `/init` command (2025) | Baseline pattern RAPID extends with deeper, structured analysis |
| `fs.readdirSync` without recursive | `fs.readdirSync(dir, { recursive: true })` | Node.js 18.17 / 20.1 (2023) | No external glob library needed for recursive directory listing |

**Deprecated/outdated:**
- `.eslintrc` (JSON format): ESLint 9+ uses flat config (`eslint.config.js`). Both formats must be detected since brownfield projects may use either. [Confidence: HIGH -- ESLint official docs]
- `fs.readdir` callback-style: Use `fs.readdirSync` for the synchronous detection flow. The project uses synchronous I/O consistently per existing patterns. [Confidence: HIGH -- codebase pattern]

## Open Questions

1. **Agent tool availability for spawning subagents**
   - What we know: The context skill needs `Agent` tool to spawn the context-generator subagent. The orchestrator role already has `Agent` in its tool list. There is a known bug (#23506) about custom agents not being able to spawn subagents.
   - What's unclear: Whether the `/rapid:context` skill (which is a skill, not an assembled agent) can successfully spawn a subagent via the `Agent` tool.
   - Recommendation: Test subagent spawning from a skill early (Wave 0). If blocked, fall back to the skill itself performing the analysis (heavier skill, but functional). The skill already lists `Agent` in its allowed-tools, matching the orchestrator pattern.

2. **Optimal sampling strategy for large codebases**
   - What we know: The subagent cannot read an entire large codebase. It needs a representative sample.
   - What's unclear: Exactly how many files to sample, how to select representative files, and whether the sampling should be configurable.
   - Recommendation: Start with a fixed strategy -- sample up to 10 source files per detected language, prioritizing: entry points (index.*, main.*, app.*), config files, test files (for test patterns), and files from each top-level source directory. Make the sample count configurable in config.json for future tuning.

3. **Context file size budgeting**
   - What we know: The assembler warns at 15KB per assembled agent. Context files are injected into agents alongside core modules and role modules.
   - What's unclear: Exact token budget per context file to stay under the 15KB agent limit.
   - Recommendation: Target 100-150 lines per context file (approximately 3-5KB each). With 2-3 context files per role, this keeps the total context injection under 10-15KB, leaving room for core modules + role module. Test with actual assembled agents during implementation.

## Sources

### Primary (HIGH confidence)
- Node.js official docs (`/nodejs/node` via Context7) -- `fs.readdirSync` with `recursive` option, `child_process.execSync`
- Claude Code official docs (https://code.claude.com/docs/en/memory) -- CLAUDE.md hierarchy, @import syntax, `/init` behavior, size recommendations, `.claude/rules/` pattern
- RAPID codebase (direct file reads) -- all existing patterns, assembler architecture, init patterns, test patterns, config.json structure

### Secondary (MEDIUM confidence)
- Anthropic blog (https://claude.com/blog/using-claude-md-files) -- CLAUDE.md best practices, verified against official docs
- Builder.io guide (https://www.builder.io/blog/claude-md-guide) -- CLAUDE.md structure recommendations, verified against official docs
- Kaushik Gopal blog (https://kau.sh/blog/build-ai-init-command/) -- Custom /init command pattern, verified against Claude Code behavior

### Tertiary (LOW confidence)
- WebSearch results on static analysis tools -- general landscape context; not used for specific recommendations since the subagent-based approach avoids traditional static analysis tooling

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All built-in Node.js modules; zero new dependencies; follows existing codebase patterns
- Architecture: HIGH - Extends established assembler/skill/CLI patterns with well-defined extension points identified in CONTEXT.md code_context section
- Pitfalls: HIGH - Derived from established CLAUDE.md best practices (official docs) and direct codebase analysis
- Open questions: MEDIUM - Subagent spawning from skills needs validation; sampling strategy needs tuning during implementation

**Research date:** 2026-03-04
**Valid until:** 2026-04-03 (30 days -- stable domain, established patterns)
