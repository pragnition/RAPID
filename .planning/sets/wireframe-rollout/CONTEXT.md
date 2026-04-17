# CONTEXT: wireframe-rollout

**Set:** wireframe-rollout
**Generated:** 2026-04-15
**Mode:** interactive

<domain>
## Set Boundary

This set rolls the branded wireframe (produced via `/rapid:branding`, artifacts under `.planning/branding/`) into real code across `web/frontend/**` and rewrites the `CONTRACT.json` files of four pending downstream sets (`web-tool-bridge`, `skill-invocation-ui`, `kanban-autopilot`, `agents-chats-tabs`) so they execute against the redesigned UI surfaces.

In-scope:
- `web/frontend/**` layout, theme, routing, top-level components, design tokens, shared primitives.
- Rewrites of the four downstream `CONTRACT.json` files aligned to redesigned surfaces.
- Targeted `DEFINITION.md` edits on downstream sets where UI scope materially shifts.

Out-of-scope:
- Backend runtime changes (covered by the merged `agent-runtime-foundation` set).
- Full content/feature implementation of downstream surfaces (owned by the four downstream sets).
- Redoing branding — `.planning/branding/**` is the immutable source of truth.
</domain>

<decisions>
## Implementation Decisions

### Migration Strategy
- **Decision:** In-place rewrite of existing layout and pages.
- **Rationale:** The set owns `web/frontend/**` in full; nothing consumes it mid-flight. Parallel v2 components would duplicate surfaces for no safety benefit in a solo-dev worktree.

### Scope of Page Restyling
- **Decision:** Fully restyle all 11 existing pages to the wireframe's visual language, not just the four wireframed screens.
- **Rationale:** Stronger cross-page consistency; the wireframe + `BRANDING.md` together establish enough pattern authority that non-wireframed pages can follow without ambiguity.

### Visual Treatment Authority for Non-Wireframed Pages
- **Decision:** Claude autonomously derives treatment for Notes, NoteEditor, Codebase, State, Settings by applying wireframe patterns (surface hierarchy, badges, tables, shared page header) plus `BRANDING.md`.
- **Rationale:** Solo-dev workflow; a style-audit artifact would be overhead. Pattern-derivation is the intent when adopting a design system.

### Design Token Plumbing
- **Decision:** Hybrid — tokens remain CSS variables (per theme file under `styles/themes/`), referenced via Tailwind's `theme.extend` so utility classes like `bg-surface-1`, `text-muted`, `border-border` resolve to the active CSS var.
- **Rationale:** Single source of truth (CSS vars) preserves runtime theme switching via `data-theme`; Tailwind integration keeps class-based authoring ergonomic and matches the utility names used throughout `BRANDING.md`.

### Theme Default
- **Decision:** Everforest Dark becomes the default theme (applied to both the theme provider and the `localStorage` fallback for `rapid-theme` / `rapid-mode`).
- **Rationale:** Matches `BRANDING.md` mandate and the wireframe's canonical palette.

### Primitives Library Organization
- **Decision:** New wireframe-introduced primitives live in a new `web/frontend/src/components/primitives/` directory, sibling to the existing `ui/`. `ui/` remains for higher-level widgets.
- **Rationale:** User preference — explicit separation between design-system primitives (surface cards, status dots, nav groups, tool-call cards, structured-question forms, error cards, slash autocomplete, page header, empty state, data table, stat card) and the existing widget library.

### Primitive Creation Strategy
- **Decision:** Eager — Wave 1 produces the full primitives library (tokens + primitives + shared page patterns) before feature-surface waves begin.
- **Rationale:** Matches SET-OVERVIEW.md's shell-first approach; downstream sets (`web-tool-bridge`, `skill-invocation-ui`, `kanban-autopilot`, `agents-chats-tabs`) will consume these primitives and need a stable API.

### Cross-Page Shared Patterns
- **Decision:** Extract recurring patterns into shared primitives — at minimum `PageHeader` (title + breadcrumb + action), `EmptyState`, `DataTable`, `StatCard`.
- **Rationale:** These repeat across most existing pages and across downstream sets' surfaces; enforcing them as primitives guarantees consistency and reduces duplication.

### Contract Rewrite Approach
- **Decision:** Editorial rewrite of each downstream `CONTRACT.json` from scratch, grounded in specific wireframe artifacts. Each export cites the exact screen/component in the wireframe that justifies it.
- **Rationale:** Directly implements the SET-OVERVIEW.md risk mitigation ("ground each CONTRACT.json rewrite in specific wireframe artifacts"). Diff-based patching would preserve mis-specifications from the pre-redesign contracts; structured extraction is too automation-heavy for editorial work that requires design judgement.

### Preserving Existing Export Names
- **Decision:** Per-export judgement. Preserve a name when the wireframe implies the same surface; replace when the wireframe clearly reshapes it. Each rewrite documents which names were preserved and which were replaced.
- **Rationale:** Minimizes unnecessary downstream replan cost while allowing the wireframe to reshape surfaces where it genuinely diverges.

