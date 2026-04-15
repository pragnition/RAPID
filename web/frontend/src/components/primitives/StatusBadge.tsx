import type { ReactNode } from "react";
import type { StatusDotTone } from "./StatusDot";

export interface StatusBadgeProps {
  label: string;
  tone: StatusDotTone;
  icon?: ReactNode;
  className?: string;
}

const TONE_BG: Record<StatusDotTone, string> = {
  accent: "bg-accent/20 text-accent",
  link: "bg-link/20 text-link",
  warning: "bg-warning/20 text-warning",
  error: "bg-error/20 text-error",
  info: "bg-info/20 text-info",
  muted: "bg-muted/20 text-muted",
  highlight: "bg-highlight/20 text-highlight",
  orange: "bg-orange/20 text-orange",
};

/**
 * Compact mono badge with tone-tinted background and text.
 * Optional leading icon slot renders before the label.
 */
export function StatusBadge({ label, tone, icon, className }: StatusBadgeProps) {
  const cls = [
    "inline-flex items-center gap-1 rounded px-2 py-0.5",
    "text-xs font-mono font-semibold",
    TONE_BG[tone],
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls}>
      {icon ? <span className="inline-flex items-center">{icon}</span> : null}
      {label}
    </span>
  );
}
