import { useState, useCallback, useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useNotesList, useCreateNote, useDeleteNote } from "@/hooks/useNotes";
import { NotesList } from "@/components/editor/NotesList";
import { NoteEditor } from "@/pages/NoteEditor";
import { PageHeader, EmptyState } from "@/components/primitives";

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
      <div className="p-6 space-y-6">
        <PageHeader
          title="Notes"
          breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Notes" }]}
          actions={
            <button
              type="button"
              className="bg-accent text-bg-0 rounded px-3 py-1.5 text-sm font-semibold"
              onClick={handleCreate}
              disabled
            >
              New Note
            </button>
          }
        />
        <EmptyState
          title="No project selected"
          description="Select a project to view notes."
        />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Notes"
          breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Notes" }]}
        />
        <EmptyState
          title="Failed to load notes"
          description={error?.detail ?? undefined}
          actions={
            <button
              type="button"
              onClick={() => void refetch()}
              className="px-4 py-2 text-sm font-medium bg-accent text-bg-0 rounded hover:opacity-90"
            >
              Retry
            </button>
          }
        />
      </div>
    );
  }

  // Main split-pane layout
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="px-6 py-4 border-b border-border">
        <PageHeader
          title="Notes"
          breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Notes" }]}
          actions={
            <button
              type="button"
              onClick={handleCreate}
              className="bg-accent text-bg-0 rounded px-3 py-1.5 text-sm font-semibold hover:opacity-90"
            >
              New Note
            </button>
          }
        />
      </div>
      <div className="flex flex-1 min-h-0">
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
    </div>
  );
}
