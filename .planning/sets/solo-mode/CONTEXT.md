# CONTEXT: solo-mode

**Set:** solo-mode
**Generated:** 2026-03-19
**Mode:** interactive

<domain>
## Set Boundary
Complete the solo mode lifecycle so solo sets work seamlessly on main without merge ceremony. Solo mode infrastructure (registration, detection, diff-base resolution) already exists in `src/lib/worktree.cjs`. The merge and review skills already contain partial solo-aware documentation. This set closes the lifecycle gap: auto-transition `complete -> merged` after solo execution, update merge skill to gracefully skip solo sets, update review skill to accept solo+merged sets in post-merge mode, and ensure status display correctness.

Depends on `dag-and-state-fixes` (already merged) for reliable state transitions.
</domain>

<decisions>
## Implementation Decisions

### Auto-merge Trigger Point

- **Location:** Inline in execute-set SKILL.md Step 6, directly after the `complete` transition. Add a solo check (`isSoloMode()` from worktree.cjs) and immediately transition to `merged` if true. Keeps the lifecycle visible in one place.
- **Artifacts:** State-only transition. No marker files or merge artifacts -- solo sets have no branch to merge, so no merge artifacts make sense. Just transition STATE.json from `complete` to `merged`.

### Merge Skill Behavior

- **UX:** Informational message when a user runs `/rapid:merge` on a solo set: "Set {id} is a solo set -- already merged automatically after execution. No merge needed." Then suggest `/rapid:review`.
- **Detection:** Both plan-time (Step 1d, annotate solo sets in merge plan display) AND merge-time (Step 3a, skip with informational message). Already partially implemented in current SKILL.md -- formalize both paths.

### Review Skill Routing

- **Routing:** Auto-detect solo+merged sets. Check registry for `solo: true`. If solo+merged, automatically route to post-merge review mode without requiring `--post-merge` flag. No user friction.
- **Diff base:** Automatic. Use `startCommit` from the registry silently as the diff base. The review skill already documents this behavior for solo sets.

### State Transition Safety

- **Retry:** Yes, reuse the same 3-attempt retry pattern from Step 6's `complete` transition. Guards against lock contention from concurrent operations.
- **Failure mode:** Warn but succeed. Log a warning that the auto-merge transition failed, but the set is still `complete`. User can manually transition or re-run. All executed work is preserved.
</decisions>

<specifics>
## Specific Ideas
- The `isSoloMode()` function in `worktree.cjs` is the single guard for all solo-specific behavior
- `detectSoloAndSkip()` in merge skill returns `{ isSolo: boolean, message: string }` per CONTRACT.json
- `adjustReviewForSolo()` in review skill returns `{ postMerge: boolean }` per CONTRACT.json
- `autoMergeSolo()` logic lives inline in execute-set Step 6 (not a separate function) -- just a conditional state transition
</specifics>

<code_context>
## Existing Code Insights

- `src/lib/worktree.cjs` already exports `isSoloMode(cwd, setId)` and `getSetDiffBase(cwd, setId)` -- these are the building blocks
- `setInitSolo()` registers with `solo: true` and `startCommit` in REGISTRY.json
- `formatStatusTable()` (line 589) already annotates solo entries with `(solo)` suffix
- `formatMarkIIStatus()` (line 871) already shows `(solo)` for worktree path column
- Execute-set SKILL.md Step 6 has existing retry logic for the `complete` transition (3 attempts, 2s pause)
- Merge SKILL.md Step 1d already detects solo sets from registry; Step 3a-solo already has the fast-path structure
- Review SKILL.md already documents solo set scoping with `startCommit` diff base (line 156-166)
- STATE.json set transitions: `pending -> discussed -> planned -> executed -> complete -> merged`
</code_context>

<deferred>
## Deferred Ideas
- Solo mode for parallel sets (currently solo only works for sequential/single sets)
- Auto-cleanup of solo registry entries after merge
- Solo mode with named branches (solo but on a dedicated branch, not main)
</deferred>
