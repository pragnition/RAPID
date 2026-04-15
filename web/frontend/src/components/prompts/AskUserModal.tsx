import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentPromptPayload } from "@/types/agentPrompt";

interface AskUserModalProps {
  prompt: AgentPromptPayload;
  onSubmit: (answer: string) => void;
  onCancel?: () => void;
  submitting?: boolean;
  /**
   * If set, a collapsible panel is rendered below the form showing the
   * caller's previously-rejected draft (used for 409 stale recovery).
   */
  previousDraft?: string | null;
}

const OTHER_OPTION_SENTINEL = "__OTHER__";

function draftStorageKey(promptId: string): string {
  return `prompt:${promptId}`;
}

function loadDraft(promptId: string): string | null {
  try {
    return window.sessionStorage.getItem(draftStorageKey(promptId));
  } catch {
    return null;
  }
}

function saveDraft(promptId: string, value: string): void {
  try {
    window.sessionStorage.setItem(draftStorageKey(promptId), value);
  } catch {
    // sessionStorage unavailable (e.g. private mode quota). Silently ignore;
    // draft persistence is a nice-to-have.
  }
}

function clearDraft(promptId: string): void {
  try {
    window.sessionStorage.removeItem(draftStorageKey(promptId));
  } catch {
    // ignore
  }
}

