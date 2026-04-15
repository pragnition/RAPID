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
| bg-0..4 / surface-0..4 | #2D353B → #4F585E | Surface hierarchy (root → top-elevation). Elevate by stepping one level, never with shadow |
| fg / fg-dim / muted | #D3C6AA / #9DA9A0 / #859289 | Body / secondary / captions, timestamps, role labels |
| accent | #A7C080 | Primary action, success, complete, streaming cursor, assistant avatar |
| link / info | #83C092 / #7FBBB3 | Hyperlinks · merged; informational, discussed, tool avatar, running spinner |
| warning | #DBBC7F | Warnings, structured-question border, awaiting |
| error | #E67E80 | Errors, destructive, failed tool calls |
| highlight | #D699B6 | Selection, planned, discuss-set accent |
| orange | #E69875 | Secondary accent, in-progress, executed |
| border | #475258 | Dividers, outlines |

### Typography Scale

Font family: `Inter, system-ui, -apple-system, sans-serif`. Monospace: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`. Mono is reserved for file paths, set IDs, commit hashes, slash commands, role labels, keyboard shortcuts, tool-call args, and ANSI-style log output.

| Token | Size / Weight | Usage |
|-------|---------------|-------|
| heading-1/2/3 | 1.875 / 1.25 / 0.875rem · bold→semibold | Page titles / card titles / section labels |
| body / caption | 0.875 / 0.75rem · 400 | Message content, paths, timestamps |
| mono-sm | 0.75rem · 400 mono | Slash commands, role labels, set IDs |

### Spacing Scale

Tailwind defaults. Canonical values: `xs` 4px (gap-1, inline), `sm` 8px (p-2, buttons), `md` 16px (p-4, cards), `lg` 24px (p-6, pages), `xl` 32px (mb-8, hero).
</visual-identity>

<component-style>
## Component Style

- **Corners:** `rounded-lg` cards, `rounded` buttons/badges, `rounded-full` dots, `rounded-xl` composer.
- **Borders:** 1px `--color-border`; 3px semantic left borders for severity on tool cards, question forms, error cards.
- **Elevation via surface tokens.** `bg-surface-1` canonical card, nested → `bg-surface-2`. No shadows or blur.
- **Transitions:** global `0.15s ease` on `bg`/`color`/`border`. No transform/opacity animation.
- **Status dots:** `w-2.5 h-2.5 rounded-full bg-{semantic}` — always paired with a label.
- **Buttons:** Primary `bg-accent text-bg-0` · Secondary `bg-surface-2 border-border` · Ghost transparent.
- **Badges:** `rounded px-2 py-0.5 text-xs font-mono font-semibold`, semantic bg @ 20% + matching fg.
- **Tables:** bottom-bordered rows, `hover:bg-hover`, header `font-semibold text-muted uppercase`.
</component-style>

<chat-surface>
## Chat Surface

- **Messages:** 2-column grid (32px avatar + content). Role label above body in uppercase mono; body in Inter; timestamp right-aligned in the role row. Avatar border encodes role — user `border-bg-4`, assistant `border-accent`, tool `border-info`.
- **Streaming cursor:** 7×16px `bg-accent` block appended to the last assistant token, `blink 1.1s steps(2) infinite`. Removed on stream completion.
- **Tool-call cards:** `bg-surface-1 border border-border rounded-lg` with click-to-expand head (status icon · mono tool name · mono args preview · duration · chevron). Body on `bg-surface-0` with `Arguments` and `Result` `<pre>` blocks. Status icon: running = `info` spinner, complete = `accent` ✓, error = `error` ✗.
- **Structured-question form:** `border-l-3 border-warning` card. Mono `qc-label` ("Awaiting Input"), bold title, full-width radio rows (`b` label + `span` description + right-aligned mono shortcut). Submit + Skip actions at bottom.
- **Composer:** `bg-surface-1 border rounded-xl p-2.5`. Textarea auto-grows 22→200px; focus border flips to accent. Right-aligned actions (attach, code, send); send is primary accent. Hint strip below: mono `↵` / `⇧↵` / `/` / `@` plus auto-scroll state.
- **Slash autocomplete:** above composer on `/`. `bg-surface-1 border-bg-4`; active row on `bg-surface-3`.
- **Error card:** `border-l-3 border-error`, circular error icon, bold error-color title, `fg-dim` body, action row (Retry / Open file / ghost).
- **Auto-scroll pill:** centered bottom floating pill (`bg-surface-3 border-accent rounded-full`) — `↓ N new messages`. Visible only when the user has scrolled off-bottom.
- **Artifact side panel:** optional right pane, 420px desktop. Header (title + mono path), tabs, body on `bg-dim`. Diff adds `bg-accent/12`, removes `bg-error/12`.
</chat-surface>

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
| Set | task, module, feature | Parallelizable unit of work with isolated worktree |
| Wave | batch, phase | Parallel execution group determined by dependency depth |
| Job | step, action | Granular implementation item within a wave |
| Milestone | release, sprint | Collection of related sets on the roadmap |
| Contract | interface, spec | JSON Schema interface (`CONTRACT.json`) |
| DAG | dependency tree | Directed Acyclic Graph of set precedence |
| Worktree | branch, sandbox | Isolated git worktree per set |
| Chat thread | conversation, session | Interactive surface with persistent composer |
| Agent run | session, task | Autonomous invocation — no composer |
| Message role | author, sender | One of `user`, `assistant`, `tool` |
| Tool call | function call | Inline tool invocation card |
| Checkpoint | snapshot | Execution pause point with resumption context |

### Status Lifecycle
Sets: `pending→discussed→planned→executed→complete→merged`. Waves/Jobs: `pending→executing→complete`. Chat threads: `active→awaiting→streaming→archived|failed`. Agent runs: `running→waiting→completed|failed|cancelled`.
</terminology>

<interaction-patterns>
## Interaction Patterns

- **Chat vs Run is load-bearing.** Chats always render a composer; runs never do. Composer presence is the only mode signal users need.
- **Inline tool calls, no popovers.** Every tool use renders as a collapsible card in the message flow. Modals reserved for blocking approval that cannot be resolved inline.
- **Streaming cursor on the active assistant message only.** Cursor removed and `aria-busy` flips to `false` on completion.
- **Auto-scroll opt-out.** Manual scroll-up disables auto-scroll until user scrolls back to bottom or taps the `↓ N new messages` pill.
- **Structured questions over freeform parsing; badges over prose.** Enumerable answers render as radio/checkbox forms. Lifecycle state (chat, run, set, wave, job) renders as a semantic mono badge — never described in sentences.
- **Deliberate feedback + progressive disclosure.** Long-running actions show explicit state; lists render summaries first, detail on demand.
- **Theme switching.** Instant swap via `data-theme` on `<html>`; persisted to `localStorage` (`rapid-theme`, `rapid-mode`).
- **Keyboard first.** `g{d,p,a,h,k,s,w,c}` nav, `⌘K` palette, `↵`/`⇧↵`/`/`/`@` in composer, `⇧P`/`⇧S` pause/stop on runs.
- **Errors inline.** Red-bordered cards with title, explanation, ≥1 actionable next step. No toast-only errors, no raw stack traces. Respect `prefers-reduced-motion`.
</interaction-patterns>

<output>
## Output Style

- **Documentation:** Detailed with examples for each non-trivial concept.
- **Code comments:** Explain non-obvious behavior, decisions, edge cases.
- **Commit messages:** `type(scope): description`. Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`.
- **Planning artifacts:** Structured markdown with section headers, tables, numbered lists.
- **Chat responses:** `react-markdown`-rendered. Tables, code, inline code use mono. No emojis.
</output>

<anti-patterns>
## Anti-Patterns (Do NOT)

- Do not use emojis in documentation, comments, commit messages, or agent output
- Do not use marketing language, superlatives, promotional tone, or filler words ("basically", "simply", "just", "very", "really", "actually", "literally")
- Do not use second-person ("you") or first-person ("we", "I")
- Do not substitute domain terms (e.g., "task" for "job", "session" for "chat thread", "function call" for "tool call")
- Do not use drop shadows, glass/blur, or decorative motion — signal elevation with surface tokens
- Do not render lifecycle state as prose — always use semantic badges
- Do not render a composer on a run page, nor omit one on a chat page — composer is the mode signal
- Do not auto-scroll past a scrolled-up user — show the "new messages" pill instead
- Do not render tool calls in modal popovers — they belong inline in the conversation
</anti-patterns>
