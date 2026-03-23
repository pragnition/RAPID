# PLAN: dag-readdition -- Wave 2

## Objective

Wire DAG awareness into the status display and enhance the KnowledgeGraphPage with Everforest theme colors, a layout toggle, a click-for-details panel, and React.lazy code splitting. Also remove the dead `GraphPage.tsx` stub.

## Tasks

### Task 1: Update status SKILL.md for DAG-ordered display

**File:** `skills/status/SKILL.md` (MODIFY)

**Action:** Add DAG-ordered set grouping to the status dashboard. The current skill lists sets in "canonical order" (Step 3, item 1). Modify Step 2 and Step 3 to attempt DAG loading and display sets grouped by wave when DAG.json exists.

**Changes to Step 2 (Load Dashboard Data):**

After loading STATE_JSON successfully, add a new block to load DAG data:

```markdown
Also attempt to load DAG.json for wave-ordered display:

\`\`\`bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
DAG_JSON=$(node "${RAPID_TOOLS}" dag show 2>/dev/null)
DAG_EXIT=$?
echo "DAG_EXIT=$DAG_EXIT"
if [ $DAG_EXIT -eq 0 ]; then
  echo "$DAG_JSON"
fi
\`\`\`

If `DAG_EXIT` is 0, the DAG was loaded successfully. Parse the output to determine wave groupings for display ordering. If `DAG_EXIT` is non-zero, fall back to canonical insertion order from STATE.json (the existing behavior).
```

**Changes to Step 3 (Display Dashboard):**

Replace the current item 1 ("Do NOT list the sets based on alphabetical order. List the set in their canonical order.") with:

```markdown
1. **Set ordering:** If DAG.json was loaded successfully in Step 2:
   - Group sets under wave headers: `**Wave 1:**`, `**Wave 2:**`, etc.
   - Within each wave, list sets in the order they appear in the DAG
   - The table format remains the same but rows are grouped under wave headers:

   ```
   **Wave 1:**
   | # | Set | Status | Last Activity | Branch |
   |---|-----|--------|---------------|--------|
   | 1 | foundation | merged | 2d ago: "final" | rapid/foundation |
   | 2 | core-lib | complete | 1d ago: "tests" | rapid/core-lib |

   **Wave 2:**
   | # | Set | Status | Last Activity | Branch |
   |---|-----|--------|---------------|--------|
   | 3 | api-layer | executing | 2h ago: "endpoints" | rapid/api-layer |
   | 4 | ui-shell | planned | no branch | -- |
   ```

   If DAG.json was NOT loaded (DAG_EXIT non-zero or DAG not available), fall back to canonical insertion order from STATE.json (NOT alphabetical). Use a single table without wave headers -- this is the existing behavior.
```

**What NOT to do:**
- Do NOT restructure the rest of the SKILL.md file
- Do NOT change the table columns or the next-action logic in Step 4
- Do NOT make DAG a hard requirement -- the fallback to canonical order must always work

**Verification:**
```bash
# Read the modified SKILL.md and verify it contains "Wave" grouping instructions
grep -c "Wave" skills/status/SKILL.md
# Should be > 0
```

### Task 2: Update KnowledgeGraphPage with Everforest theme colors

**File:** `web/frontend/src/pages/KnowledgeGraphPage.tsx` (MODIFY)

**Action:** Replace the hardcoded hex color values in `NODE_COLORS` with Everforest theme CSS custom properties read at runtime via `getComputedStyle`. This makes the graph adapt to theme changes.

**Changes:**

1. Remove the static `NODE_COLORS` object (lines 17-24) and `DEFAULT_NODE_COLOR` constant (line 26).

2. Add a function that reads CSS custom properties at render time:
   ```typescript
   function getNodeColor(status: string): string {
     const root = document.documentElement;
     const style = getComputedStyle(root);
     const themeColors: Record<string, string> = {
       pending: style.getPropertyValue('--th-muted').trim() || '#859289',
       discussed: style.getPropertyValue('--th-warning').trim() || '#DBBC7F',
       planned: style.getPropertyValue('--th-info').trim() || '#7FBBB3',
       executing: style.getPropertyValue('--th-orange').trim() || '#E69875',
       executed: style.getPropertyValue('--th-orange').trim() || '#E69875',
       complete: style.getPropertyValue('--th-accent').trim() || '#A7C080',
       merged: style.getPropertyValue('--th-muted').trim() || '#859289',
     };
     return themeColors[status] || style.getPropertyValue('--th-muted').trim() || '#859289';
   }
   ```

3. Update the cytoscape node style to use `getNodeColor` instead of the static lookup:
   - In the `"background-color"` mapper: change `NODE_COLORS[status] ?? DEFAULT_NODE_COLOR` to `getNodeColor(status)`
   - In the `"border-color"` mapper: change `darken(NODE_COLORS[status] ?? DEFAULT_NODE_COLOR)` to `darken(getNodeColor(status))`

