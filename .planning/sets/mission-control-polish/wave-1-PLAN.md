# Wave 1: Backend Fix + Shared Theme Module

## Objective

Fix the broken Set DAG endpoint (Pydantic validation error on extra fields, missing status sync from STATE.json) and create the shared CodeMirror syntax highlight theme module. These are foundation pieces -- the frontend graph and editor improvements in Wave 2 depend on a working DAG endpoint and an importable highlight theme.

## Tasks

### Task 1: Fix DagNode Pydantic model to tolerate extra fields

**File:** `web/backend/app/schemas/views.py`

**Action:** Add `model_config = {"extra": "ignore"}` to the `DagNode` class. This makes Pydantic v2 silently drop extra fields (type, group, priority, description) that DAG.json nodes contain but the model does not declare.

**Implementation:**
- Add `model_config = {"extra": "ignore"}` as a class attribute on `DagNode` (line 61-64), matching the pattern already used in `web/backend/app/config.py:9`.

**What NOT to do:**
- Do NOT add the extra fields as Optional attributes on DagNode -- they are not needed by the frontend and would bloat the API response.
- Do NOT apply model_config to DagEdge, DagWave, or DagGraph -- only DagNode receives extra fields from DAG.json.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "
from app.schemas.views import DagNode
n = DagNode(id='test', wave=1, status='pending', type='set', group=None, priority=None, description=None)
assert n.id == 'test'
assert n.wave == 1
print('DagNode extra-field tolerance: OK')
"
```

### Task 2: Merge authoritative set statuses from STATE.json into DAG response

**File:** `web/backend/app/services/dag_service.py`

**Action:** After reading DAG.json, also read STATE.json and overwrite each node's `status` field with the authoritative status from STATE.json. This ensures the DAG visualization shows current set statuses, not stale values from the static DAG.json file.

**Implementation:**
- After the existing DAG.json read (line 16-20), read STATE.json at `project_path / ".planning" / "STATE.json"`.
- Parse it and build a dict mapping set_id -> status from the current milestone's sets.
- Iterate over `data.get("nodes", [])` and overwrite each node's `"status"` key if the set_id exists in the status map.
- Use try/except around STATE.json reading so it gracefully falls back to DAG.json statuses if STATE.json is missing.
- Reference `state_service.py` for the STATE.json structure: `data["milestones"][*]["sets"][*]` has `id` and `status` fields, and `data["currentMilestone"]` identifies which milestone to use.

**What NOT to do:**
- Do NOT import or call state_service functions -- read STATE.json directly in dag_service to keep the dependency graph simple.
- Do NOT modify the DAG.json file on disk -- only overwrite statuses in memory before returning.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/backend && uv run python -c "
from pathlib import Path
from app.services.dag_service import get_dag_graph
# Use RAPID's own .planning as test data
result = get_dag_graph(Path('/home/kek/Projects/RAPID'))
if result:
    print(f'Nodes: {len(result[\"nodes\"])}')
    for n in result['nodes'][:3]:
        print(f'  {n[\"id\"]}: status={n[\"status\"]}')
    print('DAG service with status sync: OK')
else:
    print('No DAG.json found (expected in test env)')
"
```

### Task 3: Install new frontend dependencies

**File:** `web/frontend/package.json`

**Action:** Add four packages needed for the CodeMirror syntax highlight theme and expanded language support.

**Packages to add to `dependencies`:**
- `@lezer/highlight` -- direct import for highlight tag definitions
- `@codemirror/lang-json` -- JSON syntax highlighting (not currently a transitive dep)
- `@codemirror/lang-css` -- CSS syntax highlighting (currently transitive, make direct)
- `@codemirror/lang-html` -- HTML syntax highlighting (currently transitive, make direct)

**Implementation:**
- Run `npm install --save @lezer/highlight @codemirror/lang-json @codemirror/lang-css @codemirror/lang-html` from `web/frontend/`.

