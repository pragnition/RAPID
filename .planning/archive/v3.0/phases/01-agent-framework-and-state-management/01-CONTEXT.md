# Phase 1: Agent Framework and State Management - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Composable agent architecture with structured returns, filesystem-based verification, and concurrent-safe state storage in `.planning/`. Agents are built from modules, return machine-parseable results, and have their completions independently verified. All project state persists in `.planning/` with atomic locking for concurrent access.

Requirements: AGNT-01, AGNT-02, AGNT-03, STAT-01, STAT-02, STAT-03

</domain>

<decisions>
## Implementation Decisions

### Agent Module System
- Build-time generation: modules are source files, a build step assembles them into complete agent `.md` files
- No runtime indirection — agents are always self-contained after generation
- Regenerated automatically on every `/rapid:` command invocation (always fresh)
- Configurable per-project via `config.json` (projects can override which modules each agent includes)
- Three-layer module granularity:
  - **Core** — shared behavior all agents receive
  - **Role** — agent-type-specific (planner, executor, reviewer, verifier)
  - **Context** — project state, contracts, style guide (injected at build time)

### Structured Return Protocol
- Hybrid format: Markdown table for human display + hidden JSON in HTML comment for machine parsing
- Comment marker: `<!-- RAPID:RETURN { ... } -->`
- Standard fields on every return (COMPLETE, CHECKPOINT, or BLOCKED):
  - Status, artifacts created/modified, commits, tasks completed (X/Y), duration, next recommended action, warnings/notes
- **CHECKPOINT** includes full handoff: what was done, what remains, decisions made, blockers encountered, and explicit resume instructions (another agent or new session can continue cold)
- **BLOCKED** uses structured blocker categories: DEPENDENCY, PERMISSION, CLARIFICATION, ERROR — with specific resolution instructions per category (enables automated recovery routing)

### Verification Approach
- Tiered verification by context:
  - **During execution:** lighter checks (file existence + git commit verification)
  - **At merge time:** heavier checks (tests + contract validation + review)
- Separate `rapid-verifier` agent performs verification — no self-grading
- On verification failure: auto-retry once (give the working agent one chance to fix), then report BLOCKED if second attempt fails
- Verification results persisted to `.planning/` as VERIFICATION.md artifacts (full audit trail)

### State File Design
- Markdown primary source of truth for most state (STATUS.md, DEFINITION.md, CONTRACT.md, etc.)
- JSON only for machine-only data: `config.json`, lock files
- Every state change committed to git individually (full audit trail, easy bisect)
- Lock system: `mkdir`-based atomic locks in `.planning/.locks/` (gitignored)
- Stale lock detection: lock files contain PID + timestamp; stale if PID is dead OR lock exceeds timeout threshold (e.g., 5 minutes)
- Implementation language: Node.js/TypeScript for state management utilities (lock manager, state reader/writer)

### Claude's Discretion
- Exact module file naming conventions and directory structure
- Lock timeout threshold value
- Specific Markdown parsing approach for state files
- VERIFICATION.md format and level of detail
- Build script implementation (how module assembly works internally)

</decisions>

<specifics>
## Specific Ideas

- Agent indirection is undesirable — agents should never have to "discover" their own context at runtime. Build-time generation eliminates this.
- The hybrid return format (Markdown table + JSON comment) keeps files human-readable while enabling programmatic parsing — similar to how HTML comments can carry metadata.
- Full handoff in CHECKPOINT returns means any agent can resume cold from a checkpoint without re-reading the full project state.
- Structured blocker categories (DEPENDENCY, PERMISSION, CLARIFICATION, ERROR) enable the orchestrator to route blockers automatically rather than requiring human triage every time.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `paul/bin/install.js`: Reference installer that copies files with path replacement — pattern for RAPID's own installer in Phase 2
- `paul/package.json`: Reference plugin structure (commands, templates, workflows, references, rules)

### Established Patterns
- No existing RAPID code — greenfield implementation
- PAUL framework provides prior art for Claude Code plugin structure (commands/, agents/, skills/, hooks/)
- Architecture research (`.planning/research/ARCHITECTURE.md`) provides detailed target architecture with component boundaries

### Integration Points
- Plugin manifest: `.claude-plugin/plugin.json` (to be created)
- State directory: `.planning/` (already exists from GSD project setup, will be extended)
- Agent files: `agents/*.md` (generated from modules at build time)
- State utilities: Node.js scripts accessible from agent prompts and commands

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-agent-framework-and-state-management*
*Context gathered: 2026-03-03*
