# Wave 3 PLAN: Interaction and Polish -- File Viewer, Search, Performance

## Objective

Complete the code graph feature with three interactive capabilities: (1) a click-to-view file panel using CodeMirror that slides in from the right when a node is clicked, (2) a search/filter bar that dims non-matching nodes and auto-zooms to matches, and (3) performance safeguards including directory-level compound node clustering for large graphs (200+ nodes). This wave also adds keyboard accessibility with aria-live announcements.

## Prerequisites

Wave 2 must be complete: CodeGraphPage with tab architecture, code graph Cytoscape visualization rendering, `codeGraphCyRef` available for interaction wiring.

## Tasks

### Task 1: Create FileViewerPanel component

**File:** `web/frontend/src/components/graph/FileViewerPanel.tsx` (new file)
**Action:** Build a read-only file content viewer panel that slides in from the right side of the page.

Props interface:
```
interface FileViewerPanelProps {
  projectId: string;
  filePath: string | null;   // null = panel closed
  onClose: () => void;
}
```

Implementation:

1. **Data fetching:** Use the `useFileContent(projectId, filePath)` hook from Wave 1. Show a loading skeleton (pulse animation) while fetching. Show error state if fetch fails.

2. **CodeMirror read-only viewer:** Create a CodeMirror `EditorView` instance for displaying file content:
   - Use `EditorState.create()` with `EditorState.readOnly.of(true)` extension
   - Include `basicSetup` from `codemirror` for line numbers, folding, etc.
   - Include the theme extensions (`editorTheme`, `darkHighlight`) -- define locally following the same pattern as `CodeMirrorEditor.tsx` (copy the theme objects, do NOT import from CodeMirrorEditor)
   - Dynamic language extension based on `fileContent.language`:
     - Use `Compartment` for the language extension so it can be reconfigured
     - Map language string to CodeMirror language function using dynamic `import()`:
       - "typescript", "tsx" -> `import("@codemirror/lang-javascript").then(m => m.javascript({ typescript: true, jsx: lang === "tsx" }))`
       - "javascript", "jsx" -> `import("@codemirror/lang-javascript").then(m => m.javascript({ jsx: lang === "jsx" }))`
       - "python" -> `import("@codemirror/lang-python").then(m => m.python())`
       - "go" -> `import("@codemirror/lang-go").then(m => m.go())`
       - "rust" -> `import("@codemirror/lang-rust").then(m => m.rust())`
       - "markdown", "md" -> `import("@codemirror/lang-markdown").then(m => m.markdown())`
       - All others -> no language extension (plain text)
   - Destroy `EditorView` in useEffect cleanup

3. **Panel layout:**
   - Fixed width: `w-[35%]` of the page, positioned on the right side
   - Full height of the graph area (`h-full`)
   - Background: `bg-surface-0`, border: `border-l border-border`
   - Header bar with: file path (truncated with title tooltip for full path), language badge, close button (X icon)
   - Transition: `transition-transform duration-200` with `translate-x-full` when closed, `translate-x-0` when open
   - Panel renders conditionally when `filePath !== null`

4. **Content crossfade:** When `filePath` changes while panel is open:
   - The `useFileContent` hook automatically fetches the new file
   - While loading, show a brief opacity transition on the editor area (0.5 opacity during load, 1.0 when complete)
   - The CodeMirror instance content is replaced via `view.dispatch({ changes: { from: 0, to: doc.length, insert: newContent } })`
   - The language Compartment is reconfigured to match the new file's language

5. **Accessibility:** Add `role="complementary"`, `aria-label="File viewer"`, and `aria-live="polite"` region that announces "Viewing {filename}" when a file is opened.

**What NOT to do:**
- Do NOT reuse or import from `CodeMirrorEditor.tsx` -- that component is for editing with vim mode, onChange callbacks, and imperative handles. The file viewer is simpler: read-only, no onChange, no vim.
- Do NOT add resize handles to the panel. Fixed 35% width per CONTEXT.md decision.
- Do NOT fetch file content eagerly -- only when `filePath` is non-null.

