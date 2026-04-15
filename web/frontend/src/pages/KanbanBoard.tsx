import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent, DragOverEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useProjectStore } from "@/stores/projectStore";
import {
  useKanbanBoard,
  useCreateColumn,
  useUpdateColumn,
  useDeleteColumn,
  useCreateCard,
  useUpdateCard,
  useMoveCard,
  useDeleteCard,
} from "@/hooks/useKanban";
import type { KanbanCardResponse, KanbanBoardResponse } from "@/types/api";
import { KanbanColumn } from "@/components/kanban/KanbanColumn";
import { KanbanCard } from "@/components/kanban/KanbanCard";
import { AddColumnButton } from "@/components/kanban/AddColumnButton";
import { CardDetailModal } from "@/components/kanban/CardDetailModal";
import { PageHeader, EmptyState } from "@/components/primitives";

export function KanbanBoard() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { data, isLoading, isError, error, refetch } =
    useKanbanBoard(activeProjectId);

  const projectId = activeProjectId ?? "";
  const createColumn = useCreateColumn(projectId);
  const updateColumn = useUpdateColumn(projectId);
  const deleteColumn = useDeleteColumn(projectId);
  const createCard = useCreateCard(projectId);
  const updateCard = useUpdateCard(projectId);
  const moveCard = useMoveCard(projectId);
  const deleteCard = useDeleteCard(projectId);

  const [activeCard, setActiveCard] = useState<KanbanCardResponse | null>(null);
  const [editingCard, setEditingCard] = useState<KanbanCardResponse | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // -----------------------------------------------------------------------
  // Drag handlers
  // -----------------------------------------------------------------------

  const findCardColumn = useCallback(
    (cardId: string, board: KanbanBoardResponse) => {
      for (const col of board.columns) {
        if (col.cards.some((c) => c.id === cardId)) {
          return col;
        }
      }
      return undefined;
    },
    [],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const cardData = event.active.data.current;
      if (cardData?.type === "card") {
        setActiveCard(cardData.card as KanbanCardResponse);
      }
    },
    [],
  );

  const handleDragOver = useCallback(
    (_event: DragOverEvent) => {
      // Visual cross-column tracking is handled by dnd-kit's SortableContext
      // The actual move happens in onDragEnd
    },
    [],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveCard(null);

      if (!data) return;

      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      if (activeId === overId) return;

      const sourceCol = findCardColumn(activeId, data);
      if (!sourceCol) return;

      // Determine destination: "over" could be a card or a column
      let destColId: string;
      let destPosition: number;

      const overCol = findCardColumn(overId, data);
      if (overCol) {
        // Dropped over another card
        destColId = overCol.id;
        const overIndex = overCol.cards.findIndex((c) => c.id === overId);

        if (sourceCol.id === overCol.id) {
          // Same column reorder
          const activeIndex = sourceCol.cards.findIndex((c) => c.id === activeId);
          const reordered = arrayMove(sourceCol.cards, activeIndex, overIndex);
          destPosition = reordered.findIndex((c) => c.id === activeId);
        } else {
          // Cross-column move
          destPosition = overIndex;
        }
      } else {
        // Dropped over a column itself (empty column)
        const targetCol = data.columns.find((c) => c.id === overId);
        if (!targetCol) return;
        destColId = targetCol.id;
        destPosition = targetCol.cards.length;
      }

      moveCard.mutate({
        cardId: activeId,
        column_id: destColId,
        position: destPosition,
      });
    },
    [data, findCardColumn, moveCard],
  );

  // -----------------------------------------------------------------------
  // Column / card action handlers
  // -----------------------------------------------------------------------

  const handleAddColumn = useCallback(
    (title: string) => {
      createColumn.mutate({ title });
    },
    [createColumn],
  );

  const handleUpdateColumn = useCallback(
    (columnId: string, title: string) => {
      updateColumn.mutate({ columnId, title });
    },
    [updateColumn],
  );

  const handleDeleteColumn = useCallback(
    (columnId: string) => {
      deleteColumn.mutate({ columnId });
    },
    [deleteColumn],
  );

  const handleAddCard = useCallback(
    (columnId: string, title: string) => {
      createCard.mutate({ columnId, title });
    },
    [createCard],
  );

  const handleEditCard = useCallback(
    (card: KanbanCardResponse) => {
      setEditingCard(card);
    },
    [],
  );

  const handleSaveCard = useCallback(
    (cardId: string, updates: { title?: string; description?: string }) => {
      updateCard.mutate({ cardId, ...updates });
    },
    [updateCard],
  );

  const handleDeleteCard = useCallback(
    (cardId: string) => {
      deleteCard.mutate({ cardId });
    },
    [deleteCard],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!activeProjectId) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Kanban"
          breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Kanban" }]}
        />
        <EmptyState
          title="No project selected"
          description="Select a project to view its kanban board."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Kanban"
          breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Kanban" }]}
          description="Loading board..."
        />
        <LoadingSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Kanban"
          breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Kanban" }]}
        />
        <EmptyState
          title="Failed to load board"
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

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      <PageHeader
        title="Kanban"
        breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Kanban" }]}
        description={`${data?.columns.length ?? 0} columns`}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {data?.columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              onEditCard={handleEditCard}
              onDeleteCard={handleDeleteCard}
              onAddCard={handleAddCard}
              onUpdateColumn={handleUpdateColumn}
              onDeleteColumn={handleDeleteColumn}
            />
          ))}
          <AddColumnButton onAdd={handleAddColumn} />
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="opacity-80 shadow-lg rotate-2">
              <KanbanCard
                card={activeCard}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {editingCard && (
        <CardDetailModal
          card={editingCard}
          onSave={handleSaveCard}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex gap-4">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="w-72 space-y-3">
          <div className="bg-surface-1 rounded-lg h-10 animate-pulse" />
          <div className="bg-surface-1 rounded-lg h-24 animate-pulse" />
          <div className="bg-surface-1 rounded-lg h-24 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
