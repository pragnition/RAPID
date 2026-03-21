# Wave 2: Frontend Views + Navigation Wiring

## Objective

Build the four frontend page components (StateView, WorktreeView, KnowledgeGraph, CodebaseMap), wire them into the router, add sidebar navigation entries, and register keyboard shortcuts. After this wave, all four views are accessible and functional in the browser.

## Prerequisites

Wave 1 must be complete: all backend endpoints serving data, frontend types and hooks available, cytoscape + cytoscape-dagre installed.

---

## Task 1: StateView Page

**Files created:**
- `web/frontend/src/pages/StatePage.tsx`

**Action:**
Create the Project State view. This page shows milestones and their sets from STATE.json.

### Component Structure

```
StatePage
  - uses useProjectStore to get activeProjectId
  - uses useProjectState(activeProjectId) hook from Wave 1
  - loading/error/no-project states
  - renders:
    - Page header: "Project State" with project name subtitle
    - Summary cards row: total milestones count, total sets count, current milestone badge
    - Milestone list: each milestone is a collapsible card
      - Milestone header: id + name
      - Set grid inside: each set as a status-colored badge/pill
        - Status colors: pending=gray, discussed=yellow, planned=blue,
          executing=orange, complete=green, merged=dim/muted
```

### Styling rules
- Follow the exact Tailwind class patterns from `DashboardPage.tsx`:
  - Container: `div.p-6`
  - Heading: `h1.text-3xl.font-bold.text-fg.mb-2`
  - Cards: `div.bg-surface-1.border.border-border.rounded-lg.p-4`
  - Muted text: `text-muted`
  - Accent highlights: `text-accent`
- Status color mapping (use inline conditional classes):
  - `pending` -> `bg-gray-500/20 text-gray-400`
  - `discussed` -> `bg-yellow-500/20 text-yellow-400`
  - `planned` -> `bg-blue-500/20 text-blue-400`
  - `executing` -> `bg-orange-500/20 text-orange-400`
  - `complete` -> `bg-green-500/20 text-green-400`
  - `merged` -> `bg-gray-500/10 text-gray-500`

### Empty/error states
- No project selected: "Select a project from the sidebar to view state"
- Loading: Pulsing placeholder blocks (match DashboardPage loading style)
- Error: Red text with retry suggestion
- No data (404 from API): "No STATE.json found for this project"

**What NOT to do:**
- Do not import Cytoscape or any graph library in this file
- Do not add mutation buttons (no edit/create/delete)
- Do not fetch data directly -- always use the `useProjectState` hook

**Verification:**
```bash
cd web/frontend && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 2: WorktreeView Page

**Files created:**
- `web/frontend/src/pages/WorktreePage.tsx`

**Action:**
Create the Worktree Tracking view. This page shows active git worktrees from REGISTRY.json.

### Component Structure

```
WorktreePage
  - uses useProjectStore to get activeProjectId
  - uses useWorktreeRegistry(activeProjectId) hook
  - loading/error/no-project states
  - renders:
    - Page header: "Worktrees"
    - Summary row: total worktrees, active count, merged count, orphaned count
    - Table/list of worktrees:
      - Columns: Set Name, Branch, Status, Phase, Merge Status, Created
      - Each row shows the worktree entry
      - Status badge with color coding:
        - active -> green
        - orphaned -> orange
        - other -> gray
      - Merge status badge:
        - merged -> green
        - complete -> blue
        - null/empty -> gray dash
      - Solo indicator (small tag if solo=true)
      - Sort by: active first, then by created_at descending
```

### Layout
- Use a responsive table: full table on md+ screens, card list on mobile
- Table: `table.w-full.text-sm` with `thead` using `text-muted.text-left` and `tbody` rows with `border-t.border-border`
- On mobile (<md): render as stacked cards instead of table rows

### Empty/error states
- Same pattern as StatePage: no project, loading, error, no data

**What NOT to do:**
- Do not add worktree creation/deletion buttons
- Do not link to worktree file paths (they may not be accessible from the browser)

**Verification:**
```bash
cd web/frontend && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 3: KnowledgeGraph Page (Cytoscape.js)

**Files created:**
- `web/frontend/src/pages/KnowledgeGraphPage.tsx`

**File replaced:**
- `web/frontend/src/pages/GraphPage.tsx` (overwrite the placeholder)

**Action:**
Create the dependency graph visualization using Cytoscape.js directly (NOT react-cytoscapejs -- it is inactive and lacks React 19 support). The existing `GraphPage.tsx` placeholder is replaced entirely.

### Component Structure

```
KnowledgeGraphPage
  - uses useProjectStore to get activeProjectId
  - uses useDagGraph(activeProjectId) hook
  - loading/error/no-project states
  - Full Cytoscape.js integration via useRef + useEffect pattern:

    const containerRef = useRef<HTMLDivElement>(null)
    const cyRef = useRef<cytoscape.Core | null>(null)

    useEffect(() => {
      if (!containerRef.current || !data) return
      // Import cytoscape-dagre and register
      // Create/update cytoscape instance
      // Cleanup on unmount
    }, [data])
```