**Verification:** `cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20`

### Task 2: Wire file viewer into CodeGraphPage

**File:** `web/frontend/src/pages/KnowledgeGraphPage.tsx`
**Action:** Connect node clicks on the code graph to the FileViewerPanel.

1. **State:** Add `const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);`

2. **Node click handler:** In the code graph Cytoscape useEffect, add a tap handler:
   ```
   cy.on("tap", "node", (evt) => {
     const node = evt.target;
     const fullPath = node.data("fullPath") as string;
     setSelectedFilePath(fullPath);
   });
   ```

3. **Background click handler:** Close the panel when clicking the graph background:
   ```
   cy.on("tap", (evt) => {
     if (evt.target === cy) {
       setSelectedFilePath(null);
     }
   });
   ```

4. **Layout adjustment:** When the file viewer is open, the code graph container should compress to ~65% width:
   - Wrap the code graph container and FileViewerPanel in a flex row: `flex flex-row`
   - Code graph container: `flex-1` (takes remaining space)
   - FileViewerPanel: fixed `w-[35%]` when open
   - After the width changes, call `codeGraphCyRef.current?.resize()` via a `requestAnimationFrame` in a useEffect watching `selectedFilePath`

5. **Import FileViewerPanel:** `import { FileViewerPanel } from "@/components/graph/FileViewerPanel";`

6. **Render FileViewerPanel:** Inside the code-graph tab container div, after the graph container:
   ```
   {selectedFilePath && (
     <FileViewerPanel
       projectId={activeProjectId}
       filePath={selectedFilePath}
       onClose={() => setSelectedFilePath(null)}
     />
   )}
   ```

**What NOT to do:**
- Do NOT modify the Set DAG tab's click behavior -- DAG node clicks should still show the existing detail overlay, not open the file viewer.

**Verification:** `cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20`

### Task 3: Create GraphSearchFilter component

**File:** `web/frontend/src/components/graph/GraphSearchFilter.tsx` (new file)
**Action:** Build a search/filter input that highlights matching nodes and dims non-matching ones.

Props interface:
```
interface GraphSearchFilterProps {
  cyRef: React.RefObject<cytoscape.Core | null>;
  enabled: boolean;  // false when tab is not active
}
```

Implementation:

1. **Search input:** Positioned as a graph overlay in the top-left corner (`absolute top-3 left-3 z-10`).
   - Input with `bg-surface-1 border border-border rounded px-3 py-1.5 text-sm text-fg` styling
   - Placeholder: "Search files..."
   - Width: `w-64`
   - Clear button (X) appears when input has text
   - `role="search"`, `aria-label="Search graph nodes"`

2. **Search logic:** On input change (debounced 200ms):
   - Get the search term (lowercase)
   - If empty: restore all nodes to full opacity, reset zoom
   - If non-empty:
     - Find matching nodes: `cy.nodes().filter(n => n.data("label")?.toLowerCase().includes(term) || n.data("fullPath")?.toLowerCase().includes(term))`
     - Dim non-matching nodes: set opacity to 0.15 via `cy.batch(() => { ... })`
     - Keep matching nodes at full opacity (1.0)
     - Dim edges not connected to matching nodes to opacity 0.1
     - Auto-fit camera to matching nodes with padding: `cy.fit(matchingNodes, 50)`

3. **Restore on clear:** When search is cleared (X button or backspace to empty), restore all elements to full opacity and fit the full graph.

4. **Keyboard:** Pressing Escape while the search input is focused clears the search and blurs the input.

5. **Disabled state:** When `enabled` is false, do not render the component (return null). This prevents the search from appearing on the Set DAG tab.

