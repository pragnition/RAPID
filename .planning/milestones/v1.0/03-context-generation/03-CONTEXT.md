# Phase 3: Context Generation - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Auto-detect codebase patterns and generate project context files (CLAUDE.md, style guide, codebase report) so every developer and worktree agent has consistent, comprehensive understanding of code style, architecture, and conventions. This phase delivers brownfield detection (INIT-02), CLAUDE.md generation (INIT-03), and style guide creation (INIT-04).

</domain>

<decisions>
## Implementation Decisions

### Brownfield Detection
- Deep analysis scanning everything discoverable: code conventions, architecture, dependencies, test patterns, CI/CD config, linting rules, git hooks
- Produces a structured markdown report (CODEBASE.md) in `.planning/context/`
- Runs automatically, then shows summary for user review/confirmation before finalizing
- Greenfield projects (no source code detected): skip with a message suggesting to run later when code exists

### CLAUDE.md Structure
- Lean CLAUDE.md: style rules + 2-3 line project summary and tech stack identification + pointers to detail files
- Keep it as short as possible — avoid bloating agent context windows
- Separate detail files live in `.planning/context/` (e.g., ARCHITECTURE.md, CONVENTIONS.md, API_PATTERNS.md)
- Agents do NOT read CLAUDE.md to find detail files — the assembler injects relevant detail files based on agent role

### Style Guide
- Single file: `.planning/context/STYLE_GUIDE.md`
- Full enforcement scope: code style, file structure, error handling patterns, testing patterns, commit message format, PR conventions — everything that should be consistent across worktrees
- Derived from both config files (.eslintrc, .prettierrc, tsconfig, etc.) AND actual code pattern analysis — configs are ground truth, code analysis fills gaps
- Descriptive tone: documents observed patterns ("This codebase uses camelCase for variables") rather than prescriptive rules ("MUST use camelCase")

### Generation Flow
- Separate `/rapid:context` command — not part of `/rapid:init`
- Uses a subagent (via the assembler) for deep codebase analysis — keeps the skill lightweight and handles large codebases
- On re-run: regenerates from scratch (always reflects current codebase state, no diffing)
- Greenfield handling: if no source code detected, skip with message and suggest running later

### Claude's Discretion
- Exact set of detail files to generate (beyond ARCHITECTURE.md, CONVENTIONS.md, STYLE_GUIDE.md) — based on what brownfield analysis discovers
- Internal structure/sections within each detail file
- How to handle ambiguous or conflicting patterns found during analysis
- Agent-to-detail-file mapping in the assembler (which roles get which files)

</decisions>

<specifics>
## Specific Ideas

- CLAUDE.md should be as short as possible — basic high-level things like code styling only
- Separate files (ARCHITECTURE.md, etc.) for deeper details — subagents should be informed to check these files when they need them
- The assembler already has `context.project`, `context.contracts`, and `context.style` injection slots — extend this for the new detail files

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `init.cjs`: Has `detectExisting()` which checks for `.planning/` — extend for brownfield codebase detection
- `assembler.cjs`: Already injects `context.project`, `context.contracts`, `context.style` into agent prompts — extend to inject role-specific detail files from `.planning/context/`
- `core.cjs`: `findProjectRoot()`, `loadConfig()`, `resolveRapidDir()` — reusable for context generation commands
- `rapid-tools.cjs`: CLI entry point for adding new subcommands (e.g., `context detect`, `context generate`)

### Established Patterns
- CommonJS modules (.cjs) with paired .test.cjs files
- CLI subcommands via `rapid-tools.cjs` (e.g., `init detect`, `init scaffold`)
- YAML frontmatter on skills/agents for tool access and description
- Skills call `rapid-tools.cjs` subcommands — context skill would follow this pattern
- Agent modules in `src/modules/core/` and `src/modules/roles/`

### Integration Points
- New `/rapid:context` skill in `rapid/skills/context/SKILL.md`
- New context-generation agent module in `rapid/src/modules/roles/role-context-generator.md`
- New subcommands in `rapid-tools.cjs`: `context detect`, `context generate`
- New library file: `rapid/src/lib/context.cjs` (+ `context.test.cjs`)
- Extend `assembler.cjs` to support loading from `.planning/context/` directory
- `.planning/context/` directory created by context generation (not by init)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-context-generation*
*Context gathered: 2026-03-04*