### Cytoscape Configuration

**Layout:** dagre (top-to-bottom directed graph)
```
layout: {
  name: "dagre",
  rankDir: "TB",
  nodeSep: 60,
  rankSep: 80,
  padding: 30,
}
```

**Node styling:**
- Shape: `roundrectangle`
- Width: 140, Height: 40
- Label: node id (set name)
- Font size: 12
- Background color by status:
  - pending -> `#6b7280` (gray)
  - discussed -> `#eab308` (yellow)
  - planned -> `#3b82f6` (blue)
  - executing -> `#f97316` (orange)
  - complete -> `#22c55e` (green)
  - merged -> `#4b5563` (dim gray)
- Text color: white
- Border: 2px solid, slightly darker than background

**Edge styling:**
- Line color: `#4b5563`
- Target arrow: triangle
- Arrow color: `#4b5563`
- Curve style: `bezier`
- Width: 2

**Interactions:**
- Enable zoom (mousewheel), pan (drag background), box selection
- Click node: highlight node + connected edges (increase border width, brighten color)
- Min zoom: 0.3, Max zoom: 3

### Graph container
- Full height below header: `div.h-[calc(100vh-8rem)]` with `ref={containerRef}`
- Light border: `border border-border rounded-lg`
- Background: `bg-surface-0`

### Controls overlay
- Position: absolute top-right corner of graph container
- Buttons: Fit (zoom to fit all nodes), Reset (reset zoom/pan)
- Use `cy.fit()` and `cy.reset()` respectively
- Style: small buttons with `bg-surface-1 border border-border rounded px-2 py-1 text-xs`

### Empty/error states
- No project: centered message in graph area
- No DAG: "No DAG.json found"
- Loading: pulsing placeholder

**Critical implementation detail:**
- Import `cytoscape` at top level
- Import and register `cytoscape-dagre` inside the useEffect (or at module level): `import cytoscapeDagre from "cytoscape-dagre"; cytoscape.use(cytoscapeDagre);`
- Register dagre extension only once (guard with a module-level boolean flag)
- Destroy cytoscape instance in useEffect cleanup: `cyRef.current?.destroy()`
- When data updates (from polling), update elements in place rather than recreating the entire graph to preserve zoom/pan state. Use `cy.json({ elements })` or batch `cy.add()`/`cy.remove()`.

**What NOT to do:**
- Do not use react-cytoscapejs (inactive, no React 19 support per research)
- Do not ship Cytoscape WASM -- the regular JS build is fine
- Do not add edit/mutation capabilities to the graph
- Do not import `GraphPage` anywhere -- this file replaces it completely

**Verification:**
```bash
cd web/frontend && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 4: CodebaseMap Page

**Files created:**
- `web/frontend/src/pages/CodebasePage.tsx`

**Action:**
Create the codebase structure visualization. This page shows a tree of files and their symbols parsed by tree-sitter on the backend.

### Component Structure

```
CodebasePage
  - uses useProjectStore to get activeProjectId
  - uses useCodebaseTree(activeProjectId) hook
  - loading/error/no-project states
  - renders:
    - Page header: "Codebase" with language badges
    - Summary: total files parsed, languages found, parse error count
    - File tree: expandable/collapsible file entries
      - Each file shows: relative path, language badge, symbol count
      - Expand to show symbols:
        - Each symbol: icon by kind + name + line range
        - Nested children (methods inside classes) indented
```

### File Tree Component

Build a `FileTreeItem` sub-component:
```
function FileTreeItem({ file }: { file: CodeFile }) {
  const [expanded, setExpanded] = useState(false)
  // Click to expand/collapse
  // Show file path, language badge, symbol count
  // When expanded, show SymbolList
}

function SymbolItem({ symbol, depth }: { symbol: CodeSymbol; depth: number }) {
  // Indentation based on depth (ml-{depth*4})
  // Icon by kind:
  //   function -> "fn"
  //   class -> "C"
  //   method -> "m"
  //   module -> "M"
  //   (default) -> bullet
  // Show: icon + name + (L{start_line}-{end_line})
  // Recurse for children
}
```

### Language badges
- Small colored pills next to file paths:
  - python -> `bg-blue-500/20 text-blue-400`
  - javascript -> `bg-yellow-500/20 text-yellow-400`
  - go -> `bg-cyan-500/20 text-cyan-400`
  - rust -> `bg-orange-500/20 text-orange-400`

### Parse errors section
- If `parse_errors.length > 0`, show a collapsible "Parse Errors" section at the bottom
- Each error as a red-tinted list item

### Empty/error states
- Same pattern as other pages
- Special case: "No supported source files found" when files list is empty but no error

**What NOT to do:**
- Do not run tree-sitter in the browser -- all parsing is backend-only
- Do not add file editing capabilities
- Do not load file contents -- only show the symbol tree structure

**Verification:**
```bash
cd web/frontend && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 5: Router + Navigation + Keyboard Shortcuts

