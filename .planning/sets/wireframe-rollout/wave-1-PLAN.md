# PLAN: wireframe-rollout / Wave 1 — Primitives & Tokens Foundation

**Set:** wireframe-rollout
**Wave:** 1 of 3
**Status:** pending
**Set worktree path:** `.rapid-worktrees/wireframe-rollout/` (operate from this root; all paths below are relative unless noted)

## Objective

Produce the design-system substrate the rest of the set depends on. This wave introduces the full `components/primitives/` library, any additional theme tokens required to render the wireframe, and the matching `@theme inline` aliases in `global.css`. It performs **zero** feature-surface changes — no page edits, no layout/router/nav edits, no keybinding edits. Wave 2 consumes everything produced here.

Why: downstream sets (`web-tool-bridge`, `skill-invocation-ui`, `kanban-autopilot`, `agents-chats-tabs`) plus Wave 2 all depend on a stable primitive API. Eager creation per CONTEXT decision "Primitive Creation Strategy: Eager".

## File Ownership (exclusive)

Wave 1 owns exclusively:

- `web/frontend/src/components/primitives/**` (NEW directory — create and populate)
- `web/frontend/src/styles/themes/{everforest,catppuccin,gruvbox,tokyonight}-{dark,light}.css` — **additions only** (new `--th-*` declarations appended inside the existing `[data-theme="<id>-<mode>"]` block). Do NOT rename or delete existing tokens.
- `web/frontend/src/styles/global.css` — **additions only** to the `@theme inline { ... }` block (append new `--color-*` entries). Do NOT modify existing entries, the `@import` lines, the `body` rule, or the global `*` transition rule.

Wave 1 must NOT touch:

- `web/frontend/src/pages/**`
- `web/frontend/src/components/layout/**`
- `web/frontend/src/components/ui/**` (existing `CommandPalette.tsx`, `TooltipOverlay.tsx` are Wave 2 territory)
- `web/frontend/src/router.tsx`
- `web/frontend/src/types/layout.ts`
- `web/frontend/src/App.tsx`
- `web/frontend/src/hooks/useTheme.ts`, `web/frontend/src/hooks/useLayoutStore.ts`
- Any `.planning/sets/**/CONTRACT.json` or `.planning/sets/**/DEFINITION.md`

If a primitive genuinely needs to re-export something from `components/ui/`, do the re-export via a new file **inside** `components/primitives/` that imports from `@/components/ui/...` — do not edit `ui/` files.

## Tokens Pre-Audit (do this first — step 0)

Before creating any new token, enumerate the tokens the wireframe artifacts actually name and compare against the existing 25 aliases in `web/frontend/src/styles/global.css` (lines 4–30). Most wireframe surfaces already resolve via the existing set. Only add tokens that are genuinely missing and genuinely load-bearing for a wireframe-cited surface.

Read these artifacts end-to-end before deciding:

- `.planning/branding/BRANDING.md` (especially `<visual-identity>` table and the `<chat-surface>` section)
- `.planning/branding/wireframe.html` lines 60–230 (token block + structural CSS) and lines 640–1228 (four screens + command palette)
- `.planning/branding/chatbot-wireframe.html` (chat-surface tokens — tool-call cards, structured-question borders, composer, auto-scroll pill)
- `.planning/branding/guidelines.html` and `.planning/branding/components.html`

If an additional token IS needed (e.g. a 3px accent-border variant used only in tool cards), strongly prefer achieving it with existing tokens via Tailwind arbitrary values (per research risk R9: `border-l-[3px] border-accent` etc.) instead of inventing a new alias. Only introduce a new `--th-*` + `--color-*` pair when an arbitrary Tailwind expression cannot express the surface without a literal magic color.

Write the audit result (what tokens were needed; what was expressed with existing tokens + arbitrary values) as a short comment block at the top of `global.css` appended `@theme inline` additions. If the audit concludes zero new tokens are needed, say so explicitly in the comment and proceed — that is an acceptable outcome.

## Tasks

### Task 1 — Scaffold `components/primitives/` and an index barrel

**Create:** `web/frontend/src/components/primitives/index.ts` (empty barrel to start; each subsequent task appends its export line).

**Rule:** every primitive file exports both the component and its `*Props` interface. The barrel re-exports both. Example:
```
export { StatusDot, type StatusDotProps } from "./StatusDot";
```

Verification: `npx tsc -b` (from `web/frontend`) passes with the empty barrel.

