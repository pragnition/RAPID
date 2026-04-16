# Wave 2 Handoff -- Frontend Foundation (stores, hooks, a11y)

**Set:** agents-chats-tabs
**Wave:** 2 of 3
**Status:** COMPLETE
**Commits:** a25c06b, 0fda583, 08936a9, 6da76fd, cebb6bc, d10e36d, ba179c9, 8fdd80d, 7b66622

---

## Deliverables

| Artifact | Task | Status |
|----------|------|--------|
| `src/types/chats.ts` | T1 | Done |
| `src/types/dashboard.ts` | T1 | Done |
| `src/types/sseEvents.ts` | T2 | Done |
| `src/types/agents.ts` | T2 (bonus) | Done -- AgentRun type needed by useAgentEvents |
| `src/stores/statusStore.ts` | T3 | Done |
| `src/hooks/useDashboard.ts` | T4 | Done |
| `src/hooks/useAgentEvents.ts` | T5 | Done |
| `src/hooks/useChats.ts` (exports useChats + useChatThread) | T6 | Done |
| `src/components/a11y/LiveRegion.tsx` + `index.ts` | T7 | Done |
| `src/hooks/useFocusTrap.ts` | T8 | Done |
| `vite.config.ts` SSE proxy headers | T9 | Done |
| 7 test files (43 new tests) | T10 | Done |

## Verification

- `npx tsc --noEmit` -- PASS (zero errors)
- `npx vitest run` -- 12 test files, 64 tests, all PASS

## Decisions Made

1. Created `types/agents.ts` (not in plan) because `useAgentEvents` needs `AgentRunStatus` type. Mirrors `AgentRunResponse` from backend `schemas/agents.py`.
2. `useFocusTrap` tests required jsdom `offsetParent` polyfill since jsdom always returns `null` for `offsetParent`, which breaks the focusable element filter.
3. REST backfill stub in `useAgentEvents.backfillRest()` logs a warning -- endpoint does not exist yet per coordination notes.

## Wave 3 Integration Notes

Wave 3 pages can now import from:
- `@/types/chats` -- Chat, ChatMessage, ChatListResponse, etc.
- `@/types/dashboard` -- DashboardResponse, RunsSummary, etc.
- `@/types/sseEvents` -- SseEvent discriminated union
- `@/types/agents` -- AgentRun, AgentRunStatus
- `@/stores/statusStore` -- useStatusStore for sidebar badges, stat cards
- `@/hooks/useDashboard` -- poll trigger (mount once in layout or dashboard)
- `@/hooks/useAgentEvents` -- SSE + polling for run detail page
- `@/hooks/useChats` -- useChats() for list page, useChatThread() for detail
- `@/components/a11y` -- LiveRegion for streaming announcements
- `@/hooks/useFocusTrap` -- modal focus management

Test mock patterns established:
- MockEventSource class for SSE tests
- apiClient mock pattern with vi.mock
- projectStore mock pattern
- QueryClientProvider wrapper factory
