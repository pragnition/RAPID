import { useRef, type ChangeEvent, type CSSProperties, type KeyboardEvent } from "react";
import { Kbd } from "./Kbd";

export interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (v: string) => void;
  placeholder?: string;
  shortcutHint?: string;
  minWidth?: number;
  className?: string;
  "aria-label"?: string;
}

/**
 * Mono search input with an optional right-aligned keyboard-hint pill.
 * Submit via Enter fires `onSubmit`; typing fires `onChange` on every keystroke.
 */
export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  shortcutHint,
  minWidth = 280,
  className,
  "aria-label": ariaLabel,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapCls = [
    "relative inline-flex items-center",
    "bg-surface-1 border border-border rounded",
    "focus-within:border-accent",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const wrapStyle: CSSProperties = { minWidth };

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && onSubmit) {
      event.preventDefault();
      onSubmit(value);
    }
  }

  return (
    <div className={wrapCls} style={wrapStyle}>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder ?? "Search"}
        className={[
          "flex-1 bg-transparent outline-none",
          "px-3 py-1.5 text-sm font-mono text-fg",
          "placeholder:text-muted",
        ].join(" ")}
      />
      {shortcutHint ? (
        <span className="pr-2 flex items-center">
          <Kbd>{shortcutHint}</Kbd>
        </span>
      ) : null}
    </div>
  );
}
