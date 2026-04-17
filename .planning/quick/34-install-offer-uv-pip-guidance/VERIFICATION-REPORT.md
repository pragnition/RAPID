# VERIFICATION-REPORT: quick task 34 -- install uv/pip guidance

**Task:** 34-install-offer-uv-pip-guidance
**Plan:** `/home/kek/Projects/RAPID/.planning/quick/34-install-offer-uv-pip-guidance/34-PLAN.md`
**Verified:** 2026-04-17
**Verdict:** PASS_WITH_GAPS

## Coverage

| Requirement | Covered By | Status | Notes |
|-------------|------------|--------|-------|
| Detect missing `uv` early in install flow | Task 2 (skill pre-flight) + Task 1 (setup.sh env-aware detection) | PASS | Two-layer detection: interactive in skill, env-driven in setup.sh. |
| Offer automated Astral installer when `uv` missing | Task 1 (auto branch) + Task 2 (AskUserQuestion "Yes, auto-install uv") | PASS | Astral URL `https://astral.sh/uv/install.sh` matches canonical source. |
| Fallback to manual install instructions on decline / failure | Task 1 (WARNING with manual URL on failure) + Task 2 ("Show manual install instructions" branch with brew/curl/pipx/powershell) | PASS | Covers macOS, Linux, Windows, pipx. |
| Preserve non-interactive contract of `setup.sh` | Task 1 (env var `RAPID_INSTALL_UV`, not a prompt) | PASS | Explicit "What NOT to do" rule reinforces this. |
| Backwards compatibility when `setup.sh` is run standalone | Task 1 (unset / other `RAPID_INSTALL_UV` value falls back to current INFO behavior) | PASS | Byte-identical `uv` line when uv present and env var unset, per done criteria. |
| Surface uv status in `prereqs` output | Task 3 (add uv as optional tool in probe list) | PASS | Matches `jq` tier (optional, `hasWarnings` only). |
| Non-required / non-blocking contract for solo users | Task 3 done criterion "must not flip hasBlockers" + "What NOT to do" rule | PASS | Solo-mode users without web backend remain unblocked. |
| Mission Control / Step 4.5 interplay | Explicitly noted in "What NOT to do" (do not alter Step 4.5) and implicit in Step 0.5 ordering (uv is resolved before Step 4.5 runs) | PASS | Step 0.5 runs before Step 4.5 so Mission Control benefits automatically. |
| Unit test coverage for prereqs change | Task 3 done criterion "add or extend a unit test" | PASS_WITH_GAPS | Test location hint (`grep -r "prereqs" test/ spec/ __tests__/`) won't find the file -- actual tests live at `src/lib/prereqs.test.cjs`. See Implementability. |

## Implementability

| File | Task | Action | Status | Notes |
|------|------|--------|--------|-------|
| `/home/kek/Projects/RAPID/setup.sh` | Task 1 | Modify | PASS | Exists. Line 34-55 (required tools), 57-62 (uv soft-detect), 130-145 (Step 6 backend) all match reality exactly. |
| `/home/kek/Projects/RAPID/skills/install/SKILL.md` | Task 2 | Modify | PASS | Exists. Step numbering (0, 1, 2, 3, 4, 4.5, 5, 6) matches plan's claim exactly -- inserting 0.5 between existing 0 (ends line 30) and 1 (starts line 32) is unambiguous. Step 4 call to `node "$RAPID_TOOLS" prereqs` confirmed at line 191. |
| `/home/kek/Projects/RAPID/src/commands/prereqs.cjs` | Task 3 | Modify | PASS_WITH_GAPS | Exists but is a thin dispatcher (29 lines). The actual prereqs probe list is in `src/lib/prereqs.cjs` (`validatePrereqs`, lines 95-135). Plan's wording "(or wherever the prereqs probe list is defined)" accommodates this, but the Task 3 "Files to modify" line should point to `src/lib/prereqs.cjs` as the primary edit target. Plan's note sufficient to avoid confusion. |
| `/home/kek/Projects/RAPID/src/lib/prereqs.cjs` | Task 3 (implied) | Modify | PASS | Exists. `validatePrereqs` checks list at lines 96-130 is the correct insertion point for a new `uv` entry. `formatPrereqSummary` already supports `hasWarnings` flag (lines 172-173), so Task 3's conditional sub-requirement resolves favourably. |
| `/home/kek/Projects/RAPID/src/lib/prereqs.test.cjs` | Task 3 (unit test) | Modify | PASS | Exists. Current `validatePrereqs` test block asserts `results.length === 3` (line 153) -- adding `uv` flips this to 4; the test update is straightforward but MUST happen or the existing test fails. Plan does not call this out explicitly. |
| `/home/kek/Projects/RAPID/web/backend/` (pyproject.toml, service file) | (context only) | Read | PASS | Exists, confirming that Step 6 backend setup in setup.sh is meaningful on this machine. |

