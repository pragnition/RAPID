# Project Research Summary

**Project:** RAPID v2.1 — Workflow Improvements & Fixes
**Domain:** Claude Code plugin — workflow orchestration, subagent delegation, plan verification
**Researched:** 2026-03-09
**Confidence:** HIGH

## Executive Summary

RAPID v2.1 is a quality-of-life milestone that improves an already-working system. Every feature targets a known friction point documented in user feedback: manual multi-step invocations between init and execution, slow sequential questioning during the discuss phase, context exhaustion in the review pipeline, tedious full-ID typing, and residual GSD framework branding contaminating agent identities at runtime. Research confirms that all 7 planned improvements are achievable using the existing Node.js + Zod + CommonJS + Claude Code subagent stack with zero new npm dependencies. The stack changes are architectural, not technological: new library modules, new agent definitions, and skill rewrites.

The recommended approach is to treat v2.1 as three sequential phases: (1) foundation cleanup that eliminates technical debt and installs shared infrastructure, (2) core workflow improvements that reduce user interaction friction across the plan/discuss/wave-plan pipeline, and (3) advanced orchestration improvements that reduce cost and context consumption in the review stage. Phases 1 and 2 can be built and shipped incrementally. Phase 3 has two independent tracks (planning parallelism vs. review context efficiency) that can run in parallel with each other. The key architectural insight is that all improvements are prompt-engineering and orchestration changes — no architectural rewrites, no new state machine states, no new dependencies.

The primary risks are implementation-level: incomplete GSD decontamination that misses the runtime layer (agents still spawn with gsd-* names despite source code being clean), state machine corruption if a new wave state is added carelessly, race conditions in shared artifact writes during parallel wave planning, and inconsistent numeric ID rollout that ships support in some skills but not others. All risks have clear mitigations: exhaustive grep sweeps followed by integration testing, implementing plan verification as a sub-step within the `planning` state (not a new state), path isolation per-wave for all planning artifacts, and a library-first resolution implementation rolled out to all 7+ skills simultaneously.

## Key Findings

### Recommended Stack

No new dependencies. All 7 v2.1 features are implemented through: new library module files (`src/lib/resolve.cjs`, extensions to `src/lib/verify.cjs` and `src/lib/review.cjs`), new agent role modules (`src/modules/roles/role-plan-verifier.md`, `src/modules/roles/role-review-scoper.md`), one new Claude Code native subagent definition (`agents/rapid-scoper.md`), and targeted rewrites of skill orchestration files. The existing stack — Node.js >=18, Zod 3.25.76 (CommonJS), proper-lockfile, ajv, git worktrees — is retained exactly.

**Core technologies (unchanged):**
- Node.js >=18: runtime — all .cjs format, no migration needed
- Zod 3.25.76: schema validation — add PlanVerification schema to verify.cjs
- proper-lockfile 4.1.2: atomic state writes — serializes parallel planning state transitions safely
- git worktrees: set isolation — core mechanism, unchanged
- node:test (built-in): test framework — all new modules get .test.cjs files

**New components (no new dependencies):**
- `src/lib/resolve.cjs`: numeric ID + substring resolution (~30 lines, parseInt + array indexing)
- `src/modules/roles/role-plan-verifier.md`: read-only verification agent (file conflicts, step ordering, test coverage gaps)
- `src/modules/roles/role-review-scoper.md`: review scoping agent (produces REVIEW-SCOPE.md for downstream review agents)
- `agents/rapid-scoper.md`: native Claude Code subagent definition using `model: haiku` and `permissionMode: dontAsk`

### Expected Features

**Must have — table stakes (users already feel these gaps):**
- GSD agent type decontamination — agents spawn with gsd-* names; erodes trust; embarrassing
- Numeric ID shorthand (`/rapid:discuss 1` not `/rapid:discuss set-01-foundation`) — critical ergonomic fix
- Batched questioning in discuss — 20 sequential AskUserQuestion calls per session is unsustainable

**Should have — core value of v2.1:**
- Streamlined workflow (init auto-suggests set-init; each skill suggests the next step with exact invocation syntax) — eliminates manual command chain memorization
- Plan verifier agent (coverage, file conflicts, step ordering, test coverage gaps) — catches planning errors before execution

