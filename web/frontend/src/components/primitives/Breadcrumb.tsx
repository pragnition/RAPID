import { Fragment, type ReactNode } from "react";
import { NavLink } from "react-router";

export interface BreadcrumbSegment {
  label: string;
  to?: string;
}

export interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
  separator?: ReactNode;
  className?: string;
}

/**
 * Mono breadcrumb rendered as "A / B / C". The final segment is rendered in `text-fg`; prior
 * segments are `text-muted`. Unlinked segments render as `<span>`, linked segments via
 * `NavLink` from `react-router`.
 */
export function Breadcrumb({ segments, separator = "/", className }: BreadcrumbProps) {
  const cls = [
    "flex items-center gap-2 text-xs font-mono text-muted",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <nav aria-label="Breadcrumb" className={cls}>
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const toneClass = isLast ? "text-fg" : "text-muted";
        return (
          <Fragment key={`${segment.label}-${index}`}>
            {segment.to && !isLast ? (
              <NavLink to={segment.to} className={`${toneClass} hover:text-fg`}>
                {segment.label}
              </NavLink>
            ) : (
              <span className={toneClass}>{segment.label}</span>
            )}
            {!isLast ? (
              <span className="text-muted" aria-hidden="true">
                {separator}
              </span>
            ) : null}
          </Fragment>
        );
      })}
    </nav>
  );
}
