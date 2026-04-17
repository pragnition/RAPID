# Wave 2 PLAN: Core UI -- Page Rename, Tab Bar, Code Graph Visualization

## Objective

Transform the existing KnowledgeGraphPage into CodeGraphPage with a tabbed layout. The "Code Graph" tab renders a new Cytoscape.js force-directed graph (fcose) showing file nodes colored by language with import-edge arrows. The "Set DAG" tab preserves the existing DAG visualization verbatim. Tab switching uses `display:none` toggling (not mount/unmount) so both Cytoscape instances keep their zoom/pan state.

## Prerequisites

Wave 1 must be complete: `CodeGraph` types in `api.ts`, `useCodeGraph` hook in `useCodeGraph.ts`, `cytoscape-fcose` installed.

## Tasks

### Task 1: Create GraphTabBar component

**File:** `web/frontend/src/components/graph/GraphTabBar.tsx` (new file)
**Action:** Create a tab bar component that switches between "Code Graph" and "Set DAG" tabs.

Props interface:
```
interface GraphTabBarProps {
  activeTab: "code-graph" | "set-dag";
  onTabChange: (tab: "code-graph" | "set-dag") => void;
  codeGraphStats?: { nodes: number; edges: number } | null;
  dagStats?: { nodes: number; edges: number } | null;
}
```

Behavior:
- Two tabs rendered as buttons in a horizontal row
- Active tab has `border-b-2 border-accent text-fg` styling; inactive has `text-muted hover:text-fg`
- Each tab label shows count in parentheses when stats are available, e.g. "Code Graph (142 files)" and "Set DAG (8 sets)"
- For Code Graph tab: use `stats.nodes` as file count
- For Set DAG tab: use `stats.nodes` as set count
- Tab bar has bottom border `border-b border-border` spanning full width
- Use `role="tablist"` on container, `role="tab"` on buttons, `aria-selected` for active tab

Styling convention: follow the existing button styling pattern from `GraphControls` (bg-surface-1, border, text-xs text-fg), but as underline-style tabs instead of bordered buttons.

**Verification:** `cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20`

### Task 2: Rename KnowledgeGraphPage to CodeGraphPage

**File:** `web/frontend/src/pages/KnowledgeGraphPage.tsx`
**Action:** Refactor the existing page into a container that manages two tab views.

Step-by-step:

1. **Rename export:** Change `export function KnowledgeGraphPage()` to `export function CodeGraphPage()`. The file stays named `KnowledgeGraphPage.tsx` to avoid import path churn -- the export name is what matters.

2. **Rename all heading text:** Replace every occurrence of `"Knowledge Graph"` with `"Code Graph"` (there are 5 instances across loading/error/empty/main states).

3. **Add state for active tab:** Add `const [activeTab, setActiveTab] = useState<"code-graph" | "set-dag">("code-graph");`

4. **Import new dependencies:**
   - `import { GraphTabBar } from "@/components/graph/GraphTabBar";`
   - `import { useCodeGraph } from "@/hooks/useCodeGraph";`
   - `import cytoscapeFcose from "cytoscape-fcose";`
   - `import type { CodeGraph as CodeGraphData } from "@/types/api";`

5. **Add fcose registration:** Create an `ensureFcose()` singleton following the exact `ensureDagre()` pattern.

6. **Add code graph data fetching:** In the component body, add `const codeGraphQuery = useCodeGraph(activeProjectId);`

7. **Restructure the main return JSX** (the final return block, lines 311-347):
   - After the `<h1>` and stats `<p>`, insert `<GraphTabBar>` with appropriate props
   - The stats `<p>` should be dynamic: when activeTab is "code-graph", show code graph stats (files/edges); when "set-dag", show DAG stats (nodes/edges)
   - Create two sibling container divs for the graph areas:
     - `<div style={{ display: activeTab === "set-dag" ? "block" : "none" }}>` wrapping the existing DAG graph container and GraphControls
     - `<div style={{ display: activeTab === "code-graph" ? "block" : "none" }}>` wrapping the new code graph container (Task 3)
   - The selectedNode detail overlay (lines 324-344) should only show when activeTab is "set-dag"

8. **Add cy.resize() on tab switch:** Add a useEffect that watches `activeTab` and calls `cy.resize()` on the visible graph's Cytoscape instance after a short `requestAnimationFrame` delay. This is CRITICAL -- without it, Cytoscape renders at 0x0 after being toggled from display:none.

9. **Handle loading/error states for code graph tab:** When activeTab is "code-graph" and codeGraphQuery is loading, show the pulse skeleton. When error, show error message. The existing DAG loading/error logic should only apply when activeTab is "set-dag".

