import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/apiClient";
import type {
  KanbanBoardResponse,
  KanbanColumnResponse,
  KanbanCardResponse,
} from "@/types/api";

// ---------------------------------------------------------------------------
// Board query
// ---------------------------------------------------------------------------

export function useKanbanBoard(projectId: string | null) {
  return useQuery<KanbanBoardResponse, ApiError>({
    queryKey: ["kanban-board", projectId],
    queryFn: () =>
      apiClient.get<KanbanBoardResponse>(`/projects/${projectId}/kanban`),
    enabled: projectId !== null,
    staleTime: 2000,
  });
}

// ---------------------------------------------------------------------------
// Column mutations
// ---------------------------------------------------------------------------

export function useCreateColumn(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<KanbanColumnResponse, ApiError, { title: string; default_agent_type?: string }>({
    mutationFn: (body) =>
      apiClient.post<KanbanColumnResponse>(
        `/projects/${projectId}/kanban/columns`,
        body,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["kanban-board", projectId],
      });
    },
  });
}

export function useUpdateColumn(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    KanbanColumnResponse,
    ApiError,
    { columnId: string; title?: string; position?: number }
  >({
    mutationFn: ({ columnId, ...body }) =>
      apiClient.put<KanbanColumnResponse>(
        `/projects/${projectId}/kanban/columns/${columnId}`,
        body,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["kanban-board", projectId],
      });
    },
  });
}

export function useDeleteColumn(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, { columnId: string }>({
    mutationFn: ({ columnId }) =>
      apiClient.delete<void>(
        `/projects/${projectId}/kanban/columns/${columnId}`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["kanban-board", projectId],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Card mutations
// ---------------------------------------------------------------------------

export function useCreateCard(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    KanbanCardResponse,
    ApiError,
    { columnId: string; title: string; description?: string; autopilot_ignore?: boolean; agent_type?: string }
  >({
    mutationFn: ({ columnId, ...body }) =>
      apiClient.post<KanbanCardResponse>(
        `/projects/${projectId}/kanban/columns/${columnId}/cards`,
        body,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["kanban-board", projectId],
      });
    },
  });
}

export function useUpdateCard(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    KanbanCardResponse,
    ApiError,
    { cardId: string; title?: string; description?: string; autopilot_ignore?: boolean; agent_type?: string }
  >({
    mutationFn: ({ cardId, ...body }) =>
      apiClient.put<KanbanCardResponse>(
        `/projects/${projectId}/kanban/cards/${cardId}`,
        body,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["kanban-board", projectId],
      });
    },
  });
}

export function useMoveCard(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    KanbanCardResponse,
    ApiError,
    { cardId: string; column_id: string; position: number; rev?: number },
    { previous: KanbanBoardResponse | undefined }
  >({
    mutationFn: ({ cardId, ...body }) =>
      apiClient.put<KanbanCardResponse>(
        `/projects/${projectId}/kanban/cards/${cardId}/move`,
        body,
      ),
    onMutate: async ({ cardId, column_id, position }) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({
        queryKey: ["kanban-board", projectId],
      });

      const previous = queryClient.getQueryData<KanbanBoardResponse>([
        "kanban-board",
        projectId,
      ]);

      if (previous) {
        queryClient.setQueryData<KanbanBoardResponse>(
          ["kanban-board", projectId],
          (old) => {
            if (!old) return old;

            // Deep clone to avoid mutating cache directly
            const columns = old.columns.map((col) => ({
              ...col,
              cards: [...col.cards],
            }));

            // Find the card and its source column
            let movedCard: KanbanCardResponse | undefined;
            for (const col of columns) {
              const idx = col.cards.findIndex((c) => c.id === cardId);
              if (idx !== -1) {
                movedCard = col.cards.splice(idx, 1)[0];
                break;
              }
            }

            if (movedCard) {
              // Insert into destination column
              const destCol = columns.find((c) => c.id === column_id);
              if (destCol) {
                movedCard = { ...movedCard, column_id, position };
                destCol.cards.splice(position, 0, movedCard);
                // Renumber positions in destination
                destCol.cards.forEach((c, i) => {
                  c.position = i;
                });
              }
            }

            // Renumber positions in all columns that lost a card
            for (const col of columns) {
              col.cards.forEach((c, i) => {
                c.position = i;
              });
            }

            return { ...old, columns };
          },
        );
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback to previous state on error
      if (context?.previous) {
        queryClient.setQueryData(
          ["kanban-board", projectId],
          context.previous,
        );
      }
    },
    onSettled: () => {
      // Refetch to reconcile with server truth
      void queryClient.invalidateQueries({
        queryKey: ["kanban-board", projectId],
      });
    },
  });
}

export function useDeleteCard(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, { cardId: string }>({
    mutationFn: ({ cardId }) =>
      apiClient.delete<void>(
        `/projects/${projectId}/kanban/cards/${cardId}`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["kanban-board", projectId],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Column autopilot toggle
// ---------------------------------------------------------------------------

export function useToggleColumnAutopilot(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    KanbanColumnResponse,
    ApiError,
    { columnId: string; isAutopilot: boolean }
  >({
    mutationFn: ({ columnId, isAutopilot }) =>
      apiClient.put<KanbanColumnResponse>(
        `/projects/${projectId}/kanban/columns/${columnId}/autopilot`,
        { is_autopilot: isAutopilot },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["kanban-board", projectId],
      });
    },
  });
}
