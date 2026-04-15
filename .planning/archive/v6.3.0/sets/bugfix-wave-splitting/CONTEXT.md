# CONTEXT: bugfix-wave-splitting

**Set:** bugfix-wave-splitting
**Generated:** 2026-04-09
**Mode:** interactive

<domain>
## Set Boundary

This set extends `/rapid:bug-fix` with a multi-agent wave-splitting capability, slicing large bug lists into sequential waves so context rot is contained within smaller per-wave executor sessions. All changes are confined to `skills/bug-fix/SKILL.md` — pure procedural-prose edits, no new code modules. Scope includes: wave decomposition logic, sequential dispatch loop (strictly serial, never parallel), a `--wave-size <n>` flag with sensible defaults (3 normal, 5 UAT), per-wave results display, and a final aggregate summary.

Backward compatibility is a first-class requirement: when wave-splitting is not triggered, `/rapid:bug-fix` must behave exactly as it does today — single executor, no wave framing, no overhead.
</domain>

<decisions>
## Implementation Decisions

### Wave-Splitting Trigger Condition (Claude's Discretion)
- **Decision:** Auto-trigger wave-splitting when bug count exceeds the default wave size (3 normal, 5 UAT-equivalent). Below that threshold, the single-executor path is used unchanged. Explicit `--wave-size` always overrides defaults but is still subject to a minimum-bug floor (see below).
- **Rationale:** User explicitly deferred this decision as too in-the-weeds. Auto-trigger makes the defaults meaningful without forcing users to remember a flag, and preserves backward compatibility for small bug lists — the user's stated concern about not wanting to overthink the trigger policy.

### Wave-Splitting Floor (Claude's Discretion)
- **Decision:** Splitting activates only when bug count ≥ 2× the effective wave size (6 normal, 10 if UAT defaults were ever applied). Below this floor, single-executor dispatch is used even if `--wave-size` is passed.
- **Rationale:** User deferred; simple-floor strategy avoids wave ceremony overhead (extra executor spawn, per-wave display) for 2-3 bug runs where a single executor is still well within budget. Keeps the feature engaging only when it genuinely helps.

### UAT Mode Interaction
- **Decision:** Leave `--uat` mode unchanged. Wave-splitting applies only to the normal `/rapid:bug-fix` path. The existing per-failure dispatch (one executor per UAT failure, severity-sorted) remains the UAT flow. The contract's "UAT default wave size 5" is treated as vestigial and should be considered for removal during plan-set.
- **Rationale:** The current UAT flow is already effectively "wave size 1" with severity-descending dispatch — a clean, working model. Grouping multiple failures into one executor risks entangling fixes and regressing a working path for no clear benefit. User chose the safer, non-regressing option.

### UAT Sort Order (Moot)
- **Decision:** Sort-then-group was selected as the answer, but since UAT mode is left unchanged, this decision does not apply to the final implementation. Preserved here for traceability.
- **Rationale:** Would have been relevant only if UAT adopted wave-splitting; user picked the semantically-correct ordering in case the decision ever becomes live in a future set.

### Cross-Wave Handoff — SKIPPED
- **Decision:** No cross-wave handoff. Wave N+1's executor receives only its assigned bug list, with **no** modified-files list, no commit log, and no prior-wave summary. Each wave is treated as independent. The contract's `cross-wave-handoff` export should be marked for reconsideration/removal during plan-set (see Deferred Ideas).
- **Rationale:** User explicitly overrode the recommended "last-wave-only" handoff with: "It probably doesn't require any context. The bugs will rarely cause regressions." This reflects a judgment call that bugs in a single run are usually independent enough that cross-wave regression risk is low, and the simpler no-handoff model avoids any over-engineering. This contradicts the original contract and must be surfaced to plan-set.

### Wave Failure Propagation (BLOCKED)
- **Decision:** Stop-on-blocked. If any wave's executor returns BLOCKED, the run halts immediately, the blocker is displayed, and remaining waves are not dispatched. The user unblocks manually and can re-run.
- **Rationale:** Surfaces problems immediately with predictable state. Prevents cascading failures from a single unresolved issue. Matches the conservative tone the user preferred throughout the discussion.

