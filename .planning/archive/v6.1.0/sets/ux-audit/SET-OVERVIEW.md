# SET-OVERVIEW: ux-audit

## Approach

This set performs a bounded, checklist-driven UX audit of the RAPID CLI, targeting four pillars: breadcrumb consistency in error messages, command discoverability, first-run experience, and auto-regroup wiring. The audit is systematic, not exploratory -- a concrete checklist with pass/fail criteria is defined before any code changes begin.

The core implementation work involves two tracks. First, standardizing the error message pattern across the ~277 throw sites in `src/` so that errors consistently convey what has been done, what is missing, and what the user should run next (the "breadcrumb" pattern already established by `renderFooter()` in `display.cjs`). Second, wiring `partitionIntoGroups()` from `src/lib/group.cjs` into the `recalculateDAG()` flow in `src/lib/add-set.cjs`, so that adding a set automatically regroups the DAG -- a deferred item from v6.0.0.

The set produces a structured UX audit report at `.planning/v6.1.0-UX-AUDIT.md` documenting all findings, fixes applied, and any items deferred to future milestones.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/bin/rapid-tools.cjs` | CLI entry point -- USAGE string, command routing | Existing (modify) |
| `src/lib/dag.cjs` | DAG operations (toposort, wave assignment) | Existing (read-only reference) |
| `src/lib/add-set.cjs` | `addSetToMilestone()` / `recalculateDAG()` -- wire auto-regroup here | Existing (modify) |
| `src/lib/group.cjs` | `partitionIntoGroups()` -- already implemented, needs wiring | Existing (read-only reference) |
| `src/lib/errors.cjs` | `CliError` / `exitWithError` -- error output utilities | Existing (may modify) |
| `src/lib/display.cjs` | `renderFooter()` -- breadcrumb/footer pattern (from clear-guidance-and-display) | Existing (read-only, consumed) |
| `tests/ux-audit.test.cjs` | New test file for UX audit verifications | New |
| `.planning/v6.1.0-UX-AUDIT.md` | Structured audit report artifact | New |

## Integration Points

- **Exports:**
  - `uxAuditReport` -- structured UX audit report at `.planning/v6.1.0-UX-AUDIT.md` documenting findings, fixes, and deferred items
  - `autoRegroupWiring` -- `partitionIntoGroups()` called after `recalculateDAG()` in the add-set state flow, so DAG groups stay current when sets are added

- **Imports:**
  - `clearPattern` (from `clear-guidance-and-display`) -- `renderFooter(nextCommand, options)` must exist to verify UX consistency across skills; this set is already merged
  - `remediationFlow` (from `audit-handoff`) -- `readRemediationArtifact(setName)` must exist to audit the audit-to-set handoff UX; this set is currently pending

- **Side Effects:**
  - Error messages across CLI commands may change wording (breadcrumb standardization)
  - `add-set` will now produce regrouped DAG output where previously it did not

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| audit-handoff set not yet complete -- cannot audit remediation UX | Medium | Audit what is auditable now; document remediation UX audit as a deferred checklist item in the report |
| Breadcrumb standardization across 277 throw sites is large scope | High | Bound the audit: identify the highest-impact error paths (state transitions, worktree ops, set-init) rather than attempting all 277 sites |
| Auto-regroup wiring needs team-size parameter not currently available in add-set flow | Medium | Default to reading existing DAG group count or falling back to a sensible default (e.g., 2); document the decision |
| Changing error messages could break snapshot tests or agent prompt expectations | Low | Run full test suite after each batch of changes; avoid changing structured output (JSON), only human-readable messages |

## Wave Breakdown (Preliminary)

- **Wave 1:** Define UX audit checklist with pass/fail criteria; audit current state of breadcrumbs, discoverability, and first-run experience; document findings
- **Wave 2:** Wire `partitionIntoGroups()` into `recalculateDAG()` in `add-set.cjs`; standardize breadcrumb format on highest-impact error paths; add tests
- **Wave 3:** Improve command discoverability (USAGE string, help output); produce final `.planning/v6.1.0-UX-AUDIT.md` report with findings, fixes, and deferred items

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
