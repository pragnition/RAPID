# PLAN: branding-assets / Wave 2

**Set:** branding-assets
**Wave:** 2 of 3
**Objective:** Create the two diagram SVGs -- the horizontal lifecycle flow and the vertical agent dispatch diagram. Both inherit the Everforest visual language and inline-attribute conventions established by the banner in Wave 1.

## File Ownership

| File | Action |
|------|--------|
| `branding/lifecycle-flow.svg` | Create |
| `branding/agent-dispatch.svg` | Create |

## Shared Design Conventions (from Wave 1 banner)

- **Palette:** bg `#2d353b`, fg `#d3c6aa`, grey `#859289`, green `#a7c080`, cyan `#7fbbb3`
- **Phase colors:**
  - Setup (init, start-set): `#859289` (grey) fill with `#d3c6aa` (beige) text
  - Planning (discuss, plan): `#a7c080` (green) fill with `#2d353b` (dark) text
  - Execution (execute, review, merge): `#7fbbb3` (cyan) fill with `#2d353b` (dark) text
- **Shapes:** Rounded rectangles `rx="6"` or `rx="8"`, clean fill, no stroke borders
- **Connectors:** Thin lines (`stroke-width="1.5"`) with small triangle arrowheads
- **Constraints:** No `<style>`, no `class`, no `style` attribute, inline presentation attributes only
- **Font stacks:** `font-family="'Noto Serif', Georgia, 'Times New Roman', serif"` for labels; `font-family="'Courier New', 'Liberation Mono', monospace"` for command names

---

## Task 1: Create lifecycle flow SVG (branding/lifecycle-flow.svg)

**What:** Create a ~1280x200 horizontal pipeline diagram showing the 7 RAPID lifecycle stages from init to merge.

**Why:** Gives newcomers an immediate visual overview of the RAPID workflow. Referenced by the README (via the readme-migration set) as an inline diagram.

**How:**

1. Create `branding/lifecycle-flow.svg` with these specifications:

   **Canvas:**
   - `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 200" width="1280" height="200">`
   - Background: `<rect fill="#2d353b" width="1280" height="200" rx="8"/>`

   **Title (optional, small):**
   - `<text x="640" y="28" text-anchor="middle" fill="#d3c6aa" font-family="'Noto Serif', Georgia, 'Times New Roman', serif" font-size="14" font-weight="bold">RAPID Lifecycle</text>`

   **7 Pipeline Nodes:**
   Each node is a rounded rectangle pill with two lines of text inside:
   - Line 1 (command name): monospace, 12-13px, centered
   - Line 2 (description): serif, 9-10px, centered, slightly lighter/lower opacity

   Node data (left to right):

   | # | Command | Subtitle | Phase | Fill | Text Fill |
   |---|---------|----------|-------|------|-----------|
   | 1 | init | Research & Plan | Setup | `#859289` | `#d3c6aa` |
   | 2 | start-set | Create Worktree | Setup | `#859289` | `#d3c6aa` |
   | 3 | discuss | Capture Vision | Planning | `#a7c080` | `#2d353b` |
   | 4 | plan | Write Tasks | Planning | `#a7c080` | `#2d353b` |
   | 5 | execute | Implement | Execution | `#7fbbb3` | `#2d353b` |
   | 6 | review | Verify Quality | Execution | `#7fbbb3` | `#2d353b` |
   | 7 | merge | Integrate | Execution | `#7fbbb3` | `#2d353b` |

   **Node sizing and layout:**
   - Node width: ~140px each (enough for longest command name "start-set" + padding)
   - Node height: ~48px
   - Node `rx="8"` for pill shape
   - 7 nodes with ~22px gaps between them
   - Total: 7 * 140 + 6 * 22 = 980 + 132 = 1112px; centered in 1280px, starting at x = (1280 - 1112) / 2 = 84
   - Vertical center: nodes at y = (200 - 48) / 2 = ~76 (adjust for title presence; with title at y=28, shift nodes down to ~90)

   **Connectors between nodes:**
   - 6 arrows connecting adjacent nodes
   - Each arrow: a horizontal `<line>` from right edge of node N to left edge of node N+1
   - Line attributes: `stroke="#d3c6aa" stroke-width="1.5" opacity="0.5"`
   - Small triangle arrowhead at the destination end:
     - Use a `<polygon>` with 3 points forming a right-pointing triangle, ~6px wide, ~8px tall
     - `fill="#d3c6aa" opacity="0.5"`

   **Phase grouping indicator (optional):**
   - Small phase label text below each group:
     - "Setup" below nodes 1-2, centered
     - "Planning" below nodes 3-4, centered
     - "Execution" below nodes 5-7, centered
   - `font-size="9" fill="#859289" opacity="0.6" font-family="'Noto Serif', Georgia, serif"`

   **Loop indicator:**
   - A curved arrow from "merge" (node 7) back toward "start-set" (node 2) indicating that sets 2-7 repeat
   - Implemented as a `<path>` with a curved arc below the main pipeline row
   - `stroke="#d3c6aa" stroke-width="1" opacity="0.3" fill="none"`
   - Small label: `<text font-size="8" fill="#859289" opacity="0.5">repeat per set</text>` near the arc

