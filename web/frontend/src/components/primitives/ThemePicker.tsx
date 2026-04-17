export interface ThemePickerTheme {
  id: string;
  label: string;
  swatch: string;
}

export interface ThemePickerProps {
  themeId: string;
  mode: "dark" | "light";
  onThemeIdChange: (id: string) => void;
  onModeToggle: () => void;
  themes: ThemePickerTheme[];
  className?: string;
}

/**
 * Presentational theme picker: row of color swatches + a mode toggle.
 * Wave 2 wires persistence and `<html data-theme>` application.
 * Swatches use caller-supplied preview colors via inline `style.backgroundColor`
 * (matches wireframe.html:~692 — each theme's own accent preview).
 */
export function ThemePicker({
  themeId,
  mode,
  onThemeIdChange,
  onModeToggle,
  themes,
  className,
}: ThemePickerProps) {
  const cls = [
    "inline-flex items-center gap-2 p-1",
    "bg-surface-1 border border-border rounded",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} role="group" aria-label="Theme picker">
      <div className="flex items-center gap-1">
        {themes.map((theme) => {
          const active = theme.id === themeId;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onThemeIdChange(theme.id)}
              title={theme.label}
              aria-label={`Select ${theme.label} theme`}
              aria-pressed={active}
              className={[
                "w-4 h-4 rounded-full border border-border shrink-0",
                active ? "ring-2 ring-accent" : "hover:opacity-80",
              ].join(" ")}
              style={{ backgroundColor: theme.swatch }}
            />
          );
        })}
      </div>
      <button
        type="button"
        onClick={onModeToggle}
        aria-label={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
        className="px-2 py-0.5 text-[11px] font-mono uppercase text-muted hover:text-fg border-l border-border"
      >
        {mode}
      </button>
    </div>
  );
}