**Files modified:**
- `web/frontend/src/router.tsx` (add routes)
- `web/frontend/src/types/layout.ts` (add NAV_ITEMS entries)
- `web/frontend/src/components/layout/AppLayout.tsx` (add keyboard shortcuts)

### router.tsx

Add imports for the four new pages and add route entries inside the AppLayout children array:

```typescript
import { StatePage } from "@/pages/StatePage";
import { WorktreePage } from "@/pages/WorktreePage";
import { KnowledgeGraphPage } from "@/pages/KnowledgeGraphPage";
import { CodebasePage } from "@/pages/CodebasePage";
```

Add routes (keep existing routes, add new ones before the `*` catch-all):
```typescript
{ path: "state", element: <StatePage /> },
{ path: "worktrees", element: <WorktreePage /> },
// "graph" route already exists -- update its element:
{ path: "graph", element: <KnowledgeGraphPage /> },
{ path: "codebase", element: <CodebasePage /> },
```

Remove the old `GraphPage` import. Replace the graph route element with `KnowledgeGraphPage`.

### layout.ts NAV_ITEMS

Update the NAV_ITEMS array. Add new entries and add shortcuts to existing entries:

```typescript
export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "\u2302", path: "/", shortcut: "gd" },
  { id: "projects", label: "Projects", icon: "\u25A3", path: "/projects", shortcut: "gp" },
  { id: "state", label: "State", icon: "\u25C9", path: "/state", shortcut: "gs" },
  { id: "worktrees", label: "Worktrees", icon: "\u2442", path: "/worktrees", shortcut: "gw" },
  { id: "graph", label: "Graph", icon: "\u25CB", path: "/graph", shortcut: "gk" },
  { id: "codebase", label: "Codebase", icon: "\u2630", path: "/codebase", shortcut: "gc" },
  { id: "notes", label: "Notes", icon: "\u270E", path: "/notes" },
  { id: "settings", label: "Settings", icon: "\u2699", path: "/settings" },
];
```

**Note on keyboard conflicts:** The CONTEXT.md specified `gg` for graph, but `gg` is already bound to "Scroll to top" in AppLayout (line 66-69). Per SET-OVERVIEW.md research finding #2, use `gk` (k for knowledge graph) instead.

### AppLayout.tsx keyboard bindings

Add four new bindings to the `bindings` useMemo array (after the existing `gd` binding):

```typescript
{
  key: "gs",
  description: "Go to State",
  category: "navigation",
  action: () => navigate("/state"),
},
{
  key: "gw",
  description: "Go to Worktrees",
  category: "navigation",
  action: () => navigate("/worktrees"),
},
{
  key: "gk",
  description: "Go to Graph",
  category: "navigation",
  action: () => navigate("/graph"),
},
{
  key: "gc",
  description: "Go to Codebase",
  category: "navigation",
  action: () => navigate("/codebase"),
},
```

**What NOT to do:**
- Do not remove or modify existing keyboard bindings (especially `gg` for scroll-to-top)
- Do not remove existing routes (notes, settings, etc.)
- Do not modify the Sidebar component -- it reads NAV_ITEMS automatically

**Verification:**
```bash
cd web/frontend && npx tsc --noEmit 2>&1 | head -20
```

---

## Success Criteria

1. All four pages render without errors when navigating to /state, /worktrees, /graph, /codebase
2. Graph page (/graph) shows a Cytoscape.js visualization instead of the old placeholder
3. All views show loading states when no data is available
4. All views show "select a project" prompt when no project is active
5. Sidebar shows all four new navigation entries with correct shortcuts displayed
6. Keyboard shortcuts gs, gw, gk, gc navigate to the correct pages
7. Existing keyboard shortcuts (gg, gp, gd, l, h, /, ?, Escape) still work
8. TypeScript compiles without errors: `npx tsc --noEmit`
9. Auto-refresh works: data updates within 2 seconds when backend files change
10. KnowledgeGraph renders 50+ nodes and 200+ edges without visible lag

## File Ownership Summary

**New files (this wave only):**
- `web/frontend/src/pages/StatePage.tsx`
- `web/frontend/src/pages/WorktreePage.tsx`
- `web/frontend/src/pages/KnowledgeGraphPage.tsx`
- `web/frontend/src/pages/CodebasePage.tsx`

**Modified files (this wave only):**
- `web/frontend/src/pages/GraphPage.tsx` (replaced entirely by KnowledgeGraphPage -- can delete or overwrite)
- `web/frontend/src/router.tsx` (add routes, update graph import)
- `web/frontend/src/types/layout.ts` (add NAV_ITEMS entries)
- `web/frontend/src/components/layout/AppLayout.tsx` (add keyboard bindings)

**No overlap with Wave 1 files:** Wave 1 touched `api.ts`, `useViews.ts`, backend files. Wave 2 touches page components, `router.tsx`, `layout.ts`, `AppLayout.tsx`. Zero file conflicts.
