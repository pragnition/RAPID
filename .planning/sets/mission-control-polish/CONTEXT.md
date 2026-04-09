# CONTEXT: mission-control-polish

**Set:** mission-control-polish
**Generated:** 2026-04-09
**Mode:** interactive

<domain>
## Set Boundary
Fix four visual and functional issues in the Mission Control web dashboard: graph color schemes (both DAG and Code Graph), default zoom levels, syntax highlighting in the file viewer, and the broken Set DAG endpoint/visualization. Work spans frontend (React/Cytoscape.js/CodeMirror) and backend (FastAPI/Pydantic) but is scoped to polish -- no new features or API surface changes.
</domain>

<decisions>
## Implementation Decisions

### Graph Color Strategy
- Unify all graph colors on CSS custom properties. Both getNodeColor() (already using --th-* variables) and getLanguageColor() (currently hardcoded hex) should read from the theme system so colors adapt across all 8 themes.
- **Rationale:** User prioritizes full theme integration over recognizable language brand colors. Consistent theming across the entire dashboard is more important than matching GitHub's language color conventions.

### Edge and Selection Colors
- Move edge color (#4b5563) and selection highlight (#a78bfa) to theme variables (--th-border for edges, --th-accent for selection).
- **Rationale:** Minimal effort change that future-proofs for theme switching. Current hardcoded values only work well on dark Everforest.

### DAG Data Tolerance
- Add `model_config = {"extra": "ignore"}` to the DagNode Pydantic model to silently drop extra fields (type, group, priority, description) from DAG.json nodes.
- **Rationale:** One-line fix that makes the backend resilient to evolving DAG.json schemas without expanding the API contract. The extra fields aren't needed by the frontend.

### DAG Status Sync
- dag_service.py should read STATE.json alongside DAG.json and overwrite node statuses with the authoritative values from STATE.json before returning.
- **Rationale:** DAG.json statuses are stale (all show 'pending' despite 6 sets being merged). Backend merge is ~10 lines and keeps the frontend simple -- single query returns accurate data.

### Syntax Highlighting
- Build a full custom CodeMirror HighlightStyle using @lezer/highlight tags mapped to theme CSS variables (--th-* properties). Cover ~15 token types: keywords, strings, comments, types, functions, operators, etc.
- **Rationale:** Full theme integration across all 8 themes. The existing basicSetup with only a background override produces near-monochrome code which defeats the purpose of a file viewer.

### Highlight Theme Sharing
- Create a shared highlight theme module (e.g., src/lib/codemirrorTheme.ts) but only wire it into FileViewerPanel in this set. CodeMirrorEditor (Kanban notes) can adopt it in a future set.
- **Rationale:** DRY principle -- avoids divergence. But CodeMirrorEditor is a Kanban feature outside this set's scope, so applying it there is deferred.

### Default Zoom Strategy
- Use fit-then-clamp: after layout runs, call cy.fit(padding) then clamp zoom to [0.5, 1.5] range. This prevents over-zoom on small graphs and under-zoom on large ones.
- **Rationale:** Adaptive to graph size while preventing extreme zoom levels. The Fit button remains available for manual override.

### Fit Padding
- Use different padding per graph type: 60px for Set DAG (small, sparse, benefits from whitespace) and 30px for Code Graph (dense, needs screen real estate).
- **Rationale:** The two graph types have fundamentally different density profiles. A single padding value would compromise one or the other.

### Claude's Discretion
- None -- all gray areas were discussed with the user.
</decisions>

<specifics>
## Specific Ideas
- Language colors should map to theme variables like --th-blue, --th-yellow, --th-green rather than hardcoded hex values
- The zoom clamping should happen after layout completion via cy.fit(padding) followed by zoom min/max enforcement
- The shared CodeMirror theme module should export both the editor chrome theme and the syntax highlight style separately for flexibility
</specifics>

<code_context>
## Existing Code Insights
- getNodeColor() at KnowledgeGraphPage.tsx:31 already reads CSS variables via getComputedStyle -- this pattern should extend to getLanguageColor()
- DAG.json nodes have extra fields: type, group, priority, description (some null) that DagNode model at views.py:61 doesn't accept
- dag_service.py:10 already has access to project_path, so reading STATE.json is trivial (same .planning/ directory)
- FileViewerPanel uses a Compartment for language extensions -- the highlight theme can use the same pattern or be static
- CodeMirror language loading at FileViewerPanel.tsx:82 covers TS, JS, Python, Go, Rust, Markdown -- no CSS/HTML/JSON language support currently
- The Cytoscape instances set minZoom: 0.3 and maxZoom: 3 as outer bounds, but initial zoom after layout is unconstrained
</code_context>

<deferred>
## Deferred Ideas
- Apply shared CodeMirror highlight theme to CodeMirrorEditor (Kanban notes editor) in a future set
</deferred>
