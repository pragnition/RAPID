# CONTEXT: web-tool-bridge

**Set:** web-tool-bridge
**Generated:** 2026-04-15
**Mode:** interactive

<domain>
## Set Boundary

Scope (as revised during this discussion):
- In-process SDK MCP tools: `mcp__rapid__webui_ask_user` and `mcp__rapid__ask_free_text` in `web/backend/app/agents/tools/ask_user.py`.
- `can_use_tool` interception of the built-in `AskUserQuestion` tool only — auto-splits >4 questions server-side into multiple `ask_user` prompts. No permission/approval interception.
- `agent_prompts` SQLite table (server-minted `prompt_id`, status tracking: `pending | answered | stale`, 409 on stale answer). No `expired` status, no timeout sweep.
- `POST /api/agents/runs/{id}/answer` endpoint.
- `<AskUserModal>` React component only (renders multi-choice, free-form, and N-question prompts).
- `RAPID_RUN_MODE=sdk` env-var gate; minimal inline if/else patches to 9 interactive skill prose files so they call `mcp__rapid__webui_ask_user` when in sdk mode and retain built-in `AskUserQuestion` otherwise.
- sessionStorage-backed prompt draft persistence across tab close.
- SSE-based delivery of `ask_user` events; REST `GET /api/agents/runs/{id}/pending-prompt` for reconnect rehydration.

Explicitly out of scope (moved to DEFERRED.md): all approval-modal / permission-prompt work, destructive-detection rules, `render_diff` tool, and pending-prompt timeout/expiry.
</domain>

<decisions>
## Implementation Decisions

### Prompt delivery transport
- **Decision:** SSE only. Events (`ask_user`) ride the existing foundation SSE `/events` stream. No long-poll fallback, no WebSocket upgrade.
- **Rationale:** The agent-runtime-foundation set already ships the SSE stream with typed event kinds; adding a second transport would duplicate infrastructure without proportional resilience gain in a localhost solo-developer context.

### Reconnect strategy when SSE drops mid-prompt
- **Decision:** Client calls `GET /api/agents/runs/{id}/pending-prompt` on reconnect to rehydrate the modal from SQLite truth. No server-side event replay buffer keyed by `Last-Event-ID`.
- **Rationale:** The prompt is already authoritative in `agent_prompts` (status=pending); a single REST round-trip is simpler and cheaper than maintaining an in-memory event ring per run.

