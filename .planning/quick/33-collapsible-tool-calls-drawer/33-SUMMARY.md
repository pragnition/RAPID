# Quick Task 33: collapsible-tool-calls-drawer

**Description:** Right now when the agent calls a tool and then continues on with its conversation the tool calls stack up like crazy below the message. We should solve this by simply having a drawer that expands into all the tool calls (which we can further expand).

**Date:** 2026-04-17
**Status:** COMPLETE
**Commits:** 277f1e5, ef05e5b, d6919c4
**Files Modified:**
- web/frontend/src/components/primitives/ToolCallDrawer.tsx (new)
- web/frontend/src/components/primitives/index.ts
- web/frontend/src/pages/ChatThreadPage.tsx
- web/frontend/src/components/primitives/__tests__/ToolCallDrawer.test.tsx (new)

## Verification
- `npx tsc --noEmit`: clean
- `npx vitest run` on new test file: 7/7 passed
- Full `npx vitest run`: 97/97 passed, no regressions

## Notes
- New `ToolCallDrawer` primitive groups tool-call cards under a compact "N tool calls" summary row with mini status glyphs
- Collapsed by default; auto-opens on rising edge of any `running` status; never auto-closes
- Per-card `ToolCallCard` expand behavior preserved verbatim
- Wired into both `MessageBubble` (historical) and streaming assistant row in `ChatThreadPage.tsx`
