import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/apiClient";
import type { AgentPromptPayload } from "@/types/agentPrompt";

/**
 * Fetch the current pending prompt for an agent run.
 *
 * Backend semantics: returns the AgentPromptPayload row when one exists, or
 * 204 No Content when no prompt is pending. apiClient normalizes 204 to
 * `undefined`, which we coerce to `null` here so consumers can treat
 * "nothing pending" as a single unambiguous value.
 */
export function usePendingPrompt(runId: string | null) {
  return useQuery<AgentPromptPayload | null, ApiError>({
    queryKey: ["pendingPrompt", runId],
    queryFn: async () => {
      const result = await apiClient.get<AgentPromptPayload | undefined>(
        `/agents/runs/${runId}/pending-prompt`,
      );
      return result ?? null;
    },
    enabled: runId !== null,
  });
}
