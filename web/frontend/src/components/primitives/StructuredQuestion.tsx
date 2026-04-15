import { useState, type ReactNode } from "react";
import { SurfaceCard } from "./SurfaceCard";
import { Kbd } from "./Kbd";

export interface StructuredQuestionOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  shortcut?: string;
}

export interface StructuredQuestionProps<T extends string> {
  label?: string;
  title: string;
  options: StructuredQuestionOption<T>[];
  value?: T;
  onChange?: (v: T) => void;
  onSubmit?: (v: T) => void;
  onSkip?: () => void;
  submitLabel?: ReactNode;
  skipLabel?: ReactNode;
  className?: string;
}

/**
 * Form-style question bubble for agent-driven structured input.
 * Accent-warning left border, uppercase mono status label, bold title,
 * full-width radio rows with label + description + optional keyboard shortcut.
 */
export function StructuredQuestion<T extends string>({
  label = "Awaiting Input",
  title,
  options,
  value,
  onChange,
  onSubmit,
  onSkip,
  submitLabel = "Submit",
  skipLabel = "Skip",
  className,
}: StructuredQuestionProps<T>) {
  const [internalValue, setInternalValue] = useState<T | undefined>(value);
  const activeValue = value !== undefined ? value : internalValue;

  function handlePick(next: T) {
    if (onChange) onChange(next);
    if (value === undefined) setInternalValue(next);
  }

  function handleSubmit() {
    if (activeValue !== undefined && onSubmit) onSubmit(activeValue);
  }

  const cls = ["p-4 flex flex-col gap-3", className ?? ""].filter(Boolean).join(" ");

  return (
    <SurfaceCard accentBorder="warning" className={cls}>
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold font-mono">
        {label}
      </div>
      <div className="text-base font-bold text-fg">{title}</div>
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => {
          const active = activeValue === opt.value;
          return (
            <label
              key={opt.value}
              className={[
                "flex items-start gap-3 rounded border px-3 py-2 cursor-pointer",
                active
                  ? "border-accent bg-accent/10"
                  : "border-border hover:bg-hover",
              ].join(" ")}
            >
              <input
                type="radio"
                name={`sq-${title}`}
                value={opt.value}
                checked={active}
                onChange={() => handlePick(opt.value)}
                className="mt-1 accent-accent"
              />
              <div className="flex-1 flex flex-col">
                <b className="text-sm text-fg">{opt.label}</b>
                {opt.description ? (
                  <span className="text-xs text-muted">{opt.description}</span>
                ) : null}
              </div>
              {opt.shortcut ? (
                <span className="shrink-0">
                  <Kbd>{opt.shortcut}</Kbd>
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
      <div className="flex items-center gap-2 justify-end pt-1">
        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="px-3 py-1.5 text-sm rounded border border-border text-muted hover:bg-hover"
          >
            {skipLabel}
          </button>
        ) : null}
        {onSubmit ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={activeValue === undefined}
            className={[
              "px-3 py-1.5 text-sm rounded font-semibold",
              activeValue === undefined
                ? "bg-surface-2 text-muted cursor-not-allowed"
                : "bg-accent text-bg-0 hover:opacity-90",
            ].join(" ")}
          >
            {submitLabel}
          </button>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
