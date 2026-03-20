import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  createElement,
  type ReactNode,
} from "react";
import type { KeyBinding, KeyCombo } from "@/types/keyboard";
import { useKeyboardNav } from "@/hooks/useKeyboardNav";

type BindingEntry = {
  id: symbol;
  bindings: KeyBinding[];
};

interface KeyboardContextValue {
  register: (id: symbol, bindings: KeyBinding[]) => void;
  unregister: (id: symbol) => void;
  getAllBindings: () => KeyBinding[];
  getKeyComboList: () => KeyCombo[];
}

const KeyboardCtx = createContext<KeyboardContextValue | null>(null);

export function KeyboardProvider({ children }: { children: ReactNode }) {
  const registryRef = useRef<BindingEntry[]>([]);
  const allBindingsRef = useRef<KeyBinding[]>([]);

  const rebuildFlat = useCallback(() => {
    allBindingsRef.current = registryRef.current.flatMap((e) => e.bindings);
  }, []);

  const register = useCallback(
    (id: symbol, bindings: KeyBinding[]) => {
      registryRef.current = [
        ...registryRef.current.filter((e) => e.id !== id),
        { id, bindings },
      ];
      rebuildFlat();
    },
    [rebuildFlat],
  );

  const unregister = useCallback(
    (id: symbol) => {
      registryRef.current = registryRef.current.filter((e) => e.id !== id);
      rebuildFlat();
    },
    [rebuildFlat],
  );

  const getAllBindings = useCallback(() => allBindingsRef.current, []);

  const getKeyComboList = useCallback((): KeyCombo[] => {
    return allBindingsRef.current.map((b) => {
      const keys: string[] = [];
      if (b.ctrl) keys.push("Ctrl");
      if (b.shift) keys.push("Shift");
      if (b.alt) keys.push("Alt");
      keys.push(b.key);
      return { keys, description: b.description, category: b.category };
    });
  }, []);

  // Pass a getter so the keydown listener always reads the latest bindings
  // even though KeyboardProvider does not re-render on registry changes.
  useKeyboardNav(getAllBindings);

  const ctxValue = useMemo(
    () => ({ register, unregister, getAllBindings, getKeyComboList }),
    [register, unregister, getAllBindings, getKeyComboList],
  );

  return createElement(KeyboardCtx.Provider, { value: ctxValue }, children);
}

/**
 * Register keybindings that are active while the calling component is mounted.
 * Bindings are automatically removed on unmount.
 */
export function useRegisterBindings(bindings: KeyBinding[]): void {
  const ctx = useContext(KeyboardCtx);
  if (!ctx) {
    throw new Error("useRegisterBindings must be used within a KeyboardProvider");
  }

  const idRef = useRef<symbol>(Symbol("kb"));
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    const id = idRef.current;
    ctx.register(id, bindingsRef.current);
    return () => {
      ctx.unregister(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  // Re-register when bindings array identity changes
  useEffect(() => {
    ctx.register(idRef.current, bindings);
  }, [ctx, bindings]);
}

/**
 * Returns all registered key combos for display (e.g., tooltip overlay).
 */
export function useGlobalBindings(): KeyCombo[] {
  const ctx = useContext(KeyboardCtx);
  if (!ctx) {
    throw new Error("useGlobalBindings must be used within a KeyboardProvider");
  }
  return ctx.getKeyComboList();
}
