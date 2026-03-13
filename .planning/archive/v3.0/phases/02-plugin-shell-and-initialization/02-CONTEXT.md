# Phase 2: Plugin Shell and Initialization - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Developers can install RAPID as a standard Claude Code plugin and scaffold a new project with validated prerequisites. Delivers `/rapid:init` (project scaffolding with prerequisite validation) and `/rapid:help` (command reference). Also restructures the existing `rapid/` directory to match the standard plugin layout expected by the pragnition plugin marketplace.

</domain>

<decisions>
## Implementation Decisions

### Init interaction model
- Conversational setup — asks project name, description, and team size (how many developers will work in parallel)
- Populates PROJECT.md from conversation answers (developer doesn't edit templates directly)
- If `.planning/` already exists: detect and offer options (reinitialize, upgrade/add missing files, or cancel) — no silent destructive behavior
- Phase directories (`.planning/phases/`) created on-demand when planning begins, not during init

### Prerequisite validation
- Block on hard requirements: git 2.30+ (needed for worktrees), Node.js 18+
- Warn-only for nice-to-haves: jq 1.6+
- Check all prerequisites and report all results at once (summary table of pass/fail/warn) — don't stop at first failure
- Verify current directory is a git repository; if not, offer to run `git init`. Don't check clean/dirty state
- Standalone reusable `validatePrereqs()` function in lib/ — other commands (like /rapid:status in Phase 7) can call it later

### Help command design
- Full roadmap view: show all planned commands with "available" vs "coming soon" markers
- Commands grouped by workflow stage (Setup, Planning, Execution, Review) — not alphabetical or by phase
- Include ASCII workflow diagram showing the RAPID flow (init -> plan -> execute -> merge)
- Static reference only — no context-aware routing (that belongs in /rapid:status, Phase 7)

### Plugin structure
- Restructure from current `rapid/` layout to standard Claude Code plugin layout
- Plugin root gets `.claude-plugin/plugin.json` manifest and `commands/` directory
- Keep `src/lib/` for runtime Node.js code (core, state, lock, assembler, returns, verify)
- Plugin name: "rapid" — commands namespace as `/rapid:init`, `/rapid:help`, etc.
- Create DOCS.md documenting Phase 2 commands — marketplace-ready from day one
- Must conform to pragnition/claude-plugins marketplace spec (see reference below)

### Claude's Discretion
- Exact directory restructuring approach (move vs copy, what goes where)
- Command .md file structure and frontmatter details
- plugin.json metadata (keywords, description wording)
- ASCII diagram design for help command
- How to phrase conversational init questions

</decisions>

<specifics>
## Specific Ideas

- Plugin must conform to pragnition/claude-plugins marketplace spec: `.claude-plugin/plugin.json` manifest, `commands/` directory, `DOCS.md` at root
- Reference implementation: pragnition/claude-research — follow same plugin layout pattern (plugin.json with name/version/description/author/homepage/repository/license/keywords, commands as .md files with YAML frontmatter)
- Command .md files use YAML frontmatter with `description` and `allowed-tools` fields
- The `paul/` directory contains a competitor reference implementation with similar init and help commands — can reference for UX patterns but RAPID is its own thing

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `rapid/src/lib/core.cjs`: `findProjectRoot()`, `output()`, `error()`, `loadConfig()`, `resolveRapidDir()` — all reusable in init command
- `rapid/src/lib/state.cjs`: `stateGet()`, `stateUpdate()` — lock-based state access for STATE.md
- `rapid/src/lib/lock.cjs`: `acquireLock()`, `isLocked()` — mkdir-based atomic locking
- `rapid/src/lib/assembler.cjs`: Agent module assembler — not needed for Phase 2 but must survive restructuring
- `rapid/src/lib/returns.cjs`: Structured return parser/validator — same
- `rapid/src/lib/verify.cjs`: Filesystem verification — same
- `rapid/src/bin/rapid-tools.cjs`: CLI entry point with switch/case command routing — needs `init` subcommand added
- `rapid/config.json`: Agent configuration — must be preserved in new structure
- `rapid/agents/`: Assembled agent markdown files — must be preserved
- `rapid/src/modules/`: Core + role prompt modules — must be preserved

### Established Patterns
- CommonJS modules (.cjs extension) throughout
- Co-located unit tests as `.test.cjs` files
- JSON for machine state, Markdown for human-readable state
- `.planning/` as project state directory
- `rapid-tools.cjs` as CLI command router (switch/case pattern)

### Integration Points
- `rapid-tools.cjs` needs `init` and potentially `prereqs` subcommands added
- `.claude-plugin/plugin.json` is the new entry point for plugin discovery
- `commands/` directory with `.md` files registers slash commands
- All existing `src/lib/*.cjs` and `src/modules/` must be accessible from new structure

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-plugin-shell-and-initialization*
*Context gathered: 2026-03-03*
