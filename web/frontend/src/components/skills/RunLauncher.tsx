import { useCallback, useEffect, useRef } from "react";
import { SkillLauncher } from "./SkillLauncher";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RunLauncherProps {
  open: boolean;
  skillName: string | null;
  projectId: string;
  defaultSetId?: string;
  onClose: () => void;
  onLaunched: (runId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Portal-style modal wrapper around SkillLauncher.
 * Escape and backdrop-click both close.
 */
export function RunLauncher({
  open,
  skillName,
  projectId,
  defaultSetId,
  onClose,
  onLaunched,
}: RunLauncherProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Backdrop click handler
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === backdropRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  // Dispatch handler: fire onLaunched then close
  const handleDispatched = useCallback(
    (runId: string) => {
      onLaunched(runId);
      onClose();
    },
    [onLaunched, onClose],
  );

  if (!open || !skillName) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-surface-1 border border-border rounded-lg shadow-xl">
        <SkillLauncher
          skillName={skillName}
          projectId={projectId}
          defaultSetId={defaultSetId}
          onDispatched={handleDispatched}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