### Task 2 — Atom primitives (6 files)

Each file lives at `web/frontend/src/components/primitives/<Name>.tsx`. Citations refer to `.planning/branding/` artifacts.

| File | Minimum API | Citation |
|------|-------------|----------|
| `StatusDot.tsx` | `interface StatusDotProps { tone: "accent"\|"link"\|"warning"\|"error"\|"info"\|"muted"\|"highlight"\|"orange"; size?: "sm"\|"md"; pulse?: boolean; className?: string; "aria-label"?: string }` — renders `<span>` with `w-2.5 h-2.5 rounded-full bg-<tone>`; `size=sm` → `w-2 h-2`; `pulse` adds `animate-pulse` (but suppressed when user prefers reduced motion via `usePrefersReducedMotion`). Always paired with visible label by caller. | BRANDING.md `<component-style>` "Status dots"; wireframe.html line 650 `<span class="dot">` pattern |
| `HealthDot.tsx` | `interface HealthDotProps { online: boolean; className?: string }` — composes `StatusDot` with `tone="accent"` online, `tone="error"` offline, `pulse` only when online. | wireframe.html lines 663, 802, 997 sidebar footer `<span class="health-dot">` |
| `StatusBadge.tsx` | `interface StatusBadgeProps { label: string; tone: StatusDotProps["tone"]; icon?: ReactNode; className?: string }` — `rounded px-2 py-0.5 text-xs font-mono font-semibold`, `bg-<tone>/20` + `text-<tone>`. Use Tailwind opacity modifier for the 20% tint. | BRANDING.md `<component-style>` "Badges"; wireframe.html section 01 metric card status strip |
| `Breadcrumb.tsx` | `interface BreadcrumbProps { segments: Array<{ label: string; to?: string }>; separator?: ReactNode }` — renders mono segments joined by `/` (default). Last segment is `text-fg`; prior segments `text-muted`. Unlinked segments render as `<span>`, linked via `<NavLink>` from `react-router`. | wireframe.html lines 671 header pattern "RAPID / Dashboard" |
| `Kbd.tsx` | `interface KbdProps { children: ReactNode; className?: string }` — renders `<kbd>` with `bg-surface-2 border border-border rounded px-1.5 py-0.5 text-xs font-mono text-muted`. | wireframe.html lines 185–190 `.mc-search kbd`; BRANDING.md `<interaction-patterns>` keyboard-first |
| `StreamingCursor.tsx` | `interface StreamingCursorProps { active: boolean; className?: string }` — renders a `7×16px bg-accent` inline-block when `active`, animation `blink 1.1s steps(2) infinite`. Suppresses animation under `usePrefersReducedMotion`. Include the `@keyframes blink` via Tailwind arbitrary inline style or a tiny co-located `<style>` block — do NOT add it to `global.css`. | BRANDING.md `<chat-surface>` "Streaming cursor"; chatbot-wireframe.html composer/message area |

Add one barrel line per file.

Verification: `npx tsc -b` passes; `npx vite build` passes.

### Task 3 — Surface primitives (5 files)

| File | Minimum API | Citation |
|------|-------------|----------|
| `SurfaceCard.tsx` | `interface SurfaceCardProps { as?: "div"\|"section"\|"article"; elevation?: 1\|2\|3; accentBorder?: "accent"\|"warning"\|"error"\|"info"\|"highlight"\|"orange"; className?: string; children: ReactNode }` — defaults `bg-surface-1 border border-border rounded-lg`; `elevation=2` → `bg-surface-2`; `accentBorder` adds `border-l-[3px] border-<tone>` (per risk R9, no new token). | BRANDING.md `<component-style>` "Elevation via surface tokens"; wireframe.html `.card` and tool-card patterns |
| `PageHeader.tsx` | `interface PageHeaderProps { title: string; breadcrumb?: BreadcrumbProps["segments"]; description?: string; actions?: ReactNode; className?: string }` — two-row header: breadcrumb on row 1 (optional), row 2 is `flex items-center justify-between` with `<h1 class="text-2xl font-bold">` + action slot. Below h1, `text-muted text-sm` description if present. No decorative separator — rely on surrounding spacing. | wireframe.html section 01 dashboard header pattern; BRANDING.md `<interaction-patterns>` |
| `EmptyState.tsx` | `interface EmptyStateProps { title: string; description?: string; icon?: ReactNode; actions?: ReactNode; className?: string }` — centered `SurfaceCard` with `elevation=1`, `max-w-md mx-auto text-center py-12`, optional icon above the title, description in `text-muted`, actions row at bottom. | CONTEXT.md "Cross-Page Shared Patterns"; BRANDING.md anti-pattern compliance (no toast-only empty states) |
| `StatCard.tsx` | `interface StatCardProps { label: string; value: ReactNode; tone?: "accent"\|"orange"\|"warning"\|"info"; trend?: ReactNode; className?: string }` — `h2` uppercase `text-xs text-muted tracking-wider`; value: `text-[28px] font-bold leading-[1.1] text-<tone>` (default `text-accent`); optional `trend` node below (e.g. sparkline slot). | wireframe.html lines 223, 707–727 metric cards pattern |
| `NavGroup.tsx` | `interface NavGroupProps { label: string; children: ReactNode; className?: string }` — renders `<div>` with a `text-[10px] uppercase tracking-wider text-muted px-3 pt-4 pb-1` label followed by the children. Stateless — no collapse behavior (not in wireframe). | wireframe.html sidebar group-label pattern; CONTEXT.md "Sidebar Nav Grouping" |