**Important:** Check that the CSS custom properties `--th-muted`, `--th-warning`, `--th-info`, `--th-orange`, `--th-accent` actually exist in the project's theme CSS. If they use different names, use the actual property names. Search `web/frontend/src` for `--th-` to find the actual variable names. The fallback hex values ensure the graph works even if CSS vars are missing.

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20
# Should have no type errors in KnowledgeGraphPage.tsx
```

### Task 3: Add layout toggle to KnowledgeGraphPage

**File:** `web/frontend/src/pages/KnowledgeGraphPage.tsx` (MODIFY -- same file as Task 2, different section)

**Action:** Add a layout toggle button to switch between dagre top-down (TB) and breadthfirst left-right (LR) layouts.

**Changes:**

1. Add a `useState` for layout direction:
   ```typescript
   const [layoutDir, setLayoutDir] = useState<'TB' | 'LR'>('TB');
   ```

2. Add a `toggleLayout` callback that re-runs the layout:
   ```typescript
   const toggleLayout = useCallback(() => {
     setLayoutDir(prev => {
       const next = prev === 'TB' ? 'LR' : 'TB';
       if (cyRef.current) {
         cyRef.current.layout({
           name: next === 'TB' ? 'dagre' : 'breadthfirst',
           ...(next === 'TB'
             ? { rankDir: 'TB', nodeSep: 60, rankSep: 80, padding: 30 }
             : { directed: true, padding: 30, spacingFactor: 1.5 }),
           animate: true,
           animationDuration: 300,
         } as cytoscape.LayoutOptions).run();
       }
       return next;
     });
   }, []);
   ```

3. Update `GraphControls` to accept and render the toggle:
   - Add props: `layoutDir: 'TB' | 'LR'` and `onToggleLayout: () => void`
   - Add a button between Fit and Reset: `{layoutDir === 'TB' ? 'Horizontal' : 'Vertical'}` that calls `onToggleLayout`

4. Pass the new props to `<GraphControls>` in the render.

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20
```

### Task 4: Add click-for-details panel to KnowledgeGraphPage

**File:** `web/frontend/src/pages/KnowledgeGraphPage.tsx` (MODIFY -- same file)

**Action:** When a node is clicked, show a details panel/sidebar with set name, status, wave number, and dependency info.

**Changes:**

1. Add state for selected node details:
   ```typescript
   const [selectedNode, setSelectedNode] = useState<{
     id: string;
     status: string;
     wave: number;
     deps: string[];
   } | null>(null);
   ```

2. Update the `cy.on("tap", "node", ...)` handler to populate `selectedNode`:
   - Extract `id`, `status`, `wave` from `node.data()`
   - Compute `deps` from incoming edges: `node.incomers('edge').map(e => e.data('source'))`
   - Call `setSelectedNode({ id, status, wave, deps })`

3. Update the background click handler to clear: `setSelectedNode(null)`

4. Add a details panel component rendered conditionally when `selectedNode` is not null:
   ```tsx
   {selectedNode && (
     <div className="absolute bottom-3 left-3 z-10 bg-surface-1 border border-border rounded-lg p-4 min-w-[200px] shadow-lg">
       <h3 className="text-sm font-bold text-fg mb-2">{selectedNode.id}</h3>
       <dl className="text-xs text-muted space-y-1">
         <div><dt className="inline font-medium">Status:</dt> <dd className="inline">{selectedNode.status}</dd></div>
         <div><dt className="inline font-medium">Wave:</dt> <dd className="inline">{selectedNode.wave}</dd></div>
         {selectedNode.deps.length > 0 && (
           <div><dt className="inline font-medium">Depends on:</dt> <dd className="inline">{selectedNode.deps.join(', ')}</dd></div>
         )}
       </dl>
     </div>
   )}
   ```

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20
```

### Task 5: Add React.lazy code splitting for KnowledgeGraphPage

**File:** `web/frontend/src/router.tsx` (MODIFY)

**Action:** Replace the direct import of `KnowledgeGraphPage` with a `React.lazy` dynamic import wrapped in `Suspense`.

**Changes:**

1. Remove the direct import: `import { KnowledgeGraphPage } from "@/pages/KnowledgeGraphPage";`

2. Add lazy import:
   ```typescript
   import { lazy, Suspense } from "react";
   const LazyKnowledgeGraphPage = lazy(() =>
     import("@/pages/KnowledgeGraphPage").then(m => ({ default: m.KnowledgeGraphPage }))
   );
   ```

3. Update the route element:
   ```typescript
   { path: "graph", element: <Suspense fallback={<div className="p-6 animate-pulse">Loading graph...</div>}><LazyKnowledgeGraphPage /></Suspense> },
   ```

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20
```

### Task 6: Delete dead GraphPage.tsx stub

**File:** `web/frontend/src/pages/GraphPage.tsx` (DELETE)

**Action:** Delete the file. It is dead code -- never imported by the router (which uses `KnowledgeGraphPage` instead). Verify no other file imports it.

**Pre-check:**
```bash
grep -r "GraphPage" ~/Projects/RAPID/web/frontend/src/ --include="*.tsx" --include="*.ts" | grep -v "KnowledgeGraphPage" | grep -v "GraphPage.tsx"
# Should return nothing (no other file imports GraphPage)
```

**Action:** `rm web/frontend/src/pages/GraphPage.tsx`

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20
# Should compile cleanly without GraphPage.tsx
```

## Success Criteria

- `/status` skill displays sets grouped by DAG wave headers when DAG.json exists
- `/status` skill falls back to canonical order when DAG.json is absent
- KnowledgeGraphPage uses Everforest theme CSS custom properties for node colors
- KnowledgeGraphPage has a layout toggle button switching between top-down dagre and left-right breadthfirst
- KnowledgeGraphPage shows a details panel when a node is clicked (name, status, wave, dependencies)
- KnowledgeGraphPage is lazy-loaded via React.lazy (cytoscape bundle only loads on navigation to /graph)
- Dead `GraphPage.tsx` stub is removed
- `npx tsc --noEmit` passes in the frontend directory

## Files Modified

| File | Action |
|------|--------|
| `skills/status/SKILL.md` | MODIFY (DAG-ordered display) |
| `web/frontend/src/pages/KnowledgeGraphPage.tsx` | MODIFY (Everforest colors, layout toggle, details panel) |
| `web/frontend/src/router.tsx` | MODIFY (React.lazy code splitting) |
| `web/frontend/src/pages/GraphPage.tsx` | DELETE (dead code) |
