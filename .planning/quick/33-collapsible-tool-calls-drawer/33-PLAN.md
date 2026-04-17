# Quick Task 33: Collapsible Tool Calls Drawer

## Objective

When the agent emits multiple tool calls below an assistant message, they currently stack vertically as a list of `ToolCallCard`s and consume a large amount of vertical space in the chat feed. Replace that flat list with a collapsible **drawer** that shows a compact summary row by default (count of tool calls + status glyphs) and expands to reveal the individual `ToolCallCard`s, each of which remains individually expandable for full argument/result details.

This is UI-only polish. No changes to SSE event shapes, `ChatToolCall` types, the pairing helpers (`pairToolCalls`, `pairStreamToolEvents`), or the backend. The drawer is a new primitive component wrapping the existing render loops.

## Scope

- **Files created:**
  - `web/frontend/src/components/primitives/ToolCallDrawer.tsx` -- new primitive
  - `web/frontend/src/components/primitives/__tests__/ToolCallDrawer.test.tsx` -- unit tests
- **Files modified:**
  - `web/frontend/src/components/primitives/index.ts` -- export the new primitive
  - `web/frontend/src/pages/ChatThreadPage.tsx` -- swap the two `pairedTools`/`streamToolCalls` flex columns for `<ToolCallDrawer>`

Do NOT modify `ToolCallCard.tsx` -- it already handles its own per-card expand/collapse and that behavior is preserved verbatim.

## Design Decisions (do not re-litigate)

- **Drawer behavior:** collapsed by default, regardless of how many tool calls there are. Single chevron-style toggle on a summary row.
- **Summary row content (when collapsed):** a chevron, a count like `3 tool calls`, and a compact row of status glyphs (one per tool call -- spinner for running, `✓` accent for complete, `✗` error for error). The glyphs reuse the same visual vocabulary as `ToolCallCard`'s `StatusIcon` but should be small (roughly `w-2 h-2` / `text-xs`) so all fit on one line without truncation for typical cases (under ~10 tool calls). No tool names in the summary -- just the count and glyphs.
- **Expanded behavior:** the drawer renders its children in the existing `flex flex-col gap-2` layout so visual density inside matches today's behavior.
- **Streaming affordance:** if ANY tool call has status `"running"`, the drawer auto-opens (so the user sees live activity without having to click). Once all tools settle, the drawer does NOT auto-close -- that would be jarring mid-stream. The user can manually collapse.
- **Zero-count:** the drawer renders nothing if `count === 0` (so the existing `pairedTools.length > 0 && ...` guards in `ChatThreadPage.tsx` can be removed or left in place -- either works).
- **Accessibility:** the toggle is a real `<button>` with `aria-expanded`, `aria-controls` pointing at the body id, and an `aria-label` of `"Toggle tool calls"`. The body div has a matching `id`.
- **Styling:** reuse the `ToolCallCard` card surface conventions (`bg-surface-1 border border-border rounded-lg overflow-hidden`). The summary row uses `hover:bg-hover cursor-pointer`. This keeps the drawer visually at the same level as a single tool card, so a drawer containing one tool call doesn't look heavier than a bare tool card.

## Tasks

### Task 1: Create `ToolCallDrawer` primitive

**Files:**
- Create `web/frontend/src/components/primitives/ToolCallDrawer.tsx`
- Edit `web/frontend/src/components/primitives/index.ts` -- add export

**Action:**

Create a new presentational component `ToolCallDrawer` with this API:

```ts
export type ToolCallStatus = "running" | "complete" | "error"; // reuse from ToolCallCard

export interface ToolCallDrawerProps {
  /**
   * Status for each tool call in the order they should render. The length of
   * this array is the count shown in the summary. Use an empty array to render
   * nothing.
   */
  statuses: ToolCallStatus[];
  /**
   * The child ToolCallCard nodes. Rendered inside the expanded body in the
   * same `flex flex-col gap-2` layout the page currently uses.
   */
  children: ReactNode;
  /**
   * Force-open on first mount. Defaults to false. Independent of auto-open-
   * when-streaming (which is derived from `statuses`).
   */
  defaultOpen?: boolean;
  className?: string;
}
```

