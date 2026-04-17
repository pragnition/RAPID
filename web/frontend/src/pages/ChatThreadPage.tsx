import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import Markdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import {
  Composer,
  ToolCallCard,
  ToolCallDrawer,
  ErrorCard,
  AutoScrollPill,
  StreamingCursor,
  SlashAutocomplete,
  PageHeader,
  StatusBadge,
} from "@/components/primitives";
import type { SlashAutocompleteItem } from "@/components/primitives/SlashAutocomplete";
import { LiveRegion } from "@/components/a11y";
import { useChats, useChatThread } from "@/hooks/useChats";
import { useSkills } from "@/hooks/useSkills";
import { useAutoScrollWithOptOut } from "@/components/primitives/hooks/useAutoScrollWithOptOut";
import type { ChatMessage, ChatToolCall } from "@/types/chats";
import type { SseEvent } from "@/types/sseEvents";
import type { QuestionDef } from "@/types/agentPrompt";
import { AskUserModal } from "@/components/prompts/AskUserModal";

// ---------------------------------------------------------------------------
// Session status badge
// ---------------------------------------------------------------------------

type BadgeTone = Parameters<typeof StatusBadge>[0]["tone"];

const SESSION_TONE: Record<string, BadgeTone> = {
  active: "accent",
  idle: "muted",
  archived: "info",
};

// ---------------------------------------------------------------------------
// Streaming text accumulator
// ---------------------------------------------------------------------------

function accumulateStreamingText(events: SseEvent[]): string {
  let text = "";
  for (const ev of events) {
    if (ev.kind === "assistant_text") {
      text += ev.text;
    }
  }
  return text;
}

function hasActiveStream(events: SseEvent[]): boolean {
  if (events.length === 0) return false;
  const complete = events.some((e) => e.kind === "run_complete");
  if (complete) return false;
  // Active if we have any content events (text, tool calls, or thinking)
  return events.some(
    (e) =>
      e.kind === "assistant_text" ||
      e.kind === "tool_use" ||
      e.kind === "thinking" ||
      e.kind === "status",
  );
}

// ---------------------------------------------------------------------------
// Tool call pairing helper
// ---------------------------------------------------------------------------

interface PairedToolCall {
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
  output?: unknown;
  isError: boolean;
  status: "running" | "complete" | "error";
}

function pairToolCalls(toolCalls: ChatToolCall[]): PairedToolCall[] {
  // Materialized tool calls are from completed runs — never "running"
  return toolCalls.map((tc) => ({
    toolUseId: tc.tool_use_id,
    toolName: tc.tool_name,
    input: tc.input,
    output: tc.output,
    isError: tc.is_error ?? false,
    status: tc.is_error ? "error" : "complete",
  }));
}

