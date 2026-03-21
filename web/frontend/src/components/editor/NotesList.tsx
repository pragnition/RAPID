import { useState } from "react";
import type { NoteResponse } from "@/types/api";

interface NotesListProps {
  notes: NoteResponse[];
  activeNoteId: string | null;
  onSelect: (noteId: string) => void;
  onCreate: () => void;
  onDelete: (noteId: string) => void;
  isLoading: boolean;
}

export function NotesList({
  notes,
  activeNoteId,
  onSelect,
  onCreate,
  onDelete,
  isLoading,
}: NotesListProps) {
  return (
    <div className="w-64 flex-shrink-0 bg-surface-0 border-r border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-lg font-bold text-fg">Notes</h2>
        <button
          type="button"
          onClick={onCreate}
          title="Create new note"
          className="
            w-7 h-7 flex items-center justify-center rounded
            text-muted hover:text-fg hover:bg-hover
            transition-colors text-lg leading-none
          "
        >
          +
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && <LoadingSkeleton />}

        {!isLoading && notes.length === 0 && (
          <div className="p-4 text-center">
            <p className="text-muted text-sm">No notes yet. Create one!</p>
          </div>
        )}

        {!isLoading &&
          notes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              isActive={note.id === activeNoteId}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Note item
// ---------------------------------------------------------------------------

function NoteItem({
  note,
  isActive,
  onSelect,
  onDelete,
}: {
  note: NoteResponse;
  isActive: boolean;
  onSelect: (noteId: string) => void;
  onDelete: (noteId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const preview = note.content.slice(0, 50).replace(/\n/g, " ");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(note.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(note.id);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        px-4 py-3 cursor-pointer border-b border-border
        transition-colors relative
        ${isActive ? "bg-hover" : "hover:bg-hover"}
      `}
    >
      <div className="flex items-start justify-between gap-1">
        <h3 className="text-sm font-semibold text-fg truncate flex-1">
          {note.title || "Untitled"}
        </h3>
        {isHovered && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note.id);
            }}
            title="Delete note"
            className="
              w-5 h-5 flex items-center justify-center rounded
              text-muted hover:text-error hover:bg-error/10
              transition-colors text-xs leading-none flex-shrink-0
            "
          >
            x
          </button>
        )}
      </div>
      <p className="text-xs text-muted mt-0.5">{formatRelativeTime(note.updated_at)}</p>
      {preview && (
        <p className="text-xs text-muted mt-1 truncate">{preview}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="px-4 py-3 border-b border-border">
          <div className="h-4 bg-surface-1 rounded animate-pulse w-3/4 mb-2" />
          <div className="h-3 bg-surface-1 rounded animate-pulse w-1/2 mb-1" />
          <div className="h-3 bg-surface-1 rounded animate-pulse w-full" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Relative time formatter
// ---------------------------------------------------------------------------

function formatRelativeTime(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) return "just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