**Competitive differentiators (advanced orchestration):**
- Parallel wave planning with dependency-aware sequencing — auto-chain sequential waves; parallel planning for independent waves
- Context-efficient review with scoper delegation — 60-80% context reduction; lean review default; full adversarial pipeline opt-in

**Defer to v2.2+:**
- Express mode (auto-accept defaults at non-critical gates) — defer until workflow streamlining is proven
- Cross-milestone plan comparison — defer until multiple milestones are common in practice
- Selective wave re-planning — defer until parallel wave planning reveals re-plan patterns
- Review scoper learning/persistent memory — defer until scoper utility is validated

### Architecture Approach

RAPID's architecture is a 4-layer system: Skill Layer (SKILL.md orchestrators) -> Agent Composition Layer (assembler.cjs + role modules) -> CLI Layer (rapid-tools.cjs, ~95 subcommands) -> Library Layer (21 .cjs files) -> State/Filesystem (STATE.json + .planning/). All v2.1 changes respect this layering strictly: resolution logic lives in the library layer callable via CLI, skills call CLI subcommands to access all state, agents communicate via filesystem artifacts (not direct data passing), and all STATE.json writes go through lock-protected Zod-validated functions.

**Major components and v2.1 changes:**
1. `state-machine.cjs` — add `resolveEntityId()` for numeric + substring ID resolution (additive, no changes to existing functions)
2. `wave-planning.cjs` — add `listWavesInOrder()` and `getPlannableWaves()` for multi-wave planning (additive)
3. `review.cjs` — add `generateScopeInput()` to produce scoper input from wave scope data (additive)
4. `rapid-tools.cjs` — add `state resolve-id` and `wave-plan plan-all` subcommands (new routes, existing routes unchanged)
5. `skills/discuss/SKILL.md` — restructure 4-question loop into 2-interaction batched approach (rewrite of Step 5)
6. `skills/wave-plan/SKILL.md` — add multi-wave mode and plan verifier step between job planning and contract validation (major extension)
7. `skills/review/SKILL.md` — add scoper delegation before bug hunt pipeline; lean review as default (restructure)

**Key patterns to maintain:**
- CLI-Mediated State Access: skills never read/write STATE.json directly; always via rapid-tools.cjs
- Subagent Orchestration from SKILL.md: one level of delegation only; agents cannot spawn sub-agents
- Artifact-Based Communication: PLAN-VERIFICATION.md and REVIEW-SCOPE.md as new pipeline artifacts
- Lock-Protected Atomic Writes: parallel wave planning serializes STATE.json access through existing lock mechanism
- No new wave state statuses: plan verification runs as a sub-step within `planning` state; artifact existence signals completion

### Critical Pitfalls

1. **Incomplete GSD decontamination (three-layer problem)** — source code clean does not mean runtime clean. Fix requires: grep sweep of all `src/` code, update test assertions in `init.test.cjs:90-92`, add explicit "You are rapid-{role}" identity anchoring in all Agent tool spawns in SKILL.md files, and integration-test by actually running each skill and inspecting displayed agent names in Claude Code UI.

2. **Adding a new wave state for plan verification** — do NOT add a `verified` state to the wave state machine; it requires coordinated 4-file updates (state-transitions.cjs, state-schemas.cjs, state-machine.cjs, rapid-tools.cjs) and breaks all skill status checks. Instead, run the plan verifier as a sub-step within the `planning` state; use PLAN-VERIFICATION.md artifact existence as implicit status; transition to `executing` only after verification passes.

3. **Race conditions during parallel wave planning** — VALIDATION-REPORT.md is currently written to `.planning/sets/{setId}/VALIDATION-REPORT.md` (set-level); parallel wave-plan runs will overwrite each other. Fix first: move to `.planning/waves/{setId}/{waveId}/VALIDATION-REPORT.md` (wave-level). Also: each wave-plan run must commit only its own wave directory to avoid git HEAD lock conflicts.

4. **Inconsistent numeric ID rollout across skills** — partial rollout creates a broken UX where `/set-init 1` works but `/discuss 1` does not. Implement `resolveEntityId()` in state-machine.cjs + `state resolve-id` CLI subcommand first, then update all 7+ skills simultaneously in one changeset. Never ship partial support.

