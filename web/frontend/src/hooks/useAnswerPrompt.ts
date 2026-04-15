import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/apiClient";

type AnswerPromptVars = {
  runId: string;
  promptId: string;
  answer: string;
};

/**
 * Submit an answer to a pending ask_user prompt.
 *
 * Backend contract:
 *   - 200/204 on success → prompt transitions pending → answered
 *   - 409 on stale prompt_id → caller is expected to swap the modal to the
 *     current pending prompt (see PendingPromptController for that flow).
 *
 * We invalidate the ['pendingPrompt', runId] query on success so the modal
 * controller refetches. No retry logic — stale-answer recovery is the
 * caller's responsibility via onError (ApiError.status === 409).
 *
 * `tool_use_id` is sent alongside `prompt_id` for backwards compatibility
 * with the Wave 1 AnswerRequest schema.
 */
export function useAnswerPrompt() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, AnswerPromptVars>({
    mutationFn: ({ runId, promptId, answer }) =>
      apiClient.post<void>(`/agents/runs/${runId}/answer`, {
        prompt_id: promptId,
        tool_use_id: promptId,
        answer,
      }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["pendingPrompt", vars.runId],
      });
    },
  });
}
