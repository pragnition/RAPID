# Primitives

Presentational building blocks for the wireframe-rollout surfaces. Every name
below is re-exported from `./index.ts`. Primitives own no state beyond local
UI ephemera (collapse, textarea height, scroll-pin) and import from nothing
under `src/hooks/` or `src/stores/` — Wave 2 wires them to application state.

## Atoms

| Export | Purpose |
|--------|---------|
| `StatusDot` | Small tinted circle for inline lifecycle indication. |
| `StatusDotTone` (type) | Tone union used by `StatusDot`, `StatusBadge`, and tone-driven atoms. |
| `HealthDot` | Pulsing health indicator with halo for service/process status. |
| `StatusBadge` | Compact mono badge with tinted background + matching fg. |
| `Breadcrumb` | Slash-separated trail with current segment bolded. |
| `BreadcrumbSegment` (type) | One breadcrumb entry (`label` + optional `href`). |
| `Kbd` | `<kbd>`-style key/shortcut glyph. |
| `StreamingCursor` | 7x16 accent block appended to active assistant tokens. |

## Surfaces

| Export | Purpose |
|--------|---------|
| `SurfaceCard` | Elevation-aware card with optional 3px accent-left stripe. |
| `SurfaceAccentTone` (type) | Accent-stripe tone union for `SurfaceCard`. |
| `PageHeader` | Page-level title row with meta slots and actions. |
| `EmptyState` | Centered "nothing here" panel with icon/title/body/actions. |
| `StatCard` | Headline metric card with tone-driven value color. |
| `StatCardTone` (type) | Tone union for `StatCard`. |
| `NavGroup` | Sidebar section label + child nav rows. |

## Data

| Export | Purpose |
|--------|---------|
| `DataTable` | Generic bordered-row table with typed column defs. |
| `Column` (type) | Column definition accepted by `DataTable`. |
| `SearchInput` | Mono search field with shortcut affordance slot. |

## Chat surface

| Export | Purpose |
|--------|---------|
| `ToolCallCard` | Collapsible tool invocation card (running/complete/error). |
| `StructuredQuestion` | Warning-bordered radio form with Submit/Skip. |
| `ErrorCard` | Error-bordered surface with glyph, title, body, actions. |
| `Composer` | Auto-growing textarea + actions + hint strip. |
| `SlashAutocomplete` | Popover list above a composer for slash-command pick. |
| `AutoScrollPill` | Floating "N new messages" pill shown when scrolled off-bottom. |
| `NextActionBanner` | Dashboard strip pairing a mono command with a `StatusBadge`. |

## Theme

| Export | Purpose |
|--------|---------|
| `ThemePicker` | Swatch row + mode toggle (presentational; Wave 2 persists). |

## Hooks

| Export | Purpose |
|--------|---------|
| `usePrefersReducedMotion` | Live subscription to OS `prefers-reduced-motion`. |
| `useAutoScrollWithOptOut` | Scroll-pin tracker with `newCount` when user scrolls away. |