5. **Plan verifier becoming a rubber stamp or over-blocker** — the existing `validateJobPlans()` already checks contract coverage and cross-set imports. The verifier's unique value is: file conflict detection (two jobs claiming the same file in the same wave), step ordering issues (job A depends on job B's output but both execute in parallel), missing test coverage for acceptance criteria. Implement deterministic checks in code; use LLM only for implementability judgment; make findings advisory, not blocking.

## Implications for Roadmap

Based on the combined research, a 4-phase structure is strongly recommended. Phases 1 and 2 are sequential with safe, incremental commits. Phase 3 has two independent tracks (wave planning vs. review) that can run in parallel. Phase 4 is integration testing.

### Phase 1: Foundation Cleanup

**Rationale:** GSD decontamination must come first — agents with confused identity will mis-execute all subsequent features. Numeric ID resolution comes second — it is the shared library primitive that all skill modifications in Phases 2 and 3 depend on. Role module skeletons can be created here while skills remain unchanged. All items are independent, zero-risk, and have clear completion criteria.

**Delivers:** Clean agent identity (no more gsd-* names in Claude Code UI), testable resolve.cjs library and CLI subcommand, role module stubs for verifier and scoper, fix gsd_state_version in source and tests.

**Features addressed:**
- GSD agent type decontamination (P1 table stakes)
- Numeric ID shorthand library and CLI infrastructure (P1 foundation for all skills)

**New files:** `src/lib/resolve.cjs`, `src/lib/resolve.test.cjs`, `src/modules/roles/role-plan-verifier.md`, `src/modules/roles/role-review-scoper.md`

**Modified files:** `src/lib/init.cjs` (rename gsd_state_version), `src/lib/init.test.cjs` (update test assertion), `rapid-tools.cjs` (add resolve-id subcommand)

**Pitfalls to avoid:** Three-layer GSD decontamination (source + tests + runtime identity anchoring in all SKILL.md Agent spawns); implement resolve.cjs as library first, not per-skill

**Research flag:** Standard patterns — no phase research needed.

---

### Phase 2: Workflow and Planning Improvements

**Rationale:** Depends on Phase 1 numeric ID infrastructure. This is the highest user-value phase — it addresses the explicit friction points in todo.md: batched questioning, streamlined workflow suggestions, and plan verification. Skills are updated to use the resolve.cjs infrastructure from Phase 1.

**Delivers:** Dramatically fewer user interactions per session, explicit next-step guidance after each skill with exact invocation syntax, verified job plans before execution.

**Features addressed:**
- Batched questioning in discuss (P1 table stakes — 50-75% reduction in AskUserQuestion calls)
- Streamlined workflow (P2 core value — each skill suggests exact next command with numeric shorthand)
- Plan verifier agent (P2 core value — unique checks: file conflicts, step ordering, test coverage gaps)
- Numeric ID rollout to all 7+ skills (P1 table stakes — uses Phase 1 library)

**Architecture deliverables:** Extensions to wave-planning.cjs (listWavesInOrder, getPlannableWaves), wave-plan SKILL.md restructure with verifier step, discuss SKILL.md batching rewrite, all skills updated for numeric ID support.

**Pitfalls to avoid:** Do NOT add new wave states (use sub-step within `planning`); update ALL skills for numeric IDs simultaneously; keep plan verifier advisory not blocking; do not batch questions across different gray areas (different areas = different concerns).

**Research flag:** Batched questioning design may need a mini-spike — AskUserQuestion option limits and grouping behavior are medium-confidence from third-party sources. Test empirically at the start of this phase before committing to the full batching implementation.

---

### Phase 3A: Parallel Wave Planning

**Rationale:** Depends on Phase 2 plan verifier (parallel-planned waves each need independent verification). Sequential multi-wave auto-chaining is the primary win (most sets have linearly dependent waves); true parallel dispatch is an optimization on top. Start with sequential multi-wave auto-chaining; add parallel dispatch only after sequential flow is stable.

**Delivers:** Single command to plan all waves in a set; no more manual per-wave invocations; wave-level VALIDATION-REPORT.md isolation.

**Features addressed:**
- Parallel wave planning with dependency-aware sequencing (P3 differentiator)