### Sidebar Nav Grouping
- **Decision:** Adopt three nav groups (`Workspace` / `Execution` / `Library`), with Agents and Chats added under `Execution` alongside Kanban/Worktrees. Otherwise follow the wireframe's exact group membership.
- **Rationale:** Wireframe grouping is semantically meaningful (workflow phases); the only adaptation is slotting the two new downstream-owned nav entries into the right group.

### Future-Facing Nav Stubs
- **Decision:** This set adds stub routes + nav entries for `/agents` and `/chats` (placeholder pages). Content is filled by the `agents-chats-tabs` set.
- **Rationale:** Keeps the sidebar visually complete per wireframe immediately after this set merges; downstream work focuses on content, not nav scaffolding.

### Shell Features
- **Decision:** All three wireframe-shown shell affordances ship in this set:
  - Theme picker in header.
  - ⌘K command palette overlay.
  - g-prefix keyboard shortcuts (`gd`, `gp`, `gh`, `gk`, `gw`, `gs`, `ga`, `gc`) per `BRANDING.md`'s keyboard-first interaction spec.
- **Rationale:** User chose full shipment. Wireframe explicitly shows all three; shipping together avoids a fragmented shell rollout across multiple sets.

### Downstream Replan Handling
- **Decision:** Before rewriting a downstream `CONTRACT.json`, check the downstream set's status. If beyond `pending` (i.e., already `discussed` or `planned`), the rewrite still proceeds but emits a clear warning listing the affected set(s) and the manual action required (re-run `/rapid:discuss-set` / `/rapid:plan-set` for that set).
- **Rationale:** Solo-dev workflow; auto-clearing downstream state is surprising and potentially destructive, while blocking the rewrite is overly rigid. A loud warning gives the user control.

### DAG Edge Management
- **Decision:** This set does NOT inject `wireframe-rollout` as a dependency into downstream DAG entries. Each downstream set declares its own `wireframe-rollout` dep during its own `/rapid:plan-set`.
- **Rationale:** User preference — keeps each set responsible for its own declared deps; avoids cross-set writes to `DAG.json` from this set.

### Claude's Discretion
- None — every gray area received a direct user decision.
</decisions>

<specifics>
## Specific Ideas

- Primitives to introduce under `components/primitives/` (non-exhaustive, grounded in wireframe + BRANDING.md chat-surface spec):
  - `StatusBadge`, `StatusDot`, `NavGroup`, `PageHeader`, `EmptyState`, `DataTable`, `StatCard`, `Breadcrumb`, `SurfaceCard`, `HealthDot`, `SearchInput`, `ThemePicker`, `CommandPalette`.
  - Chat-surface primitives (for downstream use): `ToolCallCard`, `StructuredQuestion`, `ErrorCard`, `SlashAutocomplete`, `StreamingCursor`, `AutoScrollPill`, `Composer`.
- Wireframe source-of-truth artifacts to cite in contract rewrites: `wireframe.html` sections 01-04, `chatbot-wireframe.html`, `components.html`, `guidelines.html`.
- Preserve `data-theme` attribute switching on `<html>` and `localStorage` keys `rapid-theme` / `rapid-mode` per `BRANDING.md` interaction spec.
- Command palette: entry points per wireframe section 04 overlay; ⌘K binding; searches across sets, pages, commands.
- g-prefix mapping (per `BRANDING.md`): `gd=/`, `gp=/projects`, `gh=/graph`, `gk=/kanban`, `gw=/worktrees`, `gs=/state`, `ga=/agents`, `gc=/chats`.
</specifics>

<code_context>
## Existing Code Insights

- Frontend layout already exists at `web/frontend/src/components/layout/{AppLayout,Header,Sidebar}.tsx` — in-place rewrite targets these three files plus the 11 page files under `web/frontend/src/pages/`.
- Router at `web/frontend/src/router.tsx` uses `createBrowserRouter` with a single `AppLayout` root and 10 named routes. Two additional stub routes (`/agents`, `/chats`) need to be added.
- Existing theme files under `web/frontend/src/styles/themes/` already provide 8 variants (everforest/catppuccin/gruvbox/tokyonight × dark/light). `global.css` already aliases tokens as `--color-*` variables per `BRANDING.md`.
- Current component directories: `components/{editor,graph,kanban,layout,ui}/`. New sibling: `components/primitives/`.
- Existing `components/ui/` is retained for higher-level widgets (e.g., form controls, existing buttons); new wireframe primitives do NOT merge into it.
- All four downstream sets are presently `pending` per STATE.json, so the per-set replan warning will not fire during this rollout unless that status changes mid-set.
- No tests currently gate the frontend shell; visual/interaction testing is out of scope for this set beyond type-checking and build-passing.
</code_context>

<deferred>
## Deferred Ideas

- No deferred items identified — all raised topics were either decided in-scope or already owned by existing downstream sets (chat surface implementation lives with `agents-chats-tabs` and `web-tool-bridge`; page content refinements live with the respective owning sets).
</deferred>
