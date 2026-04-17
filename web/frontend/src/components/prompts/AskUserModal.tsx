import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AgentPromptPayload,
  QuestionDef,
  QuestionOption,
} from "@/types/agentPrompt";

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

// ---------------------------------------------------------------------------
// Draft persistence helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Per-question state for multi-question mode
// ---------------------------------------------------------------------------

type PerQuestionState = {
  selected: string | string[]; // string for single-select, string[] for multi-select
  freeText: string;
};

function getQuestionAnswer(
  qs: PerQuestionState | undefined,
  qDef: QuestionDef,
): string | string[] | null {
  if (!qs) return null;
  // No options — answer comes from free text only.
  const hasOptions = !!qDef.options && qDef.options.length > 0;
  if (!hasOptions) {
    return qs.freeText.trim() || null;
  }
  const sel = qs.selected;
  if (sel === OTHER_OPTION_SENTINEL) {
    return qs.freeText.trim() || null;
  }
  if (Array.isArray(sel)) {
    return sel.length > 0 ? sel : null;
  }
  return sel || null;
}

// ---------------------------------------------------------------------------
// SingleQuestionView — existing single-question rendering (legacy path)
// ---------------------------------------------------------------------------

function SingleQuestionView({
  prompt,
  onAnswerChange,
  initialDraft,
}: {
  prompt: AgentPromptPayload;
  onAnswerChange: (answer: string) => void;
  initialDraft: string;
}) {
  const hasOptions = !!prompt.options && prompt.options.length > 0;

  const initialSelectedOption = useMemo(() => {
    if (!hasOptions) return "";
    if (prompt.options && prompt.options.includes(initialDraft)) {
      return initialDraft;
    }
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

  const [selectedOption, setSelectedOption] =
    useState<string>(initialSelectedOption);
  const [freeText, setFreeText] = useState<string>(initialFreeText);

  useEffect(() => {
    setSelectedOption(initialSelectedOption);
    setFreeText(initialFreeText);
  }, [prompt.prompt_id, initialSelectedOption, initialFreeText]);

  const currentAnswer = useMemo(() => {
    if (!hasOptions) return freeText;
    if (selectedOption === OTHER_OPTION_SENTINEL) return freeText;
    return selectedOption;
  }, [hasOptions, selectedOption, freeText]);

  useEffect(() => {
    onAnswerChange(currentAnswer);
  }, [currentAnswer, onAnswerChange]);

  return (
    <>
      <h2
        id="ask-user-modal-question"
        className="text-lg font-semibold text-fg mb-4 whitespace-pre-wrap"
      >
        {prompt.question}
      </h2>

      {hasOptions ? (
        <div className="flex flex-col gap-2 mb-4">
          {prompt.options!.map((opt) => (
            <label
              key={opt}
              className={`flex items-start gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
                selectedOption === opt
                  ? "border-accent bg-accent/10 ring-1 ring-accent/40"
                  : "border-border bg-surface-1 hover:border-accent"
              }`}
            >
              <input
                type="radio"
                name={`ask-user-${prompt.prompt_id}`}
                value={opt}
                checked={selectedOption === opt}
                onChange={() => setSelectedOption(opt)}
                className="mt-1"
              />
              <span className="text-sm text-fg whitespace-pre-wrap">{opt}</span>
            </label>
          ))}

          {prompt.allow_free_text && (
            <>
              <label
                className={`flex items-start gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
                  selectedOption === OTHER_OPTION_SENTINEL
                    ? "border-accent bg-accent/10 ring-1 ring-accent/40"
                    : "border-border bg-surface-1 hover:border-accent"
                }`}
              >
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
    </>
  );
}

// ---------------------------------------------------------------------------
// QuestionCard — renders a single question within multi-question mode
// ---------------------------------------------------------------------------

function QuestionCard({
  qDef,
  index,
  state,
  onChange,
  promptId,
}: {
  qDef: QuestionDef;
  index: number;
  state: PerQuestionState;
  onChange: (index: number, state: PerQuestionState) => void;
  promptId: string;
}) {
  const hasOptions = !!qDef.options && qDef.options.length > 0;
  const isMultiSelect = qDef.multi_select ?? false;
  const allowFreeText = qDef.allow_free_text ?? true;

  const handleOptionToggle = (label: string) => {
    if (isMultiSelect) {
      const selected = Array.isArray(state.selected) ? state.selected : [];
      const next = selected.includes(label)
        ? selected.filter((s) => s !== label)
        : [...selected, label];
      onChange(index, { ...state, selected: next });
    } else {
      onChange(index, { ...state, selected: label });
    }
  };

  const handleOtherToggle = () => {
    if (isMultiSelect) {
      // In multi-select, "Other" is a toggle alongside other options
      const selected = Array.isArray(state.selected) ? state.selected : [];
      if (selected.includes(OTHER_OPTION_SENTINEL)) {
        onChange(index, {
          ...state,
          selected: selected.filter((s) => s !== OTHER_OPTION_SENTINEL),
        });
      } else {
        onChange(index, {
          ...state,
          selected: [...selected, OTHER_OPTION_SENTINEL],
        });
      }
    } else {
      onChange(index, { ...state, selected: OTHER_OPTION_SENTINEL });
    }
  };

  const isSelected = (label: string) => {
    if (Array.isArray(state.selected)) {
      return state.selected.includes(label);
    }
    return state.selected === label;
  };

  const isOtherSelected = isSelected(OTHER_OPTION_SENTINEL);

  return (
    <div className="space-y-2">
      {/* Header chip + question text */}
      <div className="flex items-start gap-2">
        {qDef.header && (
          <span className="shrink-0 mt-0.5 px-2 py-0.5 text-xs font-medium rounded-full bg-accent/10 text-accent border border-accent/20">
            {qDef.header}
          </span>
        )}
        <h3 className="text-sm font-semibold text-fg whitespace-pre-wrap">
          {qDef.question}
        </h3>
      </div>

      {/* Options */}
      {hasOptions && (
        <div className="flex flex-col gap-1.5 pl-1">
          {qDef.options!.map((opt) => (
            <label
              key={opt.label}
              className={`flex items-start gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
                isSelected(opt.label)
                  ? "border-accent bg-accent/10 ring-1 ring-accent/40"
                  : "border-border bg-surface-1 hover:border-accent"
              }`}
            >
              <input
                type={isMultiSelect ? "checkbox" : "radio"}
                name={`ask-user-mq-${promptId}-${index}`}
                value={opt.label}
                checked={isSelected(opt.label)}
                onChange={() => handleOptionToggle(opt.label)}
                className="mt-1 shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-sm text-fg">{opt.label}</span>
                {opt.description && (
                  <span className="text-xs text-muted mt-0.5">
                    {opt.description}
                  </span>
                )}
              </div>
            </label>
          ))}

          {/* Other / free text option */}
          {allowFreeText && (
            <>
              <label
                className={`flex items-start gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
                  isOtherSelected
                    ? "border-accent bg-accent/10 ring-1 ring-accent/40"
                    : "border-border bg-surface-1 hover:border-accent"
                }`}
              >
                <input
                  type={isMultiSelect ? "checkbox" : "radio"}
                  name={`ask-user-mq-${promptId}-${index}`}
                  value={OTHER_OPTION_SENTINEL}
                  checked={isOtherSelected}
                  onChange={handleOtherToggle}
                  className="mt-1 shrink-0"
                />
                <span className="text-sm text-fg">Other (type below)</span>
              </label>

              {isOtherSelected && (
                <textarea
                  value={state.freeText}
                  onChange={(e) =>
                    onChange(index, { ...state, freeText: e.target.value })
                  }
                  rows={2}
                  placeholder="Type your answer..."
                  className="w-full px-3 py-2 text-sm bg-surface-1 border border-border rounded text-fg placeholder:text-muted resize-y focus:outline-none focus:border-accent"
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Free text only (no options) */}
      {!hasOptions && (
        <textarea
          value={state.freeText}
          onChange={(e) =>
            onChange(index, { ...state, selected: "", freeText: e.target.value })
          }
          rows={3}
          placeholder="Type your answer..."
          className="w-full px-3 py-2 text-sm bg-surface-1 border border-border rounded text-fg placeholder:text-muted resize-y focus:outline-none focus:border-accent"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal component
// ---------------------------------------------------------------------------

export function AskUserModal({
  prompt,
  onSubmit,
  onCancel,
  submitting = false,
  previousDraft = null,
}: AskUserModalProps) {
  const isMultiQuestion =
    !!prompt.questions && prompt.questions.length > 0;
  const questions = prompt.questions ?? [];

  // --- Draft hydration ---
  const initialDraft = useMemo(
    () => loadDraft(prompt.prompt_id) ?? "",
    [prompt.prompt_id],
  );

  // --- Multi-question state ---
  const [questionStates, setQuestionStates] = useState<
    Record<number, PerQuestionState>
  >(() => {
    if (!isMultiQuestion) return {};
    // Try to hydrate from draft
    try {
      const parsed = JSON.parse(initialDraft);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<number, PerQuestionState>;
      }
    } catch {
      // Not valid JSON — fresh state
    }
    // Initialize empty state per question
    const init: Record<number, PerQuestionState> = {};
    for (let i = 0; i < questions.length; i++) {
      init[i] = {
        selected: questions[i]!.multi_select ? [] : "",
        freeText: "",
      };
    }
    return init;
  });

  // Reset multi-question state when prompt changes
  useEffect(() => {
    if (!isMultiQuestion) return;
    try {
      const raw = loadDraft(prompt.prompt_id);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          setQuestionStates(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    const init: Record<number, PerQuestionState> = {};
    for (let i = 0; i < questions.length; i++) {
      init[i] = {
        selected: questions[i]!.multi_select ? [] : "",
        freeText: "",
      };
    }
    setQuestionStates(init);
  }, [prompt.prompt_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Single-question answer tracking ---
  const [singleAnswer, setSingleAnswer] = useState("");

  const handleSingleAnswerChange = useCallback((answer: string) => {
    setSingleAnswer(answer);
  }, []);

  // --- Draft persistence ---
  useEffect(() => {
    if (isMultiQuestion) {
      const serialized = JSON.stringify(questionStates);
      saveDraft(prompt.prompt_id, serialized);
    } else {
      if (singleAnswer) {
        saveDraft(prompt.prompt_id, singleAnswer);
      } else {
        clearDraft(prompt.prompt_id);
      }
    }
  }, [prompt.prompt_id, isMultiQuestion, questionStates, singleAnswer]);

  // --- Compute canSubmit ---
  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (isMultiQuestion) {
      return questions.every((qDef, i) => {
        const answer = getQuestionAnswer(questionStates[i], qDef);
        if (answer === null) return false;
        if (typeof answer === "string") return answer.trim().length > 0;
        return answer.length > 0; // array (multiSelect)
      });
    }
    return singleAnswer.trim().length > 0;
  }, [submitting, isMultiQuestion, questions, questionStates, singleAnswer]);

  // --- Submit handler ---
  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    if (isMultiQuestion) {
      const answers: Record<string, string | string[]> = {};
      questions.forEach((qDef, i) => {
        const qs = questionStates[i];
        if (!qs) return;
        const hasOpts = !!qDef.options && qDef.options.length > 0;
        if (!hasOpts) {
          // Free-text only question — answer is the typed text.
          answers[String(i)] = qs.freeText.trim();
        } else if (qs.selected === OTHER_OPTION_SENTINEL) {
          answers[String(i)] = qs.freeText.trim();
        } else if (Array.isArray(qs.selected)) {
          // For multiSelect with OTHER, replace the sentinel with freeText
          const resolved = qs.selected.map((s) =>
            s === OTHER_OPTION_SENTINEL ? qs.freeText.trim() : s,
          ).filter(Boolean);
          answers[String(i)] = resolved;
        } else {
          answers[String(i)] = qs.selected;
        }
      });
      onSubmit(JSON.stringify({ answers }));
    } else {
      onSubmit(singleAnswer.trim());
    }
    clearDraft(prompt.prompt_id);
  }, [canSubmit, isMultiQuestion, questions, questionStates, singleAnswer, onSubmit, prompt.prompt_id]);

  // --- Keyboard shortcuts ---
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

  // --- Previous draft ---
  const [showPreviousDraft, setShowPreviousDraft] = useState(false);

  const showBatchIndicator =
    !isMultiQuestion &&
    prompt.batch_total !== null &&
    prompt.batch_total > 1 &&
    prompt.batch_position !== null;

  const handleQuestionStateChange = useCallback(
    (index: number, state: PerQuestionState) => {
      setQuestionStates((prev) => ({ ...prev, [index]: state }));
    },
    [],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="bg-surface-0 border border-border rounded-lg w-full max-w-lg mx-4 p-6 shadow-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-user-modal-question"
      >
        {/* Batch indicator (legacy single-question sequential batch) */}
        {showBatchIndicator && (
          <div className="text-xs text-muted mb-2">
            Question {(prompt.batch_position ?? 0) + 1} of{" "}
            {prompt.batch_total}
          </div>
        )}

        {/* Scrollable content area */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {isMultiQuestion ? (
            // --- Multi-question rendering ---
            <div className="space-y-5">
              {questions.map((qDef, i) => (
                <QuestionCard
                  key={i}
                  qDef={qDef}
                  index={i}
                  state={
                    questionStates[i] ?? {
                      selected: qDef.multi_select ? [] : "",
                      freeText: "",
                    }
                  }
                  onChange={handleQuestionStateChange}
                  promptId={prompt.prompt_id}
                />
              ))}
            </div>
          ) : (
            // --- Legacy single-question rendering ---
            <SingleQuestionView
              prompt={prompt}
              onAnswerChange={handleSingleAnswerChange}
              initialDraft={initialDraft}
            />
          )}

          {/* Previous draft recovery panel */}
          {previousDraft && (
            <div className="border border-border rounded mt-4 bg-surface-1">
              <button
                type="button"
                onClick={() => setShowPreviousDraft((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted hover:text-fg transition-colors"
              >
                <span>
                  Previous draft (not saved){" "}
                  {showPreviousDraft ? "\u25BE" : "\u25B8"}
                </span>
              </button>
              {showPreviousDraft && (
                <div className="px-3 pb-3 space-y-2">
                  <pre className="text-xs text-fg whitespace-pre-wrap font-mono bg-surface-0 border border-border rounded p-2 max-h-40 overflow-auto">
                    {previousDraft}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions (fixed at bottom) */}
        <div className="flex justify-between items-center gap-3 pt-4 mt-4 border-t border-border">
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
