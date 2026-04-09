# CONTEXT: branding-skill-overhaul

**Set:** branding-skill-overhaul
**Generated:** 2026-04-09
**Mode:** interactive

<domain>
## Set Boundary
Overhaul the `/rapid:branding` skill to become an artifact-driven system with a live-reloading webserver, expanded creative capabilities (guidelines page, README template, component library page), hub gallery as primary entry point, and init delegation. Owned files: `skills/branding/SKILL.md`, `src/lib/branding-server.cjs`, `src/lib/branding-artifacts.cjs`. Init skill (`skills/init/SKILL.md`) is modified for delegation only.
</domain>

<decisions>
## Implementation Decisions

### Auto-reload Trigger Path
- File watcher only -- artifact creation continues using direct `branding-artifacts.cjs` calls; the existing `fs.watch` file watcher detects filesystem changes and fires SSE `file-changed` events to trigger browser auto-reload.
- **Rationale:** No dependency on server being running during artifact creation; skill code stays simple; the watcher already exists and handles all file types. The REST API path (POST /_artifacts) is kept for external consumers but is not the primary trigger.

### File Watcher Configuration
- Keep current configuration: non-recursive, 300ms debounce, `file-changed` events only.
- **Rationale:** All branding files are flat in one directory; the hub page reloads on any `file-changed` event regardless of event type. No need for recursive watching or additional event types.

### Expanded Flow Interaction Model
- Single multi-select prompt after theme is settled, offering all available asset types as checkboxes.
- **Rationale:** One question covers all options; user sees everything available; minimal interview disruption. Sequential opt-in would burn too many questions.

### Expanded Asset Types
- Guidelines page (guidelines.html): Comprehensive HTML design system reference with usage rules, do/don't examples, copy-paste code snippets, accessibility guidelines, and brand voice & tone examples.
- README style template (readme-template.md): Branded README.md template applying the project's terminology and tone guidelines.
- Component library page (components.html): HTML page with interactive component examples (buttons, forms, cards) using branding tokens.
- **Rationale:** These three have the highest practical value for development workflows. Guidelines serves as developer reference, README template provides immediate utility, component library gives interactive examples.

### Init Delegation Boundary
- Init keeps the opt-in/skip/re-init gate logic (~30 lines). Delegates the actual interview and file generation (including server startup) to the branding skill.
- **Rationale:** Clean separation of concerns. Init controls whether branding runs; branding controls how it runs. `brandingStatus` tracking stays in init.

### Init Invocation Mechanism
- Branding SKILL.md has prompt-level mode documentation with explicit standalone and delegated sections. Init's delegation instruction tells the model which section to follow. In delegated mode, branding skips: banner, git commit, footer. Everything else (interview, generation, server, server lifecycle question) runs normally.
- **Rationale:** No marker files or STATE.json fields needed. The model reads the skill prompt and follows the appropriate section. This is the simplest mechanism that works with the Skill tool's invocation model.

### Server During Init Delegation
- The no-server-during-init contract is **removed**. When init delegates to branding, the server starts normally. Users can preview branding artifacts during the init flow.
- **Rationale:** User explicitly wants the server to start during init to enable immediate artifact preview. The original contract was overly cautious; the server is lightweight and non-blocking.

### Hub Page as Primary Entry Point
- Hub gallery at `/` (root) is the primary branding URL. Visual Preview (index.html) is one click away via the existing "Visual Preview" button.
- **Rationale:** Users see all artifacts at a glance; hub serves as navigation center; scales naturally as artifacts grow.

### Hub Page Design
- Minor polish only: add per-type badge colors for the new artifact types. Keep the existing card grid layout.
- **Rationale:** The current design handles 7-8 artifacts fine. Over-engineering the hub for a small artifact count wastes effort.

### Artifact Type System
- Add new artifact types: `guidelines`, `readme-template`, `component-library`. Each gets a distinct badge color on the hub page.
- **Rationale:** Clear semantics; type badges are meaningful at a glance; easy to filter/search by type in the future.

### AskUserQuestion Budget
- No hard limit on AskUserQuestion calls. Use as many questions as needed for a thorough interview.
- **Rationale:** The budget was a soft guideline that became a constraint. The expanded capabilities justify more questions, and interview speed depends more on question quality than count.

### Guidelines Page Architecture
- Standalone HTML artifact (guidelines.html), separate from BRANDING.md.
- **Rationale:** BRANDING.md stays concise (50-150 lines) for agent prompt injection. Guidelines page can be rich and detailed as a human-readable reference. Different audiences, different purposes.

### Guidelines Page Content
- Usage rules and do/don't examples (when to use each color/token, common mistakes, correct vs incorrect)
- Copy-paste code snippets (CSS variables, Tailwind config fragments, component markup patterns)
- Accessibility guidelines (contrast ratios, ARIA patterns, keyboard navigation notes derived from branding tokens)
- Brand voice & tone examples (writing samples showing preferred terminology and anti-patterns in context)
- **Rationale:** Developers need actionable reference material they can copy directly. This complements the Visual Preview (index.html) which demonstrates the branding visually but doesn't provide implementation guidance.

### Claude's Discretion
- No areas deferred to Claude's discretion -- all gray areas were discussed.
</decisions>

<specifics>
## Specific Ideas
- Hub badge colors should be distinct per artifact type (e.g., blue for theme, green for guidelines, orange for wireframe, purple for component-library, etc.)
- The single multi-select prompt for asset generation should list all available assets with clear descriptions of what each generates
- Init's branding delegation should set `brandingStatus = "configured"` after branding skill completes, or `"skipped"` if the user bails out of the branding skill
- Guidelines page should be the richest artifact -- it's the developer reference counterpart to the Visual Preview
</specifics>

<code_context>
## Existing Code Insights
- `branding-server.cjs` already has SSE infrastructure (`notifyClients()`, `_handleSSE()`, `_startFileWatcher()`) and a hub page generator (`_generateHubPage()`) with artifact card rendering
- `branding-artifacts.cjs` has full CRUD with Zod validation; the `ArtifactEntrySchema` just needs the `type` field to accept new string values (no schema change needed since it's `z.string()`)
- The hub page already renders cards generically from the manifest -- new artifact types get cards automatically; only badge styling needs updating
- The file watcher is already debounced at 300ms and fires `file-changed` events to SSE clients
- `SKILL.md` Step 5b/5c already generate logo.svg and wireframe.html with artifact registration -- the expanded flow follows the same pattern
- Init's branding section (Step 4B, lines ~446-780) has the opt-in/skip/re-init detection, 5-round interview, and file generation all inline
- `INFRA_FILES` set in branding-artifacts.cjs excludes `artifacts.json`, `.server.pid`, `index.html` from untracked scan -- new artifact files will show as untracked until registered
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
