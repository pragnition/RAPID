import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/apiClient";
import type { NoteResponse, NoteListResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useNotesList(projectId: string | null) {
  return useQuery<NoteListResponse, ApiError>({
    queryKey: ["notes", projectId],
    queryFn: () =>
      apiClient.get<NoteListResponse>(`/projects/${projectId}/notes`),
    enabled: projectId !== null,
    staleTime: 2000,
  });
}

export function useNote(projectId: string | null, noteId: string | null) {
  return useQuery<NoteResponse, ApiError>({
    queryKey: ["note", projectId, noteId],
    queryFn: () =>
      apiClient.get<NoteResponse>(
        `/projects/${projectId}/notes/${noteId}`,
      ),
    enabled: projectId !== null && noteId !== null,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateNote(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    NoteResponse,
    ApiError,
    { title: string; content?: string }
  >({
    mutationFn: (body) =>
      apiClient.post<NoteResponse>(`/projects/${projectId}/notes`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["notes", projectId],
      });
    },
  });
}

export function useUpdateNote(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    NoteResponse,
    ApiError,
    { noteId: string; title?: string; content?: string }
  >({
    mutationFn: ({ noteId, ...body }) =>
      apiClient.put<NoteResponse>(
        `/projects/${projectId}/notes/${noteId}`,
        body,
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["notes", projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["note", projectId, variables.noteId],
      });
    },
  });
}

export function useDeleteNote(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, { noteId: string }>({
    mutationFn: ({ noteId }) =>
      apiClient.delete<void>(`/projects/${projectId}/notes/${noteId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["notes", projectId],
      });
    },
  });
}
