import { useCallback, useEffect, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { apiClient, type ApiError } from "@/lib/apiClient";
import { useProjectStore } from "@/stores/projectStore";
import type {
  Chat,
  ChatCreateRequest,
  ChatListResponse,
  ChatMessage,
  ChatMessageCreateRequest,
} from "@/types/chats";
import type { SseEvent, SseEventKind } from "@/types/sseEvents";

// ---------- useChats ----------

export interface UseChatsResult {
  threads: Chat[];
  isLoading: boolean;
  error: ApiError | null;
  createThread: (args: {
    skillName: string;
    title?: string;
  }) => Promise<Chat>;
  sendMessage: (args: {
    chatId: string;
    content: string;
    tempId?: string;
  }) => Promise<ChatMessage>;
  refetch: () => void;
}

export function useChats(opts?: {
  includeArchived?: boolean;
}): UseChatsResult {
  const projectId = useProjectStore((s) => s.activeProjectId);
  const qc = useQueryClient();
  const includeArchived = opts?.includeArchived ?? false;

  const listQuery = useQuery<ChatListResponse, ApiError>({
    queryKey: ["chats", projectId, includeArchived],
    queryFn: () =>
      apiClient.get<ChatListResponse>(
        `/chats?project_id=${projectId}&include_archived=${includeArchived}`,
      ),
    enabled: projectId !== null,
    staleTime: 30_000,
  });

  const createMutation = useMutation<
    Chat,
    ApiError,
    { skillName: string; title?: string }
  >({
    mutationFn: ({ skillName, title }) =>
      apiClient.post<Chat>("/chats", {
        project_id: projectId,
        skill_name: skillName,
        title,
      } satisfies ChatCreateRequest),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["chats", projectId] });
      qc.setQueryData<Chat>(["chat", created.id], created);
    },
  });

  const sendMutation = useMutation<
    ChatMessage,
    ApiError,
    { chatId: string; content: string; tempId?: string }
  >({
    mutationFn: ({ chatId, content, tempId }) =>
      apiClient.post<ChatMessage>(`/chats/${chatId}/messages`, {
        content,
        temp_id: tempId,
      } satisfies ChatMessageCreateRequest),
    onMutate: ({ chatId, content, tempId }) => {
      // Optimistic: push user message with matching temp_id into cache.
      const optimistic: ChatMessage = {
        id: `temp-${tempId}`,
        chat_id: chatId,
        seq: -1,
        role: "user",
        content,
        tool_calls: [],
        tool_use_id: null,
        agent_run_id: null,
        temp_id: tempId ?? null,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<ChatMessage[]>(
        ["chat-messages", chatId],
        (prev = []) => [...prev, optimistic],
      );
    },
    onSuccess: (real, { chatId }) => {
      // Reconcile: replace the optimistic row matched by temp_id.
      qc.setQueryData<ChatMessage[]>(
        ["chat-messages", chatId],
        (prev = []) =>
          prev.map((m) =>
            m.temp_id === real.temp_id && m.seq === -1 ? real : m,
          ),
      );
    },
    onError: (_err, { chatId, tempId }) => {
      // Remove the failed optimistic row.
      qc.setQueryData<ChatMessage[]>(
        ["chat-messages", chatId],
        (prev = []) =>
          prev.filter((m) => !(m.temp_id === tempId && m.seq === -1)),
      );
    },
  });

  return {
    threads: listQuery.data?.items ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    createThread: async ({ skillName, title }) =>
      createMutation.mutateAsync({ skillName, title }),
    sendMessage: async ({ chatId, content, tempId }) =>
      sendMutation.mutateAsync({ chatId, content, tempId }),
    refetch: () => {
      void listQuery.refetch();
    },
  };
}

// ---------- useChatThread ----------

const CHAT_EVENT_KINDS: SseEventKind[] = [
  "assistant_text",
  "thinking",
  "tool_use",
  "tool_result",
  "ask_user",
  "permission_req",
  "status",
  "run_complete",
  "replay_truncated",
  "retention_warning",
];

export interface UseChatThreadResult {
  thread: Chat | null;
  messages: ChatMessage[];
  stream: { events: SseEvent[]; connected: boolean; error: string | null };
  isLoading: boolean;
  error: ApiError | null;
}

export function useChatThread(chatId: string | null): UseChatThreadResult {
  const qc = useQueryClient();

  const threadQuery = useQuery<Chat, ApiError>({
    queryKey: ["chat", chatId],
    queryFn: () => apiClient.get<Chat>(`/chats/${chatId}`),
    enabled: chatId !== null,
    staleTime: 5_000,
  });

  const messagesQuery = useQuery<ChatMessage[], ApiError>({
    queryKey: ["chat-messages", chatId],
    queryFn: () =>
      apiClient.get<ChatMessage[]>(`/chats/${chatId}/messages`),
    enabled: chatId !== null,
    staleTime: 5_000,
  });

  // SSE live stream.
  const [streamState, setStreamState] = useState<{
    events: SseEvent[];
    connected: boolean;
    error: string | null;
  }>({
    events: [],
    connected: false,
    error: null,
  });

  useEffect(() => {
    if (!chatId) return;
    const es = new EventSource(`/api/chats/${chatId}/events`);
    const onOpen = () =>
      setStreamState((s) => ({ ...s, connected: true, error: null }));
    const onError = () =>
      setStreamState((s) => ({
        ...s,
        connected: false,
        error: "SSE disconnected",
      }));

    // Listen for all 10 kinds; on run_complete, nudge the messages query
    // to refetch so materialized rows appear as soon as the turn completes.
    const handler = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as SseEvent;
        setStreamState((s) => ({
          ...s,
          events: [...s.events, payload],
        }));
        // On run_complete, refetch messages so the materialized assistant
        // ChatMessage row appears.
        if (payload.kind === "run_complete") {
          qc.invalidateQueries({
            queryKey: ["chat-messages", chatId],
          });
        }
      } catch {
        /* ignore malformed events */
      }
    };

    es.addEventListener("open", onOpen);
    es.addEventListener("error", onError);
    for (const k of CHAT_EVENT_KINDS) {
      es.addEventListener(k, handler as EventListener);
    }

    return () => {
      es.close();
    };
  }, [chatId, qc]);

  return {
    thread: threadQuery.data ?? null,
    messages: messagesQuery.data ?? [],
    stream: streamState,
    isLoading: threadQuery.isLoading || messagesQuery.isLoading,
    error: threadQuery.error ?? messagesQuery.error,
  };
}
