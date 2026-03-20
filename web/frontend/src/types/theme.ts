export type ThemeId = "everforest" | "catppuccin" | "gruvbox" | "tokyonight";
export type ThemeMode = "dark" | "light";

export interface ThemeConfig {
  id: ThemeId;
  label: string;
}

export const THEMES: ThemeConfig[] = [
  { id: "everforest", label: "Everforest" },
  { id: "catppuccin", label: "Catppuccin" },
  { id: "gruvbox", label: "Gruvbox" },
  { id: "tokyonight", label: "Tokyo Night" },
];

export function getThemeDataAttr(id: ThemeId, mode: ThemeMode): string {
  return `${id}-${mode}`;
}
