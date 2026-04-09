# Wave 1 PLAN: Hub Gallery Polish + New Artifact Types

## Objective

Add per-type badge colors to the hub page for all existing and new artifact types, and update the INFRA_FILES exclusion set in branding-artifacts.cjs if needed. This wave touches only the backend library files -- the prompt files are modified in later waves.

The SSE auto-reload pipeline is already fully functional (fs.watch -> debounce -> SSE `file-changed` -> browser reload). No code changes are needed for auto-reload itself. This wave focuses on making the hub page visually distinguish artifact types.

## Owned Files

| File | Action |
|------|--------|
| `src/lib/branding-server.cjs` | Modify `_generateHubPage()` to add per-type badge colors |
| `src/lib/branding-server.test.cjs` | Add tests for badge color rendering |

## Tasks

### Task 1: Add TYPE_COLORS map and per-type CSS classes to `_generateHubPage()`

**File:** `src/lib/branding-server.cjs`

**What to do:**

1. Inside `_generateHubPage()`, add a `TYPE_COLORS` constant mapping artifact types to hex color values:
   - `theme`: `#1f6feb` (blue -- existing default)
   - `logo`: `#e5534b` (red)
   - `wireframe`: `#57ab5a` (green)
   - `preview`: `#986ee2` (purple)
   - `guidelines`: `#cc6b2c` (orange)
   - `readme-template`: `#768390` (gray)
   - `component-library`: `#539bf5` (light blue)

2. In the CSS `<style>` block, replace the single `.type-badge` rule with dynamically generated per-type CSS classes. The pattern is `type-badge-{type}` with `background: {color}; color: #fff;`. Keep `.type-badge` as the base class (border-radius, padding, font-size, font-weight, align-self). Add a fallback `.type-badge` background color for unknown types.

3. In the artifact card rendering (the `manifest.map(...)` block), change the badge `class` from `"badge type-badge"` to `"badge type-badge type-badge-${escapedType}"` so the per-type color applies.

4. Export the `TYPE_COLORS` map from the module so tests can verify it.

**What NOT to do:**
- Do not change the SSE infrastructure, file watcher, or any server lifecycle code.
- Do not change the artifact CRUD endpoints.
- Do not change the untracked file card rendering (those stay with the `.untracked-badge` class).

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node -e "
const s = require('./src/lib/branding-server.cjs');
console.log('TYPE_COLORS exported:', typeof s.TYPE_COLORS === 'object');
console.log('Keys:', Object.keys(s.TYPE_COLORS).join(', '));
"
```

### Task 2: Add hub page badge color tests

**File:** `src/lib/branding-server.test.cjs`

**What to do:**

1. Add a new `describe('Hub page badge colors', ...)` block inside the existing `describe('branding-server.cjs', ...)`.

2. Add these tests:
   - **TYPE_COLORS has expected keys:** Verify `server.TYPE_COLORS` contains keys for `theme`, `logo`, `wireframe`, `preview`, `guidelines`, `readme-template`, `component-library`.
   - **Hub page renders per-type badge CSS classes:** Start a server, create an artifact with type `logo`, fetch `/`, and assert the HTML contains `type-badge-logo`.
   - **Hub page renders per-type badge CSS rules:** Fetch `/` and assert the `<style>` block contains `.type-badge-theme` and `.type-badge-logo` CSS class definitions.
   - **Unknown artifact types get base badge styling:** Create an artifact with type `custom-thing`, fetch `/`, and assert the HTML contains `type-badge-custom-thing` class on the badge element (the base `.type-badge` fallback color applies).

3. Each test should use the existing `_getFreePort()` and `_fetch()` helpers already defined in the test file.

**What NOT to do:**
- Do not modify or remove any existing tests.
- Do not add tests for SSE, CRUD, or server lifecycle -- those are already covered.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/branding-server.test.cjs 2>&1 | tail -20
```

## Success Criteria

1. `_generateHubPage()` produces CSS with per-type badge colors for all 7 artifact types.
2. Artifact cards in the hub HTML use `type-badge-{type}` CSS classes.
3. Unknown artifact types fall back to a default badge color.
4. All existing tests pass (39/39 server tests).
5. New badge color tests pass.
6. `TYPE_COLORS` is exported from `branding-server.cjs`.