**Architecture deliverables:** wave-plan SKILL.md `--all` mode, `wave-plan plan-all` CLI subcommand in rapid-tools.cjs, VALIDATION-REPORT.md path migration from set-level to wave-level directories.

**Pitfalls to avoid:** Fix VALIDATION-REPORT.md write path before enabling parallel dispatch; serialize git commits per wave directory; test two concurrent wave-plan runs producing separate artifacts without collision.

**Research flag:** Sequential auto-chaining follows standard patterns — no phase research needed. Parallel dispatch: test Claude Code's 5-simultaneous-subagent limit empirically before designing the fan-out. Start with 2-wave parallelism.

---

### Phase 3B: Context-Efficient Review

**Rationale:** Independent of Phase 3A — modifies review skill and review.cjs, not wave-plan skill or wave-planning.cjs. Depends on Phase 1 role module stubs. The scoper pattern reduces review cost from $15-45/cycle to an estimated $5-15/cycle. Lean review as default eliminates the primary cost surprise for new users.

**Delivers:** 60-80% estimated context reduction per review agent; lean review as default; full adversarial pipeline as explicit opt-in with cost warning.

**Features addressed:**
- Context-efficient review with scoper delegation (P3 differentiator)
- Leaner review stage default (complements scoper work — the two changes ship together)

**Architecture deliverables:** Complete `role-review-scoper.md` agent role, `generateScopeInput()` in review.cjs, REVIEW-SCOPE.md artifact format, review SKILL.md restructure (scoper spawned first at Step 3.0, lean default with full pipeline opt-in).

**Pitfalls to avoid:** Scoper returns file paths + brief summaries (not full file contents) to orchestrator; review subagents use Read tool to load files from paths directly; conservative initial scoping (flag uncertain files as cross-cutting); use Haiku model for scoper via `model: haiku` in agent frontmatter for cost efficiency.

