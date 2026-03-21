import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/apiClient";
import type {
  ProjectState,
  WorktreeRegistry,
  DagGraph,
  CodebaseTree,
} from "@/types/api";

export function useProjectState(projectId: string | null) {
  return useQuery<ProjectState, ApiError>({
    queryKey: ["project-state", projectId],
    queryFn: () =>
      apiClient.get<ProjectState>(`/projects/${projectId}/state`),
    enabled: projectId !== null,
    refetchInterval: 2000,
    staleTime: 1000,
  });
}

export function useWorktreeRegistry(projectId: string | null) {
  return useQuery<WorktreeRegistry, ApiError>({
    queryKey: ["worktree-registry", projectId],
    queryFn: () =>
      apiClient.get<WorktreeRegistry>(`/projects/${projectId}/worktrees`),
    enabled: projectId !== null,
    refetchInterval: 2000,
    staleTime: 1000,
  });
}

export function useDagGraph(projectId: string | null) {
  return useQuery<DagGraph, ApiError>({
    queryKey: ["dag-graph", projectId],
    queryFn: () =>
      apiClient.get<DagGraph>(`/projects/${projectId}/dag`),
    enabled: projectId !== null,
    refetchInterval: 2000,
    staleTime: 1000,
  });
}

export function useCodebaseTree(
  projectId: string | null,
  maxFiles?: number,
) {
  const params = maxFiles != null ? `?max_files=${maxFiles}` : "";
  return useQuery<CodebaseTree, ApiError>({
    queryKey: ["codebase-tree", projectId, maxFiles],
    queryFn: () =>
      apiClient.get<CodebaseTree>(
        `/projects/${projectId}/codebase${params}`,
      ),
    enabled: projectId !== null,
    refetchInterval: 2000,
    staleTime: 1000,
  });
}
