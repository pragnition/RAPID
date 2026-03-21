import { useState, useCallback, useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useNotesList, useCreateNote, useDeleteNote } from "@/hooks/useNotes";
import { NotesList } from "@/components/editor/NotesList";
import { NoteEditor } from "@/pages/NoteEditor";

export function NotesPage() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projectId = activeProjectId ?? "";

  const { data, isLoading, isError, error, refetch } =
    useNotesList(activeProjectId);
  const createNote = useCreateNote(projectId);
  const deleteNote = useDeleteNote(projectId);

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // Auto-select the first note when the list loads and nothing is selected
  useEffect(() => {
    if (data && data.items.length > 0 && activeNoteId === null) {
      setActiveNoteId(data.items[0]!.id);
    }
  }, [data, activeNoteId]);

  // If active note was deleted, clear selection
  useEffect(() => {
    if (data && activeNoteId) {
      const exists = data.items.some((n) => n.id === activeNoteId);
      if (!exists) {
        setActiveNoteId(data.items[0]?.id ?? null);
      }
    }
  }, [data, activeNoteId]);

  const handleCreate = useCallback(() => {
    createNote.mutate(
      { title: "Untitled", content: "" },
      {
        onSuccess: (newNote) => {
          setActiveNoteId(newNote.id);
        },
      },
    );
  }, [createNote]);

  const handleDelete = useCallback(
    (noteId: string) => {
      deleteNote.mutate({ noteId });
      // Selection cleanup is handled by the useEffect above
    },
    [deleteNote],
  );

  // No project selected
  if (!activeProjectId) {
    return (
      <div className="p-6">
        <div className="bg-surface-1 border border-border rounded-lg p-8 text-center">
          <p className="text-muted text-lg">
            Select a project to view notes
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="p-6">
        <div className="bg-surface-1 border border-border rounded-lg p-6 text-center">
          <p className="text-error mb-3">
            Failed to load notes{error?.detail ? `: ${error.detail}` : ""}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="
              px-4 py-2 text-sm font-medium
              bg-accent text-bg-0 rounded
              hover:opacity-90 transition-opacity
            "
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Main split-pane layout
  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Left pane: notes list */}
      <NotesList
        notes={data?.items ?? []}
        activeNoteId={activeNoteId}
        onSelect={setActiveNoteId}
        onCreate={handleCreate}
        onDelete={handleDelete}
        isLoading={isLoading}
      />

      {/* Right pane: editor or placeholder */}
      {activeNoteId && activeProjectId ? (
        <NoteEditor
          key={activeNoteId}
          projectId={activeProjectId}
          noteId={activeNoteId}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted text-lg">
            Select a note or create a new one
          </p>
        </div>
      )}
    </div>
  );
}
