import type { ReactNode } from "react";
import { Breadcrumb, type BreadcrumbSegment } from "./Breadcrumb";

export interface PageHeaderProps {
  title: string;
  breadcrumb?: BreadcrumbSegment[];
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * Two-row page header: optional breadcrumb row, title + actions row, optional description.
 * Spacing only — no decorative separator.
 */
export function PageHeader({
  title,
  breadcrumb,
  description,
  actions,
  className,
}: PageHeaderProps) {
  const cls = ["flex flex-col gap-2", className ?? ""].filter(Boolean).join(" ");
  return (
    <header className={cls}>
      {breadcrumb && breadcrumb.length > 0 ? <Breadcrumb segments={breadcrumb} /> : null}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-fg leading-tight">{title}</h1>
        {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
      </div>
      {description ? <p className="text-muted text-sm">{description}</p> : null}
    </header>
  );
}
