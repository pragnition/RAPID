# PLAN: branding-assets / Wave 1

**Set:** branding-assets
**Wave:** 1 of 3
**Objective:** Create the foundation banner SVG and .gitattributes file. The banner establishes the Everforest visual language (palette, typography hierarchy, inline-attribute conventions) that Waves 2 and 3 inherit.

## File Ownership

| File | Action |
|------|--------|
| `branding/banner-github.svg` | Create |
| `.gitattributes` | Create |

## Palette Reference

All SVGs in this set use these Everforest colors exclusively:

| Token | Hex | Usage |
|-------|-----|-------|
| bg | `#2d353b` | Background fill |
| fg | `#d3c6aa` | Title text (warm beige) |
| grey | `#859289` | Command text, tagline text |
| green | `#a7c080` | Planning phase accent |
| cyan | `#7fbbb3` | Execution phase accent |
| red | `#e67e80` | Error/alert accent (not used in banner) |
| yellow | `#dbbc7f` | Warning accent (not used in banner) |
| purple | `#d699b6` | Special accent (not used in banner) |

---

## Task 1: Extract RAPID title glyph paths from Noto Serif Bold

**What:** Use Python fontTools to extract SVG path data for the five glyphs R, A, P, I, D from Noto Serif Bold, with Y-axis flipped for direct SVG use (fonts use Y-up, SVG uses Y-down).

**Why:** The banner title must be rendered as `<path>` elements (not `<text>`) to avoid font-dependency failures on systems lacking Georgia or Noto Serif. This satisfies the `title-as-paths` behavioral contract.

**How:**