**What NOT to do:**
- Do NOT filter/remove nodes from the graph -- only adjust opacity (dim vs full).
- Do NOT use Cytoscape's built-in `cy.filter()` for visibility -- use style manipulation via `ele.style("opacity", value)`.
- Do NOT search on every keystroke -- debounce at 200ms.

**Verification:** `cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20`

### Task 4: Wire GraphSearchFilter into CodeGraphPage

**File:** `web/frontend/src/pages/KnowledgeGraphPage.tsx`
**Action:** Add the search filter overlay to the code graph tab.

1. **Import:** `import { GraphSearchFilter } from "@/components/graph/GraphSearchFilter";`

2. **Render:** Inside the code-graph tab container div, as the first child (before the graph container), add:
   ```
   <GraphSearchFilter cyRef={codeGraphCyRef} enabled={activeTab === "code-graph"} />
   ```

3. The search overlay should appear in the top-left of the graph area, while GraphControls remain in the top-right. Both are absolutely positioned within the relative graph container.

**Verification:** `cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20`

### Task 5: Add performance safeguards -- directory clustering and warnings

**File:** `web/frontend/src/pages/KnowledgeGraphPage.tsx`
**Action:** Add directory-level compound node clustering when the graph exceeds 200 nodes, and a max-nodes warning.

1. **Directory clustering in `buildCodeGraphElements`:** Modify the code graph element builder to support compound nodes:
   - Add a `cluster` parameter: `buildCodeGraphElements(data: CodeGraphData, cluster: boolean)`
   - When `cluster === true` (called when `data.nodes.length > 200`):
     - Extract unique directories from node paths (e.g., `src/lib/api.ts` -> `src/lib`)
     - Create parent nodes for each directory: `{ data: { id: "dir:src/lib", label: "src/lib", isDirectory: true }, classes: "directory" }`
     - Set each file node's `parent` to its directory: `{ data: { ..., parent: "dir:src/lib" } }`
     - Edges between files in different directories create inter-directory edges
   - When `cluster === false`: build flat elements as before (no parent nodes)

2. **Directory node styling:** Add a style selector for `.directory` class nodes:
   - `background-color: transparent`
   - `border-width: 1`
   - `border-style: dashed`
   - `border-color: var(--th-border)` or `#4b5563`
   - `label: "data(label)"`
   - `font-size: 13`
   - `text-valign: top`
   - `text-halign: center`
   - `padding: 20`

3. **Warning banner:** When `data.nodes.length > 200`, show an info banner above the graph: "Large graph ({count} files) -- directory clustering enabled for performance." Use `bg-surface-1 border border-info text-sm text-info p-2 rounded mb-2` styling.

4. **Node count safeguard:** When `data.nodes.length > 500`, show a warning: "Very large graph ({count} files). Consider filtering or searching to focus on specific areas." Use warning-level styling.

5. **Keyboard accessibility:** Add `tabindex="0"` to the graph container. Add an `aria-live="polite"` region below the graph that announces the selected node's file path when a node is clicked. When the file viewer opens, announce "Viewing {filename}".

**What NOT to do:**
- Do NOT prevent rendering for large graphs -- always render, but cluster when above 200.
- Do NOT modify the Set DAG tab's rendering logic at all.
- Do NOT add collapsible directory interaction in this wave -- just static compound grouping.

**Verification:** `cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20`

## Success Criteria

1. Clicking a code graph node opens the file viewer panel on the right side
2. File content is syntax-highlighted with appropriate language extension
3. Clicking a different node replaces the panel content with crossfade
4. Clicking graph background or X button closes the panel
5. Search input in top-left filters nodes by dimming non-matches
6. Clearing search restores all nodes to full visibility
7. Graphs with 200+ nodes render with directory clustering
8. Warning banners appear for large and very large graphs
9. Truncation warning appears when backend reports truncated data
10. Keyboard accessibility: graph container is focusable, aria-live announces selections
11. `npx tsc --noEmit` passes with no errors
12. Existing Set DAG tab functionality is completely unaffected
