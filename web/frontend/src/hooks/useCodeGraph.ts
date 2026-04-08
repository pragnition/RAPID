import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/apiClient";
import type { CodeGraph, FileContent } from "@/types/api";

export function useCodeGraph(projectId: string | null) {
  return useQuery<CodeGraph, ApiError>({
    queryKey: ["code-graph", projectId],
    queryFn: () =>
      apiClient.get<CodeGraph>(`/projects/${projectId}/code-graph`),
    enabled: projectId !== null,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useFileContent(
  projectId: string | null,
  filePath: string | null,
) {
  return useQuery<FileContent, ApiError>({
    queryKey: ["file-content", projectId, filePath],
    queryFn: () =>
      apiClient.get<FileContent>(
        `/projects/${projectId}/file?path=${encodeURIComponent(filePath!)}`,
      ),
    enabled: projectId !== null && filePath !== null,
    staleTime: 60_000,
  });
}
