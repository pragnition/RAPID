# Project Branding Guidelines

> Project type: webapp

<identity>
## Project Identity

RAPID is a technical-first developer tool for orchestrating parallel, isolated development workflows. The project presents itself as precise, specification-grade infrastructure — comparable to protocol documentation or compiler references. Communication conveys exactness, authority, and deep domain knowledge without unnecessary embellishment.
</identity>

<tone>
## Tone & Voice

- **Perspective:** Third-person. Avoid "you", "we", "I", "let's".
- **Formality:** Formal. Declarative statements. No colloquialisms.
- **Sentence structure:** Direct and unambiguous; one fact or instruction per sentence.
- **Example:** "The merge subsystem detects five levels of conflict." (not "We check for five kinds of conflicts.")
</tone>

<visual-identity>
## Visual Identity

Mission Control is a hypermodern terminal-dashboard. Dark-first, theme-switchable across Everforest, Catppuccin, Gruvbox, and Tokyonight (each with dark and light variants). Default theme is Everforest Dark. Palette values below define the default theme; all theme tokens are aliased via `--color-*` variables in `web/frontend/src/styles/global.css`.

### Color Palette (Everforest Dark defaults)

| Token | Hex | Usage |
|-------|-----|-------|
| bg-dim | #232A2E | Page background beneath surfaces |
| bg-0 / surface-0 | #2D353B | Root surface, table rows |
| bg-1 / surface-1 | #343F44 | Cards, primary panels |
| bg-2 / surface-2 | #3D484D | Hovered surface, nested cards |
| bg-3 / surface-3 | #475258 | Active state, selected row |
| bg-4 / surface-4 | #4F585E | Top-most elevation |
| fg | #D3C6AA | Body text, headings |
| fg-dim | #9DA9A0 | Secondary text |
| muted | #859289 | Captions, timestamps, placeholders |
| accent | #A7C080 | Primary action, success state, metric highlight |
| link | #83C092 | Hyperlinks, navigation active |
| info | #7FBBB3 | Informational badges, graph info nodes |
| warning | #DBBC7F | Warnings, pending states |
| error | #E67E80 | Errors, destructive actions |
| highlight | #D699B6 | Selection highlight, featured badge |
| orange | #E69875 | Secondary accent, in-progress state |
| border | #475258 | Surface dividers, card outlines |

### Typography Scale

Font family: `Inter, system-ui, -apple-system, sans-serif`. Monospace: system default (`font-mono`) for paths, IDs, commit hashes.

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| heading-1 | 1.875rem (text-3xl) | bold (700) | Page titles |
| heading-2 | 1.25rem (text-xl) | bold (700) | Card titles, primary metric values |
| heading-3 | 0.875rem (text-sm) | semibold (600) | Section labels, widget headings |
| body | 0.875rem (text-sm) | regular (400) | Default body text |
| caption | 0.75rem (text-xs) | regular (400) | Metadata, paths, timestamps |
| mono-sm | 0.75rem (text-xs, mono) | regular (400) | File paths, set IDs, hashes |

### Spacing Scale

Tailwind defaults. Canonical values: `xs` 4px (gap-1, inline), `sm` 8px (p-2, buttons), `md` 16px (p-4, cards), `lg` 24px (p-6, pages), `xl` 32px (mb-8, hero).
</visual-identity>

<component-style>
## Component Style

- **Corners:** `rounded-lg` (0.5rem) for cards, panels, table containers. `rounded` (0.25rem) for buttons and badges. `rounded-full` for status dots (2.5px diameter).
- **Borders:** Single 1px border in `--color-border`. No double borders. Table rows use bottom borders only.
- **Elevation:** Flat by default. Elevation signaled by surface token (surface-0 through surface-4), not by shadow. No drop shadows anywhere.
- **Surface pattern:** `bg-surface-1 border border-border rounded-lg p-4` is the canonical card. Nested cards use `bg-surface-2`.
- **Transitions:** Global `0.15s ease` on `background-color`, `color`, `border-color` (defined in `global.css`). Hover states use `bg-hover`. No transform or opacity animations on state changes.
- **Status dots:** `inline-block w-2.5 h-2.5 rounded-full bg-{semantic}`. Paired with a label; never standalone.
- **Buttons:** Primary = `bg-accent text-bg-0 rounded px-4 py-2 text-sm font-medium`. Secondary = `bg-surface-2 text-fg border border-border`.
- **Badges:** `rounded px-2 py-0.5 text-xs font-medium` with semantic background at 20% opacity and matching foreground color.
- **Tables:** Bottom-bordered rows, `hover:bg-hover`, `cursor-pointer` when rows are selectable. Header cells use `font-semibold text-muted`.
</component-style>

