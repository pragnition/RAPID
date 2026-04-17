import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";

export interface StreamingCursorProps {
  active: boolean;
  className?: string;
}

/**
 * Inline blinking block cursor used during token streaming.
 * Animation is suppressed when the user prefers reduced motion.
 *
 * We co-locate the @keyframes via a CSS custom property and inline <style> scoped to this
 * component to avoid polluting global.css per Wave 1 ownership rules.
 */
export function StreamingCursor({ active, className }: StreamingCursorProps) {
  const reducedMotion = usePrefersReducedMotion();
  const animate = active && !reducedMotion;
  const cls = [
    "inline-block align-[-2px] bg-accent",
    "rapid-streaming-cursor",
    active ? "opacity-100" : "opacity-0",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <style>{`
        @keyframes rapid-streaming-cursor-blink {
          0%, 50% { opacity: 1; }
          50.01%, 100% { opacity: 0; }
        }
        .rapid-streaming-cursor {
          width: 7px;
          height: 16px;
        }
        .rapid-streaming-cursor[data-animate="true"] {
          animation: rapid-streaming-cursor-blink 1.1s steps(2) infinite;
        }
      `}</style>
      <span className={cls} data-animate={animate ? "true" : "false"} aria-hidden="true" />
    </>
  );
}