### CHECKPOINT Handling
- **Decision:** Distinct policy — CHECKPOINT (partial progress) continues to the next wave, while BLOCKED halts. Partial progress is captured in the commit log and treated as progress, not failure.
- **Rationale:** CHECKPOINT means the executor did useful work but ran out of steam on the full task; halting would abandon that progress. Since handoff is skipped, later waves won't even see the partial state, so there's no entanglement risk either.

### Claude's Discretion
- Exact naming of the `--wave-size` flag and its help text
- Per-wave result display format (banner style, field ordering, separator characters)
- Final aggregate summary layout and wording
- Specific wording of the skill prose additions in `skills/bug-fix/SKILL.md`
- How the "wave N of M" announcement is formatted before each dispatch
- Commit message conventions for wave-produced commits (e.g., whether to include wave index in the prefix)
</decisions>

<specifics>
## Specific Ideas
- Wave dispatch must be strictly sequential — never parallel. All waves mutate the same working tree on the same branch, so parallel dispatch would cause branch corruption.
- The acceptance example from CONTRACT.json (10 bugs / `--wave-size 3` → waves of 3+3+3+1) should be codified verbatim in the skill prose so the behavior is self-documenting.
- Wave count announcement (e.g., "Dispatching wave 2 of 4 (3 bugs)") should precede each executor spawn so the user can follow progress.
- Since handoff is skipped, each wave's executor prompt is essentially independent — the only difference between wave 1 and wave N is which bugs it receives. This simplifies the dispatch loop considerably.
</specifics>

<code_context>
## Existing Code Insights

- **Target file:** `skills/bug-fix/SKILL.md` is a single procedural-prose file with clearly numbered steps (Step 0 through Step 5, plus UAT-specific Step UAT, UAT-a..e, Step UAT-Results). Wave-splitting logic slots cleanly into Step 4 (Dispatch Executor Agent) as a conditional path.
- **Current dispatch pattern:** Step 4 currently spawns one `rapid-executor` agent with the full bug list as its task. The wave-splitting path wraps this in a loop: decompose → for each wave → spawn executor → parse RAPID:RETURN → proceed or halt.
- **UAT path is already sequential:** Steps UAT-d and UAT-e already iterate over failures and dispatch one executor per failure. This confirms that "wave-splitting for UAT" would be a behavior change, not an enhancement of an existing loop — reinforcing the decision to leave UAT alone.
- **RAPID:RETURN parsing:** The executor's return format supports COMPLETE / BLOCKED / CHECKPOINT states (see Step 4's existing parsing). The wave loop reuses this parsing verbatim.
- **Commit convention:** Existing skill uses `fix(bug-fix): {brief description}`. Wave commits can follow the same convention without modification; no wave-index tagging is required unless plan-set deems it useful.
- **Backward compatibility entry point:** The simplest implementation branches at the top of Step 4: if wave-splitting threshold not met, fall through to the existing single-executor prose unchanged; otherwise enter the wave loop.
</code_context>

<deferred>
## Deferred Ideas

- **Contract update needed:** The `cross-wave-handoff` export in CONTRACT.json should be reconsidered or removed during plan-set, since the user decided to skip handoff entirely. Plan-set should flag this as a contract deviation and decide whether to update the contract or document the divergence.
- **UAT default wave size (5) in contract is vestigial:** Since UAT mode is unchanged, the "5" default documented in the contract description has no implementation target. Plan-set should either remove it from the contract or document it as reserved for future use.
- **Default wave size tuning:** Defaults (3 normal) were accepted without empirical data. A future set could re-tune based on real usage metrics; overridable via `--wave-size` so this change is non-breaking.
- **Cross-wave handoff as a future opt-in:** If regression issues surface in practice, a `--wave-handoff` flag could re-introduce handoff as opt-in. Out of scope for this set.

See DEFERRED.md for the structured decision log.
</deferred>
