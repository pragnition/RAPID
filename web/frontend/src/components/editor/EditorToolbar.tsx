interface EditorToolbarProps {
  onBold: () => void;
  onItalic: () => void;
  onHeading: () => void;
  onLink: () => void;
  onCode: () => void;
  vimMode: boolean;
  onToggleVim: () => void;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
}

export function EditorToolbar({
  onBold,
  onItalic,
  onHeading,
  onLink,
  onCode,
  vimMode,
  onToggleVim,
  isDirty,
  isSaving,
  lastSavedAt,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-surface-0 border-b border-border">
      {/* Formatting buttons */}
      <ToolbarButton onClick={onBold} title="Bold (wrap with **)">
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton onClick={onItalic} title="Italic (wrap with _)">
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton onClick={onHeading} title="Heading (## )">
        <span className="font-semibold text-xs">H</span>
      </ToolbarButton>
      <ToolbarButton onClick={onLink} title="Insert link">
        <span className="text-xs">Link</span>
      </ToolbarButton>
      <ToolbarButton onClick={onCode} title="Code block (```)">
        <span className="font-mono text-xs">&lt;/&gt;</span>
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Vim toggle */}
      <button
        type="button"
        onClick={onToggleVim}
        title={vimMode ? "Disable Vim mode" : "Enable Vim mode"}
        className={`
          px-2 py-1 text-xs font-mono rounded transition-colors
          ${
            vimMode
              ? "bg-accent/20 text-accent"
              : "text-muted hover:text-fg hover:bg-hover"
          }
        `}
      >
        Vim
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save indicator */}
      <SaveIndicator
        isDirty={isDirty}
        isSaving={isSaving}
        lastSavedAt={lastSavedAt}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

function ToolbarButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="
        w-7 h-7 flex items-center justify-center rounded
        text-muted hover:text-fg hover:bg-hover
        transition-colors
      "
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Save indicator
// ---------------------------------------------------------------------------

function SaveIndicator({
  isDirty,
  isSaving,
  lastSavedAt,
}: {
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
}) {
  if (isSaving) {
    return <span className="text-xs text-muted">Saving...</span>;
  }
  if (isDirty) {
    return <span className="text-xs text-muted">Unsaved changes</span>;
  }
  if (lastSavedAt) {
    return (
      <span className="text-xs text-muted">
        Saved at {formatTime(lastSavedAt)}
      </span>
    );
  }
  return null;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