**What NOT to do:**
- Do NOT modify the existing DAG Cytoscape rendering logic (buildElements, node click handler, layout options). It must work identically.
- Do NOT remove the existing `containerRef` and `cyRef` -- they continue to own the DAG graph.
- Do NOT mount/unmount Cytoscape instances on tab switch -- use display:none toggling only.

**Verification:** `cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20`

### Task 3: Build code graph Cytoscape visualization

**File:** `web/frontend/src/pages/KnowledgeGraphPage.tsx` (same file as Task 2 -- these tasks are sequential within the same file)
**Action:** Add the code graph rendering within the "code-graph" tab container created in Task 2.

Implementation details:

1. **New refs:** Add `codeGraphContainerRef` (HTMLDivElement) and `codeGraphCyRef` (cytoscape.Core) alongside the existing DAG refs.

2. **Language color mapping:** Create a `getLanguageColor(language: string): string` function that maps languages to distinct colors:
   - typescript/tsx -> `#3178c6` (TypeScript blue)
   - javascript/jsx -> `#f7df1e` (JS yellow)  
   - python -> `#3776ab` (Python blue)
   - go -> `#00add8` (Go cyan)
   - rust -> `#dea584` (Rust orange)
   - css/scss -> `#264de4` (CSS blue)
   - html -> `#e34c26` (HTML orange)
   - json -> `#83a598` (muted green)
   - markdown -> `#859289` (muted gray)
   - default -> read from CSS variable `--th-muted` or fallback `#859289`

3. **Build code graph elements:** Create `buildCodeGraphElements(data: CodeGraphData)` function:
   - For each node: `{ data: { id: node.id, label: extractFilename(node.path), fullPath: node.path, language: node.language, size: node.size } }`
   - `extractFilename` takes the last path segment (e.g., `src/lib/api.ts` -> `api.ts`)
   - For each edge: `{ data: { id: \`${edge.source}->${edge.target}\`, source: edge.source, target: edge.target } }`

4. **Code graph useEffect:** Create a new useEffect that watches `codeGraphQuery.data` and manages the code graph Cytoscape instance:
   - Call `ensureFcose()` before creating the instance
   - If instance exists, use `cy.batch()` to update elements in place (same pattern as DAG)
   - Node style: `shape: "roundrectangle"`, `width: 120`, `height: 32`, `label: "data(label)"`, `font-size: 11`, `background-color` mapped via `getLanguageColor(ele.data("language"))`, `border-width: 2`, `border-color` via `darken()` of the language color
   - Edge style: `line-color: #4b5563`, `target-arrow-color: #4b5563`, `target-arrow-shape: triangle`, `curve-style: bezier`, `width: 1.5`
   - Selected node: `border-width: 3`, `border-color: #a78bfa`
   - Layout: `name: "fcose"`, `animate: false`, `quality: "default"`, `nodeDimensionsIncludeLabels: true`, `idealEdgeLength: 100`, `nodeRepulsion: 4500`, `edgeElasticity: 0.45`
   - Cleanup: `cy.destroy()` in the useEffect return

5. **Truncation warning:** When `codeGraphQuery.data?.truncated === true`, render a warning banner above the graph: "Graph is truncated -- showing a subset of files. Increase max_files for a complete view." Use yellow/warning styling.

6. **Code graph controls:** Add a separate `GraphControls` instance for the code graph (Fit/Reset buttons), similar to the DAG's controls. No layout toggle needed for fcose.

**What NOT to do:**
- Do NOT implement the file viewer panel click handler yet (Wave 3)
- Do NOT implement search/filter yet (Wave 3)
- Do NOT implement directory clustering for 200+ nodes yet (Wave 3)
- Do NOT add node tap handler that opens file viewer -- just add basic node selection highlighting for now

**Verification:** `cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20`

### Task 4: Update router.tsx import

**File:** `web/frontend/src/router.tsx`
**Action:** Update the lazy import to reference the renamed export:

- Change `LazyKnowledgeGraphPage` variable name to `LazyCodeGraphPage`
- Update the import: `import("@/pages/KnowledgeGraphPage").then((m) => ({ default: m.CodeGraphPage }))`
- Update the route element to use `<LazyCodeGraphPage />`
- Keep the route path as `/graph` unchanged

**Verification:** `cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20`

## Success Criteria

1. Navigating to `/graph` shows "Code Graph" page title (not "Knowledge Graph")
2. Two tabs visible: "Code Graph" (active by default) and "Set DAG"
3. Clicking "Set DAG" tab shows the existing DAG visualization with identical behavior
4. Clicking "Code Graph" tab shows the force-directed code graph (or loading/empty state if no data)
5. Tab switching preserves zoom/pan state on both graphs
6. Code graph nodes are colored by language with filename labels
7. Code graph edges show directional arrows
8. Truncation warning appears when backend indicates truncation
9. `npx tsc --noEmit` passes with no errors
10. Sidebar and keyboard shortcut `gk` continue to navigate to `/graph`
