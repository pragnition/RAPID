# Quick Task 17: Mission Control Graph Hypermodern Redesign

## Objective

Redesign the Code Graph and Set DAG visualizations in Mission Control to look hypermodern -- fixing text overflow from fixed-size boxes, replacing the flat/dull color scheme with a glowing neon-on-dark aesthetic, and adding visual polish (rounded pill-shaped nodes, glow effects on edges, animated hover states, gradient backgrounds). The graph should feel like a futuristic network visualization, not a bland flowchart.

## Context

- **Main file**: `web/frontend/src/pages/KnowledgeGraphPage.tsx` -- contains both Cytoscape graph initializations (Set DAG with dagre layout, Code Graph with fcose layout), all style definitions, and helper functions
- **Supporting components**: `GraphTabBar.tsx`, `GraphSearchFilter.tsx`, `FileViewerPanel.tsx` -- these are fine and do not need changes
- **Design system**: Themes use `--th-*` CSS vars (accent, info, warning, error, highlight, orange, muted, border, surface-*, bg-*, fg). The existing code already reads these via `getComputedStyle()`.
- **Root cause of text overflow**: Both DAG nodes (`width: 140, height: 40`) and Code Graph nodes (`width: 120, height: 32`) use fixed pixel dimensions. Set IDs like `mission-control-polish` and filenames like `KnowledgeGraphPage.tsx` easily exceed these widths.
- **Root cause of ugly colors**: Nodes use flat opaque fills from theme semantic colors with a crude `darken()` function for borders. Edges are a single flat border color. No depth, no glow, no contrast hierarchy.

## Task 1: Fix node sizing and text overflow for both graphs

**Files**: `web/frontend/src/pages/KnowledgeGraphPage.tsx`

**Action**: Replace the fixed `width` / `height` on Cytoscape node styles with dynamic label-based sizing so text never overflows. Both the Set DAG and Code Graph node styles need this change.

Specific changes in the Cytoscape `style` arrays:

1. **Set DAG nodes** (the `cytoscape()` constructor around line 288):
   - Change `width: 140` to `width: "label"` and add `"padding": "12px"` (Cytoscape supports `"label"` as a special width value that auto-sizes to fit the label text plus padding)
   - Change `height: 40` to `height: "label"` and ensure the vertical padding accommodates single-line text (padding of 12px gives comfortable spacing)
   - Reduce `"font-size"` from `12` to `11` for a tighter, more modern feel
   - Add `"text-max-width": "200px"` as a safety cap so extremely long labels get ellipsized rather than creating enormous nodes
   - Update the dagre layout `nodeSep` from `60` to `80` to accommodate wider nodes without overlap

2. **Code Graph nodes** (the `cytoscape()` constructor around line 412):
   - Same approach: `width: "label"`, `height: "label"`, `"padding": "10px"`
   - Keep `"font-size": 11`
   - Add `"text-max-width": "180px"`
   - Increase `idealEdgeLength` from `100` to `120` in the fcose layout to give auto-sized nodes more breathing room

3. **Also update the "update elements in place" layout reruns** (lines ~276 and ~399) to use the same increased spacing values so re-renders match the initial layout.

