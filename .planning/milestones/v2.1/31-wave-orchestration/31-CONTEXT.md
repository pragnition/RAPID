# Phase 31: Wave Orchestration - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A single command plans all waves in a set with automatic sequencing, and execute runs waves without per-wave user approval gates. Covers four requirements: auto-chaining wave planning (WAVE-01), parallel planning of independent waves (WAVE-02), sequential planning with predecessor artifacts (WAVE-03), and approval-free execute flow (WAVE-04).

</domain>

<decisions>
## Implementation Decisions

### Command Surface
- New `/rapid:plan-set` command that plans all waves in a set — takes set index/ID only (e.g., `/rapid:plan-set 1`)
- Existing `/rapid:wave-plan` kept for single-wave planning — both commands coexist
- `/rapid:plan-set` requires ALL waves to be discussed first (fail fast) — if any wave is in `pending` state, abort with message listing undiscussed waves
- Plan-set and execute are separate commands — no auto-chain from planning into execution. Plan-set prints next step: `/rapid:execute {setIndex}`

### Wave Independence Detection
- Dedicated `rapid-wave-analyzer` agent reads all WAVE-CONTEXT.md files in a set and determines wave dependencies via LLM analysis
- Analyzer returns structured JSON via RAPID:RETURN (ephemeral) — no persistent artifact written
- Independent waves (no overlap detected) plan in parallel; dependent waves plan sequentially with predecessor artifacts available
- If parallel-planned waves later show file overlap, the plan verifier (Phase 30) catches it during verification — no separate cross-wave reconciliation

### Execute Auto-Advance
- PASS and PASS_WITH_WARNINGS auto-advance to next wave without user approval
- FAIL reconciliation stops the chain and presents user with retry/cancel options (only remaining gate)
- PASS_WITH_WARNINGS prints brief inline summary: "Wave X: PASS_WITH_WARNINGS (2 soft blocks). Continuing..."
- Wave transition banner printed between waves (consistent style for both plan-set and execute)
- Lean review auto-fixes committed automatically with count printed: "Lean review: 3 auto-fixed."
- Lean review needsAttention items still gate (log-and-continue or pause — existing behavior)

### Error Handling in Chains
- Plan-set: if any wave's planning fails and user cancels re-plan, the entire chain stops (no skip-and-continue)
- Parallel-planned waves: if one fails, sibling waves in the same batch continue to completion. Only subsequent dependent waves are blocked.
- Plan-set has smart re-entry: skip waves already in `planning` state, only plan waves still in `discussing` state
- Execute: new `--retry-wave wave-2` flag for targeting a specific failed wave instead of re-running the entire set
- Execute also retains smart re-entry (re-run `/rapid:execute 1` skips complete waves, retries failed)

### Claude's Discretion
- Wave analyzer agent prompt design and dependency detection heuristics
- Wave transition banner exact format and styling
- How plan-set communicates progress between sequential waves
- Internal structure of RAPID:RETURN JSON from wave analyzer
- Whether plan-set needs its own rapid-tools.cjs subcommands or reuses existing wave-plan CLI calls

</decisions>

<specifics>
## Specific Ideas

- User suggested renaming flow from `/rapid:wave-plan` to set-level command because "it leads from /init" — the name `/rapid:plan-set` captures this intent
- Wave transition banner should use the same RAPID branding style established in Phase 27 (ANSI colored banners)
- Smart re-entry pattern mirrors execute's existing approach (Phase 21) — consistency across commands

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dag.cjs`: `toposort`, `assignWaves`, `getExecutionOrder` — core graph algorithms reusable for wave dependency ordering
- `wave-planning.cjs`: `resolveWave`, `createWaveDir`, `writeWaveContext`, `validateJobPlans` — wave-level operations
- `resolve.cjs`: `resolveSet`, `resolveWave` with `--set` flag — numeric and string ID resolution
- `display.cjs`: `displayBanner()` — stage banner rendering with RAPID branding
- Execute skill Step 2 (smart re-entry): pattern for skip-complete/retry-failed logic
- Execute skill Step 3i: current per-wave approval gate to modify

### Established Patterns
- Agent spawning: `Spawn the **rapid-{role}** agent with this task:` pattern
- Structured return: `<!-- RAPID:RETURN {...} -->` protocol for agent verdicts
- State transitions: `node "${RAPID_TOOLS}" state transition wave ...` CLI calls
- Env preamble: standard RAPID_ROOT + .env loading block in all skills
- Next-step output: print-only, no AskUserQuestion (Phase 28)

### Integration Points
- New skill: `skills/plan-set/SKILL.md` — set-level wave planning orchestrator
- Modified skill: `skills/execute/SKILL.md` — remove per-wave approval gates for PASS/PASS_WITH_WARNINGS, add `--retry-wave` flag
- New agent: `rapid-wave-analyzer` — LLM-based wave independence detection
- `rapid-tools.cjs`: may need new subcommands for plan-set operations (list waves, check discussion status)
- `agents/` directory: new `rapid-wave-analyzer.md` agent file via `build-agents`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-wave-orchestration*
*Context gathered: 2026-03-10*
