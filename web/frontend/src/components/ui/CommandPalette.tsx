import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { commandRegistry, type Command } from "@/types/command";

interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Register default navigation commands on mount
  useEffect(() => {
    const navCommands: Array<{ id: string; label: string; path: string; shortcut?: string }> = [
      { id: "nav-dashboard", label: "Go to Dashboard", path: "/", shortcut: "gd" },
      { id: "nav-projects", label: "Go to Projects", path: "/projects", shortcut: "gp" },
      { id: "nav-graph", label: "Go to Graph", path: "/graph" },
      { id: "nav-notes", label: "Go to Notes", path: "/notes" },
      { id: "nav-settings", label: "Go to Settings", path: "/settings" },
    ];

    for (const cmd of navCommands) {
      commandRegistry.register({
        id: cmd.id,
        label: cmd.label,
        shortcut: cmd.shortcut,
        category: "Navigation",
        action: () => {
          navigate(cmd.path);
        },
      });
    }

    return () => {
      for (const cmd of navCommands) {
        commandRegistry.unregister(cmd.id);
      }
    };
  }, [navigate]);

  const results = useMemo(() => commandRegistry.search(query), [query]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  // Autofocus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const executeCommand = useCallback(
    (command: Command) => {
      command.action();
      onClose();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % Math.max(results.length, 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev <= 0 ? Math.max(results.length - 1, 0) : prev - 1,
          );
          break;
        case "Enter": {
          e.preventDefault();
          const selected = results[selectedIndex];
          if (selected) executeCommand(selected);
          break;
        }
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, selectedIndex, executeCommand, onClose],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-label="Command palette"
    >
      <div
        className="bg-surface-0 border border-border rounded-lg shadow-lg w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="listbox"
      >
        {/* Search input */}
        <div className="border-b border-border px-4 py-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="
              w-full bg-surface-1 text-fg border border-border rounded px-3 py-2
              text-sm placeholder:text-muted
              focus:outline-none focus:ring-1 focus:ring-accent
            "
            aria-label="Search commands"
          />
        </div>

        {/* Results list */}
        <div className="max-h-64 overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted">No commands found</div>
          ) : (
            results.map((cmd, i) => (
              <button
                key={cmd.id}
                type="button"
                className={`
                  w-full text-left px-4 py-2 flex items-center justify-between
                  text-sm transition-colors duration-75
                  ${i === selectedIndex ? "bg-hover text-accent" : "text-fg hover:bg-hover"}
                `}
                onClick={() => executeCommand(cmd)}
                role="option"
                aria-selected={i === selectedIndex}
              >
                <div className="flex items-center gap-3">
                  <span>{cmd.label}</span>
                  <span className="text-xs text-muted bg-surface-2 px-1.5 py-0.5 rounded">
                    {cmd.category}
                  </span>
                </div>
                {cmd.shortcut && (
                  <kbd className="bg-surface-2 px-2 py-0.5 rounded text-xs font-mono text-muted">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
