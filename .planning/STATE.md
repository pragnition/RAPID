---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Improvements & Fixes
status: completed
stopped_at: Completed 31-01-PLAN.md
last_updated: "2026-03-10T05:54:22.671Z"
last_activity: 2026-03-10 -- Phase 31 plan 03 (execute auto-advance)
progress:
  total_phases: 10
  completed_phases: 8
  total_plans: 20
  completed_plans: 19
  percent: 99
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** Multiple developers using Claude Code can work on the same project simultaneously without blocking each other, with confidence their independent work will merge cleanly.
**Current focus:** Phase 31 - Wave Orchestration

## Current Position

Phase: 31 (ninth of 10 in v2.1: Phases 25-32 + 27.1 + 29.1)
Plan: 3 of 3 in Phase 31 (plan 03 complete)
Status: Phase 31 plan 03 complete -- execute skill auto-advance and --retry-wave flag
Last activity: 2026-03-10 -- Phase 31 plan 03 (execute auto-advance)

Progress: [██████████] 99%

## Performance Metrics

**Velocity:**
- Total plans completed: 20
- Average duration: 3.8min
- Total execution time: 1.25 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 25 | 1 | 3min | 3min |
| 26 | 2 | 8min | 4min |
| 27 | 2 | 6min | 3min |
| 27.1 | 3 | 28min | 9.3min |
| 28 | 2 | 6min | 3min |
| 29 | 1 | 2min | 2min |
| 29.1 | 4 | 17min | 4.3min |
| 30 | 2 | 4min | 2min |
| 31 | 2 | 5min | 2.5min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.

Recent:
- v2.1 roadmap: 8 phases derived from 25 requirements at fine granularity
- Phase 27 (branding) and Phase 32 (review) can run as independent tracks
- Phase 25: Used require.main guard pattern to export CLI functions for testing
- Phase 25: Migration-on-boot pattern for silent state version upgrades
- Phase 26: resolveWave accepts pre-read state parameter (sync, testable) rather than reading STATE.json internally
- Phase 26: Requires hoisted to module level in resolve.cjs -- no circular dependency risk
- Phase 26: String wave IDs delegate to existing wave-planning.resolveWave for lookup, then enrich with indices
- Phase 26: Resolver called ONCE at skill argument boundary -- all downstream operations use resolved string IDs
- Phase 26: discuss/wave-plan replaced old wave-plan resolve-wave with resolve wave + state get --all
- Phase 27: Used bright ANSI background variants (10Xm) for better readability with white text
- Phase 27: ROLE_COLORS parallel map pattern, consistent with ROLE_TOOLS/ROLE_DESCRIPTIONS
- Phase 27: Fixed 50-char padded banner width for visual consistency
- Phase 27: Display command uses early return (no project root needed), only CLI command outputting raw ANSI text
- Phase 27: Banner calls placed after env setup, before first functional step in each skill
- Phase 27.1: Planner agent exceeds 15KB (21KB) -- accepted as known exception since role module alone is 11KB
- Phase 27.1: Removed agents/ from .gitignore so generated agents are committed for clone-and-use workflow
- Phase 27.1: buildAllAgents() in assembler.cjs (not rapid-tools.cjs) for direct unit testability
- Phase 27.1: Exported ROLE_TOOLS, ROLE_COLORS, ROLE_DESCRIPTIONS, ROLE_CORE_MAP from assembler for test verification
- Phase 27.1: Skills pass file paths (not inline content) for agents to read -- keeps spawn prompts lean
- Phase 27.1: Context generator agent spawned twice (analysis-only + write mode) using same rapid-context-generator name
- Phase 27.1: Agent name reference pattern: "Spawn the **rapid-{role}** agent with this task:" followed by task-specific context block
- Phase 27.1: build-agents is self-contained in rapid-tools.cjs -- all role maps and assembly logic inline, no assembler module dependency
- Phase 27.1: config.json agents section removed -- agent metadata lives solely in agent .md frontmatter
- Phase 28: resolveWave setId path uses resolveSet internally for consistent numeric/string resolution
- Phase 28: Error messages include set name and available waves for discoverability
- Phase 28: Workflow order section placed between Working Directory and structured return sections in core-identity
- Phase 28: Mid-flow AskUserQuestion preserved; only end-of-skill routing removed
- Phase 28: Linear skills show one next command; branching skills (review, merge) show 2-3 alternatives
- Phase 28: AskUserQuestion kept in allowed-tools for all skills retaining mid-flow decision points
- Phase 29: 2-round structure halves interactions from 16 to 8 for 4 gray areas
- Phase 29: "Let Claude decide all" takes precedence over any other multiSelect selections
- Phase 29: Round 2 always runs even when areas are delegated in Round 1
- Phase 29: "Revise" in Round 2 re-presents only that single area's Interaction 1 then Interaction 2
- Phase 29.1: CHUNK_THRESHOLD=15 files for directory-based chunking (below=single pass, above=per-directory chunks)
- Phase 29.1: Small directory groups (<3 files) merge into last large chunk to avoid over-fragmentation
- Phase 29.1: Last wave wins for file attribution when file appears in multiple waves' JOB-PLAN.md
- Phase 29.1: loadSetIssues dual-read pattern: set-level first, then legacy wave subdirectories for backward compatibility
- Phase 29.1: ReviewIssues container drops waveId; wave identity tracked per-issue via originatingWave field
- Phase 29.1: Dual-mode CLI by arg count (no new subcommands) preserves interface stability and backward compat
- Phase 29.1: 4-arg update-issue accepts wave-id positionally but ignores it for file lookup (set-level path)
- Phase 29.1: scope 1-arg enriches response with chunks + waveAttribution; 2-arg keeps lean response
- Phase 29.1: Per-wave loop (Step 3) replaced with single set-level pass (Step 4) in review SKILL.md
- Phase 29.1: Acceptance criteria aggregated from ALL waves before stage execution (dedicated Step 3)
- Phase 29.1: Chunked unit test plan presented as single combined approval (not per-chunk)
- Phase 29.1: UAT always runs on full set scope (never chunked) per locked user decision
- Phase 29.1: Lean wave-level review documented as explicitly unaffected in Important Notes
- Phase 30: Plan verifier uses Read/Write/Grep/Glob tools (no Bash or Edit) -- file checks via Glob, auto-fixes via Write
- Phase 30: Core modules: identity + returns + context-loading (no state-access or git -- verifier reads plans, does not modify state)
- Phase 30: Agent size 15.2KB slightly over 15KB warning -- accepted as planning-family agents are content-heavy
- Phase 30: Step 5.5/6.5 numbering preserves backward compatibility -- no renumbering of existing steps
- Phase 30: Maximum 1 re-plan attempt on FAIL -- second FAIL shows only override/cancel to prevent infinite loops
- Phase 30: State transition deferred from Step 2 to Step 6.5 -- FAIL verdict blocks wave from entering planning state
- Phase 31: Wave analyzer uses Read/Grep/Glob tools only (read-only analysis, no state or git access)
- Phase 31: Conservative dependency classification -- uncertain signals default to dependent to prevent merge conflicts
- Phase 31: Plan-set stage uses bright blue background (planning group) matching wave-plan and other planning stages
- Phase 31: plan-verifier.md added to KNOWN_OVERSIZED in build-agents tests (15.3KB, planning-family exception)
- Phase 31: PASS and PASS_WITH_WARNINGS auto-advance without AskUserQuestion -- only FAIL retains user gate
- Phase 31: --retry-wave validates all predecessor waves are complete before allowing targeted retry

