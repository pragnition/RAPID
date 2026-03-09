# Phase 26: Numeric ID Infrastructure - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable users to reference sets and waves by short numeric index (e.g., `1`, `1.1`) instead of typing full string IDs. Full string IDs remain backward-compatible. Resolution logic is centralized so all 7+ skills that accept set/wave arguments get numeric support consistently.

</domain>

<decisions>
## Implementation Decisions

### ID format & mapping
- Numeric IDs are 1-based indices into the alphabetically-sorted set list from `.planning/sets/`
- Dot notation for waves: `1.1` = set 1, wave 1 (wave index within set's waves[] array, also 1-based)
- If input matches `/^\d+$/`, always treat as numeric index — never try string match for bare integers
- Full string IDs (e.g., `set-01-foundation`) still work identically to before (UX-03)
- Scope: sets and waves only — job numeric references deferred to a future phase

### Resolution layer placement
- New module: `src/lib/resolve.cjs` with `resolveSet(input, cwd)` and `resolveWave(input, cwd)` functions
- `rapid-tools.cjs` exposes a `resolve` CLI subcommand: `rapid-tools resolve set 1` and `rapid-tools resolve wave 1.1`
- Skills call the resolve subcommand at the CLI boundary — resolution happens once, before dispatching to handlers
- Single call for waves: `resolve wave 1.1` returns both set and wave info in one response

### Resolver output shape
- JSON object with full context: `{"resolvedId": "set-01-foundation", "numericIndex": 1, "wasNumeric": true}`
- Wave resolution returns: `{"setId": "set-01-foundation", "waveId": "wave-01", "setIndex": 1, "waveIndex": 1, "wasNumeric": true}`
- Always includes `numericIndex` even when input was a full string ID (enables consistent display)

### Error handling
- Out-of-range: "Set 5 not found. Valid range: 1-3. Use /rapid:status to see available sets."
- Zero/negative: "Invalid index: must be a positive integer."
- Malformed dot notation (`1.`, `.1`, `1.0`, `1.1.1`): "Invalid wave reference. Use N.N format (e.g., 1.1 = set 1, wave 1)."
- No STATE.json / no sets: "No sets found. Run /rapid:plan first to create a project plan with sets."
- Strict validation: wave dot notation must match `/^\d+\.\d+$/`

### Display integration
- `/rapid:status` shows numeric indices inline: "1: set-01-foundation [executing]"
- Waves indented with dot notation: "  1.1: wave-01 [complete]"
- Jobs shown with triple dot notation in display only: "    1.1.1: job-setup [complete]" (display hint, not functional ref)
- Next-step suggestions from skills use numeric shorthand: "Next: /rapid:wave-plan 1.1"

### Claude's Discretion
- Internal implementation details of resolve.cjs (caching, function signatures beyond the public API)
- Exact error message wording refinements
- Whether resolve subcommand supports a `--format` flag or always outputs JSON
- Test file organization for the new module

</decisions>

<specifics>
## Specific Ideas

- Resolver always returns index even for string inputs — skills can consistently prefix output with "1: set-name" regardless of how user invoked
- Job indices shown in status display even though job resolution isn't supported yet — prepares users for future extension

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `plan.listSets(cwd)` in `src/lib/plan.cjs` — returns sorted set directory names, already alphabetical. Direct data source for index mapping.
- `state-machine.cjs` has `readState()` — reads STATE.json with Zod validation. Source for wave listings within sets.
- `state-schemas.cjs` — Zod schemas for SetState, WaveState, JobState with string IDs and nested arrays.

### Established Patterns
- All CLI subcommands return JSON to stdout (rapid-tools.cjs convention)
- Error handling uses `error()` helper + `process.exit(1)` pattern
- Zod schemas validate all state data — resolver should validate against existing schemas
- CommonJS modules with `module.exports` pattern throughout

### Integration Points
- `rapid-tools.cjs` main switch/case dispatches to handler functions — add `resolve` case alongside existing `set-init`, `wave-plan`, etc.
- Skills call `rapid-tools.cjs` via `node "${RAPID_TOOLS}" <command> <subcommand> <args>` — resolver follows same pattern
- `/rapid:status` skill (skills/status/SKILL.md) renders set/wave listings — needs updating to show indices
- 5+ skills reference `<set-id>` in their SKILL.md prompts — all need updating to call resolver first

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-numeric-id-infrastructure*
*Context gathered: 2026-03-09*