export function AskUserModal({
  prompt,
  onSubmit,
  onCancel,
  submitting = false,
  previousDraft = null,
}: AskUserModalProps) {
  const hasOptions = !!prompt.options && prompt.options.length > 0;

  // Hydrate from sessionStorage on mount (or when prompt_id changes).
  const initialDraft = useMemo(
    () => loadDraft(prompt.prompt_id) ?? "",
    [prompt.prompt_id],
  );

  // For the options-rendering branch, we track the selected option and a
  // separate free-text value (used when Other is selected OR when the
  // prompt also allows free text alongside the radios).
  const initialSelectedOption = useMemo(() => {
    if (!hasOptions) return "";
    // If the draft matches one of the options, preselect it.
    if (prompt.options && prompt.options.includes(initialDraft)) {
      return initialDraft;
    }
    // If there is a draft but it doesn't match an option, it was free text.
    if (initialDraft && prompt.allow_free_text) {
      return OTHER_OPTION_SENTINEL;
    }
    return "";
  }, [hasOptions, initialDraft, prompt.options, prompt.allow_free_text]);

  const initialFreeText = useMemo(() => {
    if (!hasOptions) return initialDraft;
    if (prompt.options && prompt.options.includes(initialDraft)) return "";
    return initialDraft;
  }, [hasOptions, initialDraft, prompt.options]);

  const [selectedOption, setSelectedOption] = useState<string>(
    initialSelectedOption,
  );
  const [freeText, setFreeText] = useState<string>(initialFreeText);
  const [showPreviousDraft, setShowPreviousDraft] = useState(false);

  // Reset local state when the modal swaps to a different prompt (e.g. the
  // 409-stale-recovery auto-swap path).
  useEffect(() => {
    setSelectedOption(initialSelectedOption);
    setFreeText(initialFreeText);
    setShowPreviousDraft(false);
  }, [prompt.prompt_id, initialSelectedOption, initialFreeText]);

  // Compute the current draft string (what would be submitted right now).
  const currentAnswer = useMemo(() => {
    if (!hasOptions) return freeText;
    if (selectedOption === OTHER_OPTION_SENTINEL) return freeText;
    return selectedOption;
  }, [hasOptions, selectedOption, freeText]);

  // Persist the draft on every change.
  useEffect(() => {
    if (currentAnswer) {
      saveDraft(prompt.prompt_id, currentAnswer);
    } else {
      clearDraft(prompt.prompt_id);
    }
  }, [prompt.prompt_id, currentAnswer]);

  const canSubmit = currentAnswer.trim().length > 0 && !submitting;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    const value = currentAnswer.trim();
    onSubmit(value);
    clearDraft(prompt.prompt_id);
  }, [canSubmit, currentAnswer, onSubmit, prompt.prompt_id]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (e.key === "Escape" && onCancel) {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSubmit, onCancel],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const showBatchIndicator =
    prompt.batch_total !== null &&
    prompt.batch_total > 1 &&
    prompt.batch_position !== null;

  const handleCopyPreviousDraft = useCallback(() => {
    if (!previousDraft) return;
    if (hasOptions) {
      // If draft matches an option, select it; otherwise treat as free text.
      if (prompt.options && prompt.options.includes(previousDraft)) {
        setSelectedOption(previousDraft);
        setFreeText("");
      } else if (prompt.allow_free_text) {
        setSelectedOption(OTHER_OPTION_SENTINEL);
        setFreeText(previousDraft);
      }
    } else {
      setFreeText(previousDraft);
    }
  }, [previousDraft, hasOptions, prompt.options, prompt.allow_free_text]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="bg-surface-0 border border-border rounded-lg w-full max-w-lg mx-4 p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-user-modal-question"
      >
        {/* Batch indicator */}
        {showBatchIndicator && (
          <div className="text-xs text-muted mb-2">
            Question {(prompt.batch_position ?? 0) + 1} of {prompt.batch_total}
          </div>
        )}

        {/* Question */}
        <h2
          id="ask-user-modal-question"
          className="text-lg font-semibold text-fg mb-4 whitespace-pre-wrap"
        >
          {prompt.question}
        </h2>

        {/* Answer area */}
        {hasOptions ? (
          <div className="flex flex-col gap-2 mb-4">
            {prompt.options!.map((opt) => (
              <label
                key={opt}
                className="flex items-start gap-2 px-3 py-2 rounded border border-border bg-surface-1 cursor-pointer hover:border-accent transition-colors"
              >
                <input
                  type="radio"
                  name={`ask-user-${prompt.prompt_id}`}
                  value={opt}
                  checked={selectedOption === opt}
                  onChange={() => setSelectedOption(opt)}
                  className="mt-1"
                />
                <span className="text-sm text-fg whitespace-pre-wrap">
                  {opt}
                </span>
              </label>
            ))}

            {prompt.allow_free_text && (
              <>
                <label className="flex items-start gap-2 px-3 py-2 rounded border border-border bg-surface-1 cursor-pointer hover:border-accent transition-colors">
                  <input
                    type="radio"
                    name={`ask-user-${prompt.prompt_id}`}
                    value={OTHER_OPTION_SENTINEL}
                    checked={selectedOption === OTHER_OPTION_SENTINEL}
                    onChange={() => setSelectedOption(OTHER_OPTION_SENTINEL)}
                    className="mt-1"
                  />
                  <span className="text-sm text-fg">Other (type below)</span>
                </label>

                {selectedOption === OTHER_OPTION_SENTINEL && (
                  <textarea
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    rows={3}
                    placeholder="Type your answer..."
                    className="w-full px-3 py-2 text-sm bg-surface-1 border border-border rounded text-fg placeholder:text-muted resize-y focus:outline-none focus:border-accent"
                  />
                )}
              </>
            )}
          </div>
        ) : (
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={5}
            placeholder="Type your answer..."
            className="w-full px-3 py-2 text-sm bg-surface-1 border border-border rounded text-fg placeholder:text-muted resize-y focus:outline-none focus:border-accent mb-4"
            autoFocus
          />
        )}

        {/* Previous draft recovery panel */}
        {previousDraft && (
          <div className="border border-border rounded mb-4 bg-surface-1">
            <button
              type="button"
              onClick={() => setShowPreviousDraft((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted hover:text-fg transition-colors"
            >
              <span>
                Previous draft (not saved) {showPreviousDraft ? "▾" : "▸"}
              </span>
            </button>
            {showPreviousDraft && (
              <div className="px-3 pb-3 space-y-2">
                <pre className="text-xs text-fg whitespace-pre-wrap font-mono bg-surface-0 border border-border rounded p-2 max-h-40 overflow-auto">
                  {previousDraft}
                </pre>
                <button
                  type="button"
                  onClick={handleCopyPreviousDraft}
                  className="text-xs text-accent hover:underline"
                >
                  Copy into answer
                </button>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center gap-3">
          <div className="text-xs text-muted">
            <kbd className="px-1 py-0.5 border border-border rounded">
              Ctrl
            </kbd>
            <span className="mx-1">+</span>
            <kbd className="px-1 py-0.5 border border-border rounded">
              Enter
            </kbd>
            <span className="ml-1">to submit</span>
          </div>
          <div className="flex gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm text-muted hover:text-fg transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-4 py-2 text-sm font-medium bg-accent text-bg-0 rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
