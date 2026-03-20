# Wave 1: Project Scaffolding & Theme Foundation

## Objective

Bootstrap the Vite 8 + React 19 + TypeScript project under `web/frontend/` and establish the complete multi-theme CSS system. By the end of this wave, `npm run dev` serves a blank themed page with all 4 themes (Everforest, Catppuccin, Gruvbox, Tokyo Night) switchable via `data-theme` attribute, Tailwind 4.2 fully operational with `@theme inline` consuming CSS custom properties, and TypeScript compiling cleanly.

## Tasks

### Task 1: Initialize project structure and package.json

**Files created:**
- `web/frontend/package.json`
- `web/frontend/tsconfig.json`
- `web/frontend/tsconfig.app.json`
- `web/frontend/tsconfig.node.json`

**Actions:**
1. Create `web/frontend/package.json` with these exact dependencies:
   ```json
   {
     "name": "rapid-web",
     "private": true,
     "version": "0.0.0",
     "type": "module",
     "scripts": {
       "dev": "vite",
       "build": "tsc -b && vite build",
       "preview": "vite preview",
       "typecheck": "tsc -b --noEmit"
     },
     "dependencies": {
       "react": "^19.2.4",
       "react-dom": "^19.2.4",
       "react-router": "^7.13.1",
       "@tanstack/react-query": "^5.91.3",
       "zustand": "^5.0.12"
     },
     "devDependencies": {
       "vite": "^8.0.1",
       "@vitejs/plugin-react": "^6.0.1",
       "tailwindcss": "^4.2.2",
       "@tailwindcss/vite": "^4.2.2",
       "typescript": "^5.9.3",
       "@types/react": "^19.2.14",
       "@types/react-dom": "^19.2.5",
       "@tanstack/react-query-devtools": "^5.91.3"
     }
   }
   ```
2. Create `tsconfig.json` as a project-references root referencing `tsconfig.app.json` and `tsconfig.node.json`.
3. Create `tsconfig.app.json` targeting ES2022, with `jsx: "react-jsx"`, strict mode, path alias `@/*` mapping to `./src/*`, `moduleResolution: "bundler"`, and `include: ["src"]`.
4. Create `tsconfig.node.json` targeting ES2022, for `vite.config.ts` with `include: ["vite.config.ts"]`.
5. Run `cd web/frontend && npm install` to install all dependencies.

**Verification:**
```bash
cd web/frontend && node -e "require('./node_modules/vite/package.json').version" && echo "OK"
cd web/frontend && npx tsc -b --noEmit 2>&1 | head -5
```

**What NOT to do:**
- Do NOT create a `tailwind.config.js` or `tailwind.config.ts` -- Tailwind v4 uses CSS-first `@theme` directives, not JS config.
- Do NOT use `moduleResolution: "node"` -- use `"bundler"` for Vite compatibility.

---

### Task 2: Vite configuration and entry HTML

**Files created:**
- `web/frontend/vite.config.ts`
- `web/frontend/index.html`
- `web/frontend/src/vite-env.d.ts`

**Actions:**
1. Create `vite.config.ts`:
   - Import `defineConfig` from `vite`, `react` from `@vitejs/plugin-react`, `tailwindcss` from `@tailwindcss/vite`.
   - Plugins: `react()`, `tailwindcss()`.
   - Enable `resolve.tsconfigPaths: true` (Vite 8 built-in, replaces vite-tsconfig-paths plugin).
   - Set `server.port: 5173` and `server.strictPort: true`.
   - Set `server.proxy` to proxy `/api` to `http://127.0.0.1:8998` (avoids CORS issues in development).
2. Create `index.html` in the project root (not `src/`):
   - Standard HTML5 boilerplate with `<div id="root">`.
   - `<script type="module" src="/src/main.tsx">`.
   - Inline `<script>` in `<head>` that reads `localStorage.getItem('rapid-theme')` and `localStorage.getItem('rapid-mode')`, defaulting to `"everforest"` and `"dark"` respectively. Sets `document.documentElement.dataset.theme = themeId + '-' + mode` before any rendering to prevent flash of wrong theme.
   - The `<html>` tag starts with `lang="en"` and `data-theme="everforest-dark"` as fallback.
3. Create `src/vite-env.d.ts` with `/// <reference types="vite/client" />`.

**Verification:**
```bash
cd web/frontend && npx tsc -b --noEmit
```

**What NOT to do:**
- Do NOT add `esbuild` config -- Vite 8 uses Oxc, not esbuild.
- Do NOT use `build.rollupOptions` -- Vite 8 uses `build.rolldownOptions`.

---

### Task 3: Theme CSS files -- Everforest palette

**Files created:**
- `web/frontend/src/styles/themes/everforest-dark.css`
- `web/frontend/src/styles/themes/everforest-light.css`

