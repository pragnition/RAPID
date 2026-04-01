# Wave 1 Plan: SVG Diagram Fixes

**Set:** readme-polish
**Wave:** 1
**Objective:** Prepare both SVG diagrams for full-width rendering by removing hardcoded dimensions and tightening viewBox to crop whitespace.

## Context

Both SVGs currently have explicit `width` and `height` attributes on their root `<svg>` element, which forces them to render at exactly 1280px wide regardless of container. The README also constrains them further with `width="800"` on `<img>` tags (handled in Wave 2). This wave fixes the SVG source files so they become responsive -- they will scale to fill whatever container width the README provides.

Additionally, both diagrams have slight excess whitespace at the bottom of their viewBox. Tightening the viewBox crops this dead space.

## Tasks

### Task 1: Fix lifecycle-flow.svg dimensions

**File:** `branding/lifecycle-flow.svg`

**Actions:**
1. On line 1, change the SVG root element from:
   ```
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 200" width="1280" height="200">
   ```
   to:
   ```
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 195">
   ```
   This removes the `width` and `height` attributes (making it responsive) and tightens the viewBox height from 200 to 195 (content ends at y~190, the "repeat per set" label is at y=183).

**What NOT to do:**
- Do not modify any other SVG elements, colors, fonts, or positions
- Do not change the viewBox width (1280 is correct)
- Do not add any CSS or style attributes

**Verification:**
```bash
# Confirm no width/height attributes remain on svg root
grep -c 'width=\|height=' branding/lifecycle-flow.svg
# Should output "0" (the background rect has width/height but those are element attributes, not on <svg>)
# More precisely, check just line 1:
head -1 branding/lifecycle-flow.svg | grep -c 'width='
# Should output "0"
```

### Task 2: Fix agent-dispatch.svg dimensions

**File:** `branding/agent-dispatch.svg`

**Actions:**
1. On line 1, change the SVG root element from:
   ```
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 600" width="1280" height="600">
   ```
   to:
   ```
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 575">
   ```
   This removes the `width` and `height` attributes and tightens viewBox height from 600 to 575 (last content element is the "x N" notation at y=560).

**What NOT to do:**
- Do not modify any agent pills, colors, text, or layout
- Do not change the viewBox width
- Do not alter the background rect dimensions (those stay at 1280x600 -- that is fine, the viewBox will clip)

Wait -- the background rect should also be updated to match the new viewBox height. Change line 2:
```
<rect fill="#2d353b" width="1280" height="600" rx="8"/>
```
to:
```
<rect fill="#2d353b" width="1280" height="575" rx="8"/>
```

Similarly for lifecycle-flow.svg, update the background rect on line 2 from height="200" to height="195".

**Verification:**
```bash
head -1 branding/agent-dispatch.svg | grep -c 'width='
# Should output "0"
head -1 branding/lifecycle-flow.svg | grep -c 'width='
# Should output "0"
```

## Success Criteria

1. Both SVG files have no `width` or `height` attributes on their root `<svg>` element
2. `lifecycle-flow.svg` viewBox is `"0 0 1280 195"` with background rect height="195"
3. `agent-dispatch.svg` viewBox is `"0 0 1280 575"` with background rect height="575"
4. No other elements in either SVG are modified
5. Both SVGs remain valid XML (no syntax errors)

## File Ownership

| File | Action |
|------|--------|
| `branding/lifecycle-flow.svg` | Modify (viewBox + remove dimensions) |
| `branding/agent-dispatch.svg` | Modify (viewBox + remove dimensions) |
