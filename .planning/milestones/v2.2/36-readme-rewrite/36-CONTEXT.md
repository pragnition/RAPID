# Phase 36: README Rewrite - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewrite README.md from scratch to accurately describe RAPID's current capabilities through v2.2 including subagent merge delegation. Includes a full lifecycle quick start walkthrough, ASCII architecture diagram, and accurate command reference. Does NOT include technical_documentation.md (Phase 37).

</domain>

<decisions>
## Implementation Decisions

### Structure and Scope
- Concept-explanation-first layout (not action-first): open with what RAPID is and why, then how, then quick start and commands
- Command reference table shows name + argument syntax + short description (e.g., `/rapid:set-init <set-id>`)
- Describe current state only — no version callouts, changelogs, or "What's New" sections
- Reference technical_documentation.md as the canonical power-user doc — drop DOCS.md references (it's outdated at v2.0)
- 18 skills exist: assumptions, cleanup, context, discuss, execute, help, init, install, merge, new-milestone, pause, plan, plan-set, resume, review, set-init, status, wave-plan

### Quick Start Walkthrough
- Cover both greenfield (new project) and brownfield (existing codebase) paths with clear tabbed/labeled separation
- Each step shows command + what happens (what it does, what to expect, not just a one-liner)
- Steps grouped by phase: "Project Setup", "Per-Set Development", "Finalization"
- Show the team angle: illustrate that sets run in parallel across developers (e.g., "Developer A works on Set 1 while Developer B works on Set 2")

### Architecture Diagram
- One combined diagram showing both the Sets/Waves/Jobs hierarchy AND the agent dispatch pattern
- Key agents only (~5-7): orchestrator, executor, reviewer, merger, plus a few notable ones — not all 31
- Include merge pipeline's subagent delegation: orchestrator → set-merger → conflict-resolver nesting
- Use Unicode box-drawing characters (┌─┐│└┘) for clean lines — primary viewing context is GitHub

### Tone and Positioning
- Primary audience: both newcomers discovering RAPID AND Claude Code power users — layered (context for newcomers, skip-to-action for power users)
- Conversational-technical tone — friendly but precise, like Vercel's or Astro's docs
- Problem-first opening: start with the pain of multiple Claude Code users stepping on each other, then introduce RAPID as the solution
- Brief conceptual "How It Works" section (2-3 paragraphs) explaining Sets/Waves/Jobs model in prose, separate from the diagram

### Claude's Discretion
- Exact section ordering beyond the top-level structure
- How to implement the greenfield/brownfield tab separation in Markdown (HTML details tags, headers, etc.)
- Specific wording of the problem-first opening
- Which ~5-7 agents to highlight in the diagram
- Whether to include a Features section or let the conceptual section + diagram cover it

</decisions>

<specifics>
## Specific Ideas

- Tone reference: Astro/Vercel docs — approachable without being fluffy
- The team angle in quick start should feel natural, not forced — show parallel work as the default, not a special mode
- Architecture diagram should convey that RAPID is an agent orchestration system, not just a task runner

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Current README.md (78 lines): Has reasonable section list but needs full rewrite per success criteria
- DOCS.md (979 lines, v2.0): Contains detailed command reference and workflow — source of truth for command args and descriptions, but outdated
- skills/ directory: 18 skill directories — canonical list of commands to document
- agents/ directory: 31 agent files — canonical list for diagram agent selection

### Established Patterns
- All skills use `/rapid:<name>` naming convention
- Skills accept set-id by numeric index or full string ID
- Waves referenced by dot notation (e.g., `1.1` = set 1, wave 1)

### Integration Points
- README.md is the repo root landing page — GitHub renders it automatically
- References to technical_documentation.md (Phase 37) — file won't exist yet at time of this phase
- LICENSE file exists and should be referenced

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 36-readme-rewrite*
*Context gathered: 2026-03-11*
