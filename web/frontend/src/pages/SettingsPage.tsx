import { useMemo } from "react";
import {
  PageHeader,
  SurfaceCard,
  DataTable,
  ThemePicker,
  Kbd,
  type Column,
} from "@/components/primitives";
import { useTheme } from "@/hooks/useTheme";
import { useGlobalBindings } from "@/context/KeyboardContext";
import { THEMES, type ThemeId } from "@/types/theme";

interface ShortcutRow {
  id: string;
  keys: string[];
  description: string;
  category: string;
}

// Verified swatches — matches Header.tsx (themes/*-dark.css --th-accent).
const THEME_SWATCHES: Record<ThemeId, string> = {
  everforest: "#A7C080",
  catppuccin: "#A6E3A1",
  gruvbox: "#B8BB26",
  tokyonight: "#9ECE6A",
};

export function SettingsPage() {
  const { themeId, mode, setThemeId, toggleMode } = useTheme();
  const bindings = useGlobalBindings();

  const pickerThemes = useMemo(
    () =>
      THEMES.map((t) => ({
        id: t.id,
        label: t.label,
        swatch: THEME_SWATCHES[t.id],
      })),
    [],
  );

  const shortcutRows: ShortcutRow[] = useMemo(
    () =>
      bindings.map((b, i) => ({
        id: `${b.keys.join("+")}-${i}`,
        keys: b.keys,
        description: b.description,
        category: b.category,
      })),
    [bindings],
  );

  const shortcutCols: Column<ShortcutRow>[] = [
    {
      id: "keys",
      header: "Keys",
      cell: (r) => (
        <span className="flex items-center gap-1">
          {r.keys.map((k, i) => (
            <Kbd key={i}>{k}</Kbd>
          ))}
        </span>
      ),
    },
    {
      id: "description",
      header: "Description",
      cell: (r) => <span className="text-sm text-fg">{r.description}</span>,
    },
    {
      id: "category",
      header: "Category",
      cell: (r) => (
        <span className="text-xs text-muted font-mono">{r.category}</span>
      ),
    },
  ];

  const appVersion =
    typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "";

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Settings"
        breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Settings" }]}
      />

      <SurfaceCard elevation={1} className="p-4 space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-muted font-semibold">
          Theme
        </h2>
        <ThemePicker
          themeId={themeId}
          mode={mode}
          onThemeIdChange={(id) => setThemeId(id as ThemeId)}
          onModeToggle={toggleMode}
          themes={pickerThemes}
        />
      </SurfaceCard>

      <SurfaceCard elevation={1} className="p-4 space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-muted font-semibold">
          Keyboard shortcuts
        </h2>
        <DataTable
          columns={shortcutCols}
          rows={shortcutRows}
          getRowKey={(r) => r.id}
          empty={
            <p className="text-sm text-muted text-center py-4">
              No shortcuts registered
            </p>
          }
        />
      </SurfaceCard>

      <SurfaceCard elevation={1} className="p-4 space-y-2">
        <h2 className="text-xs uppercase tracking-wider text-muted font-semibold">
          About
        </h2>
        <dl className="text-sm space-y-1">
          <div className="flex gap-2">
            <dt className="text-muted w-24">Version</dt>
            <dd className="font-mono text-fg">{appVersion || "--"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted w-24">State</dt>
            <dd className="font-mono text-fg">.planning/STATE.json</dd>
          </div>
        </dl>
      </SurfaceCard>
    </div>
  );
}
