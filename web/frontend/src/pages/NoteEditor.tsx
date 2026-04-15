import { useState, useEffect, useRef, useCallback } from "react";
import { useNote, useUpdateNote } from "@/hooks/useNotes";
import { useAutosave } from "@/hooks/useAutosave";
import {
  CodeMirrorEditor,
  type CodeMirrorEditorHandle,
} from "@/components/editor/CodeMirrorEditor";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { SurfaceCard } from "@/components/primitives";

interface NoteEditorProps {
  projectId: string;
  noteId: string;
}

const VIM_STORAGE_KEY = "rapid-vim-mode";

function readVimPref(): boolean {
  try {
    return localStorage.getItem(VIM_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function NoteEditor({ projectId, noteId }: NoteEditorProps) {
  const { data: note, isLoading } = useNote(projectId, noteId);
  const updateNote = useUpdateNote(projectId);

  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [vimMode, setVimMode] = useState(readVimPref);
  const editorRef = useRef<CodeMirrorEditorHandle>(null);
  const initializedNoteId = useRef<string | null>(null);

  // Initialize content from fetched note
  useEffect(() => {
    if (note && initializedNoteId.current !== note.id) {
      setContent(note.content);
      setTitle(note.title);
      initializedNoteId.current = note.id;
    }
  }, [note]);

  // Autosave content
  const handleSaveContent = useCallback(
    async (newContent: string) => {
      await updateNote.mutateAsync({ noteId, content: newContent });
    },
    [noteId, updateNote],
  );

  const { isDirty, isSaving, lastSavedAt, flush } = useAutosave({
    content,
    onSave: handleSaveContent,
    delay: 2000,
    enabled: initializedNoteId.current === noteId,
  });

  // Flush autosave on note change or unmount
  useEffect(() => {
    return () => {
      void flush();
    };
  }, [noteId, flush]);

  // Vim mode persistence
  const handleToggleVim = useCallback(() => {
    setVimMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(VIM_STORAGE_KEY, String(next));
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, []);

  // Title save on blur/enter
  const handleTitleBlur = useCallback(() => {
    if (note && title !== note.title && title.trim()) {
      updateNote.mutate({ noteId, title: title.trim() });
    }
  }, [note, title, noteId, updateNote]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      }
    },
    [],
  );

  // Toolbar markdown actions
  const handleBold = useCallback(() => {
    editorRef.current?.wrapSelection("**", "**");
  }, []);

  const handleItalic = useCallback(() => {
    editorRef.current?.wrapSelection("_", "_");
  }, []);

  const handleHeading = useCallback(() => {
    editorRef.current?.insertAtLineStart("## ");
  }, []);

  const handleLink = useCallback(() => {
    editorRef.current?.insertText("[text](url)");
  }, []);

  const handleCode = useCallback(() => {
    editorRef.current?.insertText("\n```\n\n```\n");
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted">Loading note...</p>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted">Note not found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Title + toolbar bar wrapped in elevation-2 surface per wireframe. */}
      <SurfaceCard elevation={2} className="rounded-none border-x-0 border-t-0">
        <div className="px-4 py-2 border-b border-border">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            placeholder="Note title"
            className="
              w-full text-xl font-bold text-fg bg-transparent
              border-none outline-none placeholder:text-muted
            "
          />
        </div>
        <EditorToolbar
          onBold={handleBold}
          onItalic={handleItalic}
          onHeading={handleHeading}
          onLink={handleLink}
          onCode={handleCode}
          vimMode={vimMode}
          onToggleVim={handleToggleVim}
          isDirty={isDirty}
          isSaving={isSaving}
          lastSavedAt={lastSavedAt}
        />
      </SurfaceCard>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <CodeMirrorEditor
          ref={editorRef}
          value={content}
          onChange={setContent}
          vimMode={vimMode}
        />
      </div>
    </div>
  );
}