**Actions:**
1. Create `everforest-dark.css` defining all theme tokens under `[data-theme="everforest-dark"]` selector. All custom properties use the `--th-` prefix (theme-generic). Tokens to define:
   - **Backgrounds:** `--th-bg-dim: #232A2E`, `--th-bg-0: #2D353B`, `--th-bg-1: #343F44`, `--th-bg-2: #3D484D`, `--th-bg-3: #475258`, `--th-bg-4: #4F585E`
   - **Foreground:** `--th-fg: #D3C6AA`, `--th-fg-dim: #9DA9A0`
   - **Semantic colors:** `--th-accent: #A7C080` (green), `--th-link: #83C092` (aqua), `--th-warning: #DBBC7F` (yellow), `--th-error: #E67E80` (red), `--th-info: #7FBBB3` (blue), `--th-muted: #859289` (grey), `--th-highlight: #D699B6` (purple), `--th-orange: #E69875`
   - **Surface hierarchy:** `--th-surface-0` through `--th-surface-4` mapping to bg0-bg4.
   - **UI tokens:** `--th-border: #475258`, `--th-hover: #3D484D`, `--th-active: #475258`, `--th-selection: rgba(167, 192, 128, 0.2)`
2. Create `everforest-light.css` with the same token names under `[data-theme="everforest-light"]`:
   - **Backgrounds:** `--th-bg-dim: #EFEBD4`, `--th-bg-0: #FDF6E3`, `--th-bg-1: #F4F0D9`, `--th-bg-2: #EFEBD4`, `--th-bg-3: #E6E2CC`, `--th-bg-4: #E0DCC7`
   - **Foreground:** `--th-fg: #5C6A72`, `--th-fg-dim: #829181`
   - **Semantic colors:** `--th-accent: #8DA101` (green), `--th-link: #35A77C` (aqua), `--th-warning: #DFA000` (yellow), `--th-error: #F85552` (red), `--th-info: #3A94C5` (blue), `--th-muted: #939F91` (grey), `--th-highlight: #DF69BA` (purple), `--th-orange: #F57D26`
   - Surface, border, hover, active, selection tokens mapped to the light palette equivalents.

**Verification:**
- Manually inspect file for valid CSS syntax (no JS validation needed at this stage).

---

### Task 4: Theme CSS files -- Catppuccin, Gruvbox, Tokyo Night

**Files created:**
- `web/frontend/src/styles/themes/catppuccin-dark.css`
- `web/frontend/src/styles/themes/catppuccin-light.css`
- `web/frontend/src/styles/themes/gruvbox-dark.css`
- `web/frontend/src/styles/themes/gruvbox-light.css`
- `web/frontend/src/styles/themes/tokyonight-dark.css`
- `web/frontend/src/styles/themes/tokyonight-light.css`

**Actions:**
1. Create each file defining the same `--th-*` CSS custom properties as the Everforest files, but using the correct palette values for each theme. Use the official palette sources:
   - **Catppuccin Mocha (dark):** Base #1E1E2E, Mantle #181825, Crust #11111B, Text #CDD6F4, Green #A6E3A1, Teal #94E2D5, Yellow #F9E2AF, Red #F38BA8, Blue #89B4FA, Overlay0 #6C7086, Mauve #CBA6F7, Peach #FAB387
   - **Catppuccin Latte (light):** Base #EFF1F5, Mantle #E6E9EF, Crust #DCE0E8, Text #4C4F69, Green #40A02B, Teal #179299, Yellow #DF8E1D, Red #D20F39, Blue #1E66F5, Overlay0 #9CA0B0, Mauve #8839EF, Peach #FE640B
   - **Gruvbox Dark:** bg #282828, bg1 #3C3836, bg2 #504945, fg #EBDBB2, green #B8BB26, aqua #8EC07C, yellow #FABD2F, red #FB4934, blue #83A598, grey #928374, purple #D3869B, orange #FE8019
   - **Gruvbox Light:** bg #FBF1C7, bg1 #EBDBB2, bg2 #D5C4A1, fg #3C3836, green #79740E, aqua #427B58, yellow #B57614, red #CC241D, blue #076678, grey #928374, purple #8F3F71, orange #AF3A03
   - **Tokyo Night Storm (dark):** bg #24283B, bg-dark #1F2335, fg #C0CAF5, green #9ECE6A, teal #73DACA, yellow #E0AF68, red #F7768E, blue #7AA2F7, comment #565F89, purple #BB9AF7, orange #FF9E64
   - **Tokyo Night Day (light):** bg #E1E2E7, bg-dark #D5D6DB, fg #3760BF, green #587539, teal #118C74, yellow #8C6C3E, red #F52A65, blue #2E7DE9, comment #848CB5, purple #9854F1, orange #B15C00
2. Each file uses the `[data-theme="<name>-<mode>"]` selector pattern.
3. Map the theme-specific palette colors to the same semantic `--th-*` tokens defined for Everforest, ensuring functional equivalence (accent = green-like, link = aqua/teal, etc.).

**Verification:**
```bash
cd web/frontend && grep -c "^  --th-" src/styles/themes/*.css
```
Each file should have approximately the same number of custom property definitions (around 20-25).

---

### Task 5: Global stylesheet with Tailwind @theme integration

**Files created:**
- `web/frontend/src/styles/global.css`
- `web/frontend/src/styles/themes/index.css`