## Consistency

| File | Claimed By | Status | Resolution |
|------|------------|--------|------------|
| `setup.sh` | Task 1 only | PASS | Single owner. |
| `skills/install/SKILL.md` | Task 2 only | PASS | Single owner. |
| `src/commands/prereqs.cjs` and/or `src/lib/prereqs.cjs` | Task 3 only | PASS | Single owner. The plan's "(or wherever the prereqs probe list is defined)" scoping keeps it clean. |
| `src/lib/prereqs.test.cjs` | Task 3 only (implied via "add or extend a unit test") | PASS | Single owner. |

No cross-task file overlap. Each task touches a distinct file set.

## Cross-Task Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Task 2 forwards `RAPID_INSTALL_UV` -> Task 1 reads `RAPID_INSTALL_UV` | PASS | Tasks can be implemented independently but are only functionally meaningful together. Task 1 standalone is benign (env var unset = existing behavior). Task 2 standalone would set an env var that setup.sh ignores -- harmless but wasted. Recommend executing Task 1 first, then Task 2. |
| Task 3 does not depend on Tasks 1 or 2 | PASS | Task 3 only adds a probe entry; no runtime coupling. |
| Task 1's `RAPID_INSTALL_UV=auto` path mutates PATH inside setup.sh | PASS_WITH_GAPS | The illustrative snippet does `export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"`. Context7 confirms current Astral installer drops `uv` into `~/.local/bin` (since uv v0.5, `~/.cargo/bin` is deprecated for new installs). Including both paths is a fine defensive fallback, but the plan should note that `~/.cargo/bin` is legacy. |

## Edits Made

| File | Change | Reason |
|------|--------|--------|

(no auto-fixes applied -- all issues are either informational or below auto-fix thresholds)

## Anti-Pattern Check

| Anti-Pattern | Status | Notes |
|--------------|--------|-------|
| No worktree | PASS | Quick tasks run on main branch in `/home/kek/Projects/RAPID` -- plan does not reference any worktree path or `git worktree` commands. |
| No set state | PASS | `.planning/quick/34-install-offer-uv-pip-guidance/` contains only `34-PLAN.md` -- no CONTEXT/WAVE/STATE files. Correct quick-task shape. |
| Single focused scope | PASS | All three tasks serve the same goal ("offer uv auto-install during /rapid:install"). Task 3 is a small adjacent quality-of-life addition (prereqs visibility), not scope creep -- it ties directly into the skill's existing Step 4 verification and reinforces the "uv is optional" contract. |
| Commit message convention | PASS_WITH_GAPS | Plan recommends `feat(quick-34): ...` but project convention is `quick(<slug>): ...` (see recent git history: `quick(collapsible-tool-calls-drawer): ...`, `quick(start-set-pending-dropdown-canonical-order): ...`). Recommend using `quick(install-offer-uv-pip-guidance): ...` per existing style. Cosmetic only -- not a blocker. |

## Done-Criteria Testability

| Task | All Done Criteria Testable? | Notes |
|------|----------------------------|-------|
| Task 1 | YES | `bash -n`, byte-diff on output, grep on INFO message, grep on WARNING message. The `RAPID_INSTALL_UV=auto` branch requires network -- document as such. |
| Task 2 | YES | All five done criteria are grep/structure checks on SKILL.md. |
| Task 3 | YES | All six done criteria are JSON-parse or grep checks on `prereqs --json` output plus an added unit test. |

## Verification-Command Sanity

