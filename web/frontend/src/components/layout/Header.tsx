import { useMemo } from "react";
import { useLocation } from "react-router";
import { useTheme } from "@/hooks/useTheme";
import { useLayoutStore } from "@/hooks/useLayoutStore";
import { THEMES, type ThemeId } from "@/types/theme";
import {
  Breadcrumb,
  type BreadcrumbSegment,
  SearchInput,
  ThemePicker,
} from "@/components/primitives";

interface HeaderProps {
  onToggleShortcuts: () => void;
  onOpenPalette: () => void;
}

// Verified from web/frontend/src/styles/themes/*-dark.css — --th-accent values.
const THEME_SWATCHES: Record<ThemeId, string> = {
  everforest: "#A7C080",
  catppuccin: "#A6E3A1",
  gruvbox: "#B8BB26",
  tokyonight: "#9ECE6A",
};

function titleCase(segment: string): string {
  if (!segment) return segment;
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

function buildBreadcrumb(pathname: string): BreadcrumbSegment[] {
  const trimmed = pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!trimmed) {
    return [{ label: "RAPID" }, { label: "Dashboard" }];
  }
  const parts = trimmed.split("/");
  const segments: BreadcrumbSegment[] = [{ label: "RAPID", to: "/" }];
  let acc = "";
  parts.forEach((part, idx) => {
    acc += `/${part}`;
    const isLast = idx === parts.length - 1;
    segments.push({
      label: titleCase(part),
      to: isLast ? undefined : acc,
    });
  });
  return segments;
}

export function Header({ onToggleShortcuts, onOpenPalette }: HeaderProps) {
  const { themeId, mode, setThemeId, toggleMode } = useTheme();
  const sidebarState = useLayoutStore((s) => s.sidebarState);
  const toggleMobileDrawer = useLayoutStore((s) => s.toggleMobileDrawer);
  const location = useLocation();

  // Offset the header based on sidebar width
  const marginClass =
    sidebarState === "full"
      ? "md:ml-[232px]"
      : sidebarState === "compact"
        ? "md:ml-16"
        : "md:ml-0";

  const breadcrumbSegments = useMemo(
    () => buildBreadcrumb(location.pathname),
    [location.pathname],
  );

  const pickerThemes = useMemo(
    () =>
      THEMES.map((t) => ({
        id: t.id,
        label: t.label,
        swatch: THEME_SWATCHES[t.id],
      })),
    [],
  );

  return (
    <header
      className={`
        fixed top-0 right-0 left-0 z-20 h-14
        bg-surface-0 border-b border-border
        flex items-center justify-between px-4 gap-4
        transition-all duration-200
        ${marginClass}
      `}
    >
      {/* Left section: hamburger + breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          className="md:hidden text-fg hover:text-accent p-1"
          onClick={toggleMobileDrawer}
          aria-label="Toggle sidebar"
        >
          <span className="text-xl">&#9776;</span>
        </button>

        <div className="hidden sm:block min-w-0">
          <Breadcrumb segments={breadcrumbSegments} />
        </div>
      </div>

      {/* Center section: search input (opens palette) */}
      <div
        className="flex-1 max-w-xl hidden md:flex justify-center"
        onClickCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenPalette();
        }}
        role="button"
        tabIndex={-1}
        aria-label="Open command palette"
      >
        <SearchInput
          value=""
          onChange={() => {
            /* palette owns input state; clicking routes to palette */
          }}
          onSubmit={() => onOpenPalette()}
          placeholder="Search sets, pages, commands"
          shortcutHint="⌘K"
          minWidth={280}
          aria-label="Search sets, pages, commands"
          className="cursor-pointer"
        />
      </div>

      {/* Right section: theme picker + shortcut hint */}
      <div className="flex items-center gap-2">
        <ThemePicker
          themeId={themeId}
          mode={mode}
          onThemeIdChange={(id) => setThemeId(id as ThemeId)}
          onModeToggle={toggleMode}
          themes={pickerThemes}
        />

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
