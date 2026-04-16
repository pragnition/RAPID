# Wave 3 Handoff -- agents-chats-tabs

## Status: COMPLETE

All 10 tasks implemented, 10 commits, 88 tests passing (31 new wave-3 tests), tsc clean (pre-existing test-only errors remain).

## Commits (chronological)

1. `3954d78` chore: install react-markdown + rehype-sanitize
2. `4eeafb0` feat: add AgentRunListResponse type
3. `eb211fb` feat: add useAgentRuns + useAgentRun hooks
4. `2a37182` feat: rewrite AgentsPage (StatCard grid, DataTable, nav fix)
5. `2a4d929` feat: add AgentsEmptyState + ChatsEmptyState
6. `72c5260` feat: add AgentRunPage (telemetry, activity feed, Shift+P/S)
7. `d4abec3` feat: rewrite ChatsPage (thread list, stat cards, new chat flow)
8. `8727aa8` feat: add ChatThreadPage (markdown, composer, SSE streaming)
9. `3ddc193` feat: add /agents/:runId and /chats/:threadId routes
10. `7524a55` test: rewrite/add integration tests (6 files, 31 test cases)

## Files Modified/Created

### New files
- `src/hooks/useAgentRuns.ts`
- `src/pages/AgentRunPage.tsx`
- `src/pages/ChatThreadPage.tsx`
- `src/components/empty-states/AgentsEmptyState.tsx`
- `src/components/empty-states/ChatsEmptyState.tsx`
- `src/components/empty-states/index.ts`
- `src/pages/__tests__/AgentRunPage.test.tsx`
- `src/pages/__tests__/ChatThreadPage.test.tsx`
- `src/components/empty-states/__tests__/AgentsEmptyState.test.tsx`
- `src/components/empty-states/__tests__/ChatsEmptyState.test.tsx`

### Modified files
- `package.json` (react-markdown, rehype-sanitize added)
- `package-lock.json`
- `src/types/agents.ts` (AgentRunListResponse added)
- `src/pages/AgentsPage.tsx` (full rewrite)
- `src/pages/ChatsPage.tsx` (full rewrite)
- `src/router.tsx` (2 new routes)
- `src/pages/__tests__/AgentsPage.integration.test.tsx` (full rewrite)
- `src/pages/__tests__/ChatsPage.integration.test.tsx` (full rewrite)

## Key Decisions

1. **StatCard tones**: Used `accent/warning/orange/info` instead of plan's `accent/warning/error/link` because StatCard only supports `accent|orange|warning|info` tones (error/link not available on StatCard, only on StatusBadge).

2. **Two-step launcher flow**: "Launch New Run" opens SkillGallery modal first, then passes selected skill to RunLauncher modal (SkillLauncher requires a pre-selected skill name).

3. **Slash autocomplete import**: `SlashAutocompleteItem` type is not re-exported from the primitives barrel, so imported directly from the component file.

4. **Nav routing fix**: Fixed the pre-existing bug where all runs navigated to `/chats/{runId}`. Now routes based on skill category: interactive -> `/chats/:threadId` (with TODO for thread ID lookup), else -> `/agents/:runId`.

## Known Dependencies / Blockers

- **Backend `GET /agents/runs?project_id=X` list endpoint does NOT exist yet.** The `useAgentRuns` hook calls this endpoint. The AgentsPage DataTable will show no data until this endpoint is implemented. This is a Wave 1 backend gap (not part of Wave 3 scope).

- **Interactive run -> chat thread ID mapping**: When an interactive run is clicked in the AgentsPage DataTable, the ideal behavior is to navigate to `/chats/:threadId` where the thread ID comes from the run<->thread binding. This binding lookup is not yet implemented; currently all clicks route to `/agents/:runId` as a safe fallback.

## Behavioral Invariants Verified

- `no_composer_on_run_detail`: AgentRunPage has NO textarea (test asserts 0 textareas)
- `status_pill_color_and_label`: StatusBadge renders tone + text label (test checks class + text)
- `prefers_reduced_motion_respected`: pulse animation suppressed when reduced motion is set
- `keyboard_accessibility`: Shift+P/S send interrupt requests (test verifies apiClient.post calls)
- `empty_state_onboarding_present`: Both empty states render with 3 action cards + distinction explanation
- `auto_scroll_opt_out`: AutoScrollPill rendered in both AgentRunPage and ChatThreadPage
- `adopts_wireframe_primitives`: All pages compose from @/components/primitives exclusively
