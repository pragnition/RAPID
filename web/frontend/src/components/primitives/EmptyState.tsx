import type { ReactNode } from "react";
import { SurfaceCard } from "./SurfaceCard";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Centered empty-state card. Pairs with a `SurfaceCard` elevation-1 surface,
 * caps width at `max-w-md`, centers text, reserves space for optional icon + actions.
 */
export function EmptyState({
  title,
  description,
  icon,
  actions,
  className,
}: EmptyStateProps) {
  const cls = [
    "max-w-md mx-auto text-center py-12 px-6",
    "flex flex-col items-center gap-3",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <SurfaceCard elevation={1} className={cls}>
      {icon ? <div className="text-muted">{icon}</div> : null}
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      {description ? <p className="text-sm text-muted">{description}</p> : null}
      {actions ? <div className="flex items-center gap-2 mt-2">{actions}</div> : null}
    </SurfaceCard>
  );
}