Verification: `npx tsc -b` passes; `npx vite build` passes.

### Task 4 — Data primitives (2 files)

| File | Minimum API | Citation |
|------|-------------|----------|
| `DataTable.tsx` | Generic: `interface Column<T> { id: string; header: ReactNode; cell: (row: T) => ReactNode; align?: "left"\|"right"\|"center"; className?: string }`. `interface DataTableProps<T> { columns: Column<T>[]; rows: T[]; getRowKey: (row: T) => string; empty?: ReactNode; onRowClick?: (row: T) => void; className?: string }`. Table class model: `<table class="w-full text-sm">` with `<thead>` → `text-muted uppercase text-xs font-semibold border-b border-border`; rows `border-b border-border hover:bg-hover`. Delegates the "empty" state to the `empty` prop (callers pass `<EmptyState ... />`). | BRANDING.md `<component-style>` "Tables"; wireframe.html section 04 projects table |
| `SearchInput.tsx` | `interface SearchInputProps { value: string; onChange: (v: string) => void; placeholder?: string; shortcutHint?: string; minWidth?: number; className?: string; onSubmit?: (v: string) => void; "aria-label"?: string }` — mono input with optional right-aligned `Kbd` hint slot. Style: `bg-surface-1 border border-border rounded px-3 py-1.5 text-sm font-mono min-w-[280px] focus:border-accent focus:outline-none`. | wireframe.html lines 174–196 `.mc-search` + kbd pattern |

Verification: `npx tsc -b` passes; `npx vite build` passes.

### Task 5 — Chat-surface primitives (7 files)

These are for downstream `web-tool-bridge` and `agents-chats-tabs` consumption. They render the shapes described in BRANDING.md `<chat-surface>` and `chatbot-wireframe.html`. They must be fully standalone — no state, no fetching — so downstream sets wire them into stores/hooks.

