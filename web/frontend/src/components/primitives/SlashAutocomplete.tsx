import type { ReactNode } from "react";

export interface SlashAutocompleteItem {
  value: string;
  label: ReactNode;
  hint?: string;
}

export interface SlashAutocompleteProps {
  items: SlashAutocompleteItem[];
  activeIndex: number;
  onPick: (value: string) => void;
  className?: string;
}

/**
 * Absolutely-positioned autocomplete list rendered above the composer.
 * Highlights the row at `activeIndex`; callers manage keyboard focus/arrow navigation.
 */
export function SlashAutocomplete({
  items,
  activeIndex,
  onPick,
  className,
}: SlashAutocompleteProps) {
  if (items.length === 0) return null;
  const cls = [
    "absolute left-0 right-0 bottom-full mb-2",
    "bg-surface-1 border border-bg-4 rounded-lg overflow-hidden shadow-lg",
    "max-h-60 overflow-y-auto",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} role="listbox">
      {items.map((item, idx) => {
        const active = idx === activeIndex;
        return (
          <button
            type="button"
            key={item.value}
            role="option"
            aria-selected={active}
            onClick={() => onPick(item.value)}
            className={[
              "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm",
              active ? "bg-surface-3 text-fg" : "text-fg-dim hover:bg-hover",
            ].join(" ")}
          >
            <span className="flex-1 font-mono">{item.label}</span>
            {item.hint ? (
              <span className="text-xs text-muted">{item.hint}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
