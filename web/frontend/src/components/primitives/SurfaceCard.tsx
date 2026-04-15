import type { ReactNode, CSSProperties } from "react";

export type SurfaceAccentTone =
  | "accent"
  | "warning"
  | "error"
  | "info"
  | "highlight"
  | "orange";

export interface SurfaceCardProps {
  as?: "div" | "section" | "article";
  elevation?: 1 | 2 | 3;
  accentBorder?: SurfaceAccentTone;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  onClick?: () => void;
}

const ELEVATION_BG: Record<1 | 2 | 3, string> = {
  1: "bg-surface-1",
  2: "bg-surface-2",
  3: "bg-surface-3",
};

const ACCENT_BORDER: Record<SurfaceAccentTone, string> = {
  accent: "border-l-[3px] border-l-accent",
  warning: "border-l-[3px] border-l-warning",
  error: "border-l-[3px] border-l-error",
  info: "border-l-[3px] border-l-info",
  highlight: "border-l-[3px] border-l-highlight",
  orange: "border-l-[3px] border-l-orange",
};

/**
 * Elevation-aware card surface. Surface defaults to `surface-1` and may be raised via
 * `elevation=2|3`. An optional `accentBorder` adds a 3px colored left stripe (no new token —
 * uses Tailwind arbitrary border width per Wave 1 design).
 */
export function SurfaceCard({
  as = "div",
  elevation = 1,
  accentBorder,
  className,
  style,
  children,
  onClick,
}: SurfaceCardProps) {
  const Tag = as;
  const cls = [
    ELEVATION_BG[elevation],
    "border border-border rounded-lg",
    accentBorder ? ACCENT_BORDER[accentBorder] : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={cls} style={style} onClick={onClick}>
      {children}
    </Tag>
  );
}
