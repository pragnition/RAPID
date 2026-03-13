---
phase: 20-wave-planning
verified: 2026-03-07T00:16:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
human_verification:
  - test: "Run /rapid:discuss on an initialized set with wave-1 in pending state"
    expected: "Skill presents 5-8 gray areas via multiSelect AskUserQuestion, then runs 4-question loop per selected area with Let Claude decide option on every question"
    why_human: "Skill execution requires Claude Code environment with RAPID_TOOLS set and a live set with STATE.json"
  - test: "Run /rapid:wave-plan on a wave in discussing state with WAVE-CONTEXT.md present"
    expected: "Pipeline spawns research agent -> wave planner -> per-job planners -> validate-contracts; WAVE-RESEARCH.md, WAVE-PLAN.md, JOB-PLAN.md files are created; VALIDATION-REPORT.md written"
    why_human: "Multi-agent pipeline requires live Agent tool and real file system; sequential-then-parallel spawning cannot be verified statically"
---

# Phase 20: Wave Planning Verification Report

**Phase Goal:** Each wave has a detailed implementation plan derived from user discussion, with per-job plans validated against interface contracts
**Verified:** 2026-03-07T00:16:00Z
**Status:** PASSED
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Developer can run /rapid:discuss and capture implementation vision for a wave | VERIFIED | `skills/discuss/SKILL.md` (335 lines) with 8-step discussion flow; 8 AskUserQuestion calls confirmed via `grep -c` |
| 2 | Discussion identifies gray areas across wave jobs and deep-dives each via 4-question loops | VERIFIED | Step 4 presents 5-8 gray areas via `multiSelect: true`; Step 5 defines Questions 1-4 with explicit loop structure |
| 3 | Every AskUserQuestion includes a Claude decides option | VERIFIED | Gray area multiselect uses "select none to let me decide all"; deep-dive Steps 5 Q1-Q4 each have "Let Claude decide" option (8 occurrences in file) |
| 4 | /discuss transitions wave to discussing and set to planning on first discussion | VERIFIED | Step 6: `state transition wave ... discussing` then `state transition set ... planning 2>/dev/null || true` (error-tolerant) |
| 5 | WAVE-CONTEXT.md is produced with all decisions recorded | VERIFIED | Step 7 calls `wave-plan create-wave-dir`, then writes WAVE-CONTEXT.md with Wave Boundary, Decisions, Claude's Discretion, Deferred Ideas, Code Context sections |
| 6 | Wave research agent can investigate implementation specifics using CONTEXT + CONTRACT + targeted files | VERIFIED | `role-wave-researcher.md` (105 lines) defines Input (WAVE-CONTEXT.md, CONTRACT.json, SET-OVERVIEW.md, source files), Output (WAVE-RESEARCH.md), Context7 MCP instruction |
| 7 | Wave Planner produces WAVE-PLAN.md with high-level per-job summaries including approach, key files, dependencies, and complexity | VERIFIED | `role-wave-planner.md` (116 lines) output template has Job Summaries with Objective/Approach/Key Files/Dependencies/Complexity fields; File Ownership table; Contract Coverage table |
| 8 | Job Planner produces JOB-PLAN.md per job with detailed implementation steps, acceptance criteria, and contract compliance | VERIFIED | `role-job-planner.md` (122 lines) output template has Implementation Steps (atomic commits), Acceptance Criteria checklist, Contract Compliance section mapping exports/imports/invariants |
| 9 | Developer can run /rapid:wave-plan and get the full research-plan-validate pipeline | VERIFIED | `skills/wave-plan/SKILL.md` (353 lines) 7-step orchestration: env setup -> resolve wave -> research agent -> wave planner -> job planners -> validate-contracts -> commit |
| 10 | Wave research agent is spawned to investigate implementation specifics | VERIFIED | Step 3 of wave-plan/SKILL.md: Agent tool call with `role-wave-researcher.md` as instructions, WAVE-RESEARCH.md verified after completion |
| 11 | Wave Planner produces WAVE-PLAN.md with high-level per-job plans | VERIFIED | Step 4 of wave-plan/SKILL.md: Agent tool call with `role-wave-planner.md` as instructions, WAVE-PLAN.md verified after completion |
| 12 | Job Planner produces JOB-PLAN.md per job with detailed implementation steps | VERIFIED | Step 5 of wave-plan/SKILL.md: parallel Agent spawning for 3+ jobs, each gets `role-job-planner.md` instructions |
| 13 | Contract validation gate runs after all job plans and produces VALIDATION-REPORT.md; major violations escalated with fix/update/override choices | VERIFIED | Step 6: `wave-plan validate-contracts` CLI; AskUserQuestion for FAIL case with "Fix plan / Update contract / Override"; VALIDATION-REPORT.md written to `.planning/sets/{setId}/` |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Min Lines | Actual Lines | Status | Details |
|----------|-----------|--------------|--------|---------|
| `src/lib/wave-planning.cjs` | -- | 230 | VERIFIED | Exports: `resolveWave`, `createWaveDir`, `writeWaveContext`, `validateJobPlans`; pure utility library |
| `src/lib/wave-planning.test.cjs` | 80 | 380 | VERIFIED | 18 tests; 4 describe blocks; all pass via `node --test` |
| `src/bin/rapid-tools.cjs` | -- | -- | VERIFIED | `wave-plan` case in main switch; `handleWavePlan` with `resolve-wave`, `create-wave-dir`, `validate-contracts` subcommands |
| `skills/discuss/SKILL.md` | 120 | 335 | VERIFIED | 8 steps, 8 AskUserQuestion uses, "Let Claude decide" on all deep-dive questions |
| `src/modules/roles/role-wave-researcher.md` | 60 | 105 | VERIFIED | Input/Responsibilities/Output/Constraints sections; Context7 MCP; RAPID:RETURN protocol |
| `src/modules/roles/role-wave-planner.md` | 80 | 116 | VERIFIED | WAVE-PLAN.md template with Job Summaries, File Ownership, Contract Coverage; RAPID:RETURN protocol |
| `src/modules/roles/role-job-planner.md` | 80 | 122 | VERIFIED | JOB-PLAN.md template with atomic steps, Contract Compliance section; RAPID:RETURN protocol |
| `skills/wave-plan/SKILL.md` | 150 | 353 | VERIFIED | 7-step pipeline; 3+ Agent calls; validate-contracts gate; AskUserQuestion at 10 decision points |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `skills/discuss/SKILL.md` | `src/bin/rapid-tools.cjs` | `wave-plan resolve-wave` | WIRED | Line 37: `node "${RAPID_TOOLS}" wave-plan resolve-wave <waveId>` |
| `skills/discuss/SKILL.md` | `src/bin/rapid-tools.cjs` | `state transition wave` | WIRED | Line 219: `node "${RAPID_TOOLS}" state transition wave ... discussing` |
| `src/bin/rapid-tools.cjs` | `src/lib/wave-planning.cjs` | `require('../lib/wave-planning.cjs')` | WIRED | Line 1136: `const wp = require('../lib/wave-planning.cjs')` |
| `src/bin/rapid-tools.cjs` | `src/lib/state-machine.cjs` | `sm.readState` before `wp.resolveWave` | WIRED | Lines 1135+1146+1151: `sm.readState(cwd)` -> `wp.resolveWave(stateResult.state, waveId)` |
| `src/bin/rapid-tools.cjs` | `src/lib/contract.cjs` | `CONTRACT.json read + wp.validateJobPlans` | WIRED | Lines 1211+1250: reads CONTRACT.json then calls `wp.validateJobPlans(contractJson, jobPlans, allSetContracts)` |
| `src/modules/roles/role-wave-researcher.md` | `WAVE-CONTEXT.md` | reads as primary input | WIRED | Line 17: `WAVE-CONTEXT.md: The developer's implementation vision` listed in Input section |
| `src/modules/roles/role-wave-planner.md` | `WAVE-RESEARCH.md` | reads research output | WIRED | Line 19: `WAVE-RESEARCH.md: Research findings from the Wave Research Agent` listed in Input |
| `src/modules/roles/role-job-planner.md` | `WAVE-PLAN.md` | reads wave plan for job scope | WIRED | Line 18: `WAVE-PLAN.md: The wave-level plan containing this job's summary` listed in Input |
| `skills/wave-plan/SKILL.md` | `src/modules/roles/role-wave-researcher.md` | Agent tool spawning | WIRED | Line 98: `Include the full contents of src/modules/roles/role-wave-researcher.md as instructions` |
| `skills/wave-plan/SKILL.md` | `src/modules/roles/role-wave-planner.md` | Agent tool spawning | WIRED | Line 143: `Include the full contents of src/modules/roles/role-wave-planner.md as instructions` |
| `skills/wave-plan/SKILL.md` | `src/modules/roles/role-job-planner.md` | Agent tool spawning per job | WIRED | Line 188: `Include the full contents of src/modules/roles/role-job-planner.md as instructions` |
| `skills/wave-plan/SKILL.md` | `src/bin/rapid-tools.cjs` | `wave-plan validate-contracts` | WIRED | Line 227: `node "${RAPID_TOOLS}" wave-plan validate-contracts "${SET_ID}" "${WAVE_ID}"` |
| `skills/wave-plan/SKILL.md` | `src/bin/rapid-tools.cjs` | `state transition wave ... planning` | WIRED | Line 77: `node "${RAPID_TOOLS}" state transition wave "${MILESTONE_ID}" "${SET_ID}" "${WAVE_ID}" planning` |
| `src/lib/assembler.cjs` | `role-wave-researcher.md` | ROLE_TOOLS + ROLE_DESCRIPTIONS | WIRED | Lines 19+33: `wave-researcher` registered with `Read, Grep, Glob, Bash, WebFetch` |
| `src/lib/assembler.cjs` | `role-wave-planner.md` | ROLE_TOOLS + ROLE_DESCRIPTIONS | WIRED | Lines 20+34: `wave-planner` registered with `Read, Write, Grep, Glob` |
| `src/lib/assembler.cjs` | `role-job-planner.md` | ROLE_TOOLS + ROLE_DESCRIPTIONS | WIRED | Lines 21+35: `job-planner` registered with `Read, Write, Grep, Glob` |