function pairStreamToolEvents(events: SseEvent[]): PairedToolCall[] {
  const map = new Map<string, PairedToolCall>();
  const isComplete = events.some((e) => e.kind === "run_complete");
  for (const ev of events) {
    if (ev.kind === "tool_use") {
      map.set(ev.tool_use_id, {
        toolUseId: ev.tool_use_id,
        toolName: ev.tool_name,
        input: ev.input,
        isError: false,
        status: "running",
      });
    } else if (ev.kind === "tool_result") {
      const entry = map.get(ev.tool_use_id);
      if (entry) {
        entry.output = ev.output;
        entry.isError = ev.is_error;
        entry.status = ev.is_error ? "error" : "complete";
      }
    }
  }
  // If the run completed, mark any tools still "running" as complete
  // (tool_result events may not be emitted for all tool calls)
  if (isComplete) {
    for (const tc of map.values()) {
      if (tc.status === "running") {
        tc.status = "complete";
      }
    }
  }
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Pending question detection
// ---------------------------------------------------------------------------

interface PendingQuestion {
  promptId: string;
  runId: string;
  question: string;
  options: string[] | null;
  allowFreeText: boolean;
  questions?: QuestionDef[] | null;
}

function findPendingQuestion(events: SseEvent[]): PendingQuestion | null {
  // Look for the latest ask_user that hasn't been answered
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i]!;
    if (ev.kind === "ask_user") {
      return {
        promptId: ev.prompt_id,
        runId: ev.run_id,
        question: ev.question,
        options: ev.options,
        allowFreeText: ev.allow_free_text,
        questions: ev.questions ?? null,
      };
    }
    // Only dismiss if the agent responded after asking (not if the run just ended)
    if (ev.kind === "assistant_text") {
      break;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function MessageBubble({
  message,
}: {
  message: ChatMessage;
}) {
  const isUser = message.role === "user";
  const pairedTools = useMemo(
    () => pairToolCalls(message.tool_calls),
    [message.tool_calls],
  );

  // Skip tool-result-only messages (they are inlined into ToolCallCard)
  if (message.role === "tool") return null;

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} w-full`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-accent/10 border border-accent/20"
            : "bg-surface-1 border border-border"
        }`}
      >
        {message.content && (
          <div className="text-sm text-fg">
            {isUser ? (
              <span className="whitespace-pre-wrap">{message.content}</span>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                  {message.content}
                </Markdown>
              </div>
            )}
          </div>
        )}
        {pairedTools.length > 0 && (
          <div className="mt-2">
            <ToolCallDrawer statuses={pairedTools.map((tc) => tc.status)}>
              {pairedTools.map((tc) => (
                <ToolCallCard
                  key={tc.toolUseId}
                  toolName={tc.toolName}
                  argsPreview={JSON.stringify(tc.input).slice(0, 80)}
                  status={tc.status}
                  argumentsBody={JSON.stringify(tc.input, null, 2)}
                  resultBody={
                    tc.output !== undefined
                      ? typeof tc.output === "string"
                        ? tc.output
                        : JSON.stringify(tc.output, null, 2)
                      : undefined
                  }
                />
              ))}
            </ToolCallDrawer>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slash autocomplete logic
// ---------------------------------------------------------------------------

function useSlashAutocomplete(composerValue: string) {
  const { data: skills = [] } = useSkills();
  const [activeIndex, setActiveIndex] = useState(0);

  const interactiveSkills = useMemo(
    () =>
      skills.filter(
        (s) =>
          s.categories.includes("interactive") ||
          s.categories.includes("human-in-loop"),
      ),
    [skills],
  );

  // Detect if slash autocomplete should be shown
  const slashTrigger = useMemo(() => {
    const trimmed = composerValue.trimStart();
    if (trimmed.startsWith("/")) {
      return trimmed.slice(1).toLowerCase();
    }
    return null;
  }, [composerValue]);

  const items: SlashAutocompleteItem[] = useMemo(() => {
    if (slashTrigger === null) return [];
    return interactiveSkills
      .filter((s) => s.name.toLowerCase().includes(slashTrigger))
      .map((s) => ({
        value: `/rapid:${s.name}`,
        label: `/rapid:${s.name}`,
        hint: s.description,
      }));
  }, [slashTrigger, interactiveSkills]);

  // Clamp active index
  const clampedIndex = Math.min(activeIndex, Math.max(0, items.length - 1));

  return {
    visible: items.length > 0,
    items,
    activeIndex: clampedIndex,
    setActiveIndex,
    moveUp: () =>
      setActiveIndex((i) => (i > 0 ? i - 1 : items.length - 1)),
    moveDown: () =>
      setActiveIndex((i) => (i < items.length - 1 ? i + 1 : 0)),
    selectedValue: items[clampedIndex]?.value ?? null,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const { sendMessage } = useChats();
  const {
    thread,
    messages,
    stream,
    isLoading,
  } = useChatThread(threadId ?? null);

  const [composerValue, setComposerValue] = useState("");
  const [pendingAnswer, setPendingAnswer] = useState<string>("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showMultiQuestionModal, setShowMultiQuestionModal] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  // Track the prompt id we've already answered so we can optimistically
  // dismiss the inline question UI before the SSE stream catches up.
  const answeredPromptIdRef = useRef<string | null>(null);

  const slash = useSlashAutocomplete(composerValue);

  const isArchived = thread?.session_status === "archived";
  const streaming = hasActiveStream(stream.events);
  const streamingText = useMemo(
    () => accumulateStreamingText(stream.events),
    [stream.events],
  );
  const streamToolCalls = useMemo(
    () => pairStreamToolEvents(stream.events),
    [stream.events],
  );

  const ssePendingQuestion = useMemo(
    () => findPendingQuestion(stream.events),
    [stream.events],
  );

  // Hydrate pending question from REST (survives page refresh)
  const activeRunId = thread?.active_run_id ?? null;
  const [hydratedQuestion, setHydratedQuestion] = useState<PendingQuestion | null>(null);

  useEffect(() => {
    if (!activeRunId) {
      setHydratedQuestion(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/agents/runs/${activeRunId}/pending-prompt`)
      .then((r) => {
        if (r.status === 204 || !r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        setHydratedQuestion({
          promptId: data.prompt_id,
          runId: data.run_id,
          question: data.question,
          options: data.options ?? null,
          allowFreeText: data.allow_free_text ?? true,
          questions: data.questions ?? null,
        });
      })
      .catch(() => {/* ignore */});
    return () => { cancelled = true; };
  }, [activeRunId]);

  // SSE-derived question takes priority; fall back to REST-hydrated one.
  // Filter out prompts we've already answered (optimistic dismiss).
  const rawPendingQuestion = ssePendingQuestion ?? hydratedQuestion;
  const pendingQuestion =
    rawPendingQuestion &&
    rawPendingQuestion.promptId !== answeredPromptIdRef.current
      ? rawPendingQuestion
      : null;
  const composerDisabled = isArchived || pendingQuestion !== null;

  // Reset selection state when a NEW pending question arrives.
  // Use the raw (unfiltered) question to detect new prompts — if a new
  // prompt_id appears that differs from the one we answered, clear the
  // optimistic dismiss flag so it renders.
  const rawPromptId = rawPendingQuestion?.promptId ?? null;
  useEffect(() => {
    if (rawPromptId && rawPromptId !== answeredPromptIdRef.current) {
      answeredPromptIdRef.current = null;
    }
    setSelectedOption(null);
    setShowMultiQuestionModal(false);
  }, [rawPromptId]);

  const { pinned, newCount, scrollToBottom } = useAutoScrollWithOptOut({
    containerRef: feedRef,
    deps: [messages.length, streamingText.length],
  });

  // Send message handler
  const handleSend = useCallback(() => {
    if (!threadId || !composerValue.trim() || composerDisabled) return;
    const tempId = globalThis.crypto?.randomUUID?.()
      ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
    void sendMessage({
      chatId: threadId,
      content: composerValue.trim(),
      tempId,
    });
    setComposerValue("");
  }, [threadId, composerValue, composerDisabled, sendMessage]);

  // Answer a pending question
  const handleAnswer = useCallback(
    async (answer: string) => {
      if (!pendingQuestion) return;
      try {
        await fetch(
          `/api/agents/runs/${pendingQuestion.runId}/answer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt_id: pendingQuestion.promptId,
              tool_use_id: pendingQuestion.promptId,
              answer,
            }),
          },
        );
        setPendingAnswer("");
        setSelectedOption(null);
        setShowMultiQuestionModal(false);
        // Optimistically dismiss: mark this prompt as answered so the UI
        // hides immediately rather than waiting for an SSE stream update.
        answeredPromptIdRef.current = pendingQuestion.promptId;
        setHydratedQuestion(null);
      } catch {
        // swallow
      }
    },
    [pendingQuestion],
  );

  // Slash autocomplete keyboard handling
  const handleComposerKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!slash.visible) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        slash.moveUp();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        slash.moveDown();
      } else if (e.key === "Enter" && slash.selectedValue) {
        e.preventDefault();
        setComposerValue(slash.selectedValue + " ");
      }
    },
    [slash],
  );

  // Register keydown on document for slash autocomplete interception
  useEffect(() => {
    if (!slash.visible) return;
    document.addEventListener("keydown", handleComposerKeyDown);
    return () =>
      document.removeEventListener("keydown", handleComposerKeyDown);
  }, [slash.visible, handleComposerKeyDown]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 p-6 pb-0">
        <PageHeader
          title={thread?.title ?? "Chat Thread"}
          breadcrumb={[
            { label: "RAPID", to: "/" },
            { label: "Chats", to: "/chats" },
            { label: thread?.title ?? threadId ?? "Thread" },
          ]}
          description={thread?.skill_name}
          actions={
            thread ? (
              <StatusBadge
                label={
                  thread.session_status.toUpperCase()
                }
                tone={SESSION_TONE[thread.session_status] ?? "muted"}
              />
            ) : undefined
          }
        />
      </div>

      {/* Archived banner */}
      {isArchived && (
        <div className="mx-6 mt-3 px-4 py-2 bg-warning/10 border border-warning/20 rounded text-sm text-warning">
          Thread archived -- un-archive to continue.
        </div>
      )}

      {/* Message list */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto p-6 space-y-4"
      >
        {isLoading && (
          <div className="text-sm text-muted animate-pulse">
            Loading messages...
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming assistant row */}
        {streaming && (
          <div className="flex justify-start w-full">
            <div className="max-w-[80%] rounded-lg px-4 py-3 bg-surface-1 border border-border">
              {streamingText && (
                <>
                  <LiveRegion mode="polite" busy={streaming}>
                    {streamingText}
                  </LiveRegion>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-fg">
                    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                      {streamingText}
                    </Markdown>
                    <StreamingCursor active={streaming} />
                  </div>
                </>
              )}
              {streamToolCalls.length > 0 && (
                <div className={streamingText ? "mt-2" : ""}>
                  <ToolCallDrawer statuses={streamToolCalls.map((tc) => tc.status)}>
                    {streamToolCalls.map((tc) => (
                      <ToolCallCard
                        key={tc.toolUseId}
                        toolName={tc.toolName}
                        argsPreview={JSON.stringify(tc.input).slice(0, 80)}
                        status={tc.status}
                        argumentsBody={JSON.stringify(tc.input, null, 2)}
                        resultBody={
                          tc.output !== undefined
                            ? typeof tc.output === "string"
                              ? tc.output
                              : JSON.stringify(tc.output, null, 2)
                            : undefined
                        }
                      />
                    ))}
                  </ToolCallDrawer>
                </div>
              )}
              {!streamingText && streamToolCalls.length === 0 && (
                <StreamingCursor active={streaming} />
              )}
            </div>
          </div>
        )}

        {/* Stream errors */}
        {stream.error && (
          <ErrorCard title="Connection error" body={stream.error} />
        )}
      </div>

      <AutoScrollPill
        count={newCount}
        visible={!pinned}
        onClick={scrollToBottom}
      />

      {/* Pending question inline above composer */}
      {pendingQuestion && (
        <div className="shrink-0 px-6 pb-2">
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
            <div className="text-xs text-warning uppercase tracking-wider font-semibold mb-2">
              Awaiting Input
            </div>
            {pendingQuestion.questions &&
            pendingQuestion.questions.length > 1 ? (
              /* --- Multi-question: summary + "Answer Questions" button --- */
              <div>
                <div className="text-sm text-fg mb-3">
                  {pendingQuestion.questions.length} questions to answer
                </div>
                <div className="flex flex-col gap-1 mb-3">
                  {pendingQuestion.questions.map((q, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted">
                      {q.header && (
                        <span className="px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium">
                          {q.header}
                        </span>
                      )}
                      <span className="truncate">{q.question}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowMultiQuestionModal(true)}
                  className="px-3 py-1.5 text-sm font-semibold rounded bg-accent text-bg-0 hover:opacity-90"
                >
                  Answer Questions
                </button>
              </div>
            ) : (
              /* --- Single question: existing inline UI --- */
              <>
                <div className="text-sm font-bold text-fg mb-3">
                  {pendingQuestion.question}
                </div>
                {pendingQuestion.options &&
                  pendingQuestion.options.length > 0 && (
                    <div className="flex flex-col gap-1.5 mb-3">
                      {pendingQuestion.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setSelectedOption(opt);
                            setPendingAnswer("");
                          }}
                          className={`text-left px-3 py-2 rounded border text-sm transition-colors ${
                            selectedOption === opt
                              ? "border-accent bg-accent/10 ring-1 ring-accent/40"
                              : "border-border hover:border-accent hover:bg-hover"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                {pendingQuestion.allowFreeText ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pendingAnswer}
                      onChange={(e) => {
                        setPendingAnswer(e.target.value);
                        setSelectedOption(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const answer = selectedOption ?? pendingAnswer.trim();
                          if (answer) handleAnswer(answer);
                        }
                      }}
                      placeholder="Type your answer..."
                      className="flex-1 bg-surface-1 border border-border rounded px-3 py-1.5 text-sm text-fg placeholder:text-muted outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const answer = selectedOption ?? pendingAnswer.trim();
                        if (answer) handleAnswer(answer);
                      }}
                      disabled={!selectedOption && !pendingAnswer.trim()}
                      className="px-3 py-1.5 text-sm font-semibold rounded bg-accent text-bg-0 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Submit
                    </button>
                  </div>
                ) : (
                  pendingQuestion.options &&
                  pendingQuestion.options.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedOption) handleAnswer(selectedOption);
                      }}
                      disabled={!selectedOption}
                      className="px-3 py-1.5 text-sm font-semibold rounded bg-accent text-bg-0 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Submit
                    </button>
                  )
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Multi-question modal overlay */}
      {showMultiQuestionModal && pendingQuestion && (
        <AskUserModal
          prompt={{
            prompt_id: pendingQuestion.promptId,
            run_id: pendingQuestion.runId,
            kind: "ask_user",
            question: pendingQuestion.question,
            options: pendingQuestion.options,
            allow_free_text: pendingQuestion.allowFreeText,
            created_at: new Date().toISOString(),
            batch_id: null,
            batch_position: null,
            batch_total: null,
            questions: pendingQuestion.questions,
          }}
          onSubmit={(answer) => {
            handleAnswer(answer);
            setShowMultiQuestionModal(false);
          }}
          onCancel={() => setShowMultiQuestionModal(false)}
        />
      )}

      {/* Composer */}
      <div className="shrink-0 p-6 pt-2 relative">
        {slash.visible && (
          <SlashAutocomplete
            items={slash.items}
            activeIndex={slash.activeIndex}
            onPick={(value) => setComposerValue(value + " ")}
          />
        )}
        <Composer
          value={composerValue}
          onChange={setComposerValue}
          onSubmit={handleSend}
          disabled={composerDisabled}
          placeholder={
            isArchived
              ? "Thread archived"
              : pendingQuestion
                ? "Answer the question above first..."
                : "Type a message..."
          }
        />
      </div>
    </div>
  );
}
