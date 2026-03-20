import { useTheme } from "@/hooks/useTheme";
import { useLayoutStore } from "@/hooks/useLayoutStore";
import { THEMES, type ThemeId } from "@/types/theme";

interface HeaderProps {
  onToggleShortcuts: () => void;
}

export function Header({ onToggleShortcuts }: HeaderProps) {
  const { themeId, mode, setThemeId, toggleMode } = useTheme();
  const sidebarState = useLayoutStore((s) => s.sidebarState);
  const toggleMobileDrawer = useLayoutStore((s) => s.toggleMobileDrawer);

  // Offset the header based on sidebar width
  const marginClass =
    sidebarState === "full"
      ? "md:ml-60"
      : sidebarState === "compact"
        ? "md:ml-16"
        : "md:ml-0";

  return (
    <header
      className={`
        fixed top-0 right-0 left-0 z-20 h-12
        bg-surface-0 border-b border-border
        flex items-center justify-between px-4
        transition-all duration-200
        ${marginClass}
      `}
    >
      {/* Left section */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden text-fg hover:text-accent p-1"
          onClick={toggleMobileDrawer}
          aria-label="Toggle sidebar"
        >
          <span className="text-xl">&#9776;</span>
        </button>

        {/* Breadcrumb placeholder */}
        <span className="text-sm text-muted hidden sm:inline">
          RAPID Mission Control
        </span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Theme selector */}
        <select
          value={themeId}
          onChange={(e) => setThemeId(e.target.value as ThemeId)}
          className="
            bg-surface-1 text-fg border border-border rounded px-2 py-1
            text-sm cursor-pointer
            hover:bg-hover focus:outline-none focus:ring-1 focus:ring-accent
          "
          aria-label="Select theme"
        >
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        {/* Dark/light mode toggle */}
        <button
          type="button"
          onClick={toggleMode}
          className="
            bg-surface-1 text-fg border border-border rounded px-2 py-1
            text-sm hover:bg-hover
            focus:outline-none focus:ring-1 focus:ring-accent
          "
          aria-label={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
        >
          {mode === "dark" ? "\u2600" : "\u263D"}
        </button>

        {/* Keyboard shortcut hint */}
        <button
          type="button"
          onClick={onToggleShortcuts}
          className="
            bg-surface-1 text-fg border border-border rounded px-2 py-1
            text-sm font-mono hover:bg-hover
            focus:outline-none focus:ring-1 focus:ring-accent
          "
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          ?
        </button>
      </div>
    </header>
  );
}
