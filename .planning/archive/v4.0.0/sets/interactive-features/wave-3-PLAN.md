# PLAN: interactive-features / Wave 3 — Markdown Note Editor

## Objective

Build the complete Markdown Note Editor feature: install CodeMirror 6 dependencies, create the split-pane note editor page with a notes list sidebar and a CodeMirror editor, implement debounced autosave (2s inactivity, flush on navigation), add vim mode toggle, and replace the existing `NotesPage.tsx` placeholder. This wave delivers a fully functional note-taking experience integrated with the existing notes API from Wave 1.

## Prerequisites

- Wave 1 complete: backend API endpoints for notes CRUD are operational
- `apiClient.put()` available from Wave 1
- TypeScript types (`NoteResponse`, `NoteListResponse`) available from Wave 1

## File Ownership

| File | Action |
|------|--------|
| `web/frontend/package.json` | Modify: add codemirror dependencies |
| `web/frontend/src/pages/NotesPage.tsx` | Rewrite: replace placeholder with split-pane layout |
| `web/frontend/src/pages/NoteEditor.tsx` | Create: CodeMirror 6 editor page (right pane content) |
| `web/frontend/src/components/editor/CodeMirrorEditor.tsx` | Create: CodeMirror 6 wrapper component |
| `web/frontend/src/components/editor/EditorToolbar.tsx` | Create: minimal markdown toolbar |
| `web/frontend/src/components/editor/NotesList.tsx` | Create: left pane notes list |
| `web/frontend/src/hooks/useNotes.ts` | Create: TanStack Query hooks for notes API |
| `web/frontend/src/hooks/useAutosave.ts` | Create: debounced autosave hook |

---

## Task 1: Install CodeMirror dependencies

### What
Add CodeMirror 6 packages to the frontend dependencies.

Run from `web/frontend/`:
```bash
npm install codemirror @codemirror/view @codemirror/state @codemirror/lang-markdown @codemirror/language @replit/codemirror-vim
```

Note: The package name is `@replit/codemirror-vim` (NOT `@codemirror/vim` which does not exist). The `codemirror` meta-package provides `basicSetup` which bundles common extensions.

### Where
`web/frontend/package.json` will be modified by npm.

### Verification
```bash
cd /home/kek/Projects/RAPID/web/frontend && node -e "require('codemirror'); require('@codemirror/lang-markdown'); require('@replit/codemirror-vim'); console.log('CodeMirror OK')"
```

---

## Task 2: Create useNotes hook

### What
Create `web/frontend/src/hooks/useNotes.ts` following the pattern from `useViews.ts` and `useKanban.ts`.

Define these hooks:

**`useNotesList(projectId: string | null)`:**
- `useQuery` with key `["notes", projectId]`
- Fetches `GET /projects/${projectId}/notes`
- Returns `NoteListResponse`
- `enabled: projectId !== null`
- `staleTime: 2000`

**`useNote(projectId: string | null, noteId: string | null)`:**
- `useQuery` with key `["note", projectId, noteId]`
- Fetches `GET /projects/${projectId}/notes/${noteId}`
- Returns `NoteResponse`
- `enabled: projectId !== null && noteId !== null`

**`useCreateNote(projectId: string)`:**
- `useMutation` that POSTs to `/projects/${projectId}/notes`
- Body: `{ title: string, content?: string }`
- `onSuccess`: invalidate `["notes", projectId]`
- Returns the created `NoteResponse`

**`useUpdateNote(projectId: string)`:**
- `useMutation` that PUTs to `/projects/${projectId}/notes/${noteId}`
- Mutation function takes `{ noteId: string, title?: string, content?: string }`
- `onSuccess`: invalidate `["notes", projectId]` and `["note", projectId, noteId]`

**`useDeleteNote(projectId: string)`:**
- `useMutation` that DELETEs `/projects/${projectId}/notes/${noteId}`
- `onSuccess`: invalidate `["notes", projectId]`

### Where
New file: `web/frontend/src/hooks/useNotes.ts`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

---

## Task 3: Create useAutosave hook

### What
Create `web/frontend/src/hooks/useAutosave.ts`.

This hook manages debounced autosave with flush-on-navigation.

**Signature:**
```typescript
function useAutosave(opts: {
  content: string;
  onSave: (content: string) => Promise<void>;
  delay?: number; // default 2000ms
  enabled?: boolean; // default true
}): {
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  flush: () => Promise<void>;
}
```

