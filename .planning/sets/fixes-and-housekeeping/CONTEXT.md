# CONTEXT: fixes-and-housekeeping

**Set:** fixes-and-housekeeping
**Generated:** 2026-04-09
**Mode:** interactive

<domain>
## Set Boundary
Fix three bugs (version display across 3 hardcoded locations, Kanban Ctrl+Enter save shortcut, shell config multi-match in install skill), fix a pre-existing test failure (stale 'executing' string literals), and regenerate .planning/context/ files. The context regeneration task is deferred to milestone close per discussion.
</domain>

<decisions>
## Implementation Decisions

### Version Single-Source-of-Truth Architecture
- **Source:** package.json is the authoritative version source, leveraging the existing `getVersion()` utility in `src/lib/version.cjs`
- **Frontend delivery:** Build-time injection via Vite `define` config — version baked into the JS bundle at compile time, zero runtime API cost
- **Python sync:** `__init__.py` dynamically reads version from `package.json` at import time (true single source, no manual sync or build scripts)
- **pyproject.toml:** Also derives from package.json or is updated to match — no independent hardcoded version
- **Rationale:** package.json is already the CLI's version source via `getVersion()`. Build-time injection is simplest for the frontend since it avoids API calls and is always available. Python reading package.json at runtime eliminates drift entirely with no extra build steps.

### Frontend Version Fallback Strategy
- Show generic fallback text ("RAPID" without version number) when version is unavailable
- **Rationale:** With build-time injection the fallback is unlikely to trigger, but for dev mode or edge cases, showing "RAPID" without a version is clean and honest without looking broken.

### Keyboard Shortcut Scope
- Ctrl+Enter/Cmd+Enter handler attached at document level via the existing `useEffect` keydown listener, matching the Escape handler pattern
- No keyboard shortcut hint on the Save button — keep the button as plain "Save"
- **Rationale:** Document-level handling is consistent with the existing Escape pattern and works regardless of focus state. No hint keeps the modal visually minimal per user preference.

### Claude's Discretion
- Shell config multi-match fix implementation (removing `break` in install skill detection loop)
- Pre-existing test failure fix (stale 'executing' literals in review.test.cjs and dag.cjs)
- Specific Vite config approach for build-time version injection
- Package.json read mechanism in Python `__init__.py`
</decisions>

<specifics>
## Specific Ideas
- The compact sidebar mode currently shows "v4" — should be updated to show the correct major version abbreviation derived from the injected version
- Context regeneration deferred to milestone close to capture all v6.3.0 changes including pending sets 4-6
- All 4 context files (CODEBASE.md, ARCHITECTURE.md, CONVENTIONS.md, STYLE_GUIDE.md) should be regenerated when the time comes
</specifics>

<code_context>
## Existing Code Insights
- `src/lib/version.cjs:getVersion()` already reads `package.json` version — reuse this pattern
- `Sidebar.tsx:122-129` hardcodes `v4.2.1` in both full and compact sidebar modes
- `CardDetailModal.tsx:14-21` has existing document-level `useEffect` keydown handler for Escape — extend this with Ctrl+Enter/Cmd+Enter check
- `web/backend/app/__init__.py` is a single-line file: `__version__ = "4.2.1"` — replace with dynamic read from `package.json`
- `web/backend/pyproject.toml:3` hardcodes `version = "4.2.1"` — needs sync mechanism
- Backend health endpoint at `/health` already exists and could expose version, but build-time injection was chosen over runtime API
</code_context>

<deferred>
## Deferred Ideas
- Context file regeneration deferred to v6.3.0 milestone close to capture full state
- Development mode detection ("dev" label in sidebar) for future UX polish
- Document-level keyboard shortcut conflict management for future multi-modal scenarios
</deferred>