### AskUserQuestion >4 split UX
- **Decision:** Sequential split — when a skill sends >4 questions (e.g. discuss-set's 12), the server splits into multiple `ask_user` prompts and the client surfaces exactly one active prompt at a time.
- **Rationale:** Matches current skill semantics (one AskUserQuestion call = one user turn) and keeps the prompt state machine linear; parallel batches risk cognitive overload.

### Split back-navigation
- **Decision:** Full back-navigation supported — the user can re-open a previously-answered batch and edit their answers. Re-opening invalidates any subsequent batches generated from the old answers; the server must regenerate downstream prompts or mark them `stale`.
- **Rationale:** User explicitly overrode the forward-only recommendation. **Implication for plan-set:** the state machine must allow a previously `answered` prompt to transition back to `pending` (or introduce an explicit `reopened` status), and downstream prompts generated from stale answers must be invalidated. This is the most complex part of the prompt state machine and should be covered by a behavioural test.

### Skill-prose patch shape
- **Decision:** Inline if/else bash check on `$RAPID_RUN_MODE` in each of the 9 SKILL.md files. Both branches remain visible to the agent. No wrapper macros, no `SKILL.cli.md`/`SKILL.sdk.md` splitting, no tool-level dispatch.
- **Rationale:** Keeps each skill's intent visible in its own file, mirrors existing bash-in-prose conventions in this repo, and keeps the CLI-parity regression test surface small (the agent sees the same prose shape in both modes, only the selected branch differs).

### Env-check evaluation site
- **Decision:** In-prose bash check. `RAPID_RUN_MODE` is read inside the skill's bash blocks at runtime; no preprocessing step strips unused branches.
- **Rationale:** Transparent and testable — the env var is a clear input, no hidden dispatch. Agent-context bytes impact is minor (9 skills × a handful of if/else lines).

### Destructive-detection source of truth
- **Decision:** Claude's Discretion — **deferred entirely.** No approval gate in this set. All tools run without user confirmation when `RAPID_RUN_MODE=sdk`.
- **Rationale:** User explicitly dropped the approval flow: "We should not need an approval model. All agents can run all tools. We can add this in next time if we want." See DEFERRED.md items 1-6.

### Destructive default set
- **Decision:** Claude's Discretion — **deferred.** No destructive set to define because no approval gate exists.
- **Rationale:** Same as above.

### Draft persistence durability
- **Decision:** sessionStorage only. Draft is keyed by `prompt_id`, lost on tab close, not synced across tabs, no server-side draft column.
- **Rationale:** A draft dying with the tab is acceptable; reconnect already re-fetches the prompt from server truth, and a server-side draft column would add schema surface for negligible UX gain in a solo-dev localhost tool.

### Pending-prompt timeout
- **Decision:** Claude's Discretion — **deferred.** `ask_user` prompts remain `pending` indefinitely until answered or the run is explicitly interrupted via the foundation's `POST /api/agents/runs/{id}/interrupt`. No `expired` status, no timeout sweep, no countdown UI.
- **Rationale:** User dropped the timer together with the approval flow ("if it's for the approval, we shouldn't add a timeout"). Extended to `ask_user` prompts for consistency: in solo-dev context, abandoned runs are not a resource concern, and explicit interrupt is a clearer mental model than implicit expiry.

### Stale prompt_id (409) recovery
- **Decision:** Toast + in-place modal swap + draft preserved. When the backend rejects an answer with 409, the UI shows a non-blocking toast ("This prompt was superseded — showing current pending prompt"), swaps the modal content to the current pending prompt (via the same REST GET used for reconnect), and preserves the rejected draft as a collapsible "Previous draft" panel.
- **Rationale:** Transparent communication of what happened without forcing a manual refresh; preserves user work; silent swap was rejected because it would leave the user unsure whether their answer applied.
</decisions>

<specifics>
## Specific Ideas

- `POST /api/agents/runs/{id}/answer` accepts `{prompt_id, answer}` and returns `200 | 409 stale | 404 expired` — but with no timeout, the 404 case reduces to "prompt doesn't exist" (deleted or run cancelled) rather than "expired".
- Complementary endpoint introduced by this discussion: `GET /api/agents/runs/{id}/pending-prompt` — returns the current pending prompt row (including payload) or 204 if none. Used by the client on SSE reconnect and on 409 auto-swap.
- Back-navigation implementation: add a `POST /api/agents/runs/{id}/prompts/{prompt_id}/reopen` endpoint (or allow re-POSTing an answer with a `reopen: true` flag) that transitions the targeted prompt back to `pending` and marks downstream prompts as `stale`. Needs a dedicated test case.
- The 9 skills to patch (per ROADMAP.md): discuss-set, init, new-version discovery half, bug-fix, scaffold, branding, quick scoping, assumptions, add-set mid-milestone.
- The `ask_user` SSE event kind and `agent_prompts.kind` enum should drop `'permission_req'` and `'approve_tool'` since those flows are deferred — keep only `'ask_user'` until the approval slice returns.
</specifics>

<code_context>
## Existing Code Insights

- `web/backend/app/agents/` already contains the foundation surface: `sdk_options.py`, `session_manager.py`, `session.py`, `event_bus.py`, `permission_hooks.py`, `permissions.py`, `mcp_registration.py`, `correlation.py`, `error_mapping.py`, `errors.py`, `archive.py`, `budget.py`, `pid_liveness.py`. No `tools/` subdirectory yet — this set creates it with `ask_user.py`.
- `permission_hooks.py` and `permissions.py` are the owners of `can_use_tool`; this set extends the hook with AskUserQuestion interception only (no permission_req emission).
- `mcp_registration.py` is the integration point for registering new `@tool` functions via `create_sdk_mcp_server`.
- Frontend structure under `web/frontend/src/`: `components/{editor,graph,kanban,layout,ui}`, plus `pages/`, `hooks/`, `stores/`, `providers/`. `AskUserModal` should land in `components/ui/` or a new `components/prompts/` directory (plan-set decision).
- Existing SSE event schema (from foundation) already includes `ask_user` as a typed kind — this set populates the schema, doesn't redefine it.
</code_context>

<deferred>
## Deferred Ideas

- Approval-modal triad (`<ApprovalModal>`, `<PermissionPrompt>`) and focus-trap/ESC=reject UX — deferred entirely with the approval flow.
- `can_use_tool` interception for `permission_req` (destructive-tool gating) — deferred.
- Destructive-detection source of truth (regex vs registry vs per-skill policy) and narrow/medium/wide default set — deferred.
- `approval_modal_destructive_default_reject` behavioural property — deferred.
- Optional `render_diff` MCP tool — deferred (loses primary use case without approval flow).
- 30-minute pending-prompt timeout, `expired` status, waiting→interrupted transition on timeout — deferred.
- One-click inline timeout extension UX — deferred.
- `timeout_on_pending_prompt` behavioural property — deferred.

See DEFERRED.md for full details and suggested future targets.
</deferred>
