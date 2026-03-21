# VERIFICATION-REPORT: web-install-bugfix

**Set:** web-install-bugfix
**Waves:** wave-1-PLAN.md, wave-2-PLAN.md
**Verified:** 2026-03-21
**Verdict:** PASS

## Coverage

| Requirement | Covered By | Status | Notes |
|-------------|------------|--------|-------|
| Alembic path resolution fallback | Wave 1 Task 1 | PASS | Adds __file__-based + cwd-based fallback with logging, matches CONTEXT.md decision exactly |
| Systemd service file template with __RAPID_ROOT__ placeholders | Wave 1 Task 2 | PASS | Replaces hardcoded %h path with template; adds WorkingDirectory per CONTEXT.md |
| TypeScript error in useKanban.ts (context type) | Wave 1 Task 3 | PASS | Adds 4th generic type parameter to useMutation; correct fix per CONTEXT.md |
| TypeScript error in KnowledgeGraphPage.tsx (string | undefined) | Wave 1 Task 4 | PASS | Changes to `as const satisfies`; NODE_COLORS.pending becomes definite string literal |
| Keep `tsc -b && vite build` as build script | Wave 1 Tasks 3+4 | PASS | No changes to package.json build script; TS errors fixed properly instead |
| Frontend build step in setup.sh | Wave 2 Task 1 (Step 7) | PASS | Adds `npm install && npm run build` step |
| Backend venv setup with editable install | Wave 2 Task 1 (Step 6) | PASS | Uses `uv venv .venv && uv pip install -e .` per CONTEXT.md |
| Service file generation at install time (sed replacement) | Wave 2 Task 1 (Step 8) | PASS | Generates rapid-web.generated.service from template |
| npm as hard prerequisite | Wave 2 Task 1 (Step 1) | PASS | npm check with exit 1 in prerequisites |
| uv as soft/optional check | Wave 2 Task 1 (Step 1) | PASS | Info message only, no exit |
| Do NOT auto-install or auto-enable systemd service | Wave 2 Task 1 (Step 8) | PASS | Generates file and prints manual instructions only |
| pyproject.toml package discovery fix | N/A (already applied) | PASS | Correctly excluded from plans; partial fix already in working tree |
| main.py static serving + SPA fallback | N/A (already applied) | PASS | Correctly excluded from plans; partial fix already in working tree |
| End-to-end verification | Wave 2 Task 2 | PASS | Verification-only task covers all success criteria |

## Implementability

| File | Wave/Task | Action | Status | Notes |
|------|-----------|--------|--------|-------|
| `web/backend/app/database.py` | W1 T1 | Modify | PASS | Exists on disk; line references verified (lines 145-153 match `run_migrations`) |
| `web/backend/service/rapid-web.service` | W1 T2 | Modify | PASS | Exists on disk; current content matches plan description (ExecStart=%h/...) |
| `web/frontend/src/hooks/useKanban.ts` | W1 T3 | Modify | PASS | Exists on disk; lines 124-128 match the useMutation generic params in plan |
| `web/frontend/src/pages/KnowledgeGraphPage.tsx` | W1 T4 | Modify | PASS | Exists on disk; lines 17-24 match NODE_COLORS declaration in plan |
| `setup.sh` | W2 T1 | Modify | PASS | Exists on disk; current 5-step structure matches plan description |

Additional verifications:
- `import logging` not present in database.py -- plan correctly instructs to add it
- `KanbanBoardResponse` type is imported in useKanban.ts (line 4) -- available for the 4th generic param
- `noUncheckedIndexedAccess: true` confirmed in `web/frontend/tsconfig.app.json` (line 12)
- Current TS errors (3 total) match exactly what the plan addresses
- `web/backend/service/` directory exists for the service file

## Consistency

| File | Claimed By | Status | Resolution |
|------|------------|--------|------------|
| `web/backend/app/database.py` | W1 T1 only | PASS | No conflict |
| `web/backend/service/rapid-web.service` | W1 T2 only | PASS | No conflict |
| `web/frontend/src/hooks/useKanban.ts` | W1 T3 only | PASS | No conflict |
| `web/frontend/src/pages/KnowledgeGraphPage.tsx` | W1 T4 only | PASS | No conflict |
| `setup.sh` | W2 T1 only | PASS | No conflict |

No file is claimed by more than one task. Each file has clear single ownership.

## Cross-Job Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Wave 2 depends on Wave 1 (TS fixes must be done before `npm run build` in setup.sh can succeed) | PASS | Correct wave ordering: Wave 1 fixes code, Wave 2 integrates into pipeline |
| Wave 2 Step 8 depends on Wave 1 Task 2 (service file template must exist before sed can generate output) | PASS | Correct wave ordering handles this |
| Wave 1 tasks are independent of each other | PASS | No intra-wave dependencies; all 4 tasks modify separate files |
| Wave 2 Task 2 (verification) depends on Wave 2 Task 1 (setup.sh changes) | PASS | Sequential execution within wave handles this |

## Edits Made

| File | Change | Reason |
|------|--------|--------|
| (none) | -- | No auto-fixes needed |

## Summary

All wave plans pass verification across all three dimensions. Coverage is complete: every requirement from the CONTEXT.md decisions and DEFINITION.md scope is addressed by exactly one task, and the two already-applied fixes (pyproject.toml, main.py) are correctly excluded. Implementability is confirmed: all five files to modify exist on disk, line references match the actual code, and the TypeScript errors (3 total) match exactly what the plans address. Consistency shows zero conflicts: each file has single-task ownership and no cross-task file collisions. The wave ordering is correct, with Wave 1 fixing individual code bugs and Wave 2 integrating them into the install pipeline.
