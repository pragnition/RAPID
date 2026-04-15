import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/apiClient";

type ReopenPromptVars = {
  runId: string;
  promptId: string;
};

/**
 * Re-open a previously answered prompt for editing.
 *
 * Backend contract (Wave 1): transitions the target prompt back to
 * `pending` and marks any downstream prompts generated from the old
 * answer as `stale`. See
 * POST /api/agents/runs/{run_id}/prompts/{prompt_id}/reopen.
 *
 * Invalidates the pending-prompt query on success.
 */
export function useReopenPrompt() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, ReopenPromptVars>({
    mutationFn: ({ runId, promptId }) =>
      apiClient.post<void>(
        `/agents/runs/${runId}/prompts/${promptId}/reopen`,
        {},
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["pendingPrompt", vars.runId],
      });
    },
  });
}
