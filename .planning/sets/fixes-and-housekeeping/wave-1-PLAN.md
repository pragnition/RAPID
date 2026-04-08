# PLAN: fixes-and-housekeeping / Wave 1

**Objective:** Fix three bugs (version display, Kanban Ctrl+Enter save, shell config multi-match), fix a pre-existing test failure (stale 'executing' literals), and defer context regeneration per CONTEXT.md decision.

All five tasks touch disjoint files with no ordering dependencies, so they execute in a single wave.

---

## Task A: Fix Version Display -- Single Source of Truth

**Goal:** Replace three hardcoded `4.2.1` version strings with dynamic derivation from `package.json` (version `6.2.0`). After this change, bumping `package.json` version is the only action needed -- all three consumers auto-derive.

### A1: Vite build-time injection

**File:** `web/frontend/vite.config.ts`

- Import `readFileSync` from `node:fs` and `resolve` from `node:path` at the top of the file (ESM imports -- this is a Vite config file)
- Before the `defineConfig` call, read version: `const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));`
- Add a `define` block to the config object: `define: { __APP_VERSION__: JSON.stringify(pkg.version) }`
- The result should look like:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf-8"));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    tsconfigPaths: true,
  },
  // ... rest unchanged
});
```

### A2: TypeScript type declaration

**File:** `web/frontend/src/vite-env.d.ts`

- Add `declare const __APP_VERSION__: string;` after the existing `/// <reference types="vite/client" />` line

### A3: Update Sidebar.tsx

**File:** `web/frontend/src/components/layout/Sidebar.tsx`

- At lines 122-130, replace the version display block. Currently:
  ```tsx
  {isFull ? (
    <span className="text-muted text-xs">RAPID v4.2.1</span>
  ) : isCompact ? (
    <span className="text-muted text-xs flex justify-center" title="RAPID v4.2.1">
      v4
    </span>
  ) : null}
  ```
- Replace with code that uses `__APP_VERSION__`:
  - Define a constant: `const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';` (place this inside the component body, before the return, or as a module-level const)
  - Full mode: `<span className="text-muted text-xs">{appVersion ? `RAPID v${appVersion}` : 'RAPID'}</span>`
  - Compact mode: Show abbreviated major version. Extract major via `appVersion.split('.')[0]`. Display: `<span className="text-muted text-xs flex justify-center" title={appVersion ? `RAPID v${appVersion}` : 'RAPID'}>{appVersion ? `v${appVersion.split('.')[0]}` : ''}</span>`
- Fallback shows "RAPID" without version number per CONTEXT.md decision

### A4: Python __init__.py -- dynamic version from package.json

**File:** `web/backend/app/__init__.py`

- Replace the single-line `__version__ = "4.2.1"` with dynamic reading:
  ```python
  import json
  from pathlib import Path

  def _read_version() -> str:
      """Read version from the root package.json (single source of truth)."""
      try:
          pkg = Path(__file__).resolve().parent.parent.parent.parent / "package.json"
          return json.loads(pkg.read_text(encoding="utf-8"))["version"]
      except (FileNotFoundError, KeyError, json.JSONDecodeError):
          return "0.0.0"

  __version__ = _read_version()
  ```
- The path traversal is: `app/__init__.py` -> `app/` -> `backend/` -> `web/` -> project root (where `package.json` lives). That is 4 levels up from `__file__`, which means `.parent.parent.parent.parent`.
- Fallback returns `"0.0.0"` to ensure the module always imports cleanly
- `main.py:19` already does `from app import __version__` -- no change needed there

### A5: pyproject.toml -- dynamic version via setuptools

**File:** `web/backend/pyproject.toml`

- Remove the static `version = "4.2.1"` from the `[project]` table
- Add `dynamic = ["version"]` to the `[project]` table (right after the `name` key)
- Add a new section:
  ```toml
  [tool.setuptools.dynamic]
  version = {attr = "app.__version__"}
  ```
- This makes setuptools read the version from `app.__version__` at build/install time, which itself reads from `package.json` -- completing the single-source chain
- Place the `[tool.setuptools.dynamic]` section after the existing `[tool.setuptools.packages.find]` section

