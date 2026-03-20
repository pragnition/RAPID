// Stub -- fleshed out in Task 6
interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  return (
    <div
      className="fixed inset-0 z-60 flex items-start justify-center pt-[20vh]"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      role="button"
      tabIndex={-1}
    >
      <div
        className="bg-surface-0 border border-border rounded-lg shadow-lg w-full max-w-md p-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <p className="text-muted text-sm">Command palette (stub)</p>
      </div>
    </div>
  );
}
