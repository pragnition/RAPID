# DEFERRED: agent-runtime-foundation

**Set:** agent-runtime-foundation
**Generated:** 2026-04-15

## Deferred Decisions

Items raised during discussion that fall outside this set's scope.

| # | Decision/Idea | Source | Suggested Target |
|---|--------------|--------|-----------------|
| 1 | Archive format and storage backend for agent_events after 30-day retention (local JSONL vs pluggable S3-compatible vs compressed archive) | Retention gray-area discussion | Future milestone post-v7.0.0 once real usage reveals storage pressure |
| 2 | SIGKILL ladder for orphans that survive SIGTERM (with configurable grace window) | Reap-policy gray-area discussion | Revisit if SIGTERM-only proves insufficient in practice; candidate for a polish milestone after v7.0.0 |
| 3 | `/api/v2/agents/...` path strategy for future breaking SSE schema changes | SSE schema-evolution gray-area discussion | Deferred until an actual breaking change is required; the additive-only rule should cover v1 lifetime |
| 4 | Multi-worker uvicorn deployment (the asyncio.Lock registry is single-process-only; SQLite partial unique index covers it but the Python layer becomes redundant) | Mutex-layering gray-area discussion | Re-evaluate when scaling beyond single-process; not needed for solo-user topology |
| 5 | Per-skill `disallowed_tools` tuning for skills needing tighter scope than the destructive-pattern firewall | can_use_tool policy revision discussion | Future set when specific skills demonstrate over-broad tool use |
| 6 | UI presentation of `permission_req` notifications (toast vs info bar) now that it is info-only and not a prompt | Trust-all-tools spec-revision discussion | Set 5 (agents-chats-tabs) when wiring the live event feed |
| 7 | `retention_warning` UI behavior — should it block further events in the run, or just warn? | Retention gray-area discussion | Set 5 (agents-chats-tabs) design pass |

## Notes
- These items should be reviewed during `/rapid:new-version` planning.
- Items may be promoted to backlog entries or new sets in future milestones.
- Items 6 and 7 are cross-set concerns that Set 5 will pick up naturally — captured here for traceability.
