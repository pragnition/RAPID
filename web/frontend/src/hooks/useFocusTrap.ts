import { useEffect, useRef, type RefObject } from "react";

export interface UseFocusTrapOptions {
  enabled?: boolean;
  onEscape?: () => void;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Trap Tab and Shift+Tab within the returned ref's container. Focus is
 * restored to the previously-focused element on unmount. Pass `onEscape`
 * to handle ESC (e.g., close a modal).
 */
export function useFocusTrap<T extends HTMLElement>(
  opts: UseFocusTrapOptions = {},
): RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  const { enabled = true, onEscape } = opts;

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const previousActive = document.activeElement as HTMLElement | null;

    function getFocusable(): HTMLElement[] {
      if (!container) return [];
      return Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
      );
    }

    // Focus the first focusable on mount.
    const firstFocusable = getFocusable()[0];
    firstFocusable?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      previousActive?.focus?.();
    };
  }, [enabled, onEscape]);

  return containerRef;
}
