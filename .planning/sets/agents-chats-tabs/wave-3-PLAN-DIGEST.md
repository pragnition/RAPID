# Wave 3 Plan Digest

**Objective:** Ship user-visible pages composing wireframe primitives and Wave 2 hooks into complete agent/chat UX — 4 pages, 2 empty states, router updates, react-markdown install.
**Tasks:** 10 tasks completed
**Key files:** src/pages/AgentsPage.tsx, src/pages/AgentRunPage.tsx, src/pages/ChatsPage.tsx, src/pages/ChatThreadPage.tsx, src/components/empty-states/AgentsEmptyState.tsx, src/components/empty-states/ChatsEmptyState.tsx, src/router.tsx, src/hooks/useAgentRuns.ts, src/types/agents.ts, package.json
**Approach:** Rewrote AgentsPage and ChatsPage with StatCard grids + DataTable views, added AgentRunPage detail (StatusBadge, telemetry, ToolCallCard feed, no composer per invariant), added ChatThreadPage (message list, react-markdown, inline ToolCallCard, persistent Composer, SlashAutocomplete, AutoScrollPill), added child routes /agents/:runId and /chats/:threadId, installed react-markdown + rehype-sanitize. 88 tests passing.
**Status:** Complete
