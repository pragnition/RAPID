import type { ReactNode } from "react";
import { SurfaceCard } from "./SurfaceCard";

export interface ErrorCardProps {
  title: string;
  body: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Chat-surface error surface. Accent-error left border, circular error glyph, bold title,
 * dim body, optional action row.
 */
export function ErrorCard({ title, body, actions, className }: ErrorCardProps) {
  const cls = ["p-4 flex gap-3", className ?? ""].filter(Boolean).join(" ");
  return (
    <SurfaceCard accentBorder="error" className={cls} as="section">
      <div
        className="mt-0.5 w-3 h-3 rounded-full bg-error shrink-0"
        aria-hidden="true"
      />
      <div className="flex-1 flex flex-col gap-1">
        <div className="text-sm font-bold text-error">{title}</div>
        <div className="text-sm text-fg-dim">{body}</div>
        {actions ? <div className="flex items-center gap-2 mt-1">{actions}</div> : null}
      </div>
    </SurfaceCard>
  );
}
