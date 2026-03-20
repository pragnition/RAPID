// Layout
export { AppLayout } from "./components/layout/AppLayout";

// Theme
export { ThemeProvider, useTheme } from "./hooks/useTheme";

// Keyboard
export { useKeyboardNav } from "./hooks/useKeyboardNav";

// Tooltip
export { TooltipOverlay } from "./components/ui/TooltipOverlay";

// Data layer
export { queryClient } from "./lib/queryClient";
export { useProjectStore } from "./stores/projectStore";
export { apiClient, ApiError } from "./lib/apiClient";

// Types (re-export for downstream consumers)
export type { ThemeId, ThemeMode, ThemeConfig } from "./types/theme";
export type { KeyBinding, KeyCombo } from "./types/keyboard";
export type { SidebarState, NavItem } from "./types/layout";
export type { Command } from "./types/command";
export type {
  ProjectSummary,
  ProjectDetail,
  ProjectListResponse,
  PaginationParams,
} from "./types/api";