### Verification

```bash
# Check Vite config parses correctly
cd /home/kek/Projects/RAPID/web/frontend && node -e "import('./vite.config.ts')" 2>/dev/null || echo "Vite config syntax check needs build tool"

# Check Python __init__.py reads correct version
cd /home/kek/Projects/RAPID && python3 -c "import sys; sys.path.insert(0, 'web/backend'); from app import __version__; print(f'Python version: {__version__}'); assert __version__ == '6.2.0', f'Expected 6.2.0, got {__version__}'"

# Check no hardcoded 4.2.1 remains in owned files
grep -r "4.2.1" web/frontend/src/components/layout/Sidebar.tsx web/backend/app/__init__.py web/backend/pyproject.toml && echo "FAIL: hardcoded 4.2.1 found" || echo "PASS: no hardcoded 4.2.1"

# Check TypeScript declaration exists
grep "__APP_VERSION__" web/frontend/src/vite-env.d.ts && echo "PASS" || echo "FAIL"
```

---

## Task B: Add Ctrl+Enter / Cmd+Enter Save Shortcut to CardDetailModal

**Goal:** Pressing Ctrl+Enter (Windows/Linux) or Cmd+Enter (macOS) in the CardDetailModal saves and closes the modal, consistent with the existing Escape-to-close pattern.

**File:** `web/frontend/src/components/kanban/CardDetailModal.tsx`

### Implementation

1. **Wrap `handleSave` in `useCallback`:** The current `handleSave` is a plain function (lines 28-39). Wrap it in `useCallback` with dependencies `[title, description, card, onSave, onClose]` so it can be referenced stably in the keydown handler.

2. **Extend `handleKeyDown`:** Currently only handles Escape (lines 14-21). Add a second condition:
   ```tsx
   if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
     e.preventDefault();
     handleSave();
   }
   ```
   - `e.preventDefault()` prevents newline insertion in the textarea when Ctrl+Enter is pressed
   - `e.metaKey` covers Cmd on macOS
   - Place this condition BEFORE the Escape check (order does not technically matter since the conditions are mutually exclusive, but Ctrl+Enter is the more complex check)

3. **Update `handleKeyDown` dependencies:** Change from `[onClose]` to `[onClose, handleSave]`

4. **Do NOT add a keyboard shortcut hint to the Save button** -- keep it as plain "Save" per CONTEXT.md decision.

### Expected result

```tsx
const handleSave = useCallback(() => {
  const updates: { title?: string; description?: string } = {};
  if (title.trim() !== card.title) {
    updates.title = title.trim();
  }
  if (description !== card.description) {
    updates.description = description;
  }
  if (Object.keys(updates).length > 0) {
    onSave(card.id, updates);
  }
  onClose();
}, [title, description, card, onSave, onClose]);

const handleKeyDown = useCallback(
  (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      onClose();
    }
  },
  [onClose, handleSave],
);
```

### Verification

```bash
# TypeScript compilation check
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -30

# Verify the handler references both ctrlKey and metaKey
grep -n "ctrlKey\|metaKey" src/components/kanban/CardDetailModal.tsx && echo "PASS" || echo "FAIL"

# Verify preventDefault is called
grep -n "preventDefault" src/components/kanban/CardDetailModal.tsx && echo "PASS" || echo "FAIL"
```

---

## Task C: Remove `break` in Install Skill Shell Config Detection Loop

**Goal:** When detecting existing RAPID_TOOLS configuration, the install skill should check ALL shell config files, not just stop at the first match. Users with multiple shells (e.g., bash + fish) should see all configured files.

**File:** `skills/install/SKILL.md`

### Implementation

- At line 84, remove the `break` statement from the detection loop
- The loop (lines 81-86) currently reads:
  ```bash
  for f in ~/.bashrc ~/.bash_profile ~/.zshrc ~/.config/fish/config.fish ~/.profile; do
      if grep -qF "RAPID_TOOLS" "$f" 2>/dev/null; then
          echo "ALREADY_CONFIGURED=$f"
          break
      fi
  done
  ```
