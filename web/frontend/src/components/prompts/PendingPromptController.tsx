import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AskUserModal } from "./AskUserModal";
import { useAgentEventStream } from "@/hooks/useAgentEventStream";
import { useAnswerPrompt } from "@/hooks/useAnswerPrompt";
import { usePendingPrompt } from "@/hooks/usePendingPrompt";
import type { AgentPromptPayload, AskUserSseEvent } from "@/types/agentPrompt";

interface PendingPromptControllerProps {
  runId: string | null;
}

/**
 * Host component that ties the ask-user prompt bridge hooks together.
 *
 * - Uses `usePendingPrompt` as the source of truth for what to render.
 * - Subscribes to the SSE stream via `useAgentEventStream` and optimistically
 *   pushes new `ask_user` events into the pending-prompt query cache; the
 *   mutation's invalidateQueries keeps the cache honest afterwards.
 * - On 409 (stale prompt_id) rejection from `useAnswerPrompt`: fires a
 *   warning toast, stashes the rejected draft, triggers a refetch of the
 *   current pending prompt, and surfaces the stash as `previousDraft` on
 *   the (new) modal so the user can copy their work forward.
 */
export function PendingPromptController({ runId }: PendingPromptControllerProps) {
  const queryClient = useQueryClient();
  const { data: pendingPrompt } = usePendingPrompt(runId);
  const answerMutation = useAnswerPrompt();
  const [previousDraft, setPreviousDraft] = useState<string | null>(null);

  // Push ask_user SSE events into the pending-prompt cache so the modal
  // appears without waiting for a poll/refetch round-trip.
  useAgentEventStream(runId, {
    onAskUser: useCallback(
      (evt: AskUserSseEvent) => {
        if (!runId) return;
        // Strip the SSE-envelope-only fields so the cache value matches the
        // AgentPromptPayload shape produced by GET /pending-prompt.
        const { seq: _seq, ts: _ts, tool_use_id: _tuid, ...payload } = evt;
        queryClient.setQueryData<AgentPromptPayload>(
          ["pendingPrompt", runId],
          payload,
        );
      },
      [queryClient, runId],
    ),
  });

  const handleSubmit = useCallback(
    (answer: string) => {
      if (!pendingPrompt || !runId) return;
      const promptId = pendingPrompt.prompt_id;
      answerMutation.mutate(
        { runId, promptId, answer },
        {
          onSuccess: () => {
            // Successful answer clears any stashed previous draft.
            setPreviousDraft(null);
          },
          onError: (err) => {
            if (err.status === 409) {
              toast.warning(
                "This prompt was superseded — showing current pending prompt",
              );
              setPreviousDraft(answer);
              queryClient.invalidateQueries({
                queryKey: ["pendingPrompt", runId],
              });
            } else {
              toast.error(`Failed to submit answer: ${err.detail}`);
            }
          },
        },
      );
    },
    [pendingPrompt, runId, answerMutation, queryClient],
  );

  if (!runId || !pendingPrompt) {
    return null;
  }

  return (
    <AskUserModal
      prompt={pendingPrompt}
      onSubmit={handleSubmit}
      submitting={answerMutation.isPending}
      previousDraft={previousDraft}
    />
  );
}
