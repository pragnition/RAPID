# SET-OVERVIEW: fixes-and-housekeeping

## Approach

This set addresses five independent, low-risk items that collectively improve correctness and maintainability: three bugs, one pre-existing test failure, and stale planning context files. None of these tasks share code paths, so they can be sequenced freely within a single wave or split across two short waves if isolation is preferred.

The version display bug is the most structurally interesting task. Three locations (Sidebar.tsx, `__init__.py`, pyproject.toml) currently hardcode `v4.2.1` while the actual project version is `6.2.0` in package.json. The fix should establish package.json (via `src/lib/version.cjs:getVersion()`) as the single source of truth, with the frontend reading from the backend health endpoint and the backend reading from pyproject.toml. This avoids the need to update multiple files on every release.

The remaining tasks are straightforward: add a `keydown` handler branch for Ctrl+Enter/Cmd+Enter in CardDetailModal, remove the `break` on line 85 of the install SKILL.md shell config detection loop, fix two stale `'executing'` string literals in `review.test.cjs` and `dag.cjs`, and regenerate the four `.planning/context/` files.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| web/frontend/src/components/layout/Sidebar.tsx | Version display in sidebar (hardcoded v4.2.1) | Existing -- modify |
| web/frontend/src/components/kanban/CardDetailModal.tsx | Kanban card detail modal (add Ctrl+Enter save) | Existing -- modify |
| web/backend/app/__init__.py | Backend `__version__` (hardcoded 4.2.1) | Existing -- modify |
| web/backend/pyproject.toml | Backend package version (hardcoded 4.2.1) | Existing -- modify |
| skills/install/SKILL.md | Install skill shell config detection loop | Existing -- modify |
| src/commands/review.test.cjs | Test file with stale `'executing'` set status literal | Existing -- modify |
| src/commands/dag.cjs | DAG display with stale `'executing'` color key | Existing -- modify |
| src/lib/version.cjs | Existing version utility (`getVersion()` reads package.json) | Existing -- reference |
| .planning/context/*.md | CODEBASE, ARCHITECTURE, CONVENTIONS, STYLE_GUIDE | Existing -- regenerate |

## Integration Points

- **Exports:**
  - `version-mechanism`: Single-source-of-truth version derivation -- frontend sidebar and backend health endpoint both derive version from one authoritative source (package.json via `getVersion()`)
  - `kanban-save-shortcut`: CardDetailModal handles Ctrl+Enter (Windows/Linux) and Cmd+Enter (macOS) as save-and-close
  - `shell-config-multiupdate`: Install skill shell config detection loop updates ALL matching config files instead of breaking on first match
- **Imports:** None -- this set is fully independent with no cross-set dependencies
- **Side Effects:** The status-rename test suite will go from 1 failure to 0 failures, unblocking CI for all sets

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Version derivation chain (package.json -> pyproject.toml -> backend -> frontend) may break if backend API is unreachable | Medium | Frontend can fall back to a static build-time version injected via Vite define/env |
| Removing `break` in install SKILL.md may cause duplicate writes if user has overlapping config files | Low | The install skill already uses AskUserQuestion to confirm the target file; removing break only affects the detection echo, not the write step |
| Regenerated context files may drift from actual codebase if run before other sets merge | Low | Context regeneration should be the last task executed, or re-run after final merge |

## Wave Breakdown (Preliminary)

- **Wave 1:** All five tasks in parallel (they touch disjoint files and have no ordering dependencies)
  - Task A: Fix version display -- update 3 hardcoded locations, wire single-source-of-truth
  - Task B: Add Ctrl+Enter / Cmd+Enter save shortcut to CardDetailModal
  - Task C: Remove `break` in install SKILL.md shell config detection loop
  - Task D: Fix stale `'executing'` literals in review.test.cjs and dag.cjs
  - Task E: Regenerate .planning/context/ files

Note: This is a preliminary breakdown. If the version single-source-of-truth requires backend API changes, it may warrant splitting into Wave 1 (backend) and Wave 2 (frontend). Detailed wave/job planning happens during /discuss and /plan.
