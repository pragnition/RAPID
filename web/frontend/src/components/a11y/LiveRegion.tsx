import type { ReactNode } from "react";

export interface LiveRegionProps {
  /** aria-live mode. Default: 'polite'. Use 'assertive' for errors. */
  mode?: "polite" | "assertive";
  /** Mark the region busy during active streaming (suppresses interim reads). */
  busy?: boolean;
  /** The text to announce. Swapping this prop triggers an announcement. */
  children?: ReactNode;
}

/**
 * Visually hidden `<div aria-live>` for screen-reader announcements.
 * Used for streaming agent text, status pill transitions, and error messages.
 */
export function LiveRegion({
  mode = "polite",
  busy = false,
  children,
}: LiveRegionProps) {
  return (
    <div
      aria-live={mode}
      aria-atomic="true"
      aria-busy={busy}
      className="sr-only"
    >
      {children}
    </div>
  );
}
