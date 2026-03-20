import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  createElement,
  type ReactNode,
} from "react";
import { getThemeDataAttr, type ThemeId, type ThemeMode } from "@/types/theme";

interface ThemeContextValue {
  themeId: ThemeId;
  mode: ThemeMode;
  setThemeId: (id: ThemeId) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeId {
  const stored = localStorage.getItem("rapid-theme");
  if (
    stored === "everforest" ||
    stored === "catppuccin" ||
    stored === "gruvbox" ||
    stored === "tokyonight"
  ) {
    return stored;
  }
  return "everforest";
}

function readStoredMode(): ThemeMode {
  const stored = localStorage.getItem("rapid-mode");
  if (stored === "dark" || stored === "light") {
    return stored;
  }
  return "dark";
}

function applyTheme(id: ThemeId, mode: ThemeMode): void {
  document.documentElement.dataset.theme = getThemeDataAttr(id, mode);
  localStorage.setItem("rapid-theme", id);
  localStorage.setItem("rapid-mode", mode);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(readStoredTheme);
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);

  useEffect(() => {
    applyTheme(themeId, mode);
  }, [themeId, mode]);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return createElement(
    ThemeContext.Provider,
    { value: { themeId, mode, setThemeId, setMode, toggleMode } },
    children,
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
