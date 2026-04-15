import { StatusDot } from "./StatusDot";

export interface HealthDotProps {
  online: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * Convenience wrapper around StatusDot for online/offline health indicators.
 * Online → green (`accent`) pulsing; offline → red (`error`) static.
 */
export function HealthDot({ online, className, "aria-label": ariaLabel }: HealthDotProps) {
  return (
    <StatusDot
      tone={online ? "accent" : "error"}
      pulse={online}
      className={className}
      aria-label={ariaLabel ?? (online ? "online" : "offline")}
    />
  );
}
