import { useState, useEffect, useCallback } from "react";
import type { KanbanCardResponse } from "@/types/api";

interface CardDetailModalProps {
  card: KanbanCardResponse;
  onSave: (cardId: string, updates: { title?: string; description?: string; autopilot_ignore?: boolean; agent_type?: string }) => void;
  onClose: () => void;
}

export function CardDetailModal({ card, onSave, onClose }: CardDetailModalProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [autopilotIgnore, setAutopilotIgnore] = useState(card.autopilot_ignore);
  const [agentType, setAgentType] = useState(card.agent_type ?? "quick");

  const handleSave = useCallback(() => {
    const updates: { title?: string; description?: string; autopilot_ignore?: boolean; agent_type?: string } = {};
    if (title.trim() !== card.title) {
      updates.title = title.trim();
    }
    if (description !== card.description) {
      updates.description = description;
    }
    if (autopilotIgnore !== card.autopilot_ignore) {
      updates.autopilot_ignore = autopilotIgnore;
    }
    if (agentType !== (card.agent_type ?? "quick")) {
      updates.agent_type = agentType;
    }
    if (Object.keys(updates).length > 0) {
      onSave(card.id, updates);
    }
    onClose();
  }, [title, description, autopilotIgnore, agentType, card, onSave, onClose]);

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

        {/* Agent type — hidden when autopilot is ignored */}
        {!autopilotIgnore && (
          <>
            <label className="block text-xs text-muted mt-3 mb-1">Agent type</label>
            <select
              value={agentType}
              onChange={(e) => setAgentType(e.target.value)}
              className="
                w-full px-3 py-1.5 text-sm
                bg-surface-1 border border-border rounded
                text-fg
                focus:outline-none focus:border-accent
              "
            >
              <option value="quick">Quick task</option>
              <option value="bug-fix">Bug fix</option>
            </select>
          </>
        )}

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

        {/* Agent metadata */}
        {(card.agent_status !== "idle" || card.created_by !== "human") && (
          <div className="mt-4 p-3 bg-surface-1 border border-border rounded space-y-1.5">
            <p className="text-xs font-semibold text-fg">Agent Activity</p>
            {card.created_by !== "human" && (
              <p className="text-xs text-muted">
                <span className="text-fg/60">Created by:</span>{" "}
                {card.created_by}
              </p>
            )}
            {card.agent_status !== "idle" && (
              <p className="text-xs text-muted">
                <span className="text-fg/60">Status:</span>{" "}
                {card.agent_status}
              </p>
            )}
            {card.agent_run_id && (
              <p className="text-xs text-muted">
                <span className="text-fg/60">Run ID:</span>{" "}
                {card.agent_run_id.slice(0, 8)}
              </p>
            )}
            {card.retry_count > 0 && (
              <p className="text-xs text-muted">
                <span className="text-fg/60">Retries:</span>{" "}
                {card.retry_count}
              </p>
            )}
            <p className="text-xs text-muted">
              <span className="text-fg/60">Rev:</span> {card.rev}
            </p>
          </div>
        )}

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
