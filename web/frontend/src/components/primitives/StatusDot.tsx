import type { CSSProperties } from "react";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";

export type StatusDotTone =
  | "accent"
  | "link"
  | "warning"
  | "error"
  | "info"
  | "muted"
  | "highlight"
  | "orange";

export interface StatusDotProps {
  tone: StatusDotTone;
  size?: "sm" | "md";
  pulse?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

const TONE_BG: Record<StatusDotTone, string> = {
  accent: "bg-accent",
  link: "bg-link",
  warning: "bg-warning",
  error: "bg-error",
  info: "bg-info",
  muted: "bg-muted",
  highlight: "bg-highlight",
  orange: "bg-orange",
};

/**
 * Small colored circle indicating state. Always paired with a visible text label by the caller.
 * When `pulse` is true the dot animates; the animation is suppressed when the user prefers
 * reduced motion.
 */
export function StatusDot({
  tone,
  size = "md",
  pulse = false,
  className,
  style,
  "aria-label": ariaLabel,
}: StatusDotProps) {
  const reducedMotion = usePrefersReducedMotion();
  const sizeClass = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";
  const pulseClass = pulse && !reducedMotion ? "animate-pulse" : "";
  const cls = [
    "inline-block rounded-full shrink-0",
    sizeClass,
    TONE_BG[tone],
    pulseClass,
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span
      className={cls}
      style={style}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    />
  );
}
