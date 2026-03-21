import { useState } from "react";

interface AddColumnButtonProps {
  onAdd: (title: string) => void;
}

export function AddColumnButton({ onAdd }: AddColumnButtonProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (trimmed) {
      onAdd(trimmed);
      setTitle("");
      setEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      setTitle("");
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="flex-shrink-0 w-72 bg-surface-0 border border-border rounded-lg p-3 space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (!title.trim()) {
              setEditing(false);
            }
          }}
          placeholder="Column title..."
          autoFocus
          className="
            w-full px-2.5 py-1.5 text-sm
            bg-surface-1 border border-border rounded
            text-fg placeholder:text-muted
            focus:outline-none focus:border-accent
          "
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            className="px-3 py-1 text-xs font-medium bg-accent text-bg-0 rounded hover:opacity-90 transition-opacity"
          >
            Add Column
          </button>
          <button
            type="button"
            onClick={() => {
              setTitle("");
              setEditing(false);
            }}
            className="px-3 py-1 text-xs text-muted hover:text-fg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="
        flex-shrink-0 w-72 h-24
        flex items-center justify-center gap-2
        border-2 border-dashed border-border rounded-lg
        text-muted text-sm
        hover:text-fg hover:border-accent
        transition-colors duration-150
      "
    >
      + Add Column
    </button>
  );
}