- After the fix:
  ```bash
  for f in ~/.bashrc ~/.bash_profile ~/.zshrc ~/.config/fish/config.fish ~/.profile; do
      if grep -qF "RAPID_TOOLS" "$f" 2>/dev/null; then
          echo "ALREADY_CONFIGURED=$f"
      fi
  done
  ```
- This only affects the detection/echo step. The actual config writing is still gated by AskUserQuestion, so no behavioral risk.

### Verification

```bash
# Verify no break remains in the detection loop
grep -A 5 "ALREADY_CONFIGURED" /home/kek/Projects/RAPID/skills/install/SKILL.md | grep -c "break" && echo "FAIL: break still present" || echo "PASS: break removed"
```

---

## Task D: Fix Stale 'executing' Set-Status Literals

**Goal:** Fix the pre-existing test failure in `status-rename.test.cjs` by removing two stale `'executing'` set-status references. The old status `'executing'` was renamed to `'executed'` for sets (waves/jobs still use `'executing'` legitimately).

### D1: Fix review.test.cjs

**File:** `src/commands/review.test.cjs`

- At line 37, change `status: 'executing'` to `status: 'executed'`
- This is a mock set status in test data. The review command requires the set to have been executed before review, so `'executed'` is the correct status.

### D2: Fix dag.cjs

**File:** `src/commands/dag.cjs`

- At line 79, remove the entire line `executing: '\x1b[92m',`
- Line 80 already has `executed: '\x1b[92m',` which is the correct current status name
- The `executing` entry is a stale duplicate color mapping that is never matched for set statuses

### Verification

```bash
# Run the status-rename test directly
cd /home/kek/Projects/RAPID && node --test src/lib/status-rename.test.cjs 2>&1

# Run the full test suite to ensure no regressions
cd /home/kek/Projects/RAPID && node --test src/commands/review.test.cjs 2>&1 | tail -10
cd /home/kek/Projects/RAPID && node --test src/commands/dag.test.cjs 2>&1 | tail -10
```

---

## Task E: Context File Regeneration -- DEFERRED

**Status:** Deferred to milestone close per CONTEXT.md decision.

**Rationale:** The `.planning/context/` files (CODEBASE.md, ARCHITECTURE.md, CONVENTIONS.md, STYLE_GUIDE.md) should be regenerated after all v6.3.0 sets are merged to capture the complete state. Regenerating now would produce stale output that needs re-generation anyway.

**Action:** No files modified. This task is tracked in `DEFERRED.md`.

---

## Success Criteria

1. **Version display:** `python3 -c "import sys; sys.path.insert(0, 'web/backend'); from app import __version__; assert __version__ == '6.2.0'"` passes
2. **Version display:** No `4.2.1` string exists in Sidebar.tsx, `__init__.py`, or `pyproject.toml`
3. **Ctrl+Enter:** `CardDetailModal.tsx` contains both `ctrlKey` and `metaKey` checks with `preventDefault`
4. **Shell config:** No `break` inside the ALREADY_CONFIGURED detection loop in `SKILL.md`
5. **Test fix:** `node --test src/lib/status-rename.test.cjs` passes with zero failures
6. **No regressions:** `node --test src/commands/review.test.cjs` and `node --test src/commands/dag.test.cjs` pass

## File Ownership

| File | Task | Action |
|------|------|--------|
| `web/frontend/vite.config.ts` | A1 | Modify -- add define block |
| `web/frontend/src/vite-env.d.ts` | A2 | Modify -- add type declaration |
| `web/frontend/src/components/layout/Sidebar.tsx` | A3 | Modify -- dynamic version |
| `web/backend/app/__init__.py` | A4 | Modify -- dynamic version read |
| `web/backend/pyproject.toml` | A5 | Modify -- dynamic version |
| `web/frontend/src/components/kanban/CardDetailModal.tsx` | B | Modify -- add Ctrl+Enter handler |
| `skills/install/SKILL.md` | C | Modify -- remove break |
| `src/commands/review.test.cjs` | D1 | Modify -- fix stale status |
| `src/commands/dag.cjs` | D2 | Modify -- remove stale color key |
