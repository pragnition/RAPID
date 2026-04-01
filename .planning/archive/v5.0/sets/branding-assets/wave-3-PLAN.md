# PLAN: branding-assets / Wave 3

**Set:** branding-assets
**Wave:** 3 of 3
**Objective:** Create the 1280x640 social preview PNG by building a composite source SVG and rasterizing it with `rsvg-convert`. The social preview combines the banner identity (top half) with a condensed lifecycle flow (bottom half) into a single shareable image.

## File Ownership

| File | Action |
|------|--------|
| `branding/social-preview-source.svg` | Create (intermediate, kept for reproducibility) |
| `branding/social-preview.png` | Create (final artifact) |

## Prerequisites

- Wave 1 complete: `branding/banner-github.svg` exists with glyph path data
- Wave 2 complete: `branding/lifecycle-flow.svg` exists with pipeline nodes
- `rsvg-convert` available at `/usr/bin/rsvg-convert` (confirmed v2.61.4)

---

## Task 1: Create social preview source SVG (branding/social-preview-source.svg)

**What:** Create a 1280x640 composite SVG that places the banner text elements in the top half and a condensed lifecycle flow in the bottom half.

**Why:** The social preview PNG needs a dedicated source SVG at 1280x640 (GitHub's recommended social preview dimensions). This is NOT a simple resize of the banner -- it is a new composition that combines two visual elements.

**How:**

1. Create `branding/social-preview-source.svg` with these specifications:

   **Canvas:**
   - `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 640" width="1280" height="640">`
   - Background: `<rect fill="#2d353b" width="1280" height="640" rx="0"/>`
   - Subtle 1px border: `<rect fill="none" stroke="#3d4f56" stroke-width="1" x="0.5" y="0.5" width="1279" height="639" rx="0"/>`

   **Top half (y: 0-320) -- Banner text elements:**
   - Copy the text layout from `branding/banner-github.svg`:
     - Command text (`/rapid:init`): same attributes, vertically centered in top half (~y=130)
     - Title paths (R, A, P, I, D): same `<path>` elements and transforms, centered at ~y=180
     - Tagline text: same attributes, at ~y=240
     - Decorative rules: same thin lines, repositioned to frame the title in the top half
   - These are the SAME elements from the banner, repositioned to center vertically within the 0-320px top region

   **Bottom half (y: 320-640) -- Condensed lifecycle flow:**
   - A simplified version of `branding/lifecycle-flow.svg` adapted for the bottom 320px:
     - 7 pipeline node pills, same data and phase coloring as Wave 2
     - Node sizing: ~120px wide, ~36px tall (slightly smaller than the full diagram)
     - Horizontal layout centered at y=~460 (vertically centered in the 320-640 region)
     - Arrows between nodes (same style, inline polygons)
     - Phase labels below ("Setup", "Planning", "Execution")
     - No title text -- the lifecycle flow is self-evident in this combined context
     - No loop indicator -- keep it clean for the social preview

   **Separation between halves:**
   - A subtle thin horizontal line at y=320: `<rect fill="#859289" opacity="0.15" x="100" y="320" width="1080" height="1"/>`

   **Font handling for rasterization:**
   - Because `rsvg-convert` renders on the local system where Noto Serif IS installed, `<text>` elements will render correctly in the PNG
   - The title still uses `<path>` elements (same as the banner) for consistency
   - Command and tagline `<text>` elements use the same font stacks as the banner

2. Validate the SVG:
   ```bash
   python3 -c "import xml.etree.ElementTree as ET; ET.parse('branding/social-preview-source.svg'); print('Valid XML')"
   ```

**What NOT to do:**
- Do NOT simply scale the banner SVG to 1280x640 -- that would stretch the 320px-tall design to 640px, leaving the bottom half of the social preview as empty dark space. The social preview must be a NEW composition.
- Do NOT remove the path-based title and replace with `<text>` -- keep consistency with the banner.
- Do NOT add rounded corners to the outer SVG for the social preview -- social platforms crop/clip the image themselves.
- Do NOT use `<image>` to embed the banner or lifecycle SVGs -- inline all elements directly.

**Verification:**
```bash
# 1. Valid XML
python3 -c "import xml.etree.ElementTree as ET; ET.parse('branding/social-preview-source.svg'); print('PASS: valid XML')"

# 2. Correct dimensions
python3 -c "
import xml.etree.ElementTree as ET
root = ET.parse('branding/social-preview-source.svg').getroot()
assert root.get('width') == '1280'
assert root.get('height') == '640'
print('PASS: 1280x640')
"

# 3. Contains path elements (title)
python3 -c "
import xml.etree.ElementTree as ET
tree = ET.parse('branding/social-preview-source.svg')
paths = [e for e in tree.iter() if e.tag.endswith('path')]
assert len(paths) >= 5, f'Expected >=5 paths for title, found {len(paths)}'
print(f'PASS: {len(paths)} path elements')
"

# 4. No style/class
python3 -c "
import xml.etree.ElementTree as ET
tree = ET.parse('branding/social-preview-source.svg')
for elem in tree.iter():
    assert 'class' not in elem.attrib, f'class on <{elem.tag}>'
    assert 'style' not in elem.attrib, f'style on <{elem.tag}>'
styles = [e for e in tree.iter() if e.tag.endswith('style')]
assert len(styles) == 0
print('PASS: no style/class')
"
```

---

## Task 2: Rasterize social preview PNG

**What:** Convert the social preview source SVG to a 1280x640 PNG using `rsvg-convert`.

**Why:** GitHub requires the social preview to be a raster image (PNG or JPEG). The PNG is committed as a binary artifact.

**How:**

1. Run rsvg-convert:
   ```bash
   rsvg-convert \
     --width 1280 \
     --height 640 \
     --background-color '#2d353b' \
     -o branding/social-preview.png \
     branding/social-preview-source.svg
   ```

2. Verify the PNG:
   ```bash
   # Check file exists and has reasonable size (should be 50KB-500KB)
   ls -la branding/social-preview.png

   # Check dimensions with file/identify
   file branding/social-preview.png
   ```

3. Verify PNG dimensions using Python (no external dependencies):
   ```bash
   python3 -c "
   import struct
   with open('branding/social-preview.png', 'rb') as f:
       sig = f.read(8)
       assert sig == b'\\x89PNG\\r\\n\\x1a\\n', 'Not a valid PNG'
       chunk_len = struct.unpack('>I', f.read(4))[0]
       chunk_type = f.read(4)
       assert chunk_type == b'IHDR', f'Expected IHDR, got {chunk_type}'
       width = struct.unpack('>I', f.read(4))[0]
       height = struct.unpack('>I', f.read(4))[0]
       assert width == 1280, f'Width {width} != 1280'
       assert height == 640, f'Height {height} != 640'
       print(f'PASS: PNG is {width}x{height}')
   "
   ```

**What NOT to do:**
- Do NOT use `--keep-aspect-ratio` flag -- we want exact 1280x640 dimensions.
- Do NOT use `--dpi-x`/`--dpi-y` flags -- width/height in pixels is sufficient.
- Do NOT delete `branding/social-preview-source.svg` after rasterization -- keep it for reproducibility.

**Verification:**
```bash
# 1. PNG exists
test -f branding/social-preview.png && echo "PASS: PNG exists" || echo "FAIL"

# 2. PNG is valid and correct dimensions
python3 -c "
import struct
with open('branding/social-preview.png', 'rb') as f:
    sig = f.read(8)
    assert sig == b'\\x89PNG\\r\\n\\x1a\\n', 'Invalid PNG signature'
    f.read(4)  # chunk length
    assert f.read(4) == b'IHDR'
    w = struct.unpack('>I', f.read(4))[0]
    h = struct.unpack('>I', f.read(4))[0]
    assert w == 1280 and h == 640, f'Dimensions {w}x{h} != 1280x640'
print('PASS: valid 1280x640 PNG')
"

# 3. File size sanity (between 10KB and 2MB)
python3 -c "
import os
size = os.path.getsize('branding/social-preview.png')
assert 10000 < size < 2000000, f'PNG size {size} bytes is outside expected range'
print(f'PASS: PNG size {size} bytes')
"

# 4. Source SVG retained
test -f branding/social-preview-source.svg && echo "PASS: source SVG retained" || echo "FAIL"
```

---

## Success Criteria

1. `branding/social-preview-source.svg` exists, is valid XML at 1280x640, contains banner text + condensed lifecycle flow
2. `branding/social-preview.png` exists as a valid 1280x640 PNG rasterized from the source SVG
3. PNG file size is reasonable (10KB-2MB)
4. Source SVG uses only inline presentation attributes (no `<style>`/`class`/`style`)
5. All verification commands pass
6. All 5 contract exports are now satisfied:
   - `branding/banner-github.svg` (Wave 1)
   - `branding/lifecycle-flow.svg` (Wave 2)
   - `branding/agent-dispatch.svg` (Wave 2)
   - `branding/social-preview.png` (Wave 3)
   - `.gitattributes` (Wave 1)