**Research flag:** Context scoping strategy is medium-confidence. Claude Code has no enforced scoped context passing (GitHub #4908 confirmed) — scoping is advisory only (prompt-level). Design the scoper's judgment threshold conservatively and calibrate with real waves before declaring this phase complete.

---

### Phase 4: Integration Testing

**Rationale:** Must come after all individual features are stable. End-to-end flow validation catches regressions and interaction effects (e.g., numeric IDs + parallel planning + scoped review in the same session).

**Delivers:** Validated end-to-end workflow from `/rapid:init` through `/rapid:merge` with all v2.1 features active; measurable context and cost improvements documented.

**Verification checklist (from PITFALLS.md "Looks Done But Isn't"):**
- Numeric IDs work consistently in all 7+ skills; test edge cases (sets named "1-auth", numeric input "1")
- Agent spawn names all start with "rapid-" in Claude Code UI (not just in source code)
- Plan verifier catches known issues (file conflicts, step ordering) and does NOT block valid plans
- Two concurrent wave-plan runs produce separate wave-level VALIDATION-REPORT.md files
- Review context usage measurably lower than baseline (track token counts before and after)
- Re-entry after interruption at each skill boundary recovers cleanly

**Research flag:** Standard testing patterns — no phase research needed.

---

### Phase Ordering Rationale

The ordering follows hard dependency chains identified across all 4 research files:

- Phase 1 before everything: GSD decontamination prevents identity poisoning of all subsequent agent work; resolve.cjs is the shared primitive that Phases 2 and 3A both depend on
- Phase 2 before Phase 3A: plan verifier (Phase 2) is a prerequisite for parallel wave planning (Phase 3A) — parallel-planned waves each need independent verification
- Phase 3A and 3B can proceed in parallel: they modify different skills (wave-plan vs review) and different library files (wave-planning.cjs vs review.cjs) with no shared dependencies
- Phase 4 gates release: integration testing validates the combined system, not individual features in isolation

The FEATURES.md dependency graph confirms this ordering:
```
GSD Decontam    ─────────────────────────────────────────────> [All phases]
Numeric ID      ──> Streamlined Workflow ──> Parallel Planning
                ──> Batched Questioning ──> Plan Verifier ──> Parallel Planning
                                                           ──> Context Review
```

### Research Flags

**Needs investigation during phase planning:**
- **Phase 2 (Batched questioning):** AskUserQuestion option limits and grouping behavior documented in third-party sources only; run a spike at the start of Phase 2 with 15+ options before committing to the batching design
- **Phase 3B (Scoper calibration):** The "needs full read" vs "summary sufficient" judgment is LLM-based; calibrate with real waves before shipping; start conservative (more cross-cutting, fewer isolated scopes)
- **Phase 3A (Parallel dispatch ceiling):** Claude Code 5-simultaneous-subagent limit confirmed in docs but real-world behavior with nested planning subagents is unknown; test with 2 waves before scaling to 5

**Standard patterns — skip phase research:**
- **Phase 1:** GSD grep sweep + test fix + library module creation — all well-understood operations
- **Phase 2 (except batching):** State machine additions, skill restructuring, and CLI subcommands follow established RAPID patterns thoroughly documented in ARCHITECTURE.md
- **Phase 4:** Integration testing follows standard RAPID workflow verification patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies are existing; no new deps; Zod 3.25.76 CommonJS compatibility verified locally; no upgrade risks |
| Features | HIGH | Features derived from first-party user feedback (todo.md) + direct codebase analysis of all 17 skills, 21 libraries, 26 role modules |
| Architecture | HIGH | Based on direct analysis of all source files; integration points and component boundaries are authoritative; specific function names and line numbers cited |
| Pitfalls | HIGH | Derived from actual failure modes observed in production (GSD naming bug exists now); state machine pitfall derived from codebase structure; race condition identified from specific artifact paths in existing code |

**Overall confidence: HIGH**

### Gaps to Address

- **AskUserQuestion option limits:** multiSelect is confirmed supported and used in discuss SKILL.md, but practical limits on option count and grouping come from a third-party blog post. Resolve by testing at the start of Phase 2 with a spike call using 15+ options.
- **Claude Code subagent `model` field behavior:** STACK.md notes `model: haiku` in agents/ frontmatter enables cheap scoper runs, sourced from official docs (March 2026). Verify this field is still honored before relying on it in Phase 3B cost projections.
- **Scoper "full read" calibration:** The review scoper's ability to correctly distinguish "summary sufficient" from "needs full read" has no deterministic guarantee. Start Phase 3B with conservative calibration (default to "needs full read"); tune based on real wave review runs before declaring cost savings realized.
- **True parallelism ceiling in practice:** The 5-simultaneous-subagent limit is confirmed in docs, but real-world behavior with 5 concurrent wave-planning agents (each spawning research + planning + job planning subagents themselves) is untested. Phase 3A should start with 2-wave parallelism and increase only after verifying stability.

## Sources

### Primary (HIGH confidence)
- RAPID v2.0 codebase: all 17 SKILL.md files, 21 .cjs library files, 26 role modules — direct analysis, authoritative source for integration points and pitfall identification
- `todo.md` (60 lines): first-party user feedback — direct requirements for all 7 v2.1 features
- `.planning/PROJECT.md`: first-party v2.1 milestone definition
- `package.json` + `node_modules/zod/package.json`: verified Zod 3.25.76 CommonJS compatibility
- [Claude Code Subagent Documentation](https://code.claude.com/docs/en/sub-agents): subagent architecture, model selection, permissionMode, tools allowlist, agents/ directory format
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills): $ARGUMENTS, $0/$1 positional args, context: fork
- [GitHub Issue #4908: Scoped Context Passing](https://github.com/anthropics/claude-code/issues/4908): confirms scoped context is advisory-only, not tool-enforced

### Secondary (MEDIUM confidence)
- [Claude Code AskUserQuestion Guide](https://smartscope.blog/en/generative-ai/claude/claude-code-askuserquestion-tool-guide/): multiSelect support, timeout behavior, practical option limits
- [Claude Code Sub-Agent Best Practices](https://claudefa.st/blog/guide/agents/sub-agent-best-practices): parallel vs. sequential patterns, context window management
- [GitHub Issue #27645: Subagent Token Waste](https://github.com/anthropics/claude-code/issues/27645): confirms community recognition of token waste in subagent delegation

### Tertiary (LOW confidence)
- Cost estimates ($5-15 scoped vs $15-45 full adversarial review): derived from per-agent token consumption estimates, not empirical measurement — validate during Phase 3B implementation

---
*Research completed: 2026-03-09*
*Ready for roadmap: yes*
