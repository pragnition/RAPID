// Stub -- fleshed out in Task 7
interface TooltipOverlayProps {
  onClose: () => void;
}

export function TooltipOverlay({ onClose }: TooltipOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      role="button"
      tabIndex={-1}
    >
      <div
        className="bg-surface-0 border border-border rounded-lg shadow-lg p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <p className="text-muted text-sm">Keyboard shortcuts (stub)</p>
      </div>
    </div>
  );
}