1. Write a Python script `branding/extract-paths.py` that:
   - Opens `/usr/share/fonts/noto/NotoSerif-Bold.ttf` via `fontTools.ttLib.TTFont`
   - For each glyph in `['R', 'A', 'P', 'I', 'D']`:
     - Gets the glyph set from `font.getGlyphSet()`
     - Records the glyph via a `fontTools.pens.recordingPen.RecordingPen`
     - Replays into a `fontTools.pens.t2Pen.T2Pen` or uses `fontTools.pens.svgPathPen.SVGPathPen` to produce an SVG path `d` attribute string
     - Applies Y-axis flip by negating all Y coordinates (the font's UPM is 1000, so flip about y=0 and translate by ascender height afterward)
     - Gets advance width from `font['hmtx']` table
   - Outputs a JSON file `branding/glyph-paths.json` with structure:
     ```json
     {
       "upm": 1000,
       "ascender": <value from OS/2 table sTypoAscender>,
       "glyphs": {
         "R": { "path": "M...", "advance": 712 },
         "A": { "path": "M...", "advance": 753 },
         "P": { "path": "M...", "advance": 638 },
         "I": { "path": "M...", "advance": 401 },
         "D": { "path": "M...", "advance": 767 }
       }
     }
     ```

2. Run the script: `python3 branding/extract-paths.py`

3. Verify the output JSON exists and contains valid SVG path strings:
   ```bash
   python3 -c "import json; d=json.load(open('branding/glyph-paths.json')); assert all(g in d['glyphs'] for g in 'RAPID'); assert all(d['glyphs'][g]['path'].startswith('M') for g in 'RAPID'); print('OK:', {g: len(d['glyphs'][g]['path']) for g in 'RAPID'})"
   ```

**What NOT to do:**
- Do NOT use raw font coordinates without flipping Y. SVG Y increases downward; font Y increases upward. Unflipped paths render upside-down.
- Do NOT hardcode path data. Always extract programmatically so the process is reproducible.
- Do NOT delete the extraction script after use -- keep it in `branding/` for reproducibility.

**Verification:**
```bash
python3 -c "import json; d=json.load(open('branding/glyph-paths.json')); assert d['upm'] == 1000; assert len(d['glyphs']) == 5; assert all(d['glyphs'][g]['path'].startswith('M') for g in 'RAPID'); print('PASS: all 5 glyph paths extracted')"
```

---

## Task 2: Create the banner SVG (branding/banner-github.svg)

**What:** Create a 1280x320 SVG banner following the G1 mockup from `branding-direction-v8.html` with the Everforest dark palette.

**Why:** This is the primary visual asset for RAPID's GitHub README header. It must survive GitHub's SVG sanitizer (Camo proxy) which strips `<style>` blocks and CSS classes.

**How:**

1. Create `branding/banner-github.svg` with these specifications:

   **Canvas:**
   - `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 320" width="1280" height="320">`
   - Background: `<rect fill="#2d353b" width="1280" height="320" rx="12"/>`

   **Layout (vertically centered in 320px height):**
   - Command text: vertically centered ~110px from top
   - Title paths: vertically centered ~155px from top (center of 320)
   - Tagline text: vertically centered ~210px from top
   - Subtle thin horizontal rules (1px, fill `#859289`, opacity 0.3) above and below the title group for framing -- positioned roughly 8-12px outside the title path bounds

   **Command text (`/rapid:init`):**
   - `<text>` element, NOT a path
   - Attributes: `x="640" y="110" text-anchor="middle" fill="#859289" font-family="'Courier New', 'Liberation Mono', monospace" font-size="13" letter-spacing="4"`
   - Content: `/rapid:init`

   **Title (`RAPID`):**
   - Five `<path>` elements from the extracted glyph data (Task 1 output)
   - Each path wrapped in a `<g>` with a `transform="translate(X, Y) scale(0.046)"` where:
     - Scale factor = 46px / 1000 UPM = 0.046
     - Total scaled width = (712 + 753 + 638 + 401 + 767) * 0.046 + (4 * 10px letter-spacing) = ~150.5 + 40 = ~190.5px
     - Starting X = (1280 - 190.5) / 2 = ~544.75
     - Each subsequent glyph X = previous X + (previous advance * 0.046) + 10px letter-spacing
     - Y position: align baseline around y=155 (adjust so glyphs visually center)
   - Each path: `fill="#d3c6aa"`

   **Tagline:**
   - `<text>` element
   - Attributes: `x="640" y="210" text-anchor="middle" fill="#859289" font-family="'Noto Serif', Georgia, 'Times New Roman', serif" font-size="14" font-style="italic"`
   - Content: `Agentic Parallelisable and Isolatable Development`
   - Note: font-size is 14px (not 11px from mockup) because the SVG renders at a smaller effective size on GitHub and 14px meets WCAG AA large-text threshold for grey on dark bg

   **Decorative rules:**
   - Two thin horizontal lines framing the title:
     - `<rect fill="#859289" opacity="0.3" x="480" y="130" width="320" height="1"/>`
     - `<rect fill="#859289" opacity="0.3" x="480" y="188" width="320" height="1"/>`
   - Adjust exact Y positions so rules sit symmetrically above and below the title paths

   **Critical constraints:**
   - NO `<style>` blocks
   - NO `class` attributes
   - NO `<defs>` for styling (structural `<defs>` for reusable shapes are fine but not needed here)
   - NO `style` attribute (use presentation attributes only: `fill`, `font-family`, `font-size`, etc.)
   - NO external resources (`<image>`, `xlink:href`, `@import`)
   - NO JavaScript

2. Validate the SVG is well-formed XML:
   ```bash
   python3 -c "import xml.etree.ElementTree as ET; ET.parse('branding/banner-github.svg'); print('Valid XML')"
   ```

**What NOT to do:**
- Do NOT use `class` or `<style>` -- GitHub strips these.
- Do NOT use the `style` attribute (e.g., `style="fill: red"`) -- use presentation attributes (`fill="red"`).
- Do NOT set font-size below 14px for the grey text -- it must meet WCAG AA large-text contrast ratio.
- Do NOT use `font-weight="900"` on `<text>` elements -- the actual rendered weight depends on available fonts and 900 may not match. Use `font-weight="bold"` for text elements.

**Verification:**
```bash
# 1. Valid XML
python3 -c "import xml.etree.ElementTree as ET; tree = ET.parse('branding/banner-github.svg'); root = tree.getroot(); print('Valid XML')"

# 2. No <style> blocks
python3 -c "
import xml.etree.ElementTree as ET
tree = ET.parse('branding/banner-github.svg')
ns = {'svg': 'http://www.w3.org/2000/svg'}
styles = tree.findall('.//svg:style', ns) + tree.findall('.//style')
assert len(styles) == 0, f'Found {len(styles)} <style> elements'
print('PASS: no <style> blocks')
"

# 3. No class attributes
python3 -c "
import xml.etree.ElementTree as ET
tree = ET.parse('branding/banner-github.svg')
for elem in tree.iter():
    assert 'class' not in elem.attrib, f'Found class attr on <{elem.tag}>'
print('PASS: no class attributes')
"

# 4. No style attributes
python3 -c "
import xml.etree.ElementTree as ET
tree = ET.parse('branding/banner-github.svg')
for elem in tree.iter():
    assert 'style' not in elem.attrib, f'Found style attr on <{elem.tag}>'
print('PASS: no style attributes')
"

# 5. Contains path elements (title as paths)
python3 -c "
import xml.etree.ElementTree as ET
tree = ET.parse('branding/banner-github.svg')
ns = {'svg': 'http://www.w3.org/2000/svg'}
paths = tree.findall('.//svg:path', ns) + tree.findall('.//path')
assert len(paths) >= 5, f'Expected >=5 path elements for RAPID title, found {len(paths)}'
print(f'PASS: {len(paths)} path elements found')
"

# 6. Correct dimensions
python3 -c "
import xml.etree.ElementTree as ET
tree = ET.parse('branding/banner-github.svg')
root = tree.getroot()
assert root.get('width') == '1280', f'Width is {root.get(\"width\")}'
assert root.get('height') == '320', f'Height is {root.get(\"height\")}'
print('PASS: dimensions 1280x320')
"
```

---

## Task 3: Create .gitattributes

**What:** Create a `.gitattributes` file at the repository root with binary/text markers for common file types.

**Why:** Ensures PNG files are treated as binary (no line-ending conversion, binary diff), SVG files are treated as text, and other source files have consistent line-ending handling.

**How:**

1. Create `.gitattributes` at the repository root with this content:

   ```
   # Auto-detect text files and normalize line endings
   * text=auto

   # Source files
   *.cjs text eol=lf
   *.js text eol=lf
   *.mjs text eol=lf
   *.json text eol=lf
   *.md text eol=lf
   *.sh text eol=lf
   *.fish text eol=lf

   # SVG as text with diff
   *.svg text eol=lf diff

   # Binary assets
   *.png binary
   *.jpg binary
   *.ico binary
   *.woff binary
   *.woff2 binary

   # Generated — do not diff
   *.png -diff
   ```

**What NOT to do:**
- Do NOT add entries for file types not present in this repository (e.g., `.rs`, `.go`, `.py` -- Python scripts in branding/ are tooling, not project source).
- Do NOT use Windows-style line endings (`eol=crlf`) for any file type.

**Verification:**
```bash
# 1. File exists
test -f .gitattributes && echo "PASS: .gitattributes exists" || echo "FAIL"

# 2. PNG marked binary
grep -q '^\*\.png binary' .gitattributes && echo "PASS: PNG binary" || echo "FAIL"

# 3. SVG marked text
grep -q '^\*\.svg text' .gitattributes && echo "PASS: SVG text" || echo "FAIL"

# 4. No Windows line endings in the file itself
file .gitattributes | grep -v CRLF && echo "PASS: no CRLF" || echo "FAIL"
```

---

## Success Criteria

1. `branding/glyph-paths.json` exists with 5 glyph path entries (R, A, P, I, D)
2. `branding/extract-paths.py` exists and is reproducible (running it regenerates identical output)
3. `branding/banner-github.svg` is valid XML, 1280x320, contains no `<style>`/`class`/`style` attributes, and has >= 5 `<path>` elements for the title
4. `.gitattributes` exists with PNG binary and SVG text markers
5. All verification commands pass
