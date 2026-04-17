import type { ReactNode } from "react";

export type StatCardTone = "accent" | "orange" | "warning" | "info";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  tone?: StatCardTone;
  trend?: ReactNode;
  className?: string;
}

const TONE_TEXT: Record<StatCardTone, string> = {
  accent: "text-accent",
  orange: "text-orange",
  warning: "text-warning",
  info: "text-info",
};

/**
 * Metric tile. Uppercase label above a large toned number; optional trend slot below.
 */
export function StatCard({
  label,
  value,
  tone = "accent",
  trend,
  className,
}: StatCardProps) {
  const cls = ["flex flex-col gap-1", className ?? ""].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <h2 className="text-xs text-muted uppercase tracking-wider font-semibold">{label}</h2>
      <div className={`text-[28px] font-bold leading-[1.1] ${TONE_TEXT[tone]}`}>{value}</div>
      {trend ? <div className="text-xs text-muted">{trend}</div> : null}
    </div>
  );
}