**Behavior:**
1. Track the "last saved content" via a ref
2. When `content` changes and differs from last saved, set `isDirty = true`
3. After `delay` ms of no changes (debounce), call `onSave(content)`
4. On save success, update lastSavedAt, set isDirty = false, update the saved-content ref
5. On save error, keep isDirty = true (will retry on next change)
6. `flush()` immediately saves if dirty (cancel pending debounce, save now)
7. Register a `beforeunload` event handler that calls `flush()` synchronously (use `navigator.sendBeacon` or synchronous XHR as fallback for beforeunload)
8. Clean up the debounce timer and beforeunload listener on unmount
9. When `enabled` is false, do not trigger autosave (but still track dirty state)

Implementation detail: Use `useRef` for the timer ID, `useCallback` for the save function, `useEffect` for the debounce trigger and cleanup.

### Where
New file: `web/frontend/src/hooks/useAutosave.ts`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

---

## Task 4: Create CodeMirrorEditor component

### What
Create `web/frontend/src/components/editor/CodeMirrorEditor.tsx`.

This is a controlled CodeMirror 6 editor wrapper.

**Props:**
```typescript
interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  vimMode?: boolean;
  className?: string;
}
```

**Behavior:**
1. Create the editor on mount using `EditorView` from `@codemirror/view` and `EditorState` from `@codemirror/state`
2. Use a `ref` to hold the parent DOM element
3. Extensions:
   - `basicSetup` from `codemirror` (provides line numbers, bracket matching, etc.)
   - `markdown()` from `@codemirror/lang-markdown` for syntax highlighting
   - `EditorView.updateListener.of(update => { if (update.docChanged) onChange(update.state.doc.toString()) })`
   - Custom theme extension to match Everforest colors: set `.cm-editor` background to match `bg-surface-1`, text color to `text-fg`, cursor color to accent, selection to hover color. Use `EditorView.theme()`.
   - When `vimMode` is true, add `vim()` from `@replit/codemirror-vim`
4. When `value` prop changes externally (not from user typing), update the editor content without triggering onChange (use a "programmatic update" flag ref)
5. When `vimMode` prop changes, reconfigure the editor extensions (use `EditorView.reconfigure` or recreate state with compartments)
6. Clean up: destroy the `EditorView` on unmount

Use `useRef` for the EditorView instance, `useEffect` for initialization and cleanup.

**Important:** Use CodeMirror 6 "compartments" pattern for togglable extensions (vim mode). Create a `Compartment` for the vim extension, and use `view.dispatch({ effects: compartment.reconfigure(...) })` to toggle it.

### Where
New file: `web/frontend/src/components/editor/CodeMirrorEditor.tsx`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

---

## Task 5: Create EditorToolbar component

### What
Create `web/frontend/src/components/editor/EditorToolbar.tsx`.

**Props:**
```typescript
interface EditorToolbarProps {
  onBold: () => void;
  onItalic: () => void;
  onHeading: () => void;
  onLink: () => void;
  onCode: () => void;
  vimMode: boolean;
  onToggleVim: () => void;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
}
```

**Behavior:**
- A horizontal toolbar bar above the editor
- Buttons: **B** (bold), *I* (italic), H (heading), Link, `</>` (code block)
- Each button inserts the corresponding markdown syntax by calling the callback (the parent will handle inserting text into CodeMirror)
- Vim toggle: a small toggle switch or button labeled "Vim" that toggles vim keybindings on/off
- Save indicator on the right side:
  - If saving: "Saving..." in muted text
  - If dirty: "Unsaved changes" in warning/muted text
  - If saved: "Saved at {time}" in muted text
  - If neither dirty nor saved: nothing shown
- Theme: `bg-surface-0`, `border-b border-border`, buttons use `text-muted hover:text-fg`

Note: For the first version, the toolbar buttons can simply call the parent's callback which inserts markdown text at the cursor position in CodeMirror. The CodeMirrorEditor component should expose a method to insert text (via `useImperativeHandle` or by passing a ref).

Alternatively, simplify by making the toolbar buttons trigger document manipulation through the `EditorView` ref. The parent page can hold the EditorView ref and pass insert functions down.

### Where
New file: `web/frontend/src/components/editor/EditorToolbar.tsx`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

---

## Task 6: Create NotesList component

### What
Create `web/frontend/src/components/editor/NotesList.tsx`.

**Props:**
```typescript
interface NotesListProps {
  notes: NoteResponse[];
  activeNoteId: string | null;
  onSelect: (noteId: string) => void;
  onCreate: () => void;
  onDelete: (noteId: string) => void;
  isLoading: boolean;
}
```

**Behavior:**
- A vertical list of note items in a narrow panel (left pane)
- Header: "Notes" title with a "+" button to create a new note
- Each note item shows:
  - Title (bold, truncated to 1 line)
  - Updated timestamp (muted, relative format like "2 minutes ago" or absolute date)
  - First ~50 chars of content as preview (muted, truncated)
