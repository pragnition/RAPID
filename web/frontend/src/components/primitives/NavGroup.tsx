import type { ReactNode } from "react";

export interface NavGroupProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * Sidebar section grouping. Renders a small uppercase label followed by the children.
 * Stateless — no collapse behavior (not in wireframe).
 */
export function NavGroup({ label, children, className }: NavGroupProps) {
  const cls = ["flex flex-col", className ?? ""].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <div className="text-[10px] uppercase tracking-wider text-muted px-3 pt-4 pb-1 font-semibold">
        {label}
      </div>
      {children}
    </div>
  );
}
