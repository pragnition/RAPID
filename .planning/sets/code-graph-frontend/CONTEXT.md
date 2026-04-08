# CONTEXT: code-graph-frontend

**Set:** code-graph-frontend
**Generated:** 2026-04-08
**Mode:** interactive

<domain>
## Set Boundary
Overhaul the existing KnowledgeGraphPage into a full Code Graph page with two tabs: a new codebase dependency graph visualization (Cytoscape.js with fcose layout) and the preserved Set DAG view. Includes click-to-view file panel (CodeMirror), search/filter, rename from "Knowledge Graph" to "Code Graph", and performance safeguards for large codebases (200+ nodes). Consumes `GET /api/projects/{id}/code-graph` and `GET /api/projects/{id}/file` endpoints from the code-graph-backend set.
</domain>

<decisions>
## Implementation Decisions

### Tab Architecture & Cytoscape Lifecycle
- **Hidden DOM (display:none):** Both Cytoscape instances (Code Graph + Set DAG) remain mounted simultaneously. Tab switching toggles visibility rather than mounting/unmounting components.
- **Rationale:** Preserves full zoom/pan state instantly on tab switch with no re-render cost. The memory overhead of two Cytoscape canvases is acceptable for the seamless UX benefit.

### File Viewer Panel Layout
- **Right Side Panel:** Slide-in panel from the right side when a node is clicked. Graph compresses horizontally, both graph and file content remain visible simultaneously.
- **Rationale:** Allows users to trace dependency edges in the graph while reading source code. Consistent with IDE-style layouts. The existing DAG node-detail overlay in the bottom-left won't conflict with the right panel.

### Graph Visualization Strategy — Node Design
- **Filename + Language Color:** Rounded rectangle nodes colored by detected language, with truncated filename as the label. Consistent with the existing DAG node styling approach.
- **Rationale:** Clean and readable at a glance. Language is instantly visible via background color without needing icons or additional assets. Maintains visual consistency with the Set DAG tab's node style.

### Graph Visualization Strategy — Layout Algorithm
- **Force-directed (fcose):** Use the fcose (fast compound spring embedder) layout algorithm for the Code Graph. Organic clustering with natural grouping of related files.
- **Rationale:** Handles potential cyclic imports naturally (unlike dagre). Supports compound nodes needed for directory clustering. Good for exploratory browsing where users don't have a fixed mental model of dependency direction.

### Data Fetching & Caching Strategy — Polling
- **30-second polling interval:** The useCodeGraph hook polls the /code-graph endpoint every 30 seconds with appropriate stale time.
- **Rationale:** Matches the backend's heavier tree-sitter parse cycle. Much lower server load than the 2s DAG polling. Code graph data changes infrequently compared to state/DAG data.

### Data Fetching & Caching Strategy — File Content
- **On-demand fetch on click:** File content is fetched from the /file endpoint only when a user clicks a node. Loading skeleton shown in the panel during fetch.
- **Rationale:** Simple, no wasted network requests. File content fetch is typically <500ms. Avoids the complexity of prefetch logic and wasted requests from hover-based prefetching.

### Search/Filter Interaction Pattern
- **Dim + auto-zoom to matches:** Non-matching nodes are dimmed (reduced opacity) while matching nodes retain full visibility. The graph automatically zooms/pans to center the matching cluster.
- **Rationale:** Combines the context-preservation of dimming with the focus benefit of auto-zoom. Users can see where matching files sit within the broader dependency structure while getting an immediate visual focus on results.
- **Search input position:** Graph overlay, top-left corner — opposite the existing control buttons in top-right. Inside the graph area, close to content.

### Directory Clustering for Large Graphs
- **Compound nodes per directory:** When the graph exceeds 200 nodes, files are grouped into Cytoscape compound (parent) nodes by directory. Directories are collapsible groups with inter-directory edges preserved.
- **Rationale:** Cytoscape's native compound node support works well with fcose layout. Preserves the full graph structure while making large codebases navigable. 200-node threshold matches the CONTRACT.json specification.

### Graph-to-File-Viewer Transition
- **Replace with crossfade animation:** When the panel is open and a different node is clicked, the file content crossfades to the new file. Panel stays open. Close via X button or clicking graph background.
- **Rationale:** The crossfade provides a visual signal that content has changed, preventing confusion about which file is displayed. Smoother than an instant swap. Panel remains persistently open for dependency-tracing workflows.
- **Fixed width ~35%:** The panel has a fixed width of approximately 35% of the page. No resize handle — graph always gets ~65% of width.

### Visual Consistency Across Tabs
- **Shared header + tab-specific stats:** One "Code Graph" page title with a stats line that updates based on the active tab (files/imports for Code Graph, sets/dependencies for Set DAG).
- **Shared control bar, tab-aware buttons:** One control area that adapts its buttons based on the active tab. Search input only appears on Code Graph tab. Fit/Reset are universal. Layout toggle label adapts per tab.
- **Rationale:** Unified page feel with minimal visual disruption on tab switch. Users see consistent control placement regardless of which tab is active.
</decisions>

<specifics>
## Specific Ideas
- The route path `/graph` stays unchanged to avoid breaking bookmarks
- Sidebar command palette entry "Go to Graph" (gk shortcut) remains pointing to `/graph`
- Need to install additional CodeMirror language extensions (`@codemirror/lang-javascript`, `@codemirror/lang-python`, etc.) — fall back to plain text for unsupported languages
- Existing DAG visualization is preserved verbatim in the "Set DAG" tab — no modifications to DAG rendering logic
- Tab bar component placed between header/stats and graph area
</specifics>

<code_context>
## Existing Code Insights
- `KnowledgeGraphPage.tsx` (349 lines): Already has Cytoscape with dagre layout, GraphControls component, node click handling with detail overlay, proper `cy.destroy()` cleanup
- `router.tsx`: Lazy-loads KnowledgeGraphPage — rename to CodeGraphPage, keep `/graph` route
- `AppLayout.tsx:96`: Command palette has "Go to Graph" binding at `gk` — update description text
- `useViews.ts`: Existing `useDagGraph` hook uses React Query with 2s polling — new `useCodeGraph` hook follows same pattern but with 30s interval
- `api.ts`: Already has DagGraph types — extend with CodeGraphNode, CodeGraphEdge, FileContent types
- Cytoscape dagre extension registered via `ensureDagre()` singleton — fcose will need similar registration pattern
- `getNodeColor()` and `darken()` utilities can be reused/adapted for language-based coloring
- `buildElements()` pattern reusable for constructing code graph elements from API response
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
