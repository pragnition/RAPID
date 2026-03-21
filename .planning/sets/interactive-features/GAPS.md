# Gaps Report: interactive-features

## Gap 1: Pre-existing tests not updated for KanbanItem removal

**Severity:** MEDIUM
**Files affected:**
- `web/backend/tests/test_database.py` — imports removed `KanbanItem` model
- `web/backend/tests/test_sync_engine.py` — imports removed `KanbanItem` model
- `web/backend/tests/test_migrations.py` — assertions expect `kanbanitem` table (3 failures)

**Details:** The `KanbanItem` model was replaced by `KanbanColumn` + `KanbanCard` in Wave 1, but the pre-existing test files still reference the old model. 5 test failures out of 101 tests collected: 2 import errors + 3 assertion failures.

**Resolution:** Update test imports to use `KanbanColumn`/`KanbanCard`, update migration test assertions to expect `kanbancolumn`/`kanbancard` tables instead of `kanbanitem`.