<terminology>
## Terminology & Naming

### Code Conventions
- Variables and functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Boolean accessors: `is*`, `has*`, `can*` prefixes
- Source files: `{name}.cjs` (CommonJS)
- Test files: `{name}.test.cjs` (co-located, `node:test`)
- Planning documents: UPPERCASE with hyphens (`STATE.json`, `DEFINITION.md`, `CONTRACT.json`)

### Domain Terms

| Preferred Term | Instead Of | Context |
|---------------|-----------|---------|
| Set | task, module, feature | Core parallelizable unit of work with isolated worktree |
| Wave | batch, phase, stage | Parallel execution group determined by dependency depth |
| Job | task, step, action | Granular implementation item within a wave |
| Milestone | release, sprint, iteration | Collection of related sets on the project roadmap |
| Contract | interface, schema, spec | JSON Schema interface definition (`CONTRACT.json`) |
| DAG | dependency tree, graph | Directed Acyclic Graph of set precedence |
| Worktree | branch, workspace, sandbox | Isolated git worktree per set |
| Phase | step, stage | Workflow stage: `discuss`, `plan`, `execute` |
| Concern | category, group | Thematic file grouping during review scoping |
| Checkpoint | save point, snapshot | Execution pause point with resumption context |

### Status Lifecycle
- Sets: `pending` -> `discussed` -> `planned` -> `executed` -> `complete` -> `merged`
- Waves: `pending` -> `executing` -> `complete`
- Jobs: `pending` -> `executing` -> `complete`
</terminology>

<interaction-patterns>
## Interaction Patterns

- **Deliberate feedback:** Every long-running action shows an explicit state — loading skeleton, progress bar, or status badge. No silent optimistic updates.
- **Status badges over free text:** Lifecycle state is always rendered as a semantic badge, never plain prose.
- **Progressive disclosure:** Pages load metric summaries first, then fetch detail views on demand. Graph and Kanban views render skeleton columns before data.
- **Theme switching:** Instant swap via `data-theme` attribute on `<html>`. Persisted to `localStorage` under `rapid-theme` and `rapid-mode`.
- **Command palette:** Global shortcut entry point for navigation. Opens a modal over the active surface.
- **Error states:** Inline surface with error color text, retry affordance, and `error?.detail` when available. No toast-only errors.
- **Health indicator:** Persistent footer strip showing backend connection status, version, uptime.
- **No marketing animation:** No parallax, no scroll-triggered reveal, no decorative motion. Transitions exist only to smooth state changes.
</interaction-patterns>

<output>
## Output Style

- **Documentation:** Detailed with examples for each non-trivial concept.
- **Code comments:** Explain non-obvious behavior, architectural decisions, edge cases.
- **Commit messages:** `type(scope): description`. Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`.
- **Planning artifacts:** Structured markdown with section headers, tables, and numbered lists.
</output>

<anti-patterns>
## Anti-Patterns (Do NOT)

- Do not use emojis in documentation, comments, commit messages, or agent output
- Do not use marketing language, superlatives, or promotional tone ("blazing fast", "revolutionary", "game-changing")
- Do not use filler words: "basically", "simply", "just", "very", "really", "actually", "literally"
- Do not use second-person ("you") or first-person ("we", "I") in documentation or comments
- Do not use colloquialisms, slang, or casual abbreviations ("gonna", "wanna", "LGTM" in prose)
- Do not substitute domain terms with generic alternatives (e.g., "task" instead of "job", "module" instead of "set")
- Do not use drop shadows, glass/blur effects, or decorative motion
- Do not signal elevation with shadow — use surface token hierarchy instead
- Do not render lifecycle state as plain prose — always use semantic status badges
</anti-patterns>
</content>
</invoke>