**Actions:**
1. Create `src/styles/themes/index.css` that `@import`s all 8 theme CSS files.
2. Create `src/styles/global.css`:
   - First line: `@import "tailwindcss";`
   - Second: `@import "./themes/index.css";`
   - Then a `@theme inline` block that maps generic Tailwind color tokens to the `--th-*` CSS custom properties:
     ```css
     @theme inline {
       --color-bg-dim: var(--th-bg-dim);
       --color-bg-0: var(--th-bg-0);
       --color-bg-1: var(--th-bg-1);
       --color-bg-2: var(--th-bg-2);
       --color-bg-3: var(--th-bg-3);
       --color-bg-4: var(--th-bg-4);
       --color-fg: var(--th-fg);
       --color-fg-dim: var(--th-fg-dim);
       --color-accent: var(--th-accent);
       --color-link: var(--th-link);
       --color-warning: var(--th-warning);
       --color-error: var(--th-error);
       --color-info: var(--th-info);
       --color-muted: var(--th-muted);
       --color-highlight: var(--th-highlight);
       --color-orange: var(--th-orange);
       --color-surface-0: var(--th-surface-0);
       --color-surface-1: var(--th-surface-1);
       --color-surface-2: var(--th-surface-2);
       --color-surface-3: var(--th-surface-3);
       --color-surface-4: var(--th-surface-4);
       --color-border: var(--th-border);
       --color-hover: var(--th-hover);
       --color-active: var(--th-active);
       --color-selection: var(--th-selection);
     }
     ```
   - After the `@theme` block, add base styles:
     ```css
     body {
       @apply bg-bg-0 text-fg antialiased;
       font-family: 'Inter', system-ui, -apple-system, sans-serif;
     }
     ```
   - Add smooth transition for theme changes: `*, *::before, *::after { transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease; }`

**Verification:**
```bash
cd web/frontend && npx tsc -b --noEmit
```

**What NOT to do:**
- Do NOT place `@theme` inside a selector or media query -- it must be top-level.
- Do NOT define actual color values in `@theme` -- only `var(--th-*)` references.
- Do NOT use `@tailwind base; @tailwind components; @tailwind utilities;` -- in Tailwind v4, `@import "tailwindcss"` replaces all three directives.

---

### Task 6: React entry point and minimal App shell

**Files created:**
- `web/frontend/src/main.tsx`
- `web/frontend/src/App.tsx`

**Actions:**
1. Create `src/main.tsx`:
   - Import `./styles/global.css` (must be first import to load Tailwind + themes).
   - Import `React` and `ReactDOM` from `react-dom/client`.
   - Import `App` from `./App`.
   - Use `ReactDOM.createRoot(document.getElementById('root')!)` and render `<App />` inside `<React.StrictMode>`.
2. Create `src/App.tsx`:
   - A minimal component that returns a `<div>` with a heading "RAPID Mission Control" styled with Tailwind theme classes (e.g., `text-fg bg-bg-0 min-h-screen`).
   - Include a small test paragraph demonstrating that theme colors work: "Theme is active" in `text-accent`.
   - This is a placeholder -- Wave 2 replaces the content with the full layout shell.

**Verification:**
```bash
cd web/frontend && npx vite build 2>&1 | tail -5
```
Build must succeed without errors. Output should show generated bundle files.

---

## Success Criteria

1. `cd web/frontend && npm run build` completes without errors.
2. All 8 theme CSS files define the same set of `--th-*` custom properties.
3. `data-theme` attribute on `<html>` controls which theme is active.
4. Tailwind utility classes like `bg-bg-0`, `text-fg`, `text-accent`, `bg-surface-1` are functional.
5. No `tailwind.config.js` or `tailwind.config.ts` exists -- CSS-first only.
6. The inline script in `index.html` applies the saved theme before React hydrates (no flash).

## File Ownership

All files in this wave are new creations. No overlap with Wave 2 or Wave 3.

| File | Status |
|------|--------|
| `web/frontend/package.json` | create |
| `web/frontend/tsconfig.json` | create |
| `web/frontend/tsconfig.app.json` | create |
| `web/frontend/tsconfig.node.json` | create |
| `web/frontend/vite.config.ts` | create |
| `web/frontend/index.html` | create |
| `web/frontend/src/vite-env.d.ts` | create |
| `web/frontend/src/main.tsx` | create |
| `web/frontend/src/App.tsx` | create |
| `web/frontend/src/styles/global.css` | create |
| `web/frontend/src/styles/themes/index.css` | create |
| `web/frontend/src/styles/themes/everforest-dark.css` | create |
| `web/frontend/src/styles/themes/everforest-light.css` | create |
| `web/frontend/src/styles/themes/catppuccin-dark.css` | create |
| `web/frontend/src/styles/themes/catppuccin-light.css` | create |
| `web/frontend/src/styles/themes/gruvbox-dark.css` | create |
| `web/frontend/src/styles/themes/gruvbox-light.css` | create |
| `web/frontend/src/styles/themes/tokyonight-dark.css` | create |
| `web/frontend/src/styles/themes/tokyonight-light.css` | create |
