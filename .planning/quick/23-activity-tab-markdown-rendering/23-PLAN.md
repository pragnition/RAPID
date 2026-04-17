# Quick Task 23: Activity Tab Markdown Rendering

## Objective

The AgentRunPage activity feed renders `assistant_text` and `thinking` events as raw text via `{item.text}` inside a plain `<div>`. Agent messages contain markdown (bold, lists, code blocks, headings, tables) that should be rendered as formatted HTML -- matching the existing markdown rendering in `ChatThreadPage`.

## Prior Art

`ChatThreadPage.tsx` (lines 193-196, 504-507) already uses the exact pattern needed:
```tsx
import Markdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
// ...
<div className="prose prose-sm dark:prose-invert max-w-none">
  <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
    {content}
  </Markdown>
</div>
```

All three packages (`react-markdown@10.1.0`, `rehype-sanitize@6.0.0`, `remark-gfm@4.0.1`) are already installed in `package.json`. No new dependencies needed.

---

## Task 1: Add markdown rendering to activity feed text items

**Files to modify:**
- `web/frontend/src/pages/AgentRunPage.tsx`

**Action:**
1. Add imports for `Markdown` from `react-markdown`, `rehypeSanitize` from `rehype-sanitize`, and `remarkGfm` from `remark-gfm` at the top of the file (matching the ChatThreadPage import pattern).
2. Replace the text item rendering block (the `case "text":` branch around lines 343-350) from:
   ```tsx
   case "text":
     return (
       <div
         key={item.key}
         className="text-sm text-fg whitespace-pre-wrap"
       >
         {item.text}
       </div>
     );
   ```
   to:
   ```tsx
   case "text":
     return (
       <div
         key={item.key}
         className="text-sm text-fg prose prose-sm dark:prose-invert max-w-none"
       >
         <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
           {item.text ?? ""}
         </Markdown>
       </div>
     );
   ```
3. Remove the `whitespace-pre-wrap` class (markdown renderer handles its own whitespace/paragraphs). Keep `text-sm text-fg` for base styling; add `prose prose-sm dark:prose-invert max-w-none` for markdown typography.

**What NOT to do:**
- Do NOT add `whitespace-pre-wrap` -- it conflicts with markdown block rendering (causes double spacing in lists/paragraphs).
- Do NOT create a separate MarkdownRenderer component -- this is a one-line change, keep it inline matching the ChatThreadPage pattern.
- Do NOT modify the `tool_call` or `error` cases -- only `text` items need markdown.

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit 2>&1 | head -20
```

**Done criteria:** The `AgentRunPage` text feed items render through `react-markdown` with GFM and sanitization. TypeScript compiles without errors.

---

## Task 2: Add unit test for markdown rendering in activity feed

**Files to modify:**
- `web/frontend/src/pages/__tests__/AgentRunPage.test.tsx`

**Action:**
1. Add a test case that pushes an `assistant_text` event with markdown content (e.g., `"**bold text**"`) into `mockEvents`, renders the page, and asserts that a `<strong>` element with text "bold text" appears in the DOM. This follows the same test pattern used in `ChatThreadPage.test.tsx` (line 170-173).
2. Add a second test case that pushes an `assistant_text` event containing a script tag (e.g., `"Safe text <script>alert('xss')</script>"`) and asserts that no `<script>` element with that payload exists in the DOM (sanitization check).

**Test pattern (from ChatThreadPage.test.tsx):**
```tsx
it("renders markdown in activity feed text items", async () => {
  mockEvents.push({
    seq: 1,
    ts: "2026-01-01T10:00:01Z",
    run_id: "run-abc-123",
    kind: "assistant_text",
    text: "**bold text**",
  });
  renderPage();
  await waitFor(() => {
    const strong = document.querySelector("strong");
    expect(strong).toBeInTheDocument();
    expect(strong?.textContent).toBe("bold text");
  });
});
```

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend && npx vitest run src/pages/__tests__/AgentRunPage.test.tsx 2>&1 | tail -20
```

**Done criteria:** Both tests pass -- markdown formatting renders as HTML elements and script tags are stripped by `rehype-sanitize`.
