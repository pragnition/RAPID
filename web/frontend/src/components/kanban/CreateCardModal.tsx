import { useState, useEffect, useCallback } from "react";

interface CreateCardModalProps {
  onSubmit: (data: {
    title: string;
    description: string;
    autopilot_ignore: boolean;
  }) => void;
  onClose: () => void;
}

export function CreateCardModal({ onSubmit, onClose }: CreateCardModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [autopilotIgnore, setAutopilotIgnore] = useState(false);

  const handleSubmit = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit({
      title: trimmed,
      description,
      autopilot_ignore: autopilotIgnore,
    });
  }, [title, description, autopilotIgnore, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose, handleSubmit],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="
          bg-surface-0 border border-border rounded-lg
          w-full max-w-lg mx-4 p-6
          shadow-lg
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          className="
            w-full text-lg font-semibold
            bg-transparent border-b border-border
            text-fg pb-2 mb-4
            focus:outline-none focus:border-accent
          "
          placeholder="Card title"
        />

        {/* Description */}
        <label className="block text-xs text-muted mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="
            w-full px-3 py-2 text-sm
            bg-surface-1 border border-border rounded
            text-fg placeholder:text-muted
            resize-y
            focus:outline-none focus:border-accent
          "
          placeholder="Add a description..."
        />

        {/* Autopilot ignore */}
        <label className="flex items-center gap-2 mt-3">
          <input
            type="checkbox"
            checked={autopilotIgnore}
            onChange={(e) => setAutopilotIgnore(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-sm text-fg">Ignore autopilot</span>
        </label>
        <p className="text-xs text-muted ml-6">
          Autopilot agents will skip this card
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted hover:text-fg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="
              px-4 py-2 text-sm font-medium
              bg-accent text-bg-0 rounded
              hover:opacity-90 transition-opacity
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
