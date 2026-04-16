# DEFERRED: agents-chats-tabs

**Set:** agents-chats-tabs
**Generated:** 2026-04-16

## Deferred Decisions

Items raised during discussion that fall outside this set's scope.

| # | Decision/Idea | Source | Suggested Target |
|---|---------------|--------|------------------|
| 1 | ChatAttachment real implementation — file upload, image embedding, code snippet attachments. This set ships the stub table with nullable fields; v7.1 adds the real functionality (size_bytes, content_type, storage_url, actual upload/storage flow). | ChatAttachment Stub Design gray area | v7.1 milestone |
| 2 | Pending-prompt notification mechanism — when a user navigates away from a chat and the agent then asks a structured question, there's no cross-app signal that attention is needed. Options: sidebar badge on the Chats nav item, browser-level notification, toast on return to the app. | Chat Thread Lifecycle (Session survives) gray area | Future UX polish set |
| 3 | Getting Started docs page — since the empty state is zero-state only (disappears after first run/thread), advanced users who want a reference for chat-vs-run workflows need a docs destination. Currently there is no in-app docs target. | Empty State Persistence gray area | Future documentation set |
| 4 | Keyboard shortcuts beyond Shift+P / Shift+S — thread search, thread archive, jump-to-latest, keyboard-driven slash autocomplete navigation patterns. The contract defines pause/stop shortcuts; richer keyboard UX is future work. | Chat Composer Interaction gray area | Future UX polish set |
| 5 | Thread archive UI polish — this set ships the archive state and filter, but advanced archive workflows (bulk archive, auto-archive after N days, un-archive UX) are out of scope. | Chat Thread Lifecycle (Explicit lifecycle + archive) gray area | Future polish set |

## Notes
- These items should be reviewed during `/rapid:new-version` planning
- Items may be promoted to backlog entries or new sets in future milestones
- Item 1 (ChatAttachment) is explicitly targeted for v7.1 per the contract's stub design
