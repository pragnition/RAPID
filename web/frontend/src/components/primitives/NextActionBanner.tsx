import type { ReactNode } from "react";
import { StatusBadge, type StatusBadgeProps } from "./StatusBadge";

export interface NextActionBannerProps {
  command: string;
  status?: StatusBadgeProps;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * Full-width "next suggested action" strip for Dashboard-style surfaces.
 * Mono command on the left; optional StatusBadge on the right; optional secondary
 * description + inline actions row.
 */
export function NextActionBanner({
  command,
  status,
  description,
  actions,
  className,
}: NextActionBannerProps) {
  const cls = [
    "w-full bg-surface-1 border border-border rounded-lg p-4",
    "flex flex-col gap-2",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <section className={cls}>
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-sm text-fg truncate">{command}</div>
        {status ? <StatusBadge {...status} /> : null}
      </div>
      {description ? <div className="text-xs text-muted">{description}</div> : null}
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </section>
  );
}