| File | Minimum API | Citation |
|------|-------------|----------|
| `ToolCallCard.tsx` | `interface ToolCallCardProps { toolName: string; argsPreview?: string; status: "running"\|"complete"\|"error"; durationMs?: number; defaultOpen?: boolean; argumentsBody?: ReactNode; resultBody?: ReactNode; className?: string }` — collapsible card `bg-surface-1 border border-border rounded-lg`. Head row: status icon (spinner `text-info` / `✓ text-accent` / `✗ text-error`) · mono tool name · mono args preview (truncated) · duration · chevron. Body on `bg-surface-0` with two `<pre>` sections: Arguments and Result. | BRANDING.md `<chat-surface>` "Tool-call cards"; chatbot-wireframe.html |
| `StructuredQuestion.tsx` | `interface StructuredQuestionProps<T extends string> { label: string; title: string; options: Array<{ value: T; label: string; description?: string; shortcut?: string }>; value?: T; onChange?: (v: T) => void; onSubmit?: (v: T) => void; onSkip?: () => void; className?: string }` — uses `SurfaceCard` with `accentBorder="warning"`, mono uppercase `qc-label` ("Awaiting Input" default), bold title, full-width radio rows (`<label>` with `<b>` for label + `<span text-muted>` description + right-aligned `Kbd`). Submit + Skip buttons at bottom. | BRANDING.md `<chat-surface>` "Structured-question form" |
| `ErrorCard.tsx` | `interface ErrorCardProps { title: string; body: ReactNode; actions?: ReactNode; className?: string }` — `SurfaceCard` with `accentBorder="error"`, circular error icon (12px), bold `text-error` title, `text-fg-dim` body, action row. | BRANDING.md `<chat-surface>` "Error card" |
| `Composer.tsx` | `interface ComposerProps { value: string; onChange: (v: string) => void; onSubmit: () => void; disabled?: boolean; placeholder?: string; maxHeightPx?: number; slashHint?: boolean; attachments?: ReactNode; className?: string }` — `bg-surface-1 border border-border rounded-xl p-2.5`; `textarea` auto-grows 22→200px (capped by `maxHeightPx`, default 200). Focus border flips to accent (`focus-within:border-accent`). Right-aligned actions slot (render children) + primary send button (`bg-accent text-bg-0`). Below: hint strip `↵` / `⇧↵` / `/` / `@` via `Kbd`. | BRANDING.md `<chat-surface>` "Composer" |
| `SlashAutocomplete.tsx` | `interface SlashAutocompleteProps { items: Array<{ value: string; label: ReactNode; hint?: string }>; activeIndex: number; onPick: (value: string) => void; className?: string }` — absolutely positioned above composer, `bg-surface-1 border border-bg-4 rounded-lg`; active row `bg-surface-3`. | BRANDING.md `<chat-surface>` "Slash autocomplete" |
| `AutoScrollPill.tsx` | `interface AutoScrollPillProps { count: number; visible: boolean; onClick: () => void; className?: string }` — fixed bottom-centered pill `bg-surface-3 border border-accent rounded-full px-3 py-1 text-xs font-mono`. Hidden when `!visible` or `count === 0`. | BRANDING.md `<chat-surface>` "Auto-scroll pill" |
| `NextActionBanner.tsx` | `interface NextActionBannerProps { command: string; status?: StatusBadgeProps; description?: string; actions?: ReactNode; className?: string }` — full-width strip, `bg-surface-1 border border-border rounded-lg p-4` with mono command text + `StatusBadge` on the right. Used by Dashboard (Wave 2). | wireframe.html lines 273–301 + 687 `.next-action-banner` |

Verification: `npx tsc -b` passes; `npx vite build` passes.

### Task 6 — Theme picker primitive (shell-facing, no wiring yet)

**Create:** `web/frontend/src/components/primitives/ThemePicker.tsx`.

API: `interface ThemePickerProps { themeId: string; mode: "dark"\|"light"; onThemeIdChange: (id: string) => void; onModeToggle: () => void; themes: Array<{ id: string; label: string; swatch: string }>; className?: string }`. Renders four color dots (matching wireframe header theme picker — small `w-4 h-4 rounded-full border border-border` swatches with active state `ring-2 ring-accent`). This primitive is purely presentational — Wave 2 wires it to `useTheme` inside `Header.tsx`.

Citation: wireframe.html lines ~692 header theme-swatch cluster.

Verification: `npx tsc -b` passes; `npx vite build` passes.

### Task 7 — A11y + motion hooks (co-located under primitives)

**Create:** `web/frontend/src/components/primitives/hooks/usePrefersReducedMotion.ts` — returns `boolean` via `matchMedia("(prefers-reduced-motion: reduce)")`. Subscribes to changes.

**Create:** `web/frontend/src/components/primitives/hooks/useAutoScrollWithOptOut.ts` — signature `({ containerRef, deps }) => { pinned: boolean; newCount: number; scrollToBottom: () => void }`. Tracks scroll position; when user scrolls up, sets `pinned=false` and increments `newCount` on new child additions; `scrollToBottom` resets both.

**Do NOT** put these hooks under `web/frontend/src/hooks/` — they are primitive-scoped and must not collide with Wave 2 surface code.

Update the barrel (`components/primitives/index.ts`) to re-export both hooks.

Verification: `npx tsc -b` passes; `npx vite build` passes.

### Task 8 — Append any confirmed new tokens (if Task 0 audit requires)

If the audit from the "Tokens Pre-Audit" section concluded new tokens are needed:

1. Append each new `--th-<name>: <value>;` line inside the existing `[data-theme="<id>-<mode>"]` block for **all 8 theme files** (`everforest-dark/light`, `catppuccin-dark/light`, `gruvbox-dark/light`, `tokyonight-dark/light`). Values for non-Everforest themes must be visually equivalent — use the existing token as a sibling reference and pick a matching tone from that palette's existing palette.
2. Append one corresponding `--color-<name>: var(--th-<name>);` line inside the `@theme inline { ... }` block in `global.css` (do not reorder existing entries).
3. Add a one-line comment in `global.css` above the new block explaining what wireframe surface justifies the token.

If the audit concluded zero new tokens are needed, do nothing for this task and record that outcome in Task 0's comment block.

Verification: `npx tsc -b` passes; `npx vite build` passes AND visual sanity — load the built app in every theme variant via `/settings` theme picker and confirm no fallback-to-default color flashes. (This manual check is only required if Task 8 added tokens.)

### Task 9 — Contract note for Wave 2

**Create:** `web/frontend/src/components/primitives/README.md` — tiny file listing every exported name from the barrel plus its one-line purpose. This is Wave 2's lookup reference; do NOT duplicate the wireframe spec here, just the API surface.

Verification: file exists, all barrel entries listed.

## Acceptance (Wave 1 Success Criteria)

All of the following must hold:

1. `npx tsc -b` (from `web/frontend`) reports zero errors.
2. `npx vite build` (from `web/frontend`) succeeds.
3. `git diff --stat main` (from the wireframe-rollout worktree) shows additions only under: `web/frontend/src/components/primitives/**`, `web/frontend/src/styles/themes/*.css`, `web/frontend/src/styles/global.css`. Any change outside this list is a file-ownership violation and must be reverted.
4. `web/frontend/src/components/primitives/index.ts` exports, at minimum: `StatusDot`, `HealthDot`, `StatusBadge`, `Breadcrumb`, `Kbd`, `StreamingCursor`, `SurfaceCard`, `PageHeader`, `EmptyState`, `StatCard`, `NavGroup`, `DataTable`, `SearchInput`, `ToolCallCard`, `StructuredQuestion`, `ErrorCard`, `Composer`, `SlashAutocomplete`, `AutoScrollPill`, `NextActionBanner`, `ThemePicker`, `usePrefersReducedMotion`, `useAutoScrollWithOptOut`.
5. `components/ui/CommandPalette.tsx` and `components/ui/TooltipOverlay.tsx` are **unchanged** (verify with `git diff main -- web/frontend/src/components/ui/`).
6. No existing entry in `global.css`'s `@theme inline` block was modified (verify with `git diff main -- web/frontend/src/styles/global.css` — only additions).
7. `components/primitives/README.md` exists and lists every barrel export.

## Commit Plan (atomic commits per CONVENTIONS)

- `feat(wireframe-rollout): scaffold primitives barrel` (Task 1)
- `feat(wireframe-rollout): add atom primitives StatusDot/HealthDot/StatusBadge/Breadcrumb/Kbd/StreamingCursor` (Task 2)
- `feat(wireframe-rollout): add surface primitives SurfaceCard/PageHeader/EmptyState/StatCard/NavGroup` (Task 3)
- `feat(wireframe-rollout): add DataTable and SearchInput primitives` (Task 4)
- `feat(wireframe-rollout): add chat-surface primitives for downstream consumption` (Task 5)
- `feat(wireframe-rollout): add ThemePicker primitive` (Task 6)
- `feat(wireframe-rollout): add usePrefersReducedMotion and useAutoScrollWithOptOut hooks` (Task 7)
- `feat(wireframe-rollout): extend theme tokens for wireframe surfaces` (Task 8, only if Task 0 audit required new tokens)
- `docs(wireframe-rollout): list primitive exports for Wave 2 reference` (Task 9)

## Notes for Executor

- Primitives are **presentational only**. Do not import `useProjects`, `useTheme`, `useLayoutStore`, or any other store/hook from primitives. Wave 2 wires them up.
- If a primitive genuinely needs a hook (e.g. `StreamingCursor` respects `usePrefersReducedMotion`), import from the sibling `components/primitives/hooks/` — never from `src/hooks/`.
- **Do not** register anything with `commandRegistry`. That is Wave 2.
- **Do not** add any nav item, route, or keyboard binding. That is Wave 2.
- When unsure whether a token is needed, prefer Tailwind arbitrary values over new tokens (per risk R9). Invent a token only if the same magic color would otherwise appear in >2 primitives.
- Keep primitive file sizes tight — most should be <120 lines. If one grows beyond that, consider whether it's doing too much.
