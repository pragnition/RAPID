import { useEffect, useRef } from "react";
import type { KeyBinding } from "@/types/keyboard";

const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const PREFIX_TIMEOUT_MS = 500;

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  if (INPUT_TAGS.has(el.tagName)) return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

function matchesBinding(e: KeyboardEvent, b: KeyBinding): boolean {
  if (e.key !== b.key) return false;
  if (!!b.ctrl !== e.ctrlKey) return false;
  if (!!b.shift !== e.shiftKey) return false;
  if (!!b.alt !== e.altKey) return false;
  if (!!b.meta !== e.metaKey) return false;
  if (b.when && !b.when()) return false;
  return true;
}

/**
 * Registers a single document-level keydown listener that dispatches to the
 * provided bindings. Accepts either a static array or a getter function so
 * that the listener always reads the latest bindings even when the host
 * component does not re-render (e.g. KeyboardProvider stores bindings in a ref).
 */
export function useKeyboardNav(
  bindingsOrGetter: KeyBinding[] | (() => KeyBinding[]),
): void {
  const getterRef = useRef(bindingsOrGetter);
  getterRef.current = bindingsOrGetter;

  const prefixRef = useRef<string | null>(null);
  const prefixTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function resolveBindings(): KeyBinding[] {
      const v = getterRef.current;
      return typeof v === "function" ? v() : v;
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Input suppression: only allow Escape when focused on inputs
      if (isInputFocused()) {
        if (e.key === "Escape") {
          (document.activeElement as HTMLElement)?.blur();
          e.preventDefault();
        }
        return;
      }

      const currentBindings = resolveBindings();

      // Handle prefix key state
      if (prefixRef.current !== null) {
        const prefix = prefixRef.current;
        prefixRef.current = null;
        if (prefixTimerRef.current) {
          clearTimeout(prefixTimerRef.current);
          prefixTimerRef.current = null;
        }

        // Try to match prefix + key combo (e.g., "g" + "g" = key "gg", or "g" + "p" = key "gp")
        const comboKey = prefix + e.key;
        for (const binding of currentBindings) {
          if (
            binding.key === comboKey &&
            !binding.ctrl &&
            !binding.shift &&
            !binding.alt &&
            (!binding.when || binding.when())
          ) {
            e.preventDefault();
            binding.action();
            return;
          }
        }
        // No combo matched, fall through to single-key matching
      }

      // Check if this key is a prefix key (e.g., "g")
      if (e.key === "g" && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        // Check if any binding uses "g" as a prefix
        const hasGPrefix = currentBindings.some(
          (b) => b.key.startsWith("g") && b.key.length > 1,
        );
        if (hasGPrefix) {
          prefixRef.current = "g";
          prefixTimerRef.current = setTimeout(() => {
            prefixRef.current = null;
            prefixTimerRef.current = null;
          }, PREFIX_TIMEOUT_MS);
          e.preventDefault();
          return;
        }
      }

      // Single-key matching
      for (const binding of currentBindings) {
        if (
          binding.key.length > 1 &&
          !binding.ctrl &&
          !binding.shift &&
          !binding.alt
        ) {
          // This is a multi-key combo (like "gg"), skip for single-key matching
          continue;
        }
        if (matchesBinding(e, binding)) {
          e.preventDefault();
          binding.action();
          return;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (prefixTimerRef.current) {
        clearTimeout(prefixTimerRef.current);
      }
    };
  }, []);
}
