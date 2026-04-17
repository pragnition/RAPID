import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { KanbanColumnResponse, KanbanCardResponse } from "@/types/api";
import { KanbanCard } from "./KanbanCard";
import { CreateCardModal } from "./CreateCardModal";

interface KanbanColumnProps {
  column: KanbanColumnResponse;
  isDropTarget?: boolean;
  onEditCard: (card: KanbanCardResponse) => void;
  onDeleteCard: (cardId: string) => void;
  onAddCard: (columnId: string, data: { title: string; description: string; autopilot_ignore: boolean }) => void;
  onUpdateColumn: (columnId: string, title: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onToggleAutopilot: (columnId: string, enabled: boolean) => void;
}

export function KanbanColumn({
  column,
  isDropTarget,
  onEditCard,
  onDeleteCard,
  onAddCard,
  onUpdateColumn,
  onDeleteColumn,
  onToggleAutopilot,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: column.id });

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(column.title);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const cardIds = column.cards.map((c) => c.id);

  const handleTitleSave = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== column.title) {
      onUpdateColumn(column.id, trimmed);
    }
    setEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTitleSave();
    } else if (e.key === "Escape") {
      setTitleDraft(column.title);
      setEditingTitle(false);
    }
  };

  return (
    <div className={`flex-shrink-0 w-72 bg-surface-0 border rounded-lg flex flex-col max-h-[calc(100vh-12rem)] transition-colors duration-150 ${isDropTarget ? "border-accent/60 bg-accent/5" : "border-border"}`}>
      {/* Column header */}
      <div className="group flex items-center gap-2 px-3 py-2.5 border-b border-border">
        {editingTitle ? (
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            autoFocus
            className="
              flex-1 px-1.5 py-0.5 text-sm font-semibold
              bg-surface-1 border border-accent rounded
              text-fg focus:outline-none
            "
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTitleDraft(column.title);
              setEditingTitle(true);
            }}
            className="flex-1 text-left text-sm font-semibold text-fg hover:text-accent transition-colors"
          >
            {column.title}
          </button>
        )}

        <span className="text-xs text-muted tabular-nums">
          {column.cards.length}
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleAutopilot(column.id, !column.is_autopilot);
          }}
          className={`
            w-5 h-5 flex items-center justify-center
            rounded text-xs transition-all duration-100
            ${
              column.is_autopilot
                ? "text-blue-400 opacity-100"
                : "text-muted opacity-0 group-hover:opacity-100 hover:text-blue-400"
            }
          `}
          aria-label={
            column.is_autopilot ? "Disable autopilot" : "Enable autopilot"
          }
          title={
            column.is_autopilot ? "Autopilot enabled" : "Enable autopilot"
          }
        >
          &#x26A1;
        </button>

        <button
          type="button"
          onClick={() => onDeleteColumn(column.id)}
          className="
            w-5 h-5 flex items-center justify-center
            text-muted hover:text-error
            opacity-0 group-hover:opacity-100
            transition-opacity duration-100
            rounded text-xs
          "
          aria-label="Delete column"
        >
          x
        </button>
      </div>

      {/* Card list */}
      <div ref={setNodeRef} className="flex-1 overflow-y-auto p-2 space-y-2">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onEdit={onEditCard}
              onDelete={onDeleteCard}
            />
          ))}
        </SortableContext>
        {isDropTarget && column.cards.length === 0 && (
          <div className="border-2 border-dashed border-accent/40 rounded-lg p-4 text-center text-xs text-muted">
            Drop here
          </div>
        )}
      </div>

      {/* Add card */}
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="
            w-full py-1.5 text-xs text-muted
            hover:text-fg hover:bg-hover
            rounded transition-colors duration-100
          "
        >
          + Add card
        </button>
      </div>

      {showCreateModal && (
        <CreateCardModal
          onSubmit={(data) => {
            onAddCard(column.id, data);
            setShowCreateModal(false);
          }}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