| Command | Status | Notes |
|---------|--------|-------|
| Task 1 verification #2 (shadow uv with `/tmp/rapid-noop` and `source` setup.sh) | PASS_WITH_GAPS | `source`-ing `setup.sh` executes the entire install (npm install, .env writes, plugin registration, backend setup, frontend build). This is NOT a safe unit test for the uv code path -- it will mutate the developer's install. Recommend extracting the uv-check into a sub-shell function or testing via `bash setup.sh 2>&1 | head -20` with a PATH that excludes the real `uv` directory. Listed as "illustrative" in the plan, so informational only. |
| Task 1 verification #3 (run full setup.sh and grep for `OK: uv `) | PASS_WITH_GAPS | Same caveat -- executes full install. Useful as an integration smoke test, not as a fast unit check. |
| Task 3 verification #1 (`PATH="/tmp/no-uv:$PATH"` to hide uv) | FAIL | Prepending a non-existent directory to PATH does NOT hide `uv` if `uv` is already on a later PATH entry (e.g., `~/.local/bin` on this machine). To genuinely shadow `uv`, the verification must either (a) strip the `uv`-containing directory from PATH (`PATH=$(echo $PATH \| tr ':' '\n' \| grep -v "$HOME/.local/bin" \| paste -sd:)`) or (b) drop a no-op `uv` shim into `/tmp/rapid-noop/uv` at the front of PATH with the containing directory also stripped out. The executor should fix this verification step before relying on it. |
| Task 3 verification #2 (JSON parse of `--json` output) | PASS | Independent of PATH -- verifies the results array shape. Will fail until Task 3 is implemented, which is the whole point. |
| Task 3 verification #3 (table includes uv) | PASS | Same note as #2. |
| Task 3 unit-test search hint (`grep -r "prereqs" test/ spec/ __tests__/`) | FAIL | These directories do not exist in this project. Tests live at `src/lib/prereqs.test.cjs` and `src/commands/commands.test.cjs`. The executor should `grep -r "prereqs" src/` instead. Hint was wrong but the existence of `src/lib/prereqs.test.cjs` is easy to discover otherwise. |

## Research-Accuracy Check (Context7)

| Claim | Status | Notes |
|-------|--------|-------|
| Astral installer URL `https://astral.sh/uv/install.sh` | PASS | Canonical, confirmed via Context7 and current Astral docs. |
| Astral installer drops uv in `~/.local/bin` (primary) / `~/.cargo/bin` (legacy) | PASS | Context7 confirms: since uv v0.5, installer uses XDG (`~/.local/bin`), not `~/.cargo/bin`. Plan's defensive `export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"` covers both. |
| `uv venv` / `uv pip install` minimum version `0.4` | PASS_WITH_GAPS | Context7 shows `uv venv` was stabilized in v0.3.0 (Python auto-download), not v0.4. The plan's permissive-floor fallback (`"0.1"` if unsure) is safe. Recommend using `"0.3"` as a factual floor or `"0.4"` as a slightly-conservative floor; either works. |
| `uv --version` output format `uv <version>` | PASS | Confirmed locally: `uv 0.10.8`. Matches plan's `awk '{print $2}'` parser. |

## Summary

The plan is structurally sound, narrowly scoped to a single objective (offering uv auto-install during `/rapid:install`), and all file references + line numbers match the current codebase exactly. Coverage is complete across detection, offer, auto-install, skip, manual-fallback, and backwards compat. Consistency is clean -- no cross-task file conflicts.

Gaps are all minor and informational:

1. **Task 3 verification #1** (using `PATH="/tmp/no-uv:$PATH"` to hide uv) won't actually hide uv if it's on a later PATH entry -- the executor should strip the real uv directory from PATH instead.
2. **Task 3 test-location hint** (`grep -r "prereqs" test/ spec/ __tests__/`) points at non-existent directories; tests live at `src/lib/prereqs.test.cjs`.
3. **Task 3 Files-to-modify** points at `src/commands/prereqs.cjs` but the actual probe list lives in `src/lib/prereqs.cjs`. Plan's "(or wherever the prereqs probe list is defined)" wording handles this, but a precise pointer would be better.
4. **Task 3 hidden dependency** -- adding `uv` to `validatePrereqs` flips the existing test assertion `results.length === 3` at `src/lib/prereqs.test.cjs:153` to 4. Plan does not call this out; executor must update it or the test will fail.
5. **Commit-message format** recommendation (`feat(quick-34): ...`) doesn't match the project's established `quick(<slug>): ...` convention. Cosmetic only.
6. **Task 1 verification commands** source setup.sh in a way that runs the full install -- not safe as a fast unit check. Acknowledged as "illustrative" in the plan.
7. **minVersion `0.4`** for uv is slightly conservative (v0.3 stabilized `uv venv`), but the permissive-floor fallback guidance makes this a non-issue.

None of these gaps are blockers, all are easily fixed during implementation, and none require auto-fix edits to the plan. Recommending PASS_WITH_GAPS so the executor is aware of items 1-4 (the substantive ones) before running verification commands verbatim.
