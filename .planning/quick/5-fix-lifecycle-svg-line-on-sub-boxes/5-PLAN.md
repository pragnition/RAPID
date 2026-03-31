# Quick Plan: Fix Lifecycle SVG Line Artifacts on Sub-Boxes

## Objective

Remove 7 spurious `<line>` elements from `branding/lifecycle-flow.svg` that draw a horizontal stroke 1px below the top edge of each node box (at y=69 when the rect starts at y=68). These lines create an unintentional visual artifact -- a thin colored bar across the top of every node.

## Task 1: Remove all 7 horizontal line artifacts

**Files:** `branding/lifecycle-flow.svg`

**Action:** Delete the following 7 `<line>` elements (one per node group). Each line sits inside a `<g>` element, between the second `<rect>` (the stroke border) and the closing `</g>` tag:

| Line # | Element | Node |
|--------|---------|------|
| 62 | `<line x1="34" y1="69" x2="178" y2="69" stroke="#859289" .../>` | init |
| 75 | `<line x1="206" y1="69" x2="350" y2="69" stroke="#859289" .../>` | start-set |
| 88 | `<line x1="396" y1="69" x2="540" y2="69" stroke="#a7c080" .../>` | discuss |
| 101 | `<line x1="568" y1="69" x2="712" y2="69" stroke="#a7c080" .../>` | plan |
| 114 | `<line x1="758" y1="69" x2="902" y2="69" stroke="#7fbbb3" .../>` | execute |
| 127 | `<line x1="930" y1="69" x2="1074" y2="69" stroke="#7fbbb3" .../>` | review |
| 140 | `<line x1="1102" y1="69" x2="1246" y2="69" stroke="#7fbbb3" .../>` | merge |

For each node `<g>` group, remove the entire `<line ... />` element and its trailing newline, so the group contains only the two `<rect>` elements (fill rect + stroke border rect).

**Before (each node group):**
```xml
  <g filter="url(#shadow...)">
    <rect fill="#3a4349" ... />
    <rect fill="none" stroke="..." ... />
    <line x1="..." y1="69" x2="..." y2="69" stroke="..." stroke-opacity="0.4" stroke-width="1"/>
  </g>
```

**After (each node group):**
```xml
  <g filter="url(#shadow...)">
    <rect fill="#3a4349" ... />
    <rect fill="none" stroke="..." ... />
  </g>
```

**What NOT to do:**
- Do not modify any `<rect>`, `<text>`, `<path>`, or `<polygon>` elements
- Do not change the `<g>` group structure or filter references
- Do not remove any other `<line>` elements that may exist elsewhere in the SVG (there are none, but be precise)

**Verification:**
```bash
# Confirm zero <line> elements with y1="69" remain
grep -c 'y1="69"' branding/lifecycle-flow.svg
# Expected: 0

# Confirm the SVG is still well-formed XML
xmllint --noout branding/lifecycle-flow.svg 2>&1 && echo "VALID" || echo "INVALID"

# Confirm total line count decreased by exactly 7
wc -l branding/lifecycle-flow.svg
# Expected: original line count minus 7
```

**Done criteria:** All 7 `<line>` elements with `y1="69"` are removed. The SVG remains valid XML. No other elements are modified. Visual inspection shows clean node boxes without the top-edge line artifact.

## Task 2: Visual verification

**Files:** `branding/lifecycle-flow.svg` (read-only)

**Action:** Open the modified SVG and confirm the node boxes render cleanly without the horizontal line artifact at the top edge. Each node should show only the rounded rectangle with its subtle stroke border.

**Verification:**
```bash
# Structural check: each <g filter="url(#shadow...)"> group should contain exactly 2 child elements (2 rects)
grep -A3 '<g filter="url(#shadow' branding/lifecycle-flow.svg | grep -c '<line'
# Expected: 0
```

**Done criteria:** Zero `<line>` elements inside any shadow-filtered `<g>` group. The 7 node boxes render as clean rounded rectangles.
