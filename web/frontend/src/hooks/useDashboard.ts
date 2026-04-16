import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiClient, type ApiError } from "@/lib/apiClient";
import { useStatusStore } from "@/stores/statusStore";
import type { DashboardResponse } from "@/types/dashboard";

/** 5s base with +/-20% jitter => 4-6s window. */
function jitteredInterval(): number {
  return 5000 + (Math.random() - 0.5) * 2000; // ~4000-6000ms
}

/**
 * Poll `GET /api/dashboard?project_id=X` on a 5s jittered interval and write
 * snapshots into the Zustand {@link useStatusStore}. Consumers that only need
 * aggregate counts or recent items should read from the store directly;
 * callers that need the raw React-Query state can use this hook.
 */
export function useDashboard(
  projectId: string | null,
): UseQueryResult<DashboardResponse, ApiError> {
  const setDashboard = useStatusStore((s) => s.setDashboard);
  const setLastError = useStatusStore((s) => s.setLastError);

  const result = useQuery<DashboardResponse, ApiError>({
    queryKey: ["dashboard", projectId],
    queryFn: () =>
      apiClient.get<DashboardResponse>(
        `/dashboard?project_id=${projectId}`,
      ),
    enabled: projectId !== null,
    refetchInterval: jitteredInterval,
    refetchIntervalInBackground: false, // don't poll when tab is hidden
    staleTime: 2000, // brief window to coalesce rapid re-renders
  });

  useEffect(() => {
    if (result.data) {
      setDashboard({
        runs: result.data.runs_summary,
        chats: result.data.chats_summary,
        kanban: result.data.kanban_summary,
        budget: result.data.budget_remaining,
        recentActivity: result.data.recent_activity,
      });
    }
  }, [result.data, setDashboard]);

  useEffect(() => {
    if (result.error) {
      setLastError(result.error.detail);
    }
  }, [result.error, setLastError]);

  return result;
}