2. Validate the SVG:
   ```bash
   python3 -c "import xml.etree.ElementTree as ET; ET.parse('branding/lifecycle-flow.svg'); print('Valid XML')"
   ```

**What NOT to do:**
- Do NOT use CSS gradients or filters -- GitHub strips them.
- Do NOT use `<marker>` for arrowheads -- GitHub's sanitizer may strip `<defs>` content. Use inline `<polygon>` elements instead.
- Do NOT make nodes too small -- text must be readable when the SVG renders at ~900px width on GitHub.
- Do NOT use `<use>` elements referencing `<defs>` -- some sanitizers strip these. Repeat the shapes inline.

**Verification:**
```bash
# 1. Valid XML
python3 -c "import xml.etree.ElementTree as ET; ET.parse('branding/lifecycle-flow.svg'); print('PASS: valid XML')"

# 2. No style/class
python3 -c "
import xml.etree.ElementTree as ET
tree = ET.parse('branding/lifecycle-flow.svg')
for elem in tree.iter():
    assert 'class' not in elem.attrib, f'class on <{elem.tag}>'
    assert 'style' not in elem.attrib, f'style on <{elem.tag}>'
styles = [e for e in tree.iter() if e.tag.endswith('style')]
assert len(styles) == 0, 'Found <style> elements'
print('PASS: no style/class')
"

# 3. Correct dimensions
python3 -c "
import xml.etree.ElementTree as ET
root = ET.parse('branding/lifecycle-flow.svg').getroot()
assert root.get('width') == '1280'
assert root.get('height') == '200'
print('PASS: 1280x200')
"

# 4. Contains 7 rounded rects (nodes) + 1 bg rect = at least 8 rect elements
python3 -c "
import xml.etree.ElementTree as ET
tree = ET.parse('branding/lifecycle-flow.svg')
rects = [e for e in tree.iter() if e.tag.endswith('rect')]
assert len(rects) >= 8, f'Expected >=8 rects, found {len(rects)}'
print(f'PASS: {len(rects)} rect elements')
"
```

---

## Task 2: Create agent dispatch SVG (branding/agent-dispatch.svg)

**What:** Create a ~1280x600 vertical diagram showing which agents each RAPID lifecycle command spawns.

**Why:** Gives users a clear picture of the parallel agent architecture -- the core innovation of RAPID. Referenced by the README as an inline diagram.

**How:**

