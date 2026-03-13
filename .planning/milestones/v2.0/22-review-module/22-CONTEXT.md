# Phase 22: Review Module - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Completed waves undergo automated testing and adversarial bug hunting before merge eligibility. This phase delivers the /rapid:review skill, two-tier review system (lean wave-level + full set-level), unit test agent with test plan approval, bug hunting pipeline (hunter/devils-advocate/judge), bugfix agent with iteration limits, and UAT agent with browser automation. Review is the quality gate between execution and merge.

</domain>

<decisions>
## Implementation Decisions

### Two-tier review architecture
- **Lean wave-level review:** Runs automatically after each wave completes (during reconciliation). Covers artifact verification, quick static analysis (hunter only, no adversarial pipeline), and contract compliance. Attempts to auto-fix issues. If auto-fix fails, blocks and asks user — recommended option is "Log issue and continue." Logged issues can be batch-fixed later via `/execute --fix-issues`
- **Full set-level review:** Triggered manually via `/rapid:review <set>`. Runs the complete unit test > bug hunt > UAT pipeline. Set transitions to 'reviewing' state. User chooses which stages to run at invocation via AskUserQuestion

### Pipeline invocation & scope
- `/rapid:review` is manual-only — /execute does NOT auto-chain into review
- Dual scope: `/rapid:review mySet` (all waves) or `/rapid:review mySet wave-2` (specific wave)
- Review state is set-level only — wave state machine stays unchanged (reconciling → complete). Set transitions executing → reviewing when /review runs
- Review artifacts: per-wave detail reports in `.planning/waves/{setId}/{waveId}/REVIEW-*.md`, plus consolidated `REVIEW-SUMMARY.md` at set level

### Stage control & ordering
- User chooses which stages to run at invocation via AskUserQuestion (unit test, bug hunt, UAT — pick 1, 2, or all 3)
- When multiple stages selected, order is: unit test → bug hunt → UAT
- Unit test agent: generates test plan for user approval BEFORE writing tests (always)
- Bug hunt agent: runs autonomously — no approval gate (the adversarial pipeline is its own quality gate)
- UAT agent: generates test plan for user approval BEFORE executing (always)
- Judge's DEFERRED rulings require human input — present evidence from both hunter and devils advocate, developer makes final call

### Bug hunt iteration depth
- Fixed limit of 3 bugfix cycles: hunt → fix → re-hunt → fix → re-hunt → fix
- After 3 cycles, remaining unfixed bugs are presented to user with per-bug options: fix manually, defer, or dismiss
- Hunter scope: changed files + their dependencies (files that import/depend on changed files)
- Re-hunts (cycles 2 and 3) narrow scope to only files the bugfix agent modified in the previous cycle

### UAT human interaction
- UAT agent classifies each step as automated or human — user approves classification in the test plan
- Browser automation tool (Playwright MCP vs Chrome DevTools MCP) is a project/global-level config setting
- Human-tagged steps: UAT pauses execution, describes what to verify (with screenshot if web), waits for pass/fail via AskUserQuestion
- UAT test plans derived from JOB-PLAN.md acceptance criteria and WAVE-CONTEXT.md decisions
- Failed UAT steps: log failure with evidence (screenshot, error), continue running remaining steps. Full report at end

### Claude's Discretion
- Internal prompt design for all new agent roles (unit-tester, bug-hunter, devils-advocate, judge, bugfix, uat)
- Lean wave-level review implementation details (how auto-fix works, what constitutes a fixable issue)
- Review artifact format (REVIEW-UNIT.md, REVIEW-BUGS.md, REVIEW-UAT.md naming)
- How logged issues are structured and persisted for --fix-issues
- Bug hunter risk/confidence scoring format
- UAT screenshot capture and presentation mechanism
- Execute --fix-issues implementation details

</decisions>

<specifics>
## Specific Ideas

- GSD has reference implementations for all review agent types (gsd-review skill family: hunter, devils-advocate, judge, unit-test, uat-agent, bugfix-agent) — use as inspiration for RAPID's agents
- The lean wave-level review should feel invisible when things are working — auto-fix silently, only surface to user when it can't resolve something
- `/rapid:config` command for configuring browser automation tool preference (Playwright MCP vs Chrome DevTools MCP) — deferred as its own capability
- The issue logging system should produce structured data that survives context resets and is queryable by --fix-issues
- The existing role-reviewer.md is merge-focused and role-verifier.md is artifact-focused — the review module's agents are complementary, not replacements

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `role-reviewer.md`: Existing merge-focused reviewer — reference for code review checklist patterns
- `role-verifier.md`: Existing artifact verifier — reference for verification tiers (lightweight/heavyweight)
- `state-machine.cjs`: transitionSet() for executing→reviewing transition, readState/writeState for review progress
- `state-transitions.cjs`: SET_TRANSITIONS already includes `executing: ['reviewing']` and `reviewing: ['merging']`
- `state-schemas.cjs`: SetStatus already includes 'reviewing' enum value
- `execute.cjs`: reconcileWave() — lean review could integrate here or run immediately after
- `contract.cjs`: CONTRACT_META_SCHEMA validation — reusable for contract compliance checks in lean review
- `assembler.cjs`: assembleAgent() — register new review agent roles (6 new roles needed)
- `returns.cjs`: RAPID:RETURN protocol — all review agents should use structured COMPLETE/CHECKPOINT/BLOCKED returns

### Established Patterns
- AskUserQuestion at every decision gate (v1.1 pattern)
- .env fallback loading in all skills
- Banner-style progress output for multi-step operations
- Lock-protected atomic writes for STATE.json
- Structured JSON CLI output parsed by skills
- Agent role modules in `src/modules/roles/` (19 existing roles)
- Wave artifacts in `.planning/waves/{setId}/{waveId}/`

### Integration Points
- New: `skills/review/SKILL.md` — the /rapid:review skill
- New: `src/lib/review.cjs` — review library with pipeline orchestration, issue logging, scoping
- New agent roles: `role-unit-tester.md`, `role-bug-hunter.md`, `role-devils-advocate.md`, `role-judge.md`, `role-bugfix.md`, `role-uat.md`
- Modified: `src/lib/execute.cjs` — integrate lean wave-level review into post-reconciliation flow
- Modified: `src/bin/rapid-tools.cjs` — new CLI subcommands for review management
- Modified: `skills/execute/SKILL.md` — add --fix-issues flag support
- Read: `.planning/waves/{setId}/{waveId}/*-JOB-PLAN.md` — acceptance criteria for UAT test generation

</code_context>

<deferred>
## Deferred Ideas

- `/rapid:config` command for project/global-level settings (browser automation tool choice, etc.) — new capability, its own phase or quick task
- `/execute --fix-issues` batch-fix command — implementation details deferred to planning, may need its own plan within this phase

</deferred>

---

*Phase: 22-review-module*
*Context gathered: 2026-03-08*
