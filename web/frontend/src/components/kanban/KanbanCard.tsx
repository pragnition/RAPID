import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { KanbanCardResponse } from "@/types/api";

interface KanbanCardProps {
  card: KanbanCardResponse;
  onEdit: (card: KanbanCardResponse) => void;
  onDelete: (cardId: string) => void;
}

export function KanbanCard({ card, onEdit, onDelete }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: "card", card },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onEdit(card)}
      className="
        group relative
        bg-surface-1 border border-border rounded-lg
        p-3 cursor-grab active:cursor-grabbing
        hover:bg-hover transition-colors duration-100
      "
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(card.id);
        }}
        className="
          absolute top-1.5 right-1.5
          w-5 h-5 flex items-center justify-center
          text-muted hover:text-error
          opacity-0 group-hover:opacity-100
          transition-opacity duration-100
          rounded text-xs
        "
        aria-label="Delete card"
      >
        x
      </button>

      <p className="font-semibold text-fg text-sm pr-4">{card.title}</p>

      {card.description && (
        <p className="text-muted text-xs mt-1 line-clamp-3">
          {card.description}
        </p>
      )}
    </div>
  );
}
