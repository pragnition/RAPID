import { useState, useEffect, useCallback } from "react";
import type { KanbanCardResponse } from "@/types/api";

interface CardDetailModalProps {
  card: KanbanCardResponse;
  onSave: (cardId: string, updates: { title?: string; description?: string }) => void;
  onClose: () => void;
}

export function CardDetailModal({ card, onSave, onClose }: CardDetailModalProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);

  const handleSave = useCallback(() => {
    const updates: { title?: string; description?: string } = {};
    if (title.trim() !== card.title) {
      updates.title = title.trim();
    }
    if (description !== card.description) {
      updates.description = description;
    }
    if (Object.keys(updates).length > 0) {
      onSave(card.id, updates);
    }
    onClose();
  }, [title, description, card, onSave, onClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
        return;
      }
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose, handleSave],
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
          rows={6}
          className="
            w-full px-3 py-2 text-sm
            bg-surface-1 border border-border rounded
            text-fg placeholder:text-muted
            resize-y
            focus:outline-none focus:border-accent
          "
          placeholder="Add a description..."
        />

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
            onClick={handleSave}
            className="
              px-4 py-2 text-sm font-medium
              bg-accent text-bg-0 rounded
              hover:opacity-90 transition-opacity
            "
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
