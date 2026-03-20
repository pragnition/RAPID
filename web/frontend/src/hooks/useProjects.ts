import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/apiClient";
import type {
  ProjectListResponse,
  ProjectDetail,
  HealthResponse,
  PaginationParams,
} from "@/types/api";

export function useProjects(params?: PaginationParams) {
  const searchParams = new URLSearchParams();
  if (params?.page != null) searchParams.set("page", String(params.page));
  if (params?.per_page != null)
    searchParams.set("per_page", String(params.per_page));
  const qs = searchParams.toString();
  const path = qs ? `/projects?${qs}` : "/projects";

  return useQuery<ProjectListResponse, ApiError>({
    queryKey: ["projects", params],
    queryFn: () => apiClient.get<ProjectListResponse>(path),
  });
}

export function useProjectDetail(projectId: string | null) {
  return useQuery<ProjectDetail, ApiError>({
    queryKey: ["project", projectId],
    queryFn: () => apiClient.get<ProjectDetail>(`/projects/${projectId}`),
    enabled: projectId !== null,
  });
}

export function useHealthCheck() {
  return useQuery<HealthResponse, ApiError>({
    queryKey: ["health"],
    queryFn: () => apiClient.get<HealthResponse>("/health"),
    staleTime: 10 * 1000, // 10 seconds
  });
}