1. Create `branding/agent-dispatch.svg` with these specifications:

   **Canvas:**
   - `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 600" width="1280" height="600">`
   - Background: `<rect fill="#2d353b" width="1280" height="600" rx="8"/>`

   **Title:**
   - `<text x="640" y="32" text-anchor="middle" fill="#d3c6aa" font-family="'Noto Serif', Georgia, 'Times New Roman', serif" font-size="14" font-weight="bold">Agent Dispatch Architecture</text>`

   **Layout: grouped horizontal rows**

   Each command gets a full-width row consisting of:
   - Left column (~200px): command name pill (rounded rect, phase-colored)
   - Right area (~1040px): agent name pills laid out horizontally, wrapping if needed
   - Rows separated by thin horizontal dividers (`fill="#859289" opacity="0.15"`)

   **Command-to-Agent data:**

   | Command | Phase | Agents |
   |---------|-------|--------|
   | /rapid:init | Setup | codebase-synthesizer, research-stack, research-features, research-architecture, research-pitfalls, research-oversights, research-ux, research-synthesizer, roadmapper |
   | /rapid:start-set | Setup | set-planner |
   | /rapid:discuss-set | Planning | research-stack |
   | /rapid:plan-set | Planning | research-stack, planner, plan-verifier |
   | /rapid:execute-set | Execution | executor (x N waves), verifier |
   | /rapid:review | Execution | scoper |
   | /rapid:merge | Execution | set-merger (x N sets), conflict-resolver |

   **Row sizing:**
   - Row height: ~70px for commands with many agents (init), ~55px for commands with few agents
   - Total approximate height: title (40px) + 7 rows (~430px) + padding = ~500-580px
   - Adjust canvas height to fit (use 600px as specified, or reduce if content fits in less)

   **Command pill (left column):**
   - Rounded rect: width ~170px, height ~32px, `rx="6"`
   - Fill: phase color (grey for setup, green for planning, cyan for execution)
   - Text: command name in monospace, centered in the pill
   - Text fill: `#d3c6aa` for grey pills, `#2d353b` for green/cyan pills

   **Agent pills (right area):**
   - Rounded rect: width proportional to text length (~120-180px), height ~26px, `rx="4"`
   - Fill: same phase color but at reduced opacity (use a slightly darker/lighter variant or add opacity)
   - Actually, for clarity: use a subtler version -- fill the agent pills with the phase color at `opacity="0.25"` and use the full phase color for the text, OR use a darker bg pill with phase-colored text
   - Recommended approach: agent pills with `fill="#343f44"` (slightly lighter than bg) and text `fill` matching the phase color
   - Text: agent name (without "rapid-" prefix) in monospace, 10-11px
   - Horizontal gap between agent pills: ~8px
   - If agents wrap to a second line within a row, increase that row's height

   **Connector lines:**
   - A thin horizontal line from command pill right edge to first agent pill left edge
   - `stroke` matching phase color, `stroke-width="1"`, `opacity="0.4"`
   - For multi-agent rows, the line fans out (or simply use a horizontal line with small dots/ticks branching to each agent pill)
   - Simplest approach: a single horizontal line from command pill to the agent pill area, and the agent pills are self-explanatory by proximity

   **Row dividers:**
   - `<rect fill="#859289" opacity="0.1" x="40" y="{row_bottom}" width="1200" height="1"/>`
   - Between each command row

   **Agent count badges (optional enhancement):**
   - Small circled number next to each command pill showing count of agents spawned
   - `<circle fill="none" stroke="{phase_color}" stroke-width="1" r="9"/>` with `<text font-size="9">{count}</text>`

2. Validate:
   ```bash
   python3 -c "import xml.etree.ElementTree as ET; ET.parse('branding/agent-dispatch.svg'); print('Valid XML')"
   ```

**What NOT to do:**
- Do NOT include the "rapid-" prefix on agent names in the diagram -- it adds visual noise without information. Use short names: "codebase-synthesizer", "research-stack", etc.
- Do NOT use `<marker>` elements for arrowheads -- use inline shapes.
- Do NOT use `<use>` with `<defs>` references -- repeat shapes inline.
- Do NOT make text smaller than 10px -- it must be readable at GitHub's rendering width.

**Verification:**
```bash
# 1. Valid XML
python3 -c "import xml.etree.ElementTree as ET; ET.parse('branding/agent-dispatch.svg'); print('PASS: valid XML')"

# 2. No style/class
python3 -c "
import xml.etree.ElementTree as ET
tree = ET.parse('branding/agent-dispatch.svg')
for elem in tree.iter():
    assert 'class' not in elem.attrib, f'class on <{elem.tag}>'
    assert 'style' not in elem.attrib, f'style on <{elem.tag}>'
styles = [e for e in tree.iter() if e.tag.endswith('style')]
assert len(styles) == 0
print('PASS: no style/class')
"

# 3. Correct dimensions
python3 -c "
import xml.etree.ElementTree as ET
root = ET.parse('branding/agent-dispatch.svg').getroot()
assert root.get('width') == '1280'
assert root.get('height') == '600'
print('PASS: 1280x600')
"

# 4. Contains at least 7 command groups (check for 7+ text elements with command names)
python3 -c "
import xml.etree.ElementTree as ET
tree = ET.parse('branding/agent-dispatch.svg')
texts = [e.text for e in tree.iter() if e.tag.endswith('text') and e.text]
commands = ['init', 'start-set', 'discuss', 'plan', 'execute', 'review', 'merge']
found = sum(1 for cmd in commands if any(cmd in t for t in texts))
assert found >= 7, f'Only found {found}/7 command labels'
print(f'PASS: all 7 commands present')
"
```

---

## Success Criteria

1. `branding/lifecycle-flow.svg` exists, is valid XML, 1280x200, has 7 pipeline nodes with correct phase coloring, no `<style>`/`class`/`style` attributes
2. `branding/agent-dispatch.svg` exists, is valid XML, 1280x600, shows all 7 commands with their spawned agents, no `<style>`/`class`/`style` attributes
3. Both diagrams use the same Everforest palette and phase color scheme as the Wave 1 banner
4. All verification commands pass
5. Both SVGs use only inline presentation attributes (no CSS)
