import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiClient, type ApiError } from "@/lib/apiClient";
import { useProjectStore } from "@/stores/projectStore";
import type { AgentRun, AgentRunListResponse } from "@/types/agents";

export function useAgentRuns(): UseQueryResult<AgentRunListResponse, ApiError> {
  const projectId = useProjectStore((s) => s.activeProjectId);
  return useQuery<AgentRunListResponse, ApiError>({
    queryKey: ["agent-runs", projectId],
    queryFn: () =>
      apiClient.get<AgentRunListResponse>(
        `/agents/runs?project_id=${projectId}`,
      ),
    enabled: projectId !== null,
    staleTime: 5_000,
    refetchInterval: 5_000,
  });
}

export function useAgentRun(
  runId: string | null,
): UseQueryResult<AgentRun, ApiError> {
  return useQuery<AgentRun, ApiError>({
    queryKey: ["agent-run", runId],
    queryFn: () => apiClient.get<AgentRun>(`/agents/runs/${runId}`),
    enabled: runId !== null,
    staleTime: 2_000,
  });
}