### Pending Todos

None.

### Roadmap Evolution

- v1.0 Core: Phases 1-9.2 (shipped)
- v1.1 UI UX Improvements: Phases 10-15 (shipped)
- v2.0 Mark II: Phases 16-24 (shipped 2026-03-09)
- v2.1 Improvements & Fixes: Phases 25-32 (in progress)
- Phase 27.1 inserted after Phase 27: Skill to agent overhaul (URGENT)
- Phase 29.1 inserted after Phase 29: Make the reviewing set based instead of wave based (URGENT)

### Blockers/Concerns

- Token cost for 3-agent adversarial review needs monitoring in production use
- Claude Code 5-subagent parallelism ceiling (Phase 31) needs testing with 2 waves first

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | commit and push this to fishjojo1/RAPID | 2026-03-03 | 68dc648 | [1-commit-and-push-this-to-fishjojo1-rapid](./quick/1-commit-and-push-this-to-fishjojo1-rapid/) |
| 2 | Flatten rapid/ plugin to repo root for Claude Code discoverability | 2026-03-05 | 39350ed | [2-flatten-rapid-plugin-to-repo-root-for-cl](./quick/2-flatten-rapid-plugin-to-repo-root-for-cl/) |
| 3 | Fix agent tool calling to use installation path (RAPID_TOOLS env var) | 2026-03-05 | 1a497a9 | [3-fix-agent-tool-calling-to-use-installati](./quick/3-fix-agent-tool-calling-to-use-installati/) |
| 4 | Make /rapid:install a valid command and fix RAPID acronym | 2026-03-05 | 46ac072 | [4-make-rapid-install-a-valid-command-and-f](./quick/4-make-rapid-install-a-valid-command-and-f/) |
| 5 | Fix install command shell detection and .env persistence | 2026-03-05 | f8e7b58 | [5-fix-install-command-shell-detection-and-](./quick/5-fix-install-command-shell-detection-and-/) |
| 6 | Create README.md as GitHub landing page | 2026-03-05 | e32ef74 | [6-create-a-readme-and-update-references-to](./quick/6-create-a-readme-and-update-references-to/) |
| 7 | Update all skills/commands with .env fallback loading | 2026-03-05 | 00e8b9a | [7-update-init-and-other-commands-to-load-e](./quick/7-update-init-and-other-commands-to-load-e/) |

## Session Continuity

Last session: 2026-03-10T05:54:22.669Z
Stopped at: Completed 31-01-PLAN.md
Resume file: None