**Architectural note on key link deviation:** Plan 01 specified `wave-planning.cjs -> state-machine.cjs` and `wave-planning.cjs -> contract.cjs` as direct requires. The implementation instead keeps `wave-planning.cjs` as a pure utility library (fs/path only), with the CLI handler in `rapid-tools.cjs` reading state via `sm.readState()` before calling `wp.resolveWave(state, waveId)`, and reading CONTRACT.json before calling `wp.validateJobPlans()`. This is functionally equivalent and architecturally superior (better separation of concerns). The functional chain is intact.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| WAVE-01 | Plan 01 | /discuss captures user implementation vision per wave via AskUserQuestion | SATISFIED | `skills/discuss/SKILL.md` Steps 2-7; AskUserQuestion at wave selection, gray area multiselect, 4-question deep-dives, next steps |
| WAVE-02 | Plan 01 | /discuss is comprehensive -- probes uncovered facets, asks about edge cases, only acts autonomously if user opts in | SATISFIED | Step 5 Q2 "probes uncovered facets or edge cases"; Q3 "drills into specifics"; "Let Claude decide" available at every Q for autonomous opt-in |
| WAVE-03 | Plan 02 + Plan 03 | /plan spawns research agents to investigate how to implement wave jobs | SATISFIED | `role-wave-researcher.md` (105 lines); `wave-plan/SKILL.md` Step 3 spawns via Agent tool with Context7 MCP instruction |
| WAVE-04 | Plan 02 + Plan 03 | Wave Planner produces high-level per-job plans with structured output | SATISFIED | `role-wave-planner.md` (116 lines) WAVE-PLAN.md template with Job Summaries, File Ownership, Contract Coverage, Risks tables |
| WAVE-05 | Plan 02 + Plan 03 | Job Planner creates detailed per-job implementation plans with user discussion | SATISFIED | `role-job-planner.md` (122 lines); reads WAVE-CONTEXT.md (user's discussion output); produces JOB-PLAN.md with atomic steps and Contract Compliance |
| WAVE-06 | Plan 03 | Job Planner validates plans against interface contracts | SATISFIED | `wave-plan/SKILL.md` Step 6: `wave-plan validate-contracts` runs `validateJobPlans()` against CONTRACT.json; major violations escalated via AskUserQuestion |

All 6 WAVE requirements verified. No orphaned requirements detected.

### Test Results

```
node --test src/lib/wave-planning.test.cjs

resolveWave: 5/5 pass
  - returns single match when waveId is unique
  - returns array of matches when waveId is ambiguous (exists in multiple sets)
  - throws Error when waveId not found, listing available wave IDs
  - handles state with no milestones gracefully
  - handles state with empty sets gracefully

createWaveDir: 3/3 pass
  - creates .planning/waves/{setId}/{waveId}/ directory and returns absolute path
  - is idempotent -- returns path without error if directory already exists
  - creates nested directories recursively

writeWaveContext: 2/2 pass
  - writes WAVE-CONTEXT.md to the wave directory
  - creates wave directory if it does not exist

validateJobPlans: 8/8 pass
  - detects missing export coverage (export file not in any job plan)
  - reports no violations when all exports are covered
  - detects cross-set import of function not exported by source set
  - uses case-insensitive matching for cross-set imports
  - classifies missing cross-set import as major violation
  - classifies missing export coverage as auto-fix severity
  - handles empty contract gracefully
  - handles contract with no imports gracefully

Total: 18/18 pass, 0 fail
```

### Anti-Patterns Found

No anti-patterns found in phase 20 files.

Scanned: `wave-planning.cjs`, `wave-planning.test.cjs`, `skills/discuss/SKILL.md`, `skills/wave-plan/SKILL.md`, `role-wave-researcher.md`, `role-wave-planner.md`, `role-job-planner.md`

No TODOs, FIXMEs, placeholder returns, stub implementations, or console-only handlers detected.

### Human Verification Required

#### 1. /rapid:discuss Live Execution

**Test:** Open Claude Code in an initialized RAPID project with a set that has waves in `pending` status. Run `/rapid:discuss wave-1`. Follow the flow through gray area selection and one deep-dive loop.
**Expected:** Skill presents 5-8 gray areas via multiSelect AskUserQuestion; after selection, runs 4-question loop with "Let Claude decide" option on Q1-Q4; after completing discussion, creates WAVE-CONTEXT.md and transitions wave to `discussing` via CLI; presents next-steps AskUserQuestion.
**Why human:** Skill execution requires live Claude Code environment with RAPID_TOOLS set; AskUserQuestion rendering cannot be verified statically; state transition requires valid STATE.json.

#### 2. /rapid:wave-plan Pipeline Execution

**Test:** With a wave in `discussing` state and WAVE-CONTEXT.md present, run `/rapid:wave-plan wave-1`. Observe the 7-step pipeline.
**Expected:** Research agent spawns and writes WAVE-RESEARCH.md; wave planner spawns and writes WAVE-PLAN.md; job planners spawn (parallel if 3+ jobs) and write `{jobId}-PLAN.md` files; `wave-plan validate-contracts` runs and VALIDATION-REPORT.md is created; all artifacts committed.
**Why human:** Multi-agent pipeline requires live Agent tool invocations; parallel job planner spawning for 3+ jobs cannot be verified statically; BLOCKED escalation paths need real failure conditions to test.

### Gaps Summary

No gaps found. All 13 observable truths verified, all 8 required artifacts substantive and wired, all 16 key links confirmed, all 6 WAVE requirements satisfied, all 18 unit tests pass, no anti-patterns detected.

The phase goal is achieved: waves have a detailed planning pipeline where user discussion (via /rapid:discuss) captures implementation vision into WAVE-CONTEXT.md, followed by automated research-plan-validate pipeline (via /rapid:wave-plan) that produces WAVE-RESEARCH.md, WAVE-PLAN.md, per-job JOB-PLAN.md files, and VALIDATION-REPORT.md -- all validated against interface contracts before execution begins.

---

_Verified: 2026-03-07T00:16:00Z_
_Verifier: Claude (gsd-verifier)_