**What NOT to do:**
- Do NOT pin exact versions -- use caret ranges to match the existing package.json style.
- Do NOT update any existing packages.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/frontend && node -e "
  const pkg = require('./package.json');
  const deps = ['@lezer/highlight', '@codemirror/lang-json', '@codemirror/lang-css', '@codemirror/lang-html'];
  for (const d of deps) {
    if (!pkg.dependencies[d]) { console.error('MISSING:', d); process.exit(1); }
    console.log('OK:', d, pkg.dependencies[d]);
  }
"
```

### Task 4: Create shared CodeMirror highlight theme module

**File:** `web/frontend/src/lib/codemirrorTheme.ts` (CREATE)

**Action:** Create a shared module that exports a custom CodeMirror HighlightStyle mapped to theme CSS variables. This module will be consumed by FileViewerPanel (wired in Wave 2) and can later be used by CodeMirrorEditor.

**Implementation:**
- Import `HighlightStyle, syntaxHighlighting` from `@codemirror/language`.
- Import `tags` from `@lezer/highlight`.
- Define and export `themeHighlightStyle` using `HighlightStyle.define([...])` with ~15 token type specs.
- Export `themeHighlighting` as `syntaxHighlighting(themeHighlightStyle)` (the extension consumers will use).

**Tag-to-CSS-variable mapping (use `var(--th-*)` values -- browser resolves at render time):**

| Tag(s) | CSS Variable | Purpose |
|---------|-------------|---------|
| `tags.keyword` | `var(--th-highlight)` | Keywords (function, const, let, class, import) |
| `tags.controlKeyword` | `var(--th-error)` | Control flow (if, else, for, while, return) |
| `tags.definitionKeyword` | `var(--th-highlight)` | Definition keywords (function, class, interface) |
| `tags.comment`, `tags.lineComment`, `tags.blockComment` | `var(--th-muted)`, fontStyle: `italic` | Comments |
| `tags.string`, `tags.special(tags.string)` | `var(--th-accent)` | Strings and template literals |
| `tags.number`, `tags.bool` | `var(--th-orange)` | Numeric and boolean literals |
| `tags.variableName` | `var(--th-fg)` | Variable names |
| `tags.definition(tags.variableName)` | `var(--th-fg)` | Variable definitions |
| `tags.typeName`, `tags.className` | `var(--th-warning)` | Type and class names |
| `tags.propertyName` | `var(--th-info)` | Property/field access |
| `tags.definition(tags.propertyName)` | `var(--th-info)` | Property definitions |
| `tags.operator` | `var(--th-fg-dim)` | Operators (+, -, =, =>) |
| `tags.punctuation` | `var(--th-muted)` | Brackets, braces, semicolons |
| `tags.meta` | `var(--th-fg-dim)` | Decorators, annotations |
| `tags.regexp` | `var(--th-orange)` | Regular expressions |
| `tags.null` | `var(--th-orange)` | null/undefined/nil |
| `tags.function(tags.variableName)` | `var(--th-link)` | Function names |

**Export structure:**
```typescript
// Named exports for maximum flexibility
export const themeHighlightStyle: HighlightStyle;  // The raw style (for inspection)
export const themeHighlighting: Extension;          // The extension to add to EditorState
```

**What NOT to do:**
- Do NOT include editor chrome styling (bg, gutter, cursor) -- that stays in each component's local `editorTheme`.
- Do NOT import or re-export from any component file.
- Do NOT use `defaultHighlightStyle` from `@codemirror/language` -- the whole point is to replace it.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit src/lib/codemirrorTheme.ts 2>&1 | head -20
```

## Success Criteria

1. `DagNode(**{"id": "x", "wave": 1, "status": "pending", "type": "set", "group": null})` succeeds without error.
2. `get_dag_graph()` returns nodes with statuses matching STATE.json (when available).
3. All four new npm packages are in `package.json` and installed.
4. `src/lib/codemirrorTheme.ts` exports `themeHighlightStyle` and `themeHighlighting` and type-checks cleanly.

## File Ownership

| File | Action |
|------|--------|
| `web/backend/app/schemas/views.py` | MODIFY |
| `web/backend/app/services/dag_service.py` | MODIFY |
| `web/frontend/package.json` | MODIFY |
| `web/frontend/src/lib/codemirrorTheme.ts` | CREATE |
