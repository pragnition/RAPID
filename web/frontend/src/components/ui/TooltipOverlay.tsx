import { useEffect, useRef, useMemo } from "react";
import { useGlobalBindings } from "@/context/KeyboardContext";
import type { KeyCombo, KeyCategory } from "@/types/keyboard";

interface TooltipOverlayProps {
  onClose: () => void;
}

const CATEGORY_LABELS: Record<KeyCategory, string> = {
  global: "Global",
  navigation: "Navigation",
  sidebar: "Sidebar",
  view: "View",
};

const CATEGORY_ORDER: KeyCategory[] = ["global", "navigation", "sidebar", "view"];

export function TooltipOverlay({ onClose }: TooltipOverlayProps) {
  const combos = useGlobalBindings();
  const panelRef = useRef<HTMLDivElement>(null);

  // Group combos by category
  const grouped = useMemo(() => {
    const map = new Map<KeyCategory, KeyCombo[]>();
    for (const combo of combos) {
      const cat = combo.category;
      const list = map.get(cat);
      if (list) {
        list.push(combo);
      } else {
        map.set(cat, [combo]);
      }
    }
    return map;
  }, [combos]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Close on click outside the panel
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="
        fixed inset-0 z-50 flex items-center justify-center
        bg-black/60
        animate-fade-in
      "
      onClick={handleBackdropClick}
      role="dialog"
      aria-label="Keyboard shortcuts"
    >
      <div
        ref={panelRef}
        className="
          bg-surface-0 border border-border rounded-lg shadow-lg
          max-w-lg w-full mx-4 p-6
          max-h-[80vh] overflow-y-auto
        "
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-fg">Keyboard Shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-fg text-sm"
            aria-label="Close"
          >
            ESC
          </button>
        </div>

        {CATEGORY_ORDER.map((cat) => {
          const items = grouped.get(cat);
          if (!items || items.length === 0) return null;
          return (
            <div key={cat} className="mb-5 last:mb-0">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                {CATEGORY_LABELS[cat]}
              </h3>
              <div className="space-y-1.5">
                {items.map((combo, i) => (
                  <div
                    key={`${cat}-${i}`}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm text-fg">{combo.description}</span>
                    <div className="flex gap-1">
                      {combo.keys.map((k, ki) => (
                        <kbd
                          key={ki}
                          className="
                            bg-surface-2 px-2 py-0.5 rounded
                            text-sm font-mono text-muted
                            border border-border
                          "
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {combos.length === 0 && (
          <p className="text-sm text-muted">No shortcuts registered</p>
        )}
      </div>
    </div>
  );
}
