# Wave 2: Frontend Graph Polish + Syntax Highlighting

## Objective

Apply all visual and functional improvements to the frontend: theme-ify graph colors (both Code Graph language colors and DAG/Code Graph edge/selection colors), implement fit-then-clamp default zoom, wire the shared CodeMirror highlight theme into FileViewerPanel, and add missing language support. These changes depend on Wave 1 outputs (working DAG endpoint, installed packages, shared theme module).

## Tasks

### Task 1: Theme-ify getLanguageColor() to use CSS variables

**File:** `web/frontend/src/pages/KnowledgeGraphPage.tsx`

**Action:** Replace hardcoded hex values in `getLanguageColor()` (lines 46-68) with CSS variable lookups using `getComputedStyle()`, matching the pattern already used in `getNodeColor()`.

**Implementation:**
- Rewrite `getLanguageColor()` to read CSS variables via `getComputedStyle(document.documentElement).getPropertyValue(...)`, the same technique `getNodeColor()` uses.
- Language-to-variable mapping:
  - typescript, tsx: `--th-info`
  - javascript, jsx: `--th-warning`
  - python: `--th-info`
  - go: `--th-link`
  - rust: `--th-orange`
  - css, scss: `--th-highlight`
  - html: `--th-error`
  - json: `--th-muted`
  - markdown: `--th-fg-dim`
- Fallback: if the variable is empty, fall back to `--th-muted`, then to `#859289`.

**What NOT to do:**
- Do NOT change `getNodeColor()` -- it already works correctly.
- Do NOT change the `darken()` function -- it works with any hex input.
- Do NOT cache the computed style object across calls -- it must be fresh to pick up theme changes.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20
```

### Task 2: Theme-ify edge and selection colors in Cytoscape styles

**File:** `web/frontend/src/pages/KnowledgeGraphPage.tsx`

**Action:** Replace hardcoded edge color `#4b5563` and selection color `#a78bfa` with CSS variable lookups.

**Implementation:**
- Both DAG and Code Graph Cytoscape style blocks use hardcoded hex colors. Replace them with dynamic lookups.
- For edges: read `--th-border` via `getComputedStyle(document.documentElement).getPropertyValue('--th-border').trim() || '#4b5563'`.
- For selections: read `--th-accent` via `getComputedStyle(document.documentElement).getPropertyValue('--th-accent').trim() || '#a78bfa'`.
- Since Cytoscape style properties accept either strings or functions, create two helper functions at the top of the file (near the existing `getNodeColor`/`getLanguageColor`):
  ```
  function getEdgeColor(): string { ... reads --th-border ... }
  function getSelectionColor(): string { ... reads --th-accent ... }
  ```