Behavior:

1. Import `ToolCallStatus` from `./ToolCallCard` (re-exporting it from index.ts is already done -- do NOT duplicate the type).
2. Local `useState<boolean>` for `open`, initialized to `defaultOpen ?? false`.
3. Derive `anyRunning = statuses.some(s => s === "running")`. Use a `useEffect` that, when `anyRunning` transitions from `false` to `true`, calls `setOpen(true)`. Do NOT force-close when it transitions back -- the user may have manually opened/closed. Use a `useRef<boolean>` to track the previous value so the effect only fires on the rising edge.
4. If `statuses.length === 0`, return `null`.
5. Render a wrapper div with classes `bg-surface-1 border border-border rounded-lg overflow-hidden` plus `className` appended.
6. Render a `<button type="button">` summary row:
   - `className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-hover cursor-pointer"`
   - `onClick={() => setOpen(p => !p)}`
   - `aria-expanded={open}`
   - `aria-controls={bodyId}` where `bodyId` is a `useId()` value
   - `aria-label="Toggle tool calls"`
   - Contents in order:
     - A chevron `<span>` with `className="text-muted text-xs shrink-0 transition-transform"` and `style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}` showing `›` (mirrors `ToolCallCard`'s chevron style).
     - `<span className="text-sm text-fg">{statuses.length} tool call{statuses.length === 1 ? "" : "s"}</span>`
     - A flex row of mini status glyphs: `<span className="flex items-center gap-1 flex-wrap ml-2">` containing one mini-icon per status. Render:
       - `running` -> `<span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-info border-t-transparent animate-spin" aria-label="running" />`
       - `complete` -> `<span className="text-accent text-xs leading-none" aria-label="complete">✓</span>`
       - `error` -> `<span className="text-error text-xs leading-none" aria-label="error">✗</span>`
     - A `<span className="flex-1" />` spacer after the glyphs so the chevron/label stays left-aligned and clicks anywhere on the row still hit the button (nothing to right-align here, since the big chevron is on the left).
7. Render the expanded body conditional on `open`:
   ```tsx
   <div id={bodyId} className="bg-surface-0 border-t border-border px-3 py-2 flex flex-col gap-2">
     {children}
   </div>
   ```
   (Matches the `bg-surface-0 border-t border-border px-3 py-2` inner-surface pattern from `ToolCallCard`, and the `flex flex-col gap-2` layout that `ChatThreadPage.tsx` uses today.)
8. Add a concise JSDoc block at the top of the component explaining: "Collapsible drawer that groups a list of ToolCallCard children under a compact summary row. Auto-opens on the rising edge of any child entering 'running' status, but will not auto-close. Purely presentational -- does not render ToolCallCards itself; callers pass them as children alongside a parallel `statuses` array."

Add the export to `web/frontend/src/components/primitives/index.ts` in the "Chat surface" section, immediately below the existing `ToolCallCard` line:

```ts
export { ToolCallDrawer, type ToolCallDrawerProps } from "./ToolCallDrawer";
```

**What NOT to do:**
- Do NOT re-define `ToolCallStatus` in the new file. Import it from `./ToolCallCard`.
- Do NOT render `ToolCallCard`s inside the drawer -- callers pass them as `children`.
- Do NOT add a "collapse" auto-behavior when tools finish -- only auto-open on rising edge.
- Do NOT add any animation beyond the existing chevron rotation.
- Do NOT truncate the status-glyph row for now (no "+5 more" logic). Typical chats have under 10 tool calls per turn; flex-wrap handles overflow gracefully.
- Do NOT add keyboard handlers beyond what a native `<button>` provides.

**Verification:**

```sh
cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit
```

TypeScript must compile clean. The export must be reachable via:

```sh
cd ~/Projects/RAPID/web/frontend && node -e "const m = require('./src/components/primitives/index.ts'); console.log(typeof m)" 2>&1 | grep -v Cannot || true
```

(That command will likely fail because the file is TSX -- instead grep the barrel file directly:)

```sh
grep -n "ToolCallDrawer" ~/Projects/RAPID/web/frontend/src/components/primitives/index.ts
```

must print at least one line showing the new export.

**Done when:**
- `ToolCallDrawer.tsx` exists with the exact API above.
- `index.ts` exports it in the "Chat surface" section.
- `npx tsc --noEmit` passes with no new errors.

---

### Task 2: Wire drawer into `ChatThreadPage.tsx` (historical + streaming)

**Files:**
- Edit `web/frontend/src/pages/ChatThreadPage.tsx`

**Action:**

Replace both existing tool-call render blocks with `<ToolCallDrawer>`.

1. Add `ToolCallDrawer` to the existing primitives import (alphabetical / grouping not strict -- just add to the named-import list).

2. In `MessageBubble` (around lines 201-220), replace:

   ```tsx
   {pairedTools.length > 0 && (
     <div className="flex flex-col gap-2 mt-2">
       {pairedTools.map((tc) => (
         <ToolCallCard ... />
       ))}
     </div>
   )}
   ```

   with:

   ```tsx
   {pairedTools.length > 0 && (
     <div className="mt-2">
       <ToolCallDrawer statuses={pairedTools.map((tc) => tc.status)}>
         {pairedTools.map((tc) => (
           <ToolCallCard
             key={tc.toolUseId}
             toolName={tc.toolName}
             argsPreview={JSON.stringify(tc.input).slice(0, 80)}
             status={tc.status}
             argumentsBody={JSON.stringify(tc.input, null, 2)}
             resultBody={
               tc.output !== undefined
                 ? typeof tc.output === "string"
                   ? tc.output
                   : JSON.stringify(tc.output, null, 2)
                 : undefined
             }
           />
         ))}
       </ToolCallDrawer>
     </div>
   )}
   ```

3. In the streaming assistant row (around lines 513-532), replace:

   ```tsx
   {streamToolCalls.length > 0 && (
     <div className={`flex flex-col gap-2${streamingText ? " mt-2" : ""}`}>
       {streamToolCalls.map((tc) => (
         <ToolCallCard ... />
       ))}
     </div>
   )}
   ```

   with:

   ```tsx
   {streamToolCalls.length > 0 && (
     <div className={streamingText ? "mt-2" : ""}>
       <ToolCallDrawer statuses={streamToolCalls.map((tc) => tc.status)}>
         {streamToolCalls.map((tc) => (
           <ToolCallCard
             key={tc.toolUseId}
             toolName={tc.toolName}
             argsPreview={JSON.stringify(tc.input).slice(0, 80)}
             status={tc.status}
             argumentsBody={JSON.stringify(tc.input, null, 2)}
             resultBody={
               tc.output !== undefined
                 ? typeof tc.output === "string"
                   ? tc.output
                   : JSON.stringify(tc.output, null, 2)
                 : undefined
             }
           />
         ))}
       </ToolCallDrawer>
     </div>
   )}
   ```

**What NOT to do:**
- Do NOT change the `ToolCallCard` props being passed -- exact same shape as today.
- Do NOT change the pairing helpers or any stream/message data flow.
- Do NOT remove the `pairedTools.length > 0` / `streamToolCalls.length > 0` guards even though the drawer no-ops on empty. Keeping the guard avoids rendering an unnecessary wrapping `<div className="mt-2">` when there are no tool calls.
- Do NOT wrap the empty-state case `!streamingText && streamToolCalls.length === 0 && <StreamingCursor ... />` -- leave it untouched.

**Verification:**

```sh
cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit
```

Must pass with zero new errors.

```sh
grep -n "flex flex-col gap-2" ~/Projects/RAPID/web/frontend/src/pages/ChatThreadPage.tsx | grep -v "// "
```

Should show FEWER matches than before the change -- the two tool-call-list flex columns should be gone. (Other `flex flex-col gap-2` uses in the file -- e.g., the multi-question options list -- should remain.)

```sh
grep -n "ToolCallDrawer" ~/Projects/RAPID/web/frontend/src/pages/ChatThreadPage.tsx | wc -l
```

Should print `3` (one import, two usages).

**Done when:**
- Both tool-call render sites in `ChatThreadPage.tsx` use `<ToolCallDrawer>` as the wrapper.
- `npx tsc --noEmit` passes.
- The import is added exactly once.

---

### Task 3: Unit tests for `ToolCallDrawer`

**Files:**
- Create `web/frontend/src/components/primitives/__tests__/ToolCallDrawer.test.tsx`

**Action:**

Use Vitest + `@testing-library/react` (already in `package.json`). Follow the style of the existing `web/frontend/src/components/a11y/__tests__/LiveRegion.test.tsx` / `web/frontend/src/hooks/__tests__/useFocusTrap.test.tsx` tests (look at one for the exact imports and setup).

Cover these behaviors:

1. **Renders nothing when `statuses` is empty**
   - Render `<ToolCallDrawer statuses={[]}>child</ToolCallDrawer>`.
   - Assert `container.firstChild === null` (or `queryByText("child")` is null).

2. **Shows count + glyphs in the summary row; body hidden by default**
   - Render with `statuses={["complete", "complete", "error"]}` and a child `<div>body-content</div>`.
   - Assert the summary label reads `"3 tool calls"` (pluralized).
   - Assert three aria-label glyphs are present (`getAllByLabelText("complete")` has length 2, `getByLabelText("error")` exists).
   - Assert `"body-content"` is NOT in the document by default (`queryByText` returns null). (Alternatively: the body div with the generated id exists but has no children visible -- but since we conditionally render on `open`, `queryByText` returning null is the cleaner assertion.)

3. **Singular count**
   - Render with `statuses={["complete"]}`. Assert label reads `"1 tool call"` (no trailing `s`).

4. **Click toggles expansion**
   - Render with `statuses={["complete"]}` and child `<div>body-content</div>`.
   - Query the toggle via `getByRole("button", { name: /toggle tool calls/i })`.
   - Initially `aria-expanded="false"`; `body-content` not visible.
   - `fireEvent.click(button)`. Assert `aria-expanded="true"` and `body-content` is now in the document.
   - Click again. Assert `aria-expanded="false"` and `body-content` is gone.

5. **Auto-opens on rising edge of `running`**
   - Render with `statuses={["complete", "complete"]}` -- drawer starts closed.
   - Rerender with `statuses={["complete", "running"]}`. Assert `aria-expanded="true"` and the body is visible without any user click.
   - Rerender with `statuses={["complete", "complete"]}` (all settled). Assert `aria-expanded` stays `"true"` -- drawer does NOT auto-close.

6. **`defaultOpen` prop**
   - Render with `statuses={["complete"]}` and `defaultOpen`. Assert `aria-expanded="true"` on initial render and the child body is visible immediately.

7. **Running spinner renders for `running` status**
   - Render with `statuses={["running"]}`. Assert `getByLabelText("running")` exists.

**What NOT to do:**
- Do NOT test `ToolCallCard`'s internals -- it has its own behavior and isn't under change here.
- Do NOT test exact class names (fragile). Test visible text, aria attributes, and presence/absence of nodes.
- Do NOT add snapshot tests.

**Verification:**

```sh
cd ~/Projects/RAPID/web/frontend && npx vitest run src/components/primitives/__tests__/ToolCallDrawer.test.tsx
```

All tests must pass. Also re-run the full suite to confirm nothing else regressed:

```sh
cd ~/Projects/RAPID/web/frontend && npx vitest run
```

**Done when:**
- Test file exists at the specified path with the seven cases above.
- `vitest run` on the file passes all cases.
- Full `vitest run` shows no new failures.

---

## Overall Success Criteria

- `npx tsc --noEmit` passes in `web/frontend/`.
- `npx vitest run` passes in `web/frontend/` (all new tests green, no prior tests regressed).
- Manual check (optional, nice-to-have): open the dev server, visit a chat thread with multi-tool-call assistant turns; tool calls are hidden behind a single "N tool calls" row; clicking the row expands the drawer; each `ToolCallCard` inside remains individually expandable via its own chevron; during a live stream, the drawer auto-opens when a tool call enters `running` and remains open after it completes.
