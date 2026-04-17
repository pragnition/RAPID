import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { commandRegistry, type Command } from "@/types/command";
import { NAV_ITEMS } from "@/types/layout";
import { SurfaceCard, Kbd } from "@/components/primitives";

interface CommandPaletteProps {
  onClose: () => void;
}

const SLASH_COMMANDS: string[] = [
  "rapid:status",
  "rapid:plan-set",
  "rapid:execute-set",
  "rapid:discuss-set",
  "rapid:start-set",
  "rapid:review",
  "rapid:merge",
];

// Entry-type glyphs per wireframe §02 (line 568 .cmd-input::before and siblings)
const ICON_NAV = "#";
const ICON_SET = "@";
const ICON_CMD = ">";

function categoryIcon(category: string): string {
  switch (category) {
    case "set-jump":
      return ICON_SET;
    case "command":
      return ICON_CMD;
    case "navigation":
    default:
      return ICON_NAV;
  }
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Register default navigation + slash commands on mount.
  useEffect(() => {
    const registeredIds: string[] = [];

    // Navigation: one entry per NAV_ITEMS page.
    for (const item of NAV_ITEMS) {
      const id = `nav-${item.id}`;
      commandRegistry.register({
        id,
        label: `Go to ${item.label}`,
        shortcut: item.shortcut,
        category: "navigation",
        action: () => {
          navigate(item.path);
        },
      });
      registeredIds.push(id);
    }

    // Slash commands — dispatched via agent runtime (stub toast for now).
    for (const cmd of SLASH_COMMANDS) {
      const id = `cmd-${cmd}`;
      commandRegistry.register({
        id,
        label: cmd,
        category: "command",
        action: () => {
          // TODO: replace with real runtime dispatch once skill-invocation-ui lands.
          // eslint-disable-next-line no-console
          console.log(`command ${cmd} is dispatched via agent runtime`);
        },
      });
      registeredIds.push(id);
    }

    // Set-jump: wire when sets API lands.
    // TODO: wire set-jump once sets API lands

    return () => {
      for (const id of registeredIds) commandRegistry.unregister(id);
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
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-label="Command palette"
    >
      <SurfaceCard
        elevation={2}
        className="w-[640px] max-w-[90vw] overflow-hidden"
        onClick={() => {
          /* intercept to keep palette open when clicking inside card */
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          role="listbox"
        >
          {/* Search input with mono "> " prefix per wireframe §02 */}
          <div className="border-b border-border px-4 py-3">
            <div className="relative flex items-center">
              <span
                aria-hidden="true"
                className="absolute left-3 text-accent font-mono text-sm select-none"
              >
                {ICON_CMD}
              </span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sets, pages, commands..."
                className="
                  w-full bg-surface-1 text-fg border border-border rounded
                  pl-8 pr-3 py-2 text-sm font-mono placeholder:text-muted
                  focus:outline-none focus:ring-1 focus:ring-accent
                "
                aria-label="Search commands"
              />
            </div>
          </div>

          {/* Results list */}
          <div className="max-h-80 overflow-y-auto py-1">
            {results.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted">No commands found</div>
            ) : (
              results.map((cmd, i) => {
                const active = i === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => executeCommand(cmd)}
                    role="option"
                    aria-selected={active}
                    className={`
                      w-full text-left
                      grid grid-cols-[24px_1fr_auto] items-center gap-3 px-3 py-2 rounded-md
                      text-sm transition-colors duration-75
                      ${active ? "bg-surface-3 text-accent" : "text-fg hover:bg-hover"}
                    `}
                  >
                    <span
                      className="font-mono text-accent text-center"
                      aria-hidden="true"
                    >
                      {categoryIcon(cmd.category)}
                    </span>
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{cmd.label}</span>
                      <span className="text-xs text-muted bg-surface-2 px-1.5 py-0.5 rounded shrink-0">
                        {cmd.category}
                      </span>
                    </span>
                    {cmd.shortcut ? <Kbd>{cmd.shortcut}</Kbd> : <span />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