- Replace all 6 occurrences:
  - DAG edges (2 occurrences at style block lines ~295-296): `"line-color"` and `"target-arrow-color"`
  - Code Graph edges (2 occurrences at style block lines ~417-418): same
  - DAG `node:selected` (line ~304, ~306): `"border-color"`
  - DAG `edge:selected` (lines ~312-313): `"line-color"`, `"target-arrow-color"`
  - Code Graph `node:selected` (line ~446): `"border-color"`
  - Code Graph directory node border (line ~431): `"border-color"` (already #4b5563)

**What NOT to do:**
- Do NOT use Cytoscape's built-in `mapData()` for this -- it does not support CSS variable resolution. Use plain function mappers that call getComputedStyle.
- Do NOT add a theme-change listener or cy.style().update() call -- that is out of scope for this polish set. The colors will be correct on initial render and after any component remount.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20
```

### Task 3: Implement fit-then-clamp default zoom for both graphs

**File:** `web/frontend/src/pages/KnowledgeGraphPage.tsx`

**Action:** After each layout run (initial creation and data-change re-layout), call `cy.fit()` with padding then clamp zoom to [0.5, 1.5] range.

**Implementation:**
- Create a helper function `fitAndClamp(cy: cytoscape.Core, padding: number)`:
  ```
  function fitAndClamp(cy: cytoscape.Core, padding: number): void {
    cy.fit(undefined, padding);
    const zoom = cy.zoom();
    const min = 0.5;
    const max = 1.5;
    if (zoom < min || zoom > max) {
      const clamped = Math.max(min, Math.min(max, zoom));
      const { x1, y1, w, h } = cy.extent();
      cy.zoom({
        level: clamped,
        renderedPosition: {
          x: cy.width() / 2,
          y: cy.height() / 2,
        },
      });
      cy.center();
    }
  }
  ```
- Call `fitAndClamp(cy, 60)` after DAG layout in 3 places:
  1. After initial DAG creation layout (after line ~324, after the `cytoscape({...})` constructor which runs layout implicitly -- add it right after `cyRef.current = cy;` but before the return)
  2. After DAG re-layout on data change (after line ~256, after `.run()`)
- Call `fitAndClamp(cy, 30)` after Code Graph layout in 3 places:
  1. After initial Code Graph creation layout (after line ~458, after `codeGraphCyRef.current = cy;` but before the return)
  2. After Code Graph re-layout on data change (after line ~379, after `.run()`)
- Also update the `handleFit` and `handleCodeGraphFit` callbacks to use `fitAndClamp`:
  - `handleFit`: `fitAndClamp(cyRef.current, 60)` instead of just `cy.fit()`
  - `handleCodeGraphFit`: `fitAndClamp(codeGraphCyRef.current, 30)` instead of just `cy.fit()`
- Keep `minZoom: 0.3` and `maxZoom: 3` on the Cytoscape instances as outer bounds for manual zoom -- the clamp only constrains the automatic initial view.

**What NOT to do:**
- Do NOT change the `handleReset` / `handleCodeGraphReset` callbacks -- `cy.reset()` should still fully reset.
- Do NOT change the `toggleLayout` callback's layout -- it uses animation and the user can manually adjust after.
- Do NOT call `fitAndClamp` on resize events -- only on layout completion.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20
```

### Task 4: Wire shared highlight theme into FileViewerPanel + add language support

**File:** `web/frontend/src/components/graph/FileViewerPanel.tsx`

**Action:** Import and use the shared `themeHighlighting` extension from `src/lib/codemirrorTheme.ts`, replacing the default highlight style that comes with `basicSetup`. Add CSS, HTML, and JSON language support to the language loader.

**Implementation:**

**A) Import the shared theme:**
- Add import: `import { themeHighlighting } from "@/lib/codemirrorTheme";`

**B) Add themeHighlighting to the EditorState extensions:**
- In the `useEffect` that creates the EditorState (around line 165-174), add `themeHighlighting` to the extensions array, AFTER `basicSetup`. The custom HighlightStyle will take precedence over basicSetup's defaultHighlightStyle because later extensions win.
- The extensions array should become:
  ```
  extensions: [
    basicSetup,
    themeHighlighting,
    EditorState.readOnly.of(true),
    editorTheme,
    darkHighlight,
    langCompartment.current.of([]),
  ],
  ```

**C) Expand language support in `loadLanguageExtension()`:**
- Add cases for CSS, HTML, and JSON:
  ```
  case "css":
  case "scss":
    return import("@codemirror/lang-css").then((m) => m.css());
  case "html":
    return import("@codemirror/lang-html").then((m) => m.html());
  case "json":
    return import("@codemirror/lang-json").then((m) => m.json());
  ```

**What NOT to do:**
- Do NOT modify CodeMirrorEditor.tsx (the notes editor) -- that is out of scope for this set per the CONTEXT.md decision.
- Do NOT remove `basicSetup` -- it provides line numbers, bracket matching, and other structural features. Only its default highlight style gets overridden.
- Do NOT remove the existing `darkHighlight` extension -- it provides the editor background/foreground colors which are separate from syntax highlighting.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20
```

## Success Criteria

1. `getLanguageColor()` returns theme-derived colors that change with the active theme.
2. Edge and selection colors in both graphs use theme variables instead of hardcoded hex.
3. Both graphs start at a reasonable zoom level (0.5-1.5 range) after initial layout.
4. The "Fit" button clamps to the same range.
5. FileViewerPanel shows syntax-highlighted code using theme-mapped colors for keywords, strings, comments, types, etc.
6. CSS, HTML, and JSON files display with proper syntax highlighting in the file viewer.
7. `npx tsc --noEmit` passes with no errors.

## File Ownership

| File | Action |
|------|--------|
| `web/frontend/src/pages/KnowledgeGraphPage.tsx` | MODIFY |
| `web/frontend/src/components/graph/FileViewerPanel.tsx` | MODIFY |
