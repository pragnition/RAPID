---
phase: 18-init-and-project-setup
verified: 2026-03-06T13:41:49Z
status: gaps_found
score: 6/7 must-haves verified
re_verification: false
gaps:
  - truth: "/new-milestone skill references role modules for research and roadmapper agents"
    status: partial
    reason: "new-milestone SKILL.md spawns generic 'research agent {N}' and 'roadmapper agent' without loading the specific role module files (role-research-*.md, role-roadmapper.md). The init SKILL.md correctly loads each role file before spawning agents, but new-milestone does not follow this pattern."
    artifacts:
      - path: "skills/new-milestone/SKILL.md"
        issue: "Research agents are generic numbered agents (1-5) instead of referencing the 5 specific role modules. Roadmapper agent is invoked without loading role-roadmapper.md instructions. This means the agents will not receive their specialized prompts."
    missing:
      - "Load role module files (role-research-stack.md, role-research-features.md, role-research-architecture.md, role-research-pitfalls.md, role-research-oversights.md) before spawning research agents, matching the init SKILL.md pattern"
      - "Load role-research-synthesizer.md before spawning synthesizer agent"
      - "Load role-roadmapper.md before spawning roadmapper agent"
---

# Phase 18: Init and Project Setup Verification Report

**Phase Goal:** Developers can initialize new projects or milestones with intelligent detection, parallel research, and automatic roadmap creation
**Verified:** 2026-03-06T13:41:49Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | /init detects whether the project is greenfield or brownfield and adapts its workflow accordingly | VERIFIED | skills/init/SKILL.md contains greenfield/brownfield detection at Step 6 (lines 330-361), with codebase synthesizer for brownfield and skip path for greenfield |
| 2 | /init asks the developer for model selection (opus/sonnet) and team size, then uses these to scale set planning | VERIFIED | skills/init/SKILL.md Step 4 has AskUserQuestion for model and team size; generateConfigJson in init.cjs computes max_parallel_sets from teamSize; 16 AskUserQuestion calls total |
| 3 | For brownfield projects, a codebase synthesizer agent analyzes files, functions, API endpoints, code style, and tech stack before planning begins | VERIFIED | role-codebase-synthesizer.md (117 lines) has Input/Output/Scope sections; init SKILL.md loads role file and spawns Agent tool at Step 6b |
| 4 | Parallel research agents investigate stack, features, architecture, and pitfalls, producing a synthesized SUMMARY.md | VERIFIED | 5 role modules (94-132 lines each) with distinct scopes; role-research-synthesizer.md (135 lines) produces SUMMARY.md; init SKILL.md spawns all 5 in parallel at Step 7 |
| 5 | A roadmapper agent creates a roadmap with the new sets/waves/jobs structure based on research and user input | VERIFIED | role-roadmapper.md (190 lines) specifies unified contract generation and structured JSON output; init SKILL.md spawns roadmapper at Step 9 with propose-then-approve |
| 6 | /install preserves current env var methodology with shell detection, and /new-milestone starts a new milestone cycle | PARTIAL | /install verified as unchanged (INIT-07 satisfied). /new-milestone SKILL.md exists (231 lines) with 8-step pipeline and AskUserQuestion gates. However, new-milestone does NOT reference the specific role module files for its research/roadmapper agents -- it uses generic agent descriptions instead of loading the specialized role prompts |
| 7 | /help shows all Mark II commands with workflow guidance for the new hierarchy | VERIFIED | skills/help/SKILL.md (105 lines) lists 15 commands grouped by lifecycle stage (Setup, Planning, Execution, Review, Merge, Meta) with Typical Workflow section |