- Active note has `bg-hover` background highlight
- Click selects a note (calls `onSelect`)
- Delete button (x) appears on hover for each note
- Loading state: show skeleton placeholders
- Empty state: "No notes yet. Create one!" message
- Theme: `bg-surface-0`, `border-r border-border`, items have `hover:bg-hover`
- Width: `w-64` fixed, with `overflow-y-auto` for scrolling

### Where
New file: `web/frontend/src/components/editor/NotesList.tsx`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

---

## Task 7: Create NoteEditor page

### What
Create `web/frontend/src/pages/NoteEditor.tsx`.

This is the right-pane content component that renders the CodeMirror editor for the active note.

**Props:**
```typescript
interface NoteEditorProps {
  projectId: string;
  noteId: string;
}
```

**Behavior:**
1. Use `useNote(projectId, noteId)` to fetch the note content
2. Maintain local `content` state initialized from the fetched note
3. Maintain `title` state for inline title editing
4. Render `EditorToolbar` above the editor
5. Render `CodeMirrorEditor` below the toolbar
6. Use `useAutosave({ content, onSave: saveFunction, delay: 2000 })` where `saveFunction` calls `useUpdateNote`
7. Manage `vimMode` state in local state (default false), persist to localStorage key `"rapid-vim-mode"`
8. Wire toolbar buttons to insert markdown at cursor position in CodeMirror:
   - Bold: wrap selection with `**`
   - Italic: wrap selection with `_`
   - Heading: insert `## ` at line start
   - Link: insert `[text](url)`
   - Code: insert triple backticks for code block
9. Title is editable: an input field above the editor. On blur or Enter, save the title via `useUpdateNote`
10. Show loading spinner while note is fetching
11. On unmount or when noteId changes, flush the autosave

### Where
New file: `web/frontend/src/pages/NoteEditor.tsx`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

---

## Task 8: Rewrite NotesPage with split-pane layout

### What
Completely rewrite `web/frontend/src/pages/NotesPage.tsx` to implement the split-pane layout.

**Behavior:**
1. Get `activeProjectId` from `useProjectStore`
2. If no project selected, show: "Select a project to view notes"
3. Use `useNotesList(activeProjectId)` to fetch notes
4. Maintain `activeNoteId` state (initially null, or first note in list)
5. Layout: split pane with `NotesList` on the left and `NoteEditor` on the right
   - Use `flex` container: `<div className="flex h-[calc(100vh-3rem)]">` (subtracting header height)
   - Left pane: `NotesList` component (fixed width ~256px)
   - Right pane: `NoteEditor` component (flex-1, fills remaining space)
   - If no note selected, right pane shows: "Select a note or create a new one"
6. "Create note" flow:
   - Call `useCreateNote` with default title "Untitled" and empty content
   - On success, set the new note's ID as `activeNoteId`
7. "Delete note" flow:
   - Call `useDeleteNote`
   - On success, if deleted note was active, set `activeNoteId` to null (or next note)
8. Error state: show error with retry, matching ProjectsPage pattern
9. Loading state: show skeleton in notes list, empty right pane

The page title should be "Notes" at the top of the notes list panel, not as a full-width header.

### Where
`web/frontend/src/pages/NotesPage.tsx` (rewrite existing placeholder)

### Verification
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

---

## Success Criteria

1. `npm install` completes without errors after adding CodeMirror packages
2. Notes page shows split-pane layout with notes list and editor
3. CodeMirror 6 renders with markdown syntax highlighting
4. Vim mode toggleable via toolbar button, persisted to localStorage
5. Autosave triggers after 2 seconds of inactivity
6. Save indicator in toolbar shows saving/saved/unsaved state
7. Toolbar buttons insert markdown formatting at cursor position
8. Notes can be created, selected, edited, and deleted
9. Content autosaves on navigation away (flush on unmount/beforeunload)
10. TypeScript compiles with zero errors

## What NOT To Do

- Do NOT modify any backend files -- those are all Wave 1
- Do NOT modify kanban components or hooks -- those are Wave 2
- Do NOT add markdown preview pane -- that is a deferred feature
- Do NOT add note folders/organization -- flat list for v1
- Do NOT install `@codemirror/vim` -- use `@replit/codemirror-vim` (the correct package name)
- Do NOT use `contentEditable` or raw textarea -- CodeMirror 6 is the editor
- Do NOT use a heavyweight markdown AST for toolbar actions -- simple string insertion at cursor is sufficient for v1
- Do NOT block navigation for unsaved changes (no "Are you sure?" dialog) -- just flush the save silently
