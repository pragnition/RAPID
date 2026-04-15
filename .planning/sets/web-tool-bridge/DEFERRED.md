# DEFERRED: web-tool-bridge

**Set:** web-tool-bridge
**Generated:** 2026-04-15

## Deferred Decisions

Items raised during discussion that fall outside this set's revised scope. The user explicitly narrowed the set during discussion to drop the entire approval/permission gate: all tools run without user confirmation in SDK mode. Items below capture what was removed from scope and should be revisited in a future milestone if the approval flow is later reintroduced.

| # | Decision/Idea | Source | Suggested Target |
|---|--------------|--------|-----------------|
| 1 | `<ApprovalModal>` React component (Approve/Reject/Edit triad, focus-trap, ESC=reject) | Gray area: Destructive-detection source of truth | Future milestone once the solo tool is used in higher-stakes contexts |
| 2 | `<PermissionPrompt>` React component (specialization of ApprovalModal for permission_req) | Gray area: Destructive-detection source of truth | Same as (1) |
| 3 | `can_use_tool` interception for `permission_req` emission (routing unknown/destructive tools to approval) | Gray area: Destructive-detection source of truth | Same as (1) |
| 4 | Destructive-detection source of truth (regex vs registry vs per-skill policy) and default-reject behaviour | Gray area: Destructive-detection source of truth | Same as (1) |
| 5 | `approval_modal_destructive_default_reject` behavioural property (CONTRACT.json) | Gray area: Destructive-detection source of truth | Same as (1) |
| 6 | `render_diff` MCP tool (surfacing unified diffs before destructive edits) | CONTRACT.json optional export; loses primary use case without approval flow | Same as (1), or a future inline-diff-viewer set |
| 7 | 30-minute pending-prompt timeout + `expired` status + waiting→interrupted transition | Gray area: Pending-prompt timeout UX | Future set if abandoned runs become a resource problem |
| 8 | Inline timeout extension UX (one-click +30min) | Gray area: Pending-prompt timeout UX | Coupled to (7) |
| 9 | `timeout_on_pending_prompt` behavioural property (CONTRACT.json) | Gray area: Pending-prompt timeout UX | Coupled to (7) |

## Notes
- These items should be reviewed during `/rapid:new-version` planning.
- Scope narrowing happened mid-discussion; plan-set must update CONTRACT.json to remove the deferred exports/behaviors before wave decomposition.
- Items (1)-(6) form a cohesive "approval flow" slice that should be reintroduced together if/when needed.
- Items (7)-(9) are a separate "timeout hygiene" slice, cheaper to reintroduce independently.