**Score:** 6/7 truths verified (1 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/init.cjs` | Extended generateConfigJson with model/teamSize | VERIFIED | 314 lines, model and teamSize params wired, defaults working |
| `src/lib/init.test.cjs` | Tests for config model, research dir, team size | VERIFIED | 456 lines, 53 tests all pass |
| `src/bin/rapid-tools.cjs` | New init subcommands + state add-milestone | VERIFIED | 1427 lines, research-dir/write-config/add-milestone all present |
| `src/bin/rapid-tools.test.cjs` | Tests for CLI subcommands | VERIFIED | 1514 lines, 62/63 pass (1 pre-existing failure unrelated to phase 18) |
| `src/modules/roles/role-codebase-synthesizer.md` | Brownfield analysis instructions | VERIFIED | 117 lines with Input/Output/Scope sections |
| `src/modules/roles/role-research-stack.md` | Stack research agent | VERIFIED | 94 lines with distinct scope |
| `src/modules/roles/role-research-features.md` | Features research agent | VERIFIED | 109 lines with distinct scope |
| `src/modules/roles/role-research-architecture.md` | Architecture research agent | VERIFIED | 122 lines with distinct scope |
| `src/modules/roles/role-research-pitfalls.md` | Pitfalls research agent | VERIFIED | 111 lines with distinct scope |
| `src/modules/roles/role-research-oversights.md` | Oversights research agent | VERIFIED | 132 lines with distinct scope |
| `src/modules/roles/role-research-synthesizer.md` | Research synthesis instructions | VERIFIED | 135 lines with SUMMARY.md output |
| `src/modules/roles/role-roadmapper.md` | Roadmap generation with contracts | VERIFIED | 190 lines with unified contract generation |
| `skills/init/SKILL.md` | Complete multi-agent init pipeline | VERIFIED | 556 lines, all role modules referenced, all CLI subcommands used |
| `skills/help/SKILL.md` | Mark II command reference | VERIFIED | 105 lines, 15 commands grouped by lifecycle |
| `skills/new-milestone/SKILL.md` | New milestone lifecycle skill | PARTIAL | 231 lines, full pipeline, but generic agent spawning without role module loading |
| `src/lib/state-machine.cjs` | addMilestone function | VERIFIED | Function exported at line 456, 59 tests pass |
| `src/lib/state-machine.test.cjs` | Tests for addMilestone | VERIFIED | 9 addMilestone tests, all pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `rapid-tools.cjs` | `init.cjs` | handleInit calls generateConfigJson with model/teamSize | WIRED | write-config subcommand calls generateConfigJson with parsed opts |
| `skills/init/SKILL.md` | `role-codebase-synthesizer.md` | Agent tool spawns codebase synthesizer | WIRED | Line 336: reads role file, line 342: passes as agent instructions |
| `skills/init/SKILL.md` | `role-research-*.md` | Agent tool spawns 5 parallel research agents | WIRED | Lines 372-376: all 5 role files listed, loaded before spawning |
| `skills/init/SKILL.md` | `role-research-synthesizer.md` | Agent tool spawns synthesizer | WIRED | Line 413: reads synthesizer role file |
| `skills/init/SKILL.md` | `role-roadmapper.md` | Agent tool spawns roadmapper | WIRED | Line 434: reads roadmapper role file |
| `skills/init/SKILL.md` | `rapid-tools.cjs` | Bash calls to init subcommands | WIRED | Lines 297, 307, 313: scaffold, write-config, research-dir |
| `skills/new-milestone/SKILL.md` | `state-machine.cjs` | CLI calls state add-milestone | WIRED | Lines 106, 111: add-milestone CLI with stdin |
| `skills/new-milestone/SKILL.md` | `role-roadmapper.md` | Agent tool spawns roadmapper | NOT_WIRED | Mentions "roadmapper agent" generically but never loads role-roadmapper.md |
| `skills/new-milestone/SKILL.md` | `role-research-*.md` | Agent tool spawns research agents | NOT_WIRED | Uses generic "Research agent {N}" without loading any of the 5 role modules |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INIT-01 | 18-01, 18-03 | /init detects greenfield vs brownfield | SATISFIED | init SKILL.md Step 6 brownfield detection |
| INIT-02 | 18-01, 18-03 | Model selection and team size | SATISFIED | AskUserQuestion in SKILL.md + generateConfigJson opts |
| INIT-03 | 18-02, 18-03 | Codebase synthesizer agent | SATISFIED | Role module + init SKILL.md wiring |
| INIT-04 | 18-02, 18-03 | Parallel research agents | SATISFIED | 5 role modules + init SKILL.md parallel spawning |
| INIT-05 | 18-01, 18-02, 18-03 | Research synthesizer -> SUMMARY.md | SATISFIED | Role module + init SKILL.md wiring |
| INIT-06 | 18-01, 18-02, 18-03 | Roadmapper creates roadmap | SATISFIED | Role module + init SKILL.md wiring with propose-then-approve |
| INIT-07 | 18-04 | /install preserves env var methodology | SATISFIED | Verified unchanged -- existing install skill handles shell detection |
| INIT-08 | 18-04 | /new-milestone starts new cycle | PARTIAL | SKILL.md exists with full pipeline, but research/roadmapper agents not wired to role modules |
| UX-04 | 18-02, 18-04 | /help shows Mark II commands | SATISFIED | 15 commands grouped by lifecycle stage |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/bin/rapid-tools.test.cjs` | 569 | Pre-existing test failure (worktree status) | Info | Not related to phase 18 -- from earlier flatten operation |

No TODOs, FIXMEs, placeholders, or empty implementations found in phase 18 modified files.

### Human Verification Required

### 1. Init Pipeline End-to-End Flow

**Test:** Run `/rapid:init` in a fresh directory and follow the full pipeline through to roadmap approval
**Expected:** Prerequisites check, project setup questions with deep discovery, scaffold creation, research agents produce output files in .planning/research/, synthesizer creates SUMMARY.md, roadmapper proposes roadmap, user can approve/revise/cancel
**Why human:** Multi-agent orchestration with real Claude agent spawning, interactive AskUserQuestion flows, and agent output quality cannot be verified programmatically

### 2. New Milestone Flow

**Test:** Run `/rapid:new-milestone` in a project with existing milestone and unfinished sets
**Expected:** Reads current state, gathers new milestone goals, handles carry-forward set selection, creates milestone, runs research pipeline, proposes roadmap
**Why human:** Interactive multi-step workflow with state mutation and agent spawning

### 3. Help Command Completeness

**Test:** Run `/rapid:help` and verify all commands are displayed with correct descriptions
**Expected:** Commands grouped by Setup, Planning, Execution, Review, Merge, Meta with descriptions matching actual skill behavior
**Why human:** Visual verification of grouping, descriptions, and workflow guidance

### Gaps Summary

One gap found: The `/new-milestone` SKILL.md (skills/new-milestone/SKILL.md) does not load the specific agent role module files when spawning research and roadmapper agents. Unlike the init SKILL.md which explicitly reads each `role-*.md` file and passes the instructions to the Agent tool, the new-milestone skill uses generic agent descriptions like "Research agent {N}" without the specialized prompts. This means the agents spawned by `/new-milestone` would not receive the carefully crafted scope boundaries, output formats, and behavioral constraints defined in the role modules.

This is a partial gap rather than a blocker because the new-milestone skill will still function -- agents will receive ad-hoc instructions -- but the quality and consistency of outputs will be lower than the init pipeline which uses the full role modules.

**Root cause:** Plan 18-04 specified the new-milestone skill should run the "same pipeline as init Steps 7-9" but the implementation used generic agent spawning rather than replicating the role module loading pattern.

---

_Verified: 2026-03-06T13:41:49Z_
_Verifier: Claude (gsd-verifier)_
