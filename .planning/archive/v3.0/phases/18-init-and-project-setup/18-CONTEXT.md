# Phase 18: Init and Project Setup - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Overhauled /init with greenfield/brownfield detection, parallel research agents, synthesizer, roadmapper agent (producing sets/waves/jobs with full contracts), model selection, and /new-milestone command. /help rewritten for Mark II command hierarchy. /install preserved as-is. Detailed per-wave discuss/plan deferred to Phase 20.

</domain>

<decisions>
## Implementation Decisions

### Init flow (end-to-end)
- Single /init command with branching for greenfield vs brownfield (same flow, not distinct paths)
- Full extended flow: Prereqs > git check > existing detection > setup questions (name, desc, team size, model) > scaffold > brownfield detection > [brownfield: synthesizer agent] > 5 parallel research agents > synthesizer agent > roadmapper agent > user approves roadmap > done
- Greenfield skips the codebase synthesizer, runs research with less context
- Brownfield triggers dedicated codebase synthesizer agent before research

### Model selection
- Opus/Sonnet binary choice during init via AskUserQuestion
- Stored in config.json, used by all downstream agents (research, planning, execution)

### Research agent pipeline
- 5 parallel research agents: Stack, Features, Architecture, Pitfalls, Oversights
- Oversights agent captures cross-cutting concerns and important notes for the entire process
- All agents use Context7 MCP for documentation lookups when available
- Research outputs live in .planning/research/ (STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, OVERSIGHTS.md)
- A separate synthesizer agent reads all 5 outputs and produces unified SUMMARY.md with deduplicated insights, cross-references, and priority rankings

### Codebase synthesizer agent
- Dedicated new agent (role-codebase-synthesizer.md), not reuse of existing context subagent
- Focused on deep analysis: files, functions, API endpoints, code style, tech stack
- Only runs for brownfield projects
- Output feeds into research agents as additional context

### Roadmapper agent
- Propose-then-approve interaction: drafts full roadmap from SUMMARY.md + user description, presents for review, user can accept/request changes/iterate
- Outputs both ROADMAP.md (human-readable) and populates STATE.json (machine-readable) -- dual format
- Writes full interface contracts (CONTRACT.json) per set during roadmap creation -- contracts are foundational for parallelization and must be unified between sets
- Depth: sets with full contracts + wave stubs (ordering and job titles per wave). Detailed job plans deferred to /discuss and /plan per wave (Phase 20)
- Set boundary principle: minimize cross-set dependencies, consider number of developers, and optimize for ease of merge later

### /new-milestone command
- Separate skill (skills/new-milestone/SKILL.md), not a subcommand of /init
- Archives current milestone's completed sets in STATE.json, bumps version
- Runs research > roadmapper pipeline again for new milestone scope
- User describes new milestone goals
- Offers choice for unfinished sets: carry all forward, select which to carry, or start fresh (via AskUserQuestion)

### /help rewrite
- Full command table rewrite for Mark II
- Commands grouped by lifecycle stage: Setup (/init, /install, /context), Planning (/plan, /discuss, /assumptions), Execution (/execute, /status, /pause), Review (/review), Merge (/merge, /cleanup), Meta (/new-milestone, /help)

### Claude's Discretion
- Internal agent prompt design for research agents, synthesizer, and roadmapper
- How brownfield synthesizer output is structured and passed to research agents
- Exact ROADMAP.md template format for sets/waves/jobs hierarchy
- Error handling and recovery flows during the multi-agent pipeline
- How research agents divide responsibility for Oversights vs Pitfalls (related but distinct)

</decisions>

<specifics>
## Specific Ideas

- "Contracts are a foundational layer that allows for parallelization. Therefore, contracts should be unified between sets. They should be written during roadmap." -- contracts must exist before any set starts executing
- "Minimize cross-set dependencies. Also take into consideration the number of developers and the ease of merge later" -- set boundary design principles
- The roadmapper plans sets, but /discuss and /plan per set/wave handle detailed implementation planning (Phase 20)
- Oversights agent is distinct from Pitfalls: Pitfalls = known failure modes, Oversights = things easy to miss or forget

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `init.cjs`: Current scaffold logic (generateProjectMd, generateStateMd, generateRoadmapMd, generateRequirementsMd, scaffoldProject, detectExisting) -- needs overhaul but structure is sound
- `context.cjs`: Brownfield detection (detectCodebase, detectConfigFiles, buildScanManifest) -- reusable for codebase synthesizer input
- `state-machine.cjs`: createInitialState for STATE.json generation, readState/writeState for state manipulation
- `state-schemas.cjs`: Zod schemas for validating STATE.json entries
- `prereqs.cjs`: Prerequisite validation -- reuse as-is
- `assembler.cjs`: Agent prompt assembly from modules -- extend for new agent roles
- `rapid-tools.cjs`: CLI entry point, handleInit/handleContext -- needs new subcommands for research, roadmap

### Established Patterns
- AskUserQuestion at every decision gate (v1.1 pattern)
- .env fallback loading in all skills (Quick Task 7 pattern)
- Agent tool for subagent spawning with role instructions (context skill pattern)
- Lock-protected atomic writes for STATE.json (Phase 16 pattern)
- Structured JSON CLI output parsed by skills (all skills follow this)

### Integration Points
- `skills/init/SKILL.md`: Complete rewrite needed for extended flow
- `skills/help/SKILL.md`: Complete rewrite for Mark II command table
- `skills/new-milestone/SKILL.md`: New skill file
- `agents/`: New agent role files (role-codebase-synthesizer.md, role-research-*.md, role-synthesizer.md, role-roadmapper.md)
- `init.cjs`: Extend with research orchestration, roadmap generation CLI subcommands
- `config.json`: Add model selection field
- `.planning/research/`: New directory for research outputs

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 18-init-and-project-setup*
*Context gathered: 2026-03-06*