**Verification**:
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | tail -5
```

**Done criteria**:
- No fixed `width: 140` or `width: 120` pixel values remain in node style selectors
- All node widths use `"label"` with appropriate padding
- TypeScript compiles without errors
- Visually: node boxes expand to fit their text labels -- no clipping or overflow

## Task 2: Replace color scheme with hypermodern glowing neon aesthetic

**Files**: `web/frontend/src/pages/KnowledgeGraphPage.tsx`

**Action**: Overhaul the visual styling of nodes and edges in both graphs to achieve a hypermodern dark-neon look. The goal: nodes should appear as softly glowing pills floating on the dark canvas, with luminous edges connecting them.

### Node style changes (both graphs):

1. **Shape**: Change `shape: "roundrectangle"` to `shape: "round-rectangle"` (both are valid in Cytoscape, but keep roundrectangle -- it already is round-rectangle). The key visual change is not the shape but the coloring approach below.

2. **Background**: Instead of using the raw theme color as `background-color`, use a much darker/desaturated version as the fill and use the bright theme color only for the border glow. Rewrite `getNodeColor` to return an object with `{ fill, border, glow }`:
   - `fill`: The theme color at ~15-20% opacity blended over the surface background. Since Cytoscape doesn't support rgba in `background-color` well via functions, use `"background-opacity": 0.85` with a darkened version of the color as the background.
   - `border`: The bright theme color itself at full saturation
   - `glow`: Same as border (used for hover/selected states)

3. **Concrete style properties for DAG nodes**:
   - `"background-color"`: Keep using `getNodeColor(status)` but set `"background-opacity"` to `0.2`
   - `"border-width"`: `2`
   - `"border-color"`: Use the full bright `getNodeColor(status)` value
   - `"border-opacity"`: `0.8`
   - `"text-outline-color"`: Use `getNodeColor(status)` -- this creates a subtle text glow
   - `"text-outline-width"`: `1`
   - `"text-outline-opacity"`: `0.3`
   - `color`: Keep `"#ffffff"` (white text on dark semi-transparent background reads well)

4. **Concrete style properties for Code Graph nodes**: Same pattern but using `getLanguageColor()` instead of `getNodeColor()`.

5. **Update the `darken()` function** -- it is no longer needed for border colors. It can be removed or repurposed. Remove calls to `darken()` in node border-color mappers.

### Edge style changes (both graphs):

1. Replace the flat `getEdgeColor()` with a more translucent, colored line:
   - `"line-color"`: Use the theme accent color at reduced opacity -- read `--th-accent` and use it with `"line-opacity": 0.4`
   - `"target-arrow-color"`: Same as line-color
   - `"curve-style"`: Change from `"bezier"` to `"unbundled-bezier"` for smoother, more organic curves (on the DAG). Keep `"bezier"` on the code graph since it has many edges.
   - `width`: Increase from `2` to `2.5` on DAG, keep `1.5` on code graph
   - Add `"arrow-scale"`: `0.8` for smaller, less chunky arrowheads

2. **Selected edge style**: Use full-brightness accent with `"line-opacity": 1` and `width: 4` for a visible "lit up" effect.

### Hover and selection glow:

1. **Selected node** (`:selected` selector):
   - `"border-width"`: `3`
   - `"border-color"`: Use `getSelectionColor()` (the accent)
   - `"border-opacity"`: `1`
   - `"background-opacity"`: `0.35` (brighten the fill on selection)
   - Add `"shadow-blur"`: `"15"`, `"shadow-color"`: accent color, `"shadow-opacity"`: `0.6` -- this creates the key "glow" effect. Note: Cytoscape does not support shadow-blur natively, so instead apply an `"overlay-color"` and `"overlay-opacity"` to simulate. Use `"overlay-color"` set to accent, `"overlay-opacity"`: `0.15`, `"overlay-padding"`: `6`.

2. **Directory nodes** (`.directory` selector on code graph): Keep the dashed border style but make it more subtle: `"border-opacity": 0.4`, `"border-color"` using a muted theme color.

### Graph background:

Change the container CSS class from `bg-surface-0` to `bg-bg-dim` (the darkest background tier) for both graph containers. This makes the glowing nodes pop more against a truly dark canvas. Update:
- Line ~659: DAG container div class
- Line ~709: Code graph container div class

**Verification**:
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | tail -5
```

**Done criteria**:
- No calls to `darken()` remain in node border-color mappers
- Nodes use low background-opacity with bright borders (the "neon outline" look)
- Edges use accent-colored translucent lines instead of flat border-gray
- Selected nodes have overlay glow effect
- Graph containers use `bg-bg-dim` for maximum contrast
- TypeScript compiles without errors

## Task 3: Polish the control overlays and info panel

**Files**: `web/frontend/src/pages/KnowledgeGraphPage.tsx`

**Action**: Bring the GraphControls buttons and the selected-node info panel in line with the new hypermodern aesthetic.

1. **GraphControls buttons** (the `GraphControls` component, ~line 195):
   - Replace the current classes with a more modern style: `bg-surface-0/80 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-1.5 text-xs text-fg hover:bg-accent/20 hover:text-accent hover:border-accent/50 transition-all duration-200`
   - This gives frosted glass buttons with accent glow on hover
   - Wrap the button group in a container with `bg-surface-0/60 backdrop-blur-md rounded-xl p-1.5 flex gap-1` for a unified floating toolbar look

2. **Selected node info panel** (the `selectedNode &&` block around line 712):
   - Add `backdrop-blur-md` to the existing classes
   - Change `bg-surface-1` to `bg-surface-0/80` for translucency
   - Change `border-border` to `border-accent/30` for a subtle accent border
   - Add a colored status dot next to the status text: render a small `<span>` with inline `style={{ backgroundColor: getNodeColor(status) }}` and classes `inline-block w-2 h-2 rounded-full`

3. **Loading skeleton containers**: Change `bg-surface-0` in the loading/skeleton divs to `bg-bg-dim` to match the new graph background.

**Verification**:
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | tail -5
```

**Done criteria**:
- GraphControls use frosted glass styling with accent hover
- Selected node panel has backdrop blur and accent-tinted border
- Status has a colored dot indicator
- Loading states match the new bg-bg-dim background
- TypeScript compiles without errors

## Summary of file changes

| File | Change |
|------|--------|
| `web/frontend/src/pages/KnowledgeGraphPage.tsx` | All 3 tasks -- node sizing, color scheme overhaul, overlay polish |

## What NOT to do

- Do NOT modify `GraphTabBar.tsx`, `GraphSearchFilter.tsx`, or `FileViewerPanel.tsx` -- they are already well-styled and consistent with the design system
- Do NOT change the layout algorithms themselves (dagre for DAG, fcose for code graph) -- only adjust spacing parameters
- Do NOT add new npm dependencies -- Cytoscape's built-in style properties are sufficient for all the described effects
- Do NOT use hardcoded hex colors -- always read from theme CSS variables via `getComputedStyle()` so the design works across all 8 themes
- Do NOT break the existing node click / selection / search interactions -- only change visual styling, not behavior
- Do NOT remove the `darken()` utility function entirely -- it may still be useful elsewhere. Just stop using it for node border colors.